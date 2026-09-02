// rate-limit.ts — ADR-019 rate limiting, rebuilt.
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S10-05 (High), S10-23; with WP3/S02-09,
//  WP6 (AI routes) and WP8 (export/portal paths)]
//
// What the audit measured on the previous implementation:
//
//   (a) Coverage: `rateLimit(` was called in 5 of 1.357 `route.ts` files.
//       No limit on the Auth.js login callback, password reset, upload,
//       export, import, whistleblower intake or the supplier portal.
//   (b) The one IP-based limit was defeated by a single request header.
//       `getClientIp()` took the FIRST entry of `X-Forwarded-For`; Caddy
//       APPENDS the client address to an existing header instead of
//       replacing it, so `X-Forwarded-For: <anything>` put every request in
//       its own bucket. Rotating one header value per attempt removed the
//       10/min limit on `/api/v1/auth/admin-login` entirely.
//   (c) ADR-019 claims a Caddy layer of "100 req/s per IP" as an existing
//       compensating control. `deploy/Caddyfile` has no `rate_limit`
//       directive, and Caddy has none without a plugin. It also promised
//       `RATE_LIMIT_DEFAULT` / `_AUTH` / `_COPILOT`, implemented nowhere.
//   (d) The bucket `Map` had no eviction. Since the key contained the
//       attacker-controlled XFF address, every request added a permanent
//       entry — a slow memory leak against the web container (S10-23).
//
// What this file now does:
//
//   * `getClientIp()` counts trusted proxy hops from the RIGHT of
//     `X-Forwarded-For` (`TRUSTED_PROXY_HOPS`, default 1). With one reverse
//     proxy the last entry is the address that proxy observed, which the
//     client cannot forge. Client-supplied entries further left are ignored
//     instead of preferred.
//   * A path→policy table plus `checkRequestRateLimit()` puts coverage in
//     ONE place, callable from the edge middleware, instead of 1.357 opt-in
//     decisions.
//   * Auth and other anonymous paths are FAIL-CLOSED: if the limiter itself
//     errors, the request is rejected. Everything else stays fail-open as
//     ADR-019 intends — a broken limiter must not take the product down,
//     but it must also not silently reopen the login endpoint.
//   * The bucket store is bounded and self-evicting.
//
// Deliberate limitation, unchanged but now stated honestly: the store is
// per-process. With more than one web container the effective limit is
// `N × capacity`. A Redis backend is the next step (`REDIS_URL` is already
// in the compose file); this API does not change when it lands.

// NOTE: no `@/lib/logger` import here on purpose. This module is imported
// by `middleware.ts`, which Next.js runs in the EDGE runtime, and the
// logger writes through `process.stdout.write`, which the edge runtime does
// not provide. `console.error` works in both runtimes and is still picked up
// by the Docker log driver.

export interface RateLimitOptions {
  /** Unique bucket key — e.g. "auth:<ip>" or "copilot:<userId>". */
  key: string;
  /** Bucket capacity (requests per window). */
  capacity: number;
  /** Window length in seconds; the bucket refills fully over this period. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the next request would be allowed. */
  retryAfterSeconds: number;
  /** True when the limiter could not decide and let the request through. */
  degraded?: boolean;
}

// ──────────────────────────────────────────────────────────────
// Bounded token-bucket store (S10-23)
// ──────────────────────────────────────────────────────────────

interface Bucket {
  tokens: number;
  lastRefillMs: number;
  /** Wall-clock time at which this bucket is certainly full again. */
  fullAtMs: number;
}

const MAX_BUCKETS = Number(process.env.RATE_LIMIT_MAX_BUCKETS ?? 50_000);
const buckets = new Map<string, Bucket>();

/**
 * Drop buckets that have refilled to capacity (they carry no state) and, if
 * that is not enough, the oldest entries. `Map` preserves insertion order,
 * so the first keys are the least recently created.
 */
function evictIfNeeded(nowMs: number): void {
  if (buckets.size <= MAX_BUCKETS) return;
  const target = Math.floor(MAX_BUCKETS * 0.9);
  for (const [key, bucket] of buckets) {
    if (bucket.fullAtMs <= nowMs) buckets.delete(key);
    if (buckets.size <= target) return;
  }
  for (const key of buckets.keys()) {
    buckets.delete(key);
    if (buckets.size <= target) return;
  }
}

function inMemoryCheck(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const refillPerMs = opts.capacity / (opts.windowSeconds * 1000);
  const bucket = buckets.get(opts.key) ?? {
    tokens: opts.capacity,
    lastRefillMs: now,
    fullAtMs: now,
  };
  const refilled = Math.min(
    opts.capacity,
    bucket.tokens + (now - bucket.lastRefillMs) * refillPerMs,
  );

  const store = (tokens: number) => {
    buckets.set(opts.key, {
      tokens,
      lastRefillMs: now,
      fullAtMs: now + (opts.capacity - tokens) / refillPerMs,
    });
    evictIfNeeded(now);
  };

  if (refilled < 1) {
    store(refilled);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((1 - refilled) / refillPerMs / 1000),
      ),
    };
  }

  const consumed = refilled - 1;
  store(consumed);
  return {
    allowed: true,
    remaining: Math.floor(consumed),
    retryAfterSeconds: 0,
  };
}

/** Test seam: drop all buckets. */
export function __resetRateLimitState(): void {
  buckets.clear();
}

/** Test/diagnostic seam: current bucket count. */
export function rateLimitBucketCount(): number {
  return buckets.size;
}

/**
 * Check a bucket and consume one token on success.
 *
 * `failClosed` inverts the behaviour when the limiter itself throws: the
 * default (false) lets the request through and logs, which is ADR-019's
 * stated rationale; auth paths pass true, because "the limiter is broken"
 * must not mean "brute force is unlimited".
 */
export async function rateLimit(
  opts: RateLimitOptions & { failClosed?: boolean },
): Promise<RateLimitResult> {
  if (opts.capacity <= 0 || opts.windowSeconds <= 0) {
    throw new Error("rateLimit: capacity and windowSeconds must be > 0");
  }
  try {
    return inMemoryCheck(opts);
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "error",
        service: process.env.ARCTOS_SERVICE ?? "arctos-web",
        msg: "rate-limit check failed",
        key: opts.key,
        failClosed: Boolean(opts.failClosed),
        error: String(e),
      }),
    );
    if (opts.failClosed) {
      return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
    }
    return {
      allowed: true,
      remaining: opts.capacity,
      retryAfterSeconds: 0,
      degraded: true,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// Client address (S10-05c)
// ──────────────────────────────────────────────────────────────

/**
 * Number of reverse proxies between the client and this process whose
 * `X-Forwarded-For` entries can be trusted. One Caddy in front of Next.js
 * is the shipped topology, hence the default of 1. Set 0 when the app is
 * exposed directly (XFF is then ignored entirely), or 2 when a CDN sits in
 * front of Caddy.
 */
const TRUSTED_PROXY_HOPS = (() => {
  const raw = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  return Number.isInteger(raw) && raw >= 0 ? raw : 1;
})();

/**
 * The client address, as far as the trusted infrastructure can vouch for it.
 *
 * `X-Forwarded-For` is APPENDED to by each proxy, so the list reads
 * `<client-supplied…>, <seen by proxy 1>, <seen by proxy 2>`. With `h`
 * trusted hops the last trustworthy entry sits at index `length - h`;
 * everything to its left was supplied by the client and is unusable. The
 * old code took exactly that — `split(",")[0]`.
 *
 * With `TRUSTED_PROXY_HOPS = 0`, XFF is ignored completely.
 */
export function getClientIp(req: Request): string {
  if (TRUSTED_PROXY_HOPS > 0) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
      const parts = xff
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const idx = parts.length - TRUSTED_PROXY_HOPS;
      if (idx >= 0 && parts[idx]) return parts[idx];
      // Fewer entries than configured hops: the header did not arrive
      // through the expected chain. Fall through rather than trust a
      // client-supplied value.
    }
    const real = req.headers.get("x-real-ip");
    if (real) return real.trim();
  }
  const direct = (req as { ip?: string }).ip;
  if (direct) return direct;
  return "unknown";
}

// ──────────────────────────────────────────────────────────────
// Policies (S10-05a)
// ──────────────────────────────────────────────────────────────

/**
 * Format: "<capacity>/<windowSeconds>", e.g. RATE_LIMIT_AUTH="10/60".
 * ADR-019 §68-70 promised these variables; nothing read them until now.
 */
function envLimit(
  name: string,
  fallback: { capacity: number; windowSeconds: number },
): { capacity: number; windowSeconds: number } {
  const raw = process.env[name];
  if (!raw) return fallback;
  const m = /^(\d+)\/(\d+)$/.exec(raw.trim());
  if (!m) return fallback;
  const capacity = Number(m[1]);
  const windowSeconds = Number(m[2]);
  if (capacity <= 0 || windowSeconds <= 0) return fallback;
  return { capacity, windowSeconds };
}

export const LIMITS = {
  DEFAULT: envLimit("RATE_LIMIT_DEFAULT", { capacity: 300, windowSeconds: 60 }),
  AUTH: envLimit("RATE_LIMIT_AUTH", { capacity: 10, windowSeconds: 60 }),
  COPILOT: envLimit("RATE_LIMIT_COPILOT", { capacity: 30, windowSeconds: 60 }),
  AI_ASSIST: envLimit("RATE_LIMIT_AI", { capacity: 10, windowSeconds: 60 }),
  IMPORT: envLimit("RATE_LIMIT_IMPORT", { capacity: 5, windowSeconds: 3600 }),
  EXPORT: envLimit("RATE_LIMIT_EXPORT", { capacity: 10, windowSeconds: 3600 }),
  UPLOAD: envLimit("RATE_LIMIT_UPLOAD", { capacity: 60, windowSeconds: 60 }),
  PORTAL: envLimit("RATE_LIMIT_PORTAL", { capacity: 30, windowSeconds: 60 }),
  INTAKE: envLimit("RATE_LIMIT_INTAKE", { capacity: 5, windowSeconds: 600 }),
  // [E2E-TRIAGE-3 · 2026-09-02] Same sustained rate, an honest burst.
  //
  // ADR-019 §57 asks for "1 req/min per user" on the hash-chain verification,
  // and that sustained rate is right: the endpoint re-hashes every audit row
  // of the tenant and is the most expensive read in the product.
  //
  // `capacity: 1` is not that rule, though — it is that rule with a burst of
  // ONE, which is a different and worse thing. A token bucket of size 1 is
  // empty after the first call, so the SECOND call is refused however far
  // apart the two are inside the window. Measured against the running
  // instance: call 1 → 200, call 2 immediately after → 429, Retry-After 60.
  //
  // What that costs in the product, not just in the suite: `/audit-log` calls
  // this endpoint on mount. Open the page, navigate away, come back within the
  // minute — the integrity panel of the audit trail reports a failure. On that
  // particular panel a failure reads as "the audit log could not be verified".
  // A control that cries wolf on a page revisit is worse than no indicator.
  //
  // 5 per 300 s is ADR-019's average unchanged (5/300s = 1/60s) and lets a
  // person look twice. Still per-user, still fail-open, still overridable via
  // RATE_LIMIT_AUDIT_INTEGRITY.
  AUDIT_INTEGRITY: envLimit("RATE_LIMIT_AUDIT_INTEGRITY", {
    capacity: 5,
    windowSeconds: 300,
  }),
} as const;

export interface RateLimitPolicy {
  /** Prefix match on the request path. */
  prefix: string;
  name: string;
  limit: { capacity: number; windowSeconds: number };
  /** Reject rather than pass through when the limiter itself fails. */
  failClosed: boolean;
}

/**
 * Path policies, most specific first. Requested by:
 *   * WP3 (S02-09) — the Auth.js login callback and password reset had no
 *     limit at all. WP3's account lockout is per account, so an attacker
 *     spraying one password across many accounts stayed unthrottled.
 *   * WP6 — the AI and copilot routes.
 *   * WP8 — bulk export, DSR/whistleblower intake and the portals.
 */
const POLICIES: RateLimitPolicy[] = [
  // ── Session-bound, credential-free: NOT an authentication attempt ───
  //
  // [E2E-TRIAGE-2026-09-02 · C-12] `/api/v1/auth/switch-org` matched the
  // `/api/v1/auth/` prefix below and therefore shared the 10-per-minute,
  // ADDRESS-keyed, fail-closed login bucket. It is not a login: it requires an
  // established session, presents no credential, and only rewrites the active
  // org cookie after checking the target against the session's own role list
  // (`apps/web/src/app/api/v1/auth/switch-org/route.ts`).
  //
  // The consequence was measured on the running instance: `E2E-401` received
  // `429` switching into the organisation its own session was already in, and
  // three later specs timed out on the login form because the shared address
  // budget was already spent. In production the same shape is worse — eleven
  // org switches a minute from one office address locked EVERYONE behind that
  // address out of logging in, and it is fail-closed, so there is no degraded
  // mode to fall back to.
  //
  // Own policy, subject-keyed (the middleware passes the verified session id),
  // and deliberately still capped: an authenticated user can rewrite their own
  // org cookie as often as they like without being able to spend anyone else's
  // budget. Must stay ABOVE `/api/v1/auth/` — `policyForPath` takes the first
  // prefix match.
  {
    prefix: "/api/v1/auth/switch-org",
    name: "session-switch",
    limit: LIMITS.DEFAULT,
    failClosed: false,
  },

  // ── Authentication: fail-closed, address-keyed ─────────────────────
  {
    prefix: "/api/auth/callback",
    name: "auth",
    limit: LIMITS.AUTH,
    failClosed: true,
  },
  {
    prefix: "/api/auth/signin",
    name: "auth",
    limit: LIMITS.AUTH,
    failClosed: true,
  },
  {
    prefix: "/api/v1/auth/",
    name: "auth",
    limit: LIMITS.AUTH,
    failClosed: true,
  },
  {
    prefix: "/api/v1/sso/",
    name: "auth",
    limit: LIMITS.AUTH,
    failClosed: true,
  },
  {
    prefix: "/api/v1/scim/",
    name: "auth",
    limit: LIMITS.AUTH,
    failClosed: true,
  },

  // ── Anonymous intake surfaces (WP8) ────────────────────────────────
  {
    prefix: "/api/v1/whistleblowing/intake",
    name: "intake",
    limit: LIMITS.INTAKE,
    failClosed: true,
  },
  {
    prefix: "/api/v1/portal/",
    name: "portal",
    limit: LIMITS.PORTAL,
    failClosed: true,
  },
  {
    prefix: "/api/v1/public/",
    name: "portal",
    limit: LIMITS.PORTAL,
    failClosed: true,
  },

  // ── Expensive or exfiltration-relevant operations (WP8) ────────────
  {
    prefix: "/api/v1/export/",
    name: "export",
    limit: LIMITS.EXPORT,
    failClosed: false,
  },
  {
    prefix: "/api/v1/import/",
    name: "import",
    limit: LIMITS.IMPORT,
    failClosed: false,
  },
  {
    prefix: "/api/v1/documents/upload",
    name: "upload",
    limit: LIMITS.UPLOAD,
    failClosed: false,
  },
  {
    prefix: "/api/v1/files/",
    name: "upload",
    limit: LIMITS.UPLOAD,
    failClosed: false,
  },
  {
    prefix: "/api/v1/audit-log/integrity",
    name: "audit-integrity",
    limit: LIMITS.AUDIT_INTEGRITY,
    failClosed: false,
  },

  // ── AI and copilot (WP6) ───────────────────────────────────────────
  {
    prefix: "/api/v1/copilot/",
    name: "copilot",
    limit: LIMITS.COPILOT,
    failClosed: false,
  },
  {
    prefix: "/api/v1/ai/",
    name: "ai",
    limit: LIMITS.AI_ASSIST,
    failClosed: false,
  },
  {
    prefix: "/api/v1/processes/generate-bpmn",
    name: "ai",
    limit: LIMITS.AI_ASSIST,
    failClosed: false,
  },

  // ── Everything else under /api ─────────────────────────────────────
  {
    prefix: "/api/",
    name: "default",
    limit: LIMITS.DEFAULT,
    failClosed: false,
  },
];

export function policyForPath(pathname: string): RateLimitPolicy | null {
  for (const policy of POLICIES) {
    if (pathname.startsWith(policy.prefix)) return policy;
  }
  return null;
}

export interface RequestLimitVerdict {
  policy: string;
  result: RateLimitResult;
}

/**
 * Evaluate the rate limit for one request. Returns `null` when no policy
 * applies (static assets, UI pages).
 *
 * `subjectId` — when the caller knows the authenticated principal, the
 * bucket is keyed on it rather than the address, so one user behind a shared
 * NAT cannot exhaust everyone else's budget. Anonymous paths (login, portal,
 * intake) stay address-keyed; that is the whole point of them, and a request
 * that PRESENTS a credential must not be able to leave that bucket by also
 * carrying a session (see the `session-switch` policy for the converse case).
 */
export async function checkRequestRateLimit(
  req: Request,
  pathname: string,
  subjectId?: string,
): Promise<RequestLimitVerdict | null> {
  const policy = policyForPath(pathname);
  if (!policy) return null;
  const anonymous =
    policy.name === "auth" ||
    policy.name === "portal" ||
    policy.name === "intake";
  const subject =
    !anonymous && subjectId ? `u:${subjectId}` : `ip:${getClientIp(req)}`;
  const result = await rateLimit({
    key: `${policy.name}:${subject}`,
    capacity: policy.limit.capacity,
    windowSeconds: policy.limit.windowSeconds,
    failClosed: policy.failClosed,
  });
  return { policy: policy.name, result };
}

/**
 * ADR-021-shaped 429 response. Defined here so the edge middleware does not
 * have to import the Node-only `api-errors` helper.
 */
export function tooManyRequestsResponse(params: {
  pathname: string;
  requestId: string;
  retryAfterSeconds: number;
}): Response {
  return new Response(
    JSON.stringify({
      type: "https://arctos.charliehund.de/errors/rate-limited",
      title: "Too Many Requests",
      status: 429,
      detail: "Rate limit exceeded. Please retry later.",
      instance: params.pathname,
      requestId: params.requestId,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/problem+json; charset=utf-8",
        "Retry-After": String(Math.max(1, params.retryAfterSeconds)),
        "x-request-id": params.requestId,
      },
    },
  );
}
