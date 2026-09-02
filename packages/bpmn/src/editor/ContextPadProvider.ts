/// <reference lib="dom" />

/**
 * Das Kontextmenü am Element (ContextPad).
 *
 * Angeboten wird, was **an dieser Stelle** naheliegt — und nur, was die Regeln
 * an dieser Stelle auch zulassen. Ein Menüeintrag, der beim Anklicken „geht
 * nicht" sagt, ist schlechter als ein fehlender Eintrag: er kostet einen
 * Bedienschritt und lehrt den Benutzer, dem Menü nicht zu trauen. Deshalb wird
 * `rules.allowed(…)` **beim Aufbau** gefragt, nicht erst beim Auslösen.
 *
 * Die Einträge sind echte `<button>` mit `aria-label` — der Rahmen von
 * `diagram-js` erzeugt sonst `<div class="entry">` mit `title`, was mit der
 * Maus funktioniert und mit der Tastatur nicht. Der Rahmen sieht `entry.html`
 * genau dafür vor.
 */

import type { EditorAnnouncer } from "./announce";
import type { EditorConfiguration } from "./config";
import type { ConnectMode } from "./ConnectMode";
import type { BpmnCopyPaste } from "./CopyPaste";
import type { AlignDistribute } from "./AlignDistribute";
import type { BendpointEditing } from "./BendpointEditing";
import type { ElementCreation } from "./ElementCreation";
import type { LabelEditing } from "./LabelEditing";
import type { ReplaceMenu } from "./ReplaceMenu";
import { describe } from "./ElementCreation";
import { escapeHtml } from "./dom";
import type { ProbeFactory } from "./probe";
import { boOf, is, isAny } from "../modeling/util";
import type {
  BpmnConnection,
  BpmnElement,
  BpmnShape,
  ModelingLike,
  PaletteItem,
  RulesLike,
  SelectionLike,
} from "./types";

interface ContextPadLike {
  registerProvider(provider: unknown): void;
  close(): void;
}

interface InjectorLike {
  get<T>(name: string, strict?: boolean): T | null;
}

type EntryAction = (
  event: Event,
  target: BpmnElement | BpmnElement[],
  autoActivate: boolean,
) => unknown;

interface ContextPadEntry {
  action: Record<string, EntryAction>;
  className?: string;
  group?: string;
  html?: string;
  title?: string;
}

/** Zusätzliche Einträge, die es in der Palette nicht gibt. */
const BOUNDARY_ITEM: PaletteItem = {
  id: "append.boundary-event",
  type: "bpmn:BoundaryEvent",
  title: "Randereignis",
  group: "ereignisse",
  eventDefinitionType: "bpmn:TimerEventDefinition",
  description: "Störung oder Frist am Rand der Aktivität",
};

const ANNOTATION_ITEM: PaletteItem = {
  id: "append.text-annotation",
  type: "bpmn:TextAnnotation",
  title: "Anmerkung",
  group: "artefakte",
  description: "Hinweis, mit dem Element verbunden",
};

/** Die drei Anhänger, die im Ablauf am häufigsten folgen. */
const APPEND_IDS = [
  "create.task",
  "create.exclusive-gateway",
  "create.end-event",
] as const;

export class ArctosContextPadProvider {
  static $inject = [
    "contextPad",
    "injector",
    "modeling",
    "rules",
    "selection",
    "editorConfig",
    "editorAnnouncer",
    "probeFactory",
  ];

  constructor(
    private readonly contextPad: ContextPadLike,
    private readonly injector: InjectorLike,
    private readonly modeling: ModelingLike,
    private readonly rules: RulesLike,
    private readonly selection: SelectionLike,
    private readonly config: EditorConfiguration,
    private readonly announcer: EditorAnnouncer,
    private readonly probes: ProbeFactory,
  ) {
    contextPad.registerProvider(this);
  }

  // -------------------------------------------------------------------------

  getContextPadEntries(element: BpmnElement): Record<string, ContextPadEntry> {
    if (!this.config.editable) return {};
    const entries: Record<string, ContextPadEntry> = {};
    const shape = element as BpmnShape;
    if (shape.labelTarget !== undefined) return {};

    const isConnection = Array.isArray((element as BpmnConnection).waypoints);

    // -- beschriften ------------------------------------------------------
    const labelEditing = this.injector.get<LabelEditing>("labelEditing", false);
    if (labelEditing?.canEdit(element)) {
      entries["edit.label"] = this.entry(
        "Beschriftung bearbeiten (F2)",
        "bearbeiten",
        "bpmn-icon-screw-wrench",
        () => {
          this.contextPad.close();
          labelEditing.activate(element);
        },
      );
    }

    if (!isConnection) {
      // -- verbinden ------------------------------------------------------
      const connectMode = this.injector.get<ConnectMode>("connectMode", false);
      if (connectMode) {
        entries["connect"] = this.entry(
          "Verbinden (Taste C)",
          "verbinden",
          "bpmn-icon-connection-multi",
          () => {
            this.contextPad.close();
            connectMode.start(element);
          },
        );
      }

      // -- anhängen -------------------------------------------------------
      const creation = this.injector.get<ElementCreation>(
        "elementCreation",
        false,
      );
      if (creation) {
        for (const id of APPEND_IDS) {
          const item = this.config.paletteItems.find(
            (candidate) => candidate.id === id,
          );
          if (!item) continue;
          if (!this.canAppend(shape, item)) continue;
          entries[`append.${id}`] = this.entry(
            `${item.title} anhängen`,
            "anfuegen",
            item.className ?? "",
            () => {
              this.contextPad.close();
              creation.append(shape, item);
            },
          );
        }
        if (this.canAppend(shape, ANNOTATION_ITEM)) {
          entries["append.text-annotation"] = this.entry(
            "Anmerkung anfügen",
            "anfuegen",
            "bpmn-icon-text-annotation",
            () => {
              this.contextPad.close();
              creation.append(shape, ANNOTATION_ITEM);
            },
          );
        }
        if (
          this.rules.allowed("shape.attach", {
            shape: this.probes.shape("bpmn:BoundaryEvent"),
            target: shape,
          }) === "attach"
        ) {
          entries["attach.boundary"] = this.entry(
            "Randereignis anheften",
            "anfuegen",
            "bpmn-icon-intermediate-event-catch-timer",
            () => {
              this.contextPad.close();
              creation.attachBoundary(shape, BOUNDARY_ITEM);
            },
          );
        }
      }

      // -- Typ wechseln ---------------------------------------------------
      const replaceMenu = this.injector.get<ReplaceMenu>("replaceMenu", false);
      if (replaceMenu && replaceMenu.optionsFor(shape).length > 0) {
        entries["replace"] = this.entry(
          "Typ wechseln (Taste R)",
          "bearbeiten",
          "bpmn-icon-screw-wrench",
          () => {
            this.contextPad.close();
            replaceMenu.openFor(shape);
          },
        );
      }

      // -- Lanes ----------------------------------------------------------
      if (isAny(boOf(shape), ["bpmn:Participant", "bpmn:Lane"])) {
        entries["lane.add.below"] = this.entry(
          "Lane darunter einfügen",
          "struktur",
          "bpmn-icon-lane-insert-below",
          () => {
            this.contextPad.close();
            this.modeling.addLane(shape, "bottom");
            this.announcer.announce(
              `Lane unterhalb von ${describe(shape)} eingefügt.`,
            );
          },
        );
        if (is(boOf(shape), "bpmn:Lane")) {
          entries["lane.remove"] = this.entry(
            "Lane entfernen",
            "struktur",
            "bpmn-icon-lane-divide-two",
            () => {
              this.contextPad.close();
              this.modeling.removeLane(shape);
              this.announcer.announce("Lane entfernt.");
            },
          );
        }
      }
    } else {
      // -- Kanten ---------------------------------------------------------
      const bendpoints = this.injector.get<BendpointEditing>(
        "bendpointEditing",
        false,
      );
      const connection = element as BpmnConnection;
      if (bendpoints) {
        entries["bendpoint.add"] = this.entry(
          "Stützpunkt setzen (Taste B)",
          "bearbeiten",
          "bpmn-icon-connection",
          () => {
            this.contextPad.close();
            bendpoints.add(connection);
          },
        );
      }
      const connectMode = this.injector.get<ConnectMode>("connectMode", false);
      if (connectMode) {
        entries["reconnect.start"] = this.entry(
          "Anfang der Kante umhängen",
          "verbinden",
          "bpmn-icon-connection-multi",
          () => {
            this.contextPad.close();
            connectMode.startReconnect(connection, "source");
          },
        );
        entries["reconnect.end"] = this.entry(
          "Ende der Kante umhängen",
          "verbinden",
          "bpmn-icon-connection-multi",
          () => {
            this.contextPad.close();
            connectMode.startReconnect(connection, "target");
          },
        );
      }
    }

    // -- löschen ----------------------------------------------------------
    if (this.canDelete([element])) {
      entries["delete"] = this.entry(
        "Löschen (Entf)",
        "entfernen",
        "bpmn-icon-trash",
        () => {
          this.contextPad.close();
          this.remove([element]);
        },
      );
    }

    return entries;
  }

  getMultiElementContextPadEntries(
    elements: BpmnElement[],
  ): Record<string, ContextPadEntry> {
    if (!this.config.editable) return {};
    const entries: Record<string, ContextPadEntry> = {};
    const align = this.injector.get<AlignDistribute>("alignDistribute", false);
    if (align) {
      const alignments: ReadonlyArray<[string, string]> = [
        ["left", "Links ausrichten"],
        ["center", "Waagerecht mittig ausrichten"],
        ["right", "Rechts ausrichten"],
        ["top", "Oben ausrichten"],
        ["middle", "Senkrecht mittig ausrichten"],
        ["bottom", "Unten ausrichten"],
      ];
      for (const [id, title] of alignments) {
        entries[`align.${id}`] = this.entry(
          title,
          "ausrichten",
          `bpmn-icon-align-${id}`,
          () => {
            this.contextPad.close();
            align.align(id as never, elements);
          },
        );
      }
      entries["distribute.horizontal"] = this.entry(
        "Waagerecht gleichmäßig verteilen",
        "ausrichten",
        "bpmn-icon-distribute-horizontal",
        () => {
          this.contextPad.close();
          align.distribute("horizontal", elements);
        },
      );
      entries["distribute.vertical"] = this.entry(
        "Senkrecht gleichmäßig verteilen",
        "ausrichten",
        "bpmn-icon-distribute-vertical",
        () => {
          this.contextPad.close();
          align.distribute("vertical", elements);
        },
      );
    }

    const copyPaste = this.injector.get<BpmnCopyPaste>("bpmnCopyPaste", false);
    if (copyPaste) {
      entries["copy"] = this.entry(
        "Kopieren (Strg+C)",
        "bearbeiten",
        "bpmn-icon-copy",
        () => {
          this.contextPad.close();
          copyPaste.copy(elements);
        },
      );
    }

    if (this.canDelete(elements)) {
      entries["delete"] = this.entry(
        "Auswahl löschen (Entf)",
        "entfernen",
        "bpmn-icon-trash",
        () => {
          this.contextPad.close();
          this.remove(elements);
        },
      );
    }
    return entries;
  }

  // -------------------------------------------------------------------------

  /** Löschen samt Ansage — der eine Weg, den auch die Tastatur benutzt. */
  remove(elements: readonly BpmnElement[]): void {
    const removable = this.removable(elements);
    if (removable.length === 0) {
      this.announcer.reject("Es lässt sich nichts löschen.");
      return;
    }
    const names = removable.map(describe).join(", ");
    this.modeling.removeElements([...removable]);
    this.selection.select(null);
    this.announcer.announce(`${names} gelöscht. Rückgängig mit Strg und Z.`);
  }

  canDelete(elements: readonly BpmnElement[]): boolean {
    return this.removable(elements).length > 0;
  }

  private removable(elements: readonly BpmnElement[]): BpmnElement[] {
    const allowed = this.rules.allowed("elements.delete", {
      elements: [...elements],
    });
    if (Array.isArray(allowed)) return allowed as BpmnElement[];
    return allowed === true ? [...elements] : [];
  }

  private canAppend(source: BpmnShape, item: PaletteItem): boolean {
    const target = this.probes.shapeIn(item.type, source.parent);
    const result = this.rules.allowed("connection.create", { source, target });
    if (result === true) return true;
    return (
      typeof result === "object" &&
      result !== null &&
      typeof (result as { type?: unknown }).type === "string"
    );
  }

  private entry(
    title: string,
    group: string,
    className: string,
    action: () => void,
  ): ContextPadEntry {
    return {
      group,
      title,
      className,
      html:
        `<button type="button" class="entry" aria-label="${escapeHtml(title)}">` +
        `<span class="djs-context-pad-icon" aria-hidden="true"></span></button>`,
      action: {
        click: (event: Event) => {
          action();
          event.preventDefault();
          event.stopPropagation();
        },
      },
    };
  }
}

export default ArctosContextPadProvider;
