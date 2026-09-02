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
  readonly incidents?: readonly GrcObjectRef[];
  readonly workItems?: readonly GrcObjectRef[];
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

export interface GrcDiagramData {
  readonly processId?: string;
  readonly processName?: string;
  readonly versionId?: string;
  readonly sodRules?: readonly GrcSodRule[];
  readonly outage?: GrcOutageScenario;
  readonly framework?: GrcFrameworkSelection;
  readonly conformance?: GrcConformanceSummary;
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
