import NextAuth from "next-auth";
import { authConfig } from "@grc/auth";

// Middleware uses the edge-safe config (no DB imports).
// It only verifies the JWT — no credential validation happens here.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes — no auth required
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return;
  }

  // All other routes require authentication
  if (!req.auth?.user) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
