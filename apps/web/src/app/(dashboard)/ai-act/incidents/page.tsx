"use client";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Plus, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { useDateFormat } from "@/lib/format-date";

interface AiIncident {
  id: string;
  incident_code: string;
  title: string;
  severity: string;
  is_serious: boolean;
  status: string;
  detected_at: string;
  authority_deadline: string;
  created_at: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-900",
  high: "bg-orange-100 text-orange-900",
  medium: "bg-yellow-100 text-yellow-900",
  low: "bg-green-100 text-green-900",
};

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. `const _t = useTranslations(…)`,
 * nie benutzt — die Seite galt der Ratsche als uebersetzt und stand auf fest
 * verdrahtetem Deutsch („KI-Vorfalle", „Schaden" ohne Umlaut). Diese Seite
 * ist der Einstieg in die Meldung nach Art. 62/63.
 */

/** Die Uebersetzungsfunktion, wie sie `getDeadlineBadge` braucht. */
type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

function getDeadlineBadge(deadline: string, t: Translate) {
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0)
    return (
      <Badge className="bg-red-600 text-white">
        <Clock className="h-3 w-3 mr-1" />
        {t("authority.deadlineExpired")}
      </Badge>
    );
  if (diffHours < 48)
    return (
      <Badge className="bg-red-100 text-red-900">
        <Clock className="h-3 w-3 mr-1" />
        {t("incidentList.hoursRemaining", { hours: diffHours })}
      </Badge>
    );
  return (
    <Badge className="bg-yellow-100 text-yellow-900">
      <Clock className="h-3 w-3 mr-1" />
      {t("authority.daysRemaining", { days: diffDays })}
    </Badge>
  );
}

function IncidentsPageInner() {
  const t = useTranslations("aiAct");
  const { formatDate } = useDateFormat();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    ai_system_id: "",
    severity: "medium",
    is_serious: false,
  });

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert wie
  // vorher eine leere Liste.
  const {
    data: rows = [],
    isPending: loading,
    refetch,
  } = useQuery<AiIncident[]>({
    queryKey: ["ai-act", "incidents"],
    queryFn: async () => {
      const res = await fetch("/api/v1/ai-act/incidents?limit=50");
      if (!res.ok) return [];
      return (await res.json()).data as AiIncident[];
    },
  });
  const fetchData = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleSubmit = async () => {
    const payload = { ...form, ai_system_id: form.ai_system_id || null };
    const res = await fetch("/api/v1/ai-act/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setDialogOpen(false);
      setForm({
        title: "",
        description: "",
        ai_system_id: "",
        severity: "medium",
        is_serious: false,
      });
      void fetchData();
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="space-y-6">
      <ModuleTabNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("incidentList.title")}</h1>
          <p className="text-muted-foreground">
            {t("incidentList.description")}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("incidentList.report")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("incidentList.dialogTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("shared.title")}</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("shared.description")}</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("incidentList.systemIdOptional")}</Label>
                <Input
                  value={form.ai_system_id}
                  onChange={(e) =>
                    setForm({ ...form, ai_system_id: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("incidentDetail.severity")}</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) => setForm({ ...form, severity: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">
                      {t("incidentDetail.severityOption.critical")}
                    </SelectItem>
                    <SelectItem value="high">
                      {t("incidentDetail.severityOption.high")}
                    </SelectItem>
                    <SelectItem value="medium">
                      {t("incidentDetail.severityOption.medium")}
                    </SelectItem>
                    <SelectItem value="low">
                      {t("incidentDetail.severityOption.low")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_serious}
                  onCheckedChange={(v) => setForm({ ...form, is_serious: v })}
                />
                <Label>{t("incidentList.seriousLabel")}</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {form.is_serious
                  ? t("incidentList.deadlineSerious")
                  : t("incidentList.deadlineStandard")}
              </p>
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={!form.title || !form.severity}
              >
                {t("incidentList.report")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {rows.map((inc) => (
          <Link key={inc.id} href={`/ai-act/incidents/${inc.id}`}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {inc.incident_code ? `${inc.incident_code} - ` : ""}
                      {inc.title}
                    </p>
                    {inc.is_serious && (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("monitor.detectedAt", {
                      value: formatDate(inc.detected_at),
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge className={SEVERITY_COLORS[inc.severity] ?? ""}>
                    {t(`incidentDetail.severityOption.${inc.severity}`)}
                  </Badge>
                  {inc.authority_deadline &&
                    getDeadlineBadge(inc.authority_deadline, t)}
                  <Badge variant="outline">{inc.status}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            {t("incidentList.empty")}
          </p>
        )}
      </div>
    </div>
  );
}

export default function AiIncidentsPage() {
  return (
    <ModuleGate moduleKey="isms">
      <IncidentsPageInner />
    </ModuleGate>
  );
}
