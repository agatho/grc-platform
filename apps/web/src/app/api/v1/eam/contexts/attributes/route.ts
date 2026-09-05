import { db, eamContextAttribute } from "@grc/db";
import { requireModule } from "@grc/auth";
import { setContextAttributeSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import { isUuidParam, invalidUuidParam } from "@/lib/query-schema";

// GET /api/v1/eam/contexts/:id/attributes — Context-specific attributes
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const contextId = url.searchParams.get("contextId");
  if (!contextId)
    return Response.json({ error: "contextId required" }, { status: 400 });
  // [Welle 4b-7 · OP-116] UUID-Form vor der Abfrage pruefen — sonst
  // entscheidet Postgres (22P02) und die Antwort nennt den Parameter nicht.
  if (!isUuidParam(contextId)) return invalidUuidParam(req, "contextId");

  const attributes = await db
    .select()
    .from(eamContextAttribute)
    .where(
      and(
        eq(eamContextAttribute.contextId, contextId),
        eq(eamContextAttribute.orgId, ctx.orgId),
      ),
    );

  return Response.json({ data: attributes });
});
// PUT /api/v1/eam/contexts/:id/attributes/:elementId — Set context override for element
export const PUT = withErrorHandler(async function PUT(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const contextId = url.searchParams.get("contextId");
  const elementId = url.searchParams.get("elementId");
  if (!contextId || !elementId)
    return Response.json(
      { error: "contextId and elementId required" },
      { status: 400 },
    );
  // [Welle 4b-7 · OP-116] UUID-Form vor der Abfrage pruefen — sonst
  // entscheidet Postgres (22P02) und die Antwort nennt den Parameter nicht.
  if (!isUuidParam(contextId)) return invalidUuidParam(req, "contextId");
  if (!isUuidParam(elementId)) return invalidUuidParam(req, "elementId");

  const body = await req.json();
  const parsed = setContextAttributeSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });

  // Upsert: insert or update
  const existing = await db
    .select()
    .from(eamContextAttribute)
    .where(
      and(
        eq(eamContextAttribute.contextId, contextId),
        eq(eamContextAttribute.elementId, elementId),
      ),
    )
    .limit(1);

  let result;
  if (existing.length) {
    result = await db
      .update(eamContextAttribute)
      .set(parsed.data)
      .where(eq(eamContextAttribute.id, existing[0].id))
      .returning();
  } else {
    result = await db
      .insert(eamContextAttribute)
      .values({
        ...parsed.data,
        contextId,
        elementId,
        orgId: ctx.orgId,
      })
      .returning();
  }

  return Response.json({ data: result[0] });
});
