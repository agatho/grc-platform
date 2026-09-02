import { db, cciConfiguration } from "@grc/db";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateCciConfigurationSchema } from "@grc/shared";
import type { CCIFactorWeights } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/compliance/cci/configuration — Get current CCI config
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const [config] = await db
    .select()
    .from(cciConfiguration)
    .where(eq(cciConfiguration.orgId, ctx.orgId))
    .limit(1);

  if (!config) {
    return Response.json({
      data: {
        factorWeights: {
          task_compliance: 0.2,
          policy_ack_rate: 0.15,
          training_completion: 0.15,
          incident_response_time: 0.2,
          audit_finding_closure: 0.15,
          self_assessment_participation: 0.15,
        },
      },
    });
  }

  return Response.json({ data: config });
});
// PUT /api/v1/compliance/cci/configuration — Update factor weights (admin only)
export const PUT = withErrorHandler(async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = updateCciConfigurationSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [existing] = await tx
      .select()
      .from(cciConfiguration)
      .where(eq(cciConfiguration.orgId, ctx.orgId))
      .limit(1);

    if (existing) {
      const [updated] = await tx
        .update(cciConfiguration)
        .set({
          factorWeights: body.data.factorWeights,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(cciConfiguration.orgId, ctx.orgId))
        .returning();
      return updated;
    } else {
      const [created] = await tx
        .insert(cciConfiguration)
        .values({
          orgId: ctx.orgId,
          factorWeights: body.data.factorWeights,
          updatedBy: ctx.userId,
        })
        .returning();
      return created;
    }
  });

  return Response.json({ data: result });
});
