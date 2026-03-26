import {
  db,
  control,
  risk,
  riskControl,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const linkRiskSchema = z.object({
  riskId: z.string().uuid(),
  effectiveness: z.string().max(50).optional(),
});

// GET /api/v1/controls/:id/risk-links — List linked risks
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify control exists
  const [existing] = await db
    .select({ id: control.id })
    .from(control)
    .where(
      and(
        eq(control.id, id),
        eq(control.orgId, ctx.orgId),
        isNull(control.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Control not found" }, { status: 404 });
  }

  const links = await db
    .select({
      id: riskControl.id,
      riskId: riskControl.riskId,
      controlId: riskControl.controlId,
      effectiveness: riskControl.effectiveness,
      riskTitle: risk.title,
      riskStatus: risk.status,
      riskCategory: risk.riskCategory,
      createdAt: riskControl.createdAt,
      createdBy: riskControl.createdBy,
    })
    .from(riskControl)
    .innerJoin(risk, eq(riskControl.riskId, risk.id))
    .where(
      and(
        eq(riskControl.controlId, id),
        eq(riskControl.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  return Response.json({ data: links });
}

// POST /api/v1/controls/:id/risk-links — Link a risk to this control
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify control exists
  const [existingControl] = await db
    .select({ id: control.id })
    .from(control)
    .where(
      and(
        eq(control.id, id),
        eq(control.orgId, ctx.orgId),
        isNull(control.deletedAt),
      ),
    );

  if (!existingControl) {
    return Response.json({ error: "Control not found" }, { status: 404 });
  }

  const body = linkRiskSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify risk exists in same org
  const [existingRisk] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(
        eq(risk.id, body.data.riskId),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  if (!existingRisk) {
    return Response.json(
      { error: "Risk not found in this organization" },
      { status: 422 },
    );
  }

  // Check for duplicate link
  const [existingLink] = await db
    .select({ id: riskControl.id })
    .from(riskControl)
    .where(
      and(
        eq(riskControl.controlId, id),
        eq(riskControl.riskId, body.data.riskId),
        eq(riskControl.orgId, ctx.orgId),
      ),
    );

  if (existingLink) {
    return Response.json(
      { error: "This risk is already linked to this control" },
      { status: 409 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(riskControl)
      .values({
        orgId: ctx.orgId,
        controlId: id,
        riskId: body.data.riskId,
        effectiveness: body.data.effectiveness,
        createdBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
