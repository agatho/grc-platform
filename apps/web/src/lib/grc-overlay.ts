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
  GrcActivityMatchKind,
  GrcAsset,
  GrcBia,
  GrcComments,
  GrcConformanceElement,
  GrcConformanceSummary,
  GrcDataCategory,
  GrcFrameworkMapping,
  GrcControl,
  GrcControlEffectiveness,
  GrcCriticality,
  GrcElementData,
  GrcFinding,
  GrcFindingSeverity,
  GrcLaneData,
  GrcLineOfDefense,
  GrcObjectRef,
  GrcOutageScenario,
  GrcOverlayData,
  GrcRaci,
  GrcRisk,
  GrcRoleRef,
  GrcRopa,
  GrcSimulation,
  GrcSodRule,
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
  /** `process_step.step_key` seit Migration 0445. */
  readonly stepKey?: string | null;
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
  /** `control.is_key` seit Migration 0453. */
  readonly isKey?: boolean | null;
  /** `control.owner_role_id` seit Migration 0453 — die Rolle, nicht der Nutzer. */
  readonly ownerRoleId?: string | null;
  /** `control.evidence_due_at` seit Migration 0453. */
  readonly evidenceDueAt?: string | null;
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

/* ------------------------------------------------------------------ *
 * STUFE2-E — die Zeilen der zehn neuen Tabellen (Migrationen 0444–0452)
 * ------------------------------------------------------------------ */

/**
 * `process_lane` (0444) samt aufgelöstem Träger.
 *
 * Schlüssel ist die **BPMN-Element-ID**, nicht die Zeilen-ID: der Vertrag
 * führt `lanes` als Record über Diagrammelemente, und die Diagrammschicht
 * schlägt dort mit der Shape-ID nach.
 */
export interface LaneRow {
  readonly bpmnElementId: string;
  readonly name: string | null;
  readonly kind: string | null;
  readonly roleId: string | null;
  readonly orgUnitId: string | null;
  readonly orgUnitName: string | null;
  readonly vendorId: string | null;
  readonly vendorName: string | null;
  readonly vendorRiskClass: string | null;
  readonly isExternal: boolean | null;
  readonly thirdCountry: string | null;
}

/**
 * Quoten je Lane-Rolle, getrennt beschafft.
 *
 * Sie hängen nicht an der Lane, sondern an ihrer Rolle — und sie sind eine
 * Aggregation über Mitgliedschaften, Schulungen und Kenntnisnahmen. Ohne
 * Pflichtschulung bzw. Pflichtverteilung im Mandanten gibt es **keine** Quote:
 * „0 %" hieße „niemand ist geschult", und das wäre eine Aussage, die die Daten
 * nicht tragen.
 */
export interface LaneRatioRow {
  readonly roleId: string;
  readonly memberCount: number;
  readonly trainedCount: number;
  readonly acknowledgedCount: number;
  readonly hasMandatoryTraining: boolean;
  readonly hasMandatoryPolicy: boolean;
}

/** `process_step_raci` (0447) — die Heimat von C und I. */
export interface RaciRow {
  readonly processStepId: string;
  readonly roleId: string;
  readonly raciRole: string;
}

/** `sod_rule` (0446) — die Regelmenge von F3. */
export interface SodRuleRow {
  readonly id: string;
  readonly roleAId: string;
  readonly roleBId: string;
  readonly severity: string | null;
  readonly rationale: string | null;
  readonly frameworkRef: string | null;
}

/** `process_step_ropa` (0448) mit dem Status der verknüpften DPIA. */
export interface RopaRow {
  readonly processStepId: string;
  readonly isProcessingActivity: boolean;
  readonly purpose: string | null;
  readonly legalBasis: string | null;
  readonly retentionMonths: number | null;
  readonly retentionBasis: string | null;
  readonly requiresDpia: boolean;
  readonly dpiaId: string | null;
  readonly dpiaStatus: string | null;
  readonly transferThirdCountry: boolean;
  readonly transferCountry: string | null;
  readonly transferSafeguard: string | null;
}

/** `process_step_data_category` ⋈ `ropa_data_category` (0448). */
export interface DataCategoryRow {
  readonly processStepId: string;
  readonly id: string;
  readonly title: string | null;
  readonly isSpecialCategory: boolean;
}

/** `process_step_recipient` (0448), Name über `vendor` bzw. `eam_org_unit`. */
export interface RecipientRow {
  readonly processStepId: string;
  readonly id: string;
  readonly title: string | null;
}

/** `process_step_bia` (0449) — in Minuten, nicht in Stunden. */
export interface BiaRow {
  readonly processStepId: string;
  readonly criticality: string | null;
  readonly mtpdMinutes: number | null;
  readonly rtoMinutes: number | null;
  readonly rpoMinutes: number | null;
  readonly workaround: string | null;
  readonly workaroundMaxDurationMinutes: number | null;
}

/** `process_step_document` ⋈ `document` (0450). */
export interface DocumentRow {
  readonly processStepId: string;
  readonly id: string;
  readonly title: string | null;
}

/** Je Schritt aus `process_event_activity_map` ⋈ `process_event` (0451). */
export interface ConformanceElementRow {
  readonly processStepId: string;
  readonly matchKind: string | null;
  readonly observedCases: number | null;
  readonly reworkLoops: number | null;
}

/** Diagrammweite Conformance-Kennzahlen — der Torwächter von F7. */
export interface ConformanceSummaryRow {
  readonly coverageRatio: number | null;
  readonly unmappedActivities: readonly string[] | null;
  readonly totalTraces: number | null;
  readonly conformantTraces: number | null;
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
  // --- STUFE2-E; alle optional, damit Bestandstests und Teilabfragen
  //     (`?layers=`) unverändert bauen.
  readonly lanes?: readonly LaneRow[];
  readonly laneRatios?: readonly LaneRatioRow[];
  readonly raci?: readonly RaciRow[];
  readonly sodRules?: readonly SodRuleRow[];
  readonly ropa?: readonly RopaRow[];
  readonly dataCategories?: readonly DataCategoryRow[];
  readonly recipients?: readonly RecipientRow[];
  readonly bia?: readonly BiaRow[];
  readonly documents?: readonly DocumentRow[];
  readonly conformanceElements?: readonly ConformanceElementRow[];
  readonly conformanceSummary?: ConformanceSummaryRow | undefined;
}

export interface BuildOverlayOptions {
  /** Pflichtfeld des Vertrags — als Argument, damit kein Test an der Uhr hängt. */
  readonly computedAt: string;
  readonly processId: string;
  readonly processName?: string | undefined;
  readonly versionId?: string | undefined;
  readonly ttlSeconds?: number | undefined;
  /**
   * Auswahl der Ausfallsimulation (F6).
   *
   * Kommt aus den Abfrageparametern und **nicht** aus der Datenbank: welches
   * Asset ausfällt, ist eine Frage des Betrachters, keine hinterlegte
   * Tatsache. Ohne Auswahl liefert der Endpunkt kein `diagram.outage`, und
   * `simulateOutage` gibt `undefined` zurück — der Layer schweigt.
   */
  readonly outage?: GrcOutageScenario | undefined;
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
    field: "elements[].frameworks[].frameworkName",
    reason:
      "process_framework_mapping führt nur den Rahmenwerkscode (framework_code), keinen Anzeigenamen; der Katalog dahinter ist optional verknüpft. Ausgegeben wird deshalb der Code — eine Abkürzung, kein erfundener Name.",
  },
  {
    field: "elements[].conformance.meanDurationMinutes, .isBottleneck",
    reason:
      "process_event trägt genau einen Zeitstempel je Ereignis und kein Lebenszyklus-Merkmal (start/complete). Ohne Anfang UND Ende gibt es keine Dauer, und ohne Dauer keinen Engpass. Die Differenz zum nächsten Ereignis desselben Falls wäre die Wartezeit davor, nicht die Bearbeitungszeit — sie als Dauer auszugeben wäre eine andere Größe unter demselben Namen.",
  },
  {
    field: "diagram.conformance.deviations",
    reason:
      "fitness_gaps (process_conformance_result) führt {activity, type, frequency, percentage} — einen Aktivitätsnamen mit Häufigkeit. Der Vertrag verlangt ein KANTENPAAR (fromElementId/toElementId). Aus einem Knoten ein Paar zu machen wäre geraten.",
  },
  {
    field: "elements[].incidents, .workItems",
    reason:
      "Der Elementbezug existiert seit Migration 0454 (security_incident.process_step_id, work_item.process_step_id). Die zugehörigen Layer F14/F16 sind bewusst nicht gebaut (STUFE2-A2-GRC.md §6); der Endpunkt fragt die Spalten deshalb nicht ab — ein Feld zu liefern, das keine Schicht liest, ist Ballast, kein Nutzen. Eine Zeile Abfrage je Feld, sobald ein Layer sie braucht.",
  },
  {
    field: "elements[].controls[].lastTestResult, .lastEvidenceAt",
    reason:
      "Beide werden geliefert, aber ABGELEITET (jüngster control_test bzw. evidence(entity_type='control')) und nicht aus einer Spalte gelesen. Migration 0453 legt sie bewusst nicht als Spalten an: eine gespeicherte Kopie, die nichts fortschreibt, zeigte nach dem nächsten Kontrolltest einen veralteten Stand an.",
  },
  {
    field: "edges",
    reason:
      "Häufigkeit und Verzweigungswahrscheinlichkeit je KANTE bräuchten eine Zuordnung des Ereignisprotokolls auf Übergänge; process_event_activity_map (0451) ordnet Aktivitäten zu, nicht Übergänge. carriesPersonalData ist dagegen nicht mehr nötig: computeTrustBoundaries leitet den Personenbezug aus dem ROPA-Datensatz der beiden Kantenenden ab.",
  },
  {
    field: "diagram.framework",
    reason:
      "Auswahlparameter der Sicht F8 (welches Rahmenwerk, welche Anforderungen), keine hinterlegte Tatsache. Er gehört an die Sichtwahl der Oberfläche, nicht in den Datensatz.",
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

/* ------------------------------------------------------------------ *
 * STUFE2-E — Abbildungen der neuen Tabellen
 * ------------------------------------------------------------------ */

const CRITICALITIES = new Set<GrcCriticality>([
  "very_high",
  "high",
  "medium",
  "low",
]);

const MATCH_KINDS = new Set<GrcActivityMatchKind>([
  "exact",
  "normalized",
  "fuzzy",
  "manual",
  "unmapped",
]);

/**
 * `sod_rule.severity` → `GrcFindingSeverity`.
 *
 * Migration 0446 führt die Spalte ausdrücklich in der **Vertragsform** und
 * nicht als `finding_severity` (der ISO-19011-Enum mit zehn Werten), damit
 * genau hier keine zweite verlustbehaftete Übersetzung entsteht. Die
 * CHECK-Bedingung der Tabelle lässt nur die vier Werte zu; der Rückfall auf
 * `high` ist der Vorgabewert derselben Spalte und praktisch unerreichbar — er
 * steht hier, damit ein von außen eingespieltes Datum die Regel nicht still
 * auf die harmloseste Stufe fallen lässt.
 */
function sodSeverity(value: string | null): GrcFindingSeverity {
  const normalized = nonEmpty(value);
  return normalized && SEVERITIES.has(normalized as GrcFindingSeverity)
    ? (normalized as GrcFindingSeverity)
    : "high";
}

/**
 * `dpia_status` (Migration 0060ff.) → die vier Stufen von `GrcRopa.dpiaStatus`.
 *
 * Die Zuordnung ist bewusst grob und in eine Richtung vorsichtig: `rejected`
 * wird **nicht** `done`. Eine abgelehnte Folgenabschätzung heißt, dass die
 * Verarbeitung so nicht laufen darf — sie als „abgeschlossen" anzuzeigen wäre
 * die Umkehrung der Aussage. `pending_dpo_review` ist laufend, nicht fertig.
 */
function dpiaStatusFor(value: string | null): GrcRopa["dpiaStatus"] {
  switch (nonEmpty(value)) {
    case "completed":
    case "approved":
      return "done";
    case "in_progress":
    case "pending_dpo_review":
    case "draft":
      return "in_progress";
    case "rejected":
      return "required";
    default:
      return undefined;
  }
}

/**
 * Eine Quote nur, wenn sie eine Aussage ist.
 *
 * `0/0` ist keine Null-Prozent-Quote, sondern keine Quote. Und ohne eine
 * einzige Pflichtschulung im Mandanten wäre „0 % geschult" die Aussage
 * „niemand ist geschult", obwohl in Wahrheit niemand etwas zu absolvieren
 * hat — genau die Sorte Befund, die ein Prüfungswerkzeug nicht erfinden darf.
 */
function ratio(
  count: number,
  total: number,
  applicable: boolean,
): number | undefined {
  if (!applicable || total <= 0) return undefined;
  return count / total;
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

  // --- Rollen (zuerst: Kontrollen und RACI schlagen darin nach) ------------
  const roleById = new Map<string, GrcRoleRef>();
  for (const row of rows.roles) {
    const name = nonEmpty(row.name);
    if (!name) continue;
    const ref: Mutable<GrcRoleRef> = { id: row.id, name };
    const short = shortFor(name);
    if (short) ref.short = short;
    roleById.set(row.id, ref);
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
    // STUFE2-E (0453). `isKey` wird nur gesetzt, wenn die Spalte tatsächlich
    // einen Wahrheitswert liefert — `undefined` heißt „nicht abgefragt", und
    // daraus `false` zu machen wäre die Aussage „keine Schlüsselkontrolle".
    if (typeof row.isKey === "boolean") control.isKey = row.isKey;
    const ownerRoleId = nonEmpty(row.ownerRoleId);
    if (ownerRoleId) {
      const ownerRole = roleById.get(ownerRoleId);
      if (ownerRole) control.ownerRole = ownerRole;
    }
    const evidenceDueAt = nonEmpty(row.evidenceDueAt);
    if (evidenceDueAt) control.evidenceDueAt = evidenceDueAt;
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

  // --- RACI aus `process_step_raci` (0447) ---------------------------------
  //
  // Vorrangregel, einmal festgelegt und getestet: eine Zeile dieser Tabelle
  // gewinnt gegen die denormalisierte Spalte an `process_step`. Sie ist die
  // spezifischere und die pflegbare Angabe; die Spalten bleiben der
  // Bestandsweg für R und A. C und I gibt es ausschließlich hier.
  const raciRowsByStep = new Map<
    string,
    { R?: GrcRoleRef; A?: GrcRoleRef; C: GrcRoleRef[]; I: GrcRoleRef[] }
  >();
  for (const row of rows.raci ?? []) {
    const role = roleById.get(row.roleId);
    if (!role) continue;
    let slot = raciRowsByStep.get(row.processStepId);
    if (!slot) {
      slot = { C: [], I: [] };
      raciRowsByStep.set(row.processStepId, slot);
    }
    switch (row.raciRole) {
      case "R":
        slot.R = role;
        break;
      case "A":
        slot.A = role;
        break;
      case "C":
        slot.C.push(role);
        break;
      case "I":
        slot.I.push(role);
        break;
      default:
        // Die CHECK-Bedingung der Tabelle lässt nur RACI zu; alles andere
        // wird verworfen statt in einen der vier Töpfe geraten.
        break;
    }
  }
  // Stabile Reihenfolge — die Diagrammschicht löst Slotkonflikte auch über
  // die Reihenfolge gleichrangiger Signale auf.
  const byName = (a: GrcRoleRef, b: GrcRoleRef): number =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1;

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

    const stepKey = nonEmpty(step.stepKey);
    if (stepKey) {
      const entry = at(step.id);
      if (entry) entry.stepKey = stepKey;
    }

    const explicit = raciRowsByStep.get(step.id);
    const responsible =
      explicit?.R ??
      (step.raciResponsibleRoleId
        ? roleById.get(step.raciResponsibleRoleId)
        : undefined);
    const accountable =
      explicit?.A ??
      (step.raciAccountableRoleId
        ? roleById.get(step.raciAccountableRoleId)
        : undefined);
    const consulted = [...(explicit?.C ?? [])].sort(byName);
    const informed = [...(explicit?.I ?? [])].sort(byName);
    if (
      responsible ||
      accountable ||
      consulted.length > 0 ||
      informed.length > 0
    ) {
      const raci: Mutable<GrcRaci> = {};
      if (responsible) raci.responsible = responsible;
      if (accountable) raci.accountable = accountable;
      if (consulted.length > 0) raci.consulted = consulted;
      if (informed.length > 0) raci.informed = informed;
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

  // --- Datenschutz: ROPA, Kategorien, Empfänger (0448) ---------------------
  //
  // Reihenfolge zählt: Kategorien und Empfänger werden zuerst nach Schritt
  // gebündelt, damit `GrcRopa` in einem Stück entsteht. Ein Schritt **ohne**
  // ROPA-Zeile bekommt kein `ropa` — auch dann nicht, wenn er Kategorien
  // trägt. `personalDataStage` liest `isProcessingActivity`, und eine
  // Kategorie ohne die ausdrückliche Feststellung „hier wird verarbeitet"
  // wäre genau die Schlussfolgerung, die ein Mensch treffen muss.
  const categoriesByStep = new Map<string, GrcDataCategory[]>();
  for (const row of rows.dataCategories ?? []) {
    const title = nonEmpty(row.title);
    if (!title) continue;
    const list = categoriesByStep.get(row.processStepId) ?? [];
    const category: Mutable<GrcDataCategory> = { id: row.id, title };
    if (row.isSpecialCategory) category.isSpecialCategory = true;
    list.push(category);
    categoriesByStep.set(row.processStepId, list);
  }

  const recipientsByStep = new Map<string, GrcObjectRef[]>();
  for (const row of rows.recipients ?? []) {
    const title = nonEmpty(row.title);
    if (!title) continue;
    const list = recipientsByStep.get(row.processStepId) ?? [];
    list.push({ id: row.id, title });
    recipientsByStep.set(row.processStepId, list);
  }

  for (const row of rows.ropa ?? []) {
    const ropa: Mutable<GrcRopa> = {
      isProcessingActivity: row.isProcessingActivity === true,
    };
    const purpose = nonEmpty(row.purpose);
    if (purpose) ropa.purpose = purpose;
    const legalBasis = nonEmpty(row.legalBasis);
    if (legalBasis) ropa.legalBasis = legalBasis;
    if (typeof row.retentionMonths === "number") {
      ropa.retentionMonths = row.retentionMonths;
    }
    const retentionBasis = nonEmpty(row.retentionBasis);
    if (retentionBasis) ropa.retentionBasis = retentionBasis;
    if (row.requiresDpia === true) ropa.requiresDpia = true;
    const dpiaId = nonEmpty(row.dpiaId);
    if (dpiaId) {
      ropa.dpiaId = dpiaId;
      // Nur aus der verknüpften Akte. Ohne Verknüpfung bleibt der Status weg
      // — der Layer sagt dann „erforderlich, aber nicht verknüpft", und das
      // ist der Befund, nicht ein erratener Zustand.
      const status = dpiaStatusFor(row.dpiaStatus);
      if (status) ropa.dpiaStatus = status;
    }
    if (row.transferThirdCountry === true) ropa.transferThirdCountry = true;
    const transferCountry = nonEmpty(row.transferCountry);
    if (transferCountry) ropa.transferCountry = transferCountry.toUpperCase();
    const transferSafeguard = nonEmpty(row.transferSafeguard);
    if (transferSafeguard) ropa.transferSafeguard = transferSafeguard;

    const categories = categoriesByStep.get(row.processStepId);
    if (categories && categories.length > 0) ropa.dataCategories = categories;
    const recipients = recipientsByStep.get(row.processStepId);
    if (recipients && recipients.length > 0) ropa.recipients = recipients;

    const entry = at(row.processStepId);
    if (entry) entry.ropa = ropa;
  }

  // --- Kontinuität (0449) --------------------------------------------------
  //
  // `criticality` ist Pflichtfeld des Vertrags. Eine Zeile mit einem Wert
  // außerhalb der vier Stufen wird verworfen statt auf „low" normalisiert:
  // eine unlesbare Einstufung als niedrigste auszugeben wäre eine Entwarnung.
  for (const row of rows.bia ?? []) {
    const criticality = nonEmpty(row.criticality);
    if (!criticality || !CRITICALITIES.has(criticality as GrcCriticality)) {
      continue;
    }
    const bia: Mutable<GrcBia> = {
      criticality: criticality as GrcCriticality,
    };
    if (typeof row.mtpdMinutes === "number") bia.mtpdMinutes = row.mtpdMinutes;
    if (typeof row.rtoMinutes === "number") bia.rtoMinutes = row.rtoMinutes;
    if (typeof row.rpoMinutes === "number") bia.rpoMinutes = row.rpoMinutes;
    const workaround = nonEmpty(row.workaround);
    if (workaround) bia.workaround = workaround;
    // Die 0 wird ausdrücklich übernommen — sie heißt „trägt nicht" und ist
    // eine Aussage, kein fehlender Wert (STUFE2-A2-GRC.md §7.4).
    if (typeof row.workaroundMaxDurationMinutes === "number") {
      bia.workaroundMaxDurationMinutes = row.workaroundMaxDurationMinutes;
    }
    const entry = at(row.processStepId);
    if (entry) entry.bia = bia;
  }

  // --- Dokumente (0450) ----------------------------------------------------
  const documentsByStep = new Map<string, GrcObjectRef[]>();
  for (const row of rows.documents ?? []) {
    const title = nonEmpty(row.title);
    if (!title) continue;
    const list = documentsByStep.get(row.processStepId) ?? [];
    list.push({ id: row.id, title });
    documentsByStep.set(row.processStepId, list);
  }
  for (const [stepId, list] of documentsByStep) {
    const entry = at(stepId);
    if (entry) entry.documents = list;
  }

  // --- Conformance je Element (0451) ---------------------------------------
  for (const row of rows.conformanceElements ?? []) {
    const matchKind = nonEmpty(row.matchKind);
    if (!matchKind || !MATCH_KINDS.has(matchKind as GrcActivityMatchKind)) {
      continue;
    }
    const conformance: Mutable<GrcConformanceElement> = {
      matchKind: matchKind as GrcActivityMatchKind,
    };
    if (typeof row.observedCases === "number") {
      conformance.observedCases = row.observedCases;
    }
    if (typeof row.reworkLoops === "number") {
      conformance.reworkLoops = row.reworkLoops;
    }
    // `meanDurationMinutes` und `isBottleneck` bleiben weg — siehe
    // MISSING_TODAY: `process_event` trägt keinen Lebenszyklus.
    const entry = at(row.processStepId);
    if (entry) entry.conformance = conformance;
  }

  // --- Lanes (0444) --------------------------------------------------------
  //
  // Schlüssel ist die BPMN-Element-ID der Lane bzw. des Pools; die
  // Diagrammschicht schlägt mit der Shape-ID nach.
  const ratioByRole = new Map<string, LaneRatioRow>();
  for (const row of rows.laneRatios ?? []) {
    ratioByRole.set(row.roleId, row);
  }
  const lanes = new Map<string, GrcLaneData>();
  for (const row of rows.lanes ?? []) {
    const elementId = nonEmpty(row.bpmnElementId);
    if (!elementId) continue;
    const lane: Mutable<GrcLaneData> = {};
    const name = nonEmpty(row.name);
    if (name) lane.name = name;
    const kind = nonEmpty(row.kind);
    if (kind === "lane" || kind === "pool") lane.kind = kind;
    const roleId = nonEmpty(row.roleId);
    const role = roleId ? roleById.get(roleId) : undefined;
    if (role) lane.role = role;
    const orgUnitId = nonEmpty(row.orgUnitId);
    const orgUnitName = nonEmpty(row.orgUnitName);
    if (orgUnitId && orgUnitName) {
      lane.orgUnit = { id: orgUnitId, title: orgUnitName };
    }
    const vendorId = nonEmpty(row.vendorId);
    const vendorName = nonEmpty(row.vendorName);
    if (vendorId && vendorName) {
      const vendor: Mutable<NonNullable<GrcLaneData["vendor"]>> = {
        id: vendorId,
        name: vendorName,
      };
      const riskClass = nonEmpty(row.vendorRiskClass);
      if (riskClass) vendor.riskClass = riskClass;
      lane.vendor = vendor;
    }
    if (row.isExternal === true) lane.isExternal = true;
    const thirdCountry = nonEmpty(row.thirdCountry);
    if (thirdCountry) lane.thirdCountry = thirdCountry.toUpperCase();

    const counts = roleId ? ratioByRole.get(roleId) : undefined;
    if (counts) {
      const training = ratio(
        counts.trainedCount,
        counts.memberCount,
        counts.hasMandatoryTraining,
      );
      if (training !== undefined) lane.trainingRatio = training;
      const ack = ratio(
        counts.acknowledgedCount,
        counts.memberCount,
        counts.hasMandatoryPolicy,
      );
      if (ack !== undefined) lane.acknowledgmentRatio = ack;
    }

    if (Object.keys(lane).length === 0) continue;
    lanes.set(elementId, lane);
  }

  const diagram: Mutable<NonNullable<GrcOverlayData["diagram"]>> = {
    processId: options.processId,
    asOf: options.computedAt,
  };
  if (options.processName !== undefined)
    diagram.processName = options.processName;
  if (options.versionId !== undefined) diagram.versionId = options.versionId;

  // --- SoD-Regeln (0446) ---------------------------------------------------
  //
  // Eine Regel, deren beide Rollen der Datensatz nicht kennt, wird
  // weggelassen: `computeSod` fände damit ohnehin nichts, und eine Regel ohne
  // benennbare Rollen in der Kopfzeile mitzuzählen wäre eine Zahl ohne Inhalt.
  const sodRules: GrcSodRule[] = [];
  for (const row of rows.sodRules ?? []) {
    if (!roleById.has(row.roleAId) || !roleById.has(row.roleBId)) continue;
    const rule: Mutable<GrcSodRule> = {
      id: row.id,
      roleAId: row.roleAId,
      roleBId: row.roleBId,
      severity: sodSeverity(row.severity),
    };
    const rationale = nonEmpty(row.rationale);
    if (rationale) rule.rationale = rationale;
    const frameworkRef = nonEmpty(row.frameworkRef);
    if (frameworkRef) rule.frameworkRef = frameworkRef;
    sodRules.push(rule);
  }
  if (sodRules.length > 0) diagram.sodRules = sodRules;

  // --- Ausfallszenario (F6) ------------------------------------------------
  //
  // Kommt aus den Abfrageparametern, nicht aus der Datenbank. Der Name des
  // Assets wird aus den bereits geladenen Zeilen aufgelöst, statt ihn erneut
  // abzufragen oder die ID als Namen auszugeben.
  if (options.outage) {
    const scenario: Mutable<GrcOutageScenario> = {
      assetId: options.outage.assetId,
    };
    const known = rows.assets.find(
      (row) => row.assetId === options.outage?.assetId,
    );
    const assetName =
      nonEmpty(options.outage.assetName) ?? nonEmpty(known?.name);
    if (assetName) scenario.assetName = assetName;
    if (typeof options.outage.elapsedMinutes === "number") {
      scenario.elapsedMinutes = options.outage.elapsedMinutes;
    }
    diagram.outage = scenario;
  }

  // --- Conformance-Zusammenfassung (der Torwächter von F7) -----------------
  const summaryRow = rows.conformanceSummary;
  if (summaryRow) {
    const summary: Mutable<GrcConformanceSummary> = {};
    // `coverageRatio` ist die einzige Angabe, ohne die `conformanceGate` die
    // Heatmap verweigert — sie wird deshalb nur gesetzt, wenn tatsächlich
    // Ereignisse gezählt wurden.
    if (typeof summaryRow.coverageRatio === "number") {
      summary.coverageRatio = summaryRow.coverageRatio;
    }
    const unmapped = (summaryRow.unmappedActivities ?? []).filter(
      (name): name is string => typeof name === "string" && name.trim() !== "",
    );
    if (unmapped.length > 0) summary.unmappedActivities = unmapped;
    if (typeof summaryRow.totalTraces === "number") {
      summary.totalTraces = summaryRow.totalTraces;
    }
    if (typeof summaryRow.conformantTraces === "number") {
      summary.conformantTraces = summaryRow.conformantTraces;
    }
    if (Object.keys(summary).length > 0) diagram.conformance = summary;
  }

  const payload: Mutable<GrcOverlayData> = {
    computedAt: options.computedAt,
    elements: Object.fromEntries(
      [...elements].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ) as GrcOverlayData["elements"],
    diagram,
  };
  if (lanes.size > 0) {
    payload.lanes = Object.fromEntries(
      [...lanes].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ) as GrcOverlayData["lanes"];
  }
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
