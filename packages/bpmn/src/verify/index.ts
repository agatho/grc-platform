/**
 * `@grc/bpmn/verify` — the tools that judge the modeling layer.
 *
 * They exist before the layer they judge, on purpose. The spike's own measured
 * conclusion was that the two most serious defects it found were caught by
 * rasterising and *looking*, not by any of its 118 tests — and that in the
 * modeling layer that eye does not exist, because a modeling defect is not
 * visible in the picture at all. It is visible in a file that a foreign tool
 * cannot read months later. These five tools are the replacement for the eye:
 *
 *   `invariants.ts`  what has to be true of the document after every operation,
 *                    plus delegation to `src/modeling/invariants.ts`;
 *   `property.ts`    random operation sequences with a deterministic seed and
 *                    delta-debugging shrinking, checked after every step;
 *   `shadow.ts`      the same input through `bpmn-js` and a classification of
 *                    every difference — temporary, see its header;
 *   `raster.ts`      render, rasterise, compare against a reference image with
 *                    a tolerance that forgives antialiasing and nothing else;
 *   `budget.ts`      time and memory on the largest corpus diagram, as a test.
 *
 * Nothing here is imported by `src/index.ts`: the verification surface is not
 * part of the package's public API and must never end up in an application
 * bundle. Tests import from these paths directly.
 */

export {
  checkAllInvariants,
  checkInvariants,
  formatViolations,
  hasModelingInvariants,
  isActivityType,
  loadModelingInvariants,
  type AllInvariantsOptions,
  type CheckOptions,
  type InvariantReport,
  type InvariantSeverity,
  type InvariantViolation,
} from "./invariants.js";

export {
  CANDIDATE_KINDS,
  CREATABLE_TYPES,
  BOUNDARY_EVENT_DEFINITIONS,
  OPERATION_KINDS,
  deserializeSequence,
  formatOperation,
  formatSequence,
  ref,
  serializeSequence,
  type CandidateKind,
  type ElementRef,
  type Operation,
  type OperationKind,
} from "./operations.js";

export {
  CandidateOrder,
  resolveIndex,
  type ModelingDriver,
  type OperationOutcome,
  type OperationResult,
} from "./driver.js";

export { AWKWARD_NAMES, Rng } from "./random.js";

export {
  failureIds,
  formatFailure,
  generateOperation,
  generateSequence,
  runCampaign,
  runSequence,
  shrinkSequence,
  type CampaignFailure,
  type CampaignOptions,
  type CampaignResult,
  type GenerateOptions,
  type RunSequenceOptions,
  type SequenceFailure,
  type SequenceResult,
  type ShrinkResult,
  type StepTrace,
} from "./property.js";

export {
  collectIds,
  normalizeGeneratedIds,
  normalizeSnapshotIds,
  snapshotDefinitions,
  snapshotXml,
  type ModelSnapshot,
  type SnapshotNode,
} from "./snapshot.js";

export {
  BOUNDS_TOLERANCE_PX,
  DIVERGENCE_RULES,
  WAYPOINT_TOLERANCE_PX,
  formatDivergences,
  lossySignatures,
  shadowCompare,
  summarize,
  type Divergence,
  type DivergenceKind,
  type DivergenceRule,
  type DivergenceVerdict,
  type ShadowResult,
  type ShadowRunOptions,
} from "./shadow.js";

export {
  DEFAULT_CHANNEL_THRESHOLD,
  DEFAULT_MAX_ERODED_PIXELS,
  compareBitmaps,
  decodePng,
  rasterToolsAvailable,
  rasterize,
  type Bitmap,
  type CompareOptions,
  type CompareResult,
  type RasterOptions,
} from "./raster.js";

export {
  canForceGc,
  checkBudget,
  formatMeasurements,
  measure,
  type BudgetEntry,
  type BudgetViolation,
  type Measurement,
} from "./budget.js";

export {
  ArctosDriver,
  arctosDriverStatus,
  createArctosDriver,
} from "./drivers/arctos.js";
export {
  BpmnJsDriver,
  isBpmnJsAvailable,
  loadBpmnJs,
} from "./drivers/bpmnjs.js";
