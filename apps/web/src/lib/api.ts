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
    if (check) return check;
  }

  return { session, orgId, userId: session.user.id };
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

/** Parse pagination params from request. */
export function paginate(req: Request) {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  return { page, limit, offset: (page - 1) * limit, searchParams: url.searchParams };
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
