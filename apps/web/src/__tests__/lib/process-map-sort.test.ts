// Prozesslandkarte — manual sort helper (pure function).

import { describe, it, expect } from "vitest";
import { moveItemInBand } from "../../lib/process-map";

describe("moveItemInBand", () => {
  const items = ["a", "b", "c", "d"];

  it("moves an item up (swap with predecessor)", () => {
    expect(moveItemInBand(items, 2, "up")).toEqual(["a", "c", "b", "d"]);
  });

  it("moves an item down (swap with successor)", () => {
    expect(moveItemInBand(items, 1, "down")).toEqual(["a", "c", "b", "d"]);
  });

  it("keeps the order when the first item moves up", () => {
    expect(moveItemInBand(items, 0, "up")).toEqual(items);
  });

  it("keeps the order when the last item moves down", () => {
    expect(moveItemInBand(items, items.length - 1, "down")).toEqual(items);
  });

  it("ignores out-of-range indices", () => {
    expect(moveItemInBand(items, -1, "down")).toEqual(items);
    expect(moveItemInBand(items, 99, "up")).toEqual(items);
  });

  it("is pure — the input array is never mutated", () => {
    const input = ["x", "y", "z"];
    const result = moveItemInBand(input, 0, "down");
    expect(input).toEqual(["x", "y", "z"]);
    expect(result).toEqual(["y", "x", "z"]);
    expect(result).not.toBe(input);
  });

  it("handles single-element and empty bands", () => {
    expect(moveItemInBand(["solo"], 0, "up")).toEqual(["solo"]);
    expect(moveItemInBand([], 0, "down")).toEqual([]);
  });
});
