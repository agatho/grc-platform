// BPM Overhaul Phase 2 A2: ROPA export helpers (CSV + HTML for PDF).
//
// Produces GDPR Art. 30 standard-compliant exports. The CSV format mirrors
// the BfDI/LfDI behoerden-template column order; the PDF is built via
// renderHtmlToPdfResponse from lib/pdf.

import { escHtml } from "@/lib/pdf";

export interface RopaRow {
  processId: string;
  processName: string;
  department: string | null;
  processingPurpose: string | null;
  legalBasis: string | null;
  legalBasisDetail: string | null;
  dataSubjectCategories: string[] | null;
  personalDataCategories: string[] | null;
  specialCategories: string[] | null;
  recipients: string[] | null;
  thirdCountryTransfers: boolean;
  thirdCountrySafeguards: string | null;
  retentionPeriodDescription: string | null;
  retentionPeriodMonths: number | null;
  tomDescription: string | null;
  requiresDpia: boolean;
  controllerOrgName: string | null;
  processorVendorNames: string[] | null;
}

const LEGAL_BASIS_LABELS: Record<string, string> = {
  consent: "Einwilligung (Art. 6(1)(a) DSGVO)",
  contract: "Vertragserfuellung (Art. 6(1)(b) DSGVO)",
  legal_obligation: "Rechtliche Verpflichtung (Art. 6(1)(c) DSGVO)",
  vital_interest: "Lebenswichtige Interessen (Art. 6(1)(d) DSGVO)",
  public_interest: "Oeffentliches Interesse (Art. 6(1)(e) DSGVO)",
  legitimate_interest: "Berechtigtes Interesse (Art. 6(1)(f) DSGVO)",
};

function csvCell(s: unknown): string {
  if (s == null) return "";
  const str = Array.isArray(s) ? s.join("; ") : String(s);
  if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

const CSV_COLUMNS = [
  ["processId", "Prozess-ID"],
  ["processName", "Bezeichnung der Verarbeitungstätigkeit"],
  ["department", "Abteilung / Bereich"],
  ["processingPurpose", "Zwecke der Verarbeitung"],
  ["legalBasis", "Rechtsgrundlage"],
  ["legalBasisDetail", "Rechtsgrundlage Detail"],
  ["dataSubjectCategories", "Kategorien betroffener Personen"],
  ["personalDataCategories", "Kategorien personenbezogener Daten"],
  ["specialCategories", "Besondere Kategorien (Art. 9 DSGVO)"],
  ["recipients", "Kategorien von Empfaengern"],
  ["thirdCountryTransfers", "Drittlandsuebermittlung"],
  ["thirdCountrySafeguards", "Garantien gem. Art. 46 DSGVO"],
  ["retentionPeriodDescription", "Loeschfristen / Speicherdauer"],
  ["retentionPeriodMonths", "Speicherdauer (Monate)"],
  ["tomDescription", "Technisch-organisatorische Massnahmen"],
  ["requiresDpia", "DSFA erforderlich"],
  ["controllerOrgName", "Verantwortlicher (Controller)"],
  ["processorVendorNames", "Auftragsverarbeiter"],
] as const;

export function rowsToCsv(rows: RopaRow[]): string {
  const header = CSV_COLUMNS.map((c) => csvCell(c[1])).join(",");
  const dataLines = rows.map((r) =>
    CSV_COLUMNS.map(([key]) => {
      const v: any = (r as any)[key];
      if (key === "legalBasis" && typeof v === "string") {
        return csvCell(LEGAL_BASIS_LABELS[v] ?? v);
      }
      if (typeof v === "boolean") return csvCell(v ? "Ja" : "Nein");
      return csvCell(v);
    }).join(","),
  );
  return [header, ...dataLines].join("\n");
}

export function rowsToHtml(rows: RopaRow[], orgName: string): string {
  const now = new Date().toLocaleDateString("de-DE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const sections = rows
    .map(
      (r, i) => `
    <h2>${i + 1}. ${escHtml(r.processName)}</h2>
    <p><strong>Prozess-ID:</strong> ${escHtml(r.processId)}<br/>
       <strong>Abteilung:</strong> ${escHtml(r.department ?? "—")}<br/>
       <strong>Verantwortlicher:</strong> ${escHtml(r.controllerOrgName ?? orgName)}
    </p>
    <p><strong>Zweck:</strong> ${escHtml(r.processingPurpose ?? "—")}</p>
    <p><strong>Rechtsgrundlage:</strong> ${escHtml(LEGAL_BASIS_LABELS[r.legalBasis ?? ""] ?? r.legalBasis ?? "—")}
       ${r.legalBasisDetail ? `<br/><em>${escHtml(r.legalBasisDetail)}</em>` : ""}
    </p>
    <p><strong>Kategorien betroffener Personen:</strong> ${escHtml((r.dataSubjectCategories ?? []).join(", ") || "—")}</p>
    <p><strong>Datenkategorien:</strong> ${escHtml((r.personalDataCategories ?? []).join(", ") || "—")}</p>
    ${(r.specialCategories ?? []).length ? `<p><strong>Besondere Kategorien (Art. 9):</strong> ${escHtml(r.specialCategories!.join(", "))}</p>` : ""}
    <p><strong>Empfaenger:</strong> ${escHtml((r.recipients ?? []).join(", ") || "—")}</p>
    <p><strong>Drittlandsuebermittlung:</strong> ${r.thirdCountryTransfers ? "Ja" : "Nein"}
       ${r.thirdCountrySafeguards ? `<br/><em>Garantien: ${escHtml(r.thirdCountrySafeguards)}</em>` : ""}
    </p>
    <p><strong>Loeschfristen:</strong> ${escHtml(r.retentionPeriodDescription ?? "—")}${r.retentionPeriodMonths ? ` (${r.retentionPeriodMonths} Monate)` : ""}</p>
    <p><strong>TOMs:</strong> ${escHtml(r.tomDescription ?? "—")}</p>
    <p><strong>DSFA erforderlich:</strong> ${r.requiresDpia ? "Ja" : "Nein"}</p>
    ${(r.processorVendorNames ?? []).length ? `<p><strong>Auftragsverarbeiter:</strong> ${escHtml(r.processorVendorNames!.join(", "))}</p>` : ""}
    `,
    )
    .join("\n");

  return `<!DOCTYPE html>
  <html>
    <head><meta charset="utf-8"/><title>ROPA – ${escHtml(orgName)}</title></head>
    <body>
      <h1>Verzeichnis von Verarbeitungstaetigkeiten (Art. 30 DSGVO)</h1>
      <p><strong>Verantwortlicher:</strong> ${escHtml(orgName)}<br/>
         <strong>Stichtag:</strong> ${now}<br/>
         <strong>Anzahl Verarbeitungstaetigkeiten:</strong> ${rows.length}
      </p>
      ${sections || "<p>Keine als Verarbeitungstaetigkeit markierten Prozesse gefunden.</p>"}
    </body>
  </html>`;
}
