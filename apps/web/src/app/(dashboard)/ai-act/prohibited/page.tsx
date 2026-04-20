"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, ShieldX, ShieldCheck } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";

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

const PROHIBITED_LABELS: Record<string, string> = {
  social_scoring: "Social Scoring (Art. 5 Abs. 1 lit. c)",
  real_time_biometric: "Echtzeit-Biometrie (Art. 5 Abs. 1 lit. h)",
  emotion_recognition:
    "Emotionserkennung am Arbeitsplatz (Art. 5 Abs. 1 lit. f)",
  predictive_policing: "Predictive Policing (Art. 5 Abs. 1 lit. d)",
  untargeted_scraping: "Ungezieltes Gesichts-Scraping (Art. 5 Abs. 1 lit. e)",
  subliminal_manipulation:
    "Unterschwellige Manipulation (Art. 5 Abs. 1 lit. a)",
  exploiting_vulnerabilities:
    "Ausnutzen von Vulnerabilitaten (Art. 5 Abs. 1 lit. b)",
  biometric_categorization:
    "Biometrische Kategorisierung (Art. 5 Abs. 1 lit. g)",
};

function ProhibitedPageInner() {
  const t = useTranslations("aiAct");
  const [rows, setRows] = useState<ProhibitedScreening[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ai-act/prohibited?limit=50");
      if (res.ok) setRows((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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
          <h1 className="text-2xl font-bold">Verbotene Praktiken</h1>
          <p className="text-muted-foreground">
            Art. 5 KI-Verordnung - Screening
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Screening durchfuhren
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Verbotsprufung Art. 5</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>KI-System ID</Label>
                <Input
                  value={form.ai_system_id}
                  onChange={(e) =>
                    setForm({ ...form, ai_system_id: e.target.value })
                  }
                />
              </div>
              {Object.entries(PROHIBITED_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <Switch
                    checked={
                      (form as unknown as Record<string, boolean>)[key] ?? false
                    }
                    onCheckedChange={(v) => setForm({ ...form, [key]: v })}
                  />
                  <Label className="text-sm">{label}</Label>
                </div>
              ))}
              <div
                className={`p-4 rounded-lg text-center font-bold text-lg ${isAnyProhibited ? "bg-red-100 text-red-900 border border-red-300" : "bg-green-100 text-green-900 border border-green-300"}`}
              >
                {isAnyProhibited ? (
                  <>
                    <ShieldX className="h-5 w-5 inline mr-2" />
                    VERBOTEN
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5 inline mr-2" />
                    Kein Verbot
                  </>
                )}
              </div>
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={!form.ai_system_id}
              >
                Ergebnis speichern
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
                  <p className="font-medium">System: {s.ai_system_id}</p>
                  <p className="text-sm text-muted-foreground">
                    Gepruft am{" "}
                    {new Date(s.created_at).toLocaleDateString("de-DE")}
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
                      VERBOTEN
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Kein Verbot
                    </>
                  )}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            Noch keine Verbotsprufungen durchgefuhrt
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
