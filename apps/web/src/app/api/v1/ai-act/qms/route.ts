import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext, withReadContext, paginate } from "@/lib/api";
import { sql } from "drizzle-orm";
import { createAiProviderQmsSchema } from "@grc/shared";

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { limit, offset, searchParams } = paginate(req);
  const aiSystemId = searchParams.get("ai_system_id");

  let query = sql`SELECT * FROM ai_provider_qms WHERE org_id = ${ctx.orgId}`;
  let countQuery = sql`SELECT count(*)::int AS count FROM ai_provider_qms WHERE org_id = ${ctx.orgId}`;

  if (aiSystemId) {
    query = sql`${query} AND ai_system_id = ${aiSystemId}`;
    countQuery = sql`${countQuery} AND ai_system_id = ${aiSystemId}`;
  }

  query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const result = await withReadContext(ctx, async (tx) => {
    const [r, c] = await Promise.all([tx.execute(query), tx.execute(countQuery)]);
    // postgres-js tx.execute returns the row array directly; normalise either shape.
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    const countArr = Array.isArray(c) ? c : (c?.rows ?? []);
    const count = Number((countArr[0] as any)?.count ?? 0);
    return { rows, count };
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

  const parsed = createAiProviderQmsSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }
  const { ai_system_id, risk_management_procedure, data_governance_procedure, technical_documentation_procedure, record_keeping_procedure, transparency_procedure, human_oversight_procedure, accuracy_procedure, cybersecurity_procedure, conformity_procedure, post_market_procedure, overall_maturity, next_audit_date } = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const res = await tx.execute(sql`
      INSERT INTO ai_provider_qms (org_id, ai_system_id, risk_management_procedure, data_governance_procedure, technical_documentation_procedure, record_keeping_procedure, transparency_procedure, human_oversight_procedure, accuracy_procedure, cybersecurity_procedure, conformity_procedure, post_market_procedure, overall_maturity, next_audit_date, assessed_by, created_by)
      VALUES (${ctx.orgId}, ${ai_system_id}, ${risk_management_procedure ?? false}, ${data_governance_procedure ?? false}, ${technical_documentation_procedure ?? false}, ${record_keeping_procedure ?? false}, ${transparency_procedure ?? false}, ${human_oversight_procedure ?? false}, ${accuracy_procedure ?? false}, ${cybersecurity_procedure ?? false}, ${conformity_procedure ?? false}, ${post_market_procedure ?? false}, ${overall_maturity ?? 0}, ${next_audit_date ?? null}, ${ctx.userId}, ${ctx.userId})
      RETURNING *
    `);
    return res.rows[0];
  });
  return Response.json({ data: result }, { status: 201 });
}
