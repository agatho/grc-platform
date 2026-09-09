"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Pencil,
  Loader2,
  Server,
  Calendar,
  Clock,
  AlertTriangle,
  Bug,
  Activity,
  History,
  FileText,
} from "lucide-react";
import { ModuleGate } from "@/components/module/module-gate";
import { ProtectionLevelBadge } from "@/components/isms/protection-level-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDateFormat } from "@/lib/format-date";

// ── Types ────────────────────────────────────────────────────────
interface AssetDetail {
  id: string;
  name: string;
  description: string | null;
  assetTier: string;
  codeGroup: string | null;
  parentAssetId: string | null;
  contactPerson: string | null;
  dataProtectionResponsible: string | null;
  dpoEmail: string | null;
  latestAuditDate: string | null;
  latestAuditResult: string | null;
  defaultConfidentiality: number | null;
  defaultIntegrity: number | null;
  defaultAvailability: number | null;
  protectionGoalClass: number | null;
  visibleInModules: string[];
  createdAt: string;
  updatedAt: string;
}

interface Classification {
  confidentialityLevel: string | null;
  integrityLevel: string | null;
  availabilityLevel: string | null;
  confidentialityReason: string | null;
  integrityReason: string | null;
  availabilityReason: string | null;
  overallProtection: string | null;
  reviewDate: string | null;
  classifiedAt: string | null;
  classifiedBy: string | null;
}

interface Vulnerability {
  id: string;
  title: string;
  cveReference: string | null;
  severity: string;
  status: string;
  description: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  entityTitle: string | null;
  userName: string | null;
  changes: Record<string, unknown>;
  createdAt: string;
}

// ── Page ─────────────────────────────────────────────────────────
export default function IsmsAssetDetailPage() {
  return (
    <ModuleGate moduleKey="isms">
      <AssetDetailInner />
    </ModuleGate>
  );
}

const TIER_KEYS = ["business_structure", "primary_asset", "supporting_asset"];

function AssetDetailInner() {
  const { formatDate, formatDateTime } = useDateFormat();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("assets");
  const tIsms = useTranslations("isms");

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [classification, setClassification] = useState<Classification | null>(
    null,
  );
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // ── Data Fetching ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [assetRes, classRes] = await Promise.all([
        fetch(`/api/v1/assets/${id}`),
        fetch(`/api/v1/isms/assets/${id}/classification`).catch(() => null),
      ]);

      if (assetRes.ok) {
        const json = await assetRes.json();
        setAsset(json.data ?? json);
      }

      if (classRes?.ok) {
        const json = await classRes.json();
        setClassification(json.data ?? json);
      }

      // Fetch vulnerabilities (may not exist)
      try {
        const vulnRes = await fetch(
          `/api/v1/isms/vulnerabilities?assetId=${id}`,
        );
        if (vulnRes.ok) {
          const json = await vulnRes.json();
          setVulnerabilities(Array.isArray(json) ? json : (json.data ?? []));
        }
      } catch {
        /* endpoint may not exist */
      }

      // Fetch audit log
      try {
        const auditRes = await fetch(
          `/api/v1/audit-log?entityType=asset&entityId=${id}&limit=20`,
        );
        if (auditRes.ok) {
          const json = await auditRes.json();
          setAuditLog(Array.isArray(json) ? json : (json.data ?? []));
        }
      } catch {
        /* endpoint may not exist */
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── Loading / Error ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <ShieldAlert size={32} className="mb-3 text-gray-400" />
        <p className="text-sm font-medium">{t("notFound")}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => router.push("/isms/assets")}
        >
          <ArrowLeft size={14} className="mr-1" /> {t("backToList")}
        </Button>
      </div>
    );
  }

  // [ARCTOS-FULL-2026-08-31 · OP-202, Welle 8b] Der Katalog fuehrt
  // `assets.tiers.*` seit jeher in BEIDEN Sprachen; daneben stand hier eine
  // deutsche Zweitfassung. Derselbe Befund wie in Welle 5a.
  const tierLabel = (tier: string) =>
    TIER_KEYS.includes(tier) ? t(`tiers.${tier}`) : tier;

  const tierColor: Record<string, string> = {
    business_structure: "bg-indigo-100 text-indigo-900 border-indigo-300",
    primary_asset: "bg-blue-100 text-blue-900 border-blue-300",
    supporting_asset: "bg-gray-100 text-gray-900 border-gray-300",
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/isms/assets")}
          className="mt-1 shrink-0"
        >
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {asset.name}
            </h1>
            <Badge
              variant="outline"
              className={`text-xs ${tierColor[asset.assetTier] ?? ""}`}
            >
              {tierLabel(asset.assetTier)}
            </Badge>
            {classification?.overallProtection && (
              <ProtectionLevelBadge
                level={
                  classification.overallProtection as
                    "normal" | "high" | "very_high" | null
                }
              />
            )}
          </div>
          {asset.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
              {asset.description}
            </p>
          )}
        </div>
        <Link href={`/isms/assets/${id}/classify`}>
          <Button variant="default" size="sm">
            <Pencil size={14} className="mr-1.5" />
            {t("detail.editClassification")}
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Server size={14} className="mr-1.5" />
            {t("detail.tabOverview")}
          </TabsTrigger>
          <TabsTrigger value="classification">
            <ShieldCheck size={14} className="mr-1.5" />
            {t("detail.tabClassification")}
          </TabsTrigger>
          <TabsTrigger value="vulnerabilities">
            <Bug size={14} className="mr-1.5" />
            {t("detail.tabVulnerabilities")}
          </TabsTrigger>
          <TabsTrigger value="incidents">
            <AlertTriangle size={14} className="mr-1.5" />
            {t("detail.tabIncidents")}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History size={14} className="mr-1.5" />
            {t("detail.tabHistory")}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Overview ──────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main info */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  {t("detail.assetInfo")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <dt className="text-gray-500 font-medium">{t("name")}</dt>
                    <dd className="text-gray-900 mt-0.5">{asset.name}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 font-medium">{t("tier")}</dt>
                    <dd className="mt-0.5">
                      <Badge
                        variant="outline"
                        className={`text-xs ${tierColor[asset.assetTier] ?? ""}`}
                      >
                        {tierLabel(asset.assetTier)}
                      </Badge>
                    </dd>
                  </div>
                  {asset.codeGroup && (
                    <div>
                      <dt className="text-gray-500 font-medium">
                        {t("codeGroup")}
                      </dt>
                      <dd className="text-gray-900 mt-0.5">
                        {asset.codeGroup}
                      </dd>
                    </div>
                  )}
                  {asset.description && (
                    <div className="sm:col-span-2">
                      <dt className="text-gray-500 font-medium">
                        {t("description")}
                      </dt>
                      <dd className="text-gray-900 mt-0.5 whitespace-pre-wrap">
                        {asset.description}
                      </dd>
                    </div>
                  )}
                  {asset.contactPerson && (
                    <div>
                      <dt className="text-gray-500 font-medium">
                        {t("contactPerson")}
                      </dt>
                      <dd className="text-gray-900 mt-0.5">
                        {asset.contactPerson}
                      </dd>
                    </div>
                  )}
                  {asset.dataProtectionResponsible && (
                    <div>
                      <dt className="text-gray-500 font-medium">
                        {t("dataProtectionResponsible")}
                      </dt>
                      <dd className="text-gray-900 mt-0.5">
                        {asset.dataProtectionResponsible}
                      </dd>
                    </div>
                  )}
                  {asset.dpoEmail && (
                    <div>
                      <dt className="text-gray-500 font-medium">
                        {t("dpoEmail")}
                      </dt>
                      <dd className="text-gray-900 mt-0.5">{asset.dpoEmail}</dd>
                    </div>
                  )}
                  {asset.visibleInModules?.length > 0 && (
                    <div className="sm:col-span-2">
                      <dt className="text-gray-500 font-medium">
                        {t("detail.visibleInModules")}
                      </dt>
                      <dd className="mt-1 flex gap-1.5 flex-wrap">
                        {asset.visibleInModules.map((m) => (
                          <Badge
                            key={m}
                            variant="outline"
                            className="text-[10px]"
                          >
                            {m}
                          </Badge>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Metadata sidebar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("detail.metadata")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <Calendar size={14} className="shrink-0" />
                  <span>
                    {t("detail.createdAt", {
                      date: formatDate(asset.createdAt),
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock size={14} className="shrink-0" />
                  <span>
                    {t("detail.updatedAt", {
                      date: formatDate(asset.updatedAt),
                    })}
                  </span>
                </div>
                {asset.latestAuditDate && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <FileText size={14} className="shrink-0" />
                    <span>
                      {t("detail.latestAudit", {
                        date: formatDate(asset.latestAuditDate),
                      })}
                    </span>
                  </div>
                )}
                {asset.latestAuditResult && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <ShieldCheck size={14} className="shrink-0" />
                    <span>
                      {t("detail.latestAuditResult", {
                        result: asset.latestAuditResult,
                      })}
                    </span>
                  </div>
                )}

                {/* CIA Defaults */}
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    {t("ciaDefaults")}
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { label: "C", value: asset.defaultConfidentiality },
                      { label: "I", value: asset.defaultIntegrity },
                      { label: "A", value: asset.defaultAvailability },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="flex items-center justify-between"
                      >
                        <span className="text-gray-600">{label}</span>
                        <span className="font-medium text-gray-900">
                          {value ?? "–"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab: Classification ────────────────────────────── */}
        <TabsContent value="classification" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                {t("detail.protectionNeeds")}
              </CardTitle>
              <Link href={`/isms/assets/${id}/classify`}>
                <Button variant="outline" size="sm">
                  <Pencil size={14} className="mr-1.5" />
                  {t("detail.edit")}
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {classification?.classifiedAt ? (
                <div className="space-y-6">
                  {/* Overall protection */}
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
                    <Shield size={24} className="text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        {t("detail.overallProtection")}
                      </p>
                      <div className="mt-1">
                        <ProtectionLevelBadge
                          level={
                            classification.overallProtection as
                              "normal" | "high" | "very_high" | null
                          }
                        />
                      </div>
                    </div>
                    <div className="ml-auto text-xs text-gray-400">
                      {t("detail.classifiedAt", {
                        date: formatDate(classification.classifiedAt),
                      })}
                    </div>
                  </div>

                  {/* C / I / A details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      {
                        key: "confidentiality",
                        label: tIsms("confidentiality"),
                        level: classification.confidentialityLevel,
                        reason: classification.confidentialityReason,
                      },
                      {
                        key: "integrity",
                        label: tIsms("integrity"),
                        level: classification.integrityLevel,
                        reason: classification.integrityReason,
                      },
                      {
                        key: "availability",
                        label: tIsms("availability"),
                        level: classification.availabilityLevel,
                        reason: classification.availabilityReason,
                      },
                    ].map(({ key, label, level, reason }) => (
                      <div
                        key={key}
                        className="rounded-lg border border-gray-200 p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-gray-700">
                            {label}
                          </p>
                          <ProtectionLevelBadge
                            level={
                              level as "normal" | "high" | "very_high" | null
                            }
                          />
                        </div>
                        {reason ? (
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {reason}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 italic">
                            {t("detail.noReason")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Review date */}
                  {classification.reviewDate && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar size={14} />
                      <span>
                        {t("detail.nextReview", {
                          date: formatDate(classification.reviewDate),
                        })}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
                  <Shield size={28} className="text-gray-400 mb-3" />
                  <p className="text-sm text-gray-500">
                    {t("detail.notClassified")}
                  </p>
                  <Link href={`/isms/assets/${id}/classify`} className="mt-3">
                    <Button size="sm">{t("detail.classifyNow")}</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Vulnerabilities ───────────────────────────── */}
        <TabsContent value="vulnerabilities" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("detail.vulnerabilities")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vulnerabilities.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
                  <Bug size={28} className="text-gray-400 mb-3" />
                  <p className="text-sm text-gray-500">
                    {t("detail.noVulnerabilities")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {vulnerabilities.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-3 rounded-md border border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <Bug size={16} className="text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {v.title}
                        </p>
                        {v.cveReference && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {v.cveReference}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          v.severity === "critical"
                            ? "bg-red-100 text-red-900 border-red-300"
                            : v.severity === "high"
                              ? "bg-orange-100 text-orange-900 border-orange-300"
                              : v.severity === "medium"
                                ? "bg-yellow-100 text-yellow-900 border-yellow-300"
                                : "bg-gray-100 text-gray-900 border-gray-300"
                        }
                      >
                        {tIsms(`incidentSeverity.${v.severity}`)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {tIsms(`vulnerabilityStatus.${v.status}`)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Incidents ─────────────────────────────────── */}
        <TabsContent value="incidents" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("detail.incidents")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
                <AlertTriangle size={28} className="text-gray-400 mb-3" />
                <p className="text-sm text-gray-500">
                  {t("detail.noIncidents")}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: History ───────────────────────────────────── */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("detail.changeHistory")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
                  <Activity size={28} className="text-gray-400 mb-3" />
                  <p className="text-sm text-gray-500">
                    {t("detail.noHistory")}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 text-sm"
                    >
                      <div
                        className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                          entry.action === "create"
                            ? "bg-green-500"
                            : entry.action === "update"
                              ? "bg-blue-500"
                              : entry.action === "delete"
                                ? "bg-red-500"
                                : "bg-gray-400"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900">
                          <span className="font-medium">
                            {entry.userName ?? t("detail.systemUser")}
                          </span>{" "}
                          <Badge variant="outline" className="text-[10px] mx-1">
                            {entry.action}
                          </Badge>{" "}
                          {entry.entityTitle ?? t("detail.entityFallback")}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDateTime(entry.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
