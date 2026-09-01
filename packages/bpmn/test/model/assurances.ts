/**
 * The four round-trip assurances of §5.1 of `ARCTOS_BPMN_ENGINE_PLAN.md`,
 * implemented as one measurement over one file.
 *
 *   Z-A  canonical equivalence — `read(x)` and `read(write(read(x)))` agree
 *        under the canonicalisation in `src/util/xml-canonical.ts`.
 *   Z-B  idempotence — `write(read(write(read(x))))` is **byte-identical** to
 *        `write(read(x))`.
 *   Z-C  non-loss — no element, attribute or text node of the input is missing
 *        from the output. Inclusion, not equality: additions are reported but
 *        are not failures.
 *   Z-D  read-preserve-write — an imported but unedited tree exports back to
 *        the original bytes.
 *
 * There is no tolerance anywhere in here. A file either satisfies an assurance
 * or it does not, and when it does not the result carries the concrete
 * difference — which file, which element, which attribute. A harness that
 * rounds a failure down to a warning is worth nothing to the decision this
 * spike has to support.
 */

import { exportXml, importXml, markModified } from "../../src/model/index.js";
import {
  canonicalize,
  countNodes,
  diffCanonical,
  diffCounts,
  elementCount,
  type CanonicalDifference,
  type CountDifference,
} from "../../src/util/index.js";

export interface AssuranceOutcome {
  readonly ok: boolean;
  /** Human-readable one-liner for the report table. */
  readonly detail: string;
}

export interface RoundTripMeasurement {
  readonly file: string;
  /** Set when import itself failed; every assurance is then `false`. */
  readonly importError?: string;
  readonly warnings: readonly string[];
  readonly bytesIn: number;
  readonly bytesOut: number;
  readonly elementsIn: number;

  readonly canonicalEquivalence: AssuranceOutcome;
  readonly idempotence: AssuranceOutcome;
  readonly nonLoss: AssuranceOutcome;
  readonly readPreserveWrite: AssuranceOutcome;
  /**
   * Informational, **not** one of the four assurances: did the serialiser keep
   * the source order of sibling elements? Z-A is stated over an element set,
   * so reordering does not violate it — but it does produce a diff in every
   * text-diff tool, so the number belongs in the report rather than nowhere.
   */
  readonly siblingOrderPreserved: AssuranceOutcome;

  readonly canonicalDifferences: readonly CanonicalDifference[];
  readonly losses: readonly CountDifference[];
  readonly additions: readonly CountDifference[];
  /** First byte offset at which pass 1 and pass 2 output differ. */
  readonly idempotenceFirstDivergence?: {
    readonly offset: number;
    readonly before: string;
    readonly after: string;
  };
}

const FAILED_IMPORT: AssuranceOutcome = { ok: false, detail: "import failed" };

function firstDivergence(
  a: string,
  b: string,
): { offset: number; before: string; after: string } {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i += 1;
  return {
    offset: i,
    before: a.slice(Math.max(0, i - 40), i + 60),
    after: b.slice(Math.max(0, i - 40), i + 60),
  };
}

/** Run all four assurances against one BPMN document. */
export async function measureRoundTrip(
  file: string,
  xml: string,
): Promise<RoundTripMeasurement> {
  const base = {
    file,
    warnings: [] as string[],
    bytesIn: Buffer.byteLength(xml, "utf8"),
    bytesOut: 0,
    elementsIn: 0,
    canonicalDifferences: [] as CanonicalDifference[],
    losses: [] as CountDifference[],
    additions: [] as CountDifference[],
  };

  try {
    base.elementsIn = elementCount(xml);
  } catch {
    base.elementsIn = -1;
  }

  // --- pass 1 -------------------------------------------------------------
  let pass1: string;
  let warnings: string[];
  try {
    const imported = await importXml(xml);
    warnings = imported.warnings.map((w) =>
      typeof w.message === "string" ? w.message : JSON.stringify(w),
    );
    pass1 = await exportXml(imported.definitions, { format: true });
  } catch (error) {
    return {
      ...base,
      importError: error instanceof Error ? error.message : String(error),
      canonicalEquivalence: FAILED_IMPORT,
      idempotence: FAILED_IMPORT,
      nonLoss: FAILED_IMPORT,
      readPreserveWrite: FAILED_IMPORT,
      siblingOrderPreserved: FAILED_IMPORT,
    };
  }

  // --- pass 2 -------------------------------------------------------------
  const reimported = await importXml(pass1);
  const pass2 = await exportXml(reimported.definitions, { format: true });

  // --- Z-A ----------------------------------------------------------------
  let canonicalDifferences: CanonicalDifference[] = [];
  let canonicalEquivalence: AssuranceOutcome;
  try {
    const before = canonicalize(xml);
    const after = canonicalize(pass1);
    canonicalDifferences = diffCanonical(before, after);
    canonicalEquivalence = {
      ok: canonicalDifferences.length === 0,
      detail:
        canonicalDifferences.length === 0
          ? "identical"
          : `${canonicalDifferences.length} differing canonical line(s)`,
    };
  } catch (error) {
    canonicalEquivalence = {
      ok: false,
      detail: `canonicalisation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // --- sibling order (informational) --------------------------------------
  let siblingOrderPreserved: AssuranceOutcome;
  try {
    const ordered = diffCanonical(
      canonicalize(xml, { sortSiblings: false }),
      canonicalize(pass1, { sortSiblings: false }),
    );
    siblingOrderPreserved = {
      ok: ordered.length === 0,
      detail:
        ordered.length === 0
          ? "source order kept"
          : `${ordered.length} line(s) move when sibling order is honoured`,
    };
  } catch {
    siblingOrderPreserved = { ok: false, detail: "could not be measured" };
  }

  // --- Z-B ----------------------------------------------------------------
  const idempotent = pass1 === pass2;
  const idempotence: AssuranceOutcome = {
    ok: idempotent,
    detail: idempotent
      ? "pass2 === pass1 (byte-identical)"
      : `pass2 differs from pass1 (${pass1.length} vs ${pass2.length} bytes)`,
  };

  // --- Z-C ----------------------------------------------------------------
  let losses: CountDifference[] = [];
  let additions: CountDifference[] = [];
  let nonLoss: AssuranceOutcome;
  try {
    const comparison = diffCounts(countNodes(xml), countNodes(pass1));
    losses = [...comparison.losses];
    additions = [...comparison.additions];
    nonLoss = {
      ok: losses.length === 0,
      detail:
        losses.length === 0
          ? additions.length === 0
            ? "no loss, no addition"
            : `no loss (${additions.length} addition kind(s))`
          : `${losses.length} lost node kind(s)`,
    };
  } catch (error) {
    nonLoss = {
      ok: false,
      detail: `counting failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // --- Z-D ----------------------------------------------------------------
  const untouched = await importXml(xml);
  const preserved = await exportXml(untouched.definitions, {
    preferPreservedSource: true,
  });
  const preservedOk = preserved === xml;
  // The shortcut must stop applying once the tree is edited, otherwise it
  // would silently discard real changes — that is the failure mode worth
  // guarding, so it is measured rather than assumed.
  markModified(untouched.definitions);
  const afterEdit = await exportXml(untouched.definitions, {
    preferPreservedSource: true,
  });
  const releasesAfterEdit = afterEdit !== xml || xml === pass1;
  const readPreserveWrite: AssuranceOutcome = {
    ok: preservedOk && releasesAfterEdit,
    detail: !preservedOk
      ? "unedited export is not byte-identical to the source"
      : releasesAfterEdit
        ? "byte-identical while unedited; re-serialises after an edit"
        : "shortcut still applied after the tree was marked modified",
  };

  return {
    ...base,
    warnings,
    bytesOut: Buffer.byteLength(pass1, "utf8"),
    canonicalEquivalence,
    idempotence,
    nonLoss,
    readPreserveWrite,
    siblingOrderPreserved,
    canonicalDifferences,
    losses,
    additions,
    idempotenceFirstDivergence: idempotent
      ? undefined
      : firstDivergence(pass1, pass2),
  };
}

export function allAssurancesHold(m: RoundTripMeasurement): boolean {
  return (
    m.canonicalEquivalence.ok &&
    m.idempotence.ok &&
    m.nonLoss.ok &&
    m.readPreserveWrite.ok
  );
}
