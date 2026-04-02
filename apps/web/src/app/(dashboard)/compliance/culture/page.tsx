"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUp,
  ArrowDown,
  Minus,
  Settings,
  Download,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import Link from "next/link";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import type {
  CCICurrentResponse,
  CCIHistoryEntry,
  CCIDepartmentEntry,
  CCIFactorsResponse,
  CCIFactorKey,
  CCITrend,
} from "@grc/shared";

const FACTOR_LABELS: Record<CCIFactorKey, { de: string; en: string }> = {
  task_compliance: { de: "Aufgaben-Compliance", en: "Task Compliance" },
  policy_ack_rate: { de: "Richtlinien-Kenntnisnahme", en: "Policy Acknowledgment" },
  training_completion: { de: "Schulungsabschluss", en: "Training Completion" },
  incident_response_time: { de: "Vorfallreaktion", en: "Incident Response" },
  audit_finding_closure: { de: "Feststellungsbehebung", en: "Finding Closure" },
  self_assessment_participation: { de: "Self-Assessment", en: "Self-Assessment" },
};

function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
}

function getScoreBgColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-800";
  if (score >= 40) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function TrendIcon({ trend }: { trend: CCITrend | null | undefined }) {
  if (trend === "up") return <ArrowUp className="h-4 w-4 text-green-600" />;
  if (trend === "down") return <ArrowDown className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
}

export default function CCIDashboardPage() {
  const t = useTranslations("cci");
  const [current, setCurrent] = useState<CCICurrentResponse | null>(null);
  const [history, setHistory] = useState<CCIHistoryEntry[]>([]);
  const [departments, setDepartments] = useState<CCIDepartmentEntry[]>([]);
  const [factors, setFactors] = useState<CCIFactorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState("12");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [cciRes, histRes, deptRes, factRes] = await Promise.all([
          fetch("/api/v1/compliance/cci"),
          fetch(`/api/v1/compliance/cci/history?months=${months}`),
          fetch("/api/v1/compliance/cci/departments"),
          fetch("/api/v1/compliance/cci/factors"),
        ]);

        if (cciRes.ok) {
          const data = await cciRes.json();
          setCurrent(data.data);
        }
        if (histRes.ok) {
          const data = await histRes.json();
          setHistory(data.data ?? []);
        }
        if (deptRes.ok) {
          const data = await deptRes.json();
          setDepartments(data.data ?? []);
        }
        if (factRes.ok) {
          const data = await factRes.json();
          setFactors(data.data ?? null);
        }
      } catch (err) {
        console.error("Failed to load CCI data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [months]);

  const radarData = useMemo(() => {
    if (!factors?.factors) return [];
    return factors.factors.map((f) => ({
      factor: FACTOR_LABELS[f.key]?.en ?? f.key,
      current: f.score,
      previous: f.previousScore ?? 0,
    }));
  }, [factors]);

  const improvementAreas = useMemo(() => {
    if (!factors?.factors) return [];
    return [...factors.factors]
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
  }, [factors]);

  const overallScore = current?.snapshot?.overallScore ?? 0;
  const trend = current?.trend;
  const delta = current?.delta;

  async function handleExport() {
    const res = await fetch("/api/v1/compliance/cci/export-pdf", {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cci-report-${current?.snapshot?.period ?? "export"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Activity className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("description")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={months} onValueChange={setMonths}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">{t("last3Months")}</SelectItem>
              <SelectItem value="6">{t("last6Months")}</SelectItem>
              <SelectItem value="12">{t("last12Months")}</SelectItem>
              <SelectItem value="24">{t("last24Months")}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            {t("export")}
          </Button>
          <Link href="/compliance/culture/settings">
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              {t("configure")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Score Header Card */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center">
                <span className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>
                  {overallScore.toFixed(1)}
                </span>
                <span className="mt-1 text-xs text-gray-500">{t("outOf100")}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendIcon trend={trend} />
                {delta != null && (
                  <span
                    className={`text-sm font-medium ${
                      delta > 0
                        ? "text-green-600"
                        : delta < 0
                          ? "text-red-600"
                          : "text-gray-500"
                    }`}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)} {t("vsPreviousMonth")}
                  </span>
                )}
              </div>
            </div>
            {current?.snapshot?.period && (
              <Badge variant="secondary">{current.snapshot.period}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("factorRadar")}</CardTitle>
            <CardDescription>{t("factorRadarDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="factor" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar
                    name={t("currentMonth")}
                    dataKey="current"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                  />
                  <Radar
                    name={t("previousMonth")}
                    dataKey="previous"
                    stroke="#9ca3af"
                    fill="#9ca3af"
                    fillOpacity={0.1}
                  />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[350px] items-center justify-center text-sm text-gray-400">
                {t("noData")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trend Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("trendChart")}</CardTitle>
            <CardDescription>{t("trendChartDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="3 3" label="Target" />
                  <Line
                    type="monotone"
                    dataKey="overallScore"
                    name={t("cciScore")}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[350px] items-center justify-center text-sm text-gray-400">
                {t("noData")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Department Heatmap */}
      {departments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("departmentHeatmap")}</CardTitle>
            <CardDescription>{t("departmentHeatmapDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      {t("department")}
                    </th>
                    {Object.keys(FACTOR_LABELS).map((key) => (
                      <th
                        key={key}
                        className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500"
                      >
                        {FACTOR_LABELS[key as CCIFactorKey].en}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      {t("overall")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {departments.map((dept) => (
                    <tr key={dept.orgEntityId}>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                        {dept.departmentName}
                      </td>
                      {Object.keys(FACTOR_LABELS).map((key) => {
                        const score = dept.factorScores?.[key as CCIFactorKey] ?? 0;
                        return (
                          <td key={key} className="px-4 py-2 text-center">
                            <Badge className={getScoreBgColor(score)}>
                              {score.toFixed(0)}
                            </Badge>
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-center">
                        <Badge className={getScoreBgColor(dept.overallScore)}>
                          {dept.overallScore.toFixed(1)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top-3 Improvement Areas */}
      {improvementAreas.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {improvementAreas.map((area, idx) => (
            <Card key={area.key}>
              <CardHeader className="pb-2">
                <CardDescription>
                  {t("improvementArea")} #{idx + 1}
                </CardDescription>
                <CardTitle className="text-lg">
                  {FACTOR_LABELS[area.key]?.en ?? area.key}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-bold ${getScoreColor(area.score)}`}>
                    {area.score.toFixed(1)}
                  </span>
                  <TrendIcon trend={area.trend} />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {t("improvementTip")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
