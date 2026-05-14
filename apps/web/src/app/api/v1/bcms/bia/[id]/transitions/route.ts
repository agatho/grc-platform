import { db, biaAssessment } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { BIA_ALLOWED_TRANSITIONS } from "@grc/shared";
import type { BiaStatus } from "@grc/shared";

// #NIGHT-045: BIA transition discovery. Returns the next-step set the
// BCMS gates will accept. Gate-blockers (Gate B1 setup completeness,
// Gate B2 coverage) are NOT pre-evaluated here — call the actual
// transition endpoint to surface them.
export const GET = withErrorHandler<{ params: Promise<{ id: string }> }>(
  async function GET(req: Request, { params }) {
    const ctx = await withAuth();
    if (ctx instanceof Response) return ctx;

    const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
    if (moduleCheck) return moduleCheck;

    const { id } = await params;

    const [row] = await db
      .select({ status: biaAssessment.status })
      .from(biaAssessment)
      .where(and(eq(biaAssessment.id, id), eq(biaAssessment.orgId, ctx.orgId)));

    if (!row) {
      return Response.json({ error: "BIA not found" }, { status: 404 });
    }

    const current = row.status as BiaStatus;
    // #WAVE14-NAMING: see /risks/[id]/transitions/route.ts.
    const allowedNext = BIA_ALLOWED_TRANSITIONS[current] ?? [];

    return Response.json({
      data: {
        current,
        allowedNext,
        endpoint:
          current === "in_progress"
            ? `/api/v1/bcms/bia/${id}/finalize`
            : `/api/v1/bcms/bia/${id}`,
        method: current === "in_progress" ? "POST" : "PUT",
        note: "Gate blockers (B1 setup, B2 coverage) are evaluated by the transition endpoint, not by this discovery route.",
      },
    });
  },
);
