import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  withAuth,
  withAuditContext,
  withReadContext,
  paginate,
} from "@/lib/api";
import { sql } from "drizzle-orm";
import { createAiCorrectiveActionSchema } from "@grc/shared";

export async function GET(req: Request) {
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

  const { limit, offset, searchParams } = paginate(req);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const actionType = searchParams.get("action_type");

  let query = sql`SELECT * FROM ai_corrective_action WHERE org_id = ${ctx.orgId}`;
  let countQuery = sql`SELECT count(*)::int AS count FROM ai_corrective_action WHERE org_id = ${ctx.orgId}`;

  if (status) {
    query = sql`${query} AND status = ${status}`;
    countQuery = sql`${countQuery} AND status = ${status}`;
  }
  if (priority) {
    query = sql`${query} AND priority = ${priority}`;
    countQuery = sql`${countQuery} AND priority = ${priority}`;
  }
  if (actionType) {
    query = sql`${query} AND action_type = ${actionType}`;
    countQuery = sql`${countQuery} AND action_type = ${actionType}`;
  }

  query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const result = await withReadContext(ctx, async (tx) => {
    const [r, c] = await Promise.all([
      tx.execute(query),
      tx.execute(countQuery),
    ]);
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    const countArr = Array.isArray(c) ? c : (c?.rows ?? []);
    return { rows, count: Number((countArr[0] as any)?.count ?? 0) };
  });
  // shadow the pre-existing variable names so the unchanged Response.json lines below still work.
  const rows = { rows: result.rows };
  const countResult = { rows: [{ count: result.count }] };
  return Response.json({
    data: rows.rows,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      total: Number(
        countResult.rows?.[0] ? (countResult.rows[0] as any).count : 0,
      ),
    },
  });
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const parsed = createAiCorrectiveActionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const {
    title,
    description,
    ai_system_id,
    action_type,
    priority,
    due_date,
    is_recall,
    is_withdrawal,
  } = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const res = await tx.execute(sql`
      INSERT INTO ai_corrective_action (org_id, title, description, ai_system_id, action_type, priority, status, due_date, is_recall, is_withdrawal, assigned_to, created_by)
      VALUES (${ctx.orgId}, ${title}, ${description ?? null}, ${ai_system_id ?? null}, ${action_type}, ${priority}, 'open', ${due_date ?? null}, ${is_recall ?? false}, ${is_withdrawal ?? false}, ${ctx.userId}, ${ctx.userId})
      RETURNING *
    `);
    return res.rows[0];
  });
  return Response.json({ data: result }, { status: 201 });
}
