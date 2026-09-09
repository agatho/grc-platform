"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ClipboardCheck, RefreshCcw, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import { useDateFormat } from "@/lib/format-date";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Fest verdrahtetes Deutsch mit
 * transliterierten Umlauten ("Entitaetstyp", "Faellig", "ausgewaehlten").
 * `statusLabel` stand ausserhalb der Komponente und lieferte die fertige
 * Beschriftung; aufgeloest wird jetzt ueber ein Template aus dem Katalog.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalRequest {
  id: string;
  title: string;
  entityType: string;
  currentStep: string;
  requesterName: string;
  requesterEmail: string;
  dueDate: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

const STATUSES = ["pending", "approved", "rejected"] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100/80";
    case "approved":
      return "bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80";
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200 hover:bg-red-100/80";
    default:
      return "";
  }
}

function dueDateClass(dueDate: string | null): string {
  if (!dueDate) return "text-muted-foreground";
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "text-red-600 font-medium";
  if (diffDays <= 3) return "text-orange-600 font-medium";
  return "text-muted-foreground";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ApprovalRequestsPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { formatDate } = useDateFormat();
  const [statusFilter, setStatusFilter] = useState<string>("__all__");

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Der Statusfilter wird wie vorher
  // clientseitig angewendet und gehoert daher nicht in den Schluessel. Eine
  // nicht-ok-Antwort liefert wie vorher eine leere Liste.
  const {
    data: requests = [],
    isPending: loading,
    isFetching,
    refetch,
  } = useQuery<ApprovalRequest[]>({
    queryKey: ["approvals", "requests"],
    queryFn: async () => {
      const res = await fetch("/api/v1/approvals/requests");
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as ApprovalRequest[];
    },
  });

  const fetchRequests = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== "__all__" && r.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6" />
            {t("approvals.openRequests")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("approvalRequests.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("approvalRequests.filterStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">
                {t("approvalRequests.allStatuses")}
              </SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`approvalRequests.status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRequests}
            disabled={isFetching}
          >
            <RefreshCcw
              className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
            />
            {tCommon("actions.refresh")}
          </Button>
          <Link href="/admin/approvals">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("approvalRequests.workflows")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredRequests.length > 0 ? (
        <div className="overflow-x-auto">
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium">
                      {t("approvalRequests.column.title")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium">
                      {t("approvalRequests.column.entityType")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium">
                      {t("approvalRequests.column.currentStep")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium">
                      {t("approvalRequests.column.requester")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium">
                      {t("approvalRequests.column.dueDate")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium">
                      {t("approvalRequests.column.status")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="border-b last:border-b-0">
                      <td className="py-3 px-4">
                        <span className="font-medium">{request.title}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary">{request.entityType}</Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {request.currentStep}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span className="text-foreground">
                          {request.requesterName}
                        </span>
                        <br />
                        <span className="text-muted-foreground text-xs">
                          {request.requesterEmail}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 text-sm ${dueDateClass(request.dueDate)}`}
                      >
                        {formatDate(request.dueDate)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(request.status)}
                        >
                          {t(`approvalRequests.status.${request.status}`)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">
              {t("approvalRequests.empty")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {statusFilter !== "__all__"
                ? t("approvalRequests.emptyFiltered")
                : t("approvalRequests.emptyHint")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
