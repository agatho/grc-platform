import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext, paginate } from "@/lib/api";
import { sql } from "drizzle-orm";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { limit, offset, searchParams } = paginate(req);
  const status = searchParams.get("status");

  let query = sql`SELECT nc.*,
    (SELECT count(*) FROM isms_corrective_action ca WHERE ca.nonconformity_id = nc.id) as action_count,
    (SELECT count(*) FROM isms_corrective_action ca WHERE ca.nonconformity_id = nc.id AND ca.status = 'completed') as completed_actions
    FROM isms_nonconformity nc WHERE nc.org_id = ${ctx.orgId}`;

  if (status) {
    query = sql`${query} AND nc.status = ${status}`;
  }

  query = sql`${query} ORDER BY nc.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  const rows = await db.execute(query);

  const [{ total }] = (await db.execute(
    sql`SELECT count(*)::int as total FROM isms_nonconformity WHERE org_id = ${ctx.orgId}`
  )).rows as [{ total: number }];

  return Response.json({ data: rows.rows, total, page: Math.floor(offset / limit) + 1, limit });
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();

  const result = await withAuditContext(ctx, async () => {
    // Generate NC code
    const [{ count }] = (await db.execute(
      sql`SELECT count(*)::int as count FROM isms_nonconformity WHERE org_id = ${ctx.orgId}`
    )).rows as [{ count: number }];
    const ncCode = `NC-${String(count + 1).padStart(3, "0")}`;

    const rows = await db.execute(sql`
      INSERT INTO isms_nonconformity (org_id, nc_code, title, description, source_type, severity, iso_clause, due_date, identified_by, assigned_to, status)
      VALUES (${ctx.orgId}, ${ncCode}, ${body.title}, ${body.description || null}, ${body.sourceType || "internal_audit"}, ${body.severity || "minor"}, ${body.isoClause || null}, ${body.dueDate || null}, ${ctx.userId}, ${body.assignedTo || null}, 'open')
      RETURNING *
    `);
    return rows.rows[0];
  });

  return Response.json(result, { status: 201 });
}
