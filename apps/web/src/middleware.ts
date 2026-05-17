import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@grc/auth";

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

// #WAVE13-RBAC-03: HinSchG vertraulichkeit. Users whose ONLY roles in the
// session are `whistleblowing_officer` and/or `ombudsperson` are confined to
// the whistleblowing module + their own session basics. This prevents the
// role-conflict the QA report flagged: a Wb-officer browsing risks/audits
// either learns reporter identity by inference or contaminates other
// compliance domains with case knowledge. Users with additional roles
// (e.g. an admin who is also wb-officer for one org) are unaffected.
const HINSCHG_ISOLATED_ROLES = new Set([
  "whistleblowing_officer",
  "ombudsperson",
]);

// Paths a HinSchG-isolated user is allowed to reach. Anything else → 403.
function isHinSchgAllowedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/v1/whistleblowing") ||
    pathname.startsWith("/whistleblowing") ||
    pathname === "/api/v1/users/me" ||
    pathname.startsWith("/api/v1/notifications") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/login" ||
    pathname === "/logout" ||
    pathname === "/" || // root-redirect, lands in whistleblowing module
    pathname.startsWith("/api/v1/health")
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const requestId = ensureRequestId(req);

  // Public routes — no auth required.
  // /api/v1/health is the liveness/readiness probe for Docker healthchecks
  // and external monitors -- must respond without a session cookie.
  // Returns only { status, checkedAt, dbLatencyMs, service } -- no data.
  //
  // /api/v1/whistleblowing/intake/* is the HinSchG-conform anonymous tip
  // channel — tipsters MUST be able to submit without an account, and
  // German whistleblower protection (HinSchG §16) forbids identifying
  // the reporter, so requiring a session would be a legal-compliance
  // bug, not just a UX nuisance. The submit endpoint does its own
  // org-resolution via orgCode and never trusts the caller's identity.
  // The discovery (GET) endpoint returns only a public schema map.
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/v1/health" ||
    pathname.startsWith("/api/v1/whistleblowing/intake") ||
    // #WAVE23.1 / #WAVE23.3: /api/v1/meta/* is deploy-/build-diagnostic.
    // Wave-23 designed `GET /meta/build` as self-service for the D1
    // prod-SHA check (commitSha + branch + builtAt + nodeVersion + uptime).
    // The middleware was blocking it with 401 → SSH-only diagnostic
    // again, defeating the purpose. The meta endpoints expose only
    // build-time / process-time strings that are also visible in any
    // GitHub push event — no secrets, no PII, no DB touch.
    //
    // Originally `/api/v1/_meta/*`; renamed in W23.3 because Next.js
    // App Router treats `_`-prefixed folders as PRIVATE and silently
    // drops them from the route table.
    pathname.startsWith("/api/v1/meta")
  ) {
    const res = NextResponse.next();
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
  const isHinSchgIsolated =
    roles.length > 0 && roles.every((r) => HINSCHG_ISOLATED_ROLES.has(r.role));
  if (isHinSchgIsolated && !isHinSchgAllowedPath(pathname)) {
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

  const res = NextResponse.next();
  res.headers.set("x-request-id", requestId);
  return res;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
