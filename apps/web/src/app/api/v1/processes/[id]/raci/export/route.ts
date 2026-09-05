import { db, process, processVersion, processRaciOverride } from "@grc/db";
import { deriveRACIFromBPMN, applyRACIOverrides } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { toCsvRow } from "@/lib/import-export/csv-sanitizer";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/processes/:id/raci/export — RACI as Excel/CSV download
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "process_owner",
    "control_owner",
    "risk_manager",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: processId } = await params;

  // Get process + latest version
  const [proc] = await db
    .select({ id: process.id, title: process.name })
    .from(process)
    .where(
      and(
        eq(process.id, processId),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  const [latestVersion] = await db
    .select({ id: processVersion.id, bpmnXml: processVersion.bpmnXml })
    .from(processVersion)
    .where(eq(processVersion.processId, processId))
    .orderBy(desc(processVersion.versionNumber))
    .limit(1);

  if (!latestVersion?.bpmnXml) {
    return Response.json({ error: "No BPMN available" }, { status: 404 });
  }

  let matrix = deriveRACIFromBPMN(latestVersion.bpmnXml);

  const overrides = await db
    .select({
      activityBpmnId: processRaciOverride.activityBpmnId,
      participantBpmnId: processRaciOverride.participantBpmnId,
      raciRole: processRaciOverride.raciRole,
    })
    .from(processRaciOverride)
    .where(
      and(
        eq(processRaciOverride.processVersionId, latestVersion.id),
        eq(processRaciOverride.orgId, ctx.orgId),
      ),
    );

  if (overrides.length > 0) {
    matrix = applyRACIOverrides(matrix, overrides);
  }

  // #S04-05: this route had NO escaping at all — a raw `join(",")` over
  // activity names and participant names. A comma in a name corrupted the
  // file and a leading `=`/`+`/`-`/`@` produced a live formula. `toCsvRow`
  // neutralizes and quotes every cell, including the header (participant
  // names are user-supplied and appear there).
  const header = toCsvRow([
    "Activity",
    ...matrix.participants.map((p) => p.name),
  ]);
  const rows = matrix.activities.map((activity) => {
    const cells = matrix.participants.map((participant) => {
      const entry = matrix.entries.find(
        (e) =>
          e.activityId === activity.id && e.participantId === participant.id,
      );
      return entry ? entry.role : "";
    });
    return toCsvRow([activity.name, ...cells]);
  });

  const csv = [header, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="raci-${proc.title}.csv"`,
    },
  });
});
