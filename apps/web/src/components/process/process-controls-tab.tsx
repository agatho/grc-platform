"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Unlink, ShieldCheck } from "lucide-react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Control {
  id: string;
  title: string;
  status: string;
  controlType?: string;
  description?: string | null;
}

interface ProcessControlLink {
  linkId: string;
  controlId: string;
  title: string;
  status: string;
  controlType?: string;
  controlContext?: string | null;
  createdAt?: string;
}

interface CoverageSummary {
  totalActivities: number;
  activitiesWithoutControl: number;
  coveragePct: number;
  totalControls: number;
  effectiveCount: number;
  effectivenessAvgPct: number;
}

const statusColor: Record<string, string> = {
  effective: "bg-emerald-100 text-emerald-800",
  implemented: "bg-blue-100 text-blue-800",
  designed: "bg-amber-100 text-amber-800",
  ineffective: "bg-red-100 text-red-800",
  retired: "bg-gray-100 text-gray-800",
};

export function ProcessControlsTab({ processId }: { processId: string }) {
  const [links, setLinks] = useState<ProcessControlLink[]>([]);
  const [summary, setSummary] = useState<CoverageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [available, setAvailable] = useState<Control[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [linking, setLinking] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [linksResp, coverageResp] = await Promise.all([
        fetch(`/api/v1/processes/${processId}/controls`),
        fetch(`/api/v1/processes/${processId}/control-coverage`),
      ]);
      if (linksResp.ok) {
        const j = await linksResp.json();
        setLinks(j.data ?? []);
      }
      if (coverageResp.ok) {
        const j = await coverageResp.json();
        setSummary(j.data?.summary ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const openPicker = useCallback(async () => {
    setPickerOpen(true);
    const resp = await fetch(`/api/v1/controls?limit=200`);
    if (resp.ok) {
      const j = await resp.json();
      setAvailable(j.data ?? []);
    }
  }, []);

  const submit = useCallback(async () => {
    if (selected.size === 0) return;
    setLinking(true);
    try {
      const resp = await fetch(
        `/api/v1/processes/${processId}/controls/bulk-link`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ controlIds: Array.from(selected) }),
        },
      );
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error ?? "Bulk-link failed");
      }
      const j = await resp.json();
      toast.success(
        `Linked ${j.data?.created ?? 0} control(s)` +
          (j.data?.skippedDuplicates
            ? ` (${j.data.skippedDuplicates} duplicate)`
            : ""),
      );
      setSelected(new Set());
      setPickerOpen(false);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLinking(false);
    }
  }, [processId, selected, reload]);

  const unlink = useCallback(
    async (linkId: string) => {
      const resp = await fetch(
        `/api/v1/processes/${processId}/controls/${linkId}`,
        {
          method: "DELETE",
        },
      );
      if (resp.ok) {
        toast.success("Control unlinked");
        reload();
      } else {
        toast.error("Unlink failed");
      }
    },
    [processId, reload],
  );

  const filtered = available.filter(
    (c) => !search || c.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Coverage" value={`${summary.coveragePct}%`} />
            <Stat
              label="Activities w/o Control"
              value={String(summary.activitiesWithoutControl)}
              tone={summary.activitiesWithoutControl > 0 ? "warn" : "ok"}
            />
            <Stat
              label="Total Controls"
              value={String(summary.totalControls)}
            />
            <Stat
              label="Effectiveness"
              value={`${summary.effectivenessAvgPct}%`}
              tone={summary.effectivenessAvgPct >= 70 ? "ok" : "warn"}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Linked Controls</CardTitle>
            <CardDescription>
              {links.length} control(s) at process level
            </CardDescription>
          </div>
          <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openPicker}>
                <Plus className="mr-2 h-4 w-4" /> Link Controls
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Link controls to this process</DialogTitle>
              </DialogHeader>
              <Input
                placeholder="Search controls…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="max-h-96 space-y-1 overflow-auto rounded border p-2">
                {filtered.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(c.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(c.id);
                        else next.delete(c.id);
                        setSelected(next);
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{c.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.controlType} ·{" "}
                        <span className={statusColor[c.status]}>
                          {c.status}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
                {filtered.length === 0 && (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    No controls found.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={submit}
                  disabled={selected.size === 0 || linking}
                >
                  {linking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Link {selected.size} control(s)
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          ) : links.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No controls linked yet.
            </p>
          ) : (
            <ul className="divide-y">
              {links.map((l) => (
                <li
                  key={l.linkId}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex-1">
                    <Link
                      href={`/controls/${l.controlId}`}
                      className="font-medium hover:underline"
                    >
                      {l.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      <Badge
                        variant="outline"
                        className={statusColor[l.status]}
                      >
                        {l.status}
                      </Badge>{" "}
                      {l.controlType ?? ""}
                      {l.controlContext ? ` — ${l.controlContext}` : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => unlink(l.linkId)}
                  >
                    <Unlink className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          tone === "warn"
            ? "text-2xl font-semibold text-amber-600"
            : tone === "ok"
              ? "text-2xl font-semibold text-emerald-600"
              : "text-2xl font-semibold"
        }
      >
        {value}
      </div>
    </div>
  );
}
