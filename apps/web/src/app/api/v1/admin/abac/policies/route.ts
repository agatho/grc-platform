import { db, abacPolicy } from "@grc/db";
import { createAbacPolicySchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/admin/abac/policies — Create ABAC policy
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createAbacPolicySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(abacPolicy)
      .values({ ...body.data, orgId: ctx.orgId, createdBy: ctx.userId })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
// GET /api/v1/admin/abac/policies — List ABAC policies
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");

  const conditions = [eq(abacPolicy.orgId, ctx.orgId)];
  if (entityType) {
    conditions.push(eq(abacPolicy.entityType, entityType));
  }

  const policies = await db
    .select()
    .from(abacPolicy)
    .where(and(...conditions))
    .orderBy(abacPolicy.priority);

  return Response.json({ data: policies });
});
