// Sprint 17: iCal Feed Generator
// Generates RFC 5545 compliant iCal feeds for calendar subscription
// Window: 1 month past + 12 months future

import { getCalendarEvents } from "./calendar-aggregation";
import type { AggregatedCalendarEvent } from "@grc/shared";

/** Convert a date string to iCal DTSTART format (UTC) */
function toICalDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Escape special characters for iCal text values */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Generate a deterministic UID for an event */
function generateUid(event: AggregatedCalendarEvent): string {
  return `${event.entityType}-${event.entityId}@arctos.grc`;
}

/** Build a single VEVENT block */
function buildVEvent(event: AggregatedCalendarEvent): string {
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${generateUid(event)}`,
    `DTSTART:${toICalDate(event.startAt)}`,
  ];

  if (event.endAt) {
    lines.push(`DTEND:${toICalDate(event.endAt)}`);
  } else {
    lines.push(`DTEND:${toICalDate(event.startAt)}`);
  }

  lines.push(`SUMMARY:${escapeICalText(event.title)}`);
  lines.push(`DESCRIPTION:Module: ${event.module} | Type: ${event.eventType}`);
  lines.push(`CATEGORIES:${event.module.toUpperCase()}`);

  if (event.isOverdue) {
    lines.push("STATUS:CANCELLED");
  } else {
    lines.push("STATUS:CONFIRMED");
  }

  lines.push(`DTSTAMP:${toICalDate(new Date().toISOString())}`);
  lines.push("END:VEVENT");

  return lines.join("\r\n");
}

/** Generate a full iCal feed for a user/org combination */
export async function generateICalFeed(orgId: string): Promise<string> {
  const now = new Date();
  const oneMonthAgo = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    now.getDate(),
  );
  const twelveMonthsAhead = new Date(
    now.getFullYear(),
    now.getMonth() + 12,
    now.getDate(),
  );

  const events = await getCalendarEvents(
    orgId,
    oneMonthAgo,
    twelveMonthsAhead,
    {},
  );

  const vevents = events.map(buildVEvent);

  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ARCTOS//Compliance Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:ARCTOS Compliance Calendar",
    "X-WR-TIMEZONE:UTC",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");

  return calendar;
}
