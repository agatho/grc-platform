"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { NextActionItem } from "@grc/shared";
import { Loader2 } from "lucide-react";

interface Props {
  journeyId: string;
  limit?: number;
}

export function NextActionsWidget({ journeyId, limit = 5 }: Props) {
  const t = useTranslations("programme");
  const [actions, setActions] = useState<NextActionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/v1/programmes/journeys/${journeyId}/next-actions?limit=${limit}`,
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        if (!cancelled) setActions(json.data ?? []);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [journeyId, limit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("nextActions.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-red-600">
            {t("nextActions.errorPrefix")}: {error}
          </p>
        )}
        {actions == null && !error && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> {t("loading")}
          </div>
        )}
        {actions && actions.length === 0 && (
          <p className="text-sm text-slate-500">{t("nextActions.empty")}</p>
        )}
        {actions && actions.length > 0 && (
          <ol className="space-y-2">
            {actions.map((a, idx) => (
              <li
                key={a.stepId}
                className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-slate-500">
                      #{idx + 1}
                    </span>
                    <Link
                      href={`/programmes/${journeyId}/steps/${a.stepId}`}
                      className="font-medium hover:underline"
                    >
                      {a.name}
                    </Link>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono">{a.code}</span>
                    <Badge variant="outline" className="text-xs">
                      {t(`nextActions.reason.${a.reason}`)}
                    </Badge>
                    {a.dueInDays != null && (
                      <span
                        className={
                          a.dueInDays < 0 ? "text-red-600 font-medium" : ""
                        }
                      >
                        {a.dueInDays < 0
                          ? t("nextActions.overdueDays", {
                              days: Math.abs(a.dueInDays),
                            })
                          : t("nextActions.dueInDays", { days: a.dueInDays })}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
