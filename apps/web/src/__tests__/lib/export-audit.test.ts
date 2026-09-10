// ARCTOS-FULL-2026-08-31 · WP8 · S07-14
//
// `exportContainsPersonalData()` ersetzt die Literalliste
// `["ropa_entry","incident"].includes(entityType)`, mit der beide
// Exportrouten das PII-Kennzeichen in `data_export_log` gesetzt haben.
// Der Befund: exportierbar sind zehn Typen, und deren Exportspalten
// enthalten laut Entity-Registry `owner_email`, `contact_person`,
// `reporter_email`, `responsible_email`, `tax_id` und `legal_name`. Ein
// Export von 5.000 Risiken mit sämtlichen Eigentümer-E-Mail-Adressen
// wurde als `contains_personal_data = false` protokolliert — genau die
// Spalte, nach der ein DSB später filtert.

import { describe, it, expect } from "vitest";
import { BULK_EXPORT_ROLES } from "@grc/auth";
import {
  exportContainsPersonalData,
  anyExportContainsPersonalData,
  mayExportPersonalData,
  PERSONAL_EXPORT_ROLES,
  clientIpForAudit,
} from "@/lib/export-audit";

describe("S07-14 — PII-Kennzeichen aus der Entity-Registry", () => {
  it("flags risk, control and process — they export free text and department", () => {
    // Die drei Typen, die die alte Literalliste als PII-frei führte. Ihre
    // Exportspalten enthalten `description` und `department`; das
    // PII-Inventar des Audits führt Freitext als "PII möglich", und in
    // Risikobeschreibungen stehen regelmäßig Namen von Verantwortlichen,
    // Vorfällen und Betroffenen.
    for (const t of ["risk", "control", "process"]) {
      expect(exportContainsPersonalData(t), t).toBe(true);
    }
  });

  it("keeps flagging the two the old list knew about", () => {
    expect(exportContainsPersonalData("ropa_entry")).toBe(true);
    expect(exportContainsPersonalData("incident")).toBe(true);
  });

  it("treats an unknown entity type as personal rather than as harmless", () => {
    expect(exportContainsPersonalData("something_new")).toBe(true);
  });

  it("aggregates across a bulk selection", () => {
    expect(anyExportContainsPersonalData(["risk"])).toBe(true);
  });
});

describe("S07-14 — Rollenschnitt für Exporte mit Personenbezug", () => {
  it("rejects the read-only role the audit exploited", () => {
    expect(mayExportPersonalData(["viewer"])).toBe(false);
    expect(mayExportPersonalData([])).toBe(false);
    expect(mayExportPersonalData(undefined)).toBe(false);
  });

  it("accepts the roles that own the data", () => {
    expect(mayExportPersonalData(["risk_manager"])).toBe(true);
    expect(mayExportPersonalData(["dpo"])).toBe(true);
  });

  it("stays a superset of WP3's BULK_EXPORT_ROLES (export-roles-superset)", () => {
    // Die Liste in `export-audit.ts` steht als Literal, damit das Modul
    // nicht von `@grc/auth` abhängt (die Smoke-Suiten mocken das Paket).
    // Dieser Test hält beide Listen in Deckung: was einen Massenexport
    // darf, muss erst recht einen Einzelexport dürfen.
    for (const r of BULK_EXPORT_ROLES) {
      expect(PERSONAL_EXPORT_ROLES, `missing ${r}`).toContain(r);
    }
  });
});

describe("S07-14 — data_export_log.ip_address war immer NULL", () => {
  it("reads the client address from the forwarding headers", () => {
    const req = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(clientIpForAudit(req)).toBe("203.0.113.7");
    expect(clientIpForAudit(new Request("http://localhost/x"))).toBeNull();
  });
});
