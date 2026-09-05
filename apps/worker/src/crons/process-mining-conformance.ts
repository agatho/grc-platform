// Cron Job: Process Mining Conformance
//
// For every process_event_log row that has status='imported' (i.e. ingested
// but not yet analyzed), compute a conformance score: percentage of unique
// case traces (case_id-ordered activity sequences) whose every activity
// matches at least one BPMN process_step name in the linked process.
//
// Also identifies:
//   - fitness gaps: activities in the log that have no matching process_step
//   - deviation edges: observed transitions the model does not connect
//   - bottlenecks: activities with the highest median wait time before them
//   - rework loops: activities that appear ≥2× in a single case trace
//
// Writes the result into process_conformance_result and marks the event log
// as 'analyzed'. Idempotent — re-runs replace prior result for the same log.
//
// [ARCTOS-FULL-2026-08-31 · OP-014] Der Konformitätsbegriff ist dabei enger
// geworden, und das ist Absicht: bis hierher hiess „konform", dass jede
// Aktivität EINEN modellierten Schritt trifft — die REIHENFOLGE wurde nicht
// geprüft. Eine Spur, die Schritt 2 überspringt (1 → 3), zählte damit als
// vollständig konform. Sobald der Job Abweichungen als Kantenpaare ausweist,
// wäre das ein Widerspruch in derselben Anzeige: „100 % konform" über einer
// Liste von Abweichungen. Gemessen an der Prüffixtur (3 Spuren: 1→3, 1→2→3,
// 1→X→3) fällt die Quote dadurch von 66,67 % auf 33,33 % — die zweite Zahl
// ist die, die ein Prüfer meint.

import {
  db,
  processEventLog,
  processConformanceResult,
  processEventTransitionMap,
  processStep,
} from "@grc/db";
import { eq, and, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface ConformanceResult {
  processed: number;
  analyzed: number;
  errors: number;
}

// ────────────────────────────────────────────────────────────────────
// [ARCTOS-FULL-2026-08-31 · OP-014] Die Auswertung, herausgelöst.
//
// Sie stand als Schleife mitten im Datenbankdurchlauf, und damit war die
// Aussage dieses Jobs — die Konformitätsquote — nur gegen eine befüllte
// Datenbank prüfbar. Für eine Zahl, die in einem Prüfbericht steht, ist das
// zu wenig: sie ist reine Rechnung auf zwei Listen und gehört als solche
// prüfbar. Der Datenbankteil ruft sie jetzt auf; er liest weiterhin, was er
// vorher gelesen hat.
//
// Der Konformitätsbegriff ist mit OP-014 ENGER geworden. Vorher hiess
// „konform", dass jede Aktivität EINEN modellierten Schritt trifft — die
// Reihenfolge wurde nicht geprüft, eine Spur 1 → 3 zählte also als
// vollständig konform. Sobald der Job Abweichungen als Kantenpaare ausweist,
// wäre das ein Widerspruch in derselben Anzeige: „100 % konform" über einer
// Liste von Abweichungen.
// ────────────────────────────────────────────────────────────────────

/** Ein modellierter Schritt, so wie ihn `process_step` führt. */
export interface ModelledStep {
  name: string | null;
  bpmnElementId: string | null;
  sequenceOrder: number | null;
}

/** Eine beobachtete Spur: Aktivitätsnamen in zeitlicher Reihenfolge. */
export interface ObservedTrace {
  case_id: string;
  activities: string[];
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-012] Ein beobachteter Uebergang als Knotenpaar.
 *
 * `probability` ist eine BEOBACHTETE Quote: dieser Uebergang geteilt durch
 * alle beobachteten Uebergaenge ab demselben Knoten. Sie sagt NICHT, mit
 * welcher Wahrscheinlichkeit ein Gateway einen Zweig waehlt — ein nie
 * beobachteter Zweig kommt in dieser Rechnung ueberhaupt nicht vor. Der
 * Unterschied steht am Spaltenkommentar und hier, weil er sonst spaetestens
 * beim zweiten Leser verlorengeht.
 */
export interface ObservedTransition {
  fromElementId: string;
  toElementId: string;
  frequency: number;
  probability: number;
  /** Ob das Modell die beiden Knoten unmittelbar verbindet. */
  isModelled: boolean;
}

export interface TraceAnalysis {
  totalTraces: number;
  conformantTraces: number;
  /** Konform in Prozent, auf zwei Nachkommastellen. */
  score: number;
  observedEvents: number;
  fitnessGaps: Array<{
    activity: string;
    type: "unexpected";
    frequency: number;
    percentage: number;
  }>;
  deviationEdges: Array<{
    fromElementId: string;
    toElementId: string;
    frequency: number;
    share: number;
  }>;
  reworkLoops: Array<{ activity: string; repeatOccurrences: number }>;
  /** [OP-012] Alle beobachteten Uebergaenge, modelliert und abweichend. */
  transitions: ObservedTransition[];
}

export function analyseTraces(
  steps: ModelledStep[],
  traces: ObservedTrace[],
): TraceAnalysis {
  const stepNames = new Set(
    steps.map((s) => (s.name ?? "").toLowerCase()).filter(Boolean),
  );
  /** Aktivitätsname (klein) → BPMN-Elementkennung, für Kantenpaare. */
  const elementOfActivity = new Map<string, string>();
  /** Aktivitätsname (klein) → sequence_order. */
  const orderOfActivity = new Map<string, number>();
  for (const s of steps) {
    const key = (s.name ?? "").toLowerCase();
    if (!key) continue;
    if (s.bpmnElementId) elementOfActivity.set(key, s.bpmnElementId);
    if (typeof s.sequenceOrder === "number") {
      orderOfActivity.set(key, s.sequenceOrder);
    }
  }

  let conformantTraces = 0;
  let observedEvents = 0;
  const fitnessGapCount = new Map<string, number>();
  const reworkCount = new Map<string, number>();
  /** Beobachtete Übergänge, die das Modell nicht kennt: `von\tnach`. */
  const deviationCount = new Map<string, number>();
  // [ARCTOS-FULL-2026-08-31 · OP-012] ALLE beobachteten Übergänge, auch die
  // modellkonformen. Der Abweichungszähler oben trägt nur die, die das Modell
  // nicht verbindet — für die Kantenkennzahl braucht es die anderen ebenso,
  // sonst hätte jede eingehaltene Kante die Häufigkeit null.
  const transitionCount = new Map<string, number>();
  const modelledTransition = new Set<string>();

  for (const trace of traces) {
    let conformant = true;
    const seenInTrace = new Set<string>();
    let vorher: string | null = null;
    for (const act of trace.activities) {
      const a = (act ?? "").toLowerCase();
      observedEvents += 1;
      if (!stepNames.has(a)) {
        conformant = false;
        fitnessGapCount.set(act, (fitnessGapCount.get(act) ?? 0) + 1);
      }
      if (seenInTrace.has(a)) {
        reworkCount.set(act, (reworkCount.get(act) ?? 0) + 1);
      }
      // Abweichender Übergang: beide Enden sind modellierte Schritte mit
      // BPMN-Kennung, aber das Modell setzt sie nicht direkt hintereinander.
      // Nur dann entsteht ein Kantenpaar, das sich im Diagramm zeichnen
      // lässt; ist ein Ende gar nicht modelliert, ist das eine Fitness-Lücke
      // und keine Kante.
      if (vorher !== null && vorher !== a) {
        const von = elementOfActivity.get(vorher);
        const nach = elementOfActivity.get(a);
        const ovVon = orderOfActivity.get(vorher);
        const ovNach = orderOfActivity.get(a);
        if (von && nach && ovVon !== undefined && ovNach !== undefined) {
          const key = `${von}\t${nach}`;
          // [OP-012] Jeder Übergang zwischen zwei modellierten Knoten zählt —
          // die Frage „modelliert oder nicht" entscheidet nur, wie er
          // gezeichnet wird, nicht ob er beobachtet wurde.
          transitionCount.set(key, (transitionCount.get(key) ?? 0) + 1);
          if (ovNach === ovVon + 1) {
            modelledTransition.add(key);
          } else {
            deviationCount.set(key, (deviationCount.get(key) ?? 0) + 1);
            conformant = false;
          }
        }
      }
      seenInTrace.add(a);
      vorher = a;
    }
    if (conformant) conformantTraces += 1;
  }

  const totalTraces = traces.length;
  const score =
    totalTraces === 0
      ? 0
      : Math.round((conformantTraces / totalTraces) * 10000) / 100;

  // [OP-014] Vorher `{ activity, count }` — eine Form, die der kanonische Typ
  // `FitnessGap` in `@grc/shared` (`{activity, type, frequency, percentage}`)
  // nicht kennt. Weil die Spalte `jsonb` ist, hat der Compiler nichts
  // gemerkt; die Mining-Seite hat sich stattdessen eine eigene, abweichende
  // `FitnessGap`-Schnittstelle danebengelegt, um zu übersetzen. Jetzt
  // schreibt der Erzeuger die deklarierte Form.
  const fitnessGaps = Array.from(fitnessGapCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([activity, frequency]) => ({
      activity,
      type: "unexpected" as const,
      frequency,
      percentage:
        observedEvents === 0
          ? 0
          : Math.round((frequency / observedEvents) * 10000) / 100,
    }));

  // [OP-014] Die Kantenpaare, an denen `GrcConformanceSummary.deviations`
  // bisher scheiterte: `fitness_gaps` führt Knoten, der Vertrag verlangt
  // `fromElementId`/`toElementId`. Aus einem Knoten ein Paar zu machen wäre
  // geraten gewesen — deshalb wird das Paar hier erhoben, wo die Spur noch
  // vorliegt, statt später rekonstruiert.
  const beobachteteUebergaenge = Array.from(deviationCount.values()).reduce(
    (a, b) => a + b,
    0,
  );
  const deviationEdges = Array.from(deviationCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([key, frequency]) => {
      const [fromElementId, toElementId] = key.split("\t");
      return {
        fromElementId: fromElementId!,
        toElementId: toElementId!,
        frequency,
        share:
          beobachteteUebergaenge === 0
            ? 0
            : Math.round((frequency / beobachteteUebergaenge) * 10000) / 10000,
      };
    });

  // [ARCTOS-FULL-2026-08-31 · OP-012] Die Verzweigungsquote je Ausgangsknoten.
  //
  // Nenner ist die Summe der beobachteten Übergänge AB DIESEM KNOTEN, nicht
  // die Zahl der Spuren und nicht die Zahl der modellierten Zweige. Beides
  // wäre eine andere Größe: über die Spuren gerechnet ergäbe die Summe über
  // alle Zweige nicht 1, sobald ein Fall den Knoten zweimal durchläuft; über
  // die modellierten Zweige gerechnet bekäme ein nie beobachteter Zweig eine
  // Wahrscheinlichkeit von 0 zugeschrieben, obwohl über ihn nichts bekannt
  // ist. Die Quote sagt: von allem, was hier beobachtet wurde, ging so viel
  // dorthin.
  const abgang = new Map<string, number>();
  for (const [key, count] of transitionCount) {
    const von = key.split("\t")[0] ?? "";
    abgang.set(von, (abgang.get(von) ?? 0) + count);
  }
  const transitions: ObservedTransition[] = Array.from(
    transitionCount.entries(),
  )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, frequency]) => {
      const [fromElementId, toElementId] = key.split("\t");
      const gesamt = abgang.get(fromElementId ?? "") ?? 0;
      return {
        fromElementId: fromElementId!,
        toElementId: toElementId!,
        frequency,
        probability:
          gesamt === 0 ? 0 : Math.round((frequency / gesamt) * 100000) / 100000,
        isModelled: modelledTransition.has(key),
      };
    });

  const reworkLoops = Array.from(reworkCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([activity, count]) => ({ activity, repeatOccurrences: count }));

  return {
    totalTraces,
    conformantTraces,
    score,
    observedEvents,
    fitnessGaps,
    deviationEdges,
    reworkLoops,
    transitions,
  };
}

export const processMiningConformance = withCronInstrumentation(
  "process-mining-conformance",
  async (): Promise<ConformanceResult> => {
    const logs = await db
      .select({
        id: processEventLog.id,
        orgId: processEventLog.orgId,
        processId: processEventLog.processId,
      })
      .from(processEventLog)
      .where(eq(processEventLog.status, "imported"));

    let analyzed = 0;
    let errors = 0;

    for (const log of logs) {
      try {
        if (!log.processId) {
          await db
            .update(processEventLog)
            .set({ status: "skipped_no_process" })
            .where(eq(processEventLog.id, log.id));
          continue;
        }

        // [ARCTOS-FULL-2026-08-31 · OP-014] Zusätzlich zur Namensmenge wird
        // jetzt die modellierte REIHENFOLGE gelesen. `process_step` ist die
        // einzige Ablaufbeschreibung, die dieser Job hat: eine nach
        // `sequence_order` geordnete Kette je Prozess. Zwei Schritte gelten
        // als modelliert verbunden, wenn ihre `sequence_order` unmittelbar
        // aufeinanderfolgen. Das ist keine BPMN-Auswertung — Gateways stehen
        // in dieser Tabelle als gewöhnliche Schritte —, und der Kommentar
        // steht hier, damit niemand mehr daraus liest, als drinsteht.
        const steps = await db
          .select({
            name: processStep.name,
            bpmnElementId: processStep.bpmnElementId,
            sequenceOrder: processStep.sequenceOrder,
          })
          .from(processStep)
          .where(eq(processStep.processId, log.processId));

        // Spuren nach `case_id`, Aktivitäten in zeitlicher Reihenfolge.
        const traceRows = (await db.execute(sql`
        SELECT case_id, array_agg(activity ORDER BY "timestamp") AS activities
        FROM process_event
        WHERE event_log_id = ${log.id}
        GROUP BY case_id
      `)) as unknown as ObservedTrace[];

        const analyse = analyseTraces(steps, traceRows);
        const {
          totalTraces: total,
          conformantTraces,
          score,
          fitnessGaps,
          deviationEdges,
          reworkLoops,
          transitions,
        } = analyse;

        const bottlenecks = (await db.execute(sql`
        WITH ordered AS (
          SELECT case_id, activity, "timestamp",
                 LAG("timestamp") OVER (PARTITION BY case_id ORDER BY "timestamp") AS prev_ts
          FROM process_event
          WHERE event_log_id = ${log.id}
        )
        SELECT activity,
               COUNT(*)::int AS occurrences,
               EXTRACT(EPOCH FROM percentile_cont(0.5)
                 WITHIN GROUP (ORDER BY ("timestamp" - prev_ts)))::int AS median_wait_seconds
        FROM ordered
        WHERE prev_ts IS NOT NULL
        GROUP BY activity
        ORDER BY median_wait_seconds DESC NULLS LAST
        LIMIT 10
      `)) as Array<{
          activity: string;
          occurrences: number;
          median_wait_seconds: number;
        }>;

        // Upsert the conformance result
        await db.transaction(async (tx) => {
          await tx
            .delete(processConformanceResult)
            .where(eq(processConformanceResult.eventLogId, log.id));
          await tx.insert(processConformanceResult).values({
            eventLogId: log.id,
            orgId: log.orgId,
            processId: log.processId,
            conformanceScore: String(score),
            totalTraces: total,
            conformantTraces,
            fitnessGaps,
            deviationEdges,
            precisionIssues: [],
            reworkLoops,
            bottlenecks: bottlenecks as any,
          });
          // [ARCTOS-FULL-2026-08-31 · OP-012] Die Uebergangszuordnung. Sie
          // steht in derselben Transaktion wie das Analyseergebnis: beide
          // beschreiben denselben Lauf, und eine Kantenhaeufigkeit ohne die
          // Konformitaetszahl daneben (oder umgekehrt) waere ein Stand, den
          // niemand erzeugt hat.
          //
          // Erst loeschen, dann schreiben — wie beim Ergebnis. Der eindeutige
          // Index `petm_log_pair_uniq` haelt zusaetzlich fest, dass ein Paar
          // je Protokoll genau einmal vorkommt; ohne ihn verdoppelte ein
          // zweiter Lauf jede Haeufigkeit, sollte das Loeschen je ausfallen.
          await tx
            .delete(processEventTransitionMap)
            .where(eq(processEventTransitionMap.eventLogId, log.id));
          if (transitions.length > 0) {
            await tx.insert(processEventTransitionMap).values(
              transitions.map((transition) => ({
                orgId: log.orgId,
                eventLogId: log.id,
                processId: log.processId,
                fromElementId: transition.fromElementId,
                toElementId: transition.toElementId,
                frequency: transition.frequency,
                probability: transition.probability.toFixed(5),
                isModelled: transition.isModelled,
              })),
            );
          }
          await tx
            .update(processEventLog)
            .set({ status: "analyzed" })
            .where(eq(processEventLog.id, log.id));
        });

        analyzed += 1;
      } catch (err) {
        errors += 1;
        const message = err instanceof Error ? err.message : String(err);
        await db
          .update(processEventLog)
          .set({ status: "error", errorMessage: message.slice(0, 1000) })
          .where(eq(processEventLog.id, log.id))
          .catch(() => {});
      }
    }

    return { processed: logs.length, analyzed, errors };
  },
);
