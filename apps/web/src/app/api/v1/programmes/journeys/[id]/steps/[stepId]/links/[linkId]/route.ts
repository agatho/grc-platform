// DELETE /api/v1/programmes/journeys/[id]/steps/[stepId]/links/[linkId]

import {
  db,
  programmeStepLink,
  programmeJourneyEvent,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; stepId: string; linkId: string }>;
  },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId, linkId } = await params;
  const [existing] = await db
    .select({ id: programmeStepLink.id })
    .from(programmeStepLink)
    .where(
      and(
        eq(programmeStepLink.id, linkId),
        eq(programmeStepLink.journeyStepId, stepId),
        eq(programmeStepLink.orgId, ctx.orgId),
      ),
    )
    .limit(1);
  if (!existing) {
    return Response.json({ error: "Link not found" }, { status: 404 });
  }

  await withAuditContext(ctx, async () =>
    db.delete(programmeStepLink).where(eq(programmeStepLink.id, linkId)),
  );

  await db.insert(programmeJourneyEvent).values({
    orgId: ctx.orgId,
    journeyId: id,
    stepId,
    eventType: "link.deleted",
    actorId: ctx.userId,
    payload: { linkId },
  });

  return Response.json({ data: { ok: true } });
}
