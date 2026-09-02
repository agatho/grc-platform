import { db, architectureElement, architectureRelationship } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/eam/diagrams/it-components — IT component hierarchy data
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const components = await db
    .select()
    .from(architectureElement)
    .where(
      and(
        eq(architectureElement.orgId, ctx.orgId),
        eq(architectureElement.layer, "technology"),
      ),
    );

  const relationships = await db
    .select()
    .from(architectureRelationship)
    .where(
      and(
        eq(architectureRelationship.orgId, ctx.orgId),
        eq(architectureRelationship.relationshipType, "composes"),
      ),
    );

  // Build hierarchy
  const childMap = new Map<string, string[]>();
  for (const rel of relationships) {
    const children = childMap.get(rel.targetId) ?? [];
    children.push(rel.sourceId);
    childMap.set(rel.targetId, children);
  }

  function buildTree(id: string): Record<string, unknown> {
    const node = components.find((c) => c.id === id);
    const childIds = childMap.get(id) ?? [];
    return {
      id,
      name: node?.name ?? "Unknown",
      type: node?.type ?? "unknown",
      children: childIds.map((cid) => buildTree(cid)),
    };
  }

  // Root nodes = nodes that are not children of anything
  const allChildIds = new Set(relationships.map((r) => r.sourceId));
  const roots = components.filter((c) => !allChildIds.has(c.id));

  return Response.json({ data: roots.map((r) => buildTree(r.id)) });
});
