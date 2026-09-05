/// <reference lib="dom" />

/**
 * Ein Aufruf, ein Bild: Szene + GRC-Daten + Sicht → fertiges SVG.
 *
 * Das ist der Weg für den serverseitigen Export (PDF, PNG, Auditanhang) und für
 * die sichtbaren Belege in `test/grc/rendered/`. Er benutzt denselben
 * `StaticRenderer` wie die Zeichenschicht und dieselbe Dekoration wie der
 * Canvas — ein exportiertes Diagramm kann deshalb nicht anders aussehen als das
 * auf dem Bildschirm, und es enthält die GRC-Information *im SVG* (§4.5).
 */

import { buildScene, type Scene } from "../draw/scene";
import {
  renderScene,
  toSvgString,
  type StaticRenderOptions,
} from "../draw/StaticRenderer";
import type { ModdleElement } from "../draw/types";
import type { GrcOverlayData } from "./contract";
import { decorateGrc, type GrcDecorationResult } from "./decorate";
import { buildOverlayModel, type GrcOverlayModel } from "./engine";
import type { GrcFilter } from "./layers";
import { buildGrcTextAlternative } from "./text-alternative";
import type { GrcView } from "./views";
import { bannerWidth } from "./decorate";
import { BANNER, LEGEND } from "./tokens";

export interface GrcRenderOptions extends StaticRenderOptions {
  readonly view: GrcView;
  readonly extraLayers?: readonly string[];
  readonly filter?: GrcFilter;
  readonly selectedConflictId?: string;
  /** Legende unter das Bild zeichnen (Vorgabe: an — für Exportbilder sinnvoll). */
  readonly legend?: boolean;
}

export interface GrcRenderResult {
  readonly svg: SVGSVGElement;
  readonly scene: Scene;
  readonly model: GrcOverlayModel;
  readonly decoration: GrcDecorationResult;
}

/** Zeichnet eine bereits gebaute Szene mit GRC-Überlagerung. */
export function renderGrcScene(
  scene: Scene,
  data: GrcOverlayData,
  options: GrcRenderOptions,
): GrcRenderResult {
  const model = buildOverlayModel(scene, data, {
    view: options.view,
    ...(options.extraLayers ? { extraLayers: options.extraLayers } : {}),
    ...(options.filter ? { filter: options.filter } : {}),
    ...(options.selectedConflictId
      ? { selectedConflictId: options.selectedConflictId }
      : {}),
  });

  const legend = options.legend !== false;
  const bannerRows = model.banners.length;
  const legendRows = legend
    ? model.legend.reduce((sum, group) => sum + group.entries.length + 1, 1)
    : 0;

  // Rand so aufziehen, dass Kopfzeile, Legende, Pin-Schiene und die
  // überstehenden Badges vollständig im Bild liegen — ein abgeschnittener
  // Befund wäre schlimmer als keiner.
  const basePadding = options.padding ?? 28;
  const rendered = renderScene(scene, {
    ...options,
    padding: basePadding,
  });

  const decoration = decorateGrc({
    root: rendered.svg,
    model,
    legend,
    banner: true,
  });

  const widestBanner = model.banners.reduce(
    (max, banner) => Math.max(max, bannerWidth(banner.signal.text, 0)),
    0,
  );
  expandViewBox(rendered.svg, {
    top: bannerRows * (BANNER.height + 6) + BANNER.offsetY,
    bottom: legendRows * LEGEND.rowHeight + LEGEND.offsetY,
    left: 40,
    right: Math.max(40, widestBanner - scene.bounds.width + 40),
  });

  const alternative = buildGrcTextAlternative(scene, model);
  const desc = rendered.svg.querySelector("desc");
  if (desc) {
    desc.textContent = `${alternative.notes.join(" ")} ${alternative.prose}`;
  }

  return { svg: rendered.svg, scene, model, decoration };
}

/** Baut die Szene aus `definitions` und zeichnet sie mit GRC-Überlagerung. */
export function renderGrcDefinitions(
  definitions: ModdleElement,
  data: GrcOverlayData,
  options: GrcRenderOptions,
): GrcRenderResult {
  return renderGrcScene(buildScene(definitions), data, options);
}

/** Serialisiert das Ergebnis als eigenständige SVG-Datei. */
export function toGrcSvgString(result: GrcRenderResult): string {
  return toSvgString({
    svg: result.svg,
    scene: result.scene,
    elementCount: result.scene.shapes.length + result.scene.connections.length,
  });
}

/** Vergrößert `viewBox`, `width` und `height` um die Dekorationsränder. */
function expandViewBox(
  svg: SVGSVGElement,
  margin: { top: number; bottom: number; left: number; right: number },
): void {
  const viewBox = svg.getAttribute("viewBox");
  if (!viewBox) {
    return;
  }
  const parts = viewBox.split(/[\s,]+/).map(Number);
  const [x, y, width, height] = parts;
  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined
  ) {
    return;
  }
  const nextWidth = width + margin.left + margin.right;
  const nextHeight = height + margin.top + margin.bottom;
  svg.setAttribute(
    "viewBox",
    `${String(x - margin.left)} ${String(y - margin.top)} ${String(nextWidth)} ${String(nextHeight)}`,
  );
  svg.setAttribute("width", String(nextWidth));
  svg.setAttribute("height", String(nextHeight));

  // Der Hintergrund ist das erste `rect` nach `title`/`desc`; er muss mitwachsen,
  // sonst steht die Legende auf durchsichtigem Grund.
  const background = svg.querySelector("rect");
  if (background && background.getAttribute("aria-hidden") === "true") {
    background.setAttribute("x", String(x - margin.left));
    background.setAttribute("y", String(y - margin.top));
    background.setAttribute("width", String(nextWidth));
    background.setAttribute("height", String(nextHeight));
  }
}
