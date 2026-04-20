import { db, audit } from "@grc/db";
import {
  auditStatusTransitionSchema,
  isValidAuditTransition,
} from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/v1/audit-mgmt/audits/[id]/status
// planned -> preparation -> fieldwork -> reporting -> review -> completed
export async function PUT(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = auditStatusTransitionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [existing] = await db
    .select()
    .from(audit)
    .where(
      and(
        eq(audit.id, id),
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Audit not found" }, { status: 404 });
  }

  if (!isValidAuditTransition(existing.status, body.data.status)) {
    return Response.json(
      {
        error: `Cannot transition from '${existing.status}' to '${body.data.status}'`,
      },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const setValues: Record<string, unknown> = {
      status: body.data.status,
      updatedAt: new Date(),
    };

    // Track actual dates
    if (body.data.status === "fieldwork" && !existing.actualStart) {
      setValues.actualStart = new Date().toISOString().split("T")[0];
    }
    if (body.data.status === "completed") {
      setValues.actualEnd = new Date().toISOString().split("T")[0];
      if (body.data.conclusion) {
        setValues.conclusion = body.data.conclusion;
      }
    }

    const [row] = await tx
      .update(audit)
      .set(setValues)
      .where(and(eq(audit.id, id), eq(audit.orgId, ctx.orgId)))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}
