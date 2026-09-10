// DPMS Overhaul: RBAC matrix for new DPMS endpoints.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "app", "api", "v1", "dpms");

interface RouteSpec {
  path: string;
  method: "GET" | "POST";
  expectedRoles: string[];
}

const MATRIX: RouteSpec[] = [
  {
    path: "dpia/[id]/transitions/blockers/route.ts",
    method: "GET",
    expectedRoles: [],
  },
  { path: "dsr/sla-status/route.ts", method: "GET", expectedRoles: [] },
  {
    path: "data-breach/[id]/72h-status/route.ts",
    method: "GET",
    expectedRoles: [],
  },
  {
    path: "data-breach/[id]/notification-pack/route.ts",
    method: "POST",
    expectedRoles: ["admin", "dpo", "compliance_officer"],
  },
  {
    path: "ropa/[id]/ai/draft-fields/route.ts",
    method: "POST",
    expectedRoles: ["admin", "dpo"],
  },
  {
    path: "dpia/[id]/ai/draft-measures/route.ts",
    method: "POST",
    expectedRoles: ["admin", "dpo"],
  },
];

function extractRoles(src: string, method: string): string[] | null {
  const re = new RegExp(
    // [E2E-TRIAGE-2026-09-02] Also match the wrapped export form
    // `export const GET = withErrorHandler(async function GET(` — the route
    // handlers adopted `withErrorHandler` so `withAuth` can bind the org-pinned
    // connection at all (see api.ts:184). The RBAC assertion below is unchanged;
    // only the shape of the declaration this extractor has to recognise is.
    `export\\s+(?:async\\s+function|const)\\s+${method}\\s*(?:=\\s*withErrorHandler\\s*\\(\\s*async\\s+function\\s+${method}\\s*)?\\(([\\s\\S]*?)withAuth\\s*\\(([^)]*)\\)`,
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

describe("DPMS endpoint RBAC matrix", () => {
  for (const spec of MATRIX) {
    it(`${spec.method} ${spec.path}: roles = [${spec.expectedRoles.join(",") || "any-authenticated"}]`, () => {
      const src = readFileSync(join(ROOT, spec.path), "utf8");
      const roles = extractRoles(src, spec.method);
      expect(roles).not.toBeNull();
      expect(new Set(roles!), `${spec.method} ${spec.path}`).toEqual(
        new Set(spec.expectedRoles),
      );
    });
  }
});
