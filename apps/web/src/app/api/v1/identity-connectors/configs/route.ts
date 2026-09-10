import { db, identityConnectorConfig } from "@grc/db";
import { createIdentityConnectorConfigSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/identity-connectors/configs
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createIdentityConnectorConfigSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(identityConnectorConfig)
      .values({ orgId: ctx.orgId, ...body.data })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
// GET /api/v1/identity-connectors/configs
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(identityConnectorConfig.orgId, ctx.orgId)];

  const provider = searchParams.get("identityProvider");
  if (provider)
    conditions.push(eq(identityConnectorConfig.identityProvider, provider));

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(identityConnectorConfig)
      .where(where)
      .orderBy(desc(identityConnectorConfig.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(identityConnectorConfig).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
});
