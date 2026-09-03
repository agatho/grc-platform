import { db, connectorTestDefinition, evidenceConnector } from "@grc/db";
import { triggerTestRunSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/connectors/:id/test-run — Trigger manual test run
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
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

  const body = triggerTestRunSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Get applicable test definitions
  const testDefs = await db
    .select()
    .from(connectorTestDefinition)
    .where(
      and(
        eq(connectorTestDefinition.connectorType, connector.connectorType),
        eq(connectorTestDefinition.isActive, true),
        body.data.testKeys
          ? inArray(connectorTestDefinition.testKey, body.data.testKeys)
          : undefined,
      ),
    );

  if (testDefs.length === 0) {
    return Response.json(
      { error: "No test definitions found for this connector type" },
      { status: 404 },
    );
  }

  // ── [ARCTOS-FULL-2026-08-31 / WP9 · S14-02] ──────────────────────────
  //
  // This block inserted one `connector_test_result` per test definition
  // with `status: "pass"`, `resourcesFailed: 0` and a `Math.random()`
  // duration, under the comment "simulated — real implementation would call
  // provider APIs". `connector_test_result` is precisely the table an
  // ISO-27001 or SOC-2 assessor reads as evidence of continuous control
  // effectiveness, and `result: { simulated: true }` sat in a JSONB detail
  // field the UI does not render — the marker existed only for whoever
  // opened the source file.
  //
  // No provider client exists in this build, so the honest answer is that
  // no test ran. Nothing is persisted; the missing result stays visible.
  return Response.json(
    {
      error: "Not implemented",
      detail:
        "Connector tests cannot be executed in this build: no provider " +
        "client is wired up. Refusing to record an unmeasured result — a " +
        "missing test result is auditable, a fabricated 'pass' is not.",
      connectorId: id,
      connectorType: connector.connectorType,
      applicableTests: testDefs.map((t) => t.testKey),
    },
    { status: 501 },
  );
});
