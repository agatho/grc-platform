/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S12-04, S12-08] Security headers, owned by
 * the application instead of by one deployment's reverse proxy.
 *
 * Before this module the complete header set existed only in
 * `deploy/Caddyfile`, which `deploy/setup-hetzner.sh` installs for the
 * single-server Hetzner path. The two Compose files ship no proxy at all
 * (`grep -n "caddy\|nginx\|traefik" docker-compose*.yml` → 0), and a
 * Kubernetes ingress, a cloud load balancer or a plain `next start` bring
 * none either — so two of the three shipped deployment modes served the app
 * with no CSP, no HSTS and no frame protection (S12-08).
 *
 * Split of responsibility:
 *  - `staticSecurityHeaders()` is emitted by `next.config.ts` `headers()` and
 *    therefore also covers `/_next/static/**`, which the middleware matcher
 *    deliberately excludes.
 *  - `contentSecurityPolicy(nonce)` is emitted by the middleware, because a
 *    nonce has to be minted per request. Next.js reads the nonce out of the
 *    `content-security-policy` REQUEST header and stamps it onto its own
 *    inline bootstrap scripts; that is what lets `'unsafe-inline'` disappear
 *    from `script-src` (S12-04).
 *
 * Edge-safe: no Node built-ins, no imports.
 */

/**
 * `script-src` carried `'unsafe-inline'` and `'unsafe-eval'`.
 *
 * `'unsafe-eval'`: removed outright. Neither `next.config.ts` nor the
 * application code contains `eval`/`new Function` (audit method M3, 0 hits).
 * Only the Turbopack dev server needs it, and the dev server is not served
 * through this path in production — `isDev` re-adds it for `next dev` only.
 *
 * `'unsafe-inline'`: removed in favour of a per-request nonce. This mattered
 * beyond hygiene — `'unsafe-inline'` in `script-src` is exactly what makes a
 * `javascript:` URI executable rather than blocked, so it was the reason the
 * CSP offered no second line of defence against S12-06/S12-12.
 *
 * `style-src 'unsafe-inline'` is kept and is a deliberate residual risk:
 * Tailwind 4 and `motion/react` write inline `style` attributes at runtime.
 * A style-only injection cannot execute script; it can be abused for data
 * exfiltration via attribute selectors, which is why `connect-src`/`img-src`
 * stay on `'self'` (plus `data:`/`blob:` for locally generated previews).
 */
export function contentSecurityPolicy(
  nonce: string,
  opts: { isDev?: boolean } = {},
): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    // Next's inline bootstrap is nonced; `strict-dynamic` lets those scripts
    // load the chunk graph without every chunk URL being enumerated.
    "'strict-dynamic'",
    // Ignored by CSP3 browsers when 'strict-dynamic' is present; present so
    // CSP2-only browsers still get host-based restriction rather than none.
    "https:",
    ...(opts.isDev ? ["'unsafe-eval'"] : []),
  ];

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    // Uploaded documents are streamed as blobs into an object URL for preview.
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    // Supersedes X-Frame-Options; kept alongside it for older browsers.
    "frame-ancestors 'self'",
    // No <form action> targets outside the origin (the app has no Server
    // Actions and no cross-origin form posts — audit S12-01).
    "form-action 'self'",
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * Headers that do not depend on the request. Applied by `next.config.ts` to
 * every route, including the static asset paths the middleware never sees.
 *
 * `X-XSS-Protection` is deliberately NOT set: the legacy auditor in old
 * browsers is a vulnerability of its own (it could be abused to selectively
 * disable scripts on a page) and is a no-op everywhere else. `deploy/Caddyfile`
 * previously set it and no longer does.
 */
export function staticSecurityHeaders(): Array<{
  key: string;
  value: string;
}> {
  return [
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    // Isolates this origin's browsing context group from cross-origin openers,
    // which is what makes `window.opener` unreachable independently of the
    // per-link `rel="noopener"` (relevant to S12-12).
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ];
}

/** 16 bytes of CSPRNG, base64url — the nonce for one response. */
export function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
