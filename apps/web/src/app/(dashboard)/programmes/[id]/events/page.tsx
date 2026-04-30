"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";

interface EventRow {
  id: string;
  eventType: string;
  occurredAt: string;
  actorId: string | null;
  payload: Record<string, unknown>;
  stepId: string | null;
}

export default function EventsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("programme");
  const [events, setEvents] = useState<EventRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(
        `/api/v1/programmes/journeys/${id}/events?limit=200`,
      );
      if (r.ok) {
        const json = await r.json();
        if (!cancelled) setEvents(json.data ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <ModuleGate moduleKey="programme">
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <Link
          href={`/programmes/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t("step.backToCockpit")}
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>{t("events.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {events == null && (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="size-4 animate-spin" /> {t("loading")}
              </div>
            )}
            {events && events.length === 0 && (
              <p className="text-sm text-slate-500">{t("events.empty")}</p>
            )}
            {events && events.length > 0 && (
              <ol className="space-y-2">
                {events.map((e) => (
                  <li
                    key={e.id}
                    className="rounded border border-slate-200 p-3 text-sm dark:border-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-slate-500">
                        {new Date(e.occurredAt).toLocaleString()}
                      </span>
                      <span className="font-medium">{e.eventType}</span>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-slate-600 dark:text-slate-300">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleGate>
  );
}
