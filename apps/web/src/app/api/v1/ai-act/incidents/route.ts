import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext, paginate } from "@/lib/api";
import { sql } from "drizzle-orm";
import { createAiIncidentSchema } from "@grc/shared";

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { limit, offset, searchParams } = paginate(req);
  const severity = searchParams.get("severity");
  const status = searchParams.get("status");

  let query = sql`SELECT * FROM ai_incident WHERE org_id = ${ctx.orgId}`;
  let countQuery = sql`SELECT count(*)::int AS count FROM ai_incident WHERE org_id = ${ctx.orgId}`;

  if (severity) {
    query = sql`${query} AND severity = ${severity}`;
    countQuery = sql`${countQuery} AND severity = ${severity}`;
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

  const parsed = createAiIncidentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }
  const { title, description, ai_system_id, severity, is_serious } = parsed.data;

  // Auto-calculate authority_deadline: 2 days if death/serious harm, 15 days otherwise
  const deadlineDays = is_serious ? 2 : 15;
  const now = new Date();
  const authorityDeadline = new Date(now.getTime() + deadlineDays * 24 * 60 * 60 * 1000);

  const result = await withAuditContext(ctx, async (tx) => {
    const res = await tx.execute(sql`
      INSERT INTO ai_incident (org_id, title, description, ai_system_id, severity, is_serious, status, authority_deadline, detected_at, reported_by, created_by)
      VALUES (${ctx.orgId}, ${title}, ${description ?? null}, ${ai_system_id ?? null}, ${severity}, ${is_serious ?? false}, 'detected', ${authorityDeadline.toISOString()}, ${now.toISOString()}, ${ctx.userId}, ${ctx.userId})
      RETURNING *
    `);
    return res.rows[0];
  });
  return Response.json({ data: result }, { status: 201 });
}
