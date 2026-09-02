/// <reference lib="dom" />

/**
 * Kopieren, Ausschneiden, Einfügen, Duplizieren — BPMN-tauglich gemacht.
 *
 * `diagram-js` bringt `features/copy-paste` mit: Baumbildung, Reihenfolge nach
 * Priorität (erst Knoten, dann Anhefter, dann Kanten, dann Beschriftungen),
 * Zwischenablage, direktes Einfügen an einem Punkt. Das alles wird benutzt.
 *
 * Was es **nicht** kann, ist alles Semantische — es kopiert den grafischen
 * Baum. Diese Klasse hängt sich in die zwei dafür vorgesehenen Ereignisse:
 *
 *   `copyPaste.copyElement`  → Abschrift des `businessObject` in den Deskriptor
 *   `copyPaste.pasteElement` → neues `businessObject` aus der Abschrift
 *
 * Damit wandert `arctos:grcMetadata` mit (Auftrag Punkt 6), die ID wird neu
 * vergeben, und die Verweise (`sourceRef`, `attachedToRef`, `flowNodeRef`)
 * werden **nicht** kopiert — die stellt der `BpmnUpdater` beim Einhängen neu
 * her. Warum das so und nicht anders geht, steht in `copy/serialize.ts`.
 *
 * Das Ziel des Einfügens wird über die Regeln bestimmt, nicht geraten: geprüft
 * wird mit Attrappen aus echten moddle-Objekten (die tragen `$instanceOf`, ohne
 * das `canDrop` die Typhierarchie nicht sieht) und **ohne** IDs zu verbrauchen.
 */

import type { EditorAnnouncer } from "./announce.js";
import { describe } from "./ElementCreation.js";
import { hasGrcMetadata, materialize, snapshotOf } from "./copy/serialize.js";
import type { ProbeFactory } from "./probe.js";
import type { SemanticSnapshot } from "./copy/serialize.js";
import type {
  BpmnElement,
  BpmnFactoryLike,
  BpmnParent,
  BpmnShape,
  CanvasLike,
  ClipboardLike,
  CopyPasteLike,
  EventBusLike,
  ModdleElement,
  Point,
  RulesLike,
  SelectionLike,
} from "./types.js";

interface Descriptor {
  id?: string;
  type?: string;
  labelTarget?: unknown;
  waypoints?: unknown;
  businessObject?: ModdleElement;
  semantic?: SemanticSnapshot;
  [key: string]: unknown;
}

export class BpmnCopyPaste {
  static $inject = [
    "eventBus",
    "canvas",
    "copyPaste",
    "clipboard",
    "bpmnFactory",
    "probeFactory",
    "rules",
    "selection",
    "editorAnnouncer",
  ];

  private lastCopyCount = 0;
  private lastCopyHadGrc = false;

  constructor(
    eventBus: EventBusLike,
    private readonly canvas: CanvasLike,
    private readonly copyPaste: CopyPasteLike,
    private readonly clipboard: ClipboardLike,
    private readonly bpmnFactory: BpmnFactoryLike,
    private readonly probes: ProbeFactory,
    private readonly rules: RulesLike,
    private readonly selection: SelectionLike,
    private readonly announcer: EditorAnnouncer,
  ) {
    eventBus.on(
      "copyPaste.copyElement",
      (event: { descriptor?: Descriptor; element?: BpmnElement }) => {
        const { descriptor, element } = event;
        if (!descriptor || !element) return;
        // Beschriftungen tragen das `businessObject` ihres Ziels; eine eigene
        // Abschrift wäre eine zweite Kopie desselben Objekts.
        if ((element as BpmnShape).labelTarget !== undefined) return;
        const bo = element.businessObject;
        if (!bo || typeof bo.$type !== "string") return;
        descriptor.type = element.type ?? bo.$type;
        descriptor.semantic = snapshotOf(bo);
      },
    );

    eventBus.on(
      "copyPaste.pasteElement",
      (event: { descriptor?: Descriptor }) => {
        const descriptor = event.descriptor;
        const snapshot = descriptor?.semantic;
        if (!descriptor || !snapshot) return;
        descriptor.businessObject = materialize(this.bpmnFactory, snapshot);
        delete descriptor.semantic;
      },
    );
  }

  // -------------------------------------------------------------------------

  /** Auswahl in die Zwischenablage. */
  copy(elements?: readonly BpmnElement[]): boolean {
    const chosen = this.resolve(elements);
    if (chosen.length === 0) {
      this.announcer.reject("Es ist nichts ausgewählt.");
      return false;
    }
    this.copyPaste.copy([...chosen]);
    this.lastCopyCount = chosen.length;
    this.lastCopyHadGrc = chosen.some((element) => {
      const bo = element.businessObject;
      return bo ? hasGrcMetadata(snapshotOf(bo)) : false;
    });
    this.announcer.announce(
      `${countLabel(chosen.length)} kopiert${this.lastCopyHadGrc ? ", einschließlich der GRC-Angaben" : ""}.`,
    );
    return true;
  }

  /** Auswahl ausschneiden. */
  cut(elements?: readonly BpmnElement[]): boolean {
    const chosen = this.resolve(elements);
    if (chosen.length === 0) {
      this.announcer.reject("Es ist nichts ausgewählt.");
      return false;
    }
    this.copyPaste.cut([...chosen]);
    this.lastCopyCount = chosen.length;
    this.announcer.announce(`${countLabel(chosen.length)} ausgeschnitten.`);
    return true;
  }

  /**
   * Einfügen an eine Stelle, an der es zulässig ist.
   *
   * Ohne Angabe wird versetzt zur Kopie eingefügt (rechts unten daneben),
   * damit das Eingefügte sichtbar neben dem Original liegt und nicht darunter
   * verschwindet — für einen Tastaturnutzer der Unterschied zwischen
   * „eingefügt" und „verschwunden".
   */
  paste(point?: Point, target?: BpmnParent): BpmnElement[] {
    if (this.clipboard.isEmpty()) {
      this.announcer.reject("Die Zwischenablage ist leer.");
      return [];
    }
    const tree = this.clipboard.get();
    const types = topLevelTypes(tree);
    const where = point ?? this.defaultPastePoint();
    const container = target ?? this.pasteTarget(types, where);
    if (!container) {
      this.announcer.reject(
        "An dieser Stelle lässt sich der Inhalt der Zwischenablage nicht einfügen.",
      );
      return [];
    }
    const pasted = this.copyPaste.paste({ element: container, point: where });
    const created = pasted ?? [];
    if (created.length > 0) {
      this.selection.select(created);
    }
    this.announcer.announce(
      created.length === 0
        ? "Es wurde nichts eingefügt."
        : `${countLabel(created.length)} eingefügt${this.lastCopyHadGrc ? ", GRC-Angaben übernommen" : ""}. Neue Kennungen vergeben.`,
    );
    return created;
  }

  /** Kopieren und sofort einfügen — ohne die Zwischenablage zu verändern. */
  duplicate(elements?: readonly BpmnElement[]): BpmnElement[] {
    const chosen = this.resolve(elements);
    if (chosen.length === 0) {
      this.announcer.reject("Es ist nichts ausgewählt.");
      return [];
    }
    const first = chosen[0];
    const container = first?.parent ?? this.canvas.getRootElement();
    const anchor = boundingMid(chosen);
    const created =
      this.copyPaste.duplicate([...chosen], {
        element: container,
        point: { x: anchor.x + 60, y: anchor.y + 60 },
      }) ?? [];
    if (created.length > 0) this.selection.select(created);
    this.announcer.announce(
      created.length === 0
        ? "Es wurde nichts dupliziert."
        : `${countLabel(created.length)} dupliziert. Neue Kennungen vergeben.`,
    );
    return created;
  }

  /** Anzahl der zuletzt kopierten Elemente — für Tests und Ansagen. */
  copiedCount(): number {
    return this.lastCopyCount;
  }

  // -------------------------------------------------------------------------

  private resolve(elements?: readonly BpmnElement[]): BpmnElement[] {
    const chosen = elements ? [...elements] : this.selection.get();
    return chosen.filter(
      (element) =>
        element.parent !== undefined &&
        (element as BpmnShape).labelTarget === undefined,
    );
  }

  private defaultPastePoint(): Point {
    const viewbox = this.canvas.viewbox();
    return {
      x: Math.round(viewbox.x + viewbox.width / 2),
      y: Math.round(viewbox.y + viewbox.height / 2),
    };
  }

  /**
   * Der Container, der die Zwischenablage aufnehmen darf.
   *
   * Gefragt wird mit Attrappen — echte moddle-Objekte ohne ID, damit die
   * Typhierarchie stimmt und der ID-Zähler nicht für eine Prüfung
   * weiterzählt (er zählt über das ganze Dokument, `src/modeling/ids.ts`, und
   * eine verbrannte ID macht zwei gleiche Bedienfolgen unterscheidbar).
   */
  private pasteTarget(
    types: readonly string[],
    point: Point,
  ): BpmnParent | null {
    const probes = types.map((type) => this.probes.shape(type));
    const selected = this.selection.get()[0];
    const candidates: BpmnParent[] = [];
    const selectedParent = selected?.parent;
    if (selectedParent) candidates.push(selectedParent);
    const root = this.canvas.getRootElement();
    if (!candidates.includes(root)) candidates.push(root);

    for (const candidate of candidates) {
      if (
        this.rules.allowed("elements.create", {
          elements: probes,
          target: candidate,
          position: point,
        }) === true
      ) {
        return candidate;
      }
    }
    return null;
  }
}

export default BpmnCopyPaste;

/** Die Typen der obersten Baumebene der Zwischenablage. */
function topLevelTypes(tree: unknown): string[] {
  if (typeof tree !== "object" || tree === null) return [];
  const branch = (tree as Record<string, unknown>)["0"];
  if (!Array.isArray(branch)) return [];
  return branch
    .map((entry) => (entry as { type?: unknown }).type)
    .filter((type): type is string => typeof type === "string");
}

function countLabel(count: number): string {
  return count === 1 ? "Ein Element" : `${String(count)} Elemente`;
}

function boundingMid(elements: readonly BpmnElement[]): Point {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const element of elements) {
    const shape = element as BpmnShape;
    if (typeof shape.width !== "number") continue;
    minX = Math.min(minX, shape.x);
    minY = Math.min(minY, shape.y);
    maxX = Math.max(maxX, shape.x + shape.width);
    maxY = Math.max(maxY, shape.y + shape.height);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0 };
  return {
    x: Math.round((minX + maxX) / 2),
    y: Math.round((minY + maxY) / 2),
  };
}

/** Nur für Tests: liest die Abschrift eines Elements. */
export function semanticSnapshot(
  element: BpmnElement,
): SemanticSnapshot | null {
  const bo = element.businessObject;
  return bo ? snapshotOf(bo) : null;
}

/** Wird von den Tests gebraucht, um die Attrappenprüfung zu beschreiben. */
export function describeElement(element: BpmnElement): string {
  return describe(element);
}
