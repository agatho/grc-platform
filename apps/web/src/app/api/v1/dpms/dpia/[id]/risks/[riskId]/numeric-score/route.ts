import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const numericScoreSchema = z.object({
  numericLikelihood: z.number().int().min(1).max(5),
  numericImpact: z.number().int().min(1).max(5),
});

/**
 * PATCH /api/v1/dpms/dpia/:id/risks/:riskId/numeric-score
 * Updates the numeric_likelihood and numeric_impact on a dpia_risk row.
 * risk_score is a GENERATED ALWAYS column in Postgres, so it auto-computes.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; riskId: string }> },
) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: dpiaId, riskId } = await params;

  const body = numericScoreSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validierung fehlgeschlagen", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { numericLikelihood, numericImpact } = body.data;

  // Verify the risk belongs to the DPIA and org
  const existing = await db.execute(sql`
    SELECT dr.id
    FROM dpia_risk dr
    JOIN dpia d ON d.id = dr.dpia_id AND d.org_id = ${ctx.orgId}
    WHERE dr.id = ${riskId}::uuid
      AND dr.dpia_id = ${dpiaId}::uuid
      AND dr.org_id = ${ctx.orgId}
    LIMIT 1
  `);

  if (!(existing as unknown as unknown[])?.length) {
    return Response.json(
      { error: "DSFA-Risiko nicht gefunden" },
      { status: 404 },
    );
  }

  // Update numeric scores (risk_score is GENERATED ALWAYS, auto-updates)
  await withAuditContext(ctx, async (tx) => {
    await tx.execute(sql`
      UPDATE dpia_risk
      SET numeric_likelihood = ${numericLikelihood},
          numeric_impact = ${numericImpact}
      WHERE id = ${riskId}::uuid AND org_id = ${ctx.orgId}
    `);
  });

  const computedScore = numericLikelihood * numericImpact;

  return Response.json({
    data: {
      id: riskId,
      numericLikelihood,
      numericImpact,
      riskScore: computedScore,
    },
  });
}
