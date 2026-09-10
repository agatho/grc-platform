/**
 * Der Layer-Katalog — hier werden aus den Rechenkernen sichtbare Signale.
 *
 * Jeder Layer trägt in `feature` die Nummer der Funktion aus Plan §3.12 bzw. der
 * Objektgruppe aus §3.4/§3.5, die er umsetzt. Die Prioritäten sind einmal
 * durchdacht und stehen in einer Tabelle beisammen (siehe `PRIORITY`), damit
 * Konflikte nicht in fünfzehn Dateien nachgeschlagen werden müssen.
 */

import type { BpmnConnection, BpmnShape } from "../draw/types";
import {
  computeCoverage,
  type CoverageStage,
  computeEvidence,
  computeFindings,
  computeIncidents,
  computeKri,
  computeLaneCosts,
  computeWorkItems,
  WORK_ITEM_DUE_SOON_DAYS,
  type LaneCostResult,
  computeFrameworkElement,
  computeRetention,
  daysBetween,
  KRI_STALE_FACTOR,
  personalDataStage,
  riskLevel,
  rollupRisk,
  SHORT_RETENTION_MONTHS,
} from "./analysis";
import type {
  GrcLaneQualification,
  GrcLineOfDefense,
  GrcObjectRef,
  GrcValidationFinding,
} from "./contract";
import { isContainer, laneOf } from "./graph";
import type { GrcLayer, GrcLayerContext, GrcLegendEntry } from "./layers";
import { formatMinutes } from "./outage";
import type {
  GrcDiagramSignal,
  GrcEdgeSignal,
  GrcElementSignal,
} from "./slots";
import { EDGE_DECORATION, TONE_GLYPH, type GrcTone } from "./tokens";

/**
 * Prioritätsordnung der Layer (§3.3.2).
 *
 * Leitgedanke: Was einen *Befund* meldet, schlägt was einen *Zustand* meldet;
 * was gerade ausdrücklich simuliert wird (Ausfall) schlägt alles, weil der
 * Nutzer genau danach gefragt hat.
 */
export const PRIORITY = {
  // [ARCTOS-FULL-2026-08-31 · OP-011] Über allem, aber nur in der Sicht
  // „Modellierung": ein Dokument, das ein Fremdwerkzeug nicht mehr lesen kann,
  // macht jede fachliche Aussage darüber gegenstandslos. In den acht anderen
  // Sichten ist der Layer gar nicht aktiv — dort zeichnet niemand.
  validation: 99,
  outage: 98,
  sod: 95,
  // [ARCTOS-FULL-2026-08-31 · OP-004] Ein Vorfall ist ein Risiko, das bereits
  // eingetreten ist. Er schlägt jede Abdeckungsstatistik: dass eine Kontrolle
  // als wirksam geführt wird, ist an einem Schritt, an dem gerade ein Vorfall
  // läuft, die weniger dringende Auskunft.
  incident: 92,
  controlCoverage: 90,
  evidence: 88,
  privacy: 86,
  risk: 85,
  conformance: 84,
  bcm: 82,
  finding: 80,
  // [ARCTOS-FULL-2026-08-31 · OP-008] Der Indikator steht UNTER dem, was
  // bereits eingetreten ist (Vorfall, Risiko, Feststellung) und über der
  // Rahmenwerkzuordnung. Er ist ein Frühwarnsignal: er sagt, was passieren
  // KÖNNTE. Wo daneben etwas steht, das passiert IST, ist das die dringendere
  // Auskunft — und der Sammel-Badge nennt ihn trotzdem.
  kri: 77,
  // [ARCTOS-FULL-2026-08-31 · OP-005] Die offene Maßnahme steht unmittelbar
  // unter der Feststellung, aus der sie meist hervorgeht — und über der
  // Kontrolle, deren Zustand sie gerade verändert.
  workItem: 79,
  control: 78,
  framework: 76,
  controlTest: 74,
  dpia: 72,
  dataCategory: 70,
  callActivity: 66,
  lineOfDefense: 62,
  asset: 58,
  raci: 54,
  retention: 46,
  operations: 40,
  // [ARCTOS-FULL-2026-08-31 · OP-006] Der Anteilsbalken teilt sich keinen
  // Slot mit einem Badge — er hat einen eigenen (Lane-Fußzeile). Die
  // Priorität entscheidet nur, welcher von zwei Fußzeilen-Layern gewinnt;
  // heute gibt es genau einen. Sie steht neben `operations`, weil beide
  // dieselbe Quelle lesen.
  cost: 39,
  trustBoundary: 36,
  comments: 30,
} as const;

/* ------------------------------------------------------------------ *
 * Hilfen
 * ------------------------------------------------------------------ */

function nameOf(element: BpmnShape | BpmnConnection): string {
  const name = element.businessObject.name;
  return typeof name === "string" && name !== "" ? name : element.id;
}

function isShape(element: BpmnShape | BpmnConnection): element is BpmnShape {
  return !Array.isArray((element as BpmnConnection).waypoints);
}

const ACTIVITY_TYPES = new Set([
  "bpmn:Task",
  "bpmn:UserTask",
  "bpmn:ServiceTask",
  "bpmn:SendTask",
  "bpmn:ReceiveTask",
  "bpmn:ManualTask",
  "bpmn:ScriptTask",
  "bpmn:BusinessRuleTask",
  "bpmn:SubProcess",
  "bpmn:Transaction",
  "bpmn:AdHocSubProcess",
  "bpmn:CallActivity",
]);

/** Elemente, an denen GRC-Objekte fachlich hängen können. */
export function carriesGrcData(shape: BpmnShape): boolean {
  return (
    ACTIVITY_TYPES.has(shape.type) ||
    shape.type.endsWith("Gateway") ||
    shape.type === "bpmn:Lane" ||
    shape.type === "bpmn:Participant" ||
    shape.type === "bpmn:DataObjectReference" ||
    shape.type === "bpmn:DataStoreReference"
  );
}

function refs(items: readonly GrcObjectRef[]): readonly GrcObjectRef[] {
  return items.map((item) => ({ id: item.id, title: item.title }));
}

function percent(value: number): string {
  return `${String(Math.round(value * 100))} %`;
}

/* ------------------------------------------------------------------ *
 * F1 — Kontrollabdeckungs-Heatmap (Formkodierung)
 * ------------------------------------------------------------------ */

const COVERAGE_TONE: Record<string, GrcTone> = {
  none: "neutral",
  full: "ok",
  partial: "warn",
  uncovered: "critical",
};

export const controlCoverageLayer: GrcLayer = {
  id: "control-coverage",
  title: "Kontrollabdeckung",
  feature: "F1",
  priority: PRIORITY.controlCoverage,

  forShape(shape, context) {
    if (!carriesGrcData(shape)) {
      return [];
    }
    const coverage = computeCoverage(context.data.elements[shape.id]);
    const inherited = inheritedCoverage(context, shape.id);
    const stage =
      coverage.riskCount > 0 ? coverage.stage : (inherited?.stage ?? "none");
    if (stage === "none") {
      return [];
    }
    const describe = this.describe(shape, context);
    if (describe === undefined) {
      return [];
    }
    const ratio = coverage.riskCount > 0 ? coverage.ratio : inherited?.ratio;
    return [
      {
        kind: "shape",
        tone: COVERAGE_TONE[stage] ?? "neutral",
        hatch:
          stage === "uncovered"
            ? "heavy"
            : stage === "partial"
              ? "light"
              : "none",
        value: ratio === undefined ? undefined : percent(ratio),
        describe,
      },
    ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const coverage = computeCoverage(context.data.elements[element.id]);
    if (coverage.riskCount === 0) {
      // Eine Call Activity ohne eigene Risiken erbt die Abdeckung ihres
      // Zielprozesses: Ein Prozess, der einen unkontrollierten Teilprozess
      // aufruft, ist selbst nicht kontrolliert (§3.4/A5).
      const inherited = inheritedCoverage(context, element.id);
      if (!inherited) {
        return undefined;
      }
      return `Kontrollabdeckung ${percent(inherited.ratio)} des Restrisikos, geerbt aus „${inherited.name}".`;
    }
    const head =
      coverage.ratio === undefined
        ? "Kontrollabdeckung nicht berechenbar (Risiken ohne Bewertung)"
        : `Kontrollabdeckung ${percent(coverage.ratio)} des Restrisikos`;
    const uncovered =
      coverage.uncoveredRisks.length === 0
        ? "alle Risiken haben eine wirksame Kontrolle"
        : `${String(coverage.uncoveredRisks.length)} Risiko${
            coverage.uncoveredRisks.length === 1 ? "" : "en"
          } ohne wirksame Kontrolle: ${coverage.uncoveredRisks
            .map(
              (risk) =>
                `„${risk.title}" (Restwert ${String(risk.residualScore)})`,
            )
            .join(", ")}`;
    return `${head}; ${uncovered}.`;
  },

  legend() {
    return [
      {
        tone: "neutral",
        glyph: TONE_GLYPH.neutral,
        text: "kein Risiko am Schritt",
      },
      {
        tone: "ok",
        glyph: TONE_GLYPH.ok,
        text: "Restrisiko vollständig abgedeckt",
      },
      {
        tone: "warn",
        glyph: TONE_GLYPH.warn,
        text: "teilweise abgedeckt (feine Schraffur)",
      },
      {
        tone: "critical",
        glyph: TONE_GLYPH.critical,
        text: "Risiko ohne wirksame Kontrolle (grobe Schraffur)",
      },
    ];
  },
};

/** Abdeckung, die eine Call Activity von ihrem Zielprozess erbt. */
function inheritedCoverage(
  context: GrcLayerContext,
  elementId: string,
): { ratio: number; stage: CoverageStage; name: string } | undefined {
  const called = context.data.elements[elementId]?.calledProcess;
  const ratio = called?.rollup?.coverageRatio;
  if (!called || ratio === undefined) {
    return undefined;
  }
  return {
    ratio,
    stage: ratio >= 1 ? "full" : ratio <= 0 ? "uncovered" : "partial",
    name: called.name,
  };
}

/* ------------------------------------------------------------------ *
 * Kontrollen als Badge (Slot TL)
 * ------------------------------------------------------------------ */

export const controlLayer: GrcLayer = {
  id: "control",
  title: "Kontrollen",
  feature: "A2",
  priority: PRIORITY.control,

  forShape(shape, context) {
    const controls = context.data.elements[shape.id]?.controls ?? [];
    if (controls.length === 0) {
      return [];
    }
    const effective = controls.filter(
      (control) => control.effectiveness === "effective",
    ).length;
    const tone: GrcTone =
      effective === controls.length
        ? "ok"
        : effective === 0
          ? "critical"
          : "warn";
    const describe = this.describe(shape, context);
    return describe === undefined
      ? []
      : [
          {
            kind: "badge",
            slot: "TL",
            text: `${String(effective)}/${String(controls.length)}`,
            tone,
            refs: refs(controls),
            describe,
          },
        ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const controls = context.data.elements[element.id]?.controls ?? [];
    if (controls.length === 0) {
      return undefined;
    }
    const effective = controls.filter(
      (control) => control.effectiveness === "effective",
    ).length;
    const keys = controls.filter((control) => control.isKey === true).length;
    return (
      `${String(controls.length)} Kontrolle${controls.length === 1 ? "" : "n"}, ` +
      `davon ${String(effective)} wirksam` +
      (keys > 0
        ? `, ${String(keys)} Schlüsselkontrolle${keys === 1 ? "" : "n"}`
        : "") +
      "."
    );
  },
};

/* ------------------------------------------------------------------ *
 * F2 — Risiko-Ampel mit Roll-up (Slot TR)
 * ------------------------------------------------------------------ */

const RISK_TONE: Record<string, GrcTone> = {
  high: "critical",
  medium: "warn",
  low: "ok",
};

export const riskLayer: GrcLayer = {
  id: "risk",
  title: "Risiken",
  feature: "F2",
  priority: PRIORITY.risk,

  forShape(shape, context) {
    if (!carriesGrcData(shape)) {
      return [];
    }
    const profile = rollupRisk(context.graph, context.data, shape);
    if (profile.count === 0) {
      return [];
    }
    const describe = this.describe(shape, context);
    return describe === undefined
      ? []
      : [
          {
            kind: "badge",
            slot: "TR",
            text: `${String(profile.count)}·${String(profile.maxResidual)}${
              profile.origin === "own" ? "" : "»"
            }`,
            tone: RISK_TONE[riskLevel(profile.maxResidual)] ?? "ok",
            refs: refs(context.data.elements[shape.id]?.risks ?? []),
            describe,
          },
        ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const profile = rollupRisk(context.graph, context.data, element);
    if (profile.count === 0) {
      return undefined;
    }
    const level = riskLevel(profile.maxResidual);
    const word =
      level === "high" ? "hoch" : level === "medium" ? "mittel" : "niedrig";
    const inherited =
      profile.origin === "own"
        ? ""
        : ` Davon geerbt aus: ${profile.inheritedFrom.join(", ")}.`;
    return (
      `${String(profile.count)} Risik${profile.count === 1 ? "o" : "en"}, ` +
      `höchster Restwert ${String(profile.maxResidual)} (${word}), Summe ${String(
        profile.sumResidual,
      )}.${inherited}`
    );
  },

  legend() {
    return [
      {
        tone: "critical",
        glyph: TONE_GLYPH.critical,
        text: "Restwert ≥ 15 (hoch)",
      },
      { tone: "warn", glyph: TONE_GLYPH.warn, text: "Restwert 9–14 (mittel)" },
      { tone: "ok", glyph: TONE_GLYPH.ok, text: "Restwert < 9 (niedrig)" },
      {
        tone: "info",
        glyph: "»",
        text: "Wert aus Subprozess oder Call Activity geerbt",
      },
    ];
  },
};

/* ------------------------------------------------------------------ *
 * A3 — Feststellungen mit Fälligkeit (Slot BR)
 * ------------------------------------------------------------------ */

export const findingLayer: GrcLayer = {
  id: "finding",
  title: "Feststellungen",
  feature: "A3",
  priority: PRIORITY.finding,

  forShape(shape, context) {
    const result = computeFindings(
      context.data.elements[shape.id],
      context.asOf,
    );
    if (result.stage === "none") {
      return [];
    }
    const describe = this.describe(shape, context);
    const tone: GrcTone =
      result.stage === "overdue"
        ? "critical"
        : result.stage === "due"
          ? "warn"
          : "info";
    return describe === undefined
      ? []
      : [
          {
            kind: "badge",
            slot: "BR",
            text: `F${String(result.open)}`,
            tone,
            refs: refs(result.items),
            describe,
          },
        ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const result = computeFindings(
      context.data.elements[element.id],
      context.asOf,
    );
    if (result.stage === "none") {
      return undefined;
    }
    const parts = [
      `${String(result.open)} offene Feststellung${result.open === 1 ? "" : "en"}`,
    ];
    if (result.overdue > 0) {
      parts.push(`${String(result.overdue)} überfällig`);
    }
    if (result.dueSoon > 0) {
      parts.push(`${String(result.dueSoon)} fällig in 14 Tagen`);
    }
    if (result.critical > 0) {
      parts.push(`${String(result.critical)} kritisch`);
    }
    return `${parts.join(", ")}.`;
  },
};

/* ------------------------------------------------------------------ *
 * A4 — Line of Defense (linke Kante)
 * ------------------------------------------------------------------ */

const LOD_LABEL: Record<GrcLineOfDefense, string> = {
  first: "1. Verteidigungslinie",
  second: "2. Verteidigungslinie",
  third: "3. Verteidigungslinie",
  oversight: "Aufsicht",
};

const LOD_TONE: Record<GrcLineOfDefense, GrcTone> = {
  first: "info",
  second: "accent",
  third: "ok",
  oversight: "neutral",
};

export const lineOfDefenseLayer: GrcLayer = {
  id: "line-of-defense",
  title: "Verteidigungslinie",
  feature: "A4",
  priority: PRIORITY.lineOfDefense,

  forShape(shape, context) {
    const lod = context.data.elements[shape.id]?.lineOfDefense;
    if (!lod) {
      return [];
    }
    return [
      {
        kind: "stripe",
        tone: LOD_TONE[lod],
        label: LOD_LABEL[lod],
        describe: `${LOD_LABEL[lod]}.`,
      },
    ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const lod = context.data.elements[element.id]?.lineOfDefense;
    return lod ? `${LOD_LABEL[lod]}.` : undefined;
  },
};

/* ------------------------------------------------------------------ *
 * B2 — RACI (Slot BL)
 * ------------------------------------------------------------------ */

export const raciLayer: GrcLayer = {
  id: "raci",
  title: "Verantwortung (RACI)",
  feature: "B2",
  priority: PRIORITY.raci,

  forShape(shape, context) {
    const raci = context.data.elements[shape.id]?.raci;
    if (!raci?.responsible && !raci?.accountable) {
      return [];
    }
    const describe = this.describe(shape, context);
    const short = [
      raci.responsible
        ? `R:${raci.responsible.short ?? initials(raci.responsible.name)}`
        : "",
      raci.accountable
        ? `A:${raci.accountable.short ?? initials(raci.accountable.name)}`
        : "",
    ]
      .filter((part) => part !== "")
      .join(" ");
    return describe === undefined
      ? []
      : [
          {
            kind: "badge",
            slot: "BL",
            text: short,
            tone: "neutral",
            glyph: "",
            describe,
          },
        ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const raci = context.data.elements[element.id]?.raci;
    if (!raci) {
      return undefined;
    }
    const parts: string[] = [];
    if (raci.responsible) {
      parts.push(`Durchführung: ${raci.responsible.name}`);
    }
    if (raci.accountable) {
      parts.push(`Rechenschaft: ${raci.accountable.name}`);
    }
    if (raci.consulted && raci.consulted.length > 0) {
      parts.push(
        `Beteiligt: ${raci.consulted.map((role) => role.name).join(", ")}`,
      );
    }
    if (raci.informed && raci.informed.length > 0) {
      parts.push(
        `Informiert: ${raci.informed.map((role) => role.name).join(", ")}`,
      );
    }
    return parts.length === 0 ? undefined : `${parts.join(". ")}.`;
  },
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 3);
}

/* ------------------------------------------------------------------ *
 * A5 — Call Activity mit Roll-up (Slot BL)
 * ------------------------------------------------------------------ */

export const callActivityLayer: GrcLayer = {
  id: "call-activity",
  title: "Aufgerufener Prozess",
  feature: "A5",
  priority: PRIORITY.callActivity,

  forShape(shape, context) {
    const called = context.data.elements[shape.id]?.calledProcess;
    if (!called) {
      return [];
    }
    const describe = this.describe(shape, context);
    const uncontrolled =
      called.rollup?.coverageRatio !== undefined &&
      called.rollup.coverageRatio < 1;
    return describe === undefined
      ? []
      : [
          {
            kind: "badge",
            slot: "BL",
            text: `» ${truncate(called.name, 14)}`,
            tone: uncontrolled ? "warn" : "info",
            glyph: "",
            refs: [{ id: called.processId, title: called.name }],
            describe,
          },
        ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const called = context.data.elements[element.id]?.calledProcess;
    if (!called) {
      return undefined;
    }
    const rollup = called.rollup;
    if (!rollup) {
      return `Ruft den Prozess „${called.name}" auf.`;
    }
    return (
      `Ruft den Prozess „${called.name}" auf. Geerbt: ${String(rollup.riskCount)} Risiken, ` +
      `höchster Restwert ${String(rollup.maxResidualScore)}` +
      (rollup.coverageRatio === undefined
        ? ""
        : `, Kontrollabdeckung ${percent(rollup.coverageRatio)}`) +
      (rollup.openFindings
        ? `, ${String(rollup.openFindings)} offene Feststellungen`
        : "") +
      "."
    );
  },
};

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/* ------------------------------------------------------------------ *
 * F4 — Nachweisfälligkeit (Formkodierung + Slot BL)
 * ------------------------------------------------------------------ */

const EVIDENCE_TONE: Record<string, GrcTone> = {
  fresh: "ok",
  due: "warn",
  overdue: "critical",
  never: "critical",
};

const EVIDENCE_WORD: Record<string, string> = {
  fresh: "aktuell",
  due: "fällig",
  overdue: "überfällig",
  never: "kein Nachweis",
};

export const evidenceLayer: GrcLayer = {
  id: "evidence",
  title: "Nachweisfälligkeit",
  feature: "F4",
  priority: PRIORITY.evidence,

  forShape(shape, context) {
    const element = context.data.elements[shape.id];
    if (!element?.controls || element.controls.length === 0) {
      return [];
    }
    const result = computeEvidence(element, context.asOf);
    const describe = this.describe(shape, context);
    if (describe === undefined) {
      return [];
    }
    const tone = EVIDENCE_TONE[result.stage] ?? "neutral";
    return [
      {
        kind: "shape",
        tone,
        hatch:
          result.stage === "never"
            ? "heavy"
            : result.stage === "overdue"
              ? "medium"
              : result.stage === "due"
                ? "light"
                : "none",
        value: EVIDENCE_WORD[result.stage],
        describe,
      },
      {
        kind: "badge",
        slot: "BL",
        text:
          result.stage === "never"
            ? "nie"
            : result.daysUntilDue === undefined
              ? `${String(result.ageDays ?? 0)}T`
              : `${result.daysUntilDue < 0 ? "-" : ""}${String(
                  Math.abs(result.daysUntilDue),
                )}T`,
        tone,
        describe,
      },
    ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const data = context.data.elements[element.id];
    if (!data?.controls || data.controls.length === 0) {
      return undefined;
    }
    const result = computeEvidence(data, context.asOf);
    if (result.stage === "never") {
      return `Nachweis: ${String(result.withoutEvidence.length)} Kontrolle${
        result.withoutEvidence.length === 1 ? "" : "n"
      } ohne jeden Nachweis (${result.withoutEvidence
        .map((control) => `„${control.title}"`)
        .join(", ")}).`;
    }
    const due =
      result.daysUntilDue === undefined
        ? ""
        : result.daysUntilDue < 0
          ? `, überfällig seit ${String(-result.daysUntilDue)} Tagen`
          : `, fällig in ${String(result.daysUntilDue)} Tagen`;
    const age =
      result.ageDays === undefined
        ? ""
        : `, jüngster Nachweis ${String(result.ageDays)} Tage alt`;
    return `Nachweis ${EVIDENCE_WORD[result.stage] ?? ""}${due}${age}.`;
  },

  legend() {
    return [
      { tone: "ok", glyph: TONE_GLYPH.ok, text: "Nachweis aktuell" },
      { tone: "warn", glyph: TONE_GLYPH.warn, text: "fällig in ≤ 30 Tagen" },
      {
        tone: "critical",
        glyph: TONE_GLYPH.critical,
        text: "überfällig oder nie erbracht",
      },
    ];
  },
};

/* ------------------------------------------------------------------ *
 * F13 — Kontrolltest-Ergebnis (Slot TR)
 * ------------------------------------------------------------------ */

export const controlTestLayer: GrcLayer = {
  id: "control-test",
  title: "Kontrolltests",
  feature: "F13",
  priority: PRIORITY.controlTest,

  forShape(shape, context) {
    const controls = context.data.elements[shape.id]?.controls ?? [];
    const tested = controls.filter((control) => control.lastTestResult);
    if (tested.length === 0) {
      return [];
    }
    const failed = tested.filter(
      (control) => control.lastTestResult === "failed",
    ).length;
    const partial = tested.filter(
      (control) => control.lastTestResult === "partial",
    ).length;
    const describe = this.describe(shape, context);
    return describe === undefined
      ? []
      : [
          {
            kind: "badge",
            slot: "TR",
            text: `${String(tested.length - failed - partial)}/${String(tested.length)}`,
            tone: failed > 0 ? "critical" : partial > 0 ? "warn" : "ok",
            refs: refs(tested),
            describe,
          },
        ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const controls = context.data.elements[element.id]?.controls ?? [];
    const tested = controls.filter((control) => control.lastTestResult);
    if (tested.length === 0) {
      return undefined;
    }
    const failed = tested.filter(
      (control) => control.lastTestResult === "failed",
    );
    return (
      `Kontrolltests: ${String(tested.length)} geprüft, ` +
      `${String(tested.filter((c) => c.lastTestResult === "passed").length)} bestanden` +
      (failed.length > 0
        ? `, nicht bestanden: ${failed.map((c) => `„${c.title}"`).join(", ")}`
        : "") +
      "."
    );
  },
};

/* ------------------------------------------------------------------ *
 * F8 — Framework-Abdeckung (Slot TL + Kopfzeile + Legende)
 * ------------------------------------------------------------------ */

const FRAMEWORK_TONE: Record<string, GrcTone> = {
  covered: "ok",
  partial: "warn",
  gap: "critical",
  none: "neutral",
};

export const frameworkLayer: GrcLayer = {
  id: "framework",
  title: "Rahmenwerk",
  feature: "F8",
  priority: PRIORITY.framework,

  forShape(shape, context) {
    const result = computeFrameworkElement(
      context.data.elements[shape.id],
      context.data.diagram?.framework,
    );
    if (result.stage === "none") {
      return [];
    }
    const describe = this.describe(shape, context);
    const first = result.relevant[0];
    const extra = result.relevant.length - 1;
    return describe === undefined || !first
      ? []
      : [
          {
            kind: "badge",
            slot: "TL",
            text: `${first.requirementRef}${extra > 0 ? ` +${String(extra)}` : ""}`,
            tone: FRAMEWORK_TONE[result.stage] ?? "neutral",
            refs: result.relevant.map((mapping) => ({
              id: mapping.id,
              title:
                `${mapping.requirementRef} ${mapping.requirementTitle ?? ""}`.trim(),
            })),
            describe,
          },
        ];
  },

  forDiagram(context): readonly GrcDiagramSignal[] {
    const summary = context.framework;
    if (!summary) {
      return [];
    }
    const text =
      `${summary.frameworkName}: ${String(summary.covered)} von ${String(
        summary.requirements,
      )} Anforderungen abgedeckt (${percent(summary.coverageRatio)})` +
      (summary.gaps > 0
        ? `, ${String(summary.gaps)} Lücke${summary.gaps === 1 ? "" : "n"}: ${summary.gapRequirements.join(", ")}`
        : "");
    return [
      {
        kind: "banner",
        tone: summary.gaps > 0 ? "warn" : "ok",
        text,
        describe: `${text}.`,
      },
    ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const result = computeFrameworkElement(
      context.data.elements[element.id],
      context.data.diagram?.framework,
    );
    if (result.stage === "none") {
      return undefined;
    }
    return `Anforderungen: ${result.relevant
      .map(
        (mapping) =>
          `${mapping.requirementRef}${
            mapping.requirementTitle ? ` (${mapping.requirementTitle})` : ""
          } — ${coverageWord(mapping.coverage)}`,
      )
      .join("; ")}.`;
  },

  legend(context) {
    const summary = context.framework;
    const entries: GrcLegendEntry[] = [
      { tone: "ok", glyph: TONE_GLYPH.ok, text: "Anforderung abgedeckt" },
      { tone: "warn", glyph: TONE_GLYPH.warn, text: "teilweise abgedeckt" },
      { tone: "critical", glyph: TONE_GLYPH.critical, text: "Lücke" },
    ];
    if (summary) {
      entries.push({
        tone: "info",
        glyph: TONE_GLYPH.info,
        text: `Abdeckungsgrad ${percent(summary.coverageRatio)} (${String(summary.covered)}/${String(summary.requirements)})`,
      });
    }
    return entries;
  },
};

function coverageWord(coverage: "covered" | "partial" | "gap"): string {
  return coverage === "covered"
    ? "abgedeckt"
    : coverage === "partial"
      ? "teilweise"
      : "Lücke";
}

/* ------------------------------------------------------------------ *
 * F3 — SoD (Slot TR + Bögen)
 * ------------------------------------------------------------------ */

/** Ab wie vielen Konflikten nur noch der ausgewählte Bogen gezeichnet wird (§3.11). */
export const MAX_DRAWN_ARCS = 3;

export const sodLayer: GrcLayer = {
  id: "sod",
  title: "Aufgabentrennung",
  feature: "F3",
  priority: PRIORITY.sod,

  forShape(shape, context) {
    const conflicts = context.sod.involved.get(shape.id) ?? [];
    const selfControl = context.sod.selfControls.find(
      (entry) => entry.elementId === shape.id,
    );
    if (conflicts.length === 0 && !selfControl) {
      return [];
    }
    const describe = this.describe(shape, context);
    if (describe === undefined) {
      return [];
    }
    const worst = conflicts.some((conflict) => conflict.severity === "critical")
      ? "critical"
      : conflicts.length > 0
        ? "warn"
        : "warn";
    return [
      {
        kind: "badge",
        slot: "TR",
        text: conflicts.length > 0 ? `SoD ${String(conflicts.length)}` : "SoD",
        tone: worst,
        refs: conflicts.map((conflict) => ({
          id: conflict.id,
          title: conflict.describe,
        })),
        describe,
      },
    ];
  },

  forDiagram(context): readonly GrcDiagramSignal[] {
    const conflicts = context.sod.conflicts;
    const selected = context.selectedConflictId
      ? conflicts.filter(
          (conflict) => conflict.id === context.selectedConflictId,
        )
      : conflicts.length <= MAX_DRAWN_ARCS
        ? conflicts
        : [];

    const signals: GrcDiagramSignal[] = selected.map((conflict) => ({
      kind: "arc",
      id: conflict.id,
      fromId: conflict.a.elementId,
      toId: conflict.b.elementId,
      tone: conflict.severity === "critical" ? "critical" : "warn",
      label: `SoD: ${conflict.a.role.short ?? initials(conflict.a.role.name)} / ${
        conflict.b.role.short ?? initials(conflict.b.role.name)
      }`,
      lock: true,
      describe: conflict.describe,
    }));

    if (conflicts.length > 0) {
      const drawn = selected.length;
      const text =
        `${String(conflicts.length)} Aufgabentrennungskonflikt${
          conflicts.length === 1 ? "" : "e"
        }` +
        (drawn < conflicts.length
          ? ` — ${String(drawn)} gezeichnet, übrige in der Liste`
          : "") +
        (context.sod.selfControls.length > 0
          ? `, ${String(context.sod.selfControls.length)} Selbstkontrolle${
              context.sod.selfControls.length === 1 ? "" : "n"
            }`
          : "");
      signals.push({
        kind: "banner",
        tone: "critical",
        text,
        describe: `${text}.`,
      });
    }
    return signals;
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const conflicts = context.sod.involved.get(element.id) ?? [];
    const selfControl = context.sod.selfControls.find(
      (entry) => entry.elementId === element.id,
    );
    const parts = conflicts.map((conflict) => conflict.describe);
    if (selfControl) {
      parts.push(selfControl.describe);
    }
    return parts.length === 0 ? undefined : parts.join(" ");
  },

  legend() {
    return [
      {
        tone: "critical",
        glyph: TONE_GLYPH.critical,
        text: "SoD-Konflikt (gestrichelter Bogen mit Schloss)",
      },
      { tone: "warn", glyph: TONE_GLYPH.warn, text: "Selbstkontrolle" },
    ];
  },
};

/* ------------------------------------------------------------------ *
 * §3.9 — Datenschutz: Personenbezug (Form) + Kategorien (TL/TR)
 * ------------------------------------------------------------------ */

export const privacyLayer: GrcLayer = {
  id: "privacy",
  title: "Personenbezug",
  feature: "§3.9",
  priority: PRIORITY.privacy,

  forShape(shape, context) {
    const ropa = context.data.elements[shape.id]?.ropa;
    const stage = personalDataStage(ropa);
    if (stage === "none") {
      return [];
    }
    const describe = this.describe(shape, context);
    if (describe === undefined) {
      return [];
    }
    const signals: GrcElementSignal[] = [
      {
        kind: "shape",
        tone: stage === "special" ? "accent" : "info",
        hatch: stage === "special" ? "medium" : "none",
        value: stage === "special" ? "bes. Kategorie" : "personenbezogen",
        describe,
      },
    ];
    const categories = ropa?.dataCategories ?? [];
    const first = categories[0];
    if (first) {
      const extra = categories.length - 1;
      signals.push({
        kind: "badge",
        slot: "TL",
        text: `${truncate(first.title, 12)}${extra > 0 ? ` +${String(extra)}` : ""}`,
        tone: "accent",
        glyph: "",
        refs: refs(categories),
        describe,
      });
    }
    if (stage === "special") {
      signals.push({
        kind: "badge",
        slot: "TR",
        text: "Art. 9",
        tone: "accent",
        describe: `Besondere Kategorien personenbezogener Daten (Art. 9 DSGVO): ${categories
          .filter((category) => category.isSpecialCategory)
          .map((category) => category.title)
          .join(", ")}.`,
      });
    }
    return signals;
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const ropa = context.data.elements[element.id]?.ropa;
    const stage = personalDataStage(ropa);
    if (stage === "none") {
      return undefined;
    }
    const categories = (ropa?.dataCategories ?? [])
      .map(
        (category) =>
          `${category.title}${category.isSpecialCategory ? " (besondere Kategorie)" : ""}`,
      )
      .join(", ");
    return (
      `Verarbeitet personenbezogene Daten${
        stage === "special" ? " einschließlich besonderer Kategorien" : ""
      }${categories ? `: ${categories}` : ""}` +
      (ropa?.purpose ? `. Zweck: ${ropa.purpose}` : "") +
      (ropa?.legalBasis ? `. Rechtsgrundlage: ${ropa.legalBasis}` : "") +
      "."
    );
  },

  legend() {
    return [
      { tone: "info", glyph: TONE_GLYPH.info, text: "personenbezogene Daten" },
      {
        tone: "accent",
        glyph: TONE_GLYPH.accent,
        text: "besondere Kategorie (Art. 9 DSGVO, Schraffur)",
      },
    ];
  },
};

/* ------------------------------------------------------------------ *
 * §3.9 — DPIA-Status (Slot BL)
 * ------------------------------------------------------------------ */

export const dpiaLayer: GrcLayer = {
  id: "dpia",
  title: "Datenschutz-Folgenabschätzung",
  feature: "§3.9",
  priority: PRIORITY.dpia,

  forShape(shape, context) {
    const ropa = context.data.elements[shape.id]?.ropa;
    if (!ropa?.requiresDpia && !ropa?.dpiaId) {
      return [];
    }
    const describe = this.describe(shape, context);
    const missing = ropa.requiresDpia === true && !ropa.dpiaId;
    return describe === undefined
      ? []
      : [
          {
            kind: "badge",
            slot: "BL",
            text: missing ? "DPIA!" : "DPIA",
            tone: missing ? "critical" : "ok",
            describe,
          },
        ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const ropa = context.data.elements[element.id]?.ropa;
    if (!ropa?.requiresDpia && !ropa?.dpiaId) {
      return undefined;
    }
    if (ropa.requiresDpia === true && !ropa.dpiaId) {
      return "Datenschutz-Folgenabschätzung erforderlich, aber keine verknüpft — Compliance-Befund.";
    }
    const status =
      ropa.dpiaStatus === "done"
        ? "abgeschlossen"
        : ropa.dpiaStatus === "in_progress"
          ? "laufend"
          : ropa.dpiaStatus === "required"
            ? "erforderlich"
            : "nicht erforderlich";
    return `Datenschutz-Folgenabschätzung ${status}.`;
  },
};

/* ------------------------------------------------------------------ *
 * F10 — Aufbewahrung und Löschung (Gutter + Slot BR)
 * ------------------------------------------------------------------ */

export const retentionLayer: GrcLayer = {
  id: "retention",
  title: "Aufbewahrung",
  feature: "F10",
  priority: PRIORITY.retention,

  forShape(shape, context) {
    const result = computeRetention(context.data.elements[shape.id]?.ropa);
    if (result.months === undefined) {
      return [];
    }
    const describe = this.describe(shape, context);
    if (describe === undefined) {
      return [];
    }
    return [
      {
        kind: "gutter",
        entries: [`${String(result.months)} Mon.`],
        describe,
      },
      {
        kind: "badge",
        slot: "BR",
        text: `${String(result.months)}M`,
        tone: result.stage === "short" ? "warn" : "info",
        describe,
      },
    ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const result = computeRetention(context.data.elements[element.id]?.ropa);
    if (result.months === undefined) {
      return undefined;
    }
    return (
      `Aufbewahrung ${String(result.months)} Monate` +
      (result.basis ? ` (${result.basis})` : "") +
      (result.stage === "short"
        ? `, kürzer als ${String(SHORT_RETENTION_MONTHS)} Monate — Löschung ist zeitnah zu steuern`
        : "") +
      (result.specialCategory ? ", besondere Kategorien betroffen" : "") +
      "."
    );
  },
};

/* ------------------------------------------------------------------ *
 * F5 — Vertrauensgrenzen (Kanten)
 * ------------------------------------------------------------------ */

export const trustBoundaryLayer: GrcLayer = {
  id: "trust-boundary",
  title: "Vertrauensgrenzen",
  feature: "F5",
  priority: PRIORITY.trustBoundary,

  forEdge(connection, context): GrcEdgeSignal | undefined {
    const crossing = context.trust.byEdgeId.get(connection.id);
    if (!crossing) {
      return undefined;
    }
    return {
      kind: "edge",
      tone: crossing.specialCategory
        ? "accent"
        : crossing.personalData
          ? "critical"
          : "warn",
      style: "double",
      chip: crossing.country ?? "extern",
      glyph: TONE_GLYPH.critical,
      describe: crossing.describe,
    };
  },

  describe(element, context) {
    if (isShape(element)) {
      return undefined;
    }
    return context.trust.byEdgeId.get(element.id)?.describe;
  },

  legend() {
    return [
      {
        tone: "critical",
        glyph: TONE_GLYPH.critical,
        text: "Doppelkante: personenbezogene Daten verlassen den Verantwortungsbereich",
      },
      {
        tone: "warn",
        glyph: TONE_GLYPH.warn,
        text: "Übergang ohne hinterlegten Personenbezug",
      },
    ];
  },
};

/* ------------------------------------------------------------------ *
 * §3.10 — BCM (Form + Gutter + Slot BL)
 * ------------------------------------------------------------------ */

const CRITICALITY_TONE: Record<string, GrcTone> = {
  very_high: "critical",
  high: "warn",
  medium: "info",
  low: "neutral",
};

const CRITICALITY_WORD: Record<string, string> = {
  very_high: "sehr hoch",
  high: "hoch",
  medium: "mittel",
  low: "niedrig",
};

export const bcmLayer: GrcLayer = {
  id: "bcm",
  title: "Kontinuität",
  feature: "§3.10",
  priority: PRIORITY.bcm,

  forShape(shape, context) {
    const bia = context.data.elements[shape.id]?.bia;
    if (!bia) {
      return [];
    }
    const describe = this.describe(shape, context);
    if (describe === undefined) {
      return [];
    }
    const signals: GrcElementSignal[] = [
      {
        kind: "shape",
        tone: CRITICALITY_TONE[bia.criticality] ?? "neutral",
        hatch: bia.criticality === "very_high" ? "medium" : "none",
        value: CRITICALITY_WORD[bia.criticality],
        describe,
      },
    ];
    const gutter: string[] = [];
    if (bia.rtoMinutes !== undefined) {
      gutter.push(`RTO ${formatMinutes(bia.rtoMinutes)}`);
    }
    if (bia.rpoMinutes !== undefined) {
      gutter.push(`RPO ${formatMinutes(bia.rpoMinutes)}`);
    }
    if (bia.mtpdMinutes !== undefined) {
      gutter.push(`MTPD ${formatMinutes(bia.mtpdMinutes)}`);
    }
    if (gutter.length > 0) {
      signals.push({ kind: "gutter", entries: gutter, describe });
    }
    signals.push({
      kind: "badge",
      slot: "BL",
      text: bia.workaround ? "AV ja" : "AV nein",
      tone: bia.workaround ? "ok" : "warn",
      glyph: "",
      describe: bia.workaround
        ? `Ausweichverfahren vorhanden: ${bia.workaround}.`
        : "Kein Ausweichverfahren dokumentiert.",
    });
    return signals;
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const bia = context.data.elements[element.id]?.bia;
    if (!bia) {
      return undefined;
    }
    const parts = [
      `Kritikalität ${CRITICALITY_WORD[bia.criticality] ?? bia.criticality}`,
    ];
    if (bia.mtpdMinutes !== undefined) {
      parts.push(`MTPD ${formatMinutes(bia.mtpdMinutes)}`);
    }
    if (bia.rtoMinutes !== undefined) {
      parts.push(`RTO ${formatMinutes(bia.rtoMinutes)}`);
    }
    if (bia.rpoMinutes !== undefined) {
      parts.push(`RPO ${formatMinutes(bia.rpoMinutes)}`);
    }
    parts.push(
      bia.workaround
        ? `Ausweichverfahren: ${bia.workaround}`
        : "kein Ausweichverfahren dokumentiert",
    );
    return `${parts.join(", ")}.`;
  },
};

/* ------------------------------------------------------------------ *
 * B1 — Asset am Schritt (Slot TL)
 * ------------------------------------------------------------------ */

export const assetLayer: GrcLayer = {
  id: "asset",
  title: "Anwendungen",
  feature: "B1",
  priority: PRIORITY.asset,

  forShape(shape, context) {
    const assets = context.data.elements[shape.id]?.assets ?? [];
    const first = [...assets].sort(
      (a, b) => criticalityRank(b.criticality) - criticalityRank(a.criticality),
    )[0];
    if (!first) {
      return [];
    }
    const describe = this.describe(shape, context);
    const extra = assets.length - 1;
    return describe === undefined
      ? []
      : [
          {
            kind: "badge",
            slot: "TL",
            text: `${truncate(first.title, 12)}${extra > 0 ? ` +${String(extra)}` : ""}`,
            tone: CRITICALITY_TONE[first.criticality] ?? "neutral",
            glyph: "",
            refs: refs(assets),
            describe,
          },
        ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const assets = context.data.elements[element.id]?.assets ?? [];
    if (assets.length === 0) {
      return undefined;
    }
    return `Anwendungen: ${assets
      .map(
        (asset) =>
          `${asset.title} (Kritikalität ${CRITICALITY_WORD[asset.criticality] ?? asset.criticality}` +
          (asset.openVulnerabilities
            ? `, ${String(asset.openVulnerabilities)} offene Schwachstellen`
            : "") +
          ")",
      )
      .join(", ")}.`;
  },
};

function criticalityRank(criticality: string): number {
  return ["low", "medium", "high", "very_high"].indexOf(criticality);
}

/* ------------------------------------------------------------------ *
 * F6 — Ausfallsimulation (Form + Slot BR + Kopfzeile)
 * ------------------------------------------------------------------ */

export const outageLayer: GrcLayer = {
  id: "outage",
  title: "Ausfallsimulation",
  feature: "F6",
  priority: PRIORITY.outage,

  forShape(shape, context) {
    const step = context.outage?.steps.get(shape.id);
    if (!step || step.state === "unaffected") {
      return [];
    }
    const tone: GrcTone =
      step.state === "affected"
        ? "critical"
        : step.state === "blocked"
          ? "warn"
          : "info";
    return [
      {
        kind: "shape",
        tone,
        hatch:
          step.state === "affected"
            ? "heavy"
            : step.state === "blocked"
              ? "medium"
              : "light",
        value:
          step.state === "affected"
            ? "Ausfall"
            : step.state === "blocked"
              ? "blockiert"
              : "Ausweichverf.",
        describe: step.describe,
      },
      {
        kind: "badge",
        slot: "BR",
        text:
          step.state === "affected"
            ? "AUS"
            : step.state === "blocked"
              ? "BLOCK"
              : "AV",
        tone,
        describe: step.describe,
      },
    ];
  },

  forDiagram(context): readonly GrcDiagramSignal[] {
    const outage = context.outage;
    if (!outage) {
      return [];
    }
    const breached =
      outage.minutesToBreach !== undefined && outage.minutesToBreach < 0;
    return [
      {
        kind: "banner",
        tone: breached ? "critical" : "warn",
        text: outage.summary,
        describe: outage.summary,
      },
    ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    return context.outage?.steps.get(element.id)?.describe;
  },

  legend() {
    return [
      {
        tone: "critical",
        glyph: TONE_GLYPH.critical,
        text: "direkt betroffen (grobe Schraffur)",
      },
      {
        tone: "warn",
        glyph: TONE_GLYPH.warn,
        text: "blockiert, kein Ausweichverfahren",
      },
      {
        tone: "info",
        glyph: TONE_GLYPH.info,
        text: "Ausweichverfahren dokumentiert",
      },
    ];
  },
};

/* ------------------------------------------------------------------ *
 * F7 — Conformance (Form + Gutter + Kanten + Geisterkanten)
 * ------------------------------------------------------------------ */

export const conformanceLayer: GrcLayer = {
  id: "conformance",
  title: "Conformance",
  feature: "F7",
  priority: PRIORITY.conformance,

  forShape(shape, context) {
    if (!context.conformance.available) {
      return [];
    }
    const element = context.data.elements[shape.id]?.conformance;
    if (!element || element.matchKind === "unmapped") {
      return [];
    }
    const describe = this.describe(shape, context);
    if (describe === undefined) {
      return [];
    }
    const signals: GrcElementSignal[] = [];
    const duration = element.meanDurationMinutes;
    if (duration !== undefined) {
      signals.push({
        kind: "shape",
        tone: durationTone(duration),
        hatch: duration >= 240 ? "medium" : "none",
        value: formatMinutes(duration),
        describe,
      });
    }
    const gutter: string[] = [];
    if (duration !== undefined) {
      gutter.push(`ø ${formatMinutes(duration)}`);
    }
    if (element.observedCases !== undefined) {
      gutter.push(`n=${element.observedCases.toLocaleString("de-DE")}`);
    }
    if (gutter.length > 0) {
      signals.push({ kind: "gutter", entries: gutter, describe });
    }
    if (element.isBottleneck) {
      signals.push({
        kind: "badge",
        slot: "TR",
        glyph: "",
        text: "Engpass",
        tone: "critical",
        describe,
      });
    }
    if (element.reworkLoops && element.reworkLoops > 0) {
      signals.push({
        kind: "badge",
        slot: "BR",
        text: `R${String(element.reworkLoops)}`,
        tone: "warn",
        glyph: "",
        describe,
      });
    }
    return signals;
  },

  forEdge(connection, context): GrcEdgeSignal | undefined {
    if (!context.conformance.available) {
      return undefined;
    }
    const edge = context.data.edges?.[connection.id];
    // [ARCTOS-FULL-2026-08-31 · OP-012] Der Übergang aus dem Ereignisprotokoll
    // (`process_event_transition_map`, 0476) als zweite Quelle. Eine
    // ausdrücklich gelieferte Kantenangabe schlägt sie — sonst überschriebe
    // eine Messung eine hinterlegte Tatsache.
    const observed = context.transitions.byEdge.get(connection.id);
    if (!edge && !observed) {
      return undefined;
    }
    if (edge?.observation === "unobserved") {
      return {
        kind: "edge",
        tone: "neutral",
        style: "dashed",
        describe: "Modelliert, aber nie beobachtet.",
      };
    }
    const frequency = edge?.frequency ?? observed?.frequency;
    const probability = edge?.probability ?? observed?.probability;
    if (frequency === undefined) {
      return undefined;
    }
    return {
      kind: "edge",
      tone: "info",
      // Die Häufigkeit trägt allein die Strichstärke. Ein Zahlenchip an *jeder*
      // Kante war im ersten gerasterten Beleg genau die Tapete, die §3.3
      // verhindern soll — die Zahl steht in der Ansage und in der Tabelle.
      style: "solid",
      width: flowWidth(frequency),
      describe: `Beobachtet in ${frequency.toLocaleString("de-DE")} Fällen${
        probability === undefined ? "" : ` (${percent(probability)})`
      }.`,
    };
  },

  forDiagram(context): readonly GrcDiagramSignal[] {
    const summary = context.data.diagram?.conformance;
    const signals: GrcDiagramSignal[] = [
      {
        kind: "banner",
        tone: context.conformance.available ? "info" : "warn",
        text: context.conformance.note,
        describe: context.conformance.note,
      },
    ];
    if (!context.conformance.available) {
      return signals;
    }
    for (const deviation of summary?.deviations ?? []) {
      const text = `Beobachteter, nicht modellierter Pfad: ${deviation.frequency.toLocaleString(
        "de-DE",
      )} Fälle${deviation.share === undefined ? "" : ` (${percent(deviation.share)})`}`;
      signals.push({
        kind: "ghost-edge",
        id: `deviation:${deviation.fromElementId}:${deviation.toElementId}`,
        fromId: deviation.fromElementId,
        toId: deviation.toElementId,
        tone: "critical",
        label:
          deviation.share === undefined
            ? deviation.frequency.toLocaleString("de-DE")
            : percent(deviation.share),
        describe: `${text}.`,
      });
    }
    return signals;
  },

  describe(element, context) {
    if (!context.conformance.available) {
      return undefined;
    }
    if (!isShape(element)) {
      const edge = context.data.edges?.[element.id];
      const observed = context.transitions.byEdge.get(element.id);
      if (!edge && !observed) {
        return undefined;
      }
      if (edge?.observation === "unobserved") {
        return "Modelliert, aber nie beobachtet.";
      }
      const frequency = edge?.frequency ?? observed?.frequency;
      return frequency === undefined
        ? undefined
        : `Beobachtet in ${frequency.toLocaleString("de-DE")} Fällen.`;
    }
    const data = context.data.elements[element.id]?.conformance;
    if (!data) {
      return undefined;
    }
    if (data.matchKind === "unmapped") {
      return "Keine Zuordnung zum Ereignisprotokoll — dieser Schritt geht nicht in die Heatmap ein.";
    }
    const parts = [`Zuordnung ${matchWord(data.matchKind)}`];
    if (data.meanDurationMinutes !== undefined) {
      parts.push(
        `mittlere Durchlaufzeit ${formatMinutes(data.meanDurationMinutes)}`,
      );
    }
    if (data.observedCases !== undefined) {
      parts.push(
        `${data.observedCases.toLocaleString("de-DE")} beobachtete Fälle`,
      );
    }
    if (data.isBottleneck) {
      parts.push("als Engpass erkannt");
    }
    if (data.reworkLoops) {
      parts.push(`${String(data.reworkLoops)} Nacharbeitsschleifen`);
    }
    return `${parts.join(", ")}.`;
  },

  legend(context) {
    return [
      {
        tone: "ok",
        glyph: TONE_GLYPH.ok,
        text: "unter 1 h mittlere Durchlaufzeit",
      },
      { tone: "warn", glyph: TONE_GLYPH.warn, text: "1–4 h" },
      {
        tone: "critical",
        glyph: TONE_GLYPH.critical,
        text: "über 4 h (Schraffur)",
      },
      {
        tone: "neutral",
        glyph: TONE_GLYPH.neutral,
        text: "modelliert, nie beobachtet (gestrichelt)",
      },
      { tone: "info", glyph: TONE_GLYPH.info, text: context.conformance.note },
    ];
  },
};

function durationTone(minutes: number): GrcTone {
  if (minutes >= 240) {
    return "critical";
  }
  if (minutes >= 60) {
    return "warn";
  }
  return "ok";
}

/** Strichstärke aus der Häufigkeit — logarithmisch (§3.8). */
export function flowWidth(frequency: number): number {
  const { minFlowWidth, maxFlowWidth } = EDGE_DECORATION;
  if (frequency <= 0) {
    return minFlowWidth;
  }
  const scaled = Math.log10(frequency + 1) / 4;
  return (
    Math.round(
      (minFlowWidth + Math.min(1, scaled) * (maxFlowWidth - minFlowWidth)) * 10,
    ) / 10
  );
}

function matchWord(kind: string): string {
  switch (kind) {
    case "exact":
      return "exakt";
    case "normalized":
      return "normalisiert";
    case "fuzzy":
      return "unscharf";
    case "manual":
      return "manuell";
    default:
      return "offen";
  }
}

/* ------------------------------------------------------------------ *
 * B4 — Betrieb und Effizienz (Gutter + Kantenstärke)
 * ------------------------------------------------------------------ */

export const operationsLayer: GrcLayer = {
  id: "operations",
  title: "Betrieb und Kosten",
  feature: "B4",
  priority: PRIORITY.operations,

  forShape(shape, context) {
    const simulation = context.data.elements[shape.id]?.simulation;
    if (!simulation) {
      return [];
    }
    const describe = this.describe(shape, context);
    if (describe === undefined) {
      return [];
    }
    const entries: string[] = [];
    if (simulation.durationMinutes !== undefined) {
      entries.push(formatMinutes(simulation.durationMinutes));
    }
    if (simulation.costPerExecution !== undefined) {
      entries.push(
        `${simulation.costPerExecution.toLocaleString("de-DE")} ${simulation.currency ?? "€"}`,
      );
    }
    if (simulation.executions !== undefined) {
      entries.push(`${simulation.executions.toLocaleString("de-DE")}×`);
    }
    return entries.length === 0 ? [] : [{ kind: "gutter", entries, describe }];
  },

  forEdge(connection, context): GrcEdgeSignal | undefined {
    // [ARCTOS-FULL-2026-08-31 · OP-012] Zwei Quellen, in dieser Reihenfolge:
    // ein ausdrücklich geliefertes `edges[]` (heute liefert es niemand, siehe
    // MISSING_TODAY) schlägt die aus dem Ereignisprotokoll gerechnete Zahl.
    // Eine gemessene Größe darf eine hinterlegte nicht überschreiben.
    const edge = context.data.edges?.[connection.id];
    const observed = context.transitions.byEdge.get(connection.id);
    const probability = edge?.probability ?? observed?.probability;
    const frequency = edge?.frequency ?? observed?.frequency;
    if (probability === undefined) {
      return undefined;
    }
    return {
      kind: "edge",
      tone: "neutral",
      style: "solid",
      width: frequency === undefined ? undefined : flowWidth(frequency),
      chip: percent(probability),
      describe:
        `Verzweigungswahrscheinlichkeit ${percent(probability)}` +
        (frequency === undefined
          ? ""
          : `, beobachtet in ${frequency.toLocaleString("de-DE")} Fällen`) +
        // Die Herkunft gehört dazu: eine beobachtete Quote ist keine Aussage
        // über die modellierte Zweigwahl, und ein Prüfer muss den Unterschied
        // sehen können, ohne die Datenherkunft zu kennen.
        (edge?.probability === undefined && observed !== undefined
          ? " (aus dem Ereignisprotokoll)"
          : "") +
        ".",
    };
  },

  describe(element, context) {
    if (!isShape(element)) {
      const probability =
        context.data.edges?.[element.id]?.probability ??
        context.transitions.byEdge.get(element.id)?.probability;
      return probability === undefined
        ? undefined
        : `Verzweigungswahrscheinlichkeit ${percent(probability)}.`;
    }
    const simulation = context.data.elements[element.id]?.simulation;
    if (!simulation) {
      return undefined;
    }
    const parts: string[] = [];
    if (simulation.durationMinutes !== undefined) {
      parts.push(`mittlere Dauer ${formatMinutes(simulation.durationMinutes)}`);
    }
    if (simulation.costPerExecution !== undefined) {
      parts.push(
        `Kosten je Durchlauf ${simulation.costPerExecution.toLocaleString("de-DE")} ${
          simulation.currency ?? "€"
        }`,
      );
    }
    if (simulation.executions !== undefined) {
      parts.push(`${simulation.executions.toLocaleString("de-DE")} Durchläufe`);
    }
    return parts.length === 0 ? undefined : `${parts.join(", ")}.`;
  },
};

/* ------------------------------------------------------------------ *
 * F9 — Element-Kommentare (Pin-Schiene)
 * ------------------------------------------------------------------ */

export const commentsLayer: GrcLayer = {
  id: "comments",
  title: "Kommentare",
  feature: "F9",
  priority: PRIORITY.comments,

  forShape(shape, context) {
    const comments = context.data.elements[shape.id]?.comments;
    if (!comments || comments.totalThreads === 0) {
      return [];
    }
    const describe = this.describe(shape, context);
    return describe === undefined
      ? []
      : [
          {
            kind: "pin",
            text: String(
              comments.openThreads > 0
                ? comments.openThreads
                : comments.totalThreads,
            ),
            // Kommentare sind kein GRC-Befund und dürfen nicht mit einem
            // konkurrieren — deshalb eigene Schiene und neutraler Ton (§3.7).
            tone: comments.blocking ? "warn" : "neutral",
            openThreads: comments.openThreads,
            describe,
          },
        ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const comments = context.data.elements[element.id]?.comments;
    if (!comments || comments.totalThreads === 0) {
      return undefined;
    }
    return (
      `Kommentare: ${String(comments.openThreads)} offen von ${String(comments.totalThreads)}` +
      (comments.blocking
        ? `, davon ${String(comments.blocking)} blockierend`
        : "") +
      (comments.lastAuthor ? `, zuletzt ${comments.lastAuthor}` : "") +
      "."
    );
  },
};

/* ------------------------------------------------------------------ *
 * Lane-Kopf: Träger, Dienstleister, Qualifikationsquote
 * ------------------------------------------------------------------ */

export const laneLayer: GrcLayer = {
  id: "lane",
  title: "Lane-Träger",
  feature: "§3.11",
  priority: PRIORITY.raci + 1,

  forShape(shape, context) {
    if (shape.type !== "bpmn:Lane" && shape.type !== "bpmn:Participant") {
      return [];
    }
    const lane = context.data.lanes?.[shape.id];
    if (!lane) {
      return [];
    }
    const describe = this.describe(shape, context);
    if (describe === undefined) {
      return [];
    }
    const signals: GrcElementSignal[] = [];
    if (lane.vendor || lane.thirdCountry) {
      signals.push({
        kind: "badge",
        slot: "TL",
        text: lane.thirdCountry ? `» ${lane.thirdCountry}` : "» extern",
        tone: "accent",
        glyph: "",
        describe,
      });
    }
    if (lane.trainingRatio !== undefined && lane.trainingRatio < 1) {
      // [ARCTOS-FULL-2026-08-31 · OP-010] Die Aufschlüsselung hängt an DIESEM
      // Badge, nicht nur an der Lane insgesamt: er ist die Stelle, auf die
      // ein Leser mit Tastatur oder Screenreader zusteuert, wenn er wissen
      // will, was an der Qualifikation fehlt. Eine Quote im zugänglichen
      // Namen und die Aufschlüsselung nur woanders wäre dieselbe Zahl ohne
      // Handlungsfolge, die OP-010 beanstandet.
      const gaps = describeQualificationGaps(lane.qualification ?? []);
      signals.push({
        kind: "badge",
        slot: "BR",
        text: percent(lane.trainingRatio),
        tone: lane.trainingRatio < 0.8 ? "warn" : "info",
        describe:
          `Qualifikationsquote ${percent(lane.trainingRatio)} der Rollenmitglieder.` +
          (gaps.length > 0 ? ` Offen: ${gaps.join("; ")}.` : ""),
      });
    }
    return signals;
  },

  describe(element, context) {
    if (!isShape(element) || !isContainer(element)) {
      return undefined;
    }
    const lane = context.data.lanes?.[element.id];
    if (!lane) {
      return undefined;
    }
    const parts: string[] = [];
    if (lane.role) {
      parts.push(`Rolle ${lane.role.name}`);
    }
    if (lane.orgUnit) {
      parts.push(`Organisationseinheit ${lane.orgUnit.title}`);
    }
    if (lane.vendor) {
      parts.push(
        `Dienstleister ${lane.vendor.name}${
          lane.vendor.riskClass
            ? ` (Risikoklasse ${lane.vendor.riskClass})`
            : ""
        }`,
      );
    }
    if (lane.thirdCountry) {
      parts.push(`Sitz im Drittland ${lane.thirdCountry}`);
    }
    if (lane.trainingRatio !== undefined) {
      parts.push(`Qualifikationsquote ${percent(lane.trainingRatio)}`);
    }
    if (lane.acknowledgmentRatio !== undefined) {
      parts.push(
        `Richtlinien-Kenntnisnahme ${percent(lane.acknowledgmentRatio)}`,
      );
    }
    // [ARCTOS-FULL-2026-08-31 · OP-010] Die Aufschlüsselung je Rolle. Sie
    // steht in der Beschreibung und damit im zugänglichen Namen, in der
    // Live-Ansage und in der Textalternative — den drei Stellen, an denen
    // diese Schicht „Panel" sagt (§4.2/§4.3). Genannt werden nur die Rollen
    // mit einer LÜCKE: eine vollständig geschulte Rolle ist keine
    // Handlungsanweisung, und eine Aufzählung, in der jede Zeile „12 von 12"
    // sagt, verdeckt die eine, die es nicht tut.
    const gaps = describeQualificationGaps(lane.qualification ?? []);
    if (gaps.length > 0) {
      parts.push(`offen: ${gaps.join("; ")}`);
    }
    return parts.length === 0 ? undefined : `${parts.join(", ")}.`;
  },
};

/**
 * [ARCTOS-FULL-2026-08-31 · OP-010] Die Lücken je Rolle als Satzteile.
 *
 * Ein Eintrag entsteht nur, wenn es überhaupt eine Pflicht gibt (`…Count` ist
 * dann gesetzt) UND jemand sie nicht erfüllt hat. `0 von 0` ist keine Lücke,
 * sondern keine Pflicht — der Unterschied ist derselbe, aus dem
 * `trainingRatio` bei fehlender Pflichtschulung ganz wegbleibt
 * (STUFE2-E-SCHEMA.md §3.1).
 *
 * Sortiert nach Größe der Lücke, dann nach Rollenname: dieselben Daten müssen
 * denselben Satz ergeben, sonst hängt die Textalternative an der Reihenfolge
 * der Datenbankzeilen.
 */
export function describeQualificationGaps(
  entries: readonly GrcLaneQualification[],
): readonly string[] {
  const rows: { text: string; gap: number; name: string }[] = [];
  for (const entry of entries) {
    const missing: string[] = [];
    let worst = 0;
    if (entry.trainedCount !== undefined) {
      const open = entry.memberCount - entry.trainedCount;
      if (open > 0) {
        missing.push(
          `${String(open)} von ${String(entry.memberCount)} ohne Pflichtschulung`,
        );
        worst = Math.max(worst, open);
      }
    }
    if (entry.acknowledgedCount !== undefined) {
      const open = entry.memberCount - entry.acknowledgedCount;
      if (open > 0) {
        missing.push(
          `${String(open)} von ${String(entry.memberCount)} ohne Kenntnisnahme`,
        );
        worst = Math.max(worst, open);
      }
    }
    if (missing.length === 0) continue;
    rows.push({
      text: `${entry.role.name} — ${missing.join(", ")}`,
      gap: worst,
      name: entry.role.name,
    });
  }
  rows.sort((a, b) => b.gap - a.gap || a.name.localeCompare(b.name));
  return rows.map((row) => row.text);
}

/* ------------------------------------------------------------------ *
 * Dokumente / SOP (Slot BR) — Sicht „Verantwortung"
 * ------------------------------------------------------------------ */

export const documentLayer: GrcLayer = {
  id: "document",
  title: "Dokumente und Arbeitsanweisungen",
  feature: "§3.6",
  priority: PRIORITY.retention + 2,

  forShape(shape, context) {
    const documents = context.data.elements[shape.id]?.documents ?? [];
    const first = documents[0];
    if (!first) {
      return [];
    }
    const describe = this.describe(shape, context);
    const extra = documents.length - 1;
    return describe === undefined
      ? []
      : [
          {
            kind: "badge",
            slot: "BR",
            text: `SOP${extra > 0 ? ` ${String(documents.length)}` : ""}`,
            tone: "info",
            glyph: "",
            refs: refs(documents),
            describe,
          },
        ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const documents = context.data.elements[element.id]?.documents ?? [];
    return documents.length === 0
      ? undefined
      : `Dokumente: ${documents.map((document) => document.title).join(", ")}.`;
  },
};

/* ------------------------------------------------------------------ *
 * F14 — Vorfälle am Schritt (Slot TL)
 * ------------------------------------------------------------------ */

/**
 * [ARCTOS-FULL-2026-08-31 · OP-004] Der Layer, den `STUFE2-A2-GRC.md` §6 mit
 * „reine Badge-Arbeit, aber ohne `security_incident.process_step_id` gäbe es
 * nichts zu zeigen" zurückgestellt hat. Die Spalte steht seit Migration 0454.
 *
 * **Warum ein abgeschlossener Vorfall trotzdem einen Badge bekommt.** Die
 * naheliegende Regel wäre „nur laufende zeigen". Sie ist falsch: dann sähe der
 * Schritt, an dem im Frühjahr ein Datenabfluss war und der seither aufgeräumt
 * ist, genauso aus wie der Schritt, an dem nie etwas passiert ist. Für eine
 * Risikobeurteilung sind das zwei sehr verschiedene Schritte. Der
 * abgeschlossene Vorfall bekommt deshalb den neutralen Ton und ein `§`, der
 * laufende die Farbe seiner Schwere.
 */
export const incidentLayer: GrcLayer = {
  id: "incident",
  title: "Vorfälle",
  feature: "F14",
  priority: PRIORITY.incident,

  forShape(shape, context) {
    const result = computeIncidents(context.data.elements[shape.id]);
    if (result.stage === "none") {
      return [];
    }
    const describe = this.describe(shape, context);
    if (describe === undefined) {
      return [];
    }
    const tone: GrcTone =
      result.stage === "critical"
        ? "critical"
        : result.stage === "open"
          ? "warn"
          : "neutral";
    return [
      {
        kind: "badge",
        // **Slot TL, nicht TR — gemessen entschieden.** Beide Slots sind in
        // der Sicht „Risiko & Kontrolle" belegt: TL von `control` (78), TR von
        // `risk` (85). Ein Vorfall (92) verdrängt in beiden Fällen jemanden,
        // und das Budget schiebt den Verdrängten in den Sammel-Badge — die
        // Frage ist also nur, WEN. Auf TR verlöre das Diagramm die
        // Risiko-Ampel an genau den Schritten, an denen gerade etwas
        // passiert; auf TL verliert es den Kontroll-Badge, dessen Aussage die
        // Formkodierung (`control-coverage`) in dieser Sicht ohnehin trägt.
        // Der kleinere Verlust gewinnt.
        slot: "TL",
        // Laufende zuerst; ohne laufende die Gesamtzahl. Der Badge zeigt die
        // Zahl, die zum Ton gehört — eine Zahl in einer Farbe, die etwas
        // anderes meint, ist die schlimmste Kombination.
        text: `V${String(result.open > 0 ? result.open : result.total)}`,
        tone,
        refs: refs(result.items),
        describe,
      },
    ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const result = computeIncidents(context.data.elements[element.id]);
    if (result.stage === "none") {
      return undefined;
    }
    const parts: string[] = [];
    if (result.open > 0) {
      parts.push(
        `${String(result.open)} laufende${result.open === 1 ? "r" : ""} Vorfall${
          result.open === 1 ? "" : "e"
        }`,
      );
    }
    const closed = result.total - result.open;
    if (closed > 0) {
      parts.push(`${String(closed)} abgeschlossen`);
    }
    if (result.worst) {
      parts.push(
        `schwerster: ${result.worst.title} (${TONE_WORD_SEVERITY[result.worst.severity]})`,
      );
    }
    if (result.dataBreaches > 0) {
      // Ein meldepflichtiger Datenschutzvorfall ist keine Fußnote: an ihm
      // hängt eine 72-Stunden-Frist (Art. 33 DSGVO).
      parts.push(
        `${String(result.dataBreaches)} meldepflichtige${
          result.dataBreaches === 1 ? "r" : ""
        } Datenschutzvorfall${result.dataBreaches === 1 ? "" : "e"}`,
      );
    }
    return `${parts.join(", ")}.`;
  },

  legend() {
    return [
      {
        tone: "critical",
        glyph: TONE_GLYPH.critical,
        text: "laufender Vorfall, hohe oder kritische Schwere",
      },
      { tone: "warn", glyph: TONE_GLYPH.warn, text: "laufender Vorfall" },
      {
        tone: "neutral",
        glyph: TONE_GLYPH.neutral,
        text: "nur abgeschlossene Vorfälle",
      },
    ];
  },
};

/** Schweregrade als Wort — Farbe ist nie der einzige Träger (§3.3.5 Regel 2). */
const TONE_WORD_SEVERITY: Readonly<Record<string, string>> = {
  low: "gering",
  medium: "mittel",
  high: "hoch",
  critical: "kritisch",
};

/* ------------------------------------------------------------------ *
 * F16 — Offene Maßnahmen mit Fälligkeit (Slot BL)
 * ------------------------------------------------------------------ */

/**
 * [ARCTOS-FULL-2026-08-31 · OP-005] Wie F14 mit Migration 0454 möglich
 * geworden (`work_item.process_step_id`).
 *
 * **Die Fälligkeit ist die Aussage, nicht die Anzahl.** Ein Badge „M3" ist ein
 * Zählwert; „M3, eine seit zwölf Tagen überfällig" ist ein Befund. Deshalb
 * bestimmt die Frist den Ton, und die Textform nennt die Tage.
 *
 * **Und der Fall, den man sonst übersieht:** eine offene Maßnahme *ohne*
 * Frist. Sie taucht in keiner Fälligkeitsliste auf und sieht in jeder Ampel
 * grün aus. Sie wird gezählt und in der Textform genannt, statt sie
 * stillschweigend als unkritisch zu führen.
 */
export const workItemLayer: GrcLayer = {
  id: "work-item",
  title: "Offene Maßnahmen",
  feature: "F16",
  priority: PRIORITY.workItem,

  forShape(shape, context) {
    const result = computeWorkItems(
      context.data.elements[shape.id],
      context.asOf,
    );
    if (result.stage === "none") {
      return [];
    }
    const describe = this.describe(shape, context);
    if (describe === undefined) {
      return [];
    }
    const tone: GrcTone =
      result.stage === "overdue"
        ? "critical"
        : result.stage === "due"
          ? "warn"
          : "info";
    return [
      {
        kind: "badge",
        slot: "BL",
        text: `M${String(result.open)}`,
        tone,
        refs: refs(result.items),
        describe,
      },
    ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const result = computeWorkItems(
      context.data.elements[element.id],
      context.asOf,
    );
    if (result.stage === "none") {
      return undefined;
    }
    const parts = [
      `${String(result.open)} offene Maßnahme${result.open === 1 ? "" : "n"}`,
    ];
    if (result.overdue > 0) {
      const days = result.daysUntilDue;
      parts.push(
        typeof days === "number" && days < 0
          ? `${String(result.overdue)} überfällig, älteste seit ${String(Math.abs(Math.round(days)))} Tagen`
          : `${String(result.overdue)} überfällig`,
      );
    } else if (result.dueSoon > 0) {
      parts.push(
        `${String(result.dueSoon)} fällig in ${String(WORK_ITEM_DUE_SOON_DAYS)} Tagen`,
      );
    }
    if (result.withoutDueDate > 0) {
      parts.push(`${String(result.withoutDueDate)} ohne Frist`);
    }
    return `${parts.join(", ")}.`;
  },

  legend() {
    return [
      {
        tone: "critical",
        glyph: TONE_GLYPH.critical,
        text: "Maßnahme überfällig",
      },
      {
        tone: "warn",
        glyph: TONE_GLYPH.warn,
        text: `Maßnahme fällig in ${String(WORK_ITEM_DUE_SOON_DAYS)} Tagen`,
      },
      {
        tone: "info",
        glyph: TONE_GLYPH.info,
        text: "offene Maßnahme ohne nahe Frist",
      },
    ];
  },
};

/* ------------------------------------------------------------------ *
 * F15 — KRI-Schwellenampel (Slot BL)
 * ------------------------------------------------------------------ */

const KRI_TREND_WORD: Readonly<Record<string, string>> = {
  improving: "Trend verbessert sich",
  stable: "Trend stabil",
  worsening: "Trend verschlechtert sich",
};

/**
 * [ARCTOS-FULL-2026-08-31 · OP-008] Die Ampel, die `STUFE2-A2-GRC.md` §6 mit
 * „ohne Zeitreihenvertrag wäre der Badge eine Zahl ohne Bedeutung"
 * zurückgestellt hat.
 *
 * Die Bedeutung ist da (Begründung an `GrcKri` in `contract.ts`) — und dieser
 * Layer bringt sie mit **zwei** Zuständen, die die Datenbank nicht hat:
 *
 * - **„keine Schwellen"** statt Grün. `kri.current_alert_status` steht auf
 *   `green`, sobald eine der drei Schwellen fehlt. Als grüner Punkt gezeichnet
 *   wäre das eine Entwarnung aus fehlenden Daten.
 * - **„veraltet"** statt Grün. Ein Indikator, dessen letzte Messung mehr als
 *   zwei Messtakte zurückliegt, sagt nichts über heute.
 *
 * Beide tragen den Neutralton mit dem Formzeichen `○` — sichtbar anders als
 * Grün, und im Text ausdrücklich benannt.
 */
export const kriLayer: GrcLayer = {
  id: "kri",
  title: "Risikoindikatoren",
  feature: "F15",
  priority: PRIORITY.kri,

  forShape(shape, context) {
    const result = computeKri(context.data.elements[shape.id], context.asOf);
    if (result.stage === "none") {
      return [];
    }
    const describe = this.describe(shape, context);
    if (describe === undefined) {
      return [];
    }
    const tone: GrcTone =
      result.stage === "critical"
        ? "critical"
        : result.stage === "warn"
          ? "warn"
          : result.stage === "ok"
            ? "ok"
            : "neutral";
    return [
      {
        kind: "badge",
        slot: "BL",
        // Rot zählt, sonst die Zahl der ungeklärten — nie eine Zahl, die zu
        // einem anderen Ton gehört als der, den sie erklärt.
        text:
          result.stage === "critical"
            ? `KRI ${String(result.red)}`
            : result.stage === "warn"
              ? `KRI ${String(result.yellow)}`
              : result.stage === "ok"
                ? "KRI"
                : `KRI ${String(result.withoutThresholds + result.stale + result.neverMeasured)}`,
        tone,
        describe,
      },
    ];
  },

  describe(element, context) {
    if (!isShape(element)) {
      return undefined;
    }
    const result = computeKri(context.data.elements[element.id], context.asOf);
    if (result.stage === "none") {
      return undefined;
    }
    const parts: string[] = [];
    if (result.red > 0) {
      parts.push(`${String(result.red)} Indikator(en) über der roten Schwelle`);
    }
    if (result.yellow > 0) {
      parts.push(`${String(result.yellow)} im Warnbereich`);
    }
    if (result.withoutThresholds > 0) {
      // Ausdrücklich benannt: „ohne Schwellen" ist kein grüner Zustand.
      parts.push(
        `${String(result.withoutThresholds)} ohne hinterlegte Schwellen (keine Ampel möglich)`,
      );
    }
    if (result.neverMeasured > 0) {
      parts.push(`${String(result.neverMeasured)} nie gemessen`);
    }
    if (result.stale > 0) {
      parts.push(
        `${String(result.stale)} veraltet (letzte Messung älter als ${String(KRI_STALE_FACTOR)} Messtakte)`,
      );
    }
    if (parts.length === 0) {
      parts.push(
        `${String(result.items.length)} Indikator(en) im grünen Bereich`,
      );
    }
    const worst = result.worst;
    if (worst) {
      const detail: string[] = [worst.title];
      if (worst.value !== undefined) {
        detail.push(
          `${worst.value.toLocaleString("de-DE")}${worst.unit ? ` ${worst.unit}` : ""}`,
        );
      }
      // Die Richtung gehört in den Satz: „18 %" ist ohne sie keine Aussage.
      detail.push(
        worst.direction === "asc"
          ? "hoch ist schlecht"
          : "niedrig ist schlecht",
      );
      if (worst.trend) {
        detail.push(KRI_TREND_WORD[worst.trend] ?? worst.trend);
      }
      if (worst.measuredAt) {
        const age = Math.max(0, daysBetween(worst.measuredAt, context.asOf));
        detail.push(`Stand vor ${String(age)} Tagen`);
      } else {
        detail.push("noch nie gemessen");
      }
      parts.push(detail.join(", "));
    }
    return `${parts.join("; ")}.`;
  },

  legend(context) {
    const any = Object.values(context.data.elements).some(
      (element) => (element?.kris?.length ?? 0) > 0,
    );
    if (!any) {
      return [];
    }
    return [
      {
        tone: "critical",
        glyph: TONE_GLYPH.critical,
        text: "Indikator über der roten Schwelle",
      },
      {
        tone: "warn",
        glyph: TONE_GLYPH.warn,
        text: "Indikator im Warnbereich",
      },
      { tone: "ok", glyph: TONE_GLYPH.ok, text: "Indikator im grünen Bereich" },
      {
        tone: "neutral",
        glyph: TONE_GLYPH.neutral,
        text: "keine Ampel möglich: Schwellen fehlen oder Messung veraltet",
      },
    ];
  },
};

/* ------------------------------------------------------------------ *
 * F11 — Kostenverteilung (Lane-Fußzeile)
 * ------------------------------------------------------------------ */

/**
 * [ARCTOS-FULL-2026-08-31 · OP-006] Der Layer, für den `STUFE2-A2-GRC.md` §6
 * erst einen Slot brauchte: „ein eigener Slot („Lane-Fußzeile"), den §3.3.1
 * nicht vorsieht — ihn zu erfinden hätte das Slotsystem aufgeweicht, bevor es
 * sich bewährt hat." Der Slot steht jetzt (`slots.ts`, `GrcLaneFooterSignal`).
 *
 * **Was der Balken sagt und was nicht.** Er sagt: dieser Rahmen trägt X % der
 * Kosten, die dieses Diagramm KENNT. Er sagt nicht: X % der Kosten. Der
 * Unterschied steht in der Beschreibung, sobald nicht jede Aktivität eine
 * Kostenangabe trägt — und ohne eine einzige Angabe schweigt der Layer ganz,
 * statt jedem Rahmen 0 % zuzuschreiben.
 */
export const costLayer: GrcLayer = {
  id: "cost",
  title: "Kostenverteilung",
  feature: "F11",
  priority: PRIORITY.cost,

  forShape(shape, context) {
    if (shape.type !== "bpmn:Lane" && shape.type !== "bpmn:Participant") {
      return [];
    }
    const result = laneCosts(context);
    const entry = result.byLane.get(shape.id);
    // Kein Balken ohne bekannte Kosten: „0 %" an jedem Rahmen wäre eine
    // Verteilungsaussage über eine Verteilung, die niemand kennt.
    if (!entry || result.total <= 0 || entry.activitiesWithCost === 0) {
      return [];
    }
    const describe = this.describe(shape, context);
    if (describe === undefined) {
      return [];
    }
    return [
      {
        kind: "lane-footer",
        share: entry.share,
        // Der höchste Anteil hebt sich ab, ohne dass er ein Befund wäre:
        // teuer ist nicht schlecht. Deshalb `accent` und nicht `critical`.
        tone: entry.share >= 0.4 ? "accent" : "info",
        label: `${formatMoney(entry.cost, result.currency)} · ${percent(entry.share)}`,
        describe,
      },
    ];
  },

  describe(element, context) {
    if (!isShape(element) || !isContainer(element)) {
      return undefined;
    }
    const result = laneCosts(context);
    const entry = result.byLane.get(element.id);
    if (!entry || result.total <= 0 || entry.activitiesWithCost === 0) {
      return undefined;
    }
    const parts = [
      `Kostenanteil ${percent(entry.share)} (${formatMoney(entry.cost, result.currency)} von ${formatMoney(result.total, result.currency)})`,
    ];
    if (result.coverage < 1) {
      // Die Pflichtangabe: der Anteil bezieht sich auf die BEKANNTEN Kosten.
      parts.push(
        `Grundlage: ${String(result.withCost)} von ${String(result.activities)} Aktivitäten mit Kostenangabe`,
      );
    }
    return `${parts.join(", ")}.`;
  },

  legend(context) {
    const result = laneCosts(context);
    if (result.total <= 0) {
      return [];
    }
    const entries: GrcLegendEntry[] = [
      {
        tone: "accent",
        glyph: TONE_GLYPH.accent,
        text: "Rahmen mit 40 % oder mehr der bekannten Kosten",
      },
      {
        tone: "info",
        glyph: TONE_GLYPH.info,
        text: "Kostenanteil des Rahmens",
      },
    ];
    if (result.coverage < 1) {
      entries.push({
        tone: "neutral",
        glyph: TONE_GLYPH.neutral,
        text: `Anteile beziehen sich auf ${String(result.withCost)} von ${String(result.activities)} Aktivitäten mit Kostenangabe`,
      });
    }
    return entries;
  },
};

/**
 * Die Kostenrechnung einmal je Kontext.
 *
 * Sie ist diagrammweit, `forShape` wird aber je Rahmen gerufen — ohne
 * Zwischenspeicher wäre sie eine Rechnung über alle Aktivitäten je Lane. Der
 * Schlüssel ist der Kontext, nicht die Szene: derselbe Datensatz mit einem
 * anderen Bezugszeitpunkt ist eine andere Rechnung.
 */
const LANE_COST_CACHE = new WeakMap<GrcLayerContext, LaneCostResult>();

function laneCosts(context: GrcLayerContext): LaneCostResult {
  const cached = LANE_COST_CACHE.get(context);
  if (cached) return cached;
  const result = computeLaneCosts(
    context.graph,
    context.data,
    (id) => laneOf(context.graph, id)?.id,
  );
  LANE_COST_CACHE.set(context, result);
  return result;
}

/** Geldbetrag mit Tausenderpunkt; ohne bekannte Währung ohne Zeichen. */
function formatMoney(value: number, currency: string | undefined): string {
  const rounded = Math.round(value);
  return `${rounded.toLocaleString("de-DE")}${currency === undefined ? "" : ` ${currency}`}`;
}

/* ------------------------------------------------------------------ *
 * BR — Validierungsmarker (Sicht „Modellierung")
 * ------------------------------------------------------------------ */

/**
 * [ARCTOS-FULL-2026-08-31 · OP-011] Der Layer, den `STUFE2-A2-GRC.md` §6 mit
 * „die Sicht ist angelegt und lässt den Slot frei" zurückgestellt hat.
 *
 * **Was er zeichnet, und was ausdrücklich nicht.** Er zeichnet einen Marker an
 * Elementen, zu denen ein Befund vorliegt. Er zeichnet **nichts** an Elementen
 * ohne Befund — kein grünes Häkchen, keine Entwarnung. Der Grund ist der Kern
 * dieses Layers: ohne beigelegte Befundliste (`context.validation` ist dann
 * leer) kann er nicht unterscheiden, ob das Modell geprüft und in Ordnung ist
 * oder ob niemand geprüft hat. Ein grünes Häkchen wäre in dem zweiten Fall
 * eine Behauptung, die kein Werkzeug gedeckt hat — und ein Modellierungsfehler
 * sieht auf dem Bildschirm ohnehin völlig richtig aus (die Begründung, aus der
 * `src/verify/` überhaupt existiert).
 *
 * **Warum die Befunde nicht hier berechnet werden.** Die Prüfung braucht den
 * moddle-Baum, den diese Schicht nicht hat (sie kennt nur die `Scene`), und
 * `src/verify/` darf in kein Anwendungsbündel. Der Layer liest deshalb, was
 * ihm beigelegt wird; die Übersetzung der beiden Prüfwerkzeuge auf diese Form
 * steht in `src/verify/markers.ts`.
 *
 * **Ein Fehler ist keine Warnung.** `error` heißt: das Dokument ist kaputt,
 * `bpmn-moddle` verliert beim nächsten Speichern, was es nicht auflösen kann
 * (`test/model/ROUNDTRIP-REPORT.md`, Ursache 2). Das ist stiller Datenverlust
 * einen Speichervorgang später und trägt deshalb den kritischen Ton; eine
 * Warnung ist legales BPMN mit schlechtem Geruch.
 */
export const validationLayer: GrcLayer = {
  id: "validation",
  title: "Modellprüfung",
  // Der Marker gehört zur Sichttabelle aus §3.3 („Modellierung", Spalte BR)
  // und trägt keine F-Nummer: er ist keine GRC-Funktion aus §3.12, sondern
  // die Prüfung des Dokuments, auf dem alle GRC-Funktionen aufsetzen.
  feature: "§3.3",
  priority: PRIORITY.validation,

  forShape(shape, context) {
    const findings = validationFor(shape.id, context.validation);
    if (findings.length === 0) {
      return [];
    }
    const describe = this.describe(shape, context);
    if (describe === undefined) {
      return [];
    }
    const errors = findings.filter(
      (finding) => finding.severity === "error",
    ).length;
    return [
      {
        kind: "badge",
        slot: "BR",
        // `§` ist das Formzeichen des kritischen Tons und in dem Glyphensatz
        // enthalten, den STUFE2-A2-GRC.md §7.2 nach dem Rastern festgelegt
        // hat — vier Zeichen wurden dort zu leeren Kästchen.
        text: errors > 0 ? `!${String(errors)}` : `?${String(findings.length)}`,
        tone: errors > 0 ? "critical" : "warn",
        refs: findings.map((finding, index) => ({
          id: finding.elementId ?? `${shape.id}#${String(index)}`,
          title: finding.message,
        })),
        describe,
      },
    ];
  },

  describe(element, context) {
    const findings = validationFor(element.id, context.validation);
    if (findings.length === 0) {
      return undefined;
    }
    const errors = findings.filter((finding) => finding.severity === "error");
    const warnings = findings.filter(
      (finding) => finding.severity === "warning",
    );
    const parts: string[] = [];
    if (errors.length > 0) {
      parts.push(
        `${String(errors.length)} Modellfehler: ${errors
          .map((finding) => finding.message)
          .join("; ")}`,
      );
    }
    if (warnings.length > 0) {
      parts.push(
        `${String(warnings.length)} Warnung${warnings.length === 1 ? "" : "en"}: ${warnings
          .map((finding) => finding.message)
          .join("; ")}`,
      );
    }
    return `${parts.join(". ")}.`;
  },

  legend(context) {
    if (context.validation.length === 0) {
      // Keine Legende ohne Befunde: eine Legende, die eine Fehlerfarbe
      // erklärt, die im Bild nicht vorkommt, lässt den Leser suchen.
      return [];
    }
    return [
      {
        tone: "critical",
        glyph: TONE_GLYPH.critical,
        text: "Modellfehler — Dokument verliert beim Speichern Angaben",
      },
      {
        tone: "warn",
        glyph: TONE_GLYPH.warn,
        text: "Warnung — legales BPMN, aber ein Hinweis auf ein Versehen",
      },
    ];
  },
};

/**
 * Befunde zu einem Element, in stabiler Reihenfolge.
 *
 * Fehler vor Warnungen, dann nach Regelkennung: dieselbe Befundliste muss
 * denselben Satz ergeben, sonst hängt die Textalternative an der Reihenfolge,
 * in der ein Prüfwerkzeug den Baum durchläuft.
 */
function validationFor(
  elementId: string,
  findings: readonly GrcValidationFinding[],
): readonly GrcValidationFinding[] {
  return findings
    .filter((finding) => finding.elementId === elementId)
    .sort(
      (a, b) =>
        Number(b.severity === "error") - Number(a.severity === "error") ||
        a.rule.localeCompare(b.rule) ||
        a.message.localeCompare(b.message),
    );
}

/** Alle gebauten Layer. */
export const ALL_LAYERS: readonly GrcLayer[] = [
  controlCoverageLayer,
  controlLayer,
  riskLayer,
  findingLayer,
  lineOfDefenseLayer,
  raciLayer,
  callActivityLayer,
  evidenceLayer,
  controlTestLayer,
  frameworkLayer,
  sodLayer,
  privacyLayer,
  dpiaLayer,
  retentionLayer,
  trustBoundaryLayer,
  bcmLayer,
  assetLayer,
  outageLayer,
  conformanceLayer,
  operationsLayer,
  commentsLayer,
  laneLayer,
  documentLayer,
  incidentLayer,
  workItemLayer,
  validationLayer,
  costLayer,
  kriLayer,
];

/* ------------------------------------------------------------------ *
 * Filter (§3.3.5 Regel 1: dimmen, nie ausblenden)
 * ------------------------------------------------------------------ */

/** Filter „nur Schritte mit offenen Feststellungen". */
export const openFindingsFilter = {
  id: "open-findings",
  label: "Nur Schritte mit offenen Feststellungen",
  matches(shape: BpmnShape, context: GrcLayerContext): boolean {
    return (
      computeFindings(context.data.elements[shape.id], context.asOf).stage !==
      "none"
    );
  },
};

/** Filter „Löschfrist < 12 Monate" (§3.12/F10). */
export const shortRetentionFilter = {
  id: "short-retention",
  label: `Nur Schritte mit Löschfrist unter ${String(SHORT_RETENTION_MONTHS)} Monaten`,
  matches(shape: BpmnShape, context: GrcLayerContext): boolean {
    return (
      computeRetention(context.data.elements[shape.id]?.ropa).stage === "short"
    );
  },
};

/** Filter „vom Ausfall betroffen". */
export const outageFilter = {
  id: "outage",
  label: "Nur vom Ausfall betroffene Schritte",
  matches(shape: BpmnShape, context: GrcLayerContext): boolean {
    const state = context.outage?.steps.get(shape.id)?.state;
    return state !== undefined && state !== "unaffected";
  },
};

/** Wird von `laneOf` gebraucht — hier nur, damit der Import nicht ungenutzt ist. */
export function laneNameOf(
  context: GrcLayerContext,
  shapeId: string,
): string | undefined {
  const lane = laneOf(context.graph, shapeId);
  if (!lane) {
    return undefined;
  }
  return context.data.lanes?.[lane.id]?.name ?? nameOf(lane);
}
