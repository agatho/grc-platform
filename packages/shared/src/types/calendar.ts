// Sprint 17: Compliance Calendar Types

export type CalendarEventType =
  | "meeting"
  | "workshop"
  | "review"
  | "training"
  | "deadline"
  | "other";
export type CalendarRecurrence =
  | "none"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "annually";
export type CalendarDeadlineStatus = "open" | "overdue" | "completed";

export interface ComplianceCalendarEvent {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  isAllDay: boolean;
  eventType: CalendarEventType;
  module?: string;
  recurrence: CalendarRecurrence;
  recurrenceEndAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface AggregatedCalendarEvent {
  id: string;
  module: string;
  title: string;
  startAt: string;
  endAt: string | null;
  eventType: string;
  responsibleId: string | null;
  entityType: string;
  entityId: string;
  isOverdue: boolean;
  color: string;
}

export interface CalendarFilters {
  modules?: string[];
  responsible?: string;
  eventType?: string[];
  status?: CalendarDeadlineStatus;
}

export interface CapacityHeatmapEntry {
  date: string;
  count: number;
  level: "none" | "low" | "medium" | "high";
}

export interface CalendarUpcomingEvent {
  id: string;
  module: string;
  title: string;
  startAt: string;
  eventType: string;
  entityType: string;
  entityId: string;
  daysUntil: number;
  urgency: "green" | "yellow" | "red";
}

export interface ICalTokenResponse {
  icalToken: string;
  icalUrl: string;
  createdAt: string;
}

export interface CalendarDigestEvent {
  title: string;
  module: string;
  startAt: string;
  entityType: string;
  entityId: string;
  responsibleName?: string;
  link: string;
}
