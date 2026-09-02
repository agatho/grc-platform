/// <reference lib="dom" />

/**
 * Hörbar machen, was sichtbar ist (Plan §4.2).
 *
 * Der Viewer hat bereits eine `aria-live="polite"`-Statusregion und meldet bei
 * jedem Fokuswechsel einen Satz. Dieser Baustein liefert den *GRC-Teil* dieses
 * Satzes und die Tastenbedienung `.` / `,`, mit der ein Screenreader-Nutzer die
 * Badges des fokussierten Elements einzeln durchgeht.
 *
 * Warum überhaupt eine eigene Bedienung: Die Badges sind bewusst **keine**
 * eigenen Tabstopps. Ein Diagramm mit 40 Aktivitäten und drei Badges je Element
 * hätte sonst 120 zusätzliche Halte — für Tastaturnutzer eine Zumutung. Die
 * Information steht deshalb im zugänglichen Namen (einmal, vollständig), und
 * wer sie einzeln durchgehen will, benutzt `.` und `,`.
 */

import type { GrcInteraction, GrcInteractionHandler } from "./contract.js";
import type { GrcOverlayModel } from "./engine.js";
import { SLOT_ORDER } from "./slots.js";

export interface GrcBadgeEntry {
  readonly layerId: string;
  readonly layerTitle: string;
  readonly slot: string;
  readonly text: string;
  readonly describe: string;
  readonly interaction: GrcInteraction;
}

/** Alle Badges eines Elements in fester Reihenfolge (TL, TR, BL, BR, Sammel). */
export function badgesOf(
  model: GrcOverlayModel,
  elementId: string,
): readonly GrcBadgeEntry[] {
  const decoration = model.elements.get(elementId);
  if (!decoration) {
    return [];
  }
  const entries: GrcBadgeEntry[] = [];
  for (const slot of SLOT_ORDER) {
    const owned = decoration.resolution.badges.get(slot);
    if (!owned) {
      continue;
    }
    entries.push({
      layerId: owned.layerId,
      layerTitle: owned.layerTitle,
      slot,
      text: owned.signal.text,
      describe: owned.signal.describe,
      interaction: {
        type: "badge.activate",
        elementId,
        layerId: owned.layerId,
        slot,
        refs: owned.signal.refs ?? [],
      },
    });
  }
  const overflow = decoration.resolution.overflow;
  if (overflow) {
    entries.push({
      layerId: "overflow",
      layerTitle: "Weitere Hinweise",
      slot: overflow.slot,
      text: `+${String(overflow.count)}`,
      describe: `${String(overflow.count)} weitere Hinweise: ${overflow.suppressed
        .map((entry) => entry.text)
        .join("; ")}`,
      interaction: {
        type: "overflow.open",
        elementId,
        suppressed: overflow.suppressed.map((entry) => ({
          layerId: entry.layerId,
          text: entry.text,
        })),
      },
    });
  }
  const pin = decoration.resolution.pin;
  if (pin) {
    entries.push({
      layerId: pin.layerId,
      layerTitle: pin.layerTitle,
      slot: "pin",
      text: pin.signal.text,
      describe: pin.signal.describe,
      interaction: {
        type: "pin.open",
        elementId,
        openThreads: pin.signal.openThreads,
      },
    });
  }
  return entries;
}

export interface BadgeCursorHost {
  /** Text in die Live-Region des Viewers geben. */
  announce(message: string): void;
  /** Das gerade fokussierte Element (der Viewer weiß es). */
  focusedElementId(): string | undefined;
}

/**
 * `.` und `,` durchlaufen die Badges des fokussierten Elements, `Enter` auf
 * einem durchlaufenen Badge löst dessen Ereignis aus.
 */
export class GrcBadgeCursor {
  private index = -1;
  private elementId: string | undefined;

  constructor(
    private model: GrcOverlayModel,
    private readonly host: BadgeCursorHost,
    private readonly onInteract?: GrcInteractionHandler,
  ) {}

  /** Nach einem Sichtwechsel: dasselbe Element, neue Badges. */
  update(model: GrcOverlayModel): void {
    this.model = model;
    this.index = -1;
  }

  /** Behandelt eine Taste; `true`, wenn sie verbraucht wurde. */
  handleKey(event: KeyboardEvent): boolean {
    if (event.key === "." || event.key === ",") {
      this.step(event.key === "." ? 1 : -1);
      return true;
    }
    if (event.key === "Enter" && this.index >= 0) {
      return this.activate();
    }
    return false;
  }

  private step(direction: 1 | -1): void {
    const elementId = this.host.focusedElementId();
    if (!elementId) {
      this.host.announce("Kein Element im Fokus.");
      return;
    }
    if (elementId !== this.elementId) {
      this.elementId = elementId;
      this.index = -1;
    }
    const entries = badgesOf(this.model, elementId);
    if (entries.length === 0) {
      this.host.announce("Dieses Element trägt keine GRC-Hinweise.");
      return;
    }
    this.index =
      (this.index + direction + entries.length + 1) % (entries.length + 1);
    if (this.index === entries.length) {
      this.index = direction === 1 ? 0 : entries.length - 1;
    }
    const entry = entries[this.index];
    if (entry) {
      this.host.announce(
        `${entry.layerTitle}, Hinweis ${String(this.index + 1)} von ${String(
          entries.length,
        )}: ${entry.describe}`,
      );
    }
  }

  private activate(): boolean {
    const elementId = this.elementId;
    if (!elementId || !this.onInteract) {
      return false;
    }
    const entry = badgesOf(this.model, elementId)[this.index];
    if (!entry) {
      return false;
    }
    this.onInteract(entry.interaction);
    return true;
  }
}

/**
 * Der GRC-Teil der Fokusansage.
 *
 * Der Viewer setzt seinen eigenen Satz davor („Aktivität ‚Rechnung prüfen',
 * Schritt 4 von 17, Lane Buchhaltung."); hier kommt der fachliche Teil.
 */
export function announcementFor(
  model: GrcOverlayModel,
  elementId: string,
): string {
  const decoration = model.elements.get(elementId);
  if (!decoration) {
    return "";
  }
  return decoration.descriptions.join(" ");
}

/** Kopfzeilen, die beim Betreten des Diagramms einmal angesagt werden sollen. */
export function diagramAnnouncement(model: GrcOverlayModel): string {
  const parts = [
    `Sicht ${model.view.title}.`,
    ...model.banners.map((banner) => banner.signal.describe),
  ];
  const flagged = [...model.elements.values()].filter(
    (decoration) => decoration.descriptions.length > 0,
  ).length;
  parts.push(
    `${String(flagged)} von ${String(model.context.graph.shapes.size)} Elementen tragen Hinweise.`,
  );
  parts.push(`Stand der Daten: ${model.computedAt}.`);
  return parts.join(" ");
}
