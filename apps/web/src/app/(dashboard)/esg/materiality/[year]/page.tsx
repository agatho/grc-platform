"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Loader2, RefreshCcw, ArrowLeft, CheckCircle } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EsgMaterialityAssessment, EsgMaterialityTopic, EsgMaterialityVote } from "@grc/shared";

export default function MaterialityYearPage() {
  return (
    <ModuleGate moduleKey="esg">
      <MaterialityYearInner />
    </ModuleGate>
  );
}

function MaterialityYearInner() {
  const t = useTranslations("esg");
  const params = useParams();
  const router = useRouter();
  const year = params.year as string;

  const [assessment, setAssessment] = useState<EsgMaterialityAssessment | null>(null);
  const [topics, setTopics] = useState<EsgMaterialityTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [votes, setVotes] = useState<EsgMaterialityVote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, tRes] = await Promise.all([
        fetch(`/api/v1/esg/materiality/${year}`),
        fetch(`/api/v1/esg/materiality/${year}/topics`),
      ]);
      if (aRes.ok) {
        const json = await aRes.json();
        setAssessment(json.data);
      }
      if (tRes.ok) {
        const json = await tRes.json();
        setTopics(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const fetchVotes = useCallback(async (topicId: string) => {
    setSelectedTopic(topicId);
    try {
      const res = await fetch(`/api/v1/esg/materiality/topics/${topicId}/votes`);
      if (res.ok) {
        const json = await res.json();
        setVotes(json.data ?? []);
      }
    } catch {
      setVotes([]);
    }
  }, []);

  const handleFinalize = async () => {
    if (!assessment) return;
    if (!confirm(t("materiality.finalizeConfirm"))) return;
    try {
      const res = await fetch(`/api/v1/esg/materiality/${year}/finalize`, { method: "POST" });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      // error handling
    }
  };

  if (loading && !assessment) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/esg/materiality")}>
          <ArrowLeft size={14} className="mr-1" /> {t("back")}
        </Button>
        <p className="text-center text-gray-400 py-12">{t("notFound")}</p>
      </div>
    );
  }

  // Compute matrix bounds
  const maxImpact = Math.max(10, ...topics.map((tp) => tp.impactScore ?? 0));
  const maxFinancial = Math.max(10, ...topics.map((tp) => tp.financialScore ?? 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/esg/materiality")}>
            <ArrowLeft size={14} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("materiality.matrix")} {year}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{t("materiality.subtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          {assessment.status !== "completed" && (
            <Button size="sm" onClick={handleFinalize} className="bg-green-600 hover:bg-green-700">
              <CheckCircle size={14} className="mr-1" />
              {t("materiality.finalize")}
            </Button>
          )}
        </div>
      </div>

      {/* Materiality Matrix (Scatter Plot) */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{t("materiality.matrix")}</h2>
        <div className="relative w-full" style={{ paddingBottom: "60%" }}>
          <div className="absolute inset-0">
            {/* Axis labels */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-gray-500 -mb-5">
              {t("materiality.impactAxis")}
            </div>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-gray-500 -ml-5">
              {t("materiality.financialAxis")}
            </div>

            {/* Grid */}
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Grid lines */}
              <line x1="0" y1="50" x2="100" y2="50" stroke="#e5e7eb" strokeWidth="0.3" strokeDasharray="2 2" />
              <line x1="50" y1="0" x2="50" y2="100" stroke="#e5e7eb" strokeWidth="0.3" strokeDasharray="2 2" />
              {/* Axes */}
              <line x1="0" y1="100" x2="100" y2="100" stroke="#9ca3af" strokeWidth="0.3" />
              <line x1="0" y1="0" x2="0" y2="100" stroke="#9ca3af" strokeWidth="0.3" />

              {/* Topic bubbles */}
              {topics.map((tp) => {
                const x = maxImpact > 0 ? ((tp.impactScore ?? 0) / maxImpact) * 95 + 2.5 : 50;
                const y = maxFinancial > 0 ? 97.5 - ((tp.financialScore ?? 0) / maxFinancial) * 95 : 50;
                const r = Math.max(1.5, Math.min(4, (tp.stakeholderConsensus ?? 5) / 2.5));
                const fill = tp.isMaterial ? "#22c55e" : "#9ca3af";
                return (
                  <circle
                    key={tp.id}
                    cx={x}
                    cy={y}
                    r={r}
                    fill={fill}
                    fillOpacity={0.7}
                    stroke={selectedTopic === tp.id ? "#2563eb" : "white"}
                    strokeWidth={selectedTopic === tp.id ? 0.8 : 0.3}
                    className="cursor-pointer hover:fill-opacity-100 transition-all"
                    onClick={() => fetchVotes(tp.id)}
                  >
                    <title>{`${tp.topicName} (${tp.esrsStandard})\nImpact: ${tp.impactScore}\nFinancial: ${tp.financialScore}`}</title>
                  </circle>
                );
              })}

              {/* Threshold line (diagonal from top-right quadrant) */}
              <line x1="50" y1="50" x2="100" y2="0" stroke="#ef4444" strokeWidth="0.3" strokeDasharray="1 1" opacity={0.5} />
            </svg>
          </div>
        </div>
      </div>

      {/* Topic List Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{t("materiality.topicList")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("materiality.esrsStandard")}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("materiality.topicName")}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("materiality.impactScore")}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("materiality.financialScore")}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("materiality.consensus")}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">{t("materiality.isMaterial")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topics.map((tp) => (
                <tr
                  key={tp.id}
                  className={`hover:bg-gray-50 cursor-pointer ${selectedTopic === tp.id ? "bg-blue-50" : ""}`}
                  onClick={() => fetchVotes(tp.id)}
                >
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px]">{tp.esrsStandard}</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{tp.topicName}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{tp.impactScore?.toFixed(1) ?? "-"}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{tp.financialScore?.toFixed(1) ?? "-"}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{tp.stakeholderConsensus?.toFixed(1) ?? "-"}</td>
                  <td className="px-4 py-3 text-center">
                    {tp.isMaterial === true && <Badge className="bg-green-100 text-green-700 text-[10px]">Yes</Badge>}
                    {tp.isMaterial === false && <Badge className="bg-gray-100 text-gray-500 text-[10px]">No</Badge>}
                    {tp.isMaterial == null && <span className="text-gray-300">-</span>}
                  </td>
                </tr>
              ))}
              {topics.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t("empty")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Voting Panel */}
      {selectedTopic && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t("materiality.voting")}</h2>
          {votes.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t("materiality.voterName")}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t("materiality.voterType")}</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">{t("materiality.impactScore")}</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">{t("materiality.financialScore")}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t("notes")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {votes.map((v) => (
                    <tr key={v.id}>
                      <td className="px-4 py-2 text-gray-900">{v.voterName ?? "-"}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="text-[10px]">
                          {t(`materiality.voterTypes.${v.voterType}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">{Number(v.impactScore).toFixed(1)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{Number(v.financialScore).toFixed(1)}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{v.comment ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
