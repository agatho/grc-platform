/**
 * Lane-Geometrie beim Verändern der Größe.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-041] **Was fehlte.** Die Fläche eines Pools
 * teilen seine Lanes restlos auf, und die Fläche einer Lane teilen ihre
 * Kind-Lanes restlos auf. Der erste Satz war gebaut — `AutoResizeBehavior`
 * ruft `redistributeLanes`, wenn ein Pool wächst. Der zweite nicht: Wer eine
 * Lane **mit** Kind-Lanes von Hand vergrößerte, bekam eine Lane, deren Kinder
 * auf ihrer alten Höhe stehenblieben.
 *
 * `STUFE2-A1-MODELING.md` §7.9 nennt das „sichtbar und deshalb der harmlosere
 * Rest dieses Postens". Sichtbar ist es; harmlos nicht. Der Streifen, der
 * danach zu keiner Kind-Lane gehört, ist genau die Fläche, in der ein Knoten
 * seine `flowNodeRef` verliert — `BpmnUpdater.syncLaneMembership` rechnet die
 * Zugehörigkeit nach jeder Größenänderung aus der **Geometrie** neu, und ein
 * Knoten in einer Lücke gehört zu nichts.
 *
 * Gemessen an der Prüffixtur `NESTED_LANES`: `Lane_Aussen` von 200 auf 300 px
 * vergrößert, `Lane_Innen1`/`Lane_Innen2` blieben bei 100+100 — 100 px der
 * Eltern-Lane ohne Kind-Lane.
 *
 * **Warum ein `postExecuted`-Interceptor und keine Zeile im Handler.** Die
 * Größenänderung selbst ist `shape.resize` von `diagram-js`, und die soll sie
 * bleiben (Plan §2.2: den Kommandostapel nicht nachbauen). Die
 * BPMN-Zusatzregel hängt sich daran, mit eigenen `shape.resize`-Kommandos für
 * die Kinder — damit ist sie automatisch Teil desselben Undo-Schritts, ohne
 * dass hier ein Rückbau von Hand geschrieben werden müsste.
 */

import CommandInterceptor from "diagram-js/lib/command/CommandInterceptor.js";
import type EventBus from "diagram-js/lib/core/EventBus.js";
import type { Bounds, BpmnShape } from "../types";
import { childLanes, isLaneShape, isParticipantShape } from "../lanes";
import { redistributeLanes, type ModelingLike } from "./AutoResizeBehavior";

/**
 * Hint, mit dem eine Umverteilung ihre eigenen Kommandos kennzeichnet.
 *
 * Ohne ihn liefe die Umverteilung einer Ebene sofort wieder in dieses
 * Verhalten hinein und verteilte dieselben Kinder ein zweites Mal — beim
 * ersten Mal auf die neue Fläche, beim zweiten Mal auf eine Fläche, die schon
 * die neue ist, mit einem anderen Ausgangsverhältnis. `redistributeLanes`
 * setzt ihn, dieses Verhalten sieht ihn und hält still.
 */
export const LANE_REDISTRIBUTION_HINT = "laneRedistribution";

export class LaneResizeBehavior extends CommandInterceptor {
  static $inject = ["eventBus", "modeling"];

  constructor(eventBus: EventBus, modeling: ModelingLike) {
    super(eventBus);

    this.postExecuted(
      "shape.resize",
      (event: { context?: Record<string, unknown> }) => {
        const context = event.context;
        if (!context) return;
        const hints = context["hints"] as Record<string, unknown> | undefined;
        if (hints?.[LANE_REDISTRIBUTION_HINT] === true) return;

        const shape = context["shape"] as BpmnShape | undefined;
        if (!shape) return;
        // Pools erledigt `AutoResizeBehavior`, wenn *es* die Größe ändert.
        // Wird ein Pool von Hand verändert, gilt dieselbe Regel — deshalb
        // beide Sorten Container.
        if (!isLaneShape(shape) && !isParticipantShape(shape)) return;

        const lanes = childLanes(shape);
        if (lanes.length === 0) return;

        const oldBounds = context["oldBounds"] as Bounds | undefined;
        const newBounds = context["newBounds"] as Bounds | undefined;
        if (!oldBounds || !newBounds) return;
        if (
          oldBounds.width === newBounds.width &&
          oldBounds.height === newBounds.height &&
          oldBounds.x === newBounds.x &&
          oldBounds.y === newBounds.y
        ) {
          return;
        }

        redistributeLanes(modeling, oldBounds, newBounds, lanes);
      },
    );
  }
}

export const laneResizeModule = {
  __init__: ["laneResizeBehavior"],
  laneResizeBehavior: ["type", LaneResizeBehavior],
};

export default LaneResizeBehavior;
