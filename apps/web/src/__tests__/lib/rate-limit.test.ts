// Tests for the in-memory rate-limit token bucket helper.
// Bezug: apps/web/src/lib/rate-limit.ts (ADR-019 Phase 1)

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the logger so we don't pollute test output
vi.mock("@/lib/logger", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("rateLimit", () => {
  let rateLimit: typeof import("../../lib/rate-limit").rateLimit;
  let LIMITS: typeof import("../../lib/rate-limit").LIMITS;

  beforeEach(async () => {
    // Reset in-memory state by re-importing fresh
    vi.resetModules();
    const mod = await import("../../lib/rate-limit");
    rateLimit = mod.rateLimit;
    LIMITS = mod.LIMITS;
  });

  it("allows the first request within capacity", async () => {
    const r = await rateLimit({
      key: "test-1",
      capacity: 5,
      windowSeconds: 60,
    });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBeGreaterThanOrEqual(3);
  });

  it("denies after capacity is exhausted", async () => {
    const opts = { key: "test-2", capacity: 3, windowSeconds: 60 };
    await rateLimit(opts);
    await rateLimit(opts);
    await rateLimit(opts);
    const fourth = await rateLimit(opts);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("isolates buckets by key", async () => {
    const a = await rateLimit({ key: "key-a", capacity: 1, windowSeconds: 60 });
    const b = await rateLimit({ key: "key-b", capacity: 1, windowSeconds: 60 });
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });

  it("throws when capacity <= 0", async () => {
    await expect(
      rateLimit({ key: "x", capacity: 0, windowSeconds: 60 }),
    ).rejects.toThrow();
  });

  it("throws when windowSeconds <= 0", async () => {
    await expect(
      rateLimit({ key: "x", capacity: 5, windowSeconds: 0 }),
    ).rejects.toThrow();
  });

  it("LIMITS constants match ADR-019", () => {
    expect(LIMITS.AUTH).toEqual({ capacity: 10, windowSeconds: 60 });
    expect(LIMITS.COPILOT).toEqual({ capacity: 30, windowSeconds: 60 });
    expect(LIMITS.IMPORT.windowSeconds).toBe(3600); // hourly
  });
});

describe("getClientIp — X-Forwarded-For spoofing (S10-05c)", () => {
  let getClientIp: typeof import("../../lib/rate-limit").getClientIp;

  async function load(hops?: string) {
    vi.resetModules();
    if (hops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = hops;
    const mod = await import("../../lib/rate-limit");
    getClientIp = mod.getClientIp;
  }

  afterEach(() => {
    delete process.env.TRUSTED_PROXY_HOPS;
  });

  // This is the regression test for the finding. The previous
  // implementation returned `xff.split(",")[0]` — the entry the CLIENT
  // supplied — so sending `X-Forwarded-For: <random>` put every request in
  // its own bucket and removed the limit entirely. With one trusted proxy,
  // the meaningful entry is the LAST one: the address Caddy actually
  // observed and appended.
  it("ignores a client-supplied X-Forwarded-For prefix", async () => {
    await load();
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("maps many spoofed prefixes onto ONE bucket key", async () => {
    await load();
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const req = new Request("http://localhost/", {
        headers: { "x-forwarded-for": `1.2.3.${i}, 198.51.100.7` },
      });
      seen.add(getClientIp(req));
    }
    expect([...seen]).toEqual(["198.51.100.7"]);
  });

  it("honours TRUSTED_PROXY_HOPS=2 (CDN in front of Caddy)", async () => {
    await load("2");
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "evil, 203.0.113.9, 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("203.0.113.9");
  });

  it("ignores X-Forwarded-For entirely when TRUSTED_PROXY_HOPS=0", async () => {
    await load("0");
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "203.0.113.1", "x-real-ip": "9.9.9.9" },
    });
    expect(getClientIp(req)).toBe("unknown");
  });

  it("falls back to X-Real-IP if X-Forwarded-For absent", async () => {
    await load();
    const req = new Request("http://localhost/", {
      headers: { "x-real-ip": "198.51.100.5" },
    });
    expect(getClientIp(req)).toBe("198.51.100.5");
  });

  it("returns 'unknown' when no headers present", async () => {
    await load();
    const req = new Request("http://localhost/");
    expect(getClientIp(req)).toBe("unknown");
  });

  it("trims whitespace from the forwarded IP", async () => {
    await load();
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "   203.0.113.1   " },
    });
    expect(getClientIp(req)).toBe("203.0.113.1");
  });

  it("does not trust XFF when it carries fewer entries than trusted hops", async () => {
    await load("2");
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "203.0.113.1", "x-real-ip": "10.0.0.2" },
    });
    expect(getClientIp(req)).toBe("10.0.0.2");
  });
});

describe("bucket store is bounded (S10-23)", () => {
  it("evicts once the configured ceiling is exceeded", async () => {
    vi.resetModules();
    process.env.RATE_LIMIT_MAX_BUCKETS = "100";
    const mod = await import("../../lib/rate-limit");
    mod.__resetRateLimitState();
    for (let i = 0; i < 500; i++) {
      await mod.rateLimit({
        key: `probe:${i}`,
        capacity: 5,
        windowSeconds: 60,
      });
    }
    expect(mod.rateLimitBucketCount()).toBeLessThanOrEqual(100);
    delete process.env.RATE_LIMIT_MAX_BUCKETS;
  });
});

describe("path policies (S10-05a)", () => {
  it("covers the Auth.js login callback, which had no limit at all", async () => {
    vi.resetModules();
    const mod = await import("../../lib/rate-limit");
    const policy = mod.policyForPath("/api/auth/callback/credentials");
    expect(policy?.name).toBe("auth");
    expect(policy?.failClosed).toBe(true);
  });

  it("covers export, import, portal, intake, AI and copilot paths", async () => {
    vi.resetModules();
    const mod = await import("../../lib/rate-limit");
    const expected: Array<[string, string]> = [
      ["/api/v1/export/bulk", "export"],
      ["/api/v1/import/jobs", "import"],
      ["/api/v1/portal/mailbox", "portal"],
      ["/api/v1/whistleblowing/intake", "intake"],
      ["/api/v1/ai/draft-policy", "ai"],
      ["/api/v1/copilot/conversations/1/messages", "copilot"],
      ["/api/v1/risks", "default"],
    ];
    for (const [path, name] of expected) {
      expect(mod.policyForPath(path)?.name, path).toBe(name);
    }
  });

  it("does not limit non-API paths", async () => {
    vi.resetModules();
    const mod = await import("../../lib/rate-limit");
    expect(mod.policyForPath("/dashboard")).toBeNull();
  });

  it("keys anonymous auth buckets on the address, not the subject", async () => {
    vi.resetModules();
    const mod = await import("../../lib/rate-limit");
    mod.__resetRateLimitState();
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "spoof, 198.51.100.10" },
    });
    let last = await mod.checkRequestRateLimit(
      req,
      "/api/auth/callback/credentials",
      "user-a",
    );
    for (let i = 0; i < 20; i++) {
      last = await mod.checkRequestRateLimit(
        req,
        "/api/auth/callback/credentials",
        `user-${i}`,
      );
    }
    // Same address, different claimed subjects — still one bucket.
    expect(last?.result.allowed).toBe(false);
  });
});
