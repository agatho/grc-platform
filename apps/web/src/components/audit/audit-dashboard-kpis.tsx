"use client";

import { useEffect, useState } from "react";
import {
  ClipboardCheck,
  Activity,
  Clock,
  AlertOctagon,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Database,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface Kpis {
  total_audits: number;
  planned: number;
  in_progress: number;
  pending_close: number;
  completed: number;
  overdue: number;
  open: number;
  open_critical: number;
  open_high: number;
  overdue_remediation: number;
  total_universe: number;
  overdue_audit_cycle: number;
}

export function AuditDashboardKpis() {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const resp = await fetch(`/api/v1/dashboard/audit-kpis`);
      if (resp.ok && !cancel) setKpis((await resp.json()).data);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  if (!kpis) return null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
      <Tile
        icon={<Database className="h-4 w-4" />}
        label="Audits total"
        value={kpis.total_audits}
      />
      <Tile
        icon={<ClipboardCheck className="h-4 w-4" />}
        label="Planned"
        value={kpis.planned}
      />
      <Tile
        icon={<Activity className="h-4 w-4" />}
        label="In progress"
        value={kpis.in_progress}
        tone="info"
      />
      <Tile
        icon={<Clock className="h-4 w-4" />}
        label="Pending close"
        value={kpis.pending_close}
        tone="warn"
      />
      <Tile
        icon={<CheckCircle2 className="h-4 w-4" />}
        label="Completed"
        value={kpis.completed}
        tone="ok"
      />
      <Tile
        icon={<AlertTriangle className="h-4 w-4" />}
        label="Overdue"
        value={kpis.overdue}
        tone="bad"
      />
      <Tile
        icon={<AlertOctagon className="h-4 w-4" />}
        label="Open findings"
        value={kpis.open}
        tone="warn"
      />
      <Tile
        icon={<ShieldAlert className="h-4 w-4" />}
        label="Open critical"
        value={kpis.open_critical}
        tone="bad"
      />
      <Tile
        icon={<AlertTriangle className="h-4 w-4" />}
        label="Open high"
        value={kpis.open_high}
        tone="warn"
      />
      <Tile
        icon={<Clock className="h-4 w-4" />}
        label="Remediation overdue"
        value={kpis.overdue_remediation}
        tone="bad"
      />
      <Tile
        icon={<Database className="h-4 w-4" />}
        label="Universe entries"
        value={kpis.total_universe}
      />
      <Tile
        icon={<Clock className="h-4 w-4" />}
        label="Audit-cycle overdue"
        value={kpis.overdue_audit_cycle}
        tone="bad"
      />
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
