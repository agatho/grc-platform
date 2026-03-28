import { db, onboardingSession, onboardingStep } from "@grc/db";
import { startOnboardingSchema } from "@grc/shared";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

const ONBOARDING_STEPS = [
  { stepNumber: 1, stepKey: "welcome", title: "Welcome" },
  { stepNumber: 2, stepKey: "org_profile", title: "Organization Profile" },
  { stepNumber: 3, stepKey: "frameworks", title: "Select Frameworks" },
  { stepNumber: 4, stepKey: "modules", title: "Enable Modules" },
  { stepNumber: 5, stepKey: "users", title: "Invite Team Members" },
  { stepNumber: 6, stepKey: "templates", title: "Apply Templates" },
  { stepNumber: 7, stepKey: "sample_data", title: "Sample Data" },
  { stepNumber: 8, stepKey: "complete", title: "Complete Setup" },
];

// POST /api/v1/onboarding — Start onboarding
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = startOnboardingSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Check for existing active session
  const [existing] = await db
    .select()
    .from(onboardingSession)
    .where(and(
      eq(onboardingSession.orgId, ctx.orgId),
      eq(onboardingSession.status, "in_progress"),
    ));

  if (existing) {
    return Response.json({ data: existing });
  }

  const [session] = await db
    .insert(onboardingSession)
    .values({
      orgId: ctx.orgId,
      orgProfile: body.data.orgProfile,
      totalSteps: ONBOARDING_STEPS.length,
      startedBy: ctx.userId,
    })
    .returning();

  // Create all steps
  await db.insert(onboardingStep).values(
    ONBOARDING_STEPS.map((s) => ({
      sessionId: session.id,
      ...s,
    })),
  );

  return Response.json({ data: session }, { status: 201 });
}

// GET /api/v1/onboarding — Get current onboarding session
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const [session] = await db
    .select()
    .from(onboardingSession)
    .where(eq(onboardingSession.orgId, ctx.orgId))
    .orderBy(desc(onboardingSession.createdAt))
    .limit(1);

  if (!session) {
    return Response.json({ data: null });
  }

  const steps = await db
    .select()
    .from(onboardingStep)
    .where(eq(onboardingStep.sessionId, session.id))
    .orderBy(onboardingStep.stepNumber);

  return Response.json({ data: { ...session, steps } });
}
