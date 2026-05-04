"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

interface PredictiveData {
  velocity: {
    completedItemsLast60d: number;
    itemsPerDay: number;
    health: "healthy" | "slow" | "very_slow" | "stalled";
  };
  backlog: {
    remainingSteps: number;
    remainingSubtasks: number;
    totalRemaining: number;
  };
  prediction: {
    predictedDaysRemaining: number | null;
    predictedCompletionDate: string | null;
    probabilityOfHittingTarget: number | null;
  };
  whatIf: {
    shiftDays: number;
    shiftedCompletionDate: string | null;
  };
  journey: {
    targetCompletionDate: string | null;
  };
}

const HEALTH_COLORS = {
  healthy: "text-emerald-700",
  slow: "text-amber-700",
  very_slow: "text-orange-700",
  stalled: "text-red-700",
};

const HEALTH_LABELS = {
  healthy: "Gesundes Tempo",
  slow: "Langsam",
  very_slow: "Sehr langsam",
  stalled: "Stillstand",
};

export function PredictiveWidget({ journeyId }: { journeyId: string }) {
  const [data, setData] = useState<PredictiveData | null>(null);
  const [shiftDays, setShiftDays] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/v1/programmes/journeys/${journeyId}/predictive?shiftDays=${shiftDays}`,
        );
        if (r.ok) {
          const j = await r.json();
          setData(j.data);
        }
      } catch {}
      setLoading(false);
    })();
  }, [journeyId, shiftDays]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Predictive Completion</CardTitle>
        </CardHeader>
        <CardContent>
          <Loader2 className="size-4 animate-spin" />
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const prob = data.prediction.probabilityOfHittingTarget;
  const probColor =
    prob == null
      ? "text-slate-500"
      : prob >= 70
        ? "text-emerald-700"
        : prob >= 40
          ? "text-amber-700"
          : "text-red-700";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4" />
          Predictive Completion
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-slate-500">Velocity (60 d)</div>
            <div className={`text-lg font-semibold ${HEALTH_COLORS[data.velocity.health]}`}>
              {data.velocity.itemsPerDay}/Tag
            </div>
            <div className="text-xs text-slate-500">
              {HEALTH_LABELS[data.velocity.health]}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Restliches Backlog</div>
            <div className="text-lg font-semibold">
              {data.backlog.totalRemaining}
            </div>
            <div className="text-xs text-slate-500">
              {data.backlog.remainingSteps} Steps + {data.backlog.remainingSubtasks} Tasks
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Voraussichtlich fertig</div>
            <div className="text-lg font-semibold">
              {data.prediction.predictedCompletionDate ?? "—"}
            </div>
            <div className="text-xs text-slate-500">
              {data.prediction.predictedDaysRemaining ?? "—"} Tage
            </div>
          </div>
        </div>

        {data.journey.targetCompletionDate && (
          <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">
                  Wahrscheinlichkeit Ziel-Datum {data.journey.targetCompletionDate}
                </div>
                <div className={`text-2xl font-semibold ${probColor}`}>
                  {prob ?? "—"}%
                </div>
              </div>
              {prob != null &&
                (prob >= 70 ? (
                  <CheckCircle2 className="size-8 text-emerald-600" />
                ) : (
                  <AlertTriangle className="size-8 text-amber-600" />
                ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-slate-500">
            What-if: Verzögerung in Tagen
          </label>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min="-30"
              max="90"
              step="7"
              value={shiftDays}
              onChange={(e) => setShiftDays(parseInt(e.target.value, 10))}
              className="flex-1"
            />
            <span className="font-mono text-sm">
              {shiftDays > 0 ? "+" : ""}
              {shiftDays} d
            </span>
          </div>
          {shiftDays !== 0 && data.whatIf.shiftedCompletionDate && (
            <div className="mt-2 text-xs text-slate-600">
              → Neues voraussichtliches Datum:{" "}
              <strong>{data.whatIf.shiftedCompletionDate}</strong>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
