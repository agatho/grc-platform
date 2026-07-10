// Unit tests for the Process-Portal role resolution (pure function).
//
// The function decides which badges (owner / R / A / C / I) a user gets
// on a published process, based on ownership, step RACI custom-role ids
// and RACI overrides (participant_bpmn_id = custom_role id, B3.1).

import { describe, it, expect } from "vitest";
import {
  resolveMyProcessRoles,
  type ProcessRoleFacts,
} from "../../lib/process-portal-roles";

const BASE: ProcessRoleFacts = {
  userId: "user-1",
  processOwnerId: null,
  userCustomRoleIds: [],
  stepRaci: [],
  raciOverrides: [],
};

describe("resolveMyProcessRoles", () => {
  it("returns empty when the user has no relation to the process", () => {
    expect(resolveMyProcessRoles(BASE)).toEqual([]);
  });

  it("resolves ownership via process_owner_id", () => {
    expect(
      resolveMyProcessRoles({ ...BASE, processOwnerId: "user-1" }),
    ).toEqual(["owner"]);
  });

  it("does not resolve ownership for a different owner", () => {
    expect(
      resolveMyProcessRoles({ ...BASE, processOwnerId: "user-2" }),
    ).toEqual([]);
  });

  it("resolves R from step raci_responsible_role_id via the user's custom roles", () => {
    expect(
      resolveMyProcessRoles({
        ...BASE,
        userCustomRoleIds: ["role-a"],
        stepRaci: [
          { raciResponsibleRoleId: "role-a", raciAccountableRoleId: null },
        ],
      }),
    ).toEqual(["R"]);
  });

  it("resolves A from step raci_accountable_role_id", () => {
    expect(
      resolveMyProcessRoles({
        ...BASE,
        userCustomRoleIds: ["role-a"],
        stepRaci: [
          { raciResponsibleRoleId: "role-b", raciAccountableRoleId: "role-a" },
        ],
      }),
    ).toEqual(["A"]);
  });

  it("ignores step RACI of roles the user does not hold", () => {
    expect(
      resolveMyProcessRoles({
        ...BASE,
        userCustomRoleIds: ["role-x"],
        stepRaci: [
          { raciResponsibleRoleId: "role-a", raciAccountableRoleId: "role-b" },
        ],
      }),
    ).toEqual([]);
  });

  it("resolves C and I from overrides (participantBpmnId = custom role id)", () => {
    expect(
      resolveMyProcessRoles({
        ...BASE,
        userCustomRoleIds: ["role-a", "role-b"],
        raciOverrides: [
          { participantBpmnId: "role-a", raciRole: "C" },
          { participantBpmnId: "role-b", raciRole: "i" }, // case-insensitive
          { participantBpmnId: "role-other", raciRole: "R" }, // not my role
        ],
      }),
    ).toEqual(["C", "I"]);
  });

  it("ignores override entries with invalid RACI letters", () => {
    expect(
      resolveMyProcessRoles({
        ...BASE,
        userCustomRoleIds: ["role-a"],
        raciOverrides: [{ participantBpmnId: "role-a", raciRole: "X" }],
      }),
    ).toEqual([]);
  });

  it("skips step/override matching entirely without custom roles", () => {
    expect(
      resolveMyProcessRoles({
        ...BASE,
        userCustomRoleIds: [],
        stepRaci: [
          { raciResponsibleRoleId: "role-a", raciAccountableRoleId: null },
        ],
        raciOverrides: [{ participantBpmnId: "role-a", raciRole: "R" }],
      }),
    ).toEqual([]);
  });

  it("deduplicates and orders badges owner → A → R → C → I", () => {
    expect(
      resolveMyProcessRoles({
        userId: "user-1",
        processOwnerId: "user-1",
        userCustomRoleIds: ["role-a", "role-b"],
        stepRaci: [
          { raciResponsibleRoleId: "role-a", raciAccountableRoleId: "role-b" },
          { raciResponsibleRoleId: "role-a", raciAccountableRoleId: null },
        ],
        raciOverrides: [
          { participantBpmnId: "role-a", raciRole: "I" },
          { participantBpmnId: "role-b", raciRole: "R" },
        ],
      }),
    ).toEqual(["owner", "A", "R", "I"]);
  });
});
