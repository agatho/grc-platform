import { db, connectorSchedule, evidenceConnector } from "@grc/db";
import { createConnectorScheduleSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/connectors/:id/schedules — Create schedule
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [connector] = await db
    .select({ id: evidenceConnector.id })
    .from(evidenceConnector)
    .where(and(eq(evidenceConnector.id, id), eq(evidenceConnector.orgId, ctx.orgId), isNull(evidenceConnector.deletedAt)));

  if (!connector) {
    return Response.json({ error: "Connector not found" }, { status: 404 });
  }

  const body = createConnectorScheduleSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(connectorSchedule)
      .values({
        orgId: ctx.orgId,
        connectorId: id,
        cronExpression: body.data.cronExpression,
        timezone: body.data.timezone,
        isEnabled: body.data.isEnabled,
        testIds: body.data.testIds ?? [],
        maxRetries: body.data.maxRetries,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/connectors/:id/schedules — List schedules
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const items = await db
    .select()
    .from(connectorSchedule)
    .where(and(eq(connectorSchedule.connectorId, id), eq(connectorSchedule.orgId, ctx.orgId)));

  return Response.json({ data: items });
}
