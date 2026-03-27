"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  FileText,
  ClipboardCheck,
  BarChart3,
  FilePlus,
  FolderOpen,
  RefreshCcw,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  negotiation: "bg-blue-100 text-blue-700",
  pending_approval: "bg-yellow-100 text-yellow-700",
  active: "bg-green-100 text-green-700",
  renewal: "bg-orange-100 text-orange-700",
  expired: "bg-red-100 text-red-700",
  terminated: "bg-red-200 text-red-800",
  archived: "bg-gray-200 text-gray-500",
};

const OBL_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};

export default function ContractDetailPage() {
  return (
    <ModuleGate moduleKey="contract">
      <ContractDetailInner />
    </ModuleGate>
  );
}

function ContractDetailInner() {
  const t = useTranslations("contracts");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [contract, setContract] = useState<Record<string, unknown> | null>(null);
  const [obligations, setObligations] = useState<Array<Record<string, unknown>>>([]);
  const [slas, setSlas] = useState<Array<Record<string, unknown>>>([]);
  const [amendments, setAmendments] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, oblRes, slaRes, amRes] = await Promise.all([
        fetch(`/api/v1/contracts/${id}`),
        fetch(`/api/v1/contracts/${id}/obligations`),
        fetch(`/api/v1/contracts/${id}/sla`),
        fetch(`/api/v1/contracts/${id}/amendments`),
      ]);

      if (cRes.ok) setContract((await cRes.json()).data);
      if (oblRes.ok) setObligations((await oblRes.json()).data ?? []);
      if (slaRes.ok) setSlas((await slaRes.json()).data ?? []);
      if (amRes.ok) setAmendments((await amRes.json()).data ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Fetch measurements for all SLAs
  const [slaMeasurements, setSlaMeasurements] = useState<Record<string, Array<Record<string, unknown>>>>({});

  useEffect(() => {
    if (slas.length === 0) return;
    const fetchMeasurements = async () => {
      const results: Record<string, Array<Record<string, unknown>>> = {};
      for (const sla of slas) {
        try {
          const res = await fetch(`/api/v1/contracts/${id}/sla/${String(sla.id)}/measurements`);
          if (res.ok) {
            const json = await res.json();
            results[String(sla.id)] = json.data ?? [];
          }
        } catch {
          /* ignore */
        }
      }
      setSlaMeasurements(results);
    };
    void fetchMeasurements();
  }, [slas, id]);

  if (loading && !contract) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!contract) {
    return <p className="text-center py-12 text-gray-500">{t("contract.notFound")}</p>;
  }

  const c = contract as Record<string, string | number | boolean | null>;

  const formatValue = (val?: string | null) => {
    if (!val) return "\u2014";
    const num = parseFloat(val);
    if (isNaN(num)) return "\u2014";
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: String(c.currency || "EUR") }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/contracts/list")}>
          <ArrowLeft size={16} />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{String(c.title)}</h1>
          {c.vendorName && (
            <p className="text-sm text-gray-500">{String(c.vendorName)}</p>
          )}
        </div>
        <Badge variant="outline" className={STATUS_COLORS[String(c.status)] ?? ""}>
          {t(`status.${String(c.status)}`)}
        </Badge>
        <Button variant="outline" size="sm" onClick={fetchAll}>
          <RefreshCcw size={14} />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <FileText size={14} /> {t("tab.overview")}
          </TabsTrigger>
          <TabsTrigger value="obligations" className="gap-1.5">
            <ClipboardCheck size={14} /> {t("tab.obligations")} ({obligations.length})
          </TabsTrigger>
          <TabsTrigger value="sla" className="gap-1.5">
            <BarChart3 size={14} /> {t("tab.sla")} ({slas.length})
          </TabsTrigger>
          <TabsTrigger value="amendments" className="gap-1.5">
            <FilePlus size={14} /> {t("tab.amendments")} ({amendments.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FolderOpen size={14} /> {t("tab.documents")}
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">{t("contract.details")}</h3>
              <dl className="space-y-3">
                <DetailRow label={t("contract.type")} value={t(`type.${String(c.contractType)}`)} />
                <DetailRow label={t("contract.number")} value={String(c.contractNumber ?? "\u2014")} />
                <DetailRow label={t("contract.effective")} value={String(c.effectiveDate ?? "\u2014")} />
                <DetailRow label={t("contract.expiration")} value={String(c.expirationDate ?? "\u2014")} />
                <DetailRow label={t("contract.noticePeriod")} value={c.noticePeriodDays ? `${c.noticePeriodDays} ${t("days")}` : "\u2014"} />
                <DetailRow label={t("contract.autoRenewal")} value={c.autoRenewal ? t("yes") : t("no")} />
                <DetailRow label={t("contract.owner")} value={String(c.ownerName ?? "\u2014")} />
              </dl>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">{t("contract.financial")}</h3>
              <dl className="space-y-3">
                <DetailRow label={t("contract.totalValue")} value={formatValue(c.totalValue as string)} />
                <DetailRow label={t("contract.annualValue")} value={formatValue(c.annualValue as string)} />
                <DetailRow label={t("contract.currency")} value={String(c.currency ?? "EUR")} />
                <DetailRow label={t("contract.paymentTerms")} value={String(c.paymentTerms ?? "\u2014")} />
                <DetailRow label={t("contract.signed")} value={String(c.signedDate ?? "\u2014")} />
              </dl>
            </div>
          </div>
          {c.description && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">{t("contract.description")}</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{String(c.description)}</p>
            </div>
          )}
        </TabsContent>

        {/* Obligations */}
        <TabsContent value="obligations" className="mt-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">{t("tab.obligations")}</h3>
          {obligations.length === 0 ? (
            <p className="text-sm text-gray-400">{t("obligation.none")}</p>
          ) : (
            <div className="space-y-2">
              {obligations.map((o: Record<string, unknown>) => (
                <div key={String(o.id)} className="rounded border border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{String(o.title)}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{String(o.obligationType)}</Badge>
                      <Badge variant="outline" className={`text-xs ${OBL_STATUS_COLORS[String(o.status)] ?? ""}`}>
                        {t(`oblStatus.${String(o.status)}`)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <span>{t("obligation.due")}: {String(o.dueDate ?? "\u2014")}</span>
                    {Boolean(o.responsibleName) && <span>{t("obligation.responsible")}: {String(o.responsibleName)}</span>}
                    {Boolean(o.recurring) && <Badge variant="outline" className="text-xs">{t("obligation.recurring")}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* SLA */}
        <TabsContent value="sla" className="mt-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">{t("tab.sla")}</h3>
          {slas.length === 0 ? (
            <p className="text-sm text-gray-400">{t("sla.none")}</p>
          ) : (
            <div className="space-y-4">
              {slas.map((sla: Record<string, unknown>) => {
                const measurements = slaMeasurements[String(sla.id)] ?? [];
                const latest = measurements[0];
                return (
                  <div key={String(sla.id)} className="rounded border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{String(sla.metricName)}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">{t("sla.target")}: {String(sla.targetValue)}{String(sla.unit)}</span>
                        <Badge variant="outline">{String(sla.measurementFrequency)}</Badge>
                      </div>
                    </div>
                    {latest && (
                      <div className={`flex items-center justify-between rounded px-3 py-1.5 text-xs ${latest.isBreach ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                        <span>{t("sla.latest")}: {String(latest.actualValue)}{String(sla.unit)}</span>
                        <span>{latest.isBreach ? t("sla.breach") : t("sla.ok")}</span>
                        <span>{String(latest.periodEnd)}</span>
                      </div>
                    )}
                    {measurements.length > 1 && (
                      <p className="text-xs text-gray-400 mt-1">+{measurements.length - 1} {t("sla.moreMeasurements")}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Amendments */}
        <TabsContent value="amendments" className="mt-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">{t("tab.amendments")}</h3>
          {amendments.length === 0 ? (
            <p className="text-sm text-gray-400">{t("amendment.none")}</p>
          ) : (
            <div className="space-y-2">
              {amendments.map((a: Record<string, unknown>) => (
                <div key={String(a.id)} className="rounded border border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{String(a.title)}</span>
                    <span className="text-xs text-gray-500">{String(a.effectiveDate ?? "\u2014")}</span>
                  </div>
                  {Boolean(a.description) && <p className="text-xs text-gray-500 mt-1">{String(a.description)}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="mt-4">
          <p className="text-sm text-gray-400">{t("documents.placeholder")}</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}
