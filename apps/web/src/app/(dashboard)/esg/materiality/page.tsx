"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, Plus, BarChart3, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDateFormat } from "@/lib/format-date";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MaterialityAssessment {
  id: string;
  reportingPeriodYear: number;
  status: string;
  createdAt: string;
  finalizedAt?: string;
  topicCount?: number;
  completionPercent?: number;
}

const STATUS_KEYS = ["draft", "in_progress", "completed"];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_progress: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
};

export default function Page() {
  return (
    <ModuleGate moduleKey="esg">
      <ModuleTabNav />
      <PageInner />
    </ModuleGate>
  );
}

function PageInner() {
  const { formatDate } = useDateFormat();
  const t = useTranslations("esgAdvanced");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert wie
  // vorher eine leere Liste; ein Netzfehler wird nicht mehr verschluckt,
  // sondern landet im Fehlerzustand der Abfrage.
  const {
    data: assessments = [],
    isPending: loading,
    refetch,
  } = useQuery<MaterialityAssessment[]>({
    queryKey: ["esg", "materiality", "list"],
    queryFn: async () => {
      const res = await fetch("/api/v1/esg/materiality?limit=50");
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as MaterialityAssessment[];
    },
  });

  const fetchAssessments = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const year = Number(formData.get("reportingYear"));
    try {
      const res = await fetch("/api/v1/esg/materiality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportingYear: year,
          reportingPeriodYear: year,
        }),
      });
      // [ARCTOS-FULL-2026-08-31 · Welle 8b] Hier stand `if (res.ok)` ohne
      // `else` — dieselbe Signatur wie OP-216/OP-217. Bei einer abgelehnten
      // Antwort blieb der Dialog offen und sagte nicht, dass nichts
      // angelegt wurde.
      if (res.ok) {
        setDialogOpen(false);
        setCreateError(null);
        void fetchAssessments();
      } else {
        setCreateError(t("materiality.createFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading && assessments.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const completedCount = assessments.filter(
    (a) => a.status === "completed",
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("materiality.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("materiality.subtitle")}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={14} className="mr-1" />
              {t("materiality.newAssessment")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("materiality.dialogTitle")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              {createError && (
                <p className="text-sm text-red-600" role="alert">
                  {createError}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="reportingYear">
                  {t("materiality.reportingYear")}
                </Label>
                <Input
                  id="reportingYear"
                  name="reportingYear"
                  type="number"
                  min={2024}
                  max={2035}
                  defaultValue={new Date().getFullYear()}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {t("materiality.cancel")}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && (
                    <Loader2 size={14} className="mr-1 animate-spin" />
                  )}
                  {t("materiality.create")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("materiality.kpiTotal")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-600" />
              <p className="text-2xl font-bold">{assessments.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("materiality.kpiCompleted")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-green-600" />
              <p className="text-2xl font-bold">{completedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("materiality.kpiInProgress")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {
                assessments.filter(
                  (a) => a.status === "in_progress" || a.status === "draft",
                ).length
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Assessment List */}
      {assessments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <BarChart3 size={32} className="mx-auto mb-2 text-gray-500" />
            <p>{t("materiality.empty")}</p>
            <p className="text-xs mt-1">{t("materiality.emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assessments.map((a) => (
            <Link key={a.id} href={`/esg/materiality/${a.reportingPeriodYear}`}>
              <Card className="hover:border-blue-300 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold">
                      {t("materiality.cardYear", {
                        year: String(a.reportingPeriodYear),
                      })}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${STATUS_COLORS[a.status] ?? ""}`}
                    >
                      {STATUS_KEYS.includes(a.status)
                        ? t(`materiality.status.${a.status}`)
                        : a.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>{t("materiality.createdAt")}</span>
                      <span>{formatDate(a.createdAt)}</span>
                    </div>
                    {a.finalizedAt && (
                      <div className="flex justify-between">
                        <span>{t("materiality.finalizedAt")}</span>
                        <span>{formatDate(a.finalizedAt)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
