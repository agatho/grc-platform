import { db, frameworkMapping } from "@grc/db";
import { updateFrameworkMappingSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext, requirePlatformAdmin } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const [row] = await db
    .select()
    .from(frameworkMapping)
    .where(eq(frameworkMapping.id, id));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
});
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
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
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const body = updateFrameworkMappingSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.data.relationshipType)
    updateData.relationshipType = body.data.relationshipType;
  if (body.data.confidence !== undefined)
    updateData.confidence = String(body.data.confidence);
  if (body.data.rationale !== undefined)
    updateData.rationale = body.data.rationale;
  if (body.data.isVerified !== undefined) {
    updateData.isVerified = body.data.isVerified;
    if (body.data.isVerified) {
      updateData.verifiedBy = ctx.userId;
      updateData.verifiedAt = new Date();
    }
  }

  const [updated] = await db
    .update(frameworkMapping)
    .set(updateData)
    .where(eq(frameworkMapping.id, id))
    .returning();
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: updated });
});
