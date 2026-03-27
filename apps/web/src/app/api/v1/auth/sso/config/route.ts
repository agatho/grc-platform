import { db, ssoConfig } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";

// GET /api/v1/auth/sso/config?orgId=... — Public endpoint to check SSO availability
// Used by the login page to determine whether to show SSO button
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");

  if (!orgId) {
    return Response.json({ sso: null });
  }

  const [config] = await db
    .select({
      provider: ssoConfig.provider,
      displayName: ssoConfig.displayName,
      isActive: ssoConfig.isActive,
      enforceSSO: ssoConfig.enforceSSO,
    })
    .from(ssoConfig)
    .where(
      and(
        eq(ssoConfig.orgId, orgId),
        eq(ssoConfig.isActive, true),
        isNull(ssoConfig.deletedAt),
      ),
    );

  if (!config) {
    return Response.json({ sso: null });
  }

  return Response.json({
    sso: {
      provider: config.provider,
      displayName: config.displayName ?? "SSO",
      enforceSSO: config.enforceSSO,
    },
  });
}
