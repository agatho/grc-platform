// Sprint 30: Safe variable resolver for report templates
// Whitelist-based — no eval(), no template injection

const VARIABLE_PATTERN = /\{\{([a-zA-Z0-9_.]+)\}\}/g;

/** Allowed top-level variable namespaces */
const ALLOWED_NAMESPACES = new Set([
  "org",
  "report",
  "period",
  "author",
  "erm",
  "ics",
  "isms",
  "dpms",
  "esg",
  "bcms",
  "audit",
  "tprm",
]);

export interface VariableContext {
  org?: {
    name?: string;
    code?: string;
    [key: string]: unknown;
  };
  report?: {
    date?: string;
    title?: string;
    [key: string]: unknown;
  };
  period?: {
    start?: string;
    end?: string;
    label?: string;
    [key: string]: unknown;
  };
  author?: {
    name?: string;
    email?: string;
    [key: string]: unknown;
  };
  [namespace: string]: Record<string, unknown> | undefined;
}

/**
 * Safely resolve nested property from dot-notated path.
 * Returns undefined if path is invalid or namespace not allowed.
 */
function getNestedValue(
  obj: VariableContext,
  path: string,
): string | undefined {
  const parts = path.split(".");
  if (parts.length < 2) return undefined;

  const namespace = parts[0];
  if (!ALLOWED_NAMESPACES.has(namespace)) return undefined;

  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  if (current == null) return "";
  return String(current);
}

/**
 * Resolve all {{variable}} placeholders in a text string.
 * Unknown variables are left as-is (for debugging visibility).
 */
export function resolveVariables(
  text: string,
  context: VariableContext,
): string {
  return text.replace(VARIABLE_PATTERN, (match, path: string) => {
    const value = getNestedValue(context, path);
    return value !== undefined ? value : match;
  });
}

/**
 * Extract all variable references from a template string.
 */
export function extractVariables(text: string): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(VARIABLE_PATTERN);
  while ((match = pattern.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return [...new Set(matches)];
}

/**
 * Validate that all referenced variables exist in the context.
 */
export function validateVariables(
  text: string,
  context: VariableContext,
): { valid: boolean; missing: string[] } {
  const variables = extractVariables(text);
  const missing = variables.filter(
    (v) => getNestedValue(context, v) === undefined,
  );
  return { valid: missing.length === 0, missing };
}
