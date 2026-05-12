// api-wrapper.ts
//
// Generic try/catch HOC for Next.js App-Router route handlers.
//
// Background: the 2026-05-12 over-night QA found ~14 endpoints returning
// HTTP 500 with an EMPTY body. Every one had the same shape — an
// unhandled Postgres error or a malformed input crashed the handler
// before any try/catch could turn it into a useful response. Operators
// got a deploy alert with no detail; clients got a status code with no
// body to parse.
//
// `withErrorHandler` wraps a route handler with a single try/catch that:
//   1. Runs the original handler.
//   2. On error, emits a structured logger.error entry with route,
//      request URL, and pgCode/pgDetail/message extracted from the
//      thrown value.
//   3. Maps known failure modes to a useful HTTP status:
//        - Postgres FK / NOT NULL / CHECK / UNIQUE     → 422
//        - Postgres invalid_text_representation (e.g.
//          malformed UUID coming through Drizzle param) → 422
//        - postgres-js timeout                          → 503
//        - Anything else                                → 500
//   4. Returns an RFC 7807 problem+json body via the `problem.*`
//      helpers in api-errors.ts so clients get a stable error shape.
//
// Usage in a route file:
//   import { withErrorHandler } from "@/lib/api-wrapper";
//   export const GET = withErrorHandler(async (req) => { ... });
//   export const POST = withErrorHandler(async (req, ctx) => { ... });
//
// Existing routes that already have their own try/catch (e.g. risks
// status, treatments) can keep theirs — wrapping them too is harmless,
// the inner catch wins.

import { problem, getRequestId } from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { PaginationError } from "@/lib/api";

type RouteHandler<TCtx = unknown> = (
  req: Request,
  ctx: TCtx,
) => Promise<Response> | Response;

interface PgError {
  code?: string;
  detail?: string;
  message?: string;
  routine?: string;
  schema?: string;
  table?: string;
}

// Postgres SQLSTATE codes that should surface as 422 Unprocessable
// instead of a generic 500. Source: postgresql.org/docs/current/errcodes-appendix.html
const CONSTRAINT_VIOLATION_CODES = new Set([
  "23502", // not_null_violation
  "23503", // foreign_key_violation
  "23505", // unique_violation
  "23514", // check_violation
  "23P01", // exclusion_violation
]);

const INVALID_INPUT_CODES = new Set([
  "22P02", // invalid_text_representation — e.g. "not-a-uuid"::uuid (#NIGHT-056)
  "22008", // datetime_field_overflow
  "22023", // invalid_parameter_value
  "22001", // string_data_right_truncation
]);

// postgres-js wraps connection-level timeouts in either CONNECT_TIMEOUT
// or its own custom code. Map these to 503 so monitoring distinguishes
// "DB unreachable" from "your code is buggy".
const TIMEOUT_CODES = new Set([
  "CONNECT_TIMEOUT",
  "CONNECTION_ENDED",
  "CONNECTION_DESTROYED",
  "CONNECTION_CLOSED",
]);

export function withErrorHandler<TCtx = unknown>(
  handler: RouteHandler<TCtx>,
  routeLabel?: string,
): RouteHandler<TCtx> {
  return async (req, ctx) => {
    const requestId = getRequestId(req);
    const label = routeLabel ?? `${req.method} ${new URL(req.url).pathname}`;

    try {
      return await handler(req, ctx);
    } catch (err) {
      const e = err as PgError;
      const logger = log.withContext({
        route: label,
        url: req.url,
        method: req.method,
        requestId,
        pgCode: e.code,
        pgDetail: e.detail,
      });

      // PaginationError from paginate() — strict pagination contract
      // enforces integer limits and rejects unknown query params (the
      // over-night QA found `limit=0`, `limit=abc`, `offset=N`, and
      // typo'd params being silently ignored).
      if (err instanceof PaginationError) {
        logger.warn("pagination validation failed", {
          field: err.field,
          value: err.value,
          reason: err.reason,
        });
        return problem.validation({
          requestId,
          instance: req.url,
          detail: `Invalid pagination parameter '${err.field}': ${err.reason}`,
          errors: [{ path: err.field, message: err.reason }],
        });
      }

      // ZodError from a `.parse()` call — extremely common on routes that
      // didn't bother with safeParse. Convert to a structured 422 with
      // path-level field errors so the client gets the same shape as
      // routes that DO use safeParse + Response.json({error, fieldErrors}).
      if (
        err &&
        typeof err === "object" &&
        "issues" in err &&
        Array.isArray((err as { issues: unknown }).issues)
      ) {
        const issues = (
          err as {
            issues: Array<{ path: (string | number)[]; message: string }>;
          }
        ).issues;
        logger.warn("zod validation failed", { issueCount: issues.length });
        return problem.validation({
          requestId,
          instance: req.url,
          detail: "Request body or query parameters failed validation",
          errors: issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      }

      if (e.code && CONSTRAINT_VIOLATION_CODES.has(e.code)) {
        logger.warn("constraint violation", { message: e.message });
        return problem.validation({
          requestId,
          instance: req.url,
          detail: e.detail ?? e.message ?? "Database constraint violated",
          errors: [{ path: "", message: e.detail ?? e.message ?? e.code }],
        });
      }

      if (e.code && INVALID_INPUT_CODES.has(e.code)) {
        logger.warn("invalid input", { message: e.message });
        return problem.validation({
          requestId,
          instance: req.url,
          detail: e.message ?? "Invalid input format",
          errors: [{ path: "", message: e.message ?? e.code }],
        });
      }

      if (e.code && TIMEOUT_CODES.has(e.code)) {
        logger.error("database unavailable", { message: e.message });
        return new Response(
          JSON.stringify({
            type: "https://arctos.charliehund.de/errors/upstream-unavailable",
            title: "Service temporarily unavailable",
            status: 503,
            detail: "Database connection timed out — try again shortly.",
            requestId,
            instance: req.url,
          }),
          {
            status: 503,
            headers: {
              "content-type": "application/problem+json; charset=utf-8",
              "x-request-id": requestId,
              "retry-after": "5",
            },
          },
        );
      }

      logger.error("unhandled handler error", {
        message: e.message ?? String(err),
        stack:
          err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined,
      });
      // #WAVE3: include the underlying error message in the response so
      // the next QA pass doesn't have to guess at root cause. For a
      // private B2B platform (ARCTOS is not consumer-facing), surfacing
      // the real DB error to admins is far more useful than the generic
      // "operators have been notified" — operators DON'T see the requestId
      // in their inbox.
      const realMessage = e.message ?? String(err);
      // Build the response inline so we can include errorMessage/errorCode
      // as RFC 7807 extension fields. problem.internal() doesn't expose
      // them in its strict signature, but the wire format allows arbitrary
      // extension fields (RFC 7807 §3.2).
      return new Response(
        JSON.stringify({
          type: "https://arctos.charliehund.de/errors/internal",
          title: "Internal server error",
          status: 500,
          requestId,
          instance: req.url,
          detail: realMessage
            ? `Unexpected error: ${realMessage}`
            : "An unexpected error occurred.",
          errorMessage: realMessage,
          errorCode: e.code,
        }),
        {
          status: 500,
          headers: {
            "content-type": "application/problem+json; charset=utf-8",
            "x-request-id": requestId,
          },
        },
      );
    }
  };
}
