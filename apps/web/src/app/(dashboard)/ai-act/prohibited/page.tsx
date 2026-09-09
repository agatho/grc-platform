"use client";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Plus, ShieldX, ShieldCheck } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { useDateFormat } from "@/lib/format-date";

interface ProhibitedScreening {
  id: string;
  ai_system_id: string;
  social_scoring: boolean;
  real_time_biometric: boolean;
  emotion_recognition: boolean;
  predictive_policing: boolean;
  untargeted_scraping: boolean;
  subliminal_manipulation: boolean;
  exploiting_vulnerabilities: boolean;
  biometric_categorization: boolean;
  overall_result: string;
  created_at: string;
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Die acht Verbotstatbestaende
 * des Art. 5 standen als fertige deutsche BESCHRIFTUNG in einer Tabelle; die
 * Seite band `useTranslations("aiAct")` an `_t` und benutzte es nie. Fuer die
 * Ratsche galt sie damit als uebersetzt. Jetzt fuehrt die Tabelle nur noch
 * die Schluessel.
 */
const PROHIBITED_KEYS = [
  "social_scoring",
  "real_time_biometric",
  "emotion_recognition",
  "predictive_policing",
  "untargeted_scraping",
  "subliminal_manipulation",
  "exploiting_vulnerabilities",
  "biometric_categorization",
] as const;

function ProhibitedPageInner() {
  const t = useTranslations("aiAct");
  const { formatDate } = useDateFormat();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    ai_system_id: "",
    social_scoring: false,
    real_time_biometric: false,
    emotion_recognition: false,
    predictive_policing: false,
    untargeted_scraping: false,
    subliminal_manipulation: false,
    exploiting_vulnerabilities: false,
    biometric_categorization: false,
  });

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert wie
  // vorher eine leere Liste.
  const {
    data: rows = [],
    isPending: loading,
    refetch,
  } = useQuery<ProhibitedScreening[]>({
    queryKey: ["ai-act", "prohibited"],
    queryFn: async () => {
      const res = await fetch("/api/v1/ai-act/prohibited?limit=50");
      if (!res.ok) return [];
      return (await res.json()).data as ProhibitedScreening[];
    },
  });
  const fetchData = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const isAnyProhibited =
    form.social_scoring ||
    form.real_time_biometric ||
    form.emotion_recognition ||
    form.predictive_policing ||
    form.untargeted_scraping ||
    form.subliminal_manipulation ||
    form.exploiting_vulnerabilities ||
    form.biometric_categorization;

  const handleSubmit = async () => {
    const res = await fetch("/api/v1/ai-act/prohibited", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setDialogOpen(false);
      setForm({
        ai_system_id: "",
        social_scoring: false,
        real_time_biometric: false,
        emotion_recognition: false,
        predictive_policing: false,
        untargeted_scraping: false,
        subliminal_manipulation: false,
        exploiting_vulnerabilities: false,
        biometric_categorization: false,
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
          <h1 className="text-2xl font-bold">{t("prohibited.title")}</h1>
          <p className="text-muted-foreground">{t("prohibited.description")}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("prohibited.runScreening")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("prohibited.dialogTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("qms.systemId")}</Label>
                <Input
                  value={form.ai_system_id}
                  onChange={(e) =>
                    setForm({ ...form, ai_system_id: e.target.value })
                  }
                />
              </div>
              {PROHIBITED_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Switch
                    checked={
                      (form as unknown as Record<string, boolean>)[key] ?? false
                    }
                    onCheckedChange={(v) => setForm({ ...form, [key]: v })}
                  />
                  <Label className="text-sm">
                    {t(`prohibited.practice.${key}`)}
                  </Label>
                </div>
              ))}
              <div
                className={`p-4 rounded-lg text-center font-bold text-lg ${isAnyProhibited ? "bg-red-100 text-red-900 border border-red-300" : "bg-green-100 text-green-900 border border-green-300"}`}
              >
                {isAnyProhibited ? (
                  <>
                    <ShieldX className="h-5 w-5 inline mr-2" />
                    {t("prohibited.verdictProhibited")}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5 inline mr-2" />
                    {t("prohibited.verdictAllowed")}
                  </>
                )}
              </div>
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={!form.ai_system_id}
              >
                {t("prohibited.saveResult")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {rows.map((s) => {
          const prohibited = s.overall_result === "prohibited";
          return (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {t("qms.systemLine", { id: s.ai_system_id })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("prohibited.checkedAt", {
                      value: formatDate(s.created_at),
                    })}
                  </p>
                </div>
                <Badge
                  className={
                    prohibited
                      ? "bg-red-600 text-white"
                      : "bg-green-100 text-green-900"
                  }
                >
                  {prohibited ? (
                    <>
                      <ShieldX className="h-3 w-3 mr-1" />
                      {t("prohibited.verdictProhibited")}
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      {t("prohibited.verdictAllowed")}
                    </>
                  )}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            {t("prohibited.empty")}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ProhibitedPage() {
  return (
    <ModuleGate moduleKey="isms">
      <ProhibitedPageInner />
    </ModuleGate>
  );
}
