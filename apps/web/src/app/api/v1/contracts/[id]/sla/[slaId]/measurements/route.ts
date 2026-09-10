import {
  db,
  contractSla,
  contractSlaMeasurement,
  toNumericInput,
} from "@grc/db";
import { createSlaMeasurementSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/contracts/:id/sla/:slaId/measurements — Record measurement
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; slaId: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "process_owner",
    "control_owner",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("contract", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { slaId } = await params;

  // Verify SLA exists in org
  const [sla] = await db
    .select({ id: contractSla.id, targetValue: contractSla.targetValue })
    .from(contractSla)
    .where(and(eq(contractSla.id, slaId), eq(contractSla.orgId, ctx.orgId)));
  if (!sla) {
    return Response.json({ error: "SLA not found" }, { status: 404 });
  }

  const body = createSlaMeasurementSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(contractSlaMeasurement)
      .values({
        slaId,
        orgId: ctx.orgId,
        periodStart: body.data.periodStart,
        periodEnd: body.data.periodEnd,
        actualValue: toNumericInput(body.data.actualValue),
        isBreach: body.data.isBreach,
        notes: body.data.notes,
        measuredBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
// GET /api/v1/contracts/:id/sla/:slaId/measurements — List measurements
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; slaId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("contract", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { slaId } = await params;

  const rows = await db
    .select()
    .from(contractSlaMeasurement)
    .where(
      and(
        eq(contractSlaMeasurement.slaId, slaId),
        eq(contractSlaMeasurement.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(contractSlaMeasurement.periodStart));

  return Response.json({ data: rows });
});
