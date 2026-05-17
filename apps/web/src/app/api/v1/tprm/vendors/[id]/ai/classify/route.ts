// TPRM Overhaul: AI vendor classification suggester.

import { db, vendor } from "@grc/db";
import { aiComplete, buildVendorClassifyPrompt, safeJsonParse } from "@grc/ai";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

const schema = z.object({
  servicesProvided: z.string().optional(),
  locale: z.enum(["de", "en"]).optional(),
});

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
  const servicesProvided = body.success ? body.data.servicesProvided ?? null : null;

  const prompt = buildVendorClassifyPrompt({
    vendorName: v.name,
    description: v.description,
    servicesProvided,
    country: v.country,
    locale,
  });

  let resp;
  try {
    resp = await aiComplete({ messages: prompt, maxTokens: 800, temperature: 0.2 });
  } catch (err) {
    return Response.json(
      { error: "AI provider failure", details: (err as Error).message },
      { status: 502 },
    );
  }

  const parsed = safeJsonParse(resp.text);
  return Response.json({
    data: { suggestion: parsed, provider: resp.provider, model: resp.model },
  });
}
