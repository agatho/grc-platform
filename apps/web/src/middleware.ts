import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import {
  authConfig,
  isHinSchgIsolated,
  isHinSchgAllowedPath,
  isPublicPath,
} from "@grc/auth";

// Middleware uses the edge-safe config (no DB imports).
// It only verifies the JWT — no credential validation happens here.
const { auth } = NextAuth(authConfig);

// Stamps every response with an X-Request-ID header for log correlation.
// If the client sent one (e.g. from an upstream proxy), we keep it;
// otherwise we generate a random 8-byte hex id. Keeping the header name
// standard means third-party log shippers (Loki, Datadog) pick it up
// automatically.
function ensureRequestId(req: Request): string {
  const existing = req.headers.get("x-request-id");
  if (existing && /^[A-Za-z0-9_-]{4,128}$/.test(existing)) return existing;
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function withRequestId(response: Response, requestId: string): Response {
  // Clone headers so we can mutate. Response.headers is mutable in
  // edge runtime but using a new Response keeps the contract explicit.
  const headers = new Headers(response.headers);
  if (!headers.has("x-request-id")) headers.set("x-request-id", requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// #WAVE13-RBAC-03 / #WP3-S12-17: the HinSchG isolation predicates now live in
// `packages/auth/src/rbac.ts` (edge-safe, no DB import) so the SAME rule is
// evaluated twice: here against the JWT copy of the roles (covers UI pages and
// module-discovery probes) and in `withAuth` against the roles read fresh from
// the database (covers every API authorisation). Previously only this edge
// check existed, and it decided on a role list that could be 8 hours old.

/**
 * #WP3 — forward the routed path and method to the Node runtime.
 *
 * `withAuth()` needs both to resolve the module scope (S02-11), the mutating
 * role floor (S02-10), the module/action for the custom-role fallback (S02-02)
 * and the platform-admin requirement (S02-03). A Next.js route handler has no
 * reliable way to learn its own pathname, so the middleware — which does —
 * stamps it onto the REQUEST headers. Any client-supplied value of these
 * headers is overwritten here, so they cannot be spoofed from outside.
 */
function nextWithRoutingHeaders(req: Request, pathname: string) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-arctos-path", pathname);
  requestHeaders.set("x-arctos-method", req.method.toUpperCase());
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const requestId = ensureRequestId(req);

  // Public routes — no auth required. The complete list, with a reason per
  // entry, lives in PUBLIC_EXACT_PATHS / PUBLIC_PREFIXES / PUBLIC_PATTERNS
  // above (S02-04, S12-09, S12-18).
  if (isPublicPath(pathname)) {
    const res = nextWithRoutingHeaders(req, pathname);
    res.headers.set("x-request-id", requestId);
    return res;
  }

  // All other routes require authentication
  if (!req.auth?.user) {
    // API routes get 401 JSON — never redirect to HTML login page
    if (pathname.startsWith("/api/")) {
      return withRequestId(
        new Response(
          JSON.stringify({
            type: "https://arctos.charliehund.de/errors/unauthorized",
            title: "Unauthorized",
            status: 401,
            detail: "Authentication required",
            instance: pathname,
            requestId,
          }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/problem+json; charset=utf-8",
            },
          },
        ),
        requestId,
      );
    }

    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    const res = NextResponse.redirect(loginUrl);
    res.headers.set("x-request-id", requestId);
    return res;
  }

  // HinSchG-isolation gate. Checked here (edge) instead of per-route to
  // catch every path including UI pages and module-discovery probes.
  const roles =
    (req.auth.user as unknown as { roles?: Array<{ role: string }> }).roles ??
    [];
  if (isHinSchgIsolated(roles) && !isHinSchgAllowedPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return withRequestId(
        new Response(
          JSON.stringify({
            type: "https://arctos.charliehund.de/errors/forbidden",
            title: "Forbidden",
            status: 403,
            detail:
              "HinSchG officers (whistleblowing_officer, ombudsperson) are confined to the whistleblowing module to preserve reporter confidentiality (§§16, 32 HinSchG).",
            instance: pathname,
            requestId,
          }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/problem+json; charset=utf-8",
            },
          },
        ),
        requestId,
      );
    }
    // UI request → bounce to the case list rather than confuse the user
    const wbHome = new URL("/whistleblowing/cases", req.nextUrl.origin);
    const res = NextResponse.redirect(wbHome);
    res.headers.set("x-request-id", requestId);
    return res;
  }

  const res = nextWithRoutingHeaders(req, pathname);
  res.headers.set("x-request-id", requestId);
  return res;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
