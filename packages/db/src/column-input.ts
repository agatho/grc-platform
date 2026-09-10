/**
 * Eingabe-Koersion für Drizzle-Spaltentypen, deren TypeScript-Repräsentation
 * von der API-Repräsentation abweicht.
 *
 * [ARCTOS-FULL-2026-08-31 / Restarbeiten]
 *
 * Zwei systematische Abweichungen ziehen sich durch `apps/web/src/app/api/v1`
 * und erzeugten nach dem Entfernen von `typescript.ignoreBuildErrors` (WP12)
 * rund 30 Typfehler:
 *
 *  1. **`numeric`-Spalten.** Drizzle bildet `numeric` bewusst auf `string` ab,
 *     damit Geld- und Score-Werte nicht durch IEEE-754-Rundung laufen. Die
 *     zugehörigen Zod-Schemata in `@grc/shared` deklarieren dieselben Felder
 *     als `z.number()`, weil die HTTP-API Zahlen entgegennimmt. Beide
 *     Entscheidungen sind für sich richtig; was fehlte, war die Umwandlung an
 *     der Grenze.
 *
 *  2. **`timestamp`-Spalten.** Drizzle erwartet `Date`; die API liefert
 *     ISO-8601-Strings aus dem JSON-Body.
 *
 * Beide Helfer sind reine Grenzwandler: sie ändern keinen gespeicherten Wert,
 * sie machen nur die Umwandlung explizit, die der Treiber bisher stillschweigend
 * vornahm. `null` und `undefined` werden durchgereicht, damit optionale
 * PATCH-Felder ihre "nicht gesetzt"-Semantik behalten.
 */

/** `numeric`-Spalte: Zahl aus dem JSON-Body → Dezimalstring für Drizzle. */
export function toNumericInput(value: number | string): string;
export function toNumericInput(
  value: number | string | null | undefined,
): string | null | undefined;
export function toNumericInput(
  value: number | string | null | undefined,
): string | null | undefined {
  if (value === null || value === undefined) return value;
  return typeof value === "string" ? value : String(value);
}

/** `timestamp`-Spalte: ISO-String aus dem JSON-Body → `Date` für Drizzle. */
export function toTimestampInput(value: string | Date): Date;
export function toTimestampInput(
  value: string | Date | null | undefined,
): Date | null | undefined;
export function toTimestampInput(
  value: string | Date | null | undefined,
): Date | null | undefined {
  if (value === null || value === undefined) return value;
  return value instanceof Date ? value : new Date(value);
}

/**
 * `integer`/`smallint`-Spalte: numerischer String aus dem Body → Zahl.
 * Bewusst streng: ein nicht parsbarer Wert wird zu `undefined`, statt `NaN`
 * in die Datenbank zu tragen.
 */
export function toIntegerInput(
  value: number | string | null | undefined,
): number | null | undefined {
  if (value === null || value === undefined) return value;
  if (typeof value === "number") return value;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}
