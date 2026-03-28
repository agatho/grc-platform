// Sprint 61: Worker — Generate monthly invoices for active subscriptions
import { db, orgSubscription, subscriptionPlan, billingInvoice, usageRecord, usageMeter } from "@grc/db";
import { eq, and, sql, gte, lte } from "drizzle-orm";

function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${year}${month}-${random}`;
}

export async function generateInvoices(): Promise<void> {
  const now = new Date();

  // Find subscriptions with period ending today or in the past
  const dueSubscriptions = await db
    .select({
      subscription: orgSubscription,
      plan: subscriptionPlan,
    })
    .from(orgSubscription)
    .innerJoin(subscriptionPlan, eq(orgSubscription.planId, subscriptionPlan.id))
    .where(and(
      eq(orgSubscription.status, "active"),
      lte(orgSubscription.currentPeriodEnd, now),
    ));

  for (const { subscription, plan } of dueSubscriptions) {
    const price = subscription.billingCycle === "yearly"
      ? plan.priceYearly
      : plan.priceMonthly;

    if (!price || price === 0) continue;

    const tax = Math.round(price * 0.19); // 19% VAT
    const total = price + tax;

    const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    try {
      await db.insert(billingInvoice).values({
        orgId: subscription.orgId,
        subscriptionId: subscription.id,
        invoiceNumber: generateInvoiceNumber(),
        status: "pending",
        subtotal: price,
        tax,
        total,
        currency: plan.currency,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        lineItems: [{
          description: `${plan.name} - ${subscription.billingCycle}`,
          quantity: 1,
          unitPrice: price,
          total: price,
        }],
        dueDate,
      });

      // Advance the subscription period
      const newPeriodStart = new Date(subscription.currentPeriodEnd);
      const newPeriodEnd = new Date(newPeriodStart);
      if (subscription.billingCycle === "yearly") {
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
      } else {
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
      }

      await db
        .update(orgSubscription)
        .set({
          currentPeriodStart: newPeriodStart,
          currentPeriodEnd: newPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(orgSubscription.id, subscription.id));

      console.log(`[invoice-gen] Generated invoice for org ${subscription.orgId}`);
    } catch (err) {
      console.error(
        `[invoice-gen] Failed to generate invoice for org ${subscription.orgId}:`,
        err,
      );
    }
  }
}
