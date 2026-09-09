"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Cable,
  Server,
  Users,
  ShieldCheck,
  Bug,
  Cloud,
  BarChart3,
  MessageSquare,
  Leaf,
  Wrench,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useDateFormat } from "@/lib/format-date";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Fest verdrahtetes Deutsch —
 * und ein Fall der Sorte, die Welle 5a beschrieben hat: `timeAgo` baute
 * „vor 3 Std." und „vor 2 Tagen" von Hand nach, obwohl
 * `common.dashboard.timeAgo.*` seit jeher in BEIDEN Sprachen im Katalog
 * steht — mit korrekten ICU-Mehrzahlformen. Die Uebersetzung war da, die
 * Seite hat sie ignoriert und daneben eine deutsche Zweitfassung gefuehrt.
 * Auch „Nie" stand schon als `common.users.never`.
 *
 * Die Kategoriebezeichnungen kommen als englische Bezeichner AUS DER
 * SCHNITTSTELLE (`ct.category`). Die neun bekannten werden gegen den Katalog
 * aufgeloest, unbekannte unveraendert durchgereicht.
 */

/** Die Uebersetzungsfunktion, wie sie `timeAgo` braucht. */
type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

// ── Types ─────────────────────────────────────────────────────

interface ConnectorType {
  id: string;
  name: string;
  description: string;
  category: string;
  authMethods: string[];
  supportedEntities: string[];
  iconKey: string;
}

interface ConnectorInstance {
  id: string;
  connectorTypeId: string;
  name: string;
  status: "active" | "error" | "disabled";
  lastSyncAt: string | null;
  lastSyncStatus: "success" | "failed" | null;
  recordCount: number;
}

type CategoryKey =
  | "ERP"
  | "HCM"
  | "CRM"
  | "ITSM"
  | "Cloud Security"
  | "Vulnerability"
  | "Utility"
  | "ESG"
  | "Messaging";

// ── Helpers ───────────────────────────────────────────────────

const CATEGORY_ICONS: Record<CategoryKey, React.ElementType> = {
  ERP: Server,
  HCM: Users,
  CRM: BarChart3,
  ITSM: Wrench,
  "Cloud Security": ShieldCheck,
  Vulnerability: Bug,
  Utility: Cable,
  ESG: Leaf,
  Messaging: MessageSquare,
};

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  ERP: "bg-blue-100 text-blue-800",
  HCM: "bg-purple-100 text-purple-800",
  CRM: "bg-orange-100 text-orange-800",
  ITSM: "bg-teal-100 text-teal-800",
  "Cloud Security": "bg-red-100 text-red-800",
  Vulnerability: "bg-amber-100 text-amber-800",
  Utility: "bg-gray-100 text-gray-800",
  ESG: "bg-green-100 text-green-800",
  Messaging: "bg-indigo-100 text-indigo-800",
};

/** Katalogtaugliche Schluessel fuer die Kategorienamen aus der Schnittstelle. */
const CATEGORY_SLUG: Record<CategoryKey, string> = {
  ERP: "erp",
  HCM: "hcm",
  CRM: "crm",
  ITSM: "itsm",
  "Cloud Security": "cloud_security",
  Vulnerability: "vulnerability",
  Utility: "utility",
  ESG: "esg",
  Messaging: "messaging",
};

const CATEGORY_ORDER: CategoryKey[] = [
  "ERP",
  "HCM",
  "CRM",
  "ITSM",
  "Cloud Security",
  "Vulnerability",
  "Utility",
  "ESG",
  "Messaging",
];

function timeAgo(dateStr: string | null, tCommon: Translate): string {
  if (!dateStr) return tCommon("users.never");
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return tCommon("dashboard.timeAgo.justNow");
  if (minutes < 60)
    return tCommon("dashboard.timeAgo.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return tCommon("dashboard.timeAgo.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return tCommon("dashboard.timeAgo.daysAgo", { count: days });
}

// ── Component ─────────────────────────────────────────────────

export default function ConnectorManagementPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { formatDateTime, formatNumber } = useDateFormat();
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade-, Daten- und Fehlerzustand (Muster
  // aus Welle 7b, `catalogs/objects/page.tsx`). Typen und Instanzen wurden
  // immer zusammen geholt und zusammen verwendet — daher EINE Abfrage. Ein
  // Netzfehler landet wie vorher als Fehlertext auf der Seite; die Antwort-
  // koerper werden wie vorher ohne `ok`-Pruefung gelesen.
  const {
    data,
    isPending: loading,
    isError,
    refetch,
  } = useQuery<{
    connectorTypes: ConnectorType[];
    instances: ConnectorInstance[];
  }>({
    queryKey: ["connectors", "types-and-instances"],
    queryFn: async () => {
      const [typesRes, instancesRes] = await Promise.all([
        fetch("/api/v1/connectors/types"),
        fetch("/api/v1/connectors/instances"),
      ]);
      const typesJson = await typesRes.json().catch(() => ({ data: [] }));
      const instancesJson = await instancesRes
        .json()
        .catch(() => ({ data: [] }));
      return {
        connectorTypes: (typesJson.data ?? []) as ConnectorType[],
        instances: (instancesJson.data ?? []) as ConnectorInstance[],
      };
    },
  });
  const connectorTypes = data?.connectorTypes ?? [];
  const instances = data?.instances ?? [];
  const error = isError ? t("connectors.loadError") : "";

  const fetchData = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Group instances by connectorTypeId
  const instancesByType = instances.reduce<Record<string, ConnectorInstance[]>>(
    (acc, inst) => {
      if (!acc[inst.connectorTypeId]) acc[inst.connectorTypeId] = [];
      acc[inst.connectorTypeId].push(inst);
      return acc;
    },
    {},
  );

  // Group connector types by category
  const typesByCategory = connectorTypes.reduce<
    Record<string, ConnectorType[]>
  >((acc, ct) => {
    const cat = ct.category || "Utility";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ct);
    return acc;
  }, {});

  // Sorted categories: known order first, then any extras
  const sortedCategories = [
    ...CATEGORY_ORDER.filter((c) => typesByCategory[c]),
    ...Object.keys(typesByCategory).filter(
      (c) => !CATEGORY_ORDER.includes(c as CategoryKey),
    ),
  ];

  // Stats
  const totalConfigured = instances.length;
  const activeSyncs = instances.filter((i) => i.status === "active").length;
  const failedSyncs = instances.filter(
    (i) => i.lastSyncStatus === "failed",
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Cable className="h-6 w-6" />
            {t("connectors.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("connectors.description")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          {tCommon("actions.refresh")}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <Cable className="mx-auto h-5 w-5 text-gray-400" />
            <p className="mt-1 text-lg font-semibold">
              {connectorTypes.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("connectors.kpi.availableTypes")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-5 w-5 text-green-500" />
            <p className="mt-1 text-lg font-semibold">{totalConfigured}</p>
            <p className="text-xs text-muted-foreground">
              {tCommon("settings.aiProviders.configured")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <Cloud className="mx-auto h-5 w-5 text-blue-500" />
            <p className="mt-1 text-lg font-semibold">{activeSyncs}</p>
            <p className="text-xs text-muted-foreground">
              {t("connectors.kpi.activeSyncs")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <XCircle
              className={`mx-auto h-5 w-5 ${failedSyncs > 0 ? "text-red-500" : "text-gray-400"}`}
            />
            <p
              className={`mt-1 text-lg font-semibold ${failedSyncs > 0 ? "text-red-600" : ""}`}
            >
              {failedSyncs}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("syncLog.status.failed")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {connectorTypes.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Cable className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p className="font-medium">{t("connectors.empty")}</p>
            <p className="mt-1 text-sm">{t("connectors.emptyHint")}</p>
          </CardContent>
        </Card>
      )}

      {/* Connector Types grouped by category */}
      {sortedCategories.map((category) => {
        const types = typesByCategory[category] ?? [];
        const catKey = category as CategoryKey;
        const CatIcon = CATEGORY_ICONS[catKey] ?? Cable;
        const catColor = CATEGORY_COLORS[catKey] ?? "bg-gray-100 text-gray-800";

        return (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-2">
              <CatIcon className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">
                {CATEGORY_ORDER.includes(catKey)
                  ? t(`connectors.category.${CATEGORY_SLUG[catKey]}`)
                  : category}
              </h2>
              <Badge variant="outline" className="text-xs">
                {t("connectors.connectorCount", { count: types.length })}
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {types.map((ct) => {
                const ctInstances = instancesByType[ct.id] ?? [];
                const isConfigured = ctInstances.length > 0;

                return (
                  <Card key={ct.id} className="relative overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <CatIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base">
                              {ct.name}
                            </CardTitle>
                            <Badge
                              variant="outline"
                              className={`mt-1 text-[10px] ${catColor}`}
                            >
                              {CATEGORY_ORDER.includes(
                                ct.category as CategoryKey,
                              )
                                ? t(
                                    `connectors.category.${CATEGORY_SLUG[ct.category as CategoryKey]}`,
                                  )
                                : ct.category}
                            </Badge>
                          </div>
                        </div>
                        <Badge
                          variant={isConfigured ? "default" : "outline"}
                          className={
                            isConfigured
                              ? "bg-green-100 text-green-800"
                              : "text-muted-foreground"
                          }
                        >
                          {isConfigured
                            ? tCommon("settings.aiProviders.configured")
                            : t("connectors.available")}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {ct.description}
                      </p>

                      {/* Auth Methods */}
                      {ct.authMethods && ct.authMethods.length > 0 && (
                        <div>
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            {t("connectors.authMethods")}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {ct.authMethods.map((m) => (
                              <Badge
                                key={m}
                                variant="outline"
                                className="text-[10px] px-1.5"
                              >
                                {m}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Supported Entities */}
                      {ct.supportedEntities &&
                        ct.supportedEntities.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-medium text-muted-foreground">
                              {t("connectors.supportedEntities")}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {ct.supportedEntities.map((e) => (
                                <Badge
                                  key={e}
                                  variant="outline"
                                  className="bg-blue-50 text-[10px] px-1.5"
                                >
                                  {e}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Configured Instances */}
                      {ctInstances.length > 0 && (
                        <div className="space-y-2 rounded-md border bg-muted/30 p-2">
                          <p className="text-xs font-medium">
                            {t("connectors.instanceCount", {
                              count: ctInstances.length,
                            })}
                          </p>
                          {ctInstances.map((inst) => (
                            <div
                              key={inst.id}
                              className="flex items-center justify-between rounded bg-background px-2 py-1.5 text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="font-medium truncate block">
                                  {inst.name}
                                </span>
                                <span className="text-muted-foreground">
                                  {t("connectors.recordCount", {
                                    value: formatNumber(inst.recordCount),
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {inst.lastSyncStatus === "success" ? (
                                  <Badge
                                    variant="outline"
                                    className="border-green-200 bg-green-50 text-green-700 text-[10px]"
                                  >
                                    <CheckCircle2 className="mr-0.5 h-3 w-3" />
                                    {t("connectors.syncOk")}
                                  </Badge>
                                ) : inst.lastSyncStatus === "failed" ? (
                                  <Badge
                                    variant="outline"
                                    className="border-red-200 bg-red-50 text-red-700 text-[10px]"
                                  >
                                    <XCircle className="mr-0.5 h-3 w-3" />
                                    {t("syncLog.status.failed")}
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    {t("approvalRequests.status.pending")}
                                  </Badge>
                                )}
                                <span
                                  className="text-[10px] text-muted-foreground whitespace-nowrap"
                                  title={formatDateTime(inst.lastSyncAt)}
                                >
                                  <Clock className="mr-0.5 inline h-3 w-3" />
                                  {timeAgo(inst.lastSyncAt, tCommon)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action */}
                      <Button
                        variant={isConfigured ? "outline" : "default"}
                        size="sm"
                        className="w-full"
                      >
                        <Plus className="mr-1.5 h-4 w-4" />
                        {isConfigured
                          ? t("connectors.addInstance")
                          : t("connectors.setUp")}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
