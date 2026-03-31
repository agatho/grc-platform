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
    // API routes get 401 JSON — never redirect to HTML login page
    if (pathname.startsWith("/api/")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
