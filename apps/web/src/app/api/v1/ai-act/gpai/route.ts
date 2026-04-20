import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  withAuth,
  withAuditContext,
  withReadContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { sql } from "drizzle-orm";
import { createAiGpaiModelSchema } from "@grc/shared";

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
  const isSystemic = searchParams.get("is_systemic_risk");
  const status = searchParams.get("status");

  let query = sql`SELECT * FROM ai_gpai_model WHERE org_id = ${ctx.orgId}`;
  let countQuery = sql`SELECT count(*)::int AS count FROM ai_gpai_model WHERE org_id = ${ctx.orgId}`;

  if (isSystemic === "true" || isSystemic === "false") {
    const val = isSystemic === "true";
    query = sql`${query} AND is_systemic_risk = ${val}`;
    countQuery = sql`${countQuery} AND is_systemic_risk = ${val}`;
  }
  if (status) {
    query = sql`${query} AND status = ${status}`;
    countQuery = sql`${countQuery} AND status = ${status}`;
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
  return Response.json({
    data: result.rows,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      total: result.count,
    },
  });
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const parsed = createAiGpaiModelSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const {
    name,
    provider,
    model_type,
    is_systemic_risk,
    training_data_summary,
    energy_consumption_kwh,
    version,
  } = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const res = await tx.execute(sql`
      INSERT INTO ai_gpai_model (org_id, name, provider, model_type, is_systemic_risk, training_data_summary, energy_consumption_kwh, version, status, created_by)
      VALUES (${ctx.orgId}, ${name}, ${provider}, ${model_type ?? "foundation"}, ${is_systemic_risk ?? false}, ${training_data_summary ?? null}, ${energy_consumption_kwh ?? null}, ${version ?? "1.0"}, 'draft', ${ctx.userId})
      RETURNING *
    `);
    return res.rows[0];
  });
  return Response.json({ data: result }, { status: 201 });
}
