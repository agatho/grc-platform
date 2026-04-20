"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, CheckCircle, XCircle } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";

interface ProviderQms {
  id: string;
  ai_system_id: string;
  risk_management_procedure: boolean;
  data_governance_procedure: boolean;
  technical_documentation_procedure: boolean;
  record_keeping_procedure: boolean;
  transparency_procedure: boolean;
  human_oversight_procedure: boolean;
  accuracy_procedure: boolean;
  cybersecurity_procedure: boolean;
  conformity_procedure: boolean;
  post_market_procedure: boolean;
  overall_maturity: number;
  next_audit_date: string | null;
  created_at: string;
}

const QMS_PROCEDURES: { key: string; label: string }[] = [
  {
    key: "risk_management_procedure",
    label: "Risikomanagementsystem (Art. 9)",
  },
  { key: "data_governance_procedure", label: "Daten-Governance (Art. 10)" },
  {
    key: "technical_documentation_procedure",
    label: "Technische Dokumentation (Art. 11)",
  },
  {
    key: "record_keeping_procedure",
    label: "Aufzeichnungspflichten (Art. 12)",
  },
  { key: "transparency_procedure", label: "Transparenzpflichten (Art. 13)" },
  { key: "human_oversight_procedure", label: "Menschliche Aufsicht (Art. 14)" },
  { key: "accuracy_procedure", label: "Genauigkeit & Robustheit (Art. 15)" },
  { key: "cybersecurity_procedure", label: "Cybersicherheit (Art. 15)" },
  { key: "conformity_procedure", label: "Konformitatsbewertung (Art. 43)" },
  { key: "post_market_procedure", label: "Post-Market-Monitoring (Art. 72)" },
];

const MATURITY_COLORS: Record<number, string> = {
  0: "bg-red-100 text-red-900",
  1: "bg-red-100 text-red-900",
  2: "bg-orange-100 text-orange-900",
  3: "bg-yellow-100 text-yellow-900",
  4: "bg-green-100 text-green-900",
  5: "bg-green-200 text-green-900",
};

function QmsPageInner() {
  const t = useTranslations("aiAct");
  const [rows, setRows] = useState<ProviderQms[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Record<string, boolean | string | number>>({
    ai_system_id: "",
    risk_management_procedure: false,
    data_governance_procedure: false,
    technical_documentation_procedure: false,
    record_keeping_procedure: false,
    transparency_procedure: false,
    human_oversight_procedure: false,
    accuracy_procedure: false,
    cybersecurity_procedure: false,
    conformity_procedure: false,
    post_market_procedure: false,
    overall_maturity: 0,
    next_audit_date: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ai-act/qms?limit=50");
      if (res.ok) setRows((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    const payload = { ...form, next_audit_date: form.next_audit_date || null };
    const res = await fetch("/api/v1/ai-act/qms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setDialogOpen(false);
      void fetchData();
    }
  };

  const countChecked = (qms: ProviderQms) =>
    QMS_PROCEDURES.filter(
      (p) => (qms as unknown as Record<string, boolean>)[p.key],
    ).length;

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
          <h1 className="text-2xl font-bold">
            Anbieter-Qualitatsmanagementsystem
          </h1>
          <p className="text-muted-foreground">Art. 16-17 KI-Verordnung</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              QMS erfassen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>QMS-Checkliste</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>KI-System ID</Label>
                <Input
                  value={form.ai_system_id as string}
                  onChange={(e) =>
                    setForm({ ...form, ai_system_id: e.target.value })
                  }
                />
              </div>
              {QMS_PROCEDURES.map((p) => (
                <div key={p.key} className="flex items-center gap-2">
                  <Switch
                    checked={form[p.key] as boolean}
                    onCheckedChange={(v) => setForm({ ...form, [p.key]: v })}
                  />
                  <Label className="text-sm">{p.label}</Label>
                </div>
              ))}
              <div>
                <Label>Reifegrad (0-5)</Label>
                <Select
                  value={String(form.overall_maturity)}
                  onValueChange={(v) =>
                    setForm({ ...form, overall_maturity: Number(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nachstes Audit</Label>
                <Input
                  type="date"
                  value={form.next_audit_date as string}
                  onChange={(e) =>
                    setForm({ ...form, next_audit_date: e.target.value })
                  }
                />
              </div>
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={!form.ai_system_id}
              >
                Speichern
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {rows.map((qms) => (
          <Card key={qms.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">System: {qms.ai_system_id}</p>
                <p className="text-sm text-muted-foreground">
                  {countChecked(qms)}/10 Verfahren erfullt
                  {qms.next_audit_date &&
                    ` | Nachstes Audit: ${new Date(qms.next_audit_date).toLocaleDateString("de-DE")}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge className={MATURITY_COLORS[qms.overall_maturity] ?? ""}>
                  Reifegrad {qms.overall_maturity}
                </Badge>
                {countChecked(qms) === 10 ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-orange-500" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            Noch keine QMS-Bewertungen
          </p>
        )}
      </div>
    </div>
  );
}

export default function QmsPage() {
  return (
    <ModuleGate moduleKey="isms">
      <QmsPageInner />
    </ModuleGate>
  );
}
