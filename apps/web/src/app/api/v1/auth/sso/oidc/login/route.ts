import { db, ssoConfig } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { discoverOIDCEndpoints } from "@grc/auth/oidc";
import { generatePKCE } from "@grc/auth/oidc";
import { cookies } from "next/headers";

// GET /api/v1/auth/sso/oidc/login?orgId=... — SP-initiated OIDC login
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");

  if (!orgId) {
    return Response.json({ error: "orgId parameter required" }, { status: 400 });
  }

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
    return Response.json(
      { error: "OIDC SSO not configured for this organization" },
      { status: 404 },
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://localhost:3000";
  const callbackUrl = url.searchParams.get("callbackUrl") ?? "/dashboard";

  try {
    const discovery = await discoverOIDCEndpoints(config.oidcDiscoveryUrl);
    const pkce = generatePKCE();
    const nonce = crypto.randomUUID();

    // Store state in httpOnly cookie for CSRF protection
    const state = JSON.stringify({
      orgId,
      callbackUrl,
      nonce,
    });
    const stateEncoded = Buffer.from(state).toString("base64url");

    const jar = await cookies();
    // Store PKCE verifier in cookie (httpOnly, secure)
    jar.set("arctos-oidc-verifier", pkce.verifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes
    });
    jar.set("arctos-oidc-state", stateEncoded, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    const params = new URLSearchParams({
      client_id: config.oidcClientId,
      response_type: "code",
      scope: config.oidcScopes ?? "openid profile email",
      redirect_uri: `${baseUrl}/api/v1/auth/sso/oidc/callback`,
      state: stateEncoded,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
      nonce,
    });

    const redirectUrl = `${discovery.authorization_endpoint}?${params.toString()}`;
    return Response.redirect(redirectUrl, 302);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OIDC discovery failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
