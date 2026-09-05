// Sprint 1.3: Module Config Cache — In-memory cache with 5-minute TTL
// Used by requireModule middleware for fast module status lookups.

import { withOrgReadContext } from "@grc/db";
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

  // Cache miss or expired — query DB.
  //
  // #SEC-CTXLESS-ORG: `module_config` is org-scoped and RLS-protected (policy
  // `rls_module_config` casts `current_setting('app.current_org_id')::uuid`
  // WITHOUT a NULLIF guard). requireModule runs early in the request pipeline
  // and this read must NOT depend on whether the ambient request-scoped RLS
  // context happens to be established yet — otherwise, under the non-superuser
  // runtime role `grc_app`, a context-less read matches no policy, returns 0
  // rows silently, and requireModule answers a bogus 404 for an enabled module.
  // We know the orgId (it is passed to requireModule), so we pin it on a
  // dedicated reserved connection for exactly this read. (`moduleDefinition` is
  // a global, non-RLS table; only the `module_config` side needs the context.)
  const rows = await withOrgReadContext(orgId, (rdb) =>
    rdb
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
      .limit(1),
  );

  if (rows.length === 0) {
    return null;
  }

  // [OP-065] `rows.length === 0` steht direkt darüber, danach wurden sechzehn
  // Felder von `rows[0]` gelesen. Die Prüfung des Werts statt der Länge macht
  // aus derselben Aussage eine, die der Compiler mitträgt — und `null` ist
  // genau das, was diese Funktion für „kein Datensatz" ohnehin liefert.
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
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
