import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withAuth, withAuditContext } from "@/lib/api";

// ──────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────

const updateNavPreferencesSchema = z.object({
  pinnedRoutes: z
    .array(z.string().max(200))
    .max(8, "Maximum 8 pinned routes allowed")
    .default([]),
  collapsedGroups: z.array(z.string().max(100)).max(20).default([]),
});

// ──────────────────────────────────────────────────────────────
// GET /api/v1/users/me/nav-preferences
// ──────────────────────────────────────────────────────────────

export async function GET() {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const rows = await db.execute(sql`
    SELECT pinned_routes, collapsed_groups
    FROM "user_nav_preference"
    WHERE user_id = ${ctx.userId}
      AND org_id = ${ctx.orgId}
    LIMIT 1
  `);

  if (!rows[0]) {
    return Response.json({
      data: { pinnedRoutes: [], collapsedGroups: [] },
    });
  }

  const row = rows[0] as Record<string, unknown>;
  return Response.json({
    data: {
      pinnedRoutes: (row.pinned_routes as string[]) ?? [],
      collapsedGroups: (row.collapsed_groups as string[]) ?? [],
    },
  });
}

// ──────────────────────────────────────────────────────────────
// PUT /api/v1/users/me/nav-preferences
// ──────────────────────────────────────────────────────────────

export async function PUT(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const body = updateNavPreferencesSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { pinnedRoutes, collapsedGroups } = body.data;

  const pinnedArray = `{${pinnedRoutes.map((r) => `"${r}"`).join(",")}}`;
  const collapsedArray = `{${collapsedGroups.map((g) => `"${g}"`).join(",")}}`;

  const result = await withAuditContext(ctx, async (tx) => {
    const rows = await tx.execute(sql`
      INSERT INTO "user_nav_preference" (user_id, org_id, pinned_routes, collapsed_groups, updated_at)
      VALUES (${ctx.userId}, ${ctx.orgId}, ${pinnedArray}::text[], ${collapsedArray}::text[], now())
      ON CONFLICT (user_id, org_id)
      DO UPDATE SET
        pinned_routes = ${pinnedArray}::text[],
        collapsed_groups = ${collapsedArray}::text[],
        updated_at = now()
      RETURNING pinned_routes, collapsed_groups
    `);
    return rows[0];
  });

  if (!result) {
    return Response.json(
      { error: "Failed to save preferences" },
      { status: 500 },
    );
  }

  const row = result as Record<string, unknown>;
  return Response.json({
    data: {
      pinnedRoutes: (row.pinned_routes as string[]) ?? [],
      collapsedGroups: (row.collapsed_groups as string[]) ?? [],
    },
  });
}
