// W21-DMS-MULTISIGN-01: Signature certificate as PDF — the audit
// evidence document for a signing ceremony.
//
// Contains: document title + version, frozen SHA-256, per signer
// name / decision / timestamp / IP / chain hash, and the live
// verification result (hash chain + file integrity). Rendered with
// pdfkit via the shared lib/pdf.ts helper (always valid %PDF bytes).
//
// ── What this certificate no longer overstates ──────────────────────
// #S06-04  "Datei-Integritaet: UNVERAENDERT" came from comparing two
//          database columns. It now reports the result of re-hashing the
//          bytes in the object store, with an explicit third state for
//          "could not be checked".
// #S06-05  The signing time is labelled with its actual backing — an
//          RFC 3161 token, or the app server's own clock.
// #S06-03  A client-supplied IP is marked as a self-declaration.
// #S06-13  The requester of the ceremony is named, and it is stated
//          whether they are also a signer.
// #S06-20  eIDAS citation corrected: the class is defined in Art. 3
//          no. 10; Art. 25 governs legal effect only.
// #S06-24  The document states that it is itself unsigned and
//          unanchored, and where the binding check lives.

import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { renderStructuredPdfResponse, type PdfSection } from "@/lib/pdf";
import {
  getSignatureProvider,
  signatureErrorResponse,
  type SignatureVerificationReport,
} from "@/lib/documents/signature-provider";

const STATUS_DE: Record<string, string> = {
  pending: "Ausstehend",
  signed: "Signiert",
  declined: "Abgelehnt",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
  // #S06-23
  invalidated: "Ungueltig — Datei nach Anforderung geaendert",
};

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("de-DE") : "—";
}

/** #S06-04: three-state, because "not checkable" must never be printed
 *  as "unchanged". */
const FILE_INTEGRITY_DE: Record<string, string> = {
  verified_unchanged: "UNVERAENDERT (Bytes geprueft)",
  verified_changed: "VERAENDERT (Bytes geprueft)",
  unverifiable: "NICHT PRUEFBAR",
};

const TSA_DE: Record<string, string> = {
  granted: "RFC 3161",
  unavailable: "TSA nicht erreichbar",
  disabled: "deaktiviert",
  error: "TSA-Fehler",
};

function buildSections(
  report: SignatureVerificationReport,
  verifyUrl: string,
): PdfSection[] {
  const anyUntrustedIp = report.links.some(
    (l) => l.signedAt !== null && l.ipTrusted !== true,
  );
  const withoutTimestamp = report.links.filter(
    (l) => l.signedAt !== null && l.tsaStatus !== "granted",
  ).length;

  return [
    {
      heading: "Dokument",
      table: {
        headers: ["Feld", "Wert"],
        rows: [
          ["Titel", report.documentTitle ?? report.documentId],
          ["Version", report.versionLabel ?? report.versionId],
          ["SHA-256 (eingefroren bei Anforderung)", report.frozenFileSha256],
          [
            "SHA-256 (in der Datenbank vermerkt)",
            report.currentFileSha256 ?? "—",
          ],
          [
            "SHA-256 (aus dem Objektspeicher neu berechnet)",
            report.recomputedFileSha256 ?? "— nicht lesbar",
          ],
          ["Datei geprueft am", fmt(report.fileCheckedAt)],
          [
            "Status der Signaturanforderung",
            STATUS_DE[report.requestStatus] ?? report.requestStatus,
          ],
        ],
      },
    },
    {
      // #S06-13: the requester was not on the certificate at all, so a
      // self-attestation (requester = only signer) was indistinguishable
      // from an independent one.
      heading: "Zeremonie",
      table: {
        headers: ["Feld", "Wert"],
        rows: [
          [
            "Angefordert von",
            report.requestedByName ?? report.requestedByUserId ?? "—",
          ],
          [
            "Anforderer ist zugleich Signer",
            report.creatorIsSigner ? "JA" : "nein",
          ],
          ["Signer-Slots (angelegt / vorhanden)", `${report.links.length}`],
        ],
      },
    },
    {
      heading: "Signaturen",
      table: {
        headers: [
          "#",
          "Signer",
          "Entscheidung",
          "Zeitpunkt",
          "Zeitstempel",
          "IP-Adresse",
          "Chain-Hash",
        ],
        rows: report.links.map((l) => [
          l.signOrder,
          l.signerName ?? l.signerUserId,
          STATUS_DE[l.status] ?? l.status,
          fmt(l.signedAt),
          l.signedAt
            ? l.tsaStatus === "granted"
              ? `${TSA_DE.granted} ${fmt(l.tsaGenTime)}`
              : (TSA_DE[l.tsaStatus ?? ""] ?? "kein Zeitstempel")
            : "—",
          l.signedAt
            ? `${l.ipAddress ?? "—"}${l.ipTrusted === true ? "" : " (Selbstauskunft)"}`
            : "—",
          l.chainHash ? `${l.chainHash.slice(0, 20)}…` : "—",
        ]),
      },
    },
    {
      heading: "Verifikationsergebnis",
      kpis: [
        {
          label: "Hash-Kette",
          value: report.chainValid ? "GUELTIG" : "GEBROCHEN",
          trend: report.chainValid ? "ok" : "crit",
        },
        {
          label: "Datei-Integritaet",
          value:
            FILE_INTEGRITY_DE[report.fileIntegrity] ?? report.fileIntegrity,
          trend:
            report.fileIntegrity === "verified_unchanged"
              ? "ok"
              : report.fileIntegrity === "unverifiable"
                ? "warn"
                : "crit",
        },
        {
          label: "Gesamtergebnis",
          value: report.valid ? "GUELTIG" : "UNGUELTIG",
          trend: report.valid ? "ok" : "crit",
        },
      ],
      notes: [
        report.brokenAt !== null
          ? `Kette gebrochen ab Glied ${report.brokenAt + 1} (chronologisch).`
          : "Alle Kettenglieder wurden erfolgreich rekonstruiert und verifiziert.",
        // #S06-15
        report.chainDefects.length > 0
          ? `Vollstaendigkeitsbefund: ${report.chainDefects.join(", ")}.`
          : "Kettenlaenge und Kettenkopf entsprechen dem bei der Anforderung festgehaltenen Sollzustand.",
        "Jedes Glied: content_hash = SHA-256 ueber die kanonische Nutzlast (hash_version 1: documentId, versionId, fileSha256, signerUserId, signedAt, decision; hash_version 2 zusaetzlich ipAddress, userAgent, declineReason, signOrder); chain_hash = SHA-256(previous_chain_hash + content_hash).",
        // #S06-04 — say what was actually measured.
        report.fileIntegrity === "unverifiable"
          ? `Die Datei-Integritaet konnte NICHT geprueft werden: ${report.fileIntegrityNote ?? "unbekannter Grund"}. Die Aussage beschraenkt sich auf die Hash-Kette.`
          : "Die Datei-Integritaet wurde durch erneutes Hashen der im Objektspeicher liegenden Bytes gegen den bei der Anforderung eingefrorenen Wert bestimmt — nicht durch einen Vergleich zweier Datenbankspalten.",
        // #S06-05 — say what the timestamp is worth.
        withoutTimestamp === 0 && report.links.some((l) => l.signedAt !== null)
          ? "Jeder Signaturzeitpunkt ist durch ein RFC-3161-Token einer externen Zeitstempelstelle gedeckt."
          : `${withoutTimestamp} Signaturzeitpunkt(e) sind NICHT extern zeitgestempelt und stammen aus der Systemuhr des Anwendungsservers.`,
        // #S06-03 — say what the IP is worth.
        anyUntrustedIp
          ? "Mindestens eine IP-Adresse ist als Selbstauskunft gekennzeichnet: sie stammt aus einem Client-setzbaren Header (kein Trusted-Proxy-Kontext konfiguriert) und ist kein Nachweis des Signaturorts."
          : "Die IP-Adressen wurden an einer vom Client nicht setzbaren Stelle der Proxy-Kette entnommen.",
        // #S06-13
        report.creatorIsSigner
          ? "Hinweis zur Funktionstrennung: der Anforderer dieser Zeremonie ist selbst Unterzeichner."
          : "Anforderer und Unterzeichner sind verschiedene Personen.",
        // #S06-20 — correct citation.
        "Einfache elektronische Signatur i.S.d. Art. 3 Nr. 10 eIDAS; Rechtswirkung nach Art. 25 Abs. 1 eIDAS. Kein qualifiziertes Zertifikat (QES), kein QSCD, kein QTSP.",
        // #S06-24 — the certificate is not itself signed or anchored.
        `Dieses Zertifikat ist ein generierter Bericht: es traegt selbst keine PDF-Signatur, keinen Zeitstempel und keinen Hash seiner selbst. Es ist nachbaubar. Belastbar ist ausschliesslich die Online-Pruefung unter ${verifyUrl} (Request-ID ${report.requestId}).`,
        `Erstellt am ${new Date().toLocaleString("de-DE")} durch die ARCTOS-Plattform.`,
      ],
    },
  ];
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { requestId } = await params;

  try {
    const report = await getSignatureProvider().verify(ctx, requestId);
    // #S06-24: the certificate names where it can actually be verified.
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
      new URL(req.url).origin;
    const verifyUrl = `${origin}/api/v1/signature-requests/${requestId}/verify`;
    return renderStructuredPdfResponse(
      {
        title: "Signatur-Zertifikat",
        subtitle: report.documentTitle ?? undefined,
        generatedAt: new Date(),
        sections: buildSections(report, verifyUrl),
      },
      `signature_certificate_${requestId.slice(0, 8)}`,
    );
  } catch (err) {
    const mapped = signatureErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
