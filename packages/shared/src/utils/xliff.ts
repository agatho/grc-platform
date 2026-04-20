/**
 * Sprint 21: XLIFF 2.0 Export/Import utilities
 * Standard format for Translation Memory tools (SDL Trados, memoQ)
 */

import { sanitizeTranslation } from "./language-resolver";

// ── Types ────────────────────────────────────────────────────────

export interface XliffTranslationUnit {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  source: string;
  target: string;
  note?: string;
}

export interface XliffDocument {
  sourceLanguage: string;
  targetLanguage: string;
  units: XliffTranslationUnit[];
}

export interface XliffImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ unitId: string; error: string }>;
  conflicts: number;
}

// ── Export ────────────────────────────────────────────────────────

/**
 * Generate XLIFF 2.0 XML string from translation units.
 */
export function generateXliff(doc: XliffDocument): string {
  const escapedUnits = doc.units.map((unit) => {
    const sourceEscaped = escapeXml(unit.source);
    const targetEscaped = escapeXml(unit.target);
    const noteXml = unit.note
      ? `\n        <notes><note>${escapeXml(unit.note)}</note></notes>`
      : "";
    return `    <unit id="${escapeXml(unit.id)}">
      <metadata>
        <meta type="entityType">${escapeXml(unit.entityType)}</meta>
        <meta type="entityId">${escapeXml(unit.entityId)}</meta>
        <meta type="field">${escapeXml(unit.field)}</meta>
      </metadata>${noteXml}
      <segment>
        <source xml:lang="${escapeXml(doc.sourceLanguage)}">${sourceEscaped}</source>
        <target xml:lang="${escapeXml(doc.targetLanguage)}">${targetEscaped}</target>
      </segment>
    </unit>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0"
  srcLang="${escapeXml(doc.sourceLanguage)}"
  trgLang="${escapeXml(doc.targetLanguage)}">
  <file id="arctos-translations">
${escapedUnits.join("\n")}
  </file>
</xliff>`;
}

/**
 * Parse an XLIFF 2.0 XML string into translation units.
 * Uses simple regex-based parsing (no DOM dependency for server).
 */
export function parseXliff(xml: string): XliffDocument {
  // Extract source and target languages
  const srcLangMatch = xml.match(/srcLang="([^"]+)"/);
  const trgLangMatch = xml.match(/trgLang="([^"]+)"/);

  if (!srcLangMatch || !trgLangMatch) {
    throw new Error("Invalid XLIFF: missing srcLang or trgLang attributes");
  }

  const sourceLanguage = srcLangMatch[1];
  const targetLanguage = trgLangMatch[1];

  // Extract units
  const unitRegex = /<unit id="([^"]+)">([\s\S]*?)<\/unit>/g;
  const units: XliffTranslationUnit[] = [];

  let unitMatch: RegExpExecArray | null;
  while ((unitMatch = unitRegex.exec(xml)) !== null) {
    const unitId = unescapeXml(unitMatch[1]);
    const unitContent = unitMatch[2];

    // Extract metadata
    const entityTypeMatch = unitContent.match(
      /<meta type="entityType">([^<]+)<\/meta>/,
    );
    const entityIdMatch = unitContent.match(
      /<meta type="entityId">([^<]+)<\/meta>/,
    );
    const fieldMatch = unitContent.match(/<meta type="field">([^<]+)<\/meta>/);

    // Extract source and target
    const sourceMatch = unitContent.match(/<source[^>]*>([^<]*)<\/source>/);
    const targetMatch = unitContent.match(/<target[^>]*>([^<]*)<\/target>/);

    if (!entityTypeMatch || !entityIdMatch || !fieldMatch || !sourceMatch) {
      continue; // Skip malformed units
    }

    units.push({
      id: unitId,
      entityType: unescapeXml(entityTypeMatch[1]),
      entityId: unescapeXml(entityIdMatch[1]),
      field: unescapeXml(fieldMatch[1]),
      source: unescapeXml(sourceMatch[1]),
      target: targetMatch
        ? sanitizeTranslation(unescapeXml(targetMatch[1]))
        : "",
    });
  }

  return { sourceLanguage, targetLanguage, units };
}

// ── CSV Export/Import ────────────────────────────────────────────

export interface CsvRow {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  source: string;
  target: string;
}

/**
 * Generate CSV string from translation data.
 */
export function generateCsv(
  rows: CsvRow[],
  sourceLanguage: string,
  targetLanguage: string,
): string {
  const header = `id,entity_type,entity_id,field,source_${sourceLanguage},target_${targetLanguage}`;
  const lines = rows.map(
    (row) =>
      `${csvEscape(row.id)},${csvEscape(row.entityType)},${csvEscape(row.entityId)},${csvEscape(row.field)},${csvEscape(row.source)},${csvEscape(row.target)}`,
  );
  return [header, ...lines].join("\n");
}

/**
 * Parse CSV string into translation rows.
 */
export function parseCsv(csv: string): {
  sourceLanguage: string;
  targetLanguage: string;
  rows: CsvRow[];
} {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("Invalid CSV: requires header and at least one data row");
  }

  const header = lines[0];
  // Extract languages from header: source_de,target_en
  const sourceMatch = header.match(/source_(\w+)/);
  const targetMatch = header.match(/target_(\w+)/);

  if (!sourceMatch || !targetMatch) {
    throw new Error(
      "Invalid CSV header: expected source_XX and target_XX columns",
    );
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = csvParseLine(lines[i]);
    if (cols.length < 6) continue;

    rows.push({
      id: cols[0],
      entityType: cols[1],
      entityId: cols[2],
      field: cols[3],
      source: cols[4],
      target: sanitizeTranslation(cols[5]),
    });
  }

  return {
    sourceLanguage: sourceMatch[1],
    targetLanguage: targetMatch[1],
    rows,
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvParseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}
