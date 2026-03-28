import { db } from "@grc/db";
import { assetScanSchema } from "@grc/shared";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/mobile/scan — Scan QR/Barcode to look up asset
export async function POST(req: Request) {
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

  if (result.rows.length === 0) {
    return Response.json({ error: "Asset not found for scan data" }, { status: 404 });
  }

  return Response.json({ data: result.rows[0] });
}
