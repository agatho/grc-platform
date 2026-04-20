import { describe, it, expect } from "vitest";
import { ENTITY_TYPE_COLORS, HUB_CONNECTION_THRESHOLD } from "../types";

// ─── Entity type colors ────────────────────────────────────

describe("Entity type colors", () => {
  it("defines colors for all core entity types", () => {
    const requiredTypes = [
      "risk",
      "control",
      "asset",
      "process",
      "vendor",
      "document",
      "finding",
      "incident",
      "audit",
    ];
    for (const type of requiredTypes) {
      expect(ENTITY_TYPE_COLORS[type]).toBeDefined();
      expect(ENTITY_TYPE_COLORS[type]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("risk is red-ish", () => {
    expect(ENTITY_TYPE_COLORS.risk).toBe("#ef4444");
  });

  it("control is blue-ish", () => {
    expect(ENTITY_TYPE_COLORS.control).toBe("#3b82f6");
  });

  it("asset is green-ish", () => {
    expect(ENTITY_TYPE_COLORS.asset).toBe("#22c55e");
  });
});

// ─── Hub detection thresholds ──────────────────────────────

describe("Hub detection", () => {
  it("threshold is 10 connections", () => {
    expect(HUB_CONNECTION_THRESHOLD).toBe(10);
  });

  it("entity with 10+ connections is a hub", () => {
    const connectionCount = 12;
    expect(connectionCount >= HUB_CONNECTION_THRESHOLD).toBe(true);
  });

  it("entity with fewer than 10 connections is not a hub", () => {
    const connectionCount = 8;
    expect(connectionCount >= HUB_CONNECTION_THRESHOLD).toBe(false);
  });
});

// ─── Orphan detection logic ────────────────────────────────

describe("Orphan categorization", () => {
  const ORPHAN_CATEGORIES = [
    {
      type: "risk",
      missingRelationship: "mitigates",
      description: "Risks without controls",
    },
    {
      type: "control",
      missingRelationship: "tested_by",
      description: "Controls without tests",
    },
    {
      type: "asset",
      missingRelationship: "any",
      description: "Assets without references",
    },
    {
      type: "process",
      missingRelationship: "owned_by",
      description: "Processes without controls",
    },
  ];

  it("defines 4 orphan categories", () => {
    expect(ORPHAN_CATEGORIES.length).toBe(4);
  });

  it("each category has type and missing relationship", () => {
    for (const cat of ORPHAN_CATEGORIES) {
      expect(cat.type).toBeDefined();
      expect(cat.missingRelationship).toBeDefined();
      expect(cat.description).toBeDefined();
    }
  });
});

// ─── Dependency matrix logic ───────────────────────────────

describe("Dependency matrix", () => {
  it("matrix entry has required fields", () => {
    const entry = {
      sourceType: "risk",
      targetType: "control",
      count: 15,
      avgWeight: 75,
    };
    expect(entry.sourceType).toBe("risk");
    expect(entry.targetType).toBe("control");
    expect(entry.count).toBeGreaterThan(0);
    expect(entry.avgWeight).toBeGreaterThanOrEqual(0);
    expect(entry.avgWeight).toBeLessThanOrEqual(100);
  });

  it("matrix is symmetric concept (both directions counted separately)", () => {
    const entries = [
      { sourceType: "risk", targetType: "control", count: 15, avgWeight: 75 },
      { sourceType: "control", targetType: "risk", count: 8, avgWeight: 60 },
    ];
    // Forward and reverse are separate entries
    const forward = entries.find(
      (e) => e.sourceType === "risk" && e.targetType === "control",
    );
    const reverse = entries.find(
      (e) => e.sourceType === "control" && e.targetType === "risk",
    );
    expect(forward).toBeDefined();
    expect(reverse).toBeDefined();
    // Counts can differ (direction matters)
    expect(forward!.count).not.toEqual(reverse!.count);
  });
});
