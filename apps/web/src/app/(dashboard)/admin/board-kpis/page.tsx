"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCcw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ThresholdRow {
  id: string;
  riskCategory: string;
  maxResidualScore: number;
  escalationRole: string | null;
  isActive: boolean;
}

const RISK_CATEGORIES = [
  "strategic",
  "operational",
  "financial",
  "compliance",
  "cyber",
  "reputational",
  "esg",
];

const ESCALATION_ROLES = ["admin", "risk_manager", "auditor"];

const THRESHOLDS_QUERY_KEY = ["erm", "risk-appetite"] as const;

export default function BoardKpiConfigPage() {
  const t = useTranslations("boardKpi");
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert
  // wie vorher eine leere Liste.
  //
  // Die Schieberegler und Rollenwahl aendern die Zeilen VOR dem Speichern
  // lokal. Dafuer gibt es keinen `useState`-Setter mehr; `setThresholds`
  // schreibt stattdessen in den Abfrage-Cache unter demselben Schluessel
  // (`queryClient.setQueryData`), das Speichern holt wie vorher den
  // Serverstand neu. Der Provider fragt nicht bei Fensterfokus nach, ein
  // Hintergrundabruf reisst dem Nutzer die Eingabe also nicht weg.
  const {
    data: thresholds = [],
    isPending: loading,
    isFetching,
    refetch,
  } = useQuery<ThresholdRow[]>({
    queryKey: THRESHOLDS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/v1/erm/risk-appetite");
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as ThresholdRow[];
    },
  });

  const fetchData = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const setThresholds = useCallback(
    (updater: (prev: ThresholdRow[]) => ThresholdRow[]) => {
      queryClient.setQueryData<ThresholdRow[]>(THRESHOLDS_QUERY_KEY, (prev) =>
        updater(prev ?? []),
      );
    },
    [queryClient],
  );

  const saveThreshold = async (
    category: string,
    maxResidualScore: number,
    escalationRole: string,
  ) => {
    setSaving(true);
    try {
      const existing = thresholds.find((t) => t.riskCategory === category);
      if (existing) {
        await fetch(`/api/v1/erm/risk-appetite/${existing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maxResidualScore, escalationRole }),
        });
      } else {
        await fetch("/api/v1/erm/risk-appetite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            riskCategory: category,
            maxResidualScore,
            escalationRole,
          }),
        });
      }
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleSliderChange = (category: string, value: number) => {
    setThresholds((prev) => {
      const existing = prev.find((t) => t.riskCategory === category);
      if (existing) {
        return prev.map((t) =>
          t.riskCategory === category ? { ...t, maxResidualScore: value } : t,
        );
      }
      return [
        ...prev,
        {
          id: "",
          riskCategory: category,
          maxResidualScore: value,
          escalationRole: "admin",
          isActive: true,
        },
      ];
    });
  };

  const handleRoleChange = (category: string, role: string) => {
    setThresholds((prev) => {
      const existing = prev.find((t) => t.riskCategory === category);
      if (existing) {
        return prev.map((t) =>
          t.riskCategory === category ? { ...t, escalationRole: role } : t,
        );
      }
      return [
        ...prev,
        {
          id: "",
          riskCategory: category,
          maxResidualScore: 15,
          escalationRole: role,
          isActive: true,
        },
      ];
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("config.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("config.subtitle")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={isFetching}
        >
          <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Risk Appetite Thresholds */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          {t("config.appetiteThresholds")}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-600">
                  {t("riskAppetite.category")}
                </th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">
                  {t("config.threshold")} (1-25)
                </th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">
                  {t("config.escalationRole")}
                </th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">
                  {t("config.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {RISK_CATEGORIES.map((category) => {
                const row = thresholds.find((t) => t.riskCategory === category);
                const value = row?.maxResidualScore ?? 15;
                const role = row?.escalationRole ?? "admin";

                return (
                  <tr key={category} className="border-b border-gray-100">
                    <td className="py-3 px-3 font-medium text-gray-900 capitalize">
                      {t(`riskAppetite.categories.${category}`)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={1}
                          max={25}
                          value={value}
                          onChange={(e) =>
                            handleSliderChange(category, Number(e.target.value))
                          }
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <span className="font-mono text-sm text-gray-700 w-8 text-right">
                          {value}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={role}
                        onChange={(e) =>
                          handleRoleChange(category, e.target.value)
                        }
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                      >
                        {ESCALATION_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => saveThreshold(category, value, role)}
                        disabled={saving}
                      >
                        <Save size={12} className="mr-1" />
                        {t("config.save")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assurance Weights Info */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          {t("config.assuranceWeights")}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {t("config.assuranceWeightsDesc")}
        </p>
        <div className="grid grid-cols-5 gap-3">
          {[
            { key: "evidenceAge", default: "25%" },
            { key: "testCoverage", default: "25%" },
            { key: "dataQuality", default: "20%" },
            { key: "assessmentSource", default: "15%" },
            { key: "automationLevel", default: "15%" },
          ].map((w) => (
            <div
              key={w.key}
              className="rounded-lg border border-gray-200 p-3 text-center"
            >
              <span className="text-lg font-bold text-gray-900">
                {w.default}
              </span>
              <p className="text-xs text-gray-500 mt-1">
                {t(`assurance.factors.${w.key}`)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Posture Weights Info */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          {t("config.postureWeights")}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {t("config.postureWeightsDesc")}
        </p>
        <div className="grid grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { key: "assetCoverage", default: "15%" },
            { key: "maturity", default: "20%" },
            { key: "ces", default: "20%" },
            { key: "vulnExposure", default: "15%" },
            { key: "incidentTTR", default: "10%" },
            { key: "freshness", default: "10%" },
            { key: "soaCompleteness", default: "10%" },
          ].map((w) => (
            <div
              key={w.key}
              className="rounded-lg border border-gray-200 p-3 text-center"
            >
              <span className="text-lg font-bold text-gray-900">
                {w.default}
              </span>
              <p className="text-xs text-gray-500 mt-1">
                {t(`posture.factors.${w.key}`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
