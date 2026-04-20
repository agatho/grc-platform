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

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const requestId = ensureRequestId(req);

  // Public routes — no auth required.
  // /api/v1/health is the liveness/readiness probe for Docker healthchecks
  // and external monitors -- must respond without a session cookie.
  // Returns only { status, checkedAt, dbLatencyMs, service } -- no data.
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/v1/health"
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
            error: "Unauthorized",
            message: "Authentication required",
            requestId,
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
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

  const res = NextResponse.next();
  res.headers.set("x-request-id", requestId);
  return res;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
