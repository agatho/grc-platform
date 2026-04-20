import { db, featureGate, orgSubscription, subscriptionPlan } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/feature-gates/check?key=feature_key — Check if feature is enabled for org
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (!key) {
    return Response.json({ error: "key parameter required" }, { status: 400 });
  }

  // Get the feature gate
  const [gate] = await db
    .select()
    .from(featureGate)
    .where(and(eq(featureGate.key, key), eq(featureGate.isActive, true)));

  if (!gate) {
    return Response.json({
      data: { enabled: false, reason: "Feature gate not found" },
    });
  }

  // Get org's subscription plan
  const [sub] = await db
    .select({
      subscription: orgSubscription,
      plan: subscriptionPlan,
    })
    .from(orgSubscription)
    .innerJoin(
      subscriptionPlan,
      eq(orgSubscription.planId, subscriptionPlan.id),
    )
    .where(eq(orgSubscription.orgId, ctx.orgId));

  if (!sub) {
    return Response.json({
      data: {
        enabled: gate.defaultValue,
        reason: "No active subscription, using default",
      },
    });
  }

  const planTier = sub.plan.tier;
  const overrides = gate.planOverrides as Record<string, unknown>;
  const value = overrides[planTier] ?? gate.defaultValue;

  return Response.json({
    data: {
      enabled: value,
      plan: planTier,
      reason: `Plan: ${planTier}`,
    },
  });
}
