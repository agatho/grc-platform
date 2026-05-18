// DPMS Overhaul: AI-draft missing ROPA fields.

import { db, ropaEntry } from "@grc/db";
import { aiComplete, buildRopaFieldDraftPrompt, safeJsonParse } from "@grc/ai";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

const schema = z.object({
  hint: z.string().optional(),
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

  const prompt = buildRopaFieldDraftPrompt({
    ropaTitle: r.title,
    processingDescription: r.processingDescription,
    hint: body.success ? (body.data.hint ?? null) : null,
    locale,
  });

  let resp;
  try {
    // ROPA touches personal data — route through containsPersonalData privacy tier.
    resp = await aiComplete({
      messages: prompt,
      maxTokens: 1500,
      temperature: 0.3,
      containsPersonalData: true,
    });
  } catch (err) {
    return Response.json(
      { error: "AI provider failure", details: (err as Error).message },
      { status: 502 },
    );
  }

  const parsed = safeJsonParse(resp.text);
  return Response.json({
    data: { draft: parsed, provider: resp.provider, model: resp.model },
  });
}
