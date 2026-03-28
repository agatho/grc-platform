// Sprint 28: Template variable interpolation
// Resolves {entity.field} placeholders in action config strings

/**
 * Interpolate template variables in a string.
 * Supports {entity.field} pattern with nested dot notation.
 *
 * Example: "Risk {entity.title} has score {entity.residual_score}"
 * → "Risk Ransomware has score 18"
 */
export function interpolate(
  template: string,
  entity: Record<string, unknown>,
): string {
  return template.replace(/\{entity\.([a-zA-Z0-9_.]+)\}/g, (_match, path) => {
    const value = getNestedValueForInterpolation(entity, path as string);
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

/**
 * Interpolate all string values in a config object.
 */
export function interpolateConfig<T extends Record<string, unknown>>(
  config: T,
  entity: Record<string, unknown>,
): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string") {
      result[key] = interpolate(value, entity);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

function getNestedValueForInterpolation(
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
