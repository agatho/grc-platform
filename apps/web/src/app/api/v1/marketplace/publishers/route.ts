import { db, marketplacePublisher } from "@grc/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createMarketplacePublisherSchema } from "@grc/shared";

// GET /api/v1/marketplace/publishers
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const rows = await db.select().from(marketplacePublisher)
    .where(eq(marketplacePublisher.orgId, ctx.orgId))
    .orderBy(desc(marketplacePublisher.createdAt));

  return Response.json({ data: rows });
}

// POST /api/v1/marketplace/publishers
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createMarketplacePublisherSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(marketplacePublisher).values({
      orgId: ctx.orgId, ...body, createdBy: ctx.userId,
    }).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
