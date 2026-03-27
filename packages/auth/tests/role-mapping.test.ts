// Sprint 20: Group-to-Role Mapping Unit Tests
import { describe, it, expect } from "vitest";
import { resolveRole, groupRoleMappingToEntries } from "../src/role-mapping";

describe("GroupRoleMapping", () => {
  const mappings = [
    { idpGroup: "GRC-Admins", role: "admin" },
    { idpGroup: "Risk-Team", role: "risk_manager" },
    { idpGroup: "Auditors", role: "auditor" },
    { idpGroup: "Viewers", role: "viewer" },
  ];

  it("should map IdP group to ARCTOS role", () => {
    expect(resolveRole(["GRC-Admins", "Engineering"], mappings)).toBe("admin");
    expect(resolveRole(["Risk-Team"], mappings)).toBe("risk_manager");
    expect(resolveRole(["Auditors"], mappings)).toBe("auditor");
  });

  it("should use default role when no group matches", () => {
    expect(resolveRole(["Engineering"], mappings, "viewer")).toBe("viewer");
    expect(resolveRole(["Unknown-Group"], mappings, "process_owner")).toBe("process_owner");
  });

  it("should use default role when no mappings provided", () => {
    expect(resolveRole(["GRC-Admins"], [], "viewer")).toBe("viewer");
  });

  it("should use default role when no groups provided", () => {
    expect(resolveRole([], mappings, "viewer")).toBe("viewer");
  });

  it("should use highest-privilege role when multiple groups match", () => {
    expect(resolveRole(["GRC-Admins", "Viewers"], mappings)).toBe("admin");
    expect(resolveRole(["Viewers", "Risk-Team"], mappings)).toBe("risk_manager");
    expect(resolveRole(["Auditors", "Viewers"], mappings)).toBe("auditor");
  });

  it("should default to viewer when defaultRole not specified", () => {
    expect(resolveRole(["Engineering"], mappings)).toBe("viewer");
  });
});

describe("groupRoleMappingToEntries", () => {
  it("should convert object to array of entries", () => {
    const mapping = {
      "GRC-Admins": "admin",
      "Risk-Team": "risk_manager",
    };
    const entries = groupRoleMappingToEntries(mapping);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ idpGroup: "GRC-Admins", role: "admin" });
    expect(entries[1]).toEqual({ idpGroup: "Risk-Team", role: "risk_manager" });
  });

  it("should handle empty object", () => {
    expect(groupRoleMappingToEntries({})).toEqual([]);
  });
});
