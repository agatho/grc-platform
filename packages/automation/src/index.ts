// Sprint 28: Automation package barrel export
export { AutomationEngine, type AutomationEngineOptions } from "./rule-engine";
export {
  evaluateConditions,
  evaluateConditionsWithTrace,
  getNestedValue,
  type ConditionTraceEntry,
} from "./condition-evaluator";
export {
  executeActions,
  determineExecutionStatus,
  type ActionServices,
  type ActionContext,
} from "./action-executor";
export { interpolate, interpolateConfig } from "./template-interpolator";
export {
  ENTITY_FIELD_MAP,
  getEntityFields,
  getAvailableEntityTypes,
} from "./entity-fields";
