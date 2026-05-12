// #WAVE4-02: validate path params BEFORE they hit the database.
//
// Drizzle .where(eq(table.id, "not-a-uuid")) passes the string straight
// to postgres-js, which produces SQLSTATE 22P02 (invalid_text_representation).
// In theory api-wrapper.ts maps 22P02 to 422 — but in practice the
// error object from postgres-js inside a Drizzle subquery sometimes
// doesn't carry the SQLSTATE in a way the wrapper recognises, and the
// caller sees a generic 500.
//
// Catching the bad UUID up front turns this into a deterministic
// ZodError → 422 problem+json with a clear field-level message.
//
// #WAVE7-NEW-01: zod's `.uuid()` enforces RFC-4122 version+variant
// bits (digits 13 and 17). The seed data uses sequential-ish UUIDs
// like `00000000-0000-0000-0000-000000000001` to keep cross-fixture
// references readable, and several long-lived test orgs were also
// minted before strict validation existed. PostgreSQL itself accepts
// ANY 8-4-4-4-12 hex shape regardless of version, so the database is
// happy — only this front-door check rejected them, surfacing as
// confusing 422s on cross-traversal endpoints (`/risks/<seed>/...`).
// Relaxing to the plain hex shape matches the database contract.

import { z } from "zod";

// Plain RFC-4122 *shape* — 8-4-4-4-12 hex digits — without the
// version/variant constraints. This matches what PostgreSQL's `uuid`
// type actually accepts.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UUID_SCHEMA = z
  .string()
  .regex(UUID_REGEX, "must be a valid UUID (8-4-4-4-12 hex digits)");

/**
 * Parse a UUID path parameter. Throws ZodError (caught by withErrorHandler
 * and surfaced as 422 problem+json) when the input is malformed.
 *
 * Use this at the top of any dynamic route that takes an id from the URL.
 */
export function requireUuidParam(value: string, paramName = "id"): string {
  const result = UUID_SCHEMA.safeParse(value);
  if (!result.success) {
    // Rebuild the ZodError with the param name on each issue's path so
    // the 422 response says e.g. "id: must be a valid UUID" instead of
    // the bare message. Issue.path is readonly so we reconstruct.
    throw new z.ZodError(
      result.error.issues.map((i) => ({ ...i, path: [paramName] })),
    );
  }
  // Lower-case the result so downstream comparisons are case-insensitive.
  // Postgres stores UUIDs in canonical lowercase regardless of input case.
  return result.data.toLowerCase();
}
