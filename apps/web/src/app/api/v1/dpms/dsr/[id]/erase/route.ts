// POST /api/v1/dpms/dsr/:id/erase — Art. 17: Löschung ausführen
//
// ── ARCTOS-FULL-2026-08-31 · WP8 · S07-04/-06/-13/-15/-28 ────────────
//
// Bis hierher gab es für Art. 17 genau zwei Dinge: einen Vorgangsstatus
// und `POST /dpms/audit-log-tombstone`, das GENAU EINE Audit-Zeile per
// UUID redigiert. Ein Löschantrag betrifft typischerweise hunderte
// Zeilen in dutzenden Tabellen, die zuerst gefunden werden müssen — und
// die Fachdaten selbst fasste nichts davon an.
//
// Diese Route führt den Löschantrag aus:
//   1. Fachdaten in allen registrierten Tabellen anonymisieren
//   2. Zugangsdaten der Person vernichten, Sitzungen löschen
//   3. Audit-Trail redigieren statt löschen — die Kette verifiziert
//      danach weiter, weil WP4s Content-Commitment (v4) erhalten bleibt
//   4. Nachweis in `gdpr_erasure_log`
//
// Ausgenommen: `wb_*` (HinSchG §8/§11 Abs. 5 — eigene Frist, kein
// Löschantrag Dritter) und die Protokolltabellen, die über die Retention
// laufen. Beides steht in der Antwort, damit die Einschränkung im
// Vorgang dokumentiert ist und nicht stillschweigend bleibt.
//
// `dryRun` ist der Regelfall vor der Ausführung: der DSB sieht, was
// passieren wird, bevor es unumkehrbar ist.
//
// Rechtlicher Vorbehalt: ob im Einzelfall eine Aufbewahrungspflicht
// (§ 147 AO, § 257 HGB) oder ein Rechtsstreit der Löschung vorgeht,
// entscheidet die verantwortliche Stelle. Die Route setzt um, was
// entschieden wurde; sie entscheidet nicht.

import { db, dsr, dsrActivity } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const eraseBodySchema = z.object({
  dryRun: z.boolean().optional().default(true),
  reason: z
    .enum([
      "gdpr_art_17",
      "person_deceased",
      "contract_end",
      "legal_hold_expired",
      "data_minimisation",
    ])
    .optional()
    .default("gdpr_art_17"),
  /** Pflicht bei der echten Ausführung — die bewusste Bestätigung. */
  confirm: z.literal(true).optional(),
});

interface EraseReport {
  dryRun: boolean;
  businessRows: number;
  auditRows: number;
  tables: { table: string; rows: number; action?: string; error?: string }[];
  excluded: unknown[];
  keyId: string;
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

  const body = eraseBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [row] = await db
    .select()
    .from(dsr)
    .where(and(eq(dsr.id, id), eq(dsr.orgId, ctx.orgId)));
  if (!row) return Response.json({ error: "DSR not found" }, { status: 404 });

  if (row.requestType !== "erasure") {
    return Response.json(
      {
        error: `This request is of type "${row.requestType}". Only erasure requests can be executed here.`,
      },
      { status: 409 },
    );
  }

  if (!row.verifiedAt) {
    return Response.json(
      {
        error:
          "The requester's identity has not been verified (Art. 12(6) GDPR). Erasing on an unverified request is itself a data-protection incident.",
      },
      { status: 409 },
    );
  }

  const dryRun = body.data.dryRun;
  if (!dryRun && body.data.confirm !== true) {
    return Response.json(
      {
        error:
          "An irreversible erasure requires `confirm: true` alongside `dryRun: false`.",
      },
      { status: 428 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT public.gdpr_erase_subject(
        ${ctx.orgId}::uuid,
        ${row.subjectUserId}::uuid,
        ${row.subjectEmail},
        ${row.subjectName},
        ${body.data.reason},
        ${id}::uuid,
        ${dryRun}
      ) AS report
    `);
    const list = (
      Array.isArray(rows)
        ? rows
        : ((rows as unknown as { rows?: unknown[] }).rows ?? [])
    ) as { report: EraseReport }[];
    const report = list[0]!.report;

    if (!dryRun) {
      await tx.insert(dsrActivity).values({
        dsrId: id,
        orgId: ctx.orgId,
        activityType: "erasure_executed",
        details:
          `Art. 17 erasure executed: ${report.businessRows} business rows anonymised, ` +
          `${report.auditRows} audit entries redacted (pseudonymisation key ${report.keyId})`,
        createdBy: ctx.userId,
      });
    }

    return report;
  });

  return Response.json({ data: result });
});
