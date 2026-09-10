/**
 * Der kuratierte Elementvorrat — was ARCTOS fachlich braucht, nicht was BPMN
 * hergibt.
 *
 * Grundlage ist die Bestandsaufnahme (`inventar_bpmn_elementtypen.csv`). Dort
 * kommen im echten Bestand **acht** Knotentypen vor:
 *
 *   `bpmn:Task` (31×), `bpmn:StartEvent` (22×), `bpmn:EndEvent` (20×),
 *   `bpmn:UserTask` (10×), `bpmn:ServiceTask` (3×),
 *   `bpmn:ExclusiveGateway` (2×), `bpmn:CallActivity` (1×),
 *   `bpmn:SubProcess` (1×)
 *
 * — dazu `bpmn:SequenceFlow` als einzige Kantenart. Die volle BPMN-Palette
 * (heute aktiv, weil `bpmn-js` keinen Override bekommt, Bestandsaufnahme
 * Editorfunktion 1) bietet gut 60 Einträge an, von denen 52 nie benutzt werden.
 * Das ist kein kosmetisches Problem: Eine Palette, in der die richtige Auswahl
 * gesucht werden muss, erzeugt genau die Modellierungsfehler, die die
 * GRC-Auswertung später nicht mehr einfangen kann.
 *
 * Ergänzt sind deshalb nur die Typen, die das **Zielbild** aus Plan §3 braucht
 * und die heute fehlen — jeder mit Begründung in der Tabelle unten. Alles
 * Weitere bleibt draußen und ist über {@link paletteCatalog} nachrüstbar; die
 * Engine zeichnet 35 Typen, die Palette bietet 17 an.
 *
 * | Ergänzung | warum | Plan |
 * |---|---|---|
 * | `bpmn:DataObjectReference`, `bpmn:DataStoreReference` | Datenkategorien und Verarbeitungsverzeichnis hängen am Datenobjekt; heute fehlt der Typ komplett | §3.9 |
 * | `bpmn:TextAnnotation` | Trägerform für Element-Kommentare und Prüfhinweise | §3.7 |
 * | `bpmn:Participant` | Pools sind die Voraussetzung für Lanes, RACI und SoD | §3.11 |
 * | `bpmn:BusinessRuleTask` | Anknüpfungspunkt der DMN-Entscheidung | §3.5 B5 |
 * | `bpmn:IntermediateCatchEvent`, `bpmn:BoundaryEvent` | Störungs- und Fristereignisse der Ausfallsimulation | §3.10 |
 * | `bpmn:ParallelGateway` | ohne paralleles Gateway ist keine Nebenläufigkeit modellierbar; die Conformance-Auswertung braucht sie | §3.8 |
 * | `bpmn:Group` | fachliche Klammer für Abschnitte, Grundlage der Gruppensichten | §3.12 |
 */

import { getTypeLabel } from "../draw/semantic";
import type {
  BpmnShape,
  ModdleElement,
  PaletteGroup,
  PaletteItem,
  ReplaceOption,
} from "./types";

/** Gruppen der Palette, in Anzeigereihenfolge. */
export const PALETTE_GROUPS: readonly PaletteGroup[] = [
  // [ARCTOS-FULL-2026-08-31 · OP-031] Die Werkzeuggruppe steht zuerst: `F6`
  // führt in die Palette, und der erste Knopf dort soll das Werkzeug sein,
  // nicht der erste Elementtyp.
  { id: "werkzeuge", label: "Werkzeuge" },
  { id: "ereignisse", label: "Ereignisse" },
  { id: "aufgaben", label: "Aufgaben" },
  { id: "gateways", label: "Verzweigungen" },
  { id: "struktur", label: "Struktur" },
  { id: "daten", label: "Daten" },
  { id: "artefakte", label: "Artefakte" },
];

/**
 * Der Vorrat. Reihenfolge = Tastaturreihenfolge in der Palette.
 *
 * `bpmn:BoundaryEvent` steht bewusst **nicht** hier: ein Randereignis entsteht
 * nur am Wirt und ist deshalb eine Handlung des Kontextmenüs, keine der
 * Palette. Ein Palette-Eintrag dafür müsste ohne Wirt ins Leere greifen.
 */
export const DEFAULT_PALETTE_ITEMS: readonly PaletteItem[] = [
  {
    id: "create.start-event",
    type: "bpmn:StartEvent",
    title: "Startereignis",
    group: "ereignisse",
    className: "bpmn-icon-start-event-none",
    description: "Beginn des Prozesses",
  },
  {
    id: "create.intermediate-event",
    type: "bpmn:IntermediateCatchEvent",
    title: "Zwischenereignis (eintretend)",
    group: "ereignisse",
    className: "bpmn-icon-intermediate-event-none",
    description: "wartet auf ein Ereignis im Ablauf",
  },
  {
    id: "create.timer-event",
    type: "bpmn:IntermediateCatchEvent",
    title: "Zeitereignis",
    group: "ereignisse",
    eventDefinitionType: "bpmn:TimerEventDefinition",
    className: "bpmn-icon-intermediate-event-catch-timer",
    description: "Frist oder Wartezeit im Ablauf",
  },
  {
    id: "create.end-event",
    type: "bpmn:EndEvent",
    title: "Endereignis",
    group: "ereignisse",
    className: "bpmn-icon-end-event-none",
    description: "Ende des Prozesses",
  },
  {
    id: "create.task",
    type: "bpmn:Task",
    title: "Aufgabe",
    group: "aufgaben",
    className: "bpmn-icon-task",
    description: "unspezifizierter Prozessschritt",
  },
  {
    id: "create.user-task",
    type: "bpmn:UserTask",
    title: "Benutzeraufgabe",
    group: "aufgaben",
    className: "bpmn-icon-user-task",
    description: "ein Mensch führt den Schritt aus",
  },
  {
    id: "create.service-task",
    type: "bpmn:ServiceTask",
    title: "Serviceaufgabe",
    group: "aufgaben",
    className: "bpmn-icon-service-task",
    description: "ein System führt den Schritt aus",
  },
  {
    id: "create.business-rule-task",
    type: "bpmn:BusinessRuleTask",
    title: "Geschäftsregelaufgabe",
    group: "aufgaben",
    className: "bpmn-icon-business-rule-task",
    description: "Anknüpfungspunkt einer DMN-Entscheidung",
  },
  {
    id: "create.exclusive-gateway",
    type: "bpmn:ExclusiveGateway",
    title: "Exklusive Verzweigung",
    group: "gateways",
    className: "bpmn-icon-gateway-xor",
    description: "genau ein Pfad wird gewählt",
  },
  {
    id: "create.parallel-gateway",
    type: "bpmn:ParallelGateway",
    title: "Parallele Verzweigung",
    group: "gateways",
    className: "bpmn-icon-gateway-parallel",
    description: "alle Pfade laufen gleichzeitig",
  },
  {
    id: "create.sub-process",
    type: "bpmn:SubProcess",
    title: "Unterprozess",
    group: "struktur",
    attrs: { isExpanded: true },
    className: "bpmn-icon-subprocess-expanded",
    description: "aufgeklappter Unterprozess",
  },
  {
    id: "create.call-activity",
    type: "bpmn:CallActivity",
    title: "Aufruf eines Unterprozesses",
    group: "struktur",
    className: "bpmn-icon-call-activity",
    description: "verweist auf einen eigenständigen Prozess",
  },
  {
    id: "create.participant",
    type: "bpmn:Participant",
    title: "Pool",
    group: "struktur",
    className: "bpmn-icon-participant",
    description: "eigenständiger Beteiligter mit eigenem Ablauf",
  },
  {
    id: "create.data-object",
    type: "bpmn:DataObjectReference",
    title: "Datenobjekt",
    group: "daten",
    className: "bpmn-icon-data-object",
    description: "Träger von Datenkategorien und Löschfristen",
  },
  {
    id: "create.data-store",
    type: "bpmn:DataStoreReference",
    title: "Datenspeicher",
    group: "daten",
    className: "bpmn-icon-data-store",
    description: "dauerhafte Ablage",
  },
  {
    id: "create.text-annotation",
    type: "bpmn:TextAnnotation",
    title: "Textanmerkung",
    group: "artefakte",
    className: "bpmn-icon-text-annotation",
    description: "Hinweis am Element",
  },
  {
    id: "create.group",
    type: "bpmn:Group",
    title: "Gruppe",
    group: "artefakte",
    className: "bpmn-icon-group",
    description: "fachliche Klammer um mehrere Schritte",
  },
];

export interface PaletteCatalogOptions {
  /** Ersetzt den Vorrat vollständig. */
  readonly items?: readonly PaletteItem[] | undefined;
  /** Zusätzliche Einträge, an ihre Gruppe angehängt. */
  readonly additions?: readonly PaletteItem[] | undefined;
  /** IDs, die nicht angeboten werden. */
  readonly exclude?: readonly string[] | undefined;
}

/**
 * Baut den Vorrat für eine Instanz. Erweiterbarkeit ist Teil des Auftrags —
 * eine Branchenkonfiguration ergänzt hier ihre Typen, ohne den Provider zu
 * ändern.
 */
export function paletteCatalog(
  options: PaletteCatalogOptions = {},
): PaletteItem[] {
  const base = options.items ?? DEFAULT_PALETTE_ITEMS;
  const excluded = new Set(options.exclude ?? []);
  const all = [...base, ...(options.additions ?? [])].filter(
    (item) => !excluded.has(item.id),
  );

  const order = new Map(
    PALETTE_GROUPS.map((group, index) => [group.id, index]),
  );
  return all
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ga = order.get(a.item.group) ?? Number.MAX_SAFE_INTEGER;
      const gb = order.get(b.item.group) ?? Number.MAX_SAFE_INTEGER;
      return ga - gb || a.index - b.index;
    })
    .map((entry) => entry.item);
}

/** Gruppen, die im gegebenen Vorrat tatsächlich vorkommen. */
export function groupsOf(items: readonly PaletteItem[]): PaletteGroup[] {
  const present = new Set(items.map((item) => item.group));
  const known = PALETTE_GROUPS.filter((group) => present.has(group.id));
  const unknown = [...present]
    .filter((id) => !PALETTE_GROUPS.some((group) => group.id === id))
    .map((id) => ({ id, label: id }));
  return [...known, ...unknown];
}

// ---------------------------------------------------------------------------
// Typwechsel
// ---------------------------------------------------------------------------

/**
 * Wechselziele je Formfamilie.
 *
 * Angeboten wird nur, was **dieselbe Rolle im Ablauf** hat: eine Aufgabe wird
 * zu einer anderen Aufgabenart, ein Gateway zu einer anderen Verzweigungsart.
 * Ein Wechsel von Aufgabe zu Ereignis ist zwar erlaubt (die Regeln verbieten
 * ihn nicht), aber er zerreißt in aller Regel die Kanten — und ein Menü, das
 * überwiegend Einträge zeigt, die anschließend Kanten löschen, ist kein
 * hilfreiches Menü.
 */
const DEFINITION_LABELS: Readonly<Record<string, string>> = {
  "bpmn:MessageEventDefinition": "Nachricht",
  "bpmn:TimerEventDefinition": "Zeit",
  "bpmn:ErrorEventDefinition": "Fehler",
  "bpmn:EscalationEventDefinition": "Eskalation",
  "bpmn:ConditionalEventDefinition": "Bedingung",
  "bpmn:SignalEventDefinition": "Signal",
  "bpmn:TerminateEventDefinition": "Terminierung",
};

const REPLACE_FAMILIES: Readonly<Record<string, readonly ReplaceOption[]>> = {
  task: optionsFor([
    "bpmn:Task",
    "bpmn:UserTask",
    "bpmn:ServiceTask",
    "bpmn:BusinessRuleTask",
    "bpmn:ManualTask",
    "bpmn:SendTask",
    "bpmn:ReceiveTask",
    "bpmn:ScriptTask",
    "bpmn:CallActivity",
    "bpmn:SubProcess",
  ]),
  gateway: optionsFor([
    "bpmn:ExclusiveGateway",
    "bpmn:ParallelGateway",
    "bpmn:InclusiveGateway",
    "bpmn:EventBasedGateway",
  ]),
  startEvent: withDefinitions("bpmn:StartEvent", [
    undefined,
    "bpmn:MessageEventDefinition",
    "bpmn:TimerEventDefinition",
    "bpmn:ConditionalEventDefinition",
    "bpmn:SignalEventDefinition",
  ]),
  endEvent: withDefinitions("bpmn:EndEvent", [
    undefined,
    "bpmn:MessageEventDefinition",
    "bpmn:ErrorEventDefinition",
    "bpmn:EscalationEventDefinition",
    "bpmn:TerminateEventDefinition",
    "bpmn:SignalEventDefinition",
  ]),
  intermediateEvent: [
    ...withDefinitions("bpmn:IntermediateCatchEvent", [
      undefined,
      "bpmn:MessageEventDefinition",
      "bpmn:TimerEventDefinition",
      "bpmn:ConditionalEventDefinition",
      "bpmn:SignalEventDefinition",
    ]),
    ...withDefinitions("bpmn:IntermediateThrowEvent", [
      undefined,
      "bpmn:MessageEventDefinition",
      "bpmn:EscalationEventDefinition",
      "bpmn:SignalEventDefinition",
    ]),
  ],
  boundaryEvent: withDefinitions("bpmn:BoundaryEvent", [
    "bpmn:TimerEventDefinition",
    "bpmn:ErrorEventDefinition",
    "bpmn:EscalationEventDefinition",
    "bpmn:MessageEventDefinition",
    "bpmn:SignalEventDefinition",
    "bpmn:ConditionalEventDefinition",
  ]),
  data: optionsFor(["bpmn:DataObjectReference", "bpmn:DataStoreReference"]),
};

function optionsFor(types: readonly string[]): ReplaceOption[] {
  return types.map((type) => ({
    id: `replace.${type.replace("bpmn:", "").toLowerCase()}`,
    type,
    label: capitalize(getTypeLabel(type)),
  }));
}

function withDefinitions(
  type: string,
  definitions: ReadonlyArray<string | undefined>,
): ReplaceOption[] {
  return definitions.map((definition) => {
    const suffix = definition
      ? definition.replace("bpmn:", "").replace("EventDefinition", "")
      : "none";
    const label = definition
      ? `${capitalize(getTypeLabel(type))}: ${DEFINITION_LABELS[definition] ?? suffix}`
      : `${capitalize(getTypeLabel(type))} ohne Auslöser`;
    return {
      id: `replace.${type.replace("bpmn:", "").toLowerCase()}.${suffix.toLowerCase()}`,
      type,
      label,
      eventDefinitionType: definition,
    };
  });
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}

/** Zu welcher Formfamilie gehört ein Element? */
export function replaceFamilyOf(type: string): string | undefined {
  if (type === "bpmn:BoundaryEvent") return "boundaryEvent";
  if (type === "bpmn:StartEvent") return "startEvent";
  if (type === "bpmn:EndEvent") return "endEvent";
  if (
    type === "bpmn:IntermediateCatchEvent" ||
    type === "bpmn:IntermediateThrowEvent"
  ) {
    return "intermediateEvent";
  }
  if (type.endsWith("Gateway")) return "gateway";
  if (
    type === "bpmn:DataObjectReference" ||
    type === "bpmn:DataStoreReference"
  ) {
    return "data";
  }
  if (
    type.endsWith("Task") ||
    type === "bpmn:CallActivity" ||
    type === "bpmn:SubProcess" ||
    type === "bpmn:Transaction"
  ) {
    return "task";
  }
  return undefined;
}

/**
 * Wechselziele für ein Element — **ohne** den eigenen Ist-Zustand.
 *
 * Die Regelfrage („darf dieses Element überhaupt zu jenem Typ werden?") stellt
 * der Aufrufer über `rules.allowed("shape.replace", …)`; hier steht nur, was
 * fachlich sinnvoll angeboten wird.
 */
export function replaceOptionsFor(element: BpmnShape): ReplaceOption[] {
  const bo = element.businessObject as ModdleElement | undefined;
  const type = (bo?.$type ?? element.type ?? "") as string;
  const family = replaceFamilyOf(type);
  if (!family) return [];
  const options = REPLACE_FAMILIES[family] ?? [];
  const currentDefinition = eventDefinitionTypeOf(bo);
  return options.filter(
    (option) =>
      !(
        option.type === type &&
        (option.eventDefinitionType ?? undefined) === currentDefinition
      ),
  );
}

/** `bpmn:TimerEventDefinition` des Elements, falls es eine hat. */
export function eventDefinitionTypeOf(
  bo: ModdleElement | undefined,
): string | undefined {
  const definitions = bo?.["eventDefinitions"];
  if (!Array.isArray(definitions) || definitions.length === 0) return undefined;
  const first = definitions[0] as { $type?: unknown } | undefined;
  return typeof first?.$type === "string" ? first.$type : undefined;
}
