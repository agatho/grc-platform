"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCcw,
  ArrowLeft,
  AlertTriangle,
  TrendingUp,
  Shield,
  Briefcase,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  RoiOverviewItem,
  RoniOverviewItem,
  RoniVsRoiItem,
  BudgetCutScenarioResult,
  GrcArea,
} from "@grc/shared";

interface RoiDashboardData {
  topRoi: RoiOverviewItem[];
  roiByArea: Array<{ grcArea: GrcArea; invested: number; mitigated: number }>;
  penaltyAvoidance: { potentialFines: number; complianceCosts: number };
  incidentAvoidance: { avgCost: number; prevented: number; avoided: number };
  totalRoni: number;
  roniPerRisk: RoniOverviewItem[];
  roiVsRoni: RoniVsRoiItem[];
}

type Perspective = "cfo" | "ciso";

export default function RoiDashboardPage() {
  const t = useTranslations("budget");
  const router = useRouter();
  const [data, setData] = useState<RoiDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [perspective, setPerspective] = useState<Perspective>("cfo");
  const [cutPercent, setCutPercent] = useState(0);
  const [scenario, setScenario] = useState<BudgetCutScenarioResult | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/budget/roi");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const fetchScenario = useCallback(async (pct: number) => {
    if (pct === 0) {
      setScenario(null);
      return;
    }
    setScenarioLoading(true);
    try {
      const res = await fetch("/api/v1/budget/roi/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cutPercent: pct }),
      });
      if (res.ok) {
        const json = await res.json();
        setScenario(json.data);
      }
    } finally {
      setScenarioLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchScenario(cutPercent);
    }, 300);
    return () => clearTimeout(timer);
  }, [cutPercent, fetchScenario]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const d = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/budget")}>
            <ArrowLeft size={14} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("roi.title")}</h1>
            <p className="text-sm text-gray-500 mt-1">{t("roi.subtitle")}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* ─── ROI Section ─── */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          <TrendingUp size={18} className="inline mr-2 text-green-600" />
          {t("roi.roiSection")}
        </h2>

        {/* Top 10 ROI Table */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">{t("roi.topRoi")}</h3>
          {(d?.topRoi ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">{t("roi.noRoiData")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t("costs.entityType")}</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">{t("roi.investment")}</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">{t("roi.riskReduction")}</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">{t("roi.roiPercent")}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t("roi.method")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(d?.topRoi ?? []).slice(0, 10).map((item, idx) => (
                    <tr key={`${item.entityType}-${item.entityId}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="text-[10px]">{item.entityType}</Badge>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {item.investmentCost.toLocaleString("de-DE")} {t("currency")}
                      </td>
                      <td className="px-4 py-2 text-right text-green-600 font-medium">
                        {item.riskReductionValue.toLocaleString("de-DE")} {t("currency")}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={`font-bold ${item.roiPercent >= 100 ? "text-green-700" : item.roiPercent >= 0 ? "text-yellow-700" : "text-red-700"}`}>
                          {item.roiPercent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 text-xs">{item.calculationMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ROI by Area + Penalty/Incident Avoidance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ROI by Area */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">{t("roi.roiByArea")}</h3>
            <div className="space-y-2">
              {(d?.roiByArea ?? []).map((item) => (
                <div key={item.grcArea} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">{t(`areas.${item.grcArea}`)}</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-gray-500">{item.invested.toLocaleString("de-DE")}</span>
                    <span className="text-green-600 font-medium">{item.mitigated.toLocaleString("de-DE")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Penalty Avoidance */}
          <div className="rounded-lg border border-green-100 bg-green-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-medium text-gray-700">{t("roi.penaltyAvoidance")}</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">{t("roi.penaltyDescription")}</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-600">{t("roi.potentialFines")}</span>
                <span className="text-sm font-bold text-red-600">
                  {(d?.penaltyAvoidance?.potentialFines ?? 0).toLocaleString("de-DE")} {t("currency")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-600">{t("roi.complianceCosts")}</span>
                <span className="text-sm font-bold text-green-600">
                  {(d?.penaltyAvoidance?.complianceCosts ?? 0).toLocaleString("de-DE")} {t("currency")}
                </span>
              </div>
            </div>
          </div>

          {/* Incident Avoidance */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-medium text-gray-700">{t("roi.incidentAvoidance")}</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">{t("roi.incidentDescription")}</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-600">{t("roi.avgIncidentCost")}</span>
                <span className="text-sm font-medium text-gray-700">
                  {(d?.incidentAvoidance?.avgCost ?? 0).toLocaleString("de-DE")} {t("currency")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-600">{t("roi.preventedIncidents")}</span>
                <span className="text-sm font-medium text-gray-700">{d?.incidentAvoidance?.prevented ?? 0}</span>
              </div>
              <div className="flex justify-between border-t border-blue-200 pt-2">
                <span className="text-xs font-medium text-gray-700">{t("roi.avoided")}</span>
                <span className="text-sm font-bold text-blue-700">
                  {(d?.incidentAvoidance?.avoided ?? 0).toLocaleString("de-DE")} {t("currency")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── RONI Section ─── */}
      <div className="space-y-4">
        {/* RONI Warning Card */}
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <h2 className="text-lg font-semibold text-red-800">{t("roi.roniWarning")}</h2>
          </div>
          <p className="text-3xl font-bold text-red-700">
            {(d?.totalRoni ?? 0).toLocaleString("de-DE")} {t("currency")}
          </p>
        </div>

        {/* Perspective Toggle */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">{t("roi.perspective")}:</span>
          <div className="flex rounded-md border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setPerspective("cfo")}
              className={`px-4 py-2 text-sm ${perspective === "cfo" ? "bg-blue-100 text-blue-900 font-medium" : "text-gray-500 hover:bg-gray-50"}`}
            >
              <Briefcase size={14} className="inline mr-1" />
              {t("roi.cfoPerspective")}
            </button>
            <button
              type="button"
              onClick={() => setPerspective("ciso")}
              className={`px-4 py-2 text-sm ${perspective === "ciso" ? "bg-orange-100 text-orange-900 font-medium" : "text-gray-500 hover:bg-gray-50"}`}
            >
              <Shield size={14} className="inline mr-1" />
              {t("roi.cisoPerspective")}
            </button>
          </div>
        </div>

        {/* RONI per Risk */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">{t("roi.roniPerRisk")}</h2>
          </div>
          {(d?.roniPerRisk ?? []).length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">{t("roi.noRoniData")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("costs.entityType")}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("roi.inherentAle")}</th>
                    {perspective === "cfo" ? (
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("roi.roniReturn")}</th>
                    ) : (
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("roi.roniRisk")}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(d?.roniPerRisk ?? []).map((item) => (
                    <tr key={`${item.entityType}-${item.entityId}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px]">{item.entityType}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {item.inherentAle.toLocaleString("de-DE")} {t("currency")}
                      </td>
                      {perspective === "cfo" ? (
                        <td className="px-4 py-3 text-right font-medium text-red-600">
                          -{item.roniCfo.toLocaleString("de-DE")} {t("currency")}
                        </td>
                      ) : (
                        <td className="px-4 py-3 text-right font-medium text-orange-600">
                          {item.roniCiso.toLocaleString("de-DE")} {t("currency")}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ROI vs RONI Comparison */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">{t("roi.roiVsRoni")}</h2>
          <p className="text-xs text-gray-500 mb-4">{t("roi.roiVsRoniDescription")}</p>
          <div className="space-y-3">
            {(d?.roiVsRoni ?? []).slice(0, 10).map((item) => {
              const maxVal = Math.max(item.investmentCost, perspective === "cfo" ? item.roniCfo : item.roniCiso, 1);
              return (
                <div key={`${item.entityType}-${item.entityId}`} className="flex items-center gap-3">
                  <Badge variant="outline" className="text-[10px] w-24 justify-center shrink-0">{item.entityType}</Badge>
                  <div className="flex-1 flex gap-1">
                    <div
                      className="h-5 bg-green-400 rounded-l flex items-center justify-end pr-1 text-[10px] text-white"
                      style={{ width: `${(item.investmentCost / maxVal) * 50}%`, minWidth: "20px" }}
                    >
                      {item.investmentCost > 0 ? item.investmentCost.toLocaleString("de-DE") : ""}
                    </div>
                    <div
                      className="h-5 bg-red-400 rounded-r flex items-center pl-1 text-[10px] text-white"
                      style={{ width: `${((perspective === "cfo" ? item.roniCfo : item.roniCiso) / maxVal) * 50}%`, minWidth: "20px" }}
                    >
                      {(perspective === "cfo" ? item.roniCfo : item.roniCiso) > 0
                        ? (perspective === "cfo" ? item.roniCfo : item.roniCiso).toLocaleString("de-DE")
                        : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <span className="text-xs text-gray-600">{t("roi.invested")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="text-xs text-gray-600">{t("roi.nonInvested")}</span>
            </div>
          </div>
        </div>

        {/* Budget Cut Scenario Slider */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">{t("roi.scenarioSlider")}</h2>
          <p className="text-xs text-gray-500 mb-4">{t("roi.scenarioDescription")}</p>

          <div className="flex items-center gap-4 mb-6">
            <label className="text-sm text-gray-700">{t("roi.cutPercent")}</label>
            <input
              type="range"
              min={0}
              max={50}
              step={5}
              value={cutPercent}
              onChange={(e) => setCutPercent(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xl font-bold text-gray-900 w-16 text-right">{cutPercent}%</span>
          </div>

          {scenarioLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : scenario ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <ScenarioCard
                label={t("roi.cutAmount")}
                value={`${scenario.cutAmount.toLocaleString("de-DE")} ${t("currency")}`}
                color="text-orange-700"
              />
              <ScenarioCard
                label={t("roi.droppedMeasures")}
                value={String(scenario.droppedTreatments.length)}
                color="text-red-700"
              />
              <ScenarioCard
                label={t("roi.newRoni")}
                value={`${scenario.newRoni.toLocaleString("de-DE")} ${t("currency")}`}
                color="text-red-700"
              />
              <ScenarioCard
                label={t("roi.deltaRoni")}
                value={`+${scenario.deltaRoni.toLocaleString("de-DE")} ${t("currency")}`}
                color="text-red-700"
              />
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              {t("roi.scenarioDescription")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ScenarioCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
