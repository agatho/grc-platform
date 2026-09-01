// POST /api/v1/export/bulk — Multi-entity export
//
// ── ARCTOS-FULL-2026-08-31 · WP8 · S07-14, zugleich S02-07 (WP3) ─────
//
// Vorher: `withAuth()` ohne Rollenliste — jede authentifizierte Rolle,
// einschliesslich `viewer`, durfte den vollständigen Datenbestand der
// Organisation exportieren. Kein Vier-Augen-Prinzip, keine
// Mengenbegrenzung im datenschutzrechtlichen Sinn, fester Leerfilter
// (`exportEntities(entityType, "csv", {}, orgId)` = alles), ein falsches
// PII-Kennzeichen und eine Protokollierung, die im `catch` verschluckt
// wurde. Der Export gelang also auch dann, wenn `data_export_log` nicht
// geschrieben werden konnte.
//
// WP3 hat die Entscheidungsfunktion `decideBulkExport()` gebaut (Rolle,
// Anzahl Entitätstypen, Vier-Augen, Zeilenobergrenze) und den Einbau an
// WP8 übergeben, weil diese Datei WP8 gehört. Hier ist er — plus die
// beiden Teile, die eine reine Entscheidungsfunktion nicht leisten kann:
// die Auflösung der Freigabe durch einen zweiten Menschen
// (`export_approval_consume`, Migration 0432) und die verbindliche
// Protokollierung.

import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { bulkExportSchema } from "@grc/shared";
import { decideBulkExport } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { exportEntities } from "@/lib/import-export/export-engine";
import {
  anyExportContainsPersonalData,
  clientIpForAudit,
  logExportOrThrow,
  ExportNotLoggedError,
} from "@/lib/export-audit";

const PROBLEM_BASE = "https://arctos.charliehund.de/errors";

function forbidden(reason: string, detail: string): Response {
  return Response.json(
    {
      type: `${PROBLEM_BASE}/${reason.replace(/_/g, "-")}`,
      title: "Forbidden",
      status: 403,
      detail,
    },
    { status: 403, headers: { "Content-Type": "application/problem+json" } },
  );
}

/**
 * Löst `approvalId` gegen `export_approval` auf und VERBRAUCHT die
 * Freigabe im selben Schritt. Der DB-seitige CHECK stellt sicher, dass
 * der Genehmigende nicht der Antragsteller ist; die Funktion prüft
 * zusätzlich Ablauf, Status und Abdeckung der Entitätstypen.
 */
async function approvalIsValid(
  approvalId: string | null | undefined,
  orgId: string,
  userId: string,
  entityTypes: string[],
): Promise<boolean> {
  if (!approvalId) return false;
  try {
    const rows = (await db.execute(sql`
      SELECT public.export_approval_consume(
        ${approvalId}::uuid, ${orgId}::uuid, ${userId}::uuid, ${entityTypes}::text[]
      ) AS ok
    `)) as unknown as { ok: boolean }[];
    const list = (
      Array.isArray(rows)
        ? rows
        : ((rows as unknown as { rows?: unknown[] }).rows ?? [])
    ) as { ok: boolean }[];
    return list[0]?.ok === true;
  } catch (err) {
    console.error(
      "[export/bulk] approval check failed:",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const body = bulkExportSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const entityTypes = body.data.entityTypes as string[];
  const approvalId =
    (body.data as { approvalId?: string | null }).approvalId ?? null;

  // Rolle und Mengenbegrenzung entscheiden sich ohne Datenbankzugriff.
  // Die Vier-Augen-Frage wird nur gestellt, wenn der Export überhaupt
  // personenbezogene Daten berührt — sonst würde jede Freigabe verbraucht,
  // bevor die Rollenprüfung greift.
  const preDecision = decideBulkExport(
    { entityTypes, approvalId },
    ctx.roles ?? [],
    false,
  );
  if (!preDecision.allowed && preDecision.reason !== "four_eyes_required") {
    return forbidden(preDecision.reason ?? "forbidden", preDecision.detail ?? "");
  }

  const decision = preDecision.allowed
    ? preDecision
    : decideBulkExport(
        { entityTypes, approvalId },
        ctx.roles ?? [],
        await approvalIsValid(approvalId, ctx.orgId, ctx.userId, entityTypes),
      );

  if (!decision.allowed) {
    return forbidden(decision.reason ?? "forbidden", decision.detail ?? "");
  }

  try {
    const results: { entityType: string; data: string; rowCount: number }[] = [];
    let totalRecords = 0;

    for (const entityType of entityTypes) {
      const result = await exportEntities(entityType, "csv", {}, ctx.orgId);

      // `decision.maxRows` ist die Obergrenze über den GESAMTEN Vorgang.
      // Die Engine begrenzt je Entitätstyp; ohne diese Prüfung addieren
      // sich fünf Typen zu einem Vielfachen der Grenze.
      if (totalRecords + result.rowCount > decision.maxRows) {
        return Response.json(
          {
            type: `${PROBLEM_BASE}/export-limit-exceeded`,
            title: "Export limit exceeded",
            status: 413,
            detail:
              `This export would return more than ${decision.maxRows} rows. ` +
              "Narrow the selection or request the data set through the data-export process.",
          },
          {
            status: 413,
            headers: { "Content-Type": "application/problem+json" },
          },
        );
      }

      totalRecords += result.rowCount;
      results.push({
        entityType,
        data: result.data.toString("utf-8"),
        rowCount: result.rowCount,
      });
    }

    // Der Nachweis steht VOR der Auslieferung und ist nicht optional.
    await logExportOrThrow({
      orgId: ctx.orgId,
      userId: ctx.userId,
      exportType: "bulk_export",
      entityType: entityTypes.join(","),
      description:
        `Bulk export (${entityTypes.length} types, ${totalRecords} total records)` +
        (approvalId ? `, approval ${approvalId}` : ""),
      recordCount: totalRecords,
      containsPersonalData: anyExportContainsPersonalData(entityTypes),
      fileName: `bulk-export-${new Date().toISOString().slice(0, 10)}.zip`,
      ipAddress: clientIpForAudit(req),
    });

    return Response.json({
      exports: results.map((r) => ({
        entityType: r.entityType,
        rowCount: r.rowCount,
        csvData: r.data,
      })),
      totalRecords,
      containsPersonalData: decision.containsPersonalData,
    });
  } catch (err) {
    if (err instanceof ExportNotLoggedError) {
      return Response.json(
        {
          type: `${PROBLEM_BASE}/export-not-recorded`,
          title: "Export not recorded",
          status: 503,
          detail:
            "The export could not be recorded in the tamper-evident export log and was therefore not delivered.",
        },
        {
          status: 503,
          headers: { "Content-Type": "application/problem+json" },
        },
      );
    }
    // #SEC-LEAK-FIX: don't echo err.message back to the client.
    console.error("[export/bulk] failed", err);
    return Response.json({ error: "Bulk export failed" }, { status: 500 });
  }
}
