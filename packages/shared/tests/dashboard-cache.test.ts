import { describe, it, expect, beforeEach } from "vitest";
import { DashboardCache } from "../src/cache/dashboard-cache";
import type { CacheAdapter } from "../src/cache/dashboard-cache";

function createMockAdapter(): CacheAdapter & { store: Map<string, { value: string; ttl: number }> } {
  const store = new Map<string, { value: string; ttl: number }>();
  return {
    store,
    async get(key: string): Promise<string | null> {
      const entry = store.get(key);
      return entry?.value ?? null;
    },
    async setex(key: string, ttl: number, value: string): Promise<void> {
      store.set(key, { value, ttl });
    },
    async del(...keys: string[]): Promise<void> {
      for (const key of keys) {
        store.delete(key);
      }
    },
    async keys(pattern: string): Promise<string[]> {
      const prefix = pattern.replace("*", "");
      return Array.from(store.keys()).filter((k) => k.startsWith(prefix));
    },
    async info(): Promise<string> {
      return "used_memory:1048576\r\n";
    },
  };
}

describe("DashboardCache", () => {
  let adapter: ReturnType<typeof createMockAdapter>;
  let cache: DashboardCache;

  beforeEach(() => {
    adapter = createMockAdapter();
    cache = new DashboardCache(adapter);
  });

  it("should cache computed result", async () => {
    let callCount = 0;
    const compute = async () => {
      callCount++;
      return { score: 76 };
    };

    const result1 = await cache.getOrCompute("test-key", compute, 300);
    const result2 = await cache.getOrCompute("test-key", compute, 300);

    expect(callCount).toBe(1); // second call served from cache
    expect(result1).toEqual({ score: 76 });
    expect(result2).toEqual({ score: 76 });
  });

  it("should track cache metrics", async () => {
    await cache.getOrCompute("k1", async () => "v1");
    await cache.getOrCompute("k1", async () => "v1");
    await cache.getOrCompute("k2", async () => "v2");

    const metrics = cache.getMetrics();
    expect(metrics.hits).toBe(1);
    expect(metrics.misses).toBe(2);
    expect(metrics.sets).toBe(2);
    expect(metrics.hitRate).toBeCloseTo(33.33, 0);
  });

  it("should invalidate all keys for org", async () => {
    await cache.getOrCompute("cache:org:org1:dashboard:erm", async () => ({ data: 1 }));
    await cache.getOrCompute("cache:org:org1:dashboard:ics", async () => ({ data: 2 }));
    await cache.getOrCompute("cache:org:org2:dashboard:erm", async () => ({ data: 3 }));

    const removed = await cache.invalidateForOrg("org1");
    expect(removed).toBe(2);

    // org1 keys should be gone
    expect(adapter.store.has("cache:org:org1:dashboard:erm")).toBe(false);
    expect(adapter.store.has("cache:org:org1:dashboard:ics")).toBe(false);
    // org2 keys should remain
    expect(adapter.store.has("cache:org:org2:dashboard:erm")).toBe(true);
  });

  it("should invalidate specific key", async () => {
    await cache.getOrCompute("my-key", async () => "value");
    expect(adapter.store.has("my-key")).toBe(true);

    await cache.invalidateKey("my-key");
    expect(adapter.store.has("my-key")).toBe(false);
  });

  it("should build correct cache key", () => {
    expect(DashboardCache.buildKey("org123", "erm")).toBe(
      "cache:org:org123:dashboard:erm",
    );
  });

  it("should reset metrics", async () => {
    await cache.getOrCompute("k", async () => "v");
    cache.resetMetrics();
    const metrics = cache.getMetrics();
    expect(metrics.hits).toBe(0);
    expect(metrics.misses).toBe(0);
    expect(metrics.sets).toBe(0);
  });

  it("should get cache stats from adapter", async () => {
    await cache.getOrCompute("cache:org:a:dashboard:x", async () => "v");
    const stats = await cache.getStats();
    expect(stats.totalKeys).toBe(1);
    expect(stats.memoryUsedMb).toBeCloseTo(1, 0);
  });
});
