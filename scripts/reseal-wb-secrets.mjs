#!/usr/bin/env node
// ============================================================================
// Re-Seal der Hinweisgeber-Chiffrate nach einem Wechsel von
// `WB_ENCRYPTION_KEY` (OP-128).
//
// [ARCTOS-FULL-2026-08-31 · Welle 5c]
//
// Ausgangslage: `packages/shared/src/wb-crypto.ts` kann seit WP8 (S07-19.2)
// mit `WB_ENCRYPTION_KEY_PREVIOUS` auch Bestandschiffrate lesen — aber
// nichts hat sie je auf den neuen Schlüssel umgeschrieben. Rotation hiess
// deshalb bisher: den ALTEN Schlüssel dauerhaft in der Umgebung stehen
// lassen. Ein zweiter gültiger Schlüssel, der nie abläuft, ist keine
// Rotation, sondern eine Verdopplung der Angriffsfläche.
// `docs/env-vars-reference.md` führt `WB_ENCRYPTION_KEY` genau so:
// „Bestandschiffrate nur über `WB_ENCRYPTION_KEY_PREVIOUS` lesbar;
// Re-Seal nötig." Das ist dieses Skript.
//
// NICHT zu verwechseln mit den beiden anderen Schlüsseln der Installation:
//   * `AUDIT_SEAL_KEY` ist ausdrücklich NICHT rotierbar und darf niemals
//     vernichtet werden (docs/env-vars-reference.md, ADR-011 rev.3 §322) —
//     ein Wechsel macht bestehende Ankersiegel unverifizierbar. Für ihn
//     gibt es kein Re-Seal und darf es keins geben.
//   * Die VERNICHTUNG von `PII_PSEUDONYM_KEY` ist der DSGVO-Löschpfad mit
//     eigenem Verfahren (docs/runbook.md §7, Vier-Augen-Prinzip). Auch dort
//     wird nichts umgeschlüsselt — die Unlesbarkeit IST das Ziel.
// Dieses Skript fasst beide nicht an und liest sie nicht.
//
// ── Die Falle, die vor der Rotation steht ───────────────────────────────
//
// `wb-crypto.ts:getPseudonymKey()` leitet den Pseudonymisierungsschlüssel
// aus `WB_ENCRYPTION_KEY` ab, WENN `WB_PSEUDONYM_KEY` nicht gesetzt ist.
// Damit hängt an `WB_ENCRYPTION_KEY` ein zweiter Schlüssel, den dieses
// Skript NICHT reparieren kann: `wb_report.ip_hash` ist ein HMAC über eine
// IP-Adresse, die nirgends gespeichert ist. Wird der Schlüssel gewechselt,
// ohne `WB_PSEUDONYM_KEY` vorher auf den ABGELEITETEN Wert des alten
// Schlüssels festzunageln, sind alle bestehenden `ip_hash`-Werte dauerhaft
// unvergleichbar — die Duplikaterkennung und `ipMatchesHash()` scheitern
// still, ohne Fehlermeldung.
//
// Das Skript verweigert deshalb den Dienst, solange `WB_PSEUDONYM_KEY`
// nicht explizit gesetzt ist, und nennt den Befehl, der den abzuleitenden
// Wert erzeugt. `--allow-derived-pseudonym-key` übergeht das bewusst (etwa
// bei einer Installation ohne einen einzigen `ip_hash`).
//
// ── Aufruf ──────────────────────────────────────────────────────────────
//
//   DATABASE_URL=postgresql://... \
//   WB_ENCRYPTION_KEY=<neu> WB_ENCRYPTION_KEY_PREVIOUS=<alt> \
//   WB_PSEUDONYM_KEY=<abgeleitet aus dem alten Schluessel> \
//     node scripts/reseal-wb-secrets.mjs [--dry-run]
//
//   --dry-run                       nur zählen, keine Schreibvorgänge.
//   --allow-derived-pseudonym-key   Pseudonym-Sperre übergehen.
//
// Beide Schlüssel werden auch im Probelauf gebraucht: ob eine Zeile noch
// unter dem alten Schlüssel liegt, lässt sich nur durch Entschlüsseln
// feststellen. Die Schlüsselkennung im Umschlag (`v2:<id>:…`) genügt
// nicht — sie ist im Auslieferungszustand für beide Schlüssel `default`.
//
// Idempotent: eine Zeile, die der NEUE Schlüssel öffnet, wird übersprungen.
// Ein zweiter Lauf schreibt nichts mehr.
//
// Das Kryptoformat MUSS mit `packages/shared/src/wb-crypto.ts`
// deckungsgleich bleiben (diese .mjs kann die TS-Quelle nicht importieren).
// `packages/shared/tests/wb-crypto-reseal-format.test.ts` hält beide Seiten
// aneinander fest.
//
// Gibt niemals Klartext oder Schlüsselmaterial aus.
// ============================================================================

import postgres from "postgres";

import {
  WB_HEX_KEY_RE,
  parseWbEnvelope,
  tryDecryptWbEnvelope,
  encryptWbEnvelope,
} from "./lib/wb-envelope.mjs";

const dryRun = process.argv.includes("--dry-run");
const allowDerivedPseudonymKey = process.argv.includes(
  "--allow-derived-pseudonym-key",
);

function fail(message) {
  console.error(message);
  process.exit(2);
}

function loadKey(varName) {
  const raw = process.env[varName];
  if (!raw) {
    fail(
      `${varName} is required (64-character hex, 32 bytes).\n` +
        "Generate with: openssl rand -hex 32",
    );
  }
  const hex = raw.trim();
  if (!WB_HEX_KEY_RE.test(hex)) {
    fail(
      `${varName} must be a 64-character hex string (32 bytes) — ` +
        "same rule as packages/shared/src/wb-crypto.ts:parseKey().",
    );
  }
  return Buffer.from(hex, "hex");
}

// ── Was umzuschlüsseln ist ────────────────────────────────────────────────
//
// Alle vier Spalten werden über `encrypt()` aus @grc/shared geschrieben.
// `wb_case_message.content` trägt je nach Schreibpfad eine AAD-Bindung
// (`wb_case_message:<caseId>` aus dem Portal) oder keine (die Wege über die
// Sachbearbeitung). Die Bindung steht im Umschlag und wird unverändert
// übernommen — sonst würde das Re-Seal die Zeilenbindung aus S07-19.3
// aufheben.
const TARGETS = [
  { table: "wb_report", column: "description" },
  { table: "wb_report", column: "contact_email" },
  { table: "wb_case", column: "resolution" },
  { table: "wb_case_message", column: "content" },
];

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) fail("DATABASE_URL is required");

const newKey = loadKey("WB_ENCRYPTION_KEY");
const previousKey = loadKey("WB_ENCRYPTION_KEY_PREVIOUS");
if (newKey.equals(previousKey)) {
  fail(
    "WB_ENCRYPTION_KEY and WB_ENCRYPTION_KEY_PREVIOUS are identical — " +
      "there is nothing to re-seal. Set the PREVIOUS variable to the key " +
      "the existing ciphertexts were written with.",
  );
}

const newKeyId = process.env.WB_ENCRYPTION_KEY_ID?.trim() || "default";

if (!process.env.WB_PSEUDONYM_KEY?.trim() && !allowDerivedPseudonymKey) {
  fail(
    "WB_PSEUDONYM_KEY is not set.\n" +
      "\n" +
      "  wb-crypto.ts derives the pseudonym key from WB_ENCRYPTION_KEY when\n" +
      "  WB_PSEUDONYM_KEY is unset. Rotating the encryption key therefore\n" +
      "  also changes the HMAC behind every wb_report.ip_hash — and those\n" +
      "  cannot be recomputed, because the IP address they cover is not\n" +
      "  stored anywhere. Duplicate detection and ipMatchesHash() would\n" +
      "  fail silently from then on.\n" +
      "\n" +
      "  Pin the OLD derived value first (run this with the OLD key in\n" +
      "  WB_ENCRYPTION_KEY_PREVIOUS, and put the output into your .env as\n" +
      "  WB_PSEUDONYM_KEY):\n" +
      "\n" +
      // Bewusst EINE Zeile mit EINEM -e. node wertet bei mehreren `-e`
      // nur das letzte aus, und ueber Zeilenfortsetzungen verteilte
      // Zeichenketten werden zu getrennten Argumenten — beide Formen
      // enden in "Expression expected". Diese Zeile ist woertlich
      // ausgefuehrt und geprueft.
      "    WB_ENCRYPTION_KEY_PREVIOUS=<alter Schluessel> node -e \"console.log(require('node:crypto').createHmac('sha256',Buffer.from(process.env.WB_ENCRYPTION_KEY_PREVIOUS,'hex')).update('wb-pseudonym-v1').digest('hex'))\"\n" +
      "\n" +
      "  Pass --allow-derived-pseudonym-key to proceed anyway (only when\n" +
      "  the installation has no wb_report.ip_hash values worth keeping).",
  );
}

const sql = postgres(dbUrl, {
  max: 1,
  ssl: dbUrl.includes("sslmode=require") ? "require" : false,
});

let unreadable = 0;
let unparsable = 0;
let resealedTotal = 0;

try {
  for (const { table, column } of TARGETS) {
    const rows = await sql`
      SELECT id, ${sql(column)} AS value
        FROM ${sql(table)}
       WHERE ${sql(column)} IS NOT NULL
         AND ${sql(column)} <> ''
       ORDER BY id
    `;

    let alreadyCurrent = 0;
    let pending = 0;
    let resealed = 0;
    let broken = 0;
    let malformed = 0;

    for (const row of rows) {
      const env = parseWbEnvelope(row.value);
      if (!env) {
        malformed++;
        continue;
      }

      // Der neue Schlüssel zuerst: eine bereits umgeschlüsselte Zeile wird
      // nicht angefasst. Das macht den Lauf wiederholbar.
      if (tryDecryptWbEnvelope(newKey, env) !== null) {
        alreadyCurrent++;
        continue;
      }

      const plaintext = tryDecryptWbEnvelope(previousKey, env);
      if (plaintext === null) {
        // Weder alter noch neuer Schlüssel öffnet die Zeile. Das ist kein
        // Fall für einen stillen Übersprung: entweder ist der falsche
        // PREVIOUS-Schlüssel gesetzt oder die Zeile ist beschädigt.
        broken++;
        continue;
      }

      pending++;
      if (dryRun) continue;

      const sealed = encryptWbEnvelope(newKey, newKeyId, plaintext, env.aad);
      const res = await sql`
        UPDATE ${sql(table)}
           SET ${sql(column)} = ${sealed}
         WHERE id = ${row.id}
           AND ${sql(column)} = ${row.value}
      `;
      resealed += res.count;
    }

    unreadable += broken;
    unparsable += malformed;
    resealedTotal += resealed;

    const verb = dryRun ? "would re-seal" : "re-sealed";
    console.log(
      `${table}.${column}: ${rows.length} non-empty, ` +
        `${alreadyCurrent} already on the current key, ` +
        `${pending} ${verb}` +
        (dryRun ? "" : ` (${resealed} written)`) +
        (malformed ? `, ${malformed} not in an envelope format` : "") +
        (broken ? `, ${broken} UNREADABLE` : ""),
    );
  }
} finally {
  await sql.end();
}

if (unparsable > 0) {
  console.warn(
    `\n${unparsable} value(s) did not parse as a wb-crypto envelope. They were ` +
      "left untouched — check whether they were ever encrypted.",
  );
}

if (unreadable > 0) {
  console.error(
    `\n${unreadable} value(s) opened with NEITHER key. Nothing was changed for ` +
      "them.\nEither WB_ENCRYPTION_KEY_PREVIOUS is not the key these rows were " +
      "written with,\nor the ciphertext is damaged. Re-run once the right " +
      "previous key is set.",
  );
  process.exit(1);
}

if (!dryRun && resealedTotal > 0) {
  console.log(
    `\n${resealedTotal} value(s) re-sealed. Verify the application can read ` +
      "them,\nthen remove WB_ENCRYPTION_KEY_PREVIOUS from the environment — " +
      "leaving it set\nkeeps a second valid key alive and defeats the purpose " +
      "of the rotation.",
  );
}
