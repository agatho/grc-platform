// POST /api/v1/risks/bulk
//
// #WAVE21-B4: Bulk-create risks. Critical Implementation Rule #11
// caps at 100 items per request. Each item is validated against
// `createRiskSchema` and persisted in the same per-item
// `withAuditContext` transaction so each row gets its own audit-log
// hash-chain entry (NOT one for the whole batch).

import { db, risk, workItem, userOrganizationRole } from "@grc/db";
import { createRiskSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { bulkExecute, bulkRequestSchema, type SafeParseable } from "@/lib/bulk";
import type { z } from "zod";

type RiskInput = z.infer<typeof createRiskSchema>;

export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const rawBody = await req.json();
  const envelope = bulkRequestSchema.safeParse(rawBody);
  if (!envelope.success) {
    return Response.json(
      {
        error:
          "Bulk request must be {items: [...]} with at least 1 item (max 100).",
        details: envelope.error.flatten(),
      },
      { status: 422 },
    );
  }

  const result = await bulkExecute<RiskInput, unknown>(
    envelope.data.items,
    createRiskSchema as unknown as SafeParseable<RiskInput>,
    async (data: RiskInput) => {
      // Validate owner is in same org (mirrors POST /risks).
      if (data.ownerId) {
        const [ownerRole] = await db
          .select({ id: userOrganizationRole.userId })
          .from(userOrganizationRole)
          .where(
            and(
              eq(userOrganizationRole.userId, data.ownerId),
              eq(userOrganizationRole.orgId, ctx.orgId),
              isNull(userOrganizationRole.deletedAt),
            ),
          );
        if (!ownerRole) {
          throw new Error(
            `Owner ${data.ownerId} not found in this organization`,
          );
        }
      }

      // Per-item audit-wrapped transaction — one hash-chain entry
      // per row, not one for the batch.
      const created = await withAuditContext(ctx, async (tx) => {
        const [wi] = await tx
          .insert(workItem)
          .values({
            orgId: ctx.orgId,
            typeKey: "single_risk",
            name: data.title,
            status: "draft",
            responsibleId: data.ownerId,
            grcPerspective: ["erm"],
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })
          .returning();

        const inhL = data.inherentLikelihood;
        const inhI = data.inherentImpact;
        const resL = data.residualLikelihood;
        const resI = data.residualImpact;

        const [row] = await tx
          .insert(risk)
          .values({
            orgId: ctx.orgId,
            workItemId: wi.id,
            title: data.title,
            description: data.description,
            riskCategory: data.riskCategory,
            riskSource: data.riskSource,
            ownerId: data.ownerId,
            department: data.department,
            inherentLikelihood: inhL,
            inherentImpact: inhI,
            residualLikelihood: resL,
            residualImpact: resI,
            riskScoreInherent:
              inhL != null && inhI != null ? inhL * inhI : null,
            riskScoreResidual:
              resL != null && resI != null ? resL * resI : null,
            treatmentStrategy: data.treatmentStrategy,
            treatmentRationale: data.treatmentRationale,
            financialImpactMin: data.financialImpactMin,
            financialImpactMax: data.financialImpactMax,
            financialImpactExpected: data.financialImpactExpected,
            reviewDate: data.reviewDate,
            catalogEntryId: data.catalogEntryId,
            catalogSource: data.catalogSource,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })
          .returning();
        return { ...row, elementId: wi.elementId };
      });

      return created;
    },
  );

  return Response.json(result.body, { status: result.status });
});
