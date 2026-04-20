import { describe, it, expect } from "vitest";
import {
  EXERCISE_ALLOWED_TRANSITIONS,
  validateExerciseGate7Execute,
  validateExerciseGate8Close,
  validateExerciseTransition,
  type ExerciseSnapshot,
} from "../src/state-machines/bcms-exercise";

const validSnapshot: ExerciseSnapshot = {
  status: "preparation",
  title: "Tabletop: Ransomware-Attack 2026-Q2",
  exerciseType: "tabletop",
  plannedDate: "2026-06-15",
  exerciseLeadId: "lead-uuid",
  participantIds: ["p1", "p2", "p3"],
  bcpId: "bcp-uuid",
  crisisScenarioId: null,
  objectives: [{ title: "Activation-Time <= 30min", achieved: null }],
  overallResult: null,
  findingsCount: 0,
  lessonsLearnedCount: 0,
};

const evalSnapshot: ExerciseSnapshot = {
  ...validSnapshot,
  status: "evaluation",
  overallResult: "successful",
  findingsCount: 2,
  lessonsLearnedCount: 1,
};

describe("EXERCISE_ALLOWED_TRANSITIONS", () => {
  it("planned -> preparation", () => {
    expect(EXERCISE_ALLOWED_TRANSITIONS.planned).toContain("preparation");
  });
  it("executing -> evaluation (not direct -> completed)", () => {
    expect(EXERCISE_ALLOWED_TRANSITIONS.executing).toContain("evaluation");
    expect(EXERCISE_ALLOWED_TRANSITIONS.executing).not.toContain("completed");
  });
  it("completed terminal", () => {
    expect(EXERCISE_ALLOWED_TRANSITIONS.completed).toEqual([]);
  });
});

describe("validateExerciseGate7Execute", () => {
  it("passes with valid snapshot", () => {
    const blockers = validateExerciseGate7Execute(validSnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks if participants < 2", () => {
    const blockers = validateExerciseGate7Execute({
      ...validSnapshot,
      participantIds: ["solo"],
    });
    expect(blockers.some((b) => b.code === "too_few_participants")).toBe(true);
  });
  it("blocks if no BCP and no scenario", () => {
    const blockers = validateExerciseGate7Execute({
      ...validSnapshot,
      bcpId: null,
      crisisScenarioId: null,
    });
    expect(blockers.some((b) => b.code === "no_context")).toBe(true);
  });
  it("blocks if no objectives", () => {
    const blockers = validateExerciseGate7Execute({
      ...validSnapshot,
      objectives: [],
    });
    expect(blockers.some((b) => b.code === "missing_objectives")).toBe(true);
  });
  it("blocks if no lead", () => {
    const blockers = validateExerciseGate7Execute({
      ...validSnapshot,
      exerciseLeadId: null,
    });
    expect(blockers.some((b) => b.code === "missing_lead")).toBe(true);
  });
});

describe("validateExerciseGate8Close", () => {
  it("passes with result + lesson", () => {
    const blockers = validateExerciseGate8Close(evalSnapshot);
    expect(blockers.filter((b) => b.severity === "error")).toHaveLength(0);
  });
  it("blocks if no overallResult", () => {
    const blockers = validateExerciseGate8Close({
      ...evalSnapshot,
      overallResult: null,
    });
    expect(blockers.some((b) => b.code === "missing_overall_result")).toBe(
      true,
    );
  });
  it("blocks if no lessons learned", () => {
    const blockers = validateExerciseGate8Close({
      ...evalSnapshot,
      lessonsLearnedCount: 0,
    });
    expect(blockers.some((b) => b.code === "no_lessons_learned")).toBe(true);
  });
  it("warns if no findings", () => {
    const blockers = validateExerciseGate8Close({
      ...evalSnapshot,
      findingsCount: 0,
    });
    const warn = blockers.find((b) => b.code === "no_findings");
    expect(warn?.severity).toBe("warning");
  });
});

describe("validateExerciseTransition", () => {
  it("blocks planned -> executing (muss ueber preparation)", () => {
    const result = validateExerciseTransition({
      currentStatus: "planned",
      targetStatus: "executing",
      snapshot: validSnapshot,
    });
    expect(result.allowed).toBe(false);
  });
  it("allows planned -> preparation", () => {
    const result = validateExerciseTransition({
      currentStatus: "planned",
      targetStatus: "preparation",
      snapshot: validSnapshot,
    });
    expect(result.allowed).toBe(true);
  });
  it("runs B7 on preparation -> executing", () => {
    const result = validateExerciseTransition({
      currentStatus: "preparation",
      targetStatus: "executing",
      snapshot: { ...validSnapshot, participantIds: ["solo"] },
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers.some((b) => b.gate === "B7")).toBe(true);
  });
  it("runs B8 on evaluation -> completed", () => {
    const result = validateExerciseTransition({
      currentStatus: "evaluation",
      targetStatus: "completed",
      snapshot: { ...evalSnapshot, lessonsLearnedCount: 0 },
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers.some((b) => b.gate === "B8")).toBe(true);
  });
  it("allows evaluation -> completed when B8 passes", () => {
    const result = validateExerciseTransition({
      currentStatus: "evaluation",
      targetStatus: "completed",
      snapshot: evalSnapshot,
    });
    expect(result.allowed).toBe(true);
  });
});
