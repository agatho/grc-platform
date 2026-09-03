import {
  db,
  architectureElement,
  businessCapability,
  eamDataObject,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { pgArray } from "../../_lib/pg-array";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// [ARCTOS-FULL-2026-08-31 / Welle 4b-4 · OP-179 (und der `page`-Fall von
// OP-176)]
//
// Der Katalog konnte nicht geblaettert werden. `offset` wurde berechnet und
// nie angewandt: die drei Teilabfragen holten je `LIMIT pageSize` OHNE
// `OFFSET`, die Antwort schnitt `items.slice(0, pageSize)` und gab `page`
// zurueck. Jede Seite war die erste.
//
// Die tote Rechnung zu entfernen haette den Befund verdeckt, sie einzusetzen
// haette ihn verschoben: `offset` auf drei getrennte Teilabfragen anzuwenden
// blaettert DREI Listen unabhaengig voneinander, nicht die eine Liste, die
// der Aufrufer sieht. Dazu kamen die beiden Folgefehler, die im Register
// ausdruecklich mitzuklaeren waren:
//   * `total` war `items.length`, also die Groesse der bereits
//     abgeschnittenen Menge — die Seitenzahl der Oberflaeche war damit
//     immer 1;
//   * die Facetten wurden ueber genau dieselbe abgeschnittene Menge
//     gezaehlt: die Zaehlstaende neben den Filtern beschrieben die
//     angezeigte Seite und nicht den Bestand.
//
// Deshalb entsteht die Liste jetzt in ZWEI Schritten:
//   1. ein Verzeichnis (`catalog`) als `UNION ALL` ueber die drei Quellen —
//      nur Kennung, Quellenrang, Objekttyp, Status, Typ und Name. Darauf
//      laufen `ORDER BY … LIMIT … OFFSET` (die Seite), `count(*)` (`total`)
//      und die Facetten. Alle drei sehen dieselbe, vollstaendige Menge.
//   2. die Volldatensaetze zu den Kennungen DIESER Seite, je Quelle mit der
//      bisherigen Spaltenauswahl — die Form der Eintraege bleibt damit
//      unveraendert.
//
// Neu ist eine feste Reihenfolge (`source_rank, name, id`). Ohne sie ist
// Blaettern nicht definiert; `source_rank` haelt die bisherige Gruppierung
// (Architekturelemente, dann Faehigkeiten, dann Datenobjekte).
//
// Unveraendert uebernommen — und ausdruecklich NICHT stillschweigend
// mitrepariert, weil es ein anderer Befund ist: `search` wirkt weiterhin nur
// auf `architecture_element` und `eam_data_object`, `keyword` nur auf
// `architecture_element` (obwohl `business_capability.keywords` existiert und
// einen GIN-Index hat). Siehe docs/UMSETZUNG-WELLE-4B-4.md §7.

/** Zeilenform des Verzeichnisses — benannt aus der SELECT-Liste unten. */
type CatalogIndexRow = {
  id: string;
  source_rank: number;
  object_type: string;
};

/** Zeilenform der Facetten-/Zaehlabfrage. */
type FacetRow = {
  field: string;
  value: string | null;
  count: number;
};

const IT_COMPONENT_TYPES = [
  "server",
  "network",
  "cloud_service",
  "database",
  "infrastructure_service",
];

/** Ganzzahl aus einem Abfrageparameter, mit Untergrenze und Vorgabe. */
function positiveInt(raw: string | null, fallback: number, max?: number) {
  const parsed = Number.parseInt(raw ?? "", 10);
  const value = Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
  return max ? Math.min(value, max) : value;
}

// GET /api/v1/eam/catalog — Unified catalog with faceted filters
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const search = url.searchParams.get("search");
  const objectTypes = url.searchParams.getAll("objectType");
  const keywords = url.searchParams.getAll("keyword");
  // Vorher `parseInt(…)` ohne Pruefung: `?page=abc` ergab `NaN`, was ohne
  // `OFFSET` folgenlos blieb. Mit `OFFSET` waere daraus ein Datenbankfehler
  // geworden — die Untergrenze gehoert zur Reparatur.
  const page = positiveInt(url.searchParams.get("page"), 1);
  const pageSize = positiveInt(url.searchParams.get("pageSize"), 50, 200);
  const offset = (page - 1) * pageSize;

  const searchPattern = search ? `%${search}%` : null;

  // ── Schritt 1: das Verzeichnis ────────────────────────────────────────
  const catalogCte = sql`
    WITH catalog AS (
      SELECT
        ae.id AS id,
        0 AS source_rank,
        CASE
          WHEN ae.type = 'application' THEN 'application'
          WHEN ae.type::text = ANY(${pgArray(IT_COMPONENT_TYPES, "text[]")}) THEN 'it_component'
          ELSE ae.type::text
        END AS object_type,
        ae.status::text AS status,
        ae.type::text AS type,
        ae.name AS name
      FROM architecture_element ae
      WHERE ae.org_id = ${ctx.orgId}
        ${searchPattern ? sql`AND ae.name ILIKE ${searchPattern}` : sql``}
        ${keywords.length > 0 ? sql`AND ae.keywords @> ${pgArray(keywords, "text[]")}` : sql``}
      UNION ALL
      SELECT
        bc.id,
        1,
        'business_capability',
        NULL::text,
        NULL::text,
        (SELECT ae2.name FROM architecture_element ae2 WHERE ae2.id = bc.element_id)
      FROM business_capability bc
      WHERE bc.org_id = ${ctx.orgId}
      UNION ALL
      SELECT
        d.id,
        2,
        'data_object',
        NULL::text,
        NULL::text,
        d.name
      FROM eam_data_object d
      WHERE d.org_id = ${ctx.orgId}
        ${searchPattern ? sql`AND d.name ILIKE ${searchPattern}` : sql``}
    ),
    filtered AS (
      SELECT * FROM catalog
      ${
        objectTypes.length > 0
          ? sql`WHERE object_type = ANY(${pgArray(objectTypes, "text[]")})`
          : sql``
      }
    )
  `;

  const [indexResult, facetResult] = await Promise.all([
    db.execute(sql`
      ${catalogCte}
      SELECT id, source_rank, object_type
      FROM filtered
      ORDER BY source_rank, name NULLS LAST, id
      LIMIT ${pageSize} OFFSET ${offset}
    `),
    db.execute(sql`
      ${catalogCte}
      SELECT '_total' AS field, NULL::text AS value, count(*)::int AS count FROM filtered
      UNION ALL
      SELECT 'objectType', object_type, count(*)::int FROM filtered
        WHERE object_type IS NOT NULL AND object_type <> '' GROUP BY object_type
      UNION ALL
      SELECT 'status', status, count(*)::int FROM filtered
        WHERE status IS NOT NULL AND status <> '' GROUP BY status
      UNION ALL
      SELECT 'type', type, count(*)::int FROM filtered
        WHERE type IS NOT NULL AND type <> '' GROUP BY type
    `),
  ]);
  // Die Zeilenform ist aus der SELECT-Liste benannt (die Regel aus
  // Welle 4b-3 §4): eine nachlesbare Zusicherung, keine Ableitung.
  const indexRows = indexResult as unknown as CatalogIndexRow[];
  const facetRows = facetResult as unknown as FacetRow[];

  // ── Schritt 2: die Volldatensaetze dieser Seite ───────────────────────
  const idsOfRank = (rank: number) =>
    indexRows.filter((r) => r.source_rank === rank).map((r) => r.id);
  const aeIds = idsOfRank(0);
  const bcIds = idsOfRank(1);
  const doIds = idsOfRank(2);

  const [aeRows, bcRows, doRows] = await Promise.all([
    aeIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: architectureElement.id,
            name: architectureElement.name,
            description: architectureElement.description,
            type: architectureElement.type,
            keywords: architectureElement.keywords,
            status: architectureElement.status,
            updatedAt: architectureElement.updatedAt,
            governanceStatus: architectureElement.governanceStatus,
          })
          .from(architectureElement)
          .where(
            and(
              eq(architectureElement.orgId, ctx.orgId),
              inArray(architectureElement.id, aeIds),
            ),
          ),
    bcIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: businessCapability.id,
            name: sql`(SELECT name FROM architecture_element WHERE id = ${businessCapability.elementId})`,
            keywords: businessCapability.keywords,
          })
          .from(businessCapability)
          .where(
            and(
              eq(businessCapability.orgId, ctx.orgId),
              inArray(businessCapability.id, bcIds),
            ),
          ),
    doIds.length === 0
      ? Promise.resolve([])
      : db
          .select()
          .from(eamDataObject)
          .where(
            and(
              eq(eamDataObject.orgId, ctx.orgId),
              inArray(eamDataObject.id, doIds),
            ),
          ),
  ]);

  // architecture_type kennt keinen eigenen „it_component"-Wert; nur
  // „application" bildet 1:1 ab, die Infrastrukturvarianten fallen
  // zusammen. Dieselbe Zuordnung steht als CASE im Verzeichnis oben —
  // sie MUSS mit dieser hier uebereinstimmen, sonst filtert das
  // Verzeichnis nach einem anderen Objekttyp als die Antwort ausweist.
  const objectTypeOf = (type: string) =>
    type === "application"
      ? "application"
      : IT_COMPONENT_TYPES.includes(type)
        ? "it_component"
        : type;

  const byId = new Map<string, Record<string, unknown>>();
  for (const el of aeRows) {
    byId.set(el.id, { ...el, objectType: objectTypeOf(el.type) });
  }
  for (const bc of bcRows) {
    byId.set(bc.id, { ...bc, objectType: "business_capability" });
  }
  for (const dobj of doRows) {
    byId.set(dobj.id, { ...dobj, objectType: "data_object" });
  }

  // Die Reihenfolge der Antwort ist die des Verzeichnisses, nicht die der
  // drei Nachladeabfragen.
  const items = indexRows
    .map((r) => byId.get(r.id))
    .filter((item): item is Record<string, unknown> => item !== undefined);

  // ── Facetten und Gesamtzahl, beide ueber den vollen Bestand ───────────
  const total = Number(facetRows.find((r) => r.field === "_total")?.count ?? 0);
  const facets = ["objectType", "status", "type"].map((field) => ({
    field,
    values: facetRows
      .filter((r) => r.field === field && r.value)
      .map((r) => ({ value: String(r.value), count: Number(r.count) }))
      // Bei Gleichstand entscheidet der Wert, damit die Reihenfolge
      // zwischen zwei Aufrufen dieselbe ist.
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
  }));

  return Response.json({
    data: {
      items,
      total,
      page,
      pageSize,
      facets,
    },
  });
});
