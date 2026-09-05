/**
 * Der Invariantenprüfer — **zuerst gebaut, bevor eine Zeile Funktionalität
 * entstand** (SPIKE-ENTSCHEIDUNG, „Prüfwerkzeuge zuerst").
 *
 * Die Begründung ist die zentrale methodische Erkenntnis des Spikes: Die zwei
 * ernstesten Fehler des Renderer-Strangs fand nicht die Testsuite, sondern das
 * Auge. In der Modellierungsschicht gibt es dieses Auge nicht — ein falsch
 * umgehängter `flowNodeRef` sieht auf dem Bildschirm völlig richtig aus und
 * fällt erst auf, wenn ein Fremdwerkzeug die Datei Monate später nicht mehr
 * liest. Dieser Prüfer **ist** das Auge.
 *
 * Er ist bewusst
 *
 *   - **total**: er wirft nie, sondern liefert eine Liste von Befunden. Ein
 *     kaputter Baum muss prüfbar bleiben, sonst kann man nicht berichten,
 *     *warum* er kaputt ist;
 *   - **abhängigkeitsarm**: er braucht `bpmn-moddle`-Objekte und eine
 *     strukturell getippte `elementRegistry`, aber weder `diagram-js` noch
 *     diese Modellierungsschicht. Ein Eigenschaftstest-Agent kann ihn über
 *     beliebige Operationsfolgen jagen, ohne den Rest zu instanziieren;
 *   - **deterministisch sortiert**: Befunde kommen in stabiler Reihenfolge,
 *     damit Abweichungen in Testausgaben diffbar bleiben.
 *
 * Aufrufkonvention: {@link checkInvariants} liefert Befunde,
 * {@link assertInvariants} wirft mit einer lesbaren Sammelmeldung. In den
 * Tests läuft `assertInvariants` nach **jeder** Operation und nach jedem Undo.
 */

import type { ElementRegistryLike, ModdleElement } from "./types";

// ---------------------------------------------------------------------------
// Befundtypen
// ---------------------------------------------------------------------------

export type InvariantCode =
  // Baum 1 ↔ Baum 3 (semantisch ↔ grafisch)
  | "GRAPHIC_WITHOUT_SEMANTIC"
  | "GRAPHIC_SEMANTIC_NOT_IN_DOCUMENT"
  | "SEMANTIC_WITHOUT_GRAPHIC"
  | "GRAPHIC_ID_MISMATCH"
  // Baum 2 (DI)
  | "DI_WITHOUT_BPMN_ELEMENT"
  | "DI_ORPHANED"
  | "DI_DUPLICATE"
  | "DI_MISSING"
  | "DI_BOUNDS_INVALID"
  | "DI_WAYPOINTS_INVALID"
  | "DI_BOUNDS_MISMATCH"
  | "DI_WAYPOINTS_MISMATCH"
  | "DI_NOT_IN_PLANE"
  // Referenzen im semantischen Baum
  | "FLOW_WITHOUT_SOURCE"
  | "FLOW_WITHOUT_TARGET"
  | "FLOW_SOURCE_NOT_IN_DOCUMENT"
  | "FLOW_TARGET_NOT_IN_DOCUMENT"
  | "OUTGOING_MISSING"
  | "INCOMING_MISSING"
  | "OUTGOING_STALE"
  | "INCOMING_STALE"
  | "DEFAULT_FLOW_DANGLING"
  | "DATA_ASSOCIATION_DANGLING"
  // Containment
  | "NODE_IN_TWO_CONTAINERS"
  | "PARENT_LINK_BROKEN"
  | "CONTAINER_MISMATCH"
  // IDs
  | "DUPLICATE_ID"
  | "MISSING_ID"
  // Lanes
  | "LANE_REF_NOT_IN_DOCUMENT"
  | "LANE_REF_FOREIGN_PROCESS"
  | "LANE_REF_DUPLICATE"
  | "LANE_REF_NOT_A_FLOWNODE"
  // Boundary Events
  | "BOUNDARY_WITHOUT_HOST"
  | "BOUNDARY_HOST_NOT_ACTIVITY"
  | "BOUNDARY_HOST_MISMATCH"
  | "BOUNDARY_HOST_FOREIGN_CONTAINER"
  // Kollaboration
  | "PARTICIPANT_PROCESS_MISSING"
  | "MESSAGE_FLOW_OUTSIDE_COLLABORATION";

export interface InvariantViolation {
  readonly code: InvariantCode;
  readonly message: string;
  /** BPMN-Id des betroffenen Elements, soweit ermittelbar. */
  readonly elementId?: string;
}

export interface InvariantContext {
  /** Wurzel des moddle-Baums (`bpmn:Definitions`). */
  readonly definitions: ModdleElement;
  /**
   * Grafisches Modell. Fehlt es, laufen nur die Prüfungen über Baum 1 und 2 —
   * das ist der Modus, in dem ein reiner Modell-Eigenschaftstest arbeitet.
   */
  readonly elementRegistry?: ElementRegistryLike | undefined;
  /**
   * Prüfungen, die für diesen Aufruf nicht gelten sollen. Jede Ausnahme ist im
   * Protokoll zu begründen; der Vorgabewert ist „keine".
   */
  readonly ignore?: readonly InvariantCode[] | undefined;
  /** Toleranz beim Vergleich von DI-Geometrie und Grafik (px). */
  readonly geometryTolerance?: number | undefined;
}

export class InvariantError extends Error {
  constructor(readonly violations: readonly InvariantViolation[]) {
    super(formatViolations(violations));
    this.name = "InvariantError";
  }
}

export function formatViolations(
  violations: readonly InvariantViolation[],
  label?: string,
): string {
  const head =
    (label ? `${label}: ` : "") +
    `${String(violations.length)} Invariantenverletzung(en)`;
  const body = violations
    .map(
      (v) =>
        `  - [${v.code}]${v.elementId ? ` <${v.elementId}>` : ""} ${v.message}`,
    )
    .join("\n");
  return `${head}\n${body}`;
}

/** Prüft und wirft. Der Aufruf, den die Tests nach jeder Operation machen. */
export function assertInvariants(
  context: InvariantContext,
  label?: string,
): void {
  const violations = checkInvariants(context);
  if (violations.length > 0) {
    const error = new InvariantError(violations);
    error.message = formatViolations(violations, label);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// moddle-Hilfen
// ---------------------------------------------------------------------------

export function isModdle(value: unknown): value is ModdleElement {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { $type?: unknown }).$type === "string"
  );
}

function isType(element: ModdleElement, type: string): boolean {
  const fn = (element as { $instanceOf?: unknown }).$instanceOf;
  if (typeof fn === "function") {
    return (fn as (t: string) => boolean).call(element, type);
  }
  return element.$type === type;
}

function asArray(value: unknown): ModdleElement[] {
  return Array.isArray(value) ? value.filter(isModdle) : [];
}

/**
 * Eigenschaftsnamen, die **Verweise** tragen, keine Enthaltenheit.
 *
 * Der Baumlauf unten braucht diese Unterscheidung, weil `moddle` sie zur
 * Laufzeit nicht anbietet: `flow.sourceRef` und `process.flowElements[0]`
 * sehen als Objektwert identisch aus. Würde der Lauf Verweise mitnehmen, wäre
 * jedes Element mehrfach „enthalten" und die Prüfung
 * `NODE_IN_TWO_CONTAINERS` sinnlos.
 */
const REFERENCE_PROPERTIES: ReadonlySet<string> = new Set([
  "$parent",
  "sourceRef",
  "targetRef",
  "attachedToRef",
  "processRef",
  "bpmnElement",
  "flowNodeRef",
  "default",
  "defaultFlow",
  "incoming",
  "outgoing",
  "messageRef",
  "errorRef",
  "escalationRef",
  "signalRef",
  "dataStoreRef",
  "structureRef",
  "categoryValueRef",
  "operationRef",
  "resourceRef",
  "partitionElement",
  "loopDataInputRef",
  "loopDataOutputRef",
  "inputDataRef",
  "outputDataRef",
  "itemSubjectRef",
  "definitionalCollaborationRef",
  "initiatingParticipantRef",
  "participantRef",
  "innerParticipantRef",
  "outerParticipantRef",
  "correlationPropertyRef",
  "activityRef",
  "interfaceRef",
  "sourceElement",
  "targetElement",
  "supportedInterfaceRef",
]);

/**
 * Jedes Element des Dokuments, in Dokumentreihenfolge, jeweils mit seinem
 * Container. Enthaltenheit wird über den Eigenschaftsnamen bestimmt (siehe
 * {@link REFERENCE_PROPERTIES}), *nicht* über `$parent` — sonst könnte ein
 * fehlerhaft gesetztes `$parent` die Prüfung `PARENT_LINK_BROKEN` selbst
 * unwirksam machen.
 */
export function walkDocument(
  definitions: ModdleElement,
): Array<{ element: ModdleElement; owner?: ModdleElement; property?: string }> {
  const out: Array<{
    element: ModdleElement;
    owner?: ModdleElement;
    property?: string;
  }> = [];
  const seen = new Set<ModdleElement>();

  const visit = (
    element: ModdleElement,
    owner?: ModdleElement,
    property?: string,
  ): void => {
    if (seen.has(element)) {
      // Ein zweiter Enthaltenheitspfad auf dasselbe Objekt ist genau der
      // Fehler, den NODE_IN_TWO_CONTAINERS meldet; der Lauf selbst darf
      // deswegen nicht in eine Schleife geraten.
      out.push({
        element,
        ...(owner ? { owner } : {}),
        ...(property ? { property } : {}),
      });
      return;
    }
    seen.add(element);
    out.push({
      element,
      ...(owner ? { owner } : {}),
      ...(property ? { property } : {}),
    });

    for (const key of Object.keys(element)) {
      if (key.startsWith("$") && key !== "$children") continue;
      if (REFERENCE_PROPERTIES.has(key)) continue;
      const value = element[key];
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (isModdle(entry)) visit(entry, element, key);
        }
      } else if (isModdle(value)) {
        visit(value, element, key);
      }
    }
  };

  visit(definitions);
  return out;
}

/** Alle Elemente des Dokuments als Menge — die Grundlage jeder Referenzprüfung. */
export function documentElements(
  definitions: ModdleElement,
): Set<ModdleElement> {
  return new Set(walkDocument(definitions).map((e) => e.element));
}

// ---------------------------------------------------------------------------
// Zugriffe, die der Prüfer selbst braucht (bewusst dupliziert statt aus
// src/model/access.ts importiert: der Prüfer soll auch dann noch etwas sagen
// können, wenn dort etwas kaputt ist)
// ---------------------------------------------------------------------------

function rootElements(definitions: ModdleElement): ModdleElement[] {
  return asArray(definitions["rootElements"]);
}

function flowElementsOf(container: ModdleElement): ModdleElement[] {
  return asArray(container["flowElements"]);
}

/** Der `bpmn:Process`/`bpmn:SubProcess`, in dessen Lane-Hierarchie `lane` steht. */
function processOfLane(
  ownerOf: ReadonlyMap<ModdleElement, ModdleElement | undefined>,
  lane: ModdleElement,
): ModdleElement | undefined {
  // lane → laneSet → (childLaneSet-Kette) → Container
  let owner = ownerOf.get(lane);
  let guard = 0;
  while (owner && guard++ < 64) {
    if (isFlowElementContainer(owner)) return owner;
    owner = ownerOf.get(owner);
  }
  return undefined;
}

function isFlowElementContainer(element: ModdleElement): boolean {
  return (
    element.$type === "bpmn:Process" ||
    element.$type === "bpmn:SubProcess" ||
    element.$type === "bpmn:AdHocSubProcess" ||
    element.$type === "bpmn:Transaction"
  );
}

/** Container jedes Elements — einmal berechnet, überall benutzt. */
function buildOwnerMap(
  walked: ReturnType<typeof walkDocument>,
): Map<ModdleElement, ModdleElement | undefined> {
  const ownerOf = new Map<ModdleElement, ModdleElement | undefined>();
  for (const entry of walked) {
    if (!ownerOf.has(entry.element)) ownerOf.set(entry.element, entry.owner);
  }
  return ownerOf;
}

function diagramPlanes(definitions: ModdleElement): ModdleElement[] {
  const out: ModdleElement[] = [];
  for (const diagram of asArray(definitions["diagrams"])) {
    const plane = diagram["plane"];
    if (isModdle(plane)) out.push(plane);
  }
  return out;
}

function planeElements(plane: ModdleElement): ModdleElement[] {
  return asArray(plane["planeElement"]);
}

function refId(value: unknown): string | undefined {
  if (isModdle(value))
    return typeof value.id === "string" ? value.id : undefined;
  return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function shortId(element: ModdleElement): string {
  return typeof element.id === "string" && element.id !== ""
    ? element.id
    : `<${element.$type}>`;
}

// ---------------------------------------------------------------------------
// Der Prüfer
// ---------------------------------------------------------------------------

interface GraphicLike {
  id?: unknown;
  businessObject?: unknown;
  di?: unknown;
  waypoints?: unknown;
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
  host?: unknown;
  labelTarget?: unknown;
  parent?: unknown;
  isImplicit?: unknown;
  children?: unknown;
}

export function checkInvariants(
  context: InvariantContext,
): InvariantViolation[] {
  const { definitions } = context;
  const ignore = new Set<InvariantCode>(context.ignore ?? []);
  const tolerance = context.geometryTolerance ?? 0.5;
  const violations: InvariantViolation[] = [];

  const add = (
    code: InvariantCode,
    message: string,
    elementId?: string,
  ): void => {
    if (ignore.has(code)) return;
    violations.push({
      code,
      message,
      ...(elementId !== undefined ? { elementId } : {}),
    });
  };

  const walked = walkDocument(definitions);
  const inDocument = new Set(walked.map((e) => e.element));
  const ownerOf = buildOwnerMap(walked);

  checkIds(walked, add);
  checkContainment(walked, definitions, add);
  checkFlowReferences(walked, inDocument, add);
  checkDefaultsAndData(walked, inDocument, add);
  checkBoundaryEvents(walked, ownerOf, inDocument, add);
  checkLanes(walked, ownerOf, inDocument, add);
  checkCollaboration(walked, definitions, inDocument, add);
  const diIndex = checkDi(walked, definitions, inDocument, add);

  if (context.elementRegistry) {
    checkGraphics(
      context.elementRegistry,
      walked,
      inDocument,
      diIndex,
      tolerance,
      add,
    );
  }

  return violations;
}

type Add = (code: InvariantCode, message: string, elementId?: string) => void;

// --- IDs -------------------------------------------------------------------

function checkIds(walked: ReturnType<typeof walkDocument>, add: Add): void {
  const byId = new Map<string, ModdleElement[]>();
  for (const { element } of walked) {
    const id = element["id"];
    if (typeof id !== "string" || id === "") {
      if (needsId(element)) {
        add("MISSING_ID", `${element.$type} ohne id`);
      }
      continue;
    }
    if (!isDiagramIdentifier(element)) continue;
    const bucket = byId.get(id);
    if (bucket) {
      if (!bucket.includes(element)) bucket.push(element);
    } else {
      byId.set(id, [element]);
    }
  }
  for (const [id, elements] of [...byId.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (elements.length > 1) {
      add(
        "DUPLICATE_ID",
        `id ${id} wird von ${String(elements.length)} Elementen benutzt (${elements
          .map((e) => e.$type)
          .join(", ")})`,
        id,
      );
    }
  }
}

/**
 * Namensräume, in denen ein `id`-Attribut eine **Diagrammkennung** ist.
 *
 * Alles andere ist eine Erweiterung, und dort ist `id` ein Feld des fremden
 * Schemas — bei ARCTOS ein **Fremdschlüssel**: `arctos:riskRef/@id` nennt die
 * Kennung eines Risikos in der Datenbank, nicht die eines Diagrammelements.
 * Zwei Aufgaben, die dasselbe Risiko tragen, sind der Normalfall (im Editor
 * beim Kopieren einer Aufgabe genauso wie in jeder von Hand gepflegten Datei)
 * und keine doppelte Kennung. Vor dieser Einschränkung schlug `DUPLICATE_ID`
 * genau darauf an — `STUFE2-B1-EDITOR.md` §6, Punkt 3.
 *
 * Die Eindeutigkeit, die BPMN fordert, gilt für `bpmn:`/`bpmndi:`/`dc:`/`di:`;
 * die Eindeutigkeit innerhalb einer fremden Erweiterung zu beurteilen steht
 * diesem Prüfer nicht zu — er kennt deren Schema nicht.
 */
const DIAGRAM_NAMESPACES: ReadonlySet<string> = new Set([
  "bpmn",
  "bpmndi",
  "dc",
  "di",
]);

function isDiagramIdentifier(element: ModdleElement): boolean {
  const type = element.$type;
  if (typeof type !== "string") return false;
  const colon = type.indexOf(":");
  // Ein Typ ohne Präfix kommt aus keiner Erweiterung.
  if (colon < 0) return true;
  return DIAGRAM_NAMESPACES.has(type.slice(0, colon));
}

/** Welche Typen brauchen zwingend eine id, damit die DI sie referenzieren kann? */
function needsId(element: ModdleElement): boolean {
  return (
    isType(element, "bpmn:FlowElement") ||
    isType(element, "bpmn:Participant") ||
    isType(element, "bpmn:Lane") ||
    isType(element, "bpmn:Process") ||
    isType(element, "bpmn:Collaboration") ||
    isType(element, "bpmn:Artifact")
  );
}

// --- Enthaltenheit ---------------------------------------------------------

function checkContainment(
  walked: ReturnType<typeof walkDocument>,
  definitions: ModdleElement,
  add: Add,
): void {
  const containers = new Map<
    ModdleElement,
    Array<{ owner: ModdleElement; property: string }>
  >();
  for (const entry of walked) {
    if (!entry.owner || !entry.property) continue;
    const list = containers.get(entry.element) ?? [];
    list.push({ owner: entry.owner, property: entry.property });
    containers.set(entry.element, list);
  }

  for (const [element, owners] of containers) {
    if (owners.length > 1) {
      const first = owners[0];
      const distinct = owners.filter(
        (o, i) =>
          owners.findIndex(
            (x) => x.owner === o.owner && x.property === o.property,
          ) === i,
      );
      if (distinct.length > 1 || owners.length > distinct.length) {
        add(
          "NODE_IN_TWO_CONTAINERS",
          `${element.$type} steht in ${String(owners.length)} Containern: ${owners
            .map((o) => `${shortId(o.owner)}.${o.property}`)
            .join(", ")}`,
          shortId(element),
        );
      } else if (first) {
        // gleiche Liste zweimal — ebenfalls ein Fehler
        add(
          "NODE_IN_TWO_CONTAINERS",
          `${element.$type} steht doppelt in ${shortId(first.owner)}.${first.property}`,
          shortId(element),
        );
      }
    }
    const owner = owners[0]?.owner;
    if (!owner) continue;
    if (!needsParentLink(element)) continue;
    const parent = element["$parent"];
    if (parent === undefined) {
      add(
        "PARENT_LINK_BROKEN",
        `${element.$type} hat kein $parent, gehört aber zu ${shortId(owner)}`,
        shortId(element),
      );
    } else if (parent !== owner) {
      add(
        "PARENT_LINK_BROKEN",
        `${element.$type}.$parent zeigt auf ${isModdle(parent) ? shortId(parent) : String(parent)}, enthalten ist es aber in ${shortId(owner)}`,
        shortId(element),
      );
    }
  }

  if (definitions["$parent"] !== undefined && definitions["$parent"] !== null) {
    add("PARENT_LINK_BROKEN", "bpmn:Definitions hat ein $parent");
  }

  checkContainerKinds(walked, add);
}

/**
 * Für welche Elemente wird `$parent` verlangt?
 *
 * **Nicht für alle** — diese Invariante war zu streng, und der Beleg dafür ist
 * der stärkste, den es gibt: sie schlug beim Vergleichslauf auch auf `bpmn-js`
 * an (Verifikationsbericht §3.8). `moddle-xml` serialisiert Kinder über die
 * deklarierte Eigenschaft, nicht über `$parent`; ein `dc:Bounds` ohne
 * Elternverweis läuft korrekt durch den Round-Trip, und die
 * Referenzimplementierung setzt ihn seit einem Jahrzehnt nicht.
 *
 * Dass eine Invariante auf der Referenz anschlägt, ist der sauberste Beweis,
 * den es für „zu streng" gibt — und der Grund, warum der Vergleichslauf mehr
 * ist als ein Sicherheitsnetz.
 *
 * Verlangt wird `$parent` weiterhin dort, wo er etwas steuert: an Elementen
 * mit eigener Identität, auf die verwiesen wird und deren Umhängen zwischen
 * Containern diese Schicht selbst besorgt. Die reinen Geometrie-Wertobjekte
 * (`dc:Bounds`, `dc:Point`, `di:Waypoint`, `bpmndi:BPMNLabel`) sind ausgenommen.
 */
function needsParentLink(element: ModdleElement): boolean {
  const type = element.$type;
  if (type.startsWith("dc:") || type.startsWith("di:")) return false;
  if (type === "bpmndi:BPMNLabel") return false;
  return true;
}

/**
 * Steht jedes Element in einem Container, den das BPMN-Schema für seinen Typ
 * überhaupt vorsieht?
 *
 * Der Grund für diese Prüfung ist ein Fehler, den der Bau dieser Schicht
 * geliefert hat: Ein Knoten, den man auf der Wurzel eines
 * **Kollaborationsdiagramms** ablegt, landet in `collaboration.flowElements`.
 * Diese Eigenschaft gibt es im Schema nicht — `moddle` nimmt sie im Speicher
 * klaglos an und **schreibt sie beim Export einfach nicht**. Im Editor ist der
 * Knoten da, in der Datei fehlt er. Kein anderer Befund dieses Prüfers zeigt
 * das an: die DI stimmt, die Referenzen stimmen, die IDs stimmen. Es ist genau
 * die Fehlerart, die SPIKE-ENTSCHEIDUNG beschreibt.
 */
function checkContainerKinds(
  walked: ReturnType<typeof walkDocument>,
  add: Add,
): void {
  for (const { element, owner, property } of walked) {
    if (!owner || !property) continue;

    if (element.$type === "bpmn:Participant") {
      if (owner.$type !== "bpmn:Collaboration") {
        add(
          "CONTAINER_MISMATCH",
          `Participant steht in ${owner.$type}.${property} statt in einer Collaboration`,
          shortId(element),
        );
      }
      continue;
    }

    if (element.$type === "bpmn:MessageFlow") continue; // eigene Prüfung

    if (isType(element, "bpmn:Artifact")) {
      if (
        !isFlowElementContainer(owner) &&
        owner.$type !== "bpmn:Collaboration"
      ) {
        add(
          "CONTAINER_MISMATCH",
          `${element.$type} steht in ${owner.$type}.${property}`,
          shortId(element),
        );
      }
      continue;
    }

    if (isType(element, "bpmn:FlowElement") && property === "flowElements") {
      if (!isFlowElementContainer(owner)) {
        add(
          "CONTAINER_MISMATCH",
          `${element.$type} steht in ${owner.$type}.flowElements — diese Eigenschaft gibt es dort nicht, der Export verliert das Element stillschweigend`,
          shortId(element),
        );
      }
    }
  }
}

// --- Flüsse ----------------------------------------------------------------

function checkFlowReferences(
  walked: ReturnType<typeof walkDocument>,
  inDocument: ReadonlySet<ModdleElement>,
  add: Add,
): void {
  const flows = walked
    .map((e) => e.element)
    .filter(
      (e) => e.$type === "bpmn:SequenceFlow" || e.$type === "bpmn:MessageFlow",
    );
  const nodes = walked
    .map((e) => e.element)
    .filter(
      (e) => isType(e, "bpmn:FlowNode") || e.$type === "bpmn:Participant",
    );

  const seenFlows = new Set(flows);

  for (const flow of seenFlows) {
    const source = flow["sourceRef"];
    const target = flow["targetRef"];

    // `incoming`/`outgoing` sind laut BPMN 2.0 als Verweise auf
    // **SequenceFlow** definiert. Ein MessageFlow steht dort *nicht* drin —
    // wer ihn dort einträgt, erzeugt eine Datei, die ein Fremdwerkzeug als
    // schemawidrig zurückweist. Deshalb wird die beidseitige Konsistenz nur
    // für Sequenzflüsse gefordert, für Nachrichtenflüsse nur die
    // Auflösbarkeit der Endpunkte.
    const twoSided = flow.$type === "bpmn:SequenceFlow";

    if (!isModdle(source)) {
      add("FLOW_WITHOUT_SOURCE", `${flow.$type} ohne sourceRef`, shortId(flow));
    } else if (!inDocument.has(source)) {
      add(
        "FLOW_SOURCE_NOT_IN_DOCUMENT",
        `sourceRef ${shortId(source)} steht nicht (mehr) im Dokument`,
        shortId(flow),
      );
    } else if (twoSided && !asArray(source["outgoing"]).includes(flow)) {
      add(
        "OUTGOING_MISSING",
        `${shortId(source)}.outgoing enthält ${shortId(flow)} nicht`,
        shortId(flow),
      );
    }

    if (!isModdle(target)) {
      add("FLOW_WITHOUT_TARGET", `${flow.$type} ohne targetRef`, shortId(flow));
    } else if (!inDocument.has(target)) {
      add(
        "FLOW_TARGET_NOT_IN_DOCUMENT",
        `targetRef ${shortId(target)} steht nicht (mehr) im Dokument`,
        shortId(flow),
      );
    } else if (twoSided && !asArray(target["incoming"]).includes(flow)) {
      add(
        "INCOMING_MISSING",
        `${shortId(target)}.incoming enthält ${shortId(flow)} nicht`,
        shortId(flow),
      );
    }
  }

  for (const node of new Set(nodes)) {
    for (const flow of asArray(node["outgoing"])) {
      if (!inDocument.has(flow)) {
        add(
          "OUTGOING_STALE",
          `${shortId(node)}.outgoing verweist auf ${shortId(flow)}, das nicht mehr im Dokument steht`,
          shortId(node),
        );
      } else if (flow["sourceRef"] !== node) {
        add(
          "OUTGOING_STALE",
          `${shortId(node)}.outgoing enthält ${shortId(flow)}, dessen sourceRef woanders zeigt`,
          shortId(node),
        );
      }
    }
    for (const flow of asArray(node["incoming"])) {
      if (!inDocument.has(flow)) {
        add(
          "INCOMING_STALE",
          `${shortId(node)}.incoming verweist auf ${shortId(flow)}, das nicht mehr im Dokument steht`,
          shortId(node),
        );
      } else if (flow["targetRef"] !== node) {
        add(
          "INCOMING_STALE",
          `${shortId(node)}.incoming enthält ${shortId(flow)}, dessen targetRef woanders zeigt`,
          shortId(node),
        );
      }
    }
  }
}

// --- default-Fluss und Datenassoziationen ----------------------------------

function checkDefaultsAndData(
  walked: ReturnType<typeof walkDocument>,
  inDocument: ReadonlySet<ModdleElement>,
  add: Add,
): void {
  for (const { element } of walked) {
    const def = element["default"];
    if (def !== undefined && def !== null) {
      if (!isModdle(def) || !inDocument.has(def)) {
        add(
          "DEFAULT_FLOW_DANGLING",
          `${shortId(element)}.default verweist auf einen nicht mehr vorhandenen Fluss`,
          shortId(element),
        );
      } else if (!asArray(element["outgoing"]).includes(def)) {
        add(
          "DEFAULT_FLOW_DANGLING",
          `${shortId(element)}.default zeigt auf ${shortId(def)}, das kein ausgehender Fluss (mehr) ist`,
          shortId(element),
        );
      }
    }

    for (const property of [
      "dataInputAssociations",
      "dataOutputAssociations",
    ] as const) {
      for (const assoc of asArray(element[property])) {
        const refs = [
          ...asArray(assoc["sourceRef"]),
          ...(isModdle(assoc["sourceRef"]) ? [assoc["sourceRef"]] : []),
          ...(isModdle(assoc["targetRef"]) ? [assoc["targetRef"]] : []),
        ];
        for (const ref of refs) {
          if (!inDocument.has(ref)) {
            add(
              "DATA_ASSOCIATION_DANGLING",
              `${property} von ${shortId(element)} verweist auf ${shortId(ref)}, das nicht mehr im Dokument steht`,
              shortId(element),
            );
          }
        }
      }
    }
  }
}

// --- Boundary Events -------------------------------------------------------

function checkBoundaryEvents(
  walked: ReturnType<typeof walkDocument>,
  ownerOf: ReadonlyMap<ModdleElement, ModdleElement | undefined>,
  inDocument: ReadonlySet<ModdleElement>,
  add: Add,
): void {
  for (const { element } of walked) {
    if (element.$type !== "bpmn:BoundaryEvent") continue;
    const host = element["attachedToRef"];
    if (!isModdle(host)) {
      add(
        "BOUNDARY_WITHOUT_HOST",
        "BoundaryEvent ohne attachedToRef",
        shortId(element),
      );
      continue;
    }
    if (!inDocument.has(host)) {
      add(
        "BOUNDARY_WITHOUT_HOST",
        `attachedToRef ${shortId(host)} steht nicht mehr im Dokument`,
        shortId(element),
      );
      continue;
    }
    if (!isType(host, "bpmn:Activity")) {
      add(
        "BOUNDARY_HOST_NOT_ACTIVITY",
        `attachedToRef zeigt auf ${host.$type}, nicht auf eine Aktivität`,
        shortId(element),
      );
    }
    const eventOwner = ownerOf.get(element);
    const hostOwner = ownerOf.get(host);
    if (eventOwner && hostOwner && eventOwner !== hostOwner) {
      add(
        "BOUNDARY_HOST_FOREIGN_CONTAINER",
        `BoundaryEvent liegt in ${shortId(eventOwner)}, sein Wirt aber in ${shortId(hostOwner)}`,
        shortId(element),
      );
    }
  }
}

// --- Lanes -----------------------------------------------------------------

function checkLanes(
  walked: ReturnType<typeof walkDocument>,
  ownerOf: ReadonlyMap<ModdleElement, ModdleElement | undefined>,
  inDocument: ReadonlySet<ModdleElement>,
  add: Add,
): void {
  const containers = walked
    .map((e) => e.element)
    .filter(isFlowElementContainer);

  for (const container of new Set(containers)) {
    const own = new Set(flowElementsOf(container));
    for (const laneSet of asArray(container["laneSets"])) {
      checkLaneSet(laneSet, container, own, inDocument, add);
    }
  }

  // Lanes, deren Prozess sich nicht ermitteln lässt, sind ebenfalls ein Befund.
  for (const entry of walked) {
    if (entry.element.$type !== "bpmn:Lane") continue;
    if (!processOfLane(ownerOf, entry.element)) {
      add(
        "LANE_REF_FOREIGN_PROCESS",
        "Lane hängt an keinem Prozess",
        shortId(entry.element),
      );
    }
  }
}

function checkLaneSet(
  laneSet: ModdleElement,
  container: ModdleElement,
  ownFlowElements: ReadonlySet<ModdleElement>,
  inDocument: ReadonlySet<ModdleElement>,
  add: Add,
): void {
  const claimedHere = new Map<ModdleElement, ModdleElement>();
  for (const lane of asArray(laneSet["lanes"])) {
    for (const node of asArray(lane["flowNodeRef"])) {
      if (!inDocument.has(node)) {
        add(
          "LANE_REF_NOT_IN_DOCUMENT",
          `flowNodeRef verweist auf ${shortId(node)}, das nicht mehr im Dokument steht`,
          shortId(lane),
        );
        continue;
      }
      if (!isType(node, "bpmn:FlowNode")) {
        add(
          "LANE_REF_NOT_A_FLOWNODE",
          `flowNodeRef verweist auf ${node.$type}`,
          shortId(lane),
        );
      }
      if (!ownFlowElements.has(node)) {
        add(
          "LANE_REF_FOREIGN_PROCESS",
          `flowNodeRef ${shortId(node)} gehört nicht zu den flowElements von ${shortId(container)}`,
          shortId(lane),
        );
      }
      const previous = claimedHere.get(node);
      if (previous && previous !== lane) {
        add(
          "LANE_REF_DUPLICATE",
          `${shortId(node)} wird von ${shortId(previous)} und ${shortId(lane)} auf derselben Ebene beansprucht`,
          shortId(node),
        );
      } else {
        claimedHere.set(node, lane);
      }
    }
    const child = lane["childLaneSet"];
    if (isModdle(child)) {
      checkLaneSet(child, container, ownFlowElements, inDocument, add);
    }
  }
}

// --- Kollaboration ---------------------------------------------------------

function checkCollaboration(
  walked: ReturnType<typeof walkDocument>,
  definitions: ModdleElement,
  inDocument: ReadonlySet<ModdleElement>,
  add: Add,
): void {
  const collaborations = rootElements(definitions).filter(
    (e) => e.$type === "bpmn:Collaboration",
  );
  for (const collaboration of collaborations) {
    for (const participant of asArray(collaboration["participants"])) {
      const processRef = participant["processRef"];
      if (processRef === undefined || processRef === null) continue;
      if (!isModdle(processRef) || !inDocument.has(processRef)) {
        add(
          "PARTICIPANT_PROCESS_MISSING",
          `processRef von ${shortId(participant)} verweist ins Leere`,
          shortId(participant),
        );
      }
    }
  }

  for (const { element, owner } of walked) {
    if (element.$type !== "bpmn:MessageFlow") continue;
    if (!owner || owner.$type !== "bpmn:Collaboration") {
      add(
        "MESSAGE_FLOW_OUTSIDE_COLLABORATION",
        `MessageFlow liegt in ${owner ? owner.$type : "keinem Container"} statt in einer Collaboration`,
        shortId(element),
      );
    }
  }
}

// --- DI --------------------------------------------------------------------

interface DiIndex {
  byElement: Map<ModdleElement, ModdleElement>;
  planeOf: Map<ModdleElement, ModdleElement>;
  /** Elemente, die auf einer Ebene tatsächlich gezeichnet werden. */
  visible: Set<ModdleElement>;
}

function checkDi(
  walked: ReturnType<typeof walkDocument>,
  definitions: ModdleElement,
  inDocument: ReadonlySet<ModdleElement>,
  add: Add,
): DiIndex {
  const byElement = new Map<ModdleElement, ModdleElement>();
  const planeOf = new Map<ModdleElement, ModdleElement>();
  const planes = diagramPlanes(definitions);

  for (const plane of planes) {
    const seenHere = new Map<ModdleElement, ModdleElement>();
    for (const di of planeElements(plane)) {
      const ref = di["bpmnElement"];
      if (ref === undefined || ref === null) {
        add(
          "DI_WITHOUT_BPMN_ELEMENT",
          `${di.$type} ohne bpmnElement`,
          shortId(di),
        );
        continue;
      }
      if (!isModdle(ref)) {
        add(
          "DI_ORPHANED",
          `${di.$type}.bpmnElement ist ein unaufgelöster Verweis (${String(refId(ref))})`,
          shortId(di),
        );
        continue;
      }
      if (!inDocument.has(ref)) {
        add(
          "DI_ORPHANED",
          `${di.$type} verweist auf ${shortId(ref)}, das nicht mehr im Dokument steht`,
          shortId(ref),
        );
        continue;
      }
      const previous = seenHere.get(ref);
      if (previous) {
        add(
          "DI_DUPLICATE",
          `${shortId(ref)} hat zwei DI-Einträge in derselben Ebene`,
          shortId(ref),
        );
      } else {
        seenHere.set(ref, di);
      }
      byElement.set(ref, di);
      planeOf.set(ref, plane);

      if (di.$type === "bpmndi:BPMNShape") {
        const bounds = di["bounds"];
        const b = isModdle(bounds)
          ? {
              x: num(bounds["x"]),
              y: num(bounds["y"]),
              width: num(bounds["width"]),
              height: num(bounds["height"]),
            }
          : undefined;
        if (
          !b ||
          b.x === undefined ||
          b.y === undefined ||
          b.width === undefined ||
          b.height === undefined ||
          b.width <= 0 ||
          b.height <= 0
        ) {
          add(
            "DI_BOUNDS_INVALID",
            `BPMNShape für ${shortId(ref)} hat keine brauchbaren Bounds`,
            shortId(ref),
          );
        }
      } else if (di.$type === "bpmndi:BPMNEdge") {
        const waypoints = asArray(di["waypoint"]);
        const bad = waypoints.some(
          (w) => num(w["x"]) === undefined || num(w["y"]) === undefined,
        );
        if (waypoints.length < 2 || bad) {
          add(
            "DI_WAYPOINTS_INVALID",
            `BPMNEdge für ${shortId(ref)} hat ${String(waypoints.length)} brauchbare Wegpunkte`,
            shortId(ref),
          );
        }
      }
    }
  }

  // Fehlende DI: jedes **sichtbare** semantische Element braucht einen Eintrag.
  const visible = buildVisibleSet(definitions, byElement);
  for (const { element } of walked) {
    if (!isRenderableType(element) || !visible.has(element)) continue;
    if (!byElement.has(element)) {
      add(
        "DI_MISSING",
        `${element.$type} hat keinen DI-Eintrag`,
        shortId(element),
      );
    }
  }

  return { byElement, planeOf, visible };
}

/**
 * Welche semantischen Elemente sind **darstellbar**?
 *
 * Bewusst eng gefasst: Datenobjekte ohne Referenz, `bpmn:Message`,
 * Kategorien und Ereignisdefinitionen werden nicht gezeichnet und dürfen
 * deshalb ohne DI existieren.
 */
function isRenderableType(element: ModdleElement): boolean {
  return (
    isType(element, "bpmn:FlowNode") ||
    element.$type === "bpmn:SequenceFlow" ||
    element.$type === "bpmn:MessageFlow" ||
    element.$type === "bpmn:Participant" ||
    element.$type === "bpmn:Lane" ||
    element.$type === "bpmn:DataObjectReference" ||
    element.$type === "bpmn:DataStoreReference" ||
    element.$type === "bpmn:TextAnnotation" ||
    element.$type === "bpmn:Group" ||
    element.$type === "bpmn:Association"
  );
}

/**
 * Die Elemente, die auf einer Ebene tatsächlich **sichtbar** sind — und nur
 * die brauchen eine DI.
 *
 * Der Unterschied ist kein Detail: Ein **eingeklappter** Subprozess
 * (`BPMNShape/@isExpanded="false"`, oder ganz ohne eigene DI) zeigt seinen
 * Inhalt nicht, und BPMN verlangt für diesen Inhalt folgerichtig keine
 * Diagramminformation. Der Bestandskorpus enthält solche Dateien
 * (`synth-boundary-events`, `synth-nested-subprocesses`). Eine Prüfung, die
 * pauschal für jeden Knoten eine DI fordert, meldete dort einen Fehler, den es
 * nicht gibt — und würde nach zwei Fehlalarmen abgeschaltet. Ein Prüfer, dem
 * man nicht glaubt, ist wertlos.
 */
function buildVisibleSet(
  definitions: ModdleElement,
  diByElement: ReadonlyMap<ModdleElement, ModdleElement>,
): Set<ModdleElement> {
  const visible = new Set<ModdleElement>();

  const visitLaneSet = (laneSet: ModdleElement): void => {
    for (const lane of asArray(laneSet["lanes"])) {
      visible.add(lane);
      const child = lane["childLaneSet"];
      if (isModdle(child)) visitLaneSet(child);
    }
  };

  const visitContainer = (container: ModdleElement): void => {
    for (const laneSet of asArray(container["laneSets"])) visitLaneSet(laneSet);
    for (const artifact of asArray(container["artifacts"]))
      visible.add(artifact);
    for (const child of asArray(container["flowElements"])) {
      visible.add(child);
      for (const property of [
        "dataInputAssociations",
        "dataOutputAssociations",
      ] as const) {
        for (const assoc of asArray(child[property])) visible.add(assoc);
      }
      if (!isFlowElementContainer(child)) continue;
      const di = diByElement.get(child);
      // Ohne eigene DI oder eingeklappt: der Inhalt wird nicht gezeichnet.
      if (!di || di["isExpanded"] === false) continue;
      visitContainer(child);
    }
  };

  for (const plane of diagramPlanes(definitions)) {
    const root = plane["bpmnElement"];
    if (!isModdle(root)) continue;
    if (root.$type === "bpmn:Collaboration") {
      for (const participant of asArray(root["participants"])) {
        visible.add(participant);
        const process = participant["processRef"];
        if (isModdle(process)) visitContainer(process);
      }
      for (const flow of asArray(root["messageFlows"])) visible.add(flow);
      for (const artifact of asArray(root["artifacts"])) visible.add(artifact);
      continue;
    }
    visitContainer(root);
  }

  return visible;
}

// --- Grafik ----------------------------------------------------------------

function checkGraphics(
  registry: ElementRegistryLike,
  walked: ReturnType<typeof walkDocument>,
  inDocument: ReadonlySet<ModdleElement>,
  di: DiIndex,
  tolerance: number,
  add: Add,
): void {
  const all = registry.getAll() as GraphicLike[];
  const semanticSeen = new Set<ModdleElement>();

  for (const element of all) {
    const id = typeof element.id === "string" ? element.id : "?";
    if (element.isImplicit === true) continue;

    const bo = element.businessObject;
    if (!isModdle(bo)) {
      add(
        "GRAPHIC_WITHOUT_SEMANTIC",
        "grafisches Element ohne businessObject",
        id,
      );
      continue;
    }
    if (!inDocument.has(bo)) {
      add(
        "GRAPHIC_SEMANTIC_NOT_IN_DOCUMENT",
        `businessObject ${shortId(bo)} steht nicht (mehr) im moddle-Baum`,
        id,
      );
      continue;
    }

    const isLabel =
      (element as { type?: unknown }).type === "label" ||
      (element.labelTarget !== undefined && element.labelTarget !== null);
    if (!isLabel) {
      if (bo.id !== undefined && bo.id !== id) {
        add(
          "GRAPHIC_ID_MISMATCH",
          `grafische id ${id} ≠ businessObject.id ${String(bo.id)}`,
          id,
        );
      }
      if (semanticSeen.has(bo)) {
        add(
          "GRAPHIC_ID_MISMATCH",
          `${shortId(bo)} ist zweimal grafisch vertreten`,
          id,
        );
      }
      semanticSeen.add(bo);
    }

    // Grafik ↔ DI
    if (isLabel) continue;
    const diElement = di.byElement.get(bo);
    if (!diElement) continue; // DI_MISSING hat das bereits gemeldet

    if (element.di !== undefined && element.di !== diElement) {
      add(
        "DI_NOT_IN_PLANE",
        `element.di zeigt auf einen DI-Eintrag, der nicht (mehr) in einer Ebene des Dokuments steht`,
        id,
      );
    }

    if (Array.isArray(element.waypoints)) {
      const graphic = (
        element.waypoints as Array<{ x: unknown; y: unknown }>
      ).map((p) => ({ x: num(p.x), y: num(p.y) }));
      const stored = asArray(diElement["waypoint"]).map((w) => ({
        x: num(w["x"]),
        y: num(w["y"]),
      }));
      if (
        graphic.length !== stored.length ||
        graphic.some((p, i) => {
          const s = stored[i];
          return (
            !s ||
            p.x === undefined ||
            p.y === undefined ||
            s.x === undefined ||
            s.y === undefined ||
            Math.abs(p.x - s.x) > tolerance ||
            Math.abs(p.y - s.y) > tolerance
          );
        })
      ) {
        add(
          "DI_WAYPOINTS_MISMATCH",
          `Wegpunkte der Grafik (${String(graphic.length)}) weichen von der DI (${String(stored.length)}) ab`,
          id,
        );
      }
    } else if (typeof element.width === "number") {
      const bounds = diElement["bounds"];
      const b = isModdle(bounds)
        ? {
            x: num(bounds["x"]),
            y: num(bounds["y"]),
            width: num(bounds["width"]),
            height: num(bounds["height"]),
          }
        : undefined;
      if (b) {
        const diff = (a: unknown, c: number | undefined): boolean =>
          typeof a !== "number" ||
          c === undefined ||
          Math.abs(a - c) > tolerance;
        if (
          diff(element.x, b.x) ||
          diff(element.y, b.y) ||
          diff(element.width, b.width) ||
          diff(element.height, b.height)
        ) {
          add(
            "DI_BOUNDS_MISMATCH",
            `Bounds der Grafik (${String(element.x)},${String(element.y)},${String(element.width)},${String(element.height)}) weichen von der DI (${String(b.x)},${String(b.y)},${String(b.width)},${String(b.height)}) ab`,
            id,
          );
        }
      }
    }

    // Boundary: grafischer Wirt ↔ attachedToRef
    if (bo.$type === "bpmn:BoundaryEvent") {
      const host = element.host as GraphicLike | undefined;
      const attachedTo = bo["attachedToRef"];
      const hostBo = host?.businessObject;
      if (isModdle(attachedTo) && hostBo !== attachedTo) {
        add(
          "BOUNDARY_HOST_MISMATCH",
          `grafischer Wirt ${host ? String(host.id) : "—"} ≠ attachedToRef ${shortId(attachedTo)}`,
          id,
        );
      }
    }
  }

  // Semantisch vorhanden, grafisch nicht: nur für Elemente, deren DI in einer
  // Ebene liegt, die gerade dargestellt wird.
  const renderedPlanes = new Set<ModdleElement>();
  for (const element of all) {
    const bo = element.businessObject;
    if (!isModdle(bo)) continue;
    const plane = di.planeOf.get(bo);
    if (plane) renderedPlanes.add(plane);
  }
  if (renderedPlanes.size > 0) {
    for (const { element } of walked) {
      if (!isRenderableType(element) || !di.visible.has(element)) continue;
      const plane = di.planeOf.get(element);
      if (!plane || !renderedPlanes.has(plane)) continue;
      if (!semanticSeen.has(element)) {
        add(
          "SEMANTIC_WITHOUT_GRAPHIC",
          `${element.$type} liegt in einer dargestellten Ebene, hat aber kein grafisches Element`,
          shortId(element),
        );
      }
    }
  }
}
