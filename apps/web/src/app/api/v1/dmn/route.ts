import { db, dmnDecision } from "@grc/db";
import { createDmnDecisionSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/dmn — Create DMN decision
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createDmnDecisionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(dmnDecision)
      .values({ ...body.data, orgId: ctx.orgId, createdBy: ctx.userId })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/dmn — List DMN decisions
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "process_owner", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const conditions = [eq(dmnDecision.orgId, ctx.orgId)];
  if (status) conditions.push(eq(dmnDecision.status, status));

  const decisions = await db
    .select()
    .from(dmnDecision)
    .where(and(...conditions))
    .orderBy(desc(dmnDecision.updatedAt))
    .limit(limit)
    .offset(offset);

  return Response.json({ data: decisions });
}
