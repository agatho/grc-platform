import { db, orgActiveCatalog, catalog } from "@grc/db";
import { activateCatalogSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/organizations/[id]/active-catalogs — List active catalogs for org
export const GET = withErrorHandler(async function GET(
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

  // Enrich with catalog names from generic catalog table
  const enriched = await Promise.all(
    activeCatalogs.map(async (ac) => {
      let catalogName = "Unknown";
      let targetModules: string[] = [];
      const [cat] = await db
        .select({ name: catalog.name, targetModules: catalog.targetModules })
        .from(catalog)
        .where(eq(catalog.id, ac.catalogId));
      if (cat) {
        catalogName = cat.name;
        targetModules = cat.targetModules ?? [];
      }
      return { ...ac, catalogName, targetModules };
    }),
  );

  return Response.json({ data: enriched });
});
// POST /api/v1/organizations/[id]/active-catalogs — Activate a catalog for org
export const POST = withErrorHandler(async function POST(
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
});
