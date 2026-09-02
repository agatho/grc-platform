/// <reference lib="dom" />

import type { Scene } from "../draw/scene";
import {
  getEventDefinitionLabel,
  getEventDefinitionType,
  getLabelText,
  getTypeLabel,
} from "../draw/semantic";
import type { BpmnShape } from "../draw/types";
import { buildGraphOrder, findContainerLabel, type GraphOrder } from "./order";

/**
 * Textuelle Alternative zum Bild (Plan §4.3, WCAG 1.1.1 und 1.4.10).
 *
 * Zwei Formen aus derselben Quelle:
 * - eine **Tabelle** (Nr., Name, Typ, Lane, Vorgänger, Nachfolger)
 * - ein **Fließtext** des Ablaufs
 *
 * Die Nummerierung ist dieselbe wie die Tastaturordnung (`order.ts`), damit
 * „Schritt 7" im Diagramm und in der Tabelle dasselbe meint.
 */

export interface TextAlternativeRow {
  readonly index: number;
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly typeLabel: string;
  readonly container: string;
  readonly predecessors: readonly string[];
  readonly successors: readonly string[];
}

export interface TextAlternativeModel {
  readonly rows: readonly TextAlternativeRow[];
  readonly prose: string;
  readonly warnings: readonly string[];
}

function displayName(shape: BpmnShape): string {
  const name = getLabelText(shape);
  if (name) {
    return name;
  }
  const definition = getEventDefinitionType(shape.businessObject);
  const definitionLabel =
    definition === "none" ? "" : ` (${getEventDefinitionLabel(definition)})`;
  return `${getTypeLabel(shape.type)}${definitionLabel} ${shape.id}`;
}

export function buildTextAlternative(
  scene: Scene,
  order?: GraphOrder,
): TextAlternativeModel {
  const graph = order ?? buildGraphOrder(scene);

  const rows: TextAlternativeRow[] = graph.nodes.map((node) => {
    const shape = node.shape;
    const definition = getEventDefinitionType(shape.businessObject);
    const typeLabel =
      definition === "none"
        ? getTypeLabel(shape.type)
        : `${getTypeLabel(shape.type)}, ${getEventDefinitionLabel(definition)}`;

    return {
      index: node.index,
      id: shape.id,
      name: getLabelText(shape),
      type: shape.type,
      typeLabel,
      container: findContainerLabel(scene, shape) ?? "",
      predecessors: node.incoming
        .map((connection) =>
          connection.source ? displayName(connection.source) : "?",
        )
        .sort(),
      successors: node.outgoing
        .map((connection) =>
          connection.target ? displayName(connection.target) : "?",
        )
        .sort(),
    };
  });

  return { rows, prose: buildProse(scene, graph), warnings: scene.warnings };
}

/**
 * Fließtextform des Ablaufs.
 *
 * Absichtlich nüchtern und schematisch: der Text soll in eine
 * Verfahrensdokumentation kopierbar sein, nicht literarisch klingen.
 */
function buildProse(scene: Scene, graph: GraphOrder): string {
  if (graph.nodes.length === 0) {
    return "Das Diagramm enthält keine Elemente.";
  }

  const sentences: string[] = [];
  const starts = graph.nodes.filter(
    (node) => node.shape.type === "bpmn:StartEvent",
  );
  if (starts.length === 1 && starts[0]) {
    sentences.push(
      `Der Prozess beginnt mit „${displayName(starts[0].shape)}“.`,
    );
  } else if (starts.length > 1) {
    sentences.push(
      `Der Prozess hat ${String(starts.length)} Startereignisse: ${starts
        .map((node) => `„${displayName(node.shape)}“`)
        .join(", ")}.`,
    );
  } else {
    sentences.push("Das Diagramm enthält kein Startereignis.");
  }

  for (const node of graph.nodes) {
    const shape = node.shape;
    if (shape.type === "bpmn:Lane" || shape.type === "bpmn:Participant") {
      continue;
    }
    const container = findContainerLabel(scene, shape);
    const where = container ? ` (${container})` : "";
    const successors = node.outgoing;

    if (successors.length === 0) {
      sentences.push(
        `Schritt ${String(node.index)}: „${displayName(shape)}“${where} endet hier.`,
      );
      continue;
    }
    if (successors.length === 1 && successors[0]) {
      const target = successors[0].target;
      sentences.push(
        `Schritt ${String(node.index)}: „${displayName(shape)}“${where} führt zu „${
          target ? displayName(target) : "einem unbekannten Element"
        }“.`,
      );
      continue;
    }
    const branches = successors
      .map((connection) => {
        const label = getLabelText(connection);
        const target = connection.target
          ? displayName(connection.target)
          : "unbekannt";
        return label ? `bei „${label}“ nach „${target}“` : `nach „${target}“`;
      })
      .join(", ");
    sentences.push(
      `Schritt ${String(node.index)}: „${displayName(shape)}“${where} verzweigt in ${String(
        successors.length,
      )} Pfade: ${branches}.`,
    );
  }

  return sentences.join(" ");
}

/**
 * Baut die Tabelle als echtes DOM — nicht als Zeichenkette.
 *
 * Grund: nur so lässt sich mit `axe-core` prüfen, dass Kopfzellen, Beschriftung
 * und Zeilenbezug stimmen. Eine Zeichenkette wäre ein Test, der nichts beweist.
 */
export function renderTextAlternativeTable(
  model: TextAlternativeModel,
  options: { caption?: string; id?: string } = {},
): HTMLTableElement {
  const table = document.createElement("table");
  if (options.id) {
    table.id = options.id;
  }
  table.className = "arctos-bpmn-text-alternative";

  const caption = document.createElement("caption");
  caption.textContent =
    options.caption ??
    "Textalternative: alle Elemente des Diagramms in Ablaufreihenfolge";
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
  ]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headRow.appendChild(th);
  }
  head.appendChild(headRow);
  table.appendChild(head);

  const body = document.createElement("tbody");
  for (const row of model.rows) {
    const tr = document.createElement("tr");
    tr.dataset["elementId"] = row.id;

    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = String(row.index);
    tr.appendChild(th);

    for (const value of [
      row.name || "(ohne Namen)",
      row.typeLabel,
      row.container || "—",
      row.predecessors.length > 0 ? row.predecessors.join(", ") : "—",
      row.successors.length > 0 ? row.successors.join(", ") : "—",
    ]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
  table.appendChild(body);
  return table;
}
