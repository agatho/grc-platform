import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { departmentManagerDashboardQuerySchema } from "@grc/shared";
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/role-dashboards/data/department-manager — Department Manager View
async function GET__ctx(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  // [ARCTOS-FULL-2026-08-31 / Welle 4b-4 · OP-176] Diese Route ist die
  // EINZIGE der sieben, deren Parameter BEIDE offen bleiben. Das ist ein
  // Befund, keine Auslassung — nachgeschlagen im laufenden Schema:
  //
  // `departmentId` ist `z.string().uuid()` und hat kein Ziel. `task` fuehrt
  // ueberhaupt keine Abteilung; `risk.department` und `control.department`
  // sind `character varying`, also Namen und keine Schluessel. Die einzige
  // schluesselgefuehrte Abteilungstabelle des Schemas ist `eam_org_unit`,
  // und die haengt ausschliesslich an `eam_business_context` und
  // `process_lane` — es gibt keinen Weg von ihr zu `task`, `risk` oder
  // `control`. Eine Zuordnung waere hier zu erfinden.
  //
  // `timeRange` hat keine Kennzahl, an der es greifen koennte: alle drei
  // Bloecke zaehlen, was der AUFRUFER gerade besitzt („Offene Aufgaben",
  // „Meine Risiken", „Meine Kontrollen" in
  // `role-dashboards/department-manager/page.tsx`). Ein Fenster ueber
  // `created_at` wuerde eine alte, weiterhin offene Aufgabe verschwinden
  // lassen — es machte die Kachel falsch statt genauer.
  //
  // Der tiefere Befund liegt darunter und ist der eigentliche Grund, warum
  // beide Parameter nirgends ankommen: die Route filtert durchweg auf
  // `assignee_id = ctx.userId` bzw. `owner_id = ctx.userId`. Sie zeigt die
  // persoenliche Arbeitsliste des Aufrufers, nicht die seiner Abteilung —
  // eine „Abteilungsleiter"-Ansicht ohne Abteilungsbegriff. Beschrieben in
  // docs/UMSETZUNG-WELLE-4B-4.md §7; der `parse`-Aufruf bleibt, weil er die
  // Eingabepruefung ist.
  departmentManagerDashboardQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );

  // Tasks assigned to current user or department
  const [taskSummary] = await db.execute(sql`
    SELECT
      count(*)::int as total_tasks,
      count(*) FILTER (WHERE status = 'open')::int as open_tasks,
      count(*) FILTER (WHERE status = 'overdue' OR (due_date < now() AND status NOT IN ('done', 'cancelled')))::int as overdue_tasks,
      count(*) FILTER (WHERE status = 'done')::int as completed_tasks
    FROM task WHERE org_id = ${ctx.orgId} AND assignee_id = ${ctx.userId}
  `);

  // Risks owned by user
  const [riskSummary] = await db.execute(sql`
    SELECT
      count(*)::int as total_risks,
      count(*) FILTER (WHERE risk_score_residual >= 15)::int as high_priority_risks
    FROM risk WHERE org_id = ${ctx.orgId} AND owner_id = ${ctx.userId} AND deleted_at IS NULL
  `);

  // Controls owned
  const [controlSummary] = await db.execute(sql`
    SELECT
      count(*)::int as total_controls,
      count(*) FILTER (WHERE status = 'effective')::int as effective
    FROM control WHERE org_id = ${ctx.orgId} AND owner_id = ${ctx.userId} AND deleted_at IS NULL
  `);

  return Response.json({
    data: {
      tasks: taskSummary,
      risks: riskSummary,
      controls: controlSummary,
      generatedAt: new Date().toISOString(),
    },
  });
}

// #SEC-F01b-RUN: wrap handlers so the request-scoped RLS context frame
// (opened by withErrorHandler, mutated by withAuth) is present around the bare
// db.* reads above — otherwise they run context-less under grc_app and RLS
// filters/faults. Also converts prior empty-body 500s to structured problem+json.
export const GET = withErrorHandler(GET__ctx);
