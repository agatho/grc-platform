// Sprint 1.3: Module Config Cache — In-memory cache with 5-minute TTL
// Used by requireModule middleware for fast module status lookups.

import { db } from "@grc/db";
import { moduleConfig, moduleDefinition } from "@grc/db";
import { eq, and } from "drizzle-orm";
import type { ModuleKey, ModuleUiStatus } from "@grc/shared";

interface CachedModuleConfig {
  moduleKey: ModuleKey;
  uiStatus: ModuleUiStatus;
  isDataActive: boolean;
  config: Record<string, unknown>;
  enabledAt: string | null;
  licenseTier: string;
  displayNameDe: string;
  displayNameEn: string;
  descriptionDe: string | null;
  descriptionEn: string | null;
  icon: string;
  navPath: string;
  navSection: string;
  navOrder: number;
  requiresModules: ModuleKey[];
}

interface CacheEntry {
  data: CachedModuleConfig;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const cache = new Map<string, CacheEntry>();

function cacheKey(orgId: string, moduleKey: string): string {
  return `${orgId}:${moduleKey}`;
}

/**
 * Get module config for an org+module pair.
 * Returns from cache if fresh, otherwise queries DB and caches the result.
 * Returns null if no config row exists.
 */
export async function get(
  orgId: string,
  moduleKey: ModuleKey,
): Promise<CachedModuleConfig | null> {
  const key = cacheKey(orgId, moduleKey);
  const cached = cache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Cache miss or expired — query DB
  const rows = await db
    .select({
      moduleKey: moduleConfig.moduleKey,
      uiStatus: moduleConfig.uiStatus,
      isDataActive: moduleConfig.isDataActive,
      config: moduleConfig.config,
      enabledAt: moduleConfig.enabledAt,
      licenseTier: moduleConfig.licenseTier,
      displayNameDe: moduleDefinition.displayNameDe,
      displayNameEn: moduleDefinition.displayNameEn,
      descriptionDe: moduleDefinition.descriptionDe,
      descriptionEn: moduleDefinition.descriptionEn,
      icon: moduleDefinition.icon,
      navPath: moduleDefinition.navPath,
      navSection: moduleDefinition.navSection,
      navOrder: moduleDefinition.navOrder,
      requiresModules: moduleDefinition.requiresModules,
    })
    .from(moduleConfig)
    .innerJoin(
      moduleDefinition,
      eq(moduleConfig.moduleKey, moduleDefinition.moduleKey),
    )
    .where(
      and(
        eq(moduleConfig.orgId, orgId),
        eq(moduleConfig.moduleKey, moduleKey),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  const data: CachedModuleConfig = {
    moduleKey: row.moduleKey as ModuleKey,
    uiStatus: row.uiStatus as ModuleUiStatus,
    isDataActive: row.isDataActive,
    config: (row.config ?? {}) as Record<string, unknown>,
    enabledAt: row.enabledAt ? row.enabledAt.toISOString() : null,
    licenseTier: row.licenseTier ?? "included",
    displayNameDe: row.displayNameDe,
    displayNameEn: row.displayNameEn,
    descriptionDe: row.descriptionDe,
    descriptionEn: row.descriptionEn,
    icon: row.icon ?? "",
    navPath: row.navPath ?? "",
    navSection: row.navSection ?? "",
    navOrder: row.navOrder,
    requiresModules: (row.requiresModules ?? []) as ModuleKey[],
  };

  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });

  return data;
}

/**
 * Invalidate cache for a specific org+module pair.
 */
export function invalidate(orgId: string, moduleKey: ModuleKey): void {
  cache.delete(cacheKey(orgId, moduleKey));
}

/**
 * Invalidate all cached module configs for an org.
 */
export function invalidateOrg(orgId: string): void {
  const prefix = `${orgId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear entire cache (used in tests).
 */
export function clearAll(): void {
  cache.clear();
}
