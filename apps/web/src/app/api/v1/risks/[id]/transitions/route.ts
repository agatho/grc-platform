import { db, risk } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { RISK_ALLOWED_TRANSITIONS, isRiskStatus } from "@grc/shared";

// #NIGHT-045/046: state-machine discovery — UI calls this to render the
// status-change dropdown without hardcoding the transition matrix.
// Returns current status + the targets PUT /risks/{id}/status will accept.
export const GET = withErrorHandler<{ params: Promise<{ id: string }> }>(
  async function GET(req: Request, { params }) {
    const ctx = await withAuth();
    if (ctx instanceof Response) return ctx;

    const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
    if (moduleCheck) return moduleCheck;

    const { id } = await params;

    const [row] = await db
      .select({ status: risk.status })
      .from(risk)
      .where(
        and(eq(risk.id, id), eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)),
      );

    if (!row) {
      return Response.json({ error: "Risk not found" }, { status: 404 });
    }

    const current = row.status;
    // #WAVE14-NAMING: aligned with vendors/contracts/processes/dsr/incidents
    // transitions on the `allowedNext` field name. The previous `allowed`
    // alias was equivalent but inconsistent — UI clients now have one key
    // to read across every state-machine discovery endpoint.
    const allowedNext = isRiskStatus(current)
      ? (RISK_ALLOWED_TRANSITIONS[current] ?? [])
      : [];

    return Response.json({
      data: {
        current,
        allowedNext,
        endpoint: `/api/v1/risks/${id}/status`,
        method: "PUT",
        bodyShape: { status: "<target>", reason: "<optional string>" },
      },
    });
  },
);
