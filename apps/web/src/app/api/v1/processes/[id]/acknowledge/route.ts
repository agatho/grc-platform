// B2.3 Release-Cycle: Kenntnisnahme (acknowledgment) of the published
// process version.
//
// POST /api/v1/processes/:id/acknowledge — the calling user confirms
//      having read the published version (stored with versionNumber +
//      timestamp on their acknowledgment step; self-registering when no
//      step was pre-created for them).
// GET  /api/v1/processes/:id/acknowledge — compliance overview (how many
//      of the requested acknowledgments are confirmed, in percent).

import { db, process, processApprovalStep, user } from "@grc/db";
import { acknowledgeProcessSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, asc, sql } from "drizzle-orm";
import { withAuth, withAuditContext, withReadContext } from "@/lib/api";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = acknowledgeProcessSchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [proc] = await db
    .select({
      id: process.id,
      status: process.status,
      currentVersion: process.currentVersion,
    })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }
  if (proc.status !== "published") {
    return Response.json(
      { error: "Only published processes can be acknowledged" },
      { status: 422 },
    );
  }

  // Existing acknowledgment step assigned to this user?
  // (process_approval_step is FORCE-RLS — read via withReadContext.)
  const ownRows: Array<typeof processApprovalStep.$inferSelect> =
    await withReadContext(ctx, (tx) =>
    tx
      .select()
      .from(processApprovalStep)
      .where(
        and(
          eq(processApprovalStep.processId, id),
          eq(processApprovalStep.orgId, ctx.orgId),
          eq(processApprovalStep.stepType, "acknowledgment"),
          eq(processApprovalStep.assigneeUserId, ctx.userId),
        ),
      )
      .orderBy(asc(processApprovalStep.stepOrder)),
  );
  const own = ownRows[0];

  if (own && own.status === "completed") {
    return Response.json(
      { data: own, meta: { alreadyAcknowledged: true } },
      { status: 200 },
    );
  }

  const result = await withAuditContext(
    ctx,
    async (tx) => {
      if (own) {
        const [row] = await tx
          .update(processApprovalStep)
          .set({
            status: "completed",
            decision: "acknowledge",
            comment: body.data.comment ?? null,
            decidedAt: new Date(),
            decidedBy: ctx.userId,
            updatedAt: new Date(),
            updatedBy: ctx.userId,
          })
          .where(eq(processApprovalStep.id, own.id))
          .returning();
        return row;
      }

      // Self-registered acknowledgment — appended to the chain of the
      // currently published version.
      const [maxRow] = await tx
        .select({
          max: sql<number>`COALESCE(MAX(${processApprovalStep.stepOrder}), 0)`,
        })
        .from(processApprovalStep)
        .where(
          and(
            eq(processApprovalStep.processId, id),
            eq(processApprovalStep.orgId, ctx.orgId),
            eq(processApprovalStep.versionNumber, proc.currentVersion),
          ),
        );

      const [row] = await tx
        .insert(processApprovalStep)
        .values({
          orgId: ctx.orgId,
          processId: id,
          versionNumber: proc.currentVersion,
          stepOrder: Number(maxRow?.max ?? 0) + 1,
          stepType: "acknowledgment",
          assigneeUserId: ctx.userId,
          status: "completed",
          decision: "acknowledge",
          comment: body.data.comment ?? null,
          decidedAt: new Date(),
          decidedBy: ctx.userId,
          createdBy: ctx.userId,
        })
        .returning();
      return row;
    },
    { actionDetail: `Acknowledged published version v${proc.currentVersion}` },
  );

  return Response.json({ data: result }, { status: 201 });
}

// GET — acknowledgment compliance overview for a version (default: current)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const [proc] = await db
    .select({ id: process.id, currentVersion: process.currentVersion })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const rawVersion = url.searchParams.get("versionNumber");
  const versionNumber = rawVersion ? Number(rawVersion) : proc.currentVersion;
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    return Response.json(
      { error: "versionNumber must be a positive integer" },
      { status: 422 },
    );
  }

  const rows: Array<{
    id: string;
    assigneeUserId: string | null;
    assigneeUserName: string | null;
    status: string;
    decidedAt: Date | null;
    versionNumber: number;
  }> = await withReadContext(ctx, (tx) =>
    tx
      .select({
        id: processApprovalStep.id,
        assigneeUserId: processApprovalStep.assigneeUserId,
        assigneeUserName: user.name,
        status: processApprovalStep.status,
        decidedAt: processApprovalStep.decidedAt,
        versionNumber: processApprovalStep.versionNumber,
      })
      .from(processApprovalStep)
      .leftJoin(user, eq(processApprovalStep.assigneeUserId, user.id))
      .where(
        and(
          eq(processApprovalStep.processId, id),
          eq(processApprovalStep.orgId, ctx.orgId),
          eq(processApprovalStep.stepType, "acknowledgment"),
          eq(processApprovalStep.versionNumber, versionNumber),
        ),
      )
      .orderBy(asc(processApprovalStep.stepOrder)),
  );

  const total = rows.length;
  const acknowledged = rows.filter((r) => r.status === "completed").length;

  return Response.json({
    data: {
      versionNumber,
      total,
      acknowledged,
      percentage: total > 0 ? Math.round((acknowledged / total) * 100) : 0,
      entries: rows,
      currentUserAcknowledged: rows.some(
        (r) => r.assigneeUserId === ctx.userId && r.status === "completed",
      ),
    },
  });
}
