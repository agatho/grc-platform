import { db, dmnDecision } from "@grc/db";
import { updateDmnDecisionSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/dmn/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const [decision] = await db
    .select()
    .from(dmnDecision)
    .where(and(eq(dmnDecision.id, id), eq(dmnDecision.orgId, ctx.orgId)));

  if (!decision) {
    return Response.json({ error: "DMN decision not found" }, { status: 404 });
  }

  return Response.json({ data: decision });
}

// PUT /api/v1/dmn/:id
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = updateDmnDecisionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [existing] = await tx
      .select()
      .from(dmnDecision)
      .where(and(eq(dmnDecision.id, id), eq(dmnDecision.orgId, ctx.orgId)));

    if (!existing) return null;

    // On XML update, increment version
    const newVersion =
      body.data.dmnXml && body.data.dmnXml !== existing.dmnXml
        ? existing.version + 1
        : existing.version;

    const [updated] = await tx
      .update(dmnDecision)
      .set({ ...body.data, version: newVersion, updatedAt: new Date() })
      .where(and(eq(dmnDecision.id, id), eq(dmnDecision.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  if (!result) {
    return Response.json({ error: "DMN decision not found" }, { status: 404 });
  }

  return Response.json({ data: result });
}
