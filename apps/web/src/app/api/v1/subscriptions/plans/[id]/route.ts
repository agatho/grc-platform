import { db, subscriptionPlan } from "@grc/db";
import { updateSubscriptionPlanSchema } from "@grc/shared";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/subscriptions/plans/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [row] = await db
    .select()
    .from(subscriptionPlan)
    .where(eq(subscriptionPlan.id, id));

  if (!row) {
    return Response.json({ error: "Plan not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}

// PATCH /api/v1/subscriptions/plans/:id
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const body = updateSubscriptionPlanSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [updated] = await db
    .update(subscriptionPlan)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(subscriptionPlan.id, id))
    .returning();

  if (!updated) {
    return Response.json({ error: "Plan not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}
