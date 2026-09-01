// GET  /api/v1/portal/mailbox/:token — Case status + decrypted messages
// POST /api/v1/portal/mailbox/:token — Whistleblower reply
//
// ── ARCTOS-FULL-2026-08-31 · WP8 ─────────────────────────────────────
//
// S02-05 (von WP3 übergeben): Diese Route löste ihren Token kontextfrei
// auf. Unter der Laufzeitrolle `grc_app` (kein BYPASSRLS) filtern die
// FORCE-RLS-Policies von `wb_anonymous_mailbox`, `wb_report`, `wb_case`
// und `wb_case_message` jede dieser Abfragen auf null Zeilen — der
// anonyme Rückkanal der hinweisgebenden Person antwortete also mit 401
// bzw. 404 für jeden gültigen Token. Der Resolver liegt seit Migration
// 0412 bereit; ab hier läuft der Rest des Handlers in einem org-gebundenen
// Kontext, also wieder vollständig unter RLS.
//
// S07-19.3: Die Fallnachrichten sind jetzt per AAD an ihre Fall-ID
// gebunden. Ein Chiffrat, das jemand von Fall A nach Fall B kopiert,
// entschlüsselt nicht mehr stillschweigend, sondern wirft.
//
// S07-19.5: Fehlt der Schlüssel, antwortet die Route mit 503 statt mit
// einem 500 aus der Tiefe der Krypto-Bibliothek.

import {
  db,
  wbAnonymousMailbox,
  wbCase,
  wbReport,
  wbCaseMessage,
  wbCaseEvidence,
  runWithRequestContext,
} from "@grc/db";
import { resolveWbMailboxToken } from "@grc/auth/anonymous-token";
import { replyToMailboxSchema } from "@grc/shared";
import { encrypt, decrypt, isWbCryptoConfigured } from "@grc/shared";
import { eq, asc, sql } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/** AAD-Bindung: ein Nachrichtenchiffrat gehört genau zu einem Fall. */
function messageAad(caseId: string): string {
  return `wb_case_message:${caseId}`;
}

/**
 * Löst den Mailbox-Token auf, OHNE einen RLS-Kontext vorauszusetzen (den
 * es hier per Konstruktion nicht geben kann — die Organisation folgt erst
 * aus dem Token). Gibt `null` zurück, wenn der Token unbekannt oder
 * abgelaufen ist; die Route unterscheidet die beiden Fälle bewusst nicht.
 */
async function resolveMailbox(token: string) {
  if (!token || token.length < 32) return null;
  const mailbox = await resolveWbMailboxToken(token);
  if (!mailbox) return null;
  if (new Date() > new Date(mailbox.expiresAt)) return null;
  return mailbox;
}

function cryptoUnavailable(): Response {
  console.error(
    "[portal/mailbox] SECURITY: WB_ENCRYPTION_KEY is not configured — " +
      "refusing to serve or accept case correspondence.",
  );
  return Response.json(
    { error: "The reporting channel is temporarily unavailable." },
    { status: 503 },
  );
}

// GET — Mailbox view: status, messages, evidence
export async function GET(_req: Request, { params }: RouteParams) {
  const { token } = await params;

  // Reihenfolge: erst der Token, dann die Konfiguration. Ein unbekannter
  // Token darf den Betriebszustand des Kanals nicht offenlegen.
  const mailbox = await resolveMailbox(token);
  if (!mailbox) {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }
  if (!isWbCryptoConfigured()) return cryptoUnavailable();

  return runWithRequestContext(
    { orgId: mailbox.orgId, userId: "" },
    async () => {
      // Zugriffszählung — innerhalb des Kontexts, sonst greift die
      // Parent-Policy von wb_anonymous_mailbox und das UPDATE trifft
      // null Zeilen.
      await db
        .update(wbAnonymousMailbox)
        .set({
          lastAccessedAt: new Date(),
          accessCount: sql`${wbAnonymousMailbox.accessCount} + 1`,
        })
        .where(eq(wbAnonymousMailbox.id, mailbox.id));

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

      const messages = await db
        .select()
        .from(wbCaseMessage)
        .where(eq(wbCaseMessage.caseId, caseRow.id))
        .orderBy(asc(wbCaseMessage.createdAt));

      const aad = messageAad(caseRow.id);
      const decryptedMessages = messages.map((m) => {
        let content: string;
        try {
          content = decrypt(m.content, aad);
        } catch (err) {
          // Ein Chiffrat, das nicht zu diesem Fall gehört (oder unter einem
          // vernichteten Schlüssel liegt), darf nicht die gesamte Mailbox
          // unerreichbar machen — es wird als unlesbar geliefert und der
          // Vorfall protokolliert.
          console.error(
            "[portal/mailbox] message could not be decrypted:",
            err instanceof Error ? err.message : String(err),
          );
          content = "";
        }
        return {
          direction: m.direction,
          content,
          authorType: m.authorType,
          createdAt: m.createdAt.toISOString(),
        };
      });

      for (const m of messages) {
        if (m.direction === "outbound" && !m.readAt) {
          await db
            .update(wbCaseMessage)
            .set({ readAt: new Date() })
            .where(eq(wbCaseMessage.id, m.id));
        }
      }

      const evidence = await db
        .select({
          fileName: wbCaseEvidence.fileName,
          fileSize: wbCaseEvidence.fileSize,
          uploadedAt: wbCaseEvidence.uploadedAt,
          storedAt: wbCaseEvidence.storedAt,
        })
        .from(wbCaseEvidence)
        .where(eq(wbCaseEvidence.caseId, caseRow.id))
        .orderBy(asc(wbCaseEvidence.uploadedAt));

      return Response.json({
        data: {
          status: caseRow.status,
          caseNumber: caseRow.caseNumber,
          acknowledgeDeadline: caseRow.acknowledgeDeadline.toISOString(),
          responseDeadline: caseRow.responseDeadline.toISOString(),
          acknowledgedAt: caseRow.acknowledgedAt?.toISOString() ?? null,
          messages: decryptedMessages,
          evidence: evidence.map((e) => ({
            fileName: e.fileName,
            fileSize: e.fileSize,
            uploadedAt: e.uploadedAt.toISOString(),
            // S07-20: die hinweisgebende Person sieht, ob die Datei
            // tatsächlich verwahrt wird. Vorher quittierte das Portal jeden
            // Upload als erfolgreich, obwohl nie eine Datei gespeichert
            // wurde.
            stored: e.storedAt !== null,
          })),
        },
      });
    },
  );
}

// POST — Whistleblower reply
export async function POST(req: Request, { params }: RouteParams) {
  const { token } = await params;

  const mailbox = await resolveMailbox(token);
  if (!mailbox) {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }
  if (!isWbCryptoConfigured()) return cryptoUnavailable();

  const body = replyToMailboxSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  return runWithRequestContext(
    { orgId: mailbox.orgId, userId: "" },
    async () => {
      await db
        .update(wbAnonymousMailbox)
        .set({
          lastAccessedAt: new Date(),
          accessCount: sql`${wbAnonymousMailbox.accessCount} + 1`,
        })
        .where(eq(wbAnonymousMailbox.id, mailbox.id));

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

      const encryptedContent = encrypt(
        body.data.content,
        messageAad(caseRow.id),
      );

      const [message] = await db
        .insert(wbCaseMessage)
        .values({
          caseId: caseRow.id,
          orgId: caseRow.orgId,
          direction: "inbound",
          content: encryptedContent,
          authorType: "whistleblower",
          authorId: null,
          createdAt: new Date(),
        })
        .returning();

      return Response.json(
        {
          data: {
            id: message!.id,
            direction: "inbound",
            createdAt: message!.createdAt.toISOString(),
          },
        },
        { status: 201 },
      );
    },
  );
}
