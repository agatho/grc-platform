import { db, processKpiDefinition } from "@grc/db";
import { createKpiDefinitionSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/bpm/kpis?processId=...
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "process_owner", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const processId = url.searchParams.get("processId");
  const { limit, offset } = paginate(url.searchParams);
  const conditions = [eq(processKpiDefinition.orgId, ctx.orgId)];
  if (processId) conditions.push(eq(processKpiDefinition.processId, processId));

  const rows = await db
    .select()
    .from(processKpiDefinition)
    .where(and(...conditions))
    .orderBy(desc(processKpiDefinition.createdAt))
    .limit(limit)
    .offset(offset);
  return paginatedResponse(rows, rows.length, limit, offset);
});
// POST /api/v1/bpm/kpis
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createKpiDefinitionSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(processKpiDefinition)
      .values({
        orgId: ctx.orgId,
        processId: body.data.processId,
        name: body.data.name,
        metricType: body.data.metricType,
        unit: body.data.unit,
        targetValue: body.data.targetValue.toString(),
        thresholdGreen: body.data.thresholdGreen.toString(),
        thresholdYellow: body.data.thresholdYellow.toString(),
        measurementPeriod: body.data.measurementPeriod,
        dataSource: body.data.dataSource,
        apiConfig: body.data.apiConfig,
        ownerId: body.data.ownerId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
