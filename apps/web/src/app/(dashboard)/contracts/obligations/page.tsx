"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  ClipboardCheck,
  RefreshCcw,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ObligationRow {
  id: string;
  contractId: string;
  title: string;
  obligationType: string;
  dueDate?: string;
  status: string;
  responsibleName?: string;
  recurring: boolean;
  contractTitle?: string;
}

const OBL_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};

const STATUSES = ["pending", "in_progress", "completed", "overdue"] as const;

export default function ObligationsQueuePage() {
  return (
    <ModuleGate moduleKey="contract">
      <ObligationsQueueInner />
    </ModuleGate>
  );
}

function ObligationsQueueInner() {
  const t = useTranslations("contracts");
  const [obligations, setObligations] = useState<ObligationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("__all__");

  const fetchObligations = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all contracts, then obligations for each
      const cRes = await fetch("/api/v1/contracts?limit=200&status=active,renewal");
      if (!cRes.ok) return;
      const cJson = await cRes.json();
      const contracts = cJson.data ?? [];

      const allObls: ObligationRow[] = [];
      for (const c of contracts) {
        try {
          const oRes = await fetch(`/api/v1/contracts/${c.id}/obligations`);
          if (oRes.ok) {
            const oJson = await oRes.json();
            for (const o of oJson.data ?? []) {
              allObls.push({ ...o, contractTitle: c.title });
            }
          }
        } catch {
          /* ignore */
        }
      }

      // Sort by due date ascending
      allObls.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });

      setObligations(allObls);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchObligations();
  }, [fetchObligations]);

  const filtered = useMemo(() => {
    if (statusFilter === "__all__") return obligations;
    return obligations.filter((o) => o.status === statusFilter);
  }, [obligations, statusFilter]);

  if (loading && obligations.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">{t("obligationsQueue")}</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} {t("obligations")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("filter.allStatuses")}</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{t(`oblStatus.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchObligations} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <ClipboardCheck size={28} className="text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-500">{t("obligation.none")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <Link
              key={o.id}
              href={`/contracts/${o.contractId}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {o.status === "overdue" && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{o.title}</p>
                  <p className="text-xs text-gray-500 truncate">{o.contractTitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <Badge variant="outline" className="text-xs">{o.obligationType}</Badge>
                <Badge variant="outline" className={`text-xs ${OBL_STATUS_COLORS[o.status] ?? ""}`}>
                  {t(`oblStatus.${o.status}`)}
                </Badge>
                <span className={`text-xs ${o.status === "overdue" ? "text-red-600 font-medium" : "text-gray-500"}`}>
                  {o.dueDate ?? "\u2014"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
