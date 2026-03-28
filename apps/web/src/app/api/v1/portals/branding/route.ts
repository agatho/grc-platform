import { db, portalBranding } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { upsertPortalBrandingSchema } from "@grc/shared";

// GET /api/v1/portals/branding?portalConfigId=...
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const portalConfigId = url.searchParams.get("portalConfigId");
  if (!portalConfigId) return Response.json({ error: "portalConfigId required" }, { status: 400 });

  const [row] = await db.select().from(portalBranding)
    .where(and(eq(portalBranding.portalConfigId, portalConfigId), eq(portalBranding.orgId, ctx.orgId)));

  return Response.json({ data: row ?? null });
}

// PUT /api/v1/portals/branding — upsert
export async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = upsertPortalBrandingSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [existing] = await tx.select().from(portalBranding)
      .where(and(eq(portalBranding.portalConfigId, body.portalConfigId), eq(portalBranding.orgId, ctx.orgId)));

    if (existing) {
      const [updated] = await tx.update(portalBranding).set({ ...body, updatedAt: new Date() })
        .where(eq(portalBranding.id, existing.id)).returning();
      return updated;
    } else {
      const [created] = await tx.insert(portalBranding).values({ orgId: ctx.orgId, ...body }).returning();
      return created;
    }
  });

  return Response.json({ data: result });
}
