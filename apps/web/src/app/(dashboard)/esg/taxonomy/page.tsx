"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  RefreshCcw,
  Plus,
  CheckCircle2,
  XCircle,
  Leaf,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TaxonomyActivity {
  id: string;
  activityName: string;
  naceCode: string;
  objective: string;
  eligible: boolean;
  aligned: boolean;
  substantialContribution: boolean;
  dnsh: boolean;
  minimumSafeguards: boolean;
  turnoverAligned: number;
  capexAligned: number;
  opexAligned: number;
  status: "draft" | "in_review" | "approved" | "rejected";
}

interface TaxonomySummary {
  eligibleCount: number;
  alignedCount: number;
  alignmentRate: number;
  totalTurnoverAligned: number;
  totalCapexAligned: number;
  totalOpexAligned: number;
}

/* ------------------------------------------------------------------ */
/*  API fetch                                                          */
/* ------------------------------------------------------------------ */

async function fetchTaxonomyData(): Promise<{
  activities: TaxonomyActivity[];
  summary: TaxonomySummary;
}> {
  const res = await fetch("/api/v1/esg/taxonomy?limit=100");
  if (!res.ok) {
    return {
      activities: [],
      summary: {
        eligibleCount: 0,
        alignedCount: 0,
        alignmentRate: 0,
        totalTurnoverAligned: 0,
        totalCapexAligned: 0,
        totalOpexAligned: 0,
      },
    };
  }
  const json = await res.json();
  return {
    activities: (json.data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      activityName: row.activityName as string,
      naceCode: row.naceCode as string,
      objective: row.objective as string,
      eligible: row.eligible as boolean,
      aligned: row.aligned as boolean,
      substantialContribution: row.substantialContribution as boolean,
      dnsh: row.dnsh as boolean,
      minimumSafeguards: row.minimumSafeguards as boolean,
      turnoverAligned: Number(row.turnoverAligned ?? 0),
      capexAligned: Number(row.capexAligned ?? 0),
      opexAligned: Number(row.opexAligned ?? 0),
      status: row.status as TaxonomyActivity["status"],
    })),
    summary: json.summary
      ? {
          eligibleCount: Number(json.summary.eligibleCount ?? 0),
          alignedCount: Number(json.summary.alignedCount ?? 0),
          alignmentRate: Number(json.summary.alignmentRate ?? 0),
          totalTurnoverAligned: Number(json.summary.totalTurnoverAligned ?? 0),
          totalCapexAligned: Number(json.summary.totalCapexAligned ?? 0),
          totalOpexAligned: Number(json.summary.totalOpexAligned ?? 0),
        }
      : {
          eligibleCount: 0,
          alignedCount: 0,
          alignmentRate: 0,
          totalTurnoverAligned: 0,
          totalCapexAligned: 0,
          totalOpexAligned: 0,
        },
  };
}

async function createTaxonomyActivity(data: {
  activityName: string;
  naceCode?: string;
  objectiveId: string;
  reportingYear: number;
}): Promise<boolean> {
  const res = await fetch("/api/v1/esg/taxonomy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.ok;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function TaxonomyPage() {
  return (
    <ModuleGate moduleKey="esg">
      <TaxonomyInner />
    </ModuleGate>
  );
}

function TaxonomyInner() {
  const t = useTranslations("esg");
  const [activities, setActivities] = useState<TaxonomyActivity[]>([]);
  const [summary, setSummary] = useState<TaxonomySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchTaxonomyData();
      setActivities(result.activities);
      setSummary(result.summary);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const ok = await createTaxonomyActivity({
      activityName: formData.get("activityName") as string,
      naceCode: (formData.get("naceCode") as string) || undefined,
      objectiveId: formData.get("objectiveId") as string,
      reportingYear: Number(formData.get("reportingYear")) || new Date().getFullYear(),
    });
    setSaving(false);
    if (ok) {
      setDialogOpen(false);
      void loadData();
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            EU-Taxonomie-Alignment
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Bewertung der Taxonomie-Konformit&auml;t wirtschaftlicher
            Aktivit&auml;ten gem&auml;&szlig; EU-Taxonomie-Verordnung
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCcw
              size={14}
              className={loading ? "animate-spin" : ""}
            />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus size={14} className="mr-1" />
                Aktivit&auml;t hinzuf&uuml;gen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neue Taxonomie-Aktivit&auml;t</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="activityName">Aktivit&auml;tsname</Label>
                  <Input id="activityName" name="activityName" required placeholder="z.B. Stromerzeugung aus Windkraft" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="naceCode">NACE-Code</Label>
                    <Input id="naceCode" name="naceCode" placeholder="z.B. D35.1.1" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reportingYear">Berichtsjahr</Label>
                    <Input id="reportingYear" name="reportingYear" type="number" defaultValue={new Date().getFullYear()} min={2020} max={2035} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="objectiveId">Umweltziel</Label>
                  <Select name="objectiveId" defaultValue="climate_mitigation">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="climate_mitigation">Klimaschutz</SelectItem>
                      <SelectItem value="climate_adaptation">Klimaanpassung</SelectItem>
                      <SelectItem value="water">Wasser</SelectItem>
                      <SelectItem value="circular_economy">Kreislaufwirtschaft</SelectItem>
                      <SelectItem value="pollution">Umweltverschmutzung</SelectItem>
                      <SelectItem value="biodiversity">Biodiversit&auml;t</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
                    Erstellen
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Taxonomie-f&auml;hig"
          value={String(summary?.eligibleCount ?? 0)}
          icon={<Leaf size={16} className="text-green-600" />}
        />
        <KpiCard
          label="Taxonomie-konform"
          value={String(summary?.alignedCount ?? 0)}
          icon={<CheckCircle2 size={16} className="text-blue-600" />}
        />
        <KpiCard
          label="Alignment-Quote"
          value={`${(summary?.alignmentRate ?? 0).toFixed(1)} %`}
          icon={<Leaf size={16} className="text-emerald-600" />}
        />
        <KpiCard
          label="Umsatz (aligned)"
          value={formatEuro(summary?.totalTurnoverAligned ?? 0)}
        />
        <KpiCard
          label="CapEx (aligned)"
          value={formatEuro(summary?.totalCapexAligned ?? 0)}
        />
        <KpiCard
          label="OpEx (aligned)"
          value={formatEuro(summary?.totalOpexAligned ?? 0)}
        />
      </div>

      {/* Activities Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  Aktivit&auml;t
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  NACE
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  Umweltziel
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                  F&auml;hig
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                  Konform
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                  SC
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                  DNSH
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                  MS
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                  Umsatz
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activities.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {a.activityName}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {a.naceCode}
                  </td>
                  <td className="px-4 py-3">
                    <ObjectiveBadge objective={a.objective} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <BoolIcon value={a.eligible} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <BoolIcon value={a.aligned} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <BoolIcon value={a.substantialContribution} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <BoolIcon value={a.dnsh} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <BoolIcon value={a.minimumSafeguards} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatEuro(a.turnoverAligned)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
              {activities.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Leaf size={32} className="text-gray-300" />
                      <span>
                        Noch keine Taxonomie-Aktivit&auml;ten erfasst.
                      </span>
                      <span className="text-xs">
                        Klicken Sie auf &quot;Aktivit&auml;t
                        hinzuf&uuml;gen&quot;, um zu beginnen.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs font-medium text-gray-500">{label}</p>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function BoolIcon({ value }: { value: boolean }) {
  return value ? (
    <CheckCircle2 size={16} className="inline text-green-600" />
  ) : (
    <XCircle size={16} className="inline text-gray-300" />
  );
}

function ObjectiveBadge({ objective }: { objective: string }) {
  const colors: Record<string, string> = {
    climate_mitigation: "bg-blue-100 text-blue-900",
    climate_adaptation: "bg-sky-100 text-sky-900",
    water: "bg-cyan-100 text-cyan-900",
    circular_economy: "bg-amber-100 text-amber-900",
    pollution: "bg-orange-100 text-orange-900",
    biodiversity: "bg-green-100 text-green-900",
  };

  const labels: Record<string, string> = {
    climate_mitigation: "Klimaschutz",
    climate_adaptation: "Klimaanpassung",
    water: "Wasser",
    circular_economy: "Kreislaufwirtschaft",
    pollution: "Umweltverschmutzung",
    biodiversity: "Biodiversit\u00e4t",
  };

  return (
    <Badge
      variant="outline"
      className={`${colors[objective] ?? ""} text-[10px]`}
    >
      {labels[objective] ?? objective}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    in_review: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };

  const labels: Record<string, string> = {
    draft: "Entwurf",
    in_review: "In Pr\u00fcfung",
    approved: "Genehmigt",
    rejected: "Abgelehnt",
  };

  return (
    <Badge
      variant="outline"
      className={`${colors[status] ?? ""} text-[10px]`}
    >
      {labels[status] ?? status}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatEuro(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
