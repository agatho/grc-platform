import { describe, it, expect } from "vitest";
import { createPluginSchema, updatePluginSchema } from "../src/schemas";

// F#9 (overnight 2026-05-18): no sandboxed runtime exists yet, so the
// Zod schema for plugin registration must reject executionMode='native'.
// Otherwise an admin (or anyone with the registration path) could ship
// arbitrary code into the worker process.

const validBase = {
  key: "test-plugin",
  name: "Test plugin",
  version: "1.0.0",
  entryPoint: "main.wasm",
};

describe("plugin executionMode guard", () => {
  it("accepts wasm", () => {
    const r = createPluginSchema.safeParse({
      ...validBase,
      executionMode: "wasm",
    });
    expect(r.success).toBe(true);
  });

  it("accepts isolated", () => {
    const r = createPluginSchema.safeParse({
      ...validBase,
      executionMode: "isolated",
    });
    expect(r.success).toBe(true);
  });

  it("rejects native", () => {
    const r = createPluginSchema.safeParse({
      ...validBase,
      executionMode: "native",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a bogus mode", () => {
    const r = createPluginSchema.safeParse({
      ...validBase,
      executionMode: "shell",
    });
    expect(r.success).toBe(false);
  });

  it("rejects native on UPDATE too", () => {
    const r = updatePluginSchema.safeParse({
      executionMode: "native",
    });
    expect(r.success).toBe(false);
  });

  it("defaults to wasm when omitted", () => {
    const r = createPluginSchema.safeParse(validBase);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.executionMode).toBe("wasm");
  });
});
