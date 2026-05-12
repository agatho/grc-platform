import { db, dpia } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { DPIA_ALLOWED_TRANSITIONS } from "@grc/shared";
import type { DpiaStatus } from "@grc/shared";

// #NIGHT-045: DPIA transition discovery (GDPR Art. 35). The UI uses this
// to render the status dropdown without hardcoding the lifecycle:
//   draft → in_progress → completed → pending_dpo_review → approved/rejected
export const GET = withErrorHandler<{ params: Promise<{ id: string }> }>(
  async function GET(req: Request, { params }) {
    const ctx = await withAuth();
    if (ctx instanceof Response) return ctx;

    const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
    if (moduleCheck) return moduleCheck;

    const { id } = await params;

    const [row] = await db
      .select({ status: dpia.status })
      .from(dpia)
      .where(and(eq(dpia.id, id), eq(dpia.orgId, ctx.orgId)));

    if (!row) {
      return Response.json({ error: "DPIA not found" }, { status: 404 });
    }

    const current = row.status as DpiaStatus;
    const allowed = DPIA_ALLOWED_TRANSITIONS[current] ?? [];

    return Response.json({
      data: {
        current,
        allowed,
        endpoint: `/api/v1/dpms/dpia/${id}/transition`,
        method: "POST",
        bodyShape: { targetStatus: "<target>" },
      },
    });
  },
);
