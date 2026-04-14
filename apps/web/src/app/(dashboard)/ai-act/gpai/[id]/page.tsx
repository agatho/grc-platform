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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, Save, AlertTriangle, ClipboardCheck } from "lucide-react";
import Link from "next/link";

interface GpaiModel {
  id: string;
  name: string;
  provider: string;
  model_type: string;
  is_systemic_risk: boolean;
  systemic_risk_justification: string | null;
  training_data_summary: string | null;
  computational_resources: string | null;
  energy_consumption_kwh: number | null;
  version: string | null;
  status: string;
  capabilities_summary: string | null;
  limitations_summary: string | null;
  intended_use: string | null;
  cybersecurity_measures: string | null;
  eu_representative_name: string | null;
  eu_representative_contact: string | null;
  code_of_practice_adherence: boolean;
  code_of_practice_notes: string | null;
  incident_reporting_enabled: boolean;
  release_date: string | null;
  created_at: string;
  updated_at: string;
}

// Art. 56 Code of Practice checklist items
const ART56_CHECKLIST = [
  { key: "transparency_obligations", label: "Transparenzpflichten gemaess Art. 53 eingehalten" },
  { key: "copyright_policy", label: "Urheberrechtsrichtlinie und Zusammenfassung der Trainingsdaten dokumentiert" },
  { key: "risk_identification", label: "Systemische Risiken identifiziert und bewertet" },
  { key: "risk_mitigation", label: "Risikominderungsmassnahmen implementiert" },
  { key: "incident_reporting", label: "Verfahren zur Meldung schwerwiegender Vorfaelle eingerichtet" },
  { key: "cybersecurity_measures", label: "Angemessene Cybersicherheitsmassnahmen umgesetzt" },
  { key: "energy_reporting", label: "Energieverbrauch und Rechenressourcen dokumentiert" },
] as const;

interface CodeOfPracticeData {
  adherenceDate?: string;
  checklist?: Record<string, boolean>;
  notes?: string;
}

function parseCodeOfPracticeNotes(raw: string | null): CodeOfPracticeData {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as CodeOfPracticeData;
  } catch {
    // Legacy plain-text notes — migrate gracefully
    return { notes: raw };
  }
}

function serializeCodeOfPracticeNotes(data: CodeOfPracticeData): string {
  return JSON.stringify(data);
}

function GpaiDetailInner() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<GpaiModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<GpaiModel>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/ai-act/gpai/${id}`);
      if (res.ok) {
        const row = (await res.json()).data;
        setData(row);
        setForm(row);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/ai-act/gpai/${id}`, {
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
    return <div className="text-center py-12 text-muted-foreground">GPAI-Modell nicht gefunden</div>;
  }

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/ai-act/gpai" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Zurueck zur Liste
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Speichern
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{data.name}</h1>
        {data.is_systemic_risk && (
          <Badge className="bg-red-100 text-red-900">
            <AlertTriangle className="h-3 w-3 mr-1" /> Systemisches Risiko
          </Badge>
        )}
        <Badge variant="outline">{data.status}</Badge>
      </div>

      {/* Stammdaten */}
      <Card>
        <CardHeader><CardTitle>Stammdaten</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Name</Label>
            <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <Label>Anbieter</Label>
            <Input value={form.provider ?? ""} onChange={(e) => set("provider", e.target.value)} />
          </div>
          <div>
            <Label>Modelltyp</Label>
            <Select value={form.model_type ?? "general_purpose"} onValueChange={(v) => set("model_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general_purpose">General Purpose</SelectItem>
                <SelectItem value="foundation">Foundation</SelectItem>
                <SelectItem value="fine_tuned">Fine-tuned</SelectItem>
                <SelectItem value="open_source">Open Source</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Version</Label>
            <Input value={form.version ?? ""} onChange={(e) => set("version", e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status ?? "draft"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Entwurf</SelectItem>
                <SelectItem value="registered">Registriert</SelectItem>
                <SelectItem value="under_review">In Pruefung</SelectItem>
                <SelectItem value="compliant">Konform</SelectItem>
                <SelectItem value="non_compliant">Nicht konform</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Veroeffentlichungsdatum</Label>
            <Input type="date" value={form.release_date ?? ""} onChange={(e) => set("release_date", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Systemisches Risiko (Art. 51) */}
      <Card>
        <CardHeader><CardTitle>Systemisches Risiko (Art. 51)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={form.is_systemic_risk ?? false} onCheckedChange={(v) => set("is_systemic_risk", v)} />
            <Label>Systemisches Risiko</Label>
          </div>
          <div>
            <Label>Begruendung systemisches Risiko</Label>
            <Textarea value={form.systemic_risk_justification ?? ""} onChange={(e) => set("systemic_risk_justification", e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Technische Details (Art. 52-53) */}
      <Card>
        <CardHeader><CardTitle>Technische Details (Art. 52-53)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Trainingsdaten-Zusammenfassung</Label>
            <Textarea value={form.training_data_summary ?? ""} onChange={(e) => set("training_data_summary", e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Rechenressourcen</Label>
            <Textarea value={form.computational_resources ?? ""} onChange={(e) => set("computational_resources", e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Energieverbrauch (kWh)</Label>
            <Input type="number" value={form.energy_consumption_kwh ?? ""} onChange={(e) => set("energy_consumption_kwh", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <Label>Faehigkeiten</Label>
            <Textarea value={form.capabilities_summary ?? ""} onChange={(e) => set("capabilities_summary", e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Einschraenkungen</Label>
            <Textarea value={form.limitations_summary ?? ""} onChange={(e) => set("limitations_summary", e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Vorgesehene Verwendung</Label>
            <Textarea value={form.intended_use ?? ""} onChange={(e) => set("intended_use", e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Cybersicherheitsmassnahmen</Label>
            <Textarea value={form.cybersecurity_measures ?? ""} onChange={(e) => set("cybersecurity_measures", e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* EU-Vertreter (Art. 54) */}
      <Card>
        <CardHeader><CardTitle>EU-Bevollmaechtigter (Art. 54)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Name des EU-Vertreters</Label>
            <Input value={form.eu_representative_name ?? ""} onChange={(e) => set("eu_representative_name", e.target.value)} />
          </div>
          <div>
            <Label>Kontakt des EU-Vertreters</Label>
            <Input value={form.eu_representative_contact ?? ""} onChange={(e) => set("eu_representative_contact", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Verhaltenskodex (Art. 56) — Code of Practice Workflow */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Verhaltenskodex (Art. 56)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Adherence toggle + date */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Switch checked={form.code_of_practice_adherence ?? false} onCheckedChange={(v) => set("code_of_practice_adherence", v)} />
              <Label className="font-medium">Einhaltung Verhaltenskodex</Label>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Datum der Zusage:</Label>
              <Input
                type="date"
                className="w-44"
                value={parseCodeOfPracticeNotes(form.code_of_practice_notes ?? null).adherenceDate ?? ""}
                onChange={(e) => {
                  const existing = parseCodeOfPracticeNotes(form.code_of_practice_notes ?? null);
                  set("code_of_practice_notes", serializeCodeOfPracticeNotes({ ...existing, adherenceDate: e.target.value }));
                }}
              />
            </div>
          </div>

          {/* Art. 56 Requirements Checklist */}
          <div>
            <Label className="font-medium mb-3 block">Anforderungen nach Art. 56 AI Act</Label>
            <div className="space-y-3 rounded-md border p-4">
              {ART56_CHECKLIST.map((item) => {
                const copData = parseCodeOfPracticeNotes(form.code_of_practice_notes ?? null);
                const checked = copData.checklist?.[item.key] ?? false;
                return (
                  <div key={item.key} className="flex items-start gap-3">
                    <Checkbox
                      id={`cop-${item.key}`}
                      checked={checked}
                      onCheckedChange={(v) => {
                        const existing = parseCodeOfPracticeNotes(form.code_of_practice_notes ?? null);
                        const newChecklist = { ...(existing.checklist ?? {}), [item.key]: !!v };
                        set("code_of_practice_notes", serializeCodeOfPracticeNotes({ ...existing, checklist: newChecklist }));
                      }}
                    />
                    <label htmlFor={`cop-${item.key}`} className="text-sm leading-tight cursor-pointer">
                      {item.label}
                    </label>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {(() => {
                const copData = parseCodeOfPracticeNotes(form.code_of_practice_notes ?? null);
                const total = ART56_CHECKLIST.length;
                const done = ART56_CHECKLIST.filter((i) => copData.checklist?.[i.key]).length;
                return `${done} von ${total} Anforderungen erfuellt`;
              })()}
            </p>
          </div>

          {/* Notes */}
          <div>
            <Label>Anmerkungen zum Verhaltenskodex</Label>
            <Textarea
              value={parseCodeOfPracticeNotes(form.code_of_practice_notes ?? null).notes ?? ""}
              onChange={(e) => {
                const existing = parseCodeOfPracticeNotes(form.code_of_practice_notes ?? null);
                set("code_of_practice_notes", serializeCodeOfPracticeNotes({ ...existing, notes: e.target.value }));
              }}
              rows={3}
              placeholder="Weitere Anmerkungen zur Einhaltung des Verhaltenskodex..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Metadaten */}
      <Card>
        <CardHeader><CardTitle>Metadaten</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div><span className="font-medium text-foreground">Erstellt am:</span> {new Date(data.created_at).toLocaleDateString("de-DE")}</div>
          <div><span className="font-medium text-foreground">Aktualisiert am:</span> {new Date(data.updated_at).toLocaleDateString("de-DE")}</div>
          <div><span className="font-medium text-foreground">ID:</span> {data.id}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function GpaiDetailPage() {
  return (
    <ModuleGate moduleKey="isms">
      <GpaiDetailInner />
    </ModuleGate>
  );
}
