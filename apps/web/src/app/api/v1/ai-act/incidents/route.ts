import { db, aiIncident } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext, paginate } from "@/lib/api";
import { and, desc, eq, sql } from "drizzle-orm";
import { createAiIncidentSchema } from "@grc/shared";

export async function GET(req: Request) {
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
  const severity = searchParams.get("severity");
  const status = searchParams.get("status");

  // Explicit orgId filter via drizzle query builder. The previous raw-sql variant
  // relied on `app.current_org_id` session var being set, which this GET route
  // never did -- resulting in 0 rows for every user.
  const conditions = [eq(aiIncident.orgId, ctx.orgId)];
  if (severity) conditions.push(eq(aiIncident.severity, severity));
  if (status) conditions.push(eq(aiIncident.status, status));
  const whereClause =
    conditions.length === 1 ? conditions[0] : and(...conditions);

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(aiIncident)
      .where(whereClause)
      .orderBy(desc(aiIncident.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiIncident)
      .where(whereClause),
  ]);

  return Response.json({
    data: rows,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      total: countRows[0]?.count ?? 0,
    },
  });
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const parsed = createAiIncidentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const { title, description, ai_system_id, severity, is_serious } =
    parsed.data;

  // Auto-calculate authority_deadline: 2 days if death/serious harm, 15 days otherwise
  const deadlineDays = is_serious ? 2 : 15;
  const now = new Date();
  const authorityDeadline = new Date(
    now.getTime() + deadlineDays * 24 * 60 * 60 * 1000,
  );

  const result = await withAuditContext(ctx, async (tx) => {
    const [inserted] = await tx
      .insert(aiIncident)
      .values({
        orgId: ctx.orgId,
        title,
        description: description ?? null,
        aiSystemId: ai_system_id ?? null,
        severity,
        isSerious: is_serious ?? false,
        status: "detected",
        authorityDeadline,
        detectedAt: now,
        createdBy: ctx.userId,
      })
      .returning();
    return inserted;
  });
  return Response.json({ data: result }, { status: 201 });
}
