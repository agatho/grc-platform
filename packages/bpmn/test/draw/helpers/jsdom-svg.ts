/// <reference lib="dom" />

/**
 * SVG-Geometrie für jsdom.
 *
 * jsdom setzt das SVG-DOM nur strukturell um: `getBBox`, `getCTM`,
 * `createSVGPoint`, `createSVGTransform` und die `transform.baseVal`-Liste
 * fehlen vollständig. `diagram-js` braucht genau diese fünf, um Shapes zu
 * positionieren und den Viewport zu berechnen.
 *
 * Diese Datei füllt sie so weit, dass ein Diagramm in jsdom aufgebaut und
 * geprüft werden kann. **Ehrliche Einordnung:** es ist eine Rechenhilfe, kein
 * Layout-Engine-Ersatz. Was hier *nicht* geprüft werden kann, steht am Ende der
 * Datei und im Messprotokoll.
 */

interface MatrixLike {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

class FakeMatrix implements MatrixLike {
  constructor(
    public a = 1,
    public b = 0,
    public c = 0,
    public d = 1,
    public e = 0,
    public f = 0,
  ) {}

  multiply(m: MatrixLike): FakeMatrix {
    return new FakeMatrix(
      this.a * m.a + this.c * m.b,
      this.b * m.a + this.d * m.b,
      this.a * m.c + this.c * m.d,
      this.b * m.c + this.d * m.d,
      this.a * m.e + this.c * m.f + this.e,
      this.b * m.e + this.d * m.f + this.f,
    );
  }

  inverse(): FakeMatrix {
    const det = this.a * this.d - this.b * this.c;
    return new FakeMatrix(
      this.d / det,
      -this.b / det,
      -this.c / det,
      this.a / det,
      (this.c * this.f - this.d * this.e) / det,
      (this.b * this.e - this.a * this.f) / det,
    );
  }

  translate(x: number, y: number): FakeMatrix {
    return this.multiply(new FakeMatrix(1, 0, 0, 1, x, y));
  }

  scale(s: number): FakeMatrix {
    return this.multiply(new FakeMatrix(s, 0, 0, s, 0, 0));
  }

  scaleNonUniform(sx: number, sy: number): FakeMatrix {
    return this.multiply(new FakeMatrix(sx, 0, 0, sy, 0, 0));
  }
}

class FakeTransform {
  matrix: FakeMatrix = new FakeMatrix();
  type = 1;

  setMatrix(m: MatrixLike): void {
    this.matrix = new FakeMatrix(m.a, m.b, m.c, m.d, m.e, m.f);
  }

  setTranslate(x: number, y: number): void {
    this.matrix = new FakeMatrix(1, 0, 0, 1, x, y);
  }

  setScale(sx: number, sy: number): void {
    this.matrix = new FakeMatrix(sx, 0, 0, sy, 0, 0);
  }

  setRotate(angle: number): void {
    const rad = (angle * Math.PI) / 180;
    this.matrix = new FakeMatrix(
      Math.cos(rad),
      Math.sin(rad),
      -Math.sin(rad),
      Math.cos(rad),
      0,
      0,
    );
  }
}

interface TransformList {
  _items: FakeTransform[];
  readonly numberOfItems: number;
  clear(): void;
  appendItem(t: FakeTransform): FakeTransform;
  getItem(i: number): FakeTransform | undefined;
  initialize(t: FakeTransform): FakeTransform;
  consolidate(): FakeTransform | null;
  createSVGTransformFromMatrix(m: MatrixLike): FakeTransform;
}

const GEOMETRY_ATTRS = [
  "x",
  "y",
  "width",
  "height",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
];

let installed = false;

/** Installiert die Polyfills einmalig im aktuellen jsdom-Fenster. */
export function installSvgPolyfills(): void {
  if (installed) {
    return;
  }
  installed = true;

  installCssEscape();

  const svgProto = SVGElement.prototype as unknown as Record<string, unknown>;
  const svgSvgProto = SVGSVGElement.prototype as unknown as Record<
    string,
    unknown
  >;

  (globalThis as unknown as Record<string, unknown>)["SVGMatrix"] = FakeMatrix;
  (globalThis as unknown as Record<string, unknown>)["SVGTransform"] =
    FakeTransform;

  svgSvgProto["createSVGMatrix"] = function (): FakeMatrix {
    return new FakeMatrix();
  };
  svgSvgProto["createSVGTransform"] = function (): FakeTransform {
    return new FakeTransform();
  };
  svgSvgProto["createSVGPoint"] = function (): {
    x: number;
    y: number;
    matrixTransform(m: MatrixLike): { x: number; y: number };
  } {
    return {
      x: 0,
      y: 0,
      matrixTransform(m: MatrixLike) {
        return {
          x: m.a * this.x + m.c * this.y + m.e,
          y: m.b * this.x + m.d * this.y + m.f,
        };
      },
    };
  };

  Object.defineProperty(SVGElement.prototype, "transform", {
    configurable: true,
    get(this: SVGElement): { baseVal: TransformList; animVal: TransformList } {
      const self = this as SVGElement & {
        __transformList?: TransformList;
        __transformAttr?: string;
      };
      if (!self.__transformList) {
        const sync = (): void => {
          const list = self.__transformList;
          if (!list || list._items.length === 0) {
            self.removeAttribute("transform");
            self.__transformAttr = undefined;
            return;
          }
          self.setAttribute(
            "transform",
            list._items
              .map((t) => {
                const m = t.matrix;
                return `matrix(${String(m.a)},${String(m.b)},${String(m.c)},${String(
                  m.d,
                )},${String(m.e)},${String(m.f)})`;
              })
              .join(" "),
          );
        };
        const list: TransformList = {
          _items: [],
          get numberOfItems() {
            return this._items.length;
          },
          clear() {
            this._items = [];
            sync();
          },
          appendItem(t) {
            this._items.push(t);
            sync();
            return t;
          },
          getItem(i) {
            return this._items[i];
          },
          initialize(t) {
            this._items = [t];
            sync();
            return t;
          },
          consolidate() {
            return this._items[0] ?? null;
          },
          createSVGTransformFromMatrix(m) {
            const t = new FakeTransform();
            t.setMatrix(m);
            return t;
          },
        };
        self.__transformList = list;
      }

      // `diagram-js` schreibt das `transform`-Attribut an manchen Stellen direkt
      // (`setCTM` in `Canvas.js`) statt über die Transformliste. Im Browser hält
      // das SVG-DOM beides synchron; in jsdom muss die Liste deshalb aus dem
      // Attribut nachgezogen werden — sonst meldet `canvas.zoom()` NaN bzw. den
      // alten Wert.
      const current = self.getAttribute("transform");
      if (current !== (self.__transformAttr ?? null)) {
        self.__transformList._items = current
          ? parseTransformAttribute(current)
          : [];
        self.__transformAttr = current ?? undefined;
      }
      return { baseVal: self.__transformList, animVal: self.__transformList };
    },
  });

  svgProto["getCTM"] = function (this: SVGElement): FakeMatrix {
    return matrixOf(this);
  };
  svgProto["getScreenCTM"] = function (this: SVGElement): FakeMatrix {
    return matrixOf(this);
  };

  /**
   * `getBBox` rechnet die Vereinigung der Geometrie aller Nachfahren aus.
   *
   * Reicht für `fit-viewport` und die Nullflächenprüfung; berücksichtigt
   * *keine* Strichstärken, keine Schriftmetrik und keine Rotationen.
   */
  svgProto["getBBox"] = function (this: SVGElement): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const box = unionBBox(this, new FakeMatrix());
    if (!box) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    return {
      x: box.minX,
      y: box.minY,
      width: box.maxX - box.minX,
      height: box.maxY - box.minY,
    };
  };

  /**
   * `clientWidth`/`clientHeight` sind in jsdom immer 0, weil es kein Layout gibt.
   * `diagram-js` leitet daraus die Viewport-Größe ab (`Canvas.getSize()`), und
   * eine Größe von 0 macht jede Zoomrechnung zu NaN. Hier wird deshalb die
   * Inline-Breite/-Höhe des Elements als Layoutgröße gelesen.
   */
  for (const property of ["clientWidth", "clientHeight"] as const) {
    Object.defineProperty(HTMLElement.prototype, property, {
      configurable: true,
      get(this: HTMLElement): number {
        const value =
          property === "clientWidth" ? this.style.width : this.style.height;
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
        const parent = this.parentElement;
        return parent
          ? property === "clientWidth"
            ? parent.clientWidth
            : parent.clientHeight
          : 0;
      },
    });
  }

  Element.prototype.getBoundingClientRect = function (): DOMRect {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1200,
      bottom: 800,
      width: 1200,
      height: 800,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

/** Liest `matrix(...)`, `translate(...)`, `scale(...)` und `rotate(...)`. */
function parseTransformAttribute(value: string): FakeTransform[] {
  const items: FakeTransform[] = [];
  const pattern = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    const name = match[1];
    const args = (match[2] ?? "")
      .split(/[\s,]+/)
      .filter((part) => part !== "")
      .map(Number);
    const transform = new FakeTransform();
    if (name === "matrix" && args.length === 6) {
      transform.setMatrix({
        a: args[0] ?? 1,
        b: args[1] ?? 0,
        c: args[2] ?? 0,
        d: args[3] ?? 1,
        e: args[4] ?? 0,
        f: args[5] ?? 0,
      });
    } else if (name === "translate") {
      transform.setTranslate(args[0] ?? 0, args[1] ?? 0);
    } else if (name === "scale") {
      transform.setScale(args[0] ?? 1, args[1] ?? args[0] ?? 1);
    } else if (name === "rotate") {
      transform.setRotate(args[0] ?? 0);
    }
    items.push(transform);
  }
  return items;
}

function matrixOf(node: SVGElement): FakeMatrix {
  // Zugriff über den Getter, damit ein direkt gesetztes Attribut eingelesen wird.
  void (node as unknown as { transform: unknown }).transform;
  const list = (node as SVGElement & { __transformList?: TransformList })
    .__transformList;
  const own = list?._items.reduce<FakeMatrix>(
    (acc, t) => acc.multiply(t.matrix),
    new FakeMatrix(),
  );
  return own ?? new FakeMatrix();
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function unionBBox(node: Element, parentMatrix: FakeMatrix): Box | null {
  const matrix =
    node instanceof SVGElement
      ? parentMatrix.multiply(matrixOf(node))
      : parentMatrix;

  let box: Box | null = localBox(node);
  if (box) {
    box = transformBox(box, matrix);
  }

  for (const child of Array.from(node.children)) {
    const childBox = unionBBox(child, matrix);
    if (!childBox) {
      continue;
    }
    box = box
      ? {
          minX: Math.min(box.minX, childBox.minX),
          minY: Math.min(box.minY, childBox.minY),
          maxX: Math.max(box.maxX, childBox.maxX),
          maxY: Math.max(box.maxY, childBox.maxY),
        }
      : childBox;
  }
  return box;
}

function transformBox(box: Box, m: FakeMatrix): Box {
  const points = [
    [box.minX, box.minY],
    [box.maxX, box.minY],
    [box.minX, box.maxY],
    [box.maxX, box.maxY],
  ] as const;
  const xs = points.map(([x, y]) => m.a * x + m.c * y + m.e);
  const ys = points.map(([x, y]) => m.b * x + m.d * y + m.f);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function localBox(node: Element): Box | null {
  const name = node.localName;
  const num = (attribute: string): number =>
    Number(node.getAttribute(attribute) ?? "0");

  if (name === "rect") {
    if (!GEOMETRY_ATTRS.some((a) => node.hasAttribute(a))) {
      return null;
    }
    return {
      minX: num("x"),
      minY: num("y"),
      maxX: num("x") + num("width"),
      maxY: num("y") + num("height"),
    };
  }
  if (name === "circle") {
    const r = num("r");
    return {
      minX: num("cx") - r,
      minY: num("cy") - r,
      maxX: num("cx") + r,
      maxY: num("cy") + r,
    };
  }
  if (name === "ellipse") {
    return {
      minX: num("cx") - num("rx"),
      minY: num("cy") - num("ry"),
      maxX: num("cx") + num("rx"),
      maxY: num("cy") + num("ry"),
    };
  }
  if (name === "path") {
    return pathBox(node.getAttribute("d") ?? "");
  }
  if (name === "line") {
    return {
      minX: Math.min(num("x1"), num("x2")),
      minY: Math.min(num("y1"), num("y2")),
      maxX: Math.max(num("x1"), num("x2")),
      maxY: Math.max(num("y1"), num("y2")),
    };
  }
  if (name === "text" || name === "tspan") {
    if (!node.hasAttribute("x") || !node.hasAttribute("y")) {
      return null;
    }
    return {
      minX: num("x"),
      minY: num("y") - 10,
      maxX: num("x"),
      maxY: num("y"),
    };
  }
  return null;
}

/** Grobe Hülle eines Pfads: alle Zahlenpaare des `d`-Attributs. */
function pathBox(d: string): Box | null {
  const numbers = d.match(/-?\d+(\.\d+)?/g);
  if (!numbers || numbers.length < 2) {
    return null;
  }
  const values = numbers.map(Number);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i + 1 < values.length; i += 2) {
    const x = values[i];
    const y = values[i + 1];
    if (x !== undefined && y !== undefined) {
      xs.push(x);
      ys.push(y);
    }
  }
  if (xs.length === 0) {
    return null;
  }
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/**
 * `CSS.escape` fehlt in jsdom.
 *
 * `diagram-js` benutzt es beim Aufbau von Palette und Kontextmenü, um den
 * Gruppennamen in einen Selektor zu setzen (`[data-group=…]`). Ohne die
 * Funktion bricht der Aufbau ab — und zwar in einem Ereignis-Zuhörer, also
 * ohne dass ein Test es als Fehler sähe: die Palette wäre einfach leer. Eine
 * Lücke der Prüfumgebung, nicht des Produktivcodes; deshalb steht der Ersatz
 * hier bei den übrigen jsdom-Ersatzteilen und nicht in `src/`.
 */
export function installCssEscape(): void {
  const scope = globalThis as unknown as {
    CSS?: { escape?: (value: string) => string };
  };
  if (typeof scope.CSS?.escape === "function") return;
  const escape = (value: string): string =>
    String(value).replace(/[^\w-]/g, (char) => `\\${char}`);
  scope.CSS = { ...(scope.CSS ?? {}), escape };
}

/**
 * Was jsdom **nicht** prüfen kann (bewusst hier dokumentiert, damit es im
 * Messprotokoll nicht untergeht):
 *
 * - **Schriftmetrik.** Es gibt keine Schriftarten; `getComputedTextLength()`
 *   existiert nicht. Der Zeilenumbruch wird deshalb gegen die eigene
 *   Breitenschätzung geprüft, nicht gegen echtes Rendering.
 * - **Farbkontrast.** `axe-core` schaltet `color-contrast` in jsdom selbst ab,
 *   weil es die tatsächlichen Farben nicht berechnen kann. Kontrastregeln
 *   (Plan §4.4) brauchen einen echten Browser.
 * - **Fokus-Sichtbarkeit** und die Frage, ob ein Element im Viewport liegt.
 * - **Screenreader-Ausgabe.** Dass eine Live-Region existiert und ihren Text
 *   ändert, ist prüfbar; dass sie vorgelesen wird, nicht.
 * - **Pixelvergleich.** Es gibt kein Rasterbild. Formen werden über Attribute
 *   und Pfaddaten geprüft, nicht über ein Bild.
 */
export const JSDOM_LIMITATIONS: readonly string[] = [
  "Schriftmetrik (getComputedTextLength) — Umbruch nur gegen die eigene Schätzung prüfbar",
  "Farbkontrast — axe-core deaktiviert color-contrast in jsdom",
  "Fokus-Sichtbarkeit und Viewport-Lage",
  "tatsächliche Screenreader-Ausgabe",
  "Pixel-/Bildvergleich",
];
