// setup-require-roles.ts — [ARCTOS-FULL-2026-08-31 · OP-170]
//
// Diese Suite prüft die Routenkette unter der produktionsnahen Rolle
// `grc_app` (kein SUPERUSER, kein BYPASSRLS). Genau das war bisher nicht
// zugesichert, sondern erhofft:
//
//   * Jede Datei hatte einen fest verdrahteten Rückfallwert auf die
//     Datenbank `grc_platform`. Fehlte `APP_DATABASE_URL`, lief die Suite
//     stillschweigend gegen eine ANDERE Datenbank als der privilegierte
//     Kanal — gemessen am 2026-09-03: `DATABASE_URL` zeigte auf `grc_v4b`,
//     `APP_DATABASE_URL` fiel auf `grc_platform` zurück. Der Fehlschlag las
//     sich wie ein RLS-Defekt und war ein Umgebungsfehler.
//   * Fehlte `APP_DATABASE_URL` ganz, konnte die Suite als SUPERUSER laufen
//     und trotzdem grün melden — ein Test namens „unter grc_app", der die
//     Rolle nie sah.
//
// Das ist dieselbe Fehlerklasse wie OP-168 und wie die drei „Tore, die nicht
// fallen können" aus den Wellen 0–3: Die Wache über der Sache war kaputt.
// Ein Test, der seine eigene Voraussetzung errät, prüft etwas anderes als
// sein Name behauptet.
//
// Deshalb: beide Verbindungen müssen gesetzt sein, und sie müssen auf
// DIESELBE Datenbank zeigen. Sonst bricht die Suite ab, statt zu raten.

function dbName(url: string): string {
  // Kein URL-Parser: `postgres://` ist für `new URL` gültig, aber der
  // Pfadanteil ist alles, was hier zählt — und Passwörter mit Sonderzeichen
  // sollen nicht versehentlich in einer Fehlermeldung landen.
  const withoutQuery = url.split("?")[0] ?? "";
  const lastSlash = withoutQuery.lastIndexOf("/");
  return lastSlash < 0 ? "" : withoutQuery.slice(lastSlash + 1);
}

const su = process.env.DATABASE_URL;
const app = process.env.APP_DATABASE_URL;

if (!su || !app) {
  throw new Error(
    "Die Routenketten-Suite braucht BEIDE Verbindungen:\n" +
      `  DATABASE_URL      ${su ? "gesetzt" : "FEHLT"}  (privilegiert, legt die Fixtures an)\n` +
      `  APP_DATABASE_URL  ${app ? "gesetzt" : "FEHLT"}  (grc_app, die Rolle, die hier geprüft wird)\n` +
      "\n" +
      "Ohne APP_DATABASE_URL liefe die Suite als SUPERUSER und meldete grün,\n" +
      "ohne die Rolle je gesehen zu haben. Sie bricht deshalb lieber ab.\n" +
      "Einrichtung: deploy/provision-grc-app.sh <datenbank>",
  );
}

const suDb = dbName(su);
const appDb = dbName(app);

if (suDb !== appDb) {
  throw new Error(
    "DATABASE_URL und APP_DATABASE_URL zeigen auf VERSCHIEDENE Datenbanken:\n" +
      `  DATABASE_URL      → ${suDb}\n` +
      `  APP_DATABASE_URL  → ${appDb}\n` +
      "\n" +
      "Die Fixtures entstünden dann in der einen und würden in der anderen\n" +
      "gesucht. Der Fehlschlag sähe aus wie ein RLS-Defekt und wäre keiner.",
  );
}
