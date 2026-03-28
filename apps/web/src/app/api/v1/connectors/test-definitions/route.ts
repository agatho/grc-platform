import { db, connectorTestDefinition } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";

// GET /api/v1/connectors/test-definitions — List test definition catalog
export async function GET(req: Request) {
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
    db.select().from(connectorTestDefinition).where(where).orderBy(desc(connectorTestDefinition.severity)).limit(limit).offset(offset),
    db.select({ value: count() }).from(connectorTestDefinition).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
