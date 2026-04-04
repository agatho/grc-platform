"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, FileText, FolderTree, MessageSquare, CheckCircle2 } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const [papers, setPapers] = useState<WorkingPaper[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const auditId = params.get("auditId");
      if (!auditId) return;
      const res = await fetch(`/api/v1/audit-mgmt/working-papers?auditId=${auditId}`);
      if (res.ok) {
        const json = await res.json();
        setPapers(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPapers(); }, [fetchPapers]);

  const statusColor = (status: string) => {
    switch (status) {
      case "draft": return "secondary";
      case "in_review": return "default";
      case "needs_revision": return "destructive";
      case "reviewed": return "default";
      case "approved": return "default";
      default: return "secondary";
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
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : papers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><FileText className="mx-auto mb-4 h-12 w-12" /><p>{t("workingPapers.title")}</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {papers.map((wp) => (
            <Card key={wp.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="font-mono text-sm font-bold text-muted-foreground">{wp.reference}</div>
                  <div>
                    <div className="font-medium">{wp.title}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {wp.preparedBy && <span>{t("resourcePlanning.role.lead")}</span>}
                    </div>
                  </div>
                </div>
                <Badge variant={statusColor(wp.status) as any}>
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
