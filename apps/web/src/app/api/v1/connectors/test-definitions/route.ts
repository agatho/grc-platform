import { db, connectorTestDefinition } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/connectors/test-definitions — List test definition catalog
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(connectorTestDefinition.isActive, true)];

  const connectorType = searchParams.get("connectorType");
  if (connectorType) {
    conditions.push(eq(connectorTestDefinition.connectorType, connectorType));
  }

  const category = searchParams.get("category");
  if (category) {
    conditions.push(eq(connectorTestDefinition.category, category));
  }

  const severity = searchParams.get("severity");
  if (severity) {
    conditions.push(eq(connectorTestDefinition.severity, severity));
  }

  const providerKey = searchParams.get("providerKey");
  if (providerKey) {
    conditions.push(eq(connectorTestDefinition.providerKey, providerKey));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(connectorTestDefinition)
      .where(where)
      .orderBy(desc(connectorTestDefinition.severity))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(connectorTestDefinition).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
});
