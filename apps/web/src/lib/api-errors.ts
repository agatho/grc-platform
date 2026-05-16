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
