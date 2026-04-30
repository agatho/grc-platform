import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@grc/db", async () => {
  const { dbMockFactory } = await import("../helpers/db-proxy");
  return dbMockFactory();
});
vi.mock("@grc/ai", () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0, 0, 0]),
}));

import { resetMockDb } from "../helpers/db-proxy";
import { chainable } from "../helpers/mock-db";

describe("processCopilotRagIndexer", () => {
  let mockDb = resetMockDb();
  beforeEach(() => {
    mockDb = resetMockDb();
    mockDb.select.mockReturnValue(chainable([]));
    mockDb.execute.mockResolvedValue([]);
  });

  it("smoke: runs without throwing", async () => {
    const { processCopilotRagIndexer } = await import(
      "../../src/crons/copilot-rag-indexer"
    );
    await expect(processCopilotRagIndexer()).resolves.toBeDefined();
  });
});
