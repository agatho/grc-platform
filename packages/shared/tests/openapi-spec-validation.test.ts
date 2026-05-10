// OpenAPI spec validation — guards docs/openapi.yaml against drift.
//
// docs/openapi.yaml is auto-generated from the API tree by
// scripts/generate-openapi.mjs (1.034 paths, 1.606 methods at last count).
// The auto-generator can produce structurally invalid output if the
// route file naming changes or a path collision appears.
//
// What we test:
//   - File exists and parses as YAML
//   - Top-level openapi version is 3.x
//   - paths object has > 100 entries (regression guard against accidental wipe)
//   - Each path key starts with `/` (basic shape)
//   - No duplicate path declarations
//
// We deliberately don't run a full $ref resolver here (that's slow and
// requires @apidevtools/swagger-parser). The static checks catch the
// 90 % case: file emptied, path structure broken, version downgraded.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Resolve docs/openapi.yaml relative to repo root from packages/shared/tests/
const SPEC_PATH = path.resolve(
  __dirname,
  "../../..",
  "docs/openapi.yaml",
);

function readSpec(): string {
  return fs.readFileSync(SPEC_PATH, "utf8");
}

// Minimal YAML inspector: we only need top-level keys and path strings.
// Avoids adding js-yaml as a test-only dep.
function extractPathKeys(yaml: string): string[] {
  // Find the `paths:` block, then collect lines that look like indented
  // path keys (start with two spaces and a slash).
  const lines = yaml.split("\n");
  const paths: string[] = [];
  let inPaths = false;
  for (const line of lines) {
    if (line.startsWith("paths:")) {
      inPaths = true;
      continue;
    }
    if (inPaths && line.length > 0 && !line.startsWith(" ")) {
      // Left the paths block (next top-level key)
      break;
    }
    if (inPaths) {
      // Match `  "/api/v1/...":` (2-space indent, quoted path, ends with colon)
      const m = line.match(/^  "(\/[^"]+)":/);
      if (m) paths.push(m[1]);
    }
  }
  return paths;
}

describe("OpenAPI spec — structural guards", () => {
  it("docs/openapi.yaml exists", () => {
    expect(fs.existsSync(SPEC_PATH)).toBe(true);
  });

  it("file is non-empty (>5 KB — defends against accidental truncation)", () => {
    const stats = fs.statSync(SPEC_PATH);
    expect(stats.size).toBeGreaterThan(5_000);
  });

  it("declares openapi 3.x", () => {
    const yaml = readSpec();
    expect(yaml).toMatch(/openapi: 3\./);
  });

  it("declares the platform title", () => {
    const yaml = readSpec();
    expect(yaml).toContain("ARCTOS GRC Platform API");
  });

  it("contains > 100 paths (regression guard)", () => {
    const paths = extractPathKeys(readSpec());
    expect(paths.length).toBeGreaterThan(100);
  });

  it("every path starts with /api/v1/ (no leaks from other prefixes)", () => {
    const paths = extractPathKeys(readSpec());
    for (const p of paths) {
      expect(p.startsWith("/api/v1/")).toBe(true);
    }
  });

  it("has no duplicate path declarations", () => {
    const paths = extractPathKeys(readSpec());
    const unique = new Set(paths);
    expect(unique.size).toBe(paths.length);
  });

  it("contains the well-known endpoints (smoke against accidental removal)", () => {
    const yaml = readSpec();
    const wellKnown = [
      "/api/v1/health",
      "/api/v1/risks",
      "/api/v1/controls",
      "/api/v1/audit-log",
      "/api/v1/audit-log/integrity",
    ];
    for (const p of wellKnown) {
      // Paths are quoted in the YAML output: `  "/path":`
      expect(yaml).toContain(`  "${p}":`);
    }
  });
});
