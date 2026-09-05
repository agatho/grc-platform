import { db, marketplaceSecurityScan } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/marketplace/security-scans?versionId=...
export const GET = withErrorHandler(async function GET(req: Request) {
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
});
// POST /api/v1/marketplace/security-scans — trigger a scan
export const POST = withErrorHandler(async function POST(req: Request) {
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
});
