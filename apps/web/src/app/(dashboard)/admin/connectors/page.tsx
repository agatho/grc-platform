"use client";

import { useState, useEffect, useCallback } from "react";
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "---";
  return new Date(dateStr).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Nie";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days > 1 ? "en" : ""}`;
}

// ── Component ─────────────────────────────────────────────────

export default function ConnectorManagementPage() {
  const [connectorTypes, setConnectorTypes] = useState<ConnectorType[]>([]);
  const [instances, setInstances] = useState<ConnectorInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [typesRes, instancesRes] = await Promise.all([
        fetch("/api/v1/connectors/types"),
        fetch("/api/v1/connectors/instances"),
      ]);
      const typesJson = await typesRes.json().catch(() => ({ data: [] }));
      const instancesJson = await instancesRes
        .json()
        .catch(() => ({ data: [] }));
      setConnectorTypes(typesJson.data ?? []);
      setInstances(instancesJson.data ?? []);
    } catch {
      setError(
        "Konnektor-Daten konnten nicht geladen werden. Bitte versuchen Sie es erneut.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
            Enterprise-Konnektoren
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Anbindung an SAP, Oracle, Workday, Salesforce, Cloud-Security und
            weitere Systeme
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Aktualisieren
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
            <p className="text-xs text-muted-foreground">Verfügbare Typen</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-5 w-5 text-green-500" />
            <p className="mt-1 text-lg font-semibold">{totalConfigured}</p>
            <p className="text-xs text-muted-foreground">Konfiguriert</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <Cloud className="mx-auto h-5 w-5 text-blue-500" />
            <p className="mt-1 text-lg font-semibold">{activeSyncs}</p>
            <p className="text-xs text-muted-foreground">Aktive Syncs</p>
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
            <p className="text-xs text-muted-foreground">Fehlgeschlagen</p>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {connectorTypes.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Cable className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p className="font-medium">Keine Konnektor-Typen verfügbar</p>
            <p className="mt-1 text-sm">
              Konnektor-Typen werden über die API bereitgestellt.
            </p>
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
              <h2 className="text-lg font-semibold">{category}</h2>
              <Badge variant="outline" className="text-xs">
                {types.length}{" "}
                {types.length === 1 ? "Konnektor" : "Konnektoren"}
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
                              {ct.category}
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
                          {isConfigured ? "Konfiguriert" : "Verfügbar"}
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
                            Auth-Methoden
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
                              Unterstützte Entitäten
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
                            {ctInstances.length} konfigurierte{" "}
                            {ctInstances.length === 1 ? "Instanz" : "Instanzen"}
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
                                  {inst.recordCount.toLocaleString("de-DE")}{" "}
                                  Datensätze
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {inst.lastSyncStatus === "success" ? (
                                  <Badge
                                    variant="outline"
                                    className="border-green-200 bg-green-50 text-green-700 text-[10px]"
                                  >
                                    <CheckCircle2 className="mr-0.5 h-3 w-3" />
                                    Sync OK
                                  </Badge>
                                ) : inst.lastSyncStatus === "failed" ? (
                                  <Badge
                                    variant="outline"
                                    className="border-red-200 bg-red-50 text-red-700 text-[10px]"
                                  >
                                    <XCircle className="mr-0.5 h-3 w-3" />
                                    Fehlgeschlagen
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    Ausstehend
                                  </Badge>
                                )}
                                <span
                                  className="text-[10px] text-muted-foreground whitespace-nowrap"
                                  title={formatDate(inst.lastSyncAt)}
                                >
                                  <Clock className="mr-0.5 inline h-3 w-3" />
                                  {timeAgo(inst.lastSyncAt)}
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
                          ? "Weitere Instanz einrichten"
                          : "Konnektor einrichten"}
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
