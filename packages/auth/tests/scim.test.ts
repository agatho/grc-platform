// Sprint 20: SCIM Service Unit Tests
import { describe, it, expect } from "vitest";
import { hashScimToken, generateScimToken } from "../src/scim/token-auth";
import {
  scimToArctosUser,
  arctosToScimUser,
  buildScimListResponse,
  buildScimError,
} from "../src/scim/user-mapper";
import {
  parseScimFilter,
  mapScimAttributeToColumn,
  buildFilterClause,
} from "../src/scim/filter-parser";

// ── Token Auth ──────────────────────────────────────────────

describe("SCIMTokenAuth", () => {
  it("should hash token using SHA-256", () => {
    const hash = hashScimToken("test-token-123");
    expect(hash).toHaveLength(64); // SHA-256 hex = 64 chars
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should produce consistent hashes", () => {
    const hash1 = hashScimToken("same-token");
    const hash2 = hashScimToken("same-token");
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different tokens", () => {
    const hash1 = hashScimToken("token-a");
    const hash2 = hashScimToken("token-b");
    expect(hash1).not.toBe(hash2);
  });

  it("should generate token with scim_ prefix", () => {
    const token = generateScimToken();
    expect(token).toMatch(/^scim_/);
    expect(token.length).toBeGreaterThan(20);
  });

  it("should generate unique tokens", () => {
    const token1 = generateScimToken();
    const token2 = generateScimToken();
    expect(token1).not.toBe(token2);
  });
});

// ── User Mapper ─────────────────────────────────────────────

describe("SCIMUserMapper", () => {
  it("should map SCIM user to ARCTOS user", () => {
    const scimUser = {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      userName: "max@example.de",
      name: { givenName: "Max", familyName: "Mustermann" },
      emails: [{ value: "max@example.de", type: "work", primary: true }],
      active: true,
      externalId: "ext-123",
    };
    const result = scimToArctosUser(scimUser);
    expect(result.email).toBe("max@example.de");
    expect(result.name).toBe("Max Mustermann");
    expect(result.firstName).toBe("Max");
    expect(result.lastName).toBe("Mustermann");
    expect(result.externalId).toBe("ext-123");
    expect(result.isActive).toBe(true);
  });

  it("should throw when SCIM user has no email", () => {
    const noEmail = {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      userName: "",
      name: { givenName: "Max", familyName: "M" },
      emails: [],
      active: true,
    };
    expect(() => scimToArctosUser(noEmail)).toThrow("no email");
  });

  it("should map ARCTOS user to SCIM user", () => {
    const user = {
      id: "uuid-123",
      email: "max@example.de",
      name: "Max Mustermann",
      externalId: "ext-123",
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-06-01"),
    };
    const scimUser = arctosToScimUser(user, "https://arctos.app/api/v1");
    expect(scimUser.schemas).toContain(
      "urn:ietf:params:scim:schemas:core:2.0:User",
    );
    expect(scimUser.id).toBe("uuid-123");
    expect(scimUser.userName).toBe("max@example.de");
    expect(scimUser.name.givenName).toBe("Max");
    expect(scimUser.name.familyName).toBe("Mustermann");
    expect(scimUser.active).toBe(true);
    expect(scimUser.meta?.resourceType).toBe("User");
    expect(scimUser.meta?.location).toBe(
      "https://arctos.app/api/v1/scim/v2/Users/uuid-123",
    );
  });

  it("should build SCIM list response", () => {
    const response = buildScimListResponse([], 0, 1, 10);
    expect(response.schemas).toContain(
      "urn:ietf:params:scim:api:messages:2.0:ListResponse",
    );
    expect(response.totalResults).toBe(0);
    expect(response.startIndex).toBe(1);
    expect(response.itemsPerPage).toBe(10);
    expect(response.Resources).toEqual([]);
  });

  it("should build SCIM error response", () => {
    const error = buildScimError("Not found", 404);
    expect(error.schemas).toContain(
      "urn:ietf:params:scim:api:messages:2.0:Error",
    );
    expect(error.detail).toBe("Not found");
    expect(error.status).toBe("404");
  });
});

// ── Filter Parser ───────────────────────────────────────────

describe("SCIMFilterParser", () => {
  it('should parse eq filter: userName eq "user@example.de"', () => {
    const filter = parseScimFilter('userName eq "user@example.de"');
    expect(filter).not.toBeNull();
    expect(filter?.attribute).toBe("userName");
    expect(filter?.operator).toBe("eq");
    expect(filter?.value).toBe("user@example.de");
  });

  it('should parse co filter: userName co "example"', () => {
    const filter = parseScimFilter('userName co "example"');
    expect(filter).not.toBeNull();
    expect(filter?.operator).toBe("co");
    expect(filter?.value).toBe("example");
  });

  it('should parse sw filter: userName sw "max"', () => {
    const filter = parseScimFilter('userName sw "max"');
    expect(filter).not.toBeNull();
    expect(filter?.operator).toBe("sw");
    expect(filter?.value).toBe("max");
  });

  it("should parse nested attribute: name.givenName", () => {
    const filter = parseScimFilter('name.givenName eq "Max"');
    expect(filter).not.toBeNull();
    expect(filter?.attribute).toBe("name.givenName");
  });

  it("should return null for empty filter", () => {
    expect(parseScimFilter("")).toBeNull();
    expect(parseScimFilter("  ")).toBeNull();
  });

  it("should return null for invalid filter syntax", () => {
    expect(parseScimFilter("invalid")).toBeNull();
    expect(parseScimFilter("userName gt 5")).toBeNull();
  });

  it("should map SCIM attributes to database columns", () => {
    expect(mapScimAttributeToColumn("userName")).toBe("email");
    expect(mapScimAttributeToColumn("externalId")).toBe("external_id");
    expect(mapScimAttributeToColumn("active")).toBe("is_active");
    expect(mapScimAttributeToColumn("unknownAttr")).toBeNull();
  });

  it("should build SQL filter clause for eq operator", () => {
    const filter = parseScimFilter('userName eq "test@example.de"');
    const clause = buildFilterClause(filter!);
    expect(clause).not.toBeNull();
    expect(clause?.clause).toContain("=");
    expect(clause?.value).toBe("test@example.de");
  });

  it("should build SQL filter clause for co operator", () => {
    const filter = parseScimFilter('userName co "example"');
    const clause = buildFilterClause(filter!);
    expect(clause).not.toBeNull();
    expect(clause?.clause).toContain("ILIKE");
    expect(clause?.value).toBe("%example%");
  });

  it("should build SQL filter clause for sw operator", () => {
    const filter = parseScimFilter('userName sw "max"');
    const clause = buildFilterClause(filter!);
    expect(clause).not.toBeNull();
    expect(clause?.clause).toContain("ILIKE");
    expect(clause?.value).toBe("max%");
  });
});
