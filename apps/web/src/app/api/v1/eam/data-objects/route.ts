import { db, eamDataObject } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createDataObjectSchema, updateDataObjectSchema } from "@grc/shared";
import { eq, and, desc, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/data-objects — List data objects
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const parentId = url.searchParams.get("parentId");
  const flat = url.searchParams.get("flat") === "true";

  let conditions = [eq(eamDataObject.orgId, ctx.orgId)];
  if (!flat && !parentId) conditions.push(isNull(eamDataObject.parentId));
  if (parentId) conditions.push(eq(eamDataObject.parentId, parentId));

  const objects = await db.select().from(eamDataObject)
    .where(and(...conditions))
    .orderBy(desc(eamDataObject.updatedAt))
    .limit(500);

  return Response.json({ data: objects });
}

// POST /api/v1/eam/data-objects — Create data object
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createDataObjectSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  // Validate hierarchy depth (max 5)
  if (parsed.data.parentId) {
    let depth = 1;
    let currentParent = parsed.data.parentId;
    while (currentParent && depth < 6) {
      const parent = await db.select().from(eamDataObject)
        .where(eq(eamDataObject.id, currentParent)).limit(1);
      if (!parent.length || !parent[0].parentId) break;
      currentParent = parent[0].parentId;
      depth++;
    }
    if (depth >= 5) return Response.json({ error: "Maximum hierarchy depth of 5 exceeded" }, { status: 400 });
  }

  const created = await db.insert(eamDataObject).values({
    ...parsed.data,
    orgId: ctx.orgId,
    createdBy: ctx.userId,
  }).returning();

  return Response.json({ data: created[0] }, { status: 201 });
}
