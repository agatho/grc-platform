/**
 * `diagram-js`-Modul der Modellierungsschicht.
 *
 * Was von `diagram-js` kommt und **nicht** nachgebaut wird (Plan §2.2):
 * `CommandStack` samt Undo/Redo, `change-support`, `selection`, `rules`,
 * `attach-support` (Anhefter mitbewegen und mitlöschen), `label-support`
 * (Beschriftungen mitbewegen und mitlöschen), `ManhattanLayout` und
 * `CroppingConnectionDocking`.
 *
 * Was hier entsteht: `bpmnFactory`, `elementFactory`, `bpmnUpdater`,
 * `bpmnRules`, `modeling`, `layouter`, `bpmnImporter` und vier Verhalten.
 */

import AttachSupportModule from "diagram-js/lib/features/attach-support/index.js";
import ChangeSupportModule from "diagram-js/lib/features/change-support/index.js";
import CommandModule from "diagram-js/lib/command/index.js";
import LabelSupportModule from "diagram-js/lib/features/label-support/index.js";
import RulesModule from "diagram-js/lib/features/rules/index.js";
import SelectionModule from "diagram-js/lib/features/selection/index.js";
import CroppingConnectionDocking from "diagram-js/lib/layout/CroppingConnectionDocking.js";

import { arctosModdle } from "../model/moddle";
import { BpmnFactory } from "./BpmnFactory";
import { BpmnElementFactory } from "./ElementFactory";
import { BpmnLayouter } from "./BpmnLayouter";
import { BpmnRules } from "./BpmnRules";
import { BpmnUpdater } from "./BpmnUpdater";
import { BpmnModeling } from "./Modeling";
import { BpmnImporter } from "./importer";
import { BoundaryEventBehavior } from "./behaviors/BoundaryEventBehavior";
import { ConnectionBehavior } from "./behaviors/ConnectionBehavior";
import { ParticipantBehavior } from "./behaviors/ParticipantBehavior";
import { LabelBehavior } from "./behaviors/LabelBehavior";
import { LaneResizeBehavior } from "./behaviors/LaneResizeBehavior";
import {
  AutoResizeRules,
  BpmnAutoResize,
} from "./behaviors/AutoResizeBehavior";

/** Die Modellierungsschicht als `didi`-Moduldeklaration. */
const modelingModule = {
  __depends__: [
    CommandModule,
    ChangeSupportModule,
    SelectionModule,
    RulesModule,
    AttachSupportModule,
    LabelSupportModule,
  ],
  __init__: [
    "bpmnUpdater",
    "bpmnRules",
    "labelBehavior",
    "boundaryEventBehavior",
    "connectionBehavior",
    "participantBehavior",
    "laneResizeBehavior",
    "modeling",
    // Zuletzt: `autoResize` hört auf `postExecuted` und muss die
    // Änderungen der übrigen Verhalten schon sehen.
    "autoResize",
    "autoResizeRules",
  ],
  moddle: ["value", arctosModdle],
  bpmnFactory: ["type", BpmnFactory],
  bpmnImporter: ["type", BpmnImporter],
  bpmnUpdater: ["type", BpmnUpdater],
  bpmnRules: ["type", BpmnRules],
  elementFactory: ["type", BpmnElementFactory],
  modeling: ["type", BpmnModeling],
  layouter: ["type", BpmnLayouter],
  connectionDocking: ["type", CroppingConnectionDocking],
  labelBehavior: ["type", LabelBehavior],
  boundaryEventBehavior: ["type", BoundaryEventBehavior],
  connectionBehavior: ["type", ConnectionBehavior],
  participantBehavior: ["type", ParticipantBehavior],
  // [ARCTOS-FULL-2026-08-31 · OP-041] Kind-Lanes ziehen mit ihrer Eltern-Lane
  // nach. Vor `autoResize` registriert, damit eine Lane-Umverteilung
  // abgeschlossen ist, bevor der Pool über sein Wachstum entscheidet.
  laneResizeBehavior: ["type", LaneResizeBehavior],
  autoResize: ["type", BpmnAutoResize],
  autoResizeRules: ["type", AutoResizeRules],
} as const;

export default modelingModule;

export { modelingModule };

export {
  BpmnFactory,
  DEFAULT_LABEL_SIZE,
  DEFAULT_SIZES,
  defaultSize,
  round,
  type CreateOptions,
} from "./BpmnFactory";
export {
  BpmnElementFactory,
  type BpmnElementAttrs,
  type ElementKind,
} from "./ElementFactory";
export {
  BpmnLayouter,
  attachOrientation,
  preferredLayouts,
  type LayoutHints,
} from "./BpmnLayouter";
export {
  BpmnRules,
  canAlign,
  canAttach,
  canConnect,
  canConnectAssociation,
  canConnectDataAssociation,
  canConnectMessageFlow,
  canConnectSequenceFlow,
  canCopy,
  canDrop,
  canMove,
  canReconnect,
  canReplace,
  canResize,
  minDimensionsFor,
  type ConnectionRuleResult,
  type Dimensions,
  type ResizeRuleResult,
} from "./BpmnRules";
export { BpmnUpdater, isFullyLinked } from "./BpmnUpdater";
export { BpmnModeling } from "./Modeling";
export {
  BpmnImporter,
  importDefinitions,
  type ImportDefinitionsOptions,
  type ImportDefinitionsResult,
} from "./importer";
export { BpmnIds, localName } from "./ids";
export {
  BoundaryEventBehavior,
  keepAttachment,
  snapToHostBorder,
} from "./behaviors/BoundaryEventBehavior";
export {
  ConnectionBehavior,
  affectedConnections,
} from "./behaviors/ConnectionBehavior";
export {
  LabelBehavior,
  labelStateIsConsistent,
} from "./behaviors/LabelBehavior";
export {
  AddLaneHandler,
  RemoveLaneHandler,
  SplitLaneHandler,
  isLaneTarget,
  sliceBounds,
} from "./cmd/LaneHandlers";
export {
  ReplaceShapeHandler,
  copySemanticProperties,
  type ReplaceShapeContext,
} from "./cmd/ReplaceShapeHandler";
export { UpdateLabelHandler, labelProperty } from "./cmd/UpdateLabelHandler";
export { UpdatePropertiesHandler } from "./cmd/UpdatePropertiesHandler";

export * from "./invariants";
export * from "./lanes";
export * from "./labels";
export * from "./di";
export * from "./types";
export {
  addRef,
  addToContainer,
  boOf,
  collaborationOf,
  containmentProperty,
  descendants,
  is,
  isAny,
  isEventSubProcess,
  isFlowElementContainerBo,
  isModdleElement,
  participantOf,
  removeFromContainer,
  removeRef,
  requireBo,
  semanticContainerOf,
  setProperty,
} from "./util";
export {
  ModelingSession,
  createModelingSession,
  type ModelingSessionOptions,
} from "./session";
