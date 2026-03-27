import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { EmailParams, EmailTemplateKey } from "../src/types";

// vi.hoisted ensures the mock fn is available when vi.mock factory runs (hoisted above imports)
const { mockResendSend } = vi.hoisted(() => ({
  mockResendSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockResendSend };
  },
}));

import { EmailService } from "../src/EmailService";

describe("EmailService", () => {
  let service: EmailService;
  const savedEnv: Record<string, string | undefined> = {};

  function saveAndSetEnv(vars: Record<string, string | undefined>): void {
    for (const [key, value] of Object.entries(vars)) {
      savedEnv[key] = process.env[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  function restoreEnv(): void {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  beforeEach(() => {
    saveAndSetEnv({
      RESEND_API_KEY: "re_test_key",
      RESEND_FROM_NAME: "ARCTOS GRC Platform",
      RESEND_FROM_EMAIL: "noreply@arctos.cws.de",
    });
    service = new EmailService("re_test_key");
    mockResendSend.mockReset();

    // Always mock delay to avoid real setTimeout waits in tests
    vi.spyOn(service as never, "delay" as never).mockResolvedValue(
      undefined as never
    );
  });

  afterEach(() => {
    restoreEnv();
  });

  const baseParams: EmailParams = {
    to: "user@example.com",
    templateKey: "task_assigned",
    data: {
      taskTitle: "Complete risk assessment",
      assigneeName: "Max Mustermann",
      dueDate: "2026-04-01",
      priority: "high",
      taskUrl: "https://arctos.cws.de/tasks/123",
    },
    lang: "de",
  };

  // ---------------------------------------------------------------------------
  // EMAIL_ENABLED=false returns null
  // ---------------------------------------------------------------------------
  describe("when EMAIL_ENABLED is not true", () => {
    it("should return null and skip sending", async () => {
      process.env.EMAIL_ENABLED = "false";
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = await service.send(baseParams);

      expect(result).toBeNull();
      expect(mockResendSend).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[EmailService] disabled")
      );
      consoleSpy.mockRestore();
    });

    it("should return null when EMAIL_ENABLED is undefined", async () => {
      delete process.env.EMAIL_ENABLED;
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = await service.send(baseParams);

      expect(result).toBeNull();
      expect(mockResendSend).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Successful send
  // ---------------------------------------------------------------------------
  describe("when EMAIL_ENABLED is true", () => {
    beforeEach(() => {
      process.env.EMAIL_ENABLED = "true";
    });

    it("should send email and return messageId on first attempt", async () => {
      mockResendSend.mockResolvedValueOnce({
        data: { id: "msg_abc123" },
        error: null,
      });

      const result = await service.send(baseParams);

      expect(result).toEqual({ messageId: "msg_abc123" });
      expect(mockResendSend).toHaveBeenCalledTimes(1);
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "ARCTOS GRC Platform <noreply@arctos.cws.de>",
          to: "user@example.com",
          subject: expect.stringContaining("Neue Aufgabe zugewiesen"),
          react: expect.anything(),
        })
      );
    });

    it("should use EN subject when lang is en", async () => {
      mockResendSend.mockResolvedValueOnce({
        data: { id: "msg_en123" },
        error: null,
      });

      const result = await service.send({ ...baseParams, lang: "en" });

      expect(result).toEqual({ messageId: "msg_en123" });
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("New task assigned"),
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Retry logic: fail first 2 attempts, succeed on 3rd
  // ---------------------------------------------------------------------------
  describe("retry logic", () => {
    beforeEach(() => {
      process.env.EMAIL_ENABLED = "true";
    });

    it("should retry and succeed on the 3rd attempt", async () => {
      mockResendSend
        .mockRejectedValueOnce(new Error("Resend rate limit"))
        .mockRejectedValueOnce(new Error("Resend timeout"))
        .mockResolvedValueOnce({
          data: { id: "msg_retry_success" },
          error: null,
        });

      const result = await service.send(baseParams);

      expect(result).toEqual({ messageId: "msg_retry_success" });
      expect(mockResendSend).toHaveBeenCalledTimes(3);
    });

    it("should retry and succeed on the 2nd attempt", async () => {
      mockResendSend
        .mockRejectedValueOnce(new Error("Temporary error"))
        .mockResolvedValueOnce({
          data: { id: "msg_retry2" },
          error: null,
        });

      const result = await service.send(baseParams);

      expect(result).toEqual({ messageId: "msg_retry2" });
      expect(mockResendSend).toHaveBeenCalledTimes(2);
    });

    it("should throw after 3 failed attempts", async () => {
      const finalError = new Error("Resend permanent failure");
      mockResendSend
        .mockRejectedValueOnce(new Error("Attempt 1"))
        .mockRejectedValueOnce(new Error("Attempt 2"))
        .mockRejectedValueOnce(finalError);

      await expect(service.send(baseParams)).rejects.toThrow(
        "Resend permanent failure"
      );
      expect(mockResendSend).toHaveBeenCalledTimes(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Template rendering for each template key
  // ---------------------------------------------------------------------------
  describe("renderTemplate", () => {
    const templateTestCases: Array<{
      key: EmailTemplateKey;
      data: Record<string, unknown>;
      lang: "de" | "en";
      expectedSubjectContains: string;
    }> = [
      {
        key: "task_assigned",
        data: {
          taskTitle: "Review controls",
          assigneeName: "Anna",
          dueDate: "2026-04-15",
          priority: "high",
          taskUrl: "https://arctos.cws.de/tasks/1",
        },
        lang: "de",
        expectedSubjectContains: "Neue Aufgabe zugewiesen: Review controls",
      },
      {
        key: "task_assigned",
        data: {
          taskTitle: "Review controls",
          assigneeName: "Anna",
          dueDate: "2026-04-15",
          priority: "high",
          taskUrl: "https://arctos.cws.de/tasks/1",
        },
        lang: "en",
        expectedSubjectContains: "New task assigned: Review controls",
      },
      {
        key: "task_overdue",
        data: {
          taskTitle: "Submit audit report",
          dueDate: "2026-03-01",
          daysOverdue: 5,
          taskUrl: "https://arctos.cws.de/tasks/2",
        },
        lang: "de",
        expectedSubjectContains: "Aufgabe überfällig: Submit audit report",
      },
      {
        key: "task_overdue",
        data: {
          taskTitle: "Submit audit report",
          dueDate: "2026-03-01",
          daysOverdue: 5,
          taskUrl: "https://arctos.cws.de/tasks/2",
        },
        lang: "en",
        expectedSubjectContains: "Task overdue: Submit audit report",
      },
      {
        key: "task_reminder",
        data: {
          taskTitle: "Update risk register",
          dueDate: "2026-04-10",
          taskUrl: "https://arctos.cws.de/tasks/3",
        },
        lang: "de",
        expectedSubjectContains: "Erinnerung: Update risk register",
      },
      {
        key: "task_reminder",
        data: {
          taskTitle: "Update risk register",
          dueDate: "2026-04-10",
          taskUrl: "https://arctos.cws.de/tasks/3",
        },
        lang: "en",
        expectedSubjectContains: "Reminder: Update risk register",
      },
      {
        key: "user_invited",
        data: {
          orgName: "CWS Boco",
          roleName: "risk_manager",
          inviterName: "Admin User",
          acceptUrl: "https://arctos.cws.de/invite/token123",
        },
        lang: "de",
        expectedSubjectContains: "Einladung zu ARCTOS",
      },
      {
        key: "user_invited",
        data: {
          orgName: "CWS Boco",
          roleName: "risk_manager",
          inviterName: "Admin User",
          acceptUrl: "https://arctos.cws.de/invite/token123",
        },
        lang: "en",
        expectedSubjectContains: "Invitation to ARCTOS",
      },
      {
        key: "notification_digest",
        data: {
          notifications: [
            {
              type: "task_assigned",
              title: "New task: Review",
              timestamp: "10:00",
            },
            {
              type: "task_overdue",
              title: "Overdue: Audit",
              timestamp: "11:00",
            },
          ],
          platformUrl: "https://arctos.cws.de",
          digestDate: "25.03.2026",
        },
        lang: "de",
        expectedSubjectContains: "ARCTOS Tagesübersicht",
      },
      {
        key: "notification_digest",
        data: {
          notifications: [],
          platformUrl: "https://arctos.cws.de",
          digestDate: "03/25/2026",
        },
        lang: "en",
        expectedSubjectContains: "ARCTOS Daily Digest",
      },
      {
        key: "dpo_assigned",
        data: {
          orgName: "CWS Boco",
          assignedBy: "Admin",
          platformUrl: "https://arctos.cws.de",
        },
        lang: "de",
        expectedSubjectContains: "DPO-Zuweisung",
      },
      {
        key: "dpo_assigned",
        data: {
          orgName: "CWS Boco",
          assignedBy: "Admin",
          platformUrl: "https://arctos.cws.de",
        },
        lang: "en",
        expectedSubjectContains: "DPO Assignment",
      },
      {
        key: "risk_owner_assigned",
        data: {
          riskTitle: "Data breach risk",
          assigneeName: "Max",
          dueDate: "2026-05-01",
          priority: "critical",
          riskUrl: "https://arctos.cws.de/risks/1",
        },
        lang: "de",
        expectedSubjectContains: "Risiko zugewiesen: Data breach risk",
      },
      {
        key: "risk_owner_assigned",
        data: {
          riskTitle: "Data breach risk",
          assigneeName: "Max",
          dueDate: "2026-05-01",
          priority: "critical",
          riskUrl: "https://arctos.cws.de/risks/1",
        },
        lang: "en",
        expectedSubjectContains: "Risk assigned: Data breach risk",
      },
    ];

    it.each(templateTestCases)(
      'should render "$key" template in "$lang" with correct subject',
      ({ key, data, lang, expectedSubjectContains }) => {
        const result = service.renderTemplate(key, data, lang);

        expect(result.subject).toContain(expectedSubjectContains);
        expect(result.component).toBeDefined();
        expect(result.component).toHaveProperty("type");
        expect(result.component).toHaveProperty("props");
      }
    );

    it("should throw for unknown template key", () => {
      expect(() =>
        service.renderTemplate(
          "nonexistent" as EmailTemplateKey,
          {},
          "en"
        )
      ).toThrow("Unknown email template key");
    });
  });

  // ---------------------------------------------------------------------------
  // From address construction
  // ---------------------------------------------------------------------------
  describe("from address", () => {
    beforeEach(() => {
      process.env.EMAIL_ENABLED = "true";
    });

    it("should use env variables for from address", async () => {
      mockResendSend.mockResolvedValueOnce({
        data: { id: "msg_from_test" },
        error: null,
      });

      process.env.RESEND_FROM_NAME = "Custom Sender";
      process.env.RESEND_FROM_EMAIL = "custom@example.com";

      await service.send(baseParams);

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "Custom Sender <custom@example.com>",
        })
      );
    });

    it("should use default values when env vars are not set", async () => {
      mockResendSend.mockResolvedValueOnce({
        data: { id: "msg_default" },
        error: null,
      });

      delete process.env.RESEND_FROM_NAME;
      delete process.env.RESEND_FROM_EMAIL;

      await service.send(baseParams);

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "ARCTOS GRC Platform <noreply@arctos.cws.de>",
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // messageId fallback
  // ---------------------------------------------------------------------------
  describe("messageId handling", () => {
    beforeEach(() => {
      process.env.EMAIL_ENABLED = "true";
    });

    it("should return empty string messageId when data.id is null", async () => {
      mockResendSend.mockResolvedValueOnce({
        data: { id: null },
        error: null,
      });

      const result = await service.send(baseParams);

      expect(result).toEqual({ messageId: "" });
    });

    it("should return empty string messageId when data is null", async () => {
      mockResendSend.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await service.send(baseParams);

      expect(result).toEqual({ messageId: "" });
    });
  });
});
