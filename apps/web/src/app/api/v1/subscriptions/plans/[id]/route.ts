import { db, subscriptionPlan } from "@grc/db";
import { updateSubscriptionPlanSchema } from "@grc/shared";
import { eq } from "drizzle-orm";
import { withAuth, requirePlatformAdmin } from "@/lib/api";

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
  // #WP3-S02-03 (Critical) — diese Tabelle hat KEIN `org_id`, keine RLS und
  // keine Policy; eine Änderung wirkt auf ALLE Mandanten. Der bisherige Guard
  // `withAuth("admin")` (bei framework-mappings sogar `risk_manager`) ist eine
  // PRO-ORGANISATION vergebene Rolle — jeder Mandanten-Admin konnte damit
  // Feature-, Abrechnungs- und Data-Sovereignty-Konfiguration aller Mandanten
  // verändern. Schreibzugriff verlangt jetzt einen Plattform-Admin
  // (Tabelle `platform_admin`, Migration 0411; nicht über die API vergebbar).
  const platformCheck = await requirePlatformAdmin(ctx);
  if (platformCheck) return platformCheck;
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
