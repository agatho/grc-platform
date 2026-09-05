import { db, crisisLog, crisisScenario } from "@grc/db";
import { addCrisisLogEntrySchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
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

// POST /api/v1/bcms/crisis/[id]/log — Add immutable log entry
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: crisisId } = await params;

  const body = addCrisisLogEntrySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify crisis exists
  const [crisis] = await db
    .select({ id: crisisScenario.id })
    .from(crisisScenario)
    .where(
      and(eq(crisisScenario.id, crisisId), eq(crisisScenario.orgId, ctx.orgId)),
    );

  if (!crisis) {
    return Response.json(
      { error: "Crisis scenario not found" },
      { status: 404 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(crisisLog)
      .values({
        crisisScenarioId: crisisId,
        orgId: ctx.orgId,
        entryType: body.data.entryType,
        title: body.data.title,
        description: body.data.description,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
// GET /api/v1/bcms/crisis/[id]/log — List log entries (newest first)
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: crisisId } = await params;
  const { page, limit, offset } = paginate(req);

  const where = and(
    eq(crisisLog.crisisScenarioId, crisisId),
    eq(crisisLog.orgId, ctx.orgId),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(crisisLog)
      .where(where)
      .orderBy(desc(crisisLog.timestamp))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(crisisLog).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
});
