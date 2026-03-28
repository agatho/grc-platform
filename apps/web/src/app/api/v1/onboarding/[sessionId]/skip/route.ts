import { db, onboardingSession } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/onboarding/:sessionId/skip — Skip remaining onboarding
export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { sessionId } = await params;

  const [updated] = await db
    .update(onboardingSession)
    .set({
      status: "skipped",
      skippedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(
      eq(onboardingSession.id, sessionId),
      eq(onboardingSession.orgId, ctx.orgId),
    ))
    .returning();

  if (!updated) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}
