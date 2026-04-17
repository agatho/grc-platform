import {
  db,
  auditChecklist,
  auditChecklistItem,
  audit,
  control,
  catalogEntry,
  orgActiveCatalog,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, inArray, asc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/audit-mgmt/audits/[id]/checklists/generate
// Generate a checklist from items in scope.
//
// Body (optional): { catalogId?: string }
//   - If `catalogId` is provided: generate ONLY from that catalog's entries
//     (requires the catalog to be active on the org). Enables targeted
//     dropdown picks like "ISO 27001 Annex A" in the Audit-Checklist UI.
//   - Without `catalogId`: legacy behaviour -- prefer org-owned `control`
//     rows, fall back to catalog_entry rows across ALL active control
//     catalogs.
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Optional body — tolerate empty body for backwards compatibility.
  let targetCatalogId: string | undefined;
  try {
    const raw = await req.text();
    if (raw && raw.trim().length > 0) {
      const body = JSON.parse(raw);
      if (typeof body?.catalogId === "string" && body.catalogId.length > 0) {
        targetCatalogId = body.catalogId;
      }
    }
  } catch {
    // Invalid JSON body -- ignore and use legacy behaviour.
  }

  // Get the audit
  const [existing] = await db
    .select()
    .from(audit)
    .where(
      and(
        eq(audit.id, id),
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Audit not found" }, { status: 404 });
  }

  type Item = {
    controlId: string | null;
    title: string;
    description: string | null;
    source: "control" | "catalog_entry";
  };
  const items: Item[] = [];

  // Branch A: Specific catalog picked in the UI -- bypass controls, only
  // generate from the targeted catalog's entries (and only if the org has
  // it activated, to prevent cross-tenant abuse).
  if (targetCatalogId) {
    const [activation] = await db
      .select({ catalogId: orgActiveCatalog.catalogId })
      .from(orgActiveCatalog)
      .where(
        and(
          eq(orgActiveCatalog.orgId, ctx.orgId),
          eq(orgActiveCatalog.catalogType, "control"),
          eq(orgActiveCatalog.catalogId, targetCatalogId),
        ),
      );
    if (!activation) {
      return Response.json(
        { error: "Catalog is not activated on this organization" },
        { status: 422 },
      );
    }
    const entries = await db
      .select({
        id: catalogEntry.id,
        code: catalogEntry.code,
        name: catalogEntry.name,
        nameDe: catalogEntry.nameDe,
        description: catalogEntry.description,
        descriptionDe: catalogEntry.descriptionDe,
      })
      .from(catalogEntry)
      .where(
        and(
          eq(catalogEntry.catalogId, targetCatalogId),
          eq(catalogEntry.status, "active"),
        ),
      )
      .orderBy(asc(catalogEntry.sortOrder))
      .limit(500);
    for (const e of entries) {
      const title = `${e.code} — ${e.nameDe ?? e.name}`;
      items.push({
        controlId: null,
        title,
        description: e.descriptionDe ?? e.description,
        source: "catalog_entry",
      });
    }
  } else {
    // Branch B: Legacy behaviour -- prefer org-owned controls, fall back
    // to catalog entries across all active control catalogs.
    const controls = await db
      .select({
        id: control.id,
        title: control.title,
        description: control.description,
      })
      .from(control)
      .where(and(eq(control.orgId, ctx.orgId), isNull(control.deletedAt)))
      .limit(200);
    for (const c of controls) {
      items.push({
        controlId: c.id,
        title: c.title,
        description: c.description,
        source: "control",
      });
    }
    if (items.length === 0) {
      const activeCatalogs = await db
        .select({ catalogId: orgActiveCatalog.catalogId })
        .from(orgActiveCatalog)
        .where(
          and(
            eq(orgActiveCatalog.orgId, ctx.orgId),
            eq(orgActiveCatalog.catalogType, "control"),
          ),
        );

      if (activeCatalogs.length > 0) {
        const catalogIds = activeCatalogs.map((c) => c.catalogId);
        const entries = await db
          .select({
            id: catalogEntry.id,
            code: catalogEntry.code,
            name: catalogEntry.name,
            nameDe: catalogEntry.nameDe,
            description: catalogEntry.description,
            descriptionDe: catalogEntry.descriptionDe,
          })
          .from(catalogEntry)
          .where(
            and(
              inArray(catalogEntry.catalogId, catalogIds),
              eq(catalogEntry.status, "active"),
            ),
          )
          .orderBy(asc(catalogEntry.sortOrder))
          .limit(500);

        for (const e of entries) {
          const title = `${e.code} — ${e.nameDe ?? e.name}`;
          items.push({
            controlId: null,
            title,
            description: e.descriptionDe ?? e.description,
            source: "catalog_entry",
          });
        }
      }
    }
  }

  if (items.length === 0) {
    return Response.json(
      {
        error:
          "No controls or active catalog entries in scope. Activate a control catalog (e.g. ISO 27001 Annex A) on this organization or add controls before generating a checklist.",
      },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [checklist] = await tx
      .insert(auditChecklist)
      .values({
        orgId: ctx.orgId,
        auditId: id,
        name: `Auto-generated Checklist - ${existing.title}`,
        sourceType: "auto_controls",
        totalItems: items.length,
        completedItems: 0,
        createdBy: ctx.userId,
      })
      .returning();

    const rows = items.map((item, idx) => ({
      orgId: ctx.orgId,
      checklistId: checklist.id,
      controlId: item.controlId,
      question: `Ist "${item.title}" in der Organisation wirksam umgesetzt?`,
      expectedEvidence: item.description
        ? item.description.substring(0, 200)
        : undefined,
      sortOrder: idx + 1,
    }));

    const createdItems = await tx
      .insert(auditChecklistItem)
      .values(rows)
      .returning();

    return {
      checklist,
      itemCount: createdItems.length,
    };
  });

  return Response.json({ data: created }, { status: 201 });
}
