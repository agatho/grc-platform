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
