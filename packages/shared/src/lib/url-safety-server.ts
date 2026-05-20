// Server-only companion to `url-safety.ts`. Pulls Node's `dns/promises`
// directly — this file MUST NOT be imported from any code path that
// could be bundled for the browser. Next.js's webpack rejects the
// `node:` scheme during client-bundling and the whole build fails.
//
// Subpath export: `@grc/shared/lib/url-safety-server`. Use from server
// code only (worker, Next.js Route Handlers, API endpoints).

import { lookup } from "node:dns/promises";
import { __privateIpHelpers, type WebhookUrlCheckResult } from "../url-safety";

const { isPrivateIPv4, isPrivateIPv6Literal } = __privateIpHelpers;

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
 *   resolution. Robust fix needs a custom undici Agent that pins the
 *   IP from this lookup (follow-up). Current implementation is
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
    return { ok: true, url: new URL(`https://${hostname}`) };
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

  return { ok: true, url: new URL(`https://${hostname}`) };
}
