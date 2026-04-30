import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@grc/db", async () => {
  const { dbMockFactory } = await import("../helpers/db-proxy");
  return dbMockFactory();
});
global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response);

import { resetMockDb } from "../helpers/db-proxy";
import { chainable } from "../helpers/mock-db";

describe("processInterfaceHealthCheck", () => {
  beforeEach(() => {
    const m = resetMockDb();
    m.select.mockReturnValue(chainable([]));
    m.execute.mockResolvedValue([]);
  });

  it("smoke: import and run without throwing", async () => {
    const mod: Record<string, unknown> = await import("../../src/crons/interface-health-check");
    const fn = mod["processInterfaceHealthCheck"];
    expect(typeof fn).toBe("function");
    let threw = false;
    try {
      await Promise.resolve((fn as () => unknown)());
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
