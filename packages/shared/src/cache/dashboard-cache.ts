// Sprint 27: Dashboard Cache Layer — Redis-based getOrCompute cache
// Cache keys include org_id to ensure cross-org cache access is impossible.
// Pattern: cache:org:{orgId}:dashboard:{type}

export interface CacheAdapter {
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<void>;
  del(...keys: string[]): Promise<void>;
  keys(pattern: string): Promise<string[]>;
  info(section?: string): Promise<string>;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  invalidations: number;
}

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

export class DashboardCache {
  private adapter: CacheAdapter;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0,
  };

  constructor(adapter: CacheAdapter) {
    this.adapter = adapter;
  }

  /**
   * Build a cache key following the org-scoped pattern.
   */
  static buildKey(orgId: string, dashboardType: string): string {
    return `cache:org:${orgId}:dashboard:${dashboardType}`;
  }

  /**
   * Get cached value or compute and cache it.
   */
  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): Promise<T> {
    const cached = await this.adapter.get(key);
    if (cached !== null) {
      this.metrics.hits++;
      return JSON.parse(cached) as T;
    }

    this.metrics.misses++;
    const result = await compute();
    await this.adapter.setex(key, ttlSeconds, JSON.stringify(result));
    this.metrics.sets++;
    return result;
  }

  /**
   * Invalidate all cache keys for a specific organization.
   */
  async invalidateForOrg(orgId: string): Promise<number> {
    const pattern = `cache:org:${orgId}:*`;
    const keys = await this.adapter.keys(pattern);
    if (keys.length > 0) {
      await this.adapter.del(...keys);
    }
    this.metrics.invalidations += keys.length;
    return keys.length;
  }

  /**
   * Invalidate a specific dashboard cache key.
   */
  async invalidateKey(key: string): Promise<void> {
    await this.adapter.del(key);
    this.metrics.invalidations++;
  }

  /**
   * Invalidate a specific dashboard type for an org.
   */
  async invalidateDashboard(
    orgId: string,
    dashboardType: string,
  ): Promise<void> {
    const key = DashboardCache.buildKey(orgId, dashboardType);
    await this.invalidateKey(key);
  }

  /**
   * Get current cache metrics (hits, misses, etc.).
   */
  getMetrics(): CacheMetrics & { hitRate: number } {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate:
        total > 0 ? Math.round((this.metrics.hits / total) * 10000) / 100 : 0,
    };
  }

  /**
   * Reset metrics counters.
   */
  resetMetrics(): void {
    this.metrics = { hits: 0, misses: 0, sets: 0, invalidations: 0 };
  }

  /**
   * Get cache stats from Redis (memory, key count).
   */
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsedMb: number;
  }> {
    const keys = await this.adapter.keys("cache:org:*");
    let memoryUsedMb = 0;
    try {
      const info = await this.adapter.info("memory");
      const match = info.match(/used_memory:(\d+)/);
      if (match) {
        memoryUsedMb =
          Math.round((parseInt(match[1], 10) / 1024 / 1024) * 100) / 100;
      }
    } catch {
      // Redis info may not be available in all setups
    }
    return {
      totalKeys: keys.length,
      memoryUsedMb,
    };
  }
}
