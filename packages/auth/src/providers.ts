// Auth providers — Node.js only (requires DB access)
// These are imported in apps/web/src/auth.ts, NOT in middleware.

import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { compare } from "bcryptjs";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { db } from "@grc/db";
import { user, userOrganizationRole, accessLog, ssoConfig } from "@grc/db";
import type { RoleAssignment } from "./types";
import type { Provider } from "next-auth/providers";

/** Write an entry to the access_log table. */
export async function logAccessEvent(params: {
  userId?: string;
  emailAttempted: string;
  eventType: "login_success" | "login_failed" | "logout" | "password_change" | "session_expired";
  authMethod?: "password" | "sso_azure_ad" | "sso_oidc" | "api_key" | "mfa_totp" | "mfa_webauthn";
  failureReason?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  await db.insert(accessLog).values({
    userId: params.userId,
    emailAttempted: params.emailAttempted,
    eventType: params.eventType,
    authMethod: params.authMethod ?? "password",
    failureReason: params.failureReason,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
  });
}

async function loadRoles(userId: string): Promise<RoleAssignment[]> {
  const rows = await db
    .select({
      orgId: userOrganizationRole.orgId,
      role: userOrganizationRole.role,
      lineOfDefense: userOrganizationRole.lineOfDefense,
    })
    .from(userOrganizationRole)
    .where(
      and(
        eq(userOrganizationRole.userId, userId),
        isNull(userOrganizationRole.deletedAt),
      ),
    );
  return rows as RoleAssignment[];
}

/**
 * Extract IP address and User-Agent from an incoming request.
 * Works with both standard Request and NextAuth's request objects.
 */
export function extractRequestInfo(request?: Request | { headers?: Headers }): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  if (!request || !request.headers) {
    return { ipAddress: undefined, userAgent: undefined };
  }
  const headers = request.headers;
  // Prefer forwarded headers (reverse proxy / load balancer), fall back to direct connection
  const ipAddress =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    undefined;
  const userAgent = headers.get("user-agent") || undefined;
  return { ipAddress, userAgent };
}

/**
 * Sprint 20: Check if any org in the given list enforces SSO.
 * Returns true if at least one org has SSO enforcement enabled.
 */
async function checkSsoEnforcement(orgIds: string[]): Promise<boolean> {
  if (!orgIds.length) return false;
  try {
    const result = await db
      .select({ enforceSSO: ssoConfig.enforceSSO })
      .from(ssoConfig)
      .where(
        and(
          inArray(ssoConfig.orgId, orgIds),
          eq(ssoConfig.enforceSSO, true),
          eq(ssoConfig.isActive, true),
          isNull(ssoConfig.deletedAt),
        ),
      );
    return result.length > 0;
  } catch {
    // If sso_config table doesn't exist yet, no enforcement
    return false;
  }
}

export const credentialsProvider = Credentials({
  id: "credentials",
  name: "Email & Password",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials, request) {
    const email = credentials?.email as string | undefined;
    const password = credentials?.password as string | undefined;
    if (!email || !password) return null;

    // Extract IP and UA from the request (Auth.js v5 passes it as second arg)
    const { ipAddress, userAgent } = extractRequestInfo(request);

    const [found] = await db
      .select()
      .from(user)
      .where(
        and(
          eq(user.email, email),
          eq(user.isActive, true),
          isNull(user.deletedAt),
        ),
      );

    if (!found?.passwordHash) {
      await logAccessEvent({
        emailAttempted: email,
        eventType: "login_failed",
        failureReason: "user_not_found",
        ipAddress,
        userAgent,
      });
      return null;
    }

    // Sprint 20: Check SSO enforcement for user's orgs
    // If any org enforces SSO, only admins can use local login
    const roles = await loadRoles(found.id);
    const orgIds = [...new Set(roles.map((r) => r.orgId))];
    if (orgIds.length > 0) {
      const ssoEnforced = await checkSsoEnforcement(orgIds);
      if (ssoEnforced) {
        const isAdmin = roles.some((r) => r.role === "admin");
        if (!isAdmin) {
          await logAccessEvent({
            userId: found.id,
            emailAttempted: email,
            eventType: "login_failed",
            failureReason: "sso_enforced",
            ipAddress,
            userAgent,
          });
          return null;
        }
      }
    }

    const valid = await compare(password, found.passwordHash);
    if (!valid) {
      await logAccessEvent({
        userId: found.id,
        emailAttempted: email,
        eventType: "login_failed",
        failureReason: "invalid_password",
        ipAddress,
        userAgent,
      });
      return null;
    }

    // Update last login timestamp + log success
    await db.execute(
      sql`UPDATE "user" SET last_login_at = now() WHERE id = ${found.id}`,
    );
    await logAccessEvent({
      userId: found.id,
      emailAttempted: email,
      eventType: "login_success",
      ipAddress,
      userAgent,
    });

    return {
      id: found.id,
      email: found.email,
      name: found.name,
      language: found.language,
      roles,
    };
  },
});

// ──────────────────────────────────────────────────────────────
// Azure AD (Microsoft Entra ID) SSO — S1-07
// Conditionally enabled when all three env vars are present.
// ──────────────────────────────────────────────────────────────

/** Returns true when Azure AD SSO environment variables are configured. */
export function isAzureAdConfigured(): boolean {
  return !!(
    process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_CLIENT_SECRET &&
    process.env.AZURE_AD_TENANT_ID
  );
}

/**
 * JIT (just-in-time) provisioning for SSO users.
 * If no user record exists for the given email, one is created.
 * Returns the user's id, email, name, language, and loaded roles.
 */
export async function jitProvisionSsoUser(profile: {
  email: string;
  name: string;
  ssoProviderId?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{
  id: string;
  email: string;
  name: string;
  language: string;
  roles: RoleAssignment[];
}> {
  const email = profile.email.toLowerCase();

  // Check for existing user
  const [existing] = await db
    .select()
    .from(user)
    .where(
      and(
        eq(user.email, email),
        isNull(user.deletedAt),
      ),
    );

  if (existing) {
    // Update last login + SSO provider link if not yet set
    await db.execute(
      sql`UPDATE "user"
          SET last_login_at = now(),
              sso_provider_id = COALESCE(sso_provider_id, ${profile.ssoProviderId ?? null}),
              is_active = true
          WHERE id = ${existing.id}`,
    );

    await logAccessEvent({
      userId: existing.id,
      emailAttempted: email,
      eventType: "login_success",
      authMethod: "sso_azure_ad",
      ipAddress: profile.ipAddress,
      userAgent: profile.userAgent,
    });

    const roles = await loadRoles(existing.id);
    return {
      id: existing.id,
      email: existing.email,
      name: existing.name,
      language: existing.language,
      roles,
    };
  }

  // JIT: Create new user record for first-time SSO login
  const [created] = await db
    .insert(user)
    .values({
      email,
      name: profile.name || email,
      ssoProviderId: profile.ssoProviderId,
      emailVerified: new Date(),
      isActive: true,
      language: "de", // Default language per i18n fallback convention
      lastLoginAt: new Date(),
    })
    .returning();

  await logAccessEvent({
    userId: created.id,
    emailAttempted: email,
    eventType: "login_success",
    authMethod: "sso_azure_ad",
    ipAddress: profile.ipAddress,
    userAgent: profile.userAgent,
  });

  // New user has no roles yet — admin must assign via user management
  return {
    id: created.id,
    email: created.email,
    name: created.name,
    language: created.language,
    roles: [],
  };
}

/**
 * Build the Azure AD (Microsoft Entra ID) provider.
 * Uses OIDC protocol with tenant-scoped issuer for organization-only login.
 * Returns undefined when env vars are missing so it can be filtered out.
 */
export function buildAzureAdProvider(): Provider | undefined {
  if (!isAzureAdConfigured()) return undefined;

  return MicrosoftEntraID({
    clientId: process.env.AZURE_AD_CLIENT_ID!,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
    issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID!}/v2.0`,
    authorization: {
      params: {
        scope: "openid profile email",
      },
    },
    // Map Entra ID profile fields to the user object for the signIn callback
    profile(profile) {
      return {
        id: profile.oid ?? profile.sub,
        email: profile.email ?? profile.preferred_username,
        name: profile.name ?? profile.preferred_username,
        image: null,
      };
    },
  });
}
