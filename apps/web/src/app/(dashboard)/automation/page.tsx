"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  Plus,
  LayoutTemplate,
  Loader2,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DashboardStats {
  activeRules: number;
  totalRules: number;
  executions24h: number;
  successRate24h: number;
  errorRate24h: number;
  topRules: Array<{
    ruleId: string;
    ruleName: string;
    executionCount: number;
    errorCount: number;
  }>;
}

interface RuleRow {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  triggerType: string;
  executionCount: number;
  lastExecutedAt?: string | null;
  createdAt: string;
}

export default function AutomationOverviewPage() {
  const t = useTranslations("automation");
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, rulesRes] = await Promise.all([
        fetch("/api/v1/automation/dashboard"),
        fetch("/api/v1/automation/rules?limit=50"),
      ]);
      if (dashRes.ok) {
        const json = await dashRes.json();
        setStats(json.data);
      }
      if (rulesRes.ok) {
        const json = await rulesRes.json();
        setRules(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const toggleActive = async (ruleId: string, currentActive: boolean) => {
    setTogglingId(ruleId);
    try {
      const res = await fetch(`/api/v1/automation/rules/${ruleId}/activate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (res.ok) {
        setRules((prev) =>
          prev.map((r) =>
            r.id === ruleId ? { ...r, isActive: !currentActive } : r,
          ),
        );
      }
    } finally {
      setTogglingId(null);
    }
  };

  const triggerBadgeColor: Record<string, string> = {
    entity_change: "bg-blue-100 text-blue-700",
    deadline_expired: "bg-orange-100 text-orange-700",
    score_threshold: "bg-red-100 text-red-700",
    periodic: "bg-purple-100 text-purple-700",
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCcw
              size={14}
              className={loading ? "animate-spin" : ""}
            />
          </Button>
          <Link href="/automation/templates">
            <Button variant="outline" size="sm">
              <LayoutTemplate size={14} className="mr-1" />
              {t("fromTemplate")}
            </Button>
          </Link>
          <Link href="/automation/rules/new">
            <Button size="sm">
              <Plus size={14} className="mr-1" />
              {t("createRule")}
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<Zap className="h-5 w-5 text-blue-600" />}
            label={t("dashboard.activeRules")}
            value={String(stats.activeRules)}
            subtitle={`${stats.totalRules} ${t("dashboard.total")}`}
          />
          <KpiCard
            icon={<Activity className="h-5 w-5 text-green-600" />}
            label={t("dashboard.executions24h")}
            value={String(stats.executions24h)}
            subtitle={t("dashboard.last24h")}
          />
          <KpiCard
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            label={t("dashboard.successRate")}
            value={`${stats.successRate24h}%`}
            subtitle={t("dashboard.last24h")}
          />
          <KpiCard
            icon={<XCircle className="h-5 w-5 text-red-600" />}
            label={t("dashboard.errorRate")}
            value={`${stats.errorRate24h}%`}
            subtitle={t("dashboard.last24h")}
          />
        </div>
      )}

      {/* Top Rules by Execution */}
      {stats?.topRules && stats.topRules.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            {t("dashboard.topRules")}
          </h2>
          <div className="space-y-2">
            {stats.topRules.map((tr) => (
              <div
                key={tr.ruleId}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
              >
                <span className="text-sm font-medium text-gray-900">
                  {tr.ruleName}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {tr.executionCount} {t("executions")}
                  </span>
                  {tr.errorCount > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-red-50 text-red-700 border-red-200 text-[10px]"
                    >
                      {tr.errorCount} {t("errors")}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rule List */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {t("ruleList.title")}
          </h2>
        </div>
        {rules.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">
            {t("ruleList.empty")}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => router.push(`/automation/rules/${rule.id}/edit`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleActive(rule.id, rule.isActive);
                    }}
                    disabled={togglingId === rule.id}
                    className="shrink-0"
                  >
                    {rule.isActive ? (
                      <ToggleRight
                        size={24}
                        className="text-green-600"
                      />
                    ) : (
                      <ToggleLeft size={24} className="text-gray-400" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {rule.name}
                    </p>
                    {rule.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {rule.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${triggerBadgeColor[rule.triggerType] ?? ""}`}
                  >
                    {t(`triggerTypes.${rule.triggerType}`)}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {rule.executionCount} {t("executions")}
                  </span>
                  {rule.lastExecutedAt && (
                    <span className="text-xs text-gray-400">
                      {new Date(rule.lastExecutedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="flex items-center gap-3">
        <Link
          href="/automation/executions"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {t("viewExecutionLog")}
        </Link>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-gray-600">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}
