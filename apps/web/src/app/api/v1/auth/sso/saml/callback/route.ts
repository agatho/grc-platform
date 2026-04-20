import { db, ssoConfig, user, userOrganizationRole } from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import {
  decodeSamlResponse,
  validateSAMLSignature,
  validateSAMLAssertion,
  extractSAMLAttributes,
} from "@grc/auth/saml";
import { resolveRole, groupRoleMappingToEntries } from "@grc/auth";
import { logAccessEvent } from "@grc/auth/providers";
import type { SamlAttributeMapping, GroupRoleMapping } from "@grc/shared";

// POST /api/v1/auth/sso/saml/callback — SAML ACS (Assertion Consumer Service)
export async function POST(req: Request) {
  const formData = await req.formData();
  const samlResponse = formData.get("SAMLResponse") as string;
  const relayStateB64 = formData.get("RelayState") as string;

  if (!samlResponse) {
    return Response.json({ error: "Missing SAMLResponse" }, { status: 400 });
  }

  // Parse relay state
  let orgId: string;
  let callbackUrl = "/dashboard";
  try {
    const relayState = JSON.parse(
      Buffer.from(relayStateB64 ?? "", "base64").toString("utf-8"),
    );
    orgId = relayState.orgId;
    callbackUrl = relayState.callbackUrl ?? "/dashboard";
  } catch {
    return Response.json({ error: "Invalid RelayState" }, { status: 400 });
  }

  // Load SSO config for org
  const [config] = await db
    .select()
    .from(ssoConfig)
    .where(
      and(
        eq(ssoConfig.orgId, orgId),
        eq(ssoConfig.provider, "saml"),
        eq(ssoConfig.isActive, true),
        isNull(ssoConfig.deletedAt),
      ),
    );

  if (!config?.samlCertificate) {
    return Response.json(
      { error: "SAML configuration not found or incomplete" },
      { status: 404 },
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://localhost:3000";

  try {
    // Decode the SAML response
    const responseXml = decodeSamlResponse(samlResponse);

    // Validate signature
    const signatureValid = validateSAMLSignature(
      responseXml,
      config.samlCertificate,
    );
    if (!signatureValid) {
      await logAccessEvent({
        emailAttempted: "unknown",
        eventType: "login_failed",
        authMethod: "sso_oidc",
        failureReason: "saml_invalid_signature",
      });
      return Response.json(
        { error: "Invalid SAML signature" },
        { status: 401 },
      );
    }

    // Validate assertion (expiry, audience, replay)
    const spEntityId = `${baseUrl}/auth/sso/saml`;
    validateSAMLAssertion(responseXml, spEntityId);

    // Extract user attributes
    const attrMapping =
      (config.samlAttributeMapping as SamlAttributeMapping) ?? {
        email: "email",
        firstName: "givenName",
        lastName: "sn",
        groups: "memberOf",
      };
    const attrs = extractSAMLAttributes(responseXml, attrMapping);

    // JIT Provisioning: create or update user
    const email = attrs.email.toLowerCase();
    const name =
      [attrs.firstName, attrs.lastName].filter(Boolean).join(" ") || email;

    const [existing] = await db
      .select()
      .from(user)
      .where(and(eq(user.email, email), isNull(user.deletedAt)));

    let userId: string;

    if (existing) {
      // Update existing user
      await db.execute(sql`
        UPDATE "user" SET
          name = ${name},
          last_login_at = now(),
          identity_provider = 'saml',
          last_synced_at = now(),
          is_active = true
        WHERE id = ${existing.id}
      `);
      userId = existing.id;
    } else {
      // Create new user via JIT
      if (!config.autoProvision) {
        return Response.json(
          { error: "Auto-provisioning is disabled for this organization" },
          { status: 403 },
        );
      }

      const [created] = await db
        .insert(user)
        .values({
          email,
          name,
          emailVerified: new Date(),
          isActive: true,
          language: "de",
          identityProvider: "saml",
          lastLoginAt: new Date(),
          lastSyncedAt: new Date(),
        })
        .returning();
      userId = created.id;

      // Assign default role
      const groupMapping = (config.groupRoleMapping as GroupRoleMapping) ?? {};
      const mappingEntries = groupRoleMappingToEntries(groupMapping);
      const role = resolveRole(
        attrs.groups ?? [],
        mappingEntries,
        config.defaultRole ?? "viewer",
      );

      await db.insert(userOrganizationRole).values({
        userId,
        orgId,
        role: role as any,
      });
    }

    // Log successful SSO login
    await logAccessEvent({
      userId,
      emailAttempted: email,
      eventType: "login_success",
      authMethod: "sso_oidc",
    });

    // Redirect to the app — the session will be created by Auth.js signIn
    // For SAML callback, we redirect to a special handler that creates the session
    const sessionUrl = new URL(`${baseUrl}/api/v1/auth/sso/session`);
    sessionUrl.searchParams.set("userId", userId);
    sessionUrl.searchParams.set("callbackUrl", callbackUrl);

    // Redirect to login with auto-sign-in token
    const redirectUrl = new URL(`${baseUrl}${callbackUrl}`);
    return Response.redirect(redirectUrl.toString(), 302);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "SAML authentication failed";
    await logAccessEvent({
      emailAttempted: "unknown",
      eventType: "login_failed",
      authMethod: "sso_oidc",
      failureReason: message,
    });
    return Response.json({ error: message }, { status: 401 });
  }
}
