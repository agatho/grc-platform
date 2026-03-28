import { db, vendorSlaDefinition } from "@grc/db";
import { createSlaDefinitionSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/tprm/sla-definitions?vendorId=...
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const vendorId = url.searchParams.get("vendorId");
  const { limit, offset } = paginate(url.searchParams);

  const conditions = [eq(vendorSlaDefinition.orgId, ctx.orgId)];
  if (vendorId) conditions.push(eq(vendorSlaDefinition.vendorId, vendorId));

  const rows = await db
    .select()
    .from(vendorSlaDefinition)
    .where(and(...conditions))
    .orderBy(desc(vendorSlaDefinition.createdAt))
    .limit(limit)
    .offset(offset);

  return paginatedResponse(rows, rows.length, limit, offset);
}

// POST /api/v1/tprm/sla-definitions
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createSlaDefinitionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(vendorSlaDefinition)
      .values({
        orgId: ctx.orgId,
        vendorId: body.data.vendorId,
        contractId: body.data.contractId,
        metricName: body.data.metricName,
        metricType: body.data.metricType,
        targetValue: body.data.targetValue.toString(),
        unit: body.data.unit,
        measurementPeriod: body.data.measurementPeriod,
        penaltyClause: body.data.penaltyClause,
        evidenceSource: body.data.evidenceSource,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
