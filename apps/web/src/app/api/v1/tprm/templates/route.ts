import { db, catalog, catalogEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, asc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

const VALID_SOURCES = ["vda_isa_tisax", "eu_dora"] as const;

type TemplateSource = (typeof VALID_SOURCES)[number];

// GET /api/v1/tprm/templates?source=vda_isa_tisax|eu_dora
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const source = url.searchParams.get("source") as TemplateSource | null;

  if (!source) {
    return Response.json({
      data: {
        availableSources: [
          {
            key: "vda_isa_tisax",
            label: "VDA ISA / TISAX Assessment Criteria",
            description:
              "TISAX assessment criteria for vendor due diligence questionnaires",
          },
          {
            key: "eu_dora",
            label: "EU DORA ICT Third-Party Requirements",
            description:
              "DORA Chapter V requirements for ICT third-party vendor assessments",
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
    .orderBy(asc(catalogEntry.level), asc(catalogEntry.sortOrder));

  return Response.json({
    data: entries.map((e) => ({
      code: e.code,
      name: e.name,
      nameDe: e.nameDe,
      description: e.description,
      descriptionDe: e.descriptionDe,
      level: e.level,
    })),
  });
}
