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

import type { ModelingDriver, OperationOutcome } from "./driver";
import type { Operation } from "./operations";
import { CANDIDATE_KINDS, formatOperation } from "./operations";
import { canonicalize, diffCanonical } from "../util/xml-canonical";
import { importXml, exportXml } from "../model/io";
import {
  collectIds,
  normalizeGeneratedIds,
  snapshotXml,
  type ModelSnapshot,
  type SnapshotNode,
} from "./snapshot";

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
    match: /^outcome\/.*\/threw-both$/,
    verdict: "intentional",
    reason:
      "Both engines refuse the operation by throwing. The harness records that as an outcome and " +
      "does not treat the *style* of refusal as a model difference; what matters is that the " +
      "resulting documents agree, which is compared separately.",
  },
  {
    match: /^outcome\/.*\/threw-reference$/,
    verdict: "reference-wrong",
    reason:
      "bpmn-js threw where ARCTOS carried the operation out or refused it by rule. Measured cause: " +
      "bpmn-js' LabelLink calls path-intersection on an element whose SVG path jsdom reports as " +
      "empty (`Cannot read properties of null (reading 'length')`), which happens when an external " +
      "label moves with its boundary event. That is a limitation of the reference *in this " +
      "harness*, not a statement about ARCTOS — and it is exactly why the throwing side belongs in " +
      "the signature: the previous rule spelled `…/threw` without a side and classified the " +
      "reference's crash as a deliberate difference.",
  },
  {
    match: /^outcome\/.*\/threw-ours$/,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT. ARCTOS threw where the reference gave a verdict. A throw out of the modeling " +
      "layer is always a finding — the property runner treats `driver/threw` the same way.",
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
    // [ARCTOS-FULL-2026-08-31 · OP-163] Die einzige Klasse, die nach dem
    // Einschalten des XML-Vergleichs uebrig bleibt — und ein echter Befund.
    match: /^xml\/\{[^}]*\}(incoming|outgoing)\//,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT, low severity, entdeckt beim Einschalten des XML-Vergleichs (OP-163). ARCTOS " +
      "schreibt <bpmn:incoming>/<bpmn:outgoing> auf Flussknoten, die das Quelldokument OHNE diese " +
      "Verweise enthaelt. Gemessen an synth-boundary-events, load+save mit NULL Operationen: gegen " +
      "die Quelle hat ARCTOS 35 semantische Differenzen, bpmn-js 23; die zwoelf zusaetzlichen sind " +
      "genau die Verweise, die ARCTOS auf Sub_Start, Sub_Task und Sub_End des Teilprozesses " +
      "Sub_Pruefung ergaenzt (Sub_Flow_1/Sub_Flow_2). Die uebrigen 23 teilen beide Engines; sie " +
      "stammen aus bpmn-moddle und sind an anderer Stelle klassifiziert.\n\n" +
      "Warum das trotz semantischer Gleichwertigkeit ein Befund ist: incoming/outgoing sind laut " +
      "Metamodell ableitbar, ihr Fehlen ist zulaessig, und beide Dokumente beschreiben denselben " +
      "Prozess. Aber es ist eine Byte-Aenderung an einem Dokument, das niemand bearbeitet hat — " +
      "genau das, was Plan §5.1 Z-D (read-preserve-write) ausschliesst. Wer eine Datei oeffnet und " +
      "wieder schliesst, bekommt einen Diff in seiner Versionsverwaltung. Die Modell-Ebene von " +
      "ARCTOS macht das NICHT (importXml/exportXml lassen die Knoten unveraendert, gemessen ueber " +
      "lossySignatures); es entsteht in der Modellierungsschicht beim Zurueckschreiben " +
      "materialisierter Elemente. Weitergereicht an den Modellierungs-Strang.",
  },
  {
    match: /^candidate-set\/container\/more-reference$/,
    verdict: "intentional",
    reason:
      "bpmn-js knows more containers than ARCTOS because it materialises **every** BPMNPlane: an " +
      "expanded sub-process in its own plane becomes a second (and third) root element, and its " +
      "children join the registry. ARCTOS' modeling importer reads one plane " +
      "(src/modeling/importer.ts, resolvePlane) and warns when the document has more. Measured on " +
      "synth-nested-subprocesses: bpmn-js offers [Process_Nested, Sub_L1, Sub_L2], ARCTOS the " +
      "first two. Deliberate for now and bounded: the first level is complete and round-trips " +
      "byte-identically, the deeper planes are preserved verbatim in the document because nothing " +
      "in this layer touches them. What is missing is the *editing* of the deeper level — the " +
      "drill-down work package (plan §3.4/A5, STUFE2-A2-GRC.md §6). It is listed as an open " +
      "feature, not as a defect of the engine, and the harness says so instead of reporting the " +
      "same gap once per generated sequence.",
  },
  {
    match: /^candidate-set\/(flowNode|removable|activity)\/more-reference$/,
    verdict: "intentional",
    reason:
      "Same cause as candidate-set/container/more-reference, seen through the other candidate " +
      "kinds: the flow nodes and connections of a deeper BPMNPlane are in bpmn-js' registry and " +
      "not in ARCTOS'. No element is lost — they stay in the document — they are only not " +
      "editable in this stage.",
  },
  {
    match: /^candidate-set\/.*\/more-ours$/,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT, halved in STUFE2-2A (4 -> 2). ARCTOS holds elements the reference does not " +
      "after the same sequence.\n\n" +
      "FIXED (2 of 4): the `shape.create` rule short-circuited to true whenever canAttach() said " +
      "'attach'. diagram-js asks `shape.attach` first and `shape.create` only afterwards, so the " +
      "shortcut answered a question that is never put to this rule — and it skipped canDrop(), " +
      "whose 'a collapsed sub-process takes nothing' was therefore dead. Measured: " +
      "createShape(bpmn:IntermediateThrowEvent, in Sub_Pruefung) on synth-boundary-events was " +
      "applied by ARCTOS and refused by the reference; the resulting element sat inside a " +
      "collapsed sub-process, visible on no plane, and showed up here as the extra candidate.\n\n" +
      "OPEN (2 of 4), and **not** what STUFE2-D §2.5 assumed. The report wrote 'one extra " +
      "bpmn:SequenceFlow after connect+undo'. Measured, both remaining cases are the reference's " +
      "**DropOnFlowBehavior**: dropping or creating a flow node on top of a sequence flow makes " +
      "bpmn-js split that flow and wire the node in. ARCTOS has no such behaviour, so it keeps " +
      "the original flow and the node sits on the line unconnected. Seen once as " +
      "element-set/bpmn:SequenceFlow/sourceRef (FF_3: F_Service against F_Start after a single " +
      "reparent). Neither document loses data; it is a missing editing convenience, not a leak. " +
      "Handed to wave 2b, where OP-019 (the automatic type change on attach) already lives — " +
      "both are 'the engine reacts to where you dropped something'.",
  },
  {
    match:
      /^outcome\/(createShape|connect|reparent|remove|changeLane)\/(applied-vs-rejected|rejected-vs-applied)$/,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT: BpmnRules parity. The two rule sets answer the same question differently. " +
      "The verdict is `ours-wrong` by burden of proof, not by authority: bpmn-js' rules have a " +
      "decade of production behind them, so the new engine owes the argument for each difference. " +
      "Plan §5.6 criterion 4 requires this list to be worked through case by case before bpmn-js " +
      "may be removed.\n\n" +
      "Worked through in STUFE2-D:\n" +
      "  * connect (4 occurrences, now 0) — FIXED and not by imitation. ARCTOS let a message flow " +
      "    end on any event; measured case Task_Bank_Entscheiden -> End_Kunde across the pool " +
      "    boundary. BPMN 2.0 gives a message flow a direction: a *throwing* event may send " +
      "    (End, IntermediateThrow), a *catching* one may receive (Start, IntermediateCatch). A " +
      "    message flow onto an end event says 'this event receives a message', and an end " +
      "    event receives nothing. Reference and specification agree; ARCTOS was the outlier. " +
      "    See BpmnRules.isMessageFlowSource/isMessageFlowTarget.\n" +
      "  * reparent (1 occurrence, open) — ARCTOS allows `elements.move` for a boundary event " +
      "    when the named target is the parent it already has, i.e. a null reparent; bpmn-js " +
      "    refuses any move of a boundary event that names a target, because it routes boundary " +
      "    events through attach. Both are internally consistent and the resulting documents are " +
      "    identical. NOT aligned on purpose: the `element.parent === target` branch is what lets " +
      "    diagram-js' attach-support move a host together with its attachers, and removing it " +
      "    would make every activity with a boundary event undraggable — a regression far worse " +
      "    than one divergence in a hundred sequences.\n" +
      "  * createShape (2 occurrences, open) — creating a Task or an EventBasedGateway in the " +
      "    root of synth-nested-subprocesses (ARCTOS allows, bpmn-js refuses).",
  },
  {
    match: /^element-(set|type)\//,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT. After the same sequence the two documents contain different elements, or the " +
      "same id carries a different type or a different sourceRef/targetRef. Data-level " +
      "divergence, and on save that is data loss or corruption rather than a cosmetic " +
      "difference. Blocks plan §5.6 criterion 2.\n\n" +
      "Worked through in STUFE2-2A (11 occurrences -> 7). The single behavioural root is the " +
      "reference's DetachEventBehavior: bpmn-js replaces a boundary event that leaves its host " +
      "with a bpmn:IntermediateCatchEvent, ARCTOS refuses the detachment instead " +
      "(BoundaryEventBehavior.keepAttachment — a boundary event without attachedToRef is " +
      "invalid BPMN, and moddle drops the attribute silently). Both answers produce a valid " +
      "document; from there the generated ids run apart and the remaining element-type entries " +
      "are that drift, not separate defects.\n\n" +
      "STUFE2-D §2.8 proposed a content-based alignment of generated ids (type + container + " +
      "neighbours) as the fix for the drift. **It was built and measured, and it is worse**: " +
      "20 -> 52 ours-wrong over the same 100 sequences, 70 with the name in the key. Grouping " +
      "by type decouples the numbering of shapes and connections, and that is exactly what must " +
      "not happen — CandidateOrder already makes both engines create the same elements in the " +
      "same order, so global document position is the quantity that genuinely agrees. The " +
      "reasoning and the table are in snapshot.ts above normalizeGeneratedIds.",
  },
  {
    match: /^waypoints\/.*\/count$/,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT, all but one occurrence closed in STUFE2-2A (34 -> 1). Different number of " +
      "waypoints for the same connection after the same operations. Cosmetic in the picture, but " +
      "it makes every save a diff.\n\n" +
      "Three causes were separated. (1) FIXED in STUFE2-D: the layouter defaulted a missing " +
      "connectionStart/connectionEnd hint to getMid(shape) instead of the *existing* docking " +
      "point, so repairConnection considered every route reparable. (2) FIXED in STUFE2-2A and " +
      "the dominant one: BpmnLayouter offered `['straight', 'h:h']` as the preferred layouts of " +
      "*every* sequence flow. In ManhattanLayout `straight` is not a finishing touch but a " +
      "precedence — tryLayoutStraight pulls axis-overlapping shapes onto a common axis and the " +
      "route collapses to two points, destroying any hand-laid bend. The reference offers " +
      "`straight` only for message flows and for connections at an expanded sub-process. " +
      "Dropping it alone took the class from 34 to 9; the full BPMN decision table (gateways " +
      "v:h/h:v, boundary events by attach orientation, loops, preserveDocking, and the vertical " +
      "counterpart for vertical pools) took it to 2. (3) FIXED: imported waypoints carried no " +
      "`original`, so every later layout used the *cropped* point as the logical anchor — see " +
      "the waypoints/*/position rule.\n\n" +
      "The report STUFE2-D §2.4 suspected a relayout on redo. **That was wrong**, and the " +
      "measurement says so: the smallest reproducing sequence is a *single* reparent on " +
      "synth-foreign-camunda-extensions with no undo/redo at all (FF_1, FF_3: 2 waypoints " +
      "against 4). The class had a table cause, not a state cause.\n\n" +
      "The one remaining occurrence is a consequence of the reference's DropOnFlowBehavior " +
      "(see candidate-set/*/more-ours), not of the routing.",
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
    // Order matters: this entry must come *before* the `…/position` rule below,
    // because `classify()` takes the first match and `…/position` would also
    // match `…/position/grid-snap` without the `$` anchor it happens to carry.
    match: /^waypoints\/bpmn:(Sequence|Message)Flow\/position\/grid-snap$/,
    verdict: "intentional",
    reason:
      "The reference Modeler snaps the middle segments of a freshly routed connection onto a 10px " +
      "grid (bpmn-js features/grid-snapping/behavior/GridSnappingLayoutConnectionBehavior, " +
      "snapMiddleSegments, on connection.create and connection.layout). ARCTOS' modeling layer " +
      "has no grid: snapping is an editing convenience and belongs to the editor, not to the " +
      "model — a document written by a headless import/edit/export must not silently move a " +
      "hand-laid route by five pixels. Measured in STUFE2-2A: after the layout table and the " +
      "import-docking fix, *every* remaining waypoint-position difference in the 100-sequence " +
      "run was of this shape (345 vs 350, 226 vs 230, 387 vs 390, 415 vs 420, 290 vs 295 …) — " +
      "an interior waypoint, the reference exactly on the grid, ours not, the gap at most half a " +
      "grid step. The three conditions are checked (isGridSnapDifference); a routing difference " +
      "that does not meet all three keeps the signature without the suffix and stays ours-wrong, " +
      "so a *new* kind of waypoint difference still fails the suite. Revisit when the editor " +
      "strand adds grid snapping: then the two should agree again and this class should vanish " +
      "rather than be tolerated.",
  },
  {
    match: /^waypoints\/bpmn:(Sequence|Message)Flow\/position$/,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT, halved in STUFE2-D. The dominant cause is fixed: the endpoints of every " +
      "computed route sat in the *centre* of source and target instead of on their outline, " +
      "because BpmnUpdater registered diagram-js' CroppingConnectionDocking as a service and " +
      "never called it (the reference crops in exactly the same two commands, connection.layout " +
      "and connection.create). The signature reported the difference as half a shape width — " +
      "measured 170 against 188 at a 36px event, which is centre against right edge. A line " +
      "beginning in the middle of an activity lies across its label; no test saw it because the " +
      "raster baselines only show *imported* diagrams, whose DI is read rather than computed. " +
      "The class fell from 42+8 to 20+2 in the 100-sequence run. The rest is intermediate " +
      "waypoints after a move or connect; classified, not accepted, so that a *new* kind of " +
      "waypoint difference still fails the suite. Blocks plan §5.6 criterion 2.\n\n" +
      "STUFE2-2A took the class from 20+2 to 1+1 through two further causes. (a) The BPMN " +
      "decision table (see waypoints/*/count). (b) **Imported connections carried no logical " +
      "docking point.** BPMN DI has only the drawn point; diagram-js keeps the point the routing " +
      "meant next to it as `waypoint.original`, and every later computation uses " +
      "`original ?? point`. Without it the *cropped* point becomes the anchor and the docking " +
      "creeps along the outline with every edit. Measured on synth-foreign-camunda-extensions, " +
      "one reparent: FF_1 left the start event at (188,138) — the bottom **right corner** of a " +
      "circle's bounding box — where the reference left it at (170,138), the bottom centre. The " +
      "reference has a dedicated component for this (ImportDockingFix); ARCTOS had none. " +
      "src/modeling/docking.ts is the equivalent, and the importer calls it. What is left is one " +
      "message flow endpoint and one sequence-flow waypoint that follows the lane-content " +
      "difference below.",
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
      "OPEN DEFECT, much reduced. Until STUFE2-D this class was the missing auto-resize: a " +
      "container simply did not grow, and the two engines ended up 90px apart (300 vs 390 on " +
      "E_EventSub). src/modeling/behaviors/AutoResizeBehavior.ts now uses diagram-js' own " +
      "features/auto-resize, so the offsets, the trigger threshold and the recursion are the same " +
      "code on both sides; the class fell from 15 occurrences to 1 in the 100-sequence run. What " +
      "is left is a 5px difference (515 vs 520) that comes from the *position of the newly " +
      "created shape*, not from the resize: the harness clamps a create position into the parent " +
      "(`inside()`), both drivers clamp with the same margin, and the remaining pixels follow the " +
      "container the clamp was measured against. Still 1 occurrence after STUFE2-2A (515 against " +
      "520 on E_EventSub). Note the correlation with the grid-snap class: the reference value is " +
      "a multiple of the 10px grid and ours is not, which points at the same " +
      "GridSnapping — but the arithmetic runs through the auto-resize padding and was not " +
      "traced to the end, so the class keeps its verdict rather than being reclassified on a " +
      "hunch.",
  },
  {
    match: /^bounds\/bpmn:/,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT, reduced to a placement convention in STUFE2-2A. An *existing* element sits " +
      "somewhere else after the same sequence. When a pool grows, bpmn-js' resizeLane makes room " +
      "by moving the lane's contents (its SpaceTool path); ARCTOS redistributed the lane *bounds* " +
      "and left the nodes standing (End_Bank y=255 against y=275).\n\n" +
      "STUFE2-D called this cosmetic — 'neither side loses data'. Measured, it was not. " +
      "synth-collaboration-pools-lanes, Participant_Bank grown from 260 to 390px: the boundary " +
      "of Lane_Genehmigung moved from y=210 to y=275 *under* Task_Bank_Entscheiden, " +
      "syncLaneMembership recomputed membership from the geometry, and the activity silently " +
      "changed lane. In this product the lane says **who** performs the step and flowNodeRef " +
      "carries that; a resize elsewhere in the diagram must not reassign responsibility. " +
      "End_Bank additionally ended up above the top edge of its own lane. " +
      "redistributeLanes now moves a leaf lane's content by the same offset as its leading edge " +
      "— but only for nodes that would otherwise fall out of the lane, so a resize does not " +
      "displace the element that caused it.\n\n" +
      "What remains is the convention itself: the reference moves the whole content, ARCTOS the " +
      "minimum. Both documents are valid; the verdict stays ours-wrong by burden of proof, " +
      "because bpmn-js' behaviour is the one users of the old editor know. Distinct from " +
      "`bounds/…/created`, which is about elements the run itself made.",
  },
  {
    match: /^element-name\/bpmn:(Sequence|Message)Flow\/name$/,
    verdict: "ours-wrong",
    reason:
      "OPEN DEFECT, low severity. A generated connection carries a name in one model and not in " +
      "the other. ARCTOS' ConnectionBehavior carries the name over when it replaces a sequence " +
      "flow with a message flow at a pool boundary (STUFE2-C §4.2, finding 4); bpmn-js' " +
      "replacement path does not always do so. The name is user text and never appears in a " +
      "signature, so the class is named by element type only. No data is lost on our side — we " +
      "keep more — but the two documents differ, so it is counted.",
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

    // [ARCTOS-FULL-2026-08-31 · OP-163] Nur was WIRKLICH fehlt, nicht was sich
    // verschoben hat.
    //
    // `diffCanonical` ist ein LCS-Diff über Zeilen einer sortierten kanonischen
    // Form. Fällt ein einziges Attribut weg, ändert sich damit der Sortier-
    // schlüssel seines Elements, und der GANZE Block wandert an eine andere
    // Stelle — der Diff meldet ihn als „entfernt" plus „hinzugefügt". Gemessen
    // an `synth-boundary-events`: der Modell-Round-Trip verliert genau ein
    // Attribut, `@cancelActivity="true"` (bpmn-moddle schreibt den Vorgabewert
    // nicht zurück), und produziert daraus **23** Diff-Zeilen, darunter
    // `<outgoing>`, `text "Flow_Fehler"` und `<errorEventDefinition>`.
    //
    // Diese Mitläufer landeten unbesehen in der Verlustmenge, und weil eine
    // Signatur bewusst inhaltsfrei ist (Elementtyp plus Attributname), passte
    // `xml/…}outgoing/<…outgoing>` anschliessend auf JEDE `outgoing`-Differenz
    // irgendeines anderen Dokuments. Das Urteil `both-lossy` — „bpmn-moddle
    // verliert das ohnehin" — wäre damit an Stellen vergeben worden, an denen
    // bpmn-moddle gar nichts verliert. Eine Zeile, die vorher UND nachher im
    // Dokument steht, ist kein Verlust, egal wo der Diff sie einsortiert.
    const removedCount = new Map<string, number>();
    const addedCount = new Map<string, number>();
    for (const difference of differences) {
      const target = difference.kind === "removed" ? removedCount : addedCount;
      target.set(difference.text, (target.get(difference.text) ?? 0) + 1);
    }
    const seen = new Map<string, number>();
    for (const difference of differences) {
      if (difference.kind !== "removed") continue;
      const index = (seen.get(difference.text) ?? 0) + 1;
      seen.set(difference.text, index);
      // Die ersten `addedCount` Vorkommen sind wiedergefunden — verschoben,
      // nicht verloren. Erst der Überschuss ist ein echter Verlust.
      if (index <= (addedCount.get(difference.text) ?? 0)) continue;
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

/**
 * Grid spacing of the reference `Modeler`, in px (`diagram-js` `GridSnapping`).
 */
export const REFERENCE_GRID_PX = 10;

/**
 * Is this waypoint difference the reference's grid snapping and nothing else?
 *
 * [ARCTOS-FULL-2026-08-31 · OP-021] `bpmn-js`' Modeler ships
 * `GridSnappingLayoutConnectionBehavior`, which after every `connection.create`
 * and `connection.layout` pulls the **middle** segments of the route onto a
 * 10px grid (`snapMiddleSegments`). ARCTOS' modeling layer has no grid — grid
 * snapping is an editing convenience and lives in the editor, not in the model.
 *
 * The three conditions together are what makes this recognisable rather than a
 * blanket excuse: an interior waypoint, the reference exactly on the grid and
 * ours not, and a gap of at most half a grid step. A genuine routing
 * difference is not bounded by half a grid step and does not land on a
 * multiple of ten on one side only. Measured over the 100-sequence run: every
 * remaining `…/position` occurrence met all three (345 vs 350, 226 vs 230,
 * 387 vs 390, 415 vs 420, …).
 */
function isGridSnapDifference(
  index: number,
  count: number,
  ours: { x: number; y: number },
  reference: { x: number; y: number },
): boolean {
  if (index === 0 || index >= count - 1) return false;
  const half = REFERENCE_GRID_PX / 2;
  if (
    Math.abs(ours.x - reference.x) > half ||
    Math.abs(ours.y - reference.y) > half
  ) {
    return false;
  }
  const onGrid = (value: number): boolean =>
    Number.isInteger(value) && value % REFERENCE_GRID_PX === 0;
  const changedAxes: ("x" | "y")[] = [];
  if (ours.x !== reference.x) changedAxes.push("x");
  if (ours.y !== reference.y) changedAxes.push("y");
  if (changedAxes.length === 0) return false;
  return changedAxes.every(
    (axis) => onGrid(reference[axis]) && !onGrid(ours[axis]),
  );
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
          const snapped = isGridSnapDifference(
            index,
            ours.waypoints.length,
            point,
            other,
          );
          out.push({
            kind: "waypoints",
            signature: `waypoints/${ours.type}/position${snapped ? "/grid-snap" : ""}`,
            detail:
              `${ours.id} waypoint ${index}: (${point.x},${point.y}) vs (${other.x},${other.y}), ` +
              `tolerance ${WAYPOINT_TOLERANCE_PX}px` +
              (snapped
                ? ` — reference value is on the ${REFERENCE_GRID_PX}px grid, ours is not, ` +
                  `and the gap is at most half a grid step: the reference's ` +
                  `GridSnappingLayoutConnectionBehavior, not a routing difference`
                : ""),
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

/**
 * [ARCTOS-FULL-2026-08-31 · OP-163] Die Ebene, die der XML-Vergleich NICHT
 * anfasst: die Diagramm-Interchange-Namensräume.
 *
 * Nicht aus Bequemlichkeit. `compareSnapshots` vergleicht Bounds und Waypoints
 * bereits — mit Toleranzen (`BOUNDS_TOLERANCE_PX`, `WAYPOINT_TOLERANCE_PX`) und
 * mit dem Wissen, welche Knoten textabhängige Geometrie haben. Der XML-Diff
 * kennt diese Toleranzen nicht: er meldet eine 1-px-Abweichung, die eine Ebene
 * höher als gleich gilt, als harte Differenz, und dazu jede von der Referenz
 * frei vergebene DI-Kennung (`BPMNShape_di_1a2b3c`).
 *
 * Gemessen am 2026-09-03 über das Korpus: 260 unklassifizierte Differenzen bei
 * eingeschaltetem XML-Vergleich, davon **254** aus `{…DI}`/`{…DC}` — Bounds,
 * Waypoints, BPMNShape-/BPMNEdge-Kennungen, BPMNPlane-Präsenz. Es blieben 6
 * Differenzen mit eigener Aussage übrig. Genau dieses Verhältnis ist der Grund,
 * aus dem der Schalter überhaupt abgeschaltet wurde („der XML-Diff ist noisy") —
 * und der Grund, aus dem `both-lossy` seitdem nicht auftreten konnte.
 *
 * Was nach dem Filter übrig bleibt, ist die semantische Ebene: genau das, was
 * die Modellvergleiche NICHT sehen (Verweise, Extensions, Attribute mit
 * Vorgabewerten, Kommentare, Processing Instructions) — und genau die Ebene,
 * auf der bpmn-moddle tatsächlich Information verliert.
 */
const DI_NAMESPACES = [
  "http://www.omg.org/spec/BPMN/20100524/DI",
  "http://www.omg.org/spec/DD/20100524/DI",
  "http://www.omg.org/spec/DD/20100524/DC",
] as const;

/** True für eine Differenz, die in der Zeichenebene sitzt. */
export function isDiagramInterchange(context: string, text: string): boolean {
  return DI_NAMESPACES.some((ns) => context.includes(ns) || text.includes(ns));
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
    if (isDiagramInterchange(difference.context, difference.text)) continue;
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
   * Compare the exported XML as well as the model.
   *
   * [ARCTOS-FULL-2026-08-31 · OP-163] Vorgabe ist jetzt **an**; nur ein
   * ausdrückliches `false` schaltet ab. Vorher war es umgekehrt, und kein
   * Aufrufer setzte den Schalter — mit zwei Folgen. Die eine steht im Register:
   * `lossySignatures()` erzeugt ausschliesslich `xml/…`-Signaturen, also konnte
   * das Urteil `both-lossy` gar nicht vergeben werden, und die Null in der
   * Auswertung hiess nicht „bpmn-moddle verliert nichts", sondern „auf dieser
   * Ebene wird nicht gemessen". Die andere ist grösser: die gesamte semantische
   * Ebene ausserhalb des Modell-Snapshots — Verweise, Extensions, Kommentare,
   * Attribute mit Vorgabewerten — war vom Vergleich ausgenommen.
   *
   * Die Begründung von damals („noisy") war richtig und ist mit dem
   * DI-Filter oben erledigt: das Rauschen kam zu 98 % aus der Zeichenebene,
   * die `compareSnapshots` ohnehin mit Toleranzen vergleicht.
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
      const mine = ours.candidates(mismatched);
      const theirs = reference.candidates(mismatched);
      // Die Richtung gehört in die Signatur, nicht nur in den Text. Ohne sie
      // fielen zwei gegensätzliche Sachverhalte in **eine** Klasse: ARCTOS
      // kennt mehr Elemente (weil es fehlende DI ergänzt — dieselbe Absicht
      // wie `bounds|waypoints/*/presence/only-ours`) oder ARCTOS kennt
      // weniger (weil sein Importer nur die erste BPMNPlane liest). Das erste
      // ist eine Entscheidung, das zweite eine Lücke; eine gemeinsame
      // Klassifikation müsste eines von beiden falsch benennen.
      const direction =
        mine.length > theirs.length ? "more-ours" : "more-reference";
      const onlyOurs = mine.filter((id) => !theirs.includes(id));
      const onlyTheirs = theirs.filter((id) => !mine.includes(id));
      divergences.push({
        kind: "element-set",
        signature: `candidate-set/${mismatched}/${direction}`,
        detail:
          `before operation ${index} (${formatOperation(op)}) the two engines no longer agree on ` +
          `which elements exist: ARCTOS has ${mine.length} "${mismatched}" ` +
          `candidates, bpmn-js ${theirs.length}` +
          (onlyOurs.length > 0
            ? `; only ARCTOS: [${onlyOurs.join(", ")}]`
            : "") +
          (onlyTheirs.length > 0
            ? `; only bpmn-js: [${onlyTheirs.join(", ")}]`
            : "") +
          ". The replay stops here; everything after this point would compare different models.",
      });
      break;
    }

    const a = await ours.apply(op);
    const b = await reference.apply(op);
    ourOutcomes.push(a.outcome);
    referenceOutcomes.push(b.outcome);
    if (a.outcome !== b.outcome) {
      // **Wer** geworfen hat, gehört in die Signatur. Vorher hieß jede
      // Ausnahme `…/threw` und war als `intentional` eingestuft mit der
      // Begründung, der *Stil* der Ablehnung sei keine Modelldifferenz. Das
      // stimmt, solange geworfen wird **statt** abzulehnen — aber nicht, wenn
      // eine Engine tatsächlich abstürzt. Genau das trat auf, als der
      // Auto-Resize die Geometrie veränderte: `bpmn-js` warf in `LabelLink`
      // (`path-intersection` über einen leeren Pfad, eine jsdom-Grenze), und
      // die alte Signatur hätte den Absturz der Referenz als gewollte
      // Abweichung durchgewinkt. Ein Wurf **unserer** Engine ist immer ein
      // Befund, ein Wurf der Referenz nie einer über uns.
      const outcomeKey =
        a.outcome === "threw" && b.outcome === "threw"
          ? "threw-both"
          : a.outcome === "threw"
            ? "threw-ours"
            : b.outcome === "threw"
              ? "threw-reference"
              : `${a.outcome}-vs-${b.outcome}`;
      divergences.push({
        kind: "outcome",
        signature: `outcome/${op.kind}/${outcomeKey}`,
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
    // [OP-163] `!== false` statt `=== true` — s. ShadowRunOptions.compareXml.
    if (options.compareXml !== false)
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
