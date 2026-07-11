// Prozesslandkarte — pure grouping + inheritance logic.
// Used by GET /api/v1/processes/map and unit-tested in isolation.

import type { ProcessMapCategory, ProcessStatus } from "@grc/shared";

/** A band on the map: the three value-chain bands + the fallback strip. */
export type ProcessMapBand = ProcessMapCategory | "unassigned";

/** One tile on the process map. */
export interface ProcessMapItem {
  id: string;
  name: string;
  status: ProcessStatus;
  level: number;
  mapCategory: ProcessMapCategory | null;
  childCount: number;
  hasDiagram: boolean;
}

/** Map payload: items of one hierarchy level grouped into bands. */
export interface ProcessMapGroups {
  management: ProcessMapItem[];
  core: ProcessMapItem[];
  support: ProcessMapItem[];
  unassigned: ProcessMapItem[];
}

/**
 * Resolve the effective band of a process from its ancestor chain
 * (self first, then parent, grandparent, …). The first explicitly set
 * category wins — children without a category inherit the closest
 * categorized ancestor's band. Returns null when nothing in the chain
 * is categorized.
 */
export function resolveInheritedCategory(
  chain: Array<{ mapCategory: ProcessMapCategory | null }>,
): ProcessMapCategory | null {
  for (const node of chain) {
    if (node.mapCategory) return node.mapCategory;
  }
  return null;
}

/**
 * Group the processes of one hierarchy level into the map bands.
 *
 * - A process with its own `mapCategory` goes into that band.
 * - A process without one inherits `parentCategory` (the effective band
 *   of the drilled-into parent).
 * - At root level (no parent / uncategorized chain) it lands in the
 *   "unassigned" strip so nothing becomes invisible.
 */
/**
 * Move one tile up/down inside its band (manual sort mode). Pure —
 * returns a new array; out-of-range moves return the input unchanged.
 */
export function moveItemInBand<T>(
  items: readonly T[],
  index: number,
  direction: "up" | "down",
): T[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= items.length) return items.slice();
  if (target < 0 || target >= items.length) return items.slice();
  const next = items.slice();
  const tmp = next[index];
  next[index] = next[target];
  next[target] = tmp;
  return next;
}

export function groupProcessesForMap(
  items: ProcessMapItem[],
  parentCategory: ProcessMapCategory | null = null,
): ProcessMapGroups {
  const groups: ProcessMapGroups = {
    management: [],
    core: [],
    support: [],
    unassigned: [],
  };
  for (const item of items) {
    const band: ProcessMapBand =
      item.mapCategory ?? parentCategory ?? "unassigned";
    groups[band].push(item);
  }
  return groups;
}
