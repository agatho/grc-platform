// Tests für MODULE_KEYS-Konstante
// Bezug: packages/shared/src/modules.ts

import { describe, it, expect } from "vitest";
import { MODULE_KEYS } from "../src/modules";

describe("MODULE_KEYS", () => {
  it("contains the documented core modules", () => {
    const required = [
      "erm",
      "bpm",
      "ics",
      "dms",
      "isms",
      "bcms",
      "dpms",
      "audit",
      "tprm",
      "contract",
    ];
    for (const k of required) {
      expect(MODULE_KEYS).toContain(k);
    }
  });

  it("contains extended modules (ESG, EAM, Academy, …)", () => {
    expect(MODULE_KEYS).toContain("esg");
    expect(MODULE_KEYS).toContain("eam");
    expect(MODULE_KEYS).toContain("academy");
    expect(MODULE_KEYS).toContain("whistleblowing");
    expect(MODULE_KEYS).toContain("reporting");
    expect(MODULE_KEYS).toContain("community");
    expect(MODULE_KEYS).toContain("marketplace");
    expect(MODULE_KEYS).toContain("simulations");
    expect(MODULE_KEYS).toContain("portals");
  });

  it("has no duplicates", () => {
    expect(new Set(MODULE_KEYS).size).toBe(MODULE_KEYS.length);
  });

  it("all keys are lowercase snake-friendly identifiers", () => {
    for (const k of MODULE_KEYS) {
      expect(k).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("array is readonly (TypeScript-level only — runtime push works)", () => {
    // const-assertion makes TS treat as readonly tuple; at runtime it's still
    // a normal array. Just verify length is non-zero and stable.
    expect(MODULE_KEYS.length).toBeGreaterThan(10);
  });
});
