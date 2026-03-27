import { db, ssoConfig, user, userOrganizationRole } from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { discoverOIDCEndpoints, exchangeCode, validateIdToken, extractOidcAttributes } from "@grc/auth/oidc";
import { resolveRole, groupRoleMappingToEntries } from "@grc/auth";
import { logAccessEvent } from "@grc/auth/providers";
import type { OidcClaimMapping, GroupRoleMapping } from "@grc/shared";

// GET /api/v1/auth/sso/oidc/callback — OIDC authorization callback
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    const errorDesc = url.searchParams.get("error_description") ?? error;
    return Response.json({ error: `OIDC error: ${errorDesc}` }, { status: 401 });
  }

  if (!code || !stateParam) {
    return Response.json({ error: "Missing code or state parameter" }, { status: 400 });
  }

  // Validate state against cookie (CSRF protection)
  const jar = await cookies();
  const storedState = jar.get("arctos-oidc-state")?.value;
  const storedVerifier = jar.get("arctos-oidc-verifier")?.value;

  if (!storedState || storedState !== stateParam) {
    return Response.json(
      { error: "State mismatch — potential CSRF attack" },
      { status: 403 },
    );
  }

  if (!storedVerifier) {
    return Response.json(
      { error: "Missing PKCE verifier — session may have expired" },
      { status: 400 },
    );
  }

  // Clean up cookies
  jar.delete("arctos-oidc-state");
  jar.delete("arctos-oidc-verifier");

  // Parse state
  let orgId: string;
  let callbackUrl = "/dashboard";
  let nonce: string | undefined;
  try {
    const state = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf-8"));
    orgId = state.orgId;
    callbackUrl = state.callbackUrl ?? "/dashboard";
    nonce = state.nonce;
  } catch {
    return Response.json({ error: "Invalid state parameter" }, { status: 400 });
  }

  // Load SSO config
  const [config] = await db
    .select()
    .from(ssoConfig)
    .where(
      and(
        eq(ssoConfig.orgId, orgId),
        eq(ssoConfig.provider, "oidc"),
        eq(ssoConfig.isActive, true),
        isNull(ssoConfig.deletedAt),
      ),
    );

  if (!config?.oidcDiscoveryUrl || !config?.oidcClientId) {
    return Response.json({ error: "OIDC configuration not found" }, { status: 404 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://localhost:3000";

  try {
    // Discover endpoints
    const discovery = await discoverOIDCEndpoints(config.oidcDiscoveryUrl);

    // Exchange code for tokens (PKCE mandatory)
    const tokens = await exchangeCode({
      tokenEndpoint: discovery.token_endpoint,
      code,
      redirectUri: `${baseUrl}/api/v1/auth/sso/oidc/callback`,
      clientId: config.oidcClientId,
      clientSecret: config.oidcClientSecret ?? undefined,
      codeVerifier: storedVerifier,
    });

    // Validate ID token
    const claims = validateIdToken(tokens.id_token, {
      issuer: discovery.issuer,
      audience: config.oidcClientId,
      nonce,
    });

    // Extract user attributes
    const claimMapping = (config.oidcClaimMapping as Record<string, string>) ?? {
      email: "email",
      firstName: "given_name",
      lastName: "family_name",
      groups: "groups",
    };
    const attrs = extractOidcAttributes(claims, claimMapping);

    // JIT Provisioning
    const email = attrs.email.toLowerCase();
    const name = [attrs.firstName, attrs.lastName].filter(Boolean).join(" ") || email;

    const [existing] = await db
      .select()
      .from(user)
      .where(and(eq(user.email, email), isNull(user.deletedAt)));

    let userId: string;

    if (existing) {
      await db.execute(sql`
        UPDATE "user" SET
          name = ${name},
          last_login_at = now(),
          identity_provider = 'oidc',
          last_synced_at = now(),
          is_active = true
        WHERE id = ${existing.id}
      `);
      userId = existing.id;
    } else {
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
          identityProvider: "oidc",
          lastLoginAt: new Date(),
          lastSyncedAt: new Date(),
          externalId: claims.sub,
        })
        .returning();
      userId = created.id;

      const groupMapping = (config.groupRoleMapping as GroupRoleMapping) ?? {};
      const mappingEntries = groupRoleMappingToEntries(groupMapping);
      const role = resolveRole(attrs.groups ?? [], mappingEntries, config.defaultRole ?? "viewer");

      await db.insert(userOrganizationRole).values({
        userId,
        orgId,
        role: role as any,
      });
    }

    await logAccessEvent({
      userId,
      emailAttempted: email,
      eventType: "login_success",
      authMethod: "sso_oidc",
    });

    const redirectUrl = new URL(`${baseUrl}${callbackUrl}`);
    return Response.redirect(redirectUrl.toString(), 302);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OIDC authentication failed";
    await logAccessEvent({
      emailAttempted: "unknown",
      eventType: "login_failed",
      authMethod: "sso_oidc",
      failureReason: message,
    });
    return Response.json({ error: message }, { status: 401 });
  }
}
