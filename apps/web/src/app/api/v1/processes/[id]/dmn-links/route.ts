import { db, dmnDecision } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNotNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/processes/:id/dmn-links — DMN decisions linked to process steps
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: processId } = await params;

  // Find DMN decisions linked to steps of this process
  const decisions = await db
    .select()
    .from(dmnDecision)
    .where(
      and(
        eq(dmnDecision.orgId, ctx.orgId),
        isNotNull(dmnDecision.linkedProcessStepId),
      ),
    );

  return Response.json({ data: decisions });
}
