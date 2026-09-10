// sync-process-lanes.ts — schreibt die aus dem BPMN-XML gelesenen Lanes und
// Pools nach `process_lane` und setzt `process_step.lane_step_id`.
//
// [ARCTOS-FULL-2026-08-31 · OP-002] Der Schreibpfad, den es bisher nicht gab.
// Die Begruendung, warum die Zuordnung aus dem Modell und nicht aus der
// Geometrie kommt, steht in `bpmn-lanes.ts`.
//
// ── Die eine nicht offensichtliche Entscheidung ────────────────────────────
//
// **Der Import ueberschreibt den Traeger einer Lane nicht.** Rolle,
// Organisationseinheit, Dienstleister, `is_external` und `third_country` sind
// genau die Angaben, die im XML **nicht** stehen — sie werden in der
// Pflegemaske (OP-001) gesetzt und sind der Grund, aus dem F5 ueberhaupt eine
// Vertrauensgrenze zeichnen kann. Ein `INSERT … ON CONFLICT DO UPDATE`, das
// sie mitschreibt, loeschte bei jedem Speichern einer Version die Aussage
// „diese Lane wird von Dienstleister X in einem Drittland betrieben" — ein
// Compliance-Befund, den niemand aufgehoben hat. Aktualisiert werden deshalb
// nur `name`, `kind` und `sequence_order`: die drei Angaben, die tatsaechlich
// aus dem XML stammen.
//
// **Aus demselben Grund wird eine verschwundene Lane nur dann geloescht, wenn
// sie keinen Traeger traegt.** `process_lane` kennt kein `deleted_at` (0444),
// und ein hartes DELETE auf einer Zeile mit Dienstleister waere derselbe
// stille Verlust. Zeilen mit Traeger bleiben stehen und werden als
// `orphaned` zurueckgemeldet; die Pflegemaske zeigt sie als „nicht mehr im
// Diagramm" an, damit jemand entscheiden kann. Kommt die Lane unter derselben
// BPMN-ID zurueck — der Normalfall nach einem Round-Trip durch ein fremdes
// Werkzeug —, ist ihr Traeger noch da.

import { sql, type SQL } from "drizzle-orm";
import { assignLaneMembership, parseBpmnLanes } from "./bpmn-lanes";

interface SqlExecutor {
  execute(query: SQL): Promise<unknown>;
}

export interface LaneSyncStats {
  /** Neu angelegte `process_lane`-Zeilen. */
  lanesInserted: number;
  /** Vorhandene Zeilen, deren Name/Art/Reihenfolge nachgezogen wurde. */
  lanesUpdated: number;
  /** Geloeschte Zeilen (nur traegerlose). */
  lanesDeleted: number;
  /** Zeilen, die nicht mehr im XML stehen, aber einen Traeger fuehren. */
  orphaned: number;
  /** Schritte, deren `lane_step_id` gesetzt oder geaendert wurde. */
  stepsAssigned: number;
  /** Schritte, deren `lane_step_id` auf NULL zurueckfiel. */
  stepsCleared: number;
  /**
   * BPMN-IDs, die von mehreren Lanes derselben Tiefe beansprucht werden.
   * Im Modell ein Widerspruch; gemeldet statt verschluckt.
   */
  ambiguous: string[];
}

function rowsOf<T>(result: unknown): T[] {
  const r = result as { rows?: T[] } | T[];
  return Array.isArray(r) ? r : (r.rows ?? []);
}

/**
 * Bringt `process_lane` und `process_step.lane_step_id` mit dem BPMN-XML in
 * Deckung.
 *
 * Wirft nicht bei einem Diagramm ohne Lanes — das ist der Normalfall eines
 * einfachen Prozesses. Wirft bei unlesbarem XML; die Aufrufer behandeln das
 * als nicht blockierend (der Versionsstand ist bereits gespeichert).
 */
export async function syncProcessLanes(args: {
  tx: SqlExecutor;
  processId: string;
  orgId: string;
  userId: string;
  bpmnXml: string;
  /** BPMN-Element-ID → `process_step.id`, bereits nachgeladen. */
  stepIdByBpmnElement: Map<string, string>;
}): Promise<LaneSyncStats> {
  const stats: LaneSyncStats = {
    lanesInserted: 0,
    lanesUpdated: 0,
    lanesDeleted: 0,
    orphaned: 0,
    stepsAssigned: 0,
    stepsCleared: 0,
    ambiguous: [],
  };

  const parsed = parseBpmnLanes(args.bpmnXml);
  const { laneByFlowNode, ambiguous } = assignLaneMembership(parsed);
  stats.ambiguous = ambiguous;

  // ── 1. Bestand lesen ────────────────────────────────────────────────────
  const existing = rowsOf<{
    id: string;
    bpmnElementId: string;
    hasCarrier: boolean;
  }>(
    await args.tx.execute(sql`
      SELECT id,
             bpmn_element_id AS "bpmnElementId",
             (org_unit_id IS NOT NULL
              OR custom_role_id IS NOT NULL
              OR vendor_id IS NOT NULL
              OR is_external
              OR third_country IS NOT NULL) AS "hasCarrier"
        FROM process_lane
       WHERE org_id = ${args.orgId} AND process_id = ${args.processId}`),
  );
  const idByElement = new Map(existing.map((r) => [r.bpmnElementId, r.id]));

  // ── 2. Einfuegen bzw. Name/Art/Reihenfolge nachziehen ───────────────────
  for (const lane of parsed.lanes) {
    if (idByElement.has(lane.bpmnElementId)) {
      await args.tx.execute(sql`
        UPDATE process_lane
           SET name           = ${lane.name},
               kind           = ${lane.kind},
               sequence_order = ${lane.sequenceOrder},
               updated_at     = now(),
               updated_by     = ${args.userId}::uuid
         WHERE id = ${idByElement.get(lane.bpmnElementId)}::uuid`);
      stats.lanesUpdated++;
      continue;
    }
    const inserted = rowsOf<{ id: string }>(
      await args.tx.execute(sql`
        INSERT INTO process_lane
              (org_id, process_id, bpmn_element_id, name, kind,
               sequence_order, created_by, updated_by)
        VALUES (${args.orgId}::uuid, ${args.processId}::uuid,
                ${lane.bpmnElementId}, ${lane.name}, ${lane.kind},
                ${lane.sequenceOrder}, ${args.userId}::uuid, ${args.userId}::uuid)
        RETURNING id`),
    );
    if (inserted[0]) {
      idByElement.set(lane.bpmnElementId, inserted[0].id);
      stats.lanesInserted++;
    }
  }

  // ── 3. Verschachtelung (parent_lane_id) in einem zweiten Durchgang ──────
  //
  // Zwei Durchgaenge, weil eine Unterlane vor ihrer Oberlane im Dokument
  // stehen darf und der Fremdschluessel sonst ins Leere zeigte.
  for (const lane of parsed.lanes) {
    const selfId = idByElement.get(lane.bpmnElementId);
    if (!selfId) continue;
    const parentId = lane.parentBpmnElementId
      ? (idByElement.get(lane.parentBpmnElementId) ?? null)
      : null;
    await args.tx.execute(sql`
      UPDATE process_lane
         SET parent_lane_id = ${parentId}::uuid
       WHERE id = ${selfId}::uuid
         AND parent_lane_id IS DISTINCT FROM ${parentId}::uuid`);
  }

  // ── 4. Verschwundene Lanes ──────────────────────────────────────────────
  const stillPresent = new Set(parsed.lanes.map((l) => l.bpmnElementId));
  for (const row of existing) {
    if (stillPresent.has(row.bpmnElementId)) continue;
    if (row.hasCarrier) {
      stats.orphaned++;
      continue;
    }
    await args.tx.execute(sql`
      DELETE FROM process_lane
       WHERE id = ${row.id}::uuid AND org_id = ${args.orgId}::uuid`);
    stats.lanesDeleted++;
  }

  // ── 5. Zuordnung der Schritte ───────────────────────────────────────────
  //
  // Ein Schritt ohne Lane bekommt ausdruecklich NULL zurueck. Die alte
  // Zuordnung stehenzulassen waere schlimmer als keine: sie sieht wie eine
  // Aussage aus, obwohl das Modell sie nicht mehr traegt.
  for (const [elementId, stepId] of args.stepIdByBpmnElement) {
    const laneElement = laneByFlowNode.get(elementId);
    const laneId = laneElement ? (idByElement.get(laneElement) ?? null) : null;
    const result = await args.tx.execute(sql`
      UPDATE process_step
         SET lane_step_id = ${laneId}::uuid,
             updated_at   = now()
       WHERE id = ${stepId}::uuid
         AND org_id = ${args.orgId}::uuid
         AND lane_step_id IS DISTINCT FROM ${laneId}::uuid
      RETURNING id`);
    if (rowsOf<{ id: string }>(result).length === 0) continue;
    if (laneId) stats.stepsAssigned++;
    else stats.stepsCleared++;
  }

  return stats;
}

/**
 * Dieselbe Synchronisation, aber ausgehend vom **aktuell gültigen**
 * Versionsstand des Prozesses.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-002] Gebraucht für den dritten Schreibpfad:
 * `promoteWorkingVersion()` (`@/lib/process-working-version`) zieht beim
 * Freigeben bzw. Veröffentlichen die Arbeitskopie zur freigegebenen Version
 * hoch und synchronisiert dabei `process_step` — die Lanes aber nicht, und die
 * Datei liegt in fremder Dateihoheit. Statt sie anzufassen, rufen die beiden
 * aufrufenden Routen (`status`, `approval-steps/[stepId]/decide`) diese
 * Funktion unmittelbar nach der Beförderung auf. Ohne sie zeigte die
 * Lane-Tabelle nach jeder Freigabe den Stand *vor* der Arbeitskopie.
 *
 * Liefert `null`, wenn der Prozess keinen Versionsstand mit XML hat.
 */
export async function syncLanesFromCurrentVersion(args: {
  tx: SqlExecutor;
  processId: string;
  orgId: string;
  userId: string;
}): Promise<LaneSyncStats | null> {
  const versions = rowsOf<{ bpmnXml: string | null }>(
    await args.tx.execute(sql`
      SELECT bpmn_xml AS "bpmnXml"
        FROM process_version
       WHERE process_id = ${args.processId}::uuid
         AND org_id = ${args.orgId}::uuid
         AND is_current
       ORDER BY version_number DESC
       LIMIT 1`),
  );
  const bpmnXml = versions[0]?.bpmnXml;
  if (!bpmnXml) return null;

  const steps = rowsOf<{ id: string; bpmnElementId: string }>(
    await args.tx.execute(sql`
      SELECT id, bpmn_element_id AS "bpmnElementId"
        FROM process_step
       WHERE process_id = ${args.processId}::uuid
         AND org_id = ${args.orgId}::uuid
         AND deleted_at IS NULL`),
  );

  return syncProcessLanes({
    tx: args.tx,
    processId: args.processId,
    orgId: args.orgId,
    userId: args.userId,
    bpmnXml,
    stepIdByBpmnElement: new Map(steps.map((s) => [s.bpmnElementId, s.id])),
  });
}
