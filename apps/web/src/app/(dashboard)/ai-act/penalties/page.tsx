"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";

interface AiPenalty {
  id: string;
  authority: string;
  penalty_type: string;
  fine_amount: number;
  fine_currency: string;
  article_reference: string | null;
  description: string | null;
  status: string;
  appeal_status: string;
  created_at: string;
}

const PENALTY_BRACKETS = [
  { label: "Art. 99 Abs. 3 — Verbotene Praktiken", max: "35 Mio. EUR / 7% Umsatz", color: "bg-red-100 text-red-900" },
  { label: "Art. 99 Abs. 4 — Pflichten Hochrisiko-KI", max: "15 Mio. EUR / 3% Umsatz", color: "bg-orange-100 text-orange-900" },
  { label: "Art. 99 Abs. 5 — Sonstige Verstose", max: "7,5 Mio. EUR / 1% Umsatz", color: "bg-yellow-100 text-yellow-900" },
];

const STATUS_COLORS: Record<string, string> = { pending: "bg-yellow-100 text-yellow-900", imposed: "bg-red-100 text-red-900", paid: "bg-gray-100 text-gray-700", appealed: "bg-blue-100 text-blue-900", overturned: "bg-green-100 text-green-900" };

function PenaltiesPageInner() {
  const t = useTranslations("aiAct");
  const [rows, setRows] = useState<AiPenalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ authority: "", penalty_type: "fine", fine_amount: "", fine_currency: "EUR", article_reference: "", description: "" });

  const fetchData = useCallback(async () => { setLoading(true); try { const res = await fetch("/api/v1/ai-act/penalties?limit=50"); if (res.ok) setRows((await res.json()).data); } finally { setLoading(false); } }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    const payload = { ...form, fine_amount: form.fine_amount ? Number(form.fine_amount) : 0, article_reference: form.article_reference || null, description: form.description || null };
    const res = await fetch("/api/v1/ai-act/penalties", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { setDialogOpen(false); setForm({ authority: "", penalty_type: "fine", fine_amount: "", fine_currency: "EUR", article_reference: "", description: "" }); void fetchData(); }
  };

  const formatCurrency = (amount: number, currency: string) => new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amount);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <ModuleTabNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sanktionsverfolgung</h1>
          <p className="text-muted-foreground">Art. 99 KI-Verordnung</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Sanktion erfassen</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Sanktion erfassen</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Behorde</Label><Input value={form.authority} onChange={(e) => setForm({ ...form, authority: e.target.value })} /></div>
              <div><Label>Sanktionstyp</Label>
                <Select value={form.penalty_type} onValueChange={(v) => setForm({ ...form, penalty_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fine">Geldbusse</SelectItem>
                    <SelectItem value="warning">Verwarnung</SelectItem>
                    <SelectItem value="market_restriction">Marktbeschrankung</SelectItem>
                    <SelectItem value="withdrawal_order">Rucknahmeanordnung</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Betrag</Label><Input type="number" value={form.fine_amount} onChange={(e) => setForm({ ...form, fine_amount: e.target.value })} /></div>
                <div><Label>Wahrung</Label>
                  <Select value={form.fine_currency} onValueChange={(v) => setForm({ ...form, fine_currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="EUR">EUR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Artikelreferenz</Label><Input value={form.article_reference} onChange={(e) => setForm({ ...form, article_reference: e.target.value })} placeholder="z.B. Art. 99 Abs. 3" /></div>
              <div><Label>Beschreibung</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <Button className="w-full" onClick={handleSubmit} disabled={!form.authority || !form.penalty_type}>Speichern</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Penalty bracket reference */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4" />Bussgeldrahmen Art. 99</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {PENALTY_BRACKETS.map((b) => (
            <div key={b.label} className={`p-2 rounded text-sm ${b.color}`}>
              <span className="font-medium">{b.label}</span> — bis zu {b.max}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {rows.map((p) => (
          <Card key={p.id}><CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{p.authority} — {p.penalty_type}</p>
              <p className="text-sm text-muted-foreground">
                {p.fine_amount > 0 && formatCurrency(p.fine_amount, p.fine_currency)}
                {p.article_reference && ` | ${p.article_reference}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge className={STATUS_COLORS[p.status] ?? ""}>{p.status}</Badge>
              {p.appeal_status !== "none" && <Badge variant="outline">Einspruch: {p.appeal_status}</Badge>}
            </div>
          </CardContent></Card>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-center py-8">Keine Sanktionen erfasst</p>}
      </div>
    </div>
  );
}

export default function PenaltiesPage() {
  return <ModuleGate moduleKey="isms"><PenaltiesPageInner /></ModuleGate>;
}
