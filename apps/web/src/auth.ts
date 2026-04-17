import NextAuth from "next-auth";
import { headers } from "next/headers";
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

      // On explicit session.update(), refresh roles from DB. Required so newly
      // created orgs (and any role changes) are reflected without re-login.
      if (trigger === "update" && token.userId) {
        const rows = await db
          .select({
            orgId: userOrganizationRole.orgId,
            role: userOrganizationRole.role,
            lineOfDefense: userOrganizationRole.lineOfDefense,
          })
          .from(userOrganizationRole)
          .where(
            and(
              eq(userOrganizationRole.userId, token.userId as string),
              isNull(userOrganizationRole.deletedAt),
            ),
          );
        (token as Record<string, unknown>).roles = rows as RoleAssignment[];
      }
      return token;
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
