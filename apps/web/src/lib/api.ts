// Shared API helpers — auth, pagination, audit context
import { auth } from "@/auth";
import { getCurrentOrgId } from "@grc/auth/context";
import { requireRole } from "@grc/auth";
import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import type { Session } from "next-auth";
import type { UserRole } from "@grc/shared";

export interface ApiContext {
  session: Session;
  orgId: string;
  userId: string;
}

/** Authenticate, resolve org, check roles. Returns context or error Response. */
export async function withAuth(
  ...roles: UserRole[]
): Promise<ApiContext | Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = await getCurrentOrgId(session);
  if (!orgId) {
    return Response.json(
      { error: "No organization selected" },
      { status: 400 },
    );
  }

  if (roles.length) {
    const check = requireRole(...roles)(session, orgId);
    if (check) {
      // Standard role denied — check custom roles as fallback
      const hasCustomAccess = await checkCustomRoleAccess(session.user.id, orgId);
      if (!hasCustomAccess) return check;
    }
  }

  return { session, orgId, userId: session.user.id };
}

/**
 * Check if user has any custom role with at least 'read' permission in current org.
 * For module-specific checks, use checkCustomRoleModuleAccess().
 */
async function checkCustomRoleAccess(userId: string, orgId: string): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT 1 FROM user_custom_role ucr
        JOIN custom_role cr ON cr.id = ucr.custom_role_id
        JOIN role_permission rp ON rp.role_id = cr.id
        WHERE ucr.user_id = ${userId}
          AND ucr.org_id = ${orgId}
          AND rp.action != 'none'
        LIMIT 1`,
  );
  return (result.rows?.length ?? 0) > 0;
}

/**
 * Check if user has custom role permission for a specific module + action.
 * action hierarchy: admin > write > read > none
 */
export async function checkCustomRoleModuleAccess(
  userId: string,
  orgId: string,
  moduleKey: string,
  requiredAction: "read" | "write" | "admin" = "read",
): Promise<boolean> {
  const actionHierarchy: Record<string, number> = { none: 0, read: 1, write: 2, admin: 3 };
  const requiredLevel = actionHierarchy[requiredAction] ?? 1;

  const result = await db.execute(
    sql`SELECT rp.action FROM user_custom_role ucr
        JOIN role_permission rp ON rp.role_id = ucr.custom_role_id
        WHERE ucr.user_id = ${userId}
          AND ucr.org_id = ${orgId}
          AND rp.module_key = ${moduleKey}
        ORDER BY CASE rp.action
          WHEN 'admin' THEN 3 WHEN 'write' THEN 2
          WHEN 'read' THEN 1 ELSE 0 END DESC
        LIMIT 1`,
  );

  if (!result.rows?.length) return false;
  const userLevel = actionHierarchy[(result.rows[0] as Record<string, string>).action] ?? 0;
  return userLevel >= requiredLevel;
}

/** Wrap a mutation in a transaction with audit session variables. */
export async function withAuditContext<T>(
  ctx: ApiContext,
  fn: (tx: any) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_org_id', ${ctx.orgId}, true)`,
    );
    await tx.execute(
      sql`SELECT set_config('app.current_user_id', ${ctx.userId}, true)`,
    );
    await tx.execute(
      sql`SELECT set_config('app.current_user_email', ${ctx.session.user.email}, true)`,
    );
    await tx.execute(
      sql`SELECT set_config('app.current_user_name', ${ctx.session.user.name}, true)`,
    );
    return fn(tx);
  });
}

/** Parse pagination params from request or search params. */
export function paginate(reqOrParams: Request | URLSearchParams) {
  const searchParams = reqOrParams instanceof Request
    ? new URL(reqOrParams.url).searchParams
    : reqOrParams;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  return { page, limit, offset: (page - 1) * limit, searchParams };
}

/** Build a paginated JSON response. */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return Response.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
