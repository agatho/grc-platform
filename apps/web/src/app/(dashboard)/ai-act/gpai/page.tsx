"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, AlertTriangle } from "lucide-react";
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

interface GpaiModel {
  id: string;
  name: string;
  provider: string;
  model_type: string;
  is_systemic_risk: boolean;
  version: string;
  status: string;
  training_data_summary: string | null;
  energy_consumption_kwh: number | null;
  created_at: string;
}

function GpaiPageInner() {
  const t = useTranslations("aiAct");
  const [rows, setRows] = useState<GpaiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", provider: "", model_type: "foundation", is_systemic_risk: false, training_data_summary: "", energy_consumption_kwh: "", version: "1.0" });

  const fetchData = useCallback(async () => { setLoading(true); try { const res = await fetch("/api/v1/ai-act/gpai?limit=50"); if (res.ok) setRows((await res.json()).data); } finally { setLoading(false); } }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    const payload = { ...form, energy_consumption_kwh: form.energy_consumption_kwh ? Number(form.energy_consumption_kwh) : null, training_data_summary: form.training_data_summary || null };
    const res = await fetch("/api/v1/ai-act/gpai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { setDialogOpen(false); setForm({ name: "", provider: "", model_type: "foundation", is_systemic_risk: false, training_data_summary: "", energy_consumption_kwh: "", version: "1.0" }); void fetchData(); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <ModuleTabNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">GPAI-Modellregister</h1>
          <p className="text-muted-foreground">Art. 51-56 KI-Verordnung</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Modell erfassen</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>GPAI-Modell erfassen</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Anbieter</Label><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></div>
              <div><Label>Modelltyp</Label>
                <Select value={form.model_type} onValueChange={(v) => setForm({ ...form, model_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="foundation">Foundation</SelectItem>
                    <SelectItem value="fine_tuned">Fine-tuned</SelectItem>
                    <SelectItem value="open_source">Open Source</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.is_systemic_risk} onCheckedChange={(v) => setForm({ ...form, is_systemic_risk: v })} /><Label>Systemisches Risiko</Label></div>
              <div><Label>Trainingsdaten-Zusammenfassung</Label><Textarea value={form.training_data_summary} onChange={(e) => setForm({ ...form, training_data_summary: e.target.value })} /></div>
              <div><Label>Energieverbrauch (kWh)</Label><Input type="number" value={form.energy_consumption_kwh} onChange={(e) => setForm({ ...form, energy_consumption_kwh: e.target.value })} /></div>
              <div><Label>Version</Label><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></div>
              <Button className="w-full" onClick={handleSubmit} disabled={!form.name || !form.provider}>Speichern</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {rows.map((m) => (
          <Card key={m.id}><CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{m.name}</p>
              <p className="text-sm text-muted-foreground">{m.provider} | {m.model_type} | v{m.version}</p>
            </div>
            <div className="flex gap-2">
              {m.is_systemic_risk && <Badge className="bg-red-100 text-red-900"><AlertTriangle className="h-3 w-3 mr-1" />Systemisch</Badge>}
              <Badge variant="outline">{m.status}</Badge>
            </div>
          </CardContent></Card>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-center py-8">Noch keine GPAI-Modelle erfasst</p>}
      </div>
    </div>
  );
}

export default function GpaiPage() {
  return <ModuleGate moduleKey="isms"><GpaiPageInner /></ModuleGate>;
}
