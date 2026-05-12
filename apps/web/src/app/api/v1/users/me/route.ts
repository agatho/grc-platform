import { db, user, userOrganizationRole } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

// #WAVE6-RBAC-01: GET /api/v1/users/me used to be 500 because the
// request was caught by /users/[id]/route.ts with id="me", which then
// ran eq(user.id, "me") against a uuid column → SQLSTATE 22P02 inside
// a JOIN that the wrapper couldn't unwrap, surfacing as empty 500.
// Explicit /users/me route returns the current session user so the UI's
// "current user" lookups never go through the dynamic [id] route.

export const GET = withErrorHandler(async function GET() {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const [me] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      language: user.language,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(and(eq(user.id, ctx.userId), isNull(user.deletedAt)));

  if (!me) {
    return Response.json(
      { error: "Authenticated user not found in DB" },
      { status: 404 },
    );
  }

  // Include the caller's roles in the current org so the UI doesn't
  // have to do a second round-trip just to render the role badge.
  const roles = await db
    .select({
      id: userOrganizationRole.id,
      role: userOrganizationRole.role,
      department: userOrganizationRole.department,
      lineOfDefense: userOrganizationRole.lineOfDefense,
    })
    .from(userOrganizationRole)
    .where(
      and(
        eq(userOrganizationRole.userId, ctx.userId),
        eq(userOrganizationRole.orgId, ctx.orgId),
        isNull(userOrganizationRole.deletedAt),
      ),
    );

  return Response.json({
    data: {
      ...me,
      orgId: ctx.orgId,
      roles,
    },
  });
});
