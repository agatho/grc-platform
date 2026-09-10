/**
 * Schemaprüfung über den **Rohtext** einer BPMN-Datei.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-043] `STUFE2-A1-MODELING.md` §7.11 hält fest:
 * „Die Invarianten prüfen Referenzintegrität, nicht Schemakonformität. Ein
 * Attribut mit falschem Typ (`cancelActivity="ja"`) fällt hier nicht auf."
 *
 * **Warum das schlimmer ist, als es klingt — gemessen.** `bpmn-moddle` liest
 * `cancelActivity="ja"` und legt `false` ins Modell. Ohne Warnung. Beim
 * Speichern steht dann `cancelActivity="false"` in der Datei. `false` heißt
 * auf einem Randereignis „nicht unterbrechend"; die Vorgabe des Schemas ist
 * `true`. Aus einem Tippfehler wird also eine **stille Umdeutung des
 * Prozesses**: Ein Randereignis, das den Vorgang abbrechen sollte, läuft
 * danach nebenher weiter — und die Datei, die das behauptet, hat ARCTOS
 * geschrieben. Dasselbe gilt für `isInterrupting`, `isExecutable`,
 * `isCollection`, `parallelMultiple` und jedes andere `Boolean`.
 *
 * Nachvollzogen mit `bpmn-moddle@10`:
 *
 * ```
 * <bpmn:boundaryEvent id="B" attachedToRef="T" cancelActivity="ja"/>
 *   → { cancelActivity: false }, warnings: []
 *   → Export: cancelActivity="false"
 * ```
 *
 * **Deshalb prüft diese Datei den Text und nicht den Baum.** Im Moment, in dem
 * ein Modell existiert, ist die Information schon weg: `"ja"` ist zu `false`
 * geworden und von einem echten `false` nicht mehr unterscheidbar. Eine
 * Schemaprüfung, die auf dem geparsten Modell arbeitet, kann diesen Fehler
 * grundsätzlich nicht finden.
 *
 * **Was hier geprüft wird — und was nicht.** Ein vollständiger XSD-Lauf gegen
 * `BPMN20.xsd` bräuchte einen XSD-Prozessor; keiner der im Baum vorhandenen
 * ist einer, und einen mitzubringen hieße, eine Abhängigkeit für einen
 * Prüfschritt aufzunehmen. Stattdessen wird das Schema benutzt, das ohnehin da
 * ist: das **Metamodell von `bpmn-moddle`** ist die maschinenlesbare Form
 * derselben Deklarationen — Typen, Attribute, Vorgabewerte, Referenzen.
 * Geprüft werden damit:
 *
 *  1. **Lexikalische Attributtypen.** `Boolean`, `Integer`, `Real` gegen die
 *     Schreibweisen, die XML Schema Part 2 zulässt (`xsd:boolean` erlaubt
 *     `true`/`false`/`1`/`0` und nichts sonst).
 *  2. **Unbekannte Attribute** an bekannten Typen, sofern sie im BPMN-, DI-,
 *     DC- oder BPMNDI-Namensraum stehen. Fremde Namensräume sind ausdrücklich
 *     erlaubt (Camunda, Signavio, `arctos:`) und werden nicht gemeldet — das
 *     Bewahren fremder Erweiterungen ist eine Zusage dieser Schicht.
 *  3. **Unbekannte Elemente** in denselben Namensräumen.
 *  4. **Leere Pflichtkennungen**: ein `id`-Attribut, das leer ist, ist kein
 *     `xsd:ID`.
 *
 * **Nicht** geprüft: Inhaltsmodelle (welche Kinder in welcher Reihenfolge),
 * Kardinalitäten und die Regeln, die BPMN 2.0 im Fließtext statt im Schema
 * formuliert. Wer das braucht, braucht einen XSD-Prozessor; dieser Prüfer sagt
 * ausdrücklich nicht, dass eine Datei ohne Befund schemakonform *ist*.
 */

import { arctosModdle } from "../model/moddle";

/** Namensräume, für die diese Prüfung zuständig ist. */
export const SCHEMA_NAMESPACES: readonly string[] = [
  "http://www.omg.org/spec/BPMN/20100524/MODEL",
  "http://www.omg.org/spec/BPMN/20100524/DI",
  "http://www.omg.org/spec/DD/20100524/DC",
  "http://www.omg.org/spec/DD/20100524/DI",
];

export type SchemaFindingKind =
  "attribute-type" | "unknown-attribute" | "unknown-element" | "empty-id";

export interface SchemaFinding {
  readonly kind: SchemaFindingKind;
  /** Qualifizierter Elementname, wie er im Dokument steht. */
  readonly element: string;
  /** `id` des Elements, wenn es eine trägt — sonst `undefined`. */
  readonly elementId?: string;
  readonly attribute?: string;
  readonly value?: string;
  /** Der deklarierte Typ, gegen den geprüft wurde. */
  readonly expected?: string;
  /** 1-basierte Zeile im Dokument. */
  readonly line: number;
  readonly detail: string;
}

interface PropertyDescriptor {
  readonly name: string;
  readonly type: string;
  readonly isAttr?: boolean;
  readonly isReference?: boolean;
}

interface TypeDescriptor {
  readonly properties: readonly PropertyDescriptor[];
}

interface Registry {
  getPackages(): readonly { prefix: string; uri: string }[];
}

/**
 * `xsd:boolean` — genau vier Schreibweisen. `"ja"`, `"yes"`, `"True"` und `""`
 * sind keine davon.
 */
const XSD_BOOLEAN = /^(?:true|false|1|0)$/;
/** `xsd:integer` — Vorzeichen und Ziffern, kein Exponent, kein Punkt. */
const XSD_INTEGER = /^[+-]?\d+$/;
/** `xsd:double`/`xsd:decimal` — Dezimalpunkt und Exponent erlaubt. */
const XSD_REAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
/** `xsd:ID`/`xsd:IDREF` sind NCNames: kein Doppelpunkt, kein führender Ziffer. */
const XSD_NCNAME = /^[A-Za-z_][\w.-]*$/;

/**
 * Öffnende, selbstschließende und schließende Tags in einem Durchlauf.
 *
 * Die drei zusammen sind nötig, weil ein Elementname allein nicht entscheidbar
 * ist: `<bpmn:incoming>` ist **kein Typ**, sondern eine Eigenschaft von
 * `bpmn:FlowNode`, und `<di:waypoint>` eine von `bpmndi:BPMNEdge`. Ohne den
 * Elternstapel meldete der Prüfer jede zweite Zeile eines gültigen Dokuments
 * als unbekanntes Element — gemessen: 10 Befunde allein in
 * `synth-without-di-section`, sämtlich falsch.
 */
const TAG =
  /<(\/)?([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)((?:\s+[^<>]*?)?)(\/)?>/g;
const ATTRIBUTE = /([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)\s*=\s*"([^"]*)"/g;
const COMMENT_OR_PI =
  /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>/g;

function lineOf(xml: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < xml.length; i += 1) {
    if (xml.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

/** Präfix → Namensraum aus den `xmlns:`-Deklarationen des Dokuments. */
function namespaceBindings(xml: string): Map<string, string> {
  const bindings = new Map<string, string>();
  const pattern = /xmlns(?::([A-Za-z_][\w.-]*))?\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    bindings.set(match[1] ?? "", match[2] ?? "");
  }
  return bindings;
}

/** Namensraum → moddle-Präfix (`bpmn`, `bpmndi`, `dc`, `di`, `arctos`, …). */
function moddlePrefixes(): Map<string, string> {
  const registry = (arctosModdle as unknown as { registry: Registry }).registry;
  const out = new Map<string, string>();
  for (const pkg of registry.getPackages()) out.set(pkg.uri, pkg.prefix);
  return out;
}

function descriptorFor(qualified: string): TypeDescriptor | undefined {
  try {
    const type = arctosModdle.getType(qualified) as
      { $descriptor?: TypeDescriptor } | undefined;
    return type?.$descriptor;
  } catch {
    // `getType` wirft für einen unbekannten Namen. Das ist hier kein Fehler,
    // sondern die Antwort „kenne ich nicht" — und die wird oben ausgewertet.
    return undefined;
  }
}

/**
 * Der moddle-Typname zu einem Dokument-Tag, oder `undefined`, wenn das Tag in
 * keinem der geprüften Namensräume steht.
 *
 * BPMN schreibt Elementnamen klein (`<bpmn:boundaryEvent>`), die Typen heißen
 * groß (`bpmn:BoundaryEvent`) — dieselbe Umschrift, die `bpmn-moddle` beim
 * Lesen macht.
 */
function typeNameOf(
  tag: string,
  bindings: ReadonlyMap<string, string>,
  prefixes: ReadonlyMap<string, string>,
): { qualified: string; known: boolean } | undefined {
  const colon = tag.indexOf(":");
  const prefix = colon === -1 ? "" : tag.slice(0, colon);
  const local = colon === -1 ? tag : tag.slice(colon + 1);
  const uri = bindings.get(prefix);
  if (!uri || !SCHEMA_NAMESPACES.includes(uri)) return undefined;
  const moddlePrefix = prefixes.get(uri);
  if (!moddlePrefix) return undefined;
  const qualified = `${moddlePrefix}:${local.charAt(0).toUpperCase()}${local.slice(1)}`;
  return { qualified, known: descriptorFor(qualified) !== undefined };
}

/** Ist `tag` eine im Metamodell deklarierte Eigenschaft von `parentType`? */
function isDeclaredProperty(
  parentType: string | undefined,
  tag: string,
): boolean {
  if (!parentType) return false;
  const descriptor = descriptorFor(parentType);
  if (!descriptor) return false;
  const local = tag.includes(":") ? tag.slice(tag.indexOf(":") + 1) : tag;
  return descriptor.properties.some((property) => {
    const name = property.name.includes(":")
      ? property.name.slice(property.name.indexOf(":") + 1)
      : property.name;
    return name === local;
  });
}

function lexicallyValid(type: string, value: string): boolean {
  switch (type) {
    case "Boolean":
      return XSD_BOOLEAN.test(value);
    case "Integer":
      return XSD_INTEGER.test(value);
    case "Real":
      return XSD_REAL.test(value);
    default:
      return true;
  }
}

/**
 * Prüft ein BPMN-Dokument gegen das Metamodell.
 *
 * Liefert die Befunde in Dokumentreihenfolge. Eine leere Liste heißt „kein
 * Befund dieser vier Arten" — siehe die Einschränkung im Dateikopf.
 */
export function checkSchema(xml: string): SchemaFinding[] {
  const findings: SchemaFinding[] = [];
  const bindings = namespaceBindings(xml);
  const prefixes = moddlePrefixes();

  // Kommentare, PIs und CDATA durch Leerzeichen gleicher Länge ersetzen: so
  // bleiben alle Zeilennummern und Offsets stehen, und ein `<task>` in einem
  // Kommentar wird nicht als Element gelesen.
  const scannable = xml.replace(COMMENT_OR_PI, (block) =>
    block.replace(/[^\n]/g, " "),
  );

  TAG.lastIndex = 0;
  let tagMatch: RegExpExecArray | null;
  /** Die offenen Elemente, jeweils mit ihrem moddle-Typnamen (falls bekannt). */
  const stack: (string | undefined)[] = [];
  while ((tagMatch = TAG.exec(scannable)) !== null) {
    const closing = tagMatch[1] === "/";
    const tag = tagMatch[2] ?? "";
    const attributeBlock = tagMatch[3] ?? "";
    const selfClosing = tagMatch[4] === "/";
    if (closing) {
      stack.pop();
      continue;
    }
    const line = lineOf(scannable, tagMatch.index);
    const resolved = typeNameOf(tag, bindings, prefixes);
    const parentType = stack[stack.length - 1];
    if (!selfClosing)
      stack.push(resolved?.known ? resolved.qualified : undefined);
    if (!resolved) continue;

    const attributes = new Map<string, string>();
    ATTRIBUTE.lastIndex = 0;
    let attributeMatch: RegExpExecArray | null;
    while ((attributeMatch = ATTRIBUTE.exec(attributeBlock)) !== null) {
      attributes.set(attributeMatch[1] ?? "", attributeMatch[2] ?? "");
    }
    const elementId = attributes.get("id");

    if (!resolved.known) {
      // Zweiter Anlauf: Elementnamen sind in BPMN nicht nur Typen, sondern
      // auch **Eigenschaften** ihres Elternelements — `<bpmn:incoming>` ist
      // eine Eigenschaft von `bpmn:FlowNode`, `<di:waypoint>` eine von
      // `bpmndi:BPMNEdge`. Beide stehen im Metamodell, nur an anderer Stelle.
      if (isDeclaredProperty(parentType, tag)) continue;
      findings.push({
        kind: "unknown-element",
        element: tag,
        ...(elementId === undefined ? {} : { elementId }),
        line,
        detail:
          `<${tag}> steht im BPMN-Namensraum, ist dort aber nicht deklariert ` +
          `(gesucht als ${resolved.qualified}).`,
      });
      continue;
    }

    const descriptor = descriptorFor(resolved.qualified);
    const byName = new Map<string, PropertyDescriptor>();
    for (const property of descriptor?.properties ?? []) {
      if (property.isAttr !== true) continue;
      const local = property.name.includes(":")
        ? property.name.slice(property.name.indexOf(":") + 1)
        : property.name;
      byName.set(local, property);
    }

    for (const [name, value] of attributes) {
      if (name === "xmlns" || name.startsWith("xmlns:")) continue;
      if (name.includes(":")) {
        // Fremdattribut (`camunda:assignee`, `xsi:type`, …). Bewusst nicht
        // geprüft: fremde Vokabulare bleiben unangetastet, und ihr Schema
        // kennt diese Schicht nicht.
        continue;
      }
      const property = byName.get(name);
      if (!property) {
        findings.push({
          kind: "unknown-attribute",
          element: tag,
          ...(elementId === undefined ? {} : { elementId }),
          attribute: name,
          value,
          line,
          detail: `${resolved.qualified} kennt kein Attribut "${name}".`,
        });
        continue;
      }
      if (name === "id" && value.trim() === "") {
        findings.push({
          kind: "empty-id",
          element: tag,
          attribute: name,
          value,
          line,
          detail: `<${tag}> trägt eine leere id; xsd:ID lässt das nicht zu.`,
        });
        continue;
      }
      if (!lexicallyValid(property.type, value)) {
        findings.push({
          kind: "attribute-type",
          element: tag,
          ...(elementId === undefined ? {} : { elementId }),
          attribute: name,
          value,
          expected: property.type,
          line,
          detail:
            `${resolved.qualified}/@${name} ist als ${property.type} deklariert, ` +
            `im Dokument steht "${value}". ` +
            (property.type === "Boolean"
              ? "bpmn-moddle liest daraus stillschweigend `false` und schreibt " +
                "es beim nächsten Speichern zurück — der Wert wird also nicht " +
                "verworfen, sondern umgedeutet."
              : "Der Wert wird beim Lesen verworfen oder umgedeutet."),
        });
        continue;
      }
      if (
        property.isReference === true &&
        value !== "" &&
        !XSD_NCNAME.test(value)
      ) {
        findings.push({
          kind: "attribute-type",
          element: tag,
          ...(elementId === undefined ? {} : { elementId }),
          attribute: name,
          value,
          expected: "IDREF",
          line,
          detail:
            `${resolved.qualified}/@${name} ist eine Referenz und muss ein ` +
            `NCName sein; "${value}" ist keiner.`,
        });
      }
    }
  }
  return findings;
}

/** Eine Zeile je Befund, in der Form, die ein Prüfbericht braucht. */
export function formatSchemaFindings(
  findings: readonly SchemaFinding[],
): string {
  return findings
    .map(
      (finding) =>
        `  Zeile ${finding.line}  [${finding.kind}] ${finding.element}` +
        (finding.elementId ? `#${finding.elementId}` : "") +
        (finding.attribute ? `/@${finding.attribute}` : "") +
        `\n      ${finding.detail}`,
    )
    .join("\n");
}
