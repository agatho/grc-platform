// #WP3-S02-02 / S12-14 (Critical) — Reproduktion der Rechteeskalation.
//
// Vor dem Fix fiel `withAuth(...roles)` bei verweigerter Standardrolle auf
// `checkCustomRoleAccess(userId, orgId)` zurück, das lediglich prüfte, ob der
// Nutzer IRGENDEINE Custom-Rolle mit IRGENDEINER Berechtigung != 'none' in der
// Org besitzt — ohne Modul- und ohne Aktionsbezug. Damit bestand ein `viewer`
// mit einer Custom-Rolle "Leserecht Academy" JEDE Rollenprüfung der Plattform,
// inklusive `withAuth("admin")` auf `POST /api/v1/users/:id/roles`, und konnte
// sich selbst die Rolle `admin` zuweisen (Auditbericht, Abschnitt S02-02).
//
// Dieser Test fährt exakt diesen Pfad:
//   1. Session: Rolle `viewer` in Org A.
//   2. DB: eine Custom-Rolle mit `academy:read` in Org A.
//   3. Aufruf einer Route, die `admin` verlangt.
// Vor dem Fix → ApiContext (Eskalation). Nach dem Fix → 403.

import { describe, it, expect, beforeEach, vi } from "vitest";

const ORG_A = "aaaaaaaa-0000-0000-0000-000000000001";
const VIEWER_ID = "11111111-1111-1111-1111-111111111111";

let session: unknown;
let routingPath = "/api/v1/users/22222222-2222-2222-2222-222222222222/roles";
let routingMethod = "POST";
/** Rows the mocked `db.execute` returns for the custom-role lookup. */
let customRolePermissions: Array<{ action: string; module_key: string }> = [];

vi.mock("@/auth", () => ({
  auth: () => Promise.resolve(session),
}));

vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve(
      new Headers({
        "x-request-id": "test-request",
        "x-arctos-path": routingPath,
        "x-arctos-method": routingMethod,
      }),
    ),
}));

vi.mock("next/server", () => ({
  after: () => undefined,
}));

vi.mock("@grc/auth/context", () => ({
  getCurrentOrgId: () => Promise.resolve(ORG_A),
}));

vi.mock("@grc/db", () => ({
  db: {
    execute: vi.fn(async () => customRolePermissions),
  },
}));

// `requireModule` must not turn the test into a 404 — module availability is a
// separate control (S02-11) with its own test.
vi.mock("@grc/auth", async () => {
  const actual = (await vi.importActual(
    "../../../../../packages/auth/src/rbac",
  )) as {
    requireRole: unknown;
    isHinSchgIsolated: unknown;
    isHinSchgAllowedPath: unknown;
  };
  return {
    requireRole: actual.requireRole,
    isHinSchgIsolated: actual.isHinSchgIsolated,
    isHinSchgAllowedPath: actual.isHinSchgAllowedPath,
    requireModule: vi.fn(async () => null),
  };
});

import { withAuth } from "@/lib/api";

function viewerWithCustomRole() {
  session = {
    user: {
      id: VIEWER_ID,
      email: "s02-poc@example.test",
      name: "S02 PoC",
      roles: [{ orgId: ORG_A, role: "viewer" }],
    },
  };
  // Exactly the audit's reproduction: one custom role, read-only, on a module
  // that has nothing to do with user administration.
  customRolePermissions = [{ action: "read", module_key: "academy" }];
}

describe("S02-02 — custom-role fallback must not satisfy an admin guard", () => {
  beforeEach(() => {
    routingPath = "/api/v1/users/22222222-2222-2222-2222-222222222222/roles";
    routingMethod = "POST";
    viewerWithCustomRole();
  });

  it("REJECTS the self-escalation path POST /users/:id/roles (S02-02 PoC)", async () => {
    const result = await withAuth("admin");
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  it("REJECTS an admin guard on any other platform-scoped route", async () => {
    routingPath = "/api/v1/organizations";
    const result = await withAuth("admin");
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  it("REJECTS a WRITE on a module the custom role only has READ for", async () => {
    routingPath = "/api/v1/academy/quiz-attempts";
    routingMethod = "POST";
    // The custom role grants academy:read; a POST needs academy:write.
    customRolePermissions = [];
    const result = await withAuth("admin");
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  it("REJECTS an admin-only guard when the custom role only has 'write'", async () => {
    routingPath = "/api/v1/academy/quiz-attempts";
    routingMethod = "POST";
    // An `admin`-only guard demands module action `admin`, not `write`.
    customRolePermissions = [{ action: "write", module_key: "academy" }];
    const result = await withAuth("admin");
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  it("GRANTS a non-admin guard when the custom role carries the needed action", async () => {
    routingPath = "/api/v1/academy/quiz-attempts";
    routingMethod = "POST";
    customRolePermissions = [{ action: "write", module_key: "academy" }];
    // A guard that is not admin-only maps a mutating request to `write`.
    const result = await withAuth("admin", "risk_manager");
    expect(result).not.toBeInstanceOf(Response);
  });

  it("GRANTS an admin-only guard when the custom role carries module admin", async () => {
    routingPath = "/api/v1/academy/quiz-attempts";
    routingMethod = "POST";
    customRolePermissions = [{ action: "admin", module_key: "academy" }];
    const result = await withAuth("admin");
    expect(result).not.toBeInstanceOf(Response);
  });

  it("fails CLOSED when the routed path is unknown (no module can be resolved)", async () => {
    routingPath = "";
    customRolePermissions = [{ action: "admin", module_key: "academy" }];
    const result = await withAuth("admin");
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });
});
