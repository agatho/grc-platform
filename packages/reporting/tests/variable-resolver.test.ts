// Variable-resolver tests — pure functions, no mocks needed.
//
// Why this matters: The reporting pipeline generates Compliance-Berichte
// (ISO 27001, NIS2, GDPR, DORA). If template variable resolution silently
// substitutes wrong values OR allows template injection (e.g. {{constructor.constructor}}),
// every generated report is compromised.
//
// The implementation uses a strict whitelist of namespaces and explicit
// dot-notation parsing — these tests pin that contract.

import { describe, it, expect } from "vitest";
import {
  resolveVariables,
  extractVariables,
  validateVariables,
  type VariableContext,
} from "../src/variable-resolver";

const ctx: VariableContext = {
  org: { name: "Meridian Holdings", code: "MERID" },
  report: { date: "2026-05-10", title: "ISMS Quarterly" },
  period: { start: "2026-01-01", end: "2026-03-31", label: "Q1 2026" },
  author: { name: "Lisa Schneider", email: "lisa@arctos.dev" },
  isms: { soaCount: "93", maturityScore: "3.8" },
};

describe("resolveVariables", () => {
  it("substitutes a single variable", () => {
    expect(resolveVariables("Org: {{org.name}}", ctx)).toBe(
      "Org: Meridian Holdings",
    );
  });

  it("substitutes multiple variables in one string", () => {
    const out = resolveVariables(
      "{{report.title}} for {{org.name}} ({{period.label}})",
      ctx,
    );
    expect(out).toBe("ISMS Quarterly for Meridian Holdings (Q1 2026)");
  });

  it("returns text unchanged when there are no variables", () => {
    const text = "No variables here.";
    expect(resolveVariables(text, ctx)).toBe(text);
  });

  it("leaves unknown-namespace variables literal (debugging visibility)", () => {
    expect(resolveVariables("{{xss.value}}", ctx)).toBe("{{xss.value}}");
    expect(resolveVariables("{{secret.apiKey}}", ctx)).toBe("{{secret.apiKey}}");
  });

  it("returns empty string for known namespace with unknown property", () => {
    // Contract: namespace allowed, but path doesn't resolve → ""
    expect(resolveVariables("{{org.nonexistent}}", ctx)).toBe("");
  });

  it("rejects single-word paths (no namespace prefix)", () => {
    // Contract: must be at least namespace.field
    expect(resolveVariables("{{title}}", ctx)).toBe("{{title}}");
  });

  it("blocks template-injection attempts via dotted prototype paths", () => {
    // Even though "constructor" looks like an object property, it's not a
    // whitelisted namespace, so the resolver MUST refuse to walk it.
    expect(resolveVariables("{{constructor.constructor}}", ctx)).toBe(
      "{{constructor.constructor}}",
    );
    expect(resolveVariables("{{__proto__.polluted}}", ctx)).toBe(
      "{{__proto__.polluted}}",
    );
  });

  it("treats variable values as literal text (no nested re-rendering)", () => {
    const xssCtx: VariableContext = {
      org: { name: "{{author.email}}" }, // value contains a fake placeholder
    };
    // The resolver should NOT recurse — output is literal.
    expect(resolveVariables("Hi {{org.name}}", xssCtx)).toBe(
      "Hi {{author.email}}",
    );
  });

  it("supports all 12 whitelisted namespaces", () => {
    const namespaces = [
      "org",
      "report",
      "period",
      "author",
      "erm",
      "ics",
      "isms",
      "dpms",
      "esg",
      "bcms",
      "audit",
      "tprm",
    ];
    const fullCtx: VariableContext = Object.fromEntries(
      namespaces.map((n) => [n, { x: `${n}-value` }]),
    );
    for (const ns of namespaces) {
      expect(resolveVariables(`{{${ns}.x}}`, fullCtx)).toBe(`${ns}-value`);
    }
  });

  it("converts non-string values to strings", () => {
    const c: VariableContext = { isms: { count: 42 as unknown as string } };
    expect(resolveVariables("{{isms.count}}", c)).toBe("42");
  });
});

describe("extractVariables", () => {
  it("returns deduplicated list of all variable references", () => {
    const text =
      "{{org.name}} {{org.name}} {{period.label}} {{report.title}}";
    expect(extractVariables(text)).toEqual([
      "org.name",
      "period.label",
      "report.title",
    ]);
  });

  it("returns empty array when no variables present", () => {
    expect(extractVariables("Plain text.")).toEqual([]);
  });

  it("ignores malformed placeholders", () => {
    expect(extractVariables("{org.name} {{ }} {{}}")).toEqual([]);
  });
});

describe("validateVariables", () => {
  it("reports valid:true when every variable resolves", () => {
    const result = validateVariables("{{org.name}} {{period.label}}", ctx);
    expect(result).toEqual({ valid: true, missing: [] });
  });

  it("reports valid:false and lists missing variables", () => {
    const result = validateVariables(
      "{{org.name}} {{nonexistent.field}} {{xss.value}}",
      ctx,
    );
    expect(result.valid).toBe(false);
    expect(result.missing.sort()).toEqual(
      ["nonexistent.field", "xss.value"].sort(),
    );
  });

  it("treats single-word references as missing", () => {
    const result = validateVariables("{{title}}", ctx);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("title");
  });
});
