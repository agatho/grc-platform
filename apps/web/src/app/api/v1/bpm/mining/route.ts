import { db, processEventLog } from "@grc/db";
import { createEventLogImportSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/bpm/mining — List imported event logs
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "process_owner", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { limit, offset } = paginate(new URL(req.url).searchParams);
  const rows = await db
    .select()
    .from(processEventLog)
    .where(eq(processEventLog.orgId, ctx.orgId))
    .orderBy(desc(processEventLog.importedAt))
    .limit(limit)
    .offset(offset);
  return paginatedResponse(rows, rows.length, limit, offset);
});
// POST /api/v1/bpm/mining — Upload event log (returns immediately, async processing)
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createEventLogImportSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(processEventLog)
      .values({
        orgId: ctx.orgId,
        processId: body.data.processId,
        importName: body.data.importName,
        formatSource: body.data.formatSource,
        importedBy: ctx.userId,
        status: "importing",
      })
      .returning();
    return row;
  });

  // In production: queue BullMQ job for async parsing
  // await miningQueue.add('import-event-log', { eventLogId: created.id, columnMapping: body.data.columnMapping });

  return Response.json({ data: created }, { status: 201 });
});
