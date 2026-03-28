import { db, eamContextAttribute, architectureElement } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/contexts/compare?a=ctx1&b=ctx2 — Compare two contexts
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const ctxA = url.searchParams.get("a");
  const ctxB = url.searchParams.get("b");
  if (!ctxA || !ctxB) return Response.json({ error: "Both context IDs (a and b) required" }, { status: 400 });

  const overridesA = await db.select().from(eamContextAttribute)
    .where(eq(eamContextAttribute.contextId, ctxA));
  const overridesB = await db.select().from(eamContextAttribute)
    .where(eq(eamContextAttribute.contextId, ctxB));

  const allElementIds = new Set([...overridesA.map((o) => o.elementId), ...overridesB.map((o) => o.elementId)]);
  const diffs: Array<{ elementId: string; changes: Array<{ field: string; valueA: string | null; valueB: string | null }> }> = [];

  const fields = ["functionalFit", "technicalFit", "timeClassification", "sixRStrategy", "businessCriticality", "lifecycleStatus"] as const;

  for (const elemId of allElementIds) {
    const a = overridesA.find((o) => o.elementId === elemId);
    const b = overridesB.find((o) => o.elementId === elemId);
    const changes: Array<{ field: string; valueA: string | null; valueB: string | null }> = [];

    for (const field of fields) {
      const valA = a?.[field] ?? null;
      const valB = b?.[field] ?? null;
      if (valA !== valB) changes.push({ field, valueA: valA, valueB: valB });
    }

    if (changes.length > 0) diffs.push({ elementId: elemId, changes });
  }

  return Response.json({ data: { contextA: ctxA, contextB: ctxB, diffs, totalChanged: diffs.length } });
}
