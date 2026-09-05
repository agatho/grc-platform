import { db } from "@grc/db";
import { assetScanSchema } from "@grc/shared";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/mobile/scan — Scan QR/Barcode to look up asset
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const body = assetScanSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Look up asset by scan data (element_id or custom barcode field)
  const result = await db.execute(
    sql`SELECT a.* FROM asset a
        WHERE a.org_id = ${ctx.orgId}
        AND (a.element_id = ${body.data.scanData}
             OR a.metadata->>'barcode' = ${body.data.scanData}
             OR a.id::text = ${body.data.scanData})
        LIMIT 1`,
  );

  if (result.length === 0) {
    return Response.json(
      { error: "Asset not found for scan data" },
      { status: 404 },
    );
  }

  return Response.json({ data: result[0] });
});
