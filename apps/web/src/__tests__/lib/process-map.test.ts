// Prozesslandkarte — pure grouping + band-inheritance logic.

import { describe, it, expect } from "vitest";
import {
  groupProcessesForMap,
  resolveInheritedCategory,
  type ProcessMapItem,
} from "@/lib/process-map";

function item(overrides: Partial<ProcessMapItem> = {}): ProcessMapItem {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Test process",
    status: "published",
    level: 1,
    mapCategory: null,
    childCount: 0,
    hasDiagram: false,
    ...overrides,
  };
}

describe("resolveInheritedCategory", () => {
  it("returns null for an empty chain", () => {
    expect(resolveInheritedCategory([])).toBeNull();
  });

  it("returns null when nothing in the chain is categorized", () => {
    expect(
      resolveInheritedCategory([{ mapCategory: null }, { mapCategory: null }]),
    ).toBeNull();
  });

  it("uses the node's own category first (self before ancestors)", () => {
    expect(
      resolveInheritedCategory([
        { mapCategory: "support" },
        { mapCategory: "core" },
      ]),
    ).toBe("support");
  });

  it("inherits from the closest categorized ancestor", () => {
    expect(
      resolveInheritedCategory([
        { mapCategory: null },
        { mapCategory: null },
        { mapCategory: "management" },
      ]),
    ).toBe("management");
  });
});

describe("groupProcessesForMap", () => {
  it("groups by own category and puts uncategorized root items into 'unassigned'", () => {
    const items = [
      item({ id: "a", mapCategory: "management" }),
      item({ id: "b", mapCategory: "core" }),
      item({ id: "c", mapCategory: "support" }),
      item({ id: "d", mapCategory: null }),
    ];
    const groups = groupProcessesForMap(items, null);
    expect(groups.management.map((i) => i.id)).toEqual(["a"]);
    expect(groups.core.map((i) => i.id)).toEqual(["b"]);
    expect(groups.support.map((i) => i.id)).toEqual(["c"]);
    expect(groups.unassigned.map((i) => i.id)).toEqual(["d"]);
  });

  it("lets uncategorized children inherit the parent's band", () => {
    const items = [
      item({ id: "a", mapCategory: null }),
      item({ id: "b", mapCategory: "support" }),
    ];
    const groups = groupProcessesForMap(items, "core");
    expect(groups.core.map((i) => i.id)).toEqual(["a"]);
    // Own category always wins over the inherited band
    expect(groups.support.map((i) => i.id)).toEqual(["b"]);
    expect(groups.unassigned).toHaveLength(0);
  });

  it("preserves input order within each band", () => {
    const items = [
      item({ id: "a", mapCategory: "core", name: "A" }),
      item({ id: "b", mapCategory: "core", name: "B" }),
      item({ id: "c", mapCategory: "core", name: "C" }),
    ];
    const groups = groupProcessesForMap(items, null);
    expect(groups.core.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("returns four empty bands for an empty level", () => {
    const groups = groupProcessesForMap([], "management");
    expect(groups).toEqual({
      management: [],
      core: [],
      support: [],
      unassigned: [],
    });
  });
});
