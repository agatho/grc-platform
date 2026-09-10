"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Zap,
  Loader2,
  AlertTriangle,
  Shield,
  History,
  Activity,
  Calendar,
} from "lucide-react";
import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDateFormat } from "@/lib/format-date";

interface Threat {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  threatCategory: string | null;
  likelihoodRating: number | null;
  isSystem: boolean;
  catalogEntryId: string | null;
  createdAt: string;
}

interface RiskScenario {
  id: string;
  description: string | null;
  riskId: string | null;
  vulnerabilityId: string | null;
  assetId: string | null;
}

export default function ThreatDetailPage() {
  return (
    <ModuleGate moduleKey="isms">
      <ThreatDetailInner />
    </ModuleGate>
  );
}

function ThreatDetailInner() {
  const { formatDate } = useDateFormat();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("isms");

  const [activeTab, setActiveTab] = useState("overview");

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Bedrohung und verknüpfte
  // Szenarien wurden immer gemeinsam geladen, daher eine Abfrage mit einem
  // Ergebnisobjekt; die Ausweichpfade sind unverändert.
  const { data, isPending: loading } = useQuery<{
    threat: Threat | null;
    scenarios: RiskScenario[];
  }>({
    queryKey: ["isms", "threats", id, "detail"],
    queryFn: async () => {
      let threat: Threat | null = null;
      const res = await fetch(`/api/v1/isms/threats/${id}`);
      if (res.ok) {
        const json = await res.json();
        threat = json.data ?? json;
      }
      // Try to fetch linked risk scenarios
      let scenarios: RiskScenario[] = [];
      try {
        const scenRes = await fetch(
          `/api/v1/isms/risk-scenarios?threatId=${id}`,
        );
        if (scenRes.ok) {
          const json = await scenRes.json();
          scenarios = Array.isArray(json) ? json : (json.data ?? []);
        }
      } catch {
        /* endpoint may not exist */
      }
      return { threat, scenarios };
    },
  });
  const threat = data?.threat ?? null;
  const scenarios = data?.scenarios ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!threat) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <AlertTriangle size={32} className="mb-3 text-gray-400" />
        <p className="text-sm font-medium">{t("threatDetail.notFound")}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => router.push("/isms/threats")}
        >
          <ArrowLeft size={14} className="mr-1" />{" "}
          {t("threatDetail.backToList")}
        </Button>
      </div>
    );
  }

  const likelihoodLabel = (rating: number | null) => {
    if (!rating) return "–";
    if (rating < 1 || rating > 5) return String(rating);
    return t(`threatDetail.likelihoodRating.${rating}`);
  };

  const likelihoodColor = (rating: number | null) => {
    if (!rating) return "";
    if (rating >= 4) return "bg-red-100 text-red-900 border-red-300";
    if (rating >= 3) return "bg-yellow-100 text-yellow-900 border-yellow-300";
    return "bg-green-100 text-green-900 border-green-300";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/isms/threats")}
          className="mt-1 shrink-0"
          aria-label={t("threatDetail.backToList")}
        >
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <Zap size={20} className="text-yellow-600 shrink-0" />
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {threat.title}
            </h1>
            {threat.code && (
              <Badge variant="outline" className="font-mono text-xs">
                {threat.code}
              </Badge>
            )}
            {threat.threatCategory && (
              <Badge variant="outline" className="text-xs">
                {threat.threatCategory}
              </Badge>
            )}
            {threat.isSystem && (
              <Badge
                variant="outline"
                className="bg-blue-100 text-blue-900 border-blue-300 text-xs"
              >
                {t("threatDetail.system")}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Zap size={14} className="mr-1.5" />
            {t("threatDetail.tabOverview")}
          </TabsTrigger>
          <TabsTrigger value="scenarios">
            <Shield size={14} className="mr-1.5" />
            {t("threatDetail.tabScenarios")}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History size={14} className="mr-1.5" />
            {t("threatDetail.tabHistory")}
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  {t("threatDetail.details")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <dt className="text-gray-500 font-medium">
                      {t("threatDetail.title")}
                    </dt>
                    <dd className="text-gray-900 mt-0.5">{threat.title}</dd>
                  </div>
                  {threat.code && (
                    <div>
                      <dt className="text-gray-500 font-medium">
                        {t("threatDetail.code")}
                      </dt>
                      <dd className="text-gray-900 mt-0.5 font-mono">
                        {threat.code}
                      </dd>
                    </div>
                  )}
                  {threat.threatCategory && (
                    <div>
                      <dt className="text-gray-500 font-medium">
                        {t("threatDetail.category")}
                      </dt>
                      <dd className="mt-0.5">
                        <Badge variant="outline" className="text-xs">
                          {threat.threatCategory}
                        </Badge>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-gray-500 font-medium">
                      {t("threatDetail.likelihood")}
                    </dt>
                    <dd className="mt-0.5">
                      <Badge
                        variant="outline"
                        className={`text-xs ${likelihoodColor(threat.likelihoodRating)}`}
                      >
                        {likelihoodLabel(threat.likelihoodRating)}
                      </Badge>
                    </dd>
                  </div>
                  {threat.description && (
                    <div className="sm:col-span-2">
                      <dt className="text-gray-500 font-medium">
                        {t("threatDetail.description")}
                      </dt>
                      <dd className="text-gray-900 mt-0.5 whitespace-pre-wrap">
                        {threat.description}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("threatDetail.metadata")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <Calendar size={14} className="shrink-0" />
                  <span>
                    {t("threatDetail.createdAt", {
                      date: formatDate(threat.createdAt),
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Zap size={14} className="shrink-0" />
                  <span>
                    {t("threatDetail.type", {
                      type: threat.isSystem
                        ? t("threatDetail.typeSystem")
                        : t("threatDetail.typeCustom"),
                    })}
                  </span>
                </div>
                {threat.catalogEntryId && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Shield size={14} className="shrink-0" />
                    <span>{t("threatDetail.fromCatalog")}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Risk Scenarios */}
        <TabsContent value="scenarios" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("threatDetail.linkedScenarios")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scenarios.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
                  <Shield size={28} className="text-gray-400 mb-3" />
                  <p className="text-sm text-gray-500">
                    {t("threatDetail.noScenarios")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scenarios.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded-md border border-gray-200 px-4 py-3"
                    >
                      <Shield size={16} className="text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">
                          {s.description ?? t("threatDetail.scenarioFallback")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("threatDetail.changeHistory")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
                <Activity size={28} className="text-gray-400 mb-3" />
                <p className="text-sm text-gray-500">
                  {t("threatDetail.historyLoading")}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
