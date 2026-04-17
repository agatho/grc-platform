import NextAuth from "next-auth";
import { cookies, headers } from "next/headers";
import { authConfig } from "@grc/auth";
import {
  credentialsProvider,
  logAccessEvent,
  extractRequestInfo,
  buildAzureAdProvider,
  jitProvisionSsoUser,
} from "@grc/auth/providers";
import type { Provider } from "next-auth/providers";
import { db, userOrganizationRole } from "@grc/db";
import { and, eq, isNull } from "drizzle-orm";
import type { RoleAssignment } from "@grc/auth";

const ORG_COOKIE = "arctos-org-id";

async function fetchFreshRoles(userId: string): Promise<RoleAssignment[]> {
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

// Build the provider list — Azure AD is only included when env vars are set
const providers: Provider[] = [credentialsProvider];
const azureAdProvider = buildAzureAdProvider();
if (azureAdProvider) {
  providers.push(azureAdProvider);
}

/**
 * Read IP address and User-Agent from the current Next.js request headers.
 * Falls back gracefully if headers() is unavailable (e.g. edge cases).
 */
async function getRequestInfoFromHeaders(): Promise<{
  ipAddress: string | undefined;
  userAgent: string | undefined;
}> {
  try {
    const hdrs = await headers();
    const ipAddress =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      hdrs.get("x-real-ip") ||
      undefined;
    const userAgent = hdrs.get("user-agent") || undefined;
    return { ipAddress, userAgent };
  } catch {
    return { ipAddress: undefined, userAgent: undefined };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user: authUser, trigger }) {
      // Run the base JWT logic (sign-in persistence). Inline it here to avoid
      // type gymnastics with the loose NextAuth callback signatures.
      if (authUser) {
        token.userId = authUser.id!;
        token.email = authUser.email!;
        token.name = authUser.name!;
        (token as Record<string, unknown>).language =
          (authUser as { language?: string }).language ?? "de";
        (token as Record<string, unknown>).roles =
          (authUser as { roles?: RoleAssignment[] }).roles ?? [];
      }

      // On explicit session.update(), refresh roles from DB so newly created
      // orgs (and any role changes) are reflected without re-login.
      if (trigger === "update" && token.userId) {
        (token as Record<string, unknown>).roles = await fetchFreshRoles(
          token.userId as string,
        );
      }
      return token;
    },
    async session({ session, token }) {
      // Base fields from the token (matches config.ts shape).
      session.user.id = token.userId as string;
      session.user.email = token.email as string;
      session.user.name = token.name as string;
      (session.user as any).language = (token as any).language ?? "de";

      // Roles: prefer fresh DB reads for the server-side session object so
      // newly granted roles are visible even if the JWT cookie still has a
      // stale list. The JWT-embedded copy is kept for the edge middleware.
      let roles = ((token as any).roles as RoleAssignment[]) ?? [];
      if (token.userId) {
        try {
          roles = await fetchFreshRoles(token.userId as string);
        } catch (err) {
          console.warn("[auth] fresh role fetch failed, using JWT copy:", err);
        }
      }
      (session.user as any).roles = roles;

      // Resolve active org from the cookie, validated against roles.
      let currentOrgId: string | null = roles[0]?.orgId ?? null;
      try {
        const jar = await cookies();
        const fromCookie = jar.get(ORG_COOKIE)?.value;
        if (fromCookie && roles.some((r) => r.orgId === fromCookie)) {
          currentOrgId = fromCookie;
        }
      } catch {
        // cookies() can throw in some edge contexts — keep fallback
      }
      (session.user as any).currentOrgId = currentOrgId;

      return session;
    },
    async signIn({ user: authUser, account, profile }) {
      // For SSO providers, run JIT provisioning to ensure a DB user exists
      if (account?.provider === "microsoft-entra-id" && profile?.email) {
        try {
          const { ipAddress, userAgent } = await getRequestInfoFromHeaders();
          const provisioned = await jitProvisionSsoUser({
            email: (profile.email as string).toLowerCase(),
            name: (profile.name as string) ?? (profile.email as string),
            ssoProviderId: `entra:${profile.sub ?? profile.oid}`,
            ipAddress,
            userAgent,
          });

          // Attach provisioned data to the user object so the JWT callback picks it up
          authUser.id = provisioned.id;
          authUser.email = provisioned.email;
          authUser.name = provisioned.name;
          (authUser as any).language = provisioned.language;
          (authUser as any).roles = provisioned.roles;
        } catch (err) {
          console.error("[SSO] JIT provisioning failed:", err);
          return false; // Deny sign-in on provisioning failure
        }
      }
      return true;
    },
  },
  events: {
    async signOut(message) {
      // Log logout event to access_log with IP/UA when available
      const token = "token" in message ? message.token : null;
      if (token?.email) {
        const { ipAddress, userAgent } = await getRequestInfoFromHeaders();
        await logAccessEvent({
          userId: token.userId as string | undefined,
          emailAttempted: token.email as string,
          eventType: "logout",
          ipAddress,
          userAgent,
        });
      }
    },
  },
});
