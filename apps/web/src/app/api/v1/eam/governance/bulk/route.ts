import { db, architectureElement, eamGovernanceLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import { bulkGovernanceSchema } from "@grc/shared";
import { eq, and, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/eam/governance/bulk — Bulk governance actions
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bulkGovernanceSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });

  const { elementIds, action, justification } = parsed.data;

  const actionToStatus: Record<string, string> = {
    publish: "pending_review",
    approve: "approved",
    reject: "rejected",
    archive: "archived",
    change_to_suggestion: "draft",
  };
  const targetStatus = actionToStatus[action];

  const elements = await db
    .select()
    .from(architectureElement)
    .where(
      and(
        eq(architectureElement.orgId, ctx.orgId),
        inArray(architectureElement.id, elementIds),
      ),
    );

  // #PERF-N-PLUS-1: was one UPDATE + one INSERT per element (up to
  // 100 elements → 200 sequential round-trips). Replaced with ONE
  // batched UPDATE (inArray over the org-verified ids) and ONE
  // multi-row INSERT for the governance log. Response shape and
  // per-element fromStatus are unchanged — the log rows still carry
  // each element's own prior governanceStatus from the pre-fetch.
  if (elements.length > 0) {
    await db
      .update(architectureElement)
      .set({ governanceStatus: targetStatus, updatedAt: new Date() })
      .where(
        and(
          eq(architectureElement.orgId, ctx.orgId),
          inArray(
            architectureElement.id,
            elements.map((el) => el.id),
          ),
        ),
      );

    await db.insert(eamGovernanceLog).values(
      elements.map((el) => ({
        orgId: ctx.orgId,
        elementId: el.id,
        elementType: el.type,
        fromStatus: el.governanceStatus ?? "draft",
        toStatus: targetStatus,
        action,
        performedBy: ctx.userId,
        justification,
      })),
    );
  }

  const results: Array<{
    elementId: string;
    success: boolean;
    error?: string;
  }> = elements.map((el) => ({ elementId: el.id, success: true }));

  return Response.json({ data: { results, processedCount: results.length } });
}
