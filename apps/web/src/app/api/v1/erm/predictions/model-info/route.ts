import { db, auditRiskPredictionModel } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/erm/predictions/model-info — Model version, accuracy, features
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const [model] = await db
    .select()
    .from(auditRiskPredictionModel)
    .where(eq(auditRiskPredictionModel.orgId, ctx.orgId))
    .orderBy(desc(auditRiskPredictionModel.trainedAt))
    .limit(1);

  if (!model) {
    return Response.json({
      data: {
        version: "v1.0-default",
        algorithm: "linear_regression",
        featureImportance: {
          score_trend: 0.35,
          kri_momentum: 0.28,
          incident_frequency: 0.15,
          finding_backlog: 0.12,
          control_effectiveness: -0.2,
          days_since_review: 0.1,
        },
        trainingMetrics: null,
        message:
          "Using default model weights. Train a custom model for better accuracy.",
      },
    });
  }

  return Response.json({ data: model });
}
