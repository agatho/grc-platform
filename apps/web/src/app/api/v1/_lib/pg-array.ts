// Eine Werteliste als EIN Postgres-Array in eine rohe Abfrage geben.
//
// [ARCTOS-FULL-2026-08-31 / Welle 4b-4 · OP-176, OP-179]
//
// Anlass: Drizzle setzt ein JavaScript-Array in einem `sql`-Baustein NICHT
// als einen Array-Parameter ein, sondern als PARAMETERLISTE. Gemessen gegen
// die laufende Datenbank:
//
//   sql`… status = ANY(${["identified", "in_remediation"]}::finding_status[])`
//   → … status = ANY(($2, $3)::finding_status[])
//   → Failed query
//
// Die naheliegende Schreibweise ist also nicht etwa langsam oder unschoen,
// sie laeuft gar nicht — und zwar erst zur Laufzeit, weil TypeScript den
// zusammengesetzten Text nicht sieht. `pgArray` baut stattdessen ein
// `ARRAY[$2, $3]::<typ>[]`: jeder Wert bleibt ein eigener Parameter, das
// Array entsteht in SQL.
//
// `cast` geht durch `sql.raw` und ist deshalb NICHT parametrisiert. Er darf
// nur eine im Quelltext ausgeschriebene Typkonstante sein (`"text[]"`,
// `"finding_status[]"`), niemals ein Wert aus einer Anfrage. Das ist die
// Lehre aus OP-178: rohe Zeichenketten in SQL sind an genau der Stelle
// erlaubt, an der sie nachweislich aus dem Quelltext stammen.

import { sql, type SQL } from "drizzle-orm";

export function pgArray(values: readonly string[], cast: string): SQL {
  return sql`ARRAY[${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )}]::${sql.raw(cast)}`;
}
