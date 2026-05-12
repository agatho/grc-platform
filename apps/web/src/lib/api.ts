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
  roles?: string[];
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
      const hasCustomAccess = await checkCustomRoleAccess(
        session.user.id,
        orgId,
      );
      if (!hasCustomAccess) return check;
    }
  }

  return { session, orgId, userId: session.user.id };
}

/**
 * Check if user has any custom role with at least 'read' permission in current org.
 * For module-specific checks, use checkCustomRoleModuleAccess().
 */
async function checkCustomRoleAccess(
  userId: string,
  orgId: string,
): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT 1 FROM user_custom_role ucr
        JOIN custom_role cr ON cr.id = ucr.custom_role_id
        JOIN role_permission rp ON rp.role_id = cr.id
        WHERE ucr.user_id = ${userId}
          AND ucr.org_id = ${orgId}
          AND rp.action != 'none'
        LIMIT 1`,
  );
  return (result?.length ?? 0) > 0;
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
  const actionHierarchy: Record<string, number> = {
    none: 0,
    read: 1,
    write: 2,
    admin: 3,
  };
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

  if (!result?.length) return false;
  const userLevel =
    actionHierarchy[(result[0] as Record<string, string>).action] ?? 0;
  return userLevel >= requiredLevel;
}

// #WAVE6-AUDIT-02: optional audit annotation passed by callers that
// do meaningful state transitions. Both fields land in the audit_log
// row written by the trigger:
//   actionDetail → audit_log.action_detail (varchar 500, summary)
//   reason       → audit_log.metadata.reason (full text, no length cap)
// Callers omit them for trivial CRUD; state-machine transitions
// should set both for compliance traceability.
export interface AuditAnnotation {
  actionDetail?: string;
  reason?: string;
}

/** Wrap a mutation in a transaction with audit session variables. */
export async function withAuditContext<T>(
  ctx: ApiContext,
  fn: (tx: any) => Promise<T>,
  annotation?: AuditAnnotation,
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
    // Optional state-transition annotation. Always set to something
    // (empty string) so a leftover value from a previous transaction
    // on the same connection can't bleed across — the audit_trigger
    // treats empty as NULL.
    await tx.execute(
      sql`SELECT set_config('app.audit_action_detail', ${annotation?.actionDetail ?? ""}, true)`,
    );
    await tx.execute(
      sql`SELECT set_config('app.audit_reason', ${annotation?.reason ?? ""}, true)`,
    );
    return fn(tx);
  });
}

/**
 * Wrap a read-only query in a transaction with RLS session vars.
 * Required for raw-SQL reads -- without `app.current_org_id` the RLS policy
 * filters out every row even if the query has an explicit `WHERE org_id = ...`.
 */
export async function withReadContext<T>(
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
    return fn(tx);
  });
}

// Pagination contract — surfaces structured errors instead of silent
// coercion (over-night QA #NIGHT-057..060):
//   - limit=0 / -1 / "abc" → throw PaginationError (was: silently → 1)
//   - limit > MAX_PAGE_SIZE → silently capped (well-behaved clients
//     should respect the limit, but we don't refuse the request)
//   - page=0 / -1 / "abc"  → throw PaginationError (was: silently → 1)
//   - offset=N (no page)   → derive page = floor(N/limit)+1; throw if
//                            offset isn't a clean page boundary so the
//                            caller doesn't get a surprising slice
//   - offset and page both → page wins (explicit beats derived)
//
// withErrorHandler maps PaginationError to a 422 problem+json body
// with field-level details. Routes that opt into `allowedParams`
// additionally get unknown-param rejection.

// #NIGHT-039: UI sometimes sends empty-string params (e.g. `&search=`)
// when the user hasn't filled the input. The downstream Zod schema then
// rejects "" as an invalid enum value or short string. Treat empty
// strings as missing — the caller didn't actually express a constraint.
export function searchParamsToObject(
  searchParams: URLSearchParams,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of searchParams) {
    if (value !== "") out[key] = value;
  }
  return out;
}

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export class PaginationError extends Error {
  readonly field: string;
  readonly value: string;
  readonly reason: string;
  constructor(field: string, value: string, reason: string) {
    super(`Invalid pagination: ${field}=${value} (${reason})`);
    this.name = "PaginationError";
    this.field = field;
    this.value = value;
    this.reason = reason;
  }
}

function parsePositiveInt(
  field: string,
  raw: string,
  { allowZero }: { allowZero: boolean },
): number {
  if (!/^-?\d+$/.test(raw)) {
    throw new PaginationError(field, raw, "must be an integer");
  }
  const n = Number(raw);
  const min = allowZero ? 0 : 1;
  if (n < min) {
    throw new PaginationError(
      field,
      raw,
      allowZero ? "must be >= 0" : "must be >= 1",
    );
  }
  return n;
}

/** Parse pagination params from request or search params. */
export function paginate(
  reqOrParams: Request | URLSearchParams,
  opts?: { allowedParams?: readonly string[] },
) {
  const searchParams =
    reqOrParams instanceof Request
      ? new URL(reqOrParams.url).searchParams
      : reqOrParams;

  const rawLimit = searchParams.get("limit");
  let limit = DEFAULT_PAGE_SIZE;
  if (rawLimit !== null) {
    const n = parsePositiveInt("limit", rawLimit, { allowZero: false });
    // #NIGHT-059: caller asked for more rows than the page-size cap.
    // Reject explicitly instead of silently capping — silent caps mean
    // the caller never learns the API has a ceiling and keeps assuming
    // they got the full result set.
    if (n > MAX_PAGE_SIZE) {
      throw new PaginationError(
        "limit",
        rawLimit,
        `must be <= ${MAX_PAGE_SIZE} (use page+limit to traverse larger result sets)`,
      );
    }
    limit = n;
  }

  const rawPage = searchParams.get("page");
  const rawOffset = searchParams.get("offset");
  let page = 1;
  if (rawPage !== null) {
    page = parsePositiveInt("page", rawPage, { allowZero: false });
  } else if (rawOffset !== null) {
    const n = parsePositiveInt("offset", rawOffset, { allowZero: true });
    if (n % limit !== 0) {
      throw new PaginationError(
        "offset",
        rawOffset,
        `must be a multiple of limit (${limit})`,
      );
    }
    page = Math.floor(n / limit) + 1;
  }

  // #NIGHT-060: surface common pagination-param typos even when the
  // route hasn't opted into a strict allow-list. These are the names
  // a developer might assume work (because they do in other APIs)
  // and silently get nothing back. Throwing is the only way to make
  // the mistake visible.
  const COMMON_PAGINATION_TYPOS = new Set([
    "skip",
    "cursor",
    "page_size",
    "pageSize",
    "perPage",
    "per_page",
    "count",
    "top",
    "start",
  ]);
  for (const key of searchParams.keys()) {
    if (COMMON_PAGINATION_TYPOS.has(key)) {
      throw new PaginationError(
        key,
        searchParams.get(key) ?? "",
        `'${key}' is not a recognised pagination parameter — use page, limit, or offset`,
      );
    }
  }

  if (opts?.allowedParams) {
    const known = new Set<string>([
      "page",
      "limit",
      "offset",
      ...opts.allowedParams,
    ]);
    for (const key of searchParams.keys()) {
      if (!known.has(key)) {
        throw new PaginationError(
          key,
          searchParams.get(key) ?? "",
          "is not a recognized query parameter",
        );
      }
    }
  }

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
