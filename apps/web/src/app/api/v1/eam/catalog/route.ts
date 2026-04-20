import {
  db,
  architectureElement,
  applicationPortfolio,
  businessCapability,
  eamDataObject,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc, sql, ilike } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/catalog — Unified catalog with faceted filters
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const search = url.searchParams.get("search");
  const objectTypes = url.searchParams.getAll("objectType");
  const keywords = url.searchParams.getAll("keyword");
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const pageSize = Math.min(
    parseInt(url.searchParams.get("pageSize") ?? "50"),
    200,
  );
  const offset = (page - 1) * pageSize;

  // Build union query across multiple tables
  const items: Array<Record<string, unknown>> = [];

  const shouldInclude = (type: string) =>
    objectTypes.length === 0 || objectTypes.includes(type);

  if (
    shouldInclude("application") ||
    shouldInclude("it_component") ||
    shouldInclude("provider")
  ) {
    const aeResult = await db
      .select({
        id: architectureElement.id,
        name: architectureElement.name,
        description: architectureElement.description,
        type: architectureElement.type,
        keywords: architectureElement.keywords,
        status: architectureElement.status,
        updatedAt: architectureElement.updatedAt,
        governanceStatus: architectureElement.governanceStatus,
      })
      .from(architectureElement)
      .where(
        and(
          eq(architectureElement.orgId, ctx.orgId),
          search ? ilike(architectureElement.name, `%${search}%`) : undefined,
          keywords.length > 0
            ? sql`${architectureElement.keywords} @> ${keywords}`
            : undefined,
        ),
      )
      .limit(pageSize);

    for (const el of aeResult) {
      // architecture_type enum no longer has a "provider" value — only
      // "application" maps 1:1; infra variants collapse to "it_component".
      const objectType =
        el.type === "application"
          ? "application"
          : [
                "server",
                "network",
                "cloud_service",
                "database",
                "infrastructure_service",
              ].includes(el.type)
            ? "it_component"
            : el.type;
      if (shouldInclude(objectType)) {
        items.push({ ...el, objectType });
      }
    }
  }

  if (shouldInclude("business_capability")) {
    const bcResult = await db
      .select({
        id: businessCapability.id,
        name: sql`(SELECT name FROM architecture_element WHERE id = ${businessCapability.elementId})`,
        keywords: businessCapability.keywords,
      })
      .from(businessCapability)
      .where(eq(businessCapability.orgId, ctx.orgId))
      .limit(pageSize);

    for (const bc of bcResult) {
      items.push({ ...bc, objectType: "business_capability" });
    }
  }

  if (shouldInclude("data_object")) {
    const doResult = await db
      .select()
      .from(eamDataObject)
      .where(
        and(
          eq(eamDataObject.orgId, ctx.orgId),
          search ? ilike(eamDataObject.name, `%${search}%`) : undefined,
        ),
      )
      .limit(pageSize);

    for (const dobj of doResult) {
      items.push({ ...dobj, objectType: "data_object" });
    }
  }

  // Compute facets
  const facetFields = ["objectType", "status", "type"];
  const facets = facetFields.map((field) => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const val = String(item[field] ?? "");
      if (val) counts.set(val, (counts.get(val) ?? 0) + 1);
    }
    return {
      field,
      values: [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
    };
  });

  return Response.json({
    data: {
      items: items.slice(0, pageSize),
      total: items.length,
      page,
      pageSize,
      facets,
    },
  });
}
