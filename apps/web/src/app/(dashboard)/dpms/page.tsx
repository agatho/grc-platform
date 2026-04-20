"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  FileText,
  Shield,
  AlertTriangle,
  Clock,
  Globe,
  UserCheck,
  Link2,
  ShieldAlert,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DpmsDashboard, DataBreach, Dsr } from "@grc/shared";

export default function DpmsPage() {
  return (
    <ModuleGate moduleKey="dpms">
      <ModuleTabNav />
      <DpmsDashboardInner />
    </ModuleGate>
  );
}

function DpmsDashboardInner() {
  const t = useTranslations("dpms");
  const router = useRouter();
  const [data, setData] = useState<DpmsDashboard | null>(null);
  const [activeBreaches, setActiveBreaches] = useState<DataBreach[]>([]);
  const [urgentDsrs, setUrgentDsrs] = useState<Dsr[]>([]);
  const [loading, setLoading] = useState(true);
  const [privacyRisks, setPrivacyRisks] = useState<{
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    syncedToErm: number;
  } | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, breachRes, dsrRes, riskRes] = await Promise.all([
        fetch("/api/v1/dpms/dashboard"),
        fetch(
          "/api/v1/dpms/breaches?status=detected,assessing,notifying_dpa&limit=5",
        ),
        fetch("/api/v1/dpms/dsr?sla=at_risk&limit=5"),
        fetch("/api/v1/dpms/erm-sync?check=true"),
      ]);

      if (dashRes.ok) {
        const json = await dashRes.json();
        setData(json.data);
      }
      if (breachRes.ok) {
        const json = await breachRes.json();
        setActiveBreaches(json.data ?? []);
      }
      if (dsrRes.ok) {
        const json = await dsrRes.json();
        setUrgentDsrs(json.data ?? []);
      }
      if (riskRes.ok) {
        const json = await riskRes.json();
        setPrivacyRisks(json.data ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const d = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("dashboard")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchDashboard}
          disabled={loading}
        >
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Active Breach Banner */}
      {activeBreaches.length > 0 && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="font-semibold text-red-800">
              {t("breaches.activeBanner")}
            </span>
          </div>
          {activeBreaches.map((breach) => {
            const detectedAt = new Date(breach.detectedAt);
            const deadline72h = new Date(
              detectedAt.getTime() + 72 * 60 * 60 * 1000,
            );
            const now = new Date();
            const hoursRemaining = Math.max(
              0,
              Math.floor(
                (deadline72h.getTime() - now.getTime()) / (1000 * 60 * 60),
              ),
            );
            const minutesRemaining = Math.max(
              0,
              Math.floor(
                ((deadline72h.getTime() - now.getTime()) % (1000 * 60 * 60)) /
                  (1000 * 60),
              ),
            );

            return (
              <Link
                key={breach.id}
                href={`/dpms/breaches/${breach.id}`}
                className="block rounded-md bg-red-100 p-3 mb-2 last:mb-0 hover:bg-red-200 transition-colors"
              >
                <p className="font-medium text-red-900">{breach.title}</p>
                <p className="text-xs text-red-700 mt-1">
                  {t("breaches.countdown")}: {hoursRemaining}h{" "}
                  {minutesRemaining}m | {t("breaches.severity")}:{" "}
                  {breach.severity}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          label={t("ropa.title")}
          value={String(d?.ropaEntryCount ?? 0)}
          onClick={() => router.push("/dpms/ropa")}
        />
        <KpiCard
          icon={<UserCheck className="h-5 w-5 text-green-600" />}
          label={t("dsr.title")}
          value={String(d?.openDsrCount ?? 0)}
          subtitle={
            d?.dsrOverdueCount
              ? `${d.dsrOverdueCount} ${t("dsr.overdue")}`
              : undefined
          }
          highlight={d?.dsrOverdueCount ? d.dsrOverdueCount > 0 : false}
          onClick={() => router.push("/dpms/dsr")}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label={t("breaches.title")}
          value={String(d?.activeBreachCount ?? 0)}
          subtitle={
            d?.breachesRequiringNotification
              ? `${d.breachesRequiringNotification} ${t("breaches.needNotification")}`
              : undefined
          }
          highlight={d?.activeBreachCount ? d.activeBreachCount > 0 : false}
          onClick={() => router.push("/dpms/breaches")}
        />
        <KpiCard
          icon={<Shield className="h-5 w-5 text-purple-600" />}
          label={t("dpia.title")}
          value={String(d?.activeDpiaCount ?? 0)}
          onClick={() => router.push("/dpms/dpia")}
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Globe className="h-5 w-5 text-orange-600" />}
          label={t("tia.title")}
          value={String(d?.tiaCount ?? 0)}
          subtitle={
            d?.tiaHighRiskCount
              ? `${d.tiaHighRiskCount} ${t("tia.highRisk")}`
              : undefined
          }
          onClick={() => router.push("/dpms/tia")}
        />
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-teal-600" />
            <span className="text-xs font-medium text-gray-600">
              {t("ropa.byStatus")}
            </span>
          </div>
          <div className="space-y-1">
            <StatusRow
              label={t("ropa.status.active")}
              count={d?.ropaByStatus?.active ?? 0}
              color="bg-green-500"
            />
            <StatusRow
              label={t("ropa.status.under_review")}
              count={d?.ropaByStatus?.under_review ?? 0}
              color="bg-yellow-500"
            />
            <StatusRow
              label={t("ropa.status.draft")}
              count={d?.ropaByStatus?.draft ?? 0}
              color="bg-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Datenschutz-Risiken (Privacy Risk Aggregation) */}
      {privacyRisks && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-purple-600" />
              <h2 className="text-base font-semibold text-gray-900">
                Datenschutz-Risiken
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs bg-green-50 text-green-700 border-green-200"
              >
                <Link2 size={10} className="mr-1" />
                {privacyRisks.syncedToErm} im ERM
              </Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-lg font-bold text-gray-900">
                {privacyRisks.total}
              </p>
              <p className="text-xs text-gray-500">Gesamt</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-center">
              <p className="text-lg font-bold text-red-700">
                {privacyRisks.critical}
              </p>
              <p className="text-xs text-red-600">Kritisch (20-25)</p>
            </div>
            <div className="rounded-lg bg-orange-50 border border-orange-100 p-3 text-center">
              <p className="text-lg font-bold text-orange-700">
                {privacyRisks.high}
              </p>
              <p className="text-xs text-orange-600">Hoch (12-19)</p>
            </div>
            <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-3 text-center">
              <p className="text-lg font-bold text-yellow-700">
                {privacyRisks.medium}
              </p>
              <p className="text-xs text-yellow-600">Mittel (6-11)</p>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-center">
              <p className="text-lg font-bold text-green-700">
                {privacyRisks.low}
              </p>
              <p className="text-xs text-green-600">Gering (1-5)</p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Row: Urgent DSRs + Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent DSRs */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              {t("dsr.urgentTitle")}
            </h2>
            <Link
              href="/dpms/dsr"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {t("dsr.viewAll")}
            </Link>
          </div>
          {urgentDsrs.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              {t("dsr.noUrgent")}
            </p>
          ) : (
            <div className="space-y-2">
              {urgentDsrs.map((dsrItem) => {
                const deadline = new Date(dsrItem.deadline);
                const now = new Date();
                const daysRemaining = Math.max(
                  0,
                  Math.ceil(
                    (deadline.getTime() - now.getTime()) /
                      (1000 * 60 * 60 * 24),
                  ),
                );

                return (
                  <Link
                    key={dsrItem.id}
                    href={`/dpms/dsr/${dsrItem.id}`}
                    className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <DsrSlaIndicator daysRemaining={daysRemaining} />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-900 truncate block">
                          {dsrItem.subjectName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {dsrItem.requestType}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0 ml-2">
                      {daysRemaining}d
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Navigation */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {t("quickNav")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <NavCard
              href="/dpms/ropa"
              label={t("ropa.title")}
              count={d?.ropaEntryCount ?? 0}
            />
            <NavCard
              href="/dpms/dpia"
              label={t("dpia.title")}
              count={d?.activeDpiaCount ?? 0}
            />
            <NavCard
              href="/dpms/dsr"
              label={t("dsr.title")}
              count={d?.openDsrCount ?? 0}
            />
            <NavCard
              href="/dpms/breaches"
              label={t("breaches.title")}
              count={d?.activeBreachCount ?? 0}
            />
            <NavCard
              href="/dpms/tia"
              label={t("tia.title")}
              count={d?.tiaCount ?? 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  subtitle,
  highlight,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border bg-white p-4 text-left hover:shadow-sm transition-shadow w-full ${
        highlight ? "border-red-300 bg-red-50" : "border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-gray-600">{label}</span>
      </div>
      <p
        className={`text-2xl font-bold ${highlight ? "text-red-700" : "text-gray-900"}`}
      >
        {value}
      </p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </button>
  );
}

function NavCard({
  href,
  label,
  count,
}: {
  href: string;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
    >
      <p className="text-sm font-medium text-gray-900">{label}</p>
      {count !== undefined && (
        <p className="text-lg font-bold text-gray-700 mt-1">{count}</p>
      )}
    </Link>
  );
}

function StatusRow({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-gray-600">{label}</span>
      </div>
      <span className="font-medium text-gray-900">{count}</span>
    </div>
  );
}

function DsrSlaIndicator({ daysRemaining }: { daysRemaining: number }) {
  let color = "bg-green-500";
  if (daysRemaining <= 5) color = "bg-red-500";
  else if (daysRemaining <= 15) color = "bg-yellow-500";
  return <span className={`h-3 w-3 rounded-full shrink-0 ${color}`} />;
}
