import { db, abacPolicy } from "@grc/db";
import { createAbacPolicySchema } from "@grc/shared";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/admin/abac/policies — Create ABAC policy
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createAbacPolicySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(abacPolicy)
      .values({ ...body.data, orgId: ctx.orgId, createdBy: ctx.userId })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/admin/abac/policies — List ABAC policies
export async function GET(req: Request) {
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
}
