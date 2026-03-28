import { db, identityConnectorConfig, identityTestResult } from "@grc/db";
import { triggerIdentitySyncSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/identity-connectors/sync — Trigger identity sync
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = triggerIdentitySyncSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });

  const [config] = await db.select().from(identityConnectorConfig).where(and(eq(identityConnectorConfig.id, body.data.configId), eq(identityConnectorConfig.orgId, ctx.orgId)));
  if (!config) return Response.json({ error: "Config not found" }, { status: 404 });

  const results = await withAuditContext(ctx, async (tx) => {
    await tx.update(identityConnectorConfig).set({ syncStatus: "syncing", updatedAt: new Date() }).where(eq(identityConnectorConfig.id, config.id));

    // Simulated sync — real implementation would call provider APIs
    const testCategories = body.data.categories ?? ["mfa_enforcement", "stale_accounts"];
    const syncResults = [];

    for (const category of testCategories) {
      const [result] = await tx.insert(identityTestResult).values({
        orgId: ctx.orgId,
        connectorId: config.connectorId,
        configId: config.id,
        testCategory: category,
        testName: `${config.identityProvider} - ${category}`,
        status: "pass",
        severity: "medium",
        totalUsers: 100,
        compliantUsers: 95,
        nonCompliantUsers: 5,
        complianceRate: "95.00",
        findings: [],
        evidence: {},
      }).returning();
      syncResults.push(result);
    }

    await tx.update(identityConnectorConfig).set({ syncStatus: "synced", lastSyncAt: new Date(), updatedAt: new Date() }).where(eq(identityConnectorConfig.id, config.id));

    return syncResults;
  });

  return Response.json({ data: { testsRun: results.length, results } }, { status: 201 });
}
