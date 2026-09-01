// #S04-09 (ARCTOS-FULL-2026-08-31, Low/Info) — 276 handlers read query
// parameters without a dedicated schema.
//
// The audit correctly found no SQL injection there: every path uses Drizzle's
// parameterized `eq()` and `paginate()` hard-clamps limit/offset. The defect
// is validation consistency: a filter value is read as `string | null`, cast
// with `as SomeEnum`, and handed to the query builder. A value the enum does
// not contain reaches Postgres and comes back as `invalid input value for
// enum …` — a 500 where a 422 belongs, with the DB error text on the operator
// path and no useful message for the caller. Free-text `search` parameters
// were likewise unbounded in length.
//
// This module supplies the shared primitives so per-route query schemas are
// a three-line addition rather than a bespoke block each time.
//
// It lives in apps/web rather than @grc/shared on purpose: @grc/shared pins
// zod 3.x while apps/web resolves zod 4.x, and a v3 schema object embedded
// in a v4 `z.object()` breaks at runtime.

import { z } from "zod";

export interface QueryParseSuccess<T> {
  ok: true;
  data: T;
}

export interface QueryParseFailure {
  ok: false;
  message: string;
  details: unknown;
}

export type QueryParseResult<T> = QueryParseSuccess<T> | QueryParseFailure;

/**
 * Validate `URLSearchParams` against a Zod object schema.
 *
 * Repeated keys collapse to the last value, matching `searchParams.get()`.
 * Empty strings are dropped so `?status=` behaves like "not supplied"
 * rather than failing an enum — that is what the previous
 * `searchParams.get(...)` + truthiness check did.
 */
export function parseQueryParams<T extends z.ZodTypeAny>(
  schema: T,
  params: URLSearchParams,
): QueryParseResult<z.infer<T>> {
  const raw: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (value === "") continue;
    raw[key] = value;
  }

  const result = schema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return {
    ok: false,
    message: "Invalid query parameters",
    details: result.error.flatten(),
  };
}

/** Bounded free-text search term. */
export const searchQueryParam = z.string().trim().min(1).max(200).optional();

/** UUID filter. */
export const uuidQueryParam = z.string().uuid().optional();

/** ISO date (YYYY-MM-DD) filter. */
export const dateQueryParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .optional();

/** ISO date-time filter. */
export const dateTimeQueryParam = z.string().datetime().optional();

/** `?flag=true` / `?flag=1` style boolean. */
export const booleanQueryParam = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1")
  .optional();

/**
 * Integer query parameter with hard bounds — the clamp is the point, so an
 * out-of-range value is refused rather than silently coerced.
 */
export function intQueryParam(
  min: number,
  max: number,
): z.ZodOptional<z.ZodNumber>;
export function intQueryParam(
  min: number,
  max: number,
  fallback: number,
): z.ZodDefault<z.ZodNumber>;
export function intQueryParam(min: number, max: number, fallback?: number) {
  const base = z.coerce.number().int().min(min).max(max);
  // `.default()` (not `.optional().default()`) so the output type is a plain
  // number when a fallback is given — callers should not have to re-check for
  // undefined on a parameter that always has a value.
  return fallback === undefined ? base.optional() : base.default(fallback);
}

/**
 * Comma-separated list of short codes, e.g. `?frameworks=iso27001,nis2`.
 */
export function csvListQueryParam(
  maxItems: number,
  itemPattern = /^[\w.-]{1,64}$/,
) {
  return z
    .string()
    .max(1024)
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .refine((list) => list.length <= maxItems, {
      message: `At most ${maxItems} values are allowed`,
    })
    .refine((list) => list.every((s) => itemPattern.test(s)), {
      message: "List contains an invalid value",
    })
    .optional();
}
