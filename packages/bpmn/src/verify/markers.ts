/**
 * [ARCTOS-FULL-2026-08-31 · OP-011] Von Prüfbefund zu Diagrammmarker.
 *
 * Die Sicht „Modellierung" (`src/grc/views.ts`) hatte den Slot für den
 * Validierungsmarker seit `STUFE2-A2-GRC.md` §6 frei — mit der Begründung „die
 * Validierung gehört `src/verify/`". Genau hier steht sie jetzt: die
 * Übersetzung der beiden Prüfwerkzeuge auf die eine Form, die der Layer liest
 * (`GrcValidationFinding`).
 *
 * **Warum die Übersetzung hier liegt und nicht in `src/grc/`.**
 *
 * - Die Zeichenschicht darf nicht von einem Prüfwerkzeug abhängen. Sie
 *   deklariert eine Form und liest, was ihr beigelegt wird; welche Werkzeuge
 *   es gibt und wie deren Befunde heißen, ist ihr gleichgültig. Ein Import in
 *   die andere Richtung fixierte die Schicht auf das heutige Werkzeug.
 * - `src/verify/` wird von `src/index.ts` bewusst **nicht** re-exportiert (siehe
 *   dessen Kopf): die Prüffläche gehört in kein Anwendungsbündel. Ein Modul
 *   hier kostet also nichts, solange eine Anwendung es nicht importiert.
 *
 * **Wer ruft das im Betrieb?** Der Modellierer — die Fläche, die den
 * moddle-Baum ohnehin hält. Für Befunde aus `src/modeling/invariants.ts`
 * (dieses Modul IST gebündelt) gibt es {@link fromInvariantViolations}; sie
 * kommt ohne diese Datei aus, ist aber hier mitdokumentiert, damit beide Wege
 * an einer Stelle nachlesbar sind.
 *
 * **Die eine fachliche Entscheidung: welcher Befund ist ein Fehler.** Sie steht
 * in {@link INVARIANT_SEVERITY} und folgt derselben Zweiteilung, die
 * `src/verify/invariants.ts` in seinem Kopf beschreibt: `error` heißt, das
 * Dokument ist kaputt und verliert beim nächsten Speichern still Angaben;
 * `warning` heißt, es ist legales BPMN mit einem starken Geruch. Die Liste ist
 * ausdrücklich vollständig aufgeführt statt über ein Muster geraten — ein
 * neuer Code muss eingeordnet werden, und der Wächtertest sagt es, wenn es
 * jemand vergisst.
 */

import type { InvariantCode } from "../modeling/invariants";
import type { GrcValidationFinding } from "../grc/contract";
import type { InvariantViolation as VerifyViolation } from "./invariants";
import type { SchemaFinding } from "./schema";

/** Die Befundform der Modellierungsschicht — strukturell, nicht importiert. */
export interface ModelingViolationLike {
  readonly code: string;
  readonly message: string;
  readonly elementId?: string | undefined;
}

/**
 * Einordnung jedes `InvariantCode` (src/modeling/invariants.ts).
 *
 * `error` = Referenz zeigt ins Leere, ID doppelt, Grafik ohne Semantik. Was
 * `bpmn-moddle` beim nächsten Speichern nicht auflösen kann, fällt weg — das
 * ist stiller Datenverlust und keine Stilfrage.
 *
 * `warning` = das Dokument bleibt lesbar, aber etwas stimmt nicht: fehlende
 * oder abweichende Geometrie, ein Element ohne DI in einem Diagramm, das sonst
 * DI hat. Fremde Werkzeuge legen es dann irgendwo hin, und der Modellierer
 * findet sein Diagramm nicht wieder.
 */
export const INVARIANT_SEVERITY: Readonly<
  Record<InvariantCode, GrcValidationFinding["severity"]>
> = {
  // Baum 1 ↔ Baum 3
  GRAPHIC_WITHOUT_SEMANTIC: "error",
  GRAPHIC_SEMANTIC_NOT_IN_DOCUMENT: "error",
  SEMANTIC_WITHOUT_GRAPHIC: "warning",
  GRAPHIC_ID_MISMATCH: "error",
  // Baum 2 (DI)
  DI_WITHOUT_BPMN_ELEMENT: "error",
  DI_ORPHANED: "error",
  DI_DUPLICATE: "error",
  DI_MISSING: "warning",
  DI_BOUNDS_INVALID: "warning",
  DI_WAYPOINTS_INVALID: "warning",
  DI_BOUNDS_MISMATCH: "warning",
  DI_WAYPOINTS_MISMATCH: "warning",
  DI_NOT_IN_PLANE: "warning",
  // Referenzen im semantischen Baum
  FLOW_WITHOUT_SOURCE: "error",
  FLOW_WITHOUT_TARGET: "error",
  FLOW_SOURCE_NOT_IN_DOCUMENT: "error",
  FLOW_TARGET_NOT_IN_DOCUMENT: "error",
  OUTGOING_MISSING: "error",
  INCOMING_MISSING: "error",
  OUTGOING_STALE: "error",
  INCOMING_STALE: "error",
  DEFAULT_FLOW_DANGLING: "error",
  DATA_ASSOCIATION_DANGLING: "error",
  // Containment
  NODE_IN_TWO_CONTAINERS: "error",
  PARENT_LINK_BROKEN: "error",
  CONTAINER_MISMATCH: "error",
  // IDs
  DUPLICATE_ID: "error",
  MISSING_ID: "error",
  // Lanes
  LANE_REF_NOT_IN_DOCUMENT: "error",
  LANE_REF_FOREIGN_PROCESS: "error",
  LANE_REF_DUPLICATE: "error",
  LANE_REF_NOT_A_FLOWNODE: "error",
  // Boundary Events
  BOUNDARY_WITHOUT_HOST: "error",
  BOUNDARY_HOST_NOT_ACTIVITY: "error",
  BOUNDARY_HOST_MISMATCH: "error",
  BOUNDARY_HOST_FOREIGN_CONTAINER: "error",
  // Kollaboration
  PARTICIPANT_PROCESS_MISSING: "error",
  MESSAGE_FLOW_OUTSIDE_COLLABORATION: "warning",
};

/**
 * Befunde der Modellierungsschicht (`src/modeling/invariants.ts`).
 *
 * Ein unbekannter Code wird `error` und **nicht** `warning`: eine Regel, die
 * niemand eingeordnet hat, als harmlos anzuzeigen wäre genau die Entwarnung,
 * die dieser Layer nicht geben darf. Sie fällt dann im Diagramm auf, und das
 * ist die Absicht.
 */
export function fromInvariantViolations(
  violations: readonly ModelingViolationLike[],
): readonly GrcValidationFinding[] {
  return violations.map((violation) => {
    const severity =
      INVARIANT_SEVERITY[violation.code as InvariantCode] ?? "error";
    const finding: {
      rule: string;
      severity: GrcValidationFinding["severity"];
      message: string;
      elementId?: string;
    } = {
      rule: violation.code,
      severity,
      message: violation.message,
    };
    if (violation.elementId !== undefined) {
      finding.elementId = violation.elementId;
    }
    return finding;
  });
}

/**
 * Befunde des Dokumentenprüfers (`src/verify/invariants.ts`).
 *
 * Der trägt seine Zweiteilung schon selbst (`severity: "error" | "warning"`);
 * hier wird nur umbenannt, nicht neu bewertet — zwei Einstufungen derselben
 * Regel an zwei Stellen wären genau die zweite Wahrheit, gegen die dieser
 * Audit an vielen Stellen argumentiert.
 */
export function fromVerifyViolations(
  violations: readonly VerifyViolation[],
): readonly GrcValidationFinding[] {
  return violations.map((violation) => {
    const finding: {
      rule: string;
      severity: GrcValidationFinding["severity"];
      message: string;
      elementId?: string;
    } = {
      rule: violation.id,
      severity: violation.severity,
      message: violation.message,
    };
    if (violation.elementId !== undefined) {
      finding.elementId = violation.elementId;
    }
    return finding;
  });
}

/**
 * Befunde der lexikalischen Schemaprüfung (`src/verify/schema.ts`, OP-043).
 *
 * Alle vier Arten sind `warning`: das Dokument ist lesbar, die
 * Referenzintegrität ist unberührt, und ein unbekanntes Attribut aus einer
 * fremden Erweiterung ist kein Datenverlust. Ein Befund ohne `elementId`
 * (das Schema kennt nur die Zeile) bekommt **keine** erfundene Zuordnung —
 * er bleibt ohne Element und wird an keinem Shape gezeichnet; die Zeile steht
 * in der Meldung.
 */
export function fromSchemaFindings(
  findings: readonly SchemaFinding[],
): readonly GrcValidationFinding[] {
  return findings.map((schemaFinding) => {
    const finding: {
      rule: string;
      severity: GrcValidationFinding["severity"];
      message: string;
      elementId?: string;
    } = {
      rule: schemaFinding.kind,
      severity: "warning",
      message: `${schemaFinding.detail} (Zeile ${String(schemaFinding.line)})`,
    };
    if (schemaFinding.elementId !== undefined) {
      finding.elementId = schemaFinding.elementId;
    }
    return finding;
  });
}
