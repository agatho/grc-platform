"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ArchitectureChangeRequest } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-900",
  under_review: "bg-yellow-100 text-yellow-900",
  approved: "bg-green-100 text-green-900",
  rejected: "bg-red-100 text-red-900",
  deferred: "bg-purple-100 text-purple-900",
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-900",
  medium: "bg-yellow-100 text-yellow-900",
  high: "bg-orange-100 text-orange-900",
  critical: "bg-red-100 text-red-900",
};

export default function ChangeRequestsPage() {
  return (
    <ModuleGate moduleKey="eam">
      <ChangeRequestsInner />
    </ModuleGate>
  );
}

function ChangeRequestsInner() {
  const t = useTranslations("eam");
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert wie
  // vorher eine leere Liste.
  const { data: acrs = [], isPending: loading } = useQuery<
    ArchitectureChangeRequest[]
  >({
    queryKey: ["eam", "change-requests"],
    queryFn: async () => {
      const res = await fetch("/api/v1/eam/change-requests");
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as ArchitectureChangeRequest[];
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("changeRequests.title")}</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t("changeRequests.createRequest")}
        </Button>
      </div>

      <div className="grid gap-3">
        {acrs.map((acr) => (
          <Link key={acr.id} href={`/eam/change-requests/${acr.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{acr.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {acr.changeType} | {acr.affectedElementIds.length} affected
                    elements
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={RISK_COLORS[acr.riskAssessment] ?? ""}>
                    {acr.riskAssessment}
                  </Badge>
                  <Badge className={STATUS_COLORS[acr.status] ?? ""}>
                    {acr.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {acrs.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {t("changeRequests.createRequest")}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
