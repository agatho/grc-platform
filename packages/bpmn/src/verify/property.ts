/**
 * Property-based testing over modeling operations.
 *
 * The claim under test is not "this one edit works" but "**no** sequence of
 * edits leaves the model in a state that violates its invariants". That is the
 * only shape of test that can cover a stateful layer whose test space —
 * eighteen element types times twelve operations times container, lane and pool
 * context — cannot be enumerated (spike decision, criterion 3b).
 *
 * Three properties are checked:
 *
 *   P1  After **every single** operation the invariants hold. Not after the
 *       sequence: after each step. A sequence that ends valid but passes
 *       through a broken state is still a bug, because the user can save there.
 *   P2  The exported document re-imports, and the invariants hold on the
 *       re-imported tree too. This is the one that catches a model that is fine
 *       in memory and wrong on disk.
 *   P3  `n` undos after `n` operations restore the starting document, compared
 *       canonically. Off by default (it needs a sequence without its own undos)
 *       and driven separately.
 *
 * **Shrinking is not optional.** A property test without it reports "seed
 * 918273 failed after 40 operations", which is not a bug report. With it, the
 * same failure reduces to the two or three operations that actually matter, and
 * that *is* a bug report. The reducer below is delta debugging (ddmin) over the
 * operation list, followed by a pass that simplifies individual operations.
 *
 * Guarding against shrinking to a *different* bug: a candidate subsequence only
 * counts as "still failing" when it fails with at least one of the invariant
 * ids of the original failure. Without that guard, ddmin happily reduces a
 * subtle lane bug to a trivial unrelated one and reports the wrong thing.
 */

import type { ModdleElement } from "bpmn-moddle";
import type { ModelingDriver, OperationOutcome } from "./driver";
import type { CheckOptions, InvariantViolation } from "./invariants";
import { checkAllInvariants, formatViolations } from "./invariants";
import { importXml } from "../model/io";
import {
  BOUNDARY_EVENT_DEFINITIONS,
  CREATABLE_TYPES,
  formatOperation,
  ref,
  serializeSequence,
  type Operation,
  type OperationKind,
} from "./operations";
import { AWKWARD_NAMES, Rng } from "./random";

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * How often each operation is drawn.
 *
 * The weights are not uniform on purpose. `createShape` and `connect` have to
 * dominate or the model shrinks to nothing within a few steps and the rest of
 * the vocabulary has nothing to act on; `undo`/`redo` are frequent because the
 * command stack is where a stateful layer breaks; `remove` is deliberately
 * lower than `create` so the diagram grows slowly rather than oscillating.
 */
const DEFAULT_WEIGHTS: readonly (readonly [OperationKind, number])[] = [
  ["createShape", 18],
  ["connect", 14],
  ["move", 10],
  ["rename", 8],
  ["remove", 8],
  ["attachBoundary", 8],
  ["reparent", 7],
  ["changeLane", 6],
  ["undo", 12],
  ["redo", 9],
];

export interface GenerateOptions {
  readonly weights?: readonly (readonly [OperationKind, number])[];
  /** Upper bound for selector indices. Larger means more of the model is hit. */
  readonly indexRange?: number;
}

export function generateOperation(
  rng: Rng,
  options: GenerateOptions = {},
): Operation {
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const range = options.indexRange ?? 24;
  const idx = (): number => rng.int(0, range);
  const coord = (): number => rng.int(0, 12) * 50 + 100;

  const kind = rng.weighted(weights);
  switch (kind) {
    case "createShape":
      return {
        kind,
        elementType: rng.pick(CREATABLE_TYPES),
        parent: ref("container", idx()),
        x: coord(),
        y: coord(),
      };
    case "move":
      return {
        kind,
        target: ref("flowNode", idx()),
        dx: rng.int(-6, 6) * 10,
        dy: rng.int(-6, 6) * 10,
      };
    case "connect":
      return {
        kind,
        source: ref("flowNode", idx()),
        target: ref("flowNode", idx()),
      };
    case "remove":
      return { kind, target: ref("removable", idx()) };
    case "reparent":
      return {
        kind,
        target: ref("flowNode", idx()),
        parent: ref("container", idx()),
        x: coord(),
        y: coord(),
      };
    case "changeLane":
      return { kind, target: ref("flowNode", idx()), lane: ref("lane", idx()) };
    case "attachBoundary":
      return {
        kind,
        host: ref("activity", idx()),
        eventDefinition: rng.pick(BOUNDARY_EVENT_DEFINITIONS),
      };
    case "rename":
      return {
        kind,
        target: ref("flowNode", idx()),
        name: rng.pick(AWKWARD_NAMES),
      };
    case "undo":
      return { kind };
    case "redo":
      return { kind };
  }
}

export function generateSequence(
  rng: Rng,
  length: number,
  options: GenerateOptions = {},
): Operation[] {
  const out: Operation[] = [];
  for (let i = 0; i < length; i += 1) out.push(generateOperation(rng, options));
  return out;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface StepTrace {
  readonly index: number;
  readonly operation: Operation;
  readonly outcome: OperationOutcome;
  readonly resolved: readonly string[];
  readonly error?: string;
}

export interface SequenceFailure {
  /** `-1` when the failure is in the export/re-import step, not in a step. */
  readonly step: number;
  readonly phase: "step" | "export" | "reimport" | "driver";
  readonly violations: readonly InvariantViolation[];
  readonly message: string;
}

export interface SequenceResult {
  readonly ok: boolean;
  readonly trace: readonly StepTrace[];
  readonly failure?: SequenceFailure;
  readonly exportedXml?: string;
  /**
   * Invariants the base document already violated before the first operation.
   * They are excluded from the verdict — an operation cannot be blamed for a
   * defect it inherited — but they are reported, because a corpus file that
   * cannot even be opened cleanly is a finding of its own.
   */
  readonly preExisting?: readonly InvariantViolation[];
}

export interface RunSequenceOptions {
  readonly checkOptions?: CheckOptions;
  /**
   * Check invariants after every step. Default `true` — turning it off makes a
   * run roughly four times faster and roughly four times less useful.
   */
  readonly perStep?: boolean;
  /** Also export, re-import and re-check at the end. Default `true`. */
  readonly checkExport?: boolean;
}

/**
 * Identity of a violation for baseline purposes: the invariant plus the element
 * it is anchored at. Deliberately not the message — messages carry counts and
 * ids that change while the defect stays the same.
 */
function violationKey(violation: InvariantViolation): string {
  return `${violation.id}|${violation.elementId ?? ""}`;
}

async function definitionsOf(driver: ModelingDriver): Promise<ModdleElement> {
  const live = driver.liveDefinitions();
  if (live) return live;
  const xml = await driver.exportXml();
  const { definitions } = await importXml(xml, { preserveSource: false });
  return definitions;
}

/** Run one sequence on a freshly loaded driver and report the first failure. */
export async function runSequence(
  driver: ModelingDriver,
  baseXml: string,
  ops: readonly Operation[],
  options: RunSequenceOptions = {},
): Promise<SequenceResult> {
  const trace: StepTrace[] = [];
  const perStep = options.perStep !== false;
  const checkExport = options.checkExport !== false;

  try {
    await driver.load(baseXml);
  } catch (error) {
    return {
      ok: false,
      trace,
      failure: {
        step: -1,
        phase: "driver",
        violations: [],
        message: `loading the base document failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }

  const baseReport = await checkAllInvariants(
    await definitionsOf(driver),
    options.checkOptions,
  );
  const baseline = new Set(baseReport.errors.map(violationKey));
  const preExisting = baseReport.errors;

  /** Errors this run introduced, i.e. that the base document did not have. */
  const introduced = (
    errors: readonly InvariantViolation[],
  ): InvariantViolation[] =>
    errors.filter((violation) => !baseline.has(violationKey(violation)));

  for (const [index, operation] of ops.entries()) {
    const result = await driver.apply(operation);
    trace.push({
      index,
      operation,
      outcome: result.outcome,
      resolved: result.resolved,
      ...(result.error !== undefined ? { error: result.error } : {}),
    });

    if (result.outcome === "threw") {
      return {
        ok: false,
        trace,
        preExisting,
        failure: {
          step: index,
          phase: "step",
          violations: [
            {
              id: "driver/threw",
              severity: "error",
              message: result.error ?? "unknown error",
            },
          ],
          message: `operation ${index} threw: ${result.error ?? "unknown error"}`,
        },
      };
    }

    if (!perStep || result.outcome !== "applied") continue;

    const report = await checkAllInvariants(
      await definitionsOf(driver),
      options.checkOptions,
    );
    const newErrors = introduced(report.errors);
    if (newErrors.length > 0) {
      return {
        ok: false,
        trace,
        preExisting,
        failure: {
          step: index,
          phase: "step",
          violations: newErrors,
          message: `invariants violated after operation ${index}`,
        },
      };
    }
  }

  if (!checkExport) return { ok: true, trace, preExisting };

  let exported: string;
  try {
    exported = await driver.exportXml();
  } catch (error) {
    return {
      ok: false,
      trace,
      preExisting,
      failure: {
        step: -1,
        phase: "export",
        violations: [],
        message: `export failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }

  try {
    const { definitions } = await importXml(exported, {
      preserveSource: false,
    });
    const report = await checkAllInvariants(definitions, options.checkOptions);
    const newErrors = introduced(report.errors);
    if (newErrors.length > 0) {
      return {
        ok: false,
        trace,
        exportedXml: exported,
        preExisting,
        failure: {
          step: -1,
          phase: "reimport",
          violations: newErrors,
          message:
            "the exported document violates the invariants after re-import — the model was fine in memory and is wrong on disk",
        },
      };
    }
  } catch (error) {
    return {
      ok: false,
      trace,
      exportedXml: exported,
      preExisting,
      failure: {
        step: -1,
        phase: "reimport",
        violations: [],
        message: `the exported document does not parse: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }

  return { ok: true, trace, exportedXml: exported, preExisting };
}

// ---------------------------------------------------------------------------
// Shrinking
// ---------------------------------------------------------------------------

type Runner = (ops: readonly Operation[]) => Promise<SequenceResult>;

function violationIds(failure: SequenceFailure | undefined): Set<string> {
  const ids = new Set<string>();
  for (const violation of failure?.violations ?? []) ids.add(violation.id);
  if (ids.size === 0 && failure) ids.add(`phase:${failure.phase}`);
  return ids;
}

function sameFailure(
  original: Set<string>,
  candidate: SequenceFailure | undefined,
): boolean {
  if (!candidate) return false;
  const ids = violationIds(candidate);
  for (const id of ids) if (original.has(id)) return true;
  return false;
}

/** Simplifications of a single operation, cheapest (most reduced) first. */
function simplifications(op: Operation): Operation[] {
  const out: Operation[] = [];
  switch (op.kind) {
    case "move":
      if (op.dx !== 0 || op.dy !== 0) out.push({ ...op, dx: 0, dy: 0 });
      if (op.dx !== 0) out.push({ ...op, dx: 0 });
      if (op.dy !== 0) out.push({ ...op, dy: 0 });
      break;
    case "rename":
      if (op.name !== "a") out.push({ ...op, name: "a" });
      break;
    case "createShape":
      if (op.elementType !== "bpmn:Task")
        out.push({ ...op, elementType: "bpmn:Task" });
      if (op.x !== 100 || op.y !== 100) out.push({ ...op, x: 100, y: 100 });
      break;
    case "attachBoundary":
      if (op.eventDefinition !== undefined)
        out.push({ ...op, eventDefinition: undefined });
      break;
    default:
      break;
  }
  // Selector indices: a smaller index is easier to read and usually resolves to
  // the same element anyway, because resolution is modulo the candidate count.
  for (const key of ["target", "source", "parent", "host", "lane"] as const) {
    const value = (op as Record<string, unknown>)[key];
    if (
      typeof value === "object" &&
      value !== null &&
      "index" in value &&
      typeof (value as { index: number }).index === "number" &&
      (value as { index: number }).index > 0
    ) {
      const current = value as { kind: string; index: number };
      out.push({
        ...op,
        [key]: { kind: current.kind, index: Math.floor(current.index / 2) },
      } as Operation);
    }
  }
  return out;
}

export interface ShrinkResult {
  readonly ops: readonly Operation[];
  /** How many candidate sequences were executed while shrinking. */
  readonly attempts: number;
  /** The run of the shrunk sequence, so the report can name real element ids. */
  readonly trace: readonly StepTrace[];
}

/**
 * Delta debugging over the operation list, then per-operation simplification.
 *
 * ddmin removes chunks rather than single operations, so a 40-operation
 * sequence usually collapses in a couple of dozen runs instead of 40.
 */
export async function shrinkSequence(
  ops: readonly Operation[],
  original: SequenceFailure,
  run: Runner,
  maxAttempts = 400,
): Promise<ShrinkResult> {
  const wanted = violationIds(original);
  let attempts = 0;

  const stillFails = async (
    candidate: readonly Operation[],
  ): Promise<boolean> => {
    if (candidate.length === 0 || attempts >= maxAttempts) return false;
    attempts += 1;
    const result = await run(candidate);
    return !result.ok && sameFailure(wanted, result.failure);
  };

  let current = [...ops];
  let granularity = 2;

  while (current.length >= 2 && attempts < maxAttempts) {
    const size = Math.ceil(current.length / granularity);
    const chunks: Operation[][] = [];
    for (let i = 0; i < current.length; i += size)
      chunks.push(current.slice(i, i + size));

    let reduced = false;

    // Prefer a single chunk — the largest possible reduction.
    for (const chunk of chunks) {
      if (await stillFails(chunk)) {
        current = chunk;
        granularity = 2;
        reduced = true;
        break;
      }
    }

    if (!reduced) {
      // Otherwise drop one chunk at a time.
      for (let i = 0; i < chunks.length; i += 1) {
        const complement = chunks.filter((_, index) => index !== i).flat();
        if (await stillFails(complement)) {
          current = complement;
          granularity = Math.max(granularity - 1, 2);
          reduced = true;
          break;
        }
      }
    }

    if (!reduced) {
      if (granularity >= current.length) break;
      granularity = Math.min(granularity * 2, current.length);
    }
  }

  // Per-operation simplification, last operation first: later operations are
  // usually the ones that carry the failure, and simplifying them first tends
  // to make the earlier ones removable.
  for (let i = current.length - 1; i >= 0 && attempts < maxAttempts; i -= 1) {
    const op = current[i];
    if (!op) continue;
    for (const simpler of simplifications(op)) {
      const candidate = [...current];
      candidate[i] = simpler;
      if (await stillFails(candidate)) {
        current = candidate;
        break;
      }
    }
  }

  // One last run of the reduced sequence, purely so the report can say which
  // elements the selectors actually resolved to. A report that says
  // `connect(flowNode#8 -> flowNode#2)` is reproducible; one that also says
  // `Task_MR_Inputs -> Task_MR_Beschluesse` is actionable.
  const final = await run(current);
  return { ops: current, attempts, trace: final.trace };
}

// ---------------------------------------------------------------------------
// The campaign
// ---------------------------------------------------------------------------

export interface CampaignOptions {
  readonly seed: number;
  readonly runs: number;
  /** Operations per sequence. */
  readonly length: number;
  /** Base documents; one is drawn per sequence. */
  readonly bases: readonly { readonly name: string; readonly xml: string }[];
  /** Fresh driver for every sequence — state must not leak between them. */
  readonly makeDriver: () => Promise<ModelingDriver>;
  readonly checkOptions?: CheckOptions;
  readonly generate?: GenerateOptions;
  readonly shrink?: boolean;
  readonly runOptions?: RunSequenceOptions;
}

export interface CampaignFailure {
  readonly seed: number;
  readonly run: number;
  readonly base: string;
  readonly failure: SequenceFailure;
  readonly ops: readonly Operation[];
  readonly shrunk: readonly Operation[];
  readonly shrinkAttempts: number;
  readonly trace: readonly StepTrace[];
  /** Trace of the shrunk sequence — the ids a reader needs. */
  readonly shrunkTrace: readonly StepTrace[];
  readonly preExisting: readonly InvariantViolation[];
}

export interface CampaignResult {
  readonly runs: number;
  readonly operationsExecuted: number;
  readonly outcomes: Readonly<Record<OperationOutcome, number>>;
  readonly kindsApplied: Readonly<Record<string, number>>;
  readonly failures: readonly CampaignFailure[];
}

/** Run `runs` random sequences; shrink and report every failure. */
export async function runCampaign(
  options: CampaignOptions,
): Promise<CampaignResult> {
  const rng = new Rng(options.seed);
  const failures: CampaignFailure[] = [];
  const outcomes: Record<OperationOutcome, number> = {
    applied: 0,
    rejected: 0,
    unresolved: 0,
    threw: 0,
  };
  const kindsApplied: Record<string, number> = {};
  let operationsExecuted = 0;

  for (let run = 0; run < options.runs; run += 1) {
    const base = rng.pick(options.bases);
    const ops = generateSequence(rng, options.length, options.generate);

    const execute: Runner = async (candidate) => {
      const driver = await options.makeDriver();
      try {
        return await runSequence(driver, base.xml, candidate, {
          ...options.runOptions,
          ...(options.checkOptions !== undefined
            ? { checkOptions: options.checkOptions }
            : {}),
        });
      } finally {
        driver.destroy();
      }
    };

    const result = await execute(ops);
    operationsExecuted += result.trace.length;
    for (const step of result.trace) {
      outcomes[step.outcome] += 1;
      if (step.outcome === "applied") {
        kindsApplied[step.operation.kind] =
          (kindsApplied[step.operation.kind] ?? 0) + 1;
      }
    }

    if (result.ok || !result.failure) continue;

    const shrunk =
      options.shrink === false
        ? { ops, attempts: 0, trace: result.trace }
        : await shrinkSequence(ops, result.failure, execute);

    failures.push({
      seed: options.seed,
      run,
      base: base.name,
      failure: result.failure,
      ops,
      shrunk: shrunk.ops,
      shrinkAttempts: shrunk.attempts,
      trace: result.trace,
      shrunkTrace: shrunk.trace,
      preExisting: result.preExisting ?? [],
    });
  }

  return {
    runs: options.runs,
    operationsExecuted,
    outcomes,
    kindsApplied,
    failures,
  };
}

/** Every invariant id in a failure — the key the findings registry matches on. */
export function failureIds(failure: CampaignFailure): string[] {
  return [
    ...new Set(failure.failure.violations.map((violation) => violation.id)),
  ].sort();
}

/** The failure report a developer is meant to act on. */
export function formatFailure(failure: CampaignFailure): string {
  const annotated = failure.shrunk.map((op, index) => {
    const step = failure.shrunkTrace[index];
    const ids =
      step && step.resolved.length > 0
        ? `  -> ${step.resolved.join(", ")}`
        : "";
    const outcome = step ? ` [${step.outcome}]` : "";
    return `  ${String(index).padStart(3, " ")}  ${formatOperation(op)}${outcome}${ids}`;
  });
  return [
    `Seed ${failure.seed}, sequence ${failure.run}, base document "${failure.base}"`,
    `Phase: ${failure.failure.phase}${failure.failure.step >= 0 ? `, operation ${failure.failure.step}` : ""}`,
    failure.failure.message,
    "",
    `Original sequence (${failure.ops.length} operations), shrunk to ${failure.shrunk.length} in ${failure.shrinkAttempts} attempts:`,
    annotated.join("\n"),
    "",
    "Violated invariants:",
    formatViolations(failure.failure.violations),
    ...(failure.preExisting.length > 0
      ? [
          "",
          `The base document already violated ${failure.preExisting.length} invariant(s) before the first operation; those are excluded from this verdict:`,
          formatViolations(failure.preExisting.slice(0, 6)),
        ]
      : []),
    "",
    "Replay:",
    `  runSequence(driver, base, ${serializeSequence(failure.shrunk)})`,
  ].join("\n");
}
