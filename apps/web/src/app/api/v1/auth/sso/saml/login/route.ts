import { db, ssoConfig } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { buildAuthnRequest, buildSamlRedirectUrl } from "@grc/auth/saml";

// GET /api/v1/auth/sso/saml/login?orgId=... — SP-initiated SAML login
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
        eq(ssoConfig.provider, "saml"),
        eq(ssoConfig.isActive, true),
        isNull(ssoConfig.deletedAt),
      ),
    );

  if (!config || !config.samlSsoUrl) {
    return Response.json({ error: "SAML SSO not configured for this organization" }, { status: 404 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://localhost:3000";
  const callbackUrl = url.searchParams.get("callbackUrl") ?? "/dashboard";

  const { xml, requestId } = buildAuthnRequest({
    issuer: `${baseUrl}/auth/sso/saml`,
    assertionConsumerServiceUrl: `${baseUrl}/api/v1/auth/sso/saml/callback`,
    destination: config.samlSsoUrl,
  });

  // Store requestId in relay state for InResponseTo validation
  const relayState = JSON.stringify({
    orgId,
    requestId,
    callbackUrl,
  });

  const redirectUrl = buildSamlRedirectUrl(
    config.samlSsoUrl,
    xml,
    Buffer.from(relayState).toString("base64"),
  );

  return Response.redirect(redirectUrl, 302);
}
