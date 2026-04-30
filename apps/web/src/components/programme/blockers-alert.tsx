"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface BlockerStep {
  id: string;
  code: string;
  name: string;
  status: string;
  blockReason?: string | null;
  dueDate?: string | null;
}

interface BlockersResponse {
  data: {
    blocked: BlockerStep[];
    overdue: BlockerStep[];
    summary: {
      blockedCount: number;
      overdueCount: number;
    };
  };
}

interface Props {
  journeyId: string;
}

export function BlockersAlert({ journeyId }: Props) {
  const t = useTranslations("programme");
  const [data, setData] = useState<BlockersResponse["data"] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/v1/programmes/journeys/${journeyId}/blockers`);
        if (!r.ok) return;
        const json = (await r.json()) as BlockersResponse;
        if (!cancelled) setData(json.data);
      } catch {
        /* swallow */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [journeyId]);

  if (!data) return null;
  if (data.summary.blockedCount === 0 && data.summary.overdueCount === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-5 text-red-600" />
        <h3 className="font-semibold text-red-900 dark:text-red-100">
          {t("blockers.title")}
        </h3>
      </div>
      <p className="mt-1 text-sm text-red-800 dark:text-red-200">
        {t("blockers.summary", {
          blocked: data.summary.blockedCount,
          overdue: data.summary.overdueCount,
        })}
      </p>
      {data.blocked.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold uppercase text-red-700 dark:text-red-300">
            {t("blockers.blockedHeading")}
          </h4>
          <ul className="mt-1 space-y-1">
            {data.blocked.slice(0, 3).map((s) => (
              <li key={s.id} className="text-sm">
                <Link
                  href={`/programmes/${journeyId}/steps/${s.id}`}
                  className="font-medium text-red-900 hover:underline dark:text-red-100"
                >
                  {s.name}
                </Link>
                {s.blockReason && (
                  <span className="ml-2 text-red-700 dark:text-red-300">
                    — {s.blockReason}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.overdue.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold uppercase text-red-700 dark:text-red-300">
            {t("blockers.overdueHeading")}
          </h4>
          <ul className="mt-1 space-y-1">
            {data.overdue.slice(0, 3).map((s) => (
              <li key={s.id} className="text-sm">
                <Link
                  href={`/programmes/${journeyId}/steps/${s.id}`}
                  className="text-red-900 hover:underline dark:text-red-100"
                >
                  {s.name}
                </Link>
                {s.dueDate && (
                  <span className="ml-2 text-xs font-mono text-red-700 dark:text-red-300">
                    ({s.dueDate})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
