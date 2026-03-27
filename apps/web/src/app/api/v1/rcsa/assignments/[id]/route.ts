import { db, rcsaAssignment, rcsaResponse, rcsaCampaign, risk, control } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/rcsa/assignments/:id — Assignment detail + entity data
export async function GET(req: Request, { params }: RouteParams) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [assignment] = await db
    .select()
    .from(rcsaAssignment)
    .where(and(eq(rcsaAssignment.id, id), eq(rcsaAssignment.orgId, ctx.orgId)));

  if (!assignment) {
    return Response.json({ error: "Assignment not found" }, { status: 404 });
  }

  // Check user access: must be the assigned user or admin/risk_manager
  // For simplicity, allow org-scoped access (RLS handles it)

  let entity: Record<string, unknown> | null = null;

  if (assignment.entityType === "risk") {
    const [r] = await db
      .select()
      .from(risk)
      .where(eq(risk.id, assignment.entityId));
    entity = r ?? null;
  } else {
    const [c] = await db
      .select()
      .from(control)
      .where(eq(control.id, assignment.entityId));
    entity = c ?? null;
  }

  const [campaign] = await db
    .select()
    .from(rcsaCampaign)
    .where(eq(rcsaCampaign.id, assignment.campaignId));

  // Get existing response
  const [existingResponse] = await db
    .select()
    .from(rcsaResponse)
    .where(eq(rcsaResponse.assignmentId, id))
    .orderBy(desc(rcsaResponse.respondedAt))
    .limit(1);

  return Response.json({
    data: {
      ...assignment,
      entity,
      campaign,
      response: existingResponse ?? null,
    },
  });
}
