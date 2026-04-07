"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  Loader2,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { EventLogEntry } from "@grc/shared";

// ── Event type styling ────────────────────────────────────────

const EVENT_TYPE_STYLES: Record<string, string> = {
  "entity.created": "bg-green-100 text-green-900",
  "entity.updated": "bg-blue-100 text-blue-900",
  "entity.deleted": "bg-red-100 text-red-900",
  "entity.status_changed": "bg-amber-100 text-amber-900",
};

const ENTITY_TYPES = [
  "", "risk", "control", "process", "asset", "vendor", "contract",
  "document", "finding", "incident", "audit", "kri",
];

const EVENT_TYPES = [
  "", "entity.created", "entity.updated", "entity.deleted", "entity.status_changed",
];

export default function EventLogPage() {
  const t = useTranslations("platform");
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<EventLogEntry | null>(null);

  // Filters
  const [filterEntityType, setFilterEntityType] = useState("");
  const [filterEventType, setFilterEventType] = useState("");
  const [filterEntityId, setFilterEntityId] = useState("");

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (filterEntityType) params.set("entityType", filterEntityType);
      if (filterEventType) params.set("eventType", filterEventType);
      if (filterEntityId) params.set("entityId", filterEntityId);

      const res = await fetch(`/api/v1/events?${params}`);
      if (res.ok) {
        const json = await res.json();
        setEvents(json.data ?? []);
        setTotal(json.pagination?.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, filterEntityType, filterEventType, filterEntityId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleFilter = () => {
    setPage(1);
    fetchEvents();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            {t("events.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("events.description")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchEvents}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          {t("events.refresh")}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 py-3">
          <Select value={filterEntityType} onValueChange={setFilterEntityType}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t("events.entityType")} />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((et) => (
                <SelectItem key={et || "all"} value={et || "all"}>
                  {et || t("events.allEntityTypes")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterEventType} onValueChange={setFilterEventType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("events.eventType")} />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((et) => (
                <SelectItem key={et || "all"} value={et || "all"}>
                  {et ? et.replace("entity.", "") : t("events.allEventTypes")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="w-[280px]"
            placeholder={t("events.entityIdPlaceholder")}
            value={filterEntityId}
            onChange={(e) => setFilterEntityId(e.target.value)}
          />
          <Button variant="outline" onClick={handleFilter}>
            <Filter className="h-3.5 w-3.5 mr-1" />
            {t("events.filter")}
          </Button>
        </CardContent>
      </Card>

      {/* Event List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Activity className="mx-auto h-10 w-10 mb-3 opacity-50" />
            <p>{t("events.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="flex items-center gap-3 rounded-md border px-4 py-2.5 text-sm hover:bg-muted/50 cursor-pointer"
              onClick={() => setSelectedEvent(evt)}
            >
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Badge
                className={
                  EVENT_TYPE_STYLES[evt.eventType] ?? "bg-gray-100 text-gray-600"
                }
              >
                {evt.eventType.replace("entity.", "")}
              </Badge>
              <Badge variant="outline">{evt.entityType}</Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {evt.entityId.slice(0, 8)}...
              </span>
              {evt.userId && (
                <span className="text-xs text-muted-foreground">
                  {t("events.by")} {evt.userId.slice(0, 8)}...
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                {new Date(evt.emittedAt).toLocaleString("de-DE")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 30 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t("events.prev")}
          </Button>
          <span className="text-sm text-muted-foreground flex items-center px-2">
            {page} / {Math.ceil(total / 30)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(total / 30)}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("events.next")}
          </Button>
        </div>
      )}

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t("events.detail")}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("events.eventType")}:</span>{" "}
                  <Badge
                    className={
                      EVENT_TYPE_STYLES[selectedEvent.eventType] ??
                      "bg-gray-100 text-gray-600"
                    }
                  >
                    {selectedEvent.eventType}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("events.entityType")}:</span>{" "}
                  <strong>{selectedEvent.entityType}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("events.entityId")}:</span>{" "}
                  <code className="font-mono text-xs">{selectedEvent.entityId}</code>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("events.timestamp")}:</span>{" "}
                  {new Date(selectedEvent.emittedAt).toLocaleString("de-DE")}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">{t("events.payload")}</h4>
                <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto max-h-[400px] overflow-y-auto">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
