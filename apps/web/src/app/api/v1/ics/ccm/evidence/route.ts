import { db, ccmEvidence } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/ics/ccm/evidence — List CCM evidence (IMMUTABLE — no POST/PUT/DELETE)
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const conditions = [eq(ccmEvidence.orgId, ctx.orgId)];
  const controlId = searchParams.get("controlId");
  if (controlId) conditions.push(eq(ccmEvidence.controlId, controlId));
  const connectorId = searchParams.get("connectorId");
  if (connectorId) conditions.push(eq(ccmEvidence.connectorId, connectorId));

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(ccmEvidence)
      .where(where)
      .orderBy(desc(ccmEvidence.collectedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(ccmEvidence).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
