"use client";

// BPM Overhaul Phase 2: KPI tiles for the BPM landing/dashboard area.

import { useEffect, useState } from "react";
import {
  ShieldAlert,
  Activity,
  AlertTriangle,
  Clock,
  FileCheck,
  Database,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface Kpis {
  total_processes: number;
  published: number;
  in_review: number;
  pending_approval: number;
  critical_processes: number;
  overdue_review: number;
  processes_with_critical_risk: number;
  processes_with_framework_mapping: number;
  processes_with_open_findings: number;
  processes_as_processing_activity: number;
  processes_requiring_dpia: number;
}

export function BpmDashboardKpis() {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const resp = await fetch(`/api/v1/dashboard/bpm-kpis`);
      if (resp.ok && !cancel) {
        const j = await resp.json();
        setKpis(j.data);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  if (!kpis) return null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
      <Tile icon={<Database className="h-4 w-4" />} label="Total processes" value={kpis.total_processes} />
      <Tile icon={<FileCheck className="h-4 w-4" />} label="Published" value={kpis.published} tone="ok" />
      <Tile icon={<Activity className="h-4 w-4" />} label="In review" value={kpis.in_review} tone="info" />
      <Tile icon={<CheckCircle2 className="h-4 w-4" />} label="Pending approval" value={kpis.pending_approval} tone="warn" />
      <Tile icon={<AlertTriangle className="h-4 w-4" />} label="Critical processes" value={kpis.critical_processes} tone="bad" />
      <Tile icon={<ShieldAlert className="h-4 w-4" />} label="≥1 critical risk" value={kpis.processes_with_critical_risk} tone="bad" />
      <Tile icon={<Clock className="h-4 w-4" />} label="Overdue review" value={kpis.overdue_review} tone="warn" />
      <Tile icon={<ShieldCheck className="h-4 w-4" />} label="Framework mapped" value={kpis.processes_with_framework_mapping} tone="ok" />
      <Tile icon={<AlertTriangle className="h-4 w-4" />} label="Open findings" value={kpis.processes_with_open_findings} tone="warn" />
      <Tile icon={<ShieldAlert className="h-4 w-4" />} label="DPIA required" value={kpis.processes_requiring_dpia} tone="bad" />
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "ok" | "warn" | "bad" | "info";
}) {
  const c =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "bad"
          ? "text-red-700"
          : tone === "info"
            ? "text-blue-700"
            : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1 text-xs uppercase text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className={`mt-1 text-2xl font-bold ${c}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
