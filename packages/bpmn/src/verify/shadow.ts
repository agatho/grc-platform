/**
 * ============================================================================
 *  TEMPORARY — dies lebt nur, solange `bpmn-js` im Baum liegt.
 * ============================================================================
 *
 * The shadow comparison: the same document and the same operation sequence
 * through **both** engines, then a comparison of what came out.
 *
 * Why it is worth building and why it is dangerous, in one sentence each.
 * Worth building: where two independently written implementations agree on a
 * document, that agreement is stronger evidence than any assertion someone
 * wrote by hand, and `bpmn-js` is the only such implementation ARCTOS will ever
 * have. Dangerous: **a difference does not mean `bpmn-js` is right.** The
 * round-trip report names four places where `bpmn-moddle` loses information,
 * and both engines sit on `bpmn-moddle`, so both lose it identically — a
 * comparison that treats the reference as truth would certify that loss as
 * correct.
 *
 * Hence the rule this file enforces: **every divergence is classified, none is
 * silently tolerated.** Four verdicts:
 *
 *   `ours-wrong`        the ARCTOS engine produces the defective document;
 *   `reference-wrong`   `bpmn-js` does, and we deliberately differ;
 *   `both-lossy`        both lose the same thing, provably — the same loss is
 *                       already present in a plain `importXml`/`exportXml`
 *                       round-trip of the base document, so it is a property of
 *                       `bpmn-moddle`, not of either engine;
 *   `intentional`       a documented, deliberate difference.
 *
 * `both-lossy` is *computed*, not asserted: `lossySignatures()` round-trips the
 * base document through the model layer alone and collects what that loses. A
 * divergence whose signature is in that set is `both-lossy` by construction.
 * The remaining verdicts come from the registry below, and a divergence that
 * matches nothing fails the test.
 *
 * ---------------------------------------------------------------------------
 * How to tell that this file's time is up
 * ---------------------------------------------------------------------------
 * See the header of `drivers/bpmnjs.ts` for the four conditions (plan §5.6).
 * In one line: when `bpmn-js` is no longer a dependency, this file, that
 * driver, `test/verify/jsdom-svg.ts` and the shadow tests go in one commit —
 * deliberately and documented, not by forgetting (plan §6.4).
 *
 * Until then, the strongest thing it buys is not the green runs. It is that
 * `consistency/incoming-outgoing-wrong-type` was settled by evidence: both
 * engines create a `bpmn:messageFlow` for a cross-pool connect, only one of
 * them also writes it into `incoming`/`outgoing`, and the metamodel sides with
 * the other. No amount of reading either implementation would have settled that
 * as quickly.
 */

import type { ModelingDriver, OperationOutcome } from "./driver.js";
import type { Operation } from "./operations.js";
import { CANDIDATE_KINDS, formatOperation } from "./operations.js";
import { canonicalize, diffCanonical } from "../util/xml-canonical.js";
import { importXml, exportXml } from "../model/io.js";
import {
  collectIds,
  normalizeGeneratedIds,
  snapshotXml,
  type ModelSnapshot,
  type SnapshotNode,
} from "./snapshot.js";

// ---------------------------------------------------------------------------
// Tolerances — plan §6.4
// ---------------------------------------------------------------------------

/** Bounds are read from DI, not computed; a difference means an import bug. */
export const BOUNDS_TOLERANCE_PX = 1;
/** Waypoints go through cropping and docking, which may legitimately differ. */
export const WAYPOINT_TOLERANCE_PX = 2;

export type DivergenceKind =
  | "outcome"
  | "element-set"
  | "element-parent"
  | "element-type"
  | "element-name"
  | "bounds"
  | "waypoints"
  | "xml";

export type DivergenceVerdict =
  "ours-wrong" | "reference-wrong" | "both-lossy" | "intentional";

export interface Divergence {
  readonly kind: DivergenceKind;
  /**
   * Stable, content-free identifier of *what sort* of difference this is —
   * an element type plus attribute, never a value. Values are process data and
   * have no business in a classification table (plan §5.4 makes the same point
   * about telemetry).
   */
  readonly signature: string;
  readonly detail: string;
  readonly verdict?: DivergenceVerdict;
  readonly reason?: string;
}

export interface ShadowResult {
  readonly ok: boolean;
  readonly divergences: readonly Divergence[];
  readonly unclassified: readonly Divergence[];
  readonly ourXml: string;
  readonly referenceXml: string;
  readonly ourOutcomes: readonly OperationOutcome[];
  readonly referenceOutcomes: readonly OperationOutcome[];
}

// ---------------------------------------------------------------------------
// The classification registry
// ---------------------------------------------------------------------------

export interface DivergenceRule {
  /** Matches `Divergence.signature`. */
  readonly match: RegExp;
  readonly kinds?: readonly DivergenceKind[];
  readonly verdict: DivergenceVerdict;
  readonly reason: string;
}

/**
 * Every divergence class seen so far, with a verdict and a reason.
 *
 * Adding an entry here is a decision, not a fix: it says "we looked, and this
 * difference is understood". An entry with verdict `ours-wrong` is a bug list
 * item; the abort criteria in plan §5.6 require that list to be empty before
 * `bpmn-js` may be removed.
 */
export const DIVERGENCE_RULES: readonly DivergenceRule[] = [
  {
    match: /^outcome\/.*\/threw$/,
    verdict: "intentional",
    reason:
      "One engine refuses an operation by throwing where the other returns a rule verdict. The " +
      "harness records both as an outcome and does not treat the *style* of refusal as a model " +
      "difference; what matters is that the resulting documents agree, which is compared separately.",
  },
  {
    match: /^element-name\/.*\/label$/,
    verdict: "intentional",
    reason:
      "bpmn-js materialises external labels as their own diagram-js elements and gives them DI; " +
      "ARCTOS' label handling is driven from LabelBehavior. Label geometry depends on text metrics, " +
      "which jsdom does not have (see test/verify/jsdom-svg.ts), so label bounds are excluded from " +
      "the comparison rather than compared against a fake.",
  },
  {
    match: /^xml\/.*\/isExecutable$/,
    verdict: "intentional",
    reason:
      "bpmn-js writes isExecutable on a process it creates; ARCTOS preserves whatever the document " +
      "had. Neither is wrong, and the corpus documents already carry the attribute.",
  },
  {
    match: /^candidate-set\//,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT. The two engines stopped holding the same set of elements part-way through the " +
      "sequence, so the replay was cut short. Every observed instance so far follows an earlier " +
      "rules disagreement (see outcome/*), but the guard fires on its own signature because a " +
      "silent element-count difference is exactly the failure mode a comparison must not paper " +
      "over. Blocks plan §5.6 criterion 2.",
  },
  {
    match:
      /^outcome\/(createShape|connect|reparent|remove|changeLane)\/(applied-vs-rejected|rejected-vs-applied)$/,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT: BpmnRules parity. The two rule sets answer the same question differently — " +
      "measured cases: creating a Task or an EventBasedGateway in the root of " +
      "synth-nested-subprocesses (ARCTOS allows, bpmn-js refuses) and connecting inside Sub_L1 " +
      "(ARCTOS refuses, bpmn-js allows). The verdict is `ours-wrong` by burden of proof, not by " +
      "authority: bpmn-js' rules have a decade of production behind them, so the new engine owes " +
      "the argument for each difference. Plan §5.6 criterion 4 requires this list to be worked " +
      "through case by case before bpmn-js may be removed.",
  },
  {
    match: /^element-(set|type)\//,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT. After the same sequence the two documents contain different elements, or the " +
      "same id carries a different type or a different sourceRef/targetRef. This is the most " +
      "serious class in the table — it is data-level divergence, and on save it is data loss or " +
      "data corruption rather than a cosmetic difference. Blocks plan §5.6 criterion 2.",
  },
  {
    match: /^waypoints\/.*\/count$/,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT. Different number of waypoints for the same connection after the same " +
      "operations — the layouter produces a different route. Cosmetic in the picture, but it " +
      "makes every save a diff and it is the same code path as the missing-coordinate defect.",
  },
  {
    match: /^outcome\/attachBoundary\/applied-vs-rejected$/,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT. ARCTOS attaches a boundary event to targets the reference refuses. bpmn-js' " +
      "canAttach() rejects an event sub-process, a compensation activity and a receive task after " +
      "an event-based gateway; ARCTOS' BpmnRules.canAttach checks only that the target is an " +
      "activity. The measured case is E_EventSub in synth-all-event-types. The verdict is not " +
      '"the reference said so": BPMN 2.0 gives an event sub-process no boundary events, so the ' +
      "reference and the specification agree and ARCTOS is the outlier. Blocks plan §5.6 criterion 4 " +
      "(BpmnRules parity).",
  },
  {
    match: /^(bounds|waypoints)\/.*\/presence\/only-ours$/,
    verdict: "intentional",
    reason:
      "ARCTOS repairs missing DI on import (ModelingSession.repairMissingDi, default on) and gives a " +
      "flow element without a BPMNShape a computed one; bpmn-js leaves it without geometry. The " +
      "corpus has three files with partial DI where this shows. Deliberate: a document ARCTOS can " +
      "show is worth more than one it renders empty, and the added DI is written back, so the file " +
      "gets *better* rather than different. Note that this makes ARCTOS output a superset here, " +
      "never a subset — the reverse direction (presence/only-reference) is NOT classified and fails.",
  },
  {
    match: /^waypoints\/bpmn:(Sequence|Message)Flow\/position$/,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT. After a move or a connect, ARCTOS puts an intermediate waypoint where bpmn-js " +
      "does not, and in the worst case emits x=0 — the same missing-coordinate defect the property " +
      "runner reports as driver/threw (test/verify/known-findings.ts). Blocks plan §5.6 criterion 2. " +
      "Classified, not accepted: the entry exists so that a *new* kind of waypoint difference still " +
      "fails the suite.",
  },
  {
    match: /^bounds\/.*\/created$/,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT, low severity. The two engines put a newly created shape in different places " +
      "(measured: 90px apart for an IntermediateThrowEvent inside a sub-process). Both computed " +
      "the geometry, so neither is reading anything wrong; the likely cause is the sub-process " +
      "resize difference above feeding into the clamp that keeps a new shape inside its parent. " +
      "Kept separate from the import-side bounds check, which stays exact and is green over the " +
      "whole corpus.",
  },
  {
    match: /^bounds\/bpmn:(SubProcess|Transaction|Participant|Lane)$/,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT. After editing inside an expanded sub-process the two engines resize the " +
      "container differently (measured: 300px vs 390px width on E_EventSub). DI is read, not " +
      "computed, so this is a modeling-side difference in the resize behaviour, not an import " +
      "difference. Blocks plan §5.6 criterion 2.",
  },
  {
    match: /^element-set\/bpmn:(Sequence|Message)Flow\/only-reference$/,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT. A flow that bpmn-js keeps is missing from the ARCTOS document after the same " +
      "sequence — most likely a removal cascade that takes one element too many. This is the " +
      "single most serious divergence class in this table: it is silent data loss on save. " +
      "Blocks plan §5.6 criterion 2.",
  },
];

function classify(
  divergence: Divergence,
  lossy: ReadonlySet<string>,
): Divergence {
  if (lossy.has(divergence.signature)) {
    return {
      ...divergence,
      verdict: "both-lossy",
      reason:
        "The same loss occurs in a plain importXml/exportXml round-trip of the base document, so it " +
        "is a property of bpmn-moddle that both engines inherit (round-trip report, four causes).",
    };
  }
  for (const rule of DIVERGENCE_RULES) {
    if (rule.kinds && !rule.kinds.includes(divergence.kind)) continue;
    if (rule.match.test(divergence.signature)) {
      return { ...divergence, verdict: rule.verdict, reason: rule.reason };
    }
  }
  return divergence;
}

// ---------------------------------------------------------------------------
// What bpmn-moddle loses on its own
// ---------------------------------------------------------------------------

/**
 * Signatures the model layer already loses when it merely reads and writes the
 * document — with no engine, no operation and no editing involved.
 *
 * This is what makes `both-lossy` a measurement rather than an opinion.
 */
export async function lossySignatures(baseXml: string): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const { definitions } = await importXml(baseXml, { preserveSource: false });
    const written = await exportXml(definitions, {
      preferPreservedSource: false,
    });
    const differences = diffCanonical(
      canonicalize(baseXml),
      canonicalize(written),
      400,
    );
    for (const difference of differences) {
      out.add(`xml/${difference.context}/${attributeOf(difference.text)}`);
    }
  } catch {
    // A base document the model layer cannot even round-trip is a finding of
    // the round-trip harness, not of this one.
  }
  return out;
}

/** `@cancelActivity="true"` → `cancelActivity`; an element line → its name. */
function attributeOf(line: string): string {
  const attribute = /^@([\w:.-]+)=/.exec(line);
  if (attribute?.[1]) return attribute[1];
  const element = /^<\/?(.+)>$/.exec(line);
  if (element?.[1]) return `<${element[1]}>`;
  if (line.startsWith("text ")) return "#text";
  if (line.startsWith("<!--")) return "#comment";
  if (line.startsWith("<?")) return "#pi";
  return line.slice(0, 40);
}

// ---------------------------------------------------------------------------
// The comparison
// ---------------------------------------------------------------------------

/** Nodes whose geometry depends on measured text and is therefore not compared. */
const LABEL_KINDS = new Set(["label", "bpmndi:BPMNLabel"]);

function compareSnapshots(
  ours: ModelSnapshot,
  reference: ModelSnapshot,
  out: Divergence[],
): void {
  const ourIds = new Set(ours.nodes.map((node) => node.id));
  const theirIds = new Set(reference.nodes.map((node) => node.id));

  for (const node of ours.nodes) {
    if (!theirIds.has(node.id)) {
      out.push({
        kind: "element-set",
        signature: `element-set/${node.id.startsWith("gen-") ? "gen-" : node.type}/only-ours`,
        detail: `${node.id} (${node.type}) exists only in the ARCTOS model`,
      });
    }
  }
  for (const node of reference.nodes) {
    if (!ourIds.has(node.id)) {
      out.push({
        kind: "element-set",
        signature: `element-set/${node.id.startsWith("gen-") ? "gen-" : node.type}/only-reference`,
        detail: `${node.id} (${node.type}) exists only in the bpmn-js model`,
      });
    }
  }

  for (const node of ours.nodes) {
    const other = reference.byId.get(node.id);
    if (!other) continue;
    compareNode(node, other, out);
  }
}

function compareNode(
  ours: SnapshotNode,
  reference: SnapshotNode,
  out: Divergence[],
): void {
  if (ours.type !== reference.type) {
    out.push({
      kind: "element-type",
      signature: `element-type/${ours.type}/vs/${reference.type}`,
      detail: `${ours.id}: ARCTOS says ${ours.type}, bpmn-js says ${reference.type}`,
    });
    return;
  }
  if (LABEL_KINDS.has(ours.type)) return;

  if (ours.parentId !== reference.parentId) {
    out.push({
      kind: "element-parent",
      signature: `element-parent/${ours.type}`,
      detail: `${ours.id}: parent ${String(ours.parentId)} vs ${String(reference.parentId)}`,
    });
  }
  if ((ours.name ?? "") !== (reference.name ?? "")) {
    out.push({
      kind: "element-name",
      signature: `element-name/${ours.type}/name`,
      detail: `${ours.id}: name differs`,
    });
  }
  for (const [key, ourRef, theirRef] of [
    ["sourceRef", ours.sourceId, reference.sourceId],
    ["targetRef", ours.targetId, reference.targetId],
    ["attachedToRef", ours.attachedToId, reference.attachedToId],
    ["lane", ours.laneId, reference.laneId],
  ] as const) {
    if (ourRef !== theirRef) {
      out.push({
        kind: "element-set",
        signature: `element-set/${ours.type}/${key}`,
        detail: `${ours.id}: ${key} ${String(ourRef)} vs ${String(theirRef)}`,
      });
    }
  }

  if (ours.bounds && reference.bounds) {
    const deltas = [
      Math.abs(ours.bounds.x - reference.bounds.x),
      Math.abs(ours.bounds.y - reference.bounds.y),
      Math.abs(ours.bounds.width - reference.bounds.width),
      Math.abs(ours.bounds.height - reference.bounds.height),
    ];
    if (deltas.some((delta) => delta > BOUNDS_TOLERANCE_PX)) {
      // An element that was already in the document and one the run created are
      // two different questions. For the first, DI is *read* and a difference
      // can only be an import defect — that is the strict check, and it is
      // green over the whole corpus. For the second, both engines *computed*
      // the geometry, and a difference is a placement decision. Same tolerance,
      // different verdict, so they need different signatures.
      const created = ours.id.startsWith("gen-");
      out.push({
        kind: "bounds",
        signature: `bounds/${ours.type}${created ? "/created" : ""}`,
        detail:
          `${ours.id}: bounds differ by more than ${BOUNDS_TOLERANCE_PX}px ` +
          `(${JSON.stringify(ours.bounds)} vs ${JSON.stringify(reference.bounds)}). ` +
          (created
            ? "This element was created by the run, so both engines computed the geometry."
            : "DI is read, not computed — a difference here is an import defect."),
      });
    }
  } else if (Boolean(ours.bounds) !== Boolean(reference.bounds)) {
    out.push({
      kind: "bounds",
      signature: `bounds/${ours.type}/presence/${ours.bounds ? "only-ours" : "only-reference"}`,
      detail: `${ours.id}: bounds exist only in ${ours.bounds ? "ARCTOS" : "bpmn-js"}`,
    });
  }

  if (ours.waypoints && reference.waypoints) {
    if (ours.waypoints.length !== reference.waypoints.length) {
      out.push({
        kind: "waypoints",
        signature: `waypoints/${ours.type}/count`,
        detail: `${ours.id}: ${ours.waypoints.length} waypoints vs ${reference.waypoints.length}`,
      });
    } else {
      for (const [index, point] of ours.waypoints.entries()) {
        const other = reference.waypoints[index];
        if (!other) continue;
        if (
          Math.abs(point.x - other.x) > WAYPOINT_TOLERANCE_PX ||
          Math.abs(point.y - other.y) > WAYPOINT_TOLERANCE_PX
        ) {
          out.push({
            kind: "waypoints",
            signature: `waypoints/${ours.type}/position`,
            detail:
              `${ours.id} waypoint ${index}: (${point.x},${point.y}) vs (${other.x},${other.y}), ` +
              `tolerance ${WAYPOINT_TOLERANCE_PX}px`,
          });
          break;
        }
      }
    }
  } else if (Boolean(ours.waypoints) !== Boolean(reference.waypoints)) {
    out.push({
      kind: "waypoints",
      signature: `waypoints/${ours.type}/presence/${ours.waypoints ? "only-ours" : "only-reference"}`,
      detail: `${ours.id}: waypoints exist only in ${ours.waypoints ? "ARCTOS" : "bpmn-js"}`,
    });
  }
}

function compareXml(
  ourXml: string,
  referenceXml: string,
  out: Divergence[],
): void {
  const differences = diffCanonical(
    canonicalize(ourXml),
    canonicalize(referenceXml),
    200,
  );
  for (const difference of differences) {
    out.push({
      kind: "xml",
      signature: `xml/${difference.context}/${attributeOf(difference.text)}`,
      detail: `${difference.kind === "removed" ? "only ARCTOS" : "only bpmn-js"}: ${difference.text} in ${difference.context}`,
    });
  }
}

export interface ShadowRunOptions {
  readonly baseXml: string;
  readonly ops: readonly Operation[];
  readonly ours: ModelingDriver;
  readonly reference: ModelingDriver;
  /**
   * Compare the exported XML as well as the model. Off for runs whose purpose
   * is the model comparison — the XML diff is noisy while either engine still
   * has an open finding, and its signal is a superset of the model's.
   */
  readonly compareXml?: boolean;
}

/**
 * Run one sequence through both engines and classify every difference.
 *
 * Not compared, on purpose (plan §6.4): SVG path data, CSS classes, DOM
 * structure. The ARCTOS renderer is *supposed* to draw differently; comparing
 * there would lock in bpmn-js' visual decisions, which is the opposite of the
 * point of the exercise.
 */
export async function shadowCompare(
  options: ShadowRunOptions,
): Promise<ShadowResult> {
  const { baseXml, ops, ours, reference } = options;
  const known = new Set(collectIds(baseXml));

  const ourOutcomes: OperationOutcome[] = [];
  const referenceOutcomes: OperationOutcome[] = [];
  const divergences: Divergence[] = [];

  await ours.load(baseXml);
  await reference.load(baseXml);

  for (const [index, op] of ops.entries()) {
    // Before every operation, check that a selector means the same thing on
    // both sides. Once the two models hold different elements, `flowNode#20`
    // resolves to different elements in the two engines, every later operation
    // acts on something else, and the model diff afterwards is noise. Stopping
    // here is the difference between a comparison and a coincidence.
    const mismatched = CANDIDATE_KINDS.find(
      (kind) =>
        ours.candidates(kind).length !== reference.candidates(kind).length,
    );
    if (mismatched !== undefined) {
      divergences.push({
        kind: "element-set",
        signature: `candidate-set/${mismatched}`,
        detail:
          `before operation ${index} (${formatOperation(op)}) the two engines no longer agree on ` +
          `which elements exist: ARCTOS has ${ours.candidates(mismatched).length} "${mismatched}" ` +
          `candidates, bpmn-js ${reference.candidates(mismatched).length}. ` +
          "The replay stops here; everything after this point would compare different models.",
      });
      break;
    }

    const a = await ours.apply(op);
    const b = await reference.apply(op);
    ourOutcomes.push(a.outcome);
    referenceOutcomes.push(b.outcome);
    if (a.outcome !== b.outcome) {
      divergences.push({
        kind: "outcome",
        signature: `outcome/${op.kind}/${a.outcome === "threw" || b.outcome === "threw" ? "threw" : `${a.outcome}-vs-${b.outcome}`}`,
        detail:
          `operation ${index} (${formatOperation(op)}): ` +
          `ARCTOS ${a.outcome} on [${a.resolved.join(", ")}]${a.error ? ` (${a.error})` : ""}, ` +
          `bpmn-js ${b.outcome} on [${b.resolved.join(", ")}]${b.error ? ` (${b.error})` : ""}`,
      });
    }
  }

  const ourXml = normalizeGeneratedIds(await ours.exportXml(), known);
  const referenceXml = normalizeGeneratedIds(
    await reference.exportXml(),
    known,
  );

  // Once the two engines answered an operation differently, they are no longer
  // running the same sequence: one created an element the other did not, every
  // later selector resolves elsewhere, and the generated-id normalisation lines
  // up documents that have nothing to do with each other. Comparing the models
  // past that point produces pages of consequential noise and hides the one
  // difference that matters, which is the outcome itself. So the comparison
  // stops here and says so.
  const outcomeDiverged = divergences.some(
    (d) => d.kind === "outcome" || d.signature.startsWith("candidate-set/"),
  );
  if (!outcomeDiverged) {
    compareSnapshots(
      await snapshotXml(ourXml),
      await snapshotXml(referenceXml),
      divergences,
    );
    if (options.compareXml === true)
      compareXml(ourXml, referenceXml, divergences);
  }

  const lossy = await lossySignatures(baseXml);
  const classified = divergences.map((divergence) =>
    classify(divergence, lossy),
  );
  const unclassified = classified.filter(
    (divergence) => divergence.verdict === undefined,
  );

  return {
    ok: unclassified.length === 0,
    divergences: classified,
    unclassified,
    ourXml,
    referenceXml,
    ourOutcomes,
    referenceOutcomes,
  };
}

/** Counts per verdict, for the report. */
export function summarize(
  divergences: readonly Divergence[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const divergence of divergences) {
    const key = divergence.verdict ?? "unclassified";
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

export function formatDivergences(
  divergences: readonly Divergence[],
  limit = 20,
): string {
  if (divergences.length === 0) return "  (none)";
  return divergences
    .slice(0, limit)
    .map(
      (divergence) =>
        `  [${divergence.verdict ?? "UNCLASSIFIED"}] ${divergence.signature}\n      ${divergence.detail}` +
        (divergence.reason ? `\n      reason: ${divergence.reason}` : ""),
    )
    .join("\n");
}
