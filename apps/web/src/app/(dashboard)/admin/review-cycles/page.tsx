"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCcw,
  ClipboardCheck,
  AlertTriangle,
  Clock,
  Users,
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
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Fest verdrahtetes Deutsch,
 * einschliesslich einer von Hand gebauten Mehrzahl
 * (`Zyklus{… ? "en" : ""}`) — jetzt ein ICU-`plural` im Katalog.
 */

// ── Types ─────────────────────────────────────────────────────

interface ReviewCycle {
  id: string;
  name: string;
  entityName: string;
  reviewerCount: number;
  status: "pending" | "in_review" | "approved" | "rejected" | "escalated";
  deadline: string | null;
  escalationDays: number;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-gray-100 text-gray-700 border-gray-200";
    case "in_review":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "approved":
      return "bg-green-100 text-green-800 border-green-200";
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200";
    case "escalated":
      return "bg-orange-100 text-orange-800 border-orange-200";
    default:
      return "";
  }
}

// ── Component ─────────────────────────────────────────────────

export default function ReviewCyclesPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { formatDate } = useDateFormat();
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/v1/review-cycles");
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setCycles(json.data ?? []);
    } catch {
      setError(true);
      setCycles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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
            {t("reviewCycles.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("reviewCycles.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            <span className="sr-only">{tCommon("actions.refresh")}</span>
          </Button>
          <Button size="sm">
            <Plus size={16} className="mr-1" />
            {t("reviewCycles.create")}
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {t("reviewCycles.loadError")}
        </div>
      )}

      {/* Table */}
      {cycles.length === 0 && !error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardCheck size={48} className="text-gray-500 mb-4" />
            <p className="text-sm font-medium text-gray-500">
              {t("reviewCycles.empty")}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {t("reviewCycles.emptyHint")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("reviewCycles.allCycles")}</CardTitle>
            <CardDescription>
              {t("reviewCycles.cycleCount", { count: cycles.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      {t("reminders.column.name")}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      {t("reviewCycles.column.entity")}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      <div className="flex items-center gap-1">
                        <Users size={14} />
                        {t("reviewCycles.column.reviewers")}
                      </div>
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      {t("reminders.column.status")}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        {t("reviewCycles.column.deadline")}
                      </div>
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      <div className="flex items-center gap-1">
                        <AlertTriangle size={14} />
                        {t("reviewCycles.column.escalation")}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((cycle) => (
                    <tr
                      key={cycle.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-3 font-medium text-gray-900">
                        {cycle.name}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {cycle.entityName}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="secondary">{cycle.reviewerCount}</Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(cycle.status)}
                        >
                          {t(`reviewCycles.status.${cycle.status}`)}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {formatDate(cycle.deadline)}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {t("reviewCycles.days", {
                          count: cycle.escalationDays,
                        })}
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
