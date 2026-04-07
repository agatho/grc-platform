"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Calendar, Plus, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RegulatoryCalendarEvent } from "@grc/shared";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-900",
  high: "bg-orange-100 text-orange-900",
  medium: "bg-yellow-100 text-yellow-900",
  low: "bg-blue-100 text-blue-900",
};

export default function RegulatoryCalendarPage() {
  const t = useTranslations("regulatory");
  const [events, setEvents] = useState<RegulatoryCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/regulatory-changes/calendar?limit=100&isCompleted=false");
      if (res.ok) setEvents((await res.json()).data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchEvents(); }, [fetchEvents]);

  const markComplete = async (id: string) => {
    await fetch(`/api/v1/regulatory-changes/calendar/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: true }),
    });
    await fetchEvents();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("calendar.title")}</h1>
        <Button><Plus className="h-4 w-4 mr-2" />{t("calendar.addEvent")}</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.eventDate} - {event.eventType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={PRIORITY_COLORS[event.priority] ?? ""}>{event.priority}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => markComplete(event.id)}><Check className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
