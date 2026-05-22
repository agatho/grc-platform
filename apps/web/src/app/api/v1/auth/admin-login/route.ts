import { db, user, userOrganizationRole, ssoConfig } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { compare } from "bcryptjs";
import { breakGlassLoginSchema } from "@grc/shared";
import { logAccessEvent } from "@grc/auth/providers";
import { rateLimit, getClientIp, LIMITS } from "@/lib/rate-limit";

// POST /api/v1/auth/admin-login — Break-glass admin login
// Only works for admin users when SSO enforcement is active
//
// #SEC-HIGH-RL: rate-limit by client IP. The break-glass endpoint
// bypasses NextAuth's own throttling. Memory note: prod
// admin@arctos.dev still ships with the default `admin123` password
// pending the operator's rotation step. Without per-IP throttling,
// any internet host can brute-force at line rate.
// LIMITS.AUTH = 10 attempts/60s per IP — generous enough that a
// fat-fingered admin doesn't get locked out, tight enough to stop
// online brute force.
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = await rateLimit({
    key: `admin-login:${ip}`,
    ...LIMITS.AUTH,
  });
  if (!limit.allowed) {
    return new Response(
      JSON.stringify({
        type: "https://arctos.charliehund.de/errors/rate-limited",
        title: "Rate limit exceeded",
        status: 429,
        detail: `Too many admin-login attempts from this IP. Retry in ${limit.retryAfterSeconds}s.`,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/problem+json; charset=utf-8",
          "Retry-After": String(limit.retryAfterSeconds),
        },
      },
    );
  }

  const body = await req.json();
  const parsed = breakGlassLoginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;

  // Find user
  const [found] = await db
    .select()
    .from(user)
    .where(
      and(
        eq(user.email, email.toLowerCase()),
        eq(user.isActive, true),
        isNull(user.deletedAt),
      ),
    );

  if (!found?.passwordHash) {
    await logAccessEvent({
      emailAttempted: email,
      eventType: "login_failed",
      failureReason: "break_glass_user_not_found",
    });
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Verify password
  const valid = await compare(password, found.passwordHash);
  if (!valid) {
    await logAccessEvent({
      userId: found.id,
      emailAttempted: email,
      eventType: "login_failed",
      failureReason: "break_glass_invalid_password",
    });
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Check user has admin role in at least one org
  const adminRoles = await db
    .select({ orgId: userOrganizationRole.orgId })
    .from(userOrganizationRole)
    .where(
      and(
        eq(userOrganizationRole.userId, found.id),
        eq(userOrganizationRole.role, "admin"),
        isNull(userOrganizationRole.deletedAt),
      ),
    );

  if (!adminRoles.length) {
    await logAccessEvent({
      userId: found.id,
      emailAttempted: email,
      eventType: "login_failed",
      failureReason: "break_glass_not_admin",
    });
    return Response.json(
      { error: "Break-glass login is only available for admin users" },
      { status: 403 },
    );
  }

  await logAccessEvent({
    userId: found.id,
    emailAttempted: email,
    eventType: "login_success",
    authMethod: "password",
  });

  // Return user data for the frontend to create session via signIn()
  return Response.json({
    data: {
      id: found.id,
      email: found.email,
      name: found.name,
      isBreakGlass: true,
    },
  });
}
