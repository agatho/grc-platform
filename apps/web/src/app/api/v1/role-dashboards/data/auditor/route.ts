import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { pgArray } from "../../../_lib/pg-array";
import { auditorDashboardQuerySchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

/**
 * Tage je `timeRange`. Die Vorgabe `quarter` sind 90 Tage — genau die
 * Zahl, die in der Beleg-Kennzahl bisher fest verdrahtet war.
 */
const TIME_RANGE_DAYS: Record<"month" | "quarter" | "year", number> = {
  month: 30,
  quarter: 90,
  year: 365,
};

/**
 * „Offen" im Sinne der Auditsicht. Diese Liste ist nicht hier erfunden: sie
 * steht wortgleich in `audit-mgmt/audit-impact-kris`, `audit-mgmt/audits/
 * [id]/report`, `controls/[id]/audit-impact`, `risks/[id]/audit-impact` und
 * `risks/audit-impact-summary`.
 */
const OPEN_FINDING_STATUSES = ["identified", "in_remediation"];

// GET /api/v1/role-dashboards/data/auditor — Auditor Dashboard data
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  // [ARCTOS-FULL-2026-08-31 / Welle 4b-4 · OP-176] Das Ergebnis der Pruefung
  // wurde nicht gebunden. `timeRange` wirkt jetzt.
  //
  // `status` bleibt bewusst ohne Wirkung, und das ist KEIN Versehen: der
  // Parameter fuehrt `open | in_progress | closed`, die Spalte ist der
  // Aufzaehlungstyp `finding_status` mit
  // `identified | in_remediation | remediated | verified | accepted |
  // closed`. Nur `closed` kommt in beiden vor. Eine Zuordnung der uebrigen
  // waere eine Erfindung, und das Repository traegt fuer den Endzustand
  // bereits ZWEI unvereinbare Auffassungen nebeneinander
  // (`not in ('closed','verified')` in `executive/dashboard` und
  // `findings/analytics/aging` gegen `not in ('closed','verified',
  // 'accepted')` in `controls/effectiveness` und `controls/
  // findings-summary`). Der Punkt bleibt offen und ist in
  // docs/UMSETZUNG-WELLE-4B-4.md §7 beschrieben.
  const { timeRange } = auditorDashboardQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const windowDays = TIME_RANGE_DAYS[timeRange];

  // Findings overview — die im Zeitraum erhobenen Feststellungen.
  const findingsOverview = await db.execute(sql`
    SELECT
      severity,
      status,
      count(*)::int as count
    FROM finding
    WHERE org_id = ${ctx.orgId}
      AND created_at > now() - make_interval(days => ${windowDays})
    GROUP BY severity, status
    ORDER BY severity, status
  `);

  // Evidence quality metrics. `recent_evidence` hing an einer fest
  // verdrahteten 90-Tage-Spanne — das ist genau das Fenster, das
  // `timeRange` benennt (Vorgabe `quarter` = 90 Tage, die Kennzahl bleibt
  // fuer alle bisherigen Aufrufer also unveraendert). `total_evidence` und
  // `with_attachment` sind Bestandszahlen und bleiben ungefenstert.
  const [evidenceQuality] = await db.execute(sql`
    SELECT
      count(*)::int as total_evidence,
      count(*) FILTER (WHERE file_path IS NOT NULL)::int as with_attachment,
      count(*) FILTER (WHERE created_at > now() - make_interval(days => ${windowDays}))::int as recent_evidence
    FROM evidence WHERE org_id = ${ctx.orgId}
  `);

  // Open audit findings by age.
  //
  // [ARCTOS-FULL-2026-08-31 / Welle 4b-4 · OP-182] Hier stand
  // `AND status = 'open'`. `finding.status` ist der Aufzaehlungstyp
  // `finding_status`, und „open" ist keiner seiner Werte:
  //
  //   grc_v4b=> SELECT count(*) FROM finding WHERE status = 'open';
  //   ERROR:  invalid input value for enum finding_status: "open"
  //
  // Diese Abfrage ist also bei JEDEM Aufruf fehlgeschlagen und hat die
  // ganze Route mit einem 500er beendet — die Auditorenseite lud damit
  // ueberhaupt keine Daten (`json.data` blieb `undefined`, die Seite
  // rendert dann `null`). Die Altersstaffel ist ein Bestandsbild der
  // OFFENEN Feststellungen und bleibt deshalb ungefenstert; ihre Kuebel
  // sind ihre eigene Zeitachse.
  const findingsByAge = await db.execute(sql`
    SELECT
      CASE
        WHEN created_at > now() - interval '30 days' THEN 'under_30d'
        WHEN created_at > now() - interval '90 days' THEN '30_90d'
        ELSE 'over_90d'
      END as age_bucket,
      count(*)::int as count
    FROM finding
    WHERE org_id = ${ctx.orgId}
      AND status = ANY(${pgArray(OPEN_FINDING_STATUSES, "finding_status[]")})
    GROUP BY 1
  `);

  return Response.json({
    data: {
      findingsOverview,
      evidenceQuality,
      findingsByAge,
      timeRange,
      generatedAt: new Date().toISOString(),
    },
  });
});
