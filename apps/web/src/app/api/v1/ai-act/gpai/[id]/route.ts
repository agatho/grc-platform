import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { sql } from "drizzle-orm";
import { updateAiGpaiModelSchema } from "@grc/shared";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager", "dpo", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;

  const rows = await db.execute(
    sql`SELECT * FROM ai_gpai_model WHERE id = ${id} AND org_id = ${ctx.orgId}`
  );
  if (rows.rows.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: rows.rows[0] });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const parsed = updateAiGpaiModelSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }
  const {
    name, provider, model_type, is_systemic_risk, systemic_risk_justification,
    training_data_summary, energy_consumption_kwh, version, status,
    capabilities_summary, limitations_summary, intended_use,
    computational_resources, cybersecurity_measures,
    eu_representative_name, eu_representative_contact,
    code_of_practice_adherence, code_of_practice_notes,
  } = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const res = await tx.execute(sql`
      UPDATE ai_gpai_model SET
        name = COALESCE(${name ?? null}, name),
        provider = COALESCE(${provider ?? null}, provider),
        model_type = COALESCE(${model_type ?? null}, model_type),
        is_systemic_risk = COALESCE(${is_systemic_risk ?? null}, is_systemic_risk),
        systemic_risk_justification = COALESCE(${systemic_risk_justification ?? null}, systemic_risk_justification),
        training_data_summary = COALESCE(${training_data_summary ?? null}, training_data_summary),
        energy_consumption_kwh = COALESCE(${energy_consumption_kwh ?? null}, energy_consumption_kwh),
        version = COALESCE(${version ?? null}, version),
        status = COALESCE(${status ?? null}, status),
        capabilities_summary = COALESCE(${capabilities_summary ?? null}, capabilities_summary),
        limitations_summary = COALESCE(${limitations_summary ?? null}, limitations_summary),
        intended_use = COALESCE(${intended_use ?? null}, intended_use),
        computational_resources = COALESCE(${computational_resources ?? null}, computational_resources),
        cybersecurity_measures = COALESCE(${cybersecurity_measures ?? null}, cybersecurity_measures),
        eu_representative_name = COALESCE(${eu_representative_name ?? null}, eu_representative_name),
        eu_representative_contact = COALESCE(${eu_representative_contact ?? null}, eu_representative_contact),
        code_of_practice_adherence = COALESCE(${code_of_practice_adherence ?? null}, code_of_practice_adherence),
        code_of_practice_notes = COALESCE(${code_of_practice_notes ?? null}, code_of_practice_notes),
        updated_at = now(),
        updated_by = ${ctx.userId}
      WHERE id = ${id} AND org_id = ${ctx.orgId}
      RETURNING *
    `);
    return res.rows[0];
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
