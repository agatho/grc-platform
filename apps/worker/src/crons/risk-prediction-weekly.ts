// Sprint 33: Weekly Risk Prediction Worker
// Runs every Monday at 03:00 — recomputes all predictions, alerts if > 70%
// Requires >= 6 months KRI data per risk

import { db, riskPredictionModel } from "@grc/db";
import { eq } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { NotImplementedEvidenceError } from "../lib/job-runtime";

const ALERT_THRESHOLD = 70; // Escalation probability > 70% triggers alert
const MIN_DATA_MONTHS = 6;

interface RiskFeatures {
  scoreTrend: number;
  kriMomentum: number;
  incidentFrequency: number;
  findingBacklog: number;
  controlEffectiveness: number;
  daysSinceReview: number;
}

interface ModelWeights {
  [key: string]: number;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * [N-2 · Welle 6a] Exportiert, weil die Funktion vollstaendig und richtig
 * ist — sie hatte nur nie einen Aufrufer. `tests/crons/risk-prediction-
 * weekly.test.ts` prueft sie jetzt; wer die Merkmalsberechnung nachzieht,
 * bekommt sie geprueft. Sie hier zu loeschen haette einen funktionierenden
 * Algorithmus weggeworfen, sie ungeprueft stehen zu lassen haette den
 * Eindruck erweckt, sie liefe.
 */
export function predictEscalation(
  features: RiskFeatures,
  weights: ModelWeights,
  bias: number,
): {
  probability: number;
  topFactors: Array<{ factor: string; value: number; contribution: number }>;
} {
  const featureEntries = Object.entries(features);
  const linearCombination = featureEntries.reduce(
    (sum, [key, value]) => sum + (weights[key] ?? 0) * value,
    bias,
  );

  const probability = sigmoid(linearCombination) * 100;

  const topFactors = featureEntries
    .map(([key, value]) => ({
      factor: key,
      value,
      contribution: Math.abs((weights[key] ?? 0) * value),
    }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);

  return { probability, topFactors };
}

// ── [N-2 · Welle 6a] Ein woechentlicher Lauf, der Erfolg meldete ──────
//
// Gefunden ueber `noUnusedLocals`: diese Datei importierte
// `riskPrediction`, `riskPredictionAlert`, `desc`, definierte
// `ALERT_THRESHOLD`, `MIN_DATA_MONTHS`, `sigmoid` und `predictEscalation` —
// und benutzte NICHTS davon. Der Rumpf war:
//
//     const processed = 0; const alerts = 0; const skipped = 0;
//     // … simplified stub for now …
//     return { processed, alerts, skipped };
//
// Der Job steht in `JOB_REGISTRY` und laeuft montags um 03:00. Ueber
// `withCronInstrumentation` hinterliess er dabei jede Woche eine Zeile in
// `job_run` mit `status: "success"` — eine Risikovorhersage, die nie
// stattgefunden hat, mit gruener Quittung. Das ist dieselbe Fehlerklasse,
// die `tests/no-fabricated-evidence.test.ts` fuer dreizehn andere Dateien
// festhaelt: nicht erfundene ZAHLEN, sondern erfundene TAETIGKEIT.
//
// Der Job verweigert jetzt nach dem Muster von
// `connector-health-monitor.ts`: gibt es nichts vorherzusagen (kein
// trainiertes Modell), ist eine ehrliche Null richtig; gibt es Modelle,
// wird das Fehlen der Umsetzung als Fehler gemeldet statt als Erfolg.
export const processRiskPredictionWeekly = withCronInstrumentation(
  "risk-prediction-weekly",
  async (): Promise<{
    processed: number;
    alerts: number;
    skipped: number;
  }> => {
    const trainedModels = await db
      .select({ id: riskPredictionModel.id })
      .from(riskPredictionModel)
      .where(eq(riskPredictionModel.status, "active"));

    if (trainedModels.length === 0) {
      // Ohne aktives Modell gibt es nichts vorherzusagen. Diese Null ist
      // gemessen, nicht behauptet.
      return { processed: 0, alerts: 0, skipped: 0 };
    }

    throw new NotImplementedEvidenceError(
      "weekly risk escalation prediction",
      `${trainedModels.length} active model(s) would have been applied. ` +
        `The feature computation (RiskFeatures from KRI history, >= ${MIN_DATA_MONTHS} ` +
        `months) is not wired up, so no prediction and no alert above ` +
        `${ALERT_THRESHOLD}% is recorded.`,
    );
  },
);
