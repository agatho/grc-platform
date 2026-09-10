// #S10-16 regression contract — audit ARCTOS-FULL-2026-08-31, Medium.
//
// The automation engine's `change_status` action executed
//
//   UPDATE <entityType> SET status = $1, updated_at = now()
//   WHERE id = $2::uuid AND org_id = $3::uuid
//
// where `entityType` came from the automation rule an org user authors in the
// UI. `sql.identifier()` quoted it correctly (so this was never SQL
// injection) and the org_id filter held the tenant boundary — but there was
// no allowlist, so a rule could set `status` on ANY table with
// (id, org_id, status, updated_at).
//
// The documented escalation: a user with automation-edit rights but no DMS
// rights writes `changeStatus(entityType: "document", newStatus: "expired")`.
// `document-retention-purge.ts` selects `status IN ('archived','expired')`
// and HARD-DELETES, so the automation rule becomes a deletion tool for
// documents its author could not otherwise touch.

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@grc/db", async () => {
  const { dbMockFactory } = await import("../helpers/db-proxy");
  return dbMockFactory();
});
vi.mock("@grc/events", async () => {
  const { eventsMockFactory } = await import("../helpers/db-proxy");
  return eventsMockFactory();
});

// Capture the ActionServices object the engine is constructed with, so the
// test can drive `changeStatus` directly without exporting it from
// production code.
const capturedServices: { current: Record<string, any> | null } = {
  current: null,
};
vi.mock("@grc/automation", () => ({
  AutomationEngine: class {
    constructor(opts: { services: Record<string, any> }) {
      capturedServices.current = opts.services;
    }
    subscribe = vi.fn();
    setActionServices = vi.fn();
    handleEvent = vi.fn().mockResolvedValue(undefined);
  },
}));

import { resetMockDb, getMockDb } from "../helpers/db-proxy";
import { chainable } from "../helpers/mock-db";

const ORG = "22222222-2222-2222-2222-222222222222";
const ENTITY = "44444444-4444-4444-4444-444444444444";

async function services() {
  const mod = await import("../../src/crons/automation-engine-init");
  mod.initAutomationEngine();
  expect(capturedServices.current).not.toBeNull();
  return capturedServices.current!;
}

describe("automation changeStatus — #S10-16 table allowlist", () => {
  beforeEach(() => {
    const m = resetMockDb();
    m.select.mockReturnValue(chainable([]));
    m.execute.mockResolvedValue([]);
    // NOTE: capturedServices is deliberately NOT reset — initAutomationEngine
    // is a singleton and only constructs the engine on the first call.
  });

  const FORBIDDEN = [
    // The documented deletion path.
    "document",
    "document_version",
    // Audit / integrity surfaces.
    "audit_log",
    "audit_log_archive",
    // Whistleblowing confidentiality.
    "whistleblow_report",
    // Auth surfaces.
    "user_organization_role",
    "organization",
    // Not a table at all — a rule can contain anything.
    "pg_class",
    "",
  ];

  for (const entityType of FORBIDDEN) {
    it(`refuses entityType ${JSON.stringify(entityType)}`, async () => {
      const svc = await services();
      const db = getMockDb();
      db.execute.mockClear();

      await svc.changeStatus({
        entityType,
        entityId: ENTITY,
        newStatus: "expired",
        orgId: ORG,
      });

      expect(db.execute).not.toHaveBeenCalled();
    });
  }

  const ALLOWED = ["risk", "control", "finding", "incident", "task", "vendor"];

  for (const entityType of ALLOWED) {
    it(`still performs the update for the automation-managed entity ${entityType}`, async () => {
      const svc = await services();
      const db = getMockDb();
      db.execute.mockClear();

      await svc.changeStatus({
        entityType,
        entityId: ENTITY,
        newStatus: "closed",
        orgId: ORG,
      });

      expect(db.execute).toHaveBeenCalledTimes(1);
    });
  }
});
