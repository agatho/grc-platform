import { db, crisisScenario, crisisLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const activateCrisisSchema = z.object({
  initialAssessment: z.string().max(5000).optional(),
});

// POST /api/v1/bcms/crisis/[id]/activate — Activate a crisis
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  let initialAssessment: string | undefined;
  try {
    const parsed = activateCrisisSchema.safeParse(await req.json());
    if (parsed.success) initialAssessment = parsed.data.initialAssessment;
  } catch {
    // no body is fine
  }

  // Verify crisis exists and is in standby
  const [current] = await db
    .select()
    .from(crisisScenario)
    .where(and(eq(crisisScenario.id, id), eq(crisisScenario.orgId, ctx.orgId)));

  if (!current) {
    return Response.json(
      { error: "Crisis scenario not found" },
      { status: 404 },
    );
  }

  if (current.status !== "standby") {
    return Response.json(
      {
        error: `Cannot activate crisis in '${current.status}' status. Must be 'standby'.`,
      },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const now = new Date();

    const [row] = await tx
      .update(crisisScenario)
      .set({
        status: "activated",
        activatedAt: now,
        activatedBy: ctx.userId,
        updatedAt: now,
      })
      .where(eq(crisisScenario.id, id))
      .returning();

    // Create activation log entry
    await tx.insert(crisisLog).values({
      crisisScenarioId: id,
      orgId: ctx.orgId,
      timestamp: now,
      entryType: "status_change",
      title: `Crisis activated: ${current.name}`,
      description: initialAssessment ?? "Crisis has been activated.",
      createdBy: ctx.userId,
    });

    return row;
  });

  return Response.json({ data: updated });
});
