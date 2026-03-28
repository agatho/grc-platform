import { z } from "zod";

// ── Supported languages ────────────────────────────────────────

const supportedLanguages = ["de", "en", "fr", "nl", "it", "es", "pl", "cs"] as const;
const translationStatusValues = ["original", "draft_translation", "verified", "outdated"] as const;
const translationMethodValues = ["manual", "ai_claude", "ai_ollama", "xliff_import", "csv_import"] as const;
const translatableEntityTypes = [
  "risk", "control", "process", "document", "finding", "incident",
  "risk_catalog_entry", "control_catalog_entry",
] as const;

// ── Translatable field schema ─────────────────────────────────

/** A JSONB field that holds translations: { "de": "text", "en": "text" } */
export const translatableFieldSchema = z.union([
  z.string(),
  z.record(z.string(), z.string()),
]);

// ── Language configuration ────────────────────────────────────

export const updateOrgLanguagesSchema = z.object({
  defaultLanguage: z.enum(supportedLanguages).optional(),
  activeLanguages: z
    .array(z.enum(supportedLanguages))
    .min(1, "At least one language must be active")
    .max(8)
    .optional(),
});

export const updateUserContentLanguageSchema = z.object({
  contentLanguage: z.enum(supportedLanguages).nullable(),
});

// ── Translation save ──────────────────────────────────────────

export const saveTranslationSchema = z.object({
  fields: z.record(
    z.string().min(1).max(50),
    z.string().max(50000),
  ).refine((val) => Object.keys(val).length > 0 && Object.keys(val).length <= 20, {
    message: "Must provide between 1 and 20 field translations",
  }),
});

// ── AI Translation ────────────────────────────────────────────

export const aiTranslateSchema = z.object({
  entityType: z.enum(translatableEntityTypes),
  entityId: z.string().uuid(),
  fields: z.array(z.string().min(1).max(50)).optional(),
  targetLanguages: z
    .array(z.enum(supportedLanguages))
    .min(1)
    .max(8),
  sourceLanguage: z.enum(supportedLanguages).optional(),
});

// ── Batch AI Translation ──────────────────────────────────────

export const aiBatchTranslateSchema = z.object({
  entities: z
    .array(
      z.object({
        entityType: z.enum(translatableEntityTypes),
        entityId: z.string().uuid(),
      }),
    )
    .min(1)
    .max(100),
  targetLanguages: z
    .array(z.enum(supportedLanguages))
    .min(1)
    .max(8),
  sourceLanguage: z.enum(supportedLanguages).optional(),
});

// ── Translation Status Update ─────────────────────────────────

export const updateTranslationStatusSchema = z.object({
  entityType: z.enum(translatableEntityTypes),
  entityId: z.string().uuid(),
  field: z.string().min(1).max(50),
  language: z.enum(supportedLanguages),
  status: z.enum(translationStatusValues),
});

// ── Translation Queue Filters ─────────────────────────────────

export const translationQueueFilterSchema = z.object({
  entityType: z.enum(translatableEntityTypes).optional(),
  targetLocale: z.enum(supportedLanguages).optional(),
  status: z.enum(["missing", "draft", "outdated", "verified", "complete"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Translation Progress Query ────────────────────────────────

export const translationProgressQuerySchema = z.object({
  entityType: z.enum(translatableEntityTypes).optional(),
  targetLocale: z.enum(supportedLanguages),
});

// ── XLIFF Import ──────────────────────────────────────────────

export const xliffImportSchema = z.object({
  content: z.string().min(1).max(52_428_800), // 50MB max
  dryRun: z.boolean().default(false),
});

// ── CSV Import ────────────────────────────────────────────────

export const csvImportSchema = z.object({
  content: z.string().min(1).max(52_428_800),
  dryRun: z.boolean().default(false),
});

// ── Export Query ──────────────────────────────────────────────

export const translationExportQuerySchema = z.object({
  entityType: z.enum(translatableEntityTypes),
  source: z.enum(supportedLanguages),
  target: z.enum(supportedLanguages),
  format: z.enum(["xliff", "csv"]).default("xliff"),
  entityIds: z.string().optional(), // comma-separated UUIDs
});

// ── Verify Translation ───────────────────────────────────────

export const verifyTranslationSchema = z.object({
  entityType: z.enum(translatableEntityTypes),
  entityId: z.string().uuid(),
  field: z.string().min(1).max(50),
  language: z.enum(supportedLanguages),
});
