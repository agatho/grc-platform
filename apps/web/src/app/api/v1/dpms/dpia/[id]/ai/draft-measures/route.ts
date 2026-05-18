// DPMS Overhaul: AI-draft mitigation measures for identified DPIA risks.

import { db, dpia, dpiaRisk } from "@grc/db";
import {
  aiComplete,
  buildDpiaMeasureDraftPrompt,
  safeJsonParse,
} from "@grc/ai";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

const schema = z.object({ locale: z.enum(["de", "en"]).optional() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("dpms", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [d] = await db
    .select()
    .from(dpia)
    .where(
      and(eq(dpia.id, id), eq(dpia.orgId, ctx.orgId), isNull(dpia.deletedAt)),
    );
  if (!d) return Response.json({ error: "DPIA not found" }, { status: 404 });

  const risks = await db.select().from(dpiaRisk).where(eq(dpiaRisk.dpiaId, id));

  if (risks.length === 0) {
    return Response.json({
      data: {
        measures: [],
        note: "No identified risks to draft measures for.",
      },
    });
  }

  const body = schema.safeParse(await req.json().catch(() => ({})));
  const locale = body.success ? (body.data.locale ?? "de") : "de";

  const prompt = buildDpiaMeasureDraftPrompt({
    dpiaTitle: d.title,
    processingDescription: d.processingDescription,
    identifiedRisks: risks.map((r: any) => ({
      title: r.title,
      description: r.description,
      inherentRiskScore: r.inherentRiskScore ?? null,
    })),
    locale,
  });

  let resp;
  try {
    resp = await aiComplete({
      messages: prompt,
      maxTokens: 2000,
      temperature: 0.3,
      containsPersonalData: true,
    });
  } catch (err) {
    return Response.json(
      { error: "AI provider failure", details: (err as Error).message },
      { status: 502 },
    );
  }

  const parsed = safeJsonParse<{ measures?: any[] }>(resp.text);
  return Response.json({
    data: {
      measures: parsed?.measures ?? [],
      provider: resp.provider,
      model: resp.model,
    },
  });
}
