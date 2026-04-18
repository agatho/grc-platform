// rate-limit.ts
//
// ADR-019 Phase 1: Token-Bucket-Implementation gegen Redis.
// Helper-Lib -- nicht automatisch gewrappt. Neue/kritische Routen
// koennen explizit so wrappen:
//
//   import { rateLimit } from "@/lib/rate-limit";
//
//   const limit = await rateLimit({
//     key: `auth:${ip}`, capacity: 10, windowSeconds: 60,
//   });
//   if (!limit.allowed) {
//     return problem.rateLimited({
//       requestId, instance: req.url,
//       retryAfterSeconds: limit.retryAfterSeconds,
//     });
//   }
//
// Fail-open: wenn Redis nicht erreichbar, wird `allowed: true`
// zurueckgegeben und der Fehler ins Log geschrieben. Ein fehlender
// Rate-Limit darf die App nicht blockieren (ADR-019 rationale).
//
// Vorlaeufige In-Memory-Fallback-Implementation fuer dev ohne Redis.
// In Produktion muss REDIS_URL gesetzt sein und ein echter Redis-Client
// nachinstalliert werden (ioredis oder redis-npm).

import { log } from "@/lib/logger";

export interface RateLimitOptions {
  /** Eindeutiger Key pro Bucket -- z. B. "auth:<ip>" oder "copilot:<userId>" */
  key: string;
  /** Maximale Tokens im Bucket */
  capacity: number;
  /** Window-Dauer in Sekunden -- nach windowSeconds wird Bucket voll aufgefuellt */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Sekunden bis zum naechsten erlaubten Request */
  retryAfterSeconds: number;
}

// In-Memory-Fallback. Nur fuer dev ohne Redis. Pro Container, nicht shared.
const inMemoryBuckets = new Map<string, { tokens: number; lastRefillMs: number }>();

function inMemoryCheck(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const bucket = inMemoryBuckets.get(opts.key) ?? { tokens: opts.capacity, lastRefillMs: now };
  const elapsedMs = now - bucket.lastRefillMs;
  const refillRate = opts.capacity / (opts.windowSeconds * 1000); // tokens per ms
  const refilled = Math.min(opts.capacity, bucket.tokens + elapsedMs * refillRate);

  if (refilled < 1) {
    const needed = 1 - refilled;
    const retryAfterSeconds = Math.ceil(needed / refillRate / 1000);
    inMemoryBuckets.set(opts.key, { tokens: refilled, lastRefillMs: now });
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  const consumed = refilled - 1;
  inMemoryBuckets.set(opts.key, { tokens: consumed, lastRefillMs: now });
  return {
    allowed: true,
    remaining: Math.floor(consumed),
    retryAfterSeconds: 0,
  };
}

/**
 * Prueft einen Rate-Limit-Bucket und consumiert im Erfolgsfall 1 Token.
 *
 * In Phase 1 (jetzt) nutzt die Implementation In-Memory-State pro Container.
 * Fuer Multi-Container-Setup muss auf Redis umgestellt werden -- siehe
 * ADR-019. Der API-Contract bleibt stabil.
 */
export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  if (opts.capacity <= 0 || opts.windowSeconds <= 0) {
    throw new Error("rateLimit: capacity and windowSeconds must be > 0");
  }
  try {
    // TODO: Phase 2 -- echte Redis-Implementation hinter REDIS_URL
    // Aktuelle Impl: Fallback fuer dev + Single-Container. In Multi-
    // Container-Prod-Setup gibt das unterschiedliche Limits pro
    // Container, aber die Summe bleibt beschraenkt.
    return inMemoryCheck(opts);
  } catch (e) {
    // Fail-open: Fehler loggen, Request durchlassen
    log.error("rate-limit check failed, failing open", {
      key: opts.key,
      error: String(e),
    });
    return { allowed: true, remaining: opts.capacity, retryAfterSeconds: 0 };
  }
}

/**
 * Vordefinierte Limits aus ADR-019. Applikationen koennen diese direkt
 * nutzen oder eigene Werte angeben.
 */
export const LIMITS = {
  DEFAULT: { capacity: 300, windowSeconds: 60 },
  AUTH: { capacity: 10, windowSeconds: 60 },
  COPILOT: { capacity: 30, windowSeconds: 60 },
  IMPORT: { capacity: 5, windowSeconds: 3600 },
  AUDIT_INTEGRITY: { capacity: 1, windowSeconds: 60 },
} as const;

/**
 * Extract client-IP aus Request. Beruecksichtigt X-Forwarded-For
 * (gesetzt vom Caddy-Reverse-Proxy).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
