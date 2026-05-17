// Audit Overhaul: RBAC matrix for new audit-mgmt endpoints.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "app", "api", "v1", "audit-mgmt", "audits");

interface RouteSpec {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  expectedRoles: string[];
}

const MATRIX: RouteSpec[] = [
  { path: "[id]/transitions/blockers/route.ts", method: "GET", expectedRoles: [] },
  { path: "[id]/sign-off/route.ts", method: "GET", expectedRoles: [] },
  { path: "[id]/sign-off/route.ts", method: "POST", expectedRoles: [] },
  { path: "[id]/racm/route.ts", method: "GET", expectedRoles: [] },
  { path: "[id]/scope-aggregation/route.ts", method: "GET", expectedRoles: [] },
  {
    path: "[id]/audit-pack/route.ts",
    method: "POST",
    expectedRoles: ["admin", "auditor", "compliance_officer", "quality_manager"],
  },
  {
    path: "[id]/ai/generate-checklist/route.ts",
    method: "POST",
    expectedRoles: ["admin", "auditor", "compliance_officer"],
  },
  {
    path: "[id]/ai/suggest-findings/route.ts",
    method: "POST",
    expectedRoles: ["admin", "auditor", "compliance_officer"],
  },
];

function extractRoles(src: string, method: string): string[] | null {
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

describe("Audit-Mgmt endpoint RBAC matrix", () => {
  for (const spec of MATRIX) {
    it(`${spec.method} ${spec.path}: roles = [${spec.expectedRoles.join(",") || "any-authenticated"}]`, () => {
      const src = readFileSync(join(ROOT, spec.path), "utf8");
      const roles = extractRoles(src, spec.method);
      expect(roles, `withAuth call for ${spec.method} not found`).not.toBeNull();
      expect(new Set(roles!), `${spec.method} ${spec.path}`).toEqual(new Set(spec.expectedRoles));
    });
  }
});
