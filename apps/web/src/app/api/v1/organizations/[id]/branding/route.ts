import { db, orgBranding, organization } from "@grc/db";
import { updateBrandingSchema } from "@grc/shared";
import { eq, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

const DEFAULT_BRANDING = {
  primaryColor: "#2563eb",
  secondaryColor: "#1e40af",
  accentColor: "#f59e0b",
  textColor: "#0f172a",
  backgroundColor: "#ffffff",
  logoUrl: null,
  faviconUrl: null,
  darkModePrimaryColor: null,
  darkModeAccentColor: null,
  reportTemplate: "standard" as const,
  confidentialityNotice: "CONFIDENTIAL -- For internal use only",
  inheritFromParent: true,
  isInherited: false,
};

// GET /api/v1/organizations/:id/branding -- Retrieve branding with inheritance resolution
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id: orgId } = await params;

  // Fetch org with parent info
  const orgs = await db
    .select({
      id: organization.id,
      name: organization.name,
      parentOrgId: organization.parentOrgId,
    })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);

  const org = orgs[0];
  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  // Fetch branding for this org
  const brandings = await db
    .select()
    .from(orgBranding)
    .where(eq(orgBranding.orgId, orgId))
    .limit(1);

  let branding = brandings[0];
  let isInherited = false;

  // Resolve inheritance: if inheritFromParent is true and org has a parent
  if ((!branding || branding.inheritFromParent) && org.parentOrgId) {
    const parentBrandings = await db
      .select()
      .from(orgBranding)
      .where(eq(orgBranding.orgId, org.parentOrgId))
      .limit(1);

    if (parentBrandings[0]) {
      branding = parentBrandings[0];
      isInherited = true;
    }
  }

  // If no branding exists at all, return defaults
  if (!branding) {
    return Response.json({
      data: {
        ...DEFAULT_BRANDING,
        orgId,
        orgName: org.name,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  return Response.json({
    data: {
      id: branding.id,
      orgId: branding.orgId,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      accentColor: branding.accentColor,
      textColor: branding.textColor,
      backgroundColor: branding.backgroundColor,
      logoUrl: branding.logoPath ?? null,
      faviconUrl: branding.faviconPath ?? null,
      darkModePrimaryColor: branding.darkModePrimaryColor,
      darkModeAccentColor: branding.darkModeAccentColor,
      reportTemplate: branding.reportTemplate,
      confidentialityNotice: branding.confidentialityNotice,
      inheritFromParent: branding.inheritFromParent,
      customCss: branding.customCss,
      isInherited,
      orgName: org.name,
      updatedAt: branding.updatedAt?.toISOString() ?? new Date().toISOString(),
    },
  });
}

// PUT /api/v1/organizations/:id/branding -- Update branding settings (admin only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id: orgId } = await params;

  const rawBody = await req.json();
  const result = updateBrandingSchema.safeParse(rawBody);
  if (!result.success) {
    return Response.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 422 },
    );
  }

  const body = result.data;

  const updated = await withAuditContext(ctx, async (tx) => {
    // Check if branding already exists
    const existing = await tx
      .select()
      .from(orgBranding)
      .where(eq(orgBranding.orgId, orgId))
      .limit(1);

    if (existing[0]) {
      const [row] = await tx
        .update(orgBranding)
        .set({ ...body, updatedAt: new Date(), updatedBy: ctx.userId })
        .where(eq(orgBranding.orgId, orgId))
        .returning();
      return row;
    }

    // Create new branding record
    const [row] = await tx
      .insert(orgBranding)
      .values({ orgId, ...body, updatedBy: ctx.userId })
      .returning();
    return row;
  });

  return Response.json({ data: updated }, { status: updated ? 200 : 201 });
}
