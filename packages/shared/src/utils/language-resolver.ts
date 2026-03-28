/**
 * Sprint 21: Language Resolver — resolves JSONB multilingual fields to strings
 *
 * Fallback chain: user.content_language -> org.default_language -> first available -> ''
 * Zero additional DB queries — all resolution happens in-memory on already-loaded JSONB.
 */

import { createHash } from "crypto";

// ── Supported languages ────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = ["de", "en", "fr", "nl", "it", "es", "pl", "cs"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<string, string> = {
  de: "Deutsch",
  en: "English",
  fr: "Francais",
  nl: "Nederlands",
  it: "Italiano",
  es: "Espanol",
  pl: "Polski",
  cs: "Cestina",
};

// ── Types ────────────────────────────────────────────────────────

/** A translatable JSONB field: { "de": "Risiko", "en": "Risk" } */
export type TranslatableField = Record<string, string> | string | null | undefined;

export interface ResolveOptions {
  userLang: string;
  orgDefaultLang: string;
}

export interface ResolvedEntityMeta {
  /** Fields that used a fallback language instead of the requested language */
  _fallback?: string[];
  /** The language that was actually used for resolution */
  _resolvedLanguage?: string;
}

// ── Core resolver functions ────────────────────────────────────────

/**
 * Resolve a single JSONB translatable field to a plain string.
 * Backwards-compatible: if the field is already a string, returns it as-is.
 */
export function resolveField(
  field: TranslatableField,
  userLang: string,
  orgDefaultLang: string,
): string {
  if (field === null || field === undefined) return "";
  if (typeof field === "string") return field; // backwards compat
  if (typeof field !== "object") return "";

  return (
    field[userLang] ??
    field[orgDefaultLang] ??
    field[Object.keys(field)[0]] ??
    ""
  );
}

/**
 * Resolve all translatable fields on an entity object.
 * Original JSONB values are preserved as `${field}_translations`.
 * Returns a new object (does not mutate the original).
 */
export function resolveEntity<T extends Record<string, unknown>>(
  entity: T,
  translatableFields: string[],
  userLang: string,
  orgDefaultLang: string,
): T & ResolvedEntityMeta {
  const resolved = { ...entity } as T & ResolvedEntityMeta;
  const fallbackFields: string[] = [];

  for (const field of translatableFields) {
    const value = resolved[field];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const translations = value as Record<string, string>;
      // Preserve original translations
      (resolved as Record<string, unknown>)[`${field}_translations`] = translations;

      // Resolve to string
      const resolvedValue = resolveField(translations, userLang, orgDefaultLang);
      (resolved as Record<string, unknown>)[field] = resolvedValue;

      // Track fallbacks
      if (translations[userLang] === undefined && resolvedValue !== "") {
        fallbackFields.push(field);
      }
    }
  }

  if (fallbackFields.length > 0) {
    resolved._fallback = fallbackFields;
  }
  resolved._resolvedLanguage = userLang;

  return resolved;
}

/**
 * Resolve an array of entities (e.g., list endpoints).
 */
export function resolveEntities<T extends Record<string, unknown>>(
  entities: T[],
  translatableFields: string[],
  userLang: string,
  orgDefaultLang: string,
): (T & ResolvedEntityMeta)[] {
  return entities.map((e) =>
    resolveEntity(e, translatableFields, userLang, orgDefaultLang),
  );
}

/**
 * Determine the content language for a request.
 * Priority: ?locale= query param > user.content_language > org.default_language > 'de'
 */
export function resolveContentLanguage(options: {
  queryLocale?: string | null;
  userContentLanguage?: string | null;
  orgDefaultLanguage?: string;
}): string {
  const { queryLocale, userContentLanguage, orgDefaultLanguage = "de" } = options;
  if (queryLocale && queryLocale !== "all") return queryLocale;
  if (userContentLanguage) return userContentLanguage;
  return orgDefaultLanguage;
}

/**
 * Wrap a string value into a JSONB translatable object.
 * Handles both string input (wraps) and object input (passes through).
 */
export function wrapTranslatableField(
  value: string | Record<string, string> | null | undefined,
  language: string,
): Record<string, string> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value;
  return { [language]: value };
}

/**
 * Merge a translation into an existing JSONB field.
 * Returns a new object with the translation added/updated.
 */
export function mergeTranslation(
  existing: TranslatableField,
  language: string,
  value: string,
): Record<string, string> {
  const base: Record<string, string> =
    existing && typeof existing === "object" ? { ...existing } : {};
  base[language] = value;
  return base;
}

/**
 * Get available languages from a JSONB field.
 */
export function getAvailableLanguages(field: TranslatableField): string[] {
  if (!field || typeof field !== "object") return [];
  return Object.keys(field).filter((k) => field[k] !== undefined && field[k] !== "");
}

/**
 * Compute a SHA-256 hash of a source text (used for detecting stale translations).
 */
export function computeSourceHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").substring(0, 16);
}

/**
 * Sanitize translated content to prevent XSS.
 * Escapes HTML entities in translated strings.
 */
export function sanitizeTranslation(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Strip CSV injection characters from export values.
 * Prevents formula injection in Excel (=, +, -, @, \t, \r).
 */
export function sanitizeCsvValue(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

// ── Translatable field registry ────────────────────────────────────

/** Map of entity types to their translatable field names */
export const TRANSLATABLE_FIELDS: Record<string, string[]> = {
  risk: ["title", "description"],
  control: ["title", "description"],
  process: ["name", "description"],
  document: ["title"],
  finding: ["title", "description"],
  incident: ["title"],
  risk_catalog_entry: ["title", "description"],
  control_catalog_entry: ["title", "description", "implementation"],
};

/** Map of entity types to their database table names */
export const ENTITY_TABLE_MAP: Record<string, string> = {
  risk: "risk",
  control: "control",
  process: "process",
  document: "document",
  finding: "finding",
  incident: "security_incident",
  risk_catalog_entry: "risk_catalog_entry",
  control_catalog_entry: "control_catalog_entry",
};

/** Valid entity types for translation operations */
export const TRANSLATABLE_ENTITY_TYPES = Object.keys(TRANSLATABLE_FIELDS);
