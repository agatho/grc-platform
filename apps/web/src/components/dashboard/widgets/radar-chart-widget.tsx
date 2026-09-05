"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { WidgetProps } from "../widget-registry";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface RadarDataPoint {
  subject: string;
  value: number;
  fullMark?: number;
}

function parseRadarData(data: unknown): RadarDataPoint[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map((item) => ({
      subject: item.subject ?? item.name ?? item.label ?? item.category ?? "-",
      value: Number(item.value ?? item.score ?? 0),
      fullMark: item.fullMark ?? item.max ?? 100,
    }));
  }
  const d = data as Record<string, unknown>;
  if ("data" in d && Array.isArray(d.data)) return parseRadarData(d.data);
  if ("scores" in d && Array.isArray(d.scores)) return parseRadarData(d.scores);
  return [];
}

export function RadarChartWidget({
  data,
  config,
  isLoading,
  error,
}: WidgetProps) {
  // [ARCTOS-FULL-2026-08-31 · OP-070] Der Leerzustand („Keine Daten
  // verfuegbar") stand in SIEBEN Kachelbausteinen wortgleich und fest
  // verdrahtet im Quelltext — und zwar mit „verfuegbar" statt „verfügbar".
  const t = useTranslations("dashboard.widget");
  // [ARCTOS-FULL-2026-08-31 · OP-070] Das Gebietsschema stand fest auf
  // `de-DE`: der englische Leser sah „1.234,5" statt „1,234.5".
  const locale = useLocale();
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-full w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  const chartData = parseRadarData(data);
  if (chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t("dataUnavailable")}
      </div>
    );
  }

  const color = config?.displayOptions?.color ?? "#3B82F6";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
        <PolarRadiusAxis tick={{ fontSize: 9 }} />
        <Tooltip formatter={(value) => Number(value).toLocaleString(locale)} />
        <Radar
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.2}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
