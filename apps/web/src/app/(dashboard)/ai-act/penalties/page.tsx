"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { useDateFormat } from "@/lib/format-date";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Diese Seite galt der
 * i18n-Ratsche als UEBERSETZT: sie band `useTranslations("aiAct")` — an
 * `_t`, und benutzte die Bindung nie. Der Unterstrich sorgte zugleich dafuer,
 * dass `no-unused-vars` schwieg. Auf dem Bildschirm stand durchgehend fest
 * verdrahtetes Deutsch, mit abgeschnittenen Umlauten („Behorde", „Geldbusse",
 * „Marktbeschrankung", „Verstose", „Bussgeldrahmen").
 *
 * Dazu ein zweiter Befund derselben Klasse wie OP-190, den der Wachposten aus
 * Welle 5a NICHT sehen konnte: `new Intl.NumberFormat("de-DE", { style:
 * "currency" })`. Die Pruefung dort kennt nur `toLocale*("xx-XX")`. Ein
 * englischsprachiger Nutzer sah auf dieser Seite deutsche Geldbetraege.
 */
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
  { key: "para3", color: "bg-red-100 text-red-900" },
  { key: "para4", color: "bg-orange-100 text-orange-900" },
  { key: "para5", color: "bg-yellow-100 text-yellow-900" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-900",
  imposed: "bg-red-100 text-red-900",
  paid: "bg-gray-100 text-gray-700",
  appealed: "bg-blue-100 text-blue-900",
  overturned: "bg-green-100 text-green-900",
};

function PenaltiesPageInner() {
  const t = useTranslations("aiAct");
  const tCommon = useTranslations("common");
  const { formatCurrency } = useDateFormat();
  const [rows, setRows] = useState<AiPenalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    authority: "",
    penalty_type: "fine",
    fine_amount: "",
    fine_currency: "EUR",
    article_reference: "",
    description: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ai-act/penalties?limit=50");
      if (res.ok) setRows((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    const payload = {
      ...form,
      fine_amount: form.fine_amount ? Number(form.fine_amount) : 0,
      article_reference: form.article_reference || null,
      description: form.description || null,
    };
    const res = await fetch("/api/v1/ai-act/penalties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setDialogOpen(false);
      setForm({
        authority: "",
        penalty_type: "fine",
        fine_amount: "",
        fine_currency: "EUR",
        article_reference: "",
        description: "",
      });
      void fetchData();
    }
  };

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
          <h1 className="text-2xl font-bold">{t("penalties.title")}</h1>
          <p className="text-muted-foreground">{t("penalties.description")}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("penalties.create")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("penalties.create")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("penalties.authority")}</Label>
                <Input
                  value={form.authority}
                  onChange={(e) =>
                    setForm({ ...form, authority: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("penalties.type")}</Label>
                <Select
                  value={form.penalty_type}
                  onValueChange={(v) => setForm({ ...form, penalty_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fine">
                      {t("penalties.typeOption.fine")}
                    </SelectItem>
                    <SelectItem value="warning">
                      {t("penalties.typeOption.warning")}
                    </SelectItem>
                    <SelectItem value="market_restriction">
                      {t("penalties.typeOption.market_restriction")}
                    </SelectItem>
                    <SelectItem value="withdrawal_order">
                      {t("penalties.typeOption.withdrawal_order")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t("penalties.amount")}</Label>
                  <Input
                    type="number"
                    value={form.fine_amount}
                    onChange={(e) =>
                      setForm({ ...form, fine_amount: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>{t("penalties.currency")}</Label>
                  <Select
                    value={form.fine_currency}
                    onValueChange={(v) =>
                      setForm({ ...form, fine_currency: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{t("penalties.articleReference")}</Label>
                <Input
                  value={form.article_reference}
                  onChange={(e) =>
                    setForm({ ...form, article_reference: e.target.value })
                  }
                  placeholder={t("penalties.articlePlaceholder")}
                />
              </div>
              <div>
                <Label>{t("shared.description")}</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={!form.authority || !form.penalty_type}
              >
                {tCommon("actions.save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Penalty bracket reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Scale className="h-4 w-4" />
            {t("penalties.brackets")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {PENALTY_BRACKETS.map((b) => (
            <div key={b.key} className={`p-2 rounded text-sm ${b.color}`}>
              <span className="font-medium">
                {t(`penalties.bracket.${b.key}.label`)}
              </span>{" "}
              {t(`penalties.bracket.${b.key}.max`)}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {rows.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {p.authority} — {p.penalty_type}
                </p>
                <p className="text-sm text-muted-foreground">
                  {p.fine_amount > 0 &&
                    formatCurrency(p.fine_amount, p.fine_currency)}
                  {p.article_reference && ` | ${p.article_reference}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge className={STATUS_COLORS[p.status] ?? ""}>
                  {p.status}
                </Badge>
                {p.appeal_status !== "none" && (
                  <Badge variant="outline">
                    {t("penalties.appeal", { status: p.appeal_status })}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            {t("penalties.empty")}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PenaltiesPage() {
  return (
    <ModuleGate moduleKey="isms">
      <PenaltiesPageInner />
    </ModuleGate>
  );
}
