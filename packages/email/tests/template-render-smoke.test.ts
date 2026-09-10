// Email Template Render-Smoke — verifies every shipped React-Email template
// can render to HTML in both DE and EN without throwing.
//
// Why this matters: 26 React-Email templates ship with the platform. A
// silent regression in any single template (typo in a JSX prop, broken
// translation lookup, missing required prop) only surfaces when an end
// user actually receives the email — too late for a compliance pipeline.
//
// We rely on @react-email/render to do the actual rendering (used in
// production by EmailService). The test asserts:
//   - render() produces a non-empty string
//   - DE and EN outputs differ (defends against copy/paste regressions)
//   - getSubject() exists and returns a non-empty string for both langs

import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import * as React from "react";

// Templates with their required props and getSubject input. Kept small
// and representative — adding new templates later just appends a row.
import {
  TaskAssigned,
  getSubject as taskAssignedSubject,
} from "../src/templates/TaskAssigned";
import {
  TaskOverdue,
  getSubject as taskOverdueSubject,
} from "../src/templates/TaskOverdue";
import {
  TaskReminder,
  getSubject as taskReminderSubject,
} from "../src/templates/TaskReminder";
import {
  UserInvited,
  getSubject as userInvitedSubject,
} from "../src/templates/UserInvited";
import {
  DataBreach72hWarning,
  getSubject as dataBreachWarningSubject,
} from "../src/templates/DataBreach72hWarning";
import {
  DsrReceived,
  getSubject as dsrReceivedSubject,
} from "../src/templates/DsrReceived";

const taskProps = {
  taskTitle: "Review Q1 ISMS Audit Plan",
  taskDescription: "Review the draft ISO 27001 audit plan for Q1 2026.",
  assigneeName: "Lisa Schneider",
  dueDate: "2026-03-31",
  priority: "high",
  taskUrl: "https://arctos.example.com/tasks/abc-123",
  orgName: "Meridian Holdings",
};

const userInvitedProps = {
  inviteeName: "Sarah Keller",
  inviterName: "Lisa Schneider",
  orgName: "Meridian Holdings",
  role: "control_owner",
  acceptUrl: "https://arctos.example.com/invite/abc",
};

const breachProps = {
  breachTitle: "Suspected unauthorized access — payroll DB",
  breachId: "BR-2026-001",
  detectedAt: "2026-05-08T14:00:00Z",
  hoursRemaining: 12,
  detailsUrl: "https://arctos.example.com/dpms/breaches/BR-2026-001",
  orgName: "Meridian Holdings",
};

const dsrProps = {
  dsrId: "DSR-2026-042",
  requestType: "access",
  subjectName: "Max Mustermann",
  receivedAt: "2026-05-09",
  deadlineDate: "2026-06-08",
  detailsUrl: "https://arctos.example.com/dpms/dsr/DSR-2026-042",
  orgName: "Meridian Holdings",
};

const cases: Array<{
  name: string;
  Component: React.FC<any>;
  props: Record<string, unknown>;
  getSubject: (data: Record<string, unknown>, lang: "de" | "en") => string;
  subjectData: Record<string, unknown>;
}> = [
  {
    name: "TaskAssigned",
    Component: TaskAssigned,
    props: taskProps,
    getSubject: taskAssignedSubject,
    subjectData: taskProps,
  },
  {
    name: "TaskOverdue",
    Component: TaskOverdue,
    props: taskProps,
    getSubject: taskOverdueSubject,
    subjectData: taskProps,
  },
  {
    name: "TaskReminder",
    Component: TaskReminder,
    props: taskProps,
    getSubject: taskReminderSubject,
    subjectData: taskProps,
  },
  {
    name: "UserInvited",
    Component: UserInvited,
    props: userInvitedProps,
    getSubject: userInvitedSubject,
    subjectData: userInvitedProps,
  },
  {
    name: "DataBreach72hWarning",
    Component: DataBreach72hWarning,
    props: breachProps,
    getSubject: dataBreachWarningSubject,
    subjectData: breachProps,
  },
  {
    name: "DsrReceived",
    Component: DsrReceived,
    props: dsrProps,
    getSubject: dsrReceivedSubject,
    subjectData: dsrProps,
  },
];

describe("Email template render-smoke", () => {
  for (const c of cases) {
    describe(c.name, () => {
      it("renders DE to non-empty HTML", async () => {
        const el = React.createElement(c.Component, { ...c.props, lang: "de" });
        const html = await render(el);
        expect(html.length).toBeGreaterThan(100);
        expect(html).toContain("<html");
      });

      it("renders EN to non-empty HTML", async () => {
        const el = React.createElement(c.Component, { ...c.props, lang: "en" });
        const html = await render(el);
        expect(html.length).toBeGreaterThan(100);
        expect(html).toContain("<html");
      });

      it("DE and EN outputs differ (no copy-paste regression)", async () => {
        const de = await render(
          React.createElement(c.Component, { ...c.props, lang: "de" }),
        );
        const en = await render(
          React.createElement(c.Component, { ...c.props, lang: "en" }),
        );
        expect(de).not.toBe(en);
      });

      it("getSubject returns non-empty string for DE", () => {
        const subject = c.getSubject(c.subjectData, "de");
        expect(typeof subject).toBe("string");
        expect(subject.length).toBeGreaterThan(0);
      });

      it("getSubject returns non-empty string for EN", () => {
        const subject = c.getSubject(c.subjectData, "en");
        expect(typeof subject).toBe("string");
        expect(subject.length).toBeGreaterThan(0);
      });

      it("DE and EN subjects differ (translation present)", () => {
        const de = c.getSubject(c.subjectData, "de");
        const en = c.getSubject(c.subjectData, "en");
        expect(de).not.toBe(en);
      });
    });
  }
});

// [Welle 4b, Strang 6 · OP-065] `UserInvited` und die Prototypenkette.
//
// `roleLabels[lang][roleName]` schlug die Rollenbezeichnung mit einer
// Zeichenkette aus dem Aufrufer in einem `Record<string, string>` nach.
// Gemessen am 2026-09-03 gegen 01d0e4cc: für `roleName = "constructor"` kam
// der Object-Konstruktor zurück, also eine FUNKTION. `|| roleName` greift
// darauf nicht — eine Funktion ist wahr —, und React lehnt eine Funktion als
// Kind mit „Functions are not valid as a React child" ab. Aus einer
// unbekannten Rolle wurde damit keine unbekannte Rolle, sondern eine
// unbrauchbare E-Mail.
describe("UserInvited — Rollenbezeichnung", () => {
  const props = {
    lang: "de" as const,
    orgName: "ACME GmbH",
    inviterName: "Ada Lovelace",
    acceptUrl: "https://example.org/invite/abc",
  };

  it("übersetzt eine bekannte Rolle", async () => {
    const html = await render(
      React.createElement(UserInvited, { ...props, roleName: "risk_manager" }),
    );
    expect(html).toContain("Risikomanager");
  });

  it.each(["constructor", "toString", "valueOf", "hasOwnProperty"])(
    "zeigt für den Prototyp-Schlüssel %s den Rohwert, nicht eine Funktion",
    async (roleName) => {
      const html = await render(
        React.createElement(UserInvited, { ...props, roleName }),
      );
      expect(html).not.toContain("native code");
      expect(html).toContain(roleName);
    },
  );

  it("zeigt eine unbekannte Rolle unverändert an", async () => {
    const html = await render(
      React.createElement(UserInvited, {
        ...props,
        roleName: "erfundene_rolle",
      }),
    );
    expect(html).toContain("erfundene_rolle");
  });
});
