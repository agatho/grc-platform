import { db, vendorSubProcessor } from "@grc/db";
import {
  ADEQUACY_COUNTRIES,
  createSubProcessorSchema,
  EU_EEA_COUNTRIES,
} from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/tprm/sub-processors?vendorId=...
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const vendorId = url.searchParams.get("vendorId");
  const { limit, offset } = paginate(url.searchParams);
  const conditions = [eq(vendorSubProcessor.orgId, ctx.orgId)];
  if (vendorId) conditions.push(eq(vendorSubProcessor.vendorId, vendorId));

  const rows = await db
    .select()
    .from(vendorSubProcessor)
    .where(and(...conditions))
    .orderBy(desc(vendorSubProcessor.createdAt))
    .limit(limit)
    .offset(offset);
  return paginatedResponse(rows, rows.length, limit, offset);
});
// POST /api/v1/tprm/sub-processors?vendorId=...
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const vendorId = url.searchParams.get("vendorId");
  if (!vendorId)
    return Response.json({ error: "vendorId required" }, { status: 400 });

  const body = createSubProcessorSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  // [ARCTOS-FULL-2026-08-31 · Welle 8b/8c · OP-201] Hier standen ZWEI
  // Inline-Kopien der Laenderlisten. Die Angemessenheitsliste war die dritte
  // Fassung im Repository — und die einzige, der die **USA** fehlten
  // (EU-US Data Privacy Framework, Art.-45-Beschluss vom Juli 2023).
  //
  // Wirkung: Fuer einen Unterauftragsverarbeiter mit `hostingCountry: "US"`
  // meldete diese Route `isAdequateCountry: false` und verlangte damit eine
  // Transfer-Impact-Assessment, waehrend `packages/shared` denselben Fall als
  // angemessen fuehrt. Zwei Antworten auf dieselbe Rechtsfrage im selben
  // Produkt.
  //
  // Beide Listen kommen jetzt aus `@grc/shared` — derselben Stelle, aus der
  // diese Datei ihr Schema ohnehin schon bezieht.
  const country = body.data.hostingCountry?.toUpperCase();
  const isEu = country ? EU_EEA_COUNTRIES.has(country) : false;
  const isAdequateCountry = country
    ? ADEQUACY_COUNTRIES.has(country) || isEu
    : false;
  const requiresTia = country ? !isEu && !isAdequateCountry : false;

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(vendorSubProcessor)
      .values({
        orgId: ctx.orgId,
        vendorId,
        name: body.data.name,
        serviceDescription: body.data.serviceDescription,
        dataCategories: body.data.dataCategories,
        hostingCountry: body.data.hostingCountry,
        isEu,
        isAdequateCountry,
        requiresTia,
        dateAdded: body.data.dateAdded,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
