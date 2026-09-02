import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext, paginate } from "@/lib/api";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { parseQueryParams } from "@/lib/query-schema";
// [E2E-TRIAGE-2026-09-02] `withErrorHandler` is what opens the
// `requestDbStorage.run(...)` frame that `withAuth` -> establishRequestScopedContext
// mutates with the org-pinned connection (apps/web/src/lib/api-wrapper.ts:113).
// Without it that helper falls back to `requestDbStorage.enterWith(...)`, which
// Next drops across the `await` in withAuth (api.ts:184-196), the handler's
// queries run on the context-less base pool, and RLS filters every row — the
// route answers 200 with an EMPTY list instead of the tenant's data.
import { withErrorHandler } from "@/lib/api-wrapper";

const createNonconformitySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  sourceType: z.string().max(50).default("internal_audit"),
  severity: z.enum(["minor", "major", "critical"]).default("minor"),
  isoClause: z.string().max(50).optional(),
  dueDate: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
});

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // #S04-09 (ARCTOS-FULL-2026-08-31): query parameters are now validated
  // against a schema instead of being read as `string | null` and cast
  // with `as <enum>`. An unknown filter value used to reach Postgres and
  // surface as a 500 (`invalid input value for enum …`); it is a 422 now,
  // and free-text search terms are length-bounded.
  const nonconformityListQuerySchema = z.object({
    status: z.string().trim().min(1).max(40).optional(),
  });

  const { limit, offset, searchParams } = paginate(req);
  const q = parseQueryParams(nonconformityListQuerySchema, searchParams);
  if (!q.ok)
    return Response.json(
      { error: q.message, details: q.details },
      { status: 422 },
    );
  const status = q.data.status ?? null;

  let query = sql`SELECT nc.*,
    (SELECT count(*) FROM isms_corrective_action ca WHERE ca.nonconformity_id = nc.id) as action_count,
    (SELECT count(*) FROM isms_corrective_action ca WHERE ca.nonconformity_id = nc.id AND ca.status = 'completed') as completed_actions
    FROM isms_nonconformity nc WHERE nc.org_id = ${ctx.orgId}`;

  if (status) {
    query = sql`${query} AND nc.status = ${status}`;
  }

  query = sql`${query} ORDER BY nc.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  const rows = await db.execute(query);

  const totalRows = (await db.execute(
    sql`SELECT count(*)::int as total FROM isms_nonconformity WHERE org_id = ${ctx.orgId}`,
  )) as unknown as Array<{ total: number }>;
  const total = totalRows[0]?.total ?? 0;

  return Response.json({
    data: rows,
    total,
    page: Math.floor(offset / limit) + 1,
    limit,
  });
});
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const parsed = createNonconformitySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const result = await withAuditContext(ctx, async () => {
    const countRows = (await db.execute(
      sql`SELECT count(*)::int as count FROM isms_nonconformity WHERE org_id = ${ctx.orgId}`,
    )) as unknown as Array<{ count: number }>;
    const count = countRows[0]?.count ?? 0;
    const ncCode = `NC-${String(count + 1).padStart(3, "0")}`;

    const rows = (await db.execute(sql`
      INSERT INTO isms_nonconformity (org_id, nc_code, title, description, source_type, severity, iso_clause, due_date, identified_by, assigned_to, status)
      VALUES (${ctx.orgId}, ${ncCode}, ${d.title}, ${d.description ?? null}, ${d.sourceType}, ${d.severity}, ${d.isoClause ?? null}, ${d.dueDate ?? null}, ${ctx.userId}, ${d.assignedTo ?? null}, 'open')
      RETURNING *
    `)) as unknown as Record<string, unknown>[];
    return rows[0];
  });

  return Response.json(result, { status: 201 });
});
