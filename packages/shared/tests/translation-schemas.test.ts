// Sprint 21: Translation Zod Schema Validation Tests
import { describe, it, expect } from "vitest";
import {
  updateOrgLanguagesSchema,
  updateUserContentLanguageSchema,
  saveTranslationSchema,
  aiTranslateSchema,
  aiBatchTranslateSchema,
  updateTranslationStatusSchema,
  translationQueueFilterSchema,
  translationProgressQuerySchema,
  xliffImportSchema,
  csvImportSchema,
  translationExportQuerySchema,
  verifyTranslationSchema,
  translatableFieldSchema,
} from "../src/schemas/translation";

describe("updateOrgLanguagesSchema", () => {
  it("should accept valid language config", () => {
    const result = updateOrgLanguagesSchema.safeParse({
      defaultLanguage: "de",
      activeLanguages: ["de", "en"],
    });
    expect(result.success).toBe(true);
  });

  it("should require at least one active language", () => {
    const result = updateOrgLanguagesSchema.safeParse({
      activeLanguages: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject unsupported languages", () => {
    const result = updateOrgLanguagesSchema.safeParse({
      activeLanguages: ["de", "xx"],
    });
    expect(result.success).toBe(false);
  });

  it("should accept max 8 languages", () => {
    const result = updateOrgLanguagesSchema.safeParse({
      activeLanguages: ["de", "en", "fr", "nl", "it", "es", "pl", "cs"],
    });
    expect(result.success).toBe(true);
  });

  it("should allow partial update (only defaultLanguage)", () => {
    const result = updateOrgLanguagesSchema.safeParse({
      defaultLanguage: "en",
    });
    expect(result.success).toBe(true);
  });
});

describe("updateUserContentLanguageSchema", () => {
  it("should accept a valid language", () => {
    const result = updateUserContentLanguageSchema.safeParse({
      contentLanguage: "en",
    });
    expect(result.success).toBe(true);
  });

  it("should accept null to reset", () => {
    const result = updateUserContentLanguageSchema.safeParse({
      contentLanguage: null,
    });
    expect(result.success).toBe(true);
  });

  it("should reject unsupported language", () => {
    const result = updateUserContentLanguageSchema.safeParse({
      contentLanguage: "xx",
    });
    expect(result.success).toBe(false);
  });
});

describe("saveTranslationSchema", () => {
  it("should accept valid field translations", () => {
    const result = saveTranslationSchema.safeParse({
      fields: { title: "Supply Chain Risk", description: "Risk of disruption" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty fields", () => {
    const result = saveTranslationSchema.safeParse({
      fields: {},
    });
    expect(result.success).toBe(false);
  });

  it("should reject field value exceeding max length", () => {
    const result = saveTranslationSchema.safeParse({
      fields: { title: "a".repeat(50001) },
    });
    expect(result.success).toBe(false);
  });
});

describe("aiTranslateSchema", () => {
  it("should accept valid translate request", () => {
    const result = aiTranslateSchema.safeParse({
      entityType: "risk",
      entityId: "550e8400-e29b-41d4-a716-446655440000",
      targetLanguages: ["en", "fr"],
    });
    expect(result.success).toBe(true);
  });

  it("should accept with optional fields", () => {
    const result = aiTranslateSchema.safeParse({
      entityType: "control",
      entityId: "550e8400-e29b-41d4-a716-446655440000",
      fields: ["title"],
      targetLanguages: ["en"],
      sourceLanguage: "de",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid entity type", () => {
    const result = aiTranslateSchema.safeParse({
      entityType: "invalid_type",
      entityId: "550e8400-e29b-41d4-a716-446655440000",
      targetLanguages: ["en"],
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty targetLanguages", () => {
    const result = aiTranslateSchema.safeParse({
      entityType: "risk",
      entityId: "550e8400-e29b-41d4-a716-446655440000",
      targetLanguages: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("aiBatchTranslateSchema", () => {
  it("should accept valid batch request", () => {
    const result = aiBatchTranslateSchema.safeParse({
      entities: [
        {
          entityType: "risk",
          entityId: "550e8400-e29b-41d4-a716-446655440000",
        },
        {
          entityType: "control",
          entityId: "550e8400-e29b-41d4-a716-446655440001",
        },
      ],
      targetLanguages: ["en"],
    });
    expect(result.success).toBe(true);
  });

  it("should enforce max 100 entities", () => {
    const entities = Array.from({ length: 101 }, (_, i) => ({
      entityType: "risk" as const,
      entityId: `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, "0")}`,
    }));
    const result = aiBatchTranslateSchema.safeParse({
      entities,
      targetLanguages: ["en"],
    });
    expect(result.success).toBe(false);
  });
});

describe("translationQueueFilterSchema", () => {
  it("should accept valid filter params", () => {
    const result = translationQueueFilterSchema.safeParse({
      entityType: "risk",
      targetLocale: "en",
      status: "missing",
      page: 1,
      limit: 20,
    });
    expect(result.success).toBe(true);
  });

  it("should default page and limit", () => {
    const result = translationQueueFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it("should cap limit at 100", () => {
    const result = translationQueueFilterSchema.safeParse({
      limit: 200,
    });
    expect(result.success).toBe(false);
  });
});

describe("translationProgressQuerySchema", () => {
  it("should require targetLocale", () => {
    const result = translationProgressQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should accept with optional entityType", () => {
    const result = translationProgressQuerySchema.safeParse({
      targetLocale: "en",
      entityType: "risk",
    });
    expect(result.success).toBe(true);
  });
});

describe("translationExportQuerySchema", () => {
  it("should accept valid export params", () => {
    const result = translationExportQuerySchema.safeParse({
      entityType: "risk",
      source: "de",
      target: "en",
      format: "xliff",
    });
    expect(result.success).toBe(true);
  });

  it("should default format to xliff", () => {
    const result = translationExportQuerySchema.safeParse({
      entityType: "control",
      source: "de",
      target: "en",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toBe("xliff");
    }
  });
});

describe("verifyTranslationSchema", () => {
  it("should accept valid verify request", () => {
    const result = verifyTranslationSchema.safeParse({
      entityType: "risk",
      entityId: "550e8400-e29b-41d4-a716-446655440000",
      field: "title",
      language: "en",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid language", () => {
    const result = verifyTranslationSchema.safeParse({
      entityType: "risk",
      entityId: "550e8400-e29b-41d4-a716-446655440000",
      field: "title",
      language: "xx",
    });
    expect(result.success).toBe(false);
  });
});

describe("translatableFieldSchema", () => {
  it("should accept a string", () => {
    const result = translatableFieldSchema.safeParse("plain text");
    expect(result.success).toBe(true);
  });

  it("should accept a JSONB object", () => {
    const result = translatableFieldSchema.safeParse({
      de: "Risiko",
      en: "Risk",
    });
    expect(result.success).toBe(true);
  });

  it("should reject a number", () => {
    const result = translatableFieldSchema.safeParse(42);
    expect(result.success).toBe(false);
  });
});
