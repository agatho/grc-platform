/**
 * Der Vertrag nach oben: was die Anwendung liefern muss, damit die
 * GRC-Diagrammschicht zeichnen kann — und was sie zurückmeldet, wenn jemand
 * etwas anklickt (Plan §3.3.6, §3.12).
 *
 * **Grundsatz.** Diese Schicht hat *keinen* Datenbankzugriff und kennt weder
 * Drizzle noch `fetch`. Sie bekommt einen fertig berechneten Datensatz — genau
 * die Nutzlast, die der geplante Endpunkt
 *
 * ```
 * GET /api/v1/processes/:id/diagram-overlay?version=:vid&layers=…
 * ```
 *
 * liefern soll (ein Aufruf, ein Cache-Eintrag, eine RLS-Prüfung). Alles, was
 * ein Nutzer nicht sehen darf, kommt schon gar nicht an: die Filterung ist
 * serverseitig, nicht hier. Deshalb ist jedes Feld optional — eine fehlende
 * Angabe bedeutet „nicht vorhanden **oder** nicht sichtbar", und die Schicht
 * unterscheidet das bewusst nicht.
 *
 * **Namensgebung.** Die Feldnamen folgen den Tabellen aus §3.13 in camelCase,
 * damit die spätere Anbindung eine mechanische Abbildung ist und keine
 * Übersetzungsleistung. Wo ein Feld eine Schemaänderung voraussetzt, steht das
 * am Typ — und gesammelt in `STUFE2-A2-GRC.md`, Abschnitt „Schemabedarf".
 */

/* ------------------------------------------------------------------ *
 * Gemeinsame Kleinteile
 * ------------------------------------------------------------------ */

/** Verweis auf eine Rolle (`custom_role`). */
export interface GrcRoleRef {
  readonly id: string;
  readonly name: string;
  /** Kürzel für die Anzeige am Element (2–3 Zeichen), z. B. `EK`. */
  readonly short?: string;
}

/** Verweis auf ein beliebiges GRC-Objekt, das ein Panel öffnen kann. */
export interface GrcObjectRef {
  readonly id: string;
  readonly title: string;
}

export type GrcCriticality = "very_high" | "high" | "medium" | "low";

export type GrcControlEffectiveness =
  "effective" | "partial" | "ineffective" | "untested";

export type GrcFindingSeverity = "low" | "medium" | "high" | "critical";

export type GrcLineOfDefense = "first" | "second" | "third" | "oversight";

/* ------------------------------------------------------------------ *
 * Objektgruppe A — Risiko, Kontrolle, Feststellung, LoD, Call Activity
 * ------------------------------------------------------------------ */

/** `risk` ⋈ `process_step_risk` (vorhanden). */
export interface GrcRisk extends GrcObjectRef {
  /** Bruttoscore, falls bewertet. */
  readonly inherentScore?: number;
  /** Nettoscore nach Kontrollen — Grundlage jeder Aggregation. */
  readonly residualScore: number;
  readonly owner?: string;
  readonly treatment?: string;
  /**
   * Kontrollen, die dieses Risiko am Schritt behandeln.
   * Die Abdeckungsrechnung (F1) prüft, ob darunter eine *wirksame* ist.
   */
  readonly controlIds?: readonly string[];
}

/** `control` ⋈ `process_step_control` (vorhanden). */
export interface GrcControl extends GrcObjectRef {
  readonly effectiveness: GrcControlEffectiveness;
  /** `control.is_key` — Annahme im Plan §3.4/A2: Feld existiert oder kommt. */
  readonly isKey?: boolean;
  /**
   * Verantwortliche Rolle der Kontrolle.
   *
   * Grundlage der Selbstkontroll-Prüfung (§3.4/A4): führt dieselbe Rolle die
   * Aktivität aus, die auch die einzige Kontrolle darauf verantwortet, ist das
   * ein Befund.
   */
  readonly ownerRole?: GrcRoleRef;
  /** Letzter Kontrolltest (`control_test_execution.executed_at`). */
  readonly lastTestedAt?: string;
  /** Ergebnis des letzten Tests. */
  readonly lastTestResult?: "passed" | "failed" | "partial";
  /** Jüngster Nachweis (`evidence.created_at`) — Grundlage von F4. */
  readonly lastEvidenceAt?: string;
  /** Nächste Fälligkeit des Nachweises/Tests. */
  readonly evidenceDueAt?: string;
}

/** `finding.process_step_id` (vorhanden). */
export interface GrcFinding extends GrcObjectRef {
  readonly severity: GrcFindingSeverity;
  readonly status: "open" | "in_progress" | "closed";
  /** Fälligkeit der Maßnahme — dreistufige Ampel statt bloßer Anzahl (§3.4/A3). */
  readonly dueAt?: string;
}

/** `process_step.called_process_id` (vorhanden) plus Roll-up (§3.4/A5). */
export interface GrcCalledProcess {
  readonly processId: string;
  readonly name: string;
  /**
   * Aggregat des Zielprozesses. Wird serverseitig berechnet — der Client kennt
   * das fremde Diagramm nicht.
   */
  readonly rollup?: {
    readonly riskCount: number;
    readonly maxResidualScore: number;
    readonly residualScoreSum: number;
    /** Anteil des durch wirksame Kontrollen abgedeckten Restrisikos, 0…1. */
    readonly coverageRatio?: number;
    readonly openFindings?: number;
  };
}

/* ------------------------------------------------------------------ *
 * Objektgruppe B — Asset, RACI, Simulation, DMN
 * ------------------------------------------------------------------ */

/** `process_step_asset` → `asset` (vorhanden, ohne UI). */
export interface GrcAsset extends GrcObjectRef {
  readonly criticality: GrcCriticality;
  /** C/I/A-Profil als Kürzel, z. B. `H/H/M`. */
  readonly cia?: string;
  readonly owner?: string;
  readonly openVulnerabilities?: number;
}

/**
 * Vollständige RACI-Zuordnung.
 *
 * *Schemabedarf:* C und I haben heute keine Datenbankheimat (§3.5/B2) — sie
 * stehen nur als Komma-String im XML. Erst `process_step_raci` macht diesen Typ
 * befüllbar.
 */
export interface GrcRaci {
  readonly responsible?: GrcRoleRef;
  readonly accountable?: GrcRoleRef;
  readonly consulted?: readonly GrcRoleRef[];
  readonly informed?: readonly GrcRoleRef[];
}

/** `simulation_activity_param` (vorhanden). */
export interface GrcSimulation {
  readonly durationMinutes?: number;
  readonly costPerExecution?: number;
  readonly executions?: number;
  readonly currency?: string;
}

/* ------------------------------------------------------------------ *
 * Objektgruppe C/D — Datenschutz, Kontinuität, Nachweis, Rahmenwerk
 * ------------------------------------------------------------------ */

/** *Schemabedarf:* `process_step_ropa` + `process_step_data_category` (§3.9). */
export interface GrcRopa {
  readonly isProcessingActivity: boolean;
  readonly purpose?: string;
  readonly legalBasis?: string;
  readonly dataCategories?: readonly GrcDataCategory[];
  /** Aufbewahrungsfrist in Monaten — Grundlage von F10. */
  readonly retentionMonths?: number;
  readonly retentionBasis?: string;
  readonly requiresDpia?: boolean;
  /** Verknüpfte DPIA. Fehlt sie bei `requiresDpia`, ist das ein Befund. */
  readonly dpiaId?: string;
  readonly dpiaStatus?: "not_required" | "required" | "in_progress" | "done";
  readonly transferThirdCountry?: boolean;
  /** ISO-3166-1 alpha-2, z. B. `US`. */
  readonly transferCountry?: string;
  readonly transferSafeguard?: string;
  readonly recipients?: readonly GrcObjectRef[];
}

export interface GrcDataCategory extends GrcObjectRef {
  readonly isSpecialCategory?: boolean;
}

/** *Schemabedarf:* `process_step_bia` (§3.10). */
export interface GrcBia {
  readonly criticality: GrcCriticality;
  readonly mtpdMinutes?: number;
  readonly rtoMinutes?: number;
  readonly rpoMinutes?: number;
  readonly workaround?: string;
  readonly workaroundMaxDurationMinutes?: number;
}

/** `process_framework_mapping` (+`process_step_id`, §3.6) → `catalog_entry`. */
export interface GrcFrameworkMapping {
  readonly id: string;
  readonly frameworkId: string;
  readonly frameworkName: string;
  /** Anforderungskennung, z. B. `A.8.2`. */
  readonly requirementRef: string;
  readonly requirementTitle?: string;
  /** Abdeckungsgrad dieser Anforderung an diesem Schritt. */
  readonly coverage: "covered" | "partial" | "gap";
}

/** `process_comment(entity_type='process_step')` — vorhanden, ungenutzt (§3.7). */
export interface GrcComments {
  readonly openThreads: number;
  readonly totalThreads: number;
  readonly lastAuthor?: string;
  readonly lastAt?: string;
  /** Im Reviewmodus: Anmerkungen, die eine Freigabe blockieren. */
  readonly blocking?: number;
}

/** Zuordnung Ereignisprotokoll ↔ Element (§3.8). */
export type GrcActivityMatchKind =
  "exact" | "normalized" | "fuzzy" | "manual" | "unmapped";

/** Mining-Kennzahlen je Element. */
export interface GrcConformanceElement {
  readonly matchKind: GrcActivityMatchKind;
  readonly observedCases?: number;
  readonly meanDurationMinutes?: number;
  readonly reworkLoops?: number;
  readonly isBottleneck?: boolean;
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-008] Ein Risikoindikator am Schritt (F15).
 *
 * **Der Befund, der diesen Typ möglich gemacht hat.** `STUFE2-A2-GRC.md` §6
 * hat F15 zurückgestellt, weil `kri_measurement` „keinen Zeitreihenvertrag und
 * keine Richtungsaussage" habe — ohne Richtung wäre die Ampel eine Zahl ohne
 * Bedeutung. Nachgemessen am Schema stimmt das nicht: `kri.direction`
 * (`asc` | `desc`, NOT NULL) steht seit Sprint 2, ebenso die drei Schwellen,
 * der Ampelstand, der Trend und `last_measured_at`. Und die Bedeutung ist
 * nicht nur da, sie ist auch **angewandt**: `POST /kris/:id/measurements`
 * rechnet Ampel und Trend bei jeder Messung aus der Richtung und schreibt sie
 * an die Zeile zurück. Die Ampel hat also eine feste Bedeutung — dieselbe, die
 * das ganze Produkt benutzt.
 *
 * **Zwei Dinge, die dieser Typ deshalb trennt.**
 *
 * 1. `alert` ist **optional**. Die Datenbank hat `current_alert_status` mit
 *    Vorgabewert `green`, und die Rechnung liefert `green`, sobald EINE der
 *    drei Schwellen fehlt. „Grün" heißt dort also auch „keine Schwellen
 *    hinterlegt" — im Diagramm wäre das eine Entwarnung aus fehlenden Daten,
 *    also genau die Zahl, die dieser Audit an anderer Stelle beanstandet.
 *    Ohne vollständige Schwellen bleibt das Feld deshalb leer.
 * 2. `measuredAt` und `frequency` gehören dazu. Ein grüner Indikator, dessen
 *    letzte Messung acht Monate alt ist, sagt nichts über heute; ohne den
 *    Stand ist die Ampel eine Behauptung über die Gegenwart aus Daten der
 *    Vergangenheit. Das ist derselbe Grund, aus dem `computedAt` im ganzen
 *    Vertrag Pflichtfeld ist.
 */
export interface GrcKri extends GrcObjectRef {
  /** `asc` = hoch ist schlecht, `desc` = niedrig ist schlecht. */
  readonly direction: "asc" | "desc";
  /** Ampelstand — fehlt, wenn nicht alle drei Schwellen hinterlegt sind. */
  readonly alert?: "green" | "yellow" | "red";
  readonly trend?: "improving" | "stable" | "worsening";
  readonly value?: number;
  readonly unit?: string;
  /** `kri.last_measured_at` — ohne ihn ist die Ampel undatiert. */
  readonly measuredAt?: string;
  /** Messtakt; Grundlage der Veraltungsprüfung. */
  readonly frequency?: "daily" | "weekly" | "monthly" | "quarterly";
  /** Das Risiko, dessen Frühwarnsignal dieser Indikator ist. */
  readonly riskId?: string;
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-004] Ein Sicherheitsvorfall an einem Schritt
 * (F14) — `security_incident` mit `process_step_id` seit Migration 0454.
 *
 * Bis Welle 3b führte der Vertrag hier `GrcObjectRef`, also Kennung und Titel.
 * Das reicht für eine Liste und nicht für ein Diagramm: ein Badge, das „2
 * Vorfälle" sagt, ohne zu sagen, ob sie laufen und wie schwer sie sind, ist
 * eine Zahl ohne Handlungsfolge. Schwere und Offenheit sind die beiden
 * Angaben, nach denen ein Prüfer als erstes fragt — sie gehören deshalb an das
 * Element und nicht in ein Panel dahinter.
 */
export interface GrcIncident extends GrcObjectRef {
  readonly severity: GrcFindingSeverity;
  /** `security_incident.status` als Rohwert — für die Textform. */
  readonly status?: string;
  /**
   * Läuft der Vorfall noch?
   *
   * **Bewusst hier und nicht aus `status` abgeleitet.** Der Lebenszyklus hat
   * sieben Stufen, und welche davon als abgeschlossen gilt, ist eine fachliche
   * Festlegung des Endpunkts (`closed_at IS NULL AND status <> 'closed'`) —
   * nicht eine Zeichenkettenprüfung in der Zeichenschicht.
   */
  readonly isOpen: boolean;
  readonly detectedAt?: string;
  /** Meldepflichtiger Datenschutzvorfall (Art. 33 DSGVO). */
  readonly isDataBreach?: boolean;
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-005] Eine offene Maßnahme an einem Schritt
 * (F16) — `work_item` mit `process_step_id` seit Migration 0454.
 *
 * Wie bei F14 trug der Vertrag nur `GrcObjectRef`. Die **Fälligkeit** ist hier
 * aber die ganze Aussage: „drei offene Maßnahmen" ist eine Zahl, „eine davon
 * seit zwölf Tagen überfällig" ist ein Befund. `dueAt` ist deshalb Teil des
 * Datensatzes und nicht optionaler Beiwert.
 */
export interface GrcWorkItem extends GrcObjectRef {
  /** `work_item.due_date`; fehlt, wenn keine Frist gesetzt ist. */
  readonly dueAt?: string;
  /** `work_item.status` als Rohwert — für die Textform. */
  readonly status?: string;
  /** `work_item.type_key` (`audit`, `control`, `risk`, …). */
  readonly typeKey?: string;
  /** Verantwortliche Person, soweit benannt. */
  readonly responsible?: string;
}

/* ------------------------------------------------------------------ *
 * Element-, Kanten- und Lane-Datensatz
 * ------------------------------------------------------------------ */

/**
 * Alles, was an *einem* BPMN-Element hängt.
 *
 * Schlüssel im Datensatz ist die BPMN-Element-ID. Sobald `process_step.step_key`
 * existiert (§3.2), tritt `stepKey` an ihre Stelle — deshalb ist er hier schon
 * vorgesehen, aber nicht tragend.
 */
export interface GrcElementData {
  readonly stepKey?: string;
  readonly risks?: readonly GrcRisk[];
  readonly controls?: readonly GrcControl[];
  readonly findings?: readonly GrcFinding[];
  readonly lineOfDefense?: GrcLineOfDefense;
  readonly calledProcess?: GrcCalledProcess;
  readonly assets?: readonly GrcAsset[];
  readonly raci?: GrcRaci;
  readonly simulation?: GrcSimulation;
  readonly dmnDecision?: GrcObjectRef;
  readonly ropa?: GrcRopa;
  readonly bia?: GrcBia;
  readonly documents?: readonly GrcObjectRef[];
  readonly frameworks?: readonly GrcFrameworkMapping[];
  readonly comments?: GrcComments;
  readonly conformance?: GrcConformanceElement;
  /** [OP-008] Risikoindikatoren an diesem Schritt (F15). */
  readonly kris?: readonly GrcKri[];
  /** [OP-004] Sicherheitsvorfälle an diesem Schritt (F14). */
  readonly incidents?: readonly GrcIncident[];
  /** [OP-005] Offene Maßnahmen an diesem Schritt (F16). */
  readonly workItems?: readonly GrcWorkItem[];
}

/** Was an einer Kante hängt (SequenceFlow, MessageFlow). */
export interface GrcEdgeData {
  /** Beobachtete Häufigkeit aus dem Ereignisprotokoll. */
  readonly frequency?: number;
  /** Verzweigungswahrscheinlichkeit, 0…1. */
  readonly probability?: number;
  readonly waitMinutes?: number;
  /**
   * Beobachtungsstand: modelliert und beobachtet, modelliert aber nie
   * beobachtet, oder beobachtete Abweichung ohne Modellentsprechung.
   */
  readonly observation?: "observed" | "unobserved";
  /**
   * Übertragung personenbezogener Daten über diese Kante — Voraussetzung
   * dafür, dass F5 die Kante überhaupt als Datenfluss wertet.
   */
  readonly carriesPersonalData?: boolean;
}

/** *Schemabedarf:* `process_lane` (§3.11) — heute gibt es keine Lane-Tabelle. */
export interface GrcLaneData {
  readonly name?: string;
  readonly kind?: "lane" | "pool";
  readonly orgUnit?: GrcObjectRef;
  readonly role?: GrcRoleRef;
  /** Träger der Lane ist ein Dienstleister → Auslöser der Vertrauensgrenze. */
  readonly vendor?: {
    readonly id: string;
    readonly name: string;
    readonly riskClass?: string;
  };
  readonly isExternal?: boolean;
  /** ISO-3166-1 alpha-2 des Sitzlandes, wenn Drittland. */
  readonly thirdCountry?: string;
  /** Anteil der Rollenmitglieder mit abgeschlossener Pflichtschulung, 0…1. */
  readonly trainingRatio?: number;
  /** Quote der Richtlinien-Kenntnisnahme, 0…1. */
  readonly acknowledgmentRatio?: number;
  /**
   * [ARCTOS-FULL-2026-08-31 · OP-010] Die Aufschlüsselung je Rolle — der
   * fehlende Teil von F17.
   *
   * `trainingRatio` oben ist eine **Quote der Lane-Rolle**: eine Zahl, die
   * sagt, dass etwas fehlt, aber nicht, bei wem und wie viel. „75 %" ist bei
   * vier Mitgliedern etwas anderes als bei vierzig, und in einer Lane
   * arbeiten in aller Regel mehrere Rollen — die Lane-Rolle ist nur die
   * tragende. Ohne die Aufschlüsselung ist die Kenntnisnahmelücke zählbar
   * und nicht handlungsfähig.
   *
   * Die Rollen sind die Trägerrolle der Lane **und** die RACI-Rollen der
   * Schritte, die dieser Lane zugeordnet sind (`process_step.lane_step_id`,
   * Migration 0445) — nicht geometrisch geraten.
   */
  readonly qualification?: readonly GrcLaneQualification[];
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-010] Der Qualifikationsstand einer Rolle an
 * einer Lane.
 *
 * **Absolute Zahlen, keine Quoten.** Die Quote steht schon an der Lane; was
 * hier fehlte, war die Grundlage: `3 von 12` ist eine Arbeitsanweisung, `75 %`
 * ist eine Kennzahl. Die Flags `hasMandatoryTraining`/`hasMandatoryPolicy`
 * bleiben erhalten, weil `0 von 0` keine Null-Prozent-Quote ist, sondern keine
 * Quote — dieselbe Regel wie bei `trainingRatio` (STUFE2-E-SCHEMA.md §3.1).
 */
export interface GrcLaneQualification {
  readonly role: GrcRoleRef;
  /** Mitglieder der Rolle im Mandanten. */
  readonly memberCount: number;
  /** Mit abgeschlossener Pflichtschulung; fehlt ohne Pflichtschulung. */
  readonly trainedCount?: number;
  /** Mit Kenntnisnahme; fehlt ohne Pflichtverteilung. */
  readonly acknowledgedCount?: number;
  /** Ob die Rolle die Trägerrolle der Lane ist oder nur darin arbeitet. */
  readonly isLaneRole: boolean;
}

/* ------------------------------------------------------------------ *
 * [ARCTOS-FULL-2026-08-31 · OP-011] Validierungsbefunde (Sicht „Modellierung")
 * ------------------------------------------------------------------ */

export type GrcValidationSeverity = "error" | "warning";

/**
 * Ein Modellierungsbefund, an ein Element geheftet.
 *
 * **Warum das nicht Teil von `GrcOverlayData` ist.** Alles andere in dieser
 * Datei ist Serverdatum: es kommt aus der Datenbank und wird über den
 * Overlay-Endpunkt geholt. Ein Validierungsbefund ist etwas anderes — er
 * entsteht aus dem Dokument, das der Modellierer gerade **im Browser**
 * bearbeitet, und ändert sich mit jeder Operation. Ihn durch den Endpunkt zu
 * schleifen hieße, den Server nach dem Zustand eines Dokuments zu fragen, das
 * er nicht hat. Er wird deshalb dem Kontext beigelegt
 * (`GrcLayerContext.validation`), nicht dem Datensatz.
 *
 * **Warum die Schicht ihre eigene Form deklariert.** Die Prüfwerkzeuge liegen
 * in `src/verify/` und in `src/modeling/invariants.ts` und führen jeweils
 * eigene Befundtypen (`InvariantViolation` mit `code`, `SchemaFinding` mit
 * `kind`/`line`). Einen davon hier zu importieren hieße, die Zeichenschicht
 * an ein Prüfwerkzeug zu binden — und `src/verify/` darf ausdrücklich in
 * keinem Anwendungsbündel landen (siehe dessen Kopfkommentar). Die Umsetzung
 * steht deshalb dort, wo die Werkzeuge stehen: `src/verify/markers.ts`.
 */
export interface GrcValidationFinding {
  /** Stabile Kennung der Regel, z. B. `DI_MISSING` oder `attribute-type`. */
  readonly rule: string;
  readonly severity: GrcValidationSeverity;
  /** BPMN-Element-ID; fehlt, wenn der Befund das Dokument als Ganzes trifft. */
  readonly elementId?: string;
  readonly message: string;
}

/* ------------------------------------------------------------------ *
 * Diagrammweite Angaben
 * ------------------------------------------------------------------ */

/** *Schemabedarf:* `sod_rule` (§3.11) — im Schema existiert dafür nichts. */
export interface GrcSodRule {
  readonly id: string;
  readonly roleAId: string;
  readonly roleBId: string;
  readonly severity: GrcFindingSeverity;
  readonly rationale?: string;
  readonly frameworkRef?: string;
}

/** Auswahl für die Ausfallsimulation (F6). */
export interface GrcOutageScenario {
  readonly assetId: string;
  readonly assetName?: string;
  /** Wie lange der Ausfall bereits andauert (für den MTPD-Reißpunkt). */
  readonly elapsedMinutes?: number;
}

/** Auswahl für die Framework-Abdeckungssicht (F8). */
export interface GrcFrameworkSelection {
  readonly frameworkId: string;
  readonly frameworkName?: string;
  /** Ausgewählte Anforderungen; leer = alle des Rahmenwerks. */
  readonly requirementRefs?: readonly string[];
}

/** `process_conformance_result` + `process_event_activity_map` (§3.8). */
export interface GrcConformanceSummary {
  /**
   * Anteil der Ereignisse, deren Aktivität einem Element zugeordnet ist, 0…1.
   *
   * **Ohne diese Angabe wird keine Heatmap gezeichnet** (Plan §3.8): eine
   * Heatmap, die stumm falsch ist, ist schlimmer als keine.
   */
  readonly coverageRatio?: number;
  readonly unmappedActivities?: readonly string[];
  readonly totalTraces?: number;
  readonly conformantTraces?: number;
  /** Beobachtete, nicht modellierte Pfade aus `fitness_gaps`. */
  readonly deviations?: readonly {
    readonly fromElementId: string;
    readonly toElementId: string;
    readonly frequency: number;
    readonly share?: number;
  }[];
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-012] Ein beobachteter Übergang, als Knotenpaar.
 *
 * **Warum als Paar und nicht als Kantenkennung.** `GrcEdgeData` ist ein Record
 * über **Kanten-IDs**, und genau die kennt der Server nicht: die BPMN-Kennung
 * eines SequenceFlow steht in keiner Tabelle des Schemas (nachgesehen —
 * `process_step` führt Knoten, Kanten führt niemand). Ein Endpunkt, der keine
 * BPMN-Datei parst, könnte eine Kantenkennung nur erfinden. Deshalb liefert er
 * das Paar, und die Diagrammschicht löst es auf — die Szene kennt zu jeder
 * Verbindung Quelle und Ziel. Denselben Weg geht `conformance.deviations`
 * seit 0465.
 *
 * `probability` ist eine **beobachtete** Quote: dieser Übergang geteilt durch
 * alle beobachteten Übergänge ab demselben Knoten. Sie sagt nicht, mit welcher
 * Wahrscheinlichkeit ein Gateway einen Zweig wählt — ein nie beobachteter
 * Zweig kommt in der Rechnung nicht vor.
 */
export interface GrcObservedTransition {
  readonly fromElementId: string;
  readonly toElementId: string;
  readonly frequency: number;
  /** Anteil an allen beobachteten Abgängen des Quellknotens, 0…1. */
  readonly probability?: number;
  /** Ob das Modell die beiden Knoten unmittelbar verbindet. */
  readonly isModelled?: boolean;
}

export interface GrcDiagramData {
  readonly processId?: string;
  readonly processName?: string;
  readonly versionId?: string;
  readonly sodRules?: readonly GrcSodRule[];
  readonly outage?: GrcOutageScenario;
  readonly framework?: GrcFrameworkSelection;
  readonly conformance?: GrcConformanceSummary;
  /**
   * [OP-012] Beobachtete Übergänge aus dem Ereignisprotokoll
   * (`process_event_transition_map`, Migration 0476). Die Layer lösen sie auf
   * die Verbindungen der Szene auf.
   */
  readonly transitions?: readonly GrcObservedTransition[];
  /** Bezugszeitpunkt aller Fälligkeitsrechnungen (Vorgabe: `computedAt`). */
  readonly asOf?: string;
}

/**
 * Die vollständige Nutzlast des Overlay-Endpunkts.
 *
 * `computedAt` ist Pflicht: jede Anzeige, die aus zwischengespeicherten Daten
 * entsteht, muss ihren Stand nennen können („Stand: vor 3 Minuten"). Ein
 * Diagramm mit stillschweigend veralteten Kontrollständen ist ein Prüfungsrisiko.
 */
export interface GrcOverlayData {
  readonly computedAt: string;
  readonly ttlSeconds?: number;
  readonly elements: Readonly<Record<string, GrcElementData | undefined>>;
  readonly edges?: Readonly<Record<string, GrcEdgeData | undefined>>;
  readonly lanes?: Readonly<Record<string, GrcLaneData | undefined>>;
  readonly diagram?: GrcDiagramData;
}

/** Leerer Datensatz — für Tests und für den Zustand „noch nichts geladen". */
export const EMPTY_OVERLAY_DATA: GrcOverlayData = {
  computedAt: "1970-01-01T00:00:00.000Z",
  elements: {},
};

/* ------------------------------------------------------------------ *
 * Ereignisse nach oben
 * ------------------------------------------------------------------ */

/**
 * Was passiert, wenn jemand etwas anklickt oder mit der Tastatur aktiviert.
 *
 * Die Diagrammschicht öffnet **kein** Panel und navigiert nirgendwohin — sie
 * meldet, was gemeint war. Das hält sie frei von Routing und macht sie in
 * Storybook, Tests und serverseitigem Rendern gleichermaßen benutzbar.
 */
export type GrcInteraction =
  | {
      readonly type: "badge.activate";
      readonly elementId: string;
      readonly layerId: string;
      readonly slot: "TL" | "TR" | "BL" | "BR";
      /** Die Objekte hinter dem Badge — Grundlage der Panelauswahl. */
      readonly refs: readonly GrcObjectRef[];
    }
  | {
      readonly type: "overflow.open";
      readonly elementId: string;
      /** Verdrängte Signale mit Layer-ID und Beschreibung. */
      readonly suppressed: readonly {
        readonly layerId: string;
        readonly text: string;
      }[];
    }
  | {
      readonly type: "pin.open";
      readonly elementId: string;
      readonly openThreads: number;
    }
  | {
      readonly type: "shape.activate";
      readonly elementId: string;
      readonly layerId: string;
    }
  | {
      readonly type: "edge.activate";
      readonly edgeId: string;
      readonly layerId: string;
    }
  | {
      readonly type: "arc.activate";
      readonly conflictId: string;
      readonly elementIds: readonly [string, string];
    }
  | {
      readonly type: "banner.activate";
      readonly layerId: string;
      readonly text: string;
    };

export type GrcInteractionHandler = (event: GrcInteraction) => void;
