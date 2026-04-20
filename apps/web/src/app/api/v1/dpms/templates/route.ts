import { db, catalog, catalogEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, asc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

const VALID_SOURCES = [
  "gdpr_legal_bases",
  "gdpr_data_categories",
  "arctos_dpia_criteria",
] as const;

type TemplateSource = (typeof VALID_SOURCES)[number];

// GET /api/v1/dpms/templates?source=gdpr_legal_bases|gdpr_data_categories|arctos_dpia_criteria
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const source = url.searchParams.get("source") as TemplateSource | null;

  // If no source, return all available template types
  if (!source) {
    return Response.json({
      data: {
        availableSources: [
          {
            key: "gdpr_legal_bases",
            label: "GDPR Art. 6 Legal Bases",
            description: "Legal bases for RoPA legal basis field",
          },
          {
            key: "gdpr_data_categories",
            label: "GDPR Data Categories",
            description: "Data category options for RoPA entries",
          },
          {
            key: "arctos_dpia_criteria",
            label: "DPIA Criteria",
            description:
              "Checklist items for Data Protection Impact Assessment",
          },
        ],
      },
    });
  }

  if (!VALID_SOURCES.includes(source)) {
    return Response.json(
      { error: "Invalid source. Must be one of: " + VALID_SOURCES.join(", ") },
      { status: 400 },
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
      level: catalogEntry.level,
      sortOrder: catalogEntry.sortOrder,
      metadata: catalogEntry.metadata,
    })
    .from(catalogEntry)
    .innerJoin(catalog, eq(catalogEntry.catalogId, catalog.id))
    .where(
      and(
        eq(catalog.source, source),
        eq(catalogEntry.status, "active"),
        eq(catalog.isActive, true),
      ),
    )
    .orderBy(asc(catalogEntry.sortOrder));

  // Map to template format depending on source
  let templateType: string;
  switch (source) {
    case "gdpr_legal_bases":
      templateType = "ropa_legal_basis_options";
      break;
    case "gdpr_data_categories":
      templateType = "ropa_data_category_options";
      break;
    case "arctos_dpia_criteria":
      templateType = "dpia_checklist_items";
      break;
  }

  return Response.json({
    data: {
      source,
      templateType,
      count: entries.length,
      items: entries,
    },
  });
}
