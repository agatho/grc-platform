// TPRM Overhaul: AI vendor classification suggester.
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09, S05-10, S05-11, S05-12]
// Der im Audit genannte Fall: die Modellausgabe bestimmt eine
// DORA-Kritikalitätseinstufung, und der Wert wurde nicht gegen das Enum
// geprüft, bevor er dem Nutzer als Vorschlag angezeigt wurde.

import { db, vendor } from "@grc/db";
import {
  aiCompleteGoverned,
  buildVendorClassifyPrompt,
  vendorClassificationSchema,
  safeJsonParse,
} from "@grc/ai";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";
import { aiRateLimit, aiErrorResponse, aiJson } from "../../../../../ai/_shared/ai-route";

const schema = z.object({
  servicesProvided: z.string().max(4000).optional(),
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

  const limited = await aiRateLimit(ctx.userId);
  if (limited) return limited;

  const { id } = await params;
  const [v] = await db
    .select()
    .from(vendor)
    .where(
      and(
        eq(vendor.id, id),
        eq(vendor.orgId, ctx.orgId),
        isNull(vendor.deletedAt),
      ),
    );
  if (!v) return Response.json({ error: "Vendor not found" }, { status: 404 });

  const body = schema.safeParse(await req.json().catch(() => ({})));
  const locale = body.success ? (body.data.locale ?? "de") : "de";
  const servicesProvided = body.success
    ? (body.data.servicesProvided ?? null)
    : null;

  try {
    const result = await aiCompleteGoverned({
      feature: "tprm.classify_vendor",
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: "vendor",
      entityId: v.id,
      messages: buildVendorClassifyPrompt({
        vendorName: v.name,
        description: v.description,
        servicesProvided,
        country: v.country,
        locale,
      }),
      maxTokens: 800,
      temperature: 0.2,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: vendorClassificationSchema,
    });

    return aiJson(
      {
        suggestion: result.data,
        provider: result.provider,
        model: result.model,
      },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
}
