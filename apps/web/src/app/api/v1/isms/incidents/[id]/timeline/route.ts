import { db, incidentTimelineEntry, securityIncident } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createIncidentTimelineEntrySchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/isms/incidents/[id]/timeline
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: incidentId } = await params;

  // Verify incident exists in org
  const [incident] = await db
    .select({ id: securityIncident.id })
    .from(securityIncident)
    .where(
      and(
        eq(securityIncident.id, incidentId),
        eq(securityIncident.orgId, ctx.orgId),
        isNull(securityIncident.deletedAt),
      ),
    )
    .limit(1);

  if (!incident) {
    return Response.json({ error: "Incident not found" }, { status: 404 });
  }

  const entries = await db
    .select()
    .from(incidentTimelineEntry)
    .where(
      and(
        eq(incidentTimelineEntry.incidentId, incidentId),
        eq(incidentTimelineEntry.orgId, ctx.orgId),
      ),
    )
    .orderBy(incidentTimelineEntry.occurredAt);

  return Response.json({ data: entries });
});
// POST /api/v1/isms/incidents/[id]/timeline
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: incidentId } = await params;
  const body = await req.json();

  const parsed = createIncidentTimelineEntrySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  // Verify incident exists in org
  const [incident] = await db
    .select({ id: securityIncident.id })
    .from(securityIncident)
    .where(
      and(
        eq(securityIncident.id, incidentId),
        eq(securityIncident.orgId, ctx.orgId),
        isNull(securityIncident.deletedAt),
      ),
    )
    .limit(1);

  if (!incident) {
    return Response.json({ error: "Incident not found" }, { status: 404 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(incidentTimelineEntry)
      .values({
        incidentId,
        orgId: ctx.orgId,
        actionType: data.actionType,
        description: data.description,
        occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
        addedBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
