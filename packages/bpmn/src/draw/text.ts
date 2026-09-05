/// <reference lib="dom" />

import { svgAppend, svgAttr, svgCreate } from "./svg";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  LINE_HEIGHT_FACTOR,
} from "./theme";

/**
 * Textlayout ohne DOM-Messung.
 *
 * Begründung: der Renderer muss auch dort umbrechen, wo nicht gemessen werden
 * kann — in jsdom (Tests), im Worker (serverseitiges PDF/PNG) und beim
 * SVG-Export. `getComputedTextLength()` existiert in jsdom nicht und ist im
 * Browser zudem teuer (Reflow je Aufruf). Deshalb eine deterministische
 * Breitenschätzung über eine Tabelle relativer Vorschubbreiten einer
 * Grotesk-Schrift (Arial/Helvetica/Liberation Sans, Werte in em).
 *
 * Die Schätzung ist bewusst leicht großzügig: zu breit geschätzt bricht früher
 * um (Text bleibt im Element), zu schmal geschätzt lässt Text überstehen.
 */

const DEFAULT_ADVANCE = 0.55;

const ADVANCE: Readonly<Record<string, number>> = {
  " ": 0.278,
  "!": 0.278,
  '"': 0.355,
  "#": 0.556,
  $: 0.556,
  "%": 0.889,
  "&": 0.667,
  "'": 0.191,
  "(": 0.333,
  ")": 0.333,
  "*": 0.389,
  "+": 0.584,
  ",": 0.278,
  "-": 0.333,
  ".": 0.278,
  "/": 0.278,
  ":": 0.278,
  ";": 0.278,
  "<": 0.584,
  "=": 0.584,
  ">": 0.584,
  "?": 0.556,
  "@": 1.015,
  "[": 0.278,
  "\\": 0.278,
  "]": 0.278,
  "^": 0.469,
  _: 0.556,
  "`": 0.333,
  "{": 0.334,
  "|": 0.26,
  "}": 0.334,
  "~": 0.584,
  "0": 0.556,
  "1": 0.556,
  "2": 0.556,
  "3": 0.556,
  "4": 0.556,
  "5": 0.556,
  "6": 0.556,
  "7": 0.556,
  "8": 0.556,
  "9": 0.556,
  a: 0.556,
  b: 0.556,
  c: 0.5,
  d: 0.556,
  e: 0.556,
  f: 0.278,
  g: 0.556,
  h: 0.556,
  i: 0.222,
  j: 0.222,
  k: 0.5,
  l: 0.222,
  m: 0.833,
  n: 0.556,
  o: 0.556,
  p: 0.556,
  q: 0.556,
  r: 0.333,
  s: 0.5,
  t: 0.278,
  u: 0.556,
  v: 0.5,
  w: 0.722,
  x: 0.5,
  y: 0.5,
  z: 0.5,
  A: 0.667,
  B: 0.667,
  C: 0.722,
  D: 0.722,
  E: 0.667,
  F: 0.611,
  G: 0.778,
  H: 0.722,
  I: 0.278,
  J: 0.5,
  K: 0.667,
  L: 0.556,
  M: 0.833,
  N: 0.722,
  O: 0.778,
  P: 0.667,
  Q: 0.778,
  R: 0.722,
  S: 0.667,
  T: 0.611,
  U: 0.722,
  V: 0.667,
  W: 0.944,
  X: 0.667,
  Y: 0.667,
  Z: 0.611,
  ä: 0.556,
  ö: 0.556,
  ü: 0.556,
  Ä: 0.667,
  Ö: 0.778,
  Ü: 0.722,
  ß: 0.556,
  "–": 0.556,
  "—": 1,
  "„": 0.333,
  "“": 0.333,
  "”": 0.333,
  "…": 1,
};

/** Geschätzte Breite eines Textes in px. */
export function measureText(text: string, fontSize: number): number {
  let em = 0;
  for (const char of text) {
    em += ADVANCE[char] ?? DEFAULT_ADVANCE;
  }
  return em * fontSize;
}

export interface TextLayoutOptions {
  /** Verfügbare Breite in px. */
  readonly width: number;
  readonly fontSize?: number;
  readonly lineHeightFactor?: number;
  /** Höhenbegrenzung; überzählige Zeilen werden mit „…" gekürzt. */
  readonly maxHeight?: number;
}

export interface TextLayout {
  readonly lines: readonly string[];
  readonly lineHeight: number;
  readonly fontSize: number;
  /** Breite der breitesten Zeile. */
  readonly width: number;
  readonly height: number;
}

/**
 * Bricht `text` auf `width` um.
 *
 * Reihenfolge der Umbruchstellen — strikt, nicht „bevorzugt":
 *
 * 1. **Wortgrenzen.** Solange ein Wort als Ganzes in eine Zeile passt, wird es
 *    nie zerteilt. Das ist der Normalfall.
 * 2. **Trennstellen im Wort** (`-`, `/`, `_`, `.`, `,`, `:`, `;` und der
 *    Übergang Kleinbuchstabe→Großbuchstabe) — nur für Wörter, die allein
 *    breiter als die Zeile sind. So brechen `Antrags-Prüfung`, Dateipfade und
 *    `camelCaseBezeichner` an lesbaren Stellen.
 * 3. **Harter Bruch im Wort.** Erst wenn auch ein einzelnes Wortstück ohne
 *    Trennstelle breiter als die Zeile ist. Das Stück bekommt dann einen
 *    Trennstrich angehängt, damit die Fortsetzung in der nächsten Zeile als
 *    Fortsetzung erkennbar bleibt und nicht als eigenes Wort gelesen wird.
 *
 * Vorhandene Zeilenumbrüche bleiben erhalten.
 */
export function layoutText(
  text: string,
  options: TextLayoutOptions,
): TextLayout {
  const fontSize = options.fontSize ?? DEFAULT_FONT_SIZE;
  const lineHeight =
    fontSize * (options.lineHeightFactor ?? LINE_HEIGHT_FACTOR);
  const available = Math.max(options.width, fontSize);

  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const trimmed = paragraph.trim();
    if (trimmed === "") {
      lines.push("");
      continue;
    }
    lines.push(...wrapParagraph(trimmed, available, fontSize));
  }

  let result = lines;
  if (options.maxHeight !== undefined) {
    const maxLines = Math.max(1, Math.floor(options.maxHeight / lineHeight));
    if (lines.length > maxLines) {
      result = lines.slice(0, maxLines);
      const last = result[maxLines - 1];
      if (last !== undefined) {
        result[maxLines - 1] = truncate(last, available, fontSize);
      }
    }
  }

  const width = result.reduce(
    (max, line) => Math.max(max, measureText(line, fontSize)),
    0,
  );
  return {
    lines: result,
    lineHeight,
    fontSize,
    width,
    height: result.length * lineHeight,
  };
}

/** Trennstrich, der bei einem harten Bruch im Wort angehängt wird. */
const SOFT_HYPHEN_MARK = "-";

function wrapParagraph(
  paragraph: string,
  available: number,
  fontSize: number,
): string[] {
  const words = paragraph.split(/\s+/).filter((word) => word.length > 0);
  const lines: string[] = [];
  let current = "";

  const flush = (): void => {
    if (current !== "") {
      lines.push(current);
      current = "";
    }
  };

  for (const word of words) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (measureText(candidate, fontSize) <= available) {
      current = candidate;
      continue;
    }

    // Das Wort passt nicht mehr in die laufende Zeile. Es wird **nicht**
    // zerteilt, solange es allein in eine Zeile passt — das ist die
    // Wortgrenzen-Regel.
    flush();
    if (measureText(word, fontSize) <= available) {
      current = word;
      continue;
    }

    // Nur jetzt — ein einzelnes Wort ist breiter als die Zeile — wird im Wort
    // getrennt. Die letzte Teilzeile bleibt offen, damit ihr die folgenden
    // Wörter noch zulaufen können; sie ist durch den Trennstrich der
    // Vorgängerzeile eindeutig als Fortsetzung markiert.
    const pieces = breakLongWord(word, available, fontSize);
    const last = pieces.pop();
    lines.push(...pieces);
    current = last ?? "";
  }

  flush();
  return lines.length > 0 ? lines : [""];
}

/**
 * Zerlegt genau ein Wort, das allein breiter als `available` ist.
 *
 * Zuerst an den Trennstellen im Wort, dann — und nur wenn ein so entstandenes
 * Stück immer noch zu breit ist — hart, mit angehängtem Trennstrich.
 */
function breakLongWord(
  word: string,
  available: number,
  fontSize: number,
): string[] {
  const lines: string[] = [];
  let current = "";

  for (const segment of splitAtBreakOpportunities(word)) {
    const candidate = current + segment;
    if (measureText(candidate, fontSize) <= available) {
      current = candidate;
      continue;
    }
    if (current !== "") {
      lines.push(current);
      current = "";
    }
    if (measureText(segment, fontSize) <= available) {
      current = segment;
      continue;
    }
    // Auch das einzelne Stück ist zu breit: harter Bruch mit Trennstrich.
    const pieces = hardBreak(segment, available, fontSize);
    const last = pieces.pop();
    lines.push(...pieces);
    current = last ?? "";
  }

  if (current !== "") {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [word];
}

/**
 * Zerlegt ein Wort an seinen inneren Trennstellen, ohne Zeichen zu verlieren.
 *
 * Ein Trennzeichen bleibt am Ende des Stücks, das es abschließt
 * (`Antrags-Prüfung` → `Antrags-`, `Prüfung`); vor einem Großbuchstaben nach
 * einem Kleinbuchstaben wird davor getrennt (`camelCase` → `camel`, `Case`).
 */
function splitAtBreakOpportunities(word: string): string[] {
  const separators = new Set(["-", "/", "_", ".", ",", ":", ";", "\\"]);
  const segments: string[] = [];
  let current = "";
  let previous = "";

  for (const char of word) {
    const isCamelBoundary =
      current !== "" &&
      previous !== "" &&
      previous === previous.toLowerCase() &&
      previous !== previous.toUpperCase() &&
      char === char.toUpperCase() &&
      char !== char.toLowerCase();
    if (isCamelBoundary) {
      segments.push(current);
      current = "";
    }
    current += char;
    if (separators.has(char)) {
      segments.push(current);
      current = "";
    }
    previous = char;
  }
  if (current !== "") {
    segments.push(current);
  }
  return segments.length > 0 ? segments : [word];
}

/**
 * Letzte Instanz: ein Stück ohne jede Trennstelle, das breiter als die Zeile
 * ist (lange IDs, Prüfsummen, URLs ohne Trenner). Jedes Stück außer dem
 * letzten bekommt einen Trennstrich, der in die Breite mit eingerechnet wird.
 */
function hardBreak(
  segment: string,
  available: number,
  fontSize: number,
): string[] {
  const chars = [...segment];
  const pieces: string[] = [];
  let current = "";

  for (const char of chars) {
    const candidate = current + char;
    if (
      current !== "" &&
      measureText(candidate + SOFT_HYPHEN_MARK, fontSize) > available
    ) {
      pieces.push(current + SOFT_HYPHEN_MARK);
      current = char;
      continue;
    }
    current = candidate;
  }
  if (current !== "") {
    pieces.push(current);
  }
  return pieces.length > 0 ? pieces : [segment];
}

function truncate(line: string, available: number, fontSize: number): string {
  let text = line;
  while (text.length > 1 && measureText(`${text}…`, fontSize) > available) {
    text = text.slice(0, -1);
  }
  return `${text.trimEnd()}…`;
}

export type TextAlign = "center" | "left" | "right";
export type TextVerticalAlign = "middle" | "top" | "bottom";

export interface RenderTextOptions extends TextLayoutOptions {
  readonly box: { x: number; y: number; width: number; height: number };
  readonly align?: TextAlign;
  readonly verticalAlign?: TextVerticalAlign;
  readonly fill?: string;
  readonly fontFamily?: string;
  readonly className?: string;
  /** Dreht den Text um den Mittelpunkt der Box (Pool-/Lane-Beschriftung). */
  readonly rotate?: number;
}

/**
 * Zeichnet umgebrochenen Text als `<text>` mit einem `<tspan>` je Zeile.
 *
 * Gibt `null` zurück, wenn nichts zu zeichnen ist — Aufrufer müssen keine
 * Leerbeschriftungen abfangen.
 */
export function renderText(
  parent: SVGElement,
  text: string,
  options: RenderTextOptions,
): SVGTextElement | null {
  const content = text.trim();
  if (content === "") {
    return null;
  }

  const layout = layoutText(content, options);
  const align = options.align ?? "center";
  const verticalAlign = options.verticalAlign ?? "middle";
  const box = options.box;

  const anchorX =
    align === "center"
      ? box.x + box.width / 2
      : align === "left"
        ? box.x
        : box.x + box.width;
  const textAnchor =
    align === "center" ? "middle" : align === "left" ? "start" : "end";

  const blockHeight = layout.height;
  const top =
    verticalAlign === "middle"
      ? box.y + (box.height - blockHeight) / 2
      : verticalAlign === "top"
        ? box.y
        : box.y + box.height - blockHeight;

  const node = svgCreate("text", {
    "font-family": options.fontFamily ?? DEFAULT_FONT_FAMILY,
    "font-size": layout.fontSize,
    fill: options.fill ?? "#12181f",
    "text-anchor": textAnchor,
    "dominant-baseline": "alphabetic",
    class: options.className ?? "djs-label",
    "xml:space": "preserve",
  });

  if (options.rotate) {
    svgAttr(node, {
      transform: `rotate(${options.rotate} ${box.x + box.width / 2} ${box.y + box.height / 2})`,
    });
  }

  layout.lines.forEach((line, index) => {
    const tspan = svgCreate("tspan", {
      x: anchorX,
      // Grundlinie: Zeilenoberkante + Zeilenhöhe abzüglich Unterlänge.
      y: top + index * layout.lineHeight + layout.fontSize * 0.85,
    });
    tspan.textContent = line;
    svgAppend(node, tspan);
  });

  svgAppend(parent, node);
  return node;
}
