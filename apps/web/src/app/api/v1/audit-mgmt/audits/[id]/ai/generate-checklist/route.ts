// Audit Overhaul Phase 3: AI checklist generator from framework + scope.
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09, S05-10, S05-11, S05-12]

import { db, audit } from "@grc/db";
import {
  aiCompleteGoverned,
  buildChecklistGenerationPrompt,
  checklistItemsSchema,
  safeJsonParse,
} from "@grc/ai";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";
import { aiRateLimit, aiErrorResponse, aiJson } from "../../../../../ai/_shared/ai-route";

const schema = z.object({ locale: z.enum(["de", "en"]).optional() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "auditor", "compliance_officer");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("audit", ctx.orgId, req.method);
  if (m) return m;

  const limited = await aiRateLimit(ctx.userId);
  if (limited) return limited;

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
    .where(
      and(eq(audit.id, id), eq(audit.orgId, ctx.orgId), isNull(audit.deletedAt)),
    );
  if (!existing)
    return Response.json({ error: "Audit not found" }, { status: 404 });

  const body = schema.safeParse(await req.json().catch(() => ({})));
  const locale = body.success ? (body.data.locale ?? "de") : "de";

  try {
    const result = await aiCompleteGoverned({
      feature: "audit.generate_checklist",
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: "audit",
      entityId: existing.id,
      messages: buildChecklistGenerationPrompt({
        auditTitle: existing.title,
        auditType: existing.auditType ?? "internal",
        scopeDescription: existing.scopeDescription,
        scopeFrameworks: existing.scopeFrameworks ?? [],
        scopeProcesses: existing.scopeProcesses ?? [],
        locale,
      }),
      maxTokens: 2500,
      temperature: 0.3,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: checklistItemsSchema,
    });

    return aiJson(
      {
        items: result.data.items,
        provider: result.provider,
        model: result.model,
      },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
}
