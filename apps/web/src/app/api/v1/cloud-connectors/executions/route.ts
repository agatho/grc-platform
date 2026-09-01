import { db, cloudTestExecution, cloudTestSuite } from "@grc/db";
import { triggerCloudTestSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/cloud-connectors/executions — Trigger cloud test suite execution
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = triggerCloudTestSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [suite] = await db
    .select()
    .from(cloudTestSuite)
    .where(
      and(
        eq(cloudTestSuite.id, body.data.suiteId),
        eq(cloudTestSuite.orgId, ctx.orgId),
      ),
    );
  if (!suite)
    return Response.json({ error: "Suite not found" }, { status: 404 });

  // ── [ARCTOS-FULL-2026-08-31 / WP9 · S14-02] ──────────────────────────
  //
  // What stood here wrote a COMPLETE, PASSED test execution without
  // contacting any cloud provider: `status: "completed"`,
  // `passCount = suite.totalTests`, `failCount: 0`, `passRate: "100.00"`
  // and a duration from `Math.random()`. It then set
  // `cloudTestSuite.lastPassRate = "100.00"`. Because the write went
  // through `withAuditContext`, the fabricated row carried an audit-trail
  // entry and a timestamp and was indistinguishable from a real result.
  //
  // In a product whose purpose is evidence that is the worst available
  // failure mode: an auditor reading `cloud_test_execution` sees an
  // unbroken history of passing control tests that never ran, and nothing
  // in the data says otherwise — `results: []` is empty, not marked.
  //
  // The rule applied here and in the other four paths of this finding: no
  // result is better than an invented one. Until a provider client exists,
  // this endpoint refuses, persists nothing, and the absence of a row is
  // the honest state "not tested".
  return Response.json(
    {
      error: "Not implemented",
      detail:
        "Cloud test suites cannot be executed in this build: no provider " +
        "client is wired up. Refusing to record an unmeasured result — an " +
        "absent execution is auditable, a fabricated 'pass' is not.",
      suiteId: suite.id,
      provider: suite.provider,
    },
    { status: 501 },
  );
}

// GET /api/v1/cloud-connectors/executions
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(cloudTestExecution.orgId, ctx.orgId)];

  const provider = searchParams.get("provider");
  if (provider) conditions.push(eq(cloudTestExecution.provider, provider));

  const status = searchParams.get("status");
  if (status) conditions.push(eq(cloudTestExecution.status, status));

  const suiteId = searchParams.get("suiteId");
  if (suiteId) conditions.push(eq(cloudTestExecution.suiteId, suiteId));

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(cloudTestExecution)
      .where(where)
      .orderBy(desc(cloudTestExecution.startedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(cloudTestExecution).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
