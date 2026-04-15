import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext, paginate } from "@/lib/api";
import { sql } from "drizzle-orm";
import { createAiPenaltySchema } from "@grc/shared";

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { limit, offset, searchParams } = paginate(req);
  const penaltyType = searchParams.get("penalty_type");
  const status = searchParams.get("status");

  let query = sql`SELECT * FROM ai_penalty WHERE org_id = ${ctx.orgId}`;
  let countQuery = sql`SELECT count(*)::int AS count FROM ai_penalty WHERE org_id = ${ctx.orgId}`;

  if (penaltyType) {
    query = sql`${query} AND penalty_type = ${penaltyType}`;
    countQuery = sql`${countQuery} AND penalty_type = ${penaltyType}`;
  }
  if (status) {
    query = sql`${query} AND status = ${status}`;
    countQuery = sql`${countQuery} AND status = ${status}`;
  }

  query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const [rows, countResult] = await Promise.all([
    db.execute(query),
    db.execute(countQuery),
  ]);
  return Response.json({
    data: rows.rows,
    pagination: { page: Math.floor(offset / limit) + 1, limit, total: Number(countResult.rows?.[0] ? (countResult.rows[0] as any).count : 0) },
  });
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const parsed = createAiPenaltySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }
  const { authority, penalty_type, fine_amount, fine_currency, article_reference, description, ai_system_id, appeal_status } = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const res = await tx.execute(sql`
      INSERT INTO ai_penalty (org_id, authority, penalty_type, fine_amount, fine_currency, article_reference, description, ai_system_id, status, appeal_status, created_by)
      VALUES (${ctx.orgId}, ${authority}, ${penalty_type}, ${fine_amount ?? 0}, ${fine_currency ?? 'EUR'}, ${article_reference ?? null}, ${description ?? null}, ${ai_system_id ?? null}, 'pending', ${appeal_status ?? 'none'}, ${ctx.userId})
      RETURNING *
    `);
    return res.rows[0];
  });
  return Response.json({ data: result }, { status: 201 });
}
