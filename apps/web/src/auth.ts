import NextAuth from "next-auth";
import { authConfig } from "@grc/auth";
import { credentialsProvider, logAccessEvent } from "@grc/auth/providers";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [credentialsProvider],
  events: {
    async signOut(message) {
      // Log logout event to access_log
      const token = "token" in message ? message.token : null;
      if (token?.email) {
        await logAccessEvent({
          userId: token.userId as string | undefined,
          emailAttempted: token.email as string,
          eventType: "logout",
        });
      }
    },
  },
});
