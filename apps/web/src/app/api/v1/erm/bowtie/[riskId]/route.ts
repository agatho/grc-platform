import { db, bowtieElement, bowtiePath, risk } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { saveBowtieSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

/**
 * [ARCTOS-FULL-2026-08-31 / WP2 · S01-01] Cross-Tenant-IDOR.
 *
 * `bowtie_path` trug weder `org_id` noch RLS, und diese Route filterte die
 * Tabelle ausschliesslich über die aus dem Pfad übernommene `riskId`. Ein
 * beliebiger authentifizierter Nutzer von Mandant A konnte damit
 *   GET  /api/v1/erm/bowtie/<UUID eines Risikos von Mandant B>
 * aufrufen und die Bowtie-Pfade des fremden Risikos lesen, und mit einem
 * PUT auf dieselbe URL (Zeile "delete where riskId") ALLE Pfade des fremden
 * Risikos löschen und durch eigene ersetzen. Die Geschwistertabelle
 * `bowtieElement` war in derselben Datei korrekt org-gefiltert.
 *
 * Der Fix hat zwei Hälften, bewusst beide:
 *  - DB: Migration 0391 gibt `bowtie_path` RLS+FORCE mit einer Policy, die
 *    über `risk.org_id` auf den Elternsatz prüft.
 *  - Route: die Existenz des Risikos IN DER EIGENEN ORG wird explizit
 *    geprüft, bevor irgendetwas passiert — sonst liefert ein Zugriff auf ein
 *    fremdes Risiko still `paths: []` und ein PUT legte (unter RLS erfolglos,
 *    aber ohne Rückmeldung) los. 404 ist die richtige Antwort, nicht 200 mit
 *    leerem Ergebnis.
 */
async function assertRiskInOrg(
  riskId: string,
  orgId: string,
): Promise<Response | null> {
  const [own] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(eq(risk.id, riskId), eq(risk.orgId, orgId), isNull(risk.deletedAt)),
    )
    .limit(1);
  if (!own) return Response.json({ error: "Not found" }, { status: 404 });
  return null;
}

// GET /api/v1/erm/bowtie/:riskId — Get bow-tie data for risk
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ riskId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { riskId } = await params;

  const notOurs = await assertRiskInOrg(riskId, ctx.orgId);
  if (notOurs) return notOurs;

  const [elements, paths] = await Promise.all([
    db
      .select()
      .from(bowtieElement)
      .where(
        and(
          eq(bowtieElement.riskId, riskId),
          eq(bowtieElement.orgId, ctx.orgId),
        ),
      )
      .orderBy(bowtieElement.sortOrder),
    db
      .select()
      .from(bowtiePath)
      .where(eq(bowtiePath.riskId, riskId))
      .orderBy(bowtiePath.sortOrder),
  ]);

  return Response.json({ data: { riskId, elements, paths } });
});
// PUT /api/v1/erm/bowtie/:riskId — Save bow-tie (full replace)
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ riskId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { riskId } = await params;

  const notOurs = await assertRiskInOrg(riskId, ctx.orgId);
  if (notOurs) return notOurs;

  const body = saveBowtieSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // Delete existing bow-tie data
    await tx.delete(bowtiePath).where(eq(bowtiePath.riskId, riskId));
    await tx
      .delete(bowtieElement)
      .where(
        and(
          eq(bowtieElement.riskId, riskId),
          eq(bowtieElement.orgId, ctx.orgId),
        ),
      );

    // Insert new elements
    const insertedElements = [];
    for (const elem of body.data.elements) {
      const [inserted] = await tx
        .insert(bowtieElement)
        .values({
          orgId: ctx.orgId,
          riskId,
          ...elem,
        })
        .returning();
      insertedElements.push(inserted);
    }

    // Insert paths
    for (const path of body.data.paths) {
      await tx.insert(bowtiePath).values({ riskId, ...path });
    }

    return insertedElements;
  });

  return Response.json({ data: result });
});
