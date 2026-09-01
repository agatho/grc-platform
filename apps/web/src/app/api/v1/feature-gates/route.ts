import { db, featureGate } from "@grc/db";
import { createFeatureGateSchema } from "@grc/shared";
import { eq, desc } from "drizzle-orm";
import { withAuth, requirePlatformAdmin } from "@/lib/api";

// GET /api/v1/feature-gates — List all feature gates
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const rows = await db
    .select()
    .from(featureGate)
    .where(eq(featureGate.isActive, true))
    .orderBy(featureGate.key);

  return Response.json({ data: rows });
}

// POST /api/v1/feature-gates — Create feature gate
export async function POST(req: Request) {
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

  const body = createFeatureGateSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [created] = await db
    .insert(featureGate)
    .values({
      ...body.data,
      defaultValue: body.data.defaultValue as Record<string, unknown>,
      planOverrides: body.data.planOverrides,
    })
    .returning();

  return Response.json({ data: created }, { status: 201 });
}
