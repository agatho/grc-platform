"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { HorizonCalendarEvent } from "@grc/shared";

const PRIO_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-900",
  high: "bg-orange-100 text-orange-900",
  medium: "bg-yellow-100 text-yellow-900",
  low: "bg-blue-100 text-blue-900",
};

export default function HorizonCalendarPage() {
  const t = useTranslations("horizonScanner");
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert
  // wie vorher eine leere Liste.
  const { data: rows = [], isPending: loading } = useQuery<
    HorizonCalendarEvent[]
  >({
    queryKey: ["horizon-scanner", "calendar"],
    queryFn: async () => {
      const res = await fetch(
        "/api/v1/horizon-scanner/calendar?limit=50&isCompleted=false",
      );
      if (!res.ok) return [];
      return (await res.json()).data as HorizonCalendarEvent[];
    },
  });
  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.calendar")}</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((evt) => (
          <Card key={evt.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{evt.title}</p>
                <p className="text-sm text-muted-foreground">
                  {evt.eventType} | {evt.eventDate} | {evt.jurisdiction ?? ""}
                </p>
              </div>
              <Badge className={PRIO_COLORS[evt.priority] ?? ""}>
                {evt.priority}
              </Badge>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            No upcoming regulatory deadlines
          </p>
        )}
      </div>
    </div>
  );
}
