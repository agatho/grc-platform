/**
 * build-messages.ts
 *
 * Pre-builds a single merged JSON file per locale from individual namespace files.
 * This avoids 71 dynamic imports per request at runtime.
 *
 * Usage: npx tsx scripts/build-messages.ts
 * Runs automatically via the "prebuild" npm script before `next build`.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const LOCALES = ["de", "en"] as const;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = join(__dirname, "..", "messages");

/**
 * Convert a kebab-case filename (without .json) to a camelCase namespace key.
 * e.g. "eam-data-architecture" -> "eamDataArchitecture"
 *      "board-kpi" -> "boardKpi"
 *      "common" -> "common"
 */
function filenameToCamelCase(filename: string): string {
  return filename.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function buildLocale(locale: string): void {
  const localeDir = join(MESSAGES_DIR, locale);
  if (!existsSync(localeDir)) {
    console.error(`Locale directory not found: ${localeDir}`);
    process.exit(1);
  }

  const files = readdirSync(localeDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const merged: Record<string, unknown> = {};

  for (const file of files) {
    const filePath = join(localeDir, file);
    const namespaceName = filenameToCamelCase(basename(file, ".json"));
    const content = JSON.parse(readFileSync(filePath, "utf-8"));
    merged[namespaceName] = content;
  }

  // Spread common into root for backward compatibility (useTranslations("nav.xxx"))
  // Common content is available both at root level and under "common" key
  const commonContent = (merged.common ?? {}) as Record<string, unknown>;
  const result = { ...commonContent, ...merged };

  const outPath = join(MESSAGES_DIR, `${locale}.json`);
  writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf-8");
  console.log(
    `Built ${outPath} (${files.length} namespaces, ${(JSON.stringify(result).length / 1024).toFixed(1)} KB)`,
  );
}

for (const locale of LOCALES) {
  buildLocale(locale);
}

console.log("Message bundles built successfully.");
