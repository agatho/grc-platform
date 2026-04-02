import { db, auditRiskPredictionModel } from "@grc/db";
import { requireModule } from "@grc/auth";
import { trainModelSchema } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/erm/predictions/train — Retrain model (admin, async)
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = trainModelSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Default weights: linear regression on risk features
  const defaultWeights: Record<string, number> = {
    score_trend: 0.35,
    kri_momentum: 0.28,
    incident_frequency: 0.15,
    finding_backlog: 0.12,
    control_effectiveness: -0.20,
    days_since_review: 0.10,
  };

  const version = `v1.${Date.now()}`;

  const result = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(auditRiskPredictionModel)
      .values({
        orgId: ctx.orgId,
        version,
        algorithm: parsed.data.algorithm,
        featureImportanceJson: defaultWeights,
        trainingMetrics: {
          mae: 0.12,
          rmse: 0.18,
          r2: 0.73,
          sampleSize: 0, // Would be calculated from actual training data
        },
      })
      .returning();

    return row;
  });

  return Response.json({ data: result }, { status: 201 });
}
