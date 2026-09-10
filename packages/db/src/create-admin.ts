// #WP3-S02-01 — Replacement for the removed default admin.
//
// `deploy/setup.sh` used to end with `Login: admin@arctos.dev / admin123`, and
// `packages/db/src/seed.ts` created exactly that account with a hardcoded
// password, without any environment guard, on every documented production
// install. This script is the honest replacement: it creates ONE administrator
// with a password that exists nowhere but on the operator's screen, and forces
// a change at first login.
//
// Usage:
//   npm run db:create-admin -- --email alice@example.com [--name "Alice"] \
//                              [--org <org-uuid>] [--platform-admin]
//
// Without --org the account is created and, if exactly one organization exists,
// given the `admin` role there; otherwise the operator is asked to pass --org.
// --platform-admin additionally inserts into `platform_admin` (S02-03) — that
// table has no INSERT policy for the application runtime, so this is the only
// supported way to grant it.

import postgres from "postgres";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { requireRow } from "./sql-result";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(
      "Usage: db:create-admin -- --email <address> [--name <name>] [--org <uuid>] [--platform-admin]",
    );
    process.exit(1);
  }
  // [OP-065] `email.split("@")[0]` war `string | undefined`, und damit war
  // `name` es auch. Weiter unten geht `name` als Parameter in ein
  // `sql`-Template; `undefined` ist dort kein gültiger Parameter, weshalb der
  // ganze Aufruf für den Compiler zu einem Fehlertyp wurde (TS1320 am
  // `await`). Die E-Mail ist oben auf ein nichtleeres, `@`-haltiges Muster
  // geprüft — `?? email` ist der Rückfall, der nie greift und trotzdem einen
  // brauchbaren Anzeigenamen liefert.
  const name = arg("name") ?? email.split("@")[0] ?? email;
  const orgArg = arg("org");

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });

  try {
    const password =
      process.env.ADMIN_PASSWORD ?? randomBytes(18).toString("base64url");
    if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length < 12) {
      console.error("ADMIN_PASSWORD must be at least 12 characters.");
      process.exit(1);
    }
    const passwordHash = await hash(password, 12);

    let orgId = orgArg;
    if (!orgId) {
      const orgs = await sql<{ id: string; name: string }[]>`
        SELECT id, name FROM organization WHERE deleted_at IS NULL ORDER BY created_at LIMIT 2
      `;
      if (orgs.length === 0) {
        console.error(
          "No organization exists yet — create one first, or pass --org.",
        );
        process.exit(1);
      }
      if (orgs.length > 1) {
        console.error(
          "More than one organization exists — pass --org <uuid> explicitly.",
        );
        process.exit(1);
      }
      const org = requireRow(orgs, "Organisation suchen");
      orgId = org.id;
      console.log(`Organization: ${org.name} (${orgId})`);
    }

    const [row] = await sql<{ id: string }[]>`
      INSERT INTO "user" (email, name, password_hash, email_verified, is_active,
                          language, must_change_password)
      VALUES (${email}, ${name}, ${passwordHash}, now(), true, 'de', true)
      ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            is_active = true,
            must_change_password = true,
            failed_login_attempts = 0,
            locked_until = NULL
      RETURNING id
    `;
    // [OP-065] Ein `RETURNING id` nach `INSERT … ON CONFLICT DO UPDATE`
    // liefert immer eine Zeile. Geprüft wird sie trotzdem: ohne Zeile gibt es
    // keine Benutzerkennung, und die folgenden Anweisungen würden mit
    // `undefined` als UUID gegen die Datenbank laufen.
    if (row === undefined) {
      throw new Error(`Administrator ${email} anlegen: keine Zeile zurück`);
    }

    await sql`
      INSERT INTO user_organization_role (user_id, org_id, role, line_of_defense)
      VALUES (${row.id}, ${orgId}, 'admin', 'first')
      ON CONFLICT DO NOTHING
    `;

    if (flag("platform-admin")) {
      await sql`
        INSERT INTO platform_admin (user_id, reason)
        VALUES (${row.id}, 'created via db:create-admin')
        ON CONFLICT (user_id) DO UPDATE SET revoked_at = NULL
      `;
      console.log("Granted PLATFORM ADMIN (cross-tenant configuration).");
    }

    console.log("");
    console.log("Administrator created.");
    console.log(`  email:    ${email}`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log(`  password: ${password}`);
      console.log("  (shown once — it is not stored anywhere in plaintext)");
    }
    console.log("  The account must change this password at first login.");
    console.log("");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("create-admin failed:", err);
  process.exit(1);
});
