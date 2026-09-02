import { db, onboardingSession, onboardingStep } from "@grc/db";
import { updateOnboardingStepSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// PATCH /api/v1/onboarding/:sessionId/steps/:stepNumber
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string; stepNumber: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { sessionId, stepNumber } = await params;

  const body = updateOnboardingStepSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify session belongs to org
  const [session] = await db
    .select()
    .from(onboardingSession)
    .where(
      and(
        eq(onboardingSession.id, sessionId),
        eq(onboardingSession.orgId, ctx.orgId),
      ),
    );

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {
    status: body.data.status,
    data: body.data.data,
  };

  if (body.data.status === "completed") {
    updateData.completedAt = new Date();
  } else if (body.data.status === "skipped") {
    updateData.skippedAt = new Date();
  }

  const [updated] = await db
    .update(onboardingStep)
    .set(updateData)
    .where(
      and(
        eq(onboardingStep.sessionId, sessionId),
        eq(onboardingStep.stepNumber, Number(stepNumber)),
      ),
    )
    .returning();

  if (!updated) {
    return Response.json({ error: "Step not found" }, { status: 404 });
  }

  // Advance session step
  const nextStep = Number(stepNumber) + 1;
  if (nextStep <= session.totalSteps) {
    await db
      .update(onboardingSession)
      .set({ currentStep: nextStep, updatedAt: new Date() })
      .where(eq(onboardingSession.id, sessionId));
  } else {
    await db
      .update(onboardingSession)
      .set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(onboardingSession.id, sessionId));
  }

  return Response.json({ data: updated });
});
