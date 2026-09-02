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
 * `bpmnRules`, `modeling`, `layouter`, `bpmnImporter` und zwei Verhalten.
 */

import AttachSupportModule from "diagram-js/lib/features/attach-support/index.js";
import ChangeSupportModule from "diagram-js/lib/features/change-support/index.js";
import CommandModule from "diagram-js/lib/command/index.js";
import LabelSupportModule from "diagram-js/lib/features/label-support/index.js";
import RulesModule from "diagram-js/lib/features/rules/index.js";
import SelectionModule from "diagram-js/lib/features/selection/index.js";
import CroppingConnectionDocking from "diagram-js/lib/layout/CroppingConnectionDocking.js";

import { arctosModdle } from "../model/moddle.js";
import { BpmnFactory } from "./BpmnFactory.js";
import { BpmnElementFactory } from "./ElementFactory.js";
import { BpmnLayouter } from "./BpmnLayouter.js";
import { BpmnRules } from "./BpmnRules.js";
import { BpmnUpdater } from "./BpmnUpdater.js";
import { BpmnModeling } from "./Modeling.js";
import { BpmnImporter } from "./importer.js";
import { BoundaryEventBehavior } from "./behaviors/BoundaryEventBehavior.js";
import { LabelBehavior } from "./behaviors/LabelBehavior.js";

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
    "modeling",
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
} from "./BpmnFactory.js";
export {
  BpmnElementFactory,
  type BpmnElementAttrs,
  type ElementKind,
} from "./ElementFactory.js";
export {
  BpmnLayouter,
  attachOrientation,
  preferredLayouts,
  type LayoutHints,
} from "./BpmnLayouter.js";
export {
  BpmnRules,
  canAttach,
  canConnect,
  canConnectAssociation,
  canConnectDataAssociation,
  canConnectMessageFlow,
  canConnectSequenceFlow,
  canDrop,
  canMove,
  canReconnect,
  canResize,
  type ConnectionRuleResult,
} from "./BpmnRules.js";
export { BpmnUpdater, isFullyLinked } from "./BpmnUpdater.js";
export { BpmnModeling } from "./Modeling.js";
export {
  BpmnImporter,
  importDefinitions,
  type ImportDefinitionsOptions,
  type ImportDefinitionsResult,
} from "./importer.js";
export { BpmnIds, localName } from "./ids.js";
export {
  BoundaryEventBehavior,
  snapToHostBorder,
} from "./behaviors/BoundaryEventBehavior.js";
export {
  LabelBehavior,
  labelStateIsConsistent,
} from "./behaviors/LabelBehavior.js";
export {
  AddLaneHandler,
  RemoveLaneHandler,
  SplitLaneHandler,
  isLaneTarget,
  sliceBounds,
} from "./cmd/LaneHandlers.js";
export { UpdateLabelHandler, labelProperty } from "./cmd/UpdateLabelHandler.js";
export { UpdatePropertiesHandler } from "./cmd/UpdatePropertiesHandler.js";

export * from "./invariants.js";
export * from "./lanes.js";
export * from "./labels.js";
export * from "./di.js";
export * from "./types.js";
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
} from "./util.js";
export {
  ModelingSession,
  createModelingSession,
  type ModelingSessionOptions,
} from "./session.js";
