// Auto-Discovery Render-Smoke for ALL email templates.
//
// This complements template-render-smoke.test.ts (which exercises 6
// templates with handcrafted props). Here we sweep every *.tsx in
// templates/ with a kitchen-sink props bag — catches:
//   - Crashes from missing imports / syntax errors
//   - Templates that don't export `getSubject`
//   - Hard-coded language paths that throw on either DE or EN
//
// We accept that some templates may receive props they ignore; what
// matters is that none crash. A render that throws → CI fails.

import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import * as React from "react";

// Kitchen-sink props bag — superset of every template's interface.
// React-Email components silently ignore unknown props.
const kitchenSink = {
  // Lang
  lang: "en" as const,

  // Org/User
  orgName: "Meridian Holdings",
  userName: "Lisa Schneider",
  inviteeName: "Sarah Keller",
  inviterName: "Lisa Schneider",
  recipientName: "Lisa Schneider",
  assigneeName: "Lisa Schneider",
  ownerName: "Lisa Schneider",
  role: "control_owner",

  // Generic
  url: "https://arctos.example.com/x/y",
  acceptUrl: "https://arctos.example.com/invite/abc",
  detailsUrl: "https://arctos.example.com/x/y",
  taskUrl: "https://arctos.example.com/tasks/1",
  link: "https://arctos.example.com/x/y",
  title: "Generic title",
  description: "Generic description.",
  message: "Generic message.",
  date: "2026-05-10",
  dueDate: "2026-06-30",
  deadlineDate: "2026-06-08",
  scheduledDate: "2026-06-15",
  receivedAt: "2026-05-09",
  detectedAt: "2026-05-08T14:00:00Z",
  reviewDate: "2026-09-01",
  expiryDate: "2026-12-31",
  resolvedAt: "2026-05-10T18:00:00Z",
  hoursRemaining: 12,
  daysRemaining: 14,
  priority: "high",
  status: "active",
  severity: "high",

  // Task
  taskTitle: "Review draft policy",
  taskDescription: "Please review and approve.",

  // Audit
  auditTitle: "ISMS Audit Q1 2026",
  auditId: "AUD-2026-001",
  findingTitle: "Missing patch on server X",
  findingId: "FND-2026-007",
  planTitle: "Audit Plan 2026",
  planId: "PLAN-2026-01",
  approverName: "Dr. Michael Braun",
  scope: "ISO 27001 Annex A.5–A.8",

  // Crisis / BCM
  scenarioTitle: "Ransomware Outbreak",
  scenarioId: "CRI-2026-001",
  bcpTitle: "BCP Production Site DE",
  bcpId: "BCP-2026-001",
  biaTitle: "Production line BIA",
  biaId: "BIA-2026-001",
  exerciseTitle: "Tabletop Q2 2026",
  exerciseId: "EX-2026-002",
  activatedAt: "2026-05-10T14:00:00Z",

  // Privacy
  breachTitle: "Suspected unauthorized access",
  breachId: "BR-2026-001",
  dpiaTitle: "Customer Analytics DPIA",
  dpiaId: "DPIA-2026-001",
  dsrId: "DSR-2026-042",
  ropaTitle: "Marketing Newsletter",
  ropaId: "RPA-2026-007",
  requestType: "access",
  subjectName: "Max Mustermann",
  individualName: "Max Mustermann",
  controllerName: "Meridian Holdings GmbH",

  // TPRM
  vendorName: "AWS GmbH",
  vendorId: "VND-2026-003",
  contractTitle: "AWS EMEA MSA",
  contractId: "CT-2026-007",
  questionnaireTitle: "DD Questionnaire 2026",
  questionnaireUrl: "https://arctos.example.com/portal/dd/abc",

  // SLA
  slaName: "Response time < 4h",
  slaId: "SLA-2026-099",
  breachedAt: "2026-05-10T13:30:00Z",
  thresholdValue: "4h",
  actualValue: "6h12m",

  // Notification digest
  notifications: [
    {
      type: "task_assigned",
      title: "Review Q1 ISMS Audit Plan",
      message: "New task assigned",
      url: "https://arctos.example.com/tasks/1",
      date: "2026-05-09",
    },
    {
      type: "deadline_approaching",
      title: "DSR-2026-042 due in 3 days",
      message: "Deadline approaching",
      url: "https://arctos.example.com/dpms/dsr/DSR-2026-042",
      date: "2026-05-09",
    },
  ],
  digestPeriod: "weekly",
  count: 2,
};

// Templates we know about — keeps the discovery list deterministic per test
// (vs. import.meta.glob which complicates the deps graph). Add new templates
// here when the team ships them.
const TEMPLATES = [
  "AuditFindingAssigned",
  "AuditPlanApproved",
  "AuditScheduled",
  "BcpReviewDue",
  "BiaOverdue",
  "ContractExpiryNotice",
  "CrisisActivated",
  "CrisisResolved",
  "DataBreach72hOverdue",
  "DataBreach72hWarning",
  "DataBreachIndividualNotification",
  "DpiaRequired",
  "DsrCompleted",
  "DsrDeadlineWarning",
  "DsrReceived",
  "ExerciseReminder",
  "NotificationDigest",
  "RopaReviewDue",
  "SlaBreachAlert",
  "TaskAssigned",
  "TaskOverdue",
  "TaskReminder",
  "UserInvited",
  "VendorDdQuestionnaire",
  "VendorReassessmentDue",
];

describe("Email template auto-discovery (full sweep)", () => {
  it(`covers all ${TEMPLATES.length} known templates`, () => {
    expect(TEMPLATES.length).toBe(25);
  });

  for (const name of TEMPLATES) {
    describe(name, () => {
      it("module exports a default-or-named React component + getSubject", async () => {
        const mod = (await import(`../src/templates/${name}`)) as Record<
          string,
          unknown
        >;
        const Component =
          (mod[name] as React.FC<unknown>) ??
          (mod.default as React.FC<unknown>);
        expect(typeof Component).toBe("function");
        expect(typeof mod.getSubject).toBe("function");
      });

      it("renders to non-empty HTML in EN", async () => {
        const mod = (await import(`../src/templates/${name}`)) as Record<
          string,
          unknown
        >;
        const Component =
          (mod[name] as React.FC<unknown>) ??
          (mod.default as React.FC<unknown>);
        const html = await render(
          React.createElement(Component, { ...kitchenSink, lang: "en" }),
        );
        expect(html.length).toBeGreaterThan(50);
        expect(html).toContain("<html");
      });

      it("renders to non-empty HTML in DE", async () => {
        const mod = (await import(`../src/templates/${name}`)) as Record<
          string,
          unknown
        >;
        const Component =
          (mod[name] as React.FC<unknown>) ??
          (mod.default as React.FC<unknown>);
        const html = await render(
          React.createElement(Component, { ...kitchenSink, lang: "de" }),
        );
        expect(html.length).toBeGreaterThan(50);
        expect(html).toContain("<html");
      });

      it("getSubject returns non-empty strings for both languages and they differ", () => {
        return import(`../src/templates/${name}`).then(
          (mod: { getSubject: (data: unknown, lang: "de" | "en") => string }) => {
            const de = mod.getSubject(kitchenSink, "de");
            const en = mod.getSubject(kitchenSink, "en");
            expect(typeof de).toBe("string");
            expect(typeof en).toBe("string");
            expect(de.length).toBeGreaterThan(0);
            expect(en.length).toBeGreaterThan(0);
            expect(de).not.toBe(en);
          },
        );
      });
    });
  }
});
