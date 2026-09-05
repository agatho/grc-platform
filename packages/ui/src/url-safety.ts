/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S12-06, S12-07, S12-12] URL guards for the
 * rendering layer.
 *
 * Three findings share one root cause: a URL that came out of the database or
 * out of a query string was handed straight to a navigation sink.
 *
 *  - S12-06 — `programme_step_link.target_url` was persisted with
 *    `z.string().max(1000)` (no scheme check) and rendered as `href`. React
 *    logs a development warning for a `javascript:` href but still sets the
 *    attribute, so the payload ran in the victim's origin with their session.
 *  - S12-07 — `?callbackUrl=` was passed to `router.push()` unvalidated, which
 *    turned the customer's own TLS-secured login page into a credential
 *    phishing relay.
 *  - S12-12 — `window.open(json.data.redirectUrl, …)` in the SSO admin UI.
 *
 * Both guards are allow-lists. A blocklist over scheme names does not work
 * here: `javascript:` survives `javascript:`, `java\tscript:`,
 * `JaVaScRiPt:` and `%6aavascript:` in at least one browser each, whereas
 * `new URL(...).protocol` is normalised by the parser before we see it.
 *
 * These live in `@grc/ui` rather than in `apps/web` because the output side is
 * the only place that can cover data that is ALREADY in the database — the
 * input-side schema fix stops new rows, not the existing ones.
 */

/** Schemes that may appear in an `href`/`window.open` target. */
const SAFE_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Returns the URL if it is safe to put in an `href` or `window.open`,
 * otherwise `undefined`.
 *
 * Relative URLs (`/risks/42`, `./x`) are accepted and returned unchanged —
 * they cannot carry a scheme. Protocol-relative URLs (`//evil.tld`) are
 * rejected: they look internal but navigate off-origin.
 *
 * ```ts
 * safeExternalHref("javascript:fetch('/api/v1/x',{method:'DELETE'})") // undefined
 * safeExternalHref("https://example.org/evidence.pdf") // unchanged
 * ```
 */
export function safeExternalHref(
  url: string | null | undefined,
): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // Protocol-relative: reject before the relative-path branch can accept it.
  if (trimmed.startsWith("//")) return undefined;
  // Same-origin relative path or fragment — no scheme possible.
  if (/^[/#?]/.test(trimmed)) return trimmed;

  let parsed: URL;
  try {
    // A bare `example.org/x` has no scheme and is not a valid absolute URL;
    // `new URL` throws and we reject rather than guess a scheme.
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }
  return SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol) ? trimmed : undefined;
}

/**
 * Normalises a post-login / post-action redirect target to a same-origin path.
 *
 * Anything that is not a plain absolute path on this origin collapses to
 * `fallback`. Rejected on purpose:
 *  - `https://attacker.tld/login` — absolute off-origin
 *  - `//attacker.tld` — protocol-relative, the classic bypass of a naive
 *    `startsWith("/")` check
 *  - `/\attacker.tld` and `/\\attacker.tld` — backslash is normalised to `/`
 *    by several browsers, so `/\evil.tld` navigates off-origin
 *  - `javascript:…`, `data:…` — no scheme is allowed at all
 *
 * Query string and fragment are preserved, so `?tab=controls#c-7` survives.
 */
export function safeRedirectPath(
  url: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!url) return fallback;
  const trimmed = url.trim();
  if (!trimmed.startsWith("/")) return fallback;
  // `//host`, `/\host`, `/\\host` all leave this origin.
  if (/^\/[/\\]/.test(trimmed)) return fallback;
  // Embedded control characters (TAB, CR, LF, NUL) are stripped by browsers
  // before URL parsing, so a path containing one can turn into `//evil.tld`.
  // eslint-disable-next-line no-control-regex -- these are exactly the bytes that must not appear
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return fallback;
  return trimmed;
}
