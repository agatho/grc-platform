import { db, user, userOrganizationRole, ssoConfig } from "@grc/db";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { compare } from "bcryptjs";
import { breakGlassLoginSchema } from "@grc/shared";
import {
  logAccessEvent,
  checkLoginLock,
  registerLoginFailure,
  registerLoginSuccess,
  normaliseEmail,
} from "@grc/auth/providers";
import { rateLimit, getClientIp, LIMITS } from "@/lib/rate-limit";

// POST /api/v1/auth/admin-login — Break-glass admin login
//
// #WP3-S02-18 — the header said "Only works for admin users when SSO
// enforcement is active" and the handler imported `ssoConfig` for exactly that
// purpose — but never used it (`grep -c ssoConfig` → 1 hit, the import). The
// endpoint was therefore a second, fully general password-login path for
// administrators, open even where the operator had enabled `enforceSSO`
// precisely to switch password logins off. It now actually checks the
// condition it documents: without SSO enforcement in any of the caller's orgs,
// break-glass is refused and the regular login is the only way in.
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

  const email = normaliseEmail(parsed.data.email);
  const { password } = parsed.data;

  // #WP3-S02-09: the same account lockout as the primary login. Per-IP rate
  // limiting alone is bypassable by incrementing X-Forwarded-For.
  const lock = await checkLoginLock(email);
  if (lock.locked) {
    await logAccessEvent({
      emailAttempted: email,
      eventType: "login_failed",
      failureReason: "account_locked",
    });
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Find user
  const [found] = await db
    .select()
    .from(user)
    .where(
      and(
        sql`lower(${user.email}) = ${email}`,
        eq(user.isActive, true),
        isNull(user.deletedAt),
      ),
    );

  if (!found?.passwordHash) {
    await registerLoginFailure(email);
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
    await registerLoginFailure(email);
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

  // #WP3-S02-18 — enforce the documented precondition. Break-glass exists for
  // "SSO is enforced and the IdP is unavailable"; where SSO is NOT enforced the
  // regular credentials login already works and this second password path adds
  // only attack surface (it bypasses the IdP's MFA/conditional access).
  const enforcingOrgs = await db
    .select({ orgId: ssoConfig.orgId })
    .from(ssoConfig)
    .where(
      and(
        inArray(
          ssoConfig.orgId,
          adminRoles.map((r) => r.orgId),
        ),
        eq(ssoConfig.enforceSSO, true),
        eq(ssoConfig.isActive, true),
        isNull(ssoConfig.deletedAt),
      ),
    );

  if (enforcingOrgs.length === 0) {
    await logAccessEvent({
      userId: found.id,
      emailAttempted: email,
      eventType: "login_failed",
      failureReason: "break_glass_sso_not_enforced",
    });
    return Response.json(
      {
        error:
          "Break-glass login is only available while SSO enforcement is active. Use the regular login.",
      },
      { status: 403 },
    );
  }

  await registerLoginSuccess(found.id);
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
      mustChangePassword: found.mustChangePassword === true,
    },
  });
}
