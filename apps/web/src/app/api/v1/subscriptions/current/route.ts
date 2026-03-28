import { db, orgSubscription, subscriptionPlan } from "@grc/db";
import { createOrgSubscriptionSchema, cancelSubscriptionSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/subscriptions/current — Get org's current subscription
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const [row] = await db
    .select({
      subscription: orgSubscription,
      plan: subscriptionPlan,
    })
    .from(orgSubscription)
    .innerJoin(subscriptionPlan, eq(orgSubscription.planId, subscriptionPlan.id))
    .where(eq(orgSubscription.orgId, ctx.orgId));

  if (!row) {
    return Response.json({ data: null });
  }

  return Response.json({ data: row });
}

// POST /api/v1/subscriptions/current — Create/change subscription
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createOrgSubscriptionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Get the plan
  const [plan] = await db
    .select()
    .from(subscriptionPlan)
    .where(eq(subscriptionPlan.id, body.data.planId));

  if (!plan) {
    return Response.json({ error: "Plan not found" }, { status: 404 });
  }

  const now = new Date();
  const periodEnd = new Date(now);
  if (body.data.billingCycle === "yearly") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const trialEndsAt = plan.trialDays > 0
    ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
    : undefined;

  const [created] = await db
    .insert(orgSubscription)
    .values({
      orgId: ctx.orgId,
      planId: body.data.planId,
      billingCycle: body.data.billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEndsAt,
      paymentMethod: body.data.paymentMethod,
      externalCustomerId: body.data.externalCustomerId,
      status: trialEndsAt ? "trialing" : "active",
    })
    .onConflictDoUpdate({
      target: [orgSubscription.orgId],
      set: {
        planId: body.data.planId,
        billingCycle: body.data.billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentMethod: body.data.paymentMethod,
        status: "active",
        updatedAt: new Date(),
      },
    })
    .returning();

  return Response.json({ data: created }, { status: 201 });
}

// DELETE /api/v1/subscriptions/current — Cancel subscription
export async function DELETE(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  let cancelReason: string | undefined;
  try {
    const body = cancelSubscriptionSchema.safeParse(await req.json());
    if (body.success) {
      cancelReason = body.data.reason;
    }
  } catch {
    // No body is fine
  }

  const [cancelled] = await db
    .update(orgSubscription)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason,
      updatedAt: new Date(),
    })
    .where(eq(orgSubscription.orgId, ctx.orgId))
    .returning();

  if (!cancelled) {
    return Response.json({ error: "No active subscription" }, { status: 404 });
  }

  return Response.json({ data: cancelled });
}
