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
