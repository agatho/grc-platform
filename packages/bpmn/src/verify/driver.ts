/**
 * What a modeling engine has to be able to do for the verification tools to
 * drive it.
 *
 * There are two implementations of this interface: `drivers/bpmnjs.ts` (the
 * reference, temporary) and `drivers/arctos.ts` (the engine under test, which
 * only works once `src/modeling/` exists). The property runner, the shadow
 * comparison and the edit round-trip all talk to this interface and to nothing
 * else, so they are written once and run against whatever is available.
 *
 * The interface is deliberately small. It does *not* expose a command stack, a
 * rules engine or an element registry — only the ten operations from
 * `operations.ts`, the candidate lists a selector resolves against, and a way
 * to get the model out. Everything the tools assert on is stated over the
 * exported BPMN document, because that document is the artefact whose
 * correctness the whole migration depends on.
 */

import type { ModdleElement } from "bpmn-moddle";
import type { CandidateKind, Operation } from "./operations.js";

/** What happened when an operation was applied. */
export type OperationOutcome =
  /** The engine carried it out. */
  | "applied"
  /** The engine's rules said no. A legitimate answer, and comparable. */
  | "rejected"
  /** The selector resolved to nothing — there was no such element. */
  | "unresolved"
  /** The engine threw. Always a finding. */
  | "threw";

export interface OperationResult {
  readonly outcome: OperationOutcome;
  /** Ids the operation resolved its selectors to, for the failure report. */
  readonly resolved: readonly string[];
  /** Present when `outcome` is `threw`. */
  readonly error?: string;
}

export interface ModelingDriver {
  /** Short name used in reports: `arctos`, `bpmn-js`. */
  readonly name: string;

  /** Replace the whole model with the given document. */
  load(xml: string): Promise<void>;

  /**
   * Ids of the elements a selector of this category may resolve to, sorted
   * ascending so the resolution is deterministic and engine-independent.
   */
  candidates(kind: CandidateKind): readonly string[];

  /** Carry out one operation. Must not throw; report `threw` instead. */
  apply(op: Operation): Promise<OperationResult>;

  /** Serialise the current model to BPMN 2.0 XML. */
  exportXml(): Promise<string>;

  /**
   * The live moddle tree, when the engine keeps one. Used for the per-step
   * invariant check, which would otherwise cost a serialise plus a parse per
   * operation. Engines without one return `undefined` and pay that cost.
   */
  liveDefinitions(): ModdleElement | undefined;

  /** Release whatever the engine holds — DOM nodes, listeners, timers. */
  destroy(): void;
}

/**
 * Resolve a selector index against a candidate list.
 *
 * Modulo, not clamp: with clamping the last element would be picked far more
 * often than any other, which biases every generated sequence towards the same
 * corner of the model.
 */
export function resolveIndex(
  candidates: readonly string[],
  index: number,
): string | undefined {
  if (candidates.length === 0) return undefined;
  return candidates[index % candidates.length];
}

/**
 * Deterministic, engine-independent ordering of candidate ids.
 *
 * Sorting candidates by id looks obvious and is wrong: `bpmn-js` mints ids from
 * a random generator (`Activity_0e81y14`), so a replay of the same sequence
 * sorts differently and resolves a selector to a different element — the
 * property test would not be reproducible and shrinking would chase ghosts.
 *
 * So the order is: everything that was already in the loaded document first,
 * sorted lexicographically (stable, and the same in every engine), then
 * everything the run created, in the order it was created. The second half is
 * engine-independent *as long as both engines create the same elements in the
 * same order* — and where they do not, the divergence surfaces in the shadow
 * comparison instead of being hidden by a sort.
 */
export class CandidateOrder {
  private readonly base = new Set<string>();
  private readonly ordinal = new Map<string, number>();
  private next = 0;

  /** Declare the ids of the freshly loaded document. Resets creation order. */
  reset(baseIds: Iterable<string>): void {
    this.base.clear();
    this.ordinal.clear();
    this.next = 0;
    for (const id of baseIds) this.base.add(id);
  }

  /** Record ids seen after an operation, assigning creation ordinals. */
  observe(ids: Iterable<string>): void {
    for (const id of ids) {
      if (this.base.has(id) || this.ordinal.has(id)) continue;
      this.ordinal.set(id, this.next);
      this.next += 1;
    }
  }

  sort(ids: readonly string[]): string[] {
    return [...ids].sort((a, b) => {
      const aBase = this.base.has(a);
      const bBase = this.base.has(b);
      if (aBase !== bBase) return aBase ? -1 : 1;
      if (aBase) return a < b ? -1 : a > b ? 1 : 0;
      const aOrd = this.ordinal.get(a) ?? Number.MAX_SAFE_INTEGER;
      const bOrd = this.ordinal.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (aOrd !== bOrd) return aOrd - bOrd;
      return a < b ? -1 : a > b ? 1 : 0;
    });
  }
}
