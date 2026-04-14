"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";

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

const SEVERITY_COLORS: Record<string, string> = { critical: "bg-red-100 text-red-900", high: "bg-orange-100 text-orange-900", medium: "bg-yellow-100 text-yellow-900", low: "bg-green-100 text-green-900" };

function getDeadlineBadge(deadline: string) {
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) return <Badge className="bg-red-600 text-white"><Clock className="h-3 w-3 mr-1" />Frist abgelaufen</Badge>;
  if (diffHours < 48) return <Badge className="bg-red-100 text-red-900"><Clock className="h-3 w-3 mr-1" />{diffHours}h verbleibend</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-900"><Clock className="h-3 w-3 mr-1" />{diffDays} Tage</Badge>;
}

function IncidentsPageInner() {
  const t = useTranslations("aiAct");
  const [rows, setRows] = useState<AiIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", ai_system_id: "", severity: "medium", is_serious: false });

  const fetchData = useCallback(async () => { setLoading(true); try { const res = await fetch("/api/v1/ai-act/incidents?limit=50"); if (res.ok) setRows((await res.json()).data); } finally { setLoading(false); } }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    const payload = { ...form, ai_system_id: form.ai_system_id || null };
    const res = await fetch("/api/v1/ai-act/incidents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { setDialogOpen(false); setForm({ title: "", description: "", ai_system_id: "", severity: "medium", is_serious: false }); void fetchData(); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <ModuleTabNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">KI-Vorfallmeldung</h1>
          <p className="text-muted-foreground">Art. 62-63 KI-Verordnung</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Vorfall melden</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>KI-Vorfall melden</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Beschreibung</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>KI-System ID (optional)</Label><Input value={form.ai_system_id} onChange={(e) => setForm({ ...form, ai_system_id: e.target.value })} /></div>
              <div><Label>Schweregrad</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Kritisch</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="low">Niedrig</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_serious} onCheckedChange={(v) => setForm({ ...form, is_serious: v })} />
                <Label>Schwerwiegend (Tod/ernste Schaden)</Label>
              </div>
              <p className="text-sm text-muted-foreground">Meldefrist: {form.is_serious ? "2 Tage" : "15 Tage"} nach Erkennung</p>
              <Button className="w-full" onClick={handleSubmit} disabled={!form.title || !form.severity}>Vorfall melden</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {rows.map((inc) => (
          <Link key={inc.id} href={`/ai-act/incidents/${inc.id}`}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer"><CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{inc.incident_code ? `${inc.incident_code} - ` : ""}{inc.title}</p>
                  {inc.is_serious && <AlertTriangle className="h-4 w-4 text-red-600" />}
                </div>
                <p className="text-sm text-muted-foreground">Erkannt: {new Date(inc.detected_at).toLocaleDateString("de-DE")}</p>
              </div>
              <div className="flex gap-2">
                <Badge className={SEVERITY_COLORS[inc.severity] ?? ""}>{inc.severity}</Badge>
                {inc.authority_deadline && getDeadlineBadge(inc.authority_deadline)}
                <Badge variant="outline">{inc.status}</Badge>
              </div>
            </CardContent></Card>
          </Link>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-center py-8">Keine KI-Vorfalle gemeldet</p>}
      </div>
    </div>
  );
}

export default function AiIncidentsPage() {
  return <ModuleGate moduleKey="isms"><IncidentsPageInner /></ModuleGate>;
}
