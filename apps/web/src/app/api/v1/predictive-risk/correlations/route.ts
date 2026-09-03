import { db, riskPrediction } from "@grc/db";
import { correlationQuerySchema, type CorrelatedEntity } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/predictive-risk/correlations — Correlation analysis
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("erm", ctx.orgId, req.method);
  if (m) return m;

  const url = new URL(req.url);
  const query = correlationQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  }

  // [ARCTOS-FULL-2026-08-31 / Welle 4b-4 · OP-176] `minCorrelation` war
  // entnommen und wurde nirgends angewandt: die Antwort enthielt ALLE
  // Korrelationen, auch die unterhalb der angeforderten Schwelle — und weil
  // der Vorgabewert 0.5 ist, galt das auch fuer jeden Aufrufer, der gar
  // keine Schwelle gesetzt hat.
  //
  // `depth` bleibt weiterhin ohne Wirkung. Das ist KEIN Filter, den man
  // nachtragen koennte: er verlangt einen Nachbarschaftslauf ueber mehrere
  // Stufen, den diese Route nicht hat (sie liest eine einzige Zeile
  // `risk_prediction` und deren `correlated_entities`). Der Befund ist im
  // Bericht zu Welle 4b-4 §7 als offener Punkt beschrieben.
  const { entityType, entityId, minCorrelation } = query.data;

  // Get predictions with correlations for the specified entity
  const predictions = await db
    .select({
      id: riskPrediction.id,
      entityType: riskPrediction.entityType,
      entityId: riskPrediction.entityId,
      correlatedEntities: riskPrediction.correlatedEntities,
      confidence: riskPrediction.confidence,
    })
    .from(riskPrediction)
    .where(
      and(
        eq(riskPrediction.orgId, ctx.orgId),
        eq(riskPrediction.entityType, entityType),
        eq(riskPrediction.entityId, entityId),
        eq(riskPrediction.isActive, true),
      ),
    )
    .limit(50);

  // `correlated_entities` ist eine JSONB-Spalte der dokumentierten Form
  // `[{entityType, entityId, correlation}]`. Drizzle kann sie nicht typisieren,
  // deshalb wird sie geprueft und nicht zugesichert. Eintraege ohne
  // numerische `correlation` koennen die Schwelle nicht nachweislich
  // erreichen und fallen damit heraus.
  function atLeast(value: unknown, min: number): CorrelatedEntity[] {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is CorrelatedEntity => {
      if (typeof entry !== "object" || entry === null) return false;
      const correlation = (entry as { correlation?: unknown }).correlation;
      return typeof correlation === "number" && correlation >= min;
    });
  }

  return Response.json({
    data: predictions.map((prediction) => ({
      ...prediction,
      correlatedEntities: atLeast(
        prediction.correlatedEntities,
        minCorrelation,
      ),
    })),
    minCorrelation,
  });
});
