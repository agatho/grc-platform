import { db, ismsNonconformity } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { NC_ALLOWED_TRANSITIONS } from "@grc/shared";
import type { NcStatus } from "@grc/shared";

// #NIGHT-045: NC transition discovery (ISO 27001 §10.1). The UI calls
// this to render the workflow buttons (analysis → action_planned →
// in_progress → verification → closed) without duplicating the matrix.
export const GET = withErrorHandler<{ params: Promise<{ id: string }> }>(
  async function GET(req: Request, { params }) {
    const ctx = await withAuth();
    if (ctx instanceof Response) return ctx;

    const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
    if (moduleCheck) return moduleCheck;

    const { id } = await params;

    const [row] = await db
      .select({ status: ismsNonconformity.status })
      .from(ismsNonconformity)
      .where(
        and(
          eq(ismsNonconformity.id, id),
          eq(ismsNonconformity.orgId, ctx.orgId),
        ),
      );

    if (!row) {
      return Response.json(
        { error: "Nonconformity not found" },
        { status: 404 },
      );
    }

    const current = row.status as NcStatus;
    const allowed = NC_ALLOWED_TRANSITIONS[current] ?? [];

    return Response.json({
      data: {
        current,
        allowed,
        endpoint: `/api/v1/isms/nonconformities/${id}`,
        method: "PUT",
        bodyShape: { status: "<target>" },
      },
    });
  },
);
