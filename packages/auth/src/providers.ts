// Auth providers — Node.js only (requires DB access)
// These are imported in apps/web/src/auth.ts, NOT in middleware.

import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@grc/db";
import { user, userOrganizationRole } from "@grc/db";
import type { RoleAssignment } from "./types";

async function loadRoles(userId: string): Promise<RoleAssignment[]> {
  const rows = await db
    .select({
      orgId: userOrganizationRole.orgId,
      role: userOrganizationRole.role,
      lineOfDefense: userOrganizationRole.lineOfDefense,
    })
    .from(userOrganizationRole)
    .where(
      and(
        eq(userOrganizationRole.userId, userId),
        isNull(userOrganizationRole.deletedAt),
      ),
    );
  return rows as RoleAssignment[];
}

export const credentialsProvider = Credentials({
  id: "credentials",
  name: "Email & Password",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    const email = credentials?.email as string | undefined;
    const password = credentials?.password as string | undefined;
    if (!email || !password) return null;

    const [found] = await db
      .select()
      .from(user)
      .where(
        and(
          eq(user.email, email),
          eq(user.isActive, true),
          isNull(user.deletedAt),
        ),
      );

    if (!found?.passwordHash) return null;

    const valid = await compare(password, found.passwordHash);
    if (!valid) return null;

    // Update last login timestamp
    await db.execute(
      sql`UPDATE "user" SET last_login_at = now() WHERE id = ${found.id}`,
    );

    const roles = await loadRoles(found.id);

    return {
      id: found.id,
      email: found.email,
      name: found.name,
      language: found.language,
      roles,
    };
  },
});
