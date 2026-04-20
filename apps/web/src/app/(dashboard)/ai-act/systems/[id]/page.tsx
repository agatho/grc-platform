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
import { Loader2, ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

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

function SystemDetailInner() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AiSystemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<AiSystemDetail>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/ai-act/systems/${id}`);
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
      const res = await fetch(`/api/v1/ai-act/systems/${id}`, {
        method: "PATCH",
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
        KI-System nicht gefunden
      </div>
    );
  }

  const set = (key: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/ai-act/systems"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Zurueck zur Liste
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Speichern
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
          <CardTitle>Stammdaten</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Systemcode</Label>
            <Input
              value={form.systemCode ?? ""}
              onChange={(e) => set("systemCode", e.target.value)}
            />
          </div>
          <div>
            <Label>Name</Label>
            <Input
              value={form.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Beschreibung</Label>
            <Textarea
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Zweck</Label>
            <Textarea
              value={form.purpose ?? ""}
              onChange={(e) => set("purpose", e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label>KI-Technik</Label>
            <Select
              value={form.aiTechnique ?? ""}
              onValueChange={(v) => set("aiTechnique", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Bitte waehlen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="machine_learning">
                  Machine Learning
                </SelectItem>
                <SelectItem value="deep_learning">Deep Learning</SelectItem>
                <SelectItem value="nlp">NLP</SelectItem>
                <SelectItem value="computer_vision">Computer Vision</SelectItem>
                <SelectItem value="expert_system">Expertensystem</SelectItem>
                <SelectItem value="generative_ai">Generative KI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={form.status ?? "draft"}
              onValueChange={(v) => set("status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Entwurf</SelectItem>
                <SelectItem value="registered">Registriert</SelectItem>
                <SelectItem value="under_review">In Pruefung</SelectItem>
                <SelectItem value="compliant">Konform</SelectItem>
                <SelectItem value="non_compliant">Nicht konform</SelectItem>
                <SelectItem value="decommissioned">Ausserbetrieb</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Risikoklassifikation */}
      <Card>
        <CardHeader>
          <CardTitle>Risikoklassifikation (Art. 6)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Risikoklasse</Label>
            <Select
              value={form.riskClassification ?? "minimal"}
              onValueChange={(v) => set("riskClassification", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unacceptable">
                  Unannehmbares Risiko (Art. 5)
                </SelectItem>
                <SelectItem value="high">Hohes Risiko (Art. 6)</SelectItem>
                <SelectItem value="limited">
                  Begrenztes Risiko (Art. 50)
                </SelectItem>
                <SelectItem value="minimal">Minimales Risiko</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Begruendung der Risikoklassifikation</Label>
            <Textarea
              value={form.riskJustification ?? ""}
              onChange={(e) => set("riskJustification", e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Label>Anhang-Kategorie</Label>
            <Select
              value={form.annexCategory ?? "none"}
              onValueChange={(v) => set("annexCategory", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="annex_i">Anhang I</SelectItem>
                <SelectItem value="annex_ii">Anhang II</SelectItem>
                <SelectItem value="annex_iii">Anhang III</SelectItem>
                <SelectItem value="annex_iv">Anhang IV</SelectItem>
                <SelectItem value="none">Keiner</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Anbieter / Betreiber */}
      <Card>
        <CardHeader>
          <CardTitle>Anbieter / Betreiber</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Rolle</Label>
            <Select
              value={form.providerOrDeployer ?? "deployer"}
              onValueChange={(v) => set("providerOrDeployer", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="provider">Anbieter</SelectItem>
                <SelectItem value="deployer">Betreiber</SelectItem>
                <SelectItem value="both">Beides</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Name des Anbieters</Label>
            <Input
              value={form.providerName ?? ""}
              onChange={(e) => set("providerName", e.target.value)}
            />
          </div>
          <div>
            <Label>Jurisdiktion des Anbieters</Label>
            <Input
              value={form.providerJurisdiction ?? ""}
              onChange={(e) => set("providerJurisdiction", e.target.value)}
            />
          </div>
          <div>
            <Label>Bereitstellungsdatum</Label>
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
          <CardTitle>Menschliche Aufsicht (Art. 14)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.humanOversightRequired ?? false}
              onCheckedChange={(v) => set("humanOversightRequired", v)}
            />
            <Label>Menschliche Aufsicht erforderlich</Label>
          </div>
        </CardContent>
      </Card>

      {/* Metadaten */}
      <Card>
        <CardHeader>
          <CardTitle>Metadaten</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Erstellt am:</span>{" "}
            {new Date(data.createdAt).toLocaleDateString("de-DE")}
          </div>
          <div>
            <span className="font-medium text-foreground">
              Aktualisiert am:
            </span>{" "}
            {new Date(data.updatedAt).toLocaleDateString("de-DE")}
          </div>
          <div>
            <span className="font-medium text-foreground">ID:</span> {data.id}
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
