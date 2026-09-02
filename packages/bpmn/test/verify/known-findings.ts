/**
 * Findings the verification tools currently reproduce, each with a verdict.
 *
 * This file is a **handover list, not an excuse list.** A finding may sit here
 * only with an owner, a minimal reproduction and a verdict; a failure whose
 * invariant ids are not all listed here fails the suite. That is the same rule
 * the shadow comparison applies to divergences (`src/verify/shadow.ts`): no
 * silent tolerance, every deviation classified.
 *
 * Two guards keep the list from rotting:
 *   - `test/verify/known-findings.test.ts` fails if an entry is missing an
 *     owner, a reproduction or a note;
 *   - the property suite reports how many known findings it hit, so an entry
 *     that stops reproducing shows up as a drop to zero rather than as silence.
 *
 * Set `PROPERTY_STRICT=1` to make every finding fail again — that is the mode
 * the modeling layer's own author wants while fixing them.
 */

export type FindingOwner =
  /** `src/modeling/` — agent A1's layer. */
  | "modeling"
  /** `src/verify/` — these tools. A finding here is mine to fix. */
  | "verify"
  /** The reference implementation. */
  | "bpmn-js"
  /** A corpus fixture that is deliberately broken. */
  | "corpus";

export type FindingVerdict =
  /** The engine is wrong: the document it produces is defective. */
  | "engine-defect"
  /** The invariant is stricter than BPMN or moddle require. */
  | "invariant-too-strict"
  /** An artefact of running a browser library under jsdom. */
  | "environment";

export interface KnownFinding {
  /** Invariant id as the checker reports it. */
  readonly id: string;
  readonly owner: FindingOwner;
  readonly verdict: FindingVerdict;
  /** Shortest reproduction, verbatim enough to paste into a test. */
  readonly repro: string;
  readonly note: string;
}

export const KNOWN_FINDINGS: readonly KnownFinding[] = [
  {
    id: "driver/threw",
    owner: "modeling",
    verdict: "engine-defect",
    repro:
      'const s = await createModelingSession(corpus("synth-boundary-events")); ' +
      's.modeling.moveElements([s.shape("Task_Freigabe")], { x: 0, y: 0 });',
    note:
      "Moving an activity that carries boundary events by (0,0) leaves Flow_2 with the waypoint " +
      '{"y":200,"original":{"y":200}} — the x coordinate is gone. The renderer catches it ' +
      '("Kante Flow_2 hat einen nicht-endlichen Wegpunkt") and the modeling layer\'s own ' +
      "DI_WAYPOINTS_MISMATCH fires. Same symptom on connect() into a sub-process whose children " +
      "have no DI. Cause is in the layouter/docking path, not in the command stack: the second " +
      "waypoint is built without an x. This is the class of defect the spike predicted — invisible " +
      "in the picture, fatal in the file.",
  },
  {
    id: "modeling/DI_WAYPOINTS_MISMATCH",
    owner: "modeling",
    verdict: "engine-defect",
    repro: "same as driver/threw above",
    note: "Consequence of the missing waypoint coordinate; will disappear with it.",
  },
  {
    id: "ref/boundary-attached-to",
    owner: "modeling",
    verdict: "engine-defect",
    repro:
      'runSequence(driver, corpus("synth-boundary-events"), [{"kind":"move",' +
      '"target":{"kind":"flowNode","index":2},"dx":0,"dy":0}])',
    note:
      "After the failed move above, a boundary event is left without attachedToRef. On the next " +
      "save moddle drops the attribute silently (round-trip report, cause 2) and the event becomes " +
      "unplaceable in every tool. Downstream of the same defect, but listed separately because it " +
      "is the one with data-loss consequences.",
  },
  {
    id: "modeling/BOUNDARY_WITHOUT_HOST",
    owner: "modeling",
    verdict: "engine-defect",
    repro: "same as ref/boundary-attached-to above",
    note: "The modeling layer's own invariant for the same state; both agree.",
  },
  {
    id: "modeling/PARENT_LINK_BROKEN",
    owner: "modeling",
    verdict: "invariant-too-strict",
    repro:
      "Drive the bpmn-js reference driver over any corpus file and create one shape: " +
      "`modeling/PARENT_LINK_BROKEN @ <dc:Bounds>` fires on bpmn-js output as well.",
    note:
      "The invariant requires every nested moddle object to carry $parent. `moddle-xml` serialises " +
      "children by declared property, not by $parent, so a dc:Bounds without $parent round-trips " +
      "correctly — and bpmn-js, which has shipped for a decade, does not set it either. That the " +
      "invariant fires on the reference implementation is the evidence: it is stricter than the " +
      "format. Recommendation to A1: keep it for elements that are *referenced* (where $parent " +
      "governs export) and downgrade it to a warning for DI leaf objects.",
  },
  {
    id: "consistency/incoming-outgoing-wrong-type",
    owner: "modeling",
    verdict: "engine-defect",
    repro:
      'runSequence(driver, corpus("synth-collaboration-pools-lanes"), [{"kind":"connect",' +
      '"source":{"kind":"flowNode","index":12},"target":{"kind":"flowNode","index":10}}]) ' +
      "— connect Task_Kunde_Antrag to Task_Bank_Entscheiden across the two pools.",
    note:
      "Both engines correctly create a <bpmn:messageFlow>. ARCTOS *additionally* writes " +
      "<bpmn:incoming>MessageFlow_3</bpmn:incoming> and the matching <bpmn:outgoing>; bpmn-js does " +
      "not. bpmn:FlowNode.incoming/outgoing are typed as SequenceFlow references in the BPMN 2.0 " +
      "metamodel, so the next reader resolves a message flow as a sequence flow. Verdict from the " +
      "shadow comparison, not from opinion: same input, same operation, reference disagrees, and " +
      "the metamodel sides with the reference. Fix in BpmnUpdater: update incoming/outgoing only " +
      "for bpmn:SequenceFlow.",
  },
  {
    id: "di/plane-element",
    owner: "modeling",
    verdict: "engine-defect",
    repro:
      'runSequence(driver, corpus("synth-nested-subprocesses"), [{"kind":"remove",' +
      '"target":{"kind":"removable","index":24}}]) — remove the expanded sub-process Sub_L1.',
    note:
      'Removing an expanded sub-process leaves its own <bpmndi:BPMNPlane bpmnElement="Sub_L1"> ' +
      "and every BPMNShape/BPMNEdge inside it in the document, all pointing at elements that no " +
      "longer exist. On the next save moddle drops the unresolvable references (round-trip report, " +
      "cause 2) and the file keeps a plane full of anchorless geometry. One operation, no undo, no " +
      "exotic input — and nothing about it is visible in the picture.",
  },
  {
    id: "di/orphan",
    owner: "modeling",
    verdict: "engine-defect",
    repro: "same as di/plane-element above",
    note: "Seven orphaned DI entries from the one removal; same cause.",
  },
  {
    id: "modeling/DI_ORPHANED",
    owner: "modeling",
    verdict: "engine-defect",
    repro: "same as di/plane-element above",
    note: "The modeling layer's own invariant for the same state; both agree.",
  },
  {
    id: "modeling/DATA_ASSOCIATION_DANGLING",
    owner: "modeling",
    verdict: "engine-defect",
    repro:
      'runSequence(driver, corpus("synth-data-objects-and-artifacts"), [{"kind":"remove",' +
      '"target":{"kind":"removable","index":8}}]) — remove DataObjectRef_Antrag, or index 10 for ' +
      "DataStore_Kundenstamm.",
    note:
      "Deleting a data object or data store leaves the dataInputAssociations and " +
      "dataOutputAssociations of every task that used it pointing at an element that is gone. " +
      "Removal cascades cover sequence flows and boundary events but not data associations. Same " +
      "consequence as every dangling reference in this list: moddle drops it on the next save. " +
      "Found by the property runner at sequence 90 of 200 and shrunk to one operation — a case " +
      "nobody writes by hand, which is the argument for generating them.",
  },
  {
    id: "roundtrip/undo-leaves-di",
    owner: "modeling",
    verdict: "engine-defect",
    repro:
      "Load synth-collaboration-pools-lanes, attachBoundary on any activity, then undo once: the " +
      'exported document still contains <bpmndi:BPMNShape id="BoundaryEvent_1_di_1" ' +
      'bpmnElement="BoundaryEvent_1"> with full Bounds. Same for connect + undo, which leaves a ' +
      "BPMNEdge with waypoints behind.",
    note:
      "The command that creates an element adds its DI, and the inverse does not take it away. " +
      "n operations followed by n undos therefore do not restore the starting document: the " +
      "semantic tree is right and the DI tree has grown. Every undone edit leaves a little more " +
      "orphaned geometry, and moddle drops the dangling bpmnElement on the next save. Fix belongs " +
      "in the revert path of the create/connect handlers, next to the DI they add.",
  },
  {
    id: "roundtrip/undo-does-not-restore-name",
    owner: "modeling",
    verdict: "engine-defect",
    repro:
      'Load synth-foreign-camunda-extensions, rename any UserTask to "" (empty), then undo. The ' +
      'name comes back as name="" instead of "Rechnung freigeben".',
    note:
      "UpdatePropertiesHandler does not restore a property whose new value was the empty string — " +
      "most likely the old value is captured with a falsy check rather than a presence check. The " +
      "generator hits this because AWKWARD_NAMES deliberately contains the empty string and a " +
      'whitespace-only string; a hand-written test would almost certainly have used "Neuer Name".',
  },
  {
    id: "modeling/DI_MISSING",
    owner: "corpus",
    verdict: "environment",
    repro:
      'createModelingSession(corpus("synth-boundary-events")) — Sub_Start, Sub_Task, Sub_End have no DI.',
    note:
      "Several corpus files carry flow elements without DI on purpose (partial DI is one of the " +
      "round-trip fixtures). ModelingSession's repairMissingDi does not descend into a sub-process " +
      "plane. Pre-existing in the base document, so the property runner excludes it from its " +
      "verdict by baseline diffing; listed here because it also surfaces as a first-step finding " +
      "when an operation touches such an element.",
  },
];

const byId = new Map(KNOWN_FINDINGS.map((finding) => [finding.id, finding]));

/** True when every invariant id in the list is a known finding. */
export function allKnown(ids: readonly string[]): boolean {
  return ids.length > 0 && ids.every((id) => byId.has(id));
}

export function lookupFinding(id: string): KnownFinding | undefined {
  return byId.get(id);
}
