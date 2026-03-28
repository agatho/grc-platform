import { db, developerApp } from "@grc/db";
import { updateDeveloperAppSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/developer-apps/:id
export async function GET(
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
}

// PATCH /api/v1/developer-apps/:id
export async function PATCH(
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
}

// DELETE /api/v1/developer-apps/:id
export async function DELETE(
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
}
