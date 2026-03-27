"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Calendar, Clock, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AggregatedCalendarEvent } from "@grc/shared";
import { MODULE_COLORS } from "@grc/shared";

const MODULE_LABELS: Record<string, string> = {
  erm: "ERM",
  isms: "ISMS",
  dpms: "DPMS",
  audit: "Audit",
  tprm: "TPRM",
  bcms: "BCMS",
  esg: "ESG",
  ics: "ICS",
  rcsa: "RCSA",
  manual: "Manual",
};

function getEntityRoute(entityType: string, entityId: string): string {
  const routes: Record<string, string> = {
    audit: `/audit/${entityId}`,
    control_test: `/controls/tests/${entityId}`,
    dsr: `/dpms/dsr/${entityId}`,
    data_breach: `/dpms/breaches/${entityId}`,
    contract: `/contracts/${entityId}`,
    ropa_entry: `/dpms/ropa/${entityId}`,
    bc_exercise: `/bcms/exercises/${entityId}`,
    esg_annual_report: `/esg/reports/${entityId}`,
    rcsa_campaign: `/rcsa/campaigns/${entityId}`,
    finding: `/findings/${entityId}`,
    calendar_event: `/calendar`,
  };
  return routes[entityType] ?? "/calendar";
}

interface UpcomingEvent extends AggregatedCalendarEvent {
  daysUntil: number;
  urgency: "green" | "yellow" | "red";
}

export function CalendarUpcomingWidget() {
  const t = useTranslations("calendar");
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUpcoming = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/calendar/upcoming?limit=5");
      if (res.ok) {
        const json = await res.json();
        setEvents(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUpcoming();
  }, [fetchUpcoming]);

  const urgencyColors: Record<string, string> = {
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">{t("upcomingTitle")}</CardTitle>
          </div>
          <Link href="/calendar" className="text-xs text-primary hover:underline flex items-center gap-1">
            {t("viewAll")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            {t("noUpcoming")}
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <Link
                key={`${event.entityType}-${event.id}`}
                href={getEntityRoute(event.entityType, event.entityId)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: event.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{event.title}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(event.startAt).toLocaleDateString()}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {MODULE_LABELS[event.module] ?? event.module}
                </Badge>
                <Badge className={`text-xs flex-shrink-0 ${urgencyColors[event.urgency]}`}>
                  {event.daysUntil <= 0 ? t("today") : `${event.daysUntil}d`}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
