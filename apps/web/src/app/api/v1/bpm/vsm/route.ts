import { db, valueStreamMap } from "@grc/db";
import {
  createVsmSchema,
  computeVsmMetrics,
  computeWasteAnalysis,
} from "@grc/shared";
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

// GET /api/v1/bpm/vsm?processId=...
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "process_owner", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const processId = url.searchParams.get("processId");
  const { limit, offset } = paginate(url.searchParams);
  const conditions = [eq(valueStreamMap.orgId, ctx.orgId)];
  if (processId) conditions.push(eq(valueStreamMap.processId, processId));

  const rows = await db
    .select()
    .from(valueStreamMap)
    .where(and(...conditions))
    .orderBy(desc(valueStreamMap.createdAt))
    .limit(limit)
    .offset(offset);
  return paginatedResponse(rows, rows.length, limit, offset);
});
// POST /api/v1/bpm/vsm
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createVsmSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const metrics = computeVsmMetrics(body.data.diagramData.steps);
  const wasteAnalysis = computeWasteAnalysis(body.data.diagramData.steps);

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(valueStreamMap)
      .values({
        orgId: ctx.orgId,
        processId: body.data.processId,
        mapType: body.data.mapType,
        title: body.data.title,
        diagramData: body.data.diagramData,
        totalLeadTimeMinutes: metrics.totalLeadTimeMinutes.toString(),
        totalValueAddMinutes: metrics.totalValueAddMinutes.toString(),
        valueAddRatio: metrics.valueAddRatio.toString(),
        wasteAnalysis,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
