import { db, marketplacePublisher } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateMarketplacePublisherSchema } from "@grc/shared";

// GET /api/v1/marketplace/publishers/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const [row] = await db
    .select()
    .from(marketplacePublisher)
    .where(
      and(
        eq(marketplacePublisher.id, id),
        eq(marketplacePublisher.orgId, ctx.orgId),
      ),
    );
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

// PATCH /api/v1/marketplace/publishers/:id
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = updateMarketplacePublisherSchema.parse(await req.json());
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(marketplacePublisher)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(
          eq(marketplacePublisher.id, id),
          eq(marketplacePublisher.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
