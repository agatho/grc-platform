/**
 * Sprint 21: XLIFF 2.0 Export/Import utilities
 * Standard format for Translation Memory tools (SDL Trados, memoQ)
 */

// [ARCTOS-FULL-2026-08-31 / WP6 · S05-18] `sanitizeTranslation()` escaped
// früher HTML-Entities und wurde damit auf JEDE gespeicherte Übersetzung
// angewendet — auch auf die aus der Anwendung selbst, wo es die Fachtexte
// verfälschte ("> 10.000 EUR" wurde zu "&gt; 10.000 EUR"). Das Escaping
// heisst jetzt, was es ist, und wird nur noch hier verwendet: für Text aus
// einer EXTERNEN Übersetzungsdatei. Das Verhalten dieses Importpfads
// ändert sich dadurch nicht.
import { escapeHtmlEntities } from "./language-resolver";

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

// [OP-065] Zwei Helfer statt dreissig Indexzugriffe.
//
// `group1` liefert die erste Fanggruppe eines GEGLÜCKTEN Treffers. Dass sie
// vorhanden ist, folgt aus dem jeweiligen Muster (`([^"]+)`, `(\w+)` — alle
// verlangen mindestens ein Zeichen), aber der Compiler kann das nicht sehen;
// er kennt nur `string | undefined`. Der Ersatzwert "" ist derselbe leere
// Inhalt, den die Weiterverarbeitung ohnehin für ein leeres Feld annimmt —
// und er steht an EINER Stelle statt an dreissig.
//
// `column` tut dasselbe für eine CSV-Zeile, deren Spaltenzahl direkt darüber
// geprüft wird.
function group1(m: RegExpMatchArray | RegExpExecArray): string {
  return m[1] ?? "";
}

function column(cols: readonly string[], i: number): string {
  return cols[i] ?? "";
}

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

  const sourceLanguage = group1(srcLangMatch);
  const targetLanguage = group1(trgLangMatch);

  // Extract units
  //
  // [ARCTOS-FULL-2026-08-31 · CodeQL js/polynomial-redos] Hier stand
  // `/<unit id="([^"]+)">([\s\S]*?)<\/unit>/g` in einer `exec`-Schleife. Das
  // faule `[\s\S]*?` ist billig, solange es fündig wird — aber JEDER Öffner
  // ohne folgendes `</unit>` lässt es bis ans Ende der Zeichenkette laufen.
  // Bei n Öffnern ohne Schliesser sind das n²/2 Schritte: eine hochgeladene
  // Datei mit 60 000 `<unit id="a">` und keinem `</unit>` blockierte die
  // Event-Loop des ganzen Node-Prozesses für Sekunden (der Importpfad
  // POST /api/v1/translations/import nimmt bis 50 MB entgegen).
  //
  // Stattdessen segmentierend: das nächste `</unit>` per `indexOf` suchen,
  // das Stück davor nehmen und den Öffner NUR darin suchen. Öffner ohne
  // Schliesser kosten dadurch nichts. Die ausgewählten Paare sind dieselben
  // wie bisher: im Segment liegt kein weiteres `</unit>`, also ist der
  // gefundene Schliesser genau der, den die alte Suche ab dem Öffner
  // gefunden hätte — und `<unit>` verschachtelt sich in XLIFF nicht.
  const CLOSING_TAG = "</unit>";
  const unitRegex = /<unit id="([^"]+)">([\s\S]*)$/;
  const units: XliffTranslationUnit[] = [];

  let cursor = 0;
  for (;;) {
    const closingIndex = xml.indexOf(CLOSING_TAG, cursor);
    if (closingIndex === -1) break;

    const segment = xml.slice(cursor, closingIndex);
    cursor = closingIndex + CLOSING_TAG.length;

    const unitMatch = segment.match(unitRegex);
    if (!unitMatch) continue;

    const unitId = unescapeXml(group1(unitMatch));
    const unitContent = unitMatch[2] ?? "";

    // Extract metadata
    const entityTypeMatch = unitContent.match(
      /<meta type="entityType">([^<]+)<\/meta>/,
    );
    const entityIdMatch = unitContent.match(
      /<meta type="entityId">([^<]+)<\/meta>/,
    );
    const fieldMatch = unitContent.match(/<meta type="field">([^<]+)<\/meta>/);

    // Extract source and target
    //
    // [ARCTOS-FULL-2026-08-31 · CodeQL js/polynomial-redos] Hier stand
    // `[^>]*` für den Attributbereich. Das schliesst `<` NICHT aus, also ist
    // jedes `<source`-Fragment ohne `>` eine gültige Startposition, deren
    // `[^>]*` bis ans Ende des Rumpfes läuft — quadratisch in der Zahl der
    // Fragmente. `[^<>]*` beendet jede solche Startposition sofort. Das
    // Verhalten bleibt gleich: ein wörtliches `<` im Attributbereich ist
    // kein wohlgeformtes XML, und `escapeXml()` in dieser Datei erzeugt dort
    // nie eines.
    const sourceMatch = unitContent.match(/<source[^<>]*>([^<]*)<\/source>/);
    const targetMatch = unitContent.match(/<target[^<>]*>([^<]*)<\/target>/);

    if (!entityTypeMatch || !entityIdMatch || !fieldMatch || !sourceMatch) {
      continue; // Skip malformed units
    }

    units.push({
      id: unitId,
      entityType: unescapeXml(group1(entityTypeMatch)),
      entityId: unescapeXml(group1(entityIdMatch)),
      field: unescapeXml(group1(fieldMatch)),
      source: unescapeXml(group1(sourceMatch)),
      target: targetMatch
        ? escapeHtmlEntities(unescapeXml(group1(targetMatch)))
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

  // `lines.length < 2` ist direkt darüber geprüft; `?? ""` schreibt das für
  // den Compiler auf, ohne einen erreichbaren Zweig hinzuzufügen.
  const header = lines[0] ?? "";
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
    const cols = csvParseLine(lines[i] ?? "");
    if (cols.length < 6) continue;

    rows.push({
      id: column(cols, 0),
      entityType: column(cols, 1),
      entityId: column(cols, 2),
      field: column(cols, 3),
      source: column(cols, 4),
      target: escapeHtmlEntities(column(cols, 5)),
    });
  }

  return {
    sourceLanguage: group1(sourceMatch),
    targetLanguage: group1(targetMatch),
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

// [ARCTOS-FULL-2026-08-31 · CodeQL js/double-escaping] Hier stand eine Kette
// von fünf `replace()`, die `&amp;` ZUERST entschlüsselte — und war damit
// nicht die Umkehrung von `escapeXml()`, das `&` korrekt zuerst
// verschlüsselt. Folge: `&amp;lt;` wurde zweimal entschlüsselt und zu `<`.
// Ein wörtliches `&lt;` in einem Fachtext (so gespeichert, so exportiert)
// kam beim Import als `<` zurück — der Text änderte sich, und der
// Rundlauf Export→Import war nicht verlustfrei. Jetzt eine einzige
// Entschlüsselungsrunde über eine Nachschlagetabelle, dieselbe Form wie in
// `apps/web/src/lib/pdf.ts`.
const XML_ENTITY_MAP: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&amp;": "&",
};

function unescapeXml(str: string): string {
  return str.replace(
    /&(?:lt|gt|quot|apos|amp);/g,
    (m) => XML_ENTITY_MAP[m] ?? m,
  );
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
