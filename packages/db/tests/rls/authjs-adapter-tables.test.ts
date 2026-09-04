import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createTestDb, createAppDb, requireRow } from "../helpers";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-139] `account`, `session`, `verification_token`
 * sind bewusst tot — und das wird hier gemessen statt behauptet.
 *
 * Befund (`/work/audit/remediation/RESTDEFEKTE.md`, „Weiterhin offen"): die
 * drei Auth.js-Adaptertabellen tragen seit Migration 0392 RLS mit FORCE und
 * KEINE Policy, `grc_app` sind alle Rechte entzogen, und die Anwendung benutzt
 * sie nicht (JWT-Strategie, kein DrizzleAdapter). Der Bericht empfiehlt,
 * „entweder zu entfernen oder als bewusst tot zu dokumentieren".
 *
 * Entscheidung: dokumentieren statt entfernen — die Begruendung steht im
 * Schema (`packages/db/src/schema/platform.ts`, Abschnitt „Auth.js tables").
 * Kurz: ein DROP waere nach ADR-023 breaking, und die Deklaration ist genau
 * das, was verhindert, dass ein spaeter eingeschalteter DrizzleAdapter die
 * Tabellen ungeschuetzt neu entstehen laesst.
 *
 * Der eigentliche Mangel war ein anderer: der Zustand war nur ein
 * Migrationskommentar. Zwei Restdefekt-Berichte mussten die drei Tabellen von
 * Hand als Sonderfall ausnehmen, und niemand haette gemerkt, wenn jemand eine
 * Policy oder ein GRANT ergaenzt oder den Adapter eingeschaltet haette.
 *
 * Dieser Test macht aus der Behauptung eine Pruefung — in beide Richtungen:
 *   (1) die Datenbank haelt den zugesagten Zustand (RLS, FORCE, 0 Policies,
 *       keine Rechte fuer grc_app, 0 Zeilen);
 *   (2) der Quellbaum nennt die Tabellen nirgends ausser in ihrer Definition.
 *
 * Wer den DrizzleAdapter einschaltet, bekommt hier einen roten Test mit einer
 * Anleitung — und nicht eine stille Tabelle voller Sitzungstoken ohne RLS.
 */

const TABLES = ["account", "session", "verification_token"] as const;

const admin = createTestDb();
const app = createAppDb(process.env.APP_DATABASE_URL);

afterAll(async () => {
  await admin.client.end({ timeout: 5 });
  await app.client.end({ timeout: 5 });
});

describe("OP-139 — Auth.js-Adaptertabellen sind bewusst tot", () => {
  it("tragen RLS + FORCE und KEINE einzige Policy (deny-all)", async () => {
    const rows = await admin.client<
      { name: string; rls: boolean; forced: boolean; policies: number }[]
    >`
      SELECT c.relname AS name,
             c.relrowsecurity AS rls,
             c.relforcerowsecurity AS forced,
             (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = ANY(${TABLES as unknown as string[]})
       ORDER BY c.relname`;

    expect(rows.map((r) => r.name)).toEqual([...TABLES].sort());
    for (const r of rows) {
      expect(r.rls, `${r.name}: RLS`).toBe(true);
      expect(r.forced, `${r.name}: FORCE`).toBe(true);
      // Eine Policy waere eine Oeffnung. Wer sie braucht, schaltet den
      // Adapter ein — und muss dann diesen Test bewusst umschreiben.
      expect(r.policies, `${r.name}: Policy-Anzahl`).toBe(0);
    }
  });

  it("die Laufzeitrolle grc_app hat auf keiner von ihnen ein Recht", async () => {
    for (const t of TABLES) {
      const row = requireRow(
        await admin.client<{ any_priv: boolean }[]>`
        SELECT (has_table_privilege('grc_app', ${`public.${t}`}, 'SELECT')
             OR has_table_privilege('grc_app', ${`public.${t}`}, 'INSERT')
             OR has_table_privilege('grc_app', ${`public.${t}`}, 'UPDATE')
             OR has_table_privilege('grc_app', ${`public.${t}`}, 'DELETE')) AS any_priv`,
        "row",
      );
      expect(row.any_priv, `${t}: grc_app hat ein Recht`).toBe(false);
    }
  });

  it("sind leer — 'unbenutzt' ist eine Tatsachenbehauptung, also wird sie gemessen", async () => {
    for (const t of TABLES) {
      const row = requireRow(
        await admin.client.unsafe<{ n: number }[]>(
          `SELECT count(*)::int AS n FROM public."${t}"`,
        ),
        "row",
      );
      expect(row.n, `${t}: Zeilen`).toBe(0);
    }
  });

  it("kein Anwendungscode nennt sie — sonst ist der Adapter eingeschaltet", () => {
    // `git grep` statt eines eigenen Baumlaufs: es kennt .gitignore, ist
    // schnell und laeuft ueber genau den Stand, der eingecheckt wird.
    const repo = resolve(__dirname, "../../../..");
    const pattern =
      "\\b(verificationToken|from\\(account\\)|from\\(session\\)|" +
      'INSERT INTO "?(account|session|verification_token)"?|' +
      'FROM "?(account|session|verification_token)"?|' +
      "DrizzleAdapter)";
    let hits: string[] = [];
    try {
      hits = execFileSync(
        "git",
        [
          "grep",
          "-nIE",
          pattern,
          "--",
          "apps/**/*.ts",
          "apps/**/*.tsx",
          "packages/**/*.ts",
          "packages/**/*.tsx",
          ":!packages/db/src/schema/platform.ts",
          ":!packages/db/tests/rls/authjs-adapter-tables.test.ts",
          // Automatisch erzeugte Namensliste ALLER @grc/db-Exporte; sie
          // erfuellt nur vitests Mock-Export-Pruefung und benutzt nichts.
          // Ein Treffer hier heisst "die Tabelle ist exportiert" — was sie
          // ist, absichtlich, siehe Schema-Kommentar.
          ":!apps/worker/tests/helpers/db-exports.ts",
        ],
        { cwd: repo, encoding: "utf8" },
      )
        .trim()
        .split("\n")
        .filter(Boolean);
    } catch (err) {
      // `git grep` gibt Exit 1 zurueck, wenn es NICHTS findet — das ist der
      // Erfolgsfall. Jeder andere Fehler (kein git, kein Repository) darf
      // nicht als "keine Treffer" durchgehen.
      const e = err as { status?: number; stderr?: Buffer };
      if (e.status !== 1) {
        throw new Error(
          `git grep nicht ausfuehrbar: ${e.stderr?.toString() ?? String(err)}`,
        );
      }
    }

    expect(
      hits,
      "Eine dieser drei Auth.js-Adaptertabellen wird jetzt referenziert. " +
        "Sie sind seit Migration 0392 deny-all (RLS + FORCE, 0 Policies, " +
        "REVOKE ALL FROM grc_app) — jeder Zugriff aus der Anwendung schlaegt " +
        "mit 'permission denied' fehl. Wer den DrizzleAdapter einschaltet, " +
        "muss VORHER echte, an app.current_user_id gebundene Policies " +
        "schreiben und diesen Test ersetzen.",
    ).toEqual([]);
  });
});
