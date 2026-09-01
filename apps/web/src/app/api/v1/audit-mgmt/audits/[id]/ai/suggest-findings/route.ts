// Audit Overhaul Phase 3: AI finding-suggester from nonconforming checklist items.
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09, S05-10, S05-11, S05-12]
// Diese Route war laut Audit die einzige der 23, die WEDER Request-Body
// NOCH Modellausgabe validierte. Beides ist jetzt vorhanden: ein
// Zod-Body-Schema und `findingSuggestionsSchema` für die Ausgabe. Der
// Prompt enthält die Prüfernotizen — freier Nutzertext, deshalb der
// Datenumschlag.

import { db, audit } from "@grc/db";
import {
  aiCompleteGoverned,
  buildFindingSuggestionPrompt,
  findingSuggestionsSchema,
  safeJsonParse,
} from "@grc/ai";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";
import { z } from "zod";
import { aiRateLimit, aiErrorResponse, aiJson } from "../../../../../ai/_shared/ai-route";

const schema = z.object({ locale: z.enum(["de", "en"]).optional() });

interface NonconformingRow {
  title: string;
  description: string | null;
  result: string | null;
  notes: string | null;
}

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

  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }
  const locale = body.data.locale ?? "de";

  const { id } = await params;
  const [existing] = await db
    .select({
      id: audit.id,
      title: audit.title,
      scopeFrameworks: audit.scopeFrameworks,
    })
    .from(audit)
    .where(
      and(eq(audit.id, id), eq(audit.orgId, ctx.orgId), isNull(audit.deletedAt)),
    );
  if (!existing)
    return Response.json({ error: "Audit not found" }, { status: 404 });

  const noncon = (await withReadContext(ctx, async (tx) =>
    tx.execute(sql`
      SELECT ci.title, ci.description, ci.result, ci.notes
      FROM audit_checklist ck
      JOIN audit_checklist_item ci ON ci.audit_checklist_id = ck.id
      WHERE ck.audit_id = ${id}
        AND ci.result IN ('minor_nonconformity', 'major_nonconformity', 'observation')
    `),
  )) as unknown as NonconformingRow[];

  if (noncon.length === 0) {
    return Response.json({
      data: {
        suggestions: [],
        note: "No nonconforming items to draft findings from.",
      },
    });
  }

  try {
    const result = await aiCompleteGoverned({
      feature: "audit.suggest_findings",
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: "audit",
      entityId: existing.id,
      messages: buildFindingSuggestionPrompt({
        auditTitle: existing.title,
        scopeFrameworks: existing.scopeFrameworks ?? [],
        nonconformingItems: noncon,
        locale,
      }),
      maxTokens: 2500,
      temperature: 0.3,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: findingSuggestionsSchema,
    });

    return aiJson(
      {
        suggestions: result.data.findings,
        provider: result.provider,
        model: result.model,
      },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
}
