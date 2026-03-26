"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Plus,
  RefreshCcw,
  AlertTriangle,
  Search,
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
import type { AuditUniverseEntry } from "@grc/shared";

export default function UniversePage() {
  return (
    <ModuleGate moduleKey="audit">
      <UniverseInner />
    </ModuleGate>
  );
}

function UniverseInner() {
  const t = useTranslations("auditMgmt");
  const [entries, setEntries] = useState<AuditUniverseEntry[]>([]);
  const [gaps, setGaps] = useState({ neverAudited: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [gapFilter, setGapFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (entityTypeFilter) params.set("entityType", entityTypeFilter);
      if (gapFilter) params.set("gap", gapFilter);
      params.set("limit", "50");

      const res = await fetch(`/api/v1/audit-mgmt/universe?${params}`);
      if (res.ok) {
        const json = await res.json();
        setEntries(json.data ?? []);
        setGaps(json.gaps ?? { neverAudited: 0, overdue: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [search, entityTypeFilter, gapFilter]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  const handleCreate = async (formData: FormData) => {
    const body = {
      name: formData.get("name") as string,
      entityType: formData.get("entityType") as string,
      riskScore: formData.get("riskScore") ? Number(formData.get("riskScore")) : undefined,
      auditCycleMonths: formData.get("auditCycleMonths") ? Number(formData.get("auditCycleMonths")) : 12,
      notes: formData.get("notes") as string || undefined,
    };

    const res = await fetch("/api/v1/audit-mgmt/universe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setDialogOpen(false);
      void fetchEntries();
    }
  };

  const riskBadge = (score: number | null | undefined) => {
    if (score == null) return <Badge variant="outline">-</Badge>;
    if (score >= 16) return <Badge variant="destructive">{score}</Badge>;
    if (score >= 8) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">{score}</Badge>;
    return <Badge className="bg-green-100 text-green-800 border-green-300">{score}</Badge>;
  };

  const gapBadge = (entry: AuditUniverseEntry) => {
    if (!entry.lastAuditDate) {
      return <Badge variant="destructive">{t("neverAudited")}</Badge>;
    }
    if (entry.nextAuditDue) {
      const today = new Date().toISOString().split("T")[0];
      if (entry.nextAuditDue <= today) {
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300">{t("overdueLabel")}</Badge>;
      }
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("universe")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("universeSubtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchEntries} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus size={14} className="mr-1" />
                {t("addEntry")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("addEntry")}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleCreate(new FormData(e.currentTarget));
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-sm font-medium">{t("name")}</label>
                  <Input name="name" required />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("entityType")}</label>
                  <select name="entityType" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="process">{t("entityTypes.process")}</option>
                    <option value="department">{t("entityTypes.department")}</option>
                    <option value="it_system">{t("entityTypes.itSystem")}</option>
                    <option value="vendor">{t("entityTypes.vendor")}</option>
                    <option value="custom">{t("entityTypes.custom")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">{t("riskScore")}</label>
                  <Input name="riskScore" type="number" min="0" max="100" />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("auditCycle")}</label>
                  <Input name="auditCycleMonths" type="number" min="1" max="120" defaultValue="12" />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("notes")}</label>
                  <Input name="notes" />
                </div>
                <Button type="submit" className="w-full">{t("save")}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Gap Banner */}
      {(gaps.neverAudited > 0 || gaps.overdue > 0) && (
        <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <span className="text-sm text-orange-800">
              {gaps.neverAudited > 0 && (
                <span className="font-semibold">{gaps.neverAudited} {t("neverAuditedEntities")}. </span>
              )}
              {gaps.overdue > 0 && (
                <span className="font-semibold">{gaps.overdue} {t("overdueEntities")}.</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={entityTypeFilter}
          onChange={(e) => setEntityTypeFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">{t("allTypes")}</option>
          <option value="process">{t("entityTypes.process")}</option>
          <option value="department">{t("entityTypes.department")}</option>
          <option value="it_system">{t("entityTypes.itSystem")}</option>
          <option value="vendor">{t("entityTypes.vendor")}</option>
          <option value="custom">{t("entityTypes.custom")}</option>
        </select>
        <select
          value={gapFilter}
          onChange={(e) => setGapFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">{t("allGaps")}</option>
          <option value="never_audited">{t("neverAudited")}</option>
          <option value="overdue">{t("overdueLabel")}</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t("emptyUniverse")}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("name")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("entityType")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("riskScore")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("lastAudit")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("nextAuditDue")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("cycle")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("gap")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{entry.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {t(`entityTypes.${entry.entityType === "it_system" ? "itSystem" : entry.entityType}`)}
                  </td>
                  <td className="px-4 py-3">{riskBadge(entry.riskScore)}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.lastAuditDate ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.nextAuditDue ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.auditCycleMonths} {t("months")}</td>
                  <td className="px-4 py-3">{gapBadge(entry)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
