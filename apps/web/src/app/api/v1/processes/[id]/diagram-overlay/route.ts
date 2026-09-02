/**
 * `GET /api/v1/processes/:id/diagram-overlay` — der Endpunkt aus Plan §3.3.6.
 *
 * **Ein Aufruf statt N.** Die Diagrammfläche holte ihre GRC-Angaben bisher aus
 * vier getrennten Routen (`/risks`, `/control-coverage`, `/findings`,
 * `/call-links`) und zeigte sie als fünf HTML-Badges. Die GRC-Diagrammschicht
 * (`packages/bpmn/src/grc/**`, 23 Layer, 9 Sichten) erwartet stattdessen einen
 * **einzigen** typisierten Datensatz `GrcOverlayData`. Diesen Endpunkt gab es
 * bis hierher nicht — deshalb war die gesamte Layer-Arbeit unsichtbar
 * (`STUFE2-C-ABSCHLUSS.md` §5, Punkt 11).
 *
 * **Was er zusichert**
 *
 * - *Eine* RLS-Prüfung: `withErrorHandler` öffnet den `requestDbStorage`-Rahmen,
 *   den `withAuth` braucht, um die org-gebundene Verbindung zu binden. Ohne den
 *   Wrapper fragt der Handler den kontextlosen Pool und RLS filtert jede Zeile
 *   weg — der schwerste Befund der E2E-Triage (`api.ts:184`).
 * - *Eine* `computedAt`-Angabe: Pflichtfeld des Vertrags, damit jede Anzeige
 *   aus zwischengespeicherten Daten ihren Stand nennen kann.
 * - **Keine erfundenen Werte.** Wo das heutige Schema ein Vertragsfeld nicht
 *   trägt, fehlt das Feld. Die Begründung je Feld steht als auswertbare Liste
 *   in `lib/grc-overlay.ts` (`MISSING_TODAY`), nicht als Fließtext.
 *
 * Die Abbildung selbst steht in `@/lib/grc-overlay` und ist rein; hier steht
 * nur, wie die Zeilen beschafft werden.
 */

import { db } from "@grc/db";
import { toRows } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import {
  buildDiagramOverlay,
  type AssetRow,
  type CalledProcessRow,
  type CommentRow,
  type ControlRow,
  type DmnRow,
  type FindingRow,
  type FrameworkRow,
  type RiskControlRow,
  type RiskRow,
  type RoleRow,
  type SimulationRow,
  type StepRow,
} from "@/lib/grc-overlay";

/**
 * Die Layergruppen, die der Aufrufer einzeln abwählen kann.
 *
 * Der Plan nennt `?layers=risk,control,finding,ropa,…`. Nur die Gruppen, die
 * dieser Endpunkt heute **wirklich** befüllen kann, sind hier aufgeführt — ein
 * `layers=ropa` anzunehmen und dann nichts zu liefern, wäre eine Zusage, die
 * nicht eingehalten wird. Unbekannte Namen lassen die Validierung fehlschlagen,
 * statt still ignoriert zu werden.
 */
const GROUPS = [
  "risk",
  "control",
  "finding",
  "asset",
  "raci",
  "line-of-defense",
  "call-activity",
  "comments",
  "framework",
  "operations",
  "dmn",
] as const;
type Group = (typeof GROUPS)[number];

const querySchema = z.object({
  /** Prozessversion. Wird geprüft und im Datensatz ausgewiesen (§4.1). */
  version: z.string().uuid().optional(),
  /** Kommaliste; ohne Angabe werden alle Gruppen geliefert. */
  layers: z
    .string()
    .max(400)
    .optional()
    .transform((value) =>
      value === undefined
        ? undefined
        : value
            .split(",")
            .map((part) => part.trim())
            .filter((part) => part.length > 0),
    )
    .refine(
      (parts) => parts === undefined || parts.every((p) => isGroup(p)),
      // Der Text nennt die zulässigen Werte, damit ein Aufrufer nicht raten muss.
      { message: `layers must be a subset of: ${GROUPS.join(", ")}` },
    ),
});

function isGroup(value: string): value is Group {
  return (GROUPS as readonly string[]).includes(value);
}

/** ISO-8601 mit `Z`, damit `new Date(...)` in jedem Browser dasselbe ergibt. */
const TS = (column: string) =>
  sql.raw(
    `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
  );

/**
 * `db.execute()` liefert unter postgres-js eine `RowList<Record<string,
 * unknown>[]>`; die tatsächliche Zeilenform steht in der Abfrage selbst (jede
 * Spalte trägt ein `AS "…"`), lässt sich aber aus dem SQL-Template nicht
 * ableiten. Diese eine Stelle macht die Behauptung sichtbar, statt sie an
 * zwölf Aufrufstellen zu wiederholen — und `toRows` bleibt der einzige Ort,
 * an dem die beiden Treiberformen (`RowList` gegen `{ rows }`) auseinander
 * gehalten werden.
 */
function rowsOf<T>(result: unknown): T[] {
  return toRows(result as Parameters<typeof toRows>[0]) as unknown as T[];
}

function firstRowOf<T>(result: unknown): T | undefined {
  return rowsOf<T>(result)[0];
}

export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: processId } = await params;

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const wanted = new Set<Group>(
    (parsed.data.layers as Group[] | undefined) ?? GROUPS,
  );
  const want = (group: Group): boolean => wanted.has(group);

  // --- Prozess ------------------------------------------------------------
  const proc = firstRowOf<{ id: string; name: string | null }>(
    await db.execute(
      sql`SELECT id, name FROM process
          WHERE id = ${processId} AND org_id = ${ctx.orgId} AND deleted_at IS NULL
          LIMIT 1`,
    ),
  );
  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Eine angegebene Version muss zu diesem Prozess gehören. Sonst wäre der
  // ausgewiesene Stand („Version X") eine Behauptung über ein fremdes Objekt.
  let versionId: string | undefined;
  if (parsed.data.version !== undefined) {
    const version = firstRowOf<{ id: string }>(
      await db.execute(
        sql`SELECT id FROM process_version
            WHERE id = ${parsed.data.version} AND process_id = ${processId}
              AND org_id = ${ctx.orgId}
            LIMIT 1`,
      ),
    );
    if (!version) {
      return Response.json({ error: "Version not found" }, { status: 404 });
    }
    versionId = version.id;
  }

  // --- Schritte -----------------------------------------------------------
  const steps = rowsOf<StepRow>(
    await db.execute(
      sql`SELECT id,
                 bpmn_element_id           AS "bpmnElementId",
                 line_of_defense           AS "lineOfDefense",
                 called_process_id         AS "calledProcessId",
                 raci_responsible_role_id  AS "raciResponsibleRoleId",
                 raci_accountable_role_id  AS "raciAccountableRoleId"
          FROM process_step
          WHERE process_id = ${processId} AND org_id = ${ctx.orgId}
            AND deleted_at IS NULL
          ORDER BY sequence_order, bpmn_element_id`,
    ),
  );

  const stepIds = steps.map((step) => step.id);
  const empty = stepIds.length === 0;

  // --- Risiken ------------------------------------------------------------
  const risks: RiskRow[] =
    empty || !want("risk")
      ? []
      : rowsOf<RiskRow>(
          await db.execute(
            sql`SELECT psr.process_step_id  AS "processStepId",
                       r.id                 AS "riskId",
                       r.title              AS "title",
                       r.risk_score_residual AS "residualScore",
                       r.risk_score_inherent AS "inherentScore",
                       u.name               AS "ownerName",
                       r.treatment_strategy::text AS "treatmentStrategy"
                FROM process_step_risk psr
                JOIN risk r ON r.id = psr.risk_id AND r.deleted_at IS NULL
                LEFT JOIN "user" u ON u.id = r.owner_id
                WHERE psr.org_id = ${ctx.orgId}
                  AND psr.process_step_id = ANY(${stepIds}::uuid[])
                ORDER BY psr.process_step_id, r.title, r.id`,
          ),
        );

  // --- Kontrollen ---------------------------------------------------------
  //
  // Der letzte Test und der jüngste Nachweis kommen als korrelierte
  // Unterabfragen, nicht als weitere Joins: ein Join über `control_test`
  // vervielfacht die Kontrollzeilen, und `evidence` ist polymorph
  // (`entity_type`/`entity_id`) und damit ohnehin nicht joinbar ohne Filter.
  const controls: ControlRow[] =
    empty || !want("control")
      ? []
      : rowsOf<ControlRow>(
          await db.execute(
            sql`SELECT psc.process_step_id AS "processStepId",
                       c.id                AS "controlId",
                       c.title             AS "title",
                       c.status::text      AS "status",
                       (SELECT to_char(ct.test_date, 'YYYY-MM-DD')
                          FROM control_test ct
                         WHERE ct.control_id = c.id AND ct.deleted_at IS NULL
                           AND ct.test_date IS NOT NULL
                         ORDER BY ct.test_date DESC LIMIT 1)   AS "lastTestedAt",
                       (SELECT ct.toe_result::text
                          FROM control_test ct
                         WHERE ct.control_id = c.id AND ct.deleted_at IS NULL
                           AND ct.test_date IS NOT NULL
                         ORDER BY ct.test_date DESC LIMIT 1)   AS "lastTestResult",
                       (SELECT ${TS("e.created_at")}
                          FROM evidence e
                         WHERE e.entity_type = 'control' AND e.entity_id = c.id
                           AND e.org_id = ${ctx.orgId} AND e.deleted_at IS NULL
                         ORDER BY e.created_at DESC LIMIT 1)   AS "lastEvidenceAt"
                FROM process_step_control psc
                JOIN control c ON c.id = psc.control_id AND c.deleted_at IS NULL
                WHERE psc.org_id = ${ctx.orgId}
                  AND psc.process_step_id = ANY(${stepIds}::uuid[])
                ORDER BY psc.process_step_id, c.title, c.id`,
          ),
        );

  // --- Risiko ↔ Kontrolle: der Join aus §3.3.6 ----------------------------
  const riskIds = [...new Set(risks.map((row) => row.riskId))];
  const riskControls: RiskControlRow[] =
    riskIds.length === 0 || controls.length === 0
      ? []
      : rowsOf<RiskControlRow>(
          await db.execute(
            sql`SELECT risk_id AS "riskId", control_id AS "controlId"
                FROM risk_control
                WHERE org_id = ${ctx.orgId}
                  AND risk_id = ANY(${riskIds}::uuid[])
                ORDER BY risk_id, control_id`,
          ),
        );

  // --- Feststellungen -----------------------------------------------------
  const findings: FindingRow[] =
    empty || !want("finding")
      ? []
      : rowsOf<FindingRow>(
          await db.execute(
            sql`SELECT process_step_id AS "processStepId",
                       id, title,
                       severity::text  AS "severity",
                       status::text    AS "status",
                       to_char(remediation_due_date, 'YYYY-MM-DD') AS "dueAt"
                FROM finding
                WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
                  AND process_step_id = ANY(${stepIds}::uuid[])
                ORDER BY process_step_id, severity, id`,
          ),
        );

  // --- Assets -------------------------------------------------------------
  const assets: AssetRow[] =
    empty || !want("asset")
      ? []
      : rowsOf<AssetRow>(
          await db.execute(
            sql`SELECT psa.process_step_id       AS "processStepId",
                       a.id                      AS "assetId",
                       a.name                    AS "name",
                       a.protection_goal_class   AS "protectionGoalClass",
                       a.default_confidentiality AS "confidentiality",
                       a.default_integrity       AS "integrity",
                       a.default_availability    AS "availability",
                       a.contact_person          AS "ownerName"
                FROM process_step_asset psa
                JOIN asset a ON a.id = psa.asset_id AND a.deleted_at IS NULL
                WHERE psa.org_id = ${ctx.orgId}
                  AND psa.process_step_id = ANY(${stepIds}::uuid[])
                ORDER BY psa.process_step_id, a.name, a.id`,
          ),
        );

  // --- Rollen (R/A) -------------------------------------------------------
  const roleIds = want("raci")
    ? [
        ...new Set(
          steps
            .flatMap((step) => [
              step.raciResponsibleRoleId,
              step.raciAccountableRoleId,
            ])
            .filter((value): value is string => typeof value === "string"),
        ),
      ]
    : [];
  const roles: RoleRow[] =
    roleIds.length === 0
      ? []
      : rowsOf<RoleRow>(
          await db.execute(
            sql`SELECT id, name FROM custom_role
                WHERE org_id = ${ctx.orgId} AND id = ANY(${roleIds}::uuid[])
                ORDER BY id`,
          ),
        );

  // --- Kommentare je Schritt ----------------------------------------------
  const comments: CommentRow[] =
    empty || !want("comments")
      ? []
      : rowsOf<CommentRow>(
          await db.execute(
            sql`SELECT pc.entity_id                                   AS "processStepId",
                       COUNT(*)::int                                  AS "totalThreads",
                       COUNT(*) FILTER (WHERE NOT pc.is_resolved)::int AS "openThreads",
                       ${TS("MAX(pc.created_at)")}                    AS "lastAt",
                       (ARRAY_AGG(u.name ORDER BY pc.created_at DESC))[1] AS "lastAuthor"
                FROM process_comment pc
                LEFT JOIN "user" u ON u.id = pc.created_by
                WHERE pc.org_id = ${ctx.orgId}
                  AND pc.process_id = ${processId}
                  AND pc.entity_type = 'process_step'
                  AND pc.parent_comment_id IS NULL
                  AND pc.deleted_at IS NULL
                  AND pc.entity_id = ANY(${stepIds}::uuid[])
                GROUP BY pc.entity_id
                ORDER BY pc.entity_id`,
          ),
        );

  // --- Framework-Zuordnungen je Schritt (F8) --------------------------------
  //
  // `process_step_id` gibt es seit Migration 0443; Zeilen ohne Schritt sind
  // Prozessaussagen und gehören nicht an ein Element (siehe MISSING_TODAY).
  const frameworks: FrameworkRow[] =
    empty || !want("framework")
      ? []
      : rowsOf<FrameworkRow>(
          await db.execute(
            sql`SELECT process_step_id AS "processStepId",
                       id,
                       framework_code   AS "frameworkCode",
                       entry_code       AS "entryCode",
                       entry_title      AS "entryTitle",
                       mapping_strength AS "mappingStrength"
                FROM process_framework_mapping
                WHERE org_id = ${ctx.orgId}
                  AND process_id = ${processId}
                  AND process_step_id = ANY(${stepIds}::uuid[])
                ORDER BY process_step_id, framework_code, entry_code, id`,
          ),
        );

  // --- Simulationsparameter ------------------------------------------------
  //
  // `activity_id` ist die BPMN-Element-ID. Genommen wird das zuletzt
  // aktualisierte Szenario dieses Prozesses; über mehrere Szenarien zu mitteln
  // wäre eine Zahl, die in keinem Szenario steht.
  const simulation: SimulationRow[] = !want("operations")
    ? []
    : rowsOf<SimulationRow>(
        await db.execute(
          sql`SELECT sap.activity_id                    AS "activityId",
                     sap.duration_most_likely::float8   AS "durationMostLikely",
                     sap.cost_per_execution::float8     AS "costPerExecution",
                     s.case_count                       AS "executions"
              FROM simulation_activity_param sap
              JOIN simulation_scenario s ON s.id = sap.scenario_id
              WHERE s.org_id = ${ctx.orgId} AND s.process_id = ${processId}
                AND s.id = (SELECT id FROM simulation_scenario
                             WHERE org_id = ${ctx.orgId} AND process_id = ${processId}
                             ORDER BY updated_at DESC, id DESC LIMIT 1)
              ORDER BY sap.activity_id`,
        ),
      );

  // --- DMN-Entscheidungen --------------------------------------------------
  const dmn: DmnRow[] =
    empty || !want("dmn")
      ? []
      : rowsOf<DmnRow>(
          await db.execute(
            sql`SELECT linked_process_step_id AS "processStepId", id, name
                FROM dmn_decision
                WHERE org_id = ${ctx.orgId}
                  AND linked_process_step_id = ANY(${stepIds}::uuid[])
                ORDER BY linked_process_step_id, id`,
          ),
        );

  // --- Roll-up der aufgerufenen Prozesse (§3.4/A5) -------------------------
  //
  // Das Aggregat gehört serverseitig gerechnet: der Client kennt das fremde
  // Diagramm nicht. Gerechnet wird über die Schritte des Zielprozesses —
  // Risikosumme, Höchstscore, das durch mindestens eine *wirksame* Kontrolle
  // abgedeckte Restrisiko und die offenen Feststellungen.
  const calledIds = want("call-activity")
    ? [
        ...new Set(
          steps
            .map((step) => step.calledProcessId)
            .filter((value): value is string => typeof value === "string"),
        ),
      ]
    : [];
  const calledProcesses: CalledProcessRow[] =
    calledIds.length === 0
      ? []
      : rowsOf<CalledProcessRow>(
          await db.execute(
            sql`WITH target_step AS (
                  SELECT ps.id, ps.process_id
                    FROM process_step ps
                   WHERE ps.org_id = ${ctx.orgId}
                     AND ps.deleted_at IS NULL
                     AND ps.process_id = ANY(${calledIds}::uuid[])
                ),
                step_risk AS (
                  SELECT ts.process_id,
                         r.id   AS risk_id,
                         COALESCE(r.risk_score_residual, 0) AS score,
                         EXISTS (
                           SELECT 1
                             FROM risk_control rc
                             JOIN process_step_control psc
                               ON psc.control_id = rc.control_id
                              AND psc.process_step_id = ts.id
                             JOIN control c ON c.id = rc.control_id
                              AND c.deleted_at IS NULL
                              AND c.status = 'effective'
                            WHERE rc.risk_id = r.id AND rc.org_id = ${ctx.orgId}
                         ) AS covered
                    FROM target_step ts
                    JOIN process_step_risk psr ON psr.process_step_id = ts.id
                    JOIN risk r ON r.id = psr.risk_id AND r.deleted_at IS NULL
                ),
                risk_agg AS (
                  SELECT process_id,
                         COUNT(DISTINCT risk_id)::int AS risk_count,
                         COALESCE(MAX(score), 0)::int AS max_score,
                         COALESCE(SUM(score), 0)::int AS sum_score,
                         COALESCE(SUM(CASE WHEN covered THEN score ELSE 0 END), 0)::int
                           AS covered_score
                    FROM step_risk GROUP BY process_id
                ),
                finding_agg AS (
                  SELECT ts.process_id, COUNT(*)::int AS open_findings
                    FROM target_step ts
                    JOIN finding f ON f.process_step_id = ts.id
                     AND f.deleted_at IS NULL
                     AND f.status NOT IN ('closed', 'verified', 'remediated')
                   WHERE f.org_id = ${ctx.orgId}
                   GROUP BY ts.process_id
                )
                SELECT p.id                                  AS "processId",
                       p.name                                AS "name",
                       COALESCE(ra.risk_count, 0)            AS "riskCount",
                       COALESCE(ra.max_score, 0)             AS "maxResidualScore",
                       COALESCE(ra.sum_score, 0)             AS "residualScoreSum",
                       COALESCE(ra.covered_score, 0)         AS "coveredScoreSum",
                       COALESCE(fa.open_findings, 0)         AS "openFindings"
                  FROM process p
                  LEFT JOIN risk_agg ra ON ra.process_id = p.id
                  LEFT JOIN finding_agg fa ON fa.process_id = p.id
                 WHERE p.org_id = ${ctx.orgId} AND p.deleted_at IS NULL
                   AND p.id = ANY(${calledIds}::uuid[])
                 ORDER BY p.id`,
          ),
        );

  const computedAt = new Date().toISOString();
  const payload = buildDiagramOverlay(
    {
      steps,
      risks,
      controls,
      riskControls,
      findings,
      assets,
      roles,
      comments,
      frameworks,
      simulation,
      dmn,
      calledProcesses,
    },
    {
      computedAt,
      processId,
      processName: proc.name ?? undefined,
      versionId,
      // Kurz genug, dass ein Kontrollwechsel im Diagramm ankommt, lang genug,
      // dass Zoomen und Sichtwechsel den Endpunkt nicht erneut befragen.
      ttlSeconds: 60,
    },
  );

  return Response.json(
    { data: payload },
    {
      headers: {
        // Privat: die Antwort ist RLS-gefiltert und damit nutzerabhängig.
        "Cache-Control": "private, max-age=60",
      },
    },
  );
});
