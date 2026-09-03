// DPMS Overhaul: Authority-ready breach notification pack (ZIP).

import JSZip from "jszip";
import { db, dataBreach, dataBreachNotification } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

function csv(s: unknown): string {
  if (s == null) return "";
  const str = Array.isArray(s) ? s.join("; ") : String(s);
  if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo", "compliance_officer");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("dpms", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [b] = await db
    .select()
    .from(dataBreach)
    .where(
      and(
        eq(dataBreach.id, id),
        eq(dataBreach.orgId, ctx.orgId),
        isNull(dataBreach.deletedAt),
      ),
    );
  if (!b) return Response.json({ error: "Breach not found" }, { status: 404 });

  const notifications = await db
    .select()
    .from(dataBreachNotification)
    .where(eq(dataBreachNotification.dataBreachId, id));

  const zip = new JSZip();

  zip.file(
    "README.txt",
    [
      `Data Breach Notification Pack`,
      `Generated: ${new Date().toISOString()}`,
      `Breach: ${b.title}`,
      `Severity: ${b.severity}`,
      `Status: ${b.status}`,
      `Detected at: ${b.detectedAt}`,
      `DPA notified at: ${b.dpaNotifiedAt ?? "—"}`,
      `Individuals notified at: ${b.individualsNotifiedAt ?? "—"}`,
      `Estimated records affected: ${b.estimatedRecordsAffected ?? "—"}`,
      ``,
      `Contents:`,
      `- breach-summary.txt`,
      `- authority-notification.txt (Art. 33 template, fill in placeholders)`,
      `- affected-data-categories.csv`,
      `- notifications-log.csv`,
    ].join("\n"),
  );

  zip.file(
    "breach-summary.txt",
    [
      `Title: ${b.title}`,
      `Description:`,
      b.description ?? "(none)",
      ``,
      `Containment measures:`,
      b.containmentMeasures ?? "(none)",
      ``,
      `Remediation measures:`,
      b.remediationMeasures ?? "(none)",
      ``,
      `Lessons learned:`,
      b.lessonsLearned ?? "(none)",
    ].join("\n"),
  );

  zip.file(
    "authority-notification.txt",
    [
      `MELDUNG EINER VERLETZUNG DES SCHUTZES PERSONENBEZOGENER DATEN`,
      `(Art. 33 DSGVO)`,
      ``,
      `1. Verantwortlicher / Organisation: <ORG_NAME>`,
      `2. Datenschutzbeauftragter: <DPO_NAME, DPO_EMAIL>`,
      `3. Datum + Uhrzeit der Feststellung: ${b.detectedAt}`,
      `4. Art der Verletzung: ${b.title}`,
      `5. Beschreibung:`,
      `   ${b.description ?? ""}`,
      `6. Kategorien betroffener personenbezogener Daten:`,
      `   ${(b.dataCategoriesAffected ?? []).join(", ")}`,
      `7. Geschätzte Anzahl der betroffenen Personen: ${b.estimatedRecordsAffected ?? "—"}`,
      `8. Wahrscheinliche Folgen:`,
      `   <FILL_IN>`,
      `9. Getroffene oder vorgeschlagene Maßnahmen:`,
      `   ${b.containmentMeasures ?? ""}`,
      `   ${b.remediationMeasures ?? ""}`,
      `10. Wurde Aufsichtsbehörde fristgerecht (72h) informiert: ${b.dpaNotifiedAt ? "Ja" : "Nein"}`,
      `    ggf. Begründung der Verzögerung: <FILL_IN>`,
    ].join("\n"),
  );

  zip.file(
    "affected-data-categories.csv",
    "Category\n" +
      (b.dataCategoriesAffected ?? []).map((c) => csv(c)).join("\n"),
  );

  zip.file(
    "notifications-log.csv",
    [
      // [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-076 → OP-181]
      // Vier der fuenf Spalten gab es in `data_breach_notification` nicht:
      // `recipient`, `channel`, `notifiedAt` und `status` sind keine Felder
      // dieser Tabelle (sie heissen `recipient_email`, `sent_at`,
      // `response_status`, ein `channel` gibt es nicht). Unter `(n: any)`
      // lieferte jeder dieser Zugriffe `undefined`, und `csv(undefined)`
      // schreibt eine leere Zelle: das Meldeprotokoll im DSGVO-Meldepaket
      // (Art. 33/34) war seit jeher bis auf die erste Spalte LEER, ohne
      // dass irgendetwas fehlschlug. Die Kopfzeile nennt jetzt die Spalten,
      // die es wirklich gibt.
      "RecipientType,RecipientEmail,SentAt,ResponseStatus",
      ...notifications.map((n) =>
        [
          csv(n.recipientType),
          csv(n.recipientEmail),
          csv(n.sentAt),
          csv(n.responseStatus),
        ].join(","),
      ),
    ].join("\n"),
  );

  const buf = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
  return new Response(
    new Blob([buf as BlobPart], { type: "application/zip" }),
    {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="breach-pack-${id.slice(0, 8)}-${Date.now()}.zip"`,
      },
    },
  );
});
