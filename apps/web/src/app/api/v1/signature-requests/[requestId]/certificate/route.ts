// W21-DMS-MULTISIGN-01: Signature certificate as PDF — the audit
// evidence document for a signing ceremony.
//
// Contains: document title + version, frozen SHA-256, per signer
// name / decision / timestamp / IP / chain hash, and the live
// verification result (hash chain + file integrity). Rendered with
// pdfkit via the shared lib/pdf.ts helper (always valid %PDF bytes).

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
};

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("de-DE") : "—";
}

function buildSections(report: SignatureVerificationReport): PdfSection[] {
  return [
    {
      heading: "Dokument",
      table: {
        headers: ["Feld", "Wert"],
        rows: [
          ["Titel", report.documentTitle ?? report.documentId],
          ["Version", report.versionLabel ?? report.versionId],
          ["SHA-256 (eingefroren bei Anforderung)", report.frozenFileSha256],
          ["SHA-256 (aktuell)", report.currentFileSha256 ?? "—"],
          [
            "Status der Signaturanforderung",
            STATUS_DE[report.requestStatus] ?? report.requestStatus,
          ],
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
          "IP-Adresse",
          "Chain-Hash",
        ],
        rows: report.links.map((l) => [
          l.signOrder,
          l.signerName ?? l.signerUserId,
          STATUS_DE[l.status] ?? l.status,
          fmt(l.signedAt),
          l.ipAddress ?? "—",
          l.chainHash ? `${l.chainHash.slice(0, 20)}…` : "—",
        ]),
      },
    },
    {
      heading: "Verifikationsergebnis",
      kpis: [
        {
          label: "Hash-Kette",
          value: report.chainValid ? "GÜLTIG" : "GEBROCHEN",
          trend: report.chainValid ? "ok" : "crit",
        },
        {
          label: "Datei-Integrität",
          value: report.fileIntegrityValid ? "UNVERÄNDERT" : "VERÄNDERT",
          trend: report.fileIntegrityValid ? "ok" : "crit",
        },
        {
          label: "Gesamtergebnis",
          value: report.valid ? "GÜLTIG" : "UNGÜLTIG",
          trend: report.valid ? "ok" : "crit",
        },
      ],
      notes: [
        report.brokenAt !== null
          ? `Kette gebrochen ab Glied ${report.brokenAt + 1} (chronologisch).`
          : "Alle Kettenglieder wurden erfolgreich rekonstruiert und verifiziert.",
        "Jedes Glied: content_hash = SHA-256(documentId, versionId, fileSha256, signerUserId, signedAt, decision); chain_hash = SHA-256(previous_chain_hash + content_hash).",
        "Elektronische Signatur i.S.d. Art. 25 eIDAS (einfache elektronische Signatur). Kein qualifiziertes Zertifikat (QES).",
        `Verifiziert am ${new Date().toLocaleString("de-DE")} durch die ARCTOS-Plattform.`,
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
    return renderStructuredPdfResponse(
      {
        title: "Signatur-Zertifikat",
        subtitle: report.documentTitle ?? undefined,
        generatedAt: new Date(),
        sections: buildSections(report),
      },
      `signature_certificate_${requestId.slice(0, 8)}`,
    );
  } catch (err) {
    const mapped = signatureErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
