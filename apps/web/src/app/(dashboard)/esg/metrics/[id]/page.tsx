"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Loader2, RefreshCcw, ArrowLeft, Plus, CheckCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EsrsMetric, EsgMeasurement } from "@grc/shared";

export default function MetricDetailPage() {
  return (
    <ModuleGate moduleKey="esg">
      <MetricDetailInner />
    </ModuleGate>
  );
}

function MetricDetailInner() {
  const t = useTranslations("esg");
  const params = useParams();
  const router = useRouter();
  const metricId = params.id as string;

  const [metric, setMetric] = useState<EsrsMetric | null>(null);
  const [measurements, setMeasurements] = useState<EsgMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formPeriodStart, setFormPeriodStart] = useState("");
  const [formPeriodEnd, setFormPeriodEnd] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formQuality, setFormQuality] = useState("estimated");
  const [formSource, setFormSource] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, measRes] = await Promise.all([
        fetch(`/api/v1/esg/metrics/${metricId}`),
        fetch(`/api/v1/esg/metrics/${metricId}/measurements`),
      ]);
      if (mRes.ok) {
        const json = await mRes.json();
        setMetric(json.data);
      }
      if (measRes.ok) {
        const json = await measRes.json();
        setMeasurements(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [metricId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/esg/metrics/${metricId}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart: formPeriodStart,
          periodEnd: formPeriodEnd,
          value: Number(formValue),
          unit: metric?.unit ?? "",
          dataQuality: formQuality,
          source: formSource || undefined,
          notes: formNotes || undefined,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormValue("");
        setFormSource("");
        setFormNotes("");
        await fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (measurementId: string) => {
    try {
      await fetch(`/api/v1/esg/measurements/${measurementId}/verify`, { method: "POST" });
      await fetchData();
    } catch {
      // error handling
    }
  };

  if (loading && !metric) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!metric) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/esg/metrics")}>
          <ArrowLeft size={14} className="mr-1" /> {t("back")}
        </Button>
        <p className="text-center text-gray-400 py-12">{t("notFound")}</p>
      </div>
    );
  }

  // Chart data
  const chartData = [...measurements]
    .sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime())
    .map((m) => ({
      period: m.periodStart,
      value: Number(m.value),
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/esg/metrics")}>
            <ArrowLeft size={14} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{metric.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {t("metrics.detail")} | {metric.unit} | {metric.frequency.replace("_", " ")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={14} className="mr-1" />
            {t("metrics.recordMeasurement")}
          </Button>
        </div>
      </div>

      {/* Record Measurement Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">{t("metrics.recordMeasurement")}</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("metrics.periodStart")}</label>
              <input
                type="date"
                required
                value={formPeriodStart}
                onChange={(e) => setFormPeriodStart(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("metrics.periodEnd")}</label>
              <input
                type="date"
                required
                value={formPeriodEnd}
                onChange={(e) => setFormPeriodEnd(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("value")} ({metric.unit})</label>
              <input
                type="number"
                step="any"
                required
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("metrics.dataQuality")}</label>
              <select
                value={formQuality}
                onChange={(e) => setFormQuality(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="measured">{t("quality.measured")}</option>
                <option value="estimated">{t("quality.estimated")}</option>
                <option value="calculated">{t("quality.calculated")}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("source")}</label>
              <input
                type="text"
                value={formSource}
                onChange={(e) => setFormSource(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("notes")}</label>
              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={submitting}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : t("save")}
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={() => setShowForm(false)}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}

      {/* Time Series Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{t("metrics.timeSeries")}</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">{t("noData")}</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(val: number) => [`${val} ${metric.unit}`, t("value")]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#2563eb" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Measurement History Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{t("metrics.measurementHistory")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("period")}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("value")}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">{t("metrics.dataQuality")}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("source")}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">{t("metrics.verified")}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("metrics.recordedAt")}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {measurements.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">
                    {m.periodStart} - {m.periodEnd}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {Number(m.value).toLocaleString()} {m.unit}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <QualityBadge quality={m.dataQuality} t={t} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.source ?? "-"}</td>
                  <td className="px-4 py-3 text-center">
                    {m.verifiedAt ? (
                      <Badge className="bg-green-100 text-green-700 text-[10px]">
                        <CheckCircle size={10} className="mr-1" />
                        {t("metrics.verified")}
                      </Badge>
                    ) : (
                      <span className="text-xs text-gray-400">{t("metrics.unverified")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(m.recordedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!m.verifiedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerify(m.id)}
                        className="text-xs"
                      >
                        {t("metrics.verify")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {measurements.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">{t("empty")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function QualityBadge({ quality, t }: { quality: string; t: (key: string) => string }) {
  const colors: Record<string, string> = {
    measured: "bg-green-100 text-green-700",
    estimated: "bg-yellow-100 text-yellow-700",
    calculated: "bg-blue-100 text-blue-700",
  };
  return (
    <Badge variant="outline" className={`${colors[quality] ?? ""} text-[10px]`}>
      {t(`quality.${quality}`)}
    </Badge>
  );
}
