"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Search,
  Plus,
  RefreshCcw,
  AlertTriangle,
  Clock,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { IncidentSeverityBadge } from "@/components/isms/incident-severity-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  SecurityIncident,
  IncidentSeverity,
  IncidentStatus,
} from "@grc/shared";

const SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"];
const STATUSES: IncidentStatus[] = [
  "detected",
  "triaged",
  "contained",
  "eradicated",
  "recovered",
  "lessons_learned",
  "closed",
];

function hoursRemaining(deadline: string): number {
  return Math.max(
    0,
    (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60),
  );
}

export default function IncidentsPage() {
  return (
    <ModuleGate moduleKey="isms">
      <ModuleTabNav />
      <IncidentsInner />
    </ModuleGate>
  );
}

function IncidentsInner() {
  const t = useTranslations("isms");
  const router = useRouter();
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/isms/incidents?limit=500");
      if (res.ok) {
        const json = await res.json();
        setIncidents(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchIncidents();
  }, [fetchIncidents]);

  const filtered = useMemo(() => {
    let result = incidents;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (inc) =>
          inc.title.toLowerCase().includes(q) ||
          inc.elementId.toLowerCase().includes(q),
      );
    }
    if (severityFilter !== "__all__") {
      result = result.filter((inc) => inc.severity === severityFilter);
    }
    if (statusFilter !== "__all__") {
      result = result.filter((inc) => inc.status === statusFilter);
    }
    return result;
  }, [incidents, search, severityFilter, statusFilter]);

  if (loading && incidents.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">{t("incidents")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {incidents.length} {t("total")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchIncidents}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={() => router.push("/isms/incidents/new")}>
            <Plus size={16} /> {t("createIncident")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchIncidents")}
            className="h-8 w-48 rounded-md border border-gray-300 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder={t("severity")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allSeverities")}</SelectItem>
            {SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`incidentSeverity.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder={t("status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allStatuses")}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`incidentStatus.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
            <AlertTriangle size={28} className="text-gray-400 mb-3" />
            <p className="text-sm text-gray-500">{t("noIncidents")}</p>
          </div>
        ) : (
          filtered.map((inc) => {
            const hrs = inc.dataBreachDeadline
              ? hoursRemaining(inc.dataBreachDeadline)
              : null;
            return (
              <Link
                key={inc.id}
                href={`/isms/incidents/${inc.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-gray-400 shrink-0">
                    {inc.elementId}
                  </span>
                  <span className="text-sm font-medium text-blue-700 hover:text-blue-900 truncate">
                    {inc.title}
                  </span>
                  {inc.isDataBreach && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
                        hrs !== null && hrs < 24
                          ? "bg-red-100 text-red-900 border-red-300"
                          : "bg-yellow-100 text-yellow-900 border-yellow-300"
                      }`}
                    >
                      <Clock size={10} className="mr-0.5" />
                      {hrs !== null ? `${Math.floor(hrs)}h` : ""}{" "}
                      {t("breach72h")}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <IncidentSeverityBadge severity={inc.severity} />
                  <Badge variant="outline" className="text-[10px]">
                    {t(`incidentStatus.${inc.status}`)}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {new Date(inc.detectedAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
