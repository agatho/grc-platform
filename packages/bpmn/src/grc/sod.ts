/**
 * F3 — Aufgabentrennung (Segregation of Duties) zwischen Lanes (Plan §3.11).
 *
 * Der stärkste Einzelbefund, den ein GRC-Prozessdiagramm liefern kann: Zwei
 * Aktivitäten desselben Prozesspfades, deren verantwortliche Rollen ein
 * unverträgliches Paar bilden. Heute wird diese Frage in jedem SOX-/IKS-Audit in
 * Excel beantwortet.
 *
 * Die Prüfung braucht drei Dinge, von denen zwei erst geschaffen werden müssen:
 * die Rollenzuordnung je Schritt (`process_step_raci`, neu), die Lane-Zuordnung
 * (`process_lane`, neu) und die Regelmenge (`sod_rule`, neu). Der Rechenkern
 * hier arbeitet deshalb gegen den Vertrag, nicht gegen das Schema.
 */

import type { BpmnShape } from "../draw/types";
import type {
  GrcElementData,
  GrcFindingSeverity,
  GrcOverlayData,
  GrcRoleRef,
  GrcSodRule,
} from "./contract";
import { laneOf, onCommonPath, type GrcGraph } from "./graph";

export interface SodConflict {
  readonly id: string;
  readonly ruleId: string;
  readonly severity: GrcFindingSeverity;
  readonly rationale: string | undefined;
  readonly frameworkRef: string | undefined;
  readonly a: SodEndpoint;
  readonly b: SodEndpoint;
  /** Fertiger Satz für Bogenbeschriftung, ARIA und Liste. */
  readonly describe: string;
}

export interface SodEndpoint {
  readonly elementId: string;
  readonly elementName: string;
  readonly role: GrcRoleRef;
  readonly laneName: string | undefined;
}

/** Selbstkontrolle: ausführende Rolle verantwortet die einzige Kontrolle (§3.4/A4). */
export interface SelfControlFinding {
  readonly elementId: string;
  readonly elementName: string;
  readonly role: GrcRoleRef;
  readonly controlId: string;
  readonly controlTitle: string;
  readonly describe: string;
}

export interface SodResult {
  readonly conflicts: readonly SodConflict[];
  readonly selfControls: readonly SelfControlFinding[];
  /** Elemente, die an mindestens einem Konflikt beteiligt sind. */
  readonly involved: ReadonlyMap<string, readonly SodConflict[]>;
}

/**
 * Die tragende Rolle eines Schritts.
 *
 * Reihenfolge: *accountable* vor *responsible* vor Lane-Rolle. Begründung: Wer
 * rechenschaftspflichtig ist, trägt die Aufgabentrennung; die Lane ist nur der
 * Rückfall, wenn am Schritt nichts gepflegt ist (und heute ist an fast keinem
 * Schritt etwas gepflegt).
 */
export function bearingRole(
  graph: GrcGraph,
  data: GrcOverlayData,
  shape: BpmnShape,
): GrcRoleRef | undefined {
  const element: GrcElementData | undefined = data.elements[shape.id];
  const raci = element?.raci;
  if (raci?.accountable) {
    return raci.accountable;
  }
  if (raci?.responsible) {
    return raci.responsible;
  }
  const lane = laneOf(graph, shape.id);
  return lane ? data.lanes?.[lane.id]?.role : undefined;
}

const ACTIVITY_PREFIXES = [
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
];

function isActivityShape(shape: BpmnShape): boolean {
  return ACTIVITY_PREFIXES.includes(shape.type);
}

/**
 * Findet alle Verstöße.
 *
 * Geprüft wird jedes ungeordnete Aktivitätspaar, dessen tragende Rollen ein
 * Regelpaar bilden **und** die im selben Prozesspfad liegen (Erreichbarkeit im
 * Graphen). Ohne die Pfadprüfung wären zwei Aktivitäten in getrennten Zweigen
 * eines Exklusiv-Gateways ein Falschbefund — sie kommen nie gemeinsam vor.
 *
 * **Abweichung vom Plan, bewusst:** §3.11 formuliert die Prüfung über zwei
 * *verschiedene* Rollen, die ein Regelpaar bilden. Das allein ist aber noch kein
 * Befund — dass zwei unverträgliche Aufgaben von zwei verschiedenen Rollen
 * wahrgenommen werden, ist der *gewünschte* Zustand. Der eigentliche Verstoß ist
 * der Fall „dieselbe Rolle verantwortet beide Aufgaben". Deshalb wird die
 * Selbstpaarung (`role_a_id = role_b_id`) hier ausdrücklich zugelassen und
 * gefunden; die Paarung zweier verschiedener Rollen bleibt möglich, weil manche
 * Regelwerke die bloße Nähe zweier Rollen im selben Pfad tatsächlich beanstanden.
 */
export function computeSod(graph: GrcGraph, data: GrcOverlayData): SodResult {
  const rules = data.diagram?.sodRules ?? [];
  const activities = [...graph.shapes.values()]
    .filter(isActivityShape)
    .sort((a, b) => a.id.localeCompare(b.id));

  const conflicts: SodConflict[] = [];

  if (rules.length > 0) {
    for (let i = 0; i < activities.length; i += 1) {
      const first = activities[i];
      if (!first) {
        continue;
      }
      const roleA = bearingRole(graph, data, first);
      if (!roleA) {
        continue;
      }
      for (let j = i + 1; j < activities.length; j += 1) {
        const second = activities[j];
        if (!second) {
          continue;
        }
        const roleB = bearingRole(graph, data, second);
        if (!roleB) {
          continue;
        }
        const rule = rules.find(
          (candidate) =>
            (candidate.roleAId === roleA.id &&
              candidate.roleBId === roleB.id) ||
            (candidate.roleAId === roleB.id && candidate.roleBId === roleA.id),
        );
        if (!rule) {
          continue;
        }
        if (!onCommonPath(graph, first.id, second.id)) {
          continue;
        }
        conflicts.push(
          buildConflict(graph, data, rule, first, roleA, second, roleB),
        );
      }
    }
  }

  const involved = new Map<string, SodConflict[]>();
  for (const conflict of conflicts) {
    for (const endpoint of [conflict.a, conflict.b]) {
      const list = involved.get(endpoint.elementId) ?? [];
      list.push(conflict);
      involved.set(endpoint.elementId, list);
    }
  }

  return {
    conflicts,
    selfControls: computeSelfControls(graph, data),
    involved,
  };
}

function buildConflict(
  graph: GrcGraph,
  data: GrcOverlayData,
  rule: GrcSodRule,
  first: BpmnShape,
  roleA: GrcRoleRef,
  second: BpmnShape,
  roleB: GrcRoleRef,
): SodConflict {
  const a: SodEndpoint = {
    elementId: first.id,
    elementName: nameOf(first),
    role: roleA,
    laneName: laneName(graph, data, first),
  };
  const b: SodEndpoint = {
    elementId: second.id,
    elementName: nameOf(second),
    role: roleB,
    laneName: laneName(graph, data, second),
  };
  const rationale = rule.rationale;
  return {
    id: `${rule.id}:${first.id}:${second.id}`,
    ruleId: rule.id,
    severity: rule.severity,
    rationale,
    frameworkRef: rule.frameworkRef,
    a,
    b,
    describe:
      `Aufgabentrennungskonflikt (${severityWord(rule.severity)}): ` +
      `„${a.elementName}“ (${a.role.name}) und „${b.elementName}“ (${b.role.name}) ` +
      `liegen im selben Prozesspfad.` +
      (rationale ? ` ${rationale}` : "") +
      (rule.frameworkRef ? ` Bezug: ${rule.frameworkRef}.` : ""),
  };
}

/**
 * Selbstkontrolle (§3.4/A4).
 *
 * Ein Schritt der 1. Verteidigungslinie, dessen **einzige** Kontrolle von
 * derselben Rolle verantwortet wird, die die Aktivität ausführt. Die
 * Einschränkung auf genau eine Kontrolle ist Absicht: gibt es eine zweite,
 * unabhängig verantwortete Kontrolle, ist die Trennung gewahrt.
 */
export function computeSelfControls(
  graph: GrcGraph,
  data: GrcOverlayData,
): readonly SelfControlFinding[] {
  const out: SelfControlFinding[] = [];
  for (const shape of [...graph.shapes.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const element = data.elements[shape.id];
    const controls = element?.controls ?? [];
    if (controls.length !== 1) {
      continue;
    }
    const control = controls[0];
    if (!control?.ownerRole) {
      continue;
    }
    const performer =
      element?.raci?.responsible ?? bearingRole(graph, data, shape);
    if (!performer || performer.id !== control.ownerRole.id) {
      continue;
    }
    if (
      element?.lineOfDefense !== undefined &&
      element.lineOfDefense !== "first"
    ) {
      continue;
    }
    out.push({
      elementId: shape.id,
      elementName: nameOf(shape),
      role: performer,
      controlId: control.id,
      controlTitle: control.title,
      describe:
        `Selbstkontrolle: „${nameOf(shape)}“ wird von ${performer.name} ausgeführt ` +
        `und die einzige Kontrolle „${control.title}“ wird von derselben Rolle verantwortet.`,
    });
  }
  return out;
}

function laneName(
  graph: GrcGraph,
  data: GrcOverlayData,
  shape: BpmnShape,
): string | undefined {
  const lane = laneOf(graph, shape.id);
  if (!lane) {
    return undefined;
  }
  const fromData = data.lanes?.[lane.id]?.name;
  if (fromData) {
    return fromData;
  }
  const name = lane.businessObject.name;
  return typeof name === "string" && name !== "" ? name : undefined;
}

function nameOf(shape: BpmnShape): string {
  const name = shape.businessObject.name;
  return typeof name === "string" && name !== "" ? name : shape.id;
}

function severityWord(severity: GrcFindingSeverity): string {
  switch (severity) {
    case "critical":
      return "kritisch";
    case "high":
      return "hoch";
    case "medium":
      return "mittel";
    default:
      return "gering";
  }
}
