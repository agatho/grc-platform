import {
  ssoConfig,
  user,
  userOrganizationRole,
  withOrgReadContext,
} from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import {
  discoverOIDCEndpoints,
  exchangeCode,
  validateIdToken,
  extractOidcAttributes,
} from "@grc/auth/oidc";
import { resolveRole, groupRoleMappingToEntries } from "@grc/auth";
import { logAccessEvent } from "@grc/auth/providers";
import { openSecret } from "@grc/shared";
import type { GroupRoleMapping } from "@grc/shared";
import { getBaseUrl } from "@/lib/base-url";
import { isEnumValue } from "../../../../_lib/enum-filter";
import { log } from "@/lib/logger";
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/auth/sso/oidc/callback — OIDC authorization callback
export const GET = withErrorHandler(async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    // #SEC-LEAK-FIX: previously passed `error_description` from the IDP
    // straight to the response. That string is attacker-controllable if
    // an attacker can craft a malicious redirect from a compromised IDP
    // or a misconfigured open IDP — passing it back unfiltered widens
    // any reflected-XSS attack surface in the consuming UI. Logging the
    // detail server-side; client sees a stable opaque message.
    const errorDesc = url.searchParams.get("error_description") ?? error;
    await logAccessEvent({
      emailAttempted: "unknown",
      eventType: "login_failed",
      authMethod: "sso_oidc",
      failureReason: `oidc_callback_error: ${errorDesc}`,
    });
    return Response.json(
      { error: "OIDC authentication failed at the identity provider" },
      { status: 401 },
    );
  }

  if (!code || !stateParam) {
    return Response.json(
      { error: "Missing code or state parameter" },
      { status: 400 },
    );
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
    const state = JSON.parse(
      Buffer.from(stateParam, "base64url").toString("utf-8"),
    );
    orgId = state.orgId;
    callbackUrl = state.callbackUrl ?? "/dashboard";
    nonce = state.nonce;
  } catch {
    return Response.json({ error: "Invalid state parameter" }, { status: 400 });
  }

  // #WP3-S02-05 — `sso_config` has FORCE RLS. This handler is anonymous by
  // design (the IdP redirects the browser back without a session), so no request-scoped org context
  // exists and a plain read under `grc_app` returned 0 rows: SSO looked
  // "not configured" on every production instance. The org is known from the
  // RelayState, so pin it on a dedicated connection for exactly this read.
  const [config] = await withOrgReadContext(orgId, (sdb) =>
    sdb
      .select()
      .from(ssoConfig)
      .where(
        and(
          eq(ssoConfig.orgId, orgId),
          eq(ssoConfig.provider, "oidc"),
          eq(ssoConfig.isActive, true),
          isNull(ssoConfig.deletedAt),
        ),
      ),
  );

  if (!config?.oidcDiscoveryUrl || !config?.oidcClientId) {
    return Response.json(
      { error: "OIDC configuration not found" },
      { status: 404 },
    );
  }

  const baseUrl = getBaseUrl();

  try {
    // Discover endpoints
    const discovery = await discoverOIDCEndpoints(config.oidcDiscoveryUrl);

    // Exchange code for tokens (PKCE mandatory)
    const tokens = await exchangeCode({
      tokenEndpoint: discovery.token_endpoint,
      code,
      redirectUri: `${baseUrl}/api/v1/auth/sso/oidc/callback`,
      clientId: config.oidcClientId,
      // oidc_client_secret is stored as a v1 AES-256-GCM envelope
      // (SECRET_ENCRYPTION_KEY). openSecret() decrypts it and passes
      // legacy plaintext rows through unchanged; those are re-sealed
      // the next time an admin saves the SSO config.
      clientSecret: openSecret(config.oidcClientSecret)?.plaintext,
      codeVerifier: storedVerifier,
    });

    // #WP3-S02-24 — Validate the ID token INCLUDING its signature.
    //
    // Vorher: `validateIdToken` dekodierte den Payload per base64 und prüfte
    // nur iss/aud/exp/iat/nonce. Die JWKS-Abholung im selben Modul wurde nie
    // aufgerufen, `alg` nie geprüft — jedes JWT mit den richtigen Claims wurde
    // akzeptiert. Jetzt wird gegen `jwks_uri` aus dem Discovery-Dokument
    // kryptografisch verifiziert; `alg: none` und HMAC sind ausgeschlossen.
    const claims = await validateIdToken(tokens.id_token, {
      issuer: discovery.issuer,
      audience: config.oidcClientId,
      nonce,
      jwksUri: discovery.jwks_uri,
    });

    // Extract user attributes
    const claimMapping = (config.oidcClaimMapping as Record<
      string,
      string
    >) ?? {
      email: "email",
      firstName: "given_name",
      lastName: "family_name",
      groups: "groups",
    };
    const attrs = extractOidcAttributes(claims, claimMapping);

    // #WP3-S02-05 — the JIT-provisioning block touches `user` and
    // `user_organization_role`, both FORCE-RLS. Without an org context under
    // `grc_app` the existence check returned 0 rows (so every SSO login tried
    // to CREATE the user and hit the unique constraint) and the role insert
    // was rejected by the policy. The org is known from the state/RelayState,
    // so the whole block runs on a connection pinned to it.
    const provisioned = await withOrgReadContext(orgId, async (sdb) => {
      // JIT Provisioning
      const email = attrs.email.toLowerCase();
      const name =
        [attrs.firstName, attrs.lastName].filter(Boolean).join(" ") || email;

      const [existing] = await sdb
        .select()
        .from(user)
        .where(and(eq(user.email, email), isNull(user.deletedAt)));

      let userId: string;

      if (existing) {
        await sdb.execute(sql`
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

        const [created] = await sdb
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

        const groupMapping =
          (config.groupRoleMapping as GroupRoleMapping) ?? {};
        const mappingEntries = groupRoleMappingToEntries(groupMapping);
        const role = resolveRole(
          attrs.groups ?? [],
          mappingEntries,
          config.defaultRole ?? "viewer",
        );

        // [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-076] `resolveRole` gibt
        // `string` zurueck — die Zuordnung Gruppe→Rolle stammt aus der
        // IdP-Konfiguration der Organisation und ist damit frei getippter
        // Text. Mit `as any` ging ein Tippfehler in dieser Konfiguration
        // ungeprueft in eine Aufzaehlungsspalte: die Datenbank wies ihn ab
        // (`invalid input value for enum user_role`), und der SSO-Login
        // scheiterte mit einem 500er statt mit einer Rolle. Unbekannte
        // Werte fallen jetzt auf `viewer` zurueck — den Wert, den die
        // Konfiguration ohnehin als Vorgabe fuehrt — und werden protokolliert.
        const safeRole = isEnumValue(userOrganizationRole.role.enumValues, role)
          ? role
          : "viewer";
        if (safeRole !== role) {
          log.warn(
            "[oidc/callback] unknown role in group mapping, falling back",
            {
              role,
              orgId,
            },
          );
        }

        await sdb.insert(userOrganizationRole).values({
          userId,
          orgId,
          role: safeRole,
        });
      }
      return { userId, email };
    });
    if (provisioned instanceof Response) return provisioned;
    const { userId, email } = provisioned;

    await logAccessEvent({
      userId,
      emailAttempted: email,
      eventType: "login_success",
      authMethod: "sso_oidc",
    });

    const redirectUrl = new URL(`${baseUrl}${callbackUrl}`);
    return Response.redirect(redirectUrl.toString(), 302);
  } catch (err) {
    // #SEC-LEAK-FIX: log the validation-failure detail server-side
    // (which step failed: token exchange, ID-token signature, audience,
    // expiry, nonce) but never return it to the unauthenticated
    // caller — that's intel for an attacker probing the IDP flow.
    const message =
      err instanceof Error ? err.message : "OIDC authentication failed";
    await logAccessEvent({
      emailAttempted: "unknown",
      eventType: "login_failed",
      authMethod: "sso_oidc",
      failureReason: message,
    });
    return Response.json(
      { error: "OIDC authentication failed" },
      { status: 401 },
    );
  }
});
