import { db, esgMaterialityAssessment, esgMaterialityTopic } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/esg/materiality/[year] — Get assessment detail with topics
export const GET = withErrorHandler(async function GET(
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
    return Response.json({ error: "Assessment not found" }, { status: 404 });
  }

  const topics = await db
    .select()
    .from(esgMaterialityTopic)
    .where(eq(esgMaterialityTopic.assessmentId, assessment.id));

  return Response.json({ data: { ...assessment, topics } });
});
// PUT /api/v1/esg/materiality/[year] — Update assessment status
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "esg_manager",
    "esg_contributor",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { year } = await params;
  const reportingYear = parseInt(year, 10);
  if (isNaN(reportingYear)) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const { z } = await import("zod");
  const parsed = z
    .object({ status: z.enum(["draft", "in_progress", "completed"]) })
    .safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const { status } = parsed.data;

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
});
