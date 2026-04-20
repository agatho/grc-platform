// Sprint 17: Calendar Aggregation Service
// Aggregates events from 10+ source tables via UNION ALL
// NO denormalization — all queries run at request time

import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import type {
  AggregatedCalendarEvent,
  CalendarFilters,
  CapacityHeatmapEntry,
} from "@grc/shared";
import { MODULE_COLORS } from "@grc/shared";

interface EnabledModulesMap {
  [moduleKey: string]: boolean;
}

/** Get enabled modules for an org from module_config */
async function getEnabledModules(orgId: string): Promise<EnabledModulesMap> {
  const result = await db.execute(
    sql`SELECT md.key FROM module_config mc JOIN module_definition md ON mc.module_id = md.id WHERE mc.org_id = ${orgId} AND mc.is_enabled = true`,
  );
  const map: EnabledModulesMap = {};
  for (const row of result as unknown as Array<{ key: string }>) {
    map[row.key] = true;
  }
  return map;
}

/** Check if a module is requested by filter AND enabled for the org */
function shouldIncludeModule(
  moduleKey: string,
  filterModules: string[] | undefined,
  enabledModules: EnabledModulesMap,
): boolean {
  // If module is not enabled for org, always exclude
  if (!enabledModules[moduleKey]) return false;
  // If no filter specified, include all enabled modules
  if (!filterModules || filterModules.length === 0) return true;
  // Otherwise, include only if in filter list
  return filterModules.includes(moduleKey);
}

/** Main aggregation: UNION ALL across all calendar sources */
export async function getCalendarEvents(
  orgId: string,
  from: Date,
  to: Date,
  filters: CalendarFilters,
): Promise<AggregatedCalendarEvent[]> {
  const enabledModules = await getEnabledModules(orgId);
  const queries: ReturnType<typeof sql>[] = [];

  const fromStr = from.toISOString();
  const toStr = to.toISOString();

  // 1. Audit planned dates
  if (shouldIncludeModule("audit", filters.modules, enabledModules)) {
    queries.push(sql`
      SELECT id, 'audit' as module, 'Audit: ' || title as title,
        planned_start::timestamptz as start_at, planned_end::timestamptz as end_at,
        'audit_plan' as event_type, lead_auditor_id as responsible_id,
        'audit' as entity_type, id as entity_id
      FROM audit
      WHERE org_id = ${orgId}
        AND planned_start IS NOT NULL
        AND planned_start::timestamptz >= ${fromStr}::timestamptz
        AND planned_start::timestamptz <= ${toStr}::timestamptz
        AND deleted_at IS NULL
    `);
  }

  // 2. Control test dates
  if (shouldIncludeModule("ics", filters.modules, enabledModules)) {
    queries.push(sql`
      SELECT ct.id, 'ics' as module, 'Test: ' || c.title as title,
        ct.test_date::timestamptz as start_at, ct.test_date::timestamptz as end_at,
        'control_test' as event_type, ct.tester_id as responsible_id,
        'control_test' as entity_type, ct.id as entity_id
      FROM control_test ct
      JOIN control c ON ct.control_id = c.id
      WHERE ct.org_id = ${orgId}
        AND ct.test_date IS NOT NULL
        AND ct.test_date::timestamptz >= ${fromStr}::timestamptz
        AND ct.test_date::timestamptz <= ${toStr}::timestamptz
        AND ct.deleted_at IS NULL
    `);
  }

  // 3. DSR deadlines
  if (shouldIncludeModule("dpms", filters.modules, enabledModules)) {
    queries.push(sql`
      SELECT id, 'dpms' as module, 'DSR: ' || request_type as title,
        deadline as start_at, deadline as end_at,
        'dsr_deadline' as event_type, handler_id as responsible_id,
        'dsr' as entity_type, id as entity_id
      FROM dsr
      WHERE org_id = ${orgId}
        AND deadline >= ${fromStr}::timestamptz
        AND deadline <= ${toStr}::timestamptz
    `);
  }

  // 4. Data breach 72h notification deadlines
  if (shouldIncludeModule("dpms", filters.modules, enabledModules)) {
    queries.push(sql`
      SELECT id, 'dpms' as module, 'Breach 72h: ' || title as title,
        (detected_at + interval '72 hours') as start_at,
        (detected_at + interval '72 hours') as end_at,
        'breach_deadline' as event_type, assignee_id as responsible_id,
        'data_breach' as entity_type, id as entity_id
      FROM data_breach
      WHERE org_id = ${orgId}
        AND (detected_at + interval '72 hours') >= ${fromStr}::timestamptz
        AND (detected_at + interval '72 hours') <= ${toStr}::timestamptz
        AND deleted_at IS NULL
    `);
  }

  // 5. Contract expiry dates
  if (shouldIncludeModule("tprm", filters.modules, enabledModules)) {
    queries.push(sql`
      SELECT id, 'tprm' as module, 'Contract: ' || title as title,
        expiration_date::timestamptz as start_at, expiration_date::timestamptz as end_at,
        'contract_expiry' as event_type, owner_id as responsible_id,
        'contract' as entity_type, id as entity_id
      FROM contract
      WHERE org_id = ${orgId}
        AND expiration_date IS NOT NULL
        AND expiration_date::timestamptz >= ${fromStr}::timestamptz
        AND expiration_date::timestamptz <= ${toStr}::timestamptz
        AND deleted_at IS NULL
    `);
  }

  // 6. RoPA next review dates
  if (shouldIncludeModule("dpms", filters.modules, enabledModules)) {
    queries.push(sql`
      SELECT id, 'dpms' as module, 'RoPA Review: ' || title as title,
        next_review_date::timestamptz as start_at, next_review_date::timestamptz as end_at,
        'ropa_review' as event_type, responsible_id as responsible_id,
        'ropa_entry' as entity_type, id as entity_id
      FROM ropa_entry
      WHERE org_id = ${orgId}
        AND next_review_date IS NOT NULL
        AND next_review_date::timestamptz >= ${fromStr}::timestamptz
        AND next_review_date::timestamptz <= ${toStr}::timestamptz
        AND deleted_at IS NULL
    `);
  }

  // 7. BCMS exercise dates
  if (shouldIncludeModule("bcms", filters.modules, enabledModules)) {
    queries.push(sql`
      SELECT id, 'bcms' as module, 'BCP Exercise: ' || title as title,
        planned_date::timestamptz as start_at, planned_date::timestamptz as end_at,
        'bcp_exercise' as event_type, exercise_lead_id as responsible_id,
        'bc_exercise' as entity_type, id as entity_id
      FROM bc_exercise
      WHERE org_id = ${orgId}
        AND planned_date::timestamptz >= ${fromStr}::timestamptz
        AND planned_date::timestamptz <= ${toStr}::timestamptz
    `);
  }

  // 8. ESG reporting deadlines (April 30 of year following reporting_year)
  if (shouldIncludeModule("esg", filters.modules, enabledModules)) {
    queries.push(sql`
      SELECT id, 'esg' as module, 'ESG Report ' || reporting_year as title,
        make_date(reporting_year + 1, 4, 30)::timestamptz as start_at,
        make_date(reporting_year + 1, 4, 30)::timestamptz as end_at,
        'esg_deadline' as event_type, NULL::uuid as responsible_id,
        'esg_annual_report' as entity_type, id as entity_id
      FROM esg_annual_report
      WHERE org_id = ${orgId}
        AND make_date(reporting_year + 1, 4, 30)::timestamptz >= ${fromStr}::timestamptz
        AND make_date(reporting_year + 1, 4, 30)::timestamptz <= ${toStr}::timestamptz
    `);
  }

  // 9. RCSA campaign deadlines
  if (shouldIncludeModule("erm", filters.modules, enabledModules)) {
    queries.push(sql`
      SELECT id, 'rcsa' as module, 'RCSA: ' || name as title,
        period_end::timestamptz as start_at, period_end::timestamptz as end_at,
        'rcsa_deadline' as event_type, created_by as responsible_id,
        'rcsa_campaign' as entity_type, id as entity_id
      FROM rcsa_campaign
      WHERE org_id = ${orgId}
        AND period_end::timestamptz >= ${fromStr}::timestamptz
        AND period_end::timestamptz <= ${toStr}::timestamptz
        AND status = 'active'
    `);
  }

  // 10. Finding remediation due dates
  if (shouldIncludeModule("ics", filters.modules, enabledModules)) {
    queries.push(sql`
      SELECT id, 'ics' as module, 'Finding Due: ' || title as title,
        remediation_due_date::timestamptz as start_at, remediation_due_date::timestamptz as end_at,
        'finding_due' as event_type, assignee_id as responsible_id,
        'finding' as entity_type, id as entity_id
      FROM finding
      WHERE org_id = ${orgId}
        AND remediation_due_date IS NOT NULL
        AND remediation_due_date::timestamptz >= ${fromStr}::timestamptz
        AND remediation_due_date::timestamptz <= ${toStr}::timestamptz
        AND deleted_at IS NULL
    `);
  }

  // 11. Manual events (always included, no module gate)
  queries.push(sql`
    SELECT id, COALESCE(module, 'manual') as module, title,
      start_at, end_at,
      event_type::text as event_type, created_by as responsible_id,
      'calendar_event' as entity_type, id as entity_id
    FROM compliance_calendar_event
    WHERE org_id = ${orgId}
      AND start_at >= ${fromStr}::timestamptz
      AND start_at <= ${toStr}::timestamptz
      AND deleted_at IS NULL
  `);

  if (queries.length === 0) {
    return [];
  }

  // Build UNION ALL
  let unionQuery = queries[0];
  for (let i = 1; i < queries.length; i++) {
    unionQuery = sql`${unionQuery} UNION ALL ${queries[i]}`;
  }

  // Add responsible filter if specified
  let finalQuery;
  if (filters.responsible) {
    finalQuery = sql`SELECT * FROM (${unionQuery}) AS events WHERE responsible_id = ${filters.responsible} ORDER BY start_at ASC`;
  } else {
    finalQuery = sql`SELECT * FROM (${unionQuery}) AS events ORDER BY start_at ASC`;
  }

  const result = await db.execute(finalQuery);
  const now = new Date();

  return (result as unknown as Array<Record<string, unknown>>).map((row) => {
    const startAt = String(row.start_at);
    const isOverdue = new Date(startAt) < now;
    const module = String(row.module);

    return {
      id: String(row.id),
      module,
      title: String(row.title),
      startAt,
      endAt: row.end_at ? String(row.end_at) : null,
      eventType: String(row.event_type),
      responsibleId: row.responsible_id ? String(row.responsible_id) : null,
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      isOverdue,
      color: MODULE_COLORS[module] ?? MODULE_COLORS.manual,
    };
  });
}

/** Get capacity heatmap data: event count per day for a date range */
export async function getCapacityHeatmap(
  orgId: string,
  from: Date,
  to: Date,
  filterModules?: string[],
): Promise<CapacityHeatmapEntry[]> {
  const events = await getCalendarEvents(orgId, from, to, {
    modules: filterModules,
  });

  // Count events per day
  const dayCounts: Record<string, number> = {};
  for (const event of events) {
    const day = event.startAt.substring(0, 10); // YYYY-MM-DD
    dayCounts[day] = (dayCounts[day] ?? 0) + 1;
  }

  // Generate entries for every day in range
  const entries: CapacityHeatmapEntry[] = [];
  const current = new Date(from);
  while (current <= to) {
    const dateStr = current.toISOString().substring(0, 10);
    const count = dayCounts[dateStr] ?? 0;
    let level: CapacityHeatmapEntry["level"] = "none";
    if (count >= 6) level = "high";
    else if (count >= 3) level = "medium";
    else if (count >= 1) level = "low";

    entries.push({ date: dateStr, count, level });
    current.setDate(current.getDate() + 1);
  }

  return entries;
}

/** Get upcoming events (next 7 days) for dashboard widget */
export async function getUpcomingEvents(
  orgId: string,
  limit = 10,
): Promise<AggregatedCalendarEvent[]> {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const events = await getCalendarEvents(orgId, now, sevenDaysFromNow, {});
  return events.slice(0, limit);
}
