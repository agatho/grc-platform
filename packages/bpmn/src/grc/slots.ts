/**
 * Slot- und Budgetsystem (Plan §3.3.1 und §3.3.2).
 *
 * Die eigentliche Gestaltungsentscheidung des Abschnitts: Ein Diagramm mit 40
 * Aktivitäten und acht Objektarten darf nicht zur Tapete werden. Deshalb gibt es
 * **feste Andockstellen** statt freier Overlays, ein **Budget** und eine
 * **deterministische Konfliktlösung**.
 *
 * ```
 *        ┌──────────────────────────────┐
 *    [TL]│                              │[TR]     TL,TR,BL,BR : Badge-Slots
 *    ▌   │      Rechnung prüfen         │         ▌           : LoD-Kante
 *    ▌   │                              │         Fläche      : Formkodierung
 *    [BL]│                              │[BR]
 *        └──────────────────────────────┘
 *   ◉     ▬▬▬ 4,2 min · 18 € · 1.240×                ◉ : Pin-Schiene
 * ```
 *
 * Determinismus ist hier kein Selbstzweck: dieselben Daten müssen im Browser,
 * im serverseitigen PDF-Export und im Test dasselbe Bild ergeben, sonst ist ein
 * exportiertes Auditdiagramm kein Beleg.
 */

import type { GrcObjectRef } from "./contract.js";
import type { GrcTone, HatchDensity } from "./tokens.js";

/** Die vier Badge-Slots. */
export type GrcSlot = "TL" | "TR" | "BL" | "BR";

export const SLOT_ORDER: readonly GrcSlot[] = ["TL", "TR", "BL", "BR"];

/**
 * Höchstens drei Badge-Slots gleichzeitig belegt (§3.3.2). Der vierte bleibt
 * für den Sammel-Badge frei — auch dann, wenn er gar nicht gebraucht wird.
 */
export const MAX_BADGES = 3;

/** Reihenfolge, in der ein freier Slot für den Sammel-Badge gesucht wird. */
const OVERFLOW_PREFERENCE: readonly GrcSlot[] = ["BR", "TR", "BL", "TL"];

/* ------------------------------------------------------------------ *
 * Signale
 * ------------------------------------------------------------------ */

interface SignalBase {
  /**
   * Textliche Entsprechung — **Pflicht**.
   *
   * Ohne sie gibt es kein Signal: der zugängliche Name, die Live-Region und die
   * Textalternative werden aus genau diesem Feld gebildet (§3.3.5 Regel 3).
   */
  readonly describe: string;
}

export interface GrcBadgeSignal extends SignalBase {
  readonly kind: "badge";
  readonly slot: GrcSlot;
  /** Kurztext im Badge, z. B. `2·16` oder `1/3`. */
  readonly text: string;
  readonly tone: GrcTone;
  /** Abweichendes Formzeichen; Vorgabe ist das des Tons. */
  readonly glyph?: string;
  /** Objekte hinter dem Badge — Nutzlast des Klickereignisses. */
  readonly refs?: readonly GrcObjectRef[];
}

export interface GrcShapeSignal extends SignalBase {
  readonly kind: "shape";
  readonly tone: GrcTone;
  readonly hatch: HatchDensity;
  /** Zahlenwert, der die Stufe zusätzlich trägt (§4.4 Regel 3). */
  readonly value?: string;
}

export interface GrcGutterSignal extends SignalBase {
  readonly kind: "gutter";
  readonly entries: readonly string[];
}

export interface GrcPinSignal extends SignalBase {
  readonly kind: "pin";
  readonly text: string;
  readonly tone: GrcTone;
  readonly openThreads: number;
}

export interface GrcStripeSignal extends SignalBase {
  readonly kind: "stripe";
  readonly tone: GrcTone;
  readonly label: string;
}

/** Dimmen statt Ausblenden (§3.3.5 Regel 1). */
export interface GrcDimSignal extends SignalBase {
  readonly kind: "dim";
}

export interface GrcEdgeSignal extends SignalBase {
  readonly kind: "edge";
  readonly tone: GrcTone;
  readonly style: "solid" | "dashed" | "double";
  readonly width?: number;
  /** Kleiner Chip in der Kantenmitte, z. B. Länderkürzel `US`. */
  readonly chip?: string;
  readonly glyph?: string;
}

export interface GrcArcSignal extends SignalBase {
  readonly kind: "arc";
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly tone: GrcTone;
  readonly label: string;
  /** Zeichnet ein Schlosssymbol in der Bogenmitte (SoD). */
  readonly lock?: boolean;
}

/** Zusätzlich eingezeichneter, im Modell nicht vorhandener Pfad (§3.8). */
export interface GrcGhostEdgeSignal extends SignalBase {
  readonly kind: "ghost-edge";
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly tone: GrcTone;
  readonly label: string;
}

export interface GrcBannerSignal extends SignalBase {
  readonly kind: "banner";
  readonly tone: GrcTone;
  readonly text: string;
}

export type GrcElementSignal =
  | GrcBadgeSignal
  | GrcShapeSignal
  | GrcGutterSignal
  | GrcPinSignal
  | GrcStripeSignal
  | GrcDimSignal;

export type GrcDiagramSignal =
  GrcArcSignal | GrcGhostEdgeSignal | GrcBannerSignal;

export type GrcSignal = GrcElementSignal | GrcDiagramSignal | GrcEdgeSignal;

/** Ein Signal mit seiner Herkunft. Die Engine hängt Layer-ID und Rang an. */
export interface OwnedSignal<T extends GrcSignal = GrcSignal> {
  readonly layerId: string;
  readonly layerTitle: string;
  readonly priority: number;
  readonly signal: T;
}

/* ------------------------------------------------------------------ *
 * Auflösung
 * ------------------------------------------------------------------ */

export interface SuppressedSignal {
  readonly layerId: string;
  readonly text: string;
}

export interface SlotResolution {
  /** Belegte Badge-Slots nach der Budgetprüfung. */
  readonly badges: ReadonlyMap<GrcSlot, OwnedSignal<GrcBadgeSignal>>;
  /** Der Sammel-Badge, falls etwas verdrängt wurde. */
  readonly overflow:
    | {
        readonly slot: GrcSlot;
        readonly count: number;
        readonly suppressed: readonly SuppressedSignal[];
      }
    | undefined;
  readonly shape: OwnedSignal<GrcShapeSignal> | undefined;
  readonly gutter: readonly OwnedSignal<GrcGutterSignal>[];
  readonly pin: OwnedSignal<GrcPinSignal> | undefined;
  readonly stripe: OwnedSignal<GrcStripeSignal> | undefined;
  readonly dimmed: boolean;
  /** Alle Beschreibungen in Anzeigereihenfolge — Grundlage der ARIA-Texte. */
  readonly descriptions: readonly string[];
}

/**
 * Vergleich für die Konfliktlösung: höhere Priorität gewinnt; bei Gleichstand
 * entscheidet die Layer-ID alphabetisch. Kein Zufall, keine Einfügereihenfolge —
 * sonst hinge das Bild an der Reihenfolge der Registrierung.
 */
function byPriority(a: OwnedSignal, b: OwnedSignal): number {
  return b.priority - a.priority || a.layerId.localeCompare(b.layerId);
}

/**
 * Löst die Slotbelegung eines Elements auf.
 *
 * Ablauf:
 * 1. leere Layer belegen nichts (sie liefern gar kein Signal),
 * 2. je Slot gewinnt die höhere Priorität,
 * 3. mehr als drei belegte Slots → die schwächsten wandern in den Sammel-Badge,
 * 4. höchstens eine Formkodierung; verdrängte Formkodierungen wandern ebenfalls
 *    in die Liste der unterdrückten Signale — sie sind sonst spurlos weg.
 */
export function resolveSlots(
  signals: readonly OwnedSignal<GrcElementSignal>[],
): SlotResolution {
  const perSlot = new Map<GrcSlot, OwnedSignal<GrcBadgeSignal>[]>();
  const shapes: OwnedSignal<GrcShapeSignal>[] = [];
  const gutters: OwnedSignal<GrcGutterSignal>[] = [];
  const pins: OwnedSignal<GrcPinSignal>[] = [];
  const stripes: OwnedSignal<GrcStripeSignal>[] = [];
  let dimmed = false;

  for (const owned of signals) {
    const signal = owned.signal;
    switch (signal.kind) {
      case "badge": {
        const list = perSlot.get(signal.slot) ?? [];
        list.push(owned as OwnedSignal<GrcBadgeSignal>);
        perSlot.set(signal.slot, list);
        break;
      }
      case "shape":
        shapes.push(owned as OwnedSignal<GrcShapeSignal>);
        break;
      case "gutter":
        gutters.push(owned as OwnedSignal<GrcGutterSignal>);
        break;
      case "pin":
        pins.push(owned as OwnedSignal<GrcPinSignal>);
        break;
      case "stripe":
        stripes.push(owned as OwnedSignal<GrcStripeSignal>);
        break;
      case "dim":
        dimmed = true;
        break;
    }
  }

  const suppressed: SuppressedSignal[] = [];

  // 2. Konflikt je Slot
  const winners: OwnedSignal<GrcBadgeSignal>[] = [];
  for (const slot of SLOT_ORDER) {
    const list = (perSlot.get(slot) ?? []).slice().sort(byPriority);
    const [winner, ...losers] = list;
    if (winner) {
      winners.push(winner);
    }
    for (const loser of losers) {
      suppressed.push({
        layerId: loser.layerId,
        text: loser.signal.describe,
      });
    }
  }

  // 3. Budget
  winners.sort(byPriority);
  const placed = winners.slice(0, MAX_BADGES);
  for (const dropped of winners.slice(MAX_BADGES)) {
    suppressed.push({
      layerId: dropped.layerId,
      text: dropped.signal.describe,
    });
  }

  const badges = new Map<GrcSlot, OwnedSignal<GrcBadgeSignal>>();
  for (const owned of placed) {
    badges.set(owned.signal.slot, owned);
  }

  // 4. genau eine Formkodierung
  shapes.sort(byPriority);
  const [shape, ...shadowed] = shapes;
  for (const owned of shadowed) {
    suppressed.push({ layerId: owned.layerId, text: owned.signal.describe });
  }

  const overflowSlot = OVERFLOW_PREFERENCE.find((slot) => !badges.has(slot));
  const overflow =
    suppressed.length > 0 && overflowSlot
      ? {
          slot: overflowSlot,
          count: suppressed.length,
          suppressed: [...suppressed],
        }
      : undefined;

  gutters.sort(byPriority);
  pins.sort(byPriority);
  stripes.sort(byPriority);

  const descriptions: string[] = [];
  if (shape) {
    descriptions.push(shape.signal.describe);
  }
  for (const slot of SLOT_ORDER) {
    const owned = badges.get(slot);
    if (owned) {
      descriptions.push(owned.signal.describe);
    }
  }
  for (const owned of gutters) {
    descriptions.push(owned.signal.describe);
  }
  const stripe = stripes[0];
  if (stripe) {
    descriptions.push(stripe.signal.describe);
  }
  const pin = pins[0];
  if (pin) {
    descriptions.push(pin.signal.describe);
  }
  if (overflow) {
    // Der Sammel-Badge ist nie stumm: er nennt, was er verdeckt.
    descriptions.push(
      `${String(overflow.count)} weitere Hinweise: ${overflow.suppressed
        .map((entry) => entry.text)
        .join("; ")}`,
    );
  }
  if (dimmed) {
    descriptions.push("Vom aktiven Filter nicht erfasst (abgeblendet).");
  }

  return {
    badges,
    overflow,
    shape,
    gutter: gutters,
    pin,
    stripe,
    dimmed,
    descriptions,
  };
}
