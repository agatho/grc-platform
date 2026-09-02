/**
 * Findings the verification tools currently reproduce, each with a verdict.
 *
 * **The list is empty.** As of the Stufe-2 close-out every entry it used to
 * carry has been fixed in `src/modeling/` (or, in one case, in the driver that
 * reported it) and no longer reproduces; each one was re-run individually
 * before it was moved to {@link RESOLVED_FINDINGS} below. An empty registry is
 * the strongest state this file can be in: `allKnown()` then answers `false`
 * for everything, so **every** property failure counts as a real failure, in
 * strict mode and outside it alike.
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

export const KNOWN_FINDINGS: readonly KnownFinding[] = [];

/**
 * What used to be in the list, kept as history rather than deleted.
 *
 * The registry's own rule was "an entry whose defect was fixed shows up as a
 * hit count that dropped to zero, and the next person to read the report
 * deletes it". Deleting it outright would throw away the only record of what
 * this engine once got wrong — the same argument that put
 * `test/modeling/findings.test.ts` in its own file. Each entry here has a
 * regression test; the `fixedIn` field says where.
 */
export interface ResolvedFinding extends KnownFinding {
  /** Where the fix lives, and which test holds it. */
  readonly fixedIn: string;
}

export const RESOLVED_FINDINGS: readonly ResolvedFinding[] = [
  {
    id: "driver/threw",
    fixedIn:
      "src/modeling (Arbeitsstrang A1); test/modeling/findings.test.ts §3.1",
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
    fixedIn: "src/modeling (A1); test/modeling/findings.test.ts §3.1",
    owner: "modeling",
    verdict: "engine-defect",
    repro: "same as driver/threw above",
    note: "Consequence of the missing waypoint coordinate; will disappear with it.",
  },
  {
    id: "ref/boundary-attached-to",
    fixedIn:
      "src/modeling/behaviors/BoundaryEventBehavior.ts (keepAttachment); test/modeling/findings.test.ts §5.3 (B2)",
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
    fixedIn:
      "wie ref/boundary-attached-to — BoundaryEventBehavior.keepAttachment; " +
      "test/modeling/findings.test.ts §5.3 (B2)",
    owner: "modeling",
    verdict: "engine-defect",
    repro: "same as ref/boundary-attached-to above",
    note: "The modeling layer's own invariant for the same state; both agree.",
  },
  {
    id: "modeling/PARENT_LINK_BROKEN",
    fixedIn:
      "src/modeling/invariants.ts (A1); test/modeling/findings.test.ts §3.8 — die Pruefung gilt nur noch dort, wo $parent den Export steuert",
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
    fixedIn:
      "src/modeling/BpmnUpdater.ts (A1); test/modeling/findings.test.ts §3.3",
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
    fixedIn:
      "src/modeling/BpmnUpdater.ts dropOwnPlanes (A1); test/modeling/findings.test.ts §3.2",
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
    fixedIn:
      "wie di/plane-element — src/modeling/BpmnUpdater.ts; test/modeling/findings.test.ts §3.2",
    owner: "modeling",
    verdict: "engine-defect",
    repro: "same as di/plane-element above",
    note: "Seven orphaned DI entries from the one removal; same cause.",
  },
  {
    id: "modeling/DI_ORPHANED",
    fixedIn:
      "wie di/plane-element — src/modeling/BpmnUpdater.ts; test/modeling/findings.test.ts §3.2",
    owner: "modeling",
    verdict: "engine-defect",
    repro: "same as di/plane-element above",
    note: "The modeling layer's own invariant for the same state; both agree.",
  },
  {
    id: "modeling/DATA_ASSOCIATION_DANGLING",
    fixedIn:
      "src/modeling/BpmnUpdater.ts dropDataAssociations (A1) und dropOwnedDataAssociationDi (Stufe 2/C); test/modeling/findings.test.ts §3.4 und §C.1",
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
    id: "modeling/CONTAINER_MISMATCH",
    owner: "verify",
    verdict: "engine-defect",
    fixedIn:
      "src/verify/drivers/{arctos,bpmnjs}.ts — the reparent case now asks the rules about the " +
      "destination; test/verify/reparent-rules.test.ts",
    repro:
      'runSequence(driver, corpus("synth-collaboration-pools-lanes"), [{"kind":"reparent",' +
      '"target":{"kind":"flowNode","index":18},"parent":{"kind":"container","index":0},"x":550,"y":250}]) ' +
      "after creating a sub-process — reparent it onto the bpmn:Collaboration root.",
    note:
      'Mine, not the engine\'s. Both drivers asked `rules.allowed("elements.move", { shapes: [target], ' +
      "target })` where `target` was the element being *moved*, not the destination — the rule was " +
      'handed the question "may X move into X?" and answered yes for a sub-process. The move then ' +
      "ran past a rule that would have refused it and produced a CONTAINER_MISMATCH no engine had " +
      "caused. Worse than a false positive: the shadowed name also meant `reparent` was mostly " +
      "*rejected* for ordinary flow nodes, so the operation was barely exercised at all. Fixing it " +
      "raised the strict failure count from 0 to 10 of 500 — and those ten were real (see below).",
  },
  {
    id: "structure/sequence-flow-crosses-container",
    owner: "modeling",
    verdict: "engine-defect",
    fixedIn:
      "src/modeling/behaviors/ConnectionBehavior.ts; test/modeling/findings.test.ts §C.2",
    repro:
      'runSequence(driver, corpus("synth-collaboration-pools-lanes"), [{"kind":"reparent",' +
      '"target":{"kind":"flowNode","index":3},"parent":{"kind":"container","index":4},"x":450,"y":350}]) ' +
      "— drag Start_Kunde into the other pool.",
    note:
      "Dragging a node into another pool or sub-process takes its sequence flows along, and BPMN " +
      "allows a sequence flow only inside one container. The engine kept them, so the file ended up " +
      "with a flow whose endpoints sit in two processes; moddle drops the unresolvable reference on " +
      "the next save while the picture looks perfectly fine. The fix converts the flow to a message " +
      "flow where the rules allow one and removes it where they do not — the same decision function " +
      "(`canConnect`) that governs drawing a new edge.",
  },
  {
    id: "structure/flow-in-wrong-container",
    owner: "modeling",
    verdict: "engine-defect",
    fixedIn:
      "same as structure/sequence-flow-crosses-container — " +
      "src/modeling/behaviors/ConnectionBehavior.ts; test/modeling/findings.test.ts §C.2",
    repro: "same as structure/sequence-flow-crosses-container above",
    note: "The second symptom of the same move: the flow stays in the container it was written to.",
  },
  {
    id: "di/orphan (data associations)",
    owner: "modeling",
    verdict: "engine-defect",
    fixedIn:
      "src/modeling/BpmnUpdater.ts dropOwnedDataAssociationDi; test/modeling/findings.test.ts §C.1",
    repro:
      'runSequence(driver, corpus("synth-data-objects-and-artifacts"), [{"kind":"remove",' +
      '"target":{"kind":"removable","index":6}}]) — remove the activity D_Task_Erfassen.',
    note:
      "The mirror image of DATA_ASSOCIATION_DANGLING. That one was about associations of *other* " +
      "activities pointing at a deleted data object; this one is about the associations the deleted " +
      "activity owns. They vanish semantically with it, but their bpmndi:BPMNEdge stays in the plane " +
      "— a data association usually has no graphical element, so the delete cascade never touches " +
      "it. Found at 1.000 sequences, three of them, shrunk to a single operation.",
  },
  {
    id: "modeling/DI_MISSING",
    fixedIn:
      "src/modeling/importer.ts (A1): repairMissingDi steigt jetzt in eingebettete Ebenen ab; der Korpus meldet keine Vorbelastung mehr",
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
