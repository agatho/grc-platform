"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, GitBranch, Plus, RefreshCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import { useDateFormat } from "@/lib/format-date";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Fest verdrahtetes Deutsch
 * ("Entitaetstyp" mit transliteriertem Umlaut). Umgestellt auf den neuen
 * Namensraum `admin`.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalWorkflow {
  id: string;
  name: string;
  type: "sequential" | "parallel";
  entityType: string;
  stepsCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function workflowTypeBadgeClass(type: string): string {
  switch (type) {
    case "sequential":
      return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100/80";
    case "parallel":
      return "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100/80";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ApprovalWorkflowsPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { formatDate } = useDateFormat();
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert wie
  // vorher eine leere Liste; ein Netzfehler landet im Fehlerzustand der
  // Abfrage und zeigt ueber den Vorgabewert dieselbe Leeransicht.
  const {
    data: workflows = [],
    isPending: loading,
    isFetching,
    refetch,
  } = useQuery<ApprovalWorkflow[]>({
    queryKey: ["approvals", "workflows"],
    queryFn: async () => {
      const res = await fetch("/api/v1/approvals");
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as ApprovalWorkflow[];
    },
  });

  const fetchWorkflows = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            {t("approvals.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("approvals.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchWorkflows}
            disabled={isFetching}
          >
            <RefreshCcw
              className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
            />
            {tCommon("actions.refresh")}
          </Button>
          <Link href="/admin/approvals/requests">
            <Button variant="outline" size="sm">
              {t("approvals.openRequests")}
            </Button>
          </Link>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {t("approvals.create")}
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : workflows.length > 0 ? (
        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{workflow.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={workflowTypeBadgeClass(workflow.type)}
                    >
                      {workflow.type === "sequential" ||
                      workflow.type === "parallel"
                        ? t(`approvals.type.${workflow.type}`)
                        : workflow.type}
                    </Badge>
                    {workflow.active ? (
                      <Badge
                        variant="outline"
                        className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80"
                      >
                        {tCommon("status.active")}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100/80"
                      >
                        {tCommon("status.inactive")}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <span>
                    {t("approvals.entityType")}{" "}
                    <Badge variant="secondary">{workflow.entityType}</Badge>
                  </span>
                  <span>
                    {t("approvals.steps")}{" "}
                    <span className="font-medium text-foreground">
                      {workflow.stepsCount}
                    </span>
                  </span>
                  <span>
                    {t("approvals.createdAt", {
                      value: formatDate(workflow.createdAt),
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">{t("approvals.empty")}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("approvals.emptyHint")}
            </p>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t("approvals.create")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
