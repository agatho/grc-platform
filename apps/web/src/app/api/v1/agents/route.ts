import { db, agentRegistration } from "@grc/db";
import { createAgentSchema, updateAgentSchema } from "@grc/shared";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/agents — Register agent for org
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createAgentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  // Check if agent type already exists for org
  const [existing] = await db
    .select({ id: agentRegistration.id })
    .from(agentRegistration)
    .where(
      and(
        eq(agentRegistration.orgId, ctx.orgId),
        eq(agentRegistration.agentType, body.data.agentType),
      ),
    );

  if (existing) {
    return Response.json({ error: "Agent type already registered for this organization" }, { status: 409 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(agentRegistration)
      .values({ ...body.data, orgId: ctx.orgId, createdBy: ctx.userId })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/agents — List registered agents
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const agents = await db
    .select()
    .from(agentRegistration)
    .where(eq(agentRegistration.orgId, ctx.orgId))
    .orderBy(agentRegistration.agentType);

  return Response.json({ data: agents });
}
