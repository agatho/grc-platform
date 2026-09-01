// POST /api/v1/dpms/dsr/:id/collect  — Art. 15 / Art. 20: Datenbestand
//                                       zur antragstellenden Person
//                                       zusammentragen
// GET  /api/v1/dpms/dsr/:id/collect  — das Ergebnis als Auskunftsdatei
//
// ── ARCTOS-FULL-2026-08-31 · WP8 · S07-13 (Medium) ───────────────────
//
// Befund: Das DSR-Modul war reine Vorgangssteuerung. `dsr` speicherte
// Antragsart, Status, Frist und Bearbeiter; die acht
// Zustandsübergangs-Routen setzten den Status und schrieben eine
// Aktivitätszeile ("Processing started — DPO collecting subject data").
// Eine Funktion, die zu einer natürlichen Person über die 449 Tabellen
// mit Personenbezug hinweg zusammenträgt, existierte nicht — `grep` auf
// `subjectEmail` fand ausschliesslich CRUD, Zod-Schema und
// State-Machine. Der DSB hätte 544 Personenreferenz- und 418
// Freitextspalten von Hand durchsuchen müssen, mit einer Frist von einem
// Monat nach Art. 12 Abs. 3. Die Compliance-Checkliste wies Art. 15 und
// Art. 20 trotzdem als erfüllt aus, mit dem Beleg "+ Export-Format".
//
// Der Sammellauf selbst liegt in der Datenbank
// (`dsr_collect_subject_data()`, Migration 0430), weil er über ein
// Register von Fundstellen läuft, das aus dem Katalog erzeugt wird — eine
// später hinzukommende Tabelle ist damit automatisch erfasst.
//
// Bewusste Ausnahme: die `wb_*`-Tabellen. Eine Auskunft nach Art. 15 darf
// nicht das Werkzeug sein, mit dem eine beschuldigte Person die Identität
// der hinweisgebenden Person erfährt (Art. 15 Abs. 4 DSGVO, HinSchG §8).
// Die Antwort weist diese Einschränkung ausdrücklich aus, statt sie zu
// verschweigen.
//
// Das Ergebnis wird NICHT im Volltext gespeichert — eine gespeicherte
// Auskunft wäre eine zweite Kopie derselben personenbezogenen Daten.
// `dsr.collection_summary` hält nur Tabellen, Zeilenzahlen und Zeitpunkt.

import { db, dsr, dsrActivity } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { clientIpForAudit, logExportOrThrow } from "@/lib/export-audit";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const collectBodySchema = z.object({
  /**
   * true → Teilmenge nach Art. 20 (von der Person bereitgestellte Daten,
   * ohne Protokolle und abgeleitete Bewertungen).
   */
  portability: z.boolean().optional().default(false),
  rowLimit: z.number().int().min(1).max(5000).optional().default(500),
});

interface CollectionResult {
  totalRows: number;
  sources: {
    table: string;
    category: string;
    rowCount: number;
    rows: unknown[];
  }[];
  skipped: { table: string; error: string }[];
  excluded: unknown[];
  scope: string;
  generatedAt: string;
}

async function loadDsr(orgId: string, id: string) {
  const [row] = await db
    .select()
    .from(dsr)
    .where(and(eq(dsr.id, id), eq(dsr.orgId, orgId)));
  return row ?? null;
}

/**
 * Findet die Benutzerzeile der antragstellenden Person, falls sie eine
 * hat. Ein Antrag kann auch von einer Person kommen, die kein Konto hat
 * (Stakeholder, Bewerber, externer Ansprechpartner) — dann bleibt
 * `userId` null und der Lauf arbeitet allein über Name und E-Mail.
 */
async function resolveSubjectUser(
  orgId: string,
  email: string | null,
  explicitId: string | null,
): Promise<string | null> {
  if (explicitId) return explicitId;
  if (!email) return null;
  const rows = await db.execute(sql`
    SELECT u.id
      FROM "user" u
      JOIN user_organization_role uor ON uor.user_id = u.id
     WHERE lower(u.email) = lower(${email})
       AND uor.org_id = ${orgId}::uuid
     LIMIT 1
  `);
  const list = (
    Array.isArray(rows)
      ? rows
      : ((rows as unknown as { rows?: unknown[] }).rows ?? [])
  ) as { id: string }[];
  return list[0]?.id ?? null;
}

async function runCollection(
  orgId: string,
  subjectUserId: string | null,
  email: string | null,
  name: string | null,
  portability: boolean,
  rowLimit: number,
): Promise<CollectionResult> {
  const rows = await db.execute(sql`
    SELECT public.dsr_collect_subject_data(
      ${orgId}::uuid,
      ${subjectUserId}::uuid,
      ${email},
      ${name},
      ${portability},
      ${rowLimit}
    ) AS report
  `);
  const list = (
    Array.isArray(rows)
      ? rows
      : ((rows as unknown as { rows?: unknown[] }).rows ?? [])
  ) as { report: CollectionResult }[];
  return list[0]!.report;
}

export const POST = withErrorHandler<RouteParams>(async function POST(
  req: Request,
  { params },
) {
  const { id } = await params;
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, "POST");
  if (moduleCheck) return moduleCheck;

  const body = collectBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const row = await loadDsr(ctx.orgId, id);
  if (!row) return Response.json({ error: "DSR not found" }, { status: 404 });

  if (!row.subjectEmail && !row.subjectName && !row.subjectUserId) {
    return Response.json(
      {
        error:
          "The request carries no identifier (subject email, name or user id). Verify the requester's identity first.",
      },
      { status: 422 },
    );
  }

  // Art. 12 Abs. 6 / Art. 15: ohne Identitätsprüfung keine Auskunft. Der
  // Zustandsautomat kennt `verified`; ohne ihn wäre die Auskunft selbst
  // ein Offenlegungsrisiko.
  if (!row.verifiedAt) {
    return Response.json(
      {
        error:
          "The requester's identity has not been verified yet (POST /verify). Art. 12(6) GDPR requires verification before data is disclosed.",
      },
      { status: 409 },
    );
  }

  const subjectUserId = await resolveSubjectUser(
    ctx.orgId,
    row.subjectEmail,
    row.subjectUserId,
  );

  const report = await runCollection(
    ctx.orgId,
    subjectUserId,
    row.subjectEmail,
    row.subjectName,
    body.data.portability,
    body.data.rowLimit,
  );

  const summary = {
    generatedAt: report.generatedAt,
    scope: report.scope,
    totalRows: report.totalRows,
    tables: report.sources.map((s) => ({
      table: s.table,
      category: s.category,
      rowCount: s.rowCount,
    })),
    skipped: report.skipped,
    excluded: report.excluded,
  };

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(dsr)
      .set({
        subjectUserId: subjectUserId ?? undefined,
        collectedAt: new Date(),
        collectedBy: ctx.userId,
        collectionSummary: summary,
        updatedAt: new Date(),
      })
      .where(and(eq(dsr.id, id), eq(dsr.orgId, ctx.orgId)));

    await tx.insert(dsrActivity).values({
      dsrId: id,
      orgId: ctx.orgId,
      activityType: "data_collection",
      details:
        `Automated collection across ${summary.tables.length} tables ` +
        `(${summary.totalRows} rows, scope ${summary.scope})`,
      createdBy: ctx.userId,
    });
  });

  return Response.json({ data: summary });
});

export const GET = withErrorHandler<RouteParams>(async function GET(
  req: Request,
  { params },
) {
  const { id } = await params;
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const row = await loadDsr(ctx.orgId, id);
  if (!row) return Response.json({ error: "DSR not found" }, { status: 404 });
  if (!row.verifiedAt) {
    return Response.json(
      { error: "Identity not verified (Art. 12(6) GDPR)." },
      { status: 409 },
    );
  }

  const url = new URL(req.url);
  const portability =
    url.searchParams.get("scope") === "portability" ||
    row.requestType === "portability";

  const subjectUserId = await resolveSubjectUser(
    ctx.orgId,
    row.subjectEmail,
    row.subjectUserId,
  );

  const report = await runCollection(
    ctx.orgId,
    subjectUserId,
    row.subjectEmail,
    row.subjectName,
    portability,
    2000,
  );

  const fileName = `dsr-${id}-${portability ? "art20-portability" : "art15-access"}.json`;

  // Eine Auskunft ist ein Datenabfluss und wird als solcher belegt.
  await logExportOrThrow({
    orgId: ctx.orgId,
    userId: ctx.userId,
    exportType: "csv_export",
    entityType: "dsr",
    description: `Data subject ${portability ? "portability (Art. 20)" : "access (Art. 15)"} export for DSR ${id}`,
    recordCount: report.totalRows,
    containsPersonalData: true,
    fileName,
    ipAddress: clientIpForAudit(req),
  });

  // Art. 20 verlangt ein "strukturiertes, gängiges und maschinenlesbares
  // Format" — JSON erfüllt das; die Datei ist zugleich die Anlage der
  // Auskunft nach Art. 15.
  return new Response(JSON.stringify(report, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
});
