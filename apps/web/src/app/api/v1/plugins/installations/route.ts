import { db, pluginInstallation, plugin } from "@grc/db";
import { installPluginSchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// POST /api/v1/plugins/installations — Install a plugin
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = installPluginSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Check if already installed
  const [existing] = await db
    .select()
    .from(pluginInstallation)
    .where(and(
      eq(pluginInstallation.orgId, ctx.orgId),
      eq(pluginInstallation.pluginId, body.data.pluginId),
    ));

  if (existing) {
    return Response.json({ error: "Plugin already installed" }, { status: 409 });
  }

  const [created] = await db
    .insert(pluginInstallation)
    .values({
      orgId: ctx.orgId,
      pluginId: body.data.pluginId,
      config: body.data.config,
      hookBindings: body.data.hookBindings,
      installedBy: ctx.userId,
    })
    .returning();

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/plugins/installations — List installed plugins
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset } = paginate(req);

  const rows = await db
    .select({
      installation: pluginInstallation,
      plugin: {
        id: plugin.id,
        key: plugin.key,
        name: plugin.name,
        version: plugin.version,
        category: plugin.category,
        iconUrl: plugin.iconUrl,
      },
    })
    .from(pluginInstallation)
    .innerJoin(plugin, eq(pluginInstallation.pluginId, plugin.id))
    .where(eq(pluginInstallation.orgId, ctx.orgId))
    .orderBy(desc(pluginInstallation.installedAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pluginInstallation)
    .where(eq(pluginInstallation.orgId, ctx.orgId));

  return Response.json(paginatedResponse(rows, Number(count), page, limit));
}
