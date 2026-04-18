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

export const problem = {
  validation(opts: ShortOpts & { errors: Array<{ path: string; message: string }> }): Response {
    return problemResponse({
      type: ErrorTypes.VALIDATION,
      title: "Validation failed",
      status: 422,
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
};

/**
 * Extract requestId from a Request. Falls back to empty string if not
 * present. Wenn Middleware (middleware.ts) aktiv ist, ist X-Request-ID
 * garantiert gesetzt.
 */
export function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? "";
}
