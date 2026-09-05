// Server-only companion to `url-safety.ts`. Pulls Node's `dns/promises`
// directly — this file MUST NOT be imported from any code path that
// could be bundled for the browser. Next.js's webpack rejects the
// `node:` scheme during client-bundling and the whole build fails.
//
// Subpath export: `@grc/shared/lib/url-safety-server`. Use from server
// code only (worker, Next.js Route Handlers, API endpoints).

import { lookup } from "node:dns/promises";
import {
  __privateIpHelpers,
  checkOutboundUrl,
  type OutboundUrlCheckOptions,
  type WebhookUrlCheckResult,
} from "../url-safety";

const { isPrivateIPv4, isPrivateIPv6Literal } = __privateIpHelpers;

/** Wrap a bare IPv6 literal in brackets so `new URL()` accepts it. */
function hostForUrl(hostname: string): string {
  return hostname.includes(":") && !hostname.startsWith("[")
    ? `[${hostname}]`
    : hostname;
}

/**
 * Async DNS check that closes the DNS-rebinding hole left open by the
 * sync `checkWebhookUrl`. Call this right before issuing an outbound
 * `fetch` on a webhook URL — resolves the hostname via the system
 * resolver (so `/etc/hosts`, split-horizon DNS, and CNAME chains that
 * land on a private IP all get caught) and verifies the resolved IP is
 * not in a private/reserved range.
 *
 * Caveats:
 * - Small TOCTOU window between this lookup and `fetch`'s own DNS
 *   resolution. The robust fix needs a custom undici Agent that pins the
 *   IP from this lookup; the measured reason it is NOT built here stands
 *   at the bottom of this file (OP-112). Current implementation is
 *   nonetheless much stronger than the literal-hostname check alone,
 *   which is trivially bypassed by `aaa.example.com` → A 10.0.0.5.
 *
 * - Skips when WEBHOOK_ALLOW_PRIVATE_HOSTS=1, matching the sync check's
 *   escape hatch.
 */
export async function checkResolvedHostIsPublic(
  hostname: string,
): Promise<WebhookUrlCheckResult> {
  if (process.env.WEBHOOK_ALLOW_PRIVATE_HOSTS === "1") {
    return { ok: true, url: new URL(`https://${hostForUrl(hostname)}`) };
  }

  let resolved: Array<{ address: string; family: number }>;
  try {
    resolved = await lookup(hostname, { all: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: `DNS lookup failed for '${hostname}': ${message}`,
    };
  }

  if (resolved.length === 0) {
    return {
      ok: false,
      reason: `DNS lookup returned no addresses for '${hostname}'.`,
    };
  }

  for (const { address, family } of resolved) {
    if (family === 4 && isPrivateIPv4(address)) {
      return {
        ok: false,
        reason: `'${hostname}' resolves to private IPv4 ${address}; refusing.`,
      };
    }
    if (family === 6 && isPrivateIPv6Literal(address)) {
      return {
        ok: false,
        reason: `'${hostname}' resolves to private IPv6 ${address}; refusing.`,
      };
    }
  }

  return { ok: true, url: new URL(`https://${hostForUrl(hostname)}`) };
}

// ─────────────────────────────────────────────────────────────────────
// #S04-02 / S04-03 — SSRF-safe outbound fetch
//
// The audit found two paths (SAML metadata / OIDC discovery, and the ISMS
// threat feed in the worker) that called bare `fetch()` on a user-supplied
// URL. It also flagged that the existing guard, even where it *was* used,
// left one hole open that a pre-flight check can never close on its own:
//
//   REDIRECTS. `fetch()` follows up to 20 redirects by default and only
//   the FIRST URL was ever validated. `https://attacker.test/x` →
//   302 → `http://169.254.169.254/latest/meta-data/` reached the metadata
//   service with a fully "validated" starting URL.
//
// `safeFetch` closes that by driving the redirect chain itself with
// `redirect: "manual"` and re-running the full guard (literal check +
// DNS resolution) on EVERY hop, including the first.
//
// Remaining, documented residual risk: the TOCTOU window between our
// `lookup()` and the one `fetch()` performs internally. Pinning the
// resolved IP needs a custom undici dispatcher; see WP5.md.
//
// ── [OP-112 · Welle 5c] Warum der Dispatcher hier NICHT steht ──────────
//
// Gemessen am 2026-09-05, nicht geschätzt.
//
// Der Weg selbst trägt. Nachweis (kleiner HTTP-Server auf 127.0.0.1, ein
// Hostname, den kein Resolver kennt, und ein Agent, dessen `connect.lookup`
// die Adresse festnagelt):
//
//   const agent = new Agent({ connect: { lookup: pinned } });
//   await fetch("http://rebind.invalid:PORT/", { dispatcher: agent });
//   → status: 200 | body: host=rebind.invalid:35463
//   → lookup calls: [{"hostname":"rebind.invalid",
//                     "opts":{"hints":32,"all":true}}]
//
// Node 22.22.2 nimmt den fremden Dispatcher an, `Host` und TLS-SNI bleiben
// der Hostname (das Zertifikat wird also weiter gegen ihn geprüft), und
// `lookup` wird mit `all: true` gerufen — die Rückgabe muss deshalb ein
// Array sein, sonst endet der Aufruf in „Invalid IP address: undefined".
//
// Woran es scheitert, ist die Abhängigkeit:
//
//   $ npm ls undici --all
//   `-- @grc/web@0.1.0 -> ./apps/web
//     `-- jsdom@29.1.1
//       `-- undici@7.29.0 overridden
//   $ npm ls undici --all --omit=dev
//   `-- (empty)
//
// `undici` liegt im Baum ausschliesslich als ENTWICKLUNGSabhängigkeit von
// `jsdom` (devDependency von apps/web, für die Testumgebung). Eine
// Produktionsinstallation (`npm ci --omit=dev`) hat es nicht. Diese Datei
// läuft aber in Produktion — sie hängt an `safeFetch` in
// `packages/auth/src/oidc/discovery.ts`, `…/saml/metadata-parser.ts` und
// `apps/worker/src/crons/threat-feed-sync.ts`. Ein `import`/`await import`
// auf undici würde dort mit ERR_MODULE_NOT_FOUND enden und JEDEN
// ausgehenden Aufruf brechen — aus einer Härtung würde ein Ausfall.
//
// Ein optionaler Import mit stillem Rückfall auf ungepinntes `fetch` wäre
// die schlechtere Variante desselben Fehlers: eine Schranke, die in
// Produktion abgeschaltet ist und nichts davon meldet. Dieser Audit hat
// neun Tore gefunden, die genau so gebaut waren.
//
// Was fehlt, ist deshalb kein Code, sondern EINE ZEILE ausserhalb der
// Dateihoheit dieser Welle: `"undici": "^7.29.0"` in den `dependencies`
// von `packages/shared/package.json`, plus der zugehörige
// `package-lock.json`-Eintrag (Tor-Eingabe von
// scripts/check-gate-inputs.mjs). Danach ist der Dispatcher oben
// wörtlich einsetzbar: die aufgelösten Adressen aus
// `checkResolvedHostIsPublic` in ein `lookup` schliessen, das `all: true`
// beachtet, und den Agent je Aufruf an `fetch` übergeben.

export interface SafeFetchOptions extends OutboundUrlCheckOptions {
  /** Maximum redirect hops to follow. 0 disables redirect following. */
  maxRedirects?: number;
  /** Per-request timeout in ms (applies to each hop). Default 10 000. */
  timeoutMs?: number;
  /** Headers sent with the request. */
  headers?: Record<string, string>;
  /** HTTP method. Default GET. */
  method?: string;
}

export class SsrfBlockedError extends Error {
  constructor(reason: string) {
    super(`Blocked by SSRF guard: ${reason}`);
    this.name = "SsrfBlockedError";
  }
}

/**
 * Validate one URL completely: scheme/host literal check plus DNS
 * resolution of the hostname. Exported so callers that must fetch through
 * another client can still reuse the exact same decision.
 */
export async function assertUrlIsSafe(
  rawUrl: string,
  options: OutboundUrlCheckOptions = {},
): Promise<WebhookUrlCheckResult> {
  const literal = checkOutboundUrl(rawUrl, options);
  if (!literal.ok) return literal;
  const resolved = await checkResolvedHostIsPublic(literal.url.hostname);
  if (!resolved.ok) return resolved;
  return literal;
}

/**
 * Drop-in replacement for `fetch()` on any URL that is influenced by user
 * input. Throws `SsrfBlockedError` when the target — or any redirect hop —
 * is not a public host.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 10_000;

  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const check = await assertUrlIsSafe(current, {
      requireHttps: options.requireHttps,
      purpose: options.purpose,
    });
    if (!check.ok) throw new SsrfBlockedError(check.reason);

    const response = await fetch(check.url.toString(), {
      method: options.method ?? "GET",
      headers: options.headers,
      // We follow redirects ourselves so every hop is validated.
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });

    const isRedirect =
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.has("location");
    if (!isRedirect) return response;

    if (hop === maxRedirects) {
      throw new SsrfBlockedError(
        `too many redirects (limit ${maxRedirects}) starting at ${rawUrl}`,
      );
    }

    const location = response.headers.get("location") as string;
    // Resolve relative Locations against the hop we just fetched.
    current = new URL(location, check.url).toString();
  }

  // Unreachable — the loop either returns or throws.
  throw new SsrfBlockedError("redirect loop exhausted");
}
