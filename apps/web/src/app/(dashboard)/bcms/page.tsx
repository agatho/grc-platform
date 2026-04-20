"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  AlertTriangle,
  Shield,
  Activity,
  ClipboardCheck,
  Clock,
  FileWarning,
  ArrowRight,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BcmsDashboard, CrisisScenario, BcExercise } from "@grc/shared";

export default function BcmsPage() {
  return (
    <ModuleGate moduleKey="bcms">
      <ModuleTabNav />
      <BcmsDashboardInner />
    </ModuleGate>
  );
}

function BcmsDashboardInner() {
  const t = useTranslations("bcms");
  const router = useRouter();
  const [data, setData] = useState<BcmsDashboard | null>(null);
  const [activeCrises, setActiveCrises] = useState<CrisisScenario[]>([]);
  const [upcomingExercises, setUpcomingExercises] = useState<BcExercise[]>([]);
  const [bcRiskStats, setBcRiskStats] = useState<{
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
    syncedToErm: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, crisisRes, exRes] = await Promise.all([
        fetch("/api/v1/bcms/dashboard"),
        fetch("/api/v1/bcms/crisis?status=activated&limit=5"),
        fetch("/api/v1/bcms/exercises?status=planned&limit=5"),
      ]);

      if (dashRes.ok) {
        const json = await dashRes.json();
        setData(json.data);
      }
      if (crisisRes.ok) {
        const json = await crisisRes.json();
        setActiveCrises(json.data ?? []);
      }
      if (exRes.ok) {
        const json = await exRes.json();
        setUpcomingExercises(json.data ?? []);
      }

      // Fetch BC risk stats
      try {
        const riskRes = await fetch("/api/v1/bcms/crisis?limit=200");
        if (riskRes.ok) {
          const riskJson = await riskRes.json();
          const scenarios = (riskJson.data ?? []) as Array<{
            riskScore?: number | null;
            ermRiskId?: string | null;
          }>;
          let critical = 0,
            high = 0,
            medium = 0,
            low = 0,
            syncedToErm = 0;
          for (const s of scenarios) {
            const score = s.riskScore ?? 0;
            if (score >= 20) critical++;
            else if (score >= 15) high++;
            else if (score >= 9) medium++;
            else if (score > 0) low++;
            if (s.ermRiskId) syncedToErm++;
          }
          setBcRiskStats({
            critical,
            high,
            medium,
            low,
            total: critical + high + medium + low,
            syncedToErm,
          });
        }
      } catch {
        // non-critical
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
          <p className="text-sm text-gray-500 mt-1">{t("overview")}</p>
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

      {/* Active Crisis Banner */}
      {activeCrises.length > 0 && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="font-semibold text-red-800">
              {t("activeCrisis")}
            </span>
          </div>
          {activeCrises.map((crisis) => (
            <Link
              key={crisis.id}
              href={`/bcms/crisis/${crisis.id}`}
              className="block rounded-md bg-red-100 p-3 mb-2 last:mb-0 hover:bg-red-200 transition-colors"
            >
              <p className="font-medium text-red-900">{crisis.name}</p>
              <p className="text-xs text-red-700 mt-1">
                {t("crisis.activatedAt")}:{" "}
                {crisis.activatedAt
                  ? new Date(crisis.activatedAt).toLocaleString()
                  : "-"}
                {" | "}
                {t("crisis.severity")}: {crisis.severity.replace(/_/g, " ")}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Shield className="h-5 w-5 text-blue-600" />}
          label={t("essentialProcesses")}
          value={String(d?.essentialProcessCount ?? 0)}
          onClick={() => router.push("/bcms/bia")}
        />
        <KpiCard
          icon={<ClipboardCheck className="h-5 w-5 text-green-600" />}
          label={t("biaCompletion")}
          value={`${d?.biaCompletionPct ?? 0}%`}
          onClick={() => router.push("/bcms/bia")}
        />
        <KpiCard
          icon={<Activity className="h-5 w-5 text-purple-600" />}
          label={t("bcpCoverage")}
          value={`${d?.activeBcpCount ?? 0}`}
          subtitle={`${d?.bcpCoveragePct ?? 0}%`}
          onClick={() => router.push("/bcms/plans")}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label={t("activeCrisisCount")}
          value={String(d?.activeCrisisCount ?? 0)}
          highlight={d?.activeCrisisCount ? d.activeCrisisCount > 0 : false}
          onClick={() => router.push("/bcms/crisis")}
        />
      </div>

      {/* KPI Cards Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Clock className="h-5 w-5 text-orange-600" />}
          label={t("avgRto")}
          value={d?.avgRtoHours != null ? `${d.avgRtoHours}h` : "-"}
          onClick={() => router.push("/bcms/bia")}
        />
        <KpiCard
          icon={<Activity className="h-5 w-5 text-teal-600" />}
          label={t("crisisScenarios")}
          value={String(d?.crisisScenarioCount ?? 0)}
          onClick={() => router.push("/bcms/crisis")}
        />
        <KpiCard
          icon={<ClipboardCheck className="h-5 w-5 text-indigo-600" />}
          label={t("exercisesCompleted")}
          value={`${d?.exercisesCompleted ?? 0} / ${(d?.exercisesCompleted ?? 0) + (d?.exercisesPlanned ?? 0)}`}
          onClick={() => router.push("/bcms/exercises")}
        />
        <KpiCard
          icon={<FileWarning className="h-5 w-5 text-amber-600" />}
          label={t("openFindings")}
          value={String(d?.openExerciseFindings ?? 0)}
          onClick={() => router.push("/bcms/exercises")}
        />
      </div>

      {/* Bottom Row: Upcoming Exercises + BCP Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Exercises */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              {t("upcomingExercises")}
            </h2>
            <Link
              href="/bcms/exercises"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {t("exercise.list")}
            </Link>
          </div>
          {upcomingExercises.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              {t("exercise.empty")}
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingExercises.map((ex) => (
                <Link
                  key={ex.id}
                  href={`/bcms/exercises/${ex.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ExerciseTypeBadge type={ex.exerciseType} />
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {ex.title}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0 ml-2">
                    {ex.plannedDate}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* BC-Risiken (ERM Bridge) */}
        {bcRiskStats && bcRiskStats.total > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                BC-Risiken
              </h2>
              <Link
                href="/bcms/crisis"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Krisenszenarien
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">
                  {bcRiskStats.critical}
                </p>
                <p className="text-xs text-red-600">Kritisch</p>
              </div>
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-center">
                <p className="text-2xl font-bold text-orange-700">
                  {bcRiskStats.high}
                </p>
                <p className="text-xs text-orange-600">Hoch</p>
              </div>
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">
                  {bcRiskStats.medium}
                </p>
                <p className="text-xs text-yellow-600">Mittel</p>
              </div>
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">
                  {bcRiskStats.low}
                </p>
                <p className="text-xs text-green-600">Niedrig</p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">
                  {bcRiskStats.syncedToErm}
                </p>
                <p className="text-xs text-blue-600 flex items-center justify-center gap-1">
                  <ArrowRight size={10} /> Im ERM
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Navigation */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {t("bcpStatus")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <NavCard
              href="/bcms/bia"
              label={t("bia.title")}
              count={d?.essentialProcessCount ?? 0}
            />
            <NavCard
              href="/bcms/plans"
              label={t("bcp.title")}
              count={d?.activeBcpCount ?? 0}
            />
            <NavCard
              href="/bcms/crisis"
              label={t("crisis.title")}
              count={d?.crisisScenarioCount ?? 0}
            />
            <NavCard href="/bcms/strategies" label={t("strategy.title")} />
            <NavCard
              href="/bcms/exercises"
              label={t("exercise.title")}
              count={(d?.exercisesCompleted ?? 0) + (d?.exercisesPlanned ?? 0)}
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

function ExerciseTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    tabletop: "bg-blue-100 text-blue-900",
    walkthrough: "bg-green-100 text-green-900",
    functional: "bg-yellow-100 text-yellow-900",
    full_simulation: "bg-red-100 text-red-900",
  };
  return (
    <Badge
      variant="outline"
      className={`${colors[type] ?? "bg-gray-100 text-gray-600"} text-[10px]`}
    >
      {type.replace(/_/g, " ")}
    </Badge>
  );
}
