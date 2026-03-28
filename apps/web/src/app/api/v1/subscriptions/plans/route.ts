import { db, subscriptionPlan } from "@grc/db";
import { createSubscriptionPlanSchema } from "@grc/shared";
import { eq, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/subscriptions/plans — List available plans
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const rows = await db
    .select()
    .from(subscriptionPlan)
    .where(eq(subscriptionPlan.isActive, true))
    .orderBy(subscriptionPlan.sortOrder);

  return Response.json({ data: rows });
}

// POST /api/v1/subscriptions/plans — Create plan (admin only)
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createSubscriptionPlanSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [created] = await db
    .insert(subscriptionPlan)
    .values(body.data)
    .returning();

  return Response.json({ data: created }, { status: 201 });
}
