/**
 * Which corpus documents the operation-level tools may start from.
 *
 * Not every corpus file is a usable *starting point* for editing. Three groups
 * are excluded, each for a stated reason rather than because it was
 * inconvenient:
 *
 *  - **No `BPMNDiagram`.** `bpmn-js` refuses such a file outright ("no diagram
 *    to display"), so nothing can be compared against it. This is by far the
 *    largest group: **25 of the 52 corpus files carry no DI at all**, because
 *    most of them were extracted from unit tests and seed SQL that only ever
 *    cared about the semantic tree. They stay in the round-trip corpus, where
 *    they belong, and they are the reason the operation-level tools work over
 *    26 documents and not over 52. Worth fixing at the corpus level rather than
 *    here: DI for those files would widen every tool in this directory at once.
 *  - **No process with flow elements.** There is nothing to edit.
 *  - **Deliberately broken references** (`synth-dangling-references`). Its
 *    invariants are violated *before* the first operation — it is a fixture for
 *    the round-trip loss measurement, not a base for editing. It is used the
 *    other way round: to prove the invariant checker notices.
 */

import { loadCorpus, type CorpusEntry } from "../model/corpus";

/**
 * Any BPMN flow node. Deliberately the full list rather than the four or five
 * obvious ones, so that the base set is bounded by what the corpus really
 * contains and not by which element types this pattern happened to name.
 */
const FLOW_NODE =
  /<(?:\w+:)?(?:task|userTask|serviceTask|manualTask|scriptTask|sendTask|receiveTask|businessRuleTask|callActivity|subProcess|transaction|adHocSubProcess|startEvent|endEvent|intermediateThrowEvent|intermediateCatchEvent|boundaryEvent|exclusiveGateway|parallelGateway|inclusiveGateway|eventBasedGateway|complexGateway)\b/i;

/** Corpus entries that carry a diagram and at least one editable process. */
export function editableBases(): CorpusEntry[] {
  return loadCorpus().filter(
    (entry) =>
      entry.name !== "synth-dangling-references" &&
      entry.xml.includes("BPMNDiagram") &&
      FLOW_NODE.test(entry.xml),
  );
}

/**
 * A small, hand-picked spread for the expensive tools (shadow comparison,
 * image comparison): one plain process, one with a gateway, one with lanes,
 * one collaboration with pools, one with sub-processes, one with boundary
 * events, one with the full event zoo, one with foreign extensions. Only files
 * that carry a BPMNDiagram — see `representativeBases()`.
 */
export const REPRESENTATIVE_BASES: readonly string[] = [
  "repo-seed-customer-service",
  "repo-prd-sales-with-gateway",
  "synth-collaboration-pools-lanes",
  "synth-nested-subprocesses",
  "synth-boundary-events",
  "synth-all-event-types",
  "synth-foreign-camunda-extensions",
];

export function representativeBases(): CorpusEntry[] {
  const wanted = new Set(REPRESENTATIVE_BASES);
  // Intersected with `editableBases()` rather than taken literally: a name in
  // the list above that turns out to have no BPMNDiagram would otherwise make
  // the shadow comparison fail with "no diagram to display", which says nothing
  // about either engine. `synth-excel-import-lanes` was exactly that case.
  return editableBases().filter((entry) => wanted.has(entry.name));
}
