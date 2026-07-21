// W21-DMS-MULTISIGN-02: signature-due-reminder cron.
//
// Covers: (a) staged reminder logic (3/0 days, once per stage via
// lastReminderSentAt), (b) one-time escalation (escalatedAt), and
// (c) sequential requests reminding only the signer whose turn it is.
// Pattern: contract-expiry-monitor.test.ts (inline @grc/db table stubs,
// payload inspection via mockDb.insert.mock.results).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";
import {
  shouldSendSignatureDueReminder,
  shouldEscalateSignatureRequest,
  signatureDueReminderStage,
} from "@grc/shared";

let mockDb: MockDb;

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  documentSignatureRequest: {
    id: "x",
    orgId: "x",
    documentId: "x",
    title: "x",
    status: "x",
    sequential: "x",
    dueDate: "x",
    createdBy: "x",
    lastReminderSentAt: "x",
    escalatedAt: "x",
    updatedAt: "x",
  },
  documentSignature: {
    requestId: "x",
    signerUserId: "x",
    signOrder: "x",
    status: "x",
  },
  document: { id: "x", ownerId: "x" },
  notification: {},
}));

const DAY = 86_400_000;

interface RequestRow {
  id: string;
  orgId: string;
  documentId: string;
  title: string;
  sequential: boolean;
  dueDate: string;
  createdBy: string | null;
  lastReminderSentAt: string | null;
  escalatedAt: string | null;
}

function makeRequest(overrides: Partial<RequestRow> = {}): RequestRow {
  return {
    id: "req-1",
    orgId: "org-1",
    documentId: "doc-1",
    title: "NDA Vendor X",
    sequential: false,
    dueDate: new Date(Date.now() + 2 * DAY).toISOString(),
    createdBy: "creator-1",
    lastReminderSentAt: null,
    escalatedAt: null,
    ...overrides,
  };
}

const twoPendingOneSigned = [
  { signerUserId: "signer-1", signOrder: 1, status: "pending" },
  { signerUserId: "signer-2", signOrder: 2, status: "pending" },
  { signerUserId: "signer-3", signOrder: 3, status: "signed" },
];

async function run() {
  const { processSignatureDueReminders } =
    await import("../../src/crons/signature-due-reminder");
  return processSignatureDueReminders();
}

interface NotificationPayload {
  userId: string;
  templateKey: string;
  message: string;
  type: string;
}

function insertedPayloads(): NotificationPayload[] {
  return mockDb.insert.mock.results.map(
    (r) =>
      (r.value as { values: ReturnType<typeof vi.fn> }).values.mock
        .calls[0]![0] as NotificationPayload,
  );
}

describe("processSignatureDueReminders", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
  });

  // ── Pure staging logic ─────────────────────────────────────────

  it("staging: no reminder more than 3 days out, once per stage after", () => {
    expect(signatureDueReminderStage(5)).toBeNull();
    expect(signatureDueReminderStage(3)).toBe(3);
    expect(signatureDueReminderStage(1)).toBe(3);
    expect(signatureDueReminderStage(0)).toBe(0);
    expect(signatureDueReminderStage(-4)).toBe(0);

    const dueDate = new Date("2026-07-14T12:00:00Z");
    // 2 days before, never reminded → fire
    expect(
      shouldSendSignatureDueReminder({
        dueDate,
        lastReminderSentAt: null,
        now: new Date("2026-07-12T12:00:00Z"),
      }),
    ).toBe(true);
    // already reminded within the same 3-day stage → do NOT fire again
    expect(
      shouldSendSignatureDueReminder({
        dueDate,
        lastReminderSentAt: new Date("2026-07-11T12:00:00Z"),
        now: new Date("2026-07-12T12:00:00Z"),
      }),
    ).toBe(false);
    // reminded in the 3-day stage, now the due date arrived → fire (stage 0)
    expect(
      shouldSendSignatureDueReminder({
        dueDate,
        lastReminderSentAt: new Date("2026-07-12T12:00:00Z"),
        now: new Date("2026-07-14T13:00:00Z"),
      }),
    ).toBe(true);
    // stage 0 already fired → overdue days do not re-fire
    expect(
      shouldSendSignatureDueReminder({
        dueDate,
        lastReminderSentAt: new Date("2026-07-14T13:00:00Z"),
        now: new Date("2026-07-16T12:00:00Z"),
      }),
    ).toBe(false);
  });

  it("escalation predicate: only after >3 days overdue and only once", () => {
    const dueDate = new Date(Date.now() - 4 * DAY);
    expect(
      shouldEscalateSignatureRequest({
        dueDate,
        escalatedAt: null,
        now: new Date(),
      }),
    ).toBe(true);
    // within the 3-day grace period → no escalation yet
    expect(
      shouldEscalateSignatureRequest({
        dueDate: new Date(Date.now() - 2 * DAY),
        escalatedAt: null,
        now: new Date(),
      }),
    ).toBe(false);
    // already escalated → never again
    expect(
      shouldEscalateSignatureRequest({
        dueDate,
        escalatedAt: new Date(Date.now() - DAY),
        now: new Date(),
      }),
    ).toBe(false);
  });

  // ── Cron flow ──────────────────────────────────────────────────

  it("returns zeros when no pending requests are due", async () => {
    mockDb.select.mockReturnValueOnce(chainable([]));
    const r = (await run()) as { scanned: number; remindersSent: number };
    expect(r.scanned).toBe(0);
    expect(r.remindersSent).toBe(0);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("reminds every pending signer of a parallel request", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([makeRequest()]))
      .mockReturnValueOnce(chainable(twoPendingOneSigned));
    const r = (await run()) as {
      remindersSent: number;
      notified: number;
      escalated: number;
    };
    expect(r.remindersSent).toBe(1);
    expect(r.notified).toBe(2);
    expect(r.escalated).toBe(0);
    const payloads = insertedPayloads();
    expect(payloads.map((p) => p.userId).sort()).toEqual([
      "signer-1",
      "signer-2",
    ]);
    expect(payloads[0]!.templateKey).toBe("document_signature_due_reminder");
    // lastReminderSentAt persisted
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("sequential: reminds ONLY the signer whose turn it is", async () => {
    mockDb.select
      .mockReturnValueOnce(chainable([makeRequest({ sequential: true })]))
      .mockReturnValueOnce(chainable(twoPendingOneSigned));
    const r = (await run()) as { notified: number };
    expect(r.notified).toBe(1);
    const payloads = insertedPayloads();
    expect(payloads).toHaveLength(1);
    expect(payloads[0]!.userId).toBe("signer-1");
  });

  it("does not re-remind within the same stage", async () => {
    // Anchor both dates to ONE timestamp. With two separate Date.now()
    // calls (makeRequest default dueDate vs. this override) even 1 ms of
    // skew pushes dueDate−lastReminderSentAt past exactly 3 days, and
    // daysBetween's Math.ceil then yields 4 → stageAtLast null → the cron
    // "re-reminds". Coverage instrumentation made that skew near-certain
    // in CI. Half a day of margin keeps both dates safely in stage 3.
    const anchor = Date.now();
    mockDb.select
      .mockReturnValueOnce(
        chainable([
          makeRequest({
            // due in 2 days, last reminder half a day ago → same 3-day stage
            dueDate: new Date(anchor + 2 * DAY).toISOString(),
            lastReminderSentAt: new Date(anchor - DAY / 2).toISOString(),
          }),
        ]),
      )
      .mockReturnValueOnce(chainable(twoPendingOneSigned));
    const r = (await run()) as { remindersSent: number; notified: number };
    expect(r.remindersSent).toBe(0);
    expect(r.notified).toBe(0);
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("escalates once to creator + document owner with n-of-m pending", async () => {
    mockDb.select
      .mockReturnValueOnce(
        chainable([
          makeRequest({
            dueDate: new Date(Date.now() - 5 * DAY).toISOString(),
            // stage-0 reminder already fired after the due date →
            // this run only escalates
            lastReminderSentAt: new Date(Date.now() - 4 * DAY).toISOString(),
          }),
        ]),
      )
      .mockReturnValueOnce(chainable(twoPendingOneSigned))
      .mockReturnValueOnce(chainable([{ ownerId: "owner-1" }]));
    const r = (await run()) as { escalated: number; notified: number };
    expect(r.escalated).toBe(1);
    expect(r.notified).toBe(2);
    const payloads = insertedPayloads();
    expect(payloads.map((p) => p.userId).sort()).toEqual([
      "creator-1",
      "owner-1",
    ]);
    expect(payloads[0]!.templateKey).toBe("document_signature_escalation");
    expect(payloads[0]!.message).toContain("2 of 3 signature(s)");
    // escalatedAt persisted
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("escalates only once — escalatedAt set means no further escalation", async () => {
    mockDb.select
      .mockReturnValueOnce(
        chainable([
          makeRequest({
            dueDate: new Date(Date.now() - 6 * DAY).toISOString(),
            lastReminderSentAt: new Date(Date.now() - 5 * DAY).toISOString(),
            escalatedAt: new Date(Date.now() - 2 * DAY).toISOString(),
          }),
        ]),
      )
      .mockReturnValueOnce(chainable(twoPendingOneSigned));
    const r = (await run()) as { escalated: number; notified: number };
    expect(r.escalated).toBe(0);
    expect(r.notified).toBe(0);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("dedupes creator and owner when they are the same user", async () => {
    mockDb.select
      .mockReturnValueOnce(
        chainable([
          makeRequest({
            dueDate: new Date(Date.now() - 5 * DAY).toISOString(),
            lastReminderSentAt: new Date(Date.now() - 4 * DAY).toISOString(),
            createdBy: "owner-1",
          }),
        ]),
      )
      .mockReturnValueOnce(chainable(twoPendingOneSigned))
      .mockReturnValueOnce(chainable([{ ownerId: "owner-1" }]));
    const r = (await run()) as { notified: number };
    expect(r.notified).toBe(1);
  });

  // ── Pure recipient selection ───────────────────────────────────

  it("selectReminderRecipients: sequential picks lowest pending sign_order", async () => {
    const { selectReminderRecipients } =
      await import("../../src/crons/signature-due-reminder");
    const slots = [
      { signerUserId: "a", signOrder: 2, status: "pending" as const },
      { signerUserId: "b", signOrder: 1, status: "signed" as const },
      { signerUserId: "c", signOrder: 3, status: "pending" as const },
    ];
    expect(selectReminderRecipients(slots, true)).toEqual(["a"]);
    expect(selectReminderRecipients(slots, false)).toEqual(["a", "c"]);
    expect(selectReminderRecipients([], true)).toEqual([]);
  });
});
