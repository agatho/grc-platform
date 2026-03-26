"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Calendar, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LifecycleEntity {
  entityId: string;
  entityName: string;
  entityType: string;
  objectType: string;
  phases: {
    id: string;
    entityType: string;
    entityId: string;
    phaseName: string;
    startDate: string;
    endDate: string | null;
    notes: string | null;
  }[];
}

const phaseColorMap: Record<string, string> = {
  planned: "bg-gray-300",
  pilot: "bg-yellow-400",
  active: "bg-green-400",
  migration: "bg-orange-400",
  eol: "bg-red-400",
  retired: "bg-slate-400",
};

export default function LifecycleRoadmapPage() {
  const t = useTranslations("catalogs");
  const [entities, setEntities] = useState<LifecycleEntity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/v1/catalogs/lifecycle-roadmap");
      const json = await res.json();
      setEntities(json.data ?? []);
      setLoading(false);
    })();
  }, []);

  // Compute timeline range
  const allDates = entities.flatMap((e) =>
    e.phases.flatMap((p) => {
      const dates = [new Date(p.startDate).getTime()];
      if (p.endDate) dates.push(new Date(p.endDate).getTime());
      return dates;
    }),
  );

  const minDate = allDates.length > 0 ? Math.min(...allDates) : Date.now();
  const maxDate = allDates.length > 0 ? Math.max(...allDates) : Date.now() + 365 * 86400000;
  const totalRange = Math.max(maxDate - minDate, 86400000 * 30);

  const getBarPosition = (start: string, end: string | null) => {
    const startMs = new Date(start).getTime();
    const endMs = end ? new Date(end).getTime() : maxDate;
    const left = ((startMs - minDate) / totalRange) * 100;
    const width = Math.max(((endMs - startMs) / totalRange) * 100, 1);
    return { left: `${left}%`, width: `${width}%` };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("lifecycle.title")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("lifecycleDescription")}</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white p-3">
        {Object.entries(phaseColorMap).map(([name, color]) => (
          <div key={name} className="flex items-center gap-2">
            <div className={`h-3 w-6 rounded-sm ${color}`} />
            <span className="text-xs text-gray-600 capitalize">
              {t(`lifecycle.${name}`)}
            </span>
          </div>
        ))}
      </div>

      {/* Timeline */}
      {entities.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-sm text-gray-500">{t("lifecycle.noPhases")}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          {/* Header row with time markers */}
          <div className="border-b border-gray-200 px-4 py-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{new Date(minDate).toLocaleDateString("de-DE")}</span>
              <span>
                {new Date((minDate + maxDate) / 2).toLocaleDateString("de-DE")}
              </span>
              <span>{new Date(maxDate).toLocaleDateString("de-DE")}</span>
            </div>
          </div>

          {/* Entities */}
          {entities.map((entity) => (
            <div
              key={entity.entityId}
              className="flex items-center border-b border-gray-100 last:border-b-0"
            >
              {/* Label */}
              <div className="w-48 shrink-0 border-r border-gray-200 px-4 py-3">
                <p className="truncate text-sm font-medium text-gray-900">
                  {entity.entityName}
                </p>
                <Badge variant="outline" className="mt-1 text-xs">
                  {t(`objectTypes.${entity.objectType}`)}
                </Badge>
              </div>

              {/* Bars */}
              <div className="relative flex-1 px-4 py-3" style={{ minHeight: 40 }}>
                {entity.phases.map((phase) => {
                  const pos = getBarPosition(phase.startDate, phase.endDate);
                  return (
                    <div
                      key={phase.id}
                      className={`absolute top-1/2 h-6 -translate-y-1/2 rounded ${phaseColorMap[phase.phaseName] ?? "bg-gray-300"}`}
                      style={{ left: pos.left, width: pos.width }}
                      title={`${t(`lifecycle.${phase.phaseName}`)}: ${phase.startDate} - ${phase.endDate ?? t("lifecycle.ongoing")}`}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white mix-blend-difference">
                        {t(`lifecycle.${phase.phaseName}`)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
