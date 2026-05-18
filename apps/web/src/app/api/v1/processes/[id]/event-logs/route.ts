// BPM Overhaul Phase 8: Webhook-style ingestion of event log batches.
//
// Accepts a JSON body with metadata + an inline `events[]` array. For larger
// datasets the existing CSV/XES upload endpoints should be preferred — this
// route is the lightweight always-on receiver.

import { db, process, processEventLog, processEvent } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const eventSchema = z.object({
  caseId: z.string().min(1).max(200),
  activity: z.string().min(1).max(500),
  timestamp: z.string().datetime(),
  resource: z.string().optional(),
  additionalData: z.record(z.unknown()).optional(),
});

const ingestSchema = z.object({
  importName: z.string().min(1).max(500),
  formatSource: z.enum(["csv", "xes", "json", "webhook"]).default("webhook"),
  events: z.array(eventSchema).min(1).max(5000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!existing)
    return Response.json({ error: "Process not found" }, { status: 404 });

  const parsed = ingestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const dates = parsed.data.events
    .map((e) => new Date(e.timestamp))
    .sort((a, b) => a.getTime() - b.getTime());
  const dateRangeStart = dates[0]?.toISOString().slice(0, 10);
  const dateRangeEnd = dates[dates.length - 1]?.toISOString().slice(0, 10);
  const caseIds = new Set(parsed.data.events.map((e) => e.caseId));
  const activities = new Set(parsed.data.events.map((e) => e.activity));

  const result = await withAuditContext(
    ctx,
    async (tx) => {
      const [log] = await tx
        .insert(processEventLog)
        .values({
          orgId: ctx.orgId,
          processId: id,
          importName: parsed.data.importName,
          formatSource: parsed.data.formatSource,
          eventCount: parsed.data.events.length,
          caseCount: caseIds.size,
          activityCount: activities.size,
          dateRangeStart,
          dateRangeEnd,
          importedBy: ctx.userId,
          status: "imported",
        })
        .returning();

      // Chunk the inserts to avoid blasting a single huge VALUES clause.
      const CHUNK = 500;
      for (let i = 0; i < parsed.data.events.length; i += CHUNK) {
        const slice = parsed.data.events.slice(i, i + CHUNK);
        await tx.insert(processEvent).values(
          slice.map((e) => ({
            eventLogId: log.id,
            orgId: ctx.orgId,
            caseId: e.caseId,
            activity: e.activity,
            timestamp: new Date(e.timestamp),
            resource: e.resource ?? null,
            additionalData: e.additionalData ?? {},
          })),
        );
      }

      return log;
    },
    { actionDetail: `Ingested ${parsed.data.events.length} events` },
  );

  return Response.json({ data: result }, { status: 201 });
}
