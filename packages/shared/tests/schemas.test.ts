// Unit tests for Zod validation schemas (Sprint 1)
// Tests createOrganizationSchema, updateOrganizationSchema, assignRoleSchema,
// createInvitationSchema, inviteUserSchema, acceptInvitationSchema

import { describe, it, expect } from "vitest";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  assignRoleSchema,
  createInvitationSchema,
  inviteUserSchema,
  acceptInvitationSchema,
} from "../src/schemas";

// ---------------------------------------------------------------------------
// createOrganizationSchema
// ---------------------------------------------------------------------------

describe("createOrganizationSchema", () => {
  it("accepts valid data with all fields", () => {
    const result = createOrganizationSchema.safeParse({
      name: "ARCTOS Holding GmbH",
      shortName: "ARC",
      type: "holding",
      country: "DEU",
      isEu: true,
      parentOrgId: "a0b1c2d3-e4f5-6789-abcd-ef0123456789",
      legalForm: "GmbH",
      dpoName: "Max Mustermann",
      dpoEmail: "dpo@arctos.dev",
    });
    expect(result.success).toBe(true);
  });

  it("accepts minimal valid data (only name)", () => {
    const result = createOrganizationSchema.safeParse({ name: "Test Org" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Test Org");
      // Defaults
      expect(result.data.type).toBe("subsidiary");
      expect(result.data.country).toBe("DEU");
      expect(result.data.isEu).toBe(true);
    }
  });

  it("rejects when name is missing", () => {
    const result = createOrganizationSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.flatten().fieldErrors;
      expect(issues.name).toBeDefined();
    }
  });

  it("rejects when name is empty string", () => {
    const result = createOrganizationSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 255 characters", () => {
    const result = createOrganizationSchema.safeParse({
      name: "A".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("accepts name at maximum length (255)", () => {
    const result = createOrganizationSchema.safeParse({
      name: "A".repeat(255),
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid org type", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Test",
      type: "invalid_type",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid org types", () => {
    const validTypes = ["subsidiary", "holding", "joint_venture", "branch"];
    for (const type of validTypes) {
      const result = createOrganizationSchema.safeParse({
        name: "Test",
        type,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects country code that is not exactly 3 characters", () => {
    const tooShort = createOrganizationSchema.safeParse({
      name: "Test",
      country: "DE",
    });
    expect(tooShort.success).toBe(false);

    const tooLong = createOrganizationSchema.safeParse({
      name: "Test",
      country: "DEUT",
    });
    expect(tooLong.success).toBe(false);
  });

  it("accepts valid 3-letter country code", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Test",
      country: "AUT",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid parentOrgId (not UUID)", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Test",
      parentOrgId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid UUID for parentOrgId", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Test",
      parentOrgId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid dpoEmail", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Test",
      dpoEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid dpoEmail", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Test",
      dpoEmail: "dpo@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects shortName exceeding 50 characters", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Test",
      shortName: "A".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it("rejects legalForm exceeding 100 characters", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Test",
      legalForm: "X".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects dpoName exceeding 255 characters", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Test",
      dpoName: "Y".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("accepts isEu as false", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Swiss Sub",
      isEu: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isEu).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// updateOrganizationSchema
// ---------------------------------------------------------------------------

describe("updateOrganizationSchema", () => {
  it("accepts partial data (only name)", () => {
    const result = updateOrganizationSchema.safeParse({ name: "Updated" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (all fields optional)", () => {
    const result = updateOrganizationSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial data with multiple fields", () => {
    const result = updateOrganizationSchema.safeParse({
      name: "New Name",
      type: "holding",
      isEu: false,
    });
    expect(result.success).toBe(true);
  });

  it("still rejects invalid values (e.g. bad type)", () => {
    const result = updateOrganizationSchema.safeParse({
      type: "nonexistent",
    });
    expect(result.success).toBe(false);
  });

  it("still rejects invalid email for dpoEmail", () => {
    const result = updateOrganizationSchema.safeParse({
      dpoEmail: "bad-email",
    });
    expect(result.success).toBe(false);
  });

  it("allows name to be omitted (unlike create)", () => {
    const result = updateOrganizationSchema.safeParse({
      shortName: "ABC",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// assignRoleSchema
// ---------------------------------------------------------------------------

describe("assignRoleSchema", () => {
  it("accepts valid role without lineOfDefense", () => {
    const result = assignRoleSchema.safeParse({ role: "admin" });
    expect(result.success).toBe(true);
  });

  it("accepts valid role with lineOfDefense", () => {
    const result = assignRoleSchema.safeParse({
      role: "auditor",
      lineOfDefense: "third",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid roles", () => {
    const validRoles = [
      "admin",
      "risk_manager",
      "control_owner",
      "auditor",
      "dpo",
      "viewer",
      "process_owner",
    ];
    for (const role of validRoles) {
      const result = assignRoleSchema.safeParse({ role });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all valid lines of defense", () => {
    const validLines = ["first", "second", "third"];
    for (const lineOfDefense of validLines) {
      const result = assignRoleSchema.safeParse({
        role: "admin",
        lineOfDefense,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid role", () => {
    const result = assignRoleSchema.safeParse({ role: "superadmin" });
    expect(result.success).toBe(false);
  });

  it("rejects missing role", () => {
    const result = assignRoleSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid lineOfDefense", () => {
    const result = assignRoleSchema.safeParse({
      role: "admin",
      lineOfDefense: "fourth",
    });
    expect(result.success).toBe(false);
  });

  it("rejects numeric role", () => {
    const result = assignRoleSchema.safeParse({ role: 123 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createInvitationSchema
// ---------------------------------------------------------------------------

describe("createInvitationSchema", () => {
  it("accepts valid email and role", () => {
    const result = createInvitationSchema.safeParse({
      email: "new.user@company.com",
      role: "viewer",
    });
    expect(result.success).toBe(true);
  });

  it("accepts email, role, and lineOfDefense", () => {
    const result = createInvitationSchema.safeParse({
      email: "auditor@company.com",
      role: "auditor",
      lineOfDefense: "third",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lineOfDefense).toBe("third");
    }
  });

  it("rejects invalid email", () => {
    const result = createInvitationSchema.safeParse({
      email: "not-an-email",
      role: "viewer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = createInvitationSchema.safeParse({
      email: "",
      role: "viewer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const result = createInvitationSchema.safeParse({ role: "viewer" });
    expect(result.success).toBe(false);
  });

  it("rejects missing role", () => {
    const result = createInvitationSchema.safeParse({
      email: "test@test.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = createInvitationSchema.safeParse({
      email: "test@test.com",
      role: "mega_admin",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid roles", () => {
    const validRoles = [
      "admin",
      "risk_manager",
      "control_owner",
      "auditor",
      "dpo",
      "viewer",
      "process_owner",
    ];
    for (const role of validRoles) {
      const result = createInvitationSchema.safeParse({
        email: "test@test.com",
        role,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid lineOfDefense", () => {
    const result = createInvitationSchema.safeParse({
      email: "test@test.com",
      role: "admin",
      lineOfDefense: "fourth",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// inviteUserSchema
// ---------------------------------------------------------------------------

describe("inviteUserSchema", () => {
  it("accepts valid email, role, and optional fields", () => {
    const result = inviteUserSchema.safeParse({
      email: "invite@test.com",
      role: "risk_manager",
      lineOfDefense: "second",
      department: "Risk Department",
    });
    expect(result.success).toBe(true);
  });

  it("accepts minimal valid data (email + role)", () => {
    const result = inviteUserSchema.safeParse({
      email: "invite@test.com",
      role: "viewer",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = inviteUserSchema.safeParse({ role: "viewer" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = inviteUserSchema.safeParse({
      email: "bad",
      role: "viewer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing role", () => {
    const result = inviteUserSchema.safeParse({ email: "test@test.com" });
    expect(result.success).toBe(false);
  });

  it("rejects department exceeding 255 characters", () => {
    const result = inviteUserSchema.safeParse({
      email: "test@test.com",
      role: "viewer",
      department: "D".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("accepts department at max length (255)", () => {
    const result = inviteUserSchema.safeParse({
      email: "test@test.com",
      role: "viewer",
      department: "D".repeat(255),
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// acceptInvitationSchema
// ---------------------------------------------------------------------------

describe("acceptInvitationSchema", () => {
  it("accepts name and password", () => {
    const result = acceptInvitationSchema.safeParse({
      name: "John Doe",
      password: "SecureP@ss123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (both fields optional)", () => {
    const result = acceptInvitationSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts only name", () => {
    const result = acceptInvitationSchema.safeParse({ name: "Jane" });
    expect(result.success).toBe(true);
  });

  it("accepts only password", () => {
    const result = acceptInvitationSchema.safeParse({
      password: "Str0ngP@ss!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name string", () => {
    const result = acceptInvitationSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 255 characters", () => {
    const result = acceptInvitationSchema.safeParse({
      name: "N".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = acceptInvitationSchema.safeParse({ password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects password exceeding 128 characters", () => {
    const result = acceptInvitationSchema.safeParse({
      password: "P".repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it("accepts password at minimum length (8)", () => {
    const result = acceptInvitationSchema.safeParse({
      password: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it("accepts password at maximum length (128)", () => {
    const result = acceptInvitationSchema.safeParse({
      password: "P".repeat(128),
    });
    expect(result.success).toBe(true);
  });
});
