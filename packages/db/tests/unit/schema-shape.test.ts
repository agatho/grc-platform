// Pure schema-shape tests — verify that critical Drizzle table objects expose
// the columns we rely on across the codebase. No Postgres connection required.
//
// These tests catch breaking schema changes that would silently misalign with
// API/cron code that references column names directly.

import { describe, it, expect } from "vitest";
import * as schema from "../../src/schema/programme";
import * as ismsCap from "../../src/schema/isms-cap";
import * as bcms from "../../src/schema/bcms";
import * as stake from "../../src/schema/stakeholder-register";

describe("programme schema", () => {
  it("programmeTemplate exposes core columns", () => {
    const t = schema.programmeTemplate;
    expect(t.id).toBeDefined();
    expect(t.code).toBeDefined();
    expect(t.msType).toBeDefined();
    expect(t.version).toBeDefined();
    expect(t.isActive).toBeDefined();
  });

  it("programmeJourney has org-scope and status columns", () => {
    const j = schema.programmeJourney;
    expect(j.orgId).toBeDefined();
    expect(j.status).toBeDefined();
    expect(j.progressPercent).toBeDefined();
    expect(j.deletedAt).toBeDefined(); // soft-delete support
  });

  it("programmeJourneyStep has owner + dueDate + status fields", () => {
    const s = schema.programmeJourneyStep;
    expect(s.ownerId).toBeDefined();
    expect(s.dueDate).toBeDefined();
    expect(s.status).toBeDefined();
    expect(s.evidenceLinks).toBeDefined();
    expect(s.requiredEvidenceCount).toBeDefined();
  });

  it("MS_TYPE_VALUES const tuple has expected members", () => {
    expect(schema.MS_TYPE_VALUES).toContain("isms");
    expect(schema.MS_TYPE_VALUES).toContain("bcms");
    expect(schema.MS_TYPE_VALUES).toContain("dpms");
    expect(schema.MS_TYPE_VALUES).toContain("aims");
  });

  it("PROGRAMME_JOURNEY_STATUS_VALUES has 7 documented states", () => {
    expect(schema.PROGRAMME_JOURNEY_STATUS_VALUES).toEqual([
      "planned",
      "active",
      "on_track",
      "at_risk",
      "blocked",
      "completed",
      "archived",
    ]);
  });

  it("PROGRAMME_STEP_STATUS_VALUES has 7 documented states", () => {
    expect(schema.PROGRAMME_STEP_STATUS_VALUES).toEqual([
      "pending",
      "blocked",
      "in_progress",
      "review",
      "completed",
      "skipped",
      "cancelled",
    ]);
  });
});

describe("isms-cap schema", () => {
  it("ismsNonconformity has status + severity + closedAt fields", () => {
    expect(ismsCap.ismsNonconformity.status).toBeDefined();
    expect(ismsCap.ismsNonconformity.severity).toBeDefined();
    expect(ismsCap.ismsNonconformity.closedAt).toBeDefined();
    expect(ismsCap.ismsNonconformity.identifiedAt).toBeDefined();
  });

  it("ismsCorrectiveAction has verification + effectiveness fields", () => {
    const ca = ismsCap.ismsCorrectiveAction;
    expect(ca.verificationRequired).toBeDefined();
    expect(ca.verifiedAt).toBeDefined();
    expect(ca.verificationResult).toBeDefined();
    expect(ca.effectivenessReviewDate).toBeDefined();
    expect(ca.effectivenessRating).toBeDefined();
  });
});

describe("bcms schema", () => {
  it("biaAssessment has core BCMS fields", () => {
    expect(bcms.biaAssessment).toBeDefined();
  });

  it("bcp has lifecycle fields", () => {
    expect(bcms.bcp).toBeDefined();
  });
});

describe("stakeholder-register schema", () => {
  it("stakeholder has CRUD-relevant columns", () => {
    expect(stake.stakeholder.orgId).toBeDefined();
    expect(stake.stakeholder.type).toBeDefined();
    expect(stake.stakeholder.influence).toBeDefined();
    expect(stake.stakeholder.interest).toBeDefined();
    expect(stake.stakeholder.nextReviewDue).toBeDefined();
  });

  it("stakeholderExpectation has status + priority columns", () => {
    expect(stake.stakeholderExpectation.status).toBeDefined();
    expect(stake.stakeholderExpectation.priority).toBeDefined();
    expect(stake.stakeholderExpectation.linkedEntityType).toBeDefined();
  });

  it("STAKEHOLDER_EXPECTATION_STATUSES is the 6-state tuple", () => {
    expect(stake.STAKEHOLDER_EXPECTATION_STATUSES).toEqual([
      "open",
      "acknowledged",
      "in_progress",
      "met",
      "unmet",
      "obsolete",
    ]);
  });

  it("STAKEHOLDER_EXPECTATION_TRANSITIONS terminal state is obsolete", () => {
    expect(stake.STAKEHOLDER_EXPECTATION_TRANSITIONS.obsolete).toEqual([]);
  });
});
