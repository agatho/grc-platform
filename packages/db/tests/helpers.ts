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
