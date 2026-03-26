import { db, vendor, vendorDueDiligence } from "@grc/db";
import { createDueDiligenceSchema, reviewDueDiligenceSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { randomBytes } from "crypto";

// POST /api/v1/vendors/:id/due-diligence — Send DD questionnaire
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify vendor exists
  const [v] = await db
    .select({ id: vendor.id, name: vendor.name })
    .from(vendor)
    .where(and(eq(vendor.id, id), eq(vendor.orgId, ctx.orgId), isNull(vendor.deletedAt)));
  if (!v) {
    return Response.json({ error: "Vendor not found" }, { status: 404 });
  }

  const body = createDueDiligenceSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const accessToken = randomBytes(32).toString("hex");

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(vendorDueDiligence)
      .values({
        vendorId: id,
        orgId: ctx.orgId,
        questionnaireVersion: body.data.questionnaireVersion ?? "v1",
        status: "pending",
        sentAt: new Date(),
        accessToken,
      })
      .returning();

    // Update vendor status to onboarding if still prospect
    await tx
      .update(vendor)
      .set({ status: "onboarding", updatedBy: ctx.userId, updatedAt: new Date() })
      .where(
        and(eq(vendor.id, id), eq(vendor.orgId, ctx.orgId), eq(vendor.status, "prospect")),
      );

    return row;
  });

  return Response.json({
    data: created,
    submissionUrl: `/api/v1/vendors/dd/submit?token=${accessToken}`,
  }, { status: 201 });
}

// GET /api/v1/vendors/:id/due-diligence — List DD responses
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const records = await db
    .select()
    .from(vendorDueDiligence)
    .where(and(eq(vendorDueDiligence.vendorId, id), eq(vendorDueDiligence.orgId, ctx.orgId)))
    .orderBy(desc(vendorDueDiligence.createdAt));

  return Response.json({ data: records });
}
