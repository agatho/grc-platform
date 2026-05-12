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

import { z } from "zod";

const UUID_SCHEMA = z.string().uuid({
  message: "must be a valid UUID (8-4-4-4-12 hex digits)",
});

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
  return result.data;
}
