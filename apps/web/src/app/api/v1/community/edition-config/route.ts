import { db, communityEditionConfig } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { upsertCommunityEditionConfigSchema } from "@grc/shared";

// GET /api/v1/community/edition-config
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const [row] = await db.select().from(communityEditionConfig)
    .where(eq(communityEditionConfig.orgId, ctx.orgId));

  return Response.json({ data: row ?? null });
}

// PUT /api/v1/community/edition-config — upsert
export async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = upsertCommunityEditionConfigSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [existing] = await tx.select().from(communityEditionConfig)
      .where(eq(communityEditionConfig.orgId, ctx.orgId));

    if (existing) {
      const [updated] = await tx.update(communityEditionConfig).set({ ...body, updatedAt: new Date() })
        .where(eq(communityEditionConfig.id, existing.id)).returning();
      return updated;
    } else {
      const [created] = await tx.insert(communityEditionConfig).values({ orgId: ctx.orgId, ...body }).returning();
      return created;
    }
  });

  return Response.json({ data: result });
}
