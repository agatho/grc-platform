// SSRF guard for outbound webhook URLs.
//
// Background: the webhook registration accepted any URL that passed Zod's
// `.url()`. That allowed admins (and any path that lets a user write a
// webhook URL) to point ARCTOS at internal services — most dangerously the
// cloud metadata endpoint (169.254.169.254), localhost, link-local, and
// other private ranges.
//
// Defence layers:
//   1. SYNC literal-hostname check (this file) — refuses obvious bad
//      hosts at registration time. Implemented as a pure function so the
//      same logic runs in the Zod schema AND at delivery time in the
//      worker before the HTTP call is made.
//   2. RUNTIME DNS check (worker, future PR) — resolve the hostname and
//      re-check that the resolved IP is not in a private range. Necessary
//      to defeat DNS rebinding. Out of scope for this PR.
//
// Note: this validator is intentionally strict for the alpha. If pilots
// need to call into a private network, set WEBHOOK_ALLOW_PRIVATE_HOSTS=1
// on the worker — the registration-time gate becomes a warning.

const PRIVATE_IPV4_RANGES: Array<[bigint, bigint]> = (() => {
  // Convert CIDR → [start, end] as bigints for fast range comparison.
  const cidrs: Array<[string, number]> = [
    ["0.0.0.0", 8], // "this network"
    ["10.0.0.0", 8], // RFC 1918
    ["100.64.0.0", 10], // CGNAT (RFC 6598)
    ["127.0.0.0", 8], // loopback
    ["169.254.0.0", 16], // link-local — covers AWS/GCP/Azure IMDS 169.254.169.254
    ["172.16.0.0", 12], // RFC 1918
    ["192.0.0.0", 24], // RFC 6890
    ["192.0.2.0", 24], // documentation TEST-NET-1
    ["192.168.0.0", 16], // RFC 1918
    ["198.18.0.0", 15], // benchmark
    ["198.51.100.0", 24], // TEST-NET-2
    ["203.0.113.0", 24], // TEST-NET-3
    ["224.0.0.0", 4], // multicast
    ["240.0.0.0", 4], // reserved / 255.255.255.255 broadcast
  ];
  return cidrs.map(([ip, bits]) => {
    const base = ipv4ToBigInt(ip);
    const mask = (1n << BigInt(32 - bits)) - 1n;
    return [base, base | mask] as [bigint, bigint];
  });
})();

function ipv4ToBigInt(ip: string): bigint {
  const parts = ip.split(".");
  if (parts.length !== 4) return -1n;
  let acc = 0n;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return -1n;
    acc = (acc << 8n) | BigInt(n);
  }
  return acc;
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToBigInt(ip);
  if (n < 0n) return false;
  return PRIVATE_IPV4_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

function isPrivateIPv6Literal(host: string): boolean {
  // Strip optional brackets, lower-case for comparison.
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::1") return true; // loopback
  if (h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local
  if (h.startsWith("fe80:")) return true; // link-local
  if (h.startsWith("ff")) return true; // multicast
  // IPv4-mapped (::ffff:127.0.0.1)
  const v4mapped = h.match(/^(?:0:){5}ffff:([0-9a-f.:]+)$/);
  if (v4mapped) {
    return isPrivateIPv4(v4mapped[1]) || isPrivateIPv4(dotted(v4mapped[1]));
  }
  return false;
}

function dotted(s: string): string {
  // ::ffff:7f00:0001 → 127.0.0.1 (rough conversion for the v4-mapped case)
  if (!s.includes(":")) return s;
  const parts = s.split(":");
  const last = parts[parts.length - 1];
  if (/^[0-9a-f]{1,4}$/.test(last) && parts.length >= 2) {
    const hi = parseInt(parts[parts.length - 2], 16);
    const lo = parseInt(last, 16);
    if (Number.isNaN(hi) || Number.isNaN(lo)) return s;
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }
  return s;
}

const FORBIDDEN_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "broadcasthost",
  // Cloud metadata services (alias hostnames in addition to literal IPs)
  "metadata.google.internal",
  "metadata.goog",
]);

export type WebhookUrlCheckResult =
  { ok: true; url: URL } | { ok: false; reason: string };

/**
 * Sync, hostname-literal check for SSRF safety. Use at registration time
 * (Zod refine) AND right before the HTTP call in the worker.
 */
export function checkWebhookUrl(rawUrl: string): WebhookUrlCheckResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      ok: false,
      reason: `Only http(s) URLs are allowed (got ${parsed.protocol}).`,
    };
  }

  // Allow http in dev only — flag via env. Default: https-only.
  if (parsed.protocol === "http:" && process.env.WEBHOOK_ALLOW_HTTP !== "1") {
    return { ok: false, reason: "Plain http:// is not allowed for webhooks." };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host) return { ok: false, reason: "URL must include a hostname." };

  if (FORBIDDEN_HOSTNAMES.has(host)) {
    return { ok: false, reason: `Hostname '${host}' is not allowed.` };
  }

  if (host.endsWith(".local") || host.endsWith(".internal")) {
    return {
      ok: false,
      reason: `Hostnames ending in .local/.internal are not allowed (got '${host}').`,
    };
  }

  // Literal IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    if (isPrivateIPv4(host)) {
      return {
        ok: false,
        reason: `IP ${host} is in a private/reserved range and not allowed for webhooks.`,
      };
    }
  }

  // Literal IPv6 (URL hostname is unbracketed; original URL has brackets)
  if (host.includes(":") && isPrivateIPv6Literal(host)) {
    return {
      ok: false,
      reason: `IPv6 ${host} is in a private/reserved range and not allowed for webhooks.`,
    };
  }

  return { ok: true, url: parsed };
}

/**
 * Convenience for use inside Zod schemas:
 *   z.string().url().refine(webhookUrlRefine, ...)
 */
export function webhookUrlRefine(rawUrl: string): boolean {
  return checkWebhookUrl(rawUrl).ok;
}

export function webhookUrlRefineMessage(rawUrl: string): string {
  const r = checkWebhookUrl(rawUrl);
  return r.ok ? "" : r.reason;
}

// The async `checkResolvedHostIsPublic` (DNS-rebind defense) lives in
// ./url-safety-server.ts. It's NOT re-exported from this file or
// index.ts because pulling Node's `dns/promises` into the client-side
// bundle breaks Next.js build (UnhandledSchemeError on "node:" prefix).
// Import it directly from server code via @grc/shared/lib/url-safety-server.

// Expose the IP predicates to the server helper without re-exporting them
// as public API.
export const __privateIpHelpers = {
  isPrivateIPv4,
  isPrivateIPv6Literal,
};
