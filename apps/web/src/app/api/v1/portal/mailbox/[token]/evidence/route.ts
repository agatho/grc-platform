// POST /api/v1/portal/mailbox/:token/evidence — Upload additional evidence (whistleblower)
//
// ── ARCTOS-FULL-2026-08-31 · WP8 · S07-20 (High) ─────────────────────
//
// Vorher: die Route las die Datei, berechnete den SHA-256, baute einen
// `storagePath` zusammen — und verwarf den Puffer. Ein Schreibvorgang
// existierte in der gesamten Datei nicht. Die Antwort war trotzdem 201
// mit Dateiname, Größe und Hash, `wb_case_evidence.is_immutable` stand
// auf `true`, und der Hash bezog sich auf einen Inhalt, den danach
// niemand mehr hatte. Die hinweisgebende Person bekam eine
// Empfangsbestätigung für ein Beweismittel, das nicht existiert; die
// Meldestelle fand später einen Datenbankeintrag ohne Datei. Damit ist
// zugleich die Dokumentationspflicht nach HinSchG §11 verletzt.
//
// Zweiter Teil desselben Befundes: `storagePath` interpolierte
// `file.name` ungefiltert — sobald die Speicherung implementiert wird,
// ist das ein Path-Traversal. Der Name wird jetzt gar nicht mehr in den
// Speicherschlüssel übernommen; er steht ausschliesslich in der
// Datenbankspalte.
//
// Dritter Teil: der Dateiname landete über den generischen
// `audit_trigger` im org-weiten `audit_log`. Dateinamen aus dem
// Hinweisgeberkontext ("Kuendigung_Mueller_2026.pdf") sind
// identifizierend. Der generische Trigger liegt seit Migration 0426
// nicht mehr auf den wb-Tabellen (S07-01).
//
// Reihenfolge ab hier: erst speichern, dann die Zeile schreiben. Schlägt
// die Speicherung fehl, gibt es weder eine Zeile noch ein 201.

import {
  db,
  wbCase,
  wbReport,
  wbCaseEvidence,
  runWithRequestContext,
} from "@grc/db";
import { resolveWbMailboxToken } from "@grc/auth/anonymous-token";
import { getFileStorage } from "@grc/shared/lib/file-storage";
import { eq } from "drizzle-orm";
import { createHash, randomUUID } from "crypto";
import { extname } from "path";

interface RouteParams {
  params: Promise<{ token: string }>;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".csv",
]);

/**
 * Der Speicherschlüssel enthält KEINEN vom Aufrufer bestimmten Anteil
 * ausser der Endung, und die stammt aus einer Allowlist. Damit ist der
 * Traversal-Pfad geschlossen, bevor er entsteht.
 */
function buildStorageKey(
  orgId: string,
  caseId: string,
  fileName: string,
): string {
  const ext = extname(fileName).toLowerCase();
  const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : ".bin";
  return `wb/${orgId}/${caseId}/${Date.now()}-${randomUUID()}${safeExt}`;
}

export async function POST(req: Request, { params }: RouteParams) {
  const { token } = await params;

  if (!token || token.length < 32) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  // #WP3-S02-05: kontextfreie Token-Auflösung über den engen
  // SECURITY-DEFINER-Resolver; danach org-gebundener RLS-Kontext.
  const mailbox = await resolveWbMailboxToken(token);
  if (!mailbox || new Date() > new Date(mailbox.expiresAt)) {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || typeof file === "string") {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size === 0) {
    return Response.json({ error: "File is empty" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "File exceeds 50MB limit" }, { status: 413 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: "File type not allowed" }, { status: 415 });
  }

  return runWithRequestContext(
    { orgId: mailbox.orgId, userId: "" },
    async () => {
      const report = await db.query.wbReport.findFirst({
        where: eq(wbReport.id, mailbox.reportId),
      });
      if (!report) {
        return Response.json({ error: "Report not found" }, { status: 404 });
      }

      const caseRow = await db.query.wbCase.findFirst({
        where: eq(wbCase.reportId, report.id),
      });
      if (!caseRow) {
        return Response.json({ error: "Case not found" }, { status: 404 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      const storageKey = buildStorageKey(caseRow.orgId, caseRow.id, file.name);

      // 1. Speichern. Erst wenn das gelungen ist, entsteht eine Zeile.
      const storage = getFileStorage();
      try {
        await storage.put(storageKey, buffer, { contentType: file.type });
      } catch (err) {
        console.error(
          "[portal/mailbox/evidence] storage write failed:",
          err instanceof Error ? err.message : String(err),
        );
        // 502, nicht 201: die hinweisgebende Person muss erfahren, dass
        // ihr Beweismittel NICHT angekommen ist.
        return Response.json(
          {
            error:
              "The evidence could not be stored. Please try again or contact the reporting office.",
          },
          { status: 502 },
        );
      }

      // 2. Verifizieren, dass das Objekt wirklich liegt. Ein Backend, das
      //    `put` still verschluckt, darf nicht als Erfolg durchgehen.
      let stored = false;
      try {
        stored = await storage.exists(storageKey);
      } catch {
        stored = false;
      }
      if (!stored) {
        console.error(
          "[portal/mailbox/evidence] storage reported success but the object is absent:",
          storageKey,
        );
        return Response.json(
          { error: "The evidence could not be stored." },
          { status: 502 },
        );
      }

      const storedAt = new Date();

      try {
        const [evidence] = await db
          .insert(wbCaseEvidence)
          .values({
            caseId: caseRow.id,
            reportId: report.id,
            orgId: caseRow.orgId,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            storagePath: storageKey,
            sha256Hash: sha256,
            uploadedBy: null, // anonymous
            uploadedAt: storedAt,
            storedAt,
            storageBackend: process.env.STORAGE_BACKEND ?? "local",
            isImmutable: true,
          })
          .returning();

        return Response.json(
          {
            data: {
              id: evidence!.id,
              fileName: evidence!.fileName,
              fileSize: evidence!.fileSize,
              sha256Hash: evidence!.sha256Hash,
              stored: true,
            },
          },
          { status: 201 },
        );
      } catch (err) {
        // Die Datei liegt, die Zeile nicht — sonst bliebe ein
        // unauffindbares Objekt im Speicher zurück (derselbe Defekt, den
        // S07-15 für den Dokument-Purge beschreibt, nur andersherum).
        try {
          await storage.delete(storageKey);
        } catch {
          console.error(
            "[portal/mailbox/evidence] orphaned object could not be removed:",
            storageKey,
          );
        }
        console.error(
          "[portal/mailbox/evidence] insert failed:",
          err instanceof Error ? err.message : String(err),
        );
        return Response.json(
          { error: "The evidence could not be recorded." },
          { status: 502 },
        );
      }
    },
  );
}
