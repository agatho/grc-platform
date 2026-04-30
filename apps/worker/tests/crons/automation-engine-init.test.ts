import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@grc/db", async () => {
  const { dbMockFactory } = await import("../helpers/db-proxy");
  return dbMockFactory();
});
vi.mock("@grc/events", async () => { const { eventsMockFactory } = await import("../helpers/db-proxy"); return eventsMockFactory(); });
vi.mock("@grc/automation", async () => { const { automationMockFactory } = await import("../helpers/db-proxy"); return automationMockFactory(); });

import { resetMockDb } from "../helpers/db-proxy";
import { chainable } from "../helpers/mock-db";

describe("initAutomationEngine", () => {
  beforeEach(() => {
    const m = resetMockDb();
    m.select.mockReturnValue(chainable([]));
    m.execute.mockResolvedValue([]);
  });

  it("smoke: import and run without throwing", async () => {
    const mod: Record<string, unknown> = await import("../../src/crons/automation-engine-init");
    const fn = mod["initAutomationEngine"];
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
