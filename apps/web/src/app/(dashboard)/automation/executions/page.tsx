"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  SkipForward,
  FlaskConical,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Execution {
  id: string;
  ruleId: string;
  ruleName: string;
  entityType?: string | null;
  entityId?: string | null;
  conditionsMatched: boolean;
  actionsExecuted: Array<{
    type: string;
    status: string;
    result?: Record<string, unknown>;
    error?: string;
  }>;
  status: string;
  durationMs?: number | null;
  errorMessage?: string | null;
  executedAt: string;
}

const STATUS_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bg: string }
> = {
  success: {
    icon: CheckCircle2,
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
  },
  partial_failure: {
    icon: AlertTriangle,
    color: "text-yellow-700",
    bg: "bg-yellow-50 border-yellow-200",
  },
  failure: {
    icon: XCircle,
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
  },
  skipped_cooldown: {
    icon: SkipForward,
    color: "text-gray-600",
    bg: "bg-gray-50 border-gray-200",
  },
  skipped_ratelimit: {
    icon: SkipForward,
    color: "text-gray-600",
    bg: "bg-gray-50 border-gray-200",
  },
  dry_run: {
    icon: FlaskConical,
    color: "text-purple-700",
    bg: "bg-purple-50 border-purple-200",
  },
};

export default function ExecutionLogPage() {
  const t = useTranslations("automation");
  const searchParams = useSearchParams();

  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") ?? "",
  );
  const [ruleIdFilter] = useState(searchParams.get("ruleId") ?? "");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (ruleIdFilter) params.set("ruleId", ruleIdFilter);

      const res = await fetch(
        `/api/v1/automation/executions?${params.toString()}`,
      );
      if (res.ok) {
        const json = await res.json();
        setExecutions(json.data ?? []);
        setTotal(json.pagination?.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, ruleIdFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/automation">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={14} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("executionLog.title")}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {total} {t("executionLog.totalExecutions")}
            </p>
          </div>
        </div>
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
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white"
        >
          <option value="">{t("executionLog.allStatuses")}</option>
          <option value="success">{t("executionLog.statuses.success")}</option>
          <option value="partial_failure">
            {t("executionLog.statuses.partial_failure")}
          </option>
          <option value="failure">{t("executionLog.statuses.failure")}</option>
          <option value="skipped_cooldown">
            {t("executionLog.statuses.skipped_cooldown")}
          </option>
          <option value="skipped_ratelimit">
            {t("executionLog.statuses.skipped_ratelimit")}
          </option>
          <option value="dry_run">{t("executionLog.statuses.dry_run")}</option>
        </select>
      </div>

      {/* Execution Table */}
      {loading && executions.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : executions.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-400">
            {t("executionLog.empty")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {executions.map((exec) => {
            const config = STATUS_CONFIG[exec.status] ?? STATUS_CONFIG.failure;
            const Icon = config.icon;
            const isExpanded = expandedId === exec.id;

            return (
              <div
                key={exec.id}
                className={`rounded-lg border ${config.bg} transition-colors`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : exec.id)
                  }
                  className="flex items-center justify-between w-full px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon size={16} className={config.color} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {exec.ruleName ?? exec.ruleId}
                      </p>
                      <p className="text-xs text-gray-500">
                        {exec.entityType && (
                          <span className="mr-2">
                            {exec.entityType}
                          </span>
                        )}
                        {exec.durationMs != null && (
                          <span>{exec.durationMs}ms</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${config.color}`}
                    >
                      {t(`executionLog.statuses.${exec.status}`)}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {new Date(exec.executedAt).toLocaleString()}
                    </span>
                    {isExpanded ? (
                      <ChevronUp size={14} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={14} className="text-gray-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-200/60">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="font-medium text-gray-600">
                          {t("executionLog.conditionsMatched")}:
                        </span>{" "}
                        {exec.conditionsMatched ? "Yes" : "No"}
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">
                          {t("executionLog.entityId")}:
                        </span>{" "}
                        <span className="font-mono">
                          {exec.entityId ?? "-"}
                        </span>
                      </div>
                    </div>

                    {exec.errorMessage && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                        {exec.errorMessage}
                      </div>
                    )}

                    {exec.actionsExecuted &&
                      exec.actionsExecuted.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-gray-600 mb-1">
                            {t("executionLog.actionsExecuted")}:
                          </p>
                          <div className="space-y-1">
                            {exec.actionsExecuted.map((a, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 text-xs"
                              >
                                {a.status === "success" ? (
                                  <CheckCircle2
                                    size={12}
                                    className="text-green-600"
                                  />
                                ) : (
                                  <XCircle
                                    size={12}
                                    className="text-red-600"
                                  />
                                )}
                                <span>
                                  {t(`actionTypes.${a.type}`)}
                                </span>
                                {a.error && (
                                  <span className="text-red-500">
                                    ({a.error})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            {t("executionLog.prev")}
          </Button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            {t("executionLog.next")}
          </Button>
        </div>
      )}
    </div>
  );
}
