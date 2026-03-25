import { db, organization } from "@grc/db";
import { requireModule } from "@grc/auth";
import { bpmnValidationConfigSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/organizations/:id/bpmn-validation-config — Get org's BPMN validation rules
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Ensure requested org matches current org context
  if (id !== ctx.orgId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [org] = await db
    .select({ settings: organization.settings })
    .from(organization)
    .where(
      and(
        eq(organization.id, id),
        isNull(organization.deletedAt),
      ),
    );

  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  const settings = (org.settings ?? {}) as Record<string, unknown>;
  const bpmnValidationRules = settings.bpmn_validation_rules ?? {
    missingStartEvent: "error",
    missingEndEvent: "error",
    disconnectedElements: "error",
    gatewayMissingDefault: "warning",
  };

  return Response.json({ data: bpmnValidationRules });
}

// PUT /api/v1/organizations/:id/bpmn-validation-config — Update BPMN validation rules (admin only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Ensure requested org matches current org context
  if (id !== ctx.orgId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = bpmnValidationConfigSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Fetch current settings
  const [org] = await db
    .select({ settings: organization.settings })
    .from(organization)
    .where(
      and(
        eq(organization.id, id),
        isNull(organization.deletedAt),
      ),
    );

  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  const currentSettings = (org.settings ?? {}) as Record<string, unknown>;
  const updatedSettings = {
    ...currentSettings,
    bpmn_validation_rules: body.data,
  };

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(organization)
      .set({
        settings: updatedSettings,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(organization.id, id));
  });

  return Response.json({ data: body.data });
}
