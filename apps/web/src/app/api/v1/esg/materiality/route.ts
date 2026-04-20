import { db, materialityAssessment } from "@grc/db";
import { createMaterialityAssessmentSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const url = new URL(req.url);
  const { limit, offset } = paginate(url.searchParams);
  const rows = await db
    .select()
    .from(materialityAssessment)
    .where(eq(materialityAssessment.orgId, ctx.orgId))
    .orderBy(desc(materialityAssessment.reportingPeriodYear))
    .limit(limit)
    .offset(offset);
  return paginatedResponse(rows, rows.length, limit, offset);
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const body = createMaterialityAssessmentSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(materialityAssessment)
      .values({
        orgId: ctx.orgId,
        reportingPeriodYear: body.data.reportingYear,
        financialThreshold: { scoreThreshold: 50 },
        impactThreshold: { scoreThreshold: 50 },
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });
  return Response.json({ data: created }, { status: 201 });
}
