// BPM Overhaul Phase 2 E1: RBAC matrix for new BPM endpoints.
//
// We grep the route files to extract the withAuth(...) role arguments and
// assert they match the documented expected role-set per endpoint. This
// catches accidental scope creep (e.g. a route opened to viewer that should
// be admin-only).
//
// This is a static-analysis test — no DB calls, just file reads.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_ROOT = join(__dirname, "..", "..", "app", "api", "v1", "processes");

interface RouteSpec {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  expectedRoles: string[]; // empty array = withAuth() with no role filter (i.e. any authenticated user)
}

// Documented expected RBAC. When a route handler uses withAuth() with no
// args (any authenticated user), expectedRoles = [].
const MATRIX: RouteSpec[] = [
  { path: "[id]/risk-heatmap/route.ts", method: "GET", expectedRoles: [] },
  { path: "[id]/control-coverage/route.ts", method: "GET", expectedRoles: [] },
  { path: "[id]/racm/route.ts", method: "GET", expectedRoles: [] },
  { path: "[id]/findings/route.ts", method: "GET", expectedRoles: [] },
  { path: "[id]/bia-impacts/route.ts", method: "GET", expectedRoles: [] },
  {
    path: "[id]/ropa-profile/route.ts",
    method: "PUT",
    expectedRoles: ["admin", "dpo", "process_owner"],
  },
  { path: "[id]/three-lines-distribution/route.ts", method: "GET", expectedRoles: [] },
  {
    path: "[id]/coverage/route.ts",
    method: "POST",
    expectedRoles: ["admin", "compliance_officer", "process_owner"],
  },
  {
    path: "[id]/coverage/route.ts",
    method: "DELETE",
    expectedRoles: ["admin", "compliance_officer", "process_owner"],
  },
  { path: "[id]/audit-trail/route.ts", method: "GET", expectedRoles: [] },
  { path: "[id]/health-score/route.ts", method: "GET", expectedRoles: [] },
  { path: "[id]/sign-off/route.ts", method: "POST", expectedRoles: [] },
  { path: "[id]/sign-off/route.ts", method: "GET", expectedRoles: [] },
  {
    path: "[id]/risks/bulk-link/route.ts",
    method: "POST",
    expectedRoles: ["admin", "process_owner", "risk_manager"],
  },
  {
    path: "[id]/controls/bulk-link/route.ts",
    method: "POST",
    expectedRoles: ["admin", "process_owner", "control_owner"],
  },
  {
    path: "[id]/documents/bulk-attach/route.ts",
    method: "POST",
    expectedRoles: ["admin", "process_owner", "compliance_officer", "dpo"],
  },
  {
    path: "[id]/steps/[stepId]/line-of-defense/route.ts",
    method: "PUT",
    expectedRoles: ["admin", "process_owner", "quality_manager", "risk_manager"],
  },
  {
    path: "ai/generate-from-text/route.ts",
    method: "POST",
    expectedRoles: ["admin", "process_owner", "quality_manager"],
  },
  {
    path: "[id]/ai/suggest-risks/route.ts",
    method: "POST",
    expectedRoles: ["admin", "process_owner", "risk_manager"],
  },
  {
    path: "[id]/ai/suggest-controls/route.ts",
    method: "POST",
    expectedRoles: ["admin", "process_owner", "control_owner"],
  },
  {
    path: "[id]/ai/map-frameworks/route.ts",
    method: "POST",
    expectedRoles: ["admin", "compliance_officer", "process_owner"],
  },
  {
    path: "[id]/event-logs/route.ts",
    method: "POST",
    expectedRoles: ["admin", "process_owner"],
  },
  {
    path: "[id]/maturity/auto-compute/route.ts",
    method: "POST",
    expectedRoles: ["admin", "quality_manager", "process_owner"],
  },
  { path: "[id]/mining/bottlenecks/route.ts", method: "GET", expectedRoles: [] },
  { path: "[id]/mining/rework/route.ts", method: "GET", expectedRoles: [] },
  { path: "cockpit/route.ts", method: "GET", expectedRoles: [] },
];

function extractRolesForMethod(src: string, method: string): string[] | null {
  // Find the function body — naive split, sufficient for our handlers.
  const re = new RegExp(
    `export\\s+async\\s+function\\s+${method}\\s*\\(([\\s\\S]*?)withAuth\\s*\\(([^)]*)\\)`,
    "m",
  );
  const m = src.match(re);
  if (!m) return null;
  const args = m[2].trim();
  if (!args) return [];
  return args
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

describe("BPM endpoint RBAC matrix", () => {
  for (const spec of MATRIX) {
    it(`${spec.method} ${spec.path}: roles = [${spec.expectedRoles.join(",") || "any-authenticated"}]`, () => {
      const file = join(APP_ROOT, spec.path);
      let src = "";
      try {
        src = readFileSync(file, "utf8");
      } catch (e) {
        throw new Error(`Route file missing: ${file}`);
      }
      const roles = extractRolesForMethod(src, spec.method);
      expect(roles, `withAuth call for ${spec.method} not found`).not.toBeNull();
      expect(new Set(roles!), `${spec.method} ${spec.path} role mismatch`).toEqual(
        new Set(spec.expectedRoles),
      );
    });
  }
});
