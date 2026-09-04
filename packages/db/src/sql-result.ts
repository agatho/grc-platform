/**
 * Normalisierung des Rückgabewerts von `db.execute()` / `tx.execute()`.
 *
 * [ARCTOS-FULL-2026-08-31 / Restarbeiten · Wurzel der 40 `.rows`-Typfehler]
 *
 * Hintergrund
 * -----------
 * Die Plattform verwendet den `postgres-js`-Treiber. Dessen Drizzle-Adapter
 * gibt aus `execute()` eine `RowList<T[]>` zurück — das ist ein ECHTES Array
 * der Zeilen, angereichert um `count` / `command` / `columns`. Es gibt dort
 * KEINE `.rows`-Eigenschaft; die kennt nur `node-postgres` (`pg`), dessen
 * `QueryResult` die Zeilen in `{ rows: [...] }` verpackt.
 *
 * In `apps/web/src/app/api/v1/**` finden sich beide Annahmen nebeneinander:
 *
 *   const rows = Array.isArray(r) ? r : (r?.rows ?? []);   // defensiv, läuft
 *   return res.rows[0];                                    // undefined!
 *   if (!candidates.rows?.length) return [];               // immer wahr!
 *
 * Die erste Form ist nur ein Typfehler. Die zweite und dritte sind
 * FUNKTIONALE Defekte: `.rows` ist zur Laufzeit `undefined`, also liefern die
 * betroffenen POST-Routen `data: undefined` und die ERM-Sync-Routen melden
 * konstant „0 synchronisiert“, obwohl Kandidaten vorhanden sind. Verdeckt
 * wurde das von `typescript.ignoreBuildErrors: true` (von WP12 entfernt).
 *
 * Konsequenz
 * ----------
 * Statt 40 Einzelkorrekturen gibt es hier EINEN Helfer, der beide Treiber-
 * Formen akzeptiert und immer ein Array liefert. Er ist bewusst tolerant
 * gegenüber `pg`-Ergebnissen, damit ein späterer Treiberwechsel die
 * Aufrufstellen nicht erneut bricht.
 */

/** Was ein `execute()` je nach Treiber zurückgeben kann. */
export type SqlExecuteResult<T = Record<string, unknown>> =
  readonly T[] | { rows?: readonly T[] | null } | null | undefined;

/**
 * Liefert die Zeilen eines `execute()`-Ergebnisses als echtes Array —
 * unabhängig davon, ob der Treiber `RowList` (postgres-js) oder
 * `QueryResult { rows }` (node-postgres) zurückgibt.
 */
export function toRows<T = Record<string, unknown>>(
  result: SqlExecuteResult<T>,
): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: readonly T[] | null }).rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

/**
 * Erste Zeile eines `execute()`-Ergebnisses oder `undefined`.
 * Ersetzt das verbreitete — und unter postgres-js kaputte — `res.rows[0]`.
 */
export function firstRow<T = Record<string, unknown>>(
  result: SqlExecuteResult<T>,
): T | undefined {
  return toRows<T>(result)[0];
}

/** Anzahl der zurückgegebenen Zeilen, treiberunabhängig. */
export function rowCount(result: SqlExecuteResult): number {
  return toRows(result).length;
}

/**
 * Genau eine Zeile aus einem Abfrageergebnis entnehmen.
 *
 * [ARCTOS-FULL-2026-08-31 / Welle 4b, Strang 6 · OP-065]
 *
 * `noUncheckedIndexedAccess` macht aus `const [row] = await sql\`… RETURNING
 * id\`` ein `row: T | undefined`. In den Seed- und Betriebsskripten dieses
 * Pakets ist das kein Formalismus: sie legen Organisationen, Benutzer,
 * Kataloge und Vorlagen an und tragen die zurückgegebenen Kennungen durch den
 * ganzen Lauf. Bleibt eine Zeile aus, lief der Seed bisher WEITER — mit
 * `undefined` als UUID in der nächsten Anweisung — und meldete am Ende
 * trotzdem „12 Vorlagen angelegt".
 *
 * Diese Funktion macht daraus einen Abbruch mit Namen, an der Stelle, an der
 * er entsteht. Sie steht hier und nicht achtmal kopiert in den einzelnen
 * Skripten, damit es EINE Stelle gibt, an der die Entscheidung „kein
 * Datensatz ⇒ Abbruch" getroffen wird.
 *
 * Ein `!` an den Fundstellen hätte das Gegenteil bewirkt: dieselbe Annahme,
 * nur ohne Prüfung und ohne Meldung.
 */
export function requireRow<T>(rows: readonly T[], what: string): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`${what}: Abfrage lieferte keine Zeile`);
  }
  return row;
}
