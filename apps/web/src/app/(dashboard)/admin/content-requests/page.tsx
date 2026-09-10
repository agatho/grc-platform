"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  RefreshCcw,
  FileQuestion,
  Inbox,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import { useDateFormat } from "@/lib/format-date";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Fest verdrahtetes Deutsch, eine
 * von Hand gebaute Mehrzahl (`Anfrage{… ? "n" : ""}`) und eine
 * gebietsschemablinde Zahl (`avgResponseTimeDays.toFixed(1)` → immer
 * Dezimalpunkt). Beides ist jetzt Sache des Katalogs bzw. von
 * `formatNumber` aus `lib/format-date.ts`.
 */

// ── Types ─────────────────────────────────────────────────────

interface ContentRequestStats {
  open: number;
  overdue: number;
  answered: number;
  avgResponseTimeDays: number;
}

interface ContentRequest {
  id: string;
  title: string;
  entityName: string;
  requestedByName: string;
  recipientName: string;
  deadline: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "overdue" | "answered" | "cancelled";
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "overdue":
      return "bg-red-100 text-red-800 border-red-200";
    case "answered":
      return "bg-green-100 text-green-800 border-green-200";
    case "cancelled":
      return "bg-gray-100 text-gray-500 border-gray-200";
    default:
      return "";
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200";
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "medium":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "low":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "";
  }
}

// ── Component ─────────────────────────────────────────────────

export default function ContentRequestsPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { formatDate, formatNumber } = useDateFormat();
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade-, Daten- und Fehlerzustand (Muster
  // aus Welle 7b, `catalogs/objects/page.tsx`). Anfragen und Kennzahlen
  // wurden immer zusammen geholt — daher EINE Abfrage. Eine nicht-ok-Antwort
  // der Anfragenliste wirft wie vorher und landet im Fehlerzustand; eine
  // nicht-ok-Antwort der Kennzahlen laesst sie wie vorher leer.
  const {
    data,
    isPending: loading,
    isError: error,
    isFetching,
    refetch,
  } = useQuery<{
    requests: ContentRequest[];
    stats: ContentRequestStats | null;
  }>({
    queryKey: ["content-requests", "list-and-stats"],
    queryFn: async () => {
      const [reqRes, statsRes] = await Promise.all([
        fetch("/api/v1/content-requests"),
        fetch("/api/v1/content-requests/stats"),
      ]);
      if (!reqRes.ok) throw new Error("Failed to load requests");
      const reqJson = await reqRes.json();
      let stats: ContentRequestStats | null = null;
      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        stats = (statsJson.data ?? null) as ContentRequestStats | null;
      }
      return { requests: (reqJson.data ?? []) as ContentRequest[], stats };
    },
  });
  const requests = data?.requests ?? [];
  const stats = data?.stats ?? null;

  const fetchData = useCallback(async () => {
    await refetch();
  }, [refetch]);

  if (loading) {
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
            {t("contentRequests.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("contentRequests.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isFetching}
          >
            <RefreshCcw
              size={14}
              className={isFetching ? "animate-spin" : ""}
            />
            <span className="sr-only">{tCommon("actions.refresh")}</span>
          </Button>
          <Button size="sm">
            <Plus size={16} className="mr-1" />
            {t("contentRequests.create")}
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {t("contentRequests.loadError")}
        </div>
      )}

      {/* KPI Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="py-4 text-center">
              <Inbox className="mx-auto h-5 w-5 text-blue-500" />
              <p className="mt-1 text-2xl font-bold">{stats.open}</p>
              <p className="text-xs text-gray-500">
                {t("contentRequests.status.open")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <AlertTriangle
                className={`mx-auto h-5 w-5 ${
                  stats.overdue > 0 ? "text-red-500" : "text-gray-400"
                }`}
              />
              <p
                className={`mt-1 text-2xl font-bold ${
                  stats.overdue > 0 ? "text-red-600" : ""
                }`}
              >
                {stats.overdue}
              </p>
              <p className="text-xs text-gray-500">
                {t("contentRequests.status.overdue")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <CheckCircle2 className="mx-auto h-5 w-5 text-green-500" />
              <p className="mt-1 text-2xl font-bold">{stats.answered}</p>
              <p className="text-xs text-gray-500">
                {t("contentRequests.status.answered")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <Clock className="mx-auto h-5 w-5 text-gray-400" />
              <p className="mt-1 text-2xl font-bold">
                {t("contentRequests.daysShort", {
                  value: formatNumber(stats.avgResponseTimeDays, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }),
                })}
              </p>
              <p className="text-xs text-gray-500">
                {t("contentRequests.avgResponseTime")}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      {requests.length === 0 && !error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileQuestion size={48} className="text-gray-500 mb-4" />
            <p className="text-sm font-medium text-gray-500">
              {t("approvalRequests.empty")}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {t("contentRequests.emptyHint")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("contentRequests.allRequests")}</CardTitle>
            <CardDescription>
              {t("contentRequests.requestCount", { count: requests.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      {t("approvalRequests.column.title")}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      {t("reviewCycles.column.entity")}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      {t("contentRequests.column.requestedBy")}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      {t("contentRequests.column.recipient")}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      {t("reviewCycles.column.deadline")}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      {t("contentRequests.column.priority")}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      {t("reminders.column.status")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr
                      key={req.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-3 font-medium text-gray-900">
                        {req.title}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {req.entityName}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {req.requestedByName}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {req.recipientName}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {formatDate(req.deadline)}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant="outline"
                          className={priorityBadgeClass(req.priority)}
                        >
                          {t(`dataQuality.severity.${req.priority}`)}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(req.status)}
                        >
                          {t(`contentRequests.status.${req.status}`)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
