"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus, BarChart3, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  in_progress: "In Bearbeitung",
  completed: "Abgeschlossen",
};

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
  const t = useTranslations("esgAdvanced");
  const [assessments, setAssessments] = useState<MaterialityAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/esg/materiality?limit=50");
      if (res.ok) {
        const json = await res.json();
        setAssessments(json.data ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAssessments();
  }, [fetchAssessments]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const year = Number(formData.get("reportingYear"));
    try {
      const res = await fetch("/api/v1/esg/materiality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportingYear: year, reportingPeriodYear: year }),
      });
      if (res.ok) {
        setDialogOpen(false);
        void fetchAssessments();
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

  const completedCount = assessments.filter((a) => a.status === "completed").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Doppelte Wesentlichkeitsanalyse
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            CSRD-konforme Wesentlichkeitsanalysen nach Berichtsjahren
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={14} className="mr-1" />
              Neue Analyse starten
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neue Wesentlichkeitsanalyse</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reportingYear">Berichtsjahr</Label>
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
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
                  Erstellen
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
              Analysen gesamt
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
              Abgeschlossen
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
              In Bearbeitung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {assessments.filter((a) => a.status === "in_progress" || a.status === "draft").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Assessment List */}
      {assessments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <BarChart3 size={32} className="mx-auto mb-2 text-gray-300" />
            <p>Noch keine Wesentlichkeitsanalysen vorhanden.</p>
            <p className="text-xs mt-1">
              Klicken Sie auf &quot;Neue Analyse starten&quot;, um zu beginnen.
            </p>
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
                      Berichtsjahr {a.reportingPeriodYear}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${STATUS_COLORS[a.status] ?? ""}`}
                    >
                      {STATUS_LABELS[a.status] ?? a.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Erstellt</span>
                      <span>
                        {new Date(a.createdAt).toLocaleDateString("de-DE")}
                      </span>
                    </div>
                    {a.finalizedAt && (
                      <div className="flex justify-between">
                        <span>Abgeschlossen</span>
                        <span>
                          {new Date(a.finalizedAt).toLocaleDateString("de-DE")}
                        </span>
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
