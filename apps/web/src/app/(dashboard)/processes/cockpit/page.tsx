"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CockpitData {
  stats: {
    draft: number;
    in_review: number;
    approved: number;
    published: number;
    archived: number;
    critical_processes: number;
    total: number;
  };
  quadrants: {
    inReview: any[];
    pendingApproval: any[];
    overdueReview: any[];
    criticalRisks: any[];
  };
}

export default function CockpitPage() {
  const t = useTranslations("bpmOverhaul");
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  const reload = async () => {
    setLoading(true);
    const resp = await fetch(`/api/v1/processes/cockpit`);
    if (resp.ok) {
      const j = await resp.json();
      setData(j.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkApprove = async (targetStatus: "approved" | "published") => {
    if (selected.size === 0) {
      toast.error("Select at least one process");
      return;
    }
    setBulkPending(true);
    try {
      const resp = await fetch(`/api/v1/processes/bulk-approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          processIds: Array.from(selected),
          targetStatus,
          signoffType: targetStatus === "published" ? "publish" : "approval",
          signerRole: "quality_manager",
        }),
      });
      if (resp.ok) {
        const j = await resp.json();
        toast.success(
          `${j.data.successful}/${j.data.total} ${targetStatus} ` +
            (j.data.skipped ? `(${j.data.skipped} blocked)` : ""),
        );
        setSelected(new Set());
        await reload();
      } else {
        const e = await resp.json().catch(() => ({}));
        toast.error(e.error ?? "Bulk-approve failed");
      }
    } finally {
      setBulkPending(false);
    }
  };

  return (
    <ModuleGate moduleKey="bpm">
      <div className="space-y-4 p-4">
        <div>
          <h1 className="text-2xl font-bold">{t("cockpit.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("cockpit.subtitle")}</p>
        </div>

        {loading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard label="Total" value={data.stats.total} />
              <StatCard label="Draft" value={data.stats.draft} />
              <StatCard label="In Review" value={data.stats.in_review} tone="info" />
              <StatCard label="Approved" value={data.stats.approved} tone="warn" />
              <StatCard label="Published" value={data.stats.published} tone="ok" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Quadrant
                title={t("cockpit.inReview")}
                icon={<Activity className="h-5 w-5 text-blue-600" />}
                rows={data.quadrants.inReview}
                renderRow={(r) => (
                  <>
                    <strong>{r.name}</strong>
                    <div className="text-xs text-muted-foreground">
                      Owner: {r.owner_name ?? "—"} · Reviewer: {r.reviewer_name ?? "—"}
                    </div>
                  </>
                )}
              />
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CheckCircle2 className="h-5 w-5 text-amber-600" />
                      Pending Approval (Quality Manager)
                    </CardTitle>
                    <CardDescription>
                      {data.quadrants.pendingApproval.length} item(s)
                      {selected.size > 0 && ` · ${selected.size} selected`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={selected.size === 0 || bulkPending}
                      onClick={() => bulkApprove("published")}
                    >
                      Bulk publish
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {data.quadrants.pendingApproval.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground">
                      Nothing pending.
                    </p>
                  ) : (
                    <ul className="max-h-96 space-y-1 overflow-auto">
                      {data.quadrants.pendingApproval.slice(0, 25).map((r: any) => (
                        <li key={r.id} className="flex items-start gap-2 rounded p-2 hover:bg-muted">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={selected.has(r.id)}
                            onChange={() => toggleSelect(r.id)}
                          />
                          <Link href={`/processes/${r.id}`} className="flex-1 block">
                            <strong>{r.name}</strong>
                            <div className="text-xs text-muted-foreground">
                              Owner: {r.owner_name ?? "—"}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <Quadrant
                title={t("cockpit.overdueReview")}
                icon={<Clock className="h-5 w-5 text-red-600" />}
                rows={data.quadrants.overdueReview}
                renderRow={(r) => (
                  <>
                    <strong>{r.name}</strong>
                    <div className="text-xs text-muted-foreground">
                      Owner: {r.owner_name ?? "—"} · Due:{" "}
                      {r.review_date ? new Date(r.review_date).toLocaleDateString() : "—"}
                    </div>
                  </>
                )}
              />
              <Quadrant
                title={t("cockpit.criticalRisks")}
                icon={<ShieldAlert className="h-5 w-5 text-red-600" />}
                rows={data.quadrants.criticalRisks}
                renderRow={(r) => (
                  <>
                    <strong>{r.name}</strong>
                    <Badge className="ml-2 bg-red-600 text-white">
                      {r.critical_count} critical
                    </Badge>
                  </>
                )}
              />
            </div>
          </>
        )}
      </div>
    </ModuleGate>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "info" | "warn" | "ok";
}) {
  const color =
    tone === "info"
      ? "text-blue-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "ok"
          ? "text-emerald-700"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className={`text-3xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Quadrant({
  title,
  icon,
  rows,
  renderRow,
}: {
  title: string;
  icon: React.ReactNode;
  rows: any[];
  renderRow: (r: any) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{rows.length} item(s)</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Nothing here. </p>
        ) : (
          <ul className="max-h-96 space-y-1 overflow-auto">
            {rows.slice(0, 25).map((r, i) => (
              <li key={i} className="rounded p-2 hover:bg-muted">
                <Link href={`/processes/${r.id}`} className="block">
                  {renderRow(r)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
