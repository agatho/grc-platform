import { db, generalCatalogEntry } from "@grc/db";
import { createGeneralCatalogEntrySchema } from "@grc/shared";
import { eq, and, isNull, count, desc, ilike, or, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/catalogs/objects — List general catalog objects
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(generalCatalogEntry.orgId, ctx.orgId),
    isNull(generalCatalogEntry.deletedAt),
  ];

  // Object type filter
  const objectType = searchParams.get("objectType");
  if (objectType) {
    const types = objectType.split(",") as Array<
      | "it_system"
      | "application"
      | "role"
      | "department"
      | "location"
      | "vendor"
      | "standard"
      | "regulation"
      | "custom"
    >;
    conditions.push(inArray(generalCatalogEntry.objectType, types));
  }

  // Status filter
  const status = searchParams.get("status");
  if (status) {
    conditions.push(eq(generalCatalogEntry.status, status));
  }

  // Search
  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(generalCatalogEntry.name, pattern),
        ilike(generalCatalogEntry.description, pattern),
      )!,
    );
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(generalCatalogEntry)
      .where(where)
      .orderBy(desc(generalCatalogEntry.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(generalCatalogEntry).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
});
// POST /api/v1/catalogs/objects — Create general catalog object
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
  );
  if (ctx instanceof Response) return ctx;

  const body = createGeneralCatalogEntrySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(generalCatalogEntry)
      .values({
        orgId: ctx.orgId,
        ...body.data,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
