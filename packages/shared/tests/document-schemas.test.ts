// Unit tests for Sprint 4 Document Management System (DMS) Zod schemas
// Tests document CRUD, status transitions, entity links

import { describe, it, expect } from "vitest";
import {
  createDocumentSchema,
  documentStatusTransitionSchema,
  createDocumentEntityLinkSchema,
  VALID_DOCUMENT_TRANSITIONS,
} from "../src/schemas";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

// ---------------------------------------------------------------------------
// createDocumentSchema
// ---------------------------------------------------------------------------

describe("createDocumentSchema", () => {
  it("accepts valid document with required fields only", () => {
    const result = createDocumentSchema.safeParse({
      title: "Information Security Policy",
    });
    expect(result.success).toBe(true);
  });

  it("applies default values", () => {
    const result = createDocumentSchema.safeParse({
      title: "Default Test",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe("other");
      expect(result.data.requiresAcknowledgment).toBe(false);
      expect(result.data.tags).toEqual([]);
    }
  });

  it("accepts all valid categories", () => {
    const cats = [
      "policy", "procedure", "guideline", "template",
      "record", "tom", "dpa", "bcp", "soa", "other",
    ];
    for (const category of cats) {
      const result = createDocumentSchema.safeParse({ title: "Doc", category });
      expect(result.success).toBe(true);
    }
  });

  it("accepts document with all optional fields", () => {
    const result = createDocumentSchema.safeParse({
      title: "GDPR Data Processing Agreement",
      content: "Full DPA content here...",
      category: "dpa",
      requiresAcknowledgment: true,
      tags: ["gdpr", "dpa", "privacy"],
      ownerId: UUID,
      reviewerId: UUID,
      approverId: UUID,
      expiresAt: "2027-01-01T00:00:00Z",
      reviewDate: "2026-06-15T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = createDocumentSchema.safeParse({
      category: "policy",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = createDocumentSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title exceeding 500 characters", () => {
    const result = createDocumentSchema.safeParse({
      title: "T".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category", () => {
    const result = createDocumentSchema.safeParse({
      title: "Doc",
      category: "manual",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID ownerId", () => {
    const result = createDocumentSchema.safeParse({
      title: "Doc",
      ownerId: "bad-id",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid datetime for expiresAt", () => {
    const result = createDocumentSchema.safeParse({
      title: "Doc",
      expiresAt: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid datetime for reviewDate", () => {
    const result = createDocumentSchema.safeParse({
      title: "Doc",
      reviewDate: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// documentStatusTransitionSchema
// ---------------------------------------------------------------------------

describe("documentStatusTransitionSchema", () => {
  it("accepts valid document status", () => {
    const result = documentStatusTransitionSchema.safeParse({
      status: "in_review",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid document statuses", () => {
    for (const s of ["draft", "in_review", "approved", "published", "archived", "expired"]) {
      const result = documentStatusTransitionSchema.safeParse({ status: s });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid document status", () => {
    const result = documentStatusTransitionSchema.safeParse({
      status: "pending",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing status", () => {
    const result = documentStatusTransitionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// VALID_DOCUMENT_TRANSITIONS
// ---------------------------------------------------------------------------

describe("VALID_DOCUMENT_TRANSITIONS", () => {
  it("allows draft -> in_review", () => {
    expect(VALID_DOCUMENT_TRANSITIONS["draft"]).toContain("in_review");
  });

  it("allows in_review -> approved", () => {
    expect(VALID_DOCUMENT_TRANSITIONS["in_review"]).toContain("approved");
  });

  it("allows approved -> published", () => {
    expect(VALID_DOCUMENT_TRANSITIONS["approved"]).toContain("published");
  });

  it("allows published -> archived", () => {
    expect(VALID_DOCUMENT_TRANSITIONS["published"]).toContain("archived");
  });

  it("allows published -> expired", () => {
    expect(VALID_DOCUMENT_TRANSITIONS["published"]).toContain("expired");
  });

  it("allows expired -> draft (restart)", () => {
    expect(VALID_DOCUMENT_TRANSITIONS["expired"]).toContain("draft");
  });

  it("does not allow draft -> published (must go through review)", () => {
    expect(VALID_DOCUMENT_TRANSITIONS["draft"]).not.toContain("published");
  });

  it("does not allow draft -> approved", () => {
    expect(VALID_DOCUMENT_TRANSITIONS["draft"]).not.toContain("approved");
  });

  it("allows in_review -> draft (send back)", () => {
    expect(VALID_DOCUMENT_TRANSITIONS["in_review"]).toContain("draft");
  });
});

// ---------------------------------------------------------------------------
// createDocumentEntityLinkSchema
// ---------------------------------------------------------------------------

describe("createDocumentEntityLinkSchema", () => {
  it("accepts valid entity link", () => {
    const result = createDocumentEntityLinkSchema.safeParse({
      documentId: UUID,
      entityType: "risk",
      entityId: UUID,
    });
    expect(result.success).toBe(true);
  });

  it("accepts link with optional description", () => {
    const result = createDocumentEntityLinkSchema.safeParse({
      documentId: UUID,
      entityType: "control",
      entityId: UUID,
      linkDescription: "Supporting evidence for control effectiveness",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing documentId", () => {
    const result = createDocumentEntityLinkSchema.safeParse({
      entityType: "risk",
      entityId: UUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID documentId", () => {
    const result = createDocumentEntityLinkSchema.safeParse({
      documentId: "not-uuid",
      entityType: "risk",
      entityId: UUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing entityType", () => {
    const result = createDocumentEntityLinkSchema.safeParse({
      documentId: UUID,
      entityId: UUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty entityType", () => {
    const result = createDocumentEntityLinkSchema.safeParse({
      documentId: UUID,
      entityType: "",
      entityId: UUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing entityId", () => {
    const result = createDocumentEntityLinkSchema.safeParse({
      documentId: UUID,
      entityType: "control",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID entityId", () => {
    const result = createDocumentEntityLinkSchema.safeParse({
      documentId: UUID,
      entityType: "control",
      entityId: "abc123",
    });
    expect(result.success).toBe(false);
  });
});
