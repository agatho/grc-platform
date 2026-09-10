"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Loader2, FileText } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { UnvalidatedJson } from "@/lib/unvalidated-json";

interface WorkingPaper {
  id: string;
  reference: string;
  title: string;
  status: string;
  folderId: string;
  preparedBy?: string;
  reviewedBy?: string;
  approvedBy?: string;
}

export default function WorkingPapersPage() {
  return (
    <ModuleGate moduleKey="audit">
      <WorkingPapersInner />
    </ModuleGate>
  );
}

function WorkingPapersInner() {
  const t = useTranslations("auditAdvanced");
  const searchParams = useSearchParams();
  const auditId = searchParams.get("auditId");

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Die `auditId` kam vorher zur
  // Abrufzeit aus `window.location.search`; jetzt aus `useSearchParams`, im
  // Schlüssel, und ohne sie läuft die Abfrage gar nicht erst (`enabled`).
  const { data: papers = [], isPending } = useQuery<WorkingPaper[]>({
    queryKey: ["audit", "working-papers", auditId],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/audit-mgmt/working-papers?auditId=${auditId}`,
      );
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as WorkingPaper[];
    },
    enabled: Boolean(auditId),
  });
  // Ohne `auditId` brach der alte Abruf vor dem Request ab und nahm den
  // Ladezustand zurück; eine abgeschaltete Abfrage bleibt dagegen `pending`,
  // deshalb gilt sie hier nur mit `auditId` als ladend.
  const loading = isPending && Boolean(auditId);

  const statusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "secondary";
      case "in_review":
        return "default";
      case "needs_revision":
        return "destructive";
      case "reviewed":
        return "default";
      case "approved":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("workingPapers.title")}</h1>
        </div>
        <Button>{t("workingPapers.createWp")}</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : papers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="mx-auto mb-4 h-12 w-12" />
            <p>{t("workingPapers.title")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {papers.map((wp) => (
            <Card
              key={wp.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="font-mono text-sm font-bold text-muted-foreground">
                    {wp.reference}
                  </div>
                  <div>
                    <div className="font-medium">{wp.title}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {wp.preparedBy && (
                        <span>{t("resourcePlanning.role.lead")}</span>
                      )}
                    </div>
                  </div>
                </div>
                <Badge variant={statusColor(wp.status) as UnvalidatedJson}>
                  {t(`workingPapers.status.${wp.status}`)}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
