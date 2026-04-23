"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ClipboardCheck,
  Clock,
  FileWarning,
  ListChecks,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// AuditQuickStatsBar
// Zeigt die wichtigsten Audit-KPIs, die das 3rd-Line-Team täglich braucht.
// Quelle: /api/v1/dashboard/audit-quick-stats (Task 9 der Overnight-Session).
//
// Placement: oben auf /audit/executions (und ggf. Dashboard-Widget).
// ─────────────────────────────────────────────────────────────

interface QuickStats {
  openAudits: number;
  openNonconformities: number;
  overdueRemediations: number;
  openFindings: number;
  dueSoonFindings: number;
  today: string;
}

export function AuditQuickStatsBar({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/dashboard/audit-quick-stats");
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setStats(json.data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        className={`rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-400 ${className}`}
      >
        Lade Audit-Kennzahlen…
      </div>
    );
  }
  if (!stats) return null;

  const total =
    stats.openAudits +
    stats.openFindings +
    stats.overdueRemediations +
    stats.openNonconformities +
    stats.dueSoonFindings;
  if (total === 0) {
    return (
      <div
        className={`rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 ${className}`}
      >
        ✓ Keine offenen Audits oder überfälligen Korrekturen.
      </div>
    );
  }

  const pill = (
    href: string,
    icon: React.ReactNode,
    count: number,
    label: string,
    color: string,
    urgent = false,
  ) => (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-all hover:shadow-sm ${color} ${
        urgent ? "ring-2 ring-offset-1 ring-red-300" : ""
      }`}
    >
      {icon}
      <span className="font-semibold">{count}</span>
      <span className="text-[11px]">{label}</span>
    </Link>
  );

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
      role="region"
      aria-label="Audit-Schnellkennzahlen"
    >
      {!compact && (
        <span className="text-[11px] font-semibold text-gray-500 mr-1">
          AUDIT-KPI:
        </span>
      )}
      {stats.openAudits > 0 &&
        pill(
          "/audit/executions",
          <ClipboardCheck size={14} />,
          stats.openAudits,
          "offene Audits",
          "bg-blue-50 text-blue-900 border-blue-200",
        )}
      {stats.openNonconformities > 0 &&
        pill(
          "/audit/executions",
          <FileWarning size={14} />,
          stats.openNonconformities,
          "Abweichungen",
          "bg-orange-50 text-orange-900 border-orange-200",
        )}
      {stats.openFindings > 0 &&
        pill(
          "/audit/findings",
          <ListChecks size={14} />,
          stats.openFindings,
          "Findings offen",
          "bg-amber-50 text-amber-900 border-amber-200",
        )}
      {stats.overdueRemediations > 0 &&
        pill(
          "/audit/executions",
          <AlertTriangle size={14} />,
          stats.overdueRemediations,
          "Korrekturen überfällig",
          "bg-red-50 text-red-900 border-red-300",
          true,
        )}
      {stats.dueSoonFindings > 0 &&
        pill(
          "/audit/findings",
          <Clock size={14} />,
          stats.dueSoonFindings,
          "≤30 Tage fällig",
          "bg-yellow-50 text-yellow-900 border-yellow-200",
        )}
    </div>
  );
}
