"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search, Plus, RefreshCcw, Bug, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Vulnerability } from "@grc/shared";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

const severityStyles: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 border-gray-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  critical: "bg-red-100 text-red-800 border-red-200",
};

export default function VulnerabilitiesPage() {
  return (
    <ModuleGate moduleKey="isms">
      <VulnerabilitiesInner />
    </ModuleGate>
  );
}

function VulnerabilitiesInner() {
  const t = useTranslations("isms");
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("__all__");
  const [showCreate, setShowCreate] = useState(false);

  const fetchVulns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/isms/vulnerabilities?limit=500");
      if (res.ok) {
        const json = await res.json();
        setVulns(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchVulns();
  }, [fetchVulns]);

  const filtered = useMemo(() => {
    let result = vulns;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.cveReference?.toLowerCase().includes(q),
      );
    }
    if (severityFilter !== "__all__") {
      result = result.filter((v) => v.severity === severityFilter);
    }
    return result;
  }, [vulns, search, severityFilter]);

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/v1/isms/vulnerabilities/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("deleted"));
      setVulns((prev) => prev.filter((v) => v.id !== id));
    }
  }, [t]);

  if (loading && vulns.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">{t("vulnerabilities")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {vulns.length} {t("total")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchVulns} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus size={16} /> {t("createVulnerability")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("createVulnerability")}</DialogTitle>
              </DialogHeader>
              <CreateVulnForm
                t={t}
                onSuccess={() => {
                  setShowCreate(false);
                  fetchVulns();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchVulnerabilities")}
            className="h-8 w-48 rounded-md border border-gray-300 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder={t("filterSeverity")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allSeverities")}</SelectItem>
            {SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>{t(`incidentSeverity.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
            <Bug size={28} className="text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">{t("noVulnerabilities")}</p>
          </div>
        ) : (
          filtered.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Bug size={16} className="text-orange-600 shrink-0" />
                <span className="text-sm font-medium text-gray-900 truncate">{v.title}</span>
                {v.cveReference && (
                  <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                    {v.cveReference}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${severityStyles[v.severity] ?? ""}`}
                >
                  {t(`incidentSeverity.${v.severity}`)}
                </Badge>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {v.status}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(v.id)}>
                <Trash2 size={14} className="text-gray-400" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CreateVulnForm({
  t,
  onSuccess,
}: {
  t: ReturnType<typeof useTranslations>;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cveReference, setCveReference] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/isms/vulnerabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          cveReference: cveReference || undefined,
          severity,
        }),
      });
      if (res.ok) {
        toast.success(t("created"));
        onSuccess();
      } else {
        toast.error(t("createError"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t("titleField")}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t("description")}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">CVE Reference</label>
        <input
          type="text"
          value={cveReference}
          onChange={(e) => setCveReference(e.target.value)}
          placeholder="CVE-2024-12345"
          className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t("severity")}</label>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{t(`incidentSeverity.${s}`)}</option>
          ))}
        </select>
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
        {t("createVulnerability")}
      </Button>
    </form>
  );
}
