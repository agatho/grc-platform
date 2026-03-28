import { db, maturityAssessment } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateMaturityAssessmentSchema } from "@grc/shared";

// GET /api/v1/maturity/assessments/:id
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const [row] = await db.select().from(maturityAssessment)
    .where(and(eq(maturityAssessment.id, id), eq(maturityAssessment.orgId, ctx.orgId)));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

// PATCH /api/v1/maturity/assessments/:id
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const body = updateMaturityAssessmentSchema.parse(await req.json());
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx.update(maturityAssessment).set({ ...body, updatedAt: new Date() })
      .where(and(eq(maturityAssessment.id, id), eq(maturityAssessment.orgId, ctx.orgId))).returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
