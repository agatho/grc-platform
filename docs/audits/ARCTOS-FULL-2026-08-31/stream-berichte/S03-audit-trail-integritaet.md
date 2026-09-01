# S03 — Audit-Trail-Integrität & Tamper-Evidence

**Audit-ID:** ARCTOS-FULL-2026-08-31 · **Stream:** S03
**Prüfgegenstand:** `/work/repo` @ `a8d1414f`
**Laufzeitumgebung:** PostgreSQL 16 (`grc_platform`), Schreibexperimente auf Klon `s03_test` (pg_dump/restore, Haupt-DB unverändert)
**Status:** abgeschlossen — 20 Findings (2 Critical, 6 High, 10 Medium, 2 Low)

---

## 1. Zusammenfassung

Die zentrale Produktzusage — „unveränderliche, lückenlose Protokollierung mit SHA-256-Hash-Kette
und FreeTSA-Zeitstempeln" — hält der feindseligen Prüfung **nicht** stand.

Die Kette ist als _Integritätsprüfung_ handwerklich ordentlich gebaut (per-Tenant-Scope,
`chain_seq`-Ordnung, TZ-invariante v3-Formel, Advisory-Lock, DELETE-Rule, Append-only-Guard,
508 von 527 Tabellen mit Trigger, 142/142 Live-Zeilen verifizieren). Als _Tamper-Evidence_
versagt sie an mehreren unabhängigen Stellen, von denen jede einzeln ausreicht, um die Zusage
zu brechen.

**Kernaussage:** Die Hash-Kette schützt gegen versehentliche Korruption und gegen einen
Angreifer ohne DB-Rechte. Gegen einen privilegierten Akteur — Betreiber-Admin, kompromittierter
Worker (der laut Produktions-Compose bewusst als Superuser läuft), gestohlenes `DATABASE_URL` —
schützt sie nicht, und alle Mechanismen, die das laut ADR-011 rev.3 auffangen sollen
(externe Anker, Anker-Schranke, Kontinuitätsbeweis), sind entweder wirkungslos, unverifiziert
oder existieren im Code nicht.

### Findings nach Schwere

| ID     | Severity     | Titel                                                                                                                                                    |
| ------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S03-01 | **Critical** | Kette vollständig neu berechenbar; externe Anker liegen ungeschützt in derselben DB und werden nie verifiziert                                           |
| S03-02 | **Critical** | Ein erlaubtes `UPDATE` (`hash_version = 0`) schaltet die Verifikation ab; `entry_hash` und damit der FreeTSA-Anker bleiben gültig                        |
| S03-03 | High         | `user_email`/`user_name`/`ip_address`/`entity_title` nicht gehasht **und** UPDATE-erlaubt — „wer war es" spurlos fälschbar                               |
| S03-04 | High         | Anker-Schutzschranke `#WAVE10-CRITICAL-01` ist für v3 wirkungslos; der Nightly-Cron hat gar keine                                                        |
| S03-05 | High         | Sechs Produktivpfade schreiben Audit-Einträge ohne Hash und ohne Scope an der Kette vorbei (DSGVO-Löschung, Retention-Purge, Controlled Copy)            |
| S03-06 | High         | Die DSGVO-Art.-17-Tombstone-Funktion bricht die Kette dauerhaft — Code, ADR und Test behaupten das Gegenteil                                             |
| S03-07 | High         | Der mitgelieferte Offline-Verifikationsweg ist unbrauchbar: falsche Formel (0/142 Treffer), falsche Reihenfolge (23/142), fehlende Hash-Felder im Export |
| S03-14 | High         | Passwort-Hashes, Client-Secrets und Tokens landen im Klartext im unlöschbaren Audit-Log; `wb_*`-Tabellen leaken Hinweisgeber-Vorgänge ins org-weite Log  |
| S03-08 | Medium       | ADR-026 stützt die Kontinuitätszusage auf zwei nicht existierende Mechanismen; `totalContinuityValid` ist ein reines Versions-Histogramm                 |
| S03-09 | Medium       | Vorgänger-Hash-Race: unter `read committed` verhindert, unter `repeatable read`/`serializable` reproduzierbar (latent)                                   |
| S03-10 | Medium       | Kein Scheduler für den Anchor-Job; fehlgeschlagene Tage werden nie erneut verankert                                                                      |
| S03-11 | Medium       | FreeTSA-Antwort wird nicht validiert (kein Nonce, kein `messageImprint`, keine Signatur)                                                                 |
| S03-12 | Medium       | Keine automatische Kettenprüfung in Produktion; der einzige Check prüft nur Zeiger, 1000 Zeilen, Toleranz 10                                             |
| S03-13 | Medium       | Keine Audit-Trigger auf `approval_decision`/`review_decision`/`attestation_response`/`account`; Sign-off-Tabellen nur `INSERT`                           |
| S03-15 | Medium       | Whistleblowing-Kette ohne Append-only-Schutz, TZ-abhängig gehasht, nirgends verifiziert                                                                  |
| S03-16 | Medium       | `TRUNCATE audit_log` umgeht die Append-only-RULE vollständig                                                                                             |
| S03-18 | Medium       | Der „security-critical" Test des Integritäts-Endpoints kann nicht fehlschlagen; kein einziger Tamper-Erkennungstest                                      |
| S03-19 | Medium       | `grc_app` hat keinerlei Rechte auf `audit_log` — entweder sind alle Audit-Endpoints kaputt oder die Web-App läuft als Superuser                          |
| S03-17 | Low          | Merkle-Konstruktion mit Bitcoin-Duplikation ohne Domain-Separation — Wurzel bestimmt Blattmenge nicht eindeutig                                          |
| S03-20 | Low          | Doku-Drift in ADR-011 rev.3 / ADR-026 gegenüber der Implementierung (10 Einzelabweichungen)                                                              |

Die im Auftrag ausdrücklich verlangte **Race Condition** ist unter dem tatsächlich verwendeten
Isolationslevel `read committed` **nicht** reproduzierbar (Advisory-Lock greift, experimentell
mit zwei parallelen psql-Sessions belegt) — unter `repeatable read`/`serializable` **schon**
(S03-09, Fork-Nachweis).

---

## 2. Methodik-Protokoll

| #   | Schritt                                                                                                | Ergebnis / Evidenz                                                |
| --- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| M1  | ADR-011 rev.3 und ADR-026 gelesen, Zusagen extrahiert                                                  | `docs/ADR-011-rev3.md`, `docs/ADR-026-hash-chain-v3-migration.md` |
| M2  | Alle Audit-/Hash-Funktionen aus der **laufenden DB** gezogen (nicht aus Migrationen)                   | `evidence/S03_functions.sql` (389 Z.)                             |
| M3  | Trigger, Rules, Grants, RLS auf allen Log-Tabellen inventarisiert                                      | Abschnitt 3                                                       |
| M4  | Trigger-Deckungsmatrix über alle 527 Basistabellen                                                     | `evidence/S03_tables_without_audit_trigger.txt`                   |
| M5  | Verifikations-SQL 1:1 aus `integrity/route.ts` nachgebaut                                              | `evidence/S03_verify.sql`                                         |
| M6  | Anker-Schranke 1:1 aus `anchor/route.ts` nachgebaut                                                    | `evidence/S03_anchor_gate.sql`                                    |
| M7  | Isolierter DB-Klon `s03_test` via `pg_dump \| psql` (kein `-T`, da TimescaleDB-Worker die Quelle hält) | 527 Tabellen, 130 audit_log-Zeilen, Baseline `healthy = t`        |
| M8  | Schreibexperimente EXP-1…EXP-7 auf dem Klon                                                            | Abschnitt 5, je Finding                                           |
| M9  | Parallelitätsexperiment mit zwei echten psql-Sessions, drei Isolationslevel                            | S03-09                                                            |
| M10 | Kompensierende Kontrollen geprüft (Grants für `grc_app`, RULES, Guard, Anker, Tests, Monitoring)       | Abschnitt 4                                                       |

**Reproduktion des Klons:**

```
export PGPASSWORD=grc_dev_password
createdb -h localhost -U grc s03_test
pg_dump -h localhost -U grc -d grc_platform --no-owner --no-privileges | psql -h localhost -U grc -d s03_test -q
```

---

## 3. Bestandsaufnahme — Log-Tabellen, Schutzmechanismen

```
$ psql -U grc -d grc_platform -c "SELECT c.relname, t.tgname, p.proname, ... FROM pg_trigger t ..."
       table        |              tgname              |              func              | lvl | timing |        events
--------------------+----------------------------------+--------------------------------+-----+--------+----------------------
 audit_anchor       | audit_trigger                    | audit_trigger                  | ROW | AFTER  | INSERT DELETE UPDATE
 audit_log          | audit_log_tombstone_guard        | audit_log_tombstone_only_guard | ROW | BEFORE | UPDATE
 document_signature | document_signature_audit_trigger | audit_trigger                  | ROW | AFTER  | INSERT DELETE UPDATE
 process_sign_off   | process_sign_off_audit_trigger   | audit_trigger                  | ROW | AFTER  | INSERT
```

```
$ psql -U grc -d grc_platform -c "SELECT tablename, rulename, definition FROM pg_rules WHERE ..."
 public | audit_log       | audit_log_no_delete       | ON DELETE TO public.audit_log DO INSTEAD NOTHING;
 public | access_log      | access_log_no_update      | ON UPDATE TO public.access_log DO INSTEAD NOTHING;
 public | access_log      | access_log_no_delete      | ON DELETE TO public.access_log DO INSTEAD NOTHING;
 public | data_export_log | data_export_log_no_update | ON UPDATE TO public.data_export_log DO INSTEAD NOTHING;
 public | data_export_log | data_export_log_no_delete | ON DELETE TO public.data_export_log DO INSTEAD NOTHING;
```

| Tabelle                    | UPDATE blockiert           | DELETE blockiert | TRUNCATE blockiert | RLS                  | Hash-Kette                |
| -------------------------- | -------------------------- | ---------------- | ------------------ | -------------------- | ------------------------- |
| `audit_log`                | **teilweise** (Allow-List) | ja (RULE, still) | **nein**           | nein (bewusst, 0379) | ja (v3)                   |
| `whistleblowing_audit_log` | **nein**                   | **nein**         | **nein**           | ja                   | ja (eigene Formel, v-los) |
| `access_log`               | ja                         | ja               | nein               | nein                 | nein                      |
| `data_export_log`          | ja                         | ja               | nein               | ja + FORCE           | nein                      |
| `audit_anchor`             | **nein**                   | **nein**         | nein               | nein                 | n/a (hält die Beweise)    |

**Rechte:** `relacl` aller Log-Tabellen ist `NULL` → nur der Eigentümer `grc` (SUPERUSER) hat
Rechte. Belegt:

```
$ PGPASSWORD=grc_app_dev_password psql -U grc_app -d grc_platform -c "SELECT count(*) FROM audit_log;"
ERROR:  permission denied for table audit_log
$ PGPASSWORD=grc_app_dev_password psql -U grc_app -d grc_platform -c "UPDATE audit_log SET user_email='x' WHERE false;"
ERROR:  permission denied for table audit_log
```

Das ist die stärkste kompensierende Kontrolle des Streams und wird bei jedem Finding gewürdigt.
Sie hat aber zwei Löcher: (a) das Bedrohungsmodell des Auftrags ist ausdrücklich der _böswillige
Admin / DB-Zugriff_, gegen den sie definitionsgemäß nicht wirkt; (b) sie bedeutet zugleich, dass
die Runtime-Rolle den Audit-Trail **gar nicht lesen** kann — siehe S03-19.

---

## 4. Trigger-/Tabellen-Deckungsmatrix

Erhoben gegen die laufende DB, nicht gegen die Doku:

```
$ psql -U grc -d grc_platform -tAc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ... relkind='r'"
527        -- Basistabellen in public
508        -- davon mit audit_trigger
19         -- ohne audit_trigger
2          -- davon mit org_id-Spalte
```

**Deckungsgrad 508/527 = 96,4 %.** Die 19 Ausnahmen:

| Tabelle                                                | org_id | Bewertung                                                                                                            |
| ------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `audit_log`                                            | ja     | korrekt (Rekursion)                                                                                                  |
| `whistleblowing_audit_log`                             | –      | korrekt (eigene Kette)                                                                                               |
| `access_log`                                           | ja     | akzeptabel (eigene Append-only-RULES), aber **kein Hash** → Info, s. u.                                              |
| `session`, `verification_token`, `account`             | –      | `session`/`verification_token` unkritisch; **`account`** = OAuth-Identitätsverknüpfung, sicherheitsrelevant → S03-13 |
| **`approval_decision`**                                | –      | **fachlich hoch relevant** — formale Freigabeentscheidungen → S03-13                                                 |
| **`review_decision`**                                  | –      | **fachlich hoch relevant** — Review-/Vier-Augen-Entscheidungen → S03-13                                              |
| **`attestation_response`**                             | –      | **fachlich hoch relevant** — Attestierungs-Nachweise → S03-13                                                        |
| `module_definition`, `module_nav_item`                 | –      | Plattform-Stammdaten, steuern `requireModule`-Autorisierung → S03-13 (Low)                                           |
| `catalog`, `catalog_entry`, `catalog_entry_mapping`    | –      | Referenzdaten, Info                                                                                                  |
| `connector_field_mapping`, `connector_type_definition` | –      | Konfiguration, Info                                                                                                  |
| `work_item_type`, `xbrl_tag`, `xbrl_taxonomy`          | –      | Referenzdaten, Info                                                                                                  |

Rohdaten: `evidence/S03_tables_without_audit_trigger.txt`,
`evidence/S03_tables_with_audit_trigger.txt`.

> **Einschränkung:** Die Zählung erfolgt gegen die _migrierte_ DB, die laut BASE-002 nur
> 533 statt 576 erwarteter Tabellen enthält (43 Migrationen schlagen dauerhaft fehl). Für die
> nicht angelegten Tabellen ist der Trigger-Status nicht bestimmbar. Migration
> `0337_audit_trigger_gap_closure.sql` schließt Lücken dynamisch — in einer Umgebung, in der
> sie nicht durchläuft, ist der Deckungsgrad niedriger als hier gemessen.

---

## 5. Findings

### S03-01 — Der Audit-Trail ist eine Integritätsprüfung, keine Tamper-Evidence: ein Akteur mit DB-Schreibrecht kann die Kette vollständig neu berechnen und die externen Anker gleich mit überschreiben

**Severity: Critical** (Rubrik: „Manipulierbarkeit des Audit-Trails")

**Datei/Zeile:**

- `docs/ADR-011-rev3.md:15,96` (Zusage) · `apps/web/src/app/api/v1/audit-log/anchor/route.ts:289-311` (`upsertAnchor` mit `onConflictDoUpdate`)
- `packages/db/drizzle/0285_audit_anchor.sql` (keine Append-only-RULE auf `audit_anchor`)
- `packages/shared/src/lib/freetsa.ts:89-131` (`requestTimestamp` — keine Validierung der Antwort)
- `docker-compose.production.yml:305-311` (Worker läuft als Superuser `grc`)

**Zusage im ADR (wörtlich), `docs/ADR-011-rev3.md`:**

> „Rev.3 schließt genau diese Lücke: die tägliche Merkle-Root jeder Tenant-Chain wird an _externe_
> Trust-Roots übergeben. Was wir nach diesem Zeitpunkt schreiben, können wir nicht mehr rückwirkend
> umschreiben, ohne dass ein externer Zeuge widerspricht."
> „Platform-Vendor verliert ab Anchor-Zeitpunkt die Möglichkeit, Audit-Events rückwirkend zu
> manipulieren — egal ob legal, illegal, oder forensisch erzwungen."

**Befund.** Die Zusage hält nicht, weil die Beweismittel des „externen Zeugen" vollständig in
derselben Datenbank liegen, die manipuliert werden soll, und **von der Plattform an keiner Stelle
verifiziert werden**:

1. `audit_anchor` hat **keine** Append-only-RULE, **keinen** Guard-Trigger und **kein** RLS
   (belegt in Abschnitt 3). `merkle_root`, `proof` und `proof_status` sind frei überschreibbar —
   der Produktivcode selbst tut das per `onConflictDoUpdate` (`anchor/route.ts:302-311`).
2. Die FreeTSA-Antwort wird **nie** geprüft: `parseTimestampResponse` liest ausschließlich den
   PKIStatus-Integer. Es findet **keine** Signaturprüfung, **keine** Zertifikatskettenprüfung,
   **kein** Nonce-Abgleich und **kein** Vergleich des `messageImprint` mit der eingereichten
   Merkle-Root statt. Der erzeugte Nonce wird zurückgegeben mit dem Kommentar
   `/** The nonce that was sent; useful if the caller wants to pin it later */`
   (`freetsa.ts:42`) — **kein Aufrufer pinnt ihn**. Jede HTTP-200-Antwort, deren erstes
   DER-Kind mit `00` beginnt, wird als gültiger Zeitstempel gespeichert.
3. Der Append-only-Guard auf `audit_log` ist ein normaler User-Trigger und wird von
   `SET session_replication_role = 'replica'` abgeschaltet — ein Muster, das das Projekt in
   seinen eigenen Tests verwendet (`packages/db/tests/integration/audit-chain-per-tenant.test.ts:95,156,243,306,376`:
   `await client.unsafe("SET session_replication_role = 'replica'")`). Die DELETE-RULE lässt sich
   mit `ALTER TABLE audit_log DISABLE RULE audit_log_no_delete` entfernen.
4. `TRUNCATE audit_log` umgeht die DELETE-RULE ohnehin (RULES greifen nicht bei TRUNCATE, es gibt
   keinen `ON TRUNCATE`-Trigger).

**Reproduktion (EXP-8b, Klon `s03_test`, Datei `evidence/S03_full_rewrite2.sql`):**

```sql
SET session_replication_role = 'replica';
UPDATE audit_log SET changes = jsonb_set(changes,'{new,name}','"Alles in Ordnung"') WHERE chain_seq = 251;
DO $$ ... Kette in chain_seq-Reihenfolge mit compute_audit_hash_v3 neu berechnen ... $$;
UPDATE audit_anchor SET merkle_root = repeat('0',64), proof = '', proof_status='complete';
SET session_replication_role = 'origin';
```

Ausgabe:

```
(keine Fehlerausgabe = erfolgreich)
### integrity-Endpoint:
 total | row_mismatches | chain_mismatches | v0_skipped | healthy
    13 |              0 |                0 |          0 | t
### anchor-Gate:
 row_broken | chain_broken
          0 |            0
### manipulierter Inhalt:
Alles in Ordnung
### DELETE-Rule aushebeln:
ALTER TABLE
DELETE 1
 count = 0        -- Zeile chain_seq=253 ist weg
```

**Angriffsszenario.** Ein Betreiber-Admin (oder ein Angreifer mit `DATABASE_URL`) löscht die
Audit-Spuren eines unautorisierten Datenzugriffs, berechnet die Mandantenkette neu und
überschreibt die zugehörigen `audit_anchor`-Zeilen. `/api/v1/audit-log/integrity` meldet
`healthy: true`, `/api/v1/audit-log/integrity/continuity` meldet `monolithic_v3 / valid`,
die Anker-Schranke meldet 0/0. Der Kunde hat keinen technischen Weg, das zu bemerken.

**Verschärfend:** Der **Worker läuft laut Produktions-Compose bewusst als Superuser `grc`**:

> `# So the worker deliberately connects as the PRIVILEGED superuser grc (BYPASSRLS)`
> (`docker-compose.production.yml:305-311`)

Damit ist jede der 132 Worker-Dateien ein Pfad, über den ein Code-Defekt in vollen
Audit-Trail-Schreibzugriff eskaliert. Die Antwort auf Methodikpunkt 1 („läuft irgendein
Produktivpfad als `grc`?") lautet: **ja, der gesamte Worker.**

**Kompensierende Kontrollen (geprüft, reichen nicht):**

- `grc_app` hat _keine_ Rechte auf `audit_log` (E1) → die Web-Runtime kann nicht manipulieren. Gut,
  aber irrelevant für das hier geprüfte Bedrohungsmodell.
- Der Guard blockiert `entry_hash`/`previous_hash`-UPDATEs (EXP-8 scheiterte daran) — bis
  `session_replication_role` gesetzt wird.
- `GET /api/v1/audit-log/archive` exportiert die rohen `.tsr`-Beweise. Ein Auditor, der diese
  ZIPs **außerhalb** der Plattform aufbewahrt, könnte den Betrug erkennen. Das ist die einzige
  wirksame Restkontrolle — sie ist rein manuell, nirgends automatisiert, nirgends dokumentiert
  als Pflicht, und der mitgelieferte Verifikationsweg ist defekt (→ S03-07).

**Empfehlung:** Anker-Beweise (`proof`, `merkle_root`) aus der Anwendungs-DB heraus
in einen WORM-/Append-only-Speicher spiegeln; FreeTSA-Antwort vollständig validieren
(Nonce, `messageImprint`, Signatur, Zertifikatskette); `audit_log`/`audit_anchor`
in ein separates DB-Cluster oder wenigstens unter eine eigene, vom App-Owner getrennte
Rolle legen; Event-Trigger gegen `ALTER TABLE ... DISABLE`.

---

### S03-02 — Ein einziges erlaubtes UPDATE (`hash_version = 0`) schaltet die Verifikation für eine Zeile ab und macht beliebige Inhaltsmanipulation unsichtbar — der externe Anker bleibt gültig

**Severity: Critical** (Rubrik: „Manipulierbarkeit des Audit-Trails")

**Datei/Zeile:**

- Guard-Allow-List: `packages/db/drizzle/0311_repair_audit_hash_versioning.sql` →
  live in `evidence/S03_functions.sql`, Funktion `audit_log_tombstone_only_guard`
- Verifier-Skip: `apps/web/src/app/api/v1/audit-log/integrity/route.ts:187-190`

**Wörtliches Zitat, Guard (laufende DB):**

```plpgsql
v_allowed text[] := ARRAY[
    'user_email', 'user_name', 'ip_address', 'changes',
    'pii_tombstoned_at', 'pii_tombstone_reason',
    -- metadata column, not content — see migration 0311 header.
    'hash_version'
  ];
```

**Wörtliches Zitat, Verifier (`integrity/route.ts:187-190`):**

```sql
      -- v0 rows are skipped (counted as warnings), neither row_ok nor
      -- chain_ok considered.
      (hash_version = 0 OR stored_entry_hash = recomputed_entry_hash) AS row_ok,
      (hash_version = 0 OR COALESCE(stored_previous_hash, '') = COALESCE(prev_row_entry_hash, '')) AS chain_ok
```

**Befund.** `changes` (Hash-Eingabe) **und** `hash_version` (der Verifikations-Schalter) stehen
gemeinsam auf der Allow-List. Wer `audit_log` beschreiben darf, ändert den Inhalt und setzt
`hash_version = 0`; die Zeile wird dann von _beiden_ Prüfungen übersprungen. Weil `entry_hash`
unverändert bleibt, bleibt auch die **Merkle-Wurzel des Tages identisch** — der FreeTSA-/OTS-Anker
bestätigt die manipulierte Kette weiterhin. Das ist der Angriff, gegen den ADR-011 rev.3
konstruktionsbedingt **nicht** schützt, weil die Anker über `entry_hash` gebildet werden, nicht
über den Inhalt.

**Reproduktion (EXP-1/EXP-2, Klon `s03_test`):**

```
### EXP-1: naives Tampern von 'changes' (Kontrollgruppe)
UPDATE audit_log SET changes = jsonb_set(changes,'{new,name}','"HARMLESS RENAME"') WHERE id='86d1525a-…';
 total | row_mismatches | chain_mismatches | v0_skipped | healthy
    13 |              1 |                0 |          0 | f          ← erkannt

### EXP-2: dasselbe + hash_version = 0
UPDATE audit_log SET hash_version = 0 WHERE id='86d1525a-…';
 total | row_mismatches | chain_mismatches | v0_skipped | healthy
    13 |              0 |                0 |          1 | t          ← NICHT erkannt

 hash_version |    entry_hash    |  tampered_name
            0 | 015bb72dad3f7f33 | HARMLESS RENAME     ← entry_hash unverändert ⇒ Merkle-Root unverändert
```

**Beweis, dass der externe Anker die Fälschung mitträgt (EXP-10):** Die Merkle-Blätter sind die
`entry_hash`-Werte; der Angriff lässt sie unberührt. Mit einer 1:1-Portierung von
`packages/shared/src/lib/merkle-tree.ts` (`evidence/S03_merkle_check.py`) vor und nach dem Angriff:

```
VOR  Tamper: leaves=22 merkle_root=06985925db834cbb3d2460d7c1b9f6d3a7af9115c89f7b1ba78b952d75642832
$ UPDATE audit_log SET changes=jsonb_set(changes,'{new,name}','"GEFAELSCHT"'), hash_version=0 WHERE chain_seq=251;
UPDATE 1
NACH Tamper: leaves=22 merkle_root=06985925db834cbb3d2460d7c1b9f6d3a7af9115c89f7b1ba78b952d75642832
Inhalt jetzt: GEFAELSCHT
 total | row_mismatches | chain_mismatches | v0_skipped | healthy
    22 |              0 |                0 |          1 | t
```

Bit-identische Wurzel. Der bereits erteilte FreeTSA-Zeitstempel und der OpenTimestamps-Proof
bestätigen die manipulierte Kette weiterhin — und auch das in `rebuild_merkle.py` implementierte
Offline-Verifikationsverfahren meldet „All anchors matched". Die in ADR-011 rev.3 zugesagte
Wirkung des externen Zeugen greift bei dieser Angriffsklasse **konstruktionsbedingt nicht**,
weil verankert wird, was gehasht wurde — nicht, was protokolliert wurde.

**Wirkung.** `GET /api/v1/audit-log/integrity` liefert wieder `200` mit `healthy: true`.
Der einzige Hinweis ist eine `warnings[]`-Zeile `broken_hash_window`, deren `remedy`-Text den
Operator anweist:

> „Run migrations 0327 (v3 helper + trigger) and 0328 (chain rehash) via `npm run db:migrate-all`."

Das ist der **falsche** Rat: der Rehash berechnet `entry_hash` aus dem _manipulierten_ Inhalt neu
und macht die Fälschung damit endgültig und unauffindbar.

**Kompensierende Kontrolle (geprüft, teilweise wirksam):**
`GET /api/v1/audit-log/integrity/continuity` schlägt bei `v0_broken > 0` auf
`continuityClaim: "unmigrated", totalContinuityValid: false` um
(`continuity/route.ts:133-192`, Fall-Through). Der Angriff hinterlässt dort also ein Signal — das
allerdings (a) als „Migration fehlt" gerahmt ist, nicht als Manipulationsverdacht, (b) durch den
oben zitierten, ausdrücklich empfohlenen Rehash beseitigt wird, und (c) auf einem Endpoint sitzt,
den nur der Pilot-Readiness-Gate-Skript und ein Auditor manuell aufrufen. Kein Alarm, kein
Monitoring (→ S03-12). Herabstufung auf High wurde erwogen und **verworfen**, weil die
Standard-Antwort des Systems auf die Frage „ist der Audit-Trail intakt?" — der
`/integrity`-Endpoint — nach dem Angriff `healthy: true` sagt.

**Empfehlung:** `hash_version` von der Allow-List nehmen; `changes` nur über
`tombstone_audit_entry` änderbar machen (`SECURITY DEFINER` + Guard prüft `pg_trigger_depth()`);
v0-Zeilen als **Fehler** statt als Warnung behandeln.

---

### S03-03 — `user_email`, `user_name`, `ip_address`, `entity_title` gehen nicht in den Hash ein und sind gleichzeitig frei änderbar: die Zuordnung „wer hat es getan" ist spurlos fälschbar

**Severity: High** (Rubrik: „Umgehung von Segregation-of-Duties" / Integritätsrisiko)

**Datei/Zeile:** `compute_audit_hash_v3` (live, `evidence/S03_functions.sql`) —
Eingabefelder: `previous_hash, org_id, user_id, entity_type, entity_id, action, changes,
action_detail, metadata, created_at, previous_hash_scope`.
Guard-Allow-List (s. S03-02) enthält `user_email`, `user_name`, `ip_address`.

**Befund.** Vier Spalten der Tabelle sind **nicht** Teil des Digests: `user_email`, `user_name`,
`ip_address`, `entity_title` (dazu `id` und `chain_seq`). Drei davon sind ausdrücklich
UPDATE-erlaubt. Das UI und die Exportfunktion zeigen genau diese Klartextfelder als „Akteur"
(`archive/route.ts:111-126` exportiert `userEmail`/`userName` in die JSONL, ohne dass sie
hashgeschützt wären).

**Reproduktion (EXP-3, Klon `s03_test`):**

```
UPDATE audit_log SET user_email='innocent.intern@example.com',
                     user_name='Innocent Intern',
                     ip_address=NULL
 WHERE chain_seq=256;
UPDATE 1

 user_email                  | user_name       | ip_address | hash_version
 innocent.intern@example.com | Innocent Intern |            |            3

 total | row_mismatches | chain_mismatches | v0_skipped | healthy
    13 |              0 |                0 |          1 | t     ← unverändert gesund, hash_version bleibt 3
```

**Wirkung.** Eine Handlung kann einem anderen Menschen zugeschrieben werden, ohne dass irgendeine
Prüfung anschlägt und ohne dass `hash_version` verdächtig wird. `user_id` bleibt zwar korrekt und
ist gehasht — aber weder UI noch Archiv-Export stellen `user_id` und `user_email` einander
gegenüber, und der Archiv-Export enthält keine Möglichkeit, den Widerspruch zu erkennen (→ S03-07).

**Kompensierende Kontrolle:** `user_id` ist gehasht. Wer _beide_ Felder vergleicht, findet den
Widerspruch — es existiert kein Codepfad, der das tut.

**Empfehlung:** `user_email`, `user_name`, `ip_address`, `entity_title`, `id` und `chain_seq` in
`compute_audit_hash_v4` aufnehmen; Allow-List auf `pii_tombstoned_at`/`pii_tombstone_reason`
reduzieren und die Redaktion über einen separaten, gehashten Tombstone-Datensatz lösen.

---

### S03-04 — Die Anker-Schutzschranke (`#WAVE10-CRITICAL-01`) ist für v3-Zeilen wirkungslos — also für 100 % der Live-Kette

**Severity: High**

**Datei/Zeile:** `apps/web/src/app/api/v1/audit-log/anchor/route.ts:84-96`

**Wörtliches Zitat:**

```ts
        CASE
          WHEN hash_version = 2 THEN compute_audit_hash_v2(
            previous_hash, org_id, user_id, entity_type, entity_id,
            action::text, changes, action_detail, metadata, created_at,
            previous_hash_scope
          )
          WHEN hash_version = 1 THEN compute_audit_hash_v1(
            previous_hash, org_id, user_id, entity_type, entity_id,
            action::text, changes, created_at, previous_hash_scope
          )
          ELSE entry_hash
        END AS expected_eh
```

Es gibt **keinen** `WHEN hash_version = 3`-Zweig. Für jede v3-Zeile gilt
`expected_eh = entry_hash`, der anschließende Filter
`COUNT(*) FILTER (WHERE hash_version <> 0 AND stored_eh <> expected_eh)` vergleicht den
gespeicherten Hash mit sich selbst und ist konstant 0.

Laut `docs/ADR-026-hash-chain-v3-migration.md` sind alle Live-Zeilen v3
(„After migration 0328 completes, `v0 = 0`, `v1 = 0`, `v2 = 0`, `v3 = N`") — in der geprüften DB
bestätigt: 142/142 Zeilen `hash_version = 3`.

Der Zweck der Schranke steht direkt darüber im selben File (Z. 60-69):

> „#WAVE10-CRITICAL-01: refuse to anchor a chain that's failing self-verification … FreeTSA then
> signed a Merkle root that included rows whose chain pointers were wrong — exactly the
> permanent-trust corruption the gate was meant to prevent."

**Reproduktion (EXP-6, Klon `s03_test`, `evidence/S03_anchor_gate.sql` = wörtliche Kopie der CTE):**

```
### clean baseline
 row_broken | chain_broken
          0 |            0
### tamper a v3 row's changes
UPDATE 1
### integrity endpoint says:
 total | row_mismatches | chain_mismatches | v0_skipped | healthy
    13 |              1 |                0 |          0 | f
### anchor gate says (>0 => HTTP 409 refuse):
 row_broken | chain_broken
          0 |            0          ← Schranke offen
```

**Wirkung.** `POST /api/v1/audit-log/anchor` verankert eine Kette, die der eigene
Integritäts-Endpoint als kaputt meldet. Der Zeitstempel zementiert den manipulierten Zustand —
genau das im Kommentar beschriebene „permanent-trust corruption".

**Zusätzlich: der Nightly-Cron hat die Schranke überhaupt nicht.**
`apps/worker/src/crons/daily-audit-anchor.ts` prüft vor dem Verankern nichts (Z. 84-200). Der
automatische Pfad — der 365 Tage im Jahr läuft — ist ungeprüft; nur der manuelle
API-Pfad hat die (defekte) Schranke.

**Empfehlung:** `WHEN hash_version = 3 THEN compute_audit_hash_v3(...)` ergänzen, `ELSE` auf
`NULL` setzen (unbekannte Version = Bruch, nicht = OK), und dieselbe Prüfung in den Cron ziehen.

---

### S03-05 — Sechs produktive Codepfade schreiben Audit-Einträge komplett an der Hash-Kette vorbei — darunter DSGVO-Löschung, Retention-Hard-Delete und Controlled-Copy-Export

**Severity: High**

**Datei/Zeile:**

| Pfad                             | Datei:Zeile                                                           |
| -------------------------------- | --------------------------------------------------------------------- |
| Bulk-Prozessoperation            | `apps/web/src/app/api/v1/processes/bulk/route.ts:150`                 |
| Dokument-Integritätsprüfung      | `apps/web/src/app/api/v1/documents/[id]/verify-integrity/route.ts:68` |
| Upload-Ablehnung (Malware)       | `apps/web/src/app/api/v1/documents/[id]/upload/route.ts:115`          |
| **DSGVO-Löschung (Art. 17)**     | `apps/web/src/app/api/v1/documents/[id]/erase/route.ts:72`            |
| **Controlled-Copy-Download**     | `apps/web/src/lib/documents/controlled-copy.ts:24`                    |
| **Retention-Hard-Delete (Cron)** | `apps/worker/src/crons/document-retention-purge.ts:79-83`             |

**Wörtliches Zitat, `document-retention-purge.ts:79-83`:**

```ts
          // 1. Audit-log entry BEFORE deletion (raw SQL — chain_seq /
          //    hash chain are assigned by DB defaults + triggers).
          await tx.execute(sql`
            INSERT INTO audit_log
```

Der Kommentar ist **falsch**. Auf `audit_log` liegt genau ein Trigger,
`audit_log_tombstone_guard` (`BEFORE UPDATE`) — kein `BEFORE INSERT`-Trigger, der Hashes vergäbe.
`audit_trigger()` hängt an den 508 Fachtabellen, nicht an `audit_log` selbst.

**Spaltendefaults (laufende DB):** `entry_hash` NULL, `previous_hash` NULL,
`previous_hash_scope` NULL, `hash_version` **DEFAULT 1**.

**Reproduktion (EXP-5, Klon `s03_test`):**

```
INSERT INTO audit_log (org_id,user_id,user_email,user_name,entity_type,entity_id,
                       entity_title,action,action_detail,metadata)
VALUES ('aaaaaaaa-…',NULL,'attacker@evil.tld','system:document-retention-purge','document',
        gen_random_uuid(),'Vertrag 2026','delete','gdpr_erasure','{"reason":"x"}');

 chain_seq | hash_version | previous_hash_scope | entry_hash | previous_hash
       281 |            1 |                     |            |

-- integrity-Endpoint (WHERE previous_hash_scope = 'org:…'):
 total | row_mismatches | chain_mismatches | v0_skipped | healthy
     5 |              0 |                0 |          0 | t        ← Zeile taucht nicht auf

-- legacyRowCount-Query aus route.ts:
 legacy_count = 1

-- Merkle-Blätter (anchor: isNotNull(entry_hash)):
 anchored = 5 | not_anchored = 1                                  ← nicht verankert
```

**Wirkung.** Die forensisch wertvollsten Ereignisse — wer welches Dokument DSGVO-gelöscht hat, wer
eine kontrollierte Kopie heruntergeladen hat, welche Dokumente die Retention-Automatik hart
gelöscht hat — liegen **außerhalb** jeder Integritätsprüfung und außerhalb des externen Ankers.
Der `/integrity`-Endpoint zählt sie unter `legacyRowCount`, das der Code als

> „Separate count of pre-rev2 legacy rows (NULL scope). They are not verifiable under per-tenant
> semantics and are reported informationally." (`integrity/route.ts:230-232`)

kommentiert — die Zeilen werden also als historischer Altbestand ausgewiesen, obwohl sie von
laufendem Produktivcode neu erzeugt werden. Ein Auditor liest daraus das Gegenteil der Wahrheit.

**Empfehlung:** Diese sechs Stellen auf einen `write_audit_entry(...)`-`SECURITY DEFINER`-Helfer
umstellen, der Scope, Advisory-Lock, `previous_hash` und `entry_hash` genauso setzt wie
`audit_trigger()`; `previous_hash_scope`/`entry_hash` als `NOT NULL` erzwingen;
`legacyRowCount > 0` bei Zeilen mit `created_at > <rev2-Stichtag>` als Fehler melden.

---

### S03-06 — Die produktseitige DSGVO-Art.-17-Tombstone-Funktion bricht die Hash-Kette dauerhaft; Code, ADR und Test behaupten das Gegenteil

**Severity: High** (Zielkonflikt Löschpflicht ↔ Unveränderlichkeit ist _nicht_ gelöst)

**Datei/Zeile:**

- `apps/web/src/app/api/v1/dpms/audit-log-tombstone/route.ts:9-12` (falsche Zusage)
- `packages/db/drizzle/0284_audit_chain_rev2_per_tenant.sql` Header (falsche Zusage)
- `packages/db/tests/integration/audit-chain-per-tenant.test.ts:254,289-290` (Test zementiert den Fehler)
- Funktion `tombstone_audit_entry` (live, `evidence/S03_functions.sql`)

**Wörtliche Zusagen:**

> `route.ts:9-12`: „redacts PII from a specific audit_log row **without breaking the hash chain**.
> … The function rewrites user_email, user_name, ip_address and any PII-tagged keys in the
> `changes` JSON with deterministic hashes; **the entry_hash is preserved so the chain stays
> verifiable**."
> `0284`-Header: „`tombstone_audit_entry(uuid, text)` function: redacts PII from a single
> audit_log row **without breaking entry_hash**"

**Befund.** `entry_hash` bleibt zwar erhalten — aber `changes` ist in v1, v2 **und** v3 eine
Hash-Eingabe. Die Funktion schreibt `changes` um (`redact_pii_jsonb` auf `changes->'new'` und
`changes->'old'`). Damit weicht der Recompute ab. „entry_hash preserved" und „chain stays
verifiable" sind zwei verschiedene Aussagen; nur die erste stimmt.

**Reproduktion (EXP-7, Klon `s03_test`):**

```
SELECT tombstone_audit_entry('86d1525a-c691-48c6-a223-15a52506ebe9','GDPR Art.17 Loeschantrag');

 chain_seq | hash_version |              user_email        | tombstoned
       251 |            3 | __tombstoned__:2e370ec13d50cec | t

-- integrity-Endpoint NACH einem legitimen Tombstone:
 total | row_mismatches | chain_mismatches | v0_skipped | healthy
    13 |              1 |                0 |          0 | f          ← 503, dauerhaft

-- Detailnachweis:
        stored        |      recomputed
 015bb72dad3f7f33bb5b | e1bb3f459494ad0dc297
```

**Wirkung.** Nach dem **ersten** Löschantrag eines Betroffenen liefert
`GET /api/v1/audit-log/integrity` dauerhaft `503 / healthy: false`. Damit ist entweder
(a) das Löschrecht faktisch blockiert, oder (b) die Integritätszusage dauerhaft verletzt und der
Betrieb gewöhnt sich an einen roten Zustand — was jede echte Manipulationsmeldung im Rauschen
verschwinden lässt. Wäre S03-04 behoben, wäre der Mandant zusätzlich **nicht mehr verankerbar**
(HTTP 409 auf `/anchor`).

**Warum es nicht auffiel:** Der Integrationstest prüft nur die Hash-_Gleichheit_, nie die
_Verifizierbarkeit_:

```ts
// entry_hash is preserved — tombstone does not rehash
expect(after.entry_hash).toBe(originalHash);
```

(`audit-chain-per-tenant.test.ts:289-290`). Ein `expect(verify(...)).toBe(true)` fehlt.

**Empfehlung:** Tombstone-Semantik neu entwerfen — PII **nicht** in `changes` hashen (separate,
ungehashte `changes_pii`-Spalte), oder Tombstones als eigene, gehashte Kettenglieder
(„Redaktionsereignis") führen und den Verifier `pii_tombstoned_at IS NOT NULL` explizit über eine
Tombstone-Formel prüfen lassen. Test um eine Recompute-Assertion ergänzen.

---

### S03-07 — Der mitgelieferte unabhängige Verifikationsweg funktioniert nicht: falsche Hash-Formel, falsche Kettenreihenfolge, fehlende Hash-Eingabefelder im Export

**Severity: High** (die Zusage „offline unabhängig prüfbar" ist die Grundlage von ADR-011 D6)

**Datei/Zeile:** `apps/web/src/app/api/v1/audit-log/archive/route.ts:409-428` (README-Text),
`:111-126` (Feldauswahl des Exports), `:296-360` (`rebuild_merkle.py`)

**Wörtliches Zitat aus dem generierten README (`archive/route.ts:409-428`):**

```
### 2. Check that each row's entry_hash is internally consistent
Each row's `entryHash` is SHA-256 over:
previous_hash | org_id | user_id | entity_type | entity_id |
action | changes_json | created_at | previous_hash_scope
(PostgreSQL `text` concatenation with `|` separator, as emitted by `audit_trigger()`. See ADR-011 rev.2.)
### 3. Check that each row's previous_hash chains to the prior row
Within a `previous_hash_scope`, rows form a chain sorted by `(created_at, id)`.
```

**Drei unabhängige Defekte:**

1. **Formel ist v1 (9 Felder), die Daten sind v3 (11 Felder, UTC-normalisiertes `created_at`).**
   Gemessen gegen die Live-DB:

   ```
   $ psql -U grc -d grc_platform -c "SELECT count(*) zeilen,
       count(*) FILTER (WHERE entry_hash = compute_audit_hash_v1(...)) treffer_readme_v1,
       count(*) FILTER (WHERE entry_hash = compute_audit_hash_v3(...)) treffer_v3
     FROM audit_log WHERE previous_hash_scope IS NOT NULL;"
    zeilen | treffer_readme_v1 | treffer_v3
       142 |                 0 |        142
   ```

   Ein Auditor, der der Anleitung folgt, misst **0 von 142** korrekten Zeilen.

2. **Der Export enthält die für v3 nötigen Felder gar nicht.** Exportiert werden
   (`archive/route.ts:111-126`): `id, orgId, userId, userEmail, userName, entityType, entityId,
entityTitle, action, changes, previousHash, entryHash, previousHashScope, createdAt`.
   Es fehlen **`actionDetail`, `metadata`, `hashVersion`, `chainSeq`** — `actionDetail` und
   `metadata` sind v3-Hash-Eingaben, `chainSeq` ist die maßgebliche Kettenordnung. Der
   `entry_hash` ist aus dem Archiv **prinzipiell nicht rekonstruierbar**.

3. **Die angegebene Kettenreihenfolge `(created_at, id)` ist nicht die tatsächliche.** Der Trigger
   setzt `created_at := now()` (Transaktionszeit), also identisch für alle Zeilen einer
   Transaktion; der Kommentar in `audit_trigger()` sagt das selbst:

   > „ORDER BY chain_seq DESC (not created_at, id DESC): when 5 rows share now() inside one tx,
   > (created_at, id DESC) picks the largest random UUID which is NOT necessarily the most
   > recently inserted row."

   Gemessen:

   ```
    falsch_sortiert | gesamt
                 23 |    142         ← 16 % der Zeilen landen an anderer Position
   ```

   Der Auditor sieht also zusätzlich 23 vorgetäuschte Kettenbrüche.

4. **`rebuild_merkle.py` prüft nur Merkle-über-gespeicherte-Hashes**, nie den Inhalt. Es liest
   `bytes.fromhex(r["entryHash"])` und vergleicht die Wurzel. Ein S03-02-Angriff (Inhalt geändert,
   `entry_hash` erhalten) ist damit auch offline unsichtbar. Die Skriptausgabe lautet dann wörtlich
   „All anchors matched — the audit_log.jsonl is consistent with the stored Merkle roots." — eine
   Aussage über die Hashes, die als Aussage über den Inhalt gelesen wird.

**Kompensierende Kontrolle:** Der Export selbst (rohe `.tsr`) ist wertvoll und geht über
ADR-011 hinaus (dort ist der Archiv-Export noch „Phase 2"). Nur die Anleitung und der
Feldumfang sind unbrauchbar.

**Empfehlung:** README auf v3 korrigieren, `chainSeq`/`hashVersion`/`actionDetail`/`metadata`
exportieren, Reihenfolge auf `chain_seq` umstellen, und `rebuild_merkle.py` um eine
Zeilen-Recompute-Stufe erweitern.

---

### S03-08 — ADR-026 stützt die Kontinuitätszusage auf zwei Mechanismen, die im Code nicht existieren; `totalContinuityValid` ist ein reines Versions-Histogramm ohne kryptografischen Gehalt

**Severity: Medium** (Doku-Drift mit Fehlbedienungsrisiko + wirkungsloses Release-Gate)

**Datei/Zeile:** `docs/ADR-026-hash-chain-v3-migration.md` §„Continuity proof" ·
`apps/web/src/app/api/v1/audit-log/integrity/continuity/route.ts:77-131, 133-192, 208-231` ·
`scripts/pilot-readiness-gate.sh:262-266`

**Zusage (ADR-026, wörtlich):**

> „2. **Migration anchor** — every migration runs inside a transaction that is itself written to
> `audit_log` (via the migration audit trigger added in 0341). Migration 0328 therefore appears in
> the live chain as a row of `entity_type='database'`, `action='migration_run'`,
> `entity_id='0328'`. … The anchor row is the **explicit cross-link** between pre-rehash history
> and post-rehash operations."

**Widerlegung 1 — es gibt keinen solchen Trigger und keinen solchen Enum-Wert:**

```
$ grep -ci trigger packages/db/drizzle/0341_signoff_chain_concurrency_guard.sql
0                                   # 0341 enthält ausschließlich UNIQUE-Constraints
$ psql … -tAc "SELECT string_agg(e::text,', ') FROM unnest(enum_range(NULL::audit_action)) e;"
create, update, delete, restore, status_change, approve, reject, assign, unassign,
upload_evidence, delete_evidence, acknowledge, export, bulk_update, comment, link, unlink
                                    # 'migration_run' fehlt ⇒ der Cast in der Query schlägt fehl
$ psql … -c "SELECT count(*) FROM audit_log WHERE entity_type='database';"
 count = 0
$ grep -rn "migration_run" --include=*.ts --include=*.sql .   # nur der lesende Endpoint, kein Schreiber
```

`gatherMigrationAnchors()` liefert daher **immer** `[]` (der `try/catch` schluckt den Enum-Fehler).

**Widerlegung 2 — der externe Zeitstempel-Pfeiler wird nie befüllt.** Der Endpoint fragt

```sql
SELECT anchored_at, hash_version FROM audit_anchor …
```

`audit_anchor` hat **weder** `anchored_at` **noch** `hash_version`:

```
$ psql … -c "SELECT anchored_at, hash_version FROM audit_anchor LIMIT 1;"
ERROR:  column "anchored_at" does not exist
```

Der Fehler landet in `catch { }`; `freeTsaAnchors` ist konstant `{null, null}`. Der Code
gesteht das selbst ein („surface placeholder fields. Wire-up happens in a follow-up PR"),
während ADR-026 den Wert im JSON-Beispiel als geliefert darstellt.

**Widerlegung 3 — `totalContinuityValid` prüft die Kette überhaupt nicht.**
`deriveContinuityClaim()` bekommt ausschließlich das Versions-Histogramm und die (leere)
Anker-Liste. Ist alles v3 und `v0_broken = 0`, liefert es
`{ claim: "monolithic_v3", valid: true }` — auch für die in S03-01 vollständig neu berechnete
Kette. Belegt in EXP-8b: nach kompletter Fälschung sind alle 13 Zeilen `hash_version = 3`,
also `monolithic_v3 / valid: true`.

**Wirkung.** `scripts/pilot-readiness-gate.sh:262-266` macht den Produktivstart von genau diesem
Wert abhängig:

```sh
# scripts/pilot-readiness-gate.sh:262
echo "▶ C1: /audit-log/integrity/continuity totalContinuityValid=true"
```

Das Gate lässt sich durch ein vollständig manipuliertes Log passieren.

**Empfehlung:** ADR-026 korrigieren oder den Mechanismus tatsächlich bauen (`migration_run` zum
Enum hinzufügen, Trigger schreiben, `audit_anchor.hash_version` ergänzen);
`totalContinuityValid` zusätzlich an das Ergebnis von `computeIntegrity()` koppeln.

---

### S03-09 — Race auf den Vorgänger-Hash: unter `read committed` durch den Advisory-Lock verhindert, unter `repeatable read`/`serializable` reproduzierbar

**Severity: Medium** (latent — der Defekt ist real, die heutige Konfiguration schützt zufällig)

**Datei/Zeile:** `audit_trigger()` (live, `evidence/S03_functions.sql`), Abschnitt
„#0343: per-scope transaction-level advisory lock"; `packages/db/drizzle/0343_audit_chain_concurrency_lock.sql`

**Wörtliches Zitat aus dem Trigger:**

```plpgsql
  -- #0343: per-scope transaction-level advisory lock so concurrent
  -- audit_trigger() executions across different user transactions
  -- can't both read the same MAX(chain_seq) row as prev_hash.
  PERFORM pg_advisory_xact_lock(hashtext('audit_chain:' || v_scope));
```

und aus `0284`:

> „advisory lock scoped to org_id — parallel tenants no longer block each other and **parallel
> inserts within one tenant are strictly serialised**"

**Experiment A — zwei echte parallele psql-Sessions, `read committed` (Default, belegt via
`SHOW default_transaction_isolation` → `read committed`):**
Session A `BEGIN`, INSERT, `pg_sleep(4)`, COMMIT; Session B startet 1 s später, INSERT.

```
A: INSERT 0 1 … A committed  2026-08-31 21:45:16.934914+00
B: INSERT 0 1 … B inserted   2026-08-31 21:45:16.941737+00   ← ~3 s blockiert, dann direkt nach A
```

Kette danach:

```
 chain_seq | entity_title |    prev    |     eh
       268 | RACE-A       | eb36f446ad | 6f5f34f2d6
       269 | RACE-B       | 6f5f34f2d6 | 80db40d315   ← korrekt verkettet
 total | row_mismatches | chain_mismatches | healthy
    19 |              0 |                0 | t
```

→ **Kein Fork.** Der Lock greift, weil unter `read committed` jede Anweisung im PL/pgSQL-Body
einen frischen Snapshot zieht.

**Experiment B — `repeatable read` (Snapshot von B wird vor A's COMMIT gezogen):**

```
 total | row_mismatches | chain_mismatches | v0_skipped | healthy
    25 |              0 |                1 |          0 | f
```

Detail (`evidence/S03_race_chain_fork.txt`):

```
 chain_seq | entity_title | stored_prev  | expected_prev | ok
       274 | RR-A-15110   | e665f9c31359 | e665f9c31359  | t
       275 | RR-B-28699   | 55db4753d178 | 5c94652c1ff1  | f   ← Fork: B zeigt auf den Stand vor A
       276 | RR-B-28699   | 5228b060b6e2 | 5228b060b6e2  | t
```

`55db4753d178` ist der `entry_hash` von `chain_seq = 271` — dem Kettenende zum Zeitpunkt von
B's Snapshot. Der Advisory-Lock hat B korrekt blockiert, aber B's `SELECT` im Trigger sieht
nach der Lock-Freigabe **weiterhin den alten Snapshot**.

**Experiment C — `serializable`:** B bricht mit
`ERROR: could not serialize access due to read/write dependencies among transactions` ab.
Sicher, aber die Fachtransaktion schlägt fehl.

**Bewertung.** Kein Codepfad im Repo setzt ein Isolationslevel
(`grep -niE "isolation ?level|repeatable read|serializable"` über `apps/`, `packages/`, `scripts/`
liefert nichts), und der Server-Default ist `read committed`. Daher heute **nicht ausnutzbar** —
aber der Schutz beruht auf einer nicht dokumentierten und nirgends erzwungenen Annahme, und der
Kommentar in 0284 („strictly serialised") behauptet eine Eigenschaft, die der Lock nicht liefert.
Ein einzelnes `BEGIN ISOLATION LEVEL REPEATABLE READ` in einem künftigen Report- oder
Import-Pfad bricht die Kette **irreversibel** (der Guard verbietet die Reparatur per UPDATE).

**Nebenbefund (Info):** `hashtext()` liefert `int4`; verschiedene `org:<uuid>`-Scopes können
kollidieren. Folge ist nur unnötige Serialisierung zwischen zwei Mandanten, kein Korrektheitsfehler.
Da `audit_trigger` an 508 Tabellen hängt, ist der Lock zugleich ein globaler Schreib-Engpass pro
Mandant — für S09/S10 vermerkt.

**Empfehlung:** Im Trigger `SELECT ... FOR SHARE`/expliziten Snapshot-Refresh oder — sauberer —
eine `UNIQUE (previous_hash_scope, previous_hash)`-Constraint analog zu Migration 0341
(die genau dieses Problem für die Sign-off-Ketten korrekt löst). Zusätzlich
`ASSERT current_setting('transaction_isolation') = 'read committed'` im Trigger.

---

### S03-10 — Der Nightly-Anchor-Job hat keinen Scheduler und retryt fehlgeschlagene Tage nie: FreeTSA-Ausfall erzeugt permanente, stille Lücken in der Tamper-Evidence

**Severity: Medium**

**Datei/Zeile:** `apps/worker/src/crons/daily-audit-anchor.ts:132, 166, 196-215` ·
`apps/worker/src/index.ts:197, 211-224` · `apps/worker/package.json` (keine Cron-Abhängigkeit)

**Befund 1 — kein Scheduler.** ADR-011 D3 sagt: „Läuft 00:05 UTC." Der Worker ist eine reine
Hono-HTTP-App; `apps/worker/src/index.ts:197` kommentiert die Endpunkte selbst mit

> „Cron endpoints — triggered by external schedulers"

`apps/worker/package.json` enthält **keine** Scheduler-Abhängigkeit (kein `node-cron`, kein
`croner`), es gibt keinen `setInterval`, keinen systemd-Timer, keine Crontab-Zeile und keinen
k8s-CronJob im Repo (`deploy/`, `docker/`, `docker-compose.production.yml`, `.github/workflows/`
geprüft; die einzige Crontab-Anweisung im Repo betrifft `deploy/offsite-sync-setup.sh`, also
Backups). **Der externe Anker — die gesamte Grundlage von ADR-011 rev.3 — läuft in der
ausgelieferten Deployment-Konfiguration nie**, außer ein Betreiber verdrahtet ihn außerhalb des
Repos.

**Befund 2 — Fehlschläge blockieren jeden Retry dauerhaft.** Der Cron prüft:

```ts
    const existing = await db.select({ id: auditAnchor.id }).from(auditAnchor)
      .where(and(eq(...orgId), eq(...anchorDate), eq(...provider))).limit(1);
    if (existing.length === 0) { …anchor… }
```

Bei Fehlschlag schreibt `logAnchorFailure()` eine Zeile mit `proofStatus: 'failed'`. Beim nächsten
Lauf ist `existing.length === 1` → **der Tag wird nie wieder verankert.** Der API-Pfad macht es
richtig (`anchor/route.ts:180`: `if (existing.length > 0 && existing[0].proofStatus !== "failed")`),
der Cron nicht. Ein einziger FreeTSA-Ausfall (der ADR nennt freetsa.org selbst „Single-Point-of-
Failure") erzeugt eine dauerhafte, unsichtbare Lücke.

**Befund 3 — Ausfallverhalten der TSA (Methodikpunkt 5).** Der Audit-Eintrag selbst wird
unabhängig geschrieben (DB-Trigger, kein Netzwerkpfad). Der Anker fällt still aus:
`logAnchorFailure` schreibt in `audit_anchor.last_error` und `console.error` — es gibt **keinen**
Alarm, keine Benachrichtigung, keinen Health-Check. Das ist die richtige Wahl bezüglich
Verfügbarkeit, aber die Lücke wird niemandem gemeldet.

**Befund 4 — der `date`-Parameter ist um einen Tag versetzt.** `index.ts:214-217` baut
`new Date(body.date + "T12:00:00Z")`; der Cron rechnet daraus „gestern". `{"date":"2026-04-15"}`
verankert also den 14. — der Kommentar im Code sagt das Gegenteil.

**Empfehlung:** Scheduler ausliefern (systemd-Timer oder `node-cron` im Worker) und im
Runbook dokumentieren; die `proofStatus !== 'failed'`-Logik aus dem API-Pfad in den Cron ziehen;
Alarm auf „Tag mit Audit-Aktivität ohne `proof_status='complete'`-Anker älter als 48 h".

---

### S03-11 — FreeTSA-Antwort wird nicht validiert: kein Nonce-Abgleich, kein `messageImprint`-Vergleich, keine Signatur-/Zertifikatsprüfung

**Severity: Medium** (eigenständig; verschärft S03-01)

**Datei/Zeile:** `packages/shared/src/lib/freetsa.ts:89-131` (`requestTimestamp`),
`:143-182` (`parseTimestampResponse`)

**Wörtliches Zitat, `freetsa.ts:40-43`:**

```ts
/** DER-encoded TimeStampResp bytes — store this in audit_anchor.proof */
proof: Buffer;
/** The nonce that was sent; useful if the caller wants to pin it later */
nonce: Buffer;
```

und `:163-169`:

```ts
// genTime is deep inside the timeStampToken. … We don't fully parse the
// ContentInfo → SignedData → EncapsulatedContentInfo → TSTInfo
// chain here because the store-the-raw-bytes policy already covers
// provability.
```

**Befund.** Akzeptanzkriterium ist ausschließlich `statusCode === 0` (aus dem ersten
PKIStatusInfo-Integer) plus HTTP 200. Nicht geprüft werden:

- der **Nonce** (RFC 3161 §2.4.2 — der einzige Replay-Schutz des Protokolls). Beide Aufrufer
  (`anchor/route.ts:186`, `daily-audit-anchor.ts:133`) verwerfen `tsa.nonce`.
- der **`messageImprint`** der Antwort gegen die eingereichte Merkle-Root. Eine Antwort, die einen
  völlig anderen Hash bestätigt, wird als Anker für unsere Wurzel abgelegt.
- die **Signatur** und die **Zertifikatskette** (obwohl `certReq = true` gesendet wird und das
  Zertifikat damit in der Antwort liegt).
- der **Gültigkeitszeitraum** / `genTime`-Plausibilität (`genTime` wird per linearem Byte-Scan
  nach Tag `0x18` „best effort" geraten und dann verworfen).

**Angriffsszenario.** Ein MITM auf der (unauthentifizierten, nur TLS-geschützten) Verbindung zu
`https://freetsa.org/tsr`, ein kompromittierter ausgehender Proxy oder ein Insider mit
Konfigurationszugriff (`opts.endpoint` ist überschreibbar) liefert eine beliebige, früher
erhaltene oder selbst erzeugte `TimeStampResp` mit `status = 0`. Sie wird als `proof_status =
'complete'` gespeichert, die UI zeigt „FreeTSA: verankert vor 2 h" (ADR-011 D5), und der
Kunde glaubt an einen externen Zeugen, der nie existiert hat.

**Kompensierende Kontrolle:** Die rohen DER-Bytes werden gespeichert, ein externer Auditor
könnte sie mit `openssl ts -verify` prüfen — dazu braucht er aber das FreeTSA-CA-Zertifikat,
das das Produkt nicht mitliefert, und einen Anlass, es zu tun. Die Plattform selbst behauptet
„verankert", ohne es je geprüft zu haben. `verified_at` existiert als Spalte in `audit_anchor`
und wird von keinem Codepfad je gesetzt.

**Empfehlung:** `parseTimestampResponse` um `messageImprint`- und Nonce-Vergleich erweitern;
TSA-Zertifikat pinnen und die CMS-Signatur prüfen (z. B. via `node-forge` oder ein
`openssl ts -verify`-Subprozess); `verified_at` durch einen periodischen Re-Verify-Job setzen;
`proof_status='complete'` erst nach bestandener Prüfung vergeben.

---

### S03-12 — Es existiert keine automatische, wiederkehrende Prüfung der Hash-Kette in Produktion; der einzige automatisierte Check prüft nur Kettenzeiger, nur die letzten 1000 Zeilen und toleriert 10 Brüche

**Severity: Medium**

**Datei/Zeile:** `scripts/dr-restore-drill.sh:120-168`

**Wörtliches Zitat:**

```sh
CHAIN_THRESHOLD="${CHAIN_THRESHOLD:-10}"
…
elif [ "$CHAIN_OK" -gt 0 ]; then
  log "  WARN: $CHAIN_OK historical mismatches (≤ threshold $CHAIN_THRESHOLD) — known migration 0327 rehash artifact"
```

und

```sh
# verified against prod 2026-05-20: 5 mismatches in chain_seq 62602–62606, all hash_version=3
# stable since the migration. Anything >10 in a 1000-row sample IS suspicious
```

**Vier Defekte:**

1. Die Query berechnet **keinen einzigen `entry_hash` neu** — sie vergleicht nur
   `previous_hash` mit `LAG(entry_hash)`. Inhaltsmanipulation (S03-02, S03-06) ist unsichtbar.
2. **Stichprobe = die 1000 jüngsten Zeilen** (`ORDER BY chain_seq DESC LIMIT 1000`). Manipulation
   älterer Einträge — der übliche Fall bei nachträglicher Vertuschung — wird nie geprüft.
3. **Toleranzschwelle 10** ist ein explizites Manipulationsbudget: bis zu 10 Kettenbrüche gelten
   als „bekannt". Der Kommentar räumt zugleich 5 unerklärte Brüche in Produktion ein — im direkten
   Widerspruch zu ADR-026: „If a chain mismatch surfaces post-rehash, it is a real tamper signal
   (or a real bug in the rehash code). It is not 'expected drift'."
4. Bei Query-Fehler (`|| echo "?"`) wird **fortgesetzt**: eine fehlende oder geleerte
   `audit_log`-Tabelle besteht die Prüfung.

**Zusätzlich:** Es gibt in `apps/`, `packages/`, `deploy/` und `.github/workflows/` keinen
Alarmpfad auf `healthy === false`. Der einzige weitere Konsument ist
`scripts/pilot-readiness-gate.sh` (manuelles/CI-Gate gegen Staging), nicht Produktion.
Damit ist die Antwort auf „wird die unabhängige Verifikationsfunktion irgendwo automatisch
ausgeführt?" (Methodikpunkt 3): **nein, nicht in Produktion.**

**Empfehlung:** Täglicher Worker-Job, der `computeIntegrity()` pro Mandant über die
**vollständige** Kette fährt, das Ergebnis in einer eigenen Tabelle festhält und bei
`healthy === false` alarmiert; Schwelle auf 0 und die 5 Produktionsbrüche vorher forensisch klären.

---

### S03-13 — Trigger-Deckungslücken bei Freigabe- und Review-Entscheidungen; Sign-off-Tabellen protokollieren nur INSERT, nicht UPDATE/DELETE

**Severity: Medium**

**Datei/Zeile:** `packages/db/src/schema/approval-workflow.ts:76` (`approvalDecision`),
`:122` (`reviewDecision`), `:163` (`attestationResponse`) ·
Trigger-Ist-Stand: `evidence/S03_tables_without_audit_trigger.txt`

**Befund 1 — fehlende Trigger.** Von 527 Basistabellen tragen 508 den `audit_trigger`. Unter den
19 Ausnahmen sind drei fachlich hoch relevante Entscheidungstabellen:

```
 approval_decision       -- formale Freigabeentscheidungen (approval-workflow.ts:76)
 review_decision         -- Review-/Vier-Augen-Entscheidungen (approval-workflow.ts:122)
 attestation_response    -- Attestierungs-Nachweise (approval-workflow.ts:163)
```

sowie `account` (OAuth-Identitätsverknüpfung — relevant für Kontoübernahme) und
`module_definition`/`module_nav_item` (steuern die `requireModule`-Autorisierung).
Wer eine Freigabe erteilt, zurückzieht oder eine Attestierungsantwort ändert, hinterlässt
im Audit-Trail nichts.

**Befund 2 — Sign-off-Tabellen nur `INSERT`.**

```
$ psql … "SELECT relname, trigger-events FROM pg_trigger …"
 audit_sign_off             | audit_trigger [I]
 process_sign_off           | audit_trigger [I]
 vendor_sign_off            | audit_trigger [I]
 document_signature         | audit_trigger [IDU]
 document_signature_request | audit_trigger [IDU]
```

Die drei Sign-off-Tabellen haben zudem **keine** Append-only-RULE. Ein `UPDATE` oder `DELETE` auf
eine Freigabe erzeugt **keinen** Audit-Eintrag; die `verifyChain()`-Prüfung läuft nur beim
lesenden `GET` der jeweiligen Entität (`processes/[id]/sign-off/route.ts:179`,
`audit-mgmt/audits/[id]/sign-off/route.ts:156`, `tprm/vendors/[id]/sign-off/route.ts:159`) —
ein gelöschtes letztes Kettenglied fällt dabei gar nicht auf, weil die verbleibende Kette
in sich stimmig bleibt.

**Kompensierende Kontrolle (positiv vermerkt):** Für die Fork-Race der Sign-off-Ketten existiert
mit Migration 0341 (`UNIQUE NULLS NOT DISTINCT (…, previous_chain_hash)`) und für
`document_signature` mit `dsig_request_prev_chain_uniq` (Migration 0375) eine **korrekte,
DB-durchgesetzte** Lösung — deutlich robuster als der Advisory-Lock in `audit_trigger()`
(vgl. S03-09). In der laufenden DB verifiziert:

```
 process_sign_off | process_sign_off_chain_uq | UNIQUE NULLS NOT DISTINCT (process_id, previous_chain_hash)
 audit_sign_off   | audit_sign_off_chain_uq   | UNIQUE NULLS NOT DISTINCT (audit_id, previous_chain_hash)
 vendor_sign_off  | vendor_sign_off_chain_uq  | UNIQUE NULLS NOT DISTINCT (vendor_id, previous_chain_hash)
 dsig_request_prev_chain_uniq ON document_signature (request_id, previous_chain_hash) NULLS NOT DISTINCT WHERE (content_hash IS NOT NULL)
```

**Empfehlung:** `audit_trigger` auf `approval_decision`, `review_decision`,
`attestation_response`, `account`, `module_definition` ergänzen; die drei Sign-off-Trigger auf
`INSERT OR UPDATE OR DELETE` erweitern und `*_no_update`/`*_no_delete`-RULES ergänzen.

---

### S03-14 — Der Audit-Trail speichert Geheimnisse und Sonderkategorien im Klartext, dauerhaft und unlöschbar

**Severity: High** (Rubrik: DSGVO-Verstoß mit Meldepflicht-Potenzial; überschneidet sich mit S07)

**Datei/Zeile:** `audit_trigger()` (live) — `v_changes := jsonb_build_object('new', v_new)` bzw.
Vollfeld-Diff über `jsonb_object_keys(v_new)`; keine Redaktions- oder Allow-List.
`redact_pii_jsonb` (live) — Schlüsselliste ohne Credential-Begriffe, keine Rekursion.

**Befund.** Der Trigger schreibt `to_jsonb(NEW)` **vollständig** in `audit_log.changes`, bei
UPDATE zusätzlich den alten Wert. 10 Tabellen mit `audit_trigger` führen Geheimnis-Spalten:

```
$ psql … (Evidenz E6)
 bi_shared_dashboard  | password, share_token
 connector_credential | encrypted_payload, refresh_token
 dd_session           | access_token
 device_registration  | device_token
 plugin_setting       | is_secret
 portal_session       | access_token
 sso_config           | oidc_client_secret
 user                 | ical_token, password_hash
 vendor_due_diligence | access_token
 wb_report            | report_token
```

**Reproduktion (EXP-9, Klon `s03_test`):**

```
UPDATE "user" SET password_hash='$2b$12$NEUERHASH…' WHERE email='opfer@kunde.de';
UPDATE 1

SELECT entity_type, action, changes FROM audit_log WHERE entity_type='user' ORDER BY chain_seq DESC LIMIT 1;
 user | update | {"updated_at": {…},
                 "password_hash": {"new": "$2b$12$NEUERHASH0000…",
                                   "old": "$2b$12$ALTERHASH0000…"}}
```

**Wirkung.** Passwort-Hashes (alt **und** neu), OIDC-Client-Secrets, Refresh- und Access-Tokens
liegen dauerhaft in einer Tabelle, aus der per DELETE-RULE nichts entfernt werden kann, und sind
für jede `admin`/`auditor`-Rolle des Mandanten über `/api/v1/audit-log` und den Archiv-Export
lesbar. `redact_pii_jsonb` deckt sie nicht ab (Schlüsselliste: `email, first_name, …, ip_address,
user_agent` — kein `password_hash`, `token`, `secret`) und arbeitet nur auf der obersten
JSON-Ebene, greift also auch bei verschachtelten Objekten nicht.

**Verschärfend — HinSchG.** `wb_case`, `wb_case_message`, `wb_case_evidence` und `wb_report`
tragen **beide** Trigger:

```
$ psql … (Evidenz E7)
 wb_case          | audit_trigger + whistleblowing_audit_trigger
 wb_case_evidence | audit_trigger + whistleblowing_audit_trigger
 wb_case_message  | audit_trigger + whistleblowing_audit_trigger
 wb_report        | audit_trigger
```

Der vertrauliche `whistleblowing_audit_trigger` hasht die Akteursidentität ausdrücklich
(„Actor identity is HASHED — never store the user_id directly in wb audit log (HinSchG §8
confidentiality requirement)"). Der parallele allgemeine `audit_trigger` schreibt denselben
Vorgang **mit `user_id`, `user_email`, `user_name` im Klartext** und mit dem vollständigen
Zeileninhalt (inkl. `wb_report.report_token`) in das **org-weit sichtbare** `audit_log` — und
hebelt damit die in Migration 0284 zugesagte Trennung auf:

> „whistleblowing_audit_log created as a separate chain … **Never visible to org admins** — only
> whistleblowing_officer + ombudsperson."

**Empfehlung:** Spalten-Allow-/Deny-List im Trigger (per `pg_catalog`-Kommentar oder
Konfigurationstabelle), Geheimnis- und Sonderkategoriespalten vor dem `jsonb_build_object`
entfernen; `audit_trigger` von den `wb_*`-Tabellen nehmen bzw. dort auf eine
identitätsfreie Kurzform reduzieren; `redact_pii_jsonb` rekursiv machen und um
Credential-Begriffe erweitern.

---

### S03-15 — Die Whistleblowing-Kette ist ungeschützt, TZ-abhängig gehasht und wird nirgends verifiziert

**Severity: Medium**

**Datei/Zeile:** `whistleblowing_audit_trigger()` (live, `evidence/S03_functions.sql`) ·
`packages/db/drizzle/0284_audit_chain_rev2_per_tenant.sql`

**Drei Defekte:**

1. **Keine Append-only-Absicherung.** `whistleblowing_audit_log` hat weder `*_no_update`- noch
   `*_no_delete`-RULE noch einen Guard-Trigger (Abschnitt 3). UPDATE und DELETE sind uneingeschränkt
   möglich — im Gegensatz zu `audit_log`, `access_log` und `data_export_log`.

2. **Zeitzonenabhängige Hash-Formel — exakt der Fehler, den ADR-026 für `audit_log` behoben hat:**

   ```plpgsql
   v_hash_input := COALESCE(v_prev_hash,'0') || '|' || … || v_created_at::text;
   ```

   `::text` serialisiert in der Session-Zeitzone. ADR-026 dazu wörtlich:

   > „v2 formula used `created_at::text` which serialises in the _session_ timezone, so a row
   > hashed on Hetzner failed verification on CI and vice versa."
   > Die WB-Kette hat diese Korrektur nie erhalten und besitzt auch keine `hash_version`-Spalte,
   > also keinen Migrationspfad.

3. **Kein Verifizierer.** `grep -rn "whistleblowing_audit_log" --include=*.ts apps/ packages/`
   liefert genau **einen** Treffer, und der ist ein Kommentar in `audit-log/route.ts:19`. Es gibt
   keinen Endpoint, keine Funktion und keinen Test, der die WB-Kette je prüft. Sie wird
   geschrieben und nie gelesen.

**Nebenbefund:** Die Vorgänger-Suche verwendet `ORDER BY created_at DESC, id DESC` — genau die
Reihenfolge, die der Kommentar in `audit_trigger()` als fehleranfällig verwirft. Hier ist
`v_created_at := clock_timestamp()` (statt `now()`), womit das Problem in der Praxis entschärft
ist; der Tiebreak über eine Zufalls-UUID bleibt aber falsch.

**Empfehlung:** Append-only-RULES ergänzen, Formel auf die TZ-invariante v3-Darstellung umstellen,
`hash_version` einführen, Verifikations-Endpoint für Rolle `whistleblowing_officer`/`ombudsperson`
bauen.

---

### S03-16 — `TRUNCATE audit_log` umgeht die Append-only-RULE vollständig

**Severity: Medium**

**Datei/Zeile:** `packages/db/sql/000_schema.sql` / `packages/db/drizzle/0000_lethal_scorpion.sql`
(`CREATE RULE audit_log_no_delete … DO INSTEAD NOTHING`)

**Befund.** PostgreSQL-RULES greifen bei `TRUNCATE` nicht, und es existiert kein
`ON TRUNCATE`-Trigger auf `audit_log`, `whistleblowing_audit_log`, `access_log`,
`data_export_log` oder `audit_anchor`.

**Reproduktion (EXP-4, Klon `s03_test`):**

```
DELETE FROM audit_log WHERE chain_seq=256;
DELETE 0                       ← RULE greift, still (kein Fehler!)
 still_there = 1

TRUNCATE audit_log CASCADE;
TRUNCATE TABLE
 count = 0                     ← gesamter Audit-Trail weg
```

**Nebenbefund (Low).** Die DELETE-RULE meldet Erfolg (`DELETE 0`), statt einen Fehler zu werfen.
Ein Löschversuch bleibt damit für den Aufrufer und für jedes Monitoring unsichtbar — ein
`RULE … DO INSTEAD SELECT raise_exception()` oder ein `BEFORE DELETE`-Trigger wäre
aussagekräftiger.

**Empfehlung:** `CREATE TRIGGER … BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE
FUNCTION raise_append_only()` auf allen fünf Log-Tabellen.

---

### S03-17 — Die Merkle-Konstruktion nutzt die Bitcoin-Duplikationskonvention ohne Domain-Separation: die verankerte Wurzel bestimmt die Blattmenge nicht eindeutig

**Severity: Low**

**Datei/Zeile:** `packages/shared/src/lib/merkle-tree.ts:55-69` (`merkleRoot`),
`:38-49` (`hashPair`); Anleitung `docs/ADR-011-rev3.md` D2

**Wörtliches Zitat (ADR-011 D2):** „Odd-level: letztes Element wird mit sich selbst gepaart
(Bitcoin-Konvention)."

**Befund.** Die Implementierung folgt der Konvention exakt — inklusive der bekannten Schwäche
(CVE-2012-2459-Klasse): eine Blattliste `[a,b,c]` und `[a,b,c,c]` erzeugen dieselbe Wurzel. Es
gibt zudem keine Domain-Separation zwischen Blatt- und Knoten-Hashes (RFC 6962 nutzt dafür
`0x00`/`0x01`-Präfixe), sodass ein innerer Knoten formal als Blatt präsentierbar ist.

**Wirkung.** Die verankerte Wurzel allein legt die Menge der abgedeckten Audit-Einträge nicht
fest. Das einzige Disambiguierungsmerkmal ist `audit_anchor.leaf_count` — das in derselben,
ungeschützten Tabelle liegt (S03-01) und vom Offline-Verifizierer aus dem `.json`-Sidecar
gelesen wird (`archive/route.ts:~325`). Praktisch ist die Ausnutzung eng begrenzt, weil
`entry_hash`-Werte inhaltsdeterminiert sind; als Konstruktionsmangel einer Beweiskette ist es
dennoch zu vermerken.

**Empfehlung:** RFC-6962-Domain-Separation (`SHA256(0x00 || leaf)`, `SHA256(0x01 || l || r)`)
oder mindestens `leaf_count` in die Wurzel einbeziehen. Achtung: Formeländerung erfordert wie bei
v3 eine dokumentierte Migration mit Alt-Anker-Erhalt.

---

### S03-18 — Der Test für den Integritäts-Endpoint prüft nichts Sicherheitsrelevantes; es existiert kein Test, der eine manipulierte Zeile erkennt

**Severity: Medium** (Rubrik: „fehlende negative Tests auf Sicherheitspfaden")

**Datei/Zeile:** `apps/web/src/__tests__/api/audit-log-integrity.test.ts:52-66` ·
`apps/web/src/__tests__/lib/signoff-chain-concurrency-guard.test.ts:26-49` ·
`packages/db/tests/integration/audit-chain-per-tenant.test.ts:289-290`

**Wörtliches Zitat (`audit-log-integrity.test.ts:52-66`), Dateikopf: „security-critical, verifies SHA-256 chain":**

```ts
  it("returns 200 with healthy chain when no rows exist", async () => {
    // Empty per-tenant chain + zero legacy rows = vacuously intact
    mockDb.execute
      .mockResolvedValueOnce([])                      // row-by-row check
      .mockResolvedValueOnce([{ legacy_count: 0 }])   // legacy count
      .mockResolvedValueOnce([{ total: 0, broken: 0 }]);
    …
    expect([200, 503]).toContain(res.status);
    const body = await res.json();
    // Either healthy=true or contains diagnostic detail; both are valid responses
    expect(body).toBeDefined();
  });
```

Die DB ist vollständig gemockt; die Assertion akzeptiert **beide** möglichen Statuscodes und
prüft nur, dass ein Body existiert. Der Test kann nicht fehlschlagen, solange der Handler
irgendetwas zurückgibt.

`signoff-chain-concurrency-guard.test.ts` liest die Migrations-SQL-Datei und greppt nach dem
Constraint-Namen — er prüft Text, kein Verhalten.

**Fehlende negative Tests (vollständige Suche über 684 Testdateien):**

- Kein Test setzt `hash_version = 0` und erwartet, dass die Verifikation anschlägt (S03-02).
- Kein Test ändert `user_email`/`user_name` und erwartet Erkennung (S03-03).
- Kein Test prüft, dass `/anchor` eine manipulierte v3-Kette mit 409 ablehnt (S03-04).
- Kein Test prüft nach `tombstone_audit_entry`, dass die Zeile **noch verifiziert** (S03-06) —
  der vorhandene Test prüft ausdrücklich nur `expect(after.entry_hash).toBe(originalHash)`.
- Der einzige echte Tamper-Test (`audit-trigger.test.ts:211-216`) deckt nur _nicht_
  allow-gelistete Spalten ab — also genau die, die der Guard ohnehin blockiert.

**Empfehlung:** Integrationstests gegen eine echte DB, die je Angriffsklasse aus S03-02 bis
S03-06 die Erkennung beweisen; den gemockten Endpoint-Test auf Auth-Gating reduzieren und im
Dateikopf nicht mehr „verifies SHA-256 chain" behaupten.

---

### S03-19 — Die Runtime-Rolle `grc_app` hat keinerlei Rechte auf `audit_log`; jeder Audit-Log-Lesepfad der Web-App muss fehlschlagen oder läuft als Superuser

**Severity: Medium** (Info/Betriebsdefekt mit Sicherheitsbezug)

**Datei/Zeile:** `pg_class.relacl` von `audit_log` ist `NULL` (Abschnitt 3);
`docker-compose.production.yml:204` (Web-Service `DATABASE_URL`) vs. `:311` (Worker)

**Befund.**

```
$ PGPASSWORD=grc_app_dev_password psql -U grc_app -d grc_platform -c "SELECT count(*) FROM audit_log;"
ERROR:  permission denied for table audit_log
```

Es existiert **kein** `GRANT` auf `audit_log` (und ebenso wenig auf `whistleblowing_audit_log`,
`audit_anchor`, `access_log`, `data_export_log`) für `grc_app`. Damit müssen alle Web-Endpoints,
die den Audit-Trail lesen — `/api/v1/audit-log`, `/audit-log/integrity`,
`/audit-log/integrity/continuity`, `/audit-log/anchor`, `/audit-log/archive` — unter der
vorgesehenen Least-Privilege-Runtime mit `42501` scheitern. `integrity/route.ts` fängt das ab
und liefert `503 „Hash-chain verification could not complete"` — **ununterscheidbar von einer
tatsächlich gebrochenen Kette.**

Die beiden möglichen Realitäten sind beide ein Finding:

- Die Web-App läuft tatsächlich als `grc_app` → sämtliche Audit-Funktionen sind kaputt und die
  Integritätsanzeige meldet dauerhaft 503.
- `APP_DATABASE_URL` ist nicht gesetzt und `packages/db` fällt auf `DATABASE_URL` (= Superuser
  `grc`) zurück — genau das Muster, das `docker-compose.production.yml:309-311` für den Worker
  ausdrücklich beschreibt („Because APP_DATABASE_URL is intentionally NOT set here, packages/db
  falls back to DATABASE_URL (grc)") → dann läuft die _nutzerseitige_ App als Superuser und
  S03-01 ist über jeden Web-Request erreichbar.

Die Auflösung (welche Variante in Produktion gilt) gehört zu S01/S13; für S03 ist relevant, dass
die Rechtevergabe für die Log-Tabellen in keiner Migration und keinem Deploy-Skript stattfindet
(`deploy/provision-grc-app.sh` geprüft) und dass ein Rechtefehler als Kettenbruch angezeigt wird.

**Empfehlung:** `GRANT SELECT ON audit_log, audit_anchor TO grc_app` (kein INSERT/UPDATE/DELETE —
Schreiben erfolgt über den `SECURITY DEFINER`-Trigger); im `catch` von `integrity/route.ts`
`42501` gesondert behandeln und als Konfigurationsfehler statt als Integritätsproblem melden.

---

### S03-20 — Doku-Drift in ADR-011 rev.3 und ADR-026 gegenüber der Implementierung

**Severity: Low**

| Zusage                                                                         | Fundstelle                                           | Realität                                                                              |
| ------------------------------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| „Downloadable-Archive-Export … **Phase 2**"                                    | `ADR-011-rev3.md`, Roadmap                           | Ist bereits implementiert (`audit-log/archive/route.ts`) — ADR unterschätzt den Stand |
| „**OTS-Upgrade-Job** … Phase 2"                                                | `ADR-011-rev3.md`, Roadmap                           | Existiert bereits (`apps/worker/src/crons/ots-upgrade.ts`)                            |
| „Läuft **00:05 UTC**" (D3)                                                     | `ADR-011-rev3.md`                                    | Kein Scheduler im Repo (→ S03-10)                                                     |
| „die tägliche Merkle-Root" (D3) vs. „timestamps the Merkle root … **monthly**" | `ADR-011-rev3.md` vs. `ADR-026` §Continuity proof 3  | Widersprüchlich; Code implementiert täglich                                           |
| „migration audit trigger **added in 0341**"                                    | `ADR-026`                                            | 0341 enthält null Trigger (→ S03-08)                                                  |
| `versionDistribution` / `migrationAnchors`-JSON-Beispiel                       | `ADR-026`                                            | `migrationAnchors` ist strukturell immer `[]` (→ S03-08)                              |
| „v1 — rev.2 trigger … v2 — rev.3 trigger" (Kopfkommentar listet nur v0–v2)     | `integrity/route.ts:11-21`                           | Der Code implementiert v3; der Kommentar erwähnt v3 erst 60 Zeilen später             |
| `tombstone … without breaking the hash chain`                                  | `dpms/audit-log-tombstone/route.ts:9`, `0284`-Header | Bricht die Kette (→ S03-06)                                                           |
| „chain_seq / hash chain are assigned by DB defaults + triggers"                | `document-retention-purge.ts:79`                     | Es gibt keinen solchen Trigger (→ S03-05)                                             |
| „parallel inserts within one tenant are **strictly serialised**"               | `0284`-Header                                        | Nur unter `read committed` (→ S03-09)                                                 |

In einem Compliance-Produkt ist die Richtigkeit der eigenen Architektur-Dokumentation selbst ein
Compliance-Merkmal; die Zusagen in ADR-011/026 werden gegenüber Kunden und Prüfern als
Nachweis geführt.

---

## 6. Antworten auf die vier Leitfragen des Auftrags

**1. Kann ein Angreifer mit DB-Zugriff Einträge ändern und die Kette konsistent neu berechnen?**
**Ja, vollständig** (S03-01, experimentell belegt in EXP-8b). Zusätzlich genügt sogar ein einziges,
vom Guard _erlaubtes_ UPDATE, um Manipulation unsichtbar zu machen, ohne die Kette anzufassen
(S03-02) — dabei bleibt sogar der externe FreeTSA-Anker gültig. **Die Hash-Kette ist damit eine
Integritätsprüfung gegen versehentliche Korruption, keine Tamper-Evidence gegen einen
privilegierten Akteur** — unabhängig davon, was ADR-011 rev.3 zusagt.

**2. Race Condition beim parallelen Einfügen?**
Unter dem tatsächlich verwendeten `read committed` **nein** — der Advisory-Lock aus Migration 0343
greift, mit zwei parallelen psql-Sessions belegt. Unter `repeatable read`/`serializable` **ja**,
mit Fork-Nachweis (S03-09). Latenter Defekt, kein aktueller Angriffspfad.

**3. Deckungsgrad — welche fachlich relevanten Tabellen haben keinen Audit-Trigger?**
508/527 = 96,4 %. Fachlich kritisch fehlen `approval_decision`, `review_decision`,
`attestation_response` und `account`; `access_log` hat Append-only-RULES, aber keine Hash-Kette.
Die drei Sign-off-Tabellen protokollieren nur INSERT (S03-13). Gravierender als die Trigger-Lücken
sind die sechs Codepfade, die _am_ Trigger vorbei ungehashte Einträge schreiben (S03-05).

**4. FreeTSA-Ausfallverhalten und Validierung der TSA-Antwort?**
Ausfall blockiert **nicht** (der Eintrag entsteht im DB-Trigger, unabhängig vom Netzwerk) — die
Tamper-Evidence bekommt eine stille, wegen des fehlenden Retrys **dauerhafte** Lücke (S03-10).
Die TSA-Antwort wird **gar nicht validiert**: kein Nonce-Abgleich, kein `messageImprint`-Vergleich,
keine Signatur- oder Zertifikatsprüfung; akzeptiert wird jede HTTP-200-Antwort mit `status = 0`
(S03-11). Und in der ausgelieferten Deployment-Konfiguration existiert überhaupt kein Scheduler,
der den Anker je auslöst.

---

## 7. Positiv vermerkte Kontrollen

Zur Abgrenzung gegen Falsch-Positive ausdrücklich festgehalten:

- `grc_app` hat **keine** Rechte auf `audit_log` — die nutzerseitige Runtime kann den Trail unter
  Least-Privilege nicht manipulieren (hat allerdings die Kehrseite S03-19).
- Der Guard blockiert `entry_hash`/`previous_hash`-UPDATEs zuverlässig, solange
  `session_replication_role` nicht gesetzt wird (EXP-8 scheiterte daran).
- Die per-Tenant-Skopierung und die Umstellung der Kettenordnung auf `chain_seq` (Migration 0313)
  sind fachlich korrekt und lösen ein echtes Problem.
- Die TZ-invariante v3-Formel (`to_char(… AT TIME ZONE 'UTC', …)`) ist richtig gebaut; 142/142
  Live-Zeilen verifizieren gegen sie.
- Die Fork-Race der Sign-off- und Dokument-Signatur-Ketten ist mit
  `UNIQUE NULLS NOT DISTINCT` **DB-durchgesetzt** gelöst (0341, 0375) — die robustere Lösung als
  der Advisory-Lock in `audit_trigger()`.
- Der Archiv-Export legt die rohen RFC-3161-Beweisbytes offen und geht damit über den ADR-Stand
  hinaus; nur Anleitung und Feldumfang sind defekt (S03-07).
- Trigger-Deckungsgrad von 96,4 % ist für ein System dieser Größe überdurchschnittlich.
- Der `hashtext`-Advisory-Lock ist per Scope partitioniert; Mandanten blockieren sich nicht
  gegenseitig (bis auf seltene `int4`-Kollisionen).

---

## 8. Evidenzverzeichnis

| Datei                                                 | Inhalt                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `evidence/S03_functions.sql`                          | Alle Audit-/Hash-Funktionen aus der laufenden DB (`pg_get_functiondef`)   |
| `evidence/S03_verify.sql`                             | 1:1-Nachbau der Verifikation aus `integrity/route.ts`                     |
| `evidence/S03_anchor_gate.sql`                        | 1:1-Nachbau der Anker-Schranke aus `anchor/route.ts`                      |
| `evidence/S03_full_rewrite.sql`                       | EXP-8 — Kettenneuberechnung ohne Guard-Bypass (scheitert)                 |
| `evidence/S03_full_rewrite2.sql`                      | EXP-8b — Kettenneuberechnung mit `session_replication_role` (erfolgreich) |
| `evidence/S03_race_chain_fork.txt`                    | Fork-Nachweis unter `repeatable read`                                     |
| `evidence/S03_tables_with_audit_trigger.txt`          | 508 Tabellen mit `audit_trigger`                                          |
| `evidence/S03_tables_without_audit_trigger.txt`       | 19 Tabellen ohne, mit `org_id`-Kennzeichnung                              |
| `evidence/S03_orgid_tables_without_audit_trigger.txt` | Teilmenge mit `org_id`                                                    |
| `evidence/S03_merkle_check.py`                        | 1:1-Portierung von `merkle-tree.ts`; Merkle-Root vor/nach Tamper          |
| `evidence/S03_evidence_log.txt`                       | Konsolidierte Befehle E1–E8 mit Ausgabe                                   |
