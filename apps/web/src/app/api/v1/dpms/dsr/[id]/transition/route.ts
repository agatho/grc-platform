// POST /api/v1/dpms/dsr/[id]/transition
//
// Sprint 3.3: DSR-Status-Transitions mit Gates G6/G7/G8 + 30d-Frist.

import { db, dsr, dsrActivity } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  validateDsrTransition,
  type DsrSnapshot,
  type DsrStatus,
} from "@grc/shared";
import { and, eq, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  targetStatus: z.enum([
    "received",
    "verified",
    "processing",
    "response_sent",
    "closed",
    "rejected",
  ]),
  identityVerificationDocumented: z.boolean().optional(),
  article19NotificationsSent: z.boolean().optional(),
  extensionApplied: z.boolean().optional(),
  reason: z.string().max(2000).optional(),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const [row] = await db
    .select()
    .from(dsr)
    .where(and(eq(dsr.id, id), eq(dsr.orgId, ctx.orgId)));
  if (!row) {
    return Response.json({ error: "DSR not found" }, { status: 404 });
  }

  const [{ activityCount }] = await db
    .select({ activityCount: sql<number>`count(*)::int` })
    .from(dsrActivity)
    .where(eq(dsrActivity.dsrId, id));

  const snapshot: DsrSnapshot = {
    status: row.status,
    requestType: row.requestType,
    subjectName: row.subjectName,
    subjectEmail: row.subjectEmail,
    receivedAt: row.receivedAt,
    deadline: row.deadline,
    verifiedAt: row.verifiedAt,
    respondedAt: row.respondedAt,
    closedAt: row.closedAt,
    handlerId: row.handlerId,
    responseArtifactsCount: activityCount ?? 0,
    identityVerificationDocumented:
      parsed.data.identityVerificationDocumented ?? row.verifiedAt !== null,
    article19NotificationsSent: parsed.data.article19NotificationsSent ?? false,
    extensionApplied: parsed.data.extensionApplied ?? false,
  };

  const validation = validateDsrTransition({
    currentStatus: row.status as DsrStatus,
    targetStatus: parsed.data.targetStatus,
    snapshot,
  });

  if (!validation.allowed) {
    return Response.json(
      {
        blocked: true,
        currentStatus: row.status,
        targetStatus: parsed.data.targetStatus,
        blockers: validation.blockers,
      },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const updates: Record<string, unknown> = {
      status: parsed.data.targetStatus,
      updatedAt: new Date(),
    };
    if (parsed.data.targetStatus === "verified")
      updates.verifiedAt = new Date();
    if (parsed.data.targetStatus === "response_sent")
      updates.respondedAt = new Date();
    if (parsed.data.targetStatus === "closed") updates.closedAt = new Date();

    const [updated] = await tx
      .update(dsr)
      .set(updates)
      .where(and(eq(dsr.id, id), eq(dsr.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  // Auto-Activity-Log-Entry
  await withAuditContext(ctx, async (tx) => {
    await tx.insert(dsrActivity).values({
      dsrId: id,
      orgId: ctx.orgId,
      activityType: "status_change",
      description: `${row.status} -> ${parsed.data.targetStatus}${parsed.data.reason ? ": " + parsed.data.reason : ""}`,
      performedBy: ctx.userId,
    });
  });

  return Response.json({
    data: result,
    previousStatus: row.status,
    blockers: validation.blockers,
  });
}
