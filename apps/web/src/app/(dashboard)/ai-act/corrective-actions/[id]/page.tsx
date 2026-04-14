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
import { Loader2, ArrowLeft, Save, AlertTriangle, ShieldAlert } from "lucide-react";
import Link from "next/link";

interface CorrectiveAction {
  id: string;
  ai_system_id: string | null;
  source_type: string;
  source_id: string | null;
  title: string;
  description: string | null;
  non_conformity_description: string | null;
  action_type: string;
  is_recall: boolean;
  is_withdrawal: boolean;
  recall_reason: string | null;
  priority: string;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  authority_notified: boolean;
  authority_notified_at: string | null;
  authority_reference: string | null;
  verification_required: boolean;
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  status: string;
  effectiveness_rating: string | null;
  created_at: string;
  updated_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-900",
  high: "bg-orange-100 text-orange-900",
  medium: "bg-yellow-100 text-yellow-900",
  low: "bg-green-100 text-green-900",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-900",
  in_progress: "bg-yellow-100 text-yellow-900",
  completed: "bg-blue-100 text-blue-900",
  verified: "bg-green-100 text-green-900",
  closed: "bg-gray-100 text-gray-700",
};

function CorrectiveActionDetailInner() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CorrectiveAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<CorrectiveAction>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/ai-act/corrective-actions/${id}`);
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
      const res = await fetch(`/api/v1/ai-act/corrective-actions/${id}`, {
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
    return <div className="text-center py-12 text-muted-foreground">Korrekturmassnahme nicht gefunden</div>;
  }

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));
  const isOverdue = data.due_date && new Date(data.due_date) < new Date() && !["completed", "verified", "closed"].includes(data.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/ai-act/corrective-actions" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Zurueck zur Liste
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Speichern
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">{data.title}</h1>
        <Badge className={PRIORITY_COLORS[data.priority] ?? ""}>{data.priority}</Badge>
        <Badge className={STATUS_COLORS[data.status] ?? ""}>{data.status}</Badge>
        {data.is_recall && (
          <Badge className="bg-red-600 text-white">
            <ShieldAlert className="h-3 w-3 mr-1" /> Rueckruf
          </Badge>
        )}
        {data.is_withdrawal && (
          <Badge className="bg-orange-600 text-white">
            <AlertTriangle className="h-3 w-3 mr-1" /> Ruecknahme
          </Badge>
        )}
        {isOverdue && <Badge className="bg-red-600 text-white">Ueberfaellig</Badge>}
      </div>

      {/* Stammdaten */}
      <Card>
        <CardHeader><CardTitle>Stammdaten</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Titel</Label>
            <Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Beschreibung</Label>
            <Textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={3} />
          </div>
          <div className="md:col-span-2">
            <Label>Nichtkonformitaet</Label>
            <Textarea value={form.non_conformity_description ?? ""} onChange={(e) => set("non_conformity_description", e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Massnahmentyp</Label>
            <Select value={form.action_type ?? "corrective"} onValueChange={(v) => set("action_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="corrective">Korrektur</SelectItem>
                <SelectItem value="preventive">Praevention</SelectItem>
                <SelectItem value="recall">Rueckruf</SelectItem>
                <SelectItem value="withdrawal">Ruecknahme</SelectItem>
                <SelectItem value="modification">Aenderung</SelectItem>
                <SelectItem value="decommission">Ausserbetriebnahme</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prioritaet</Label>
            <Select value={form.priority ?? "medium"} onValueChange={(v) => set("priority", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Kritisch</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="low">Niedrig</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status ?? "open"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Offen</SelectItem>
                <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                <SelectItem value="completed">Abgeschlossen</SelectItem>
                <SelectItem value="verified">Verifiziert</SelectItem>
                <SelectItem value="closed">Geschlossen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Faelligkeitsdatum</Label>
            <Input type="date" value={form.due_date ?? ""} onChange={(e) => set("due_date", e.target.value || null)} />
          </div>
        </CardContent>
      </Card>

      {/* Rueckruf / Ruecknahme */}
      <Card>
        <CardHeader><CardTitle>Rueckruf / Ruecknahme (Art. 16/20)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Switch checked={form.is_recall ?? false} onCheckedChange={(v) => set("is_recall", v)} />
              <Label>Rueckruf</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_withdrawal ?? false} onCheckedChange={(v) => set("is_withdrawal", v)} />
              <Label>Ruecknahme vom Markt</Label>
            </div>
          </div>
          {(form.is_recall || form.is_withdrawal) && (
            <div>
              <Label>Begruendung</Label>
              <Textarea value={form.recall_reason ?? ""} onChange={(e) => set("recall_reason", e.target.value)} rows={3} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Behoerdenbenachrichtigung */}
      <Card>
        <CardHeader><CardTitle>Behoerdenbenachrichtigung</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={form.authority_notified ?? false} onCheckedChange={(v) => set("authority_notified", v)} />
            <Label>Behoerde benachrichtigt</Label>
          </div>
          {form.authority_notified && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Benachrichtigt am</Label>
                <Input type="datetime-local" value={form.authority_notified_at ? String(form.authority_notified_at).slice(0, 16) : ""} onChange={(e) => set("authority_notified_at", e.target.value || null)} />
              </div>
              <div>
                <Label>Aktenzeichen Behoerde</Label>
                <Input value={form.authority_reference ?? ""} onChange={(e) => set("authority_reference", e.target.value)} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verifizierung */}
      <Card>
        <CardHeader><CardTitle>Verifizierung</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={form.verification_required ?? true} onCheckedChange={(v) => set("verification_required", v)} />
            <Label>Verifizierung erforderlich</Label>
          </div>
          <div>
            <Label>Verifizierungsnotizen</Label>
            <Textarea value={form.verification_notes ?? ""} onChange={(e) => set("verification_notes", e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Wirksamkeitsbewertung</Label>
            <Select value={form.effectiveness_rating ?? ""} onValueChange={(v) => set("effectiveness_rating", v || null)}>
              <SelectTrigger><SelectValue placeholder="Noch nicht bewertet" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="effective">Wirksam</SelectItem>
                <SelectItem value="partially_effective">Teilweise wirksam</SelectItem>
                <SelectItem value="ineffective">Unwirksam</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {data.verified_at && (
            <p className="text-sm text-muted-foreground">
              Verifiziert am: {new Date(data.verified_at).toLocaleDateString("de-DE")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Metadaten */}
      <Card>
        <CardHeader><CardTitle>Metadaten</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div><span className="font-medium text-foreground">Erstellt am:</span> {new Date(data.created_at).toLocaleDateString("de-DE")}</div>
          <div><span className="font-medium text-foreground">Aktualisiert am:</span> {new Date(data.updated_at).toLocaleDateString("de-DE")}</div>
          {data.completed_at && <div><span className="font-medium text-foreground">Abgeschlossen am:</span> {new Date(data.completed_at).toLocaleDateString("de-DE")}</div>}
          <div><span className="font-medium text-foreground">Quellentyp:</span> {data.source_type}</div>
          <div><span className="font-medium text-foreground">ID:</span> {data.id}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CorrectiveActionDetailPage() {
  return (
    <ModuleGate moduleKey="isms">
      <CorrectiveActionDetailInner />
    </ModuleGate>
  );
}
