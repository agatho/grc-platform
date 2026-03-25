// PUT /api/v1/organizations/:id/modules/:key — Enable/disable/configure a module
// Admin only. Validates dependencies on enable, cascade check on disable.

import {
  db,
  moduleConfig,
  moduleDefinition,
  notification,
  userOrganizationRole,
} from "@grc/db";
import { eq, and, sql, inArray, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  updateModuleConfigSchema,
  MODULE_KEYS,
  type ModuleKey,
  type ModuleUiStatus,
} from "@grc/shared";
import { moduleConfigCache } from "@grc/auth";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; key: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id, key } = await params;

  // Verify the requested org matches the user's current org context
  if (id !== ctx.orgId) {
    return Response.json(
      { error: "Organization mismatch" },
      { status: 403 },
    );
  }

  // Validate moduleKey is a known key
  if (!MODULE_KEYS.includes(key as ModuleKey)) {
    return Response.json(
      { error: `Unknown module key: '${key}'` },
      { status: 400 },
    );
  }

  const moduleKey = key as ModuleKey;

  // Validate request body
  const rawBody = await req.json();
  const result = updateModuleConfigSchema.safeParse(rawBody);
  if (!result.success) {
    return Response.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 422 },
    );
  }

  const body = result.data;

  // Verify module_definition exists for this key
  const definitions = await db
    .select()
    .from(moduleDefinition)
    .where(eq(moduleDefinition.moduleKey, moduleKey))
    .limit(1);

  if (definitions.length === 0) {
    return Response.json(
      { error: `Module definition not found: '${moduleKey}'` },
      { status: 404 },
    );
  }

  const definition = definitions[0];

  // ── Dependency validation on enable ──
  if (body.uiStatus === "enabled" || body.uiStatus === "preview") {
    const requiredModules = (definition.requiresModules ?? []) as ModuleKey[];

    if (requiredModules.length > 0) {
      // Get all module configs for the required modules in this org
      const depConfigs = await db
        .select({
          moduleKey: moduleConfig.moduleKey,
          uiStatus: moduleConfig.uiStatus,
        })
        .from(moduleConfig)
        .where(
          and(
            eq(moduleConfig.orgId, id),
            inArray(moduleConfig.moduleKey, requiredModules),
          ),
        );

      const enabledDeps = new Set(
        depConfigs
          .filter((c) => c.uiStatus === "enabled")
          .map((c) => c.moduleKey),
      );

      for (const reqKey of requiredModules) {
        if (!enabledDeps.has(reqKey)) {
          return Response.json(
            {
              error: `Dependency not met: module '${reqKey}' must be enabled first`,
            },
            { status: 400 },
          );
        }
      }
    }
  }

  // ── Cascade check on disable ──
  if (body.uiStatus === "disabled" || body.uiStatus === "maintenance") {
    // Find all module_definitions that require this module
    const allDefs = await db.select().from(moduleDefinition);

    const dependentKeys: ModuleKey[] = [];
    for (const def of allDefs) {
      const reqs = (def.requiresModules ?? []) as ModuleKey[];
      if (reqs.includes(moduleKey)) {
        dependentKeys.push(def.moduleKey as ModuleKey);
      }
    }

    if (dependentKeys.length > 0) {
      // Check which of these dependent modules are active in this org
      const activeDepConfigs = await db
        .select({
          moduleKey: moduleConfig.moduleKey,
          uiStatus: moduleConfig.uiStatus,
        })
        .from(moduleConfig)
        .where(
          and(
            eq(moduleConfig.orgId, id),
            inArray(moduleConfig.moduleKey, dependentKeys),
          ),
        );

      const activeDeps = activeDepConfigs
        .filter(
          (c) => c.uiStatus === "enabled" || c.uiStatus === "preview",
        )
        .map((c) => c.moduleKey);

      if (activeDeps.length > 0) {
        return Response.json(
          {
            error: `Cannot disable '${moduleKey}' — the following modules depend on it: ${activeDeps.join(", ")}`,
          },
          { status: 400 },
        );
      }
    }
  }

  // ── Perform the update inside audit context ──
  const updated = await withAuditContext(ctx, async (tx) => {
    // Build SET clause dynamically
    const setClauses: Record<string, unknown> = {
      updatedAt: sql`now()`,
      updatedBy: ctx.userId,
    };

    if (body.uiStatus !== undefined) {
      setClauses.uiStatus = body.uiStatus;
    }

    if (body.config !== undefined) {
      setClauses.config = body.config;
    }

    // Set enabled/disabled timestamps
    if (body.uiStatus === "enabled" || body.uiStatus === "preview") {
      setClauses.enabledAt = sql`now()`;
      setClauses.enabledBy = ctx.userId;
    }

    if (body.uiStatus === "disabled" || body.uiStatus === "maintenance") {
      setClauses.disabledAt = sql`now()`;
      setClauses.disabledBy = ctx.userId;
    }

    const rows = await tx
      .update(moduleConfig)
      .set(setClauses)
      .where(
        and(
          eq(moduleConfig.orgId, id),
          eq(moduleConfig.moduleKey, moduleKey),
        ),
      )
      .returning();

    return rows[0] ?? null;
  });

  if (!updated) {
    return Response.json(
      { error: "Module config not found for this organization" },
      { status: 404 },
    );
  }

  // ── Invalidate cache for this org ──
  moduleConfigCache.invalidateOrg(id);

  // ── Create notification for all admins in org ──
  if (body.uiStatus !== undefined) {
    const displayName = definition.displayNameEn;
    const action =
      body.uiStatus === "enabled" || body.uiStatus === "preview"
        ? "enabled"
        : body.uiStatus === "disabled"
          ? "disabled"
          : "set to maintenance";
    const userName = ctx.session.user.name ?? ctx.session.user.email ?? "Admin";

    // Find all admin user IDs in this org
    const adminRoles = await db
      .select({ userId: userOrganizationRole.userId })
      .from(userOrganizationRole)
      .where(
        and(
          eq(userOrganizationRole.orgId, id),
          eq(userOrganizationRole.role, "admin"),
          isNull(userOrganizationRole.deletedAt),
        ),
      );

    const adminUserIds = [...new Set(adminRoles.map((r) => r.userId))];

    if (adminUserIds.length > 0) {
      const notifRows = adminUserIds.map((userId) => ({
        userId,
        orgId: id,
        type: "status_change" as const,
        entityType: "module_config",
        title: `${displayName} was ${action} by ${userName}`,
        message: `Module '${displayName}' status changed to '${body.uiStatus}'.`,
        createdBy: ctx.userId,
      }));

      await db.insert(notification).values(notifRows);
    }
  }

  return Response.json({ data: updated });
}
