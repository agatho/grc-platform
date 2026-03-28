import { db, vendorSlaMeasurement, vendorSlaDefinition } from "@grc/db";
import { createSlaMeasurementSchema, computeSlaMet, computeBreachSeverity } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/tprm/sla-measurements?slaDefinitionId=...
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const slaId = url.searchParams.get("slaDefinitionId");
  const { limit, offset } = paginate(url.searchParams);

  const conditions = [eq(vendorSlaMeasurement.orgId, ctx.orgId)];
  if (slaId) conditions.push(eq(vendorSlaMeasurement.slaDefinitionId, slaId));

  const rows = await db
    .select()
    .from(vendorSlaMeasurement)
    .where(and(...conditions))
    .orderBy(desc(vendorSlaMeasurement.measuredAt))
    .limit(limit)
    .offset(offset);

  return paginatedResponse(rows, rows.length, limit, offset);
}

// POST /api/v1/tprm/sla-measurements
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createSlaMeasurementSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  // Lookup SLA definition to get metric type and target
  const [slaDef] = await db
    .select()
    .from(vendorSlaDefinition)
    .where(eq(vendorSlaDefinition.id, body.data.slaDefinitionId));

  if (!slaDef) return Response.json({ error: "SLA definition not found" }, { status: 404 });

  const targetValue = Number(slaDef.targetValue);
  const isMet = computeSlaMet(slaDef.metricType, body.data.actualValue, targetValue);
  const breachSeverity = computeBreachSeverity(body.data.actualValue, targetValue, isMet);

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(vendorSlaMeasurement)
      .values({
        slaDefinitionId: body.data.slaDefinitionId,
        orgId: ctx.orgId,
        periodStart: body.data.periodStart,
        periodEnd: body.data.periodEnd,
        actualValue: body.data.actualValue.toString(),
        targetValue: targetValue.toString(),
        isMet,
        breachSeverity,
        evidence: body.data.evidence,
        notes: body.data.notes,
        measuredBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
