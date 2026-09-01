import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import {
  authConfig,
  isHinSchgIsolated,
  isHinSchgAllowedPath,
  isPublicPath,
} from "@grc/auth";
// [WP9 · S10-05] Edge-safe: rate-limit.ts imports only the logger.
import {
  checkRequestRateLimit,
  tooManyRequestsResponse,
} from "@/lib/rate-limit";
// [WP12 · S12-04, S12-08] Edge-safe: no Node built-ins, no imports of its own.
import {
  contentSecurityPolicy,
  generateCspNonce,
  staticSecurityHeaders,
} from "@/lib/security-headers";

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
  // [WP12 · S12-08] The middleware short-circuits (401/403 problem+json,
  // 429) never reach `next.config.ts` headers(), so they carried no security
  // headers at all. Same set, applied here.
  for (const { key, value } of staticSecurityHeaders()) {
    if (!headers.has(key)) headers.set(key, value);
  }
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

/** [WP12 · S12-08] Stamp the request-independent security header set. */
function applyStaticSecurityHeaders(res: { headers: Headers }) {
  for (const { key, value } of staticSecurityHeaders()) {
    if (!res.headers.has(key)) res.headers.set(key, value);
  }
}

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

  // ── [ARCTOS-FULL-2026-08-31 / WP12 · S12-04] Nonce-based CSP ──────────
  //
  // The CSP shipped `script-src 'self' 'unsafe-inline' 'unsafe-eval'`, which
  // is no policy at all: `'unsafe-inline'` permits every injected <script>,
  // every `on*=` handler AND every `javascript:` URI — the last of those is
  // precisely why the CSP offered no fallback against S12-06 / S12-12.
  //
  // A nonce has to be minted per response, so it cannot live in
  // `next.config.ts` `headers()` (S12-08 handles the request-independent set
  // there). Next.js reads the nonce out of the `content-security-policy`
  // REQUEST header and stamps it onto its own inline bootstrap scripts, which
  // is what allows `'unsafe-inline'` to be dropped.
  //
  // This file belongs to WP3 (S02-04 allowlist). The edit is minimal, additive
  // and confined to this helper; it is recorded as a cross-package edit in
  // /work/audit/remediation/WP12.md, following the same route WP9 took for the
  // rate-limit wiring above. It could not be done from WP12's own files — the
  // middleware is the only layer that can see a request before it is rendered.
  const nonce = generateCspNonce();
  const csp = contentSecurityPolicy(nonce, {
    isDev: process.env.NODE_ENV === "development",
  });
  requestHeaders.set("content-security-policy", csp);
  requestHeaders.set("x-nonce", nonce);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  // `next.config.ts` sets the same values, but only for responses that go
  // through the route-header pipeline. Setting them here too means a
  // middleware short-circuit (redirect, 401, 403) is covered as well.
  applyStaticSecurityHeaders(res);
  return res;
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const requestId = ensureRequestId(req);

  // ── [ARCTOS-FULL-2026-08-31 / WP9 · S10-05] Rate limiting ──────────
  //
  // This is the only place in the request path that sees EVERY route, so it
  // is where coverage has to be decided. Before this, `rateLimit()` was
  // opted into by 5 of 1.357 route files, and the Auth.js login callback —
  // the most attacked endpoint of any application — had no limit at all.
  //
  // Deliberately placed BEFORE the authentication check: brute force
  // happens on unauthenticated requests. The policy table, the
  // trusted-proxy handling (`TRUSTED_PROXY_HOPS`) and the
  // fail-open/fail-closed decision live in `lib/rate-limit.ts`.
  //
  // This file is owned by WP3 (S02-04 allowlist). This block is the minimal
  // wiring WP9 requires and is recorded as a cross-package edit in
  // /work/audit/remediation/WP9.md — an unwired limiter would have been
  // exactly the placebo fix the remediation plan forbids.
  const limited = await checkRequestRateLimit(
    req,
    pathname,
    (req.auth?.user as { id?: string } | undefined)?.id,
  );
  if (limited && !limited.result.allowed) {
    // [WP12 · S12-08] `withRequestId` is idempotent on x-request-id and adds
    // the security header set the 429 short-circuit would otherwise miss.
    return withRequestId(
      tooManyRequestsResponse({
        pathname,
        requestId,
        retryAfterSeconds: limited.result.retryAfterSeconds,
      }),
      requestId,
    );
  }

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
    applyStaticSecurityHeaders(res);
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
    applyStaticSecurityHeaders(res);
    return res;
  }

  const res = nextWithRoutingHeaders(req, pathname);
  res.headers.set("x-request-id", requestId);
  return res;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
