// POST /api/v1/assets/[id]/classification-override
//
// #WAVE21-MAR-P2-03: operator creates a manual override of one
// classification field on an asset whose value would otherwise be
// derived from the BIA cascade.
//
// Hybrid approval-flow per the design call:
//   requestApproval = false → Light path: status='active' immediately;
//                              the override wins over the BIA value at
//                              read time.
//   requestApproval = true  → Strict path: status='pending_approval';
//                              BIA-derived value stays authoritative
//                              until an approver clicks /approve. A
//                              notification fires to the asset's
//                              risk_manager / ciso pool.

import {
  db,
  asset,
  assetClassification,
  assetClassificationOverride,
  notification,
  userOrganizationRole,
} from "@grc/db";
import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

type RouteParams = { params: Promise<{ id: string }> };

const ALLOWED_FIELDS = [
  "confidentialityLevel",
  "integrityLevel",
  "availabilityLevel",
  "overallProtection",
] as const;

const PROTECTION_LEVELS = ["normal", "high", "very_high"] as const;

const createOverrideSchema = z.object({
  fieldName: z.enum(ALLOWED_FIELDS),
  overrideValue: z.enum(PROTECTION_LEVELS),
  reason: z.string().min(20, "reason must be at least 20 characters"),
  requestApproval: z.boolean().default(false),
});

export const POST = withErrorHandler<RouteParams>(async function POST(
  req: Request,
  { params },
) {
  const { id } = await params;
  requireUuidParam(id);
  const ctx = await withAuth("admin", "risk_manager", "ciso", "control_owner");
  if (ctx instanceof Response) return ctx;

  const body = createOverrideSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify asset belongs to caller's org. Avoids leaking via RLS that
  // an asset exists in another org by treating cross-org with a
  // generic 404.
  const [assetRow] = await db
    .select({ id: asset.id })
    .from(asset)
    .where(
      and(
        eq(asset.id, id),
        eq(asset.orgId, ctx.orgId),
        isNull(asset.deletedAt),
      ),
    );
  if (!assetRow) {
    return Response.json({ error: "Asset not found" }, { status: 404 });
  }

  // Snapshot the current BIA-derived value so the override audit-trail
  // shows what the operator was correcting. The cascade writes into
  // asset_classification, so reading from there gets the live derived
  // value.
  const [classificationRow] = await db
    .select({
      confidentialityLevel: assetClassification.confidentialityLevel,
      integrityLevel: assetClassification.integrityLevel,
      availabilityLevel: assetClassification.availabilityLevel,
      overallProtection: assetClassification.overallProtection,
    })
    .from(assetClassification)
    .where(
      and(
        eq(assetClassification.assetId, id),
        eq(assetClassification.orgId, ctx.orgId),
      ),
    );

  // If no classification exists yet (BIA never ran), the derived value
  // is the column default (`normal`). Snapshot that so the audit trail
  // is consistent.
  const derivedValue = classificationRow
    ? ((classificationRow as Record<string, string>)[body.data.fieldName] ??
      "normal")
    : "normal";

  const initialStatus = body.data.requestApproval
    ? ("pending_approval" as const)
    : ("active" as const);

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(assetClassificationOverride)
      .values({
        orgId: ctx.orgId,
        assetId: id,
        fieldName: body.data.fieldName,
        derivedValue,
        overrideValue: body.data.overrideValue,
        reason: body.data.reason,
        requestApproval: body.data.requestApproval,
        status: initialStatus,
        createdBy: ctx.userId,
      })
      .returning();

    // Strict path: notify the org's risk_manager + ciso pool that an
    // approval is pending. Light path skips this (operator already
    // knows what they did).
    if (body.data.requestApproval) {
      const approvers = await tx
        .select({ userId: userOrganizationRole.userId })
        .from(userOrganizationRole)
        .where(
          and(
            eq(userOrganizationRole.orgId, ctx.orgId),
            inArray(userOrganizationRole.role, [
              "admin",
              "risk_manager",
              "ciso",
            ]),
            isNull(userOrganizationRole.deletedAt),
          ),
        );

      if (approvers.length > 0) {
        await tx.insert(notification).values(
          approvers.map((a) => ({
            userId: a.userId,
            orgId: ctx.orgId,
            type: "approval_request" as const,
            entityType: "asset_classification_override",
            entityId: row.id,
            title: `Asset-classification override pending approval`,
            message: `Asset ${id}: ${body.data.fieldName} override → ${body.data.overrideValue}. Reason: ${body.data.reason.slice(0, 120)}${body.data.reason.length > 120 ? "…" : ""}`,
            channel: "in_app" as const,
            createdBy: ctx.userId,
          })),
        );
      }
    }

    return row;
  });

  return Response.json(
    {
      data: {
        ...created,
        nextSteps: body.data.requestApproval
          ? [
              {
                step: "approve",
                label:
                  "Approver muss das Override freigeben — bis dahin bleibt der BIA-Wert wirksam.",
                endpoint: `/api/v1/asset-classification-overrides/${created.id}/approve`,
              },
            ]
          : [
              {
                step: "active",
                label:
                  "Override ist sofort wirksam. /effective-classification liefert den neuen Wert.",
                endpoint: `/api/v1/assets/${id}/effective-classification`,
              },
            ],
      },
    },
    { status: 201 },
  );
});

// GET on the same path: list every override (active + historic) for
// this asset. Useful for the asset-detail UI tab "Overrides &
// Approvals".
export const GET = withErrorHandler<RouteParams>(async function GET(
  _req: Request,
  { params },
) {
  const { id } = await params;
  requireUuidParam(id);
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const rows = await db
    .select()
    .from(assetClassificationOverride)
    .where(
      and(
        eq(assetClassificationOverride.assetId, id),
        eq(assetClassificationOverride.orgId, ctx.orgId),
      ),
    );

  return Response.json({
    data: {
      assetId: id,
      total: rows.length,
      overrides: rows,
    },
  });
});
