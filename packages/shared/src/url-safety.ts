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

// #S04-02/S04-03 (ARCTOS-FULL-2026-08-31): the original guard only ever
// looked at hostnames matching /^\d{1,3}(\.\d{1,3}){3}$/ — i.e. plain
// dotted-quad. `inet_aton`-style spellings that every libc (and therefore
// Node's `getaddrinfo`, curl and the browser) accepts slipped straight
// through the literal check:
//
//   2130706433      decimal            → 127.0.0.1
//   0x7f000001      hex                → 127.0.0.1
//   0177.0.0.1      octal octet        → 127.0.0.1
//   127.1           2-part short form  → 127.0.0.1
//   0               "this host"        → 0.0.0.0
//   2852039166      decimal            → 169.254.169.254 (IMDS)
//
// `normalizeNumericIPv4` reproduces the inet_aton grammar (1–4 parts, each
// decimal / 0-prefixed octal / 0x-prefixed hex, the last part absorbing the
// remaining bytes) and returns the canonical dotted quad, so the range check
// below sees the address the OS resolver will actually dial.
export function normalizeNumericIPv4(host: string): string | null {
  const h = host.trim();
  if (h.length === 0) return null;
  // A trailing dot ("127.0.0.1.") is accepted by some resolvers; normalize
  // it away rather than treating it as an empty 5th part.
  const cleaned = h.endsWith(".") ? h.slice(0, -1) : h;
  const parts = cleaned.split(".");
  if (parts.length < 1 || parts.length > 4) return null;

  const nums: bigint[] = [];
  for (const part of parts) {
    if (part.length === 0) return null;
    if (/^0[xX][0-9a-fA-F]+$/.test(part)) {
      nums.push(BigInt(part.toLowerCase()));
    } else if (/^0[0-7]+$/.test(part)) {
      nums.push(BigInt(parseInt(part, 8)));
    } else if (/^[0-9]+$/.test(part)) {
      nums.push(BigInt(part));
    } else {
      return null;
    }
  }

  // All but the last part must be a single octet; the last part absorbs the
  // remaining 32 - 8*(n-1) bits.
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i] > 255n) return null;
  }
  const lastMaxExclusive = 1n << BigInt(32 - 8 * (nums.length - 1));
  if (nums[nums.length - 1] >= lastMaxExclusive) return null;

  let acc = 0n;
  for (let i = 0; i < nums.length - 1; i++) {
    acc |= nums[i] << BigInt(32 - 8 * (i + 1));
  }
  acc |= nums[nums.length - 1];

  return [
    (acc >> 24n) & 0xffn,
    (acc >> 16n) & 0xffn,
    (acc >> 8n) & 0xffn,
    acc & 0xffn,
  ].join(".");
}

function isPrivateIPv4(ip: string): boolean {
  // Accept every inet_aton spelling, not just dotted-quad.
  const canonical = normalizeNumericIPv4(ip) ?? ip;
  const n = ipv4ToBigInt(canonical);
  if (n < 0n) return false;
  return PRIVATE_IPV4_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

/**
 * Expand an IPv6 literal into its eight 16-bit groups.
 *
 * #S04-02: the original check was prefix matching on the *written* form, so
 * only the shortest spelling of each address was caught. The fully written
 * loopback `0:0:0:0:0:0:0:1`, the zero-padded `::0001` and
 * `[0:0:0:0:0:ffff:a9fe:a9fe]` (IMDS) all read as "public". Expanding first
 * makes the comparison spelling-independent.
 */
function expandIPv6(raw: string): number[] | null {
  let h = raw.replace(/^\[|\]$/g, "").toLowerCase();
  // Drop a zone index ("fe80::1%eth0").
  const zone = h.indexOf("%");
  if (zone >= 0) h = h.slice(0, zone);
  if (h.length === 0 || !h.includes(":")) return null;

  // Trailing embedded IPv4 ("::ffff:127.0.0.1") → two hex groups.
  const v4tail = h.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4tail) {
    const quad = v4tail[1].split(".").map(Number);
    if (quad.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    const hi = ((quad[0] << 8) | quad[1]).toString(16);
    const lo = ((quad[2] << 8) | quad[3]).toString(16);
    h = h.slice(0, h.length - v4tail[1].length) + `${hi}:${lo}`;
  }

  const halves = h.split("::");
  if (halves.length > 2) return null;

  const toGroups = (s: string): number[] | null => {
    if (s.length === 0) return [];
    const out: number[] = [];
    for (const g of s.split(":")) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };

  if (halves.length === 1) {
    const groups = toGroups(h);
    return groups && groups.length === 8 ? groups : null;
  }

  const head = toGroups(halves[0]);
  const tail = toGroups(halves[1]);
  if (!head || !tail) return null;
  const fill = 8 - head.length - tail.length;
  if (fill < 0) return null;
  return [...head, ...(Array(fill).fill(0) as number[]), ...tail];
}

function isPrivateIPv6Literal(host: string): boolean {
  const groups = expandIPv6(host);
  if (!groups) {
    // Not a parseable IPv6 literal — fall back to the original conservative
    // prefix check so this never *loosens* the previous behaviour.
    const h = host.replace(/^\[|\]$/g, "").toLowerCase();
    return (
      h === "::1" ||
      h === "::" ||
      h.startsWith("fc") ||
      h.startsWith("fd") ||
      h.startsWith("fe80:") ||
      h.startsWith("ff")
    );
  }

  const first = groups[0];

  // Unspecified :: and loopback ::1
  if (groups.every((g, i) => (i === 7 ? g <= 1 : g === 0))) return true;
  if ((first & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  if ((first & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((first & 0xffc0) === 0xfec0) return true; // site-local fec0::/10
  if ((first & 0xff00) === 0xff00) return true; // multicast ff00::/8

  const embeddedV4 = () =>
    [
      (groups[6] >> 8) & 0xff,
      groups[6] & 0xff,
      (groups[7] >> 8) & 0xff,
      groups[7] & 0xff,
    ].join(".");

  // IPv4-mapped ::ffff:0:0/96 and IPv4-compatible ::a.b.c.d
  const headIsZero = groups.slice(0, 5).every((g) => g === 0);
  if (headIsZero && (groups[5] === 0xffff || groups[5] === 0)) {
    if (isPrivateIPv4(embeddedV4())) return true;
  }
  // NAT64 well-known prefix 64:ff9b::/96 wrapping a private v4.
  if (first === 0x64 && groups[1] === 0xff9b) {
    if (isPrivateIPv4(embeddedV4())) return true;
  }

  return false;
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

export interface OutboundUrlCheckOptions {
  /**
   * When true, plain http:// is refused regardless of
   * WEBHOOK_ALLOW_HTTP. Used by SSO/SAML/OIDC and threat-feed callers,
   * where a cleartext fetch is a finding in its own right.
   */
  requireHttps?: boolean;
  /** Label used in the refusal message (defaults to "outbound requests"). */
  purpose?: string;
}

/**
 * Sync, hostname-literal check for SSRF safety. Shared by every outbound
 * fetch in the product — webhooks, SAML metadata, OIDC discovery, threat
 * feeds, interface health checks.
 *
 * Use at registration time (Zod refine) AND right before the HTTP call.
 * For the DNS-rebinding-resistant version, follow this with
 * `checkResolvedHostIsPublic` (or use `safeFetch`, which does both plus
 * per-redirect-hop re-validation).
 */
export function checkOutboundUrl(
  rawUrl: string,
  options: OutboundUrlCheckOptions = {},
): WebhookUrlCheckResult {
  const purpose = options.purpose ?? "outbound requests";
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
  // `requireHttps` overrides the escape hatch entirely.
  if (parsed.protocol === "http:") {
    if (options.requireHttps) {
      return {
        ok: false,
        reason: `Plain http:// is not allowed for ${purpose}.`,
      };
    }
    if (process.env.WEBHOOK_ALLOW_HTTP !== "1") {
      return {
        ok: false,
        reason: `Plain http:// is not allowed for ${purpose}.`,
      };
    }
  }

  // Embedded credentials ("https://user:pass@internal/") are never
  // legitimate here and are a classic parser-confusion vector.
  if (parsed.username || parsed.password) {
    return {
      ok: false,
      reason: "URLs with embedded credentials are not allowed.",
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host) return { ok: false, reason: "URL must include a hostname." };

  if (FORBIDDEN_HOSTNAMES.has(host)) {
    return { ok: false, reason: `Hostname '${host}' is not allowed.` };
  }

  if (
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost")
  ) {
    return {
      ok: false,
      reason: `Hostnames ending in .local/.internal/.localhost are not allowed (got '${host}').`,
    };
  }

  // Literal IPv4 in ANY inet_aton spelling (dotted quad, decimal, octal,
  // hex, short form). #S04-02: the old check matched dotted-quad only.
  const numeric = normalizeNumericIPv4(host);
  if (numeric !== null && isPrivateIPv4(numeric)) {
    return {
      ok: false,
      reason: `IP ${host} (${numeric}) is in a private/reserved range and not allowed for ${purpose}.`,
    };
  }

  // Literal IPv6 (URL hostname is unbracketed; original URL has brackets)
  if (host.includes(":") && isPrivateIPv6Literal(host)) {
    return {
      ok: false,
      reason: `IPv6 ${host} is in a private/reserved range and not allowed for ${purpose}.`,
    };
  }

  return { ok: true, url: parsed };
}

/**
 * Webhook-flavoured wrapper. Kept as the historic public name so the
 * existing webhook call sites and their tests are untouched.
 */
export function checkWebhookUrl(rawUrl: string): WebhookUrlCheckResult {
  return checkOutboundUrl(rawUrl, { purpose: "webhooks" });
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
