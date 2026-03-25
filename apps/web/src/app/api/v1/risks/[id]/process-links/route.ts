import {
  db,
  risk,
  processRisk,
} from "@grc/db";
import { eq, and, isNull, count } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { z } from "zod";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

const createProcessLinkSchema = z.object({
  processId: z.string().uuid(),
  riskContext: z.string().optional(),
});

// POST /api/v1/risks/:id/process-links — Link risk to process
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify risk exists in org
  const [existing] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(
        eq(risk.id, id),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  const body = createProcessLinkSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(processRisk)
      .values({
        orgId: ctx.orgId,
        riskId: id,
        processId: body.data.processId,
        riskContext: body.data.riskContext,
        createdBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/risks/:id/process-links — List process links for risk
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify risk exists in org
  const [existing] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(
        eq(risk.id, id),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  const { page, limit, offset } = paginate(req);

  const conditions = and(
    eq(processRisk.riskId, id),
    eq(processRisk.orgId, ctx.orgId),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(processRisk)
      .where(conditions)
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(processRisk)
      .where(conditions),
  ]);

  return paginatedResponse(items, total, page, limit);
}
