import { db, cloudComplianceSnapshot } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";

// GET /api/v1/cloud-connectors/snapshots
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(cloudComplianceSnapshot.orgId, ctx.orgId)];

  const provider = searchParams.get("provider");
  if (provider) conditions.push(eq(cloudComplianceSnapshot.provider, provider));

  const connectorId = searchParams.get("connectorId");
  if (connectorId)
    conditions.push(eq(cloudComplianceSnapshot.connectorId, connectorId));

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(cloudComplianceSnapshot)
      .where(where)
      .orderBy(desc(cloudComplianceSnapshot.snapshotDate))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(cloudComplianceSnapshot).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
