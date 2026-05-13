import { db, securityIncident } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

// POST /api/v1/isms/incidents/[id]/notify-authority
//
// Records the DSGVO Art. 33(1)/(3) notification to the supervisory
// authority. The 72-hour clock starts at incident.detected_at; this
// endpoint is the operator's declaration that the notification was
// sent. The response surfaces deadline status (within / overdue / how
// many hours late) so the caller can present a compliance summary.
//
// Why a side-channel and not part of the status state-machine: an
// incident can be notified at any stage between `detected` and
// `recovered`. The notification doesn't itself transition the status —
// the operator may continue containment/eradication after notifying
// the authority. Embedding it in the state machine would either
// duplicate transitions or force a notify-then-status sequence that
// doesn't reflect operational reality.
//
// Idempotency: a second POST overwrites the previous record (an
// operator amending the authority name or reason). The audit_trigger
// captures the diff so the historical claim isn't lost. If a stricter
// "notification can only be recorded once" rule becomes desirable,
// add a guard here.

const notifyAuthoritySchema = z.object({
  authority: z.string().min(1).max(255),
  notifiedAt: z.string().datetime().optional(),
  reason: z.string().min(1).max(5000),
});

type IdCtx = { params: Promise<{ id: string }> };

export const POST = withErrorHandler<IdCtx>(async function POST(
  req,
  { params },
) {
  const ctx = await withAuth("admin", "dpo", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  requireUuidParam(id);

  const body = notifyAuthoritySchema.parse(await req.json());
  const notifiedAt = body.notifiedAt ? new Date(body.notifiedAt) : new Date();

  const updated = await withAuditContext(
    ctx,
    async (tx) => {
      const [current] = await tx
        .select({
          id: securityIncident.id,
          detectedAt: securityIncident.detectedAt,
          status: securityIncident.status,
        })
        .from(securityIncident)
        .where(
          and(
            eq(securityIncident.id, id),
            eq(securityIncident.orgId, ctx.orgId),
            isNull(securityIncident.deletedAt),
          ),
        );

      if (!current) return null;

      const [row] = await tx
        .update(securityIncident)
        .set({
          authorityNotifiedAt: notifiedAt,
          notifiedAuthority: body.authority,
          notificationReason: body.reason,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(securityIncident.id, id))
        .returning({
          id: securityIncident.id,
          detectedAt: securityIncident.detectedAt,
          authorityNotifiedAt: securityIncident.authorityNotifiedAt,
          notifiedAuthority: securityIncident.notifiedAuthority,
          notificationReason: securityIncident.notificationReason,
        });

      return row;
    },
    {
      reason: body.reason,
      actionDetail: `Authority notified: ${body.authority}`,
    },
  );

  if (!updated) {
    return Response.json({ error: "Incident not found" }, { status: 404 });
  }

  // Compute the 72h compliance summary so the UI can render a badge
  // without re-querying.
  const detectedAt = updated.detectedAt;
  const deadlineMs = detectedAt.getTime() + 72 * 60 * 60 * 1000;
  const notifiedMs = updated.authorityNotifiedAt!.getTime();
  const deltaHours = (notifiedMs - deadlineMs) / (60 * 60 * 1000);

  const compliance =
    notifiedMs <= deadlineMs
      ? {
          status: "within_72h" as const,
          hoursBeforeDeadline: Math.round(-deltaHours * 10) / 10,
        }
      : {
          status: "overdue" as const,
          hoursLate: Math.round(deltaHours * 10) / 10,
        };

  return Response.json({
    data: {
      id: updated.id,
      detectedAt: detectedAt.toISOString(),
      authorityNotifiedAt: updated.authorityNotifiedAt!.toISOString(),
      notifiedAuthority: updated.notifiedAuthority,
      notificationReason: updated.notificationReason,
      deadline72h: new Date(deadlineMs).toISOString(),
      compliance,
    },
  });
});
