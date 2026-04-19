import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext, withReadContext, paginate } from "@/lib/api";
import { sql } from "drizzle-orm";
import { createAiAuthorityCommunicationSchema } from "@grc/shared";

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

  query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const result = await withReadContext(ctx, async (tx) => {
    const [r, c] = await Promise.all([tx.execute(query), tx.execute(countQuery)]);
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    const countArr = Array.isArray(c) ? c : (c?.rows ?? []);
    return { rows, count: Number((countArr[0] as any)?.count ?? 0) };
  });
  return Response.json({
    data: result.rows,
    pagination: { page: Math.floor(offset / limit) + 1, limit, total: result.count },
  });
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const parsed = createAiAuthorityCommunicationSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }
  const { authority_name, subject, direction, response_deadline, content, ai_system_id } = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const res = await tx.execute(sql`
      INSERT INTO ai_authority_communication (org_id, authority_name, subject, direction, sent_at, response_deadline, content, ai_system_id, status, created_by)
      VALUES (${ctx.orgId}, ${authority_name}, ${subject}, ${direction}, ${new Date().toISOString()}, ${response_deadline ?? null}, ${content ?? null}, ${ai_system_id ?? null}, 'open', ${ctx.userId})
      RETURNING *
    `);
    return res.rows[0];
  });
  return Response.json({ data: result }, { status: 201 });
}
