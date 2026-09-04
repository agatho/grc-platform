import { db, eamDataObject } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createDataObjectSchema } from "@grc/shared";
import { eq, and, desc, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import { isUuidParam, invalidUuidParam } from "@/lib/query-schema";

// GET /api/v1/eam/data-objects — List data objects
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const parentId = url.searchParams.get("parentId");
  const flat = url.searchParams.get("flat") === "true";

  const conditions = [eq(eamDataObject.orgId, ctx.orgId)];
  if (!flat && !parentId) conditions.push(isNull(eamDataObject.parentId));
  // [Welle 4b-7 · OP-116] UUID-Form vor der Abfrage pruefen — sonst
  // entscheidet Postgres (22P02) und die Antwort nennt den Parameter nicht.
  if (parentId && !isUuidParam(parentId))
    return invalidUuidParam(req, "parentId");
  if (parentId) conditions.push(eq(eamDataObject.parentId, parentId));

  const objects = await db
    .select()
    .from(eamDataObject)
    .where(and(...conditions))
    .orderBy(desc(eamDataObject.updatedAt))
    .limit(500);

  return Response.json({ data: objects });
});
// POST /api/v1/eam/data-objects — Create data object
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createDataObjectSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });

  // Validate hierarchy depth (max 5)
  if (parsed.data.parentId) {
    let depth = 1;
    let currentParent = parsed.data.parentId;
    while (currentParent && depth < 6) {
      const parent = await db
        .select()
        .from(eamDataObject)
        .where(eq(eamDataObject.id, currentParent))
        .limit(1);
      if (!parent.length || !parent[0].parentId) break;
      currentParent = parent[0].parentId;
      depth++;
    }
    if (depth >= 5)
      return Response.json(
        { error: "Maximum hierarchy depth of 5 exceeded" },
        { status: 400 },
      );
  }

  const created = await db
    .insert(eamDataObject)
    .values({
      ...parsed.data,
      orgId: ctx.orgId,
      createdBy: ctx.userId,
    })
    .returning();

  return Response.json({ data: created[0] }, { status: 201 });
});
