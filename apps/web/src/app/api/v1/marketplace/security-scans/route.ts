import { db, marketplaceSecurityScan } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

// GET /api/v1/marketplace/security-scans?versionId=...
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const versionId = url.searchParams.get("versionId");
  if (!versionId)
    return Response.json({ error: "versionId is required" }, { status: 400 });

  const rows = await db
    .select()
    .from(marketplaceSecurityScan)
    .where(
      and(
        eq(marketplaceSecurityScan.versionId, versionId),
        eq(marketplaceSecurityScan.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(marketplaceSecurityScan.createdAt));

  return Response.json({ data: rows });
}

// POST /api/v1/marketplace/security-scans — trigger a scan
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const schema = z.object({ versionId: z.string().uuid() });
  const body = schema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(marketplaceSecurityScan)
      .values({
        orgId: ctx.orgId,
        versionId: body.versionId,
        scanStatus: "pending",
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
