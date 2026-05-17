// Audit Overhaul Phase 3: AI checklist generator from framework + scope.

import { db, audit } from "@grc/db";
import { aiComplete, buildChecklistGenerationPrompt, safeJsonParse } from "@grc/ai";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

const schema = z.object({ locale: z.enum(["de", "en"]).optional() });

interface ChecklistItem {
  title: string;
  description?: string;
  method?: string;
  framework?: string;
  frameworkReference?: string;
  riskRating?: string;
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
      auditType: audit.auditType,
      scopeDescription: audit.scopeDescription,
      scopeFrameworks: audit.scopeFrameworks,
      scopeProcesses: audit.scopeProcesses,
    })
    .from(audit)
    .where(and(eq(audit.id, id), eq(audit.orgId, ctx.orgId), isNull(audit.deletedAt)));
  if (!existing) return Response.json({ error: "Audit not found" }, { status: 404 });

  const body = schema.safeParse(await req.json().catch(() => ({})));
  const locale = body.success ? body.data.locale ?? "de" : "de";

  const prompt = buildChecklistGenerationPrompt({
    auditTitle: existing.title,
    auditType: existing.auditType ?? "internal",
    scopeDescription: existing.scopeDescription,
    scopeFrameworks: existing.scopeFrameworks ?? [],
    scopeProcesses: existing.scopeProcesses ?? [],
    locale,
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

  const parsed = safeJsonParse<{ items?: ChecklistItem[] }>(resp.text);
  return Response.json({
    data: { items: parsed?.items ?? [], provider: resp.provider, model: resp.model },
  });
}
