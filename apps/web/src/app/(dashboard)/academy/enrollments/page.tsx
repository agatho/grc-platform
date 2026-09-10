"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCcw } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDateFormat } from "@/lib/format-date";

interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  status: string;
  progressPct: number;
  dueDate: string | null;
  completedAt: string | null;
}

export default function EnrollmentsPage() {
  return (
    <ModuleGate moduleKey="academy">
      <EnrollmentsList />
    </ModuleGate>
  );
}

function EnrollmentsList() {
  const t = useTranslations("academy");
  const { formatDate } = useDateFormat();
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert
  // wie vorher eine leere Liste.
  const {
    data: items = [],
    isPending: loading,
    isFetching,
    refetch,
  } = useQuery<Enrollment[]>({
    queryKey: ["academy", "enrollments"],
    queryFn: async () => {
      const res = await fetch("/api/v1/academy/enrollments?limit=50");
      if (!res.ok) return [];
      return ((await res.json()).data ?? []) as Enrollment[];
    },
  });

  const fetchData = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const statusColors: Record<string, string> = {
    assigned: "bg-blue-50 text-blue-700",
    in_progress: "bg-yellow-50 text-yellow-700",
    completed: "bg-green-50 text-green-700",
    overdue: "bg-red-50 text-red-700",
    exempted: "bg-gray-50 text-gray-600",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("enrollments.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("enrollments.description")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={isFetching}
        >
          <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} />
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {t("enrollments.empty")}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
            >
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {e.courseId}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className={statusColors[e.status] ?? ""}
                  >
                    {e.status.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {e.progressPct}% {t("complete")}
                  </span>
                </div>
              </div>
              <div className="text-right">
                {e.dueDate && (
                  <p className="text-xs text-gray-400">
                    {t("dueDate")}: {formatDate(e.dueDate)}
                  </p>
                )}
                {e.completedAt && (
                  <p className="text-xs text-green-600">
                    {t("completedAt")}: {formatDate(e.completedAt)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
