// Unit tests for RBAC middleware functions (ADR-007 rev.1)
// Tests requireRole, requireLineOfDefense, getRolesInOrg, getAccessibleOrgIds

import { describe, it, expect } from "vitest";
import {
  requireRole,
  requireLineOfDefense,
  getRolesInOrg,
  getAccessibleOrgIds,
} from "../src/rbac";
import type { Session } from "next-auth";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeSession(overrides?: Partial<Session["user"]>): Session {
  return {
    user: {
      id: "user-1",
      email: "test@arctos.dev",
      name: "Test User",
      image: null,
      language: "de",
      roles: [
        { orgId: "org-1", role: "admin", lineOfDefense: null },
        { orgId: "org-1", role: "risk_manager", lineOfDefense: "second" },
        { orgId: "org-2", role: "viewer", lineOfDefense: null },
        { orgId: "org-3", role: "auditor", lineOfDefense: "third" },
        { orgId: "org-3", role: "dpo", lineOfDefense: "second" },
      ],
      ...overrides,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

const nullSession: Session | null = null;

const emptyRolesSession = makeSession({ roles: [] });

// ---------------------------------------------------------------------------
// requireRole
// ---------------------------------------------------------------------------

describe("requireRole", () => {
  it("returns null (authorized) when user has the required role in org", () => {
    const session = makeSession();
    const check = requireRole("admin")(session, "org-1");
    expect(check).toBeNull();
  });

  it("returns null when user has one of multiple allowed roles", () => {
    const session = makeSession();
    const check = requireRole("auditor", "dpo")(session, "org-3");
    expect(check).toBeNull();
  });

  it("returns 403 when user does not have the required role in the org", () => {
    const session = makeSession();
    const check = requireRole("admin")(session, "org-2");
    expect(check).toBeInstanceOf(Response);
    expect(check!.status).toBe(403);
  });

  it("returns 403 when user has the role in a different org", () => {
    const session = makeSession();
    // admin role is in org-1, not org-3
    const check = requireRole("admin")(session, "org-3");
    expect(check).toBeInstanceOf(Response);
    expect(check!.status).toBe(403);
  });

  it("returns 401 when session is null", () => {
    const check = requireRole("admin")(nullSession, "org-1");
    expect(check).toBeInstanceOf(Response);
    expect(check!.status).toBe(401);
  });

  it("returns 401 when session.user.id is missing", () => {
    const session = makeSession({ id: "" });
    const check = requireRole("admin")(session, "org-1");
    expect(check).toBeInstanceOf(Response);
    expect(check!.status).toBe(401);
  });

  it("returns 403 when user has empty roles array", () => {
    const check = requireRole("admin")(emptyRolesSession, "org-1");
    expect(check).toBeInstanceOf(Response);
    expect(check!.status).toBe(403);
  });

  it("returns correct JSON error body for 403", async () => {
    const session = makeSession();
    const check = requireRole("admin")(session, "org-2");
    const body = await check!.json();
    expect(body).toEqual({ error: "Forbidden" });
  });

  it("returns correct JSON error body for 401", async () => {
    const check = requireRole("admin")(nullSession, "org-1");
    const body = await check!.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns correct Content-Type header", () => {
    const check = requireRole("admin")(nullSession, "org-1");
    expect(check!.headers.get("Content-Type")).toBe("application/json");
  });

  it("handles multiple roles where only one matches", () => {
    const session = makeSession();
    // org-2 only has viewer, so admin|risk_manager should fail
    const check = requireRole("admin", "risk_manager")(session, "org-2");
    expect(check).toBeInstanceOf(Response);
    expect(check!.status).toBe(403);
  });

  it("works with every valid role type", () => {
    const roles = [
      "admin",
      "risk_manager",
      "control_owner",
      "auditor",
      "dpo",
      "process_owner",
      "viewer",
    ] as const;

    for (const role of roles) {
      const session = makeSession({
        roles: [{ orgId: "org-x", role, lineOfDefense: null }],
      });
      const check = requireRole(role)(session, "org-x");
      expect(check).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// requireLineOfDefense
// ---------------------------------------------------------------------------

describe("requireLineOfDefense", () => {
  it("returns null when user has a role in the required LoD", () => {
    const session = makeSession();
    // org-3 has auditor(third) and dpo(second)
    const check = requireLineOfDefense("third")(session, "org-3");
    expect(check).toBeNull();
  });

  it("returns null when user matches one of multiple allowed LoDs", () => {
    const session = makeSession();
    const check = requireLineOfDefense("first", "second")(session, "org-1");
    // org-1 has risk_manager with LoD "second"
    expect(check).toBeNull();
  });

  it("returns 403 when user has no role with the required LoD in org", () => {
    const session = makeSession();
    // org-2 has viewer with null LoD
    const check = requireLineOfDefense("first")(session, "org-2");
    expect(check).toBeInstanceOf(Response);
    expect(check!.status).toBe(403);
  });

  it("returns 403 when user has roles but all have null lineOfDefense", () => {
    const session = makeSession();
    // org-2 only has viewer with null LoD
    const check = requireLineOfDefense("second")(session, "org-2");
    expect(check).toBeInstanceOf(Response);
    expect(check!.status).toBe(403);
  });

  it("returns 401 when session is null", () => {
    const check = requireLineOfDefense("first")(nullSession, "org-1");
    expect(check).toBeInstanceOf(Response);
    expect(check!.status).toBe(401);
  });

  it("returns 401 when session.user.id is falsy", () => {
    const session = makeSession({ id: "" });
    const check = requireLineOfDefense("first")(session, "org-1");
    expect(check).toBeInstanceOf(Response);
    expect(check!.status).toBe(401);
  });

  it("returns 403 for empty roles array", () => {
    const check = requireLineOfDefense("first")(emptyRolesSession, "org-1");
    expect(check).toBeInstanceOf(Response);
    expect(check!.status).toBe(403);
  });

  it("ignores roles from other orgs", () => {
    const session = makeSession();
    // org-1 has second LoD, but checking org-3 for first should fail
    const check = requireLineOfDefense("first")(session, "org-3");
    expect(check).toBeInstanceOf(Response);
    expect(check!.status).toBe(403);
  });

  it("returns correct JSON body for 403", async () => {
    const session = makeSession();
    const check = requireLineOfDefense("first")(session, "org-2");
    const body = await check!.json();
    expect(body).toEqual({ error: "Forbidden" });
  });

  it("handles all three lines of defense", () => {
    const lines = ["first", "second", "third"] as const;
    for (const lod of lines) {
      const session = makeSession({
        roles: [{ orgId: "org-x", role: "admin", lineOfDefense: lod }],
      });
      const check = requireLineOfDefense(lod)(session, "org-x");
      expect(check).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// getRolesInOrg
// ---------------------------------------------------------------------------

describe("getRolesInOrg", () => {
  it("returns roles for the specified org", () => {
    const session = makeSession();
    const roles = getRolesInOrg(session, "org-1");
    expect(roles).toEqual(["admin", "risk_manager"]);
  });

  it("returns a single role when user has one role in org", () => {
    const session = makeSession();
    const roles = getRolesInOrg(session, "org-2");
    expect(roles).toEqual(["viewer"]);
  });

  it("returns multiple roles from a different org", () => {
    const session = makeSession();
    const roles = getRolesInOrg(session, "org-3");
    expect(roles).toEqual(["auditor", "dpo"]);
  });

  it("returns empty array for an org the user is not in", () => {
    const session = makeSession();
    const roles = getRolesInOrg(session, "org-nonexistent");
    expect(roles).toEqual([]);
  });

  it("returns empty array for null session", () => {
    const roles = getRolesInOrg(nullSession, "org-1");
    expect(roles).toEqual([]);
  });

  it("returns empty array when session has no roles property", () => {
    const session = {
      user: {
        id: "user-1",
        email: "test@arctos.dev",
        name: "Test",
        language: "de",
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as Session;
    const roles = getRolesInOrg(session, "org-1");
    expect(roles).toEqual([]);
  });

  it("returns empty array for empty roles array", () => {
    const roles = getRolesInOrg(emptyRolesSession, "org-1");
    expect(roles).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getAccessibleOrgIds
// ---------------------------------------------------------------------------

describe("getAccessibleOrgIds", () => {
  it("returns all unique org IDs from user roles", () => {
    const session = makeSession();
    const orgIds = getAccessibleOrgIds(session);
    expect(orgIds).toHaveLength(3);
    expect(orgIds).toContain("org-1");
    expect(orgIds).toContain("org-2");
    expect(orgIds).toContain("org-3");
  });

  it("deduplicates org IDs when user has multiple roles in same org", () => {
    const session = makeSession();
    const orgIds = getAccessibleOrgIds(session);
    // org-1 appears twice (admin + risk_manager) and org-3 twice (auditor + dpo)
    const org1Count = orgIds.filter((id) => id === "org-1").length;
    const org3Count = orgIds.filter((id) => id === "org-3").length;
    expect(org1Count).toBe(1);
    expect(org3Count).toBe(1);
  });

  it("returns empty array for null session", () => {
    const orgIds = getAccessibleOrgIds(nullSession);
    expect(orgIds).toEqual([]);
  });

  it("returns empty array when session has no roles property", () => {
    const session = {
      user: {
        id: "user-1",
        email: "test@arctos.dev",
        name: "Test",
        language: "de",
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as Session;
    const orgIds = getAccessibleOrgIds(session);
    expect(orgIds).toEqual([]);
  });

  it("returns empty array for empty roles array", () => {
    const orgIds = getAccessibleOrgIds(emptyRolesSession);
    expect(orgIds).toEqual([]);
  });

  it("returns single org when user belongs to only one", () => {
    const session = makeSession({
      roles: [{ orgId: "org-only", role: "viewer", lineOfDefense: null }],
    });
    const orgIds = getAccessibleOrgIds(session);
    expect(orgIds).toEqual(["org-only"]);
  });
});
