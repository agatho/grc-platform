// [N-2 · Welle 6a] Diese Datei ERSETZT einen Rauchtest, der den Defekt
// festgeschrieben hat. Er lautete in seiner ganzen Substanz:
//
//     it("smoke: import and run without throwing", …)
//       let threw = false; try { await fn(); } catch { threw = true; }
//       expect(threw).toBe(false);
//
// Also: „der Job wirft nicht" — fuer einen Job, dessen Rumpf `return
// {processed:0,alerts:0,skipped:0}` war. Die Zusicherung konnte den Stub
// von einer arbeitenden Umsetzung nicht unterscheiden, und sie haette dem
// Stub jede Verweigerung verboten. Gemessen: mit dem alten Datenbank-
// Doppel (`select` liefert `[]`) laeuft der neue Code ebenfalls ohne Wurf
// durch — der alte Test war gegen beide Staende gruen und hat nie etwas
// geprueft. Sein Anliegen („der Job laeuft durch, wenn es nichts zu tun
// gibt") steht als erste Zusicherung unten, jetzt mit einer Aussage.
//
// Zwei Dinge werden hier festgehalten:
//
//   1. `processRiskPredictionWeekly` meldet keinen Erfolg mehr, ohne etwas
//      getan zu haben. Vorher war der Rumpf `const processed = 0; …; return`
//      mit dem Kommentar „simplified stub for now" — und
//      `withCronInstrumentation` schrieb dafuer jeden Montag eine
//      `job_run`-Zeile mit `status: "success"`.
//   2. `predictEscalation` rechnet, was es zu rechnen behauptet. Die
//      Funktion war vollstaendig, hatte aber keinen Aufrufer und keine
//      Pruefung.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { modelRows } = vi.hoisted(() => ({
  modelRows: { current: [] as unknown[] },
}));

vi.mock("@grc/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(modelRows.current),
      }),
    }),
  },
  riskPredictionModel: { id: "id", status: "status" },
}));

vi.mock("../../src/lib/cron-instrument", () => ({
  withCronInstrumentation: (_name: string, fn: unknown) => fn,
}));

// Statischer Import, nicht `await import(...)`: `vi.mock` wird von vitest
// ohnehin ueber die Importe gehoben, und `scripts/audit-dead-exports.mjs`
// baut seinen Importindex ausschliesslich aus statischen
// `import {…} from`-Formen (Zeile 196 dort) — ein dynamisch importiertes
// Symbol gilt ihm als tot.
import {
  processRiskPredictionWeekly,
  predictEscalation,
} from "../../src/crons/risk-prediction-weekly";
import { NotImplementedEvidenceError } from "../../src/lib/job-runtime";

describe("risk-prediction-weekly — kein Erfolg ohne Messung", () => {
  beforeEach(() => {
    modelRows.current = [];
  });

  it("meldet eine ehrliche Null, wenn es kein aktives Modell gibt", async () => {
    await expect(processRiskPredictionWeekly()).resolves.toEqual({
      processed: 0,
      alerts: 0,
      skipped: 0,
    });
  });

  it("verweigert, statt Erfolg zu melden, wenn Modelle da sind", async () => {
    modelRows.current = [{ id: "m1" }, { id: "m2" }];
    await expect(processRiskPredictionWeekly()).rejects.toBeInstanceOf(
      NotImplementedEvidenceError,
    );
    await expect(processRiskPredictionWeekly()).rejects.toThrow(
      /2 active model\(s\) would have been applied/,
    );
  });
});

describe("predictEscalation — die Rechnung, die nie gerufen wurde", () => {
  const nullMerkmale = {
    scoreTrend: 0,
    kriMomentum: 0,
    incidentFrequency: 0,
    findingBacklog: 0,
    controlEffectiveness: 0,
    daysSinceReview: 0,
  };

  it("gibt bei Bias 0 und Nullmerkmalen genau 50 % zurueck", () => {
    const r = predictEscalation(nullMerkmale, {}, 0);
    expect(r.probability).toBeCloseTo(50, 10);
  });

  it("bleibt fuer jede Eingabe im Bereich 0..100", () => {
    for (const bias of [-1e6, -10, 0, 10, 1e6]) {
      const r = predictEscalation(nullMerkmale, { scoreTrend: 3 }, bias);
      expect(r.probability).toBeGreaterThanOrEqual(0);
      expect(r.probability).toBeLessThanOrEqual(100);
    }
  });

  it("nennt die drei staerksten Faktoren, nach Beitrag sortiert", () => {
    const r = predictEscalation(
      { ...nullMerkmale, scoreTrend: 1, kriMomentum: 2, findingBacklog: 5 },
      { scoreTrend: 1, kriMomentum: 1, findingBacklog: 1 },
      0,
    );
    expect(r.topFactors.map((f) => f.factor)).toEqual([
      "findingBacklog",
      "kriMomentum",
      "scoreTrend",
    ]);
    expect(r.topFactors).toHaveLength(3);
  });

  it("wertet ein negatives Gewicht als Beitrag, nicht als Abzug in der Reihenfolge", () => {
    const r = predictEscalation(
      { ...nullMerkmale, scoreTrend: 1, kriMomentum: 10 },
      { scoreTrend: 1, kriMomentum: -1 },
      0,
    );
    expect(r.topFactors[0]?.factor).toBe("kriMomentum");
    expect(r.topFactors[0]?.contribution).toBe(10);
  });
});
