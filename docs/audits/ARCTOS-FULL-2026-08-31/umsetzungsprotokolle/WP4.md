# WP4 — Audit-Trail und Tamper-Evidence

**Audit:** `ARCTOS-FULL-2026-08-31` · **Branch:** `audit/full-2026-08-31`
**Umfang:** `S03-01`…`S03-20` (20 Findings · 2 Critical, 6 High, 10 Medium, 2 Low)
**Welle:** 2, parallel zu WP2/WP3/WP5
**Stand:** abgeschlossen 2026-09-01 · **nicht committet** (auftragsgemäß)

---

## 1. Kurzfassung

Der Auditbericht schließt mit dem Satz, die Hash-Kette sei „eine
Integritätsprüfung gegen versehentliche Korruption, keine Tamper-Evidence
gegen einen privilegierten Akteur". Das war zutreffend, und zwar aus vier
unabhängigen Gründen: die Anker lagen ungeschützt in derselben Datenbank
und wurden nie geprüft (S03-01), ein vom Guard **erlaubtes** UPDATE
schaltete die Verifikation pro Zeile ab, ohne die verankerte Merkle-Wurzel
zu verändern (S03-02), die Akteursfelder waren gar nicht gehasht und frei
änderbar (S03-03), und die Schranke, die das hätte auffangen sollen, war
für 100 % der Live-Zeilen wirkungslos (S03-04).

Nach diesem Paket gilt:

| Angriff (wie im Bericht reproduziert)                          | vorher                                               | nachher                                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `changes` + `hash_version = 0`                                 | `healthy: true`, Merkle-Wurzel bit-identisch         | UPDATE abgewiesen; per Superuser erzwungen → `unverifiable_version`, `healthy: false`     |
| `user_email`/`user_name`/`ip_address` umschreiben              | nicht erkannt (nicht gehasht **und** UPDATE-erlaubt) | UPDATE abgewiesen; erzwungen → `commitment_mismatch`                                      |
| Kette neu berechnen unter `session_replication_role='replica'` | erfolgreich, nicht erkannt                           | Guards feuern trotzdem (`ENABLE ALWAYS`); per Superuser erzwungen → `commitment_mismatch` |
| `UPDATE audit_anchor SET merkle_root = …`                      | nicht erkannt                                        | abgewiesen; erzwungen → `anchor_digest_mismatch` gegen das HMAC-Siegel                    |
| `TRUNCATE audit_log CASCADE`                                   | gesamter Trail weg, kein Fehler                      | abgewiesen, auch unter `replica`                                                          |
| DSGVO-Tombstone                                                | `/integrity` dauerhaft 503                           | Zeile verifiziert weiter; Redaktion ist selbst ein Kettenglied                            |
| Offline-Verifikation                                           | 0 von 142 Zeilen (alte README-Formel)                | 149 von 149 auf der frisch migrierten DB, plus Erkennung des Inhaltsangriffs              |

**Restlücke, ausdrücklich:** ein Superuser kann Trigger und Tabellen
löschen. Siehe Abschnitt 5.

---

## 2. Umsetzung je Finding

### S03-02 (Critical) — `hash_version` auf der UPDATE-Allowlist · **behoben**

**Änderung:** `packages/db/drizzle/0401_audit_chain_assign_and_guards.sql` —
`audit_log_tombstone_only_guard()` neu gefasst. Die Allowlist enthält
`hash_version` nicht mehr und wird nie wieder enthalten; die
Redaktionsspalten (`user_email`, `user_name`, `ip_address`, `changes`,
`pii_tombstoned_at`, `pii_tombstone_reason`) sind **ausschließlich** auf
dem Übergang `pii_tombstoned_at NULL → NOT NULL` erlaubt, also beim ersten
und einzigen Tombstone der Zeile. `content_commitment` steht ebenfalls
nicht darauf. Der Trigger ist `ENABLE ALWAYS`.

Ergänzend `0404_audit_chain_verification.sql`: eine Zeile, deren
Hash-Version der Verifizierer nicht kennt — `hash_version = 0`
eingeschlossen —, ist ein **Mismatch**, keine Warnung. Der frühere
`remedy`-Text („Migrationen 0327 und 0328 ausführen") ist entfernt; er war
der falsche Rat, weil ein Rehash den Hash aus dem manipulierten Inhalt
neu berechnet und die Fälschung damit endgültig macht.

**Nachweis:**

```
$ psql -d wp4_test -c "UPDATE audit_log SET changes = …, hash_version = 0 WHERE id = …"
ERROR:  audit_log is append-only — column hash_version cannot be updated (id=…)

$ psql -d wp4_test -c "SET session_replication_role='replica';
                       UPDATE audit_log SET hash_version = 0 WHERE id = …"
SET
ERROR:  audit_log is append-only — column hash_version cannot be updated (id=…)
```

Vorher/Nachher gegen dieselbe Zeile, mit dem alten Guard und dem alten
Verifizierer temporär wiederhergestellt (Skript
`scratchpad/before_after.sql`):

```
=== BEFORE (alter Guard, alter Verifizierer) ===
UPDATE 1
 total | row_mismatches | chain_mismatches | v0_skipped | healthy
    16 |              0 |                0 |          1 | t        ← nicht erkannt

=== AFTER (aktueller Verifizierer, dieselbe manipulierte Zeile) ===
    "healthy": false,
    "firstFailure": { "status": "unverifiable_version" },
    "unverifiableVersion": 1
```

Tests: `packages/db/tests/integration/audit-tamper-evidence.test.ts`,
Block „S03-02 — the hash_version escape hatch" (4 Tests);
`apps/web/src/__tests__/api/audit-log-integrity.test.ts` („returns 503 for
hash_version = 0 instead of calling it a warning", prüft zusätzlich, dass
im Response nirgends mehr das Wort _rehash_ steht).

---

### S03-04 (High) — Ankerschranke ohne v3-Zweig, Cron ohne Schranke · **behoben**

**Ursache:** die Prüflogik existierte viermal (Endpunkt, Ankerschranke,
DR-Drill-Skript — und im Cron gar nicht) und ist auseinandergelaufen. Das
Kopieren war der Defekt, nicht der fehlende Zweig.

**Änderung:** `0404_audit_chain_verification.sql` führt
`audit_chain_check(scope)` und `audit_chain_verify(scope)` als **einzige**
Implementierung ein. Aufrufer:

- `apps/web/src/app/api/v1/audit-log/integrity/route.ts`
- `apps/web/src/app/api/v1/audit-log/anchor/route.ts` (`anchorGate()`)
- `apps/worker/src/crons/daily-audit-anchor.ts` (`chainIsAnchorable()` —
  der Nightly-Pfad hat jetzt überhaupt erstmals eine Schranke)
- `apps/worker/src/crons/audit-chain-verify.ts`
- `packages/db/tests/integration/audit-integrity-live.test.ts` (trug bis
  dahin die fünfte Kopie)

Eine unbekannte Hash-Version liefert `NULL` statt `entry_hash` und zählt
als Mismatch — der `ELSE entry_hash`-Fallback, der jeden Hash mit sich
selbst verglich, existiert nicht mehr.

**Nachweis:** `audit-tamper-evidence.test.ts` erzwingt eine Manipulation
und prüft, dass `audit_chain_verify()` sie meldet; der Anker-Gate-Pfad
verwendet dieselbe Funktion, kann also nicht abweichen. Der frühere
Zustand (Schranke meldet 0/0 bei kaputter Kette) ist strukturell nicht
mehr herstellbar.

---

### S03-01 (Critical) — Anker ungeschützt in derselben DB, nie verifiziert · **behoben, mit benannter Restlücke**

**Änderung:** `0403_audit_anchor_seal.sql`, plus
`0401_audit_chain_assign_and_guards.sql`.

1. **`audit_anchor` ist append-only für seine Beweisfelder.**
   `merkle_root`, `leaf_count` und `merkle_version` eines abgeschlossenen
   Ankers sind unveränderlich; Identitätsspalten ebenfalls; die
   Proof-Bytes dürfen nur auf dem dokumentierten
   OpenTimestamps-Upgrade-Pfad wachsen. `DELETE` ist verboten. Ein
   vorher **fehlgeschlagener** Versuch darf durch einen echten Anker
   ersetzt werden — das ist der Retry-Pfad aus S03-10. Trigger
   `ENABLE ALWAYS`.

2. **Gesiegeltes Zweitregister `audit_anchor_seal`.** Eigene Rolle
   `grc_audit_seal` als Eigentümer, `REVOKE ALL` gegen `grc_app` und
   `PUBLIC`, `FORCE ROW LEVEL SECURITY` mit einer Deny-all-Policy, die
   sich nur innerhalb der `SECURITY DEFINER`-Siegelfunktionen öffnet
   (funktionslokales GUC, das PostgreSQL beim Verlassen zurücksetzt).
   Jedes Siegel verkettet auf das vorherige, mit
   `UNIQUE NULLS NOT DISTINCT (prev_seal_hash)` — eine Zeile
   herauszuschneiden oder einzufügen bricht die Kette. Jedes Siegel trägt
   einen **HMAC unter `AUDIT_SEAL_KEY`, der nicht in der Datenbank
   liegt**, sondern per Session-GUC aus der Anwendungsumgebung kommt.
   Das Siegel bindet zusätzlich das Kettenende (`chain_tip_hash`,
   `chain_tip_seq`) zum Siegelzeitpunkt.

3. **`audit_anchor_verify()`** — die Prüfung, die es nie gab. Meldet
   `anchor_digest_mismatch`, `seal_missing`, `anchor_missing`,
   `seal_chain_broken`, `seal_hash_invalid`, `seal_hmac_invalid`,
   `seal_unsigned`. Aufgerufen von `/audit-log/integrity`,
   `GET /audit-log/anchor` und dem Verifikations-Cron. `/integrity` ist
   **nicht** `healthy`, wenn die Kette intakt, ein Anker aber
   überschrieben ist — das ist genau der Angriff.

4. **Kein Bypass über `session_replication_role`.** Alle Guards auf
   `audit_log`, `audit_anchor`, `audit_anchor_seal` und
   `whistleblowing_audit_log` sind `ENABLE ALWAYS`.

5. **Export nach außen.** `audit_anchor_seal_export(after_seq)` liefert
   die Siegelzeilen als JSONL für eine Spiegelung in WORM-Speicher.

**Nachweis:**

```
=== Anker überschreiben, Guard aktiv, replica-Rolle gesetzt ===
SET
ERROR:  audit_anchor: merkle_root/leaf_count of a complete anchor are immutable
        — rewriting them is the S03-01 attack

=== Anker überschreiben, Guard vom Superuser deaktiviert ===
UPDATE 1
         issue          | detail
------------------------+---------------------------------------------------------
 anchor_digest_mismatch | stored root 0000…0000 does not match the sealed digest
```

Tests: Block „S03-01 — full chain rewrite and anchor overwrite" (5 Tests):
Kettenneuberechnung, Anker-Overwrite abgewiesen, Anker-Overwrite erzwungen
→ erkannt, gelöschter Anker → erkannt, herausgeschnittene Siegelzeile →
`seal_chain_broken`.

**Restlücke:** siehe Abschnitt 5.

---

### S03-03 (High) — Akteursfelder ungehasht und UPDATE-erlaubt · **behoben**

**Änderung:** `0400_audit_hash_v4_commitment.sql` führt Formel **v4** ein.
Statt die Nutzdaten direkt zu hashen, hasht v4 ein _Content-Commitment_:

```
content_commitment = SHA256(changes | user_email | user_name | ip_address | entity_title)
entry_hash         = SHA256(previous_hash | id | org_id | user_id | entity_type |
                            entity_id | action | content_commitment |
                            action_detail | metadata | created_at_utc | scope)
```

Damit sind alle vier zuvor ungehashten Spalten gebunden, und `id`
zusätzlich. Der Verifizierer prüft für nicht-tombstonierte v4-Zeilen
außerdem, ob sich das Commitment aus den aktuellen Spaltenwerten
reproduzieren lässt (`commitment_mismatch`).

Bestandszeilen (v1–v3) werden **nicht** neu gehasht — Begründung in
ADR-026 rev.2.

**Nachweis:**

```
UPDATE audit_log SET user_email='innocent.intern@example.com', … WHERE id=…
ERROR:  audit_log column user_email may only change during the initial
        GDPR Art. 17 tombstone of the row

-- per Superuser erzwungen:
healthy = false | commitmentMismatches = 1
```

Test: Block „S03-03 — the actor fields" (2 Tests).

---

### S03-05 (High) — sechs Pfade schreiben an der Kette vorbei · **behoben**

**Ursache:** `audit_trigger()` berechnete die Hashes und schrieb dann
`INSERT`. Jeder andere `INSERT` in `audit_log` landete mit
`entry_hash = NULL`, `previous_hash_scope = NULL`, `hash_version = 1`
(Spaltendefault) in der Tabelle — außerhalb jeder Prüfung und jedes
Ankers. `/integrity` wies sie als „pre-rev2 legacy rows … reported
informationally" aus, während sechs Produktivpfade sie laufend erzeugten.

**Änderung (der strukturelle Fix):**
`0401_audit_chain_assign_and_guards.sql` verlagert die Kettenlogik in
einen `BEFORE INSERT`-Trigger **auf `audit_log` selbst**
(`audit_log_chain_assign()`, `ENABLE ALWAYS`, `SECURITY DEFINER`). Jeder
Insert — Trigger, Anwendungs-SQL, Migration, `psql` — wird skopiert,
von Geheimnissen bereinigt, committet und gehasht. Vom Aufrufer
gelieferte Kettenwerte werden **verworfen**: ein gefälschter Scope hätte
eine Zeile in die Kette eines fremden Mandanten gelegt.

Damit ist die Klasse geschlossen, nicht nur die sechs bekannten Fälle.
`write_audit_entry(...)` (0404) existiert als benannter, dokumentierter
Pfad für manuelle Einträge.

**Angepasste Aufrufstellen** (nur Kommentar/Kontext, kein Verhalten):

| Pfad                         | Datei                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Bulk-Prozessoperation        | `apps/web/src/app/api/v1/processes/bulk/route.ts:150`                                                                                    |
| Dokument-Integritätsprüfung  | `apps/web/src/app/api/v1/documents/[id]/verify-integrity/route.ts`                                                                       |
| Upload-Ablehnung (Malware)   | `apps/web/src/app/api/v1/documents/[id]/upload/route.ts`                                                                                 |
| **DSGVO-Löschung**           | `apps/web/src/app/api/v1/documents/[id]/erase/route.ts` — _fachlich WP7/WP8, nur Audit-Aufruf berührt_                                   |
| **Controlled-Copy-Download** | `apps/web/src/lib/documents/controlled-copy.ts`                                                                                          |
| **Retention-Hard-Delete**    | `apps/worker/src/crons/document-retention-purge.ts:79` — _fachlich WP7/WP8, nur Audit-Aufruf und der sachlich falsche Kommentar berührt_ |

Der Kommentar in `document-retention-purge.ts` behauptete, „chain_seq /
hash chain are assigned by DB defaults + triggers". Das war falsch; jetzt
ist es wahr, und der Kommentar sagt, wodurch.

**Nachweis:** `/integrity` meldet `unchainedRows` **mit Zeitstempel der
jüngsten** solchen Zeile, sodass historischer Altbestand von einem aktiven
Bypass unterscheidbar ist. Tests: Block „S03-05 — writes that used to
bypass the chain" (2 Tests, darunter ein `INSERT` in exakt der Form aus
`document-retention-purge.ts:82` und einer mit gefälschtem Scope).

---

### S03-06 (High) — Art.-17-Tombstone bricht die Kette dauerhaft · **behoben**

**Änderung:** die v4-Konstruktion aus S03-03 löst den Zielkonflikt:

- **v4-Zeilen:** die Redaktion überschreibt die Nutzdaten und **erhält das
  Commitment**. `entry_hash` rechnet weiterhin nach, die Kette bleibt
  intakt, die personenbezogenen Daten sind weg.
- **v1–v3-Zeilen:** nicht rückwirkend reparierbar. Für sie schreibt ein
  neuer `AFTER UPDATE`-Trigger (`audit_log_redaction_event()`, 0401) die
  Redaktion als **eigenes, gehashtes, verankerbares Kettenglied**
  (`entity_type='audit_log'`, `action_detail='pii_tombstone'`, wer, wann,
  warum). Der Verifizierer meldet sie als `redacted_legacy` — kein Bruch.
  Eine tombstonierte Zeile **ohne** dieses Ereignis ist ein Befund
  (`redaction_unproven`): so sieht eine als Löschung getarnte Manipulation
  aus.

`tombstone_audit_entry()` und `redact_pii_jsonb()` sind **nicht** geändert
— sie gehören WP8. Der Guard erkennt den Tombstone am
Spaltenübergang, nicht an einem Flag, das die Funktion setzen müsste; die
Schnittstelle zwischen WP4 und WP8 ist damit implizit und kollisionsfrei.

Falsche Zusagen in `apps/web/src/app/api/v1/dpms/audit-log-tombstone/route.ts`
korrigiert, inklusive der Erklärung, warum „entry_hash preserved" und
„chain stays verifiable" zwei verschiedene Aussagen sind.

**Nachweis:** Block „S03-06 — GDPR Art. 17 redaction keeps the chain
verifiable": nach `tombstone_audit_entry()` ist `healthy = true`,
`redactionUnproven = 0`, und genau **ein** Redaktionsereignis existiert in
der Kette. Der frühere Integrationstest prüfte nur
`expect(after.entry_hash).toBe(originalHash)` — Hash-Gleichheit, nie
Verifizierbarkeit.

---

### S03-07 (High) — Offline-Verifikation unbrauchbar · **behoben**

**Änderung:** `apps/web/src/app/api/v1/audit-log/archive/route.ts`.

1. **Formel.** README dokumentiert v4 **und** v3, feldgenau, inklusive der
   Regeln für NULL und für `previous_hash = NULL`.
2. **Feldumfang.** Export enthält jetzt `chainSeq`, `hashVersion`,
   `actionDetail`, `metadata`, `contentCommitment`, `ipAddress`,
   `piiTombstonedAt`, `piiTombstoneReason`. `changes` und `metadata`
   werden als **exakte PostgreSQL-`jsonb::text`-Darstellung** exportiert —
   ein JSON-Round-Trip durch eine andere Bibliothek ordnet Schlüssel um
   und verändert die gehashten Bytes.
3. **Reihenfolge.** `ORDER BY chain_seq`, dokumentiert samt Begründung
   (`now()` ist innerhalb einer Transaktion identisch, der Tiebreak über
   eine Zufalls-UUID erzeugte 23 vorgetäuschte Brüche in 142 Zeilen).
4. **Verifizierer.** `verify/verify_archive.py` (weiterhin auch als
   `rebuild_merkle.py` ausgeliefert) prüft dreistufig: **Zeile**
   (Recompute inkl. Commitment) → **Kette** → **Anker**. Das alte Skript
   prüfte nur Stufe 3 und meldete für den S03-02-Angriff wörtlich „All
   anchors matched".
5. **Ehrlichkeit.** Neuer README-Abschnitt „What this archive does not
   prove": Anker decken nur ihren Tag ab, und ein Archiv, das nur in der
   Plattform liegt, beweist nichts.

**Nachweis:** Block „S03-07 — the offline verification path" (4 Tests).
Er extrahiert das **ausgelieferte** Python aus dem Route-Modul, baut ein
Archiv aus der Live-DB und führt es aus.

Zusätzlich derselbe Lauf über die vollständige Platform-Kette einer aus
den Migrationen erzeugten Datenbank (`wp4_final`, 149 Zeilen — der Audit
maß 142 auf seiner Instanz):

```
== ARCTOS audit archive verification ==
149 rows
-- 1. row hashes --   149/149 rows recompute correctly
-- 2. chain links --  149/149 chain links intact
OK — every row recomputes, every chain link holds, and every
anchored Merkle root matches the rows it covers.
```

Die Formel aus dem alten README trifft auf denselben Daten weiterhin
**0 von 149** — das war der Befund, nicht ein Messfehler:

```
 zeilen | treffer_readme_alt | treffer_v3 | treffer_v4
    149 |                  0 |        146 |          3
```

Ein Test manipuliert den Inhalt bei unverändertem `entryHash` (der
S03-02-Angriff, wie er im Archiv aussieht) → Exit 1, „content commitment
does not match the row content". Ein weiterer entfernt eine Zeile → Exit 1,
Kettenbruch. Ein vierter prüft, dass jedes Feld, das das Skript liest, im
Export vorhanden ist — er wird rot, sobald wieder eine Hash-Eingabe aus
der Projektion fällt.

---

### S03-14 (High) — Geheimnisse im unlöschbaren Log · **behoben (Kettenanteil)**

**Änderung:** `0400` + `0401`.

- Deklarative Deny-Liste `audit_sensitive_column` (Tabelle × Spalte),
  gefüllt mit den 12 Geheimnis-Spalten aus der Evidenz E6.
- Rekursive Schlüsselmuster-Prüfung `audit_scrub_secrets_jsonb()` über
  alle JSON-Ebenen — `redact_pii_jsonb` (WP8) arbeitet nur auf der
  obersten Ebene und kennt keine Credential-Begriffe. Bewusst **nicht**
  wiederverwendet: das läuft bei jedem Schreibvorgang und darf nicht von
  einer Funktion abhängen, die ein anderes Paket gerade umbaut.
- Ausnahmen für LLM-Buchhaltungsspalten (`prompt_tokens`, `total_tokens`,
  …), damit Nutzungsnachweise nicht Kollateralschaden werden.
- Schnellpfad: eine Regex über die serialisierte Nutzlast; der Normalfall
  überspringt den rekursiven Durchlauf.
- Angewandt in `audit_log_chain_assign()`, also auf **jedem** Insert, und
  zusätzlich in `whistleblowing_audit_trigger()`.
- **HinSchG-Anteil:** `audit_trigger()` schreibt für `wb_case`,
  `wb_case_message`, `wb_case_evidence`, `wb_report`, `wb_case_task` nur
  noch einen identitätsfreien Existenzeintrag (kein `user_id`, kein
  `user_email`, kein `user_name`, kein Zeileninhalt). Der vertrauliche
  Datensatz bleibt in `whistleblowing_audit_log` mit gehashtem Akteur.

**Nachweis:** Block „S03-14 — credentials must not enter the immutable
log": Passwort-Hashes (alt und neu), ein verschachteltes
`oidc_client_secret` und `prompt_tokens` in einem Insert → die Geheimnisse
fehlen im gespeicherten `changes`, die Schlüsselnamen und der Zählwert
bleiben.

**Abgrenzung:** die _vollständige_ Entfernung des generischen Triggers von
den `wb_*`-Tabellen ist S07-01 und gehört WP8. Der hiesige Fix ist
unabhängig davon wirksam und kollidiert nicht.

---

### S03-11 (Medium) — FreeTSA-Antwort wird nicht validiert · **behoben**

**Änderung:** `packages/shared/src/lib/freetsa.ts` — neue Funktion
`verifyTimestampResponse()`, aufgerufen von `requestTimestamp()` vor dem
Zurückgeben. Geprüft werden: `PKIStatus` (nur 0; `grantedWithMods` wird
abgelehnt), `messageImprint` gegen die eingereichte Wurzel, **Nonce**
gegen den gesendeten, die vollständige CMS-Signatur
(`message-digest`-Attribut gegen SHA-256 über den `eContent`, Signatur
über die DER-`SET OF signedAttrs` unter dem Zertifikatsschlüssel),
`genTime`-Plausibilität gegen den Gültigkeitszeitraum des Zertifikats, und
— bei gesetztem `FREETSA_CA_PEM` — die Zertifikatskette. Ohne
Vertrauensanker ist das Ergebnis `chainVerified: false`, nicht
stillschweigend „verifiziert".

`audit_anchor.tsa_verified` unterscheidet „gespeichert" von „geprüft";
`verified_at` wird vom Re-Verifikationsjob geschrieben — die Spalte
existierte seit ADR-011 rev.3 und wurde von keinem Codepfad je gesetzt.

**Nachweis:** `packages/shared/tests/freetsa-validation.test.ts` (11
Tests) gegen eine **echte**, mit `openssl ts` erzeugte
`TimeStampResp` (Fixture + Reproduktionsanleitung unter
`packages/shared/tests/fixtures/`). Einen DER-Validierer nur gegen den
eigenen Encoder zu testen beweist nichts über die Antworten, die er
tatsächlich bekommt.

```
valid:              { verified: true, chainVerified: true, signerSubject: 'CN=ARCTOS Test TSA' }
falscher Imprint →  imprint_mismatch
falscher Nonce  →   nonce_mismatch
Signatur verfälscht → signature_invalid
falscher Trust-Anchor → chain_untrusted
Status-only-Antwort (das, was vorher akzeptiert wurde) → no_token
```

---

### S03-16 (Medium) — `TRUNCATE` umgeht die Append-only-Rule · **behoben**

**Änderung:** `0401`. `BEFORE TRUNCATE`-Statement-Trigger (`ENABLE
ALWAYS`) auf `audit_log`, `audit_anchor`, `whistleblowing_audit_log`,
`access_log`, `data_export_log`, `audit_anchor_seal` und
`audit_log_write_attempt`. Jeder Versuch wird abgewiesen **und** in
`audit_log_write_attempt` protokolliert.

Nebenbefund (stiller `DELETE 0`): die Rule ist durch einen
`BEFORE DELETE`-Trigger ersetzt, der die Semantik beibehält (nichts wird
gelöscht, kein bestehender Aufrufer ändert sein Verhalten) und den Versuch
mit `WARNING` protokolliert. `/integrity` und der Verifikations-Cron
melden abgewiesene Schreibversuche der letzten 24 h.

**Nachweis:** Block „S03-16 — DELETE and TRUNCATE" (3 Tests), inklusive
`TRUNCATE` unter `session_replication_role='replica'`.

---

### S03-09 (Medium) — Vorgänger-Hash-Race unter `repeatable read` · **behoben**

**Änderung:** `0402_audit_chain_order_and_fork_guard.sql` — das Muster aus
Migration 0341 (Sign-off-Ketten) übernommen:

```sql
ALTER TABLE audit_log ADD CONSTRAINT audit_log_scope_prev_uniq
  UNIQUE NULLS NOT DISTINCT (previous_hash_scope, previous_hash);
```

Eine Constraint wird gegen den _committeten_ Zustand geprüft, nicht gegen
den Transaktions-Snapshot, und hält deshalb auf jedem Isolationslevel. Der
Advisory-Lock bleibt als Optimierung erhalten, damit der Normalfall nicht
in die Constraint läuft; `audit_warn_non_read_committed()` benennt die
Ursache im Log, wenn doch.

`NULLS NOT DISTINCT` ist der entscheidende Teil: ohne ihn dürften beliebig
viele Zeilen „kein Vorgänger" beanspruchen — also beliebig viele
Kettenköpfe, und ein zweiter Kopf _ist_ der Fork.

**Nachweis:** Block „S03-09": ein erzwungener Insert, der einen bereits
beanspruchten Vorgänger reklamiert, wird mit
`audit_log_scope_prev_uniq` abgewiesen.

---

### S03-12 · S03-18 (Medium) — keine automatische Prüfung, kein Tamper-Test · **behoben**

**S03-12.** Neu: `apps/worker/src/crons/audit-chain-verify.ts`. Läuft über
die **vollständige** Kette jedes Scopes, rechnet jede Zeile nach, prüft
jeden Anker gegen sein Siegel, re-verifiziert gespeicherte
RFC-3161-Beweise (und setzt dabei erstmals `verified_at`), meldet
Ankerlücken älter als 48 h, zählt abgewiesene Schreibversuche und
schreibt jeden Lauf nach `audit_chain_verification` (append-only). Keine
Stichprobe, keine Toleranzschwelle, keine Fortsetzung bei Query-Fehler.

Zusätzlich ist die Ursache der „bekannten Rehash-Artefakte" geklärt:
`0328` verkettete in `(created_at, id)`-Reihenfolge neu, während `0313`
und der Verifizierer `chain_seq` verwenden — messbar 21 von 146 Zeilen auf
einer allein aus den Migrationen erzeugten Datenbank. `0402` repariert
das **hashwahrend**: `chain_seq` wird entlang der vorhandenen
`previous_hash`-Verkettung umnummeriert, kein einziger Hash wird neu
berechnet, jede bereits erteilte Merkle-Wurzel bleibt gültig. Die
Reparatur läuft nur, wenn der Zeigergraph eines Scopes ein sauberer
einzelner Pfad über alle Zeilen ist.

```
NOTICE:  0402: chain_seq realigned with the previous_hash linkage for 146 row(s);
         no hash was recomputed
-- danach:
 org:aaaaaaaa-…|0|5
 org:platform  |0|146      ← broken, total
```

**S03-18.** Neu: `packages/db/tests/integration/audit-tamper-evidence.test.ts`
— **31 Tests**, jeder fährt einen im Bericht reproduzierten Angriff und
prüft Abweisung oder Erkennung.
`apps/web/src/__tests__/api/audit-log-integrity.test.ts` neu gefasst: der
Dateikopf behauptet nicht mehr, die SHA-256-Kette zu verifizieren
(ein vollständig gemockter Test kann das nicht), und die Tautologie
`expect([200,503]).toContain(res.status); expect(body).toBeDefined();` ist
durch neun Verhaltensassertions ersetzt.
`apps/web/src/__tests__/lib/signoff-chain-concurrency-guard.test.ts`
bezeichnet sich jetzt als das, was es ist — ein Drift-Check auf der
Migrationsquelle —, und das Verhalten wird gegen die Live-Datenbank
geprüft. Zusätzlich hält der Drift-Check fest, dass `0402` **nicht**
rehasht: eine spätere Änderung, die daraus einen Rehash macht, wird rot.

---

### S03-08 (Medium) — Kontinuitätszusage auf nicht existierenden Mechanismen · **behoben**

**Änderung:**

- `0407`: Enum-Wert `migration_run` ergänzt (der Cast in der Lesequery
  schlug bis dahin fehl, der Fehler wurde von einem leeren `catch`
  verschluckt, `migrationAnchors` war strukturell **immer** `[]`), Funktion
  `record_migration_anchor()` gebaut, Anker für `0400` geschrieben.
  `entity_id` ist `uuid` und kann „0400" nicht aufnehmen — die
  Migrationsnummer steht in `action_detail`/`entity_title`, und das ADR
  ist entsprechend korrigiert.
- `0403`: `audit_anchor.anchored_at` und `.hash_version` ergänzt — die
  Spalten, die der Endpunkt seit Wave 24 abfragte und die nicht
  existierten. Das `catch` um die Query ist entfernt.
- `continuity/route.ts`: `totalContinuityValid` ist an
  `audit_chain_verify()` gekoppelt. Kein Versionshistogramm kann mehr
  `valid: true` erzeugen, während die Verifikation scheitert.

---

### S03-10 (Medium) — kein Scheduler, kein Retry, Datum um einen Tag versetzt · **teilweise behoben**

| Teilbefund                                 | Stand                                                                                                                                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fehlschlag blockiert jeden Retry dauerhaft | **behoben** — der Cron prüft `proof_status <> 'failed'` (wie der API-Pfad) und arbeitet ein Fenster von `AUDIT_ANCHOR_RETRY_DAYS` (Default 14) ab, nicht nur „gestern". Ein FreeTSA-Ausfall erzeugt keine dauerhafte Lücke mehr. |
| `date`-Parameter um einen Tag versetzt     | **behoben** — `targetDate` ist jetzt der zu verankernde Tag. **Verhaltensänderung**, in ADR-011 rev.4 vermerkt.                                                                                                                  |
| Stiller Ausfall ohne Alarm                 | **behoben** — der Verifikations-Cron meldet Tage mit Audit-Aktivität ohne abgeschlossenen Anker, älter als 48 h.                                                                                                                 |
| **Kein Scheduler ausgeliefert**            | **offen — WP9.** Der Worker ist ein HTTP-Listener ohne Scheduler (S10-02, dasselbe Finding für alle 128 Jobs). Siehe Abschnitt 4.                                                                                                |

---

### S03-13 (Medium) — Trigger-Deckungslücken, Sign-offs nur INSERT · **behoben**

`0405_audit_trigger_coverage.sql`: `audit_trigger` auf
`approval_decision`, `review_decision`, `attestation_response`, `account`,
`module_definition`, `module_nav_item`. Die drei Sign-off-Tabellen von
`INSERT` auf `INSERT OR UPDATE OR DELETE` erweitert und mit einer
`no_delete`-Rule versehen — eine Freigabe wird nicht durch Löschen
zurückgezogen, sondern durch einen neuen, signierten Datensatz.

**Nachweis:** Test „the decision tables that had no audit trigger now have
one" prüft Existenz **und** Ereignismenge (I/U/D) aus `pg_trigger`.

---

### S03-15 (Medium) — Whistleblowing-Kette ungeschützt, TZ-abhängig, unverifiziert · **behoben**

`0406_wb_audit_chain_hardening.sql`:

- `hash_version`-Spalte ergänzt; `compute_wb_audit_hash_v2()` ist
  TZ-invariant (dieselbe Korrektur, die `audit_log` mit v3 bekam und die
  die WB-Kette nie erhalten hatte); `compute_wb_audit_hash_v1()` bleibt
  für Bestandszeilen erhalten und ist bewusst als `STABLE` statt
  `IMMUTABLE` deklariert — die Zeitzonenabhängigkeit _ist_ der Defekt.
- Append-only-Guard (`ENABLE ALWAYS`) für UPDATE und DELETE, plus
  TRUNCATE-Guard.
- Fork-Constraint `UNIQUE NULLS NOT DISTINCT (case_id, previous_hash)`.
- Vorgängersuche mit `entry_hash` als Tiebreak statt einer Zufalls-UUID.
- `wb_audit_chain_verify()` — die Kette wurde bis dahin geschrieben und
  nie gelesen.

**Abgrenzung:** nur der Kettenanteil. Actor-Hash-Konstruktion, Payload und
Case-ID-Auflösung sind byteidentisch zur vorherigen Definition, damit WP8
(S07-01/-03/-06) kollisionsfrei darauf aufsetzen kann.

**Nachweis:** Block „S03-15" prüft `ENABLE ALWAYS`, TZ-Invarianz (derselbe
Hash unter `Europe/Berlin` und `UTC`) und den Verifizierer.

---

### S03-17 (Low) — Merkle ohne Domain-Separation · **behoben**

`packages/shared/src/lib/merkle-tree.ts`: `merkleRootV2()` nach RFC 6962 —
`SHA256(0x00 || leaf)`, `SHA256(0x01 || l || r)`, ungerade Ebene wird
**hochgereicht statt dupliziert**, und die Blattzahl geht in die Wurzel
ein (`SHA256(0x02 || uint64_be(count) || root)`). `merkleRootVersioned()`
dispatcht; `audit_anchor.merkle_version` hält fest, welche Konstruktion
eine gegebene Wurzel erzeugt hat, sodass Altanker verifizierbar bleiben.
`merkleProofV2()`/`verifyMerkleProofV2()` passend ergänzt.

**Nachweis:** `packages/shared/tests/merkle-domain-separation.test.ts` (18
Tests). Der erste Test hält die _Schwäche_ von v1 ausdrücklich fest
(`[a,b,c]` und `[a,b,c,c]` liefern dieselbe Wurzel), damit der Grund für
v2 im Testbestand sichtbar bleibt.

---

### S03-19 (Medium) — `grc_app` ohne Rechte auf `audit_log` · **behoben**

`0407`: `GRANT SELECT` auf `audit_log`, `audit_anchor`,
`audit_chain_verification`, `audit_log_write_attempt`,
`audit_sensitive_column`; `INSERT` nur auf `audit_chain_verification`;
`REVOKE INSERT/UPDATE/DELETE/TRUNCATE` auf `audit_log` und `audit_anchor`
explizit. Geschrieben wird ausschließlich über `SECURITY DEFINER`-Trigger
und `write_audit_entry()`. Die Grants stehen in einer Migration, nicht in
`deploy/provision-grc-app.sh` — ein Recht, das nur in einem Shell-Skript
existiert, existiert nicht in CI, nicht im DR-Restore und nicht in einer
Neuinstallation.

`integrity/route.ts` behandelt `42501` gesondert: HTTP 500 mit
„Audit log not readable by the runtime role" statt 503
„Hash-chain verification could not complete". Ein Rechtefehler ist ein
Deployment-Defekt und darf nicht wie ein manipulierter Audit-Trail
aussehen.

---

### S03-20 (Low) — Doku-Drift · **behoben, zuletzt**

Beide ADRs sind **nach** den technischen Fixes überarbeitet, damit sie
danach stimmen statt nur ehrlicher zu sein.

- `docs/ADR-011-rev3.md` → inhaltlich **rev.4** (Dateiname beibehalten, da
  aus Code, Tests und ausgelieferten Archiv-READMEs verlinkt). Enthält
  eine Tabelle „Zusage gegen Messung" mit allen zehn Abweichungen, die
  neue Konstruktion (D1–D10) und einen ausdrücklichen Abschnitt D11 „Die
  Grenze" mit der Vorher/Nachher-Matrix.
- `docs/ADR-026-hash-chain-v3-migration.md` → **rev.2**. Zieht die
  falschen Aussagen einzeln zurück (Migrations-Trigger in 0341,
  `entity_id='0328'`, `freeTsaAnchors`, „monthly", „restricted by RLS",
  DR-Drill-Schwelle) und **widerruft die Rehash-Vorlage für v4** samt
  Begründung.

Die Einzelbefunde aus der S03-20-Tabelle:

| Zusage                                                    | Stand                                                     |
| --------------------------------------------------------- | --------------------------------------------------------- |
| Archive-Export / OTS-Upgrade „Phase 2"                    | als erledigt geführt                                      |
| „Läuft 00:05 UTC"                                         | als Betriebsanforderung ausgewiesen, offener Punkt an WP9 |
| täglich vs. monatlich                                     | einheitlich täglich                                       |
| „migration audit trigger added in 0341"                   | Mechanismus gebaut (0407), ADR korrigiert                 |
| `migrationAnchors`-Beispiel                               | tatsächlich befüllt                                       |
| `integrity/route.ts`-Kopfkommentar (v0–v2)                | neu geschrieben, v4 inbegriffen                           |
| „tombstone … without breaking the hash chain"             | korrigiert, mit Erklärung                                 |
| „chain_seq/hash chain assigned by DB defaults + triggers" | jetzt wahr, Kommentar sagt wodurch                        |
| „strictly serialised" (0284)                              | in ADR-011 D9 richtiggestellt                             |

---

## 3. Abnahme

| Kriterium                                     | Ergebnis                                                                                                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrationen von Null                          | **381/381**, 590 Tabellen, Exit 0 (`wp4_final`)                                                                                                                       |
| Tamper-Test                                   | `audit-tamper-evidence.test.ts` — **31/31 grün**                                                                                                                      |
| Tamper-Test schlägt auf dem Vorher-Stand fehl | belegt: alter Guard + alter Verifizierer → `healthy: t` bei manipulierter Zeile (Abschnitt S03-02)                                                                    |
| FreeTSA-Negativtest                           | `freetsa-validation.test.ts` — **11/11 grün**, echte `openssl ts`-Antwort                                                                                             |
| Merkle-Domain-Separation                      | `merkle-domain-separation.test.ts` — **18/18 grün**                                                                                                                   |
| Offline-Verifikation                          | **149/149** Zeilen und **149/149** Kettenglieder mit dem ausgelieferten Skript; alte README-Formel weiterhin 0/149; Inhaltsangriff und gelöschte Zeile werden erkannt |
| `packages/db` Integration                     | **64 grün, 1 Skip** (Skip vorbestehend, W23.2 dokumentiert)                                                                                                           |
| `packages/shared`                             | **1923/1923 grün**                                                                                                                                                    |
| `tsc --noEmit` (`apps/web`, `apps/worker`)    | keine Fehler aus WP4-Dateien; einzig `TS2688 react-grid-layout` — vorbestehend, `@types/react-grid-layout@2.1.0` ist ein Stub ohne `.d.ts` (WP12/S14-25)              |

**Reproduktion:**

```bash
export PGPASSWORD=grc_dev_password
DB=wp4_final; dropdb -h localhost -U grc --if-exists $DB; createdb -h localhost -U grc $DB
psql -q -h localhost -U grc -d $DB -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS vector;
  CREATE EXTENSION IF NOT EXISTS timescaledb;'
cd packages/db
DATABASE_URL="postgresql://grc:grc_dev_password@localhost:5432/$DB" npx tsx src/migrate-all.ts
DATABASE_URL="postgresql://grc:grc_dev_password@localhost:5432/$DB" \
  npx vitest run --config vitest.integration.config.ts
cd ../shared && npx vitest run tests/freetsa-validation.test.ts tests/merkle-domain-separation.test.ts
```

---

## 4. Bedarf an andere Pakete

### An WP9 (Worker, Cron) — **blockierend für S03-10 und S03-12**

1. `apps/worker/src/index.ts`: Endpunkt registrieren

   ```ts
   import { processAuditChainVerify } from "./crons/audit-chain-verify";

   app.post("/crons/audit-chain-verify", async (c) => {
     const result = await processAuditChainVerify(undefined);
     return c.json(
       { success: result.healthy, ...result },
       result.healthy ? 200 : 503,
     );
   });
   ```

   Die Datei gehört WP9 (`apps/worker/**`), deshalb nicht selbst geändert.
   Der Cron selbst liegt fertig unter
   `apps/worker/src/crons/audit-chain-verify.ts`.

2. **Scheduler.** Ohne ihn läuft weder Anker noch Verifikation — das ist
   der Kern von S03-10 und identisch mit S10-02. Empfehlung:
   `daily-audit-anchor` 00:05 UTC, `audit-chain-verify` 02:00 UTC.

3. `apps/worker/src/index.ts`, Handler `daily-audit-anchor`: die Zeile
   `new Date(body.date + "T12:00:00Z")` kann bleiben, aber der Job zieht
   keinen Tag mehr ab. `{"date":"2026-04-15"}` verankert jetzt den 15.,
   vorher den 14. Bitte den Runbook-Text mitziehen.

4. **Alarm** auf `healthy === false` aus `audit-chain-verify` und auf neue
   Zeilen in `audit_log_write_attempt` (S13-11/-12).

### An WP10 (Betrieb, Skripte) — `scripts/**`

1. `scripts/dr-restore-drill.sh:120-168`: `CHAIN_THRESHOLD` auf 0 setzen
   und die Query durch
   `SELECT audit_chain_verify('org:'||org_id) FROM …` bzw.
   `audit_chain_verify_and_record()` ersetzen. Die dort tolerierten fünf
   Produktionsbrüche sind erklärt und hashwahrend repariert (S03-12 oben);
   die Toleranz hat keine Grundlage mehr. Auch `|| echo "?"` entfernen —
   ein Query-Fehler darf nicht als bestanden gelten.
2. `scripts/pilot-readiness-gate.sh:262-266`: `totalContinuityValid` ist
   jetzt an die kryptografische Verifikation gekoppelt und damit
   aussagekräftig. Zusätzlich empfohlen: das Gate auch gegen
   `GET /api/v1/audit-log/integrity` (`healthy`) laufen lassen.
3. Deployment: `AUDIT_SEAL_KEY`, `AUDIT_SEAL_KEY_ID` und `FREETSA_CA_PEM`
   in die Produktions-Umgebung aufnehmen und in die Secret-Rotation
   einbeziehen. Ohne `AUDIT_SEAL_KEY` sind Anker-Siegel verkettet, aber
   nicht signiert; `/integrity` meldet das als `anchor_unsealed`.
4. Phase 2 (ADR-011 rev.4): `audit_anchor_seal_export()` in einen
   WORM-/Append-only-Speicher außerhalb dieser Datenbank spiegeln. Das ist
   der einzige Schritt, der die Restlücke aus Abschnitt 5 schließt.

### An WP2 (RLS)

1. `audit_anchor_seal` hat eine Deny-all-Policy, die sich nur innerhalb
   der drei Siegelfunktionen öffnet
   (`current_setting('app.audit_seal_ctx')`). Sie ist Teil der
   Siegelkonstruktion und darf **nicht** durch eine generische
   org-Scope-Policy ersetzt oder gelockert werden.
2. `audit_log` und `audit_anchor` haben jetzt `GRANT SELECT` an `grc_app`
   (0407). Falls WP2 dort RLS ergänzt: Lesen muss für `admin`, `auditor`,
   `ciso`, `compliance_officer` innerhalb der eigenen Org möglich bleiben,
   sonst meldet `/integrity` einen Rechtefehler.
3. Die SECURITY-DEFINER-Siegelfunktionen laufen bewusst unter der
   Migrationsrolle, nicht unter `grc_audit_seal`, weil sie `audit_anchor`
   und `audit_log` lesen und deren RLS-Policies WP2-eigene
   Hilfsfunktionen aufrufen. Wird eine neue Policy-Hilfsfunktion
   eingeführt, ändert sich daran nichts — bitte aber nicht die Ownership
   der Funktionen verschieben.

### An WP8 (Datenschutz)

1. `tombstone_audit_entry()` und `redact_pii_jsonb()` sind **unverändert**.
   Der Guard erkennt den Tombstone am Übergang
   `pii_tombstoned_at NULL → NOT NULL`, nicht an einem Flag — WP8 muss
   nichts setzen. **Bedingung:** die Funktion muss `pii_tombstoned_at` in
   **derselben** UPDATE-Anweisung setzen wie die Redaktionsspalten. Wird
   sie in zwei Anweisungen aufgeteilt, weist der Guard die zweite ab.
2. `whistleblowing_audit_trigger()` wurde geändert, aber **nur im
   Kettenanteil**: TZ-invariante Formel v2, `hash_version`-Spalte,
   `audit_scrub_changes()`, Tiebreak über `entry_hash`. Actor-Hash,
   Payload-Aufbau und Case-ID-Auflösung sind byteidentisch zur vorherigen
   Definition — S07-01/-03/-06 lassen sich darauf aufsetzen.
3. `audit_trigger()` schreibt für `wb_*`-Tabellen nur noch einen
   identitätsfreien Existenzeintrag. Die _vollständige_ Entfernung des
   generischen Triggers von diesen Tabellen ist S07-01 und bleibt WP8
   überlassen; beide Fixes sind unabhängig wirksam.
4. `audit_sensitive_column` ist als Konfigurationstabelle angelegt. Wenn
   WP8 im Rahmen von S07-05 weitere Spalten identifiziert, ist ein
   `INSERT` dort der vorgesehene Weg — kein PL/pgSQL-Eingriff nötig.
5. `redact_pii_jsonb()` ist bewusst **nicht** wiederverwendet: die
   Geheimnis-Bereinigung läuft auf jedem Schreibvorgang und darf nicht von
   einer Funktion abhängen, die WP8 gerade umbaut.

### An WP7 (DMS)

`documents/[id]/erase/route.ts` und
`apps/worker/src/crons/document-retention-purge.ts` wurden **nur** am
Audit-Aufruf und an einem sachlich falschen Kommentar berührt; die
Fachlogik ist unverändert.

### An WP11 (Testfundament)

`packages/db/tests/integration/**` läuft nur über
`npm run test:integration --workspace=@grc/db` mit gesetzter
`DATABASE_URL` — also nicht in `npm test`. Der Tamper-Test ist das
Abnahmekriterium dieses Pakets und sollte in CI verpflichtend laufen
(S11-11).

---

## 5. Restrisiko

**Die Kette leistet nach diesen Fixes Tamper-Evidence im eigentlichen
Sinn — mit einer benannten Grenze und einer betrieblichen Bedingung.**

Was jetzt gilt: jede der im Bericht reproduzierten Manipulationen wird
entweder **abgewiesen** (die Guards sind `ENABLE ALWAYS`, also auch unter
`session_replication_role = 'replica'` wirksam) oder, wenn ein Superuser
sie erzwingt, **erkannt** — durch das Content-Commitment, durch die
Fork-Constraint, durch das HMAC-Siegel der Anker und durch die
vollständige, wiederkehrende Verifikation. Der entscheidende Unterschied
zu vorher: der Angreifer kann die Kette zwar weiterhin umschreiben, aber
er kann kein Siegel erzeugen, das verifiziert, weil der HMAC-Schlüssel
nicht in der Datenbank liegt.

Die Grenze: **ein PostgreSQL-Superuser kann jeden Trigger und jede Tabelle
löschen, das Siegelregister eingeschlossen.** Nichts innerhalb einer
Datenbank ist gegen den Eigentümer dieser Datenbank manipulationssicher,
und der Worker läuft laut Produktions-Compose bewusst als Superuser. Gegen
einen Akteur, der _alles_ löscht statt zu fälschen, hilft nur ein Vergleich
mit einer außerhalb gehaltenen Kopie — dem Archiv-Export, der jetzt
funktioniert, oder der WORM-Spiegelung der Siegelzeilen aus Phase 2.

Die betriebliche Bedingung: ohne gesetzten `AUDIT_SEAL_KEY` und ohne
Scheduler bleibt ein Teil der Wirkung Papier. Beides ist in Abschnitt 4 an
WP9 und WP10 übergeben und in ADR-011 rev.4 als Betriebsanforderung
festgehalten, nicht als Empfehlung. Solange sie offen sind, ist die
ehrliche Aussage: **die Kette ist manipulationssicher gegen jeden Akteur
ohne Superuser-Rechte und manipulations-_evident_ gegen einen Superuser,
sobald ein Siegelschlüssel gesetzt und die Verifikation eingeplant ist.**
Vorher war sie beides nicht.
