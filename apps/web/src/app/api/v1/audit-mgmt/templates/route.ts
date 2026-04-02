import { db, catalog, catalogEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, asc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

const VALID_SOURCES = [
  "iia_standards_2024",
  "isae3402_soc2",
  "cobit_2019",
] as const;

type TemplateSource = (typeof VALID_SOURCES)[number];

// GET /api/v1/audit-mgmt/templates?source=iia_standards_2024|isae3402_soc2|cobit_2019
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const source = url.searchParams.get("source") as TemplateSource | null;

  if (!source) {
    return Response.json({
      data: {
        availableSources: [
          {
            key: "iia_standards_2024",
            label: "IIA Global Internal Audit Standards 2024",
            description: "Checklist template items based on IIA standards",
          },
          {
            key: "isae3402_soc2",
            label: "ISAE 3402 / SOC 2 Trust Criteria",
            description: "SOC 2 trust service criteria as checklist template items",
          },
          {
            key: "cobit_2019",
            label: "COBIT 2019 Governance Objectives",
            description: "COBIT objectives as audit universe items",
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
