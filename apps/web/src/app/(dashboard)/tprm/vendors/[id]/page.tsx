"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Building2,
  ClipboardCheck,
  Shield,
  FileText,
  Send,
  RefreshCcw,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TIER_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  important: "bg-yellow-100 text-yellow-800 border-yellow-200",
  standard: "bg-gray-100 text-gray-800 border-gray-200",
  low_risk: "bg-green-100 text-green-800 border-green-200",
};

const STATUS_COLORS: Record<string, string> = {
  prospect: "bg-gray-100 text-gray-700",
  onboarding: "bg-blue-100 text-blue-900",
  active: "bg-green-100 text-green-900",
  under_review: "bg-yellow-100 text-yellow-900",
  suspended: "bg-red-100 text-red-900",
  terminated: "bg-gray-200 text-gray-500",
};

export default function VendorDetailPage() {
  return (
    <ModuleGate moduleKey="tprm">
      <VendorDetailInner />
    </ModuleGate>
  );
}

function VendorDetailInner() {
  const t = useTranslations("tprm");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [vendor, setVendor] = useState<Record<string, unknown> | null>(null);
  const [contacts, setContacts] = useState<Array<Record<string, unknown>>>([]);
  const [ddRecords, setDdRecords] = useState<Array<Record<string, unknown>>>([]);
  const [assessments, setAssessments] = useState<Array<Record<string, unknown>>>([]);
  const [lksgRecords, setLksgRecords] = useState<Array<Record<string, unknown>>>([]);
  const [contracts, setContracts] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [vendorRes, contactRes, ddRes, assessRes, contractRes] = await Promise.all([
        fetch(`/api/v1/vendors/${id}`),
        fetch(`/api/v1/vendors/${id}/contacts`),
        fetch(`/api/v1/vendors/${id}/due-diligence`),
        fetch(`/api/v1/vendors/${id}/risk-assessments`),
        fetch(`/api/v1/contracts?vendorId=${id}&limit=50`),
      ]);

      if (vendorRes.ok) {
        const json = await vendorRes.json();
        setVendor(json.data);

        // Fetch LkSG if relevant
        if (json.data?.isLksgRelevant) {
          const lksgRes = await fetch(`/api/v1/lksg/${id}/assessment`);
          if (lksgRes.ok) {
            const lksgJson = await lksgRes.json();
            setLksgRecords(lksgJson.data ?? []);
          }
        }
      }
      if (contactRes.ok) setContacts((await contactRes.json()).data ?? []);
      if (ddRes.ok) setDdRecords((await ddRes.json()).data ?? []);
      if (assessRes.ok) setAssessments((await assessRes.json()).data ?? []);
      if (contractRes.ok) setContracts((await contractRes.json()).data ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const handleSendDD = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/vendors/${id}/due-diligence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        toast.success(t("dd.sent"));
        void fetchAll();
      } else {
        toast.error(t("dd.sendError"));
      }
    } catch {
      toast.error(t("dd.sendError"));
    }
  }, [id, t, fetchAll]);

  if (loading && !vendor) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t("vendor.notFound")}</p>
      </div>
    );
  }

  const v = vendor as Record<string, string | number | boolean | null>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/tprm/vendors")}>
          <ArrowLeft size={16} />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{String(v.name)}</h1>
          {v.legalName && (
            <p className="text-sm text-gray-500">{String(v.legalName)}</p>
          )}
        </div>
        <Badge variant="outline" className={TIER_COLORS[String(v.tier)] ?? ""}>
          {t(`tier.${String(v.tier)}`)}
        </Badge>
        <Badge variant="outline" className={STATUS_COLORS[String(v.status)] ?? ""}>
          {t(`status.${String(v.status)}`)}
        </Badge>
        <Button variant="outline" size="sm" onClick={fetchAll}>
          <RefreshCcw size={14} />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <Building2 size={14} /> {t("tab.overview")}
          </TabsTrigger>
          <TabsTrigger value="dd" className="gap-1.5">
            <ClipboardCheck size={14} /> {t("tab.dueDiligence")}
          </TabsTrigger>
          <TabsTrigger value="risk" className="gap-1.5">
            <Shield size={14} /> {t("tab.riskAssessment")}
          </TabsTrigger>
          <TabsTrigger value="contracts" className="gap-1.5">
            <FileText size={14} /> {t("tab.contracts")} ({contracts.length})
          </TabsTrigger>
          {v.isLksgRelevant && (
            <TabsTrigger value="lksg" className="gap-1.5">
              <Shield size={14} /> LkSG
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">{t("vendor.details")}</h3>
              <dl className="space-y-3">
                <DetailRow label={t("vendor.category")} value={t(`category.${String(v.category)}`)} />
                <DetailRow label={t("vendor.country")} value={String(v.country ?? "\u2014")} />
                <DetailRow label={t("vendor.website")} value={String(v.website ?? "\u2014")} />
                <DetailRow label={t("vendor.taxId")} value={String(v.taxId ?? "\u2014")} />
                <DetailRow label={t("vendor.owner")} value={String(v.ownerName ?? "\u2014")} />
              </dl>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">{t("vendor.riskInfo")}</h3>
              <dl className="space-y-3">
                <DetailRow label={t("vendor.inherentScore")} value={v.inherentRiskScore != null ? `${v.inherentRiskScore}/25` : "\u2014"} />
                <DetailRow label={t("vendor.residualScore")} value={v.residualRiskScore != null ? `${v.residualRiskScore}/25` : "\u2014"} />
                <DetailRow label={t("vendor.lastAssessment")} value={String(v.lastAssessmentDate ?? "\u2014")} />
                <DetailRow label={t("vendor.nextAssessment")} value={String(v.nextAssessmentDate ?? "\u2014")} />
              </dl>
            </div>
          </div>

          {/* Contacts */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              {t("vendor.contacts")} ({contacts.length})
            </h3>
            {contacts.length === 0 ? (
              <p className="text-sm text-gray-400">{t("vendor.noContacts")}</p>
            ) : (
              <div className="space-y-2">
                {contacts.map((c: Record<string, unknown>) => (
                  <div key={String(c.id)} className="flex items-center justify-between rounded border border-gray-100 px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{String(c.name)}</span>
                      {Boolean(c.role) && <span className="ml-2 text-xs text-gray-500">({String(c.role)})</span>}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      {Boolean(c.email) && <span>{String(c.email)}</span>}
                      {Boolean(c.isPrimary) && <Badge variant="outline" className="text-xs">Primary</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Due Diligence */}
        <TabsContent value="dd" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{t("dd.history")}</h3>
            <Button size="sm" onClick={handleSendDD}>
              <Send size={14} /> {t("dd.send")}
            </Button>
          </div>
          {ddRecords.length === 0 ? (
            <p className="text-sm text-gray-400">{t("dd.noRecords")}</p>
          ) : (
            <div className="space-y-2">
              {ddRecords.map((dd: Record<string, unknown>) => (
                <div key={String(dd.id)} className="rounded border border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {t("dd.questionnaire")} {String(dd.questionnaireVersion ?? "v1")}
                    </span>
                    <Badge variant="outline">{String(dd.status)}</Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <span>{t("dd.sentAt")}: {dd.sentAt ? new Date(String(dd.sentAt)).toLocaleDateString() : "\u2014"}</span>
                    {Boolean(dd.completedAt) && <span>{t("dd.completedAt")}: {new Date(String(dd.completedAt)).toLocaleDateString()}</span>}
                    {dd.riskScore != null && dd.riskScore !== undefined && <span>{t("dd.riskScore")}: {String(dd.riskScore)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Risk Assessment */}
        <TabsContent value="risk" className="mt-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">{t("risk.history")}</h3>
          {assessments.length === 0 ? (
            <p className="text-sm text-gray-400">{t("risk.noAssessments")}</p>
          ) : (
            <div className="space-y-2">
              {assessments.map((a: Record<string, unknown>) => (
                <div key={String(a.id)} className="rounded border border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{String(a.assessmentDate)}</span>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">{t("risk.inherent")}: {String(a.inherentRiskScore)}/25</span>
                      <span className="text-gray-500">{t("risk.residual")}: {String(a.residualRiskScore)}/25</span>
                      {Boolean(a.riskTrend) && (
                        <Badge variant="outline" className="text-xs">{String(a.riskTrend)}</Badge>
                      )}
                    </div>
                  </div>
                  {Boolean(a.notes) && <p className="text-xs text-gray-500 mt-1">{String(a.notes)}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Contracts */}
        <TabsContent value="contracts" className="mt-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">{t("tab.contracts")}</h3>
          {contracts.length === 0 ? (
            <p className="text-sm text-gray-400">{t("vendor.noContracts")}</p>
          ) : (
            <div className="space-y-2">
              {contracts.map((c: Record<string, unknown>) => (
                <Link
                  key={String(c.id)}
                  href={`/contracts/${String(c.id)}`}
                  className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3 hover:border-blue-300 transition-colors"
                >
                  <span className="text-sm font-medium text-blue-600">{String(c.title)}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{String(c.contractType)}</Badge>
                    <Badge variant="outline" className="text-xs">{String(c.status)}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* LkSG */}
        {v.isLksgRelevant && (
          <TabsContent value="lksg" className="mt-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">{t("lksg.assessments")}</h3>
            {lksgRecords.length === 0 ? (
              <p className="text-sm text-gray-400">{t("lksg.noAssessments")}</p>
            ) : (
              <div className="space-y-2">
                {lksgRecords.map((a: Record<string, unknown>) => (
                  <div key={String(a.id)} className="rounded border border-gray-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{String(a.assessmentDate)}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{String(a.lksgTier)}</Badge>
                        <Badge variant="outline" className="text-xs">{String(a.status)}</Badge>
                        {Boolean(a.overallRiskLevel) && (
                          <Badge variant="outline" className="text-xs">{String(a.overallRiskLevel)}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}
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
