"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, ArrowLeft, Save, AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDateFormat } from "@/lib/format-date";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Fest verdrahtetes Deutsch mit
 * transliterierten Umlauten ("Zurueck", "ueberschritten", "Eindaemmung",
 * "Praeventivmassnahmen", "Behoerde"). Der Katalog schreibt sie richtig.
 *
 * `getDeadlineInfo` steht ausserhalb der Komponente und rechnet nur noch;
 * die Beschriftung des Countdowns wird in der Komponente aus dem Katalog
 * geholt, weil eine Hilfsfunktion keinen Hook lesen kann.
 */
interface AiIncident {
  id: string;
  ai_system_id: string | null;
  gpai_model_id: string | null;
  incident_code: string | null;
  title: string;
  description: string | null;
  severity: string;
  is_serious: boolean;
  detected_at: string;
  authority_deadline: string | null;
  authority_notified_at: string | null;
  authority_reference: string | null;
  affected_persons_count: number | null;
  harm_type: string | null;
  harm_description: string | null;
  root_cause: string | null;
  root_cause_category: string | null;
  remediation_actions: string | null;
  preventive_measures: string | null;
  lessons_learned: string | null;
  status: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-900",
  high: "bg-orange-100 text-orange-900",
  medium: "bg-yellow-100 text-yellow-900",
  low: "bg-green-100 text-green-900",
};

const STATUS_COLORS: Record<string, string> = {
  detected: "bg-red-100 text-red-900",
  investigating: "bg-orange-100 text-orange-900",
  mitigating: "bg-yellow-100 text-yellow-900",
  resolved: "bg-green-100 text-green-900",
  closed: "bg-gray-100 text-gray-700",
};

function getDeadlineInfo(deadline: string | null) {
  if (!deadline) return null;
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffD = Math.floor(diffH / 24);
  const overdue = diffMs < 0;
  return { overdue, diffH: Math.abs(diffH), diffD: Math.abs(diffD), date: dl };
}

function IncidentDetailInner() {
  const _router = useRouter();
  const t = useTranslations("aiAct");
  const tCommon = useTranslations("common");
  const { formatDate, formatDateTime } = useDateFormat();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AiIncident | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<AiIncident>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/ai-act/incidents/${id}`);
      if (res.ok) {
        const row = (await res.json()).data;
        setData(row);
        setForm(row);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/ai-act/incidents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const updated = (await res.json()).data;
        setData(updated);
        setForm(updated);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t("incidentDetail.notFound")}
      </div>
    );
  }

  const set = (key: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const deadlineInfo = getDeadlineInfo(data.authority_deadline);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/ai-act/incidents"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t("shared.backToList")}
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {tCommon("actions.save")}
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">{data.title}</h1>
        {data.incident_code && (
          <Badge variant="outline">{data.incident_code}</Badge>
        )}
        <Badge className={SEVERITY_COLORS[data.severity] ?? ""}>
          {data.severity}
        </Badge>
        <Badge className={STATUS_COLORS[data.status] ?? ""}>
          {data.status}
        </Badge>
        {data.is_serious && (
          <Badge className="bg-red-600 text-white">
            <AlertTriangle className="h-3 w-3 mr-1" />{" "}
            {t("incidentDetail.serious")}
          </Badge>
        )}
      </div>

      {/* Behoerden-Frist Countdown */}
      {deadlineInfo && (
        <Card
          className={
            deadlineInfo.overdue
              ? "border-red-400 bg-red-50"
              : "border-yellow-400 bg-yellow-50"
          }
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Clock
              className={`h-5 w-5 ${deadlineInfo.overdue ? "text-red-600" : "text-yellow-600"}`}
            />
            <div>
              <p className="font-semibold">
                {deadlineInfo.overdue
                  ? t("incidentDetail.deadlineOverdue", {
                      span:
                        deadlineInfo.diffD > 0
                          ? t("incidentDetail.days", {
                              days: deadlineInfo.diffD,
                            })
                          : t("incidentDetail.hours", {
                              hours: deadlineInfo.diffH,
                            }),
                    })
                  : t("incidentDetail.deadlineRemaining", {
                      span:
                        deadlineInfo.diffD > 0
                          ? t("incidentDetail.days", {
                              days: deadlineInfo.diffD,
                            })
                          : t("incidentDetail.hours", {
                              hours: deadlineInfo.diffH,
                            }),
                    })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("incidentDetail.deadlineAt", {
                  value: formatDateTime(deadlineInfo.date),
                })}
                {data.is_serious
                  ? t("incidentDetail.deadlineWindowSerious")
                  : t("incidentDetail.deadlineWindowStandard")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stammdaten */}
      <Card>
        <CardHeader>
          <CardTitle>{t("shared.masterData")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>{t("shared.title")}</Label>
            <Input
              value={form.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>{t("shared.description")}</Label>
            <Textarea
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Label>{t("incidentDetail.severity")}</Label>
            <Select
              value={form.severity ?? "medium"}
              onValueChange={(v) => set("severity", v)}
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
          <div>
            <Label>{t("shared.status")}</Label>
            <Select
              value={form.status ?? "detected"}
              onValueChange={(v) => set("status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="detected">
                  {t("incidentDetail.statusOption.detected")}
                </SelectItem>
                <SelectItem value="investigating">
                  {t("incidentDetail.statusOption.investigating")}
                </SelectItem>
                <SelectItem value="mitigating">
                  {t("incidentDetail.statusOption.mitigating")}
                </SelectItem>
                <SelectItem value="resolved">
                  {t("incidentDetail.statusOption.resolved")}
                </SelectItem>
                <SelectItem value="closed">
                  {t("incidentDetail.statusOption.closed")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.is_serious ?? false}
              onCheckedChange={(v) => set("is_serious", v)}
            />
            <Label>{t("incidentDetail.seriousIncident")}</Label>
          </div>
          <div>
            <Label>{t("incidentDetail.affectedPersons")}</Label>
            <Input
              type="number"
              value={form.affected_persons_count ?? ""}
              onChange={(e) =>
                set(
                  "affected_persons_count",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            />
          </div>
          <div>
            <Label>{t("incidentDetail.detectedAt")}</Label>
            <Input
              type="datetime-local"
              value={form.detected_at ? form.detected_at.slice(0, 16) : ""}
              onChange={(e) => set("detected_at", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Schaden & Ursache */}
      <Card>
        <CardHeader>
          <CardTitle>{t("incidentDetail.harmSection")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{t("incidentDetail.harmType")}</Label>
              <Input
                value={form.harm_type ?? ""}
                onChange={(e) => set("harm_type", e.target.value)}
              />
            </div>
            <div>
              <Label>{t("incidentDetail.rootCauseCategory")}</Label>
              <Input
                value={form.root_cause_category ?? ""}
                onChange={(e) => set("root_cause_category", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>{t("incidentDetail.harmDescription")}</Label>
            <Textarea
              value={form.harm_description ?? ""}
              onChange={(e) => set("harm_description", e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label>{t("incidentDetail.rootCause")}</Label>
            <Textarea
              value={form.root_cause ?? ""}
              onChange={(e) => set("root_cause", e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Massnahmen */}
      <Card>
        <CardHeader>
          <CardTitle>{t("incidentDetail.measuresSection")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t("incidentDetail.remediationActions")}</Label>
            <Textarea
              value={form.remediation_actions ?? ""}
              onChange={(e) => set("remediation_actions", e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Label>{t("incidentDetail.preventiveMeasures")}</Label>
            <Textarea
              value={form.preventive_measures ?? ""}
              onChange={(e) => set("preventive_measures", e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Label>{t("incidentDetail.lessonsLearned")}</Label>
            <Textarea
              value={form.lessons_learned ?? ""}
              onChange={(e) => set("lessons_learned", e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Behoerdenbenachrichtigung */}
      <Card>
        <CardHeader>
          <CardTitle>{t("incidentDetail.authoritySection")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{t("incidentDetail.authorityNotifiedAt")}</Label>
            <Input
              type="datetime-local"
              value={
                form.authority_notified_at
                  ? String(form.authority_notified_at).slice(0, 16)
                  : ""
              }
              onChange={(e) =>
                set("authority_notified_at", e.target.value || null)
              }
            />
          </div>
          <div>
            <Label>{t("incidentDetail.authorityReference")}</Label>
            <Input
              value={form.authority_reference ?? ""}
              onChange={(e) => set("authority_reference", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Metadaten */}
      <Card>
        <CardHeader>
          <CardTitle>{t("shared.metadata")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">
              {t("shared.createdAt")}
            </span>{" "}
            {formatDate(data.created_at)}
          </div>
          <div>
            <span className="font-medium text-foreground">
              {t("shared.updatedAt")}
            </span>{" "}
            {formatDate(data.updated_at)}
          </div>
          {data.resolved_at && (
            <div>
              <span className="font-medium text-foreground">
                {t("incidentDetail.resolvedAt")}
              </span>{" "}
              {formatDate(data.resolved_at)}
            </div>
          )}
          <div>
            <span className="font-medium text-foreground">
              {t("shared.id")}
            </span>{" "}
            {data.id}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function IncidentDetailPage() {
  return (
    <ModuleGate moduleKey="isms">
      <IncidentDetailInner />
    </ModuleGate>
  );
}
