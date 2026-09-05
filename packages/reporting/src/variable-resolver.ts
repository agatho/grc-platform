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
  if (namespace === undefined || !ALLOWED_NAMESPACES.has(namespace)) {
    return undefined;
  }

  // [OP-065] Der Kopfkommentar dieser Funktion sagt „Safely resolve nested
  // property". Der Zugriff `(current as Record<string, unknown>)[part]` fragte
  // aber nicht nach EIGENEN Eigenschaften, sondern lief in die
  // Prototypenkette. Gemessen am 2026-09-03 gegen 01d0e4cc mit
  // `{ org: { name: "ACME" } }`:
  //
  //   {{org.name}}         → "ACME"
  //   {{org.unbekannt}}    → ""
  //   {{org.constructor}}  → "function Object() { [native code] }"
  //   {{org.__proto__}}    → "[object Object]"
  //
  // Der Text einer Berichtsvorlage ist damit ein Weg, Fremdes in einen
  // erzeugten Bericht zu schreiben. `VARIABLE_PATTERN` lässt nur zwei
  // Abschnitte zu, die Tiefe war also begrenzt — die Klasse ist es nicht.
  // `Object.hasOwn` fragt genau das, was gemeint war.
  //
  // Wichtig ist dabei der UNTERSCHIED der beiden Ausgänge, den diese Funktion
  // seit jeher macht und der von `tests/variable-resolver.test.ts` festgehalten
  // wird: `undefined` heisst „Pfad nicht auflösbar" und lässt `{{…}}` als
  // Platzhalter stehen (Sichtbarkeit beim Entwerfen der Vorlage), während ein
  // aufgelöster, aber leerer Wert "" ergibt. Eine fehlende EIGENE Eigenschaft
  // gehört in den zweiten Topf — vorher tat sie das über `undefined`, jetzt
  // über denselben Weg. Ein früher Ausstieg an dieser Stelle hätte den
  // Vertrag geändert.
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = Object.hasOwn(current, part)
      ? (current as Record<string, unknown>)[part]
      : undefined;
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
    // Die Fanggruppe des Musters ist bei einem Treffer vorhanden; `?? ""`
    // schreibt das auf, statt es mit `!` zu behaupten.
    matches.push(match[1] ?? "");
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
