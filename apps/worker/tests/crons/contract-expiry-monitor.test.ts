import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  contract: {
    id: "x",
    orgId: "x",
    title: "x",
    expirationDate: "x",
    autoRenewal: "x",
    renewalPeriodMonths: "x",
    noticePeriodDays: "x",
    ownerId: "x",
    deletedAt: "x",
    status: "x",
  },
  notification: {},
}));

describe("processContractExpiryMonitor", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it("returns zero when no contracts to process", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([])) // expired contracts
      .mockReturnValueOnce(chainable([])); // approaching notice
    const { processContractExpiryMonitor } = await import(
      "../../src/crons/contract-expiry-monitor"
    );
    const r = await processContractExpiryMonitor();
    expect(r.processed).toBe(0);
    expect(r.notified).toBe(0);
    expect(r.transitioned).toBe(0);
  });

  it("transitions an expired non-auto-renewing contract to expired status", async () => {
    const expiredContracts = [
      {
        id: "c1",
        orgId: "org",
        title: "Old Vendor Contract",
        status: "active",
        expirationDate: "2026-04-01",
        autoRenewal: false,
        renewalPeriodMonths: null,
        ownerId: "owner-1",
      },
    ];
    mockDb.select
      .mockReturnValueOnce(chainable(expiredContracts))
      .mockReturnValueOnce(chainable([]));
    const { processContractExpiryMonitor } = await import(
      "../../src/crons/contract-expiry-monitor"
    );
    const r = await processContractExpiryMonitor();
    expect(r.transitioned).toBe(1);
    expect(r.notified).toBe(1);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("auto-renews contract when autoRenewal=true", async () => {
    const expiredContracts = [
      {
        id: "c1",
        orgId: "org",
        title: "Cloud Subscription",
        status: "active",
        expirationDate: "2026-04-01",
        autoRenewal: true,
        renewalPeriodMonths: 12,
        ownerId: "owner-1",
      },
    ];
    mockDb.select
      .mockReturnValueOnce(chainable(expiredContracts))
      .mockReturnValueOnce(chainable([]));
    const { processContractExpiryMonitor } = await import(
      "../../src/crons/contract-expiry-monitor"
    );
    const r = await processContractExpiryMonitor();
    expect(r.transitioned).toBe(1);
    expect(r.notified).toBe(1);
    // Verify the notification template is `contract_auto_renewed`
    const calls = mockDb.insert.mock.results;
    const lastInsert = calls[calls.length - 1]?.value as {
      values: ReturnType<typeof vi.fn>;
    };
    expect(lastInsert.values).toHaveBeenCalled();
    const payload = lastInsert.values.mock.calls[0]![0];
    expect(payload.templateKey).toBe("contract_auto_renewed");
  });

  it("notifies owner when contract reaches notice period", async () => {
    const approachingNotice = [
      {
        id: "c2",
        orgId: "org",
        title: "MSP Contract",
        expirationDate: "2026-07-01",
        noticePeriodDays: 60,
        ownerId: "owner-2",
      },
    ];
    mockDb.select
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(chainable(approachingNotice));
    const { processContractExpiryMonitor } = await import(
      "../../src/crons/contract-expiry-monitor"
    );
    const r = await processContractExpiryMonitor();
    expect(r.notified).toBe(1);
    const insertChain = mockDb.insert.mock.results[0]?.value as {
      values: ReturnType<typeof vi.fn>;
    };
    const payload = insertChain.values.mock.calls[0]![0];
    expect(payload.templateKey).toBe("contract_notice_period");
  });
});
