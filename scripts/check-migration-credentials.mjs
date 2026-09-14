#!/usr/bin/env node
// ============================================================================
// [ARCTOS-FULL-2026-08-31 · OP-267] Keine anmeldefaehigen Konten aus Migrationen
// ============================================================================
//
// Das Projekt hat drei Schalter gegen Demo-Konten mit bekanntem Passwort —
// `SEED_DEMO_DATA`, `ALLOW_DEMO_SEED_IN_PROD` (#SEC-F04) und
// `ALLOW_PRODUCTION_SEED` — und einen Waechter, der den Start verweigert,
// wenn die ersten beiden gesetzt sind (`scripts/assert-runtime-config.mjs`).
// Alle drei wirken im SEED-Pfad. Sechs MIGRATIONEN laufen daran vorbei: sie
// sind unbedingt, sie laufen auf jeder Datenbank, und sie laufen, bevor
// irgendein Schalter gelesen wird. Am 2026-09-14 standen deshalb in einem
// Mandanten, der laut Runbook genau ein Konto haben sollte, 35 — davon 15
// anmeldefaehig mit einem Passwort, das in der Kopfzeile von 0317 im Klartext
// steht (oeffentliches Repository).
//
// Sechs Dateien in einer Klasse sind keine Einzelfaelle. Die Antwort auf eine
// Klasse ist eine Pruefung.
//
// Zwei Regeln:
//
//   1. Eine Migration darf `password_hash` nicht in `"user"` schreiben.
//      Die sechs historischen Dateien sind namentlich eingefroren; die Liste
//      darf schrumpfen, nicht wachsen. (Aendern lassen sie sich nach ADR-014
//      nicht — sie sind ausgeliefert. Stillgelegt werden sie von
//      `0480_op267_disable_seeded_login_accounts.sql`.)
//
//   2. JEDE Adresse aus diesen sechs Dateien muss von 0480 erfasst sein.
//      Das ist die Regel, die wirklich traegt: sie faellt auch dann, wenn
//      jemand einer eingefrorenen Datei eine Adresse hinzufuegt, die die
//      Stilllegung nicht kennt. Ohne sie waere die Freigabeliste eine
//      Erlaubnis; mit ihr ist sie eine Buchfuehrung.
//
// Seeds unter `packages/db/sql/` prueft dieses Skript NICHT: sie haengen an
// den Schaltern oben, und das ist der vorgesehene Weg.
// ============================================================================

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONEN = "packages/db/drizzle";
const STILLLEGUNG = "0480_op267_disable_seeded_login_accounts.sql";

// Eingefroren am 2026-09-14. Jede Zeile nennt, was die Datei anlegt.
const EINGEFROREN = new Map([
  ["0096_additional_system_roles.sql", "6 × @arctos.dev (namentlich)"],
  ["0316_seed_rbac_test_users.sql", "13 × @arctos.test (Platzhalter-Hash)"],
  [
    "0317_seed_rbac_login_users.sql",
    "9 × @meridian.test (Passwort im Klartext in der Kopfzeile)",
  ],
  [
    "0318_user_role_enum_backfill_and_rbac_retry.sql",
    "Wiederholung von 0316/0317",
  ],
  ["0326_seed_arctistx_rbac_users.sql", "4 × @arctistx.test"],
  ["0346_seed_bcm_security_external_auditor_users.sql", "3 × @meridian.test"],
]);

const fehler = [];
const zeilen = (t) => t.split(/\r?\n/);

const dateien = readdirSync(MIGRATIONEN)
  .filter((f) => f.endsWith(".sql"))
  .sort();

// ── Regel 1: keine neuen Konten aus Migrationen ─────────────────────────────
const gefunden = new Set();
for (const datei of dateien) {
  const text = readFileSync(join(MIGRATIONEN, datei), "utf8");
  // Nur Treffer, die BEIDES tun: in `"user"` einfuegen und dabei einen
  // Passwort-Hash setzen. `UPDATE "user" SET password_hash = ...` (wie die
  // Stilllegung selbst) ist ausdruecklich erlaubt.
  if (!/INSERT\s+INTO\s+"user"/i.test(text)) continue;
  if (!/password_hash/i.test(text)) continue;
  gefunden.add(datei);
  if (!EINGEFROREN.has(datei)) {
    const nr =
      zeilen(text).findIndex((z) => /INSERT\s+INTO\s+"user"/i.test(z)) + 1;
    fehler.push(
      `${MIGRATIONEN}/${datei}:${nr}\n` +
        `    Diese Migration legt ein Konto mit Passwort-Hash an. Migrationen laufen\n` +
        `    unbedingt auf JEDER Datenbank und an SEED_DEMO_DATA,\n` +
        `    ALLOW_DEMO_SEED_IN_PROD und ALLOW_PRODUCTION_SEED vorbei (OP-267).\n` +
        `    Konten gehoeren in einen Seed unter packages/db/sql/ oder in\n` +
        `    packages/db/src/create-admin.ts — nicht in eine Migration.`,
    );
  }
}

for (const [datei, was] of EINGEFROREN) {
  if (!gefunden.has(datei)) {
    fehler.push(
      `${MIGRATIONEN}/${datei}\n` +
        `    steht als eingefroren in dieser Liste (${was}), legt aber kein Konto\n` +
        `    mehr an. Wenn das gewollt ist: Zeile aus EINGEFROREN entfernen.`,
    );
  }
}

// ── Regel 2: die Stilllegung erfasst jede dieser Adressen ───────────────────
const stillText = readFileSync(join(MIGRATIONEN, STILLLEGUNG), "utf8");

// Muster der Form  email ILIKE '%@arctos.test'
const muster = [...stillText.matchAll(/ILIKE\s+'%@([A-Za-z0-9.-]+)'/g)].map(
  (m) => "@" + m[1].toLowerCase(),
);
// Einzeln genannte Adressen aus der IN-Liste
const einzeln = new Set(
  [...stillText.matchAll(/'([A-Za-z0-9._+-]+@[A-Za-z0-9.-]+)'/g)].map((m) =>
    m[1].toLowerCase(),
  ),
);

const erfasst = (adresse) =>
  einzeln.has(adresse) || muster.some((d) => adresse.endsWith(d));

for (const datei of EINGEFROREN.keys()) {
  if (!gefunden.has(datei)) continue;
  const text = readFileSync(join(MIGRATIONEN, datei), "utf8");
  // Nur Adressen aus den INSERT-Anweisungen auf `"user"`. Eine Datei nennt
  // fremde Adressen auch, ohne sie anzulegen: 0096:170 liest
  // `admin@arctos.dev` als `granted_by` nach. Dieses Konto legt der Seed an,
  // es ist das echte Administratorkonto der Installation und muss
  // anmeldefaehig bleiben — die erste Fassung dieser Regel las die ganze
  // Datei und verlangte prompt seine Stilllegung.
  const anweisungen = text.match(/INSERT\s+INTO\s+"user"[\s\S]*?;/gi) ?? [];
  const adressen = new Set(
    anweisungen.flatMap((a) =>
      [...a.matchAll(/'([A-Za-z0-9._+-]+@[A-Za-z0-9.-]+)'/g)].map((m) =>
        m[1].toLowerCase(),
      ),
    ),
  );
  for (const adresse of adressen) {
    if (!erfasst(adresse)) {
      fehler.push(
        `${MIGRATIONEN}/${datei}\n` +
          `    '${adresse}' wird von ${STILLLEGUNG} nicht erfasst.\n` +
          `    Entweder die Adresse dort aufnehmen oder begruenden, warum sie\n` +
          `    anmeldefaehig bleiben soll.`,
      );
    }
  }
}

if (fehler.length > 0) {
  console.error("");
  console.error("Konten aus Migrationen (OP-267):");
  console.error("");
  for (const f of fehler) console.error("  " + f + "\n");
  process.exit(1);
}

const zahl = gefunden.size;
console.log(
  `OK — ${zahl} historische Migration${zahl === 1 ? "" : "en"} mit Konten, ` +
    `alle von ${STILLLEGUNG} stillgelegt; keine neuen.`,
);
