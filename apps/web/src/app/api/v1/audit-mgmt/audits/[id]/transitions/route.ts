// GET /api/v1/audit-mgmt/audits/[id]/transitions
//
// #WAVE14D-P1-05: Wave-14 QA tried `planned → fieldwork` and got back a
// bare 422 "Cannot transition from 'planned' to 'fieldwork'" — no
// discovery of what would be valid next, no hint about pre-conditions.
// Other state-bearing modules (risk, finding, control, incident, vendor,
// contract, process, dsr, dpia, bia) all already expose a /transitions
// route; audit was the lone gap. This closes it.
//
// Audit-state-machine: planned → preparation → fieldwork → reporting →
// review → completed. (Cancellation is allowed from planned/preparation/
// fieldwork/reporting.) Source: VALID_AUDIT_STATUS_TRANSITIONS in
// packages/shared/src/schemas/audit.ts.

import { db, audit } from "@grc/db";
import { requireModule } from "@grc/auth";
import { VALID_AUDIT_STATUS_TRANSITIONS } from "@grc/shared";
import { and, eq, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

type RouteParams = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<RouteParams>(async function GET(
  _req: Request,
  { params },
) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [row] = await db
    .select({
      status: audit.status,
      leadAuditorId: audit.leadAuditorId,
      plannedStart: audit.plannedStart,
      plannedEnd: audit.plannedEnd,
    })
    .from(audit)
    .where(
      and(
        eq(audit.id, id),
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Audit not found" }, { status: 404 });
  }

  const current = row.status;
  const allowedNext = VALID_AUDIT_STATUS_TRANSITIONS[current] ?? [];

  // Surface the soft pre-conditions Wave-14 QA hit blind.
  // These aren't enforced by the state machine itself but are conventions
  // any sensible audit ought to satisfy before moving past `preparation`.
  const preconditions: { code: string; satisfied: boolean; message: string }[] =
    [
      {
        code: "lead_auditor_assigned",
        satisfied: row.leadAuditorId !== null,
        message:
          "Lead auditor assigned (set on the audit row before moving to fieldwork).",
      },
      {
        code: "planned_window_set",
        satisfied: row.plannedStart !== null && row.plannedEnd !== null,
        message: "Both plannedStart and plannedEnd dates set.",
      },
    ];

  return Response.json({
    data: {
      current,
      allowedNext,
      endpoint: `/api/v1/audit-mgmt/audits/${id}/status`,
      method: "PUT",
      preconditions,
      note: "Pre-conditions are advisory — the state machine accepts the transition once the `to` status is in `allowedNext`. The hard rule is the transition table; pre-conditions help operators avoid moving an under-configured audit forward.",
    },
  });
});
