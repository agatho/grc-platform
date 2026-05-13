import { db, securityIncident } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { incidentStatusTransitions } from "@grc/shared";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

// GET /api/v1/isms/incidents/[id]/transitions
//
// Discovery endpoint for the incident lifecycle. Same shape as
// /findings/[id]/transitions and /vulnerabilities/[id]/transitions
// (Wave 8 #WAVE6-STATE-01) — UI consumes this to render the right
// status-change buttons + a hint at the next workflow action.
//
// Source of truth for the matrix is packages/shared/src/schemas/isms.ts
// (incidentStatusTransitions) — the same matrix the PUT /status route
// validates against, so the discovery never advertises a transition
// that PUT will reject.
//
// The DSGVO Art. 33 72h notification is a SEPARATE concern from the
// state-machine transition (an incident can be notified at any
// stage), so notify-authority is a distinct workflow route, not part
// of the transitions matrix.

const INCIDENT_STATUSES = [
  "detected",
  "triaged",
  "contained",
  "eradicated",
  "recovered",
  "lessons_learned",
  "closed",
] as const;

type IdCtx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<IdCtx>(async function GET(req, { params }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  requireUuidParam(id);

  const [row] = await db
    .select({ status: securityIncident.status })
    .from(securityIncident)
    .where(
      and(
        eq(securityIncident.id, id),
        eq(securityIncident.orgId, ctx.orgId),
        isNull(securityIncident.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Incident not found" }, { status: 404 });
  }

  return Response.json({
    data: {
      current: row.status,
      knownStatuses: INCIDENT_STATUSES,
      allowedNext: incidentStatusTransitions[row.status] ?? [],
      endpoint: `/api/v1/isms/incidents/${id}/status`,
      method: "PUT",
      bodyShape: {
        status: `<one of: ${INCIDENT_STATUSES.join(" | ")}>`,
        reason: "<optional string>",
      },
      // Side-channel workflow that's NOT a status transition.
      sideChannels: {
        notifyAuthority: {
          endpoint: `/api/v1/isms/incidents/${id}/notify-authority`,
          method: "POST",
          purpose:
            "Record a DSGVO Art. 33 notification to the supervisory authority. Must include reason and authority. The 72h deadline is automatically computed from detected_at.",
          bodyShape: {
            authority: "<string, e.g. 'Datenschutzbehörde Bayern'>",
            notifiedAt: "<ISO datetime, defaults to now>",
            reason: "<string, mandatory>",
          },
        },
      },
      note: "Incident lifecycle per ISO 27035. The status-machine and the DSGVO notify-authority side-channel are independent — an incident can be notified at any stage between detected and recovered.",
    },
  });
});
