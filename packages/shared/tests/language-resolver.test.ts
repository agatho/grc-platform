// Sprint 21: Language Resolver Unit Tests
import { describe, it, expect } from "vitest";
import {
  resolveField,
  resolveEntity,
  resolveEntities,
  resolveContentLanguage,
  wrapTranslatableField,
  mergeTranslation,
  getAvailableLanguages,
  computeSourceHash,
  sanitizeTranslation,
  sanitizeCsvValue,
  TRANSLATABLE_FIELDS,
  SUPPORTED_LANGUAGES,
} from "../src/utils/language-resolver";

describe("resolveField", () => {
  it("should return empty string for null/undefined", () => {
    expect(resolveField(null, "en", "de")).toBe("");
    expect(resolveField(undefined, "en", "de")).toBe("");
  });

  it("should return string as-is for backwards compatibility", () => {
    expect(resolveField("plain text", "en", "de")).toBe("plain text");
  });

  it("should resolve user language first", () => {
    const field = { de: "Risiko", en: "Risk", fr: "Risque" };
    expect(resolveField(field, "en", "de")).toBe("Risk");
  });

  it("should fall back to org default language", () => {
    const field = { de: "Risiko", fr: "Risque" };
    expect(resolveField(field, "en", "de")).toBe("Risiko");
  });

  it("should fall back to first available language", () => {
    const field = { fr: "Risque" };
    expect(resolveField(field, "en", "de")).toBe("Risque");
  });

  it("should return empty string for empty object", () => {
    expect(resolveField({}, "en", "de")).toBe("");
  });

  it("should handle non-object non-string values", () => {
    expect(resolveField(42 as any, "en", "de")).toBe("");
  });
});

describe("resolveEntity", () => {
  it("should resolve translatable fields and preserve translations", () => {
    const entity = {
      id: "abc",
      title: { de: "Titel", en: "Title" },
      description: { de: "Beschreibung" },
      status: "identified",
    };

    const resolved = resolveEntity(
      entity,
      ["title", "description"],
      "en",
      "de",
    );

    expect(resolved.title).toBe("Title");
    expect(resolved.description).toBe("Beschreibung"); // fallback to de
    expect(resolved.title_translations).toEqual({ de: "Titel", en: "Title" });
    expect(resolved.description_translations).toEqual({ de: "Beschreibung" });
    expect(resolved.status).toBe("identified"); // not touched
  });

  it("should track fallback fields", () => {
    const entity = {
      title: { de: "Titel" },
      description: { de: "Beschreibung", en: "Description" },
    };

    const resolved = resolveEntity(
      entity,
      ["title", "description"],
      "en",
      "de",
    );

    expect(resolved._fallback).toEqual(["title"]);
    expect(resolved._resolvedLanguage).toBe("en");
  });

  it("should handle null fields gracefully", () => {
    const entity = { title: null, description: undefined };
    const resolved = resolveEntity(
      entity,
      ["title", "description"],
      "en",
      "de",
    );
    expect(resolved.title).toBeNull();
    expect(resolved.description).toBeUndefined();
  });

  it("should not modify non-translatable fields", () => {
    const entity = { title: { de: "Titel" }, status: "active" };
    const resolved = resolveEntity(entity, ["title"], "en", "de");
    expect(resolved.status).toBe("active");
  });
});

describe("resolveEntities", () => {
  it("should resolve an array of entities", () => {
    const entities = [
      { id: "1", title: { de: "A", en: "B" } },
      { id: "2", title: { de: "C" } },
    ];

    const resolved = resolveEntities(entities, ["title"], "en", "de");

    expect(resolved).toHaveLength(2);
    expect(resolved[0].title).toBe("B");
    expect(resolved[1].title).toBe("C"); // fallback
    expect(resolved[1]._fallback).toEqual(["title"]);
  });
});

describe("resolveContentLanguage", () => {
  it("should prefer query locale parameter", () => {
    expect(
      resolveContentLanguage({
        queryLocale: "fr",
        userContentLanguage: "en",
        orgDefaultLanguage: "de",
      }),
    ).toBe("fr");
  });

  it("should skip 'all' as a locale value", () => {
    expect(
      resolveContentLanguage({
        queryLocale: "all",
        userContentLanguage: "en",
        orgDefaultLanguage: "de",
      }),
    ).toBe("en");
  });

  it("should fall back to user content language", () => {
    expect(
      resolveContentLanguage({
        queryLocale: null,
        userContentLanguage: "en",
        orgDefaultLanguage: "de",
      }),
    ).toBe("en");
  });

  it("should fall back to org default language", () => {
    expect(
      resolveContentLanguage({
        queryLocale: null,
        userContentLanguage: null,
        orgDefaultLanguage: "de",
      }),
    ).toBe("de");
  });

  it("should use 'de' as ultimate fallback", () => {
    expect(resolveContentLanguage({})).toBe("de");
  });
});

describe("wrapTranslatableField", () => {
  it("should wrap a string into a JSONB object", () => {
    expect(wrapTranslatableField("test", "de")).toEqual({ de: "test" });
  });

  it("should pass through an object", () => {
    const obj = { de: "A", en: "B" };
    expect(wrapTranslatableField(obj, "de")).toEqual(obj);
  });

  it("should return null for null/undefined", () => {
    expect(wrapTranslatableField(null, "de")).toBeNull();
    expect(wrapTranslatableField(undefined, "de")).toBeNull();
  });
});

describe("mergeTranslation", () => {
  it("should merge a new language into existing translations", () => {
    const existing = { de: "Risiko" };
    expect(mergeTranslation(existing, "en", "Risk")).toEqual({
      de: "Risiko",
      en: "Risk",
    });
  });

  it("should overwrite existing translation for same language", () => {
    const existing = { de: "Risiko", en: "Old" };
    expect(mergeTranslation(existing, "en", "New")).toEqual({
      de: "Risiko",
      en: "New",
    });
  });

  it("should handle null existing value", () => {
    expect(mergeTranslation(null, "en", "Risk")).toEqual({ en: "Risk" });
  });

  it("should handle string existing value", () => {
    expect(mergeTranslation("old string", "en", "New")).toEqual({ en: "New" });
  });
});

describe("getAvailableLanguages", () => {
  it("should return keys with non-empty values", () => {
    expect(getAvailableLanguages({ de: "A", en: "B", fr: "" })).toEqual([
      "de",
      "en",
    ]);
  });

  it("should return empty array for null", () => {
    expect(getAvailableLanguages(null)).toEqual([]);
  });

  it("should return empty array for string", () => {
    expect(getAvailableLanguages("text")).toEqual([]);
  });
});

describe("computeSourceHash", () => {
  it("should return a 16-char hex string", () => {
    const hash = computeSourceHash("test");
    expect(hash).toHaveLength(16);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("should return different hashes for different inputs", () => {
    expect(computeSourceHash("a")).not.toBe(computeSourceHash("b"));
  });

  it("should return same hash for same input", () => {
    expect(computeSourceHash("test")).toBe(computeSourceHash("test"));
  });
});

describe("sanitizeTranslation", () => {
  it("should escape HTML entities", () => {
    expect(sanitizeTranslation('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
  });

  it("should escape ampersand", () => {
    expect(sanitizeTranslation("A & B")).toBe("A &amp; B");
  });

  it("should leave plain text unchanged (except &)", () => {
    expect(sanitizeTranslation("Normal text")).toBe("Normal text");
  });
});

describe("sanitizeCsvValue", () => {
  it("should prefix dangerous CSV characters with quote", () => {
    expect(sanitizeCsvValue("=cmd")).toBe("'=cmd");
    expect(sanitizeCsvValue("+cmd")).toBe("'+cmd");
    expect(sanitizeCsvValue("-cmd")).toBe("'-cmd");
    expect(sanitizeCsvValue("@cmd")).toBe("'@cmd");
  });

  it("should not modify safe values", () => {
    expect(sanitizeCsvValue("normal text")).toBe("normal text");
  });
});

describe("TRANSLATABLE_FIELDS", () => {
  it("should include all expected entity types", () => {
    expect(TRANSLATABLE_FIELDS).toHaveProperty("risk");
    expect(TRANSLATABLE_FIELDS).toHaveProperty("control");
    expect(TRANSLATABLE_FIELDS).toHaveProperty("process");
    expect(TRANSLATABLE_FIELDS).toHaveProperty("document");
    expect(TRANSLATABLE_FIELDS).toHaveProperty("finding");
    expect(TRANSLATABLE_FIELDS).toHaveProperty("incident");
  });

  it("should list title and description for risk", () => {
    expect(TRANSLATABLE_FIELDS.risk).toContain("title");
    expect(TRANSLATABLE_FIELDS.risk).toContain("description");
  });

  it("should list name and description for process", () => {
    expect(TRANSLATABLE_FIELDS.process).toContain("name");
    expect(TRANSLATABLE_FIELDS.process).toContain("description");
  });
});

describe("SUPPORTED_LANGUAGES", () => {
  it("should include de and en as minimum", () => {
    expect(SUPPORTED_LANGUAGES).toContain("de");
    expect(SUPPORTED_LANGUAGES).toContain("en");
  });

  it("should have 8 supported languages", () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(8);
  });
});
