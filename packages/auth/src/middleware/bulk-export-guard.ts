// #WP3-S02-07 (High) — Massenexport: Rolle, Mengenbegrenzung, Vier-Augen,
// belastbare Protokollierung.
//
// Befund (`apps/web/src/app/api/v1/export/bulk/route.ts:7-31`):
//   * `withAuth()` ohne Rollen und ohne `requireModule` — jede Rolle,
//     einschliesslich `viewer`, durfte exportieren;
//   * der Filter ist fest `{}`, es wird also jeweils der VOLLSTAENDIGE
//     Datenbestand der Org exportiert;
//   * keine Obergrenze fuer `entityTypes`, kein Rate-Limit
//     (`rateLimit` steht in 5 von 1.357 Routendateien, diese gehoert nicht dazu);
//   * die Protokollierung ist best-effort und verschluckt Fehler, der Export
//     gelingt also auch dann, wenn `data_export_log` nicht geschrieben werden
//     kann — der klassische Insider-Exfiltrationspfad ohne Nachweis.
//
// DATEIHOHEIT: `apps/web/src/app/api/v1/export/**` gehoert WP8. Dieses Paket
// stellt deshalb den Mechanismus bereit und uebergibt den Einbau als Notiz —
// siehe /work/audit/remediation/WP3.md, Abschnitt "Bedarf an andere Pakete".

import type { UserRole } from "@grc/shared";

/** Roles entitled to run a bulk export at all. */
export const BULK_EXPORT_ROLES: readonly UserRole[] = [
  "admin",
  "dpo",
  "compliance_officer",
];

/** Entity types that carry personal data and therefore need four eyes. */
export const PERSONAL_DATA_ENTITY_TYPES: readonly string[] = [
  "ropa_entry",
  "incident",
  "wb_report",
  "wb_case",
  "user",
  "employee",
  "training_record",
  "access_log",
  "dsar_request",
];

/** Hard ceilings — a single request must not be able to drain the tenant. */
export const BULK_EXPORT_MAX_ENTITY_TYPES = 5;
export const BULK_EXPORT_MAX_ROWS = 50_000;

export interface BulkExportRequest {
  entityTypes: string[];
  /** Id of an approval issued by a SECOND person, if one was obtained. */
  approvalId?: string | null;
}

export interface BulkExportDecision {
  allowed: boolean;
  /** Machine-readable reason; the route maps it to a problem+json body. */
  reason?: "role_required" | "too_many_entity_types" | "four_eyes_required";
  detail?: string;
  /** True when the request touches personal data (drives logging + approval). */
  containsPersonalData: boolean;
  /** Row ceiling the export engine must enforce. */
  maxRows: number;
  requiredRoles: readonly UserRole[];
}

export function containsPersonalData(entityTypes: readonly string[]): boolean {
  return entityTypes.some((t) => PERSONAL_DATA_ENTITY_TYPES.includes(t));
}

/**
 * Pure decision function — no I/O, so it is unit-testable and the route stays
 * a thin adapter.
 *
 * @param actorRoles roles the caller holds in the CURRENT org
 * @param approvalIsValid whether `approvalId` resolves to an approval that was
 *   granted by a DIFFERENT user, is still open and covers these entity types.
 *   The route resolves that; this function only decides what is required.
 */
export function decideBulkExport(
  request: BulkExportRequest,
  actorRoles: readonly string[],
  approvalIsValid: boolean,
): BulkExportDecision {
  const personal = containsPersonalData(request.entityTypes);
  const base = {
    containsPersonalData: personal,
    maxRows: BULK_EXPORT_MAX_ROWS,
    requiredRoles: BULK_EXPORT_ROLES,
  };

  if (!BULK_EXPORT_ROLES.some((r) => actorRoles.includes(r))) {
    return {
      ...base,
      allowed: false,
      reason: "role_required",
      detail:
        "A bulk export of the tenant's full data set requires one of: " +
        BULK_EXPORT_ROLES.join(", "),
    };
  }

  if (request.entityTypes.length > BULK_EXPORT_MAX_ENTITY_TYPES) {
    return {
      ...base,
      allowed: false,
      reason: "too_many_entity_types",
      detail: `At most ${BULK_EXPORT_MAX_ENTITY_TYPES} entity types per export.`,
    };
  }

  if (personal && !approvalIsValid) {
    return {
      ...base,
      allowed: false,
      reason: "four_eyes_required",
      detail:
        "This export contains personal data. A second authorised person must " +
        "approve it before it can run (four-eyes principle).",
    };
  }

  return { ...base, allowed: true };
}
