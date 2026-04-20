import { db, riskAnomalyDetection } from "@grc/db";
import { updateAnomalySchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/predictive-risk/anomalies/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const [anomaly] = await db
    .select()
    .from(riskAnomalyDetection)
    .where(
      and(
        eq(riskAnomalyDetection.id, id),
        eq(riskAnomalyDetection.orgId, ctx.orgId),
      ),
    );

  if (!anomaly) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: anomaly });
}

// PATCH /api/v1/predictive-risk/anomalies/:id — Update status
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = updateAnomalySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const isResolved =
    body.data.status === "resolved" || body.data.status === "false_positive";

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(riskAnomalyDetection)
      .set({
        status: body.data.status,
        resolutionNote: body.data.resolutionNote,
        resolvedBy: isResolved ? ctx.userId : undefined,
        resolvedAt: isResolved ? new Date() : undefined,
      })
      .where(
        and(
          eq(riskAnomalyDetection.id, id),
          eq(riskAnomalyDetection.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
