import { db, wbProtectionCase, wbProtectionEvent } from "@grc/db";
import {
  createProtectionCaseSchema,
  createProtectionEventSchema,
} from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// GET /api/v1/whistleblowing/protection
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule(
    "whistleblowing",
    ctx.orgId,
    req.method,
  );
  if (moduleCheck) return moduleCheck;

  const { limit, offset } = paginate(new URL(req.url).searchParams);
  const rows = await db
    .select()
    .from(wbProtectionCase)
    .where(eq(wbProtectionCase.orgId, ctx.orgId))
    .orderBy(desc(wbProtectionCase.createdAt))
    .limit(limit)
    .offset(offset);
  return paginatedResponse(rows, rows.length, limit, offset);
}

// POST /api/v1/whistleblowing/protection
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule(
    "whistleblowing",
    ctx.orgId,
    req.method,
  );
  if (moduleCheck) return moduleCheck;

  const body = createProtectionCaseSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(wbProtectionCase)
      .values({
        orgId: ctx.orgId,
        caseId: body.data.caseId,
        reporterReference: body.data.reporterReference,
        reporterUserId: body.data.reporterUserId,
        protectionStartDate: body.data.protectionStartDate,
        monitoringFrequency: body.data.monitoringFrequency,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
