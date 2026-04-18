// POST /api/v1/bcms/plans/[id]/transition
//
// Sprint 2.2: BCP-Status-Transitions mit Gate B3/B5/B6-Validation.
//
// Body:
//   - targetStatus: "in_review" | "approved" | "published" | "archived" | "superseded" | "draft"
//   - publishCtx?: { reportDocumentId: uuid, physicalStorageLocation: string }
//     (nur fuer approved -> published relevant)

import {
  db,
  bcp,
  bcpProcedure,
  bcpResource,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  validateBcpTransition,
  type BcpSnapshot,
  type BcpStatus,
} from "@grc/shared";
import { and, eq, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  targetStatus: z.enum([
    "draft",
    "in_review",
    "approved",
    "published",
    "archived",
    "superseded",
  ]),
  reason: z.string().max(2000).optional(),
  publishCtx: z
    .object({
      reportDocumentId: z.string().uuid().nullable(),
      physicalStorageLocation: z.string().max(2000).nullable(),
    })
    .optional(),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { targetStatus, publishCtx } = parsed.data;

  const [plan] = await db
    .select()
    .from(bcp)
    .where(and(eq(bcp.id, id), eq(bcp.orgId, ctx.orgId)));
  if (!plan) {
    return Response.json({ error: "BCP not found" }, { status: 404 });
  }

  // Procedure + Resource Counts fuer Gate B3
  const [{ procCount }] = await db
    .select({ procCount: sql<number>`count(*)::int` })
    .from(bcpProcedure)
    .where(eq(bcpProcedure.bcpId, id));

  const [{ resCount }] = await db
    .select({ resCount: sql<number>`count(*)::int` })
    .from(bcpResource)
    .where(eq(bcpResource.bcpId, id));

  const snapshot: BcpSnapshot = {
    status: plan.status,
    title: plan.title,
    scope: plan.scope,
    activationCriteria: plan.activationCriteria,
    bcManagerId: plan.bcManagerId,
    processIds: plan.processIds as string[] | null,
    procedureCount: procCount ?? 0,
    resourceCount: resCount ?? 0,
    approvedBy: plan.approvedBy,
    approvedAt: plan.approvedAt,
    publishedAt: plan.publishedAt,
  };

  const validation = validateBcpTransition({
    currentStatus: plan.status as BcpStatus,
    targetStatus,
    snapshot,
    approverUserId: ctx.userId,
    publishCtx,
  });

  if (!validation.allowed) {
    return Response.json(
      {
        blocked: true,
        currentStatus: plan.status,
        targetStatus,
        blockers: validation.blockers,
      },
      { status: 422 },
    );
  }

  // Transition durchfuehren mit Status-spezifischen Seiten-Effekten
  const result = await withAuditContext(ctx, async (tx) => {
    const updates: Record<string, unknown> = {
      status: targetStatus,
      updatedAt: new Date(),
    };

    if (targetStatus === "approved") {
      updates.approvedBy = ctx.userId;
      updates.approvedAt = new Date();
    }
    if (targetStatus === "published") {
      updates.publishedAt = new Date();
      if (publishCtx?.reportDocumentId) {
        updates.reportDocumentId = publishCtx.reportDocumentId;
      }
    }

    const [updated] = await tx
      .update(bcp)
      .set(updates)
      .where(and(eq(bcp.id, id), eq(bcp.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  return Response.json({
    data: result,
    previousStatus: plan.status,
    blockers: validation.blockers,
  });
}
