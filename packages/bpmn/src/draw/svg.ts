/// <reference lib="dom" />

/**
 * Dünne SVG-DOM-Hilfen.
 *
 * Bewusst direkt auf `document.createElementNS` statt auf `tiny-svg`: die
 * Zeichenschicht bestimmt so die Attributreihenfolge selbst (wichtig für die
 * Serialisierung in `StaticRenderer`) und läuft ohne weitere Laufzeitabhängigkeit.
 */

export const SVG_NS = "http://www.w3.org/2000/svg";

export type SvgAttrs = Readonly<Record<string, string | number | undefined>>;

export function svgCreate<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs?: SvgAttrs,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(
    SVG_NS,
    name,
  ) as SVGElementTagNameMap[K];
  if (attrs) {
    svgAttr(node, attrs);
  }
  return node;
}

export function svgAttr<T extends SVGElement>(node: T, attrs: SvgAttrs): T {
  for (const key of Object.keys(attrs)) {
    const value = attrs[key];
    if (value === undefined) {
      continue;
    }
    node.setAttribute(
      key,
      typeof value === "number" ? formatNumber(value) : value,
    );
  }
  return node;
}

export function svgAppend<T extends Node>(parent: Node, child: T): T {
  parent.appendChild(child);
  return child;
}

export function svgClasses<T extends SVGElement>(
  node: T,
  ...classNames: string[]
): T {
  const existing = node.getAttribute("class");
  const all = (existing ? existing.split(/\s+/) : [])
    .concat(classNames)
    .filter(Boolean);
  node.setAttribute("class", Array.from(new Set(all)).join(" "));
  return node;
}

/**
 * Zahlformatierung für Pfad- und Attributwerte.
 *
 * Rundet auf drei Nachkommastellen und normalisiert `-0`. NaN/Infinity werden
 * *nicht* stillschweigend zu 0 — der Renderer soll bei kaputter Geometrie laut
 * scheitern statt unsichtbaren Unsinn zu zeichnen (Testkriterium „keine NaN").
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`nicht-endliche Koordinate: ${String(value)}`);
  }
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

/** Baut einen `d`-Pfad aus Segmenten; Zahlen werden einheitlich formatiert. */
export function path(...segments: Array<string | number>): string {
  return segments
    .map((segment) =>
      typeof segment === "number" ? formatNumber(segment) : segment,
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ein geschlossener Polygonzug als Pfad. */
export function polygonPath(
  points: ReadonlyArray<readonly [number, number]>,
): string {
  const parts: Array<string | number> = [];
  points.forEach(([x, y], index) => {
    parts.push(index === 0 ? "M" : "L", x, y);
  });
  parts.push("z");
  return path(...parts);
}

/** Rechteck mit abgerundeten Ecken. */
export function roundRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  return path(
    "M",
    x + r,
    y,
    "L",
    x + width - r,
    y,
    "A",
    r,
    r,
    0,
    0,
    1,
    x + width,
    y + r,
    "L",
    x + width,
    y + height - r,
    "A",
    r,
    r,
    0,
    0,
    1,
    x + width - r,
    y + height,
    "L",
    x + r,
    y + height,
    "A",
    r,
    r,
    0,
    0,
    1,
    x,
    y + height - r,
    "L",
    x,
    y + r,
    "A",
    r,
    r,
    0,
    0,
    1,
    x + r,
    y,
    "z",
  );
}

/** Kreis als Pfad (für `getShapePath`, wo diagram-js einen String erwartet). */
export function circlePath(cx: number, cy: number, r: number): string {
  return path(
    "M",
    cx,
    cy - r,
    "A",
    r,
    r,
    0,
    1,
    1,
    cx,
    cy + r,
    "A",
    r,
    r,
    0,
    1,
    1,
    cx,
    cy - r,
    "z",
  );
}

/** Offener Linienzug (Kanten). */
export function polylinePath(
  points: ReadonlyArray<{ x: number; y: number }>,
): string {
  if (points.length === 0) {
    throw new Error("Kante ohne Wegpunkte");
  }
  const parts: Array<string | number> = [];
  points.forEach((p, index) => {
    parts.push(index === 0 ? "M" : "L", p.x, p.y);
  });
  return path(...parts);
}
