import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@grc/db", async () => {
  const { dbMockFactory } = await import("../helpers/db-proxy");
  return dbMockFactory();
});
vi.mock("@grc/ai", async () => { const { aiMockFactory } = await import("../helpers/db-proxy"); return aiMockFactory(); });

import { resetMockDb } from "../helpers/db-proxy";
import { chainable } from "../helpers/mock-db";

describe("processRegulatoryRelevanceScorer", () => {
  beforeEach(() => {
    const m = resetMockDb();
    m.select.mockReturnValue(chainable([]));
    m.execute.mockResolvedValue([]);
  });

  it("smoke: import and run without throwing", async () => {
    const mod: Record<string, unknown> = await import("../../src/crons/regulatory-relevance-scorer");
    const fn = mod["processRegulatoryRelevanceScorer"];
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
