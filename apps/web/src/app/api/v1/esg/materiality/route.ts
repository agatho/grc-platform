import { db, esgMaterialityAssessment } from "@grc/db";
import { createMaterialityAssessmentSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc, count } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// POST /api/v1/esg/materiality — Create materiality assessment for year
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createMaterialityAssessmentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Check for existing assessment for this year
  const [existing] = await db
    .select({ id: esgMaterialityAssessment.id })
    .from(esgMaterialityAssessment)
    .where(
      and(
        eq(esgMaterialityAssessment.orgId, ctx.orgId),
        eq(esgMaterialityAssessment.reportingYear, body.data.reportingYear),
      ),
    );

  if (existing) {
    return Response.json(
      { error: "Assessment already exists for this reporting year" },
      { status: 409 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(esgMaterialityAssessment)
      .values({
        orgId: ctx.orgId,
        reportingYear: body.data.reportingYear,
        status: "draft",
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/esg/materiality — List all materiality assessments
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);

  const where = eq(esgMaterialityAssessment.orgId, ctx.orgId);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(esgMaterialityAssessment)
      .where(where)
      .orderBy(desc(esgMaterialityAssessment.reportingYear))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(esgMaterialityAssessment).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
