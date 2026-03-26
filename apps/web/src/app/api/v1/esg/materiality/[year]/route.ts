import {
  db,
  esgMaterialityAssessment,
  esgMaterialityTopic,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/esg/materiality/[year] — Get assessment detail with topics
export async function GET(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { year } = await params;
  const reportingYear = parseInt(year, 10);
  if (isNaN(reportingYear)) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const [assessment] = await db
    .select()
    .from(esgMaterialityAssessment)
    .where(
      and(
        eq(esgMaterialityAssessment.orgId, ctx.orgId),
        eq(esgMaterialityAssessment.reportingYear, reportingYear),
      ),
    );

  if (!assessment) {
    return Response.json(
      { error: "Assessment not found" },
      { status: 404 },
    );
  }

  const topics = await db
    .select()
    .from(esgMaterialityTopic)
    .where(eq(esgMaterialityTopic.assessmentId, assessment.id));

  return Response.json({ data: { ...assessment, topics } });
}

// PUT /api/v1/esg/materiality/[year] — Update assessment status
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { year } = await params;
  const reportingYear = parseInt(year, 10);
  if (isNaN(reportingYear)) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const body = await req.json();
  const status = body.status;
  if (!["draft", "in_progress", "completed"].includes(status)) {
    return Response.json({ error: "Invalid status" }, { status: 422 });
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(esgMaterialityAssessment)
      .set({
        status,
        startedAt: status === "in_progress" ? new Date() : undefined,
        completedAt: status === "completed" ? new Date() : undefined,
      })
      .where(
        and(
          eq(esgMaterialityAssessment.orgId, ctx.orgId),
          eq(esgMaterialityAssessment.reportingYear, reportingYear),
        ),
      )
      .returning();

    if (!row) {
      return null;
    }
    return row;
  });

  if (!updated) {
    return Response.json({ error: "Assessment not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}
