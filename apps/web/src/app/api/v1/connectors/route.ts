import { db, evidenceConnector } from "@grc/db";
import {
  createEvidenceConnectorSchema,
  connectorQuerySchema,
} from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count, desc, ilike } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/connectors — Create evidence connector
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createEvidenceConnectorSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(evidenceConnector)
      .values({
        orgId: ctx.orgId,
        name: body.data.name,
        description: body.data.description,
        connectorType: body.data.connectorType,
        providerKey: body.data.providerKey,
        authMethod: body.data.authMethod,
        baseUrl: body.data.baseUrl,
        config: body.data.config ?? {},
        status: "pending_setup",
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/connectors — List evidence connectors
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(evidenceConnector.orgId, ctx.orgId),
    isNull(evidenceConnector.deletedAt),
  ];

  const connectorType = searchParams.get("connectorType");
  if (connectorType) {
    conditions.push(eq(evidenceConnector.connectorType, connectorType));
  }

  const status = searchParams.get("status");
  if (status) {
    conditions.push(eq(evidenceConnector.status, status));
  }

  const healthStatus = searchParams.get("healthStatus");
  if (healthStatus) {
    conditions.push(eq(evidenceConnector.healthStatus, healthStatus));
  }

  const search = searchParams.get("search");
  if (search) {
    conditions.push(ilike(evidenceConnector.name, `%${search}%`));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(evidenceConnector)
      .where(where)
      .orderBy(desc(evidenceConnector.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(evidenceConnector).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
