// Sprint 28: Condition Evaluator — PURE function, no side effects
// Parses nested AND/OR condition groups, evaluates field comparisons

import type {
  ConditionGroup,
  ConditionRule,
  ConditionComparisonOp,
} from "@grc/shared";

/**
 * Get a nested value from an object using dot notation.
 * e.g. getNestedValue({ a: { b: 3 } }, "a.b") → 3
 */
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string,
): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Calculate the number of days since a given date string.
 * Returns positive if the date is in the past, negative if in the future.
 */
function daysSince(dateStr: string | Date): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Compare a field value against a condition value using the given operator.
 */
function compareValues(
  fieldValue: unknown,
  op: ConditionComparisonOp,
  conditionValue: string | number | boolean,
): boolean {
  // Handle null/undefined
  if (fieldValue === null || fieldValue === undefined) {
    return false;
  }

  switch (op) {
    case ">":
      return Number(fieldValue) > Number(conditionValue);
    case "<":
      return Number(fieldValue) < Number(conditionValue);
    case ">=":
      return Number(fieldValue) >= Number(conditionValue);
    case "<=":
      return Number(fieldValue) <= Number(conditionValue);
    case "=":
      return String(fieldValue) === String(conditionValue);
    case "!=":
      return String(fieldValue) !== String(conditionValue);
    case "contains":
      return String(fieldValue)
        .toLowerCase()
        .includes(String(conditionValue).toLowerCase());
    case "not_contains":
      return !String(fieldValue)
        .toLowerCase()
        .includes(String(conditionValue).toLowerCase());
    case "days_since": {
      const days = daysSince(String(fieldValue));
      return days > Number(conditionValue);
    }
    default:
      return false;
  }
}

/**
 * Check if a value is a ConditionGroup (has operator and rules).
 */
function isConditionGroup(
  rule: ConditionRule | ConditionGroup,
): rule is ConditionGroup {
  return "operator" in rule && "rules" in rule;
}

/**
 * Evaluate a single condition rule against an entity.
 */
function evaluateRule(
  rule: ConditionRule,
  entity: Record<string, unknown>,
): boolean {
  const fieldValue = getNestedValue(entity, rule.field);
  return compareValues(fieldValue, rule.op, rule.value);
}

/**
 * Evaluate a condition group (AND/OR with nested groups) against an entity.
 * This is the main entry point for condition evaluation.
 *
 * PURE function — no side effects.
 */
export function evaluateConditions(
  conditions: ConditionGroup,
  entity: Record<string, unknown>,
): boolean {
  const { operator, rules } = conditions;

  if (!rules || rules.length === 0) {
    return true; // Empty rule set matches everything
  }

  const results = rules.map((rule) => {
    if (isConditionGroup(rule)) {
      return evaluateConditions(rule, entity);
    }
    return evaluateRule(rule, entity);
  });

  if (operator === "AND") {
    return results.every(Boolean);
  }
  return results.some(Boolean);
}

/**
 * Evaluate conditions and return detailed trace for dry-run / debugging.
 * Returns the evaluation result for each condition.
 */
export interface ConditionTraceEntry {
  field?: string;
  op?: string;
  value?: unknown;
  actualValue?: unknown;
  matched: boolean;
  operator?: string;
  children?: ConditionTraceEntry[];
}

export function evaluateConditionsWithTrace(
  conditions: ConditionGroup,
  entity: Record<string, unknown>,
): ConditionTraceEntry {
  const { operator, rules } = conditions;

  const children: ConditionTraceEntry[] = rules.map((rule) => {
    if (isConditionGroup(rule)) {
      return evaluateConditionsWithTrace(rule, entity);
    }
    const fieldValue = getNestedValue(entity, rule.field);
    const matched = compareValues(fieldValue, rule.op, rule.value);
    return {
      field: rule.field,
      op: rule.op,
      value: rule.value,
      actualValue: fieldValue,
      matched,
    };
  });

  const matched =
    operator === "AND"
      ? children.every((c) => c.matched)
      : children.some((c) => c.matched);

  return {
    operator,
    matched,
    children,
  };
}
