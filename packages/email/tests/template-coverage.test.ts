// [ARCTOS-FULL-2026-08-31 / WP9 · S10-03, S10-04]
//
// Two regression suites for the notification chain, which the audit found
// broken in three independent places at once.
//
// (1) Template coverage. The `EmailTemplateKey` union had 27 members; the
//     platform wrote 70 distinct keys into `notification.template_key`, and
//     the intersection with the crons' 38 was TWO. Everything else hit
//     `default: throw`, burned three retries and was then excluded forever
//     by `retry_count < 3` — the GDPR Art. 33 warning, the HinSchG
//     acknowledgement reminder, the DORA escalation, all of them.
//
//     The first test below scans the source tree for every `templateKey:
//     "…"` literal and asserts the registry knows it. It fails on the
//     pre-fix tree with 36 unknown keys, and it fails again the moment
//     someone introduces a 71st key without registering it.
//
// (2) Delivery accounting. The Resend SDK never throws — it returns
//     `{ data: null, error }` for HTTP errors AND network failures — so the
//     old `catch` was unreachable, the three retries never ran, and a 429 or
//     an unverified domain produced `{ messageId: "" }`, reported as
//     success.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  allEmailTemplateKeys,
  isEmailTemplateKey,
  DEDICATED_TEMPLATE_KEYS,
  GENERIC_TEMPLATES,
} from "../src/template-registry";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SCAN_DIRS = [
  join(REPO_ROOT, "apps/worker/src"),
  join(REPO_ROOT, "apps/web/src/app/api"),
  join(REPO_ROOT, "packages"),
];

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "coverage" || entry === "dist")
      continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      yield full;
    }
  }
}

/**
 * Every string literal that can end up in `templateKey`.
 *
 * Not just `templateKey: "literal"`: `signature-due-reminder.ts` writes
 * `templateKey: isOverdue ? "document_signature_overdue" :
 * "document_signature_due_reminder"`, and a scan for the literal form alone
 * misses BOTH — which is exactly how two keys slipped past the first pass of
 * this fix. The whole assignment expression is captured, up to the next
 * property of the object literal, and every quoted literal inside it is
 * treated as a key.
 */
function usedTemplateKeys(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  // `templateKey:` … up to the next `\n  <identifier>:` (next property) or
  // the closing brace of the object.
  const assignment =
    /templateKey\s*[:=]\s*([\s\S]{0,200}?)(?=\n\s*[A-Za-z_$][\w$]*\s*[:,]|\n\s*\}|\n\s*\))/g;
  const literal = /["']([a-z][a-z0-9_]{3,})["']/g;
  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) {
      const src = readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      while ((m = assignment.exec(src))) {
        let span = m[1];
        // A Drizzle column definition (`templateKey: varchar("template_key",
        // …)`) is not a value assignment — skip it.
        if (/^[A-Za-z_$][\w$]*\s*\(/.test(span.trim())) continue;
        // In a ternary the condition can contain unrelated literals
        // (`targetStatus === "approved" ? "process_approved" : …`); only the
        // branches are template keys.
        const q = span.indexOf("?");
        if (q >= 0) span = span.slice(q + 1);
        let l: RegExpExecArray | null;
        literal.lastIndex = 0;
        while ((l = literal.exec(span))) {
          const key = l[1];
          const list = found.get(key) ?? [];
          list.push(file.slice(REPO_ROOT.length + 1));
          found.set(key, list);
        }
      }
    }
  }
  return found;
}

describe("e-mail template coverage (S10-03)", () => {
  it("knows every templateKey the platform writes", () => {
    const used = usedTemplateKeys();
    expect(
      used.size,
      "no templateKey literals found — scanner broken?",
    ).toBeGreaterThan(30);

    const unknown = [...used.entries()]
      .filter(([key]) => !isEmailTemplateKey(key))
      .map(([key, files]) => `${key} (${files[0]})`);

    expect(
      unknown,
      "template keys with no renderer — these mails die after three retries",
    ).toEqual([]);
  });

  it("keeps the dedicated and generic key sets disjoint", () => {
    const overlap = DEDICATED_TEMPLATE_KEYS.filter(
      (k) => (k as string) in GENERIC_TEMPLATES,
    );
    expect(overlap).toEqual([]);
  });

  it("gives every generic key a subject in both languages", () => {
    for (const [key, spec] of Object.entries(GENERIC_TEMPLATES)) {
      expect(spec.subject.de.length, `${key} de`).toBeGreaterThan(3);
      expect(spec.subject.en.length, `${key} en`).toBeGreaterThan(3);
    }
  });

  it("marks the statutory-deadline keys as critical", () => {
    // These carry regulatory reporting windows; the severity drives the
    // visual treatment of the mail.
    for (const key of [
      "breach_72h_warning",
      "dsr_sla_warning",
      "wb_acknowledge_reminder",
      "wb_response_reminder",
      "dora_report_overdue",
      "ai_act_incident_deadline",
    ] as const) {
      expect(GENERIC_TEMPLATES[key].severity, key).toBe("critical");
    }
  });

  it("renders every registered key without throwing", async () => {
    const { EmailService } = await import("../src/EmailService");
    const service = new EmailService("re_test_placeholder");
    for (const key of allEmailTemplateKeys()) {
      const rendered = service.renderTemplate(
        key as never,
        {
          notificationTitle: "Probe",
          notificationMessage: "Probe body",
          recipientName: "Probe",
          taskTitle: "Probe",
          dueDate: "2026-09-01",
          orgName: "Probe GmbH",
        },
        "de",
      );
      expect(rendered.subject.length, key).toBeGreaterThan(0);
      expect(rendered.component, key).toBeTruthy();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Delivery accounting (S10-04)
// ─────────────────────────────────────────────────────────────────────

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

describe("EmailService delivery accounting (S10-04)", () => {
  const params = {
    to: "user@example.com",
    templateKey: "task_assigned" as const,
    data: { taskTitle: "T", assigneeName: "A", dueDate: "2026-09-01" },
    lang: "de" as const,
  };
  const previous = process.env.EMAIL_ENABLED;

  beforeEach(() => {
    mockSend.mockReset();
    process.env.EMAIL_ENABLED = "true";
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.EMAIL_ENABLED;
    else process.env.EMAIL_ENABLED = previous;
  });

  async function service() {
    const { EmailService } = await import("../src/EmailService");
    return new EmailService("re_test_key");
  }

  it("throws when the provider returns an error object", async () => {
    // The SDK NEVER throws — this is the shape a 422/429/401 arrives in.
    mockSend.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "domain not verified" },
    });
    const svc = await service();
    await expect(svc.send(params)).rejects.toThrow(/domain not verified/);
    // Pre-fix this returned { messageId: "" } and was recorded as delivered.
  }, 60_000);

  it("throws when the provider returns neither id nor error", async () => {
    mockSend.mockResolvedValue({ data: null, error: null });
    const svc = await service();
    await expect(svc.send(params)).rejects.toThrow(/not delivered/);
  }, 60_000);

  it("retries a provider failure and succeeds on a later attempt", async () => {
    mockSend
      .mockResolvedValueOnce({
        data: null,
        error: { name: "rate_limit_exceeded" },
      })
      .mockResolvedValueOnce({ data: { id: "msg_2" }, error: null });
    const svc = await service();
    await expect(svc.send(params)).resolves.toEqual({ messageId: "msg_2" });
    expect(mockSend).toHaveBeenCalledTimes(2);
    // Pre-fix the retry block was unreachable dead code.
  }, 60_000);

  it("returns null — meaning NOT sent — when delivery is disabled", async () => {
    process.env.EMAIL_ENABLED = "false";
    const svc = await service();
    await expect(svc.send(params)).resolves.toBeNull();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does not write the recipient address to stdout when disabled", async () => {
    // S10-24: EMAIL_ENABLED defaults to false in production, so this was
    // the DEFAULT path and logged every recipient to a third-party log sink.
    process.env.EMAIL_ENABLED = "false";
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const svc = await service();
    await svc.send({ ...params, to: "personal.name@customer.example" });
    const logged = spy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("personal.name@customer.example");
    expect(logged).toContain("customer.example"); // domain kept for triage
    spy.mockRestore();
  });
});
