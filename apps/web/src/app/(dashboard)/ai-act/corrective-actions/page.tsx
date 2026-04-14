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

interface CorrectiveAction {
  id: string;
  title: string;
  ai_system_id: string | null;
  action_type: string;
  priority: string;
  status: string;
  due_date: string | null;
  is_recall: boolean;
  is_withdrawal: boolean;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = { critical: "bg-red-100 text-red-900", high: "bg-orange-100 text-orange-900", medium: "bg-yellow-100 text-yellow-900", low: "bg-green-100 text-green-900" };
const STATUS_COLORS: Record<string, string> = { open: "bg-gray-100 text-gray-700", in_progress: "bg-blue-100 text-blue-900", completed: "bg-green-100 text-green-900", verified: "bg-green-200 text-green-900" };

function CorrectiveActionsInner() {
  const t = useTranslations("aiAct");
  const [rows, setRows] = useState<CorrectiveAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", ai_system_id: "", action_type: "corrective", priority: "medium", due_date: "", is_recall: false, is_withdrawal: false });

  const fetchData = useCallback(async () => { setLoading(true); try { const res = await fetch("/api/v1/ai-act/corrective-actions?limit=50"); if (res.ok) setRows((await res.json()).data); } finally { setLoading(false); } }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    const payload = { ...form, ai_system_id: form.ai_system_id || null, due_date: form.due_date || null };
    const res = await fetch("/api/v1/ai-act/corrective-actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { setDialogOpen(false); setForm({ title: "", description: "", ai_system_id: "", action_type: "corrective", priority: "medium", due_date: "", is_recall: false, is_withdrawal: false }); void fetchData(); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <ModuleTabNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Korrekturmasnahmen</h1>
          <p className="text-muted-foreground">Art. 20-21 KI-Verordnung</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Masnahme anlegen</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Korrekturmasnahme</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Beschreibung</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>KI-System ID (optional)</Label><Input value={form.ai_system_id} onChange={(e) => setForm({ ...form, ai_system_id: e.target.value })} /></div>
              <div><Label>Art der Masnahme</Label>
                <Select value={form.action_type} onValueChange={(v) => setForm({ ...form, action_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrective">Korrektur</SelectItem>
                    <SelectItem value="preventive">Pravention</SelectItem>
                    <SelectItem value="recall">Ruckruf</SelectItem>
                    <SelectItem value="withdrawal">Rucknahme</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Prioritat</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Kritisch</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="low">Niedrig</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Falligkeitsdatum</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_recall} onCheckedChange={(v) => setForm({ ...form, is_recall: v })} /><Label>Ruckruf</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_withdrawal} onCheckedChange={(v) => setForm({ ...form, is_withdrawal: v })} /><Label>Rucknahme vom Markt</Label></div>
              <Button className="w-full" onClick={handleSubmit} disabled={!form.title || !form.action_type || !form.priority}>Speichern</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {rows.map((a) => (
          <Card key={a.id} className={(a.is_recall || a.is_withdrawal) ? "border-red-300" : ""}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{a.title}</p>
                  {(a.is_recall || a.is_withdrawal) && <AlertTriangle className="h-4 w-4 text-red-600" />}
                </div>
                <p className="text-sm text-muted-foreground">
                  {a.action_type}{a.due_date ? ` | Fallig: ${new Date(a.due_date).toLocaleDateString("de-DE")}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {a.is_recall && <Badge className="bg-red-600 text-white">Ruckruf</Badge>}
                {a.is_withdrawal && <Badge className="bg-red-600 text-white">Rucknahme</Badge>}
                <Badge className={PRIORITY_COLORS[a.priority] ?? ""}>{a.priority}</Badge>
                <Badge className={STATUS_COLORS[a.status] ?? ""} variant="outline">{a.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-center py-8">Keine Korrekturmasnahmen vorhanden</p>}
      </div>
    </div>
  );
}

export default function CorrectiveActionsPage() {
  return <ModuleGate moduleKey="isms"><CorrectiveActionsInner /></ModuleGate>;
}
