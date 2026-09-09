"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Loader2, ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDateFormat } from "@/lib/format-date";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Die Seite stand fest auf
 * Deutsch — mit transliterierten Umlauten ("Zurueck", "Bitte waehlen",
 * "In Pruefung", "Begruendung", "Ausserbetrieb"), also derselben Fehlerform,
 * die Welle 5a im Meldekanal gefunden hat (OP-191). Der Katalog schreibt sie
 * richtig; die Umstellung nimmt den Textfehler mit.
 *
 * Die Schaltflaeche "Speichern" kommt aus `common.actions.save` und nicht aus
 * einem neuen `aiAct`-Schluessel: ein zweiter Schluessel fuer denselben Text
 * macht die Sache schlechter (Welle 5a, §3.1).
 */
interface AiSystemDetail {
  id: string;
  systemCode: string;
  name: string;
  description: string | null;
  purpose: string | null;
  aiTechnique: string | null;
  riskClassification: string;
  riskJustification: string | null;
  annexCategory: string | null;
  providerOrDeployer: string;
  providerName: string | null;
  providerJurisdiction: string | null;
  deploymentDate: string | null;
  humanOversightRequired: boolean;
  ownerId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const RISK_COLORS: Record<string, string> = {
  unacceptable: "bg-red-100 text-red-900",
  high: "bg-orange-100 text-orange-900",
  limited: "bg-yellow-100 text-yellow-900",
  minimal: "bg-green-100 text-green-900",
};

const aiSystemKey = (id: string) => ["ai-act", "systems", id] as const;

function SystemDetailInner() {
  const _router = useRouter();
  const t = useTranslations("aiAct");
  const { id } = useParams<{ id: string }>();

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `processes/[id]/ropa/page.tsx`): das Formular wird aus dem
  // Serverstand gesät, deshalb lebt es in einer eigenen Komponente, die erst
  // eingehängt wird, wenn die Daten da sind. Eine nicht-ok-Antwort liefert
  // wie vorher „nicht gefunden".
  const { data = null, isPending: loading } = useQuery<AiSystemDetail | null>({
    queryKey: aiSystemKey(id),
    queryFn: async () => {
      const res = await fetch(`/api/v1/ai-act/systems/${id}`);
      if (!res.ok) return null;
      return (await res.json()).data as AiSystemDetail;
    },
  });

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
        {t("systemDetail.notFound")}
      </div>
    );
  }

  return <SystemDetailForm id={id} initial={data} />;
}

function SystemDetailForm({
  id,
  initial,
}: {
  id: string;
  initial: AiSystemDetail;
}) {
  const t = useTranslations("aiAct");
  const tCommon = useTranslations("common");
  const { formatDate } = useDateFormat();
  const queryClient = useQueryClient();
  const [data, setData] = useState<AiSystemDetail>(initial);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<AiSystemDetail>>(initial);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/ai-act/systems/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const updated = (await res.json()).data as AiSystemDetail;
        setData(updated);
        setForm(updated);
        // Den Abfrage-Cache mitziehen, damit ein erneutes Einhängen nicht den
        // alten Stand als Saat nimmt.
        queryClient.setQueryData(aiSystemKey(id), updated);
      }
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/ai-act/systems"
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
        <h1 className="text-2xl font-bold">
          {data.systemCode} - {data.name}
        </h1>
        <Badge className={RISK_COLORS[data.riskClassification] ?? ""}>
          {data.riskClassification}
        </Badge>
        <Badge variant="outline">{data.status}</Badge>
      </div>

      {/* Stammdaten */}
      <Card>
        <CardHeader>
          <CardTitle>{t("shared.masterData")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{t("systemDetail.systemCode")}</Label>
            <Input
              value={form.systemCode ?? ""}
              onChange={(e) => set("systemCode", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("shared.name")}</Label>
            <Input
              value={form.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
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
          <div className="md:col-span-2">
            <Label>{t("systemDetail.purpose")}</Label>
            <Textarea
              value={form.purpose ?? ""}
              onChange={(e) => set("purpose", e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label>{t("systemDetail.aiTechnique")}</Label>
            <Select
              value={form.aiTechnique ?? ""}
              onValueChange={(v) => set("aiTechnique", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("shared.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="machine_learning">
                  {t("systemDetail.technique.machine_learning")}
                </SelectItem>
                <SelectItem value="deep_learning">
                  {t("systemDetail.technique.deep_learning")}
                </SelectItem>
                <SelectItem value="nlp">
                  {t("systemDetail.technique.nlp")}
                </SelectItem>
                <SelectItem value="computer_vision">
                  {t("systemDetail.technique.computer_vision")}
                </SelectItem>
                <SelectItem value="expert_system">
                  {t("systemDetail.technique.expert_system")}
                </SelectItem>
                <SelectItem value="generative_ai">
                  {t("systemDetail.technique.generative_ai")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("shared.status")}</Label>
            <Select
              value={form.status ?? "draft"}
              onValueChange={(v) => set("status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">
                  {t("systemDetail.systemStatus.draft")}
                </SelectItem>
                <SelectItem value="registered">
                  {t("systemDetail.systemStatus.registered")}
                </SelectItem>
                <SelectItem value="under_review">
                  {t("systemDetail.systemStatus.under_review")}
                </SelectItem>
                <SelectItem value="compliant">
                  {t("systemDetail.systemStatus.compliant")}
                </SelectItem>
                <SelectItem value="non_compliant">
                  {t("systemDetail.systemStatus.non_compliant")}
                </SelectItem>
                <SelectItem value="decommissioned">
                  {t("systemDetail.systemStatus.decommissioned")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Risikoklassifikation */}
      <Card>
        <CardHeader>
          <CardTitle>{t("systemDetail.riskSection")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t("systemDetail.riskClass")}</Label>
            <Select
              value={form.riskClassification ?? "minimal"}
              onValueChange={(v) => set("riskClassification", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unacceptable">
                  {t("systemDetail.riskOption.unacceptable")}
                </SelectItem>
                <SelectItem value="high">
                  {t("systemDetail.riskOption.high")}
                </SelectItem>
                <SelectItem value="limited">
                  {t("systemDetail.riskOption.limited")}
                </SelectItem>
                <SelectItem value="minimal">
                  {t("systemDetail.riskOption.minimal")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("systemDetail.riskJustification")}</Label>
            <Textarea
              value={form.riskJustification ?? ""}
              onChange={(e) => set("riskJustification", e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Label>{t("systemDetail.annexCategory")}</Label>
            <Select
              value={form.annexCategory ?? "none"}
              onValueChange={(v) => set("annexCategory", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="annex_i">
                  {t("systemDetail.annex.annex_i")}
                </SelectItem>
                <SelectItem value="annex_ii">
                  {t("systemDetail.annex.annex_ii")}
                </SelectItem>
                <SelectItem value="annex_iii">
                  {t("systemDetail.annex.annex_iii")}
                </SelectItem>
                <SelectItem value="annex_iv">
                  {t("systemDetail.annex.annex_iv")}
                </SelectItem>
                <SelectItem value="none">
                  {t("systemDetail.annex.none")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Anbieter / Betreiber */}
      <Card>
        <CardHeader>
          <CardTitle>{t("systemDetail.providerSection")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{t("systemDetail.role")}</Label>
            <Select
              value={form.providerOrDeployer ?? "deployer"}
              onValueChange={(v) => set("providerOrDeployer", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="provider">
                  {t("systemDetail.roleOption.provider")}
                </SelectItem>
                <SelectItem value="deployer">
                  {t("systemDetail.roleOption.deployer")}
                </SelectItem>
                <SelectItem value="both">
                  {t("systemDetail.roleOption.both")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("systemDetail.providerName")}</Label>
            <Input
              value={form.providerName ?? ""}
              onChange={(e) => set("providerName", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("systemDetail.providerJurisdiction")}</Label>
            <Input
              value={form.providerJurisdiction ?? ""}
              onChange={(e) => set("providerJurisdiction", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("systemDetail.deploymentDate")}</Label>
            <Input
              type="date"
              value={form.deploymentDate ?? ""}
              onChange={(e) => set("deploymentDate", e.target.value || null)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Menschliche Aufsicht */}
      <Card>
        <CardHeader>
          <CardTitle>{t("systemDetail.oversightSection")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.humanOversightRequired ?? false}
              onCheckedChange={(v) => set("humanOversightRequired", v)}
            />
            <Label>{t("systemDetail.oversightRequired")}</Label>
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
            {formatDate(data.createdAt)}
          </div>
          <div>
            <span className="font-medium text-foreground">
              {t("shared.updatedAt")}
            </span>{" "}
            {formatDate(data.updatedAt)}
          </div>
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

export default function SystemDetailPage() {
  return (
    <ModuleGate moduleKey="isms">
      <SystemDetailInner />
    </ModuleGate>
  );
}
