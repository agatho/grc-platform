// Tests for the in-memory rate-limit token bucket helper.
// Bezug: apps/web/src/lib/rate-limit.ts (ADR-019 Phase 1)

import { describe, it, expect, beforeEach, vi } from "vitest";

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

describe("getClientIp", () => {
  let getClientIp: typeof import("../../lib/rate-limit").getClientIp;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../lib/rate-limit");
    getClientIp = mod.getClientIp;
  });

  it("returns first entry from X-Forwarded-For", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("203.0.113.1");
  });

  it("falls back to X-Real-IP if X-Forwarded-For absent", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-real-ip": "198.51.100.5" },
    });
    expect(getClientIp(req)).toBe("198.51.100.5");
  });

  it("returns 'unknown' when no headers present", () => {
    const req = new Request("http://localhost/");
    expect(getClientIp(req)).toBe("unknown");
  });

  it("trims whitespace from forwarded IP", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "   203.0.113.1   " },
    });
    expect(getClientIp(req)).toBe("203.0.113.1");
  });
});
