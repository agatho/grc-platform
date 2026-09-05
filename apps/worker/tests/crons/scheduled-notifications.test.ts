// [ARCTOS-FULL-2026-08-31 / WP11 · S11-09]
// Was one `it("returns expected stats with empty queue")` asserting
// `expect(r).toBeDefined()`. WP9 rewrote the delivery accounting for S10-03
// (an unknown template key burned three retries and excluded the notification
// forever — including the GDPR Art. 33 warning) and S10-04 (`emailSentAt` was
// written even when delivery was switched off or the provider returned no
// message id, so the field that PROVES a deadline was communicated was a lie).
//
// `emailSentAt` is evidence. These tests hold the exact conditions under which
// it may be written.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { chainable, makeMockDb, type MockDb } from "../helpers/mock-db";

let mockDb: MockDb;
const send = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  notification: {
    id: "x",
    userId: "x",
    orgId: "x",
    channel: "x",
    scheduledFor: "x",
    emailSentAt: "x",
    deletedAt: "x",
    retryCount: "x",
    title: "x",
    message: "x",
    templateKey: "x",
    templateData: "x",
  },
  user: { id: "x", email: "x", name: "x", language: "x" },
}));

vi.mock("@grc/email", () => ({
  emailService: {
    send: (...args: unknown[]) => send(...args),
  },
  // The real guard: a plain varchar column must be validated, not cast.
  isEmailTemplateKey: (k: string) =>
    ["task_reminder", "wb_acknowledge_reminder"].includes(k),
}));

const NOTIF = {
  id: "n-1",
  userId: "u-1",
  orgId: "org-1",
  type: "deadline_approaching",
  title: "Frist",
  message: "Bitte erledigen",
  channel: "email",
  templateKey: "task_reminder",
  templateData: { taskId: "t-1" },
  retryCount: 0,
};

const RECIPIENT = { email: "u@example.com", name: "Ada", language: "de" };

async function run() {
  const { processScheduledNotifications } =
    await import("../../src/crons/scheduled-notifications");
  return processScheduledNotifications();
}

type Result = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  ok: boolean;
  errors: string[];
};

/** pending notifications, then one recipient lookup per notification */
function queue(notifs: unknown[], recipients: Array<unknown[]>) {
  mockDb.select.mockReturnValueOnce(chainable(notifs));
  for (const r of recipients) {
    mockDb.select.mockReturnValueOnce(chainable(r));
  }
  mockDb.select.mockReturnValue(chainable([]));
}

function setPayload(index = 0): Record<string, unknown> {
  return (
    mockDb.update.mock.results[index]!.value as {
      set: ReturnType<typeof vi.fn>;
    }
  ).set.mock.calls[0]![0] as Record<string, unknown>;
}

describe("processScheduledNotifications", () => {
  beforeEach(() => {
    mockDb = makeMockDb();
    send.mockReset();
    send.mockResolvedValue({ ok: true, messageId: "msg-1" });
  });

  it("returns a clean zero run on an empty queue", async () => {
    mockDb.select.mockReturnValue(chainable([]));
    const r = (await run()) as Result;
    expect(r.processed).toBe(0);
    expect(r.sent).toBe(0);
    expect(r.ok).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends with the recipient's language and records the message id", async () => {
    queue([NOTIF], [[{ ...RECIPIENT, language: "en" }]]);
    const r = (await run()) as Result;

    expect(r).toMatchObject({ processed: 1, sent: 1, failed: 0, skipped: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    const arg = send.mock.calls[0]![0] as {
      to: string;
      templateKey: string;
      lang: string;
      data: Record<string, unknown>;
    };
    expect(arg.to).toBe("u@example.com");
    expect(arg.templateKey).toBe("task_reminder");
    expect(arg.lang).toBe("en");
    expect(arg.data.notificationTitle).toBe("Frist");
    expect(arg.data.recipientName).toBe("Ada");
    expect(arg.data.taskId).toBe("t-1");

    const p = setPayload();
    expect(p.emailSentAt).toBeInstanceOf(Date);
    expect(p.emailMessageId).toBe("msg-1");
    expect(p.emailError).toBeNull();
  });

  it("does NOT mark a notification as sent when delivery is switched off (S10-04)", async () => {
    queue([NOTIF], [[RECIPIENT]]);
    send.mockResolvedValue(null); // EMAIL_ENABLED != true

    const r = (await run()) as Result;
    expect(r.skipped).toBe(1);
    expect(r.sent).toBe(0);

    const p = setPayload();
    expect(p.emailSentAt).toBeUndefined();
    expect(String(p.emailError)).toContain("disabled");
    // The retry counter must NOT move: the notification is fine, the mailer
    // is off. Incrementing it would exclude the row forever.
    expect(p.retryCount).toBeUndefined();
  });

  it("treats a missing provider message id as not delivered (S10-04 A)", async () => {
    queue([NOTIF], [[RECIPIENT]]);
    send.mockResolvedValue({ ok: true, messageId: "" });

    const r = (await run()) as Result;
    expect(r.sent).toBe(0);
    expect(r.failed).toBe(1);
    expect(r.ok).toBe(false);

    const p = setPayload();
    expect(p.emailSentAt).toBeUndefined();
    expect(p.retryCount).toBe(1);
  });

  it("stops retrying an unknown template key instead of burning three attempts (S10-03)", async () => {
    queue([{ ...NOTIF, templateKey: "gdpr_art33_warning" }], [[RECIPIENT]]);

    const r = (await run()) as Result;
    expect(send).not.toHaveBeenCalled();
    expect(r.failed).toBe(1);
    expect(r.ok).toBe(false);

    const p = setPayload();
    expect(String(p.emailError)).toContain("gdpr_art33_warning");
    expect(p.retryCount).toBe(3); // MAX_RETRIES — retrying cannot help
  });

  it("stops retrying when the recipient no longer exists", async () => {
    queue([NOTIF], [[]]);
    const r = (await run()) as Result;
    expect(send).not.toHaveBeenCalled();
    const p = setPayload();
    expect(p.emailError).toBe("Recipient user not found");
    expect(p.retryCount).toBe(3); // MAX_RETRIES — retrying cannot help
    expect(r.sent).toBe(0);
  });

  // [ARCTOS-FULL-2026-08-31 · OP-108] Hier stand ein `it.fails` mit der
  // Begruendung "KNOWN PRODUCT DEFECT → WP9": `scheduled-notifications.ts`
  // fuehrt einen lokalen `failed`-Zaehler UND einen `createRunReport()`;
  // `report.toResult()` ueberschreibt `failed`/`ok` mit den Zahlen des
  // Reports, und der Zweig "recipient user not found" hat nur den lokalen
  // Zaehler erhoeht. Eine Benachrichtigung, die nie zugestellt werden kann,
  // kam damit als `{ failed: 0, ok: true }` zurueck.
  //
  // Der Defekt ist behoben (`report.fail(...)` in jenem Zweig), also ist das
  // hier ein gewoehnliches `it`. Ein `it.fails`, das eine Iteration ueberlebt,
  // ist eine Erwartung, dass etwas kaputt bleibt.
  it("reports an undeliverable notification as a failure", async () => {
    queue([NOTIF], [[]]);
    const r = (await run()) as Result;
    expect(r.failed).toBe(1);
    expect(r.ok).toBe(false);
  });

  it("increments the retry counter and reports a partial failure on a provider error", async () => {
    queue([NOTIF], [[RECIPIENT]]);
    send.mockRejectedValue(new Error("smtp 421"));

    const r = (await run()) as Result;
    expect(r.failed).toBe(1);
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(1);
    const p = setPayload();
    expect(p.retryCount).toBe(1);
    expect(p.emailError).toBe("smtp 421");
  });
});
