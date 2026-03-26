import { db, orgActiveCatalog, riskCatalog, controlCatalog } from "@grc/db";
import { activateCatalogSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/organizations/[id]/active-catalogs — List active catalogs for org
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id: orgId } = await params;

  if (orgId !== ctx.orgId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const activeCatalogs = await db
    .select()
    .from(orgActiveCatalog)
    .where(eq(orgActiveCatalog.orgId, orgId));

  // Enrich with catalog names
  const enriched = await Promise.all(
    activeCatalogs.map(async (ac) => {
      let catalogName = "Unknown";
      if (ac.catalogType === "risk") {
        const [cat] = await db
          .select({ name: riskCatalog.name })
          .from(riskCatalog)
          .where(eq(riskCatalog.id, ac.catalogId));
        if (cat) catalogName = cat.name;
      } else if (ac.catalogType === "control") {
        const [cat] = await db
          .select({ name: controlCatalog.name })
          .from(controlCatalog)
          .where(eq(controlCatalog.id, ac.catalogId));
        if (cat) catalogName = cat.name;
      }
      return { ...ac, catalogName };
    }),
  );

  return Response.json({ data: enriched });
}

// POST /api/v1/organizations/[id]/active-catalogs — Activate a catalog for org
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id: orgId } = await params;

  if (orgId !== ctx.orgId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = activateCatalogSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Check if already active
  const [existing] = await db
    .select({ id: orgActiveCatalog.id })
    .from(orgActiveCatalog)
    .where(
      and(
        eq(orgActiveCatalog.orgId, orgId),
        eq(orgActiveCatalog.catalogType, body.data.catalogType),
        eq(orgActiveCatalog.catalogId, body.data.catalogId),
      ),
    );

  if (existing) {
    return Response.json(
      { error: "Catalog already activated for this organization" },
      { status: 409 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(orgActiveCatalog)
      .values({
        orgId,
        catalogType: body.data.catalogType,
        catalogId: body.data.catalogId,
        enforcementLevel: body.data.enforcementLevel,
        isMandatoryFromParent: body.data.isMandatoryFromParent,
        activatedBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
