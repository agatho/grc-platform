# Migrationen — Stand und bekannte Grenzen

**Stand: 2026-09-01, nach der Remediation `ARCTOS-FULL-2026-08-31` (WP1).**

Dieses Dokument beschrieb bis zum Audit einen Zustand, den es nicht mehr gab,
und wurde vom Produktions-Entrypoint als Rechtfertigung dafür zitiert, dass
fehlgeschlagene Migrationen toleriert werden. Beides ist entfallen. Was hier
steht, ist gemessen; jede Zahl lässt sich mit dem genannten Befehl
reproduzieren.

## Ist-Stand

```
$ createdb wp1
$ psql -d wp1 -c 'CREATE EXTENSION pgcrypto; CREATE EXTENSION "uuid-ossp";
                  CREATE EXTENSION vector;   CREATE EXTENSION timescaledb;'
$ cd packages/db && DATABASE_URL=... npx tsx src/migrate-all.ts

Applying 360 migrations...
  Pass 1: 356 succeeded, 4 deferred
  Pass 2: 4 recovered, 0 still failing

✓ 584 tables created
✓ 360/360 migrations applied

All migrations applied successfully.
```

Exit-Code 0. Ein zweiter Lauf ist ein No-Op (siehe „Applied-State"). Der
Schema-Diff gegen das Drizzle-Schema ist leer:

```
$ npx tsx tests/schema-drift-report.ts
Drizzle tables: 574   DB tables: 577
missing in DB : 0
column drift  : 0
duplicate defs: 0
RLS drift     : 3        # access_log, audit_anchor, audit_log — Finding S01-06, offen bei WP2
extra in DB   : 3        # _arctos_migrations, bpm_simulation_result, whistleblowing_audit_log
```

## Was sich geändert hat

| Vorher                                                                                                  | Jetzt                                                                                         |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 43 Migrationen liefen gegen eine leere Datenbank dauerhaft nicht (S09-01)                               | 0                                                                                             |
| 533 Tabellen nach `migrate-all`, 576 nach dem CI-Pfad, wieder andere in Produktion (S09-02)             | ein Pfad, ein Schema: 584 Tabellen                                                            |
| `create-missing-tables.ts` legte fehlende Tabellen ohne FK, Index, Constraint, Enum und RLS an (S09-03) | ersatzlos entfernt; CI baut das Schema aus den Migrationen                                    |
| `0315_rls_gap_closure_v4.sql` brach auf Tabelle 1 von 142 ab, 570 Policies entstanden nie (S09-04)      | 2552 Policies auf 508 Tabellen                                                                |
| Der Runner entfernte `BEGIN;`/`COMMIT;` und erzwang eine Transaktion pro Datei (S09-05)                 | der Runner respektiert die Transaktionssteuerung der Datei                                    |
| Kein Applied-State für 329 von 354 Dateien (S09-06)                                                     | Ledger `_arctos_migrations` mit SHA-256 je Datei, von Runner und Entrypoint gemeinsam genutzt |
| Entrypoint mit `ON_ERROR_STOP=0`, `2>/dev/null`, ohne Abbruch (S13-03)                                  | `ON_ERROR_STOP=1`, stderr erhalten, Exit ≠ 0, App startet nicht                               |
| Drei Sortierungen (`sort`, `sort -V`, JS `.sort()`) (S09-15, S13-21)                                    | überall Byte-Reihenfolge (`LC_ALL=C sort` ≡ `Array.prototype.sort()`)                         |

## Applied-State

`_arctos_migrations (filename, checksum, applied_at, applied_by, status)`.
Runner und Entrypoint tragen jede erfolgreich angewendete Datei mit ihrer
SHA-256-Prüfsumme ein und überspringen sie danach. Das ist die Voraussetzung
dafür, dass ein Containerstart nicht mehr alle Migrationen erneut einspielt —
Idempotenz ist bei den Altdateien nicht durchgängig gegeben (`0285` legt einen
Trigger ohne Guard an, `0306` eine Policy).

Trifft der Entrypoint eine **bereits deployte** Datenbank ohne Ledger an, läuft
er einmal im Adoptionsmodus: Fehler der Form „already exists" gelten dann als
Beleg, dass die Datei ihre Wirkung schon hat, und werden als `status='adopted'`
verbucht; jeder andere Fehler bleibt fatal. Abschaltbar mit
`MIGRATION_ADOPT_EXISTING=false`.

`drizzle/meta/_journal.json` enthält weiterhin nur die 25 von `drizzle-kit
generate` erzeugten Einträge (`0000`–`0024`). Das ist **kein** Applied-State
mehr, sondern die Historie des Generators; `drizzle-kit migrate` ist aus allen
Schemabau-Pfaden entfernt. Neue Migrationen sind SQL-Dateien in `drizzle/` mit
dem ADR-023-Metadaten-Header — das prüft
`.github/workflows/migration-policy.yml`.

## Bekannte Grenzen (nicht behoben, bewusst)

1. **Vier Dateien brauchen einen zweiten Pass.** `0068`/`0069` referenzieren
   `catalog`/`catalog_entry` aus `0075`, `0071` eine Spalte, die eine spätere
   Datei ergänzt, `0106` `framework_mapping` aus `0107`. Die Reihenfolge ist
   also nicht topologisch. Runner und Entrypoint konvergieren darüber in
   höchstens drei Pässen und brechen ab, wenn danach noch etwas offen ist. Eine
   echte topologische Sortierung hätte Änderungen an Migrationen erfordert, die
   erfolgreich ausgeliefert sind — nach ADR-014 unzulässig.

2. **21 Indexnamen sind über Tabellen hinweg doppelt vergeben**, jeweils mit
   `IF NOT EXISTS`. Sie brechen keine Migration, aber der zweite Index entsteht
   still nicht; `node tests/check-migration-index-names.mjs` listet sie als
   Warnung. Die betroffenen `org_id`-Indizes zieht
   `0387_fk_and_org_id_indexes.sql` generisch nach; der Rest ist Aufräumarbeit
   ohne Funktionsbezug.

3. **31 Nummernlücken** (`0147`, `0181`–`0185`, `0208`–`0210`, `0217`–`0222`,
   `0250`, `0272`–`0277`, `0280`, `0358`, `0359`, `0364`–`0366`, `0370`–`0372`).
   Harmlos, verhindern aber die Aussage „alle Migrationen bis N sind
   eingespielt". Das Ledger ersetzt diese Aussage; ein Sequenz-Gate gibt es
   bewusst nicht. Die Nummern sind seit dieser Remediation eindeutig — `0085`
   und `0349` waren doppelt vergeben, `0085_ai_act_full_compliance.sql` heißt
   jetzt `0085a_ai_act_full_compliance.sql`.

4. **`dashboard_widget_config` existiert nicht.**
   `0124_seed_isms_bcm_dashboards.sql` und die Seed-Skripte
   `src/seeds/isms-bcm-dashboards.ts` und `src/seeds/erm-dashboards.ts`
   schreiben in eine Tabelle, die es in keiner Migration, keiner
   `pgTable`-Definition und keiner Umgebung gibt. Der Seed in der Migration ist
   mit einem `to_regclass`-Guard versehen und damit ein No-Op. Die real
   vorhandenen Ablagen (`custom_dashboard`, `custom_dashboard_widget`,
   `role_dashboard_config`, `user_dashboard_layout`) sind alle org-gebunden und
   damit keine Ablage für die hier gemeinten plattformweiten System-Dashboards.
   **Offene fachliche Klärung**, kein technischer Defekt mehr.

5. **`notification_template` existiert nicht.** Gleiche Lage in
   `0025_sprint14_rcsa.sql`: drei E-Mail-Vorlagen für RCSA sind geguarded und
   werden nicht angelegt. Kein Code liest die Tabelle.

6. **Drei Log-Tabellen ohne RLS** — `access_log`, `audit_anchor`, `audit_log`.
   Das ist Finding S01-06 und gehört zu WP2. Der Drift-Report meldet sie; das
   CI-Gate schaltet sie über `--fail-on-rls` scharf, sobald WP2 gelandet ist.

7. **Fünf Spalten, in denen die Datenbank strenger ist als der Code** —
   `{audit,process,vendor}_sign_off.ip_address` (`inet` statt `varchar`) und
   `catalog_entry_mapping.{relationship,mapping_source}` (Enum statt
   `varchar`). Sie stehen begründet in `tests/schema-drift.ts`
   (`ACCEPTED_TYPE_DRIFT`); angeglichen gehört hier die Code-Seite, und die
   liegt bei den Paketen, die diese Module besitzen.

8. **TimescaleDB wird nicht genutzt.** Die beiden `create_hypertable()`-Aufrufe
   in `0136` und `0153` sind entfernt (S09-18): sie schlugen mit `TS103` fehl,
   sobald die Extension vorhanden war, weil beide Tabellen einen einspaltigen
   Primärschlüssel auf `id` haben — die Dateien waren also überall dort grün,
   wo TimescaleDB fehlte, und genau dann rot, wenn jemand die Extension
   aktivierte. Es gibt weiterhin null Hypertables und null anwendungsbezogene
   Retention-Policies. Ob das Produktions-Image `timescale/timescaledb` bleibt,
   ist eine Betriebsentscheidung (WP10).

## Zur früheren Fassung dieses Dokuments

Die alte Einteilung (Kategorien A–G, „≈30 fehlschlagend", „483 Tabellen") war
zum Zeitpunkt des Audits in sieben Punkten sachlich falsch:

- Kategorie D („Enum, both fixed") — `IF NOT EXISTS` adressiert `55P04`
  („unsafe use of new value") nicht; `0096` scheiterte weiterhin.
- Kategorie F („TimescaleDB, both fixed") — der `DO`-Block fängt nur die
  _fehlende_ Extension ab; ist sie da, schlagen beide Dateien fehl.
- Kategorie B („Ziel-Tabellen existieren via `create-missing-tables.ts`") — die
  so erzeugten Tabellen hatten weder FKs noch Indizes, Constraints oder RLS.
- `0053` → vermutet `exercise_date`, real `planned_date`.
- `0092` → vermutet `o.code`, real `org_code`.
- `0061` → vermutet `risk_level`/`inherent_score`, real `risk_score_inherent`.
- `0064` → „auf einer Tabelle die kein `name`-Feld hat", konkret
  `business_capability`, Zeile 99.

Die Einteilung ist ersatzlos entfallen, weil es die Fehlschläge nicht mehr
gibt. Die vollständige Einzelanalyse der 43 Dateien liegt in
`/work/audit/evidence/S09-migration-defects.md`, die Umsetzung in
`/work/audit/remediation/WP1.md`.
