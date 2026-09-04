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
import { problem, getRequestId } from "@/lib/api-errors";

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

// ─────────────────────────────────────────────────────────────────────────
// [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-116 / S04-09]
// ─────────────────────────────────────────────────────────────────────────
//
// Der Kopf dieser Datei nennt als Defekt „ein Filterwert wird als
// `string | null` gelesen, mit `as SomeEnum` gecastet und an den Query-Builder
// gereicht". Der Enum-Teil davon ist seit Welle 4b-3 abgetragen
// (`isEnumValue` gegen `column.enumValues`, fünf Routen). Der UUID-Teil war es
// nicht: nachgemessen am 2026-09-04 über alle 1.372 Routendateien flossen
// zwölf Abfrageparameter in acht Dateien ungeprüft in einen Vergleich gegen
// eine `uuid`-Spalte.
//
//     select 1 from eam_keyword where id = 'nicht-uuid';
//     ERROR:  invalid input syntax for type uuid: "nicht-uuid"
//
// Seit dieser Welle macht `withErrorHandler` daraus kein 500 mehr, sondern ein
// 422 — aber ohne zu sagen, WELCHER Parameter gemeint war, weil Postgres das
// nicht weiss. Diese Prüfung sagt es, bevor die Abfrage überhaupt losgeht.
//
// Absichtlich eine Regex und kein `z.string().uuid()`: die Aufrufstellen sind
// Einzeilerprüfungen mitten im Handler, kein Schemaobjekt, und ein zweites
// zod-Objekt pro Parameter wäre hier nur Zeremonie.

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True, wenn der Wert als `uuid` an Postgres gehen darf. */
export function isUuidParam(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * 422 in RFC-7807-Form für einen Abfrageparameter, der eine UUID sein müsste.
 * Der Name des Parameters steht in `errors[0].path` — genau die Angabe, die
 * ein aus dem Treiber hochgereichter 22P02 nicht liefern kann.
 */
export function invalidUuidParam(req: Request, name: string): Response {
  return problem.validation({
    requestId: getRequestId(req),
    instance: req.url,
    detail: `The '${name}' parameter must be a UUID.`,
    errors: [{ path: name, message: "expected a valid uuid" }],
  });
}

// ─── Datumsparameter ─────────────────────────────────────────────────
//
// [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-116 / S04-09]
//
// Der zweite ungeprüfte Fluss, den die Nachmessung vom 2026-09-04 gefunden
// hat, und der einzige, den `withErrorHandler` NICHT auffängt: ein roher
// Abfrageparameter in `new Date(…)`, das Ergebnis als Vergleichsgrenze.
// `new Date("garbage")` wirft nicht, es ergibt `Invalid Date`; erst der
// Treiber stolpert darüber, und zwar mit einem `RangeError`, nicht mit einem
// SQLSTATE. Gemessen am 2026-09-04 über den `postgres`-Treiber des
// Repositories:
//
//     sql`… where created_at >= ${new Date("garbage")}`
//     → RangeError: Invalid time value   (kein `code`)
//
// Ohne SQLSTATE greift im Wickel weder die 22er- noch die 23er-Zuordnung: der
// Aufruf endet als **500**. Ein Tippfehler in einem Datumsfilter macht damit
// aus einer Liste einen Serverfehler.
//
// Zwei Routen im selben Repository machen es richtig und beweisen, dass die
// Prüfung bekannt ist: `calendar` und `compliance/calendar` verwerfen ein
// `Number.isNaN(d.getTime())` mit 422. Diese Helfer sind dieselbe Prüfung,
// einmal benannt.

/** Wandelt einen Abfrageparameter in ein `Date` — oder in `null`. */
export function toDateParam(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 422 in RFC-7807-Form für einen Datumsparameter, der nicht lesbar ist. */
export function invalidDateParam(req: Request, name: string): Response {
  return problem.validation({
    requestId: getRequestId(req),
    instance: req.url,
    detail: `The '${name}' parameter must be an ISO 8601 date or date-time.`,
    errors: [{ path: name, message: "expected an ISO 8601 date" }],
  });
}
