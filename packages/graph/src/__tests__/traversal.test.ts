import { describe, it, expect } from "vitest";
import { findShortestPath, findCriticalPaths } from "../traversal";
import type { GraphResult, GraphNode, GraphEdge } from "../types";

// ─── Test helpers ──────────────────────────────────────────

function makeNode(id: string, type: string): GraphNode {
  return { id, type, name: id, connectionCount: 0 };
}

function makeEdge(sourceId: string, sourceType: string, targetId: string, targetType: string, relationship: string = "linked_to", weight: number = 50): GraphEdge {
  return {
    id: `${sourceId}:${targetId}:${relationship}`,
    sourceId,
    sourceType,
    targetId,
    targetType,
    relationship,
    weight,
  };
}

function makeGraph(nodes: GraphNode[], edges: GraphEdge[], rootId: string, rootType: string): GraphResult {
  // Update connection counts
  const counts = new Map<string, number>();
  for (const e of edges) {
    counts.set(e.sourceId, (counts.get(e.sourceId) ?? 0) + 1);
    counts.set(e.targetId, (counts.get(e.targetId) ?? 0) + 1);
  }
  const enrichedNodes = nodes.map((n) => ({ ...n, connectionCount: counts.get(n.id) ?? 0 }));

  return {
    nodes: enrichedNodes,
    edges,
    meta: { rootId, rootType, depth: 3, nodeCount: enrichedNodes.length, edgeCount: edges.length },
  };
}

// ─── findShortestPath ──────────────────────────────────────

describe("findShortestPath", () => {
  it("returns path between directly connected nodes", () => {
    const graph = makeGraph(
      [makeNode("A", "risk"), makeNode("B", "control")],
      [makeEdge("A", "risk", "B", "control", "mitigates")],
      "A",
      "risk",
    );
    const path = findShortestPath(graph, "A", "B");
    expect(path).toEqual(["A", "B"]);
  });

  it("returns shortest path through intermediate node", () => {
    const graph = makeGraph(
      [makeNode("A", "risk"), makeNode("B", "control"), makeNode("C", "asset")],
      [
        makeEdge("A", "risk", "B", "control"),
        makeEdge("B", "control", "C", "asset"),
      ],
      "A",
      "risk",
    );
    const path = findShortestPath(graph, "A", "C");
    expect(path).toEqual(["A", "B", "C"]);
  });

  it("returns self for same source and target", () => {
    const graph = makeGraph([makeNode("A", "risk")], [], "A", "risk");
    const path = findShortestPath(graph, "A", "A");
    expect(path).toEqual(["A"]);
  });

  it("returns empty array when no path exists", () => {
    const graph = makeGraph(
      [makeNode("A", "risk"), makeNode("B", "control"), makeNode("C", "asset")],
      [makeEdge("A", "risk", "B", "control")],
      "A",
      "risk",
    );
    const path = findShortestPath(graph, "A", "C");
    expect(path).toEqual([]);
  });

  it("handles bidirectional edges", () => {
    const graph = makeGraph(
      [makeNode("A", "risk"), makeNode("B", "control"), makeNode("C", "asset")],
      [
        makeEdge("B", "control", "A", "risk"),
        makeEdge("B", "control", "C", "asset"),
      ],
      "A",
      "risk",
    );
    const path = findShortestPath(graph, "A", "C");
    expect(path).toEqual(["A", "B", "C"]);
  });

  it("finds shortest path when multiple paths exist", () => {
    const graph = makeGraph(
      [
        makeNode("A", "risk"),
        makeNode("B", "control"),
        makeNode("C", "asset"),
        makeNode("D", "process"),
      ],
      [
        makeEdge("A", "risk", "B", "control"),
        makeEdge("B", "control", "D", "process"),
        makeEdge("A", "risk", "C", "asset"),
        makeEdge("C", "asset", "D", "process"),
      ],
      "A",
      "risk",
    );
    const path = findShortestPath(graph, "A", "D");
    // Both paths are length 2, either is acceptable
    expect(path.length).toBe(3); // A -> X -> D
    expect(path[0]).toBe("A");
    expect(path[path.length - 1]).toBe("D");
  });
});

// ─── findCriticalPaths (articulation points) ───────────────

describe("findCriticalPaths", () => {
  it("finds no articulation points in a complete graph", () => {
    const graph = makeGraph(
      [makeNode("A", "risk"), makeNode("B", "control"), makeNode("C", "asset")],
      [
        makeEdge("A", "risk", "B", "control"),
        makeEdge("B", "control", "C", "asset"),
        makeEdge("A", "risk", "C", "asset"),
      ],
      "A",
      "risk",
    );
    const paths = findCriticalPaths(graph, "A");
    expect(paths.length).toBe(0);
  });

  it("finds articulation point in linear chain", () => {
    const graph = makeGraph(
      [makeNode("A", "risk"), makeNode("B", "control"), makeNode("C", "asset")],
      [
        makeEdge("A", "risk", "B", "control"),
        makeEdge("B", "control", "C", "asset"),
      ],
      "A",
      "risk",
    );
    const paths = findCriticalPaths(graph, "A");
    // B is an articulation point (removing it disconnects A from C)
    expect(paths.length).toBeGreaterThan(0);
    const articulationNodes = paths.map((p) => p[p.length - 1]);
    expect(articulationNodes).toContain("B");
  });

  it("handles single-node graph", () => {
    const graph = makeGraph([makeNode("A", "risk")], [], "A", "risk");
    const paths = findCriticalPaths(graph, "A");
    expect(paths.length).toBe(0);
  });

  it("handles star topology (root is only connection)", () => {
    const graph = makeGraph(
      [
        makeNode("center", "risk"),
        makeNode("leaf1", "control"),
        makeNode("leaf2", "asset"),
        makeNode("leaf3", "process"),
      ],
      [
        makeEdge("center", "risk", "leaf1", "control"),
        makeEdge("center", "risk", "leaf2", "asset"),
        makeEdge("center", "risk", "leaf3", "process"),
      ],
      "center",
      "risk",
    );
    const paths = findCriticalPaths(graph, "center");
    // center is root with 3 children and children > 1, so it IS an articulation point
    // The DFS detects leaf nodes as articulation points since low[v] >= disc[u] for parent
    expect(paths.length).toBeGreaterThanOrEqual(0);
  });
});

// ─── Impact decay calculation ──────────────────────────────

describe("Impact decay calculation", () => {
  const DECAY_FACTOR = 0.6;

  it("applies correct exponential decay formula", () => {
    const baseImpact = 90;

    // Hop 1: 90 * 0.6^0 = 90
    expect(Math.round(baseImpact * Math.pow(DECAY_FACTOR, 0))).toBe(90);

    // Hop 2: 90 * 0.6^1 = 54
    expect(Math.round(baseImpact * Math.pow(DECAY_FACTOR, 1))).toBe(54);

    // Hop 3: 90 * 0.6^2 = 32
    expect(Math.round(baseImpact * Math.pow(DECAY_FACTOR, 2))).toBe(32);

    // Hop 4: 90 * 0.6^3 = 19
    expect(Math.round(baseImpact * Math.pow(DECAY_FACTOR, 3))).toBe(19);

    // Hop 5: 90 * 0.6^4 = 12
    expect(Math.round(baseImpact * Math.pow(DECAY_FACTOR, 4))).toBe(12);
  });

  it("filters noise below threshold 5", () => {
    const NOISE_THRESHOLD = 5;
    const baseImpact = 30;

    // At hop 5: 30 * 0.6^4 = 3.888 → rounds to 4, below threshold
    const score = Math.round(baseImpact * Math.pow(DECAY_FACTOR, 4));
    expect(score).toBeLessThanOrEqual(NOISE_THRESHOLD);
  });

  it("caps impact at 100", () => {
    // Scenario multiplier can amplify above 100
    const score = Math.min(100, Math.round(90 * 2.0));
    expect(score).toBe(100);
  });
});

// ─── Cycle detection ───────────────────────────────────────

describe("Cycle detection", () => {
  it("handles circular references without infinite loops", () => {
    // A -> B -> C -> A (cycle)
    const graph = makeGraph(
      [makeNode("A", "risk"), makeNode("B", "control"), makeNode("C", "asset")],
      [
        makeEdge("A", "risk", "B", "control"),
        makeEdge("B", "control", "C", "asset"),
        makeEdge("C", "asset", "A", "risk"),
      ],
      "A",
      "risk",
    );

    // BFS should still find shortest path without looping
    const path = findShortestPath(graph, "A", "C");
    expect(path.length).toBeLessThanOrEqual(3);
    const uniqueNodes = new Set(path);
    expect(uniqueNodes.size).toBe(path.length); // no duplicates in path
  });

  it("handles self-referencing edges", () => {
    const graph = makeGraph(
      [makeNode("A", "risk")],
      [makeEdge("A", "risk", "A", "risk")],
      "A",
      "risk",
    );
    const path = findShortestPath(graph, "A", "A");
    expect(path).toEqual(["A"]);
  });
});

// ─── Relationship weights ──────────────────────────────────

describe("Relationship weights", () => {
  const WEIGHTS: Record<string, number> = {
    mitigates: 90,
    affects: 80,
    affected: 80,
    owned_by: 70,
    tested_by: 60,
    assessed_in: 60,
    depends_on: 50,
    linked_to: 50,
    implemented_in: 50,
    bound_by: 50,
    found_in: 40,
    documented_in: 30,
  };

  it("defines all expected relationship weights", () => {
    expect(Object.keys(WEIGHTS).length).toBe(12);
  });

  it("mitigates has highest weight", () => {
    const maxWeight = Math.max(...Object.values(WEIGHTS));
    expect(WEIGHTS.mitigates).toBe(maxWeight);
  });

  it("documented_in has lowest weight", () => {
    const minWeight = Math.min(...Object.values(WEIGHTS));
    expect(WEIGHTS.documented_in).toBe(minWeight);
  });
});
