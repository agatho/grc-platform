"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plug,
  Plus,
  Loader2,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Heart,
  Cloud,
  Shield,
  GitBranch,
  Layers,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DashboardStats {
  totalConnectors: number;
  activeConnectors: number;
  healthyConnectors: number;
  degradedConnectors: number;
  unhealthyConnectors: number;
  totalTestsRun24h: number;
  passRate24h: number;
  totalArtifacts: number;
  staleEvidence: number;
}

interface ConnectorRow {
  id: string;
  name: string;
  connectorType: string;
  providerKey: string;
  status: string;
  healthStatus: string;
  lastHealthCheck?: string | null;
  createdAt: string;
}

export default function ConnectorDashboardPage() {
  const t = useTranslations("connectors");
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [connectors, setConnectors] = useState<ConnectorRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, listRes] = await Promise.all([
        fetch("/api/v1/connectors/dashboard"),
        fetch("/api/v1/connectors?limit=50"),
      ]);
      if (dashRes.ok) {
        const json = await dashRes.json();
        setStats(json.data);
      }
      if (listRes.ok) {
        const json = await listRes.json();
        setConnectors(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const statusColor: Record<string, string> = {
    active: "bg-green-100 text-green-900",
    inactive: "bg-gray-100 text-gray-600",
    error: "bg-red-100 text-red-900",
    disabled: "bg-gray-100 text-gray-400",
    pending_setup: "bg-yellow-100 text-yellow-900",
  };

  const healthIcon: Record<string, React.ReactNode> = {
    healthy: <CheckCircle2 size={14} className="text-green-600" />,
    degraded: <AlertTriangle size={14} className="text-yellow-600" />,
    unhealthy: <XCircle size={14} className="text-red-600" />,
    unknown: <Heart size={14} className="text-gray-400" />,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Link href="/connectors/new">
            <Button size="sm">
              <Plus size={14} className="mr-1" />
              {t("addConnector")}
            </Button>
          </Link>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            icon={<Plug className="h-5 w-5 text-blue-600" />}
            label={t("dashboard.totalConnectors")}
            value={String(stats.totalConnectors)}
            subtitle={`${stats.activeConnectors} ${t("dashboard.active")}`}
          />
          <KpiCard
            icon={<Heart className="h-5 w-5 text-green-600" />}
            label={t("dashboard.healthy")}
            value={String(stats.healthyConnectors)}
            subtitle={`${stats.degradedConnectors} ${t("dashboard.degraded")}`}
          />
          <KpiCard
            icon={<Activity className="h-5 w-5 text-purple-600" />}
            label={t("dashboard.testsRun24h")}
            value={String(stats.totalTestsRun24h)}
            subtitle={t("dashboard.last24h")}
          />
          <KpiCard
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            label={t("dashboard.passRate")}
            value={`${stats.passRate24h}%`}
            subtitle={t("dashboard.last24h")}
          />
          <KpiCard
            icon={<Layers className="h-5 w-5 text-indigo-600" />}
            label={t("dashboard.artifacts")}
            value={String(stats.totalArtifacts)}
            subtitle={`${stats.staleEvidence} ${t("dashboard.stale")}`}
          />
        </div>
      )}

      {/* Quick Navigation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/connectors/cloud"
          className="rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors"
        >
          <Cloud className="h-6 w-6 text-orange-600 mb-2" />
          <p className="text-sm font-medium text-gray-900">{t("nav.cloud")}</p>
          <p className="text-xs text-gray-500 mt-1">{t("nav.cloudDesc")}</p>
        </Link>
        <Link
          href="/connectors/identity"
          className="rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors"
        >
          <Shield className="h-6 w-6 text-blue-600 mb-2" />
          <p className="text-sm font-medium text-gray-900">
            {t("nav.identity")}
          </p>
          <p className="text-xs text-gray-500 mt-1">{t("nav.identityDesc")}</p>
        </Link>
        <Link
          href="/connectors/devops"
          className="rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors"
        >
          <GitBranch className="h-6 w-6 text-green-600 mb-2" />
          <p className="text-sm font-medium text-gray-900">{t("nav.devops")}</p>
          <p className="text-xs text-gray-500 mt-1">{t("nav.devopsDesc")}</p>
        </Link>
        <Link
          href="/connectors/framework-mappings"
          className="rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors"
        >
          <Layers className="h-6 w-6 text-purple-600 mb-2" />
          <p className="text-sm font-medium text-gray-900">
            {t("nav.frameworks")}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {t("nav.frameworksDesc")}
          </p>
        </Link>
      </div>

      {/* Connector List */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {t("connectorList.title")}
          </h2>
        </div>
        {connectors.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">
            {t("connectorList.empty")}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {connectors.map((connector) => (
              <div
                key={connector.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => router.push(`/connectors/${connector.id}`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {healthIcon[connector.healthStatus] ?? healthIcon.unknown}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {connector.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {connector.connectorType} / {connector.providerKey}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${statusColor[connector.status] ?? ""}`}
                  >
                    {t(`statuses.${connector.status}`)}
                  </Badge>
                  {connector.lastHealthCheck && (
                    <span className="text-xs text-gray-400">
                      {new Date(connector.lastHealthCheck).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
