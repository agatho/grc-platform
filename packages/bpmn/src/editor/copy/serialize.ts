/**
 * Kopieren und Einfügen semantischer Objekte.
 *
 * Der Kern des Problems: `diagram-js`' `copy-paste` kopiert den **grafischen**
 * Baum. Der semantische Baum interessiert es nicht — und genau dort steht
 * alles, was ARCTOS an einem Element wertvoll findet: Name, Ereignisdefinition
 * und vor allem `bpmn:extensionElements` mit `arctos:grcMetadata` (Risiken,
 * Kontrollen, RACI, Löschfristen, BCM-Kennzahlen).
 *
 * Zwei Entwurfsentscheidungen, beide nicht offensichtlich:
 *
 * **(1) Zwischenform statt geteilter Objekte.** Beim Kopieren entsteht eine
 * *Abschrift* aus einfachen Werten, kein Verweis auf die moddle-Objekte. Beim
 * Einfügen entstehen daraus neue moddle-Objekte. Würde man die Objekte
 * behalten, hinge das eingefügte Element am `$parent` des Originals; ein Undo
 * ließe dann Teilbäume zurück, die noch im Baum stehen, aber niemandem mehr
 * gehören. `ReplaceShapeHandler` hat genau diesen Fehler schon einmal gehabt
 * (STUFE2-A1 §6b) — dieselbe Falle, andere Stelle.
 *
 * **(2) Verweise werden nicht kopiert, Enthaltenes schon.** `moddle`
 * unterscheidet beides im Deskriptor (`isReference`), und der wird hier
 * gelesen statt geraten. Fehlt er (handgebautes Objekt im Test), greift eine
 * Namensliste als Notnagel. Ein kopiertes `sourceRef` wäre ein Zeiger auf ein
 * Element des Originals — beim Einfügen entstünde eine Kante, die zwei
 * verschiedene Diagramme verbindet.
 *
 * **Was bewusst nicht mitkommt:** die `id`. Sie wird beim Einfügen neu
 * vergeben, weil sie im Dokument eindeutig sein muss. Das ist die eine Stelle,
 * an der ARCTOS' Grundsatz „die ID bleibt" (siehe `shape.replace`) *nicht*
 * gilt: eine Kopie ist ein zweites Element, und zwei Elemente mit derselben ID
 * wären eine unlesbare Datei.
 */

import type { ModdleElement } from "../types";

/** Abschrift eines semantischen Objekts. */
export interface SemanticSnapshot {
  readonly type: string;
  readonly attrs: Readonly<Record<string, unknown>>;
  readonly children: Readonly<Record<string, readonly SemanticSnapshot[]>>;
  /** Unbekannte Attribute, die `moddle` wörtlich behalten hat. */
  readonly extraAttrs?: Readonly<Record<string, unknown>> | undefined;
  /**
   * Elemente einer **nicht registrierten** Erweiterung (Camunda, Signavio, …).
   *
   * `moddle` legt sie als generische Objekte ab: kein Deskriptor mit
   * Eigenschaften, statt dessen `$children` und `$body`. Sie zu überspringen
   * wäre stiller Datenverlust genau der Art, die Plan §5.3 verbietet — eine
   * kopierte Aufgabe verlöre ihre Camunda-Konfiguration, und das fiele erst im
   * Betrieb auf.
   */
  readonly generic?: boolean | undefined;
  /** Namensraum eines generischen Elements — `createAny` braucht ihn. */
  readonly nsUri?: string | undefined;
  /** Textinhalt eines generischen Elements. */
  readonly body?: string | undefined;
  /** Kindelemente eines generischen Elements. */
  readonly anyChildren?: readonly SemanticSnapshot[] | undefined;
}

/**
 * Eigenschaften, die nie in eine Kopie gehören: Identität, Struktur,
 * Grafikbezug und die beidseitig gepflegten Flusslisten.
 */
const NEVER_COPIED: ReadonlySet<string> = new Set([
  "id",
  "$type",
  "$parent",
  "$instanceOf",
  "$descriptor",
  "di",
  "incoming",
  "outgoing",
  "flowElements",
  "artifacts",
  "laneSets",
  "lanes",
  "childLaneSet",
  "flowNodeRef",
  "participants",
  "messageFlows",
  "sourceRef",
  "targetRef",
  "attachedToRef",
  "default",
  "processRef",
  "categoryValueRef",
  "dataInputAssociations",
  "dataOutputAssociations",
  "ioSpecification",
  "calledElement",
  "eventDefinitionRef",
]);

interface Descriptor {
  isGeneric?: boolean;
  ns?: { uri?: string };
  properties?: Array<{
    name?: string;
    isReference?: boolean;
    isMany?: boolean;
  }>;
}

/** Ist diese Eigenschaft laut Metamodell ein Verweis? */
function isReferenceProperty(bo: ModdleElement, name: string): boolean {
  const descriptor = (bo as { $descriptor?: Descriptor }).$descriptor;
  const property = descriptor?.properties?.find((entry) => entry.name === name);
  if (property) return property.isReference === true;
  // Notnagel für Objekte ohne Deskriptor: Namenskonvention von BPMN.
  return name.endsWith("Ref") || name.endsWith("Refs");
}

function isModdle(value: unknown): value is ModdleElement {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { $type?: unknown }).$type === "string"
  );
}

function descriptorOf(bo: ModdleElement): Descriptor | undefined {
  return (bo as { $descriptor?: Descriptor }).$descriptor;
}

/**
 * Erstellt die Abschrift eines semantischen Objekts.
 *
 * `root` unterscheidet die **Identität** des kopierten Elements von der
 * **Nutzlast** darunter. Das ist keine Feinheit: `arctos:riskRef/@id` ist ein
 * Fremdschlüssel in die ARCTOS-Datenbank („Risiko 4711"), nicht die Kennung
 * eines Diagrammelements. Würde er wie die Element-`id` verworfen, verlöre eine
 * kopierte Aufgabe genau die Verknüpfung, deretwegen die Kopie GRC-Daten
 * überhaupt mitnimmt — und der Verlust wäre stumm.
 */
export function snapshotOf(bo: ModdleElement, root = true): SemanticSnapshot {
  const descriptor = descriptorOf(bo);
  if (descriptor?.isGeneric === true) {
    return snapshotOfGeneric(bo, descriptor);
  }
  const attrs: Record<string, unknown> = {};
  const children: Record<string, SemanticSnapshot[]> = {};

  for (const [name, value] of Object.entries(bo)) {
    if (name === "id" ? root : NEVER_COPIED.has(name)) continue;
    if (name.startsWith("$")) continue;
    if (isReferenceProperty(bo, name)) continue;

    if (isModdle(value)) {
      children[name] = [snapshotOf(value, false)];
      continue;
    }
    if (Array.isArray(value)) {
      const nested = value.filter(isModdle);
      if (nested.length === value.length && nested.length > 0) {
        children[name] = nested.map((entry) => snapshotOf(entry, false));
      } else if (nested.length === 0) {
        attrs[name] = value.map((entry) => entry as unknown);
      }
      continue;
    }
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      attrs[name] = value;
    }
  }

  const extra = (bo as { $attrs?: Record<string, unknown> }).$attrs;
  const extraAttrs =
    extra && typeof extra === "object"
      ? Object.fromEntries(
          Object.entries(extra).filter(([name]) => name !== "id"),
        )
      : undefined;

  return { type: bo.$type, attrs, children, extraAttrs };
}

/** Abschrift eines generischen (nicht registrierten) Elements. */
function snapshotOfGeneric(
  bo: ModdleElement,
  descriptor: Descriptor,
): SemanticSnapshot {
  const attrs: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(bo)) {
    if (name.startsWith("$")) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      attrs[name] = value;
    }
  }
  const children = (bo as { $children?: unknown }).$children;
  const body = (bo as { $body?: unknown }).$body;
  const extra = (bo as { $attrs?: Record<string, unknown> }).$attrs;
  return {
    type: bo.$type,
    attrs,
    children: {},
    generic: true,
    nsUri: descriptor.ns?.uri ?? "",
    ...(typeof body === "string" ? { body } : {}),
    ...(Array.isArray(children)
      ? {
          anyChildren: children
            .filter(isModdle)
            .map((child) => snapshotOf(child, false)),
        }
      : {}),
    ...(extra && typeof extra === "object" ? { extraAttrs: { ...extra } } : {}),
  };
}

export interface FactoryLike {
  create(
    type: string,
    attrs?: Record<string, unknown>,
    options?: { parent?: ModdleElement; id?: string },
  ): ModdleElement;
  /** Zugang zu `moddle.createAny` für generische Elemente. */
  readonly moddle?: {
    create(type: string, properties?: Record<string, unknown>): ModdleElement;
    createAny(
      name: string,
      nsUri: string,
      properties?: Record<string, unknown>,
    ): ModdleElement;
  };
}

/**
 * Baut aus einer Abschrift neue moddle-Objekte.
 *
 * Die IDs vergibt die Fabrik (`BpmnFactory` zählt über das **ganze** Dokument,
 * `src/modeling/ids.ts`); `$parent` wird gesetzt, sobald der Container bekannt
 * ist — beides Bedingungen des Invariantenprüfers.
 */
export function materialize(
  factory: FactoryLike,
  snapshot: SemanticSnapshot,
  parent?: ModdleElement,
): ModdleElement {
  if (snapshot.generic === true) {
    return materializeGeneric(factory, snapshot, parent);
  }
  // Nur das kopierte Element selbst geht über die Elementfabrik und bekommt
  // dort eine frische, dokumentweit freie Kennung. Alles darunter entsteht
  // direkt über `moddle`: Ereignisdefinitionen und GRC-Angaben brauchen keine
  // Diagrammkennung, und ein Fremdschlüssel wie `arctos:riskRef/@id` würde von
  // der Fabrik als bereits vergebene Kennung zurückgewiesen.
  const element = parent
    ? createNested(factory, snapshot, parent)
    : factory.create(snapshot.type, { ...snapshot.attrs });
  for (const [name, entries] of Object.entries(snapshot.children)) {
    const created = entries.map((child) =>
      materialize(factory, child, element),
    );
    element[name] =
      created.length === 1 && !isManyLike(element, name) ? created[0] : created;
  }
  if (snapshot.extraAttrs && Object.keys(snapshot.extraAttrs).length > 0) {
    const existing = (element as { $attrs?: Record<string, unknown> }).$attrs;
    element["$attrs"] = { ...(existing ?? {}), ...snapshot.extraAttrs };
  }
  return element;
}

/**
 * Ein generisches Element neu aufbauen.
 *
 * `moddle.createAny` ist der dafür vorgesehene Weg: Es erzeugt ein Objekt mit
 * dem Deskriptor, den der Schreiber braucht, um es unverändert wieder
 * auszugeben. Ohne `moddle` — etwa in einem Test mit Attrappenfabrik — bleibt
 * das Element weg, statt ein Objekt zu erzeugen, das der Export später
 * stillschweigend verschluckt.
 */
function materializeGeneric(
  factory: FactoryLike,
  snapshot: SemanticSnapshot,
  parent?: ModdleElement,
): ModdleElement {
  const moddle = factory.moddle;
  if (!moddle) {
    throw new Error(
      `Das generische Element ${snapshot.type} lässt sich ohne moddle nicht kopieren.`,
    );
  }
  const element = moddle.createAny(snapshot.type, snapshot.nsUri ?? "", {
    ...snapshot.attrs,
  });
  if (parent) element["$parent"] = parent;
  if (snapshot.body !== undefined) element["$body"] = snapshot.body;
  if (snapshot.extraAttrs && Object.keys(snapshot.extraAttrs).length > 0) {
    element["$attrs"] = { ...snapshot.extraAttrs };
  }
  if (snapshot.anyChildren && snapshot.anyChildren.length > 0) {
    element["$children"] = snapshot.anyChildren.map((child) =>
      materialize(factory, child, element),
    );
  }
  return element;
}

function createNested(
  factory: FactoryLike,
  snapshot: SemanticSnapshot,
  parent: ModdleElement,
): ModdleElement {
  const moddle = factory.moddle;
  const element = moddle
    ? moddle.create(snapshot.type, { ...snapshot.attrs })
    : factory.create(snapshot.type, { ...snapshot.attrs }, { parent });
  element["$parent"] = parent;
  return element;
}

function isManyLike(bo: ModdleElement, name: string): boolean {
  const descriptor = (bo as { $descriptor?: Descriptor }).$descriptor;
  const property = descriptor?.properties?.find((entry) => entry.name === name);
  if (property) return property.isMany === true;
  return name.endsWith("s");
}

/** Trägt die Abschrift GRC-Daten? Wird für die Ansage gebraucht. */
export function hasGrcMetadata(snapshot: SemanticSnapshot): boolean {
  const nested = [
    ...Object.values(snapshot.children).flat(),
    ...(snapshot.anyChildren ?? []),
  ];
  for (const child of nested) {
    if (child.type.startsWith("arctos:")) return true;
    if (hasGrcMetadata(child)) return true;
  }
  return false;
}
