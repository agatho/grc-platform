import { toRows, firstRow } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext, withReadContext } from "@/lib/api";
import { sql } from "drizzle-orm";
import { updateAiIncidentSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
  const { id } = await params;

  const row = await withReadContext(ctx, async (tx) => {
    const res = await tx.execute(
      sql`SELECT * FROM ai_incident WHERE id = ${id} AND org_id = ${ctx.orgId}`,
    );
    const rows = toRows(res);
    return rows[0];
  });
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
});
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const parsed = updateAiIncidentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const {
    title,
    description,
    severity,
    is_serious,
    status,
    affected_persons_count,
    root_cause,
    root_cause_category,
    remediation_actions,
    preventive_measures,
    lessons_learned,
    harm_type,
    harm_description,
    authority_notified_at,
    authority_reference,
  } = parsed.data;

  // If being resolved, set resolved_at
  //
  // [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-077] Dieser Ausdruck wurde
  // gebaut und dann NIE in das UPDATE eingesetzt — `resolved_at` blieb
  // beim Abschluss eines KI-Vorfalls leer. Sichtbar wurde das erst, als
  // `no-unused-vars` in diesem Verzeichnis eingeschaltet wurde: die tote
  // Bindung war der einzige Hinweis. Fuer Art. 73 KI-VO ist der Zeitpunkt
  // des Abschlusses ein berichtspflichtiges Datum, nicht Kosmetik.
  const resolvedClause =
    status === "resolved"
      ? sql`, resolved_at = COALESCE(resolved_at, now())`
      : sql``;

  const result = await withAuditContext(ctx, async (tx) => {
    const res = await tx.execute(sql`
      UPDATE ai_incident SET
        title = COALESCE(${title ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        severity = COALESCE(${severity ?? null}, severity),
        is_serious = COALESCE(${is_serious ?? null}, is_serious),
        status = COALESCE(${status ?? null}, status),
        affected_persons_count = COALESCE(${affected_persons_count ?? null}, affected_persons_count),
        root_cause = COALESCE(${root_cause ?? null}, root_cause),
        root_cause_category = COALESCE(${root_cause_category ?? null}, root_cause_category),
        remediation_actions = COALESCE(${remediation_actions ?? null}, remediation_actions),
        preventive_measures = COALESCE(${preventive_measures ?? null}, preventive_measures),
        lessons_learned = COALESCE(${lessons_learned ?? null}, lessons_learned),
        harm_type = COALESCE(${harm_type ?? null}, harm_type),
        harm_description = COALESCE(${harm_description ?? null}, harm_description),
        authority_notified_at = COALESCE(${authority_notified_at ?? null}, authority_notified_at),
        authority_reference = COALESCE(${authority_reference ?? null}, authority_reference),
        updated_at = now()${resolvedClause}
      WHERE id = ${id} AND org_id = ${ctx.orgId}
      RETURNING *
    `);
    return firstRow(res);
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
});
