/**
 * Der Rechenkern des Overlay-Endpunkts aus Plan §3.3.6.
 *
 * `GET /api/v1/processes/:id/diagram-overlay` liefert genau die Nutzlast, die
 * die GRC-Diagrammschicht erwartet (`packages/bpmn/src/grc/contract.ts`,
 * beschrieben in `docs/bpmn-engine/STUFE2-A2-GRC.md` §4.1). Diese Datei enthält
 * die **reine** Abbildung von Datenbankzeilen auf `GrcOverlayData` — kein
 * `fetch`, kein Drizzle, kein `Date.now()`. Die Route daneben tut nichts
 * anderes, als die Zeilen zu holen und sie hier hineinzureichen; damit ist der
 * fachlich interessante Teil ohne Datenbank testbar.
 *
 * **Die Regel, die über allem steht: nichts erfinden.** Wo das heutige Schema
 * ein Vertragsfeld nicht trägt, bleibt das Feld weg. Es bekommt keinen
 * Ersatzwert, keine Schätzung und keinen Platzhaltertitel. Ein Prüfungswerkzeug,
 * das eine Lücke als Aussage darstellt, ist schlimmer als eines, das die Lücke
 * zeigt. `MISSING_TODAY` unten führt jedes weggelassene Feld mit Grund; ein Test
 * prüft, dass die dort genannten Felder im Ergebnis tatsächlich fehlen.
 *
 * Der Unterschied zu `components/bpmn/bpmn-grc-bridge.ts` (die Vorstufe, die
 * aus den heutigen Client-Routen baute): dort gab es nur Zählwerte, also
 * Platzhalter-Kontrollen ohne Titel. Hier kommen die Kontrollen selbst aus der
 * Datenbank, samt Wirksamkeit, letztem Test und letztem Nachweis — und der
 * Join `process_step_risk ⋈ risk_control ⋈ process_step_control`, den der Plan
 * in §3.3.6 ausdrücklich in den Endpunkt und nicht in den Client legt.
 */

import type {
  GrcAsset,
  GrcComments,
  GrcFrameworkMapping,
  GrcControl,
  GrcControlEffectiveness,
  GrcCriticality,
  GrcElementData,
  GrcFinding,
  GrcFindingSeverity,
  GrcLineOfDefense,
  GrcObjectRef,
  GrcOverlayData,
  GrcRaci,
  GrcRisk,
  GrcRoleRef,
  GrcSimulation,
} from "@grc/bpmn/grc";

/* ------------------------------------------------------------------ *
 * Eingangsformen — je eine Zeile, so wie die Abfrage sie liefert
 * ------------------------------------------------------------------ */

export interface StepRow {
  readonly id: string;
  readonly bpmnElementId: string | null;
  readonly lineOfDefense: string | null;
  readonly calledProcessId: string | null;
  readonly raciResponsibleRoleId: string | null;
  readonly raciAccountableRoleId: string | null;
}

export interface RiskRow {
  readonly processStepId: string;
  readonly riskId: string;
  readonly title: string | null;
  readonly residualScore: number | null;
  readonly inherentScore: number | null;
  readonly ownerName: string | null;
  readonly treatmentStrategy: string | null;
}

export interface ControlRow {
  readonly processStepId: string;
  readonly controlId: string;
  readonly title: string | null;
  readonly status: string | null;
  readonly lastTestedAt: string | null;
  readonly lastTestResult: string | null;
  readonly lastEvidenceAt: string | null;
}

/** `risk_control` — die Verknüpfung, die F1 überhaupt erst rechenbar macht. */
export interface RiskControlRow {
  readonly riskId: string;
  readonly controlId: string;
}

export interface FindingRow {
  readonly processStepId: string;
  readonly id: string;
  readonly title: string | null;
  readonly severity: string | null;
  readonly status: string | null;
  /** `finding.remediation_due_date` — die Fälligkeit der Maßnahme (§3.4/A3). */
  readonly dueAt: string | null;
}

export interface AssetRow {
  readonly processStepId: string;
  readonly assetId: string;
  readonly name: string | null;
  readonly protectionGoalClass: number | null;
  readonly confidentiality: number | null;
  readonly integrity: number | null;
  readonly availability: number | null;
  readonly ownerName: string | null;
}

export interface RoleRow {
  readonly id: string;
  readonly name: string | null;
}

export interface CommentRow {
  readonly processStepId: string;
  readonly totalThreads: number;
  readonly openThreads: number;
  readonly lastAt: string | null;
  readonly lastAuthor: string | null;
}

/** `simulation_activity_param` — `activity_id` ist die BPMN-Element-ID. */
export interface SimulationRow {
  readonly activityId: string;
  readonly durationMostLikely: number | null;
  readonly costPerExecution: number | null;
  readonly executions: number | null;
}

/**
 * `process_framework_mapping` mit dem Schrittbezug aus Migration 0443.
 *
 * Vor 0443 trug die Tabelle die Zuordnung nur am Prozess; F8 war damit
 * strukturell datenlos. Die Spalte ist nullable — Zeilen ohne Schritt sind
 * weiterhin Prozessaussagen und werden hier nicht abgefragt.
 */
export interface FrameworkRow {
  readonly processStepId: string;
  readonly id: string;
  readonly frameworkCode: string | null;
  readonly entryCode: string | null;
  readonly entryTitle: string | null;
  readonly mappingStrength: string | null;
}

export interface DmnRow {
  readonly processStepId: string;
  readonly id: string;
  readonly name: string | null;
}

/**
 * Aggregat eines aufgerufenen Prozesses (§3.4/A5, Roll-up).
 *
 * Serverseitig gerechnet, weil der Client das fremde Diagramm nicht kennt.
 */
export interface CalledProcessRow {
  readonly processId: string;
  readonly name: string | null;
  readonly riskCount: number;
  readonly maxResidualScore: number;
  readonly residualScoreSum: number;
  readonly coveredScoreSum: number;
  readonly openFindings: number;
}

export interface OverlayQueryResult {
  readonly steps: readonly StepRow[];
  readonly risks: readonly RiskRow[];
  readonly controls: readonly ControlRow[];
  readonly riskControls: readonly RiskControlRow[];
  readonly findings: readonly FindingRow[];
  readonly assets: readonly AssetRow[];
  readonly roles: readonly RoleRow[];
  readonly comments: readonly CommentRow[];
  readonly frameworks: readonly FrameworkRow[];
  readonly simulation: readonly SimulationRow[];
  readonly dmn: readonly DmnRow[];
  readonly calledProcesses: readonly CalledProcessRow[];
}

export interface BuildOverlayOptions {
  /** Pflichtfeld des Vertrags — als Argument, damit kein Test an der Uhr hängt. */
  readonly computedAt: string;
  readonly processId: string;
  readonly processName?: string | undefined;
  readonly versionId?: string | undefined;
  readonly ttlSeconds?: number | undefined;
}

/* ------------------------------------------------------------------ *
 * Was heute leer bleibt — als auswertbares Datum, nicht als Fließtext
 * ------------------------------------------------------------------ */

/**
 * Vertragsfelder, die dieser Endpunkt **nicht** befüllt, mit dem Grund.
 *
 * Jede Zeile nennt den Schemabedarf aus `STUFE2-A2-GRC.md` §5. Solange die dort
 * genannte Tabelle bzw. Spalte fehlt, liefert der Endpunkt das Feld gar nicht —
 * und der zugehörige Layer meldet kein Signal, statt eines zu erfinden.
 */
export const MISSING_TODAY: ReadonlyArray<{
  readonly field: string;
  readonly reason: string;
}> = [
  {
    field: "elements[].controls[].isKey",
    reason:
      "control.is_key existiert nicht (Schemabedarf §5.2). Ohne die Spalte ist jede Schlüsselkontroll-Markierung geraten.",
  },
  {
    field: "elements[].controls[].ownerRole",
    reason:
      "control.owner_id zeigt auf einen Benutzer, nicht auf eine Rolle; control.owner_role_id fehlt (§5.2). Damit ist die Selbstkontroll-Prüfung (§3.4/A4) nicht rechenbar.",
  },
  {
    field: "elements[].controls[].evidenceDueAt",
    reason:
      "control.evidence_due_at fehlt (§5.2). F4 fällt deshalb auf die Altersregel zurück, die die GRC-Schicht dafür vorsieht.",
  },
  {
    field: "elements[].raci.consulted, .raci.informed",
    reason:
      "process_step_raci fehlt (§5.1). process_raci_override kennt zwar C und I, benennt die Beteiligten aber über rohe BPMN-Lane-IDs ohne Fremdschlüssel auf custom_role — eine Lane als Rolle auszugeben wäre eine Erfindung.",
  },
  {
    field: "elements[].ropa, .bia, .documents",
    reason:
      "Alle drei hängen im heutigen Schema am Prozess, nicht am Element (process_ropa_profile 1:1, bia_process_impact(process_id), process_document(process_id) — §5.1/§5.2). Eine Prozessaussage an jedes Element zu hängen wäre falsch.",
  },
  {
    field: "elements[].frameworks[].frameworkName",
    reason:
      "process_framework_mapping führt nur den Rahmenwerkscode (framework_code), keinen Anzeigenamen; der Katalog dahinter ist optional verknüpft. Ausgegeben wird deshalb der Code — eine Abkürzung, kein erfundener Name.",
  },
  {
    field: "elements[].conformance und diagram.conformance",
    reason:
      "process_event.activity ist ein Aktivitätsname, keine BPMN-ID; ohne process_event_activity_map (§5.1) gibt es keine Zuordnungsquote. Die GRC-Schicht verweigert F7 ohne coverageRatio ausdrücklich.",
  },
  {
    field: "elements[].incidents, .workItems",
    reason:
      "security_incident und work_item haben keinen Elementbezug (§5.2). Vertrag vorbereitet, Layer bewusst nicht gebaut.",
  },
  {
    field: "elements[].stepKey",
    reason:
      "process_step.step_key existiert nicht (§5.2); Schlüssel des Datensatzes bleibt die BPMN-Element-ID.",
  },
  {
    field: "lanes",
    reason:
      "Es gibt keine Lane-Tabelle (process_lane, §5.1). Ohne sie sind Vertrauensgrenzen (F5), Lane-Quoten (F17) und der Lane-Bezug der SoD-Prüfung datenlos.",
  },
  {
    field: "edges",
    reason:
      "Häufigkeit und Verzweigungswahrscheinlichkeit je Kante kommen aus dem Ereignisprotokoll; die Zuordnung fehlt (siehe conformance). carriesPersonalData setzt process_step_ropa voraus.",
  },
  {
    field: "diagram.sodRules",
    reason:
      "sod_rule fehlt (§5.1). abac_policy und access_review decken Zugriffsrechte ab, nicht Aufgabentrennung.",
  },
  {
    field: "diagram.outage, diagram.framework",
    reason:
      "Beides sind Auswahlparameter einer Simulation bzw. Sicht. Die Ausfallsimulation braucht zusätzlich process_step_bia (§5.1); ohne Elementebene wäre der MTPD-Reißpunkt geschätzt statt gerechnet.",
  },
];

/* ------------------------------------------------------------------ *
 * Die Abbildung
 * ------------------------------------------------------------------ */

const LOD_VALUES = new Set<GrcLineOfDefense>([
  "first",
  "second",
  "third",
  "oversight",
]);
const SEVERITIES = new Set<GrcFindingSeverity>([
  "low",
  "medium",
  "high",
  "critical",
]);

/**
 * `finding_severity` (ISO 19011, Migration 0293) → die vier Stufen des Vertrags.
 *
 * **Diese Tabelle ist der Grund, warum die Abbildung nicht raten darf.** Das
 * Schema führt zehn Werte, keiner davon heißt `low`/`medium`/`high`/`critical`
 * — eine naive Übernahme des Strings hätte *jede* Feststellung auf `medium`
 * fallen lassen und damit eine schwere Nichtkonformität wie eine Anmerkung
 * aussehen lassen. Die Zuordnung folgt der Farbordnung, die die Anwendung
 * selbst schon benutzt (`components/control/finding-severity-badge.tsx`), und
 * für die oberste Stufe ausdrücklich derselben Menge, mit der
 * `controls/findings-summary` seinen `criticalCount` bildet
 * (`major_nonconformity`, `significant_nonconformity`).
 */
const SEVERITY_MAP: Readonly<Record<string, GrcFindingSeverity>> = {
  major_nonconformity: "critical",
  significant_nonconformity: "critical",
  minor_nonconformity: "high",
  insignificant_nonconformity: "high",
  opportunity_for_improvement: "medium",
  improvement_requirement: "medium",
  observation: "low",
  recommendation: "low",
  conforming: "low",
  positive: "low",
};
const CLOSED_FINDING_STATUS = new Set([
  "closed",
  "verified",
  "remediated",
  "accepted",
]);
const IN_PROGRESS_FINDING_STATUS = new Set([
  "in_progress",
  "in_remediation",
  "remediation_planned",
]);

/**
 * `control.status` → `GrcControlEffectiveness`.
 *
 * Die Zuordnung ist absichtlich eng: **nur** `effective` gilt als wirksam,
 * genau wie in `GET /control-coverage`, das denselben Zählwert bildet. Ein
 * `designed` oder `implemented` bedeutet „entworfen bzw. umgesetzt", nicht
 * „geprüft und wirksam" — es als `partial` auszugeben, hieße einen
 * Prüfungsstand zu behaupten, den niemand festgestellt hat. `partial` entsteht
 * deshalb nur dort, wo ein Kontrolltest tatsächlich `partially_effective`
 * ergeben hat (siehe {@link effectivenessFor}).
 */
function statusEffectiveness(status: string | null): GrcControlEffectiveness {
  switch (status) {
    case "effective":
      return "effective";
    case "ineffective":
      return "ineffective";
    default:
      return "untested";
  }
}

/**
 * Wirksamkeit einer Kontrolle aus Status **und** letztem Test.
 *
 * Ein Test, der `partially_effective` ergeben hat, ist die einzige Quelle im
 * heutigen Schema für die Stufe `partial`; er wird nur dann herangezogen, wenn
 * der Status selbst nichts Genaueres sagt (`designed`/`implemented`/`retired`).
 * Ein ausdrücklich gesetzter Status `effective`/`ineffective` gewinnt, weil er
 * die Bewertung ist, mit der der Rest der Anwendung rechnet.
 */
function effectivenessFor(row: ControlRow): GrcControlEffectiveness {
  const fromStatus = statusEffectiveness(row.status);
  if (fromStatus !== "untested") return fromStatus;
  if (row.lastTestResult === "partially_effective") return "partial";
  return fromStatus;
}

/** `control_test.toe_result` → das dreiwertige Feld des Vertrags. */
function testResultFor(value: string | null): GrcControl["lastTestResult"] {
  switch (value) {
    case "effective":
      return "passed";
    case "ineffective":
      return "failed";
    case "partially_effective":
      return "partial";
    default:
      return undefined;
  }
}

/**
 * `asset.protection_goal_class` (1–4) → `GrcCriticality`.
 *
 * Die Spalte ist per Trigger `GREATEST(C, I, A)` und damit genau die
 * vierstufige Schutzbedarfsklasse, die der Vertrag als Kritikalität führt.
 * Ohne Wert bleibt das Asset weg — ein Asset ohne Schutzbedarf als „low"
 * auszugeben, wäre eine Entwarnung, die niemand erteilt hat.
 */
function criticalityFor(value: number | null): GrcCriticality | undefined {
  switch (value) {
    case 4:
      return "very_high";
    case 3:
      return "high";
    case 2:
      return "medium";
    case 1:
      return "low";
    default:
      return undefined;
  }
}

const CIA_LETTER: Readonly<Record<number, string>> = {
  1: "N",
  2: "M",
  3: "H",
  4: "S",
};

function ciaFor(row: AssetRow): string | undefined {
  const parts = [row.confidentiality, row.integrity, row.availability].map(
    (value) =>
      typeof value === "number" ? (CIA_LETTER[value] ?? undefined) : undefined,
  );
  if (parts.some((part) => part === undefined)) return undefined;
  return parts.join("/");
}

export /**
 * `process_framework_mapping.mapping_strength` → `GrcFrameworkMapping.coverage`.
 *
 * Die Spalte kennt drei Werte (Migration 0334): `covers`, `partial`,
 * `references`. Die ersten beiden übersetzen sich unmittelbar. `references`
 * heißt „erwähnt, aber deckt nicht ab" — im Vertrag ist das eine **Lücke**,
 * nicht eine Teilabdeckung: eine Anforderung, auf die nur verwiesen wird, ist
 * nicht erfüllt, und sie in der Heatmap als halb erfüllt zu zeigen wäre die
 * Sorte Beschönigung, wegen der man dem Diagramm nicht mehr glaubt.
 */
function toCoverage(value: string | null): GrcFrameworkMapping["coverage"] {
  switch (value) {
    case "covers":
      return "covered";
    case "partial":
      return "partial";
    default:
      return "gap";
  }
}

export function toSeverity(value: string | null): GrcFindingSeverity {
  const normalized = nonEmpty(value)?.toLowerCase();
  if (!normalized) return "medium";
  const mapped = SEVERITY_MAP[normalized];
  if (mapped) return mapped;
  // Ein Wert, der schon die Vertragsform hat, wird übernommen (Fixtures,
  // Fremdquellen). Alles Unbekannte bleibt `medium` — nicht `low`: eine
  // unbekannte Einstufung darf nicht als Entwarnung erscheinen.
  return SEVERITIES.has(normalized as GrcFindingSeverity)
    ? (normalized as GrcFindingSeverity)
    : "medium";
}

/**
 * Der Vertrag kennt drei Zustände, `finding_status` mehr.
 *
 * Alles, was die Anwendung als erledigt führt, wird `closed`; alles Unbekannte
 * bleibt `open`, weil eine übersehene Feststellung teurer ist als eine zu viel
 * angezeigte.
 */
function toFindingStatus(value: string | null): GrcFinding["status"] {
  const normalized = nonEmpty(value)?.toLowerCase();
  if (!normalized) return "open";
  if (CLOSED_FINDING_STATUS.has(normalized)) return "closed";
  if (IN_PROGRESS_FINDING_STATUS.has(normalized)) return "in_progress";
  return "open";
}

/** Zwei- bis dreistelliges Kürzel für die Anzeige am Element. */
function shortFor(name: string): string | undefined {
  const words = name.split(/[\s/_-]+/u).filter((word) => word.length > 0);
  if (words.length === 0) return undefined;
  if (words.length === 1) {
    const single = words[0] ?? "";
    return single.slice(0, 2).toUpperCase();
  }
  return words
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * Baut die Nutzlast des Overlay-Endpunkts aus den Abfrageergebnissen.
 *
 * Rein und deterministisch: gleiche Zeilen → gleiche Antwort, gleiche
 * Reihenfolge. Das ist keine Kosmetik — die GRC-Schicht löst Slotkonflikte
 * unter anderem über die Reihenfolge gleichrangiger Signale auf, und ein
 * Endpunkt, der zweimal dasselbe anders sortiert, würde ein flackerndes Bild
 * erzeugen.
 */
export function buildDiagramOverlay(
  rows: OverlayQueryResult,
  options: BuildOverlayOptions,
): GrcOverlayData {
  const elements = new Map<string, Mutable<GrcElementData>>();
  const stepToElement = new Map<string, string>();

  for (const step of rows.steps) {
    const elementId = nonEmpty(step.bpmnElementId);
    if (!elementId) continue;
    stepToElement.set(step.id, elementId);
  }

  const at = (stepId: string): Mutable<GrcElementData> | undefined => {
    const elementId = stepToElement.get(stepId);
    if (elementId === undefined) return undefined;
    let entry = elements.get(elementId);
    if (!entry) {
      entry = {};
      elements.set(elementId, entry);
    }
    return entry;
  };

  // --- Risiko ↔ Kontrolle: die Verknüpfung zuerst, sie wird unten gebraucht --
  const controlsOfRisk = new Map<string, Set<string>>();
  for (const link of rows.riskControls) {
    let set = controlsOfRisk.get(link.riskId);
    if (!set) {
      set = new Set<string>();
      controlsOfRisk.set(link.riskId, set);
    }
    set.add(link.controlId);
  }

  /** Welche Kontrollen an welchem Schritt hängen — für den Schnitt mit oben. */
  const controlsOfStep = new Map<string, Set<string>>();
  for (const control of rows.controls) {
    let set = controlsOfStep.get(control.processStepId);
    if (!set) {
      set = new Set<string>();
      controlsOfStep.set(control.processStepId, set);
    }
    set.add(control.controlId);
  }

  // --- Kontrollen ---------------------------------------------------------
  const controlsByStep = new Map<string, GrcControl[]>();
  for (const row of rows.controls) {
    const list = controlsByStep.get(row.processStepId) ?? [];
    const lastTestResult = testResultFor(row.lastTestResult);
    const control: Mutable<GrcControl> = {
      id: row.controlId,
      title: nonEmpty(row.title) ?? "",
      effectiveness: effectivenessFor(row),
    };
    const testedAt = nonEmpty(row.lastTestedAt);
    if (testedAt) control.lastTestedAt = testedAt;
    if (lastTestResult) control.lastTestResult = lastTestResult;
    const evidenceAt = nonEmpty(row.lastEvidenceAt);
    if (evidenceAt) control.lastEvidenceAt = evidenceAt;
    list.push(control);
    controlsByStep.set(row.processStepId, list);
  }
  for (const [stepId, list] of controlsByStep) {
    const entry = at(stepId);
    if (entry) entry.controls = list;
  }

  // --- Risiken ------------------------------------------------------------
  const risksByStep = new Map<string, GrcRisk[]>();
  for (const row of rows.risks) {
    const list = risksByStep.get(row.processStepId) ?? [];
    const risk: Mutable<GrcRisk> = {
      id: row.riskId,
      title: nonEmpty(row.title) ?? row.riskId,
      residualScore: numberOr(row.residualScore, 0),
    };
    if (typeof row.inherentScore === "number") {
      risk.inherentScore = row.inherentScore;
    }
    const owner = nonEmpty(row.ownerName);
    if (owner) risk.owner = owner;
    const treatment = nonEmpty(row.treatmentStrategy);
    if (treatment) risk.treatment = treatment;

    // Der Join aus Plan §3.3.6: nur die Kontrollen, die das Risiko behandeln
    // **und** an diesem Schritt hängen. Eine Kontrolle, die das Risiko
    // anderswo behandelt, deckt diesen Schritt nicht ab.
    const atStep = controlsOfStep.get(row.processStepId);
    const ofRisk = controlsOfRisk.get(row.riskId);
    if (atStep && ofRisk) {
      const shared = [...ofRisk].filter((id) => atStep.has(id)).sort();
      if (shared.length > 0) risk.controlIds = shared;
    }
    list.push(risk);
    risksByStep.set(row.processStepId, list);
  }
  for (const [stepId, list] of risksByStep) {
    const entry = at(stepId);
    if (entry) entry.risks = list;
  }

  // --- Feststellungen -----------------------------------------------------
  const findingsByStep = new Map<string, GrcFinding[]>();
  for (const row of rows.findings) {
    const list = findingsByStep.get(row.processStepId) ?? [];
    const finding: Mutable<GrcFinding> = {
      id: row.id,
      title: nonEmpty(row.title) ?? row.id,
      severity: toSeverity(row.severity),
      status: toFindingStatus(row.status),
    };
    const dueAt = nonEmpty(row.dueAt);
    if (dueAt) finding.dueAt = dueAt;
    list.push(finding);
    findingsByStep.set(row.processStepId, list);
  }
  for (const [stepId, list] of findingsByStep) {
    const entry = at(stepId);
    if (entry) entry.findings = list;
  }

  // --- Assets -------------------------------------------------------------
  const assetsByStep = new Map<string, GrcAsset[]>();
  for (const row of rows.assets) {
    const criticality = criticalityFor(row.protectionGoalClass);
    if (criticality === undefined) continue;
    const list = assetsByStep.get(row.processStepId) ?? [];
    const assetEntry: Mutable<GrcAsset> = {
      id: row.assetId,
      title: nonEmpty(row.name) ?? row.assetId,
      criticality,
    };
    const cia = ciaFor(row);
    if (cia) assetEntry.cia = cia;
    const owner = nonEmpty(row.ownerName);
    if (owner) assetEntry.owner = owner;
    list.push(assetEntry);
    assetsByStep.set(row.processStepId, list);
  }
  for (const [stepId, list] of assetsByStep) {
    const entry = at(stepId);
    if (entry) entry.assets = list;
  }

  // --- Line of Defense, RACI (R/A), Call Activity -------------------------
  const roleById = new Map<string, GrcRoleRef>();
  for (const row of rows.roles) {
    const name = nonEmpty(row.name);
    if (!name) continue;
    const ref: Mutable<GrcRoleRef> = { id: row.id, name };
    const short = shortFor(name);
    if (short) ref.short = short;
    roleById.set(row.id, ref);
  }

  const rollupByProcess = new Map<string, CalledProcessRow>();
  for (const row of rows.calledProcesses) {
    rollupByProcess.set(row.processId, row);
  }

  for (const step of rows.steps) {
    const elementId = stepToElement.get(step.id);
    if (elementId === undefined) continue;

    const lod = nonEmpty(step.lineOfDefense);
    if (lod && LOD_VALUES.has(lod as GrcLineOfDefense)) {
      const entry = at(step.id);
      if (entry) entry.lineOfDefense = lod as GrcLineOfDefense;
    }

    const responsible = step.raciResponsibleRoleId
      ? roleById.get(step.raciResponsibleRoleId)
      : undefined;
    const accountable = step.raciAccountableRoleId
      ? roleById.get(step.raciAccountableRoleId)
      : undefined;
    if (responsible || accountable) {
      const raci: Mutable<GrcRaci> = {};
      if (responsible) raci.responsible = responsible;
      if (accountable) raci.accountable = accountable;
      const entry = at(step.id);
      if (entry) entry.raci = raci;
    }

    const calledId = nonEmpty(step.calledProcessId);
    if (calledId) {
      const row = rollupByProcess.get(calledId);
      const called: Mutable<GrcElementData["calledProcess"] & object> = {
        processId: calledId,
        name: nonEmpty(row?.name) ?? calledId,
      };
      if (row) {
        const rollup: Mutable<
          NonNullable<NonNullable<GrcElementData["calledProcess"]>["rollup"]>
        > = {
          riskCount: row.riskCount,
          maxResidualScore: row.maxResidualScore,
          residualScoreSum: row.residualScoreSum,
        };
        // Eine Quote nur, wenn es überhaupt bewertetes Restrisiko gibt —
        // 0/0 ist keine vollständige Abdeckung, sondern keine Aussage.
        if (row.residualScoreSum > 0) {
          rollup.coverageRatio = row.coveredScoreSum / row.residualScoreSum;
        }
        rollup.openFindings = row.openFindings;
        called.rollup = rollup;
      }
      const entry = at(step.id);
      if (entry) entry.calledProcess = called;
    }
  }

  // --- Framework-Zuordnungen (F8) ------------------------------------------
  const frameworksByStep = new Map<string, GrcFrameworkMapping[]>();
  for (const row of rows.frameworks) {
    const requirementRef = nonEmpty(row.entryCode);
    const frameworkId = nonEmpty(row.frameworkCode);
    // Ohne Rahmenwerk und Anforderungskennung gibt es nichts zu zeigen: der
    // Chip trägt genau diese beiden Angaben.
    if (!requirementRef || !frameworkId) continue;
    const list = frameworksByStep.get(row.processStepId) ?? [];
    const mapping: Mutable<GrcFrameworkMapping> = {
      id: row.id,
      frameworkId,
      frameworkName: frameworkId,
      requirementRef,
      coverage: toCoverage(row.mappingStrength),
    };
    const title = nonEmpty(row.entryTitle);
    if (title) mapping.requirementTitle = title;
    list.push(mapping);
    frameworksByStep.set(row.processStepId, list);
  }
  for (const [stepId, list] of frameworksByStep) {
    const entry = at(stepId);
    if (entry) entry.frameworks = list;
  }

  // --- Kommentare ---------------------------------------------------------
  for (const row of rows.comments) {
    if (row.totalThreads <= 0) continue;
    const comments: Mutable<GrcComments> = {
      openThreads: row.openThreads,
      totalThreads: row.totalThreads,
    };
    const lastAuthor = nonEmpty(row.lastAuthor);
    if (lastAuthor) comments.lastAuthor = lastAuthor;
    const lastAt = nonEmpty(row.lastAt);
    if (lastAt) comments.lastAt = lastAt;
    const entry = at(row.processStepId);
    if (entry) entry.comments = comments;
  }

  // --- DMN ----------------------------------------------------------------
  for (const row of rows.dmn) {
    const ref: GrcObjectRef = {
      id: row.id,
      title: nonEmpty(row.name) ?? row.id,
    };
    const entry = at(row.processStepId);
    if (entry) entry.dmnDecision = ref;
  }

  // --- Simulationsparameter ------------------------------------------------
  // `activity_id` ist die BPMN-Element-ID, nicht die `process_step.id` — die
  // einzige Quelle im Datensatz, die direkt am Element hängt.
  for (const row of rows.simulation) {
    const elementId = nonEmpty(row.activityId);
    if (!elementId) continue;
    const simulation: Mutable<GrcSimulation> = {};
    if (typeof row.durationMostLikely === "number") {
      simulation.durationMinutes = row.durationMostLikely;
    }
    if (typeof row.costPerExecution === "number") {
      simulation.costPerExecution = row.costPerExecution;
    }
    if (typeof row.executions === "number") {
      simulation.executions = row.executions;
    }
    if (Object.keys(simulation).length === 0) continue;
    let entry = elements.get(elementId);
    if (!entry) {
      entry = {};
      elements.set(elementId, entry);
    }
    entry.simulation = simulation;
  }

  const diagram: Mutable<NonNullable<GrcOverlayData["diagram"]>> = {
    processId: options.processId,
    asOf: options.computedAt,
  };
  if (options.processName !== undefined)
    diagram.processName = options.processName;
  if (options.versionId !== undefined) diagram.versionId = options.versionId;

  const payload: Mutable<GrcOverlayData> = {
    computedAt: options.computedAt,
    elements: Object.fromEntries(
      [...elements].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ) as GrcOverlayData["elements"],
    diagram,
  };
  if (options.ttlSeconds !== undefined) payload.ttlSeconds = options.ttlSeconds;
  return payload;
}

/* ------------------------------------------------------------------ *
 * Kleinteile
 * ------------------------------------------------------------------ */

function nonEmpty(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function numberOr(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
