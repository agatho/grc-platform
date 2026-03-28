import { db, controlLibraryEntry } from "@grc/db";
import { eq, count, ilike, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { requireModule } from "@grc/auth";

// GET /api/v1/ics/control-library — Browse control library (shared, read-only)
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const conditions = [];
  const category = searchParams.get("category");
  if (category) conditions.push(eq(controlLibraryEntry.category, category));
  const controlType = searchParams.get("controlType");
  if (controlType) conditions.push(eq(controlLibraryEntry.controlType, controlType));
  const framework = searchParams.get("framework");
  if (framework) {
    conditions.push(sql`${controlLibraryEntry.frameworkMappings}::jsonb @> ${JSON.stringify([{ framework }])}::jsonb`);
  }

  const where = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(controlLibraryEntry).where(where)
      .orderBy(controlLibraryEntry.category, controlLibraryEntry.controlRef)
      .limit(limit).offset(offset),
    db.select({ value: count() }).from(controlLibraryEntry).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
