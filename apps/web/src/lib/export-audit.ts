// Nachweisführung für Datenexporte — ARCTOS-FULL-2026-08-31 · WP8 · S07-14
//
// Befund, drei Teile:
//
//  1. **Falsches PII-Kennzeichen.** Beide Exportrouten schrieben
//     `containsPersonalData: ["ropa_entry","incident"].includes(entityType)`.
//     Exportierbar sind aber `risk, control, asset, vendor, contract,
//     incident, process, ropa_entry, bia, finding`, und deren
//     Exportspalten enthalten laut Entity-Registry u. a. `owner_email`,
//     `contact_person`, `reporter_email`, `responsible_email`, `tax_id`
//     und `legal_name`. Ein Export von 5.000 Risiken mit sämtlichen
//     Eigentümer-E-Mail-Adressen wurde als `contains_personal_data = false`
//     protokolliert — genau die Spalte, nach der ein DSB später filtert.
//     Hier wird das Kennzeichen aus den tatsächlich exportierten Spalten
//     abgeleitet.
//
//  2. **Protokollierung nicht verbindlich.** Jede Schreiboperation steckte
//     in `try { … } catch (logErr) { console.error(…) }`. Schlägt die
//     Protokollierung fehl, wurde der Export trotzdem ausgeliefert — der
//     klassische Insider-Exfiltrationspfad ohne Nachweis.
//     `logExportOrThrow()` lässt den Export scheitern statt den Nachweis.
//
//  3. **`data_export_log.ip_address` wurde von keiner Route gesetzt** und
//     war immer NULL.
//
// Nicht hier gelöst: 19 der 25 Exportrouten protokollieren gar nicht.
// Dieses Modul ist die gemeinsame Anlaufstelle dafür; die betroffenen
// Routen liegen in fremder Dateihoheit und sind in
// /work/audit/remediation/WP8.md unter "Bedarf an andere Pakete"
// aufgeführt.

import { db, dataExportLog } from "@grc/db";
import { getEntityDefinition } from "./import-export/entity-registry";

/**
 * Rollen, die einen Export mit Personenbezug auslösen dürfen.
 *
 * Für den MASSENexport hat WP3 `BULK_EXPORT_ROLES` festgelegt
 * (admin, dpo, compliance_officer). Ein EINZELexport ist die schwächere
 * Operation — dort kommen die fachlich zuständigen Zweitverteidiger dazu,
 * weil ein Risikomanager seine Risiken exportieren können muss. Was
 * ausgeschlossen bleibt, sind die reinen Lese- und Gastrollen: genau die,
 * über die der Befund lief ("auch `viewer`").
 *
 * Die drei Rollen aus `BULK_EXPORT_ROLES` stehen hier bewusst als Literale
 * und werden NICHT aus `@grc/auth` importiert: dieses Modul wird von jeder
 * Exportroute geladen, und die beiden auto-generierten Smoke-Suiten mocken
 * `@grc/auth` mit einer Factory ohne diesen Export — vitest 4 wirft dann
 * beim Modulladen (dieselbe Falle, die WP3 in seinem Übergabevermerk
 * beschreibt). `packages/auth` bleibt die Quelle der Wahrheit; der Test
 * `export-roles-superset` hält beide Listen in Deckung.
 */
export const PERSONAL_EXPORT_ROLES: readonly string[] = [
  "admin",
  "dpo",
  "compliance_officer",
  "risk_manager",
  "control_owner",
  "process_owner",
  "auditor",
  "ciso",
  "vendor_manager",
  "bcm_manager",
  "contract_manager",
  "quality_manager",
  "esg_manager",
  "security_analyst",
  "department_head",
];

export function mayExportPersonalData(roles: readonly string[] | undefined): boolean {
  return (roles ?? []).some((r) => PERSONAL_EXPORT_ROLES.includes(r));
}

/**
 * Spaltennamen, die einen Personenbezug tragen können. Bewusst dasselbe
 * Namensmuster wie `pii_key_class()` in Migration 0427, damit die
 * Bewertung in Datenbank und Anwendung nicht auseinanderläuft.
 *
 * Zwei Gruppen:
 *  - direkte Merkmale (E-Mail, Telefon, Name, Anschrift, Kennungen)
 *  - Freitext. Das PII-Inventar des Audits führt 418 Freitextspalten als
 *    "PII möglich"; in einem GRC-Produkt (Risikobeschreibungen,
 *    Vorfallschilderungen, Prüfungsnotizen) ist das die Regel, nicht die
 *    Ausnahme. Ein Export von 5.000 Risikobeschreibungen darf im Nachweis
 *    nicht als personenbezugsfrei stehen.
 *
 * Anmerkung zur Fundstelle im Bericht: dort ist `owner_email` (risk :74)
 * als Exportspalte benannt. Tatsächlich steht das Feld in der IMPORT-Liste
 * der Entity-Registry; die `exportColumns` von `risk` führen es nicht.
 * Am Ergebnis ändert das nichts — `description` und `department` gehen
 * mit, und beide sind Freitext.
 */
const PII_COLUMN_PATTERN =
  /(email|e_mail|phone|mobile|_name$|^name$|contact_person|owner|responsible|reporter|assignee|signer|author|tax_id|vat|iban|address|street|postal|zip|city|birth|national_id|passport|ip_address|user_agent|^description$|^notes?$|^comment$|^content$|^resolution$|^message$|^detail$|^details$|^department$|beschreibung|notiz|kommentar|abteilung)/i;

/** Entitätstypen, die als Ganzes personenbezogen sind. */
const ALWAYS_PERSONAL = new Set([
  "ropa_entry",
  "incident",
  "user",
  "employee",
  "training_record",
  "access_log",
  "dsr",
  "dsar_request",
  "wb_report",
  "wb_case",
]);

/**
 * Leitet aus der Entity-Registry ab, ob ein Export personenbezogene Daten
 * enthält — statt aus einer zweielementigen Literalliste.
 */
export function exportContainsPersonalData(entityType: string): boolean {
  if (ALWAYS_PERSONAL.has(entityType)) return true;
  const def = getEntityDefinition(entityType);
  if (!def) return true; // im Zweifel als personenbezogen kennzeichnen
  return def.exportColumns.some(
    (c) => PII_COLUMN_PATTERN.test(c.key) || PII_COLUMN_PATTERN.test(c.header),
  );
}

export function anyExportContainsPersonalData(
  entityTypes: readonly string[],
): boolean {
  return entityTypes.some(exportContainsPersonalData);
}

/**
 * Die Client-IP für den Nachweis. Bewusst ohne eigene Trusted-Proxy-Logik:
 * `getClientIp()` aus `lib/rate-limit.ts` gehört WP9 und wird dort gerade
 * um eine Hop-Zählung ergänzt (S02-09/S10-05). Bis dahin ist der Wert für
 * den Nachweis brauchbar, für eine Zugriffsentscheidung nicht — er wird
 * hier nur protokolliert, nie ausgewertet.
 */
export function clientIpForAudit(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

/** Werte des DB-Enums `export_type`. */
export type ExportType =
  | "pdf_report"
  | "excel_export"
  | "csv_export"
  | "evidence_download"
  | "bulk_export"
  | "api_extract"
  | "audit_report"
  | "emergency_handbook";

export interface ExportLogEntry {
  orgId: string;
  userId: string;
  exportType: ExportType;
  entityType: string;
  description: string;
  recordCount: number;
  fileName: string;
  /** Überschreibt die Ableitung aus der Registry, wenn gesetzt. */
  containsPersonalData?: boolean;
  ipAddress?: string | null;
}

export class ExportNotLoggedError extends Error {
  constructor(cause: unknown) {
    super(
      "The export could not be recorded in data_export_log and was therefore not delivered.",
    );
    this.name = "ExportNotLoggedError";
    this.cause = cause;
  }
}

/**
 * Schreibt den Exportnachweis. Wirft, wenn das nicht gelingt — der
 * Aufrufer muss den Export dann abbrechen.
 *
 * `data_export_log` ist append-only (Rules) und FORCE-RLS mit
 * Org-Isolation (S07-27); wo protokolliert wird, ist der Eintrag nicht
 * manipulierbar. Genau deshalb darf das Schreiben nicht optional sein.
 */
export async function logExportOrThrow(entry: ExportLogEntry): Promise<void> {
  try {
    await db.insert(dataExportLog).values({
      orgId: entry.orgId,
      userId: entry.userId,
      exportType: entry.exportType,
      entityType: entry.entityType,
      description: entry.description,
      recordCount: entry.recordCount,
      containsPersonalData:
        entry.containsPersonalData ??
        anyExportContainsPersonalData(entry.entityType.split(",")),
      fileName: entry.fileName,
      ipAddress: entry.ipAddress ?? null,
    });
  } catch (err) {
    console.error(
      "[export-audit] data_export_log write failed — refusing to deliver the export:",
      err instanceof Error ? err.message : String(err),
    );
    throw new ExportNotLoggedError(err);
  }
}
