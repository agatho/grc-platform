import {
  db,
  vendor,
  questionnaireTemplate,
  vendorDueDiligence,
  ddSession,
} from "@grc/db";
import { inviteVendorSchema } from "@grc/shared";
import { generateDdToken } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/v1/vendors/:id/dd/invite — Invite vendor to DD questionnaire
export async function POST(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: vendorId } = await params;

  const body = inviteVendorSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify vendor belongs to org
  const existingVendor = await db.query.vendor.findFirst({
    where: and(
      eq(vendor.id, vendorId),
      eq(vendor.orgId, ctx.orgId),
      isNull(vendor.deletedAt),
    ),
  });

  if (!existingVendor) {
    return Response.json({ error: "Vendor not found" }, { status: 404 });
  }

  // Verify template is published
  const template = await db.query.questionnaireTemplate.findFirst({
    where: and(
      eq(questionnaireTemplate.id, body.data.templateId),
      eq(questionnaireTemplate.orgId, ctx.orgId),
      eq(questionnaireTemplate.status, "published"),
      isNull(questionnaireTemplate.deletedAt),
    ),
  });

  if (!template) {
    return Response.json(
      { error: "Template not found or not published" },
      { status: 400 },
    );
  }

  const accessToken = generateDdToken();
  const deadline = new Date(body.data.deadline);

  const result = await withAuditContext(ctx, async (tx) => {
    // Create DD record
    const [dd] = await tx
      .insert(vendorDueDiligence)
      .values({
        orgId: ctx.orgId,
        vendorId,
        status: "pending",
        questionnaireVersion: `v${template.version}`,
        sentAt: new Date(),
        accessToken: accessToken,
      })
      .returning();

    // Create session
    const [session] = await tx
      .insert(ddSession)
      .values({
        orgId: ctx.orgId,
        vendorId,
        dueDiligenceId: dd.id,
        templateId: template.id,
        templateVersion: template.version,
        accessToken,
        tokenExpiresAt: deadline,
        language: body.data.language,
        supplierEmail: body.data.supplierEmail,
        supplierName: body.data.supplierName,
        createdBy: ctx.userId,
      })
      .returning();

    return { session, dueDiligenceId: dd.id };
  });

  const portalBaseUrl =
    process.env.PORTAL_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  const portalUrl = `${portalBaseUrl}/dd/${accessToken}`;

  return Response.json(
    {
      data: result.session,
      portalUrl,
    },
    { status: 201 },
  );
}
