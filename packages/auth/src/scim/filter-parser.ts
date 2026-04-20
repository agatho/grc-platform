// Sprint 20: SCIM Filter Parser
// Supports basic SCIM filter syntax: eq, co, sw operators
// Ref: RFC 7644 Section 3.4.2.2

export interface ScimFilter {
  attribute: string;
  operator: "eq" | "co" | "sw";
  value: string;
}

/**
 * Parse a simple SCIM filter expression.
 * Supports: attribute eq "value", attribute co "value", attribute sw "value"
 *
 * @param filterStr - Raw SCIM filter string (e.g., 'userName eq "user@example.com"')
 * @returns Parsed filter object or null if unparseable
 */
export function parseScimFilter(filterStr: string): ScimFilter | null {
  if (!filterStr?.trim()) return null;

  // Match: attribute operator "value" or attribute operator 'value'
  const match = filterStr
    .trim()
    .match(/^(\w+(?:\.\w+)?)\s+(eq|co|sw)\s+["']([^"']*)["']$/i);

  if (!match) return null;

  const [, attribute, operator, value] = match;

  const validOps = ["eq", "co", "sw"];
  const op = operator.toLowerCase();
  if (!validOps.includes(op)) return null;

  return {
    attribute: attribute,
    operator: op as "eq" | "co" | "sw",
    value: value,
  };
}

/**
 * Map SCIM attribute names to database column names.
 */
export function mapScimAttributeToColumn(scimAttr: string): string | null {
  const mapping: Record<string, string> = {
    userName: "email",
    "name.givenName": "name",
    "name.familyName": "name",
    externalId: "external_id",
    active: "is_active",
    "emails.value": "email",
  };
  return mapping[scimAttr] ?? null;
}

/**
 * Build a SQL WHERE clause fragment from a SCIM filter.
 * Returns [clauseString, value] for parameterized queries.
 */
export function buildFilterClause(
  filter: ScimFilter,
): { clause: string; value: string } | null {
  const column = mapScimAttributeToColumn(filter.attribute);
  if (!column) return null;

  switch (filter.operator) {
    case "eq":
      return { clause: `"${column}" = $1`, value: filter.value };
    case "co":
      return { clause: `"${column}" ILIKE $1`, value: `%${filter.value}%` };
    case "sw":
      return { clause: `"${column}" ILIKE $1`, value: `${filter.value}%` };
    default:
      return null;
  }
}
