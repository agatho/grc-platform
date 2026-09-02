import { db, ssoConfig } from "@grc/db";
import { eq, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  createSsoConfigSchema,
  updateSsoConfigSchema,
  sealSecret,
} from "@grc/shared";
import { inspectIdpCertificate } from "@grc/auth/saml";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// oidc_client_secret is encrypted at rest (Wave-24 F#1 follow-up):
// sealSecret() wraps the plaintext in the v1 AES-256-GCM envelope keyed
// by SECRET_ENCRYPTION_KEY before any INSERT/UPDATE. sealSecret is
// idempotent, so legacy plaintext rows migrate on the next save.
// Responses never contain the secret (masked below).

/** Mask the client secret in API responses — never return it, not even encrypted. */
function maskSsoSecret<T extends { oidcClientSecret: string | null }>(
  config: T,
): T {
  return {
    ...config,
    oidcClientSecret: config.oidcClientSecret ? "••••••••" : null,
  };
}

/**
 * Zertifikatsstatus fuer die Betriebsansicht. Gibt `null` zurueck, wenn gar
 * kein Zertifikat konfiguriert ist (OIDC-Betrieb), und einen `error`-Eintrag,
 * wenn das Feld kein X.509-Zertifikat enthaelt — beides ist eine Aussage, ein
 * fehlender Schluessel im JSON waere keine.
 */
function describeSamlCertificate(pem: string | null) {
  if (!pem?.trim()) return null;
  try {
    const info = inspectIdpCertificate(pem);
    return {
      subject: info.subject,
      issuer: info.issuer,
      selfSigned: info.selfSigned,
      validFrom: info.validFrom.toISOString(),
      validTo: info.validTo.toISOString(),
      daysUntilExpiry: info.daysUntilExpiry,
      expired: info.expired,
      notYetValid: info.notYetValid,
      expiresSoon: info.expiresSoon,
      certificateCount: info.certificateCount,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// GET /api/v1/admin/sso — Get SSO configuration for current org
export const GET = withErrorHandler(async function GET(req: Request) {
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
  return Response.json({
    data: maskSsoSecret(config),
    // [ARCTOS-FULL-2026-08-31 · OP-096] Der Ablauf des IdP-Zertifikats war bis
    // hierher nirgends sichtbar: die Signaturpruefung akzeptierte ein
    // abgelaufenes Zertifikat, und diese Ansicht zeigte nur den PEM-Block.
    // Jetzt lehnt der Anmeldepfad ab (response-validator.ts) — damit das kein
    // Ausfall ohne Vorwarnung wird, gehoert der Status DAHIN, wo der Betreiber
    // das Zertifikat pflegt. `expiresSoon` ist die Zeile, die aus der Rotation
    // einen geplanten Vorgang macht.
    certificate: describeSamlCertificate(config.samlCertificate),
  });
});
// POST /api/v1/admin/sso — Create SSO configuration
export const POST = withErrorHandler(async function POST(req: Request) {
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
        oidcClientSecret: sealSecret(parsed.data.oidcClientSecret),
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

  return Response.json({ data: maskSsoSecret(result) }, { status: 201 });
});
// PUT /api/v1/admin/sso — Update SSO configuration
export const PUT = withErrorHandler(async function PUT(req: Request) {
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
    return Response.json(
      { error: "No SSO configuration found" },
      { status: 404 },
    );
  }

  const updateData: Record<string, unknown> = {
    ...parsed.data,
    updatedBy: ctx.userId,
    updatedAt: new Date(),
  };
  // Remove undefined values
  for (const key of Object.keys(updateData)) {
    if (updateData[key] === undefined) delete updateData[key];
  }
  // Encrypt-at-rest before UPDATE (idempotent for already-sealed values)
  if (typeof updateData.oidcClientSecret === "string") {
    updateData.oidcClientSecret = sealSecret(updateData.oidcClientSecret);
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(ssoConfig)
      .set(updateData)
      .where(eq(ssoConfig.orgId, ctx.orgId))
      .returning();
    return updated;
  });

  return Response.json({ data: maskSsoSecret(result) });
});
// DELETE /api/v1/admin/sso — Delete (soft) SSO configuration
export const DELETE = withErrorHandler(async function DELETE(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(ssoConfig)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
        isActive: false,
        enforceSSO: false,
      })
      .where(eq(ssoConfig.orgId, ctx.orgId));
  });

  return Response.json({ success: true });
});
