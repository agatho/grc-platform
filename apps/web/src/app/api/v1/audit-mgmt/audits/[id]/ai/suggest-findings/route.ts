// Audit Overhaul Phase 3: AI finding-suggester from nonconforming checklist items.

import { db, audit } from "@grc/db";
import { aiComplete, buildFindingSuggestionPrompt, safeJsonParse } from "@grc/ai";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";

interface Suggestion {
  title: string;
  description?: string;
  severity?: "critical" | "high" | "medium" | "low";
  evidenceSummary?: string;
  remediationPlan?: string;
  remediationDueDateRelativeDays?: number;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "auditor", "compliance_officer");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("audit", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [existing] = await db
    .select({
      id: audit.id,
      title: audit.title,
      scopeFrameworks: audit.scopeFrameworks,
    })
    .from(audit)
    .where(and(eq(audit.id, id), eq(audit.orgId, ctx.orgId), isNull(audit.deletedAt)));
  if (!existing) return Response.json({ error: "Audit not found" }, { status: 404 });

  const noncon = await withReadContext(ctx, async (tx) => {
    return tx.execute(sql`
      SELECT ci.title, ci.description, ci.result, ci.notes
      FROM audit_checklist ck
      JOIN audit_checklist_item ci ON ci.audit_checklist_id = ck.id
      WHERE ck.audit_id = ${id}
        AND ci.result IN ('minor_nonconformity', 'major_nonconformity', 'observation')
    `);
  });

  if ((noncon as any[]).length === 0) {
    return Response.json({
      data: { suggestions: [], note: "No nonconforming items to draft findings from." },
    });
  }

  const prompt = buildFindingSuggestionPrompt({
    auditTitle: existing.title,
    scopeFrameworks: existing.scopeFrameworks ?? [],
    nonconformingItems: noncon as any[],
  });

  let resp;
  try {
    resp = await aiComplete({ messages: prompt, maxTokens: 2500, temperature: 0.3 });
  } catch (err) {
    return Response.json(
      { error: "AI provider failure", details: (err as Error).message },
      { status: 502 },
    );
  }

  const parsed = safeJsonParse<{ findings?: Suggestion[] }>(resp.text);
  return Response.json({
    data: {
      suggestions: parsed?.findings ?? [],
      provider: resp.provider,
      model: resp.model,
    },
  });
}
