import { db, user, userOrganizationRole, ssoConfig } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { compare } from "bcryptjs";
import { breakGlassLoginSchema } from "@grc/shared";
import { logAccessEvent } from "@grc/auth/providers";

// POST /api/v1/auth/admin-login — Break-glass admin login
// Only works for admin users when SSO enforcement is active
export async function POST(req: Request) {
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
