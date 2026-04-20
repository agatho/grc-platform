import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext, withReadContext } from "@/lib/api";
import { sql } from "drizzle-orm";
import { updateAiCorrectiveActionSchema } from "@grc/shared";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "dpo",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;

  const row = await withReadContext(ctx, async (tx) => {
    const res = await tx.execute(
      sql`SELECT * FROM ai_corrective_action WHERE id = ${id} AND org_id = ${ctx.orgId}`,
    );
    const rows = Array.isArray(res) ? res : (res?.rows ?? []);
    return rows[0];
  });
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const parsed = updateAiCorrectiveActionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const {
    title,
    description,
    non_conformity_description,
    action_type,
    is_recall,
    is_withdrawal,
    recall_reason,
    priority,
    assigned_to,
    due_date,
    status,
    authority_notified,
    authority_notified_at,
    authority_reference,
    verification_notes,
    effectiveness_rating,
  } = parsed.data;

  // Auto-set completed_at/verified_at based on status transitions
  const completedClause =
    status === "completed"
      ? sql`, completed_at = COALESCE(completed_at, now())`
      : sql``;
  const verifiedClause =
    status === "verified"
      ? sql`, verified_at = COALESCE(verified_at, now()), verified_by = COALESCE(verified_by, ${ctx.userId})`
      : sql``;

  const result = await withAuditContext(ctx, async (tx) => {
    const res = await tx.execute(sql`
      UPDATE ai_corrective_action SET
        title = COALESCE(${title ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        non_conformity_description = COALESCE(${non_conformity_description ?? null}, non_conformity_description),
        action_type = COALESCE(${action_type ?? null}, action_type),
        is_recall = COALESCE(${is_recall ?? null}, is_recall),
        is_withdrawal = COALESCE(${is_withdrawal ?? null}, is_withdrawal),
        recall_reason = COALESCE(${recall_reason ?? null}, recall_reason),
        priority = COALESCE(${priority ?? null}, priority),
        assigned_to = COALESCE(${assigned_to ?? null}, assigned_to),
        due_date = COALESCE(${due_date ?? null}, due_date),
        status = COALESCE(${status ?? null}, status),
        authority_notified = COALESCE(${authority_notified ?? null}, authority_notified),
        authority_notified_at = COALESCE(${authority_notified_at ?? null}, authority_notified_at),
        authority_reference = COALESCE(${authority_reference ?? null}, authority_reference),
        verification_notes = COALESCE(${verification_notes ?? null}, verification_notes),
        effectiveness_rating = COALESCE(${effectiveness_rating ?? null}, effectiveness_rating),
        updated_at = now()
        ${completedClause}
        ${verifiedClause}
      WHERE id = ${id} AND org_id = ${ctx.orgId}
      RETURNING *
    `);
    return res.rows[0];
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
