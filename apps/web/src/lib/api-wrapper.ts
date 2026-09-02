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

import {
  problem,
  getRequestId,
  // [WP12 · S14-16] legacy `{ error: … }` → RFC 7807 on the way out
  normaliseErrorResponse,
} from "@/lib/api-errors";
import { log } from "@/lib/logger";
import { PaginationError } from "@/lib/api";

// Two-argument shape matches Next.js's invocation: (req, { params })
// for dynamic routes, (req, undefined) for flat routes. Dynamic-route
// handlers destructure params so the second arg must be present.
type RouteHandler<TCtx = unknown> = (
  req: Request,
  ctx: TCtx,
) => Promise<Response> | Response;

/**
 * The shape of what `withErrorHandler` HANDS BACK.
 *
 * [E2E-TRIAGE-2026-09-02] Deliberately different from `RouteHandler` in one
 * respect: `ctx` is optional at the CALL site. Next always passes it — the
 * comment above says as much, `(req, undefined)` for a flat route — but the
 * ~90 unit tests under `src/__tests__/api/` invoke flat handlers directly as
 * `GET(req)`, which is exactly how Next invokes them minus an argument
 * TypeScript can see. Requiring it here would have turned every one of those
 * call sites into a TS2554 the moment a route adopted the wrapper, which is a
 * tax on the fix and not a property worth enforcing.
 *
 * The handler side keeps `ctx: TCtx` REQUIRED, so a dynamic route that
 * destructures `{ params }` is still type-checked against what it declares.
 */
type WrappedRouteHandler<TCtx = unknown> = (
  req: Request,
  ctx?: TCtx,
) => Promise<Response>;

/**
 * The mutable store `requestDbStorage.run(...)` is seeded with. Structurally
 * identical to `RequestDbStore` in `packages/db/src/request-context.ts`; typed
 * loosely here for the same reason the module is imported dynamically — the
 * ~90 unit tests that `vi.mock("@grc/db")` must not have to provide the type.
 */
interface RequestStore {
  db: unknown;
  reserved: unknown;
  orgId: string;
  userId: string;
  released: boolean;
}

/**
 * [E2E-TRIAGE-2026-09-02 · C-07, main path] Give the reserved, org-pinned
 * connection back when the RESPONSE is finished — not when the handler returns.
 *
 * What was wrong: `establishRequestScopedContext` (apps/web/src/lib/api.ts)
 * reserves one connection per authenticated request out of `requestClient`
 * (`max: 25`) and hands the release to Next's `after()` hook, which does not
 * run when the client disconnects mid-flight. The first triage measured 22 of
 * 25 connections stuck on the `set_config(…)` statement eight hours after an
 * E2E run; measured again on this instance before this change: 25 of 25 idle
 * and holding, and every authenticated request hanging on `reserve()` forever.
 * A production instance stops serving logged-in users after ~25 aborted
 * requests and does not recover without a restart.
 *
 * Why not a plain `finally` around the handler: a route that returns a stream
 * it has not produced yet — the ZIP of `/audit-log/archive`, the report PDFs,
 * the CSV exports — reads the database WHILE the body is being consumed. A
 * `finally` would pull its connection out from under it.
 *
 * So the release is attached to the RESPONSE instead, on three triggers:
 *   * no body (204, or a `Response` with a null body) → release at once;
 *   * a body → wrap it in a stream that releases when the source ends, errors,
 *     or is cancelled. `pull`-driven, so backpressure is unchanged;
 *   * the request's abort signal. This is the one that matters in practice and
 *     the one a body hook alone does NOT cover: when the client disconnects
 *     before the response is written, the runtime may simply drop the body
 *     object without ever reading or cancelling it, so neither `pull` nor
 *     `cancel` ever fires — and `after()` does not run either. Measured on this
 *     instance during the E2E run: 25 of 28 `grc_app` connections idle for six
 *     minutes on the widget queries of pages Playwright had already navigated
 *     away from, i.e. exactly the aborted-request case.
 *
 * The abort handler CANCELS THE READER FIRST and only releases afterwards.
 * A streaming route (`/audit-log/archive`, the report PDFs) is still producing
 * rows from that connection while the body is consumed; cancelling propagates
 * to its source and stops it, so the connection is never handed back to the
 * pool while a generator could still issue a query on it. Releasing straight
 * from the abort handler would risk exactly that.
 *
 * The listener is attached only AFTER the handler has returned, so an abort
 * mid-handler can never pull the connection out from under the handler itself.
 *
 * `releaseRequestContext` is idempotent, so the `after()` hook staying in place
 * as a further safety net costs nothing. Routes with no reserved connection
 * (unit tests, unauthenticated paths) are returned untouched.
 */
function releaseReservedWhenSettled(
  store: RequestStore,
  req: Request,
  res: Response,
  release?: (s: RequestStore) => Promise<void>,
): Response {
  if (!release || !store.reserved || store.released) return res;

  let done = false;
  const releaseOnce = () => {
    if (done) return;
    done = true;
    void release(store).catch(() => {
      // Nothing useful to do here: the request is already answered, and the
      // connection is scrubbed-or-lost either way. Never let this reject into
      // an unhandled rejection.
    });
  };

  /** Attach `releaseOnce` to the client-disconnect signal, if there is one. */
  const onAbort = (cancelSource?: (reason: unknown) => Promise<void>) => {
    const signal = req.signal as AbortSignal | undefined;
    if (!signal) return;
    const handler = () => {
      if (!cancelSource) {
        releaseOnce();
        return;
      }
      void cancelSource(new Error("client disconnected"))
        .catch(() => {})
        .then(releaseOnce);
    };
    if (signal.aborted) {
      handler();
      return;
    }
    try {
      signal.addEventListener("abort", handler, { once: true });
    } catch {
      // Not an EventTarget in this runtime — the body hooks still apply.
    }
  };

  if (!res.body) {
    releaseOnce();
    return res;
  }

  const reader = res.body.getReader();
  onAbort((reason) => reader.cancel(reason));

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done: finished, value } = await reader.read();
        if (finished) {
          controller.close();
          releaseOnce();
          return;
        }
        controller.enqueue(value);
      } catch (err) {
        releaseOnce();
        controller.error(err);
      }
    },
    cancel(reason) {
      releaseOnce();
      return reader.cancel(reason);
    },
  });

  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

/**
 * True for anything that carries an HTTP status. Deliberately structural
 * rather than `instanceof Response`: `NextResponse`, the undici `Response` of
 * the Node runtime and the `Response` a test constructs in jsdom are three
 * different constructors, and an `instanceof` check that silently fails for
 * one of them would send that whole realm down the error path.
 */
function isResponseLike(value: unknown): value is Response {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Response).status === "number"
  );
}

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
): WrappedRouteHandler<TCtx> {
  return async (req, ctx) => {
    // #SEC-F01b-RUN — Establish the request-scoped RLS context frame HERE, once,
    // around every wrapped handler. We seed the AsyncLocalStorage with a MUTABLE
    // initial store (`db: baseDb`, no reserved connection) via
    // `requestDbStorage.run(...)`. Later, withAuth → establishRequestScopedContext
    // reserves an org/user-pinned connection and MUTATES this same store object
    // (`store.db = reservedDb`), instead of calling `enterWith`.
    //
    // Why: under the Next App Router runtime, `enterWith()` called inside an
    // awaited helper (withAuth) is silently dropped when control returns to the
    // route body across the `await` boundary — so the handler's `db` queries ran
    // context-less and RLS filtered every row (200 with `{data:[],total:0}`).
    // `run()` establishes the ALS frame for the ENTIRE async execution of the
    // handler, and a mutation of the store object is observed by the `db` proxy
    // on every property access — which is reliable. (Empirically verified: a
    // nested `enterWith` under an enclosing `run()` does NOT propagate, but a
    // mutation of the run()-bound store object does.)
    // @grc/db is imported DYNAMICALLY (not a top-level named import) so the many
    // unit tests that `vi.mock("@grc/db", …)` with just a `db` stub don't trip
    // Vitest's strict "no <export> defined on the mock" guard on
    // requestDbStorage/baseDb. When the module is mocked (no requestDbStorage /
    // baseDb) we skip the ALS frame and run the handler directly — exactly the
    // pre-existing behaviour those tests expect (establishRequestScopedContext
    // no-ops the same way). In the real runtime both are defined and the
    // run()+mutate frame is established. Same dynamic-import rationale as api.ts.
    let requestDbStorage:
      { run: <T>(store: unknown, cb: () => T) => T } | undefined;
    let baseDb: unknown;
    let releaseRequestContext:
      ((store: RequestStore) => Promise<void>) | undefined;
    try {
      const dbmod = (await import("@grc/db")) as {
        requestDbStorage?: { run: <T>(store: unknown, cb: () => T) => T };
        baseDb?: unknown;
        releaseRequestContext?: (store: RequestStore) => Promise<void>;
      };
      requestDbStorage = dbmod.requestDbStorage;
      baseDb = dbmod.baseDb;
      releaseRequestContext = dbmod.releaseRequestContext;
    } catch {
      // @grc/db is mocked without requestDbStorage/baseDb (Vitest's strict mock
      // guard throws on the missing named export) — run without the ALS frame,
      // exactly like the pre-existing behaviour. Same try/catch rationale as
      // establishRequestScopedContext in api.ts.
    }
    if (
      !requestDbStorage ||
      typeof requestDbStorage.run !== "function" ||
      !baseDb
    ) {
      return runHandler(req, ctx);
    }
    const initialStore: RequestStore = {
      db: baseDb,
      reserved: null,
      orgId: "",
      userId: "",
      released: true,
    };
    const res = await requestDbStorage.run(initialStore, () =>
      runHandler(req, ctx),
    );
    return releaseReservedWhenSettled(
      initialStore,
      req,
      res,
      releaseRequestContext,
    );
  };

  async function runHandler(req: Request, ctx?: TCtx): Promise<Response> {
    const requestId = getRequestId(req);
    const label = routeLabel ?? `${req.method} ${new URL(req.url).pathname}`;

    try {
      // [ARCTOS-FULL-2026-08-31 / WP12 · S14-16] Normalise the RETURNED
      // error responses too, not just the throw path below.
      //
      // ADR-021 mandates RFC 7807 for "alle API-Errors" and `docs/STATUS.md`
      // reported it as done; the measurement was 9 of 1.355 routes. The
      // wrapper produced correct problem+json — but only for uncaught
      // exceptions, so the regular 401/403/404/409/422 answers of the 143
      // wrapped routes stayed `{ error: "…" }` in `application/json`.
      //
      // `normaliseErrorResponse` rewrites those on the way out and keeps every
      // original field as an RFC 7807 extension member, so no route body has
      // to change and no client that reads `json.error` breaks.
      const res = await handler(req, ctx as TCtx);

      // Two guards, both learned the hard way (WP11 measured 41 red tests
      // after the first version of this call):
      //
      //  1. The success path never enters the normaliser at all. Deciding
      //     "is this an error?" belongs HERE, before the response is handed
      //     to a formatter — `normaliseErrorResponse` also returns early on
      //     `status < 400`, but that made a 201 depend on the correctness of
      //     an error-formatting helper, and that dependency is the defect,
      //     not the early return.
      //  2. If normalisation fails for any reason, the ORIGINAL response is
      //     returned. Changing the content type of an error body is
      //     cosmetic; turning a route's deliberate 422 into a 500 because the
      //     cosmetics threw is a functional regression. The failure is logged
      //     so it cannot hide.
      if (!isResponseLike(res) || res.status < 400) return res;
      try {
        return await normaliseErrorResponse(res, {
          instance: new URL(req.url).pathname,
          requestId,
        });
      } catch (normaliseErr) {
        log.warn("problem+json normalisation failed; passing through", {
          route: label,
          requestId,
          status: res.status,
          error: (normaliseErr as Error)?.message,
        });
        return res;
      }
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

      // #WAVE23-A1: structured 500 für Finding-FK-Mismatch. Erkannt
      // an `name === "FindingFkMismatchError"` damit der wrapper nicht
      // das route-modul direkt importieren muss (würde einen
      // App-Router → lib Zirkel-Import erzeugen). Body enthält die
      // `mismatches` als Diagnostic — Cowork-QA kann ohne Server-Log
      // sehen, welcher FK gedroppt wurde.
      if (
        err &&
        typeof err === "object" &&
        (err as { name?: string }).name === "FindingFkMismatchError"
      ) {
        const mismatches = (err as { mismatches?: unknown[] }).mismatches ?? [];
        logger.error("finding FK persistence mismatch", {
          mismatches,
          message: e.message,
        });
        return new Response(
          JSON.stringify({
            type: "https://arctos.charliehund.de/errors/fk-persistence-mismatch",
            title: "Finding FK persistence mismatch",
            status: 500,
            detail:
              "POST /findings returned a row whose FK columns differ from the input — schema-drift or trigger-induced data loss. The transaction was rolled back; no broken finding was created.",
            mismatches,
            requestId,
            instance: req.url,
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

      // #WAVE11: full message + stack are logged for operators (with
      // requestId as the correlation key) but NEVER returned in the
      // response body. CodeQL js/stack-trace-exposure flagged the
      // earlier Wave-3 version that surfaced e.message + errorCode to
      // the client. Even on a private B2B platform, error messages can
      // leak schema names, table names, query fragments, and library
      // versions — all of which are unnecessary risk. The requestId in
      // the response is enough for an operator to grep the logs and
      // recover the full picture.
      logger.error("unhandled handler error", {
        message: e.message ?? String(err),
        pgCode: e.code,
        stack:
          err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined,
      });
      return new Response(
        JSON.stringify({
          type: "https://arctos.charliehund.de/errors/internal",
          title: "Internal server error",
          status: 500,
          detail:
            "An unexpected error occurred. The full error has been logged " +
            "server-side; include the requestId when reporting.",
          requestId,
          instance: req.url,
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
  }
}
