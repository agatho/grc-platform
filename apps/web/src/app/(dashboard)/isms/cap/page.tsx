"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  RefreshCcw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search as SearchIcon,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Nonconformity {
  id: string;
  nc_code: string;
  title: string;
  description: string;
  source_type: string;
  severity: string;
  iso_clause: string;
  status: string;
  due_date: string | null;
  identified_at: string;
  root_cause: string | null;
  action_count: number;
  completed_actions: number;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-900",
  analysis: "bg-orange-100 text-orange-900",
  action_planned: "bg-yellow-100 text-yellow-900",
  in_progress: "bg-blue-100 text-blue-900",
  verification: "bg-purple-100 text-purple-900",
  closed: "bg-green-100 text-green-900",
  reopened: "bg-red-100 text-red-900",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Offen",
  analysis: "Analyse",
  action_planned: "Maßnahme geplant",
  in_progress: "In Bearbeitung",
  verification: "Verifizierung",
  closed: "Geschlossen",
  reopened: "Wiedereröffnet",
};

const SEVERITY_COLORS: Record<string, string> = {
  major: "bg-red-100 text-red-900",
  minor: "bg-yellow-100 text-yellow-900",
  observation: "bg-blue-100 text-blue-900",
};

const SOURCE_LABELS: Record<string, string> = {
  internal_audit: "Internes Audit",
  management_review: "Management Review",
  incident: "Sicherheitsvorfall",
  assessment: "ISMS-Bewertung",
  external_audit: "Externes Audit",
  complaint: "Beschwerde",
};

function CapInner() {
  const router = useRouter();
  const [items, setItems] = useState<Nonconformity[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    sourceType: "internal_audit",
    severity: "minor",
    isoClause: "",
    dueDate: "",
  });
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "50");
      const res = await fetch(`/api/v1/isms/nonconformities?${params}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/v1/isms/nonconformities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setDialogOpen(false);
        setForm({
          title: "",
          description: "",
          sourceType: "internal_audit",
          severity: "minor",
          isoClause: "",
          dueDate: "",
        });
        await fetchData();
      }
    } finally {
      setCreating(false);
    }
  };

  const openCount = items.filter((i) => i.status !== "closed").length;
  const overdueCount = items.filter(
    (i) =>
      i.due_date && new Date(i.due_date) < new Date() && i.status !== "closed",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Korrekturmaßnahmen (CAP)</h1>
          <p className="text-muted-foreground">
            ISO 27001 Kap. 10 — Nichtkonformitäten und Korrekturmaßnahmen
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus size={14} className="mr-1" /> Nichtkonformität melden
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Neue Nichtkonformität</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Titel</Label>
                  <Input
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                    placeholder="Kurzbeschreibung der Abweichung"
                  />
                </div>
                <div>
                  <Label>Beschreibung</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Quelle</Label>
                    <Select
                      value={form.sourceType}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, sourceType: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Schweregrad</Label>
                    <Select
                      value={form.severity}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, severity: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="major">Wesentlich</SelectItem>
                        <SelectItem value="minor">Geringfügig</SelectItem>
                        <SelectItem value="observation">Beobachtung</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>ISO-Klausel (optional)</Label>
                    <Input
                      value={form.isoClause}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, isoClause: e.target.value }))
                      }
                      placeholder="z.B. A.8.24"
                    />
                  </div>
                  <div>
                    <Label>Frist</Label>
                    <Input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, dueDate: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={!form.title || creating}
                  className="w-full"
                >
                  {creating && (
                    <Loader2 size={14} className="mr-2 animate-spin" />
                  )}
                  Nichtkonformität erstellen
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Offen</div>
          <div className="text-2xl font-bold text-red-600">{openCount}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock size={12} /> Überfällig
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {overdueCount}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <CheckCircle size={12} /> Geschlossen
          </div>
          <div className="text-2xl font-bold text-green-600">
            {items.filter((i) => i.status === "closed").length}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["", "open", "in_progress", "verification", "closed"].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s === "" ? "Alle" : STATUS_LABELS[s] || s}
          </Button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="h-12 w-12 mx-auto text-green-400 mb-4" />
          <h3 className="text-lg font-medium">Keine Nichtkonformitäten</h3>
          <p className="text-muted-foreground mt-1">
            Alle Anforderungen werden erfüllt
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((nc) => (
            <div
              key={nc.id}
              className="rounded-lg border p-4 hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/isms/cap/${nc.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    size={18}
                    className={
                      nc.severity === "major"
                        ? "text-red-500"
                        : "text-yellow-500"
                    }
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {nc.nc_code}
                      </span>
                      <span className="font-medium">{nc.title}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>
                        {SOURCE_LABELS[nc.source_type] || nc.source_type}
                      </span>
                      {nc.iso_clause && (
                        <span className="font-mono">{nc.iso_clause}</span>
                      )}
                      <span>
                        {nc.action_count} Maßnahmen ({nc.completed_actions}{" "}
                        abgeschlossen)
                      </span>
                      {nc.due_date && (
                        <span
                          className={
                            new Date(nc.due_date) < new Date() &&
                            nc.status !== "closed"
                              ? "text-red-500 font-medium"
                              : ""
                          }
                        >
                          Frist:{" "}
                          {new Date(nc.due_date).toLocaleDateString("de-DE")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    className={SEVERITY_COLORS[nc.severity] || "bg-gray-100"}
                  >
                    {nc.severity === "major"
                      ? "Wesentlich"
                      : nc.severity === "minor"
                        ? "Geringfügig"
                        : "Beobachtung"}
                  </Badge>
                  <Badge className={STATUS_COLORS[nc.status] || "bg-gray-100"}>
                    {STATUS_LABELS[nc.status] || nc.status}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IsmsCapPage() {
  return (
    <ModuleGate moduleKey="isms">
      <ModuleTabNav />
      <CapInner />
    </ModuleGate>
  );
}
