// ARCTOS-FULL-2026-08-31 · WP8 · S07-14 (zugleich S02-07)
//
// Abnahmekriterium des Pakets: „Massenexport ohne die geforderte Rolle →
// 403; über Limit → abgelehnt."
//
// `decideBulkExport()` selbst ist in packages/auth getestet, die
// Freigabe-Mechanik in packages/db/tests/integration/gdpr-privacy.test.ts.
// Was hier geprüft wird, ist die VERDRAHTUNG in der Route — genau die
// Stelle, an der der Befund lag: der Guard existierte nicht, die Route
// lief unter `withAuth()` ohne Rollenliste, und die Protokollierung
// steckte in einem `catch`, das den Export trotzdem auslieferte.

import { describe, it, expect, vi, beforeEach } from "vitest";

const withAuthMock = vi.fn();
const exportEntitiesMock = vi.fn();
const logExportMock = vi.fn();
const executeMock = vi.fn();

vi.mock("@/lib/api", () => ({
  withAuth: (...args: unknown[]) => withAuthMock(...args),
  withAuditContext: vi.fn(async (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({}),
  ),
}));

vi.mock("@grc/db", () => ({
  db: { execute: (...a: unknown[]) => executeMock(...a) },
}));

vi.mock("@/lib/import-export/export-engine", () => ({
  exportEntities: (...a: unknown[]) => exportEntitiesMock(...a),
}));

class ExportNotLoggedErrorStub extends Error {}

vi.mock("@/lib/export-audit", () => ({
  logExportOrThrow: (...a: unknown[]) => logExportMock(...a),
  anyExportContainsPersonalData: (types: string[]) =>
    types.includes("ropa_entry") || types.includes("incident"),
  clientIpForAudit: () => "203.0.113.7",
  ExportNotLoggedError: ExportNotLoggedErrorStub,
}));

function req(body: unknown): Request {
  return new Request("http://localhost/api/v1/export/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const CTX = {
  orgId: "11111111-1111-1111-1111-111111111111",
  userId: "22222222-2222-2222-2222-222222222222",
};

beforeEach(() => {
  vi.clearAllMocks();
  exportEntitiesMock.mockResolvedValue({
    data: Buffer.from("id,title\n1,x\n"),
    contentType: "text/csv",
    fileName: "risk-export.csv",
    rowCount: 1,
  });
  logExportMock.mockResolvedValue(undefined);
  executeMock.mockResolvedValue([{ ok: false }]);
});

describe("S07-14 — POST /api/v1/export/bulk", () => {
  it("refuses a viewer with 403 (the audit's scenario)", async () => {
    withAuthMock.mockResolvedValue({ ...CTX, roles: ["viewer"] });
    const { POST } = await import("@/app/api/v1/export/bulk/route");
    const res = await POST(req({ entityTypes: ["risk"] }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.type).toContain("role-required");
    expect(exportEntitiesMock).not.toHaveBeenCalled();
  });

  it("refuses more entity types than the ceiling allows", async () => {
    withAuthMock.mockResolvedValue({ ...CTX, roles: ["admin"] });
    const { POST } = await import("@/app/api/v1/export/bulk/route");
    const res = await POST(
      req({
        entityTypes: [
          "risk",
          "control",
          "asset",
          "vendor",
          "contract",
          "process",
        ],
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).type).toContain("too-many-entity-types");
    expect(exportEntitiesMock).not.toHaveBeenCalled();
  });

  it("refuses personal data without a second person's approval", async () => {
    withAuthMock.mockResolvedValue({ ...CTX, roles: ["admin"] });
    const { POST } = await import("@/app/api/v1/export/bulk/route");
    const res = await POST(req({ entityTypes: ["ropa_entry"] }));
    expect(res.status).toBe(403);
    expect((await res.json()).type).toContain("four-eyes-required");
  });

  it("allows personal data once the approval resolves", async () => {
    withAuthMock.mockResolvedValue({ ...CTX, roles: ["dpo"] });
    executeMock.mockResolvedValue([{ ok: true }]);
    const { POST } = await import("@/app/api/v1/export/bulk/route");
    const res = await POST(
      req({
        entityTypes: ["ropa_entry"],
        approvalId: "33333333-3333-3333-3333-333333333333",
      }),
    );
    expect(res.status).toBe(200);
    expect(logExportMock).toHaveBeenCalledTimes(1);
    // Das PII-Kennzeichen wird nicht mehr aus einer Literalliste geraten.
    expect(logExportMock.mock.calls[0]![0].containsPersonalData).toBe(true);
  });

  it("does not deliver an export it could not record", async () => {
    // Vorher: `try { insert } catch (logErr) { console.error }` — der
    // Export gelang auch ohne Nachweis. Das ist der klassische
    // Insider-Exfiltrationspfad.
    withAuthMock.mockResolvedValue({ ...CTX, roles: ["compliance_officer"] });
    logExportMock.mockRejectedValue(new ExportNotLoggedErrorStub("no log"));
    const { POST } = await import("@/app/api/v1/export/bulk/route");
    const res = await POST(req({ entityTypes: ["risk"] }));
    expect(res.status).toBe(503);
    expect((await res.json()).type).toContain("export-not-recorded");
  });

  it("rejects a request that would exceed the row ceiling", async () => {
    withAuthMock.mockResolvedValue({ ...CTX, roles: ["admin"] });
    exportEntitiesMock.mockResolvedValue({
      data: Buffer.from(""),
      contentType: "text/csv",
      fileName: "x.csv",
      rowCount: 60_000,
    });
    const { POST } = await import("@/app/api/v1/export/bulk/route");
    const res = await POST(req({ entityTypes: ["risk"] }));
    expect(res.status).toBe(413);
    expect(logExportMock).not.toHaveBeenCalled();
  });
});
