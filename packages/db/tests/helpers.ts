import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/schema/platform";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://grc:grc_dev_password@localhost:5432/grc_platform";

/**
 * Create a database client for testing.
 * Uses the superuser connection (can bypass RLS).
 *
 * `max: 1` keeps every query on the same connection so that
 * `set_config(..., is_local=false)` session settings (current_org_id,
 * current_user_id, etc.) are observed by subsequent queries.
 */
export function createTestDb() {
  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema });
  return { db, client };
}

/**
 * Create a database client as a non-superuser (for RLS tests).
 * Requires the grc_app role to exist (created by seed or CI).
 *
 * Pool size 1: setRlsContext() must stick for subsequent queries.
 */
export function createAppDb(url?: string) {
  const appUrl =
    url ??
    DATABASE_URL.replace(/\/\/[^@]+@/, "//grc_app:grc_app_dev_password@");
  const client = postgres(appUrl, { max: 1 });
  const db = drizzle(client, { schema });
  return { db, client };
}

/**
 * Set RLS session variables for the current connection.
 */
export async function setRlsContext(
  client: postgres.Sql,
  orgId: string,
  userId: string,
  email = "test@arctos.dev",
  name = "Test User",
) {
  await client`SELECT set_config('app.current_org_id', ${orgId}, false)`;
  await client`SELECT set_config('app.current_user_id', ${userId}, false)`;
  await client`SELECT set_config('app.current_user_email', ${email}, false)`;
  await client`SELECT set_config('app.current_user_name', ${name}, false)`;
}

/**
 * Clear RLS session variables.
 */
export async function clearRlsContext(client: postgres.Sql) {
  await client`SELECT set_config('app.current_org_id', '', false)`;
  await client`SELECT set_config('app.current_user_id', '', false)`;
}

export { schema };

/**
 * [ARCTOS-FULL-2026-08-31 / Welle 4b, Strang 6 · OP-065]
 * Genau eine Zeile aus einem Abfrageergebnis entnehmen.
 *
 * Warum es diesen Helfer gibt: `noUncheckedIndexedAccess` macht aus
 * `const [org] = await sql\`… RETURNING id\`` ein `org: Row | undefined`, und
 * das ist in diesen Suiten kein Formalismus. Die Fixtures dieser Tests legen
 * Organisationen, Benutzer und Datensätze an und tragen deren Kennungen durch
 * den ganzen Lauf. Bleibt eine Zeile aus — weil eine Migration fehlt, eine
 * Bedingung nicht greift oder eine RLS-Policy den INSERT still verwirft —,
 * dann läuft der Test bisher WEITER und scheitert irgendwo später an einem
 * `Cannot read properties of undefined`, oder, schlimmer, er stellt eine
 * Behauptung über `undefined` auf und ist grün.
 *
 * `requireRow` macht daraus einen Fehlschlag mit Namen, an der Stelle, an der
 * er entsteht. Ein `!` hätte genau das Gegenteil bewirkt.
 */
export function requireRow<T>(rows: readonly T[], what: string): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`${what}: Abfrage lieferte keine Zeile`);
  }
  return row;
}

/**
 * [OP-065] Wie {@link requireRow}, aber für einen beliebigen Index — für
 * Zusicherungen der Form `rows[2].status`.
 */
export function requireAt<T>(rows: readonly T[], i: number, what: string): T {
  const row = rows[i];
  if (row === undefined) {
    throw new Error(
      `${what}: Element ${i} fehlt (nur ${rows.length} Zeilen vorhanden)`,
    );
  }
  return row;
}
