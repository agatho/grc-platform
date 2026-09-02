import { db, customFieldDefinition } from "@grc/db";
import { createCustomFieldSchema } from "@grc/shared";
import { eq, and, count, desc } from "drizzle-orm";
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

// GET /api/v1/admin/custom-fields — List all custom field definitions
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset } = paginate(req);

  const where = eq(customFieldDefinition.orgId, ctx.orgId);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(customFieldDefinition)
      .where(where)
      .orderBy(
        customFieldDefinition.entityType,
        customFieldDefinition.sortOrder,
      )
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(customFieldDefinition).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
});
// POST /api/v1/admin/custom-fields — Create custom field definition
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createCustomFieldSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [field] = await tx
      .insert(customFieldDefinition)
      .values({
        orgId: ctx.orgId,
        ...body.data,
      })
      .returning();
    return field;
  });

  return Response.json({ data: created }, { status: 201 });
});
