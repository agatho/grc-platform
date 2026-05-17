// TPRM Overhaul: AI due-diligence question drafter.

import { db, vendor } from "@grc/db";
import { aiComplete, buildDdQuestionDraftPrompt, safeJsonParse } from "@grc/ai";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

const schema = z.object({ locale: z.enum(["de", "en"]).optional() });

interface Question {
  section: string;
  question: string;
  questionType?: string;
  isMandatory?: boolean;
  evidenceRequired?: boolean;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "vendor_manager", "compliance_officer");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("tprm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [v] = await db
    .select()
    .from(vendor)
    .where(and(eq(vendor.id, id), eq(vendor.orgId, ctx.orgId), isNull(vendor.deletedAt)));
  if (!v) return Response.json({ error: "Vendor not found" }, { status: 404 });

  const body = schema.safeParse(await req.json().catch(() => ({})));
  const locale = body.success ? body.data.locale ?? "de" : "de";

  const prompt = buildDdQuestionDraftPrompt({
    vendorName: v.name,
    category: v.category ?? "other",
    tier: v.tier ?? "standard",
    doraCriticalIct: v.doraCriticalIct,
    lksgTier1: v.lksgTier1,
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

  const parsed = safeJsonParse<{ questions?: Question[] }>(resp.text);
  return Response.json({
    data: { questions: parsed?.questions ?? [], provider: resp.provider, model: resp.model },
  });
}
