import { db, cloudTestSuite } from "@grc/db";
import { createCloudTestSuiteSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/cloud-connectors/suites
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createCloudTestSuiteSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(cloudTestSuite)
      .values({
        orgId: ctx.orgId,
        connectorId: body.data.connectorId,
        provider: body.data.provider,
        suiteName: body.data.suiteName,
        description: body.data.description,
        testKeys: body.data.testKeys,
        isEnabled: body.data.isEnabled,
        totalTests: body.data.testKeys.length,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/cloud-connectors/suites
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(cloudTestSuite.orgId, ctx.orgId)];

  const provider = searchParams.get("provider");
  if (provider) conditions.push(eq(cloudTestSuite.provider, provider));

  const connectorId = searchParams.get("connectorId");
  if (connectorId) conditions.push(eq(cloudTestSuite.connectorId, connectorId));

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(cloudTestSuite)
      .where(where)
      .orderBy(desc(cloudTestSuite.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(cloudTestSuite).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
