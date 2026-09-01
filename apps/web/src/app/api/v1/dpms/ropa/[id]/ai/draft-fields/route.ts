// DPMS Overhaul: AI-draft missing ROPA fields.
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-01, S05-06, S05-09, S05-10, S05-12]
//
// Das ist einer der beiden Pfade aus S05-01: `containsPersonalData: true`
// war als Schutz kommentiert, fiel aber ohne konfiguriertes lokales
// Modell still auf den Cloud-Default zurück — der Art.-30-Text ging an
// api.anthropic.com, ohne Hinweis an Nutzer oder Betreiber.
//
// Seit WP6 ist das Flag eine Bedingung: ohne Ollama/LM Studio scheitert
// der Aufruf mit 403 und dem Text „…es wurde kein Cloud-Provider
// kontaktiert". Der Fehlschlag wird in `ai_egress_log` mit
// `outcome='blocked'` festgehalten.

import { db, ropaEntry } from "@grc/db";
import {
  aiCompleteGoverned,
  buildRopaFieldDraftPrompt,
  ropaDraftSchema,
  safeJsonParse,
} from "@grc/ai";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";
import { aiRateLimit, aiErrorResponse, aiJson } from "../../../../../ai/_shared/ai-route";

const schema = z.object({
  hint: z.string().max(2000).optional(),
  locale: z.enum(["de", "en"]).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("dpms", ctx.orgId, req.method);
  if (m) return m;

  const limited = await aiRateLimit(ctx.userId);
  if (limited) return limited;

  const { id } = await params;
  const [r] = await db
    .select()
    .from(ropaEntry)
    .where(
      and(
        eq(ropaEntry.id, id),
        eq(ropaEntry.orgId, ctx.orgId),
        isNull(ropaEntry.deletedAt),
      ),
    );
  if (!r)
    return Response.json({ error: "ROPA entry not found" }, { status: 404 });

  const body = schema.safeParse(await req.json().catch(() => ({})));
  const locale = body.success ? (body.data.locale ?? "de") : "de";

  try {
    const result = await aiCompleteGoverned({
      feature: "dpms.ropa_draft_fields",
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: "ropa_entry",
      entityId: r.id,
      // Art.-30-Inhalte: darf die Installation nicht verlassen.
      containsPersonalData: true,
      messages: buildRopaFieldDraftPrompt({
        ropaTitle: r.title,
        processingDescription: r.processingDescription,
        hint: body.success ? (body.data.hint ?? null) : null,
        locale,
      }),
      maxTokens: 1500,
      temperature: 0.3,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: ropaDraftSchema,
    });

    return aiJson(
      { draft: result.data, provider: result.provider, model: result.model },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
}
