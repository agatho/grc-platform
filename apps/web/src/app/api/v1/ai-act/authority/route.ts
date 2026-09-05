import { toRows, firstRow } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  withAuth,
  withAuditContext,
  withReadContext,
  paginate,
} from "@/lib/api";
import { sql } from "drizzle-orm";
import { createAiAuthorityCommunicationSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

/**
 * `COUNT(*)` ist in Postgres `bigint`; der Treiber liefert es als
 * Zeichenkette. [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-076]
 */
type CountRow = { count: string | number };

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "dpo",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { limit, offset, searchParams } = paginate(req);
  const direction = searchParams.get("direction");

  let query = sql`SELECT * FROM ai_authority_communication WHERE org_id = ${ctx.orgId}`;
  let countQuery = sql`SELECT count(*)::int AS count FROM ai_authority_communication WHERE org_id = ${ctx.orgId}`;

  if (direction) {
    query = sql`${query} AND direction = ${direction}`;
    countQuery = sql`${countQuery} AND direction = ${direction}`;
  }

  query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const result = await withReadContext(ctx, async (tx) => {
    const [r, c] = await Promise.all([
      tx.execute(query),
      tx.execute(countQuery),
    ]);
    const rows = toRows(r);
    const countArr = toRows(c) as unknown as CountRow[];
    return { rows, count: Number(countArr[0]?.count ?? 0) };
  });
  return Response.json({
    data: result.rows,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      total: result.count,
    },
  });
});
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const parsed = createAiAuthorityCommunicationSchema.safeParse(
    await req.json(),
  );
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const {
    authority_name,
    subject,
    direction,
    response_deadline,
    content,
    ai_system_id,
  } = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const res = await tx.execute(sql`
      INSERT INTO ai_authority_communication (org_id, authority_name, subject, direction, sent_at, response_deadline, content, ai_system_id, status, created_by)
      VALUES (${ctx.orgId}, ${authority_name}, ${subject}, ${direction}, ${new Date().toISOString()}, ${response_deadline ?? null}, ${content ?? null}, ${ai_system_id ?? null}, 'open', ${ctx.userId})
      RETURNING *
    `);
    return firstRow(res);
  });
  return Response.json({ data: result }, { status: 201 });
});
