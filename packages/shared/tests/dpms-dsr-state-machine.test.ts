import { describe, it, expect } from "vitest";
import {
  DSR_ALLOWED_TRANSITIONS,
  validateDsrGate6Verify,
  validateDsrGate7Response,
  validateDsrGate8Close,
  validateDsrTransition,
  computeDsrDeadline,
  type DsrSnapshot,
} from "../src/state-machines/dpms-dsr";

const verifySnapshot: DsrSnapshot = {
  status: "received",
  requestType: "access",
  subjectName: "Max Mustermann",
  subjectEmail: "max@example.com",
  receivedAt: new Date(),
  deadline: new Date(),
  verifiedAt: null,
  respondedAt: null,
  closedAt: null,
  handlerId: null,
  responseArtifactsCount: 0,
  identityVerificationDocumented: true,
  article19NotificationsSent: false,
  extensionApplied: false,
};

const responseSnapshot: DsrSnapshot = {
  ...verifySnapshot,
  status: "processing",
  handlerId: "handler-uuid",
  responseArtifactsCount: 1,
  verifiedAt: new Date(),
};

const closeSnapshot: DsrSnapshot = {
  ...responseSnapshot,
  status: "response_sent",
  respondedAt: new Date(),
};

describe("DSR_ALLOWED_TRANSITIONS", () => {
  it("received -> verified + rejected", () => {
    expect(DSR_ALLOWED_TRANSITIONS.received).toEqual(["verified", "rejected"]);
  });
  it("closed terminal", () => {
    expect(DSR_ALLOWED_TRANSITIONS.closed).toEqual([]);
  });
});

describe("validateDsrGate6Verify", () => {
  it("passes with verified identity", () => {
    const blockers = validateDsrGate6Verify(verifySnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks without identity", () => {
    const blockers = validateDsrGate6Verify({
      ...verifySnapshot,
      subjectName: null,
      subjectEmail: null,
    });
    expect(blockers.some((b) => b.code === "missing_subject_identity")).toBe(
      true,
    );
  });
  it("blocks without verification documented", () => {
    const blockers = validateDsrGate6Verify({
      ...verifySnapshot,
      identityVerificationDocumented: false,
    });
    expect(blockers.some((b) => b.code === "identity_not_verified")).toBe(true);
  });
});

describe("validateDsrGate7Response", () => {
  it("passes with handler + artifacts for access", () => {
    const blockers = validateDsrGate7Response(responseSnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks without handler", () => {
    const blockers = validateDsrGate7Response({
      ...responseSnapshot,
      handlerId: null,
    });
    expect(blockers.some((b) => b.code === "missing_handler")).toBe(true);
  });
  it("blocks access type without artifacts", () => {
    const blockers = validateDsrGate7Response({
      ...responseSnapshot,
      requestType: "access",
      responseArtifactsCount: 0,
    });
    expect(blockers.some((b) => b.code === "missing_response_artifacts")).toBe(
      true,
    );
  });
  it("allows erasure without artifacts (different flow)", () => {
    const blockers = validateDsrGate7Response({
      ...responseSnapshot,
      requestType: "erasure",
      responseArtifactsCount: 0,
    });
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
});

describe("validateDsrGate8Close", () => {
  it("passes within 30d", () => {
    const received = new Date();
    received.setDate(received.getDate() - 10);
    const blockers = validateDsrGate8Close({
      ...closeSnapshot,
      receivedAt: received,
      respondedAt: new Date(),
    });
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });

  it("blocks exceeded deadline without extension", () => {
    const received = new Date();
    received.setDate(received.getDate() - 35);
    const responded = new Date();
    responded.setDate(responded.getDate() - 1);
    const blockers = validateDsrGate8Close({
      ...closeSnapshot,
      receivedAt: received,
      respondedAt: responded,
    });
    expect(
      blockers.some((b) => b.code === "deadline_exceeded_without_extension"),
    ).toBe(true);
  });

  it("hard-blocks > 90 days", () => {
    const received = new Date();
    received.setDate(received.getDate() - 100);
    const blockers = validateDsrGate8Close({
      ...closeSnapshot,
      receivedAt: received,
      respondedAt: new Date(),
      extensionApplied: true,
    });
    expect(blockers.some((b) => b.code === "deadline_hard_exceeded")).toBe(
      true,
    );
  });

  it("warns Art 19 missing for erasure", () => {
    const blockers = validateDsrGate8Close({
      ...closeSnapshot,
      requestType: "erasure",
      article19NotificationsSent: false,
    });
    const warn = blockers.find((b) => b.code === "article_19_missing");
    expect(warn?.severity).toBe("warning");
  });
});

describe("validateDsrTransition", () => {
  it("blocks received -> processing (muss ueber verified)", () => {
    const result = validateDsrTransition({
      currentStatus: "received",
      targetStatus: "processing",
      snapshot: verifySnapshot,
    });
    expect(result.allowed).toBe(false);
  });
  it("allows received -> verified", () => {
    const result = validateDsrTransition({
      currentStatus: "received",
      targetStatus: "verified",
      snapshot: verifySnapshot,
    });
    expect(result.allowed).toBe(true);
  });
});

describe("computeDsrDeadline", () => {
  it("30-day standard + 90-day extended", () => {
    const received = new Date("2026-04-01T00:00:00Z");
    const d = computeDsrDeadline(received, new Date("2026-04-01T12:00:00Z"));
    expect(d.standardDeadline.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(d.extendedDeadline.toISOString()).toBe("2026-06-30T00:00:00.000Z");
  });

  it("green urgency fresh request", () => {
    const received = new Date();
    received.setDate(received.getDate() - 1);
    const d = computeDsrDeadline(received);
    expect(d.urgency).toBe("green");
    expect(d.standardOverdue).toBe(false);
  });

  it("orange urgency approaching deadline", () => {
    const received = new Date();
    received.setDate(received.getDate() - 25);
    const d = computeDsrDeadline(received);
    expect(d.urgency).toMatch(/red|orange/);
  });

  it("red urgency overdue", () => {
    const received = new Date();
    received.setDate(received.getDate() - 40);
    const d = computeDsrDeadline(received);
    expect(d.urgency).toMatch(/red|orange/);
    expect(d.standardOverdue).toBe(true);
  });
});
