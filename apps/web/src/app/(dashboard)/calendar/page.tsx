"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCcw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Filter,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import type { AggregatedCalendarEvent, CapacityHeatmapEntry } from "@grc/shared";
import { MODULE_COLORS } from "@grc/shared";

// ──────────────────────────────────────────────────────────────
// Module labels for display
// ──────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────
// Views
// ──────────────────────────────────────────────────────────────
type CalendarView = "month" | "week" | "day" | "agenda";

// ──────────────────────────────────────────────────────────────
// Helper: entity type to route mapping for deep-link navigation
// ──────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────
// Helper: get days in month grid (includes prev/next padding)
// ──────────────────────────────────────────────────────────────
function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday start
  const days: Date[] = [];

  // Padding from previous month
  for (let i = startPadding - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }
  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }
  // Padding for next month
  while (days.length % 7 !== 0) {
    days.push(new Date(year, month + 1, days.length - startPadding - lastDay.getDate() + 1));
  }
  return days;
}

function formatDateKey(d: Date): string {
  return d.toISOString().substring(0, 10);
}

// ──────────────────────────────────────────────────────────────
// Calendar Page Component
// ──────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const t = useTranslations("calendar");
  const router = useRouter();

  // State
  const [events, setEvents] = useState<AggregatedCalendarEvent[]>([]);
  const [heatmap, setHeatmap] = useState<CapacityHeatmapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Filters
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(true);

  // Create event form
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    startAt: "",
    endAt: "",
    isAllDay: false,
    eventType: "meeting" as string,
    module: "",
    recurrence: "none" as string,
  });

  // ──────────────────────────────────────────────────────────
  // Computed date range based on view + current date
  // ──────────────────────────────────────────────────────────
  const dateRange = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const day = currentDate.getDate();
    const dayOfWeek = currentDate.getDay();

    switch (view) {
      case "month":
        return {
          from: new Date(year, month, 1),
          to: new Date(year, month + 1, 0, 23, 59, 59),
        };
      case "week": {
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(year, month, day + mondayOffset);
        const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
        sunday.setHours(23, 59, 59);
        return { from: monday, to: sunday };
      }
      case "day":
        return {
          from: new Date(year, month, day),
          to: new Date(year, month, day, 23, 59, 59),
        };
      case "agenda":
        return {
          from: new Date(year, month, day),
          to: new Date(year, month + 1, day),
        };
      default:
        return { from: new Date(year, month, 1), to: new Date(year, month + 1, 0) };
    }
  }, [currentDate, view]);

  // ──────────────────────────────────────────────────────────
  // Fetch events
  // ──────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
      });
      if (selectedModules.length > 0) {
        params.set("modules", selectedModules.join(","));
      }

      const [eventsRes, heatmapRes] = await Promise.all([
        fetch(`/api/v1/calendar?${params.toString()}`),
        view === "month"
          ? fetch(`/api/v1/calendar/capacity-heatmap?${params.toString()}`)
          : Promise.resolve(null),
      ]);

      if (eventsRes.ok) {
        const json = await eventsRes.json();
        setEvents(json.data ?? []);
      }

      if (heatmapRes && heatmapRes.ok) {
        const json = await heatmapRes.json();
        setHeatmap(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedModules, view]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  // ──────────────────────────────────────────────────────────
  // Group events by date
  // ──────────────────────────────────────────────────────────
  const eventsByDate = useMemo(() => {
    const map: Record<string, AggregatedCalendarEvent[]> = {};
    for (const event of events) {
      const key = event.startAt.substring(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(event);
    }
    return map;
  }, [events]);

  // Heatmap lookup
  const heatmapByDate = useMemo(() => {
    const map: Record<string, CapacityHeatmapEntry> = {};
    for (const entry of heatmap) {
      map[entry.date] = entry;
    }
    return map;
  }, [heatmap]);

  // ──────────────────────────────────────────────────────────
  // Navigation
  // ──────────────────────────────────────────────────────────
  function navigatePrev() {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() - 1);
    else if (view === "week") d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  }

  function navigateNext() {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + 1);
    else if (view === "week") d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  }

  function navigateToday() {
    setCurrentDate(new Date());
  }

  // ──────────────────────────────────────────────────────────
  // Create manual event
  // ──────────────────────────────────────────────────────────
  async function handleCreateEvent() {
    if (!newEvent.title || !newEvent.startAt) return;
    try {
      const res = await fetch("/api/v1/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newEvent.title,
          description: newEvent.description || undefined,
          startAt: new Date(newEvent.startAt).toISOString(),
          endAt: newEvent.endAt ? new Date(newEvent.endAt).toISOString() : undefined,
          isAllDay: newEvent.isAllDay,
          eventType: newEvent.eventType,
          module: newEvent.module || undefined,
          recurrence: newEvent.recurrence,
        }),
      });

      if (res.ok) {
        setShowCreateDialog(false);
        setNewEvent({
          title: "",
          description: "",
          startAt: "",
          endAt: "",
          isAllDay: false,
          eventType: "meeting",
          module: "",
          recurrence: "none",
        });
        void fetchEvents();
      }
    } catch {
      // Error handling is silent for now
    }
  }

  // ──────────────────────────────────────────────────────────
  // Toggle module filter
  // ──────────────────────────────────────────────────────────
  function toggleModule(moduleKey: string) {
    setSelectedModules((prev) =>
      prev.includes(moduleKey)
        ? prev.filter((m) => m !== moduleKey)
        : [...prev, moduleKey],
    );
  }

  // ──────────────────────────────────────────────────────────
  // Capacity heatmap background color
  // ──────────────────────────────────────────────────────────
  function getHeatmapBg(dateKey: string): string {
    const entry = heatmapByDate[dateKey];
    if (!entry) return "";
    switch (entry.level) {
      case "high":
        return "bg-red-50";
      case "medium":
        return "bg-orange-50";
      case "low":
        return "bg-yellow-50";
      default:
        return "";
    }
  }

  // ──────────────────────────────────────────────────────────
  // Render: Month View
  // ──────────────────────────────────────────────────────────
  function renderMonthView() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = getMonthDays(year, month);
    const todayKey = formatDateKey(new Date());
    const weekDays = [
      t("weekdays.mon"),
      t("weekdays.tue"),
      t("weekdays.wed"),
      t("weekdays.thu"),
      t("weekdays.fri"),
      t("weekdays.sat"),
      t("weekdays.sun"),
    ];

    return (
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 border-b">
          {weekDays.map((day) => (
            <div key={day} className="px-2 py-1 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 flex-1">
          {days.map((day, idx) => {
            const dateKey = formatDateKey(day);
            const isCurrentMonth = day.getMonth() === month;
            const isToday = dateKey === todayKey;
            const dayEvents = eventsByDate[dateKey] ?? [];
            const heatBg = view === "month" ? getHeatmapBg(dateKey) : "";

            return (
              <div
                key={idx}
                className={`min-h-[100px] border-r border-b p-1 ${heatBg} ${
                  !isCurrentMonth ? "bg-muted/30" : ""
                } ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}
              >
                <div className={`text-xs font-medium mb-1 ${!isCurrentMonth ? "text-muted-foreground" : ""}`}>
                  {day.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <button
                      key={`${event.entityType}-${event.id}`}
                      onClick={() => router.push(getEntityRoute(event.entityType, event.entityId))}
                      className={`w-full text-left text-xs px-1 py-0.5 rounded truncate ${
                        event.isOverdue ? "border border-dashed border-red-500" : ""
                      }`}
                      style={{ backgroundColor: event.color + "20", color: event.color }}
                      title={`${event.title} (${event.module})`}
                    >
                      {event.title}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground pl-1">
                      +{dayEvents.length - 3} {t("more")}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // Render: Agenda View
  // ──────────────────────────────────────────────────────────
  function renderAgendaView() {
    if (events.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          {t("noEvents")}
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {events.map((event) => (
          <button
            key={`${event.entityType}-${event.id}`}
            onClick={() => router.push(getEntityRoute(event.entityType, event.entityId))}
            className={`w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors ${
              event.isOverdue ? "border-red-300 border-dashed" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: event.color }}
              />
              <span className="font-medium text-sm">{event.title}</span>
              <Badge variant="outline" className="text-xs ml-auto">
                {MODULE_LABELS[event.module] ?? event.module}
              </Badge>
              {event.isOverdue && (
                <Badge variant="destructive" className="text-xs">
                  {t("overdue")}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1 ml-5">
              {new Date(event.startAt).toLocaleDateString()} &middot; {event.eventType}
            </div>
          </button>
        ))}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // Render: Week View
  // ──────────────────────────────────────────────────────────
  function renderWeekView() {
    const dayOfWeek = currentDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + mondayOffset);
    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      weekDays.push(new Date(monday.getTime() + i * 24 * 60 * 60 * 1000));
    }
    const todayKey = formatDateKey(new Date());

    return (
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 gap-2 p-2">
          {weekDays.map((day) => {
            const dateKey = formatDateKey(day);
            const isToday = dateKey === todayKey;
            const dayEvents = eventsByDate[dateKey] ?? [];

            return (
              <div key={dateKey} className={`min-h-[300px] border rounded-lg p-2 ${isToday ? "ring-2 ring-primary" : ""}`}>
                <div className="text-sm font-medium mb-2">
                  {day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
                </div>
                <div className="space-y-1">
                  {dayEvents.map((event) => (
                    <button
                      key={`${event.entityType}-${event.id}`}
                      onClick={() => router.push(getEntityRoute(event.entityType, event.entityId))}
                      className={`w-full text-left text-xs p-1.5 rounded ${
                        event.isOverdue ? "border border-dashed border-red-500" : ""
                      }`}
                      style={{ backgroundColor: event.color + "20", color: event.color }}
                    >
                      <div className="font-medium truncate">{event.title}</div>
                      <div className="opacity-75">{new Date(event.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // Render: Day View
  // ──────────────────────────────────────────────────────────
  function renderDayView() {
    const dateKey = formatDateKey(currentDate);
    const dayEvents = eventsByDate[dateKey] ?? [];

    return (
      <div className="flex-1 overflow-auto p-4">
        <h3 className="text-lg font-semibold mb-4">
          {currentDate.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </h3>
        {dayEvents.length === 0 ? (
          <div className="text-muted-foreground">{t("noEvents")}</div>
        ) : (
          <div className="space-y-2">
            {dayEvents.map((event) => (
              <button
                key={`${event.entityType}-${event.id}`}
                onClick={() => router.push(getEntityRoute(event.entityType, event.entityId))}
                className={`w-full text-left p-4 rounded-lg border hover:bg-muted/50 transition-colors ${
                  event.isOverdue ? "border-red-300 border-dashed" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: event.color }} />
                  <div>
                    <div className="font-medium">{event.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(event.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {event.endAt && ` - ${new Date(event.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-auto">
                    {MODULE_LABELS[event.module] ?? event.module}
                  </Badge>
                  {event.isOverdue && <Badge variant="destructive">{t("overdue")}</Badge>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // Title based on view
  // ──────────────────────────────────────────────────────────
  function getViewTitle(): string {
    const opts: Intl.DateTimeFormatOptions =
      view === "month"
        ? { year: "numeric", month: "long" }
        : view === "week"
          ? { year: "numeric", month: "short", day: "numeric" }
          : { year: "numeric", month: "long", day: "numeric" };
    return currentDate.toLocaleDateString(undefined, opts);
  }

  // ──────────────────────────────────────────────────────────
  // Main Render
  // ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          <h1 className="text-xl font-semibold">{t("title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-1" />
            {t("filters")}
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {t("createEvent")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("createEvent")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>{t("eventTitle")}</Label>
                  <Input
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder={t("eventTitlePlaceholder")}
                  />
                </div>
                <div>
                  <Label>{t("eventDescription")}</Label>
                  <Textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("startDate")}</Label>
                    <Input
                      type="datetime-local"
                      value={newEvent.startAt}
                      onChange={(e) => setNewEvent({ ...newEvent, startAt: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t("endDate")}</Label>
                    <Input
                      type="datetime-local"
                      value={newEvent.endAt}
                      onChange={(e) => setNewEvent({ ...newEvent, endAt: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newEvent.isAllDay}
                    onCheckedChange={(checked) => setNewEvent({ ...newEvent, isAllDay: checked })}
                  />
                  <Label>{t("allDay")}</Label>
                </div>
                <div>
                  <Label>{t("eventType")}</Label>
                  <Select
                    value={newEvent.eventType}
                    onValueChange={(v) => setNewEvent({ ...newEvent, eventType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meeting">{t("types.meeting")}</SelectItem>
                      <SelectItem value="workshop">{t("types.workshop")}</SelectItem>
                      <SelectItem value="review">{t("types.review")}</SelectItem>
                      <SelectItem value="training">{t("types.training")}</SelectItem>
                      <SelectItem value="deadline">{t("types.deadline")}</SelectItem>
                      <SelectItem value="other">{t("types.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("recurrence")}</Label>
                  <Select
                    value={newEvent.recurrence}
                    onValueChange={(v) => setNewEvent({ ...newEvent, recurrence: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("recurrences.none")}</SelectItem>
                      <SelectItem value="weekly">{t("recurrences.weekly")}</SelectItem>
                      <SelectItem value="monthly">{t("recurrences.monthly")}</SelectItem>
                      <SelectItem value="quarterly">{t("recurrences.quarterly")}</SelectItem>
                      <SelectItem value="annually">{t("recurrences.annually")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateEvent} className="w-full">
                  {t("save")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Navigation + View Toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={navigateToday}>
            {t("today")}
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-lg font-medium ml-2">{getViewTitle()}</span>
          {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
        </div>
        <div className="flex items-center gap-1">
          {(["month", "week", "day", "agenda"] as CalendarView[]).map((v) => (
            <Button
              key={v}
              variant={view === v ? "default" : "outline"}
              size="sm"
              onClick={() => setView(v)}
            >
              {t(`views.${v}`)}
            </Button>
          ))}
          <Button variant="ghost" size="icon" onClick={fetchEvents}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main content: Filter sidebar + Calendar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filter Sidebar */}
        {showFilters && (
          <div className="w-60 border-r p-4 space-y-6 overflow-auto">
            <div>
              <h3 className="font-medium text-sm mb-2">{t("moduleFilter")}</h3>
              <div className="space-y-2">
                {Object.entries(MODULE_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedModules.length === 0 || selectedModules.includes(key)}
                      onCheckedChange={() => toggleModule(key)}
                    />
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: MODULE_COLORS[key] }}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {selectedModules.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={() => setSelectedModules([])}
                >
                  {t("clearFilters")}
                </Button>
              )}
            </div>

            {/* Heatmap Legend (month view) */}
            {view === "month" && (
              <div>
                <h3 className="font-medium text-sm mb-2">{t("capacityLegend")}</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-white border" />
                    {t("capacity.none")}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-yellow-50 border" />
                    {t("capacity.low")}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-orange-50 border" />
                    {t("capacity.medium")}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-50 border" />
                    {t("capacity.high")}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Calendar Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {view === "month" && renderMonthView()}
          {view === "week" && renderWeekView()}
          {view === "day" && renderDayView()}
          {view === "agenda" && renderAgendaView()}
        </div>
      </div>
    </div>
  );
}
