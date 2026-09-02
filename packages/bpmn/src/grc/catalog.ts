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
  computeFrameworkElement,
  computeRetention,
  personalDataStage,
  riskLevel,
  rollupRisk,
  SHORT_RETENTION_MONTHS,
} from "./analysis";
import type { GrcLineOfDefense, GrcObjectRef } from "./contract";
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
  outage: 98,
  sod: 95,
  controlCoverage: 90,
  evidence: 88,
  privacy: 86,
  risk: 85,
  conformance: 84,
  bcm: 82,
  finding: 80,
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
    if (!edge) {
      return undefined;
    }
    if (edge.observation === "unobserved") {
      return {
        kind: "edge",
        tone: "neutral",
        style: "dashed",
        describe: "Modelliert, aber nie beobachtet.",
      };
    }
    if (edge.frequency === undefined) {
      return undefined;
    }
    return {
      kind: "edge",
      tone: "info",
      // Die Häufigkeit trägt allein die Strichstärke. Ein Zahlenchip an *jeder*
      // Kante war im ersten gerasterten Beleg genau die Tapete, die §3.3
      // verhindern soll — die Zahl steht in der Ansage und in der Tabelle.
      style: "solid",
      width: flowWidth(edge.frequency),
      describe: `Beobachtet in ${edge.frequency.toLocaleString("de-DE")} Fällen${
        edge.probability === undefined ? "" : ` (${percent(edge.probability)})`
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
      if (!edge) {
        return undefined;
      }
      if (edge.observation === "unobserved") {
        return "Modelliert, aber nie beobachtet.";
      }
      return edge.frequency === undefined
        ? undefined
        : `Beobachtet in ${edge.frequency.toLocaleString("de-DE")} Fällen.`;
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
    const edge = context.data.edges?.[connection.id];
    if (edge?.probability === undefined) {
      return undefined;
    }
    return {
      kind: "edge",
      tone: "neutral",
      style: "solid",
      width:
        edge.frequency === undefined ? undefined : flowWidth(edge.frequency),
      chip: percent(edge.probability),
      describe: `Verzweigungswahrscheinlichkeit ${percent(edge.probability)}.`,
    };
  },

  describe(element, context) {
    if (!isShape(element)) {
      const edge = context.data.edges?.[element.id];
      return edge?.probability === undefined
        ? undefined
        : `Verzweigungswahrscheinlichkeit ${percent(edge.probability)}.`;
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
      signals.push({
        kind: "badge",
        slot: "BR",
        text: percent(lane.trainingRatio),
        tone: lane.trainingRatio < 0.8 ? "warn" : "info",
        describe: `Qualifikationsquote ${percent(lane.trainingRatio)} der Rollenmitglieder.`,
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
    return parts.length === 0 ? undefined : `${parts.join(", ")}.`;
  },
};

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
