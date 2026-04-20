import { db, businessCapability, architectureElement } from "@grc/db";
import { createBusinessCapabilitySchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, asc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/eam/capabilities — Capability tree (hierarchical)
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const capabilities = await db
    .select({
      capability: businessCapability,
      element: architectureElement,
    })
    .from(businessCapability)
    .innerJoin(
      architectureElement,
      eq(businessCapability.elementId, architectureElement.id),
    )
    .where(eq(businessCapability.orgId, ctx.orgId))
    .orderBy(asc(businessCapability.level), asc(businessCapability.sortOrder));

  // Build tree structure
  const map = new Map<string, Record<string, unknown>>();
  const roots: Record<string, unknown>[] = [];

  for (const row of capabilities) {
    const node = {
      ...row.capability,
      element: row.element,
      children: [] as Record<string, unknown>[],
    };
    map.set(row.capability.id, node);
  }

  for (const row of capabilities) {
    const node = map.get(row.capability.id)!;
    if (row.capability.parentId && map.has(row.capability.parentId)) {
      (
        map.get(row.capability.parentId)!.children as Record<string, unknown>[]
      ).push(node);
    } else {
      roots.push(node);
    }
  }

  return Response.json({ data: roots });
}

// POST /api/v1/eam/capabilities — Create capability
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createBusinessCapabilitySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Enforce max depth = 4
  let level = 1;
  if (body.data.parentId) {
    const [parent] = await db
      .select({ level: businessCapability.level })
      .from(businessCapability)
      .where(
        and(
          eq(businessCapability.id, body.data.parentId),
          eq(businessCapability.orgId, ctx.orgId),
        ),
      );
    if (!parent) {
      return Response.json(
        { error: "Parent capability not found" },
        { status: 404 },
      );
    }
    level = parent.level + 1;
    if (level > 4) {
      return Response.json(
        { error: "Maximum capability depth is 4 levels" },
        { status: 400 },
      );
    }
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // Create architecture element first if not provided
    let elementId = body.data.elementId;
    if (!elementId) {
      const [element] = await tx
        .insert(architectureElement)
        .values({
          orgId: ctx.orgId,
          name: body.data.name,
          description: body.data.description,
          layer: "business",
          type: "business_capability",
          createdBy: ctx.userId,
        })
        .returning();
      elementId = element.id;
    }

    const [created] = await tx
      .insert(businessCapability)
      .values({
        orgId: ctx.orgId,
        elementId: elementId!,
        parentId: body.data.parentId,
        level,
        sortOrder: body.data.sortOrder ?? 0,
        maturityLevel: body.data.maturityLevel,
        strategicImportance: body.data.strategicImportance,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
