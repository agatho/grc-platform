import { db, ssoConfig } from "@grc/db";
import { eq, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createSsoConfigSchema, updateSsoConfigSchema } from "@grc/shared";

// GET /api/v1/admin/sso — Get SSO configuration for current org
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const [config] = await db
    .select()
    .from(ssoConfig)
    .where(eq(ssoConfig.orgId, ctx.orgId));

  if (!config) {
    return Response.json({ data: null });
  }

  // Never return the OIDC client secret in full
  const sanitized = {
    ...config,
    oidcClientSecret: config.oidcClientSecret ? "••••••••" : null,
  };

  return Response.json({ data: sanitized });
}

// POST /api/v1/admin/sso — Create SSO configuration
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = await req.json();
  const parsed = createSsoConfigSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Check if config already exists for org
  const [existing] = await db
    .select({ id: ssoConfig.id })
    .from(ssoConfig)
    .where(eq(ssoConfig.orgId, ctx.orgId));

  if (existing) {
    return Response.json(
      { error: "SSO configuration already exists. Use PUT to update." },
      { status: 409 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(ssoConfig)
      .values({
        orgId: ctx.orgId,
        provider: parsed.data.provider,
        displayName: parsed.data.displayName,
        samlMetadataUrl: parsed.data.samlMetadataUrl,
        samlEntityId: parsed.data.samlEntityId,
        samlSsoUrl: parsed.data.samlSsoUrl,
        samlCertificate: parsed.data.samlCertificate,
        samlAttributeMapping: parsed.data.samlAttributeMapping ?? undefined,
        oidcDiscoveryUrl: parsed.data.oidcDiscoveryUrl,
        oidcClientId: parsed.data.oidcClientId,
        oidcClientSecret: parsed.data.oidcClientSecret,
        oidcScopes: parsed.data.oidcScopes,
        oidcClaimMapping: parsed.data.oidcClaimMapping ?? undefined,
        isActive: parsed.data.isActive ?? false,
        enforceSSO: parsed.data.enforceSSO ?? false,
        defaultRole: parsed.data.defaultRole ?? "viewer",
        groupRoleMapping: parsed.data.groupRoleMapping ?? {},
        autoProvision: parsed.data.autoProvision ?? true,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}

// PUT /api/v1/admin/sso — Update SSO configuration
export async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = await req.json();
  const parsed = updateSsoConfigSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: ssoConfig.id })
    .from(ssoConfig)
    .where(eq(ssoConfig.orgId, ctx.orgId));

  if (!existing) {
    return Response.json({ error: "No SSO configuration found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = { ...parsed.data, updatedBy: ctx.userId, updatedAt: new Date() };
  // Remove undefined values
  for (const key of Object.keys(updateData)) {
    if (updateData[key] === undefined) delete updateData[key];
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(ssoConfig)
      .set(updateData)
      .where(eq(ssoConfig.orgId, ctx.orgId))
      .returning();
    return updated;
  });

  return Response.json({ data: result });
}

// DELETE /api/v1/admin/sso — Delete (soft) SSO configuration
export async function DELETE(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(ssoConfig)
      .set({ deletedAt: new Date(), deletedBy: ctx.userId, isActive: false, enforceSSO: false })
      .where(eq(ssoConfig.orgId, ctx.orgId));
  });

  return Response.json({ success: true });
}
