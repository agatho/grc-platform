import { db, developerApp } from "@grc/db";
import { updateDeveloperAppSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/developer-apps/:id
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [row] = await db
    .select({
      id: developerApp.id,
      name: developerApp.name,
      description: developerApp.description,
      clientId: developerApp.clientId,
      clientSecretLast4: developerApp.clientSecretLast4,
      redirectUris: developerApp.redirectUris,
      grantTypes: developerApp.grantTypes,
      status: developerApp.status,
      logoUrl: developerApp.logoUrl,
      homepageUrl: developerApp.homepageUrl,
      privacyUrl: developerApp.privacyUrl,
      tosUrl: developerApp.tosUrl,
      createdAt: developerApp.createdAt,
      updatedAt: developerApp.updatedAt,
    })
    .from(developerApp)
    .where(and(eq(developerApp.id, id), eq(developerApp.orgId, ctx.orgId)));

  if (!row) {
    return Response.json({ error: "Developer app not found" }, { status: 404 });
  }

  return Response.json({ data: row });
});
// PATCH /api/v1/developer-apps/:id
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const body = updateDeveloperAppSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [updated] = await db
    .update(developerApp)
    .set({ ...body.data, updatedAt: new Date() })
    .where(and(eq(developerApp.id, id), eq(developerApp.orgId, ctx.orgId)))
    .returning();

  if (!updated) {
    return Response.json({ error: "Developer app not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
});
// DELETE /api/v1/developer-apps/:id
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [deactivated] = await db
    .update(developerApp)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(and(eq(developerApp.id, id), eq(developerApp.orgId, ctx.orgId)))
    .returning();

  if (!deactivated) {
    return Response.json({ error: "Developer app not found" }, { status: 404 });
  }

  return Response.json({ data: deactivated });
});
