// Sprint 21: Multi-Language Content Management types

export type TranslationStatusValue = "original" | "draft_translation" | "verified" | "outdated";
export type TranslationMethod = "manual" | "ai_claude" | "ai_ollama" | "xliff_import" | "csv_import";

export interface TranslationStatusRecord {
  id: string;
  orgId: string;
  entityType: string;
  entityId: string;
  field: string;
  language: string;
  status: TranslationStatusValue;
  method?: TranslationMethod | null;
  translatedBy?: string | null;
  translatedAt?: string | null;
  sourceHash?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TranslationProgress {
  entityType: string;
  targetLanguage: string;
  total: number;
  translated: number;
  verified: number;
  draft: number;
  outdated: number;
  percentage: number;
}

export interface TranslationQueueItem {
  entityType: string;
  entityId: string;
  entityTitle: string;
  missingLanguages: string[];
  outdatedLanguages: string[];
  lastModified: string;
  fieldCount: number;
  translatedFieldCount: number;
}

export interface LanguageConfig {
  code: string;
  label: string;
  isPrimary: boolean;
  isActive: boolean;
  translationProgress: number;
}

export interface TranslationHeatmapCell {
  entityType: string;
  language: string;
  total: number;
  translated: number;
  percentage: number;
}

export interface AiTranslateRequest {
  entityType: string;
  entityId: string;
  fields?: string[];
  targetLanguages: string[];
  sourceLanguage?: string;
}

export interface AiTranslateResponse {
  translations: Record<string, Record<string, string>>;
  tokensUsed: {
    input: number;
    output: number;
  };
  provider: string;
}

export interface TranslationExportOptions {
  entityType: string;
  sourceLanguage: string;
  targetLanguage: string;
  format: "xliff" | "csv";
  entityIds?: string[];
}

export interface TranslationImportPreview {
  totalUnits: number;
  newTranslations: number;
  updatedTranslations: number;
  conflicts: number;
  errors: Array<{ unitId: string; error: string }>;
}
