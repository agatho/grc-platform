// BPM Overhaul Phase 8: CSV / XES event-log file upload.
//
// Accepts multipart/form-data with a `file` field. Detects format from
// extension and parses accordingly:
//   CSV: header row "case_id,activity,timestamp[,resource]" (or German variants)
//   XES: simple <trace>/<event> elements with concept:name + time:timestamp
// Inline events are then handed to the same ingest path as the JSON endpoint
// in /event-logs/route.ts.

import { db, process, processEventLog, processEvent } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

interface ParsedEvent {
  caseId: string;
  activity: string;
  timestamp: string;
  resource?: string;
}

function parseCsv(text: string): ParsedEvent[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0]
    .split(/[,;\t]/)
    .map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const idxCase = header.findIndex((h) => /^(case|case_id|fall|fall_id|caseid)$/.test(h));
  const idxActivity = header.findIndex((h) =>
    /^(activity|aktivit(ae|ä)t|task|step)$/.test(h),
  );
  const idxTime = header.findIndex((h) =>
    /^(timestamp|zeit|datetime|time|datum)$/.test(h),
  );
  const idxResource = header.findIndex((h) =>
    /^(resource|user|bearbeiter|owner)$/.test(h),
  );
  if (idxCase === -1 || idxActivity === -1 || idxTime === -1) {
    throw new Error(
      "CSV must contain case_id, activity, timestamp columns (or German equivalents)",
    );
  }
  const out: ParsedEvent[] = [];
  for (const line of lines.slice(1)) {
    const cells = line
      .match(/(".*?"|[^,;\t]+)(?=\s*[,;\t]|\s*$)/g)
      ?.map((c) => c.trim().replace(/^"|"$/g, "")) ?? [];
    if (cells.length < 3) continue;
    out.push({
      caseId: cells[idxCase]?.slice(0, 200) ?? "",
      activity: cells[idxActivity]?.slice(0, 500) ?? "",
      timestamp: new Date(cells[idxTime]).toISOString(),
      resource: idxResource >= 0 ? cells[idxResource] : undefined,
    });
  }
  return out;
}

function parseXes(xml: string): ParsedEvent[] {
  // Lightweight XES parser — extracts <trace> blocks and their <event>
  // children with concept:name and time:timestamp attributes.
  const events: ParsedEvent[] = [];
  const traceRe = /<trace>([\s\S]*?)<\/trace>/g;
  let traceMatch: RegExpExecArray | null;
  while ((traceMatch = traceRe.exec(xml)) !== null) {
    const traceBlock = traceMatch[1];
    const caseMatch =
      traceBlock.match(/<string\s+key="concept:name"\s+value="([^"]+)"/) ??
      traceBlock.match(/<string\s+key="case:concept:name"\s+value="([^"]+)"/);
    const caseId = caseMatch?.[1] ?? `case-${events.length}`;
    const eventRe = /<event>([\s\S]*?)<\/event>/g;
    let evMatch: RegExpExecArray | null;
    while ((evMatch = eventRe.exec(traceBlock)) !== null) {
      const eb = evMatch[1];
      const actMatch = eb.match(/<string\s+key="concept:name"\s+value="([^"]+)"/);
      const tsMatch = eb.match(/<date\s+key="time:timestamp"\s+value="([^"]+)"/);
      const resMatch = eb.match(/<string\s+key="org:resource"\s+value="([^"]+)"/);
      if (!actMatch || !tsMatch) continue;
      events.push({
        caseId,
        activity: actMatch[1],
        timestamp: new Date(tsMatch[1]).toISOString(),
        resource: resMatch?.[1],
      });
    }
  }
  return events;
}

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
    .where(and(eq(process.id, id), eq(process.orgId, ctx.orgId), isNull(process.deletedAt)));
  if (!existing) return Response.json({ error: "Process not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "multipart field `file` required" }, { status: 422 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return Response.json({ error: "File too large (max 20MB)" }, { status: 422 });
  }

  const text = await file.text();
  let events: ParsedEvent[];
  let format: "csv" | "xes";
  try {
    if (file.name.toLowerCase().endsWith(".xes") || /<log\b/.test(text.slice(0, 200))) {
      events = parseXes(text);
      format = "xes";
    } else {
      events = parseCsv(text);
      format = "csv";
    }
  } catch (err) {
    return Response.json(
      { error: "Parse failure", details: (err as Error).message },
      { status: 422 },
    );
  }

  if (events.length === 0) {
    return Response.json({ error: "No events parsed from file" }, { status: 422 });
  }

  const sortedDates = events.map((e) => e.timestamp).sort();
  const importName = (form.get("importName") as string) ?? file.name;

  const result = await withAuditContext(
    ctx,
    async (tx) => {
      const [log] = await tx
        .insert(processEventLog)
        .values({
          orgId: ctx.orgId,
          processId: id,
          importName,
          formatSource: format,
          eventCount: events.length,
          caseCount: new Set(events.map((e) => e.caseId)).size,
          activityCount: new Set(events.map((e) => e.activity)).size,
          dateRangeStart: sortedDates[0]?.slice(0, 10),
          dateRangeEnd: sortedDates[sortedDates.length - 1]?.slice(0, 10),
          importedBy: ctx.userId,
          status: "imported",
        })
        .returning();

      const CHUNK = 500;
      for (let i = 0; i < events.length; i += CHUNK) {
        const slice = events.slice(i, i + CHUNK);
        await tx.insert(processEvent).values(
          slice.map((e) => ({
            eventLogId: log.id,
            orgId: ctx.orgId,
            caseId: e.caseId,
            activity: e.activity,
            timestamp: new Date(e.timestamp),
            resource: e.resource ?? null,
            additionalData: {},
          })),
        );
      }
      return log;
    },
    { actionDetail: `Uploaded ${format.toUpperCase()} event log: ${events.length} events` },
  );

  return Response.json({ data: result }, { status: 201 });
}
