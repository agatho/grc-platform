// Sprint 20: Identity Zod Schema Validation Tests
import { describe, it, expect } from "vitest";
import {
  createSsoConfigSchema,
  updateSsoConfigSchema,
  createScimTokenSchema,
  scimCreateUserSchema,
  scimPatchOpSchema,
  parseSamlMetadataSchema,
  discoverOidcSchema,
  breakGlassLoginSchema,
  groupRoleMappingSchema,
} from "../src/schemas/identity";

describe("SSOConfigSchemas", () => {
  it("should validate a complete SAML config", () => {
    const result = createSsoConfigSchema.safeParse({
      provider: "saml",
      displayName: "Corporate IdP",
      samlMetadataUrl: "https://idp.example.com/metadata",
      samlEntityId: "http://idp.example.com/entity",
      samlSsoUrl: "https://idp.example.com/sso",
      samlCertificate: "MIICx...",
      isActive: true,
      defaultRole: "viewer",
    });
    expect(result.success).toBe(true);
  });

  it("should validate a complete OIDC config", () => {
    const result = createSsoConfigSchema.safeParse({
      provider: "oidc",
      oidcDiscoveryUrl:
        "https://accounts.example.com/.well-known/openid-configuration",
      oidcClientId: "client-123",
      oidcClientSecret: "secret-456",
      oidcScopes: "openid profile email",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid provider", () => {
    const result = createSsoConfigSchema.safeParse({
      provider: "ldap",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid default role", () => {
    const result = createSsoConfigSchema.safeParse({
      provider: "saml",
      defaultRole: "superuser",
    });
    expect(result.success).toBe(false);
  });

  it("should accept partial update", () => {
    const result = updateSsoConfigSchema.safeParse({
      displayName: "Updated Name",
    });
    expect(result.success).toBe(true);
  });
});

describe("SCIMSchemas", () => {
  it("should validate SCIM token creation", () => {
    const result = createScimTokenSchema.safeParse({
      description: "IdP Integration Token",
    });
    expect(result.success).toBe(true);
  });

  it("should validate SCIM token creation without description", () => {
    const result = createScimTokenSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should validate SCIM user creation", () => {
    const result = scimCreateUserSchema.safeParse({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      userName: "max@example.de",
      name: { givenName: "Max", familyName: "Mustermann" },
      active: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject SCIM user without schemas", () => {
    const result = scimCreateUserSchema.safeParse({
      userName: "max@example.de",
      name: { givenName: "Max", familyName: "Mustermann" },
    });
    expect(result.success).toBe(false);
  });

  it("should reject SCIM user with invalid email", () => {
    const result = scimCreateUserSchema.safeParse({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      userName: "not-an-email",
      name: { givenName: "Max", familyName: "M" },
    });
    expect(result.success).toBe(false);
  });

  it("should validate SCIM PatchOp", () => {
    const result = scimPatchOpSchema.safeParse({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
      Operations: [{ op: "replace", path: "active", value: false }],
    });
    expect(result.success).toBe(true);
  });

  it("should reject PatchOp with invalid operation", () => {
    const result = scimPatchOpSchema.safeParse({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
      Operations: [{ op: "merge", path: "active", value: false }],
    });
    expect(result.success).toBe(false);
  });

  it("should reject PatchOp with >100 operations", () => {
    const ops = Array.from({ length: 101 }, () => ({
      op: "replace" as const,
      path: "active",
      value: true,
    }));
    const result = scimPatchOpSchema.safeParse({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
      Operations: ops,
    });
    expect(result.success).toBe(false);
  });
});

describe("MetadataSchemas", () => {
  it("should validate SAML metadata URL", () => {
    const result = parseSamlMetadataSchema.safeParse({
      metadataUrl: "https://idp.example.com/metadata.xml",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid metadata URL", () => {
    const result = parseSamlMetadataSchema.safeParse({
      metadataUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("should validate OIDC discovery URL", () => {
    const result = discoverOidcSchema.safeParse({
      discoveryUrl:
        "https://accounts.example.com/.well-known/openid-configuration",
    });
    expect(result.success).toBe(true);
  });
});

describe("BreakGlassSchema", () => {
  it("should validate break-glass login", () => {
    const result = breakGlassLoginSchema.safeParse({
      email: "admin@example.de",
      password: "secure-password",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty password", () => {
    const result = breakGlassLoginSchema.safeParse({
      email: "admin@example.de",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("GroupRoleMappingSchema", () => {
  it("should validate valid group-role mapping", () => {
    const result = groupRoleMappingSchema.safeParse({
      "GRC-Admins": "admin",
      "Risk-Team": "risk_manager",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid role in mapping", () => {
    const result = groupRoleMappingSchema.safeParse({
      "GRC-Admins": "superuser",
    });
    expect(result.success).toBe(false);
  });
});
