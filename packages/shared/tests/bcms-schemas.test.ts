// Unit tests for Sprint 6 Business Continuity Management System (BCMS) Zod schemas
// Tests BIA, BCP, Crisis Scenario, BC Exercise schemas and status transitions

import { describe, it, expect } from "vitest";
import {
  createBiaAssessmentSchema,
  submitBiaProcessImpactSchema,
  createBcpSchema,
  createCrisisScenarioSchema,
  createBcExerciseSchema,
  biaStatusTransitions,
  bcpStatusTransitions,
  bcpStatusTransitionSchema,
} from "../src/schemas";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

// ---------------------------------------------------------------------------
// createBiaAssessmentSchema
// ---------------------------------------------------------------------------

describe("createBiaAssessmentSchema", () => {
  it("accepts valid BIA with required fields", () => {
    const result = createBiaAssessmentSchema.safeParse({
      name: "2026 Business Impact Analysis",
    });
    expect(result.success).toBe(true);
  });

  it("accepts BIA with all optional fields", () => {
    const result = createBiaAssessmentSchema.safeParse({
      name: "Annual BIA",
      description: "Comprehensive BIA for all business units",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      leadAssessorId: UUID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createBiaAssessmentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createBiaAssessmentSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 500 characters", () => {
    const result = createBiaAssessmentSchema.safeParse({
      name: "B".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format for periodStart", () => {
    const result = createBiaAssessmentSchema.safeParse({
      name: "BIA",
      periodStart: "01-01-2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format for periodEnd", () => {
    const result = createBiaAssessmentSchema.safeParse({
      name: "BIA",
      periodEnd: "2026/12/31",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid YYYY-MM-DD date format", () => {
    const result = createBiaAssessmentSchema.safeParse({
      name: "BIA",
      periodStart: "2026-06-01",
      periodEnd: "2026-12-31",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID leadAssessorId", () => {
    const result = createBiaAssessmentSchema.safeParse({
      name: "BIA",
      leadAssessorId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// submitBiaProcessImpactSchema — RTO <= MTPD critical
// ---------------------------------------------------------------------------

describe("submitBiaProcessImpactSchema", () => {
  it("accepts valid process impact with RTO <= MTPD", () => {
    const result = submitBiaProcessImpactSchema.safeParse({
      processId: UUID,
      mtpdHours: 24,
      rtoHours: 8,
    });
    expect(result.success).toBe(true);
  });

  it("accepts RTO equal to MTPD", () => {
    const result = submitBiaProcessImpactSchema.safeParse({
      processId: UUID,
      mtpdHours: 12,
      rtoHours: 12,
    });
    expect(result.success).toBe(true);
  });

  it("rejects RTO greater than MTPD", () => {
    const result = submitBiaProcessImpactSchema.safeParse({
      processId: UUID,
      mtpdHours: 8,
      rtoHours: 24,
    });
    expect(result.success).toBe(false);
  });

  it("accepts when only MTPD is provided (no RTO)", () => {
    const result = submitBiaProcessImpactSchema.safeParse({
      processId: UUID,
      mtpdHours: 24,
    });
    expect(result.success).toBe(true);
  });

  it("accepts when only RTO is provided (no MTPD)", () => {
    const result = submitBiaProcessImpactSchema.safeParse({
      processId: UUID,
      rtoHours: 8,
    });
    expect(result.success).toBe(true);
  });

  it("accepts when neither RTO nor MTPD are provided", () => {
    const result = submitBiaProcessImpactSchema.safeParse({
      processId: UUID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing processId", () => {
    const result = submitBiaProcessImpactSchema.safeParse({
      mtpdHours: 24,
      rtoHours: 8,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative mtpdHours", () => {
    const result = submitBiaProcessImpactSchema.safeParse({
      processId: UUID,
      mtpdHours: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative rtoHours", () => {
    const result = submitBiaProcessImpactSchema.safeParse({
      processId: UUID,
      rtoHours: -4,
    });
    expect(result.success).toBe(false);
  });

  it("accepts impact rating scores within 1-5 range", () => {
    const result = submitBiaProcessImpactSchema.safeParse({
      processId: UUID,
      impactReputation: 3,
      impactLegal: 1,
      impactOperational: 5,
      impactFinancial: 2,
      impactSafety: 4,
    });
    expect(result.success).toBe(true);
  });

  it("rejects impact rating below 1", () => {
    const result = submitBiaProcessImpactSchema.safeParse({
      processId: UUID,
      impactReputation: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects impact rating above 5", () => {
    const result = submitBiaProcessImpactSchema.safeParse({
      processId: UUID,
      impactFinancial: 6,
    });
    expect(result.success).toBe(false);
  });

  it("applies default isEssential to false", () => {
    const result = submitBiaProcessImpactSchema.safeParse({
      processId: UUID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isEssential).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// BIA Status Transitions
// ---------------------------------------------------------------------------

describe("biaStatusTransitions", () => {
  it("allows draft -> in_progress", () => {
    expect(biaStatusTransitions["draft"]).toContain("in_progress");
  });

  it("allows in_progress -> review", () => {
    expect(biaStatusTransitions["in_progress"]).toContain("review");
  });

  it("allows review -> approved", () => {
    expect(biaStatusTransitions["review"]).toContain("approved");
  });

  it("allows review -> in_progress (send back)", () => {
    expect(biaStatusTransitions["review"]).toContain("in_progress");
  });

  it("allows approved -> archived", () => {
    expect(biaStatusTransitions["approved"]).toContain("archived");
  });

  it("does not allow archived to transition", () => {
    expect(biaStatusTransitions["archived"]).toEqual([]);
  });

  it("does not allow draft -> review directly", () => {
    expect(biaStatusTransitions["draft"]).not.toContain("review");
  });
});

// ---------------------------------------------------------------------------
// createBcpSchema
// ---------------------------------------------------------------------------

describe("createBcpSchema", () => {
  it("accepts valid BCP with required fields", () => {
    const result = createBcpSchema.safeParse({
      title: "IT Disaster Recovery Plan",
    });
    expect(result.success).toBe(true);
  });

  it("accepts BCP with all optional fields", () => {
    const result = createBcpSchema.safeParse({
      title: "Pandemic Response Plan",
      description: "Plan for maintaining operations during pandemic",
      scope: "All office-based operations",
      processIds: [UUID],
      bcManagerId: UUID,
      activationCriteria: "When >30% staff affected",
      activationAuthority: "Crisis Manager",
    });
    expect(result.success).toBe(true);
  });

  it("applies default processIds to empty array", () => {
    const result = createBcpSchema.safeParse({ title: "BCP" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.processIds).toEqual([]);
    }
  });

  it("rejects missing title", () => {
    const result = createBcpSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = createBcpSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID in processIds array", () => {
    const result = createBcpSchema.safeParse({
      title: "BCP",
      processIds: ["not-a-uuid"],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BCP Status Transitions
// ---------------------------------------------------------------------------

describe("bcpStatusTransitions", () => {
  it("allows draft -> in_review", () => {
    expect(bcpStatusTransitions["draft"]).toContain("in_review");
  });

  it("allows in_review -> approved", () => {
    expect(bcpStatusTransitions["in_review"]).toContain("approved");
  });

  it("allows approved -> published", () => {
    expect(bcpStatusTransitions["approved"]).toContain("published");
  });

  it("allows published -> archived", () => {
    expect(bcpStatusTransitions["published"]).toContain("archived");
  });

  it("allows published -> superseded", () => {
    expect(bcpStatusTransitions["published"]).toContain("superseded");
  });

  it("does not allow archived to transition", () => {
    expect(bcpStatusTransitions["archived"]).toEqual([]);
  });

  it("does not allow superseded to transition", () => {
    expect(bcpStatusTransitions["superseded"]).toEqual([]);
  });

  it("does not allow draft -> published directly", () => {
    expect(bcpStatusTransitions["draft"]).not.toContain("published");
  });
});

describe("bcpStatusTransitionSchema", () => {
  it("accepts all valid BCP statuses", () => {
    for (const s of [
      "draft",
      "in_review",
      "approved",
      "published",
      "archived",
      "superseded",
    ]) {
      const result = bcpStatusTransitionSchema.safeParse({ status: s });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid BCP status", () => {
    const result = bcpStatusTransitionSchema.safeParse({ status: "active" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createCrisisScenarioSchema
// ---------------------------------------------------------------------------

describe("createCrisisScenarioSchema", () => {
  it("accepts valid crisis scenario with required fields", () => {
    const result = createCrisisScenarioSchema.safeParse({
      name: "Ransomware Attack",
      category: "cyber_attack",
    });
    expect(result.success).toBe(true);
  });

  it("applies default severity", () => {
    const result = createCrisisScenarioSchema.safeParse({
      name: "Fire in Server Room",
      category: "fire",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.severity).toBe("level_2_emergency");
    }
  });

  it("accepts all valid crisis categories", () => {
    const cats = [
      "cyber_attack",
      "fire",
      "pandemic",
      "supply_chain",
      "natural_disaster",
      "it_outage",
      "other",
    ];
    for (const category of cats) {
      const result = createCrisisScenarioSchema.safeParse({
        name: "Test",
        category,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid crisis category", () => {
    const result = createCrisisScenarioSchema.safeParse({
      name: "Test",
      category: "terrorism",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid severity levels", () => {
    for (const severity of [
      "level_1_incident",
      "level_2_emergency",
      "level_3_crisis",
      "level_4_catastrophe",
    ]) {
      const result = createCrisisScenarioSchema.safeParse({
        name: "Test",
        category: "other",
        severity,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects missing name", () => {
    const result = createCrisisScenarioSchema.safeParse({
      category: "fire",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing category", () => {
    const result = createCrisisScenarioSchema.safeParse({
      name: "Scenario",
    });
    expect(result.success).toBe(false);
  });

  it("accepts scenario with escalation matrix", () => {
    const result = createCrisisScenarioSchema.safeParse({
      name: "Multi-level crisis",
      category: "cyber_attack",
      escalationMatrix: [
        {
          level: 1,
          triggerCriteria: "Single system affected",
          notifyRoles: ["it_admin"],
          autoNotify: true,
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createBcExerciseSchema
// ---------------------------------------------------------------------------

describe("createBcExerciseSchema", () => {
  it("accepts valid exercise with required fields", () => {
    const result = createBcExerciseSchema.safeParse({
      title: "Tabletop Exercise Q1",
      exerciseType: "tabletop",
      plannedDate: "2026-04-15",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid exercise types", () => {
    for (const et of [
      "tabletop",
      "walkthrough",
      "functional",
      "full_simulation",
    ]) {
      const result = createBcExerciseSchema.safeParse({
        title: "Exercise",
        exerciseType: et,
        plannedDate: "2026-06-01",
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid exercise type", () => {
    const result = createBcExerciseSchema.safeParse({
      title: "Exercise",
      exerciseType: "fire_drill",
      plannedDate: "2026-06-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format for plannedDate", () => {
    const result = createBcExerciseSchema.safeParse({
      title: "Exercise",
      exerciseType: "tabletop",
      plannedDate: "15-04-2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", () => {
    const result = createBcExerciseSchema.safeParse({
      exerciseType: "tabletop",
      plannedDate: "2026-06-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing exerciseType", () => {
    const result = createBcExerciseSchema.safeParse({
      title: "Exercise",
      plannedDate: "2026-06-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing plannedDate", () => {
    const result = createBcExerciseSchema.safeParse({
      title: "Exercise",
      exerciseType: "tabletop",
    });
    expect(result.success).toBe(false);
  });

  it("applies default participantIds and objectives", () => {
    const result = createBcExerciseSchema.safeParse({
      title: "Exercise",
      exerciseType: "walkthrough",
      plannedDate: "2026-07-01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.participantIds).toEqual([]);
      expect(result.data.objectives).toEqual([]);
    }
  });

  it("accepts exercise with objectives array", () => {
    const result = createBcExerciseSchema.safeParse({
      title: "Full Simulation",
      exerciseType: "full_simulation",
      plannedDate: "2026-09-01",
      objectives: [
        { title: "Test RTO compliance", met: false },
        {
          title: "Validate communication plan",
          met: false,
          notes: "Focus on email chain",
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
