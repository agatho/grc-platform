import { db, agentRegistration } from "@grc/db";
import { updateAgentSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/agents/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const [agent] = await db
    .select()
    .from(agentRegistration)
    .where(and(eq(agentRegistration.id, id), eq(agentRegistration.orgId, ctx.orgId)));

  if (!agent) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  return Response.json({ data: agent });
}

// PUT /api/v1/agents/:id — Update config / activate / deactivate
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = updateAgentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const updateData: Record<string, unknown> = { ...body.data, updatedAt: new Date() };

    // Compute next run if activating
    if (body.data.isActive && body.data.config?.scanFrequencyMinutes) {
      updateData.nextRunAt = new Date(Date.now() + body.data.config.scanFrequencyMinutes * 60000);
    }

    const [updated] = await tx
      .update(agentRegistration)
      .set(updateData)
      .where(and(eq(agentRegistration.id, id), eq(agentRegistration.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  if (!result) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  return Response.json({ data: result });
}
