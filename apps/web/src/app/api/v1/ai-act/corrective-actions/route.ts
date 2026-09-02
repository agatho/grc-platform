import { db, toRows, firstRow } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  withAuth,
  withAuditContext,
  withReadContext,
  paginate,
} from "@/lib/api";
import { sql } from "drizzle-orm";
import { createAiCorrectiveActionSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
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
    const rows = toRows(r);
    const countArr = toRows(c);
    return { rows, count: Number((countArr[0] as any)?.count ?? 0) };
  });
  return Response.json({
    data: result.rows,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      total: result.count,
    },
  });
});
export const POST = withErrorHandler(async function POST(req: Request) {
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
    return firstRow(res);
  });
  return Response.json({ data: result }, { status: 201 });
});
