import NextAuth from "next-auth";
import { authConfig } from "@grc/auth";
import { credentialsProvider } from "@grc/auth/providers";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [credentialsProvider],
});
