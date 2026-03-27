import { db, ssoConfig } from "@grc/db";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { testSsoLoginSchema } from "@grc/shared";
import { buildAuthnRequest, buildSamlRedirectUrl } from "@grc/auth/saml";
import { discoverOIDCEndpoints } from "@grc/auth/oidc";
import { generatePKCE } from "@grc/auth/oidc";

// POST /api/v1/admin/sso/test — Generate a test login URL
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = await req.json();
  const parsed = testSsoLoginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [config] = await db
    .select()
    .from(ssoConfig)
    .where(eq(ssoConfig.orgId, ctx.orgId));

  if (!config) {
    return Response.json({ error: "No SSO configuration found" }, { status: 404 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://localhost:3000";

  if (parsed.data.provider === "saml") {
    if (!config.samlSsoUrl || !config.samlEntityId) {
      return Response.json(
        { error: "SAML configuration incomplete: missing SSO URL or Entity ID" },
        { status: 400 },
      );
    }

    const { xml, requestId } = buildAuthnRequest({
      issuer: `${baseUrl}/auth/sso/saml`,
      assertionConsumerServiceUrl: `${baseUrl}/api/v1/auth/sso/saml/callback`,
      destination: config.samlSsoUrl,
      forceAuthn: true,
    });

    const redirectUrl = buildSamlRedirectUrl(
      config.samlSsoUrl,
      xml,
      `test:${ctx.orgId}`,
    );

    return Response.json({
      data: { redirectUrl, requestId, provider: "saml" },
    });
  }

  if (parsed.data.provider === "oidc") {
    if (!config.oidcDiscoveryUrl || !config.oidcClientId) {
      return Response.json(
        { error: "OIDC configuration incomplete: missing discovery URL or client ID" },
        { status: 400 },
      );
    }

    const discovery = await discoverOIDCEndpoints(config.oidcDiscoveryUrl);
    const pkce = generatePKCE();

    const params = new URLSearchParams({
      client_id: config.oidcClientId,
      response_type: "code",
      scope: config.oidcScopes ?? "openid profile email",
      redirect_uri: `${baseUrl}/api/v1/auth/sso/oidc/callback`,
      state: `test:${ctx.orgId}`,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
      nonce: crypto.randomUUID(),
      prompt: "login",
    });

    const redirectUrl = `${discovery.authorization_endpoint}?${params.toString()}`;

    return Response.json({
      data: {
        redirectUrl,
        provider: "oidc",
        pkceVerifier: pkce.verifier,
      },
    });
  }

  return Response.json({ error: "Invalid provider" }, { status: 400 });
}
