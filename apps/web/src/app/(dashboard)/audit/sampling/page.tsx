"use client";

import { useEffect, useState } from "react";
import {
  Loader2, Plus, Dice5, BarChart3, CheckCircle2, AlertTriangle,
  Calculator, Target, Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AuditSample {
  id: string;
  controlTitle: string | null;
  sampleMethod: string;
  populationSize: number;
  sampleSize: number;
  confidenceLevel: number;
  exceptionsFound: number;
  status: string;
  sampledAt: string | null;
}

const methodLabels: Record<string, string> = {
  random: "Zufallsstichprobe",
  systematic: "Systematische Stichprobe",
  stratified: "Geschichtete Stichprobe",
  judgmental: "Ermessensstichprobe",
  monetary_unit: "Geldeinheitenstichprobe",
};

const statusColors: Record<string, string> = {
  planned: "bg-gray-100 text-gray-900 border-gray-300",
  in_progress: "bg-blue-100 text-blue-900 border-blue-300",
  completed: "bg-green-100 text-green-900 border-green-300",
  failed: "bg-red-100 text-red-900 border-red-300",
};

export default function AuditSamplingPage() {
  const [samples, setSamples] = useState<AuditSample[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/audit/samples?limit=50")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => setSamples(json.data ?? []))
      .catch(() => setSamples([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stichprobenprüfung</h1>
          <p className="text-sm text-gray-500 mt-1">
            Audit Sampling — Statistische und ermessensbasierte Stichprobenverfahren
          </p>
        </div>
        <Button>
          <Plus size={14} className="mr-1.5" />
          Stichprobe erstellen
        </Button>
      </div>

      {/* Sampling Methods Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(methodLabels).map(([key, label]) => (
          <Card key={key}>
            <CardContent className="p-4 text-center">
              <Dice5 size={20} className="mx-auto text-indigo-600 mb-2" />
              <p className="text-xs font-medium text-gray-700">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sample Calculator Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator size={16} className="text-blue-600" />
            Stichprobenkalkulator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <label className="text-gray-500 text-xs font-medium">Grundgesamtheit</label>
              <input type="number" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="z.B. 500" />
            </div>
            <div>
              <label className="text-gray-500 text-xs font-medium">Konfidenzniveau</label>
              <select className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="90">90%</option>
                <option value="95" selected>95%</option>
                <option value="99">99%</option>
              </select>
            </div>
            <div>
              <label className="text-gray-500 text-xs font-medium">Tolerierbare Fehlerrate</label>
              <select className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="1">1%</option>
                <option value="3">3%</option>
                <option value="5" selected>5%</option>
                <option value="10">10%</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="default" className="w-full">
                <Target size={14} className="mr-1.5" />
                Berechnen
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Samples List */}
      {samples.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <Dice5 size={32} className="text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-500">Keine Stichproben vorhanden</p>
          <p className="text-xs text-gray-400 mt-1">Erstellen Sie eine Stichprobe für Kontrollprüfungen</p>
        </div>
      ) : (
        <div className="space-y-2">
          {samples.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-blue-300 transition-colors"
            >
              <Dice5 size={16} className="text-indigo-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{s.controlTitle ?? "Stichprobe"}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px]">{methodLabels[s.sampleMethod] ?? s.sampleMethod}</Badge>
                  <span className="text-[10px] text-gray-400">{s.sampleSize}/{s.populationSize} Einträge</span>
                  <span className="text-[10px] text-gray-400">{s.confidenceLevel}% Konfidenz</span>
                </div>
              </div>
              {s.exceptionsFound > 0 && (
                <Badge variant="outline" className="bg-red-100 text-red-900 border-red-300 text-xs">
                  {s.exceptionsFound} Ausnahmen
                </Badge>
              )}
              <Badge variant="outline" className={`text-xs ${statusColors[s.status] ?? ""}`}>
                {s.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
