/**
 * Sichten statt Einzelschalter (Plan §3.3.3) und Rollenvoreinstellungen (§3.3.4).
 *
 * Eine **Sicht** ist ein benanntes Preset: welche Layer an sind, welcher davon
 * die Formkodierung stellt, welche Legende gezeigt wird, welche Spalten die
 * Textalternative bekommt. Nutzer schalten Sichten, nicht Layer — Fortgeschrittene
 * dürfen einzelne Layer zuschalten, das Budget aus §3.3.2 greift trotzdem.
 *
 * Die Tabelle unten ist die aus §3.3.3, eins zu eins in Code. Wo eine Zeile
 * einen Layer nennt, den diese Ausbaustufe nicht gebaut hat (Validierung in der
 * Sicht „Modellierung", EAM-Zuordnungslinien in „Architektur"), fehlt er hier —
 * und steht im Protokoll unter „nicht gebaut".
 */

import { ALL_LAYERS } from "./catalog";
import {
  createLayerRegistry,
  type GrcLayer,
  type GrcLayerRegistry,
} from "./layers";

export type GrcViewId =
  | "modeling"
  | "risk-control"
  | "compliance"
  | "privacy"
  | "continuity"
  | "operations"
  | "organization"
  | "architecture"
  | "responsibility";

export interface GrcView {
  readonly id: GrcViewId;
  readonly title: string;
  /** Ein Satz, der die Sicht in der Oberfläche erklärt. */
  readonly purpose: string;
  /** Aktive Layer, in der Reihenfolge der Tabelle aus §3.3.3. */
  readonly layers: readonly string[];
  /**
   * Der Layer, der die Formkodierung stellen darf. Alle anderen `shape`-Signale
   * werden verdrängt und landen im Sammel-Badge — höchstens eine Formkodierung
   * (§3.3.2).
   */
  readonly shapeCodingLayer: string | undefined;
}

export const GRC_VIEWS: Readonly<Record<GrcViewId, GrcView>> = {
  modeling: {
    id: "modeling",
    title: "Modellierung",
    purpose:
      "Zeichnen ohne Ablenkung. Ein Modellierer will beim Zeichnen keine Heatmap.",
    // [ARCTOS-FULL-2026-08-31 · OP-011] Der Validierungsmarker ist die eine
    // Ausnahme von „ohne Ablenkung": ein Modellierungsfehler sieht auf dem
    // Bildschirm richtig aus und fällt erst auf, wenn ein Fremdwerkzeug die
    // Datei Monate später nicht mehr liest. Ohne beigelegte Befundliste
    // schweigt der Layer — die Sicht bleibt dann so leer wie vorher.
    layers: ["validation", "comments"],
    shapeCodingLayer: undefined,
  },
  "risk-control": {
    id: "risk-control",
    title: "Risiko & Kontrolle",
    purpose: "Wo ballt sich Restrisiko und wo fehlt die wirksame Kontrolle?",
    layers: [
      "control-coverage",
      "control",
      "risk",
      "line-of-defense",
      "raci",
      "call-activity",
      "finding",
      // [ARCTOS-FULL-2026-08-31 · OP-004/OP-005] Der eingetretene Vorfall und
      // die daraus laufende Maßnahme gehören in die Sicht, die nach Risiko
      // und Kontrolle fragt: sie sind das Ergebnis, an dem sich beides misst.
      "incident",
      "work-item",
      // [ARCTOS-FULL-2026-08-31 · OP-008] Das Frühwarnsignal gehört neben das
      // Risiko, dessen Signal es ist. Es steht in der Prioritätsordnung unter
      // den eingetretenen Befunden und wird deshalb in einer vollen Sicht oft
      // in den Sammel-Badge verdrängt — genannt wird es dort trotzdem.
      "kri",
      "comments",
    ],
    shapeCodingLayer: "control-coverage",
  },
  compliance: {
    id: "compliance",
    title: "Compliance & Nachweis",
    purpose:
      "Welche Schritte haben keinen frischen Nachweis — die Vorbereitungsfrage jedes Audits.",
    layers: ["evidence", "framework", "control-test", "finding", "comments"],
    shapeCodingLayer: "evidence",
  },
  privacy: {
    id: "privacy",
    title: "Datenschutz",
    purpose:
      "Wo entstehen personenbezogene Daten, wohin fließen sie, wann werden sie gelöscht?",
    layers: [
      "privacy",
      "dpia",
      "retention",
      "trust-boundary",
      "lane",
      "comments",
    ],
    shapeCodingLayer: "privacy",
  },
  continuity: {
    id: "continuity",
    title: "Kontinuität (BCM)",
    purpose:
      "Was steht still, wenn eine Anwendung ausfällt — und ab wann reißt das MTPD?",
    // [ARCTOS-FULL-2026-08-31 · OP-004] Vorfälle auch hier: die
    // Ausfallsimulation fragt „was wäre, wenn", der Vorfall sagt „was war".
    // Wer beides nebeneinander sieht, erkennt, ob die Annahme trägt.
    layers: ["outage", "bcm", "asset", "incident", "comments"],
    shapeCodingLayer: "outage",
  },
  operations: {
    id: "operations",
    title: "Betrieb & Effizienz",
    purpose:
      "Modell gegen Wirklichkeit: Durchlaufzeiten, Engpässe, Abweichungen.",
    // [ARCTOS-FULL-2026-08-31 · OP-006] F11 gehört hierher: die Sicht fragt
    // „Modell gegen Wirklichkeit", und wo das Geld hingeht, ist die zweite
    // Hälfte dieser Frage. Der Gutter zeigt die Kosten je Aktivität, der
    // Balken den Anteil je Rahmen — dieselbe Quelle, zwei Auflösungen.
    // [OP-008] In dieser Sicht steht der KRI-Badge unbedrängt: hier ist er
    // die Kennzahl, um die es geht, nicht die Fußnote neben einem Vorfall.
    layers: ["conformance", "operations", "cost", "kri", "comments"],
    shapeCodingLayer: "conformance",
  },
  organization: {
    id: "organization",
    title: "Organisation & SoD",
    purpose:
      "Aufgabentrennung zwischen Lanes — die klassische Prüfungsfrage jedes IKS-Audits.",
    layers: ["sod", "raci", "lane", "line-of-defense", "comments"],
    shapeCodingLayer: undefined,
  },
  architecture: {
    id: "architecture",
    title: "Architektur (EAM)",
    purpose: "Welche Anwendung hängt an welchem Schritt?",
    layers: ["asset", "lane", "comments"],
    shapeCodingLayer: undefined,
  },
  responsibility: {
    id: "responsibility",
    title: "Verantwortung",
    purpose:
      "Die Sicht des Mitarbeiters: was ist mein Schritt, wer ist zuständig, welche Arbeitsanweisung gilt.",
    // [ARCTOS-FULL-2026-08-31 · OP-005] „Was ist an meinem Schritt offen?" ist
    // genau die Frage dieser Sicht — bis hierher konnte sie sie nicht
    // beantworten.
    layers: ["raci", "document", "line-of-defense", "work-item", "comments"],
    shapeCodingLayer: undefined,
  },
};

/** Rollenvoreinstellungen (§3.3.4). */
export const ROLE_DEFAULT_VIEW: Readonly<Record<string, GrcViewId>> = {
  process_modeler: "modeling",
  process_owner: "modeling",
  risk_manager: "risk-control",
  second_line: "risk-control",
  internal_audit: "compliance",
  auditor: "compliance",
  data_protection_officer: "privacy",
  bcm_officer: "continuity",
  operations: "operations",
  iam: "organization",
  enterprise_architect: "architecture",
  employee: "responsibility",
};

/**
 * Standardsicht für eine Rolle.
 *
 * Unbekannte Rollen bekommen „Verantwortung": die Sicht mit der geringsten
 * Voraussetzung an Vorwissen und ohne Befunddarstellung, die jemand missdeuten
 * könnte.
 */
export function defaultViewForRole(role: string | undefined): GrcView {
  const id: GrcViewId =
    (role === undefined ? undefined : ROLE_DEFAULT_VIEW[role]) ??
    "responsibility";
  return GRC_VIEWS[id];
}

export interface ResolvedView {
  readonly view: GrcView;
  /** Aktive Layer nach Priorität — die Reihenfolge der Konfliktlösung. */
  readonly layers: readonly GrcLayer[];
  /** Layer-IDs, die die Sicht nennt, die aber nicht registriert sind. */
  readonly missing: readonly string[];
}

/**
 * Löst eine Sicht gegen ein Register auf.
 *
 * Zusätzlich zugeschaltete Layer (`extraLayerIds`) sind ausdrücklich erlaubt
 * (§3.3.3, „Fortgeschrittene"), ändern aber nichts am Budget.
 */
export function resolveView(
  view: GrcView,
  registry: GrcLayerRegistry = defaultRegistry(),
  extraLayerIds: readonly string[] = [],
): ResolvedView {
  const ids = [...new Set([...view.layers, ...extraLayerIds])];
  const layers: GrcLayer[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const layer = registry.get(id);
    if (layer) {
      layers.push(layer);
    } else {
      missing.push(id);
    }
  }
  layers.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  return { view, layers, missing };
}

let cached: GrcLayerRegistry | undefined;

/** Das Register aller gebauten Layer. */
export function defaultRegistry(): GrcLayerRegistry {
  cached ??= createLayerRegistry(ALL_LAYERS);
  return cached;
}

/** Sicht per ID, mit sprechendem Fehler statt `undefined`. */
export function viewById(id: string): GrcView {
  const view: GrcView | undefined = GRC_VIEWS[id as GrcViewId];
  if (!view) {
    throw new Error(
      `Unbekannte Sicht „${id}". Bekannt: ${Object.keys(GRC_VIEWS).join(", ")}.`,
    );
  }
  return view;
}
