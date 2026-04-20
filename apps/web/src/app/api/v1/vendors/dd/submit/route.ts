import { db, vendorDueDiligence } from "@grc/db";
import { completeDueDiligenceSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";

// POST /api/v1/vendors/dd/submit — External DD submission (token-based, NO auth)
export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return Response.json({ error: "Missing token" }, { status: 400 });
  }

  // Find DD record by access token
  const [dd] = await db
    .select()
    .from(vendorDueDiligence)
    .where(eq(vendorDueDiligence.accessToken, token));

  if (!dd) {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 404 },
    );
  }

  if (dd.status === "completed") {
    return Response.json(
      { error: "Questionnaire already submitted" },
      { status: 409 },
    );
  }

  if (dd.status === "expired") {
    return Response.json(
      { error: "Questionnaire has expired" },
      { status: 410 },
    );
  }

  const body = completeDueDiligenceSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [updated] = await db
    .update(vendorDueDiligence)
    .set({
      status: "completed",
      responses: body.data.responses,
      riskScore: body.data.riskScore,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(vendorDueDiligence.accessToken, token),
        eq(vendorDueDiligence.id, dd.id),
      ),
    )
    .returning();

  return Response.json({
    data: {
      id: updated.id,
      status: updated.status,
      completedAt: updated.completedAt,
    },
  });
}
