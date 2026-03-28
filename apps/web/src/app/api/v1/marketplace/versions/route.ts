import { db, marketplaceVersion } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createMarketplaceVersionSchema } from "@grc/shared";

// GET /api/v1/marketplace/versions?listingId=...
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const listingId = url.searchParams.get("listingId");
  if (!listingId) return Response.json({ error: "listingId is required" }, { status: 400 });

  const rows = await db.select().from(marketplaceVersion)
    .where(and(eq(marketplaceVersion.listingId, listingId), eq(marketplaceVersion.orgId, ctx.orgId)))
    .orderBy(desc(marketplaceVersion.createdAt));

  return Response.json({ data: rows });
}

// POST /api/v1/marketplace/versions
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createMarketplaceVersionSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(marketplaceVersion).values({
      orgId: ctx.orgId, ...body, createdBy: ctx.userId,
    }).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
