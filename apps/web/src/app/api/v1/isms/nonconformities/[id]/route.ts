import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { sql } from "drizzle-orm";
import { z } from "zod";
import {
  NC_STATUSES,
  validateNcTransition,
  assertCanCloseNc,
  assertCanCloseMajorNc,
  type NcStatus,
  type CorrectiveActionSnapshot,
} from "@grc/shared";

const updateNonconformitySchema = z.object({
  status: z.enum(NC_STATUSES).optional(),
  rootCause: z.string().max(5000).optional(),
  rootCauseMethod: z.string().max(100).optional(),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.string().optional(),
});

// GET /api/v1/isms/nonconformities/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Nonconformity detail with assigned user names
  const ncRows = await db.execute(sql`
    SELECT nc.*,
      ib.name as identified_by_name,
      au.name as assigned_to_name
    FROM isms_nonconformity nc
    LEFT JOIN "user" ib ON ib.id = nc.identified_by
    LEFT JOIN "user" au ON au.id = nc.assigned_to
    WHERE nc.id = ${id} AND nc.org_id = ${ctx.orgId}
    LIMIT 1
  `);

  const ncArr = ncRows as unknown as Record<string, unknown>[];
  if (ncArr.length === 0) {
    return Response.json({ error: "Nonconformity not found" }, { status: 404 });
  }

  // Corrective actions for this nonconformity
  const actionRows = await db.execute(sql`
    SELECT ca.*,
      au.name as assigned_to_name,
      vu.name as verified_by_name
    FROM isms_corrective_action ca
    LEFT JOIN "user" au ON au.id = ca.assigned_to
    LEFT JOIN "user" vu ON vu.id = ca.verified_by
    WHERE ca.nonconformity_id = ${id} AND ca.org_id = ${ctx.orgId}
    ORDER BY ca.created_at ASC
  `);

  return Response.json({
    data: {
      ...ncArr[0],
      corrective_actions: actionRows,
    },
  });
}

// PUT /api/v1/isms/nonconformities/[id] — Update status, root cause, etc.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const parsed = updateNonconformitySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const d = parsed.data;

  // REQ-ISMS-031/032: validate state-machine transition + closure pre-conditions
  if (d.status) {
    const currentRows = (await db.execute(sql`
      SELECT status, severity FROM isms_nonconformity
      WHERE id = ${id} AND org_id = ${ctx.orgId} LIMIT 1
    `)) as unknown as Array<{ status: string; severity: string }>;

    if (currentRows.length === 0) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const fromStatus = currentRows[0].status as NcStatus;
    const toStatus = d.status;

    const transitionResult = validateNcTransition({
      from: fromStatus,
      to: toStatus,
    });
    if (!transitionResult.ok) {
      return Response.json(
        {
          error: "Invalid status transition",
          reason: transitionResult.reason,
          from: fromStatus,
          to: toStatus,
        },
        { status: 422 },
      );
    }

    if (toStatus === "closed") {
      const caRows = (await db.execute(sql`
        SELECT
          status,
          verification_result as "verificationResult",
          verified_at as "verifiedAt",
          effectiveness_review_date as "effectivenessReviewDate",
          effectiveness_rating as "effectivenessRating"
        FROM isms_corrective_action
        WHERE nonconformity_id = ${id} AND org_id = ${ctx.orgId}
      `)) as unknown as CorrectiveActionSnapshot[];

      const isMajor = currentRows[0].severity === "major";
      const closeAssertion = isMajor
        ? assertCanCloseMajorNc(caRows)
        : assertCanCloseNc(caRows);

      if (!closeAssertion.ok) {
        return Response.json(
          {
            error: "Cannot close nonconformity",
            reason: closeAssertion.reason,
          },
          { status: 422 },
        );
      }
    }
  }

  const result = await withAuditContext(ctx, async () => {
    const rows = (await db.execute(sql`
      UPDATE isms_nonconformity
      SET
        status = COALESCE(${d.status ?? null}, status),
        root_cause = COALESCE(${d.rootCause ?? null}, root_cause),
        root_cause_method = COALESCE(${d.rootCauseMethod ?? null}, root_cause_method),
        assigned_to = COALESCE(${d.assignedTo ?? null}, assigned_to),
        due_date = COALESCE(${d.dueDate ?? null}, due_date),
        closed_at = CASE
          WHEN ${d.status ?? null}::text = 'closed' THEN now()
          ELSE closed_at
        END,
        updated_at = now()
      WHERE id = ${id} AND org_id = ${ctx.orgId}
      RETURNING *
    `)) as unknown as Record<string, unknown>[];
    return rows[0];
  });

  if (!result) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: result });
}
