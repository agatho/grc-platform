// api-errors.ts
//
// RFC 7807 Problem-Details fuer API-Error-Responses (siehe ADR-021).
//
// Drop-in-Alternative zu `Response.json({ error: "..." }, { status: ... })`.
// Nicht verpflichtend -- bestehende Routen bleiben unveraendert, bis sie
// migriert werden. Neue Routen sollten diesen Helper nutzen.
//
// Beispiel:
//   import { problemResponse, ErrorTypes } from "@/lib/api-errors";
//   return problemResponse({
//     type: ErrorTypes.VALIDATION,
//     title: "Validation failed",
//     status: 422,
//     instance: req.url,
//     requestId: req.headers.get("x-request-id") ?? "",
//     errors: parsed.error.issues.map((i) => ({
//       path: i.path.join("."), message: i.message,
//     })),
//   });
//
// Content-Type ist application/problem+json (RFC 7807) -- Clients sollen
// das explizit behandeln, nicht generisches application/json.

const ERROR_BASE = "https://arctos.charliehund.de/errors";

export const ErrorTypes = {
  VALIDATION: `${ERROR_BASE}/validation`,
  UNAUTHORIZED: `${ERROR_BASE}/unauthorized`,
  FORBIDDEN: `${ERROR_BASE}/forbidden`,
  NOT_FOUND: `${ERROR_BASE}/not-found`,
  CONFLICT: `${ERROR_BASE}/conflict`,
  RATE_LIMITED: `${ERROR_BASE}/rate-limited`,
  INTERNAL: `${ERROR_BASE}/internal`,
  MODULE_DISABLED: `${ERROR_BASE}/module-disabled`,
  RLS_DENIED: `${ERROR_BASE}/rls-denied`,
  UNPROCESSABLE: `${ERROR_BASE}/unprocessable`,
  PRECONDITION_FAILED: `${ERROR_BASE}/precondition-failed`,
} as const;

export type ErrorType = (typeof ErrorTypes)[keyof typeof ErrorTypes];

export interface ProblemDetails {
  type: ErrorType | string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  requestId: string;
  errors?: Array<{ path: string; message: string }>;
  [extensionField: string]: unknown;
}

/**
 * Baut eine RFC-7807-konforme Response.
 */
export function problemResponse(p: ProblemDetails): Response {
  const body: ProblemDetails = { ...p };
  return new Response(JSON.stringify(body), {
    status: p.status,
    headers: {
      "content-type": "application/problem+json; charset=utf-8",
      "x-request-id": p.requestId,
    },
  });
}

// ─── Convenience-Helfer pro Typ ──────────────────────────────────────

interface ShortOpts {
  requestId: string;
  instance?: string;
  detail?: string;
}

// Group errors into the legacy `fieldErrors: {field: [msg]}` shape
// that several existing clients still parse. RFC 7807 lets us include
// arbitrary extension fields, so we keep `errors` (canonical) AND add
// `fieldErrors` (legacy ergonomic).
function groupFieldErrors(
  errors: Array<{ path: string; message: string }>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of errors) {
    const key = e.path || "_";
    (out[key] ??= []).push(e.message);
  }
  return out;
}

export const problem = {
  validation(
    opts: ShortOpts & { errors: Array<{ path: string; message: string }> },
  ): Response {
    // #NIGHT-038/-044: every 422 now carries BOTH the RFC 7807 `errors`
    // array and the legacy `fieldErrors` object. UI code can pick
    // whichever is more convenient without us breaking either.
    return problemResponse({
      type: ErrorTypes.VALIDATION,
      title: "Validation failed",
      status: 422,
      fieldErrors: groupFieldErrors(opts.errors),
      ...opts,
    });
  },

  unauthorized(opts: ShortOpts): Response {
    return problemResponse({
      type: ErrorTypes.UNAUTHORIZED,
      title: "Unauthorized",
      status: 401,
      ...opts,
    });
  },

  forbidden(opts: ShortOpts): Response {
    return problemResponse({
      type: ErrorTypes.FORBIDDEN,
      title: "Forbidden",
      status: 403,
      ...opts,
    });
  },

  notFound(opts: ShortOpts): Response {
    return problemResponse({
      type: ErrorTypes.NOT_FOUND,
      title: "Resource not found",
      status: 404,
      ...opts,
    });
  },

  conflict(opts: ShortOpts): Response {
    return problemResponse({
      type: ErrorTypes.CONFLICT,
      title: "Conflict with current state",
      status: 409,
      ...opts,
    });
  },

  rateLimited(opts: ShortOpts & { retryAfterSeconds?: number }): Response {
    const r = problemResponse({
      type: ErrorTypes.RATE_LIMITED,
      title: "Too many requests",
      status: 429,
      ...opts,
    });
    if (opts.retryAfterSeconds) {
      r.headers.set("retry-after", String(opts.retryAfterSeconds));
    }
    return r;
  },

  internal(opts: ShortOpts & { errorId?: string }): Response {
    return problemResponse({
      type: ErrorTypes.INTERNAL,
      title: "Internal server error",
      status: 500,
      errorId: opts.errorId,
      ...opts,
    });
  },

  moduleDisabled(opts: ShortOpts & { moduleKey: string }): Response {
    const { moduleKey, ...rest } = opts;
    return problemResponse({
      type: ErrorTypes.MODULE_DISABLED,
      title: "Module not enabled for this organization",
      status: 404,
      moduleKey,
      ...rest,
    });
  },

  // 405 with the Allow header populated. The over-night QA (#NIGHT-009,
  // -017, -018, -037) flagged Next.js's default 405 as missing Allow,
  // which leaves clients guessing which methods the route accepts.
  methodNotAllowed(
    opts: ShortOpts & { allow: string[]; method?: string },
  ): Response {
    const allowHeader = opts.allow.join(", ");
    const r = problemResponse({
      type: `${ERROR_BASE}/method-not-allowed`,
      title: "Method Not Allowed",
      status: 405,
      detail:
        opts.detail ??
        `${opts.method ? `${opts.method} not supported. ` : ""}This endpoint accepts: ${allowHeader}`,
      requestId: opts.requestId,
      instance: opts.instance,
      allow: opts.allow,
    });
    r.headers.set("allow", allowHeader);
    return r;
  },
};

/**
 * Extract requestId from a Request. Falls back to a fresh
 * `crypto.randomUUID()` if no `x-request-id` header is set.
 *
 * Production middleware (middleware.ts) sets the header on every
 * request, so the fallback only activates in test, dev-without-
 * middleware, or edge-case routes mounted before the middleware
 * matcher (e.g. `/api/auth`). The fallback guarantees that every
 * problem+json response carries a non-empty correlation ID for
 * log-grep — Wave 23 acceptance tests assert `requestId` truthy on
 * every error response.
 */
export function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

// ─────────────────────────────────────────────────────────────────────────
// [ARCTOS-FULL-2026-08-31 / WP12 · S14-16] Legacy → RFC 7807 normalisation
// ─────────────────────────────────────────────────────────────────────────
//
// ADR-021 says "Alle API-Errors folgen RFC 7807 … Content-Type:
// application/problem+json", and `docs/STATUS.md:226` lists "RFC-7807
// Error-Envelopes" among the completed wave topics. The measurement over all
// 1.355 routes under /api/v1:
//
//     application/problem+json …………………………………………………………………     9
//     { error: "…" } ……………………………………………………………………………………   970
//     { message: "…" } ………………………………………………………………………………    11
//     { errors: … } ……………………………………………………………………………………      6
//
// The helpers above existed and were imported by 8 routes. The contract was
// therefore met by well under 1 %, while being reported as done.
//
// Migrating 970 route bodies by hand is neither this package's file ownership
// nor a change anyone could review. What IS available is the chokepoint every
// wrapped route already passes through: `withErrorHandler` in
// `lib/api-wrapper.ts`. `normaliseErrorResponse` converts a legacy error body
// on the way out, so a route keeps `return Response.json({ error: "Not
// found" }, { status: 404 })` and the CLIENT receives
//
//     Content-Type: application/problem+json
//     { "type": ".../not-found", "title": "Not Found", "status": 404,
//       "detail": "Not found", "instance": "/api/v1/…", "requestId": "…" }
//
// That turns the wrapper from "correct shape for uncaught exceptions only"
// into "correct shape for every error the route emits", and it is why the
// contract now holds for every wrapped route instead of for nine of them.
// A route that already emits problem+json is passed through untouched.

const STATUS_TO_TYPE: Record<number, { type: string; title: string }> = {
  400: { type: `${ERROR_BASE}/validation`, title: "Bad Request" },
  401: { type: ErrorTypes.UNAUTHORIZED, title: "Unauthorized" },
  403: { type: ErrorTypes.FORBIDDEN, title: "Forbidden" },
  404: { type: ErrorTypes.NOT_FOUND, title: "Not Found" },
  405: {
    type: `${ERROR_BASE}/method-not-allowed`,
    title: "Method Not Allowed",
  },
  409: { type: ErrorTypes.CONFLICT, title: "Conflict" },
  412: { type: ErrorTypes.PRECONDITION_FAILED, title: "Precondition Failed" },
  415: {
    type: `${ERROR_BASE}/unsupported-media-type`,
    title: "Unsupported Media Type",
  },
  422: { type: ErrorTypes.UNPROCESSABLE, title: "Unprocessable Content" },
  429: { type: ErrorTypes.RATE_LIMITED, title: "Too Many Requests" },
  500: { type: ErrorTypes.INTERNAL, title: "Internal Server Error" },
  503: {
    type: `${ERROR_BASE}/service-unavailable`,
    title: "Service Unavailable",
  },
};

/** The three legacy error shapes the audit counted, plus arbitrary extras. */
interface LegacyErrorBody {
  error?: unknown;
  message?: unknown;
  errors?: unknown;
  [k: string]: unknown;
}

/**
 * Rewrites a legacy JSON error response as RFC 7807.
 *
 * Untouched, and deliberately so:
 *  - any response with status < 400 (a 2xx `{ error: null }` is data, not an
 *    error, and rewriting it would change a success payload);
 *  - a response that is already `application/problem+json`;
 *  - a non-JSON response (a streamed file download, a CSV export, an HTML
 *    error page from an upstream) — reading its body to inspect it would
 *    consume the stream.
 *
 * Every field of the original body is preserved as an RFC 7807 extension
 * member, so a client that parses `json.error` today keeps working. That is
 * what makes this safe to apply to 143 existing routes at once: the change is
 * strictly additive on the body and only the Content-Type becomes more
 * specific.
 */
export async function normaliseErrorResponse(
  res: Response,
  opts: { instance?: string; requestId: string },
): Promise<Response> {
  if (res.status < 400) return res;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/problem+json")) return res;
  if (!contentType.includes("application/json")) return res;

  let body: LegacyErrorBody;
  try {
    body = (await res.clone().json()) as LegacyErrorBody;
  } catch {
    // Malformed JSON — leave it alone rather than swallow the original.
    return res;
  }
  if (body === null || typeof body !== "object" || Array.isArray(body))
    return res;
  // Already problem-shaped (a route that built one by hand): don't double-wrap.
  if (typeof body.type === "string" && typeof body.title === "string")
    return res;

  const mapped = STATUS_TO_TYPE[res.status] ?? {
    type: `${ERROR_BASE}/http-${res.status}`,
    title: `HTTP ${res.status}`,
  };
  const detail =
    typeof body.error === "string"
      ? body.error
      : typeof body.message === "string"
        ? body.message
        : typeof body.detail === "string"
          ? body.detail
          : undefined;

  const problem: ProblemDetails = {
    type: mapped.type,
    title: mapped.title,
    status: res.status,
    ...(detail ? { detail } : {}),
    ...(opts.instance ? { instance: opts.instance } : {}),
    requestId: opts.requestId,
  };

  // Carry every original member across as an RFC 7807 extension member — that
  // is what keeps a client reading `json.error` working. Written through the
  // index signature rather than spread into the literal: the legacy body's
  // `errors` is `unknown`, and `ProblemDetails.errors` declares the zod-shaped
  // `{path, message}[]`. Spreading would either fail the typecheck (it did) or
  // require a cast that claims a shape nobody verified. A key already set
  // above is never overwritten, so a route cannot smuggle its own `status` or
  // `type` past the normalisation.
  for (const [key, value] of Object.entries(body)) {
    if (key in problem) continue;
    problem[key] = value;
  }

  // Carry over every header the route set (Allow, Retry-After, Location, …);
  // only the content type changes.
  const headers = new Headers(res.headers);
  headers.set("content-type", "application/problem+json; charset=utf-8");
  if (!headers.has("x-request-id")) headers.set("x-request-id", opts.requestId);
  return new Response(JSON.stringify(problem), { status: res.status, headers });
}
