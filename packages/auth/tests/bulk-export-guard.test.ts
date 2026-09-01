// #WP3-S02-07 — Massenexport ohne Rolle, Limit und Vier-Augen.
import { describe, it, expect } from "vitest";
import {
  decideBulkExport,
  BULK_EXPORT_MAX_ENTITY_TYPES,
} from "../src/middleware/bulk-export-guard";

describe("S02-07 — bulk export authorisation", () => {
  it("REJECTS a viewer (the audit's scenario: read-only role exports everything)", () => {
    const d = decideBulkExport({ entityTypes: ["risk"] }, ["viewer"], false);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("role_required");
  });

  it("REJECTS an unbounded number of entity types", () => {
    const many = Array.from(
      { length: BULK_EXPORT_MAX_ENTITY_TYPES + 1 },
      (_, i) => `e${i}`,
    );
    const d = decideBulkExport({ entityTypes: many }, ["admin"], false);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("too_many_entity_types");
  });

  it("REQUIRES four eyes for personal data even for an admin", () => {
    const d = decideBulkExport(
      { entityTypes: ["ropa_entry"] },
      ["admin"],
      false,
    );
    expect(d.containsPersonalData).toBe(true);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("four_eyes_required");
  });

  it("ALLOWS personal data once a second person approved", () => {
    const d = decideBulkExport({ entityTypes: ["ropa_entry"] }, ["dpo"], true);
    expect(d.allowed).toBe(true);
  });

  it("ALLOWS non-personal data for an entitled role and caps the row count", () => {
    const d = decideBulkExport(
      { entityTypes: ["risk", "control"] },
      ["compliance_officer"],
      false,
    );
    expect(d.allowed).toBe(true);
    expect(d.containsPersonalData).toBe(false);
    expect(d.maxRows).toBeGreaterThan(0);
  });
});
