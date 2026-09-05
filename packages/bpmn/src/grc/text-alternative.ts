/// <reference lib="dom" />

/**
 * Die Textalternative mit GRC-Spalten (Plan §4.3).
 *
 * `BpmnTextAlternative` liefert Nr./Name/Typ/Lane/Vorgänger/Nachfolger. Hier
 * kommt **je aktivem Layer eine Spalte** dazu — aus derselben `describe()`-
 * Methode, aus der auch der zugängliche Name und die Live-Region gespeist
 * werden. Damit ist die Tabelle nicht eine zweite Darstellung, die veralten
 * kann, sondern dieselbe Aussage in anderer Form.
 *
 * Nebeneffekt, der den Aufwand doppelt lohnt: Diese Tabelle ist die Antwort auf
 * WCAG 1.4.10 (Reflow bei 320 px) — ein Diagramm-Canvas kann nicht umbrechen,
 * eine Tabelle schon — und sie ist zugleich das, was Menschen für eine
 * Verfahrensdokumentation ohnehin brauchen.
 */

import type { Scene } from "../draw/scene";
import {
  buildTextAlternative,
  type TextAlternativeRow,
} from "../viewer/TextAlternative";
import { buildGraphOrder, type GraphOrder } from "../viewer/order";
import type { GrcOverlayModel } from "./engine";

export interface GrcTextColumn {
  readonly layerId: string;
  readonly header: string;
}

export interface GrcTextRow extends TextAlternativeRow {
  /** Layer-ID → Text; fehlt der Eintrag, hat der Layer nichts zu sagen. */
  readonly grc: Readonly<Record<string, string>>;
}

export interface GrcTextAlternative {
  readonly columns: readonly GrcTextColumn[];
  readonly rows: readonly GrcTextRow[];
  readonly prose: string;
  /** Kopfzeilen, Abdeckungsquoten, Filterhinweise — alles, was über dem Bild steht. */
  readonly notes: readonly string[];
  readonly warnings: readonly string[];
}

export function buildGrcTextAlternative(
  scene: Scene,
  model: GrcOverlayModel,
  order?: GraphOrder,
): GrcTextAlternative {
  const graph = order ?? buildGraphOrder(scene);
  const base = buildTextAlternative(scene, graph);

  const rows: GrcTextRow[] = base.rows.map((row) => {
    const shape = graph.byId.get(row.id)?.shape;
    const grc: Record<string, string> = {};
    if (shape) {
      const decoration = model.elements.get(row.id);

      // Der Spaltentext ist die Vereinigung aus der allgemeinen Beschreibung
      // des Layers und den Texten der Signale, die er an diesem Element
      // tatsächlich zeichnet. Das ist keine Bequemlichkeit, sondern die
      // strukturelle Zusicherung des Auftrags: Was gezeichnet wird, steht auch
      // in der Tabelle — und zwar wortgleich, nicht sinngemäß.
      const perLayer = new Map<string, string[]>();
      const add = (layerId: string, text: string | undefined): void => {
        if (text === undefined || text === "") {
          return;
        }
        const list = perLayer.get(layerId) ?? [];
        if (!list.includes(text)) {
          list.push(text);
        }
        perLayer.set(layerId, list);
      };

      for (const layer of model.layers) {
        add(layer.id, layer.describe(shape, model.context));
      }
      if (decoration) {
        for (const [, owned] of decoration.resolution.badges) {
          add(owned.layerId, owned.signal.describe);
        }
        const shapeSignal = decoration.resolution.shape;
        if (shapeSignal) {
          add(shapeSignal.layerId, shapeSignal.signal.describe);
        }
        for (const owned of decoration.resolution.gutter) {
          add(owned.layerId, owned.signal.describe);
        }
        const pin = decoration.resolution.pin;
        if (pin) {
          add(pin.layerId, pin.signal.describe);
        }
        const stripe = decoration.resolution.stripe;
        if (stripe) {
          add(stripe.layerId, stripe.signal.describe);
        }
      }
      for (const [layerId, texts] of perLayer) {
        grc[layerId] = texts.join(" ");
      }

      if (decoration?.resolution.overflow) {
        grc["_overflow"] = decoration.resolution.overflow.suppressed
          .map((entry) => entry.text)
          .join(" ");
      }
      if (decoration?.resolution.dimmed) {
        grc["_filter"] = "vom Filter nicht erfasst";
      }
    }
    return { ...row, grc };
  });

  // Nur Spalten, die irgendwo etwas enthalten — eine leere Spalte je Layer
  // wäre der schnellste Weg, die Tabelle unbenutzbar zu machen.
  const columns: GrcTextColumn[] = model.layers
    .filter((layer) => rows.some((row) => row.grc[layer.id] !== undefined))
    .map((layer) => ({ layerId: layer.id, header: layer.title }));
  if (rows.some((row) => row.grc["_overflow"] !== undefined)) {
    columns.push({ layerId: "_overflow", header: "Weitere Hinweise" });
  }
  if (rows.some((row) => row.grc["_filter"] !== undefined)) {
    columns.push({ layerId: "_filter", header: "Filter" });
  }

  const notes = [
    `Sicht: ${model.view.title} — ${model.view.purpose}`,
    `Stand der GRC-Daten: ${model.computedAt}`,
    ...model.banners.map((banner) => banner.signal.describe),
    ...[...model.edges.values()].map(
      (edge) => `Kante ${edge.edgeId}: ${edge.descriptions.join(" ")}`,
    ),
  ];

  return {
    columns,
    rows,
    prose: `${base.prose} ${grcProse(model)}`.trim(),
    notes,
    warnings: [...base.warnings, ...model.warnings],
  };
}

/**
 * Fließtextergänzung: was das Bild über die Struktur hinaus erzählt.
 *
 * Bewusst als eigener Absatz hinter dem Ablauftext — wer den Prozess verstehen
 * will, liest zuerst den Ablauf; wer prüft, liest weiter.
 */
function grcProse(model: GrcOverlayModel): string {
  const sentences: string[] = [];
  for (const banner of model.banners) {
    sentences.push(banner.signal.describe);
  }
  for (const arc of model.arcs) {
    sentences.push(arc.signal.describe);
  }
  const flagged = [...model.elements.values()].filter(
    (decoration) => decoration.descriptions.length > 0,
  );
  if (flagged.length > 0) {
    sentences.push(
      `${String(flagged.length)} Element${flagged.length === 1 ? "" : "e"} tragen GRC-Hinweise in der Sicht „${model.view.title}".`,
    );
  }
  return sentences.join(" ");
}

/**
 * Baut die Tabelle als echtes DOM.
 *
 * Wie im Viewer bewusst DOM und keine Zeichenkette: nur so lässt sich mit
 * `axe-core` prüfen, dass Kopfzellen, Beschriftung und Zeilenbezug stimmen.
 */
export function renderGrcTextAlternativeTable(
  alternative: GrcTextAlternative,
  options: { readonly caption?: string; readonly id?: string } = {},
): HTMLTableElement {
  const table = document.createElement("table");
  if (options.id) {
    table.id = options.id;
  }
  table.className = "arctos-grc-text-alternative";

  const caption = document.createElement("caption");
  caption.textContent =
    options.caption ??
    `Textalternative mit GRC-Angaben. ${alternative.notes.join(" ")}`;
  table.appendChild(caption);

  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of [
    "Nr.",
    "Name",
    "Typ",
    "Lane / Rolle",
    "Vorgänger",
    "Nachfolger",
    ...alternative.columns.map((column) => column.header),
  ]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headRow.appendChild(th);
  }
  head.appendChild(headRow);
  table.appendChild(head);

  const body = document.createElement("tbody");
  for (const row of alternative.rows) {
    const tr = document.createElement("tr");
    tr.dataset["elementId"] = row.id;

    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = String(row.index);
    tr.appendChild(th);

    const values = [
      row.name || "(ohne Namen)",
      row.typeLabel,
      row.container || "—",
      row.predecessors.length > 0 ? row.predecessors.join(", ") : "—",
      row.successors.length > 0 ? row.successors.join(", ") : "—",
      ...alternative.columns.map((column) => row.grc[column.layerId] ?? "—"),
    ];
    for (const value of values) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
  table.appendChild(body);
  return table;
}
