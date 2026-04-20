import { db, connectorHealthCheck, evidenceConnector } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/connectors/:id/health — Get health check history
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const items = await db
    .select()
    .from(connectorHealthCheck)
    .where(
      and(
        eq(connectorHealthCheck.connectorId, id),
        eq(connectorHealthCheck.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(connectorHealthCheck.checkedAt))
    .limit(50);

  return Response.json({ data: items });
}

// POST /api/v1/connectors/:id/health — Trigger health check
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [connector] = await db
    .select()
    .from(evidenceConnector)
    .where(
      and(
        eq(evidenceConnector.id, id),
        eq(evidenceConnector.orgId, ctx.orgId),
        isNull(evidenceConnector.deletedAt),
      ),
    );

  if (!connector) {
    return Response.json({ error: "Connector not found" }, { status: 404 });
  }

  // Simulate health check (real implementation would ping the connector)
  const startMs = Date.now();
  const healthStatus = connector.status === "active" ? "healthy" : "unhealthy";
  const responseTimeMs = Date.now() - startMs;

  const created = await withAuditContext(ctx, async (tx) => {
    const [check] = await tx
      .insert(connectorHealthCheck)
      .values({
        orgId: ctx.orgId,
        connectorId: id,
        status: healthStatus,
        responseTimeMs,
        checkType: "connectivity",
        details: {
          connectorType: connector.connectorType,
          providerKey: connector.providerKey,
        },
      })
      .returning();

    await tx
      .update(evidenceConnector)
      .set({ lastHealthCheck: new Date(), healthStatus, updatedAt: new Date() })
      .where(eq(evidenceConnector.id, id));

    return check;
  });

  return Response.json({ data: created }, { status: 201 });
}
