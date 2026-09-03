/// <reference lib="dom" />

/**
 * Zeichnen der GRC-Schicht ins SVG (Plan §3.3.1, §4.4, §4.5).
 *
 * **Warum ins SVG und nicht als HTML-Overlay:** Die heutigen HTML-Overlays sind
 * im Export nicht enthalten — `saveSVG()` liefert das Diagramm *ohne* die
 * GRC-Badges, ein exportiertes Auditdiagramm zeigt also die Auditinformation
 * nicht. Außerdem wandern feste Pixelwerte beim Zoomen. Beides ist hier
 * erledigt, weil die Dekoration im selben Koordinatensystem wie das Diagramm
 * gezeichnet wird und mitskaliert.
 *
 * **Koordinatenvertrag:** Elementdekoration wird *in die Elementgruppe*
 * (`g.djs-element`) gezeichnet und benutzt dieselben absoluten BPMN-DI-Koordinaten
 * wie `BpmnRenderer`. Sie folgt der Form daher in jedem Einbettungsfall — im
 * statischen SVG ebenso wie auf der `diagram-js`-Fläche, deren Gruppen zusätzlich
 * eine Translation tragen. Diagrammweite Dekoration (Bögen, Kopfzeile, Legende)
 * liegt in einer eigenen Gruppe und rechnet die Translation der Endpunkte hinzu.
 *
 * **Barrierefreiheit:** Jede gezeichnete Dekoration ist `aria-hidden`. Ihr Inhalt
 * steht im zugänglichen Namen des Elements — genau einmal, an einer Stelle, aus
 * derselben Quelle wie Live-Region und Textalternative.
 */

import { ACTIVITY_RADIUS, DEFAULT_FONT_FAMILY } from "../draw/theme";
import {
  polygonPath,
  roundRectPath,
  svgAppend,
  svgAttr,
  svgCreate,
} from "../draw/svg";
import type { BpmnShape, Point } from "../draw/types";
import type { GrcInteraction, GrcInteractionHandler } from "./contract";
import type { GrcElementDecoration, GrcOverlayModel } from "./engine";
import { centerOf, midpointOf } from "./graph";
import { SLOT_ORDER, type GrcBadgeSignal, type GrcSlot } from "./slots";
import {
  ARC,
  BADGE,
  badgeWidth,
  BANNER,
  EDGE_DECORATION,
  GRC_PALETTE,
  GUTTER,
  HATCH_SPACING,
  LANE_FOOTER,
  LEGEND,
  LOD_STRIPE,
  PIN,
  TONE_GLYPH,
  BADGE_TEXT,
  type GrcTone,
  type HatchDensity,
} from "./tokens";

const DEFS_ID = "arctos-grc-defs";
const OVERLAY_CLASS = "arctos-grc-overlay";
const DECORATION_ATTR = "data-grc";
const BASE_LABEL_ATTR = "data-grc-base-label";
const BASE_FILL_ATTR = "data-grc-base-fill";

export interface DecorateOptions {
  /** SVG-Wurzel oder ein Container, der genau eine enthält. */
  readonly root: Element;
  readonly model: GrcOverlayModel;
  readonly onInteract?: GrcInteractionHandler;
  /** Legende unter das Diagramm zeichnen (Vorgabe: aus). */
  readonly legend?: boolean;
  /** Kopfzeile über das Diagramm zeichnen (Vorgabe: an, wenn es eine gibt). */
  readonly banner?: boolean;
}

export interface GrcDecorationResult {
  readonly model: GrcOverlayModel;
  /** Wie viele Elemente eine Dekoration bekommen haben. */
  readonly decoratedElements: number;
  readonly decoratedEdges: number;
  readonly arcs: number;
  /** Entfernt alle Dekorationen und stellt die ursprünglichen Namen wieder her. */
  destroy(): void;
}

interface InteractionTarget {
  readonly interaction: GrcInteraction;
}

/** Zeichnet das Überlagerungsmodell. */
export function decorateGrc(options: DecorateOptions): GrcDecorationResult {
  const { model } = options;
  const svg = findSvg(options.root);
  const targets = new WeakMap<Element, InteractionTarget>();

  clearDecorations(options.root);

  const defs = ensureDefs(svg);
  const overlay = svgCreate("g", {
    class: OVERLAY_CLASS,
    "aria-hidden": "true",
  });
  svgAttr(overlay, { [DECORATION_ATTR]: "overlay" });
  svgAppend(overlayParent(svg), overlay);

  let decoratedElements = 0;
  for (const decoration of model.elements.values()) {
    const group = findElementGroup(options.root, decoration.elementId);
    if (!group) {
      continue;
    }
    decorateElement(group, decoration, defs, targets);
    applyAccessibleName(group, decoration.accessibleSuffix);
    decoratedElements += 1;
  }

  let decoratedEdges = 0;
  for (const edge of model.edges.values()) {
    const group = findElementGroup(options.root, edge.edgeId);
    if (!group) {
      continue;
    }
    decorateEdge(
      group,
      edge.connection.waypoints,
      edge.signal.signal,
      targets,
      {
        layerId: edge.signal.layerId,
        edgeId: edge.edgeId,
      },
    );
    applyAccessibleName(group, edge.descriptions.join(" "));
    decoratedEdges += 1;
  }

  // Bögen und Geisterkanten liegen über allem, damit sie nicht in der
  // Kantenführung untergehen (§3.11: „deutlich abgesetzt").
  let arcs = 0;
  for (const arc of model.arcs) {
    const from = anchorPoint(options.root, model, arc.signal.fromId);
    const to = anchorPoint(options.root, model, arc.signal.toId);
    if (!from || !to) {
      continue;
    }
    drawArc(
      overlay,
      from,
      to,
      arc.signal.tone,
      arc.signal.label,
      arc.signal.lock === true,
      {
        interaction: {
          type: "arc.activate",
          conflictId: arc.signal.id,
          elementIds: [arc.signal.fromId, arc.signal.toId],
        },
      },
      targets,
    );
    arcs += 1;
  }

  for (const ghost of model.ghostEdges) {
    const from = anchorPoint(options.root, model, ghost.signal.fromId);
    const to = anchorPoint(options.root, model, ghost.signal.toId);
    if (!from || !to) {
      continue;
    }
    drawGhostEdge(overlay, from, to, ghost.signal.tone, ghost.signal.label);
  }

  const bounds = model.context.scene.bounds;
  if (options.banner !== false && model.banners.length > 0) {
    drawBanners(overlay, bounds, model, targets);
  }
  if (options.legend === true && model.legend.length > 0) {
    drawLegend(overlay, bounds, model);
  }

  const handler = options.onInteract;
  const onClick = (event: Event): void => {
    if (!handler) {
      return;
    }
    let node: Element | null = event.target as Element | null;
    while (node && node !== options.root) {
      const target = targets.get(node);
      if (target) {
        handler(target.interaction);
        return;
      }
      node = node.parentElement ?? (node.parentNode as Element | null);
    }
  };
  if (handler) {
    options.root.addEventListener("click", onClick);
  }

  return {
    model,
    decoratedElements,
    decoratedEdges,
    arcs,
    destroy() {
      if (handler) {
        options.root.removeEventListener("click", onClick);
      }
      clearDecorations(options.root);
    },
  };
}

/* ------------------------------------------------------------------ *
 * Elementdekoration
 * ------------------------------------------------------------------ */

function decorateElement(
  group: Element,
  decoration: GrcElementDecoration,
  defs: SVGDefsElement,
  targets: WeakMap<Element, InteractionTarget>,
): void {
  const shape = decoration.shape;
  const resolution = decoration.resolution;

  // 1. Formkodierung — *vor* das Visual, damit Kontur und Beschriftung oben
  //    bleiben. Die BPMN-Formensprache darf eine Kodierung nie auflösen
  //    (§4.4 Regel 4).
  const shapeSignal = resolution.shape;
  if (shapeSignal) {
    const tone = shapeSignal.signal.tone;
    const fill = svgCreate("path", {
      d: shapeCodingPath(shape),
      fill: GRC_PALETTE[tone].tint,
      class: "arctos-grc-shape-coding",
      "aria-hidden": "true",
    });
    svgAttr(fill, { [DECORATION_ATTR]: "shape" });

    // Die tragende Kontur des Renderers ist weiß gefüllt und läge sonst *über*
    // der Tönung — eine Formkodierung dahinter wäre unsichtbar. Deshalb wird
    // die Füllung der Kontur selbst umgesetzt (und beim Aufräumen
    // zurückgestellt); die Kontur, die Symbole und die Beschriftung bleiben
    // unangetastet und liegen weiter oben (§4.4 Regel 4).
    const outline = group.querySelector(".bpmn-outline");
    if (outline) {
      outline.setAttribute(
        BASE_FILL_ATTR,
        outline.getAttribute("fill") ?? "none",
      );
      outline.setAttribute("fill", GRC_PALETTE[tone].tint);
    } else {
      group.insertBefore(fill, group.firstChild);
    }

    if (shapeSignal.signal.hatch !== "none") {
      const patternId = ensureHatch(defs, tone, shapeSignal.signal.hatch);
      const hatch = svgCreate("path", {
        d: shapeCodingPath(shape),
        fill: `url(#${patternId})`,
        class: "arctos-grc-hatch",
        "aria-hidden": "true",
      });
      svgAttr(hatch, { [DECORATION_ATTR]: "hatch" });
      if (outline?.parentNode) {
        outline.parentNode.insertBefore(hatch, outline.nextSibling);
      } else {
        group.insertBefore(hatch, group.firstChild);
      }
    }
    register(outline ?? fill, targets, {
      type: "shape.activate",
      elementId: shape.id,
      layerId: shapeSignal.layerId,
    });
  }

  // 2. LoD-Kante
  const stripe = resolution.stripe;
  if (stripe) {
    const node = svgCreate("rect", {
      x: shape.x - LOD_STRIPE.offsetX,
      y: shape.y,
      width: LOD_STRIPE.width,
      height: shape.height,
      fill: GRC_PALETTE[stripe.signal.tone].solid,
      class: "arctos-grc-lod",
      "aria-hidden": "true",
    });
    svgAttr(node, { [DECORATION_ATTR]: "stripe" });
    svgAppend(group, node);
  }

  // 3. Badges
  for (const [slot, owned] of resolution.badges) {
    const node = drawBadge(group, shape, slot, owned.signal);
    register(node, targets, {
      type: "badge.activate",
      elementId: shape.id,
      layerId: owned.layerId,
      slot,
      refs: owned.signal.refs ?? [],
    });
  }

  // 4. Sammel-Badge
  const overflow = resolution.overflow;
  if (overflow) {
    const node = drawBadge(group, shape, overflow.slot, {
      kind: "badge",
      slot: overflow.slot,
      text: `+${String(overflow.count)}`,
      tone: "neutral",
      glyph: "",
      describe: "",
    });
    register(node, targets, {
      type: "overflow.open",
      elementId: shape.id,
      suppressed: overflow.suppressed.map((entry) => ({
        layerId: entry.layerId,
        text: entry.text,
      })),
    });
  }

  // 5. Gutter — höchstens eine Zeile, höchstens drei Kennzahlen, und nur unter
  //    Aktivitäten: Ereignisse und Gateways tragen ihre Beschriftung außerhalb
  //    der Form, genau dort, wo der Gutter läge. Der erste gerasterte Beleg
  //    zeigte beides übereinander.
  const entries = hasGutter(shape)
    ? fitGutter(
        resolution.gutter
          .flatMap((owned) => owned.signal.entries)
          .slice(0, GUTTER.maxEntries),
        shape.width * 1.5,
      )
    : [];
  if (entries.length > 0) {
    const text = svgCreate("text", {
      x: shape.x,
      y: shape.y + shape.height + GUTTER.offsetY + GUTTER.fontSize,
      "font-family": DEFAULT_FONT_FAMILY,
      "font-size": GUTTER.fontSize,
      fill: GRC_PALETTE.neutral.solid,
      class: "arctos-grc-gutter",
      "aria-hidden": "true",
    });
    svgAttr(text, { [DECORATION_ATTR]: "gutter" });
    text.textContent = entries.join(" · ");
    svgAppend(group, text);
  }

  // 5b. Lane-Fußzeile (OP-006)
  //
  // [ARCTOS-FULL-2026-08-31 · OP-006] Der achte Slot. Er liegt am unteren
  // Innenrand des Rahmens, aus demselben Grund, aus dem Lane-Badges am
  // rechten INNENrand stehen (§7.2, Befund 4): außerhalb läge er auf der
  // nächsten Lane oder halb außerhalb der Zeichenfläche.
  //
  // Der Balken trägt seinen Wert doppelt — als Länge UND als Text daneben.
  // Eine Länge allein ist ein Vergleich ohne Bezugsgröße, und ein Leser mit
  // Screenreader hätte gar nichts (§3.3.5 Regel 2).
  const laneFooter = resolution.laneFooter;
  if (laneFooter) {
    const share = Math.min(1, Math.max(0, laneFooter.signal.share));
    const maxWidth = shape.width * LANE_FOOTER.maxWidthRatio;
    const width = Math.max(LANE_FOOTER.minWidth, maxWidth * share);
    const y = shape.y + shape.height - LANE_FOOTER.offsetY - LANE_FOOTER.height;
    const footerGroup = svgCreate("g", {
      class: "arctos-grc-lane-footer",
      "aria-hidden": "true",
    });
    svgAttr(footerGroup, { [DECORATION_ATTR]: "lane-footer" });
    // Die Bezugsspur in Neutralton: ohne sie ist ein kurzer Balken nicht von
    // einem abgeschnittenen zu unterscheiden.
    svgAppend(
      footerGroup,
      svgCreate("rect", {
        x: shape.x + LANE_FOOTER.offsetY,
        y,
        width: round(maxWidth),
        height: LANE_FOOTER.height,
        rx: 2,
        fill: GRC_PALETTE.neutral.tint,
      }),
    );
    svgAppend(
      footerGroup,
      svgCreate("rect", {
        x: shape.x + LANE_FOOTER.offsetY,
        y,
        width: round(width),
        height: LANE_FOOTER.height,
        rx: 2,
        fill: GRC_PALETTE[laneFooter.signal.tone].solid,
      }),
    );
    const footerLabel = svgCreate("text", {
      x: round(shape.x + LANE_FOOTER.offsetY + maxWidth + LANE_FOOTER.labelGap),
      y: round(y + LANE_FOOTER.height),
      "font-family": DEFAULT_FONT_FAMILY,
      "font-size": LANE_FOOTER.fontSize,
      fill: GRC_PALETTE.neutral.solid,
    });
    footerLabel.textContent = laneFooter.signal.label;
    svgAppend(footerGroup, footerLabel);
    svgAppend(group, footerGroup);
  }

  // 6. Pin-Schiene links außen
  const pin = resolution.pin;
  if (pin) {
    const cx = shape.x - PIN.offsetX;
    const cy = shape.y + PIN.radius + 2;
    const pinGroup = svgCreate("g", {
      class: "arctos-grc-pin",
      "aria-hidden": "true",
    });
    svgAttr(pinGroup, { [DECORATION_ATTR]: "pin" });
    svgAppend(
      pinGroup,
      svgCreate("path", {
        // Sprechblase: Kreis mit kleiner Spitze nach unten rechts.
        d: `M ${String(cx)} ${String(cy - PIN.radius)} a ${String(PIN.radius)} ${String(
          PIN.radius,
        )} 0 1 1 -0.01 0 z M ${String(cx + 2)} ${String(cy + PIN.radius - 1)} l 3 5 l -6 -3 z`,
        fill: GRC_PALETTE[pin.signal.tone].solid,
      }),
    );
    const label = svgCreate("text", {
      x: cx,
      y: cy + PIN.fontSize * 0.35,
      "text-anchor": "middle",
      "font-family": DEFAULT_FONT_FAMILY,
      "font-size": PIN.fontSize,
      fill: BADGE_TEXT,
    });
    label.textContent = pin.signal.text;
    svgAppend(pinGroup, label);
    svgAppend(group, pinGroup);
    register(pinGroup, targets, {
      type: "pin.open",
      elementId: shape.id,
      openThreads: pin.signal.openThreads,
    });
  }

  // 7. Abblenden statt Ausblenden (§3.3.5 Regel 1)
  if (resolution.dimmed) {
    // Die Deckkraft liegt auf der *ganzen* Elementgruppe, nicht nur auf dem
    // Visual: sonst leuchten die Badges eines abgeblendeten Elements weiter und
    // der Filter sagt zwei Dinge gleichzeitig.
    group.setAttribute("opacity", "0.25");
    group.setAttribute("data-grc-dimmed", "true");
  }
}

function drawBadge(
  group: Element,
  shape: BpmnShape,
  slot: GrcSlot,
  signal: GrcBadgeSignal,
): SVGGElement {
  const glyph = signal.glyph ?? TONE_GLYPH[signal.tone];
  const full = glyph === "" ? signal.text : `${glyph} ${signal.text}`;
  // Zwei Badges an derselben Kante dürfen sich nicht überlappen: mehr als die
  // halbe Elementbreite (plus beide Überstände) bekommt keines. Der Text wird
  // dafür gekürzt — die vollständige Angabe steht ohnehin im zugänglichen Namen
  // und in der Textalternative. Ohne diese Grenze schiebt sich an einem
  // 100 px breiten Task der Kategoriechip über die Ampel; genau das zeigte der
  // erste gerasterte Beleg.
  // Untergrenze 48 px: an einem 36 px breiten Ereignis wäre die halbe Breite so
  // schmal, dass selbst „AV ja" zu „AV …" verkäme — ein Badge, das nichts mehr
  // sagt, ist schlechter als eines, das etwas übersteht.
  const text = fitBadgeText(
    full,
    Math.max(shape.width / 2 + BADGE.overhang, 48),
  );
  const width = badgeWidth(text);
  const { x, y } = badgePosition(shape, slot, width);
  const tone = GRC_PALETTE[signal.tone];

  const badge = svgCreate("g", {
    class: `arctos-grc-badge arctos-grc-badge-${slot.toLowerCase()}`,
    "aria-hidden": "true",
  });
  svgAttr(badge, { [DECORATION_ATTR]: "badge" });
  svgAppend(
    badge,
    svgCreate("rect", {
      x,
      y,
      width,
      height: BADGE.height,
      rx: BADGE.radius,
      ry: BADGE.radius,
      fill: tone.solid,
      // Heller Rand: das Badge überlappt die Elementkante und braucht auch
      // gegen dunkle Nachbarschaft eine Trennung (§4.4 Regel 2).
      stroke: "#ffffff",
      "stroke-width": 1,
    }),
  );
  const label = svgCreate("text", {
    x: x + width / 2,
    y: y + BADGE.height / 2 + BADGE.fontSize * 0.35,
    "text-anchor": "middle",
    "font-family": DEFAULT_FONT_FAMILY,
    "font-size": BADGE.fontSize,
    fill: BADGE_TEXT,
  });
  label.textContent = text;
  svgAppend(badge, label);
  svgAppend(group, badge);
  return badge;
}

/** Trägt die Form eine Gutter-Zeile? Nur Aktivitäten und Container. */
function hasGutter(shape: BpmnShape): boolean {
  return !(
    shape.type.endsWith("Event") ||
    shape.type.endsWith("Gateway") ||
    shape.type.startsWith("bpmn:Data")
  );
}

/** Lässt so viele Kennzahlen stehen, wie unter das Shape passen. */
function fitGutter(
  entries: readonly string[],
  maxWidth: number,
): readonly string[] {
  const out: string[] = [];
  for (const entry of entries) {
    const candidate = [...out, entry].join(" · ");
    if (
      out.length > 0 &&
      candidate.length * (GUTTER.fontSize * 0.55) > maxWidth
    ) {
      break;
    }
    out.push(entry);
  }
  return out;
}

/** Kürzt einen Badge-Text auf die verfügbare Breite (mit Auslassungszeichen). */
function fitBadgeText(text: string, maxWidth: number): string {
  if (badgeWidth(text) <= maxWidth) {
    return text;
  }
  const fits = Math.max(
    3,
    Math.floor((maxWidth - BADGE.paddingX * 2) / BADGE.charWidth) - 1,
  );
  return text.length <= fits ? text : `${text.slice(0, fits)}…`;
}

function badgePosition(
  shape: BpmnShape,
  slot: GrcSlot,
  width: number,
): { x: number; y: number } {
  // Lanes und Pools sind Rahmen: Ihre „Ecken" liegen am Rand des halben
  // Diagramms. Ein Badge in der Ecke stünde halb außerhalb, eines am Lane-Kopf
  // läge auf den ersten Aktivitäten. Ihre Badges stapeln sich deshalb am
  // rechten Innenrand — dort ist in Prozessdiagrammen verlässlich Platz. Die
  // Slotbezeichnung bleibt für die Konfliktlösung erhalten, bestimmt hier aber
  // nur die Reihenfolge im Stapel.
  if (shape.isFrame === true) {
    const index = Math.max(0, SLOT_ORDER.indexOf(slot));
    return {
      x: shape.x + shape.width - width - 8,
      y: shape.y + 6 + index * (BADGE.height + 4),
    };
  }
  const top = shape.y - BADGE.overhang;
  const bottom = shape.y + shape.height - BADGE.height + BADGE.overhang;
  const left = shape.x - BADGE.overhang;
  const right = shape.x + shape.width - width + BADGE.overhang;
  switch (slot) {
    case "TL":
      return { x: left, y: top };
    case "TR":
      return { x: right, y: top };
    case "BL":
      return { x: left, y: bottom };
    default:
      return { x: right, y: bottom };
  }
}

/** Umriss für die Formkodierung — folgt der BPMN-Form, nie ein Kasten darüber. */
export function shapeCodingPath(shape: BpmnShape): string {
  const { x, y, width, height } = shape;
  if (shape.type.endsWith("Event")) {
    const r = Math.min(width, height) / 2;
    const cx = x + width / 2;
    const cy = y + height / 2;
    return `M ${String(cx)} ${String(cy - r)} a ${String(r)} ${String(r)} 0 1 1 -0.01 0 z`;
  }
  if (shape.type.endsWith("Gateway")) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    return polygonPath([
      [cx, y],
      [x + width, cy],
      [cx, y + height],
      [x, cy],
    ]);
  }
  if (shape.type === "bpmn:Lane" || shape.type === "bpmn:Participant") {
    return roundRectPath(x, y, width, height, 0);
  }
  return roundRectPath(x, y, width, height, ACTIVITY_RADIUS);
}

/* ------------------------------------------------------------------ *
 * Kanten
 * ------------------------------------------------------------------ */

function decorateEdge(
  group: Element,
  waypoints: readonly Point[],
  signal: { tone: GrcTone; style: string; width?: number; chip?: string },
  targets: WeakMap<Element, InteractionTarget>,
  ids: { layerId: string; edgeId: string },
): void {
  const tone = GRC_PALETTE[signal.tone];
  const d = waypoints
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${String(round(point.x))} ${String(round(point.y))}`,
    )
    .join(" ");

  const decoration = svgCreate("g", {
    class: "arctos-grc-edge",
    "aria-hidden": "true",
  });
  svgAttr(decoration, { [DECORATION_ATTR]: "edge" });

  if (signal.style === "double") {
    // Doppelkante: breiter Grundstrich, darüber ein schmaler heller — das ergibt
    // zwei parallele Linien ohne eine zweite Geometrie berechnen zu müssen.
    svgAppend(
      decoration,
      svgCreate("path", {
        d,
        fill: "none",
        stroke: tone.solid,
        "stroke-width": EDGE_DECORATION.outerWidth,
        "stroke-linejoin": "round",
      }),
    );
    svgAppend(
      decoration,
      svgCreate("path", {
        d,
        fill: "none",
        stroke: "#ffffff",
        "stroke-width": EDGE_DECORATION.innerWidth,
        "stroke-linejoin": "round",
      }),
    );
  } else {
    svgAppend(
      decoration,
      svgCreate("path", {
        d,
        fill: "none",
        stroke: tone.solid,
        "stroke-width": signal.width ?? EDGE_DECORATION.minFlowWidth,
        "stroke-dasharray": signal.style === "dashed" ? "8,5" : undefined,
        "stroke-linejoin": "round",
        opacity: signal.style === "dashed" ? 0.85 : 0.9,
      }),
    );
  }

  if (signal.chip) {
    const mid = midpointOf({
      id: ids.edgeId,
      type: "bpmn:SequenceFlow",
      waypoints: [...waypoints],
      businessObject: { $type: "bpmn:SequenceFlow" },
    });
    const width = badgeWidth(signal.chip);
    svgAppend(
      decoration,
      svgCreate("rect", {
        x: mid.x - width / 2,
        y: mid.y - EDGE_DECORATION.chipHeight / 2,
        width,
        height: EDGE_DECORATION.chipHeight,
        rx: 3,
        ry: 3,
        fill: tone.solid,
        stroke: "#ffffff",
        "stroke-width": 1,
      }),
    );
    const label = svgCreate("text", {
      x: mid.x,
      y: mid.y + EDGE_DECORATION.chipFontSize * 0.35,
      "text-anchor": "middle",
      "font-family": DEFAULT_FONT_FAMILY,
      "font-size": EDGE_DECORATION.chipFontSize,
      fill: BADGE_TEXT,
    });
    label.textContent = signal.chip;
    svgAppend(decoration, label);
  }

  svgAppend(group, decoration);
  register(decoration, targets, {
    type: "edge.activate",
    edgeId: ids.edgeId,
    layerId: ids.layerId,
  });
}

/* ------------------------------------------------------------------ *
 * Diagrammweite Dekoration
 * ------------------------------------------------------------------ */

function drawArc(
  overlay: SVGElement,
  from: Point,
  to: Point,
  tone: GrcTone,
  label: string,
  lock: boolean,
  target: InteractionTarget,
  targets: WeakMap<Element, InteractionTarget>,
): void {
  const colors = GRC_PALETTE[tone];
  // Der Bogen weicht *senkrecht* zur Verbindungslinie aus, nicht stur nach oben:
  // sonst legt er sich bei senkrecht übereinanderliegenden Lanes quer über die
  // Shapes, statt sich davon abzusetzen (§3.11: „außerhalb der normalen
  // Kantenführung").
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const sign = normal.y > 0 ? -1 : 1;
  const mid = {
    x: (from.x + to.x) / 2 + normal.x * ARC.bulge * sign,
    y: (from.y + to.y) / 2 + normal.y * ARC.bulge * sign,
  };
  const group = svgCreate("g", {
    class: "arctos-grc-arc",
    "aria-hidden": "true",
  });
  svgAttr(group, { [DECORATION_ATTR]: "arc" });
  svgAppend(
    group,
    svgCreate("path", {
      d: `M ${String(round(from.x))} ${String(round(from.y))} Q ${String(round(mid.x))} ${String(
        round(mid.y),
      )} ${String(round(to.x))} ${String(round(to.y))}`,
      fill: "none",
      stroke: colors.solid,
      "stroke-width": ARC.strokeWidth,
      "stroke-dasharray": ARC.dash,
      "stroke-linecap": "round",
    }),
  );

  // Scheitel der quadratischen Bézierkurve bei t = 0,5.
  const apex = {
    x: 0.25 * from.x + 0.5 * mid.x + 0.25 * to.x,
    y: 0.25 * from.y + 0.5 * mid.y + 0.25 * to.y,
  };
  if (lock) {
    svgAppend(group, padlock(apex, colors.solid));
  }
  const labelText = fitBadgeText(label, ARC.maxLabelWidth);
  const width = badgeWidth(labelText);
  svgAppend(
    group,
    svgCreate("rect", {
      x: apex.x - width / 2,
      y: apex.y + (lock ? ARC.lockSize : 0) - BADGE.height / 2 + 4,
      width,
      height: BADGE.height,
      rx: BADGE.radius,
      ry: BADGE.radius,
      fill: colors.solid,
      stroke: "#ffffff",
      "stroke-width": 1,
    }),
  );
  const text = svgCreate("text", {
    x: apex.x,
    y: apex.y + (lock ? ARC.lockSize : 0) + BADGE.fontSize * 0.35 + 4,
    "text-anchor": "middle",
    "font-family": DEFAULT_FONT_FAMILY,
    "font-size": BADGE.fontSize,
    fill: BADGE_TEXT,
  });
  text.textContent = labelText;
  svgAppend(group, text);
  svgAppend(overlay, group);
  register(group, targets, target.interaction);
}

/** Schlosssymbol in der Bogenmitte (§3.11). */
function padlock(at: Point, color: string): SVGGElement {
  const size = ARC.lockSize;
  const group = svgCreate("g", { class: "arctos-grc-lock" });
  svgAppend(
    group,
    svgCreate("rect", {
      x: at.x - size / 2,
      y: at.y - size / 2,
      width: size,
      height: size * 0.72,
      rx: 1.5,
      ry: 1.5,
      fill: color,
    }),
  );
  svgAppend(
    group,
    svgCreate("path", {
      d: `M ${String(round(at.x - size * 0.26))} ${String(round(at.y - size / 2))} v ${String(
        round(-size * 0.3),
      )} a ${String(round(size * 0.26))} ${String(round(size * 0.26))} 0 0 1 ${String(
        round(size * 0.52),
      )} 0 v ${String(round(size * 0.3))}`,
      fill: "none",
      stroke: color,
      "stroke-width": 2,
    }),
  );
  return group;
}

function drawGhostEdge(
  overlay: SVGElement,
  from: Point,
  to: Point,
  tone: GrcTone,
  label: string,
): void {
  const colors = GRC_PALETTE[tone];
  const group = svgCreate("g", {
    class: "arctos-grc-ghost-edge",
    "aria-hidden": "true",
  });
  svgAttr(group, { [DECORATION_ATTR]: "ghost-edge" });
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + ARC.bulge };
  svgAppend(
    group,
    svgCreate("path", {
      d: `M ${String(round(from.x))} ${String(round(from.y))} Q ${String(round(mid.x))} ${String(
        round(mid.y),
      )} ${String(round(to.x))} ${String(round(to.y))}`,
      fill: "none",
      stroke: colors.solid,
      "stroke-width": 2,
      "stroke-dasharray": "10,6",
    }),
  );
  const apex = {
    x: 0.25 * from.x + 0.5 * mid.x + 0.25 * to.x,
    y: 0.25 * from.y + 0.5 * mid.y + 0.25 * to.y,
  };
  const width = badgeWidth(label);
  svgAppend(
    group,
    svgCreate("rect", {
      x: apex.x - width / 2,
      y: apex.y - BADGE.height / 2,
      width,
      height: BADGE.height,
      rx: BADGE.radius,
      ry: BADGE.radius,
      fill: colors.solid,
      stroke: "#ffffff",
      "stroke-width": 1,
    }),
  );
  const text = svgCreate("text", {
    x: apex.x,
    y: apex.y + BADGE.fontSize * 0.35,
    "text-anchor": "middle",
    "font-family": DEFAULT_FONT_FAMILY,
    "font-size": BADGE.fontSize,
    fill: BADGE_TEXT,
  });
  text.textContent = label;
  svgAppend(group, text);
  svgAppend(overlay, group);
}

function drawBanners(
  overlay: SVGElement,
  bounds: { x: number; y: number; width: number; height: number },
  model: GrcOverlayModel,
  targets: WeakMap<Element, InteractionTarget>,
): void {
  model.banners.forEach((banner, index) => {
    const colors = GRC_PALETTE[banner.signal.tone];
    const y = bounds.y - BANNER.offsetY - index * (BANNER.height + 6);
    const width = bannerWidth(banner.signal.text, bounds.width);
    const group = svgCreate("g", {
      class: "arctos-grc-banner",
      "aria-hidden": "true",
    });
    svgAttr(group, { [DECORATION_ATTR]: "banner" });
    svgAppend(
      group,
      svgCreate("rect", {
        x: bounds.x,
        y,
        width,
        height: BANNER.height,
        rx: 4,
        ry: 4,
        fill: colors.solid,
      }),
    );
    const text = svgCreate("text", {
      x: bounds.x + BANNER.paddingX,
      y: y + BANNER.height / 2 + BANNER.fontSize * 0.35,
      "font-family": DEFAULT_FONT_FAMILY,
      "font-size": BANNER.fontSize,
      fill: BADGE_TEXT,
    });
    text.textContent = `${TONE_GLYPH[banner.signal.tone]} ${banner.signal.text}`;
    svgAppend(group, text);
    svgAppend(overlay, group);
    register(group, targets, {
      type: "banner.activate",
      layerId: banner.layerId,
      text: banner.signal.text,
    });
  });
}

/**
 * Breite der Kopfzeile.
 *
 * Sie richtet sich nach ihrem Text, nicht nach dem Diagramm: ein abgeschnittener
 * Satz „7 von 18 Schritten betroffen, MTPD überschr…" ist schlimmer als eine
 * Kopfzeile, die über das Diagramm hinausragt.
 */
export function bannerWidth(text: string, diagramWidth: number): number {
  const estimated = text.length * BANNER.fontSize * 0.56 + BANNER.paddingX * 3;
  return Math.max(diagramWidth, 240, Math.ceil(estimated));
}

function drawLegend(
  overlay: SVGElement,
  bounds: { x: number; y: number; width: number; height: number },
  model: GrcOverlayModel,
): void {
  const group = svgCreate("g", {
    class: "arctos-grc-legend",
    "aria-hidden": "true",
  });
  svgAttr(group, { [DECORATION_ATTR]: "legend" });
  let y = bounds.y + bounds.height + LEGEND.offsetY;

  const title = svgCreate("text", {
    x: bounds.x,
    y,
    "font-family": DEFAULT_FONT_FAMILY,
    "font-size": LEGEND.fontSize + 1,
    "font-weight": "bold",
    fill: GRC_PALETTE.neutral.solid,
  });
  title.textContent = `Sicht „${model.view.title}" — Stand ${model.computedAt}`;
  svgAppend(group, title);
  y += LEGEND.rowHeight;

  for (const entry of model.legend) {
    const heading = svgCreate("text", {
      x: bounds.x,
      y,
      "font-family": DEFAULT_FONT_FAMILY,
      "font-size": LEGEND.fontSize,
      "font-weight": "bold",
      fill: GRC_PALETTE.neutral.solid,
    });
    heading.textContent = entry.title;
    svgAppend(group, heading);
    y += LEGEND.rowHeight;

    for (const row of entry.entries) {
      svgAppend(
        group,
        svgCreate("rect", {
          x: bounds.x + 6,
          y: y - LEGEND.swatch + 2,
          width: LEGEND.swatch,
          height: LEGEND.swatch,
          rx: 2,
          ry: 2,
          fill: GRC_PALETTE[row.tone].tint,
          stroke: GRC_PALETTE[row.tone].solid,
          "stroke-width": 1.5,
        }),
      );
      const text = svgCreate("text", {
        x: bounds.x + 6 + LEGEND.swatch + LEGEND.paddingX,
        y,
        "font-family": DEFAULT_FONT_FAMILY,
        "font-size": LEGEND.fontSize,
        fill: GRC_PALETTE.neutral.solid,
      });
      text.textContent = `${row.glyph} ${row.text}`;
      svgAppend(group, text);
      y += LEGEND.rowHeight;
    }
    y += 4;
  }
  svgAppend(overlay, group);
}

/* ------------------------------------------------------------------ *
 * Infrastruktur
 * ------------------------------------------------------------------ */

function register(
  node: Element,
  targets: WeakMap<Element, InteractionTarget>,
  interaction: GrcInteraction,
): void {
  targets.set(node, { interaction });
  node.setAttribute("data-grc-interactive", interaction.type);
  (node as SVGElement).style.cursor = "pointer";
}

/**
 * Hängt die GRC-Sätze an den zugänglichen Namen.
 *
 * Der ursprüngliche Name wird gesichert, damit ein Sichtwechsel ihn nicht
 * Schicht um Schicht verlängert. Dass der Name *eine* Zeichenkette ist und
 * nicht vier `aria-describedby`-Verweise, ist Absicht: Screenreader lesen den
 * Namen zuverlässig, Beschreibungen je nach Modus gar nicht.
 */
function applyAccessibleName(group: Element, suffix: string): void {
  const base =
    group.getAttribute(BASE_LABEL_ATTR) ?? group.getAttribute("aria-label");
  if (base === null) {
    return;
  }
  group.setAttribute(BASE_LABEL_ATTR, base);
  group.setAttribute("aria-label", suffix ? `${base} ${suffix}` : base);
}

function clearDecorations(root: Element): void {
  for (const node of Array.from(
    root.querySelectorAll(`[${DECORATION_ATTR}]`),
  )) {
    node.remove();
  }
  for (const node of Array.from(
    root.querySelectorAll(`[${BASE_LABEL_ATTR}]`),
  )) {
    const base = node.getAttribute(BASE_LABEL_ATTR);
    if (base !== null) {
      node.setAttribute("aria-label", base);
      node.removeAttribute(BASE_LABEL_ATTR);
    }
  }
  for (const node of Array.from(root.querySelectorAll(`[${BASE_FILL_ATTR}]`))) {
    const base = node.getAttribute(BASE_FILL_ATTR);
    if (base !== null) {
      node.setAttribute("fill", base);
      node.removeAttribute(BASE_FILL_ATTR);
    }
    node.removeAttribute("data-grc-interactive");
  }
  for (const node of Array.from(root.querySelectorAll("[data-grc-dimmed]"))) {
    node.removeAttribute("opacity");
    node.removeAttribute("data-grc-dimmed");
  }
}

function findSvg(root: Element): SVGSVGElement {
  if (root instanceof SVGSVGElement) {
    return root;
  }
  const svg = root.querySelector("svg");
  if (!svg) {
    throw new Error(
      "Kein <svg> gefunden — die GRC-Schicht braucht die Zeichenfläche.",
    );
  }
  return svg as SVGSVGElement;
}

/**
 * Wo die diagrammweite Dekoration hin soll.
 *
 * Auf der `diagram-js`-Fläche ist das die `.viewport`-Gruppe (sie trägt Zoom und
 * Verschiebung), im statischen SVG die Zeichenebene.
 */
function overlayParent(svg: SVGSVGElement): SVGElement {
  return (svg.querySelector(".viewport") ??
    svg.querySelector(".arctos-bpmn-layer") ??
    svg) as SVGElement;
}

function findElementGroup(root: Element, id: string): Element | null {
  return root.querySelector(`[data-element-id="${cssEscape(id)}"]`);
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

/**
 * Ankerpunkt eines Elements *im Koordinatensystem der Überlagerung*.
 *
 * Elementgruppen können eine eigene Translation tragen (`diagram-js` setzt sie,
 * der statische Renderer nicht). Sie wird hier ausgelesen und aufaddiert, damit
 * Bögen in beiden Einbettungen an derselben Stelle ankommen.
 */
function anchorPoint(
  root: Element,
  model: GrcOverlayModel,
  elementId: string,
): Point | undefined {
  const shape = model.context.graph.shapes.get(elementId);
  if (!shape) {
    return undefined;
  }
  const center = centerOf(shape);
  const group = findElementGroup(root, elementId);
  const offset = group ? translationOf(group) : { x: 0, y: 0 };
  return { x: center.x + offset.x, y: center.y + offset.y };
}

function translationOf(node: Element): Point {
  const transform = node.getAttribute("transform");
  if (!transform) {
    return { x: 0, y: 0 };
  }
  const matrix = /matrix\(([^)]+)\)/.exec(transform);
  if (matrix?.[1]) {
    const parts = matrix[1].split(/[\s,]+/).map(Number);
    return { x: parts[4] ?? 0, y: parts[5] ?? 0 };
  }
  const translate = /translate\(([^)]+)\)/.exec(transform);
  if (translate?.[1]) {
    const parts = translate[1].split(/[\s,]+/).map(Number);
    return { x: parts[0] ?? 0, y: parts[1] ?? 0 };
  }
  return { x: 0, y: 0 };
}

function ensureDefs(svg: SVGSVGElement): SVGDefsElement {
  const existing = svg.querySelector(`#${DEFS_ID}`);
  if (existing) {
    return existing as SVGDefsElement;
  }
  const defs = svgCreate("defs", { id: DEFS_ID });
  svgAttr(defs, { [DECORATION_ATTR]: "defs" });
  svg.insertBefore(defs, svg.firstChild);
  return defs;
}

/** Legt ein Schraffurmuster an (einmal je Ton und Dichte). */
function ensureHatch(
  defs: SVGDefsElement,
  tone: GrcTone,
  density: HatchDensity,
): string {
  const id = `arctos-grc-hatch-${tone}-${density}`;
  if (defs.querySelector(`#${id}`)) {
    return id;
  }
  const spacing = HATCH_SPACING[density];
  const pattern = svgCreate("pattern", {
    id,
    width: spacing,
    height: spacing,
    patternUnits: "userSpaceOnUse",
    patternTransform: "rotate(45)",
  });
  svgAppend(
    pattern,
    svgCreate("line", {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: spacing,
      stroke: GRC_PALETTE[tone].hatch,
      "stroke-width": density === "heavy" ? 1.6 : 1.1,
      opacity: 0.65,
    }),
  );
  svgAppend(defs, pattern);
  return id;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export { OVERLAY_CLASS, DECORATION_ATTR, BASE_LABEL_ATTR, BASE_FILL_ATTR };
