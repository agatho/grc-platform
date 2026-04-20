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
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

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

  const results: Array<{
    elementId: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const el of elements) {
    // Update element
    await db
      .update(architectureElement)
      .set({ governanceStatus: targetStatus, updatedAt: new Date() })
      .where(eq(architectureElement.id, el.id));

    // Log
    await db.insert(eamGovernanceLog).values({
      orgId: ctx.orgId,
      elementId: el.id,
      elementType: el.type,
      fromStatus: el.governanceStatus ?? "draft",
      toStatus: targetStatus,
      action,
      performedBy: ctx.userId,
      justification,
    });

    results.push({ elementId: el.id, success: true });
  }

  return Response.json({ data: { results, processedCount: results.length } });
}
