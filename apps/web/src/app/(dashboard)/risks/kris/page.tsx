"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  X,
  Clock,
  Inbox,
  ChevronRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type {
  KRI,
  KRIMeasurement,
  KriAlertStatus,
  KriTrend,
  KriMeasurementFrequency,
} from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KriListItem extends KRI {
  linkedRiskName?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusBorderColors: Record<KriAlertStatus, string> = {
  green: "border-l-green-500",
  yellow: "border-l-yellow-400",
  red: "border-l-red-500",
};

const statusBgColors: Record<KriAlertStatus, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  red: "bg-red-500",
};

const lineColors: Record<KriAlertStatus, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
};

function trendIcon(trend: KriTrend) {
  switch (trend) {
    case "improving":
      return <TrendingDown size={16} className="text-green-600" />;
    case "worsening":
      return <TrendingUp size={16} className="text-red-600" />;
    default:
      return <Minus size={16} className="text-gray-400" />;
  }
}

// ---------------------------------------------------------------------------
// KRI Sparkline Component
// ---------------------------------------------------------------------------

function KriSparkline({
  measurements,
  alertStatus,
  height = 60,
}: {
  measurements: KRIMeasurement[];
  alertStatus: KriAlertStatus;
  height?: number;
}) {
  const data = [...measurements]
    .sort(
      (a, b) =>
        new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
    )
    .map((m) => ({
      date: new Date(m.measuredAt).toLocaleDateString(),
      value: parseFloat(m.value),
    }));

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs text-gray-400"
        style={{ height }}
      >
        Not enough data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={lineColors[alertStatus]}
          strokeWidth={2}
          dot={false}
        />
        <Tooltip
          contentStyle={{ fontSize: "11px", padding: "4px 8px" }}
          labelStyle={{ fontSize: "10px" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// KRI Detail Slide-over
// ---------------------------------------------------------------------------

function KriSlideOver({
  kri,
  measurements,
  onClose,
  t,
}: {
  kri: KriListItem;
  measurements: KRIMeasurement[];
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const chartData = [...measurements]
    .sort(
      (a, b) =>
        new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
    )
    .map((m) => ({
      date: new Date(m.measuredAt).toLocaleDateString(),
      value: parseFloat(m.value),
    }));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{kri.name}</h2>
            {kri.linkedRiskName && (
              <p className="text-sm text-gray-500">{kri.linkedRiskName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Current value + status */}
          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                {kri.currentValue ?? "-"}
              </span>
              {kri.unit && (
                <span className="text-sm text-gray-400">{kri.unit}</span>
              )}
            </div>
            <span
              className={`w-3 h-3 rounded-full ${statusBgColors[kri.currentAlertStatus]}`}
            />
            {trendIcon(kri.trend)}
          </div>

          {/* Full chart */}
          <div className="rounded-lg border border-gray-200 p-4">
            {chartData.length >= 2 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    stroke="#9ca3af"
                  />
                  <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{ fontSize: "12px" }}
                    labelStyle={{ fontSize: "11px" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={lineColors[kri.currentAlertStatus]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">
                Not enough data for chart
              </div>
            )}
          </div>

          {/* Thresholds */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              {t("thresholds")}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                <div className="text-xs text-green-600">{t("thresholdGreen")}</div>
                <div className="text-sm font-semibold text-green-700 mt-1">
                  {kri.thresholdGreen ?? "-"}
                </div>
              </div>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-center">
                <div className="text-xs text-yellow-600">{t("thresholdYellow")}</div>
                <div className="text-sm font-semibold text-yellow-700 mt-1">
                  {kri.thresholdYellow ?? "-"}
                </div>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                <div className="text-xs text-red-600">{t("thresholdRed")}</div>
                <div className="text-sm font-semibold text-red-700 mt-1">
                  {kri.thresholdRed ?? "-"}
                </div>
              </div>
            </div>
          </div>

          {/* Measurement history table */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              {t("measurementHistory")}
            </h3>
            {measurements.length === 0 ? (
              <p className="text-sm text-gray-400">No measurements</p>
            ) : (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="text-left py-2 px-3">{t("measurementDate")}</th>
                      <th className="text-right py-2 px-3">{t("measurementValue")}</th>
                      <th className="text-left py-2 px-3">{t("measurementSource")}</th>
                      <th className="text-left py-2 px-3">{t("measurementNotes")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measurements.map((m) => (
                      <tr key={m.id} className="border-t">
                        <td className="py-2 px-3 text-gray-600">
                          {new Date(m.measuredAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          {m.value}
                        </td>
                        <td className="py-2 px-3 text-gray-500">{m.source}</td>
                        <td className="py-2 px-3 text-gray-400 text-xs truncate max-w-[120px]">
                          {m.notes ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function KriDashboardContent() {
  const t = useTranslations("risk.kri");

  const [kris, setKris] = useState<KriListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Measurements cache: kriId -> measurements
  const [measurementsCache, setMeasurementsCache] = useState<
    Record<string, KRIMeasurement[]>
  >({});

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("");
  const [frequencyFilter, setFrequencyFilter] = useState<string>("");

  // Slide-over
  const [selectedKri, setSelectedKri] = useState<KriListItem | null>(null);

  // Inline measurement
  const [measKriId, setMeasKriId] = useState<string | null>(null);
  const [measValue, setMeasValue] = useState("");
  const [savingMeas, setSavingMeas] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch KRIs
  // ---------------------------------------------------------------------------

  const fetchKris = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (statusFilter !== "all") params.set("alertStatus", statusFilter);
      if (riskFilter) params.set("riskId", riskFilter);
      if (frequencyFilter) params.set("measurementFrequency", frequencyFilter);

      const res = await fetch(`/api/v1/kris?${params.toString()}`);
      if (!res.ok) throw new Error("Failed");
      const json: PaginatedResponse<KriListItem> = await res.json();
      setKris(json.data);
      setError(false);

      // Fetch measurements for each KRI (last 12)
      const cache: Record<string, KRIMeasurement[]> = {};
      await Promise.all(
        json.data.map(async (k) => {
          try {
            const mRes = await fetch(
              `/api/v1/kris/${k.id}/measurements?limit=12`,
            );
            if (mRes.ok) {
              const mJson = await mRes.json();
              cache[k.id] = mJson.data ?? [];
            }
          } catch {
            cache[k.id] = [];
          }
        }),
      );
      setMeasurementsCache(cache);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, riskFilter, frequencyFilter]);

  useEffect(() => {
    void fetchKris();
  }, [fetchKris]);

  // Status counts
  const greenCount = kris.filter(
    (k) => k.currentAlertStatus === "green",
  ).length;
  const yellowCount = kris.filter(
    (k) => k.currentAlertStatus === "yellow",
  ).length;
  const redCount = kris.filter(
    (k) => k.currentAlertStatus === "red",
  ).length;

  // Add measurement
  async function addMeasurement() {
    if (!measKriId || !measValue) return;
    setSavingMeas(true);
    try {
      const res = await fetch(`/api/v1/kris/${measKriId}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: parseFloat(measValue),
          measuredAt: new Date().toISOString(),
          source: "manual",
        }),
      });
      if (res.ok) {
        setMeasKriId(null);
        setMeasValue("");
        await fetchKris();
      }
    } catch {
      // Error handling
    } finally {
      setSavingMeas(false);
    }
  }

  // Unique risk IDs for filter dropdown
  const uniqueRisks = Array.from(
    new Map(
      kris
        .filter((k) => k.riskId)
        .map((k) => [k.riskId!, { id: k.riskId!, name: k.linkedRiskName }]),
    ).values(),
  );

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
      </div>

      {/* ── Status summary ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">{t("total")}</p>
          <p className="text-2xl font-bold text-gray-900">{kris.length}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-600">{t("ok")}</p>
          <p className="text-2xl font-bold text-green-700">{greenCount}</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-600">{t("warning")}</p>
          <p className="text-2xl font-bold text-yellow-700">{yellowCount}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{t("critical")}</p>
          <p className="text-2xl font-bold text-red-700">{redCount}</p>
        </div>
      </div>

      {/* ── Filter tabs + dropdowns ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Tabs
          value={statusFilter}
          onValueChange={setStatusFilter}
          className="w-auto"
        >
          <TabsList>
            <TabsTrigger value="all">{t("all")}</TabsTrigger>
            <TabsTrigger value="green">{t("ok")}</TabsTrigger>
            <TabsTrigger value="yellow">{t("warning")}</TabsTrigger>
            <TabsTrigger value="red">{t("critical")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">{t("allRisks")}</option>
          {uniqueRisks.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name ?? r.id.slice(0, 8)}
            </option>
          ))}
        </select>

        <select
          value={frequencyFilter}
          onChange={(e) => setFrequencyFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">{t("allFrequencies")}</option>
          {(["daily", "weekly", "monthly", "quarterly"] as const).map((f) => (
            <option key={f} value={f}>
              {t(`frequencies.${f}`)}
            </option>
          ))}
        </select>
      </div>

      {/* ── KRI Grid ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Activity size={32} className="mb-2" />
          <p className="text-sm">{t("loadError")}</p>
        </div>
      ) : kris.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Inbox size={32} className="mb-2" />
          <p className="text-sm">{t("noKris")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kris.map((k) => {
            const measurements = measurementsCache[k.id] ?? [];
            return (
              <Card
                key={k.id}
                className={`border-l-4 ${statusBorderColors[k.currentAlertStatus]}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm truncate">{k.name}</CardTitle>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${statusBgColors[k.currentAlertStatus]}`}
                      />
                      {trendIcon(k.trend)}
                    </div>
                  </div>
                  {k.linkedRiskName && (
                    <Link
                      href={k.riskId ? `/risks/${k.riskId}` : "#"}
                      className="text-xs text-blue-600 hover:text-blue-800 truncate block"
                    >
                      {k.linkedRiskName}
                    </Link>
                  )}
                </CardHeader>

                <CardContent className="space-y-2">
                  {/* Current value */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {k.currentValue ?? "-"}
                    </span>
                    {k.unit && (
                      <span className="text-sm text-gray-400">{k.unit}</span>
                    )}
                  </div>

                  {/* Sparkline */}
                  <KriSparkline
                    measurements={measurements}
                    alertStatus={k.currentAlertStatus}
                  />

                  {/* Thresholds */}
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {k.thresholdGreen && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        {k.thresholdGreen}
                      </span>
                    )}
                    {k.thresholdYellow && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-yellow-400" />
                        {k.thresholdYellow}
                      </span>
                    )}
                    {k.thresholdRed && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        {k.thresholdRed}
                      </span>
                    )}
                  </div>

                  {/* Last measured */}
                  {k.lastMeasuredAt && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(k.lastMeasuredAt).toLocaleDateString()}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => setSelectedKri(k)}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      {t("details")} <ChevronRight size={12} />
                    </button>

                    {measKriId === k.id ? (
                      <div className="flex items-center gap-1 ml-auto">
                        <input
                          type="number"
                          value={measValue}
                          onChange={(e) => setMeasValue(e.target.value)}
                          placeholder={t("measurementValue")}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
                        />
                        <button
                          onClick={addMeasurement}
                          disabled={savingMeas || !measValue}
                          className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingMeas ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            "+"
                          )}
                        </button>
                        <button
                          onClick={() => setMeasKriId(null)}
                          className="text-xs text-gray-400"
                        >
                          x
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setMeasKriId(k.id)}
                        className="text-xs text-gray-500 hover:text-blue-600 ml-auto"
                      >
                        + {t("addMeasurement")}
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Slide-over ──────────────────────────────────────────── */}
      {selectedKri && (
        <KriSlideOver
          kri={selectedKri}
          measurements={measurementsCache[selectedKri.id] ?? []}
          onClose={() => setSelectedKri(null)}
          t={t}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page with ModuleGate
// ---------------------------------------------------------------------------

export default function KriDashboardPage() {
  return (
    <ModuleGate moduleKey="erm">
      <KriDashboardContent />
    </ModuleGate>
  );
}
