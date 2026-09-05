import { db, connectorHealthCheck, evidenceConnector } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/connectors/:id/health — Get health check history
export const GET = withErrorHandler(async function GET(
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
});
// POST /api/v1/connectors/:id/health — Trigger health check
export const POST = withErrorHandler(async function POST(
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

  // ── [ARCTOS-FULL-2026-08-31 / WP9 · S14-02] ──────────────────────────
  //
  // `const healthStatus = connector.status === "active" ? "healthy" :
  // "unhealthy"` derived connectivity from a row in our own database — a
  // connector whose credentials expired last month is "active", therefore
  // "healthy", with a `responseTimeMs` measured across two adjacent
  // `Date.now()` calls (always 0). The row landed in
  // `connector_health_check`, which is what the connector dashboard and any
  // evidence-freshness argument rely on.
  //
  // Nothing is written until something is actually measured.
  return Response.json(
    {
      error: "Not implemented",
      detail:
        "Connector health cannot be measured in this build: no provider " +
        "client is wired up, and the configured status in our own database " +
        "is not evidence of connectivity. Refusing to record an unmeasured " +
        "health check.",
      connectorId: id,
      configuredStatus: connector.status,
    },
    { status: 501 },
  );
});
