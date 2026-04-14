import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext, paginate } from "@/lib/api";
import { sql } from "drizzle-orm";

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { limit, offset, searchParams } = paginate(req);
  const direction = searchParams.get("direction");

  let query = sql`SELECT * FROM ai_authority_communication WHERE org_id = ${ctx.orgId}`;
  let countQuery = sql`SELECT count(*)::int AS count FROM ai_authority_communication WHERE org_id = ${ctx.orgId}`;

  if (direction) {
    query = sql`${query} AND direction = ${direction}`;
    countQuery = sql`${countQuery} AND direction = ${direction}`;
  }

  query = sql`${query} ORDER BY communication_date DESC LIMIT ${limit} OFFSET ${offset}`;

  const [rows, countResult] = await Promise.all([
    db.execute(query),
    db.execute(countQuery),
  ]);
  return Response.json({
    data: rows.rows,
    pagination: { page: Math.floor(offset / limit) + 1, limit, total: Number((countResult.rows[0] as any)?.count ?? 0) },
  });
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const { authority_name, subject, direction, communication_date, response_deadline, content, ai_system_id } = body;
  if (!authority_name || !subject || !direction) {
    return Response.json({ error: "authority_name, subject, and direction are required" }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const res = await tx.execute(sql`
      INSERT INTO ai_authority_communication (org_id, authority_name, subject, direction, communication_date, response_deadline, content, ai_system_id, status, created_by)
      VALUES (${ctx.orgId}, ${authority_name}, ${subject}, ${direction}, ${communication_date ?? new Date().toISOString()}, ${response_deadline ?? null}, ${content ?? null}, ${ai_system_id ?? null}, 'open', ${ctx.userId})
      RETURNING *
    `);
    return res.rows[0];
  });
  return Response.json({ data: result }, { status: 201 });
}
