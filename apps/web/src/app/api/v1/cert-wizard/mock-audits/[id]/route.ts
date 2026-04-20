import { db, certMockAudit } from "@grc/db";
import { updateCertMockAuditSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const [row] = await db
    .select()
    .from(certMockAudit)
    .where(and(eq(certMockAudit.id, id), eq(certMockAudit.orgId, ctx.orgId)));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = updateCertMockAuditSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  const updateData: Record<string, unknown> = {
    ...body.data,
    updatedAt: new Date(),
  };
  if (body.data.responses) {
    updateData.answeredQuestions = body.data.responses.length;
    const scores = body.data.responses
      .filter((r) => r.aiScore !== undefined)
      .map((r) => r.aiScore!);
    if (scores.length > 0)
      updateData.overallScore = (
        scores.reduce((a, b) => a + b, 0) / scores.length
      ).toFixed(2);
  }
  if (body.data.status === "in_progress" && !updateData.startedAt)
    updateData.startedAt = new Date();
  if (body.data.status === "completed") updateData.completedAt = new Date();

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(certMockAudit)
      .set(updateData)
      .where(and(eq(certMockAudit.id, id), eq(certMockAudit.orgId, ctx.orgId)))
      .returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
