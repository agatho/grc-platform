import {
  db,
  risk,
  riskAppetite,
  notification,
  userOrganizationRole,
} from "@grc/db";
import { assessRiskSchema } from "@grc/shared";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/risks/:id/assessment — Set assessment scores
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(risk)
    .where(
      and(eq(risk.id, id), eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = assessRiskSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const {
    inherentLikelihood,
    inherentImpact,
    residualLikelihood,
    residualImpact,
  } = body.data;

  // Compute scores
  const riskScoreInherent = inherentLikelihood * inherentImpact;
  const riskScoreResidual =
    residualLikelihood != null && residualImpact != null
      ? residualLikelihood * residualImpact
      : null;

  // Check risk appetite threshold
  const [appetite] = await db
    .select()
    .from(riskAppetite)
    .where(
      and(eq(riskAppetite.orgId, ctx.orgId), isNull(riskAppetite.deletedAt)),
    );

  const scoreToCheck = riskScoreResidual ?? riskScoreInherent;
  const riskAppetiteExceeded = appetite
    ? scoreToCheck > appetite.appetiteThreshold
    : false;

  // Determine if appetite was newly exceeded (for escalation notification)
  const wasExceeded = existing.riskAppetiteExceeded;

  // Auto-transition: identified -> assessed
  const newStatus =
    existing.status === "identified" ? "assessed" : existing.status;

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(risk)
      .set({
        inherentLikelihood,
        inherentImpact,
        residualLikelihood: residualLikelihood ?? null,
        residualImpact: residualImpact ?? null,
        riskScoreInherent,
        riskScoreResidual,
        riskAppetiteExceeded,
        status: newStatus,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(eq(risk.id, id), eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)),
      )
      .returning();

    // Send escalation notification if appetite newly exceeded
    if (riskAppetiteExceeded && !wasExceeded) {
      // Notify owner
      if (existing.ownerId) {
        await tx.insert(notification).values({
          userId: existing.ownerId,
          orgId: ctx.orgId,
          type: "escalation",
          entityType: "risk",
          entityId: id,
          title: `Risk appetite exceeded: ${existing.title}`,
          message: `Residual risk score ${scoreToCheck} exceeds appetite threshold ${appetite?.appetiteThreshold ?? "N/A"}.`,
          channel: "both",
          templateKey: "risk_appetite_exceeded",
          templateData: {
            riskId: id,
            riskTitle: existing.title,
            score: scoreToCheck,
            threshold: appetite?.appetiteThreshold,
          },
          createdBy: ctx.userId,
        });
      }

      // Notify all risk_managers in org
      const riskManagers = await tx
        .select({ userId: userOrganizationRole.userId })
        .from(userOrganizationRole)
        .where(
          and(
            eq(userOrganizationRole.orgId, ctx.orgId),
            eq(userOrganizationRole.role, "risk_manager"),
            isNull(userOrganizationRole.deletedAt),
          ),
        );

      for (const rm of riskManagers) {
        if (rm.userId === existing.ownerId || rm.userId === ctx.userId)
          continue;
        await tx.insert(notification).values({
          userId: rm.userId,
          orgId: ctx.orgId,
          type: "escalation",
          entityType: "risk",
          entityId: id,
          title: `Risk appetite exceeded: ${existing.title}`,
          message: `Residual risk score ${scoreToCheck} exceeds appetite threshold ${appetite?.appetiteThreshold ?? "N/A"}.`,
          channel: "both",
          templateKey: "risk_appetite_exceeded",
          templateData: {
            riskId: id,
            riskTitle: existing.title,
            score: scoreToCheck,
            threshold: appetite?.appetiteThreshold,
          },
          createdBy: ctx.userId,
        });
      }
    }

    return row;
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}
