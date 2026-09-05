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
  type BiaRow,
  type CalledProcessRow,
  type CommentRow,
  type ConformanceElementRow,
  type ConformanceSummaryRow,
  type ControlRow,
  type DataCategoryRow,
  type DmnRow,
  type DocumentRow,
  type FindingRow,
  type IncidentRow,
  type KriRow,
  type FrameworkRow,
  type LaneRatioRow,
  type LaneRoleRow,
  type LaneRow,
  type RaciRow,
  type RecipientRow,
  type RiskControlRow,
  type RiskRow,
  type RoleRow,
  type RopaRow,
  type SimulationRow,
  type SodRuleRow,
  type StepRow,
  type TransitionRow,
  type WorkItemRow,
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
  // --- STUFE2-E: die Gruppen der zehn nachgereichten Layer ---------------
  // Sie stehen hier erst, seit die Migrationen 0444–0452 sie befüllbar
  // machen. Vorher hätte `?layers=ropa` eine Zusage gegeben, die niemand
  // einhält — deshalb war der Name bis dahin ein 422.
  "lane",
  "sod",
  "ropa",
  "bia",
  "document",
  "conformance",
  // --- Welle 3b: die beiden Layer, die 0454 möglich gemacht hat -----------
  // [ARCTOS-FULL-2026-08-31 · OP-004/OP-005] Der Elementbezug steht seit
  // Migration 0454; gefehlt haben die Abfragen und die Layer, nicht die
  // Daten. Vorher wäre `?layers=incident` eine Zusage ohne Deckung gewesen.
  "incident",
  "work-item",
  // [ARCTOS-FULL-2026-08-31 · OP-008] F15. Die Richtungsaussage, die
  // STUFE2-A2-GRC.md §6 vermisst hat, steht seit Sprint 2 in `kri.direction`.
  "kri",
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
  /**
   * Ausfallsimulation (F6): welches Asset fällt aus, und seit wann.
   *
   * Ein **Auswahlparameter**, keine hinterlegte Tatsache — deshalb steht er
   * in der Abfrage und nicht in einer Tabelle. Ohne ihn liefert der Endpunkt
   * kein `diagram.outage`, und der Layer schweigt, statt einen Ausfall zu
   * unterstellen, den niemand angenommen hat.
   */
  outage: z.string().uuid().optional(),
  outageElapsed: z.coerce.number().int().min(0).max(525_600).optional(),
  /**
   * [ARCTOS-FULL-2026-08-31 · OP-016] Rahmenwerkauswahl der Sicht F8.
   *
   * Wie `outage` ein **Auswahlparameter** und keine hinterlegte Tatsache —
   * mit einem Unterschied: die Wahl eines Rahmenwerks ist eine dauerhafte
   * Arbeitseinstellung („ich prüfe gerade gegen ISO 27001"), keine Frage, die
   * man je Aufruf neu stellt. Deshalb gibt es beides: dieser Parameter
   * gewinnt, und ohne ihn greift die gespeicherte Wahl des aufrufenden
   * Nutzers aus `user_diagram_preference.framework_code` (0475).
   *
   * Der Wert ist ein `framework_code`, kein Schlüssel — genau die Größe, gegen
   * die `computeFrameworkElement` vergleicht.
   */
  framework: z.string().max(40).optional(),
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
                 raci_accountable_role_id  AS "raciAccountableRoleId",
                 -- STUFE2-E (0445): stabile Identität über Round-Trips.
                 step_key::text            AS "stepKey"
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
                         ORDER BY e.created_at DESC LIMIT 1)   AS "lastEvidenceAt",
                       -- STUFE2-E (0453). last_test_result und
                       -- last_evidence_at gibt es bewusst NICHT als Spalten;
                       -- sie bleiben abgeleitet (Kopfkommentar der Migration).
                       c.is_key                                AS "isKey",
                       c.owner_role_id                         AS "ownerRoleId",
                       ${TS("c.evidence_due_at")}              AS "evidenceDueAt"
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

  // --- RACI-Zeilen (0447) — C und I gibt es ausschließlich hier ------------
  const raci: RaciRow[] =
    empty || !want("raci")
      ? []
      : rowsOf<RaciRow>(
          await db.execute(
            sql`SELECT process_step_id AS "processStepId",
                       role_id         AS "roleId",
                       raci_role       AS "raciRole"
                FROM process_step_raci
                WHERE org_id = ${ctx.orgId}
                  AND process_step_id = ANY(${stepIds}::uuid[])
                ORDER BY process_step_id, raci_role, role_id`,
          ),
        );

  // --- Lanes (0444) --------------------------------------------------------
  //
  // Träger und Drittland stehen an der Lane; der Name des Dienstleisters und
  // der Organisationseinheit kommt per Join, damit die Antwort keine bloßen
  // Kennungen enthält, die die Diagrammschicht nicht anzeigen kann.
  const lanes: LaneRow[] = !want("lane")
    ? []
    : rowsOf<LaneRow>(
        await db.execute(
          sql`SELECT pl.bpmn_element_id AS "bpmnElementId",
                     pl.name            AS "name",
                     pl.kind            AS "kind",
                     pl.custom_role_id  AS "roleId",
                     pl.org_unit_id     AS "orgUnitId",
                     ou.name            AS "orgUnitName",
                     pl.vendor_id       AS "vendorId",
                     v.name             AS "vendorName",
                     v.tier::text       AS "vendorRiskClass",
                     pl.is_external     AS "isExternal",
                     pl.third_country   AS "thirdCountry"
              FROM process_lane pl
              LEFT JOIN eam_org_unit ou
                     ON ou.id = pl.org_unit_id AND ou.org_id = ${ctx.orgId}
              LEFT JOIN vendor v
                     ON v.id = pl.vendor_id AND v.org_id = ${ctx.orgId}
                    AND v.deleted_at IS NULL
              WHERE pl.org_id = ${ctx.orgId} AND pl.process_id = ${processId}
              ORDER BY pl.sequence_order, pl.bpmn_element_id`,
        ),
      );

  // --- Rollen je Lane (F17-Aufschlüsselung, OP-010) ------------------------
  //
  // [ARCTOS-FULL-2026-08-31 · OP-010] In einer Lane arbeitet in aller Regel
  // mehr als ihre Trägerrolle. Welche, sagt seit Migration 0445 die Spalte
  // `process_step.lane_step_id` zusammen mit `process_step_raci` — vorher
  // hätte man die Lane-Zugehörigkeit geometrisch raten müssen, und eine
  // geratene Zuordnung ist als Grundlage einer Qualifikationsaussage
  // unbrauchbar.
  //
  // Nur, wenn die Lane-Gruppe auch gewollt ist: sonst kostete `?layers=raci`
  // eine Abfrage für eine Angabe, die in der Antwort nicht vorkommt.
  const laneRoles: LaneRoleRow[] =
    // Ohne Schritte gibt es keine RACI-Zeilen, die an einer Lane hängen
    // könnten — dann entfällt die Abfrage ganz, statt eine leere Menge zu
    // verbinden.
    empty || lanes.length === 0
      ? []
      : rowsOf<LaneRoleRow>(
          await db.execute(
            sql`SELECT pl.bpmn_element_id AS "bpmnElementId",
                       psr.role_id        AS "roleId"
                FROM process_lane pl
                JOIN process_step ps
                     ON ps.lane_step_id = pl.id
                    AND ps.org_id = ${ctx.orgId}
                    AND ps.deleted_at IS NULL
                JOIN process_step_raci psr
                     ON psr.process_step_id = ps.id
                    AND psr.org_id = ${ctx.orgId}
                WHERE pl.org_id = ${ctx.orgId}
                  AND pl.process_id = ${processId}
                GROUP BY pl.bpmn_element_id, psr.role_id
                ORDER BY pl.bpmn_element_id, psr.role_id`,
          ),
        );

  // --- SoD-Regeln (0446) ---------------------------------------------------
  //
  // Mandantenweit, nicht prozessbezogen: eine Aufgabentrennungsregel gilt
  // zwischen zwei Rollen, unabhängig davon, in welchem Diagramm sie sich
  // treffen. Nur aktive Regeln — eine ausser Kraft gesetzte Regel bleibt der
  // Nachvollziehbarkeit halber stehen, darf aber keinen Konflikt erzeugen.
  const sodRules: SodRuleRow[] = !want("sod")
    ? []
    : rowsOf<SodRuleRow>(
        await db.execute(
          sql`SELECT id,
                     role_a_id     AS "roleAId",
                     role_b_id     AS "roleBId",
                     severity      AS "severity",
                     rationale     AS "rationale",
                     framework_ref AS "frameworkRef"
              FROM sod_rule
              WHERE org_id = ${ctx.orgId} AND is_active
              ORDER BY id`,
        ),
      );

  // --- Rollen: R/A der Schritte, RACI-Zeilen, Lane-Träger, SoD, Kontrollen -
  const roleIds = [
    ...new Set(
      [
        ...(want("raci")
          ? steps.flatMap((step) => [
              step.raciResponsibleRoleId,
              step.raciAccountableRoleId,
            ])
          : []),
        ...raci.map((row) => row.roleId),
        ...lanes.map((row) => row.roleId),
        // [OP-010] Auch die Rollen, die IN der Lane arbeiten — sonst stünde
        // in der Aufschlüsselung eine UUID statt eines Rollennamens, und die
        // Abbildung verwürfe die Zeile.
        ...laneRoles.map((row) => row.roleId),
        ...sodRules.flatMap((row) => [row.roleAId, row.roleBId]),
        ...controls.map((row) => row.ownerRoleId ?? null),
      ].filter((value): value is string => typeof value === "string"),
    ),
  ];
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

  // --- Quoten je Lane-Rolle (F17) ------------------------------------------
  //
  // Zwei Quoten über die Mitglieder der Lane-Rolle: abgeschlossene
  // Pflichtschulung und Kenntnisnahme einer Pflichtverteilung. Die beiden
  // `EXISTS` sind der eigentliche Punkt der Abfrage — ohne sie wäre ein
  // Mandant ohne Pflichtschulung ununterscheidbar von einem, in dem niemand
  // sie absolviert hat, und die Fläche zeigte „0 %" als Befund. Die Auswertung
  // dieser Unterscheidung steht in `ratio()` in lib/grc-overlay.ts.
  // [ARCTOS-FULL-2026-08-31 · OP-010] Die Quotenabfrage deckt jetzt beide
  // Rollenmengen ab: die Trägerrollen der Lanes UND die Rollen, die in ihnen
  // arbeiten. Ohne die zweite Menge hätte die Aufschlüsselung genau für die
  // Rollen keine Zahlen, wegen denen sie gebaut wurde.
  const laneRoleIds = [
    ...new Set(
      [
        ...lanes.map((row) => row.roleId),
        ...laneRoles.map((row) => row.roleId),
      ].filter((value): value is string => typeof value === "string"),
    ),
  ];
  const laneRatios: LaneRatioRow[] =
    laneRoleIds.length === 0
      ? []
      : rowsOf<LaneRatioRow>(
          await db.execute(
            sql`SELECT ucr.custom_role_id AS "roleId",
                       COUNT(DISTINCT ucr.user_id)::int AS "memberCount",
                       COUNT(DISTINCT ae.user_id)
                         FILTER (WHERE ae.status = 'completed')::int
                         AS "trainedCount",
                       COUNT(DISTINCT pa.user_id)
                         FILTER (WHERE pa.status = 'acknowledged')::int
                         AS "acknowledgedCount",
                       EXISTS (SELECT 1 FROM academy_course ac
                                WHERE ac.org_id = ${ctx.orgId}
                                  AND ac.is_mandatory) AS "hasMandatoryTraining",
                       EXISTS (SELECT 1 FROM policy_distribution pd
                                WHERE pd.org_id = ${ctx.orgId}
                                  AND pd.is_mandatory) AS "hasMandatoryPolicy"
                FROM user_custom_role ucr
                LEFT JOIN academy_enrollment ae
                       ON ae.user_id = ucr.user_id
                      AND ae.org_id = ${ctx.orgId}
                      AND ae.course_id IN (SELECT id FROM academy_course
                                            WHERE org_id = ${ctx.orgId}
                                              AND is_mandatory)
                LEFT JOIN policy_acknowledgment pa
                       ON pa.user_id = ucr.user_id
                      AND pa.org_id = ${ctx.orgId}
                      AND pa.distribution_id IN (SELECT id FROM policy_distribution
                                                  WHERE org_id = ${ctx.orgId}
                                                    AND is_mandatory)
                WHERE ucr.org_id = ${ctx.orgId}
                  AND ucr.custom_role_id = ANY(${laneRoleIds}::uuid[])
                GROUP BY ucr.custom_role_id
                ORDER BY ucr.custom_role_id`,
          ),
        );

  // --- Datenschutz je Schritt (0448) ---------------------------------------
  const ropa: RopaRow[] =
    empty || !want("ropa")
      ? []
      : rowsOf<RopaRow>(
          await db.execute(
            sql`SELECT r.process_step_id        AS "processStepId",
                       r.is_processing_activity AS "isProcessingActivity",
                       r.purpose                AS "purpose",
                       r.legal_basis::text      AS "legalBasis",
                       r.retention_months       AS "retentionMonths",
                       r.retention_basis        AS "retentionBasis",
                       r.requires_dpia          AS "requiresDpia",
                       r.dpia_id                AS "dpiaId",
                       d.status::text           AS "dpiaStatus",
                       r.transfer_third_country AS "transferThirdCountry",
                       r.transfer_country       AS "transferCountry",
                       r.transfer_safeguard     AS "transferSafeguard"
                FROM process_step_ropa r
                LEFT JOIN dpia d ON d.id = r.dpia_id AND d.org_id = ${ctx.orgId}
                                AND d.deleted_at IS NULL
                WHERE r.org_id = ${ctx.orgId}
                  AND r.process_step_id = ANY(${stepIds}::uuid[])
                ORDER BY r.process_step_id`,
          ),
        );

  const dataCategories: DataCategoryRow[] =
    empty || !want("ropa")
      ? []
      : rowsOf<DataCategoryRow>(
          await db.execute(
            sql`SELECT psdc.process_step_id     AS "processStepId",
                       rdc.id                   AS "id",
                       rdc.category             AS "title",
                       psdc.is_special_category AS "isSpecialCategory"
                FROM process_step_data_category psdc
                JOIN ropa_data_category rdc ON rdc.id = psdc.ropa_data_category_id
                WHERE psdc.org_id = ${ctx.orgId}
                  AND psdc.process_step_id = ANY(${stepIds}::uuid[])
                ORDER BY psdc.process_step_id, rdc.category, rdc.id`,
          ),
        );

  // Polymorph: `recipient_id` trägt keinen Fremdschlüssel (Migration 0448),
  // deshalb genau zwei LEFT JOINs und ein COALESCE über den Namen. Eine Zeile
  // ohne auflösbaren Namen fällt in der Abbildung weg — eine nackte UUID als
  // Empfänger anzuzeigen wäre schlimmer als kein Empfänger.
  const recipients: RecipientRow[] =
    empty || !want("ropa")
      ? []
      : rowsOf<RecipientRow>(
          await db.execute(
            sql`SELECT psr.process_step_id AS "processStepId",
                       psr.recipient_id    AS "id",
                       COALESCE(v.name, ou.name) AS "title"
                FROM process_step_recipient psr
                LEFT JOIN vendor v
                       ON psr.kind = 'vendor' AND v.id = psr.recipient_id
                      AND v.org_id = ${ctx.orgId} AND v.deleted_at IS NULL
                LEFT JOIN eam_org_unit ou
                       ON psr.kind = 'org_unit' AND ou.id = psr.recipient_id
                      AND ou.org_id = ${ctx.orgId}
                WHERE psr.org_id = ${ctx.orgId}
                  AND psr.process_step_id = ANY(${stepIds}::uuid[])
                ORDER BY psr.process_step_id, psr.kind, psr.recipient_id`,
          ),
        );

  // --- Kontinuität je Schritt (0449) ---------------------------------------
  const bia: BiaRow[] =
    empty || !want("bia")
      ? []
      : rowsOf<BiaRow>(
          await db.execute(
            sql`SELECT process_step_id  AS "processStepId",
                       criticality      AS "criticality",
                       mtpd_minutes     AS "mtpdMinutes",
                       rto_minutes      AS "rtoMinutes",
                       rpo_minutes      AS "rpoMinutes",
                       workaround       AS "workaround",
                       workaround_max_duration_minutes
                         AS "workaroundMaxDurationMinutes"
                FROM process_step_bia
                WHERE org_id = ${ctx.orgId}
                  AND process_step_id = ANY(${stepIds}::uuid[])
                ORDER BY process_step_id`,
          ),
        );

  // --- Dokumente je Schritt (0450) -----------------------------------------
  const documents: DocumentRow[] =
    empty || !want("document")
      ? []
      : rowsOf<DocumentRow>(
          await db.execute(
            sql`SELECT psd.process_step_id AS "processStepId",
                       d.id                AS "id",
                       d.title             AS "title"
                FROM process_step_document psd
                JOIN document d ON d.id = psd.document_id AND d.deleted_at IS NULL
                WHERE psd.org_id = ${ctx.orgId}
                  AND psd.process_step_id = ANY(${stepIds}::uuid[])
                ORDER BY psd.process_step_id, d.title, d.id`,
          ),
        );

  // --- Conformance (0451) --------------------------------------------------
  //
  // Genommen wird das zuletzt importierte Ereignisprotokoll dieses Prozesses —
  // dieselbe Regel wie beim Simulationsszenario. Über mehrere Protokolle zu
  // mitteln ergäbe eine Quote, die in keinem Protokoll steht.
  //
  // `reworkLoops` = Fälle, in denen die Aktivität MEHR ALS EINMAL vorkommt.
  // Das ist aus `process_event` unmittelbar zählbar. `meanDurationMinutes` und
  // `isBottleneck` sind es nicht (ein Zeitstempel je Ereignis, kein
  // Lebenszyklus) und bleiben deshalb weg — siehe MISSING_TODAY.
  const conformanceElements: ConformanceElementRow[] =
    empty || !want("conformance")
      ? []
      : rowsOf<ConformanceElementRow>(
          await db.execute(
            sql`WITH log AS (
                  SELECT id FROM process_event_log
                   WHERE org_id = ${ctx.orgId} AND process_id = ${processId}
                   ORDER BY imported_at DESC, id DESC LIMIT 1
                ),
                mapped AS (
                  SELECT m.activity_name, m.process_step_id, m.match_kind
                    FROM process_event_activity_map m
                    JOIN log ON log.id = m.event_log_id
                   WHERE m.org_id = ${ctx.orgId}
                     AND m.process_step_id = ANY(${stepIds}::uuid[])
                ),
                per_case AS (
                  SELECT mp.process_step_id AS step_id,
                         e.case_id,
                         COUNT(*)::int AS occurrences
                    FROM process_event e
                    JOIN log ON log.id = e.event_log_id
                    JOIN mapped mp ON mp.activity_name = e.activity
                   WHERE e.org_id = ${ctx.orgId}
                   GROUP BY mp.process_step_id, e.case_id
                ),
                agg AS (
                  SELECT step_id,
                         COUNT(*)::int AS cases,
                         COUNT(*) FILTER (WHERE occurrences > 1)::int AS rework
                    FROM per_case GROUP BY step_id
                )
                SELECT m.process_step_id AS "processStepId",
                       (ARRAY_AGG(m.match_kind ORDER BY
                          CASE m.match_kind
                            WHEN 'exact' THEN 0 WHEN 'manual' THEN 1
                            WHEN 'normalized' THEN 2 WHEN 'fuzzy' THEN 3
                            ELSE 4 END))[1]              AS "matchKind",
                       COALESCE(MAX(a.cases), 0)::int    AS "observedCases",
                       COALESCE(MAX(a.rework), 0)::int   AS "reworkLoops"
                  FROM mapped m
                  LEFT JOIN agg a ON a.step_id = m.process_step_id
                 GROUP BY m.process_step_id
                 ORDER BY m.process_step_id`,
          ),
        );

  // Die Abdeckungsquote — ohne sie verweigert `conformanceGate` die Heatmap
  // ausdrücklich, und genau deshalb wird sie hier gemessen und nicht
  // geschätzt: gezählte Ereignisse mit Zuordnung durch gezählte Ereignisse.
  const conformanceSummary: ConformanceSummaryRow | undefined = !want(
    "conformance",
  )
    ? undefined
    : rowsOf<ConformanceSummaryRow>(
        await db.execute(
          sql`WITH log AS (
                SELECT id FROM process_event_log
                 WHERE org_id = ${ctx.orgId} AND process_id = ${processId}
                 ORDER BY imported_at DESC, id DESC LIMIT 1
              ),
              totals AS (
                SELECT COUNT(*)::int AS events,
                       COUNT(DISTINCT e.case_id)::int AS traces
                  FROM process_event e JOIN log ON log.id = e.event_log_id
                 WHERE e.org_id = ${ctx.orgId}
              ),
              matched AS (
                SELECT COUNT(*)::int AS events
                  FROM process_event e
                  JOIN log ON log.id = e.event_log_id
                  JOIN process_event_activity_map m
                    ON m.event_log_id = e.event_log_id
                   AND m.activity_name = e.activity
                   AND m.process_step_id IS NOT NULL
                 WHERE e.org_id = ${ctx.orgId} AND m.org_id = ${ctx.orgId}
              ),
              unmapped AS (
                SELECT ARRAY_AGG(DISTINCT e.activity) AS names
                  FROM process_event e
                  JOIN log ON log.id = e.event_log_id
                  LEFT JOIN process_event_activity_map m
                    ON m.event_log_id = e.event_log_id
                   AND m.activity_name = e.activity
                   AND m.process_step_id IS NOT NULL
                 WHERE e.org_id = ${ctx.orgId} AND m.id IS NULL
              )
              SELECT CASE WHEN totals.events > 0
                          THEN matched.events::float8 / totals.events
                     END                                   AS "coverageRatio",
                     COALESCE(unmapped.names, ARRAY[]::varchar[])
                                                           AS "unmappedActivities",
                     NULLIF(totals.traces, 0)              AS "totalTraces",
                     (SELECT r.conformant_traces
                        FROM process_conformance_result r
                        JOIN log ON log.id = r.event_log_id
                       WHERE r.org_id = ${ctx.orgId}
                       ORDER BY r.computed_at DESC LIMIT 1) AS "conformantTraces"
                FROM totals, matched, unmapped`,
        ),
      )[0];

  // --- Beobachtete Übergänge (F7/B4, Migration 0476) -----------------------
  //
  // [ARCTOS-FULL-2026-08-31 · OP-012] Aus demselben Ereignisprotokoll wie die
  // Zusammenfassung darüber — dem zuletzt importierten. Zwei Protokolle
  // nebeneinander zu addieren wäre eine Häufigkeit über zwei verschiedene
  // Zeiträume unter einem Namen.
  //
  // Ohne die Gruppe `conformance` wird gar nicht gefragt: die Kantenkennzahl
  // ist Teil derselben Aussage, und `?layers=` soll wirklich weniger abfragen
  // und nicht nur weniger ausliefern.
  const transitions: TransitionRow[] = !want("conformance")
    ? []
    : rowsOf<TransitionRow>(
        await db.execute(
          sql`WITH log AS (
                SELECT id FROM process_event_log
                 WHERE org_id = ${ctx.orgId} AND process_id = ${processId}
                 ORDER BY imported_at DESC, id DESC LIMIT 1
              )
              SELECT t.from_element_id AS "fromElementId",
                     t.to_element_id   AS "toElementId",
                     t.frequency       AS "frequency",
                     t.probability::float8 AS "probability",
                     t.is_modelled     AS "isModelled"
                FROM process_event_transition_map t
                JOIN log ON log.id = t.event_log_id
               WHERE t.org_id = ${ctx.orgId}
               ORDER BY t.frequency DESC, t.from_element_id, t.to_element_id`,
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
            // [ARCTOS-FULL-2026-08-31 · OP-015] `catalog.name` ist der
            // Anzeigename, den `frameworkName` meint. Er stand die ganze Zeit
            // bereit — die Zuordnungstabelle trägt `catalog_id` seit jeher —,
            // nur hat ihn niemand gelesen, und der Chip zeigte den Code.
            // LEFT JOIN, weil die Spalte nullable ist: eine Zuordnung ohne
            // Katalogbezug behält den Code und verliert nichts.
            // `catalog` ist plattformweit (kein `org_id`), deshalb keine
            // Mandantenbedingung — eine hier wäre eine Bedingung auf eine
            // Spalte, die es nicht gibt.
            sql`SELECT pfm.process_step_id AS "processStepId",
                       pfm.id,
                       pfm.framework_code   AS "frameworkCode",
                       pfm.entry_code       AS "entryCode",
                       pfm.entry_title      AS "entryTitle",
                       pfm.mapping_strength AS "mappingStrength",
                       cat.name             AS "frameworkName"
                FROM process_framework_mapping pfm
                LEFT JOIN catalog cat ON cat.id = pfm.catalog_id
                WHERE pfm.org_id = ${ctx.orgId}
                  AND pfm.process_id = ${processId}
                  AND pfm.process_step_id = ANY(${stepIds}::uuid[])
                ORDER BY pfm.process_step_id, pfm.framework_code,
                         pfm.entry_code, pfm.id`,
          ),
        );

  // --- Rahmenwerkauswahl der Sicht F8 (OP-016) -----------------------------
  //
  // Reihenfolge: ausdrücklicher Parameter vor gespeicherter Wahl. Der
  // Parameter ist die Frage eines einzelnen Aufrufs, die Voreinstellung die
  // Arbeitsweise eines Nutzers — eine Voreinstellung, die eine ausdrückliche
  // Angabe überstimmt, wäre ein Werkzeug, das nicht tut, was man ihm sagt.
  //
  // Die Voreinstellung wird nur gelesen, wenn die Gruppe `framework`
  // überhaupt gewollt ist: ein `?layers=lane` soll drei Abfragen machen und
  // nicht vier (der Zähltest in `process-diagram-overlay.test.ts` hält das
  // fest).
  let frameworkSelection: string | undefined = parsed.data.framework;
  if (frameworkSelection === undefined && want("framework")) {
    const stored = firstRowOf<{ frameworkCode: string | null }>(
      await db.execute(
        sql`SELECT framework_code AS "frameworkCode"
              FROM user_diagram_preference
             WHERE org_id = ${ctx.orgId}
               AND user_id = ${ctx.userId}
               AND scope = 'default'
             LIMIT 1`,
      ),
    );
    frameworkSelection = stored?.frameworkCode ?? undefined;
  }
  // Der Anzeigename kommt aus denselben Zeilen, die ohnehin geladen sind —
  // eine zweite Abfrage gegen `catalog` wäre eine Abfrage für ein Wort. Findet
  // sich der Code an keinem Schritt dieses Prozesses, bleibt der Name weg:
  // `summarizeFramework` fällt dann auf den Code zurück, und die Kopfzeile
  // nennt ehrlich „0 Anforderungen" statt eines Namens ohne Deckung.
  const frameworkName = frameworkSelection
    ? frameworks.find(
        (row) => row.frameworkCode === frameworkSelection && row.frameworkName,
      )?.frameworkName
    : undefined;

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

  // --- Risikoindikatoren am Schritt (F15) ----------------------------------
  //
  // [ARCTOS-FULL-2026-08-31 · OP-008] Der Bezug zum Schritt läuft über das
  // RISIKO, nicht über eine eigene Spalte: ein KRI ist das Frühwarnsignal
  // eines Risikos (`kri.risk_id`), und welche Risiken an einem Schritt hängen,
  // sagt `process_step_risk`. Eine zusätzliche Spalte `kri.process_step_id`
  // wäre eine zweite Zuordnung neben einer vorhandenen — und die erste
  // Anwendung, die nur eine der beiden pflegt, ließe die Ampel am falschen
  // Schritt stehen.
  //
  // `hasThresholds` wird hier gebildet, weil nur diese eine Aussage gebraucht
  // wird; die drei Schwellenwerte selbst wandern nicht durch die Antwort.
  const kris: KriRow[] =
    empty || !want("kri")
      ? []
      : rowsOf<KriRow>(
          await db.execute(
            sql`SELECT psr.process_step_id  AS "processStepId",
                       k.id,
                       k.name,
                       k.unit,
                       k.direction::text    AS "direction",
                       k.current_value::float8 AS "value",
                       k.current_alert_status::text AS "alertStatus",
                       k.trend::text        AS "trend",
                       ${TS("k.last_measured_at")} AS "measuredAt",
                       k.measurement_frequency::text AS "frequency",
                       (k.threshold_green IS NOT NULL
                        AND k.threshold_yellow IS NOT NULL
                        AND k.threshold_red IS NOT NULL) AS "hasThresholds",
                       k.risk_id            AS "riskId"
                FROM process_step_risk psr
                JOIN kri k ON k.risk_id = psr.risk_id
                          AND k.org_id = ${ctx.orgId}
                          AND k.deleted_at IS NULL
                WHERE psr.org_id = ${ctx.orgId}
                  AND psr.process_step_id = ANY(${stepIds}::uuid[])
                ORDER BY psr.process_step_id, k.name, k.id`,
          ),
        );

  // --- Vorfälle am Schritt (F14, Migration 0454) ---------------------------
  //
  // [ARCTOS-FULL-2026-08-31 · OP-004] `isOpen` wird HIER entschieden, nicht in
  // der Zeichenschicht: `incident_status` hat sieben Stufen, und welche davon
  // als abgeschlossen gilt, ist eine fachliche Festlegung. Sie lautet: der
  // Vorfall ist abgeschlossen, wenn `closed_at` steht UND der Status `closed`
  // ist. Beide Bedingungen zusammen, weil ein Status ohne Zeitstempel (und
  // umgekehrt) vorkommt — und ein solcher Widerspruch zählt als **offen**.
  // Fehlende Daten sind keine Entwarnung; dieselbe Regel wie bei F1 für ein
  // Risiko ohne Kontrollverknüpfung (STUFE2-A2-GRC.md §7.4).
  //
  // Abgeschlossene Vorfälle werden mitgeliefert, nicht weggefiltert: der
  // Schritt, an dem im Frühjahr etwas passiert ist, sieht sonst aus wie der,
  // an dem nie etwas war. Die Begrenzung liegt bei der Zeit, nicht beim
  // Status — ein Vorfall von vor drei Jahren sagt über den heutigen Prozess
  // wenig, und eine unbegrenzte Liste macht aus dem Badge einen Zähler der
  // Firmengeschichte.
  const incidents: IncidentRow[] =
    empty || !want("incident")
      ? []
      : rowsOf<IncidentRow>(
          await db.execute(
            sql`SELECT process_step_id AS "processStepId",
                       id,
                       title,
                       severity::text  AS "severity",
                       status::text    AS "status",
                       (closed_at IS NULL OR status <> 'closed') AS "isOpen",
                       ${TS("detected_at")} AS "detectedAt",
                       is_data_breach  AS "isDataBreach"
                FROM security_incident
                WHERE org_id = ${ctx.orgId}
                  AND deleted_at IS NULL
                  AND process_step_id = ANY(${stepIds}::uuid[])
                  AND (closed_at IS NULL
                       OR closed_at > now() - interval '24 months')
                ORDER BY process_step_id, detected_at DESC, id`,
          ),
        );

  // --- Offene Maßnahmen am Schritt (F16, Migration 0454) -------------------
  //
  // [ARCTOS-FULL-2026-08-31 · OP-005] Anders als bei den Vorfällen wird hier
  // gefiltert: geliefert werden nur die **offenen**. Eine erledigte Maßnahme
  // ist kein Ereignis am Schritt, sondern eine Aufgabe, die vom Tisch ist —
  // sie im Diagramm mitzuzählen machte aus „drei offene Maßnahmen" mit der
  // Zeit „siebzehn Maßnahmen", und die Zahl verlöre ihren Sinn.
  //
  // `completed`, `obsolete` und `cancelled` sind die drei Endzustände von
  // `work_item_status_generic`; `completed_at` deckt den Fall ab, dass jemand
  // den Abschluss datiert, ohne den Status zu setzen.
  const workItems: WorkItemRow[] =
    empty || !want("work-item")
      ? []
      : rowsOf<WorkItemRow>(
          await db.execute(
            sql`SELECT wi.process_step_id AS "processStepId",
                       wi.id,
                       wi.name,
                       wi.status::text    AS "status",
                       wi.type_key        AS "typeKey",
                       ${TS("wi.due_date")} AS "dueAt",
                       u.name             AS "responsibleName"
                FROM work_item wi
                LEFT JOIN "user" u ON u.id = wi.responsible_id
                WHERE wi.org_id = ${ctx.orgId}
                  AND wi.deleted_at IS NULL
                  AND wi.completed_at IS NULL
                  AND wi.status NOT IN ('completed', 'obsolete', 'cancelled')
                  AND wi.process_step_id = ANY(${stepIds}::uuid[])
                ORDER BY wi.process_step_id, wi.due_date NULLS LAST, wi.id`,
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
      kris,
      incidents,
      workItems,
      lanes,
      laneRatios,
      laneRoles,
      raci,
      sodRules,
      ropa,
      dataCategories,
      recipients,
      bia,
      documents,
      conformanceElements,
      conformanceSummary,
      transitions,
    },
    {
      computedAt,
      processId,
      processName: proc.name ?? undefined,
      versionId,
      // Kurz genug, dass ein Kontrollwechsel im Diagramm ankommt, lang genug,
      // dass Zoomen und Sichtwechsel den Endpunkt nicht erneut befragen.
      ttlSeconds: 60,
      // Die Ausfallsimulation ist eine Auswahl des Betrachters. Sie wird nur
      // durchgereicht, wenn der Aufrufer sie nennt — sonst kein
      // `diagram.outage`, und der Layer schweigt.
      outage: parsed.data.outage
        ? {
            assetId: parsed.data.outage,
            ...(parsed.data.outageElapsed !== undefined
              ? { elapsedMinutes: parsed.data.outageElapsed }
              : {}),
          }
        : undefined,
      // [ARCTOS-FULL-2026-08-31 · OP-016] Ohne Auswahl kein
      // `diagram.framework` — dann rechnet `summarizeFramework` nichts und
      // die Kopfzeile schweigt, statt einen Abdeckungsgrad über „alle
      // Rahmenwerke zusammen" zu zeigen, den kein Prüfer je verlangt hat.
      framework: frameworkSelection
        ? {
            frameworkId: frameworkSelection,
            ...(frameworkName ? { frameworkName } : {}),
          }
        : undefined,
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
