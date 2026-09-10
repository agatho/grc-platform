// GET /api/v1/organizations/:id/modules — List all module configs for an org
// All roles can read; module_config JOIN module_definition, sorted by nav_order.

import { db, moduleConfig, moduleDefinition } from "@grc/db";
import { eq, asc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import type { ModuleConfig, ModuleKey, ModuleUiStatus } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] `withErrorHandler` is what opens the
// `requestDbStorage.run(...)` frame that `withAuth` -> establishRequestScopedContext
// mutates with the org-pinned connection (apps/web/src/lib/api-wrapper.ts:113).
// Without it that helper falls back to `requestDbStorage.enterWith(...)`, which
// Next drops across the `await` in withAuth (api.ts:184-196), the handler's
// queries run on the context-less base pool, and RLS filters every row — the
// route answers 200 with an EMPTY list instead of the tenant's data.
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Use the requested org if the user has access, otherwise fall back to current org
  const targetOrgId = id === ctx.orgId ? id : ctx.orgId;

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
    .where(eq(moduleConfig.orgId, targetOrgId))
    .orderBy(asc(moduleDefinition.navOrder));

  const data: ModuleConfig[] = rows.map((row) => ({
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
  }));

  return Response.json({ data });
});
