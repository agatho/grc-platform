# WP8 — Datenschutz, DSGVO, HinSchG · Umsetzungsprotokoll

**Audit-ID:** ARCTOS-FULL-2026-08-31 · **Stream:** S07 (29 Findings) · **Welle:** 3
**Branch:** `audit/full-2026-08-31` · **Migrationen:** 0425–0434
**Stand:** abgeschlossen

> **Abgrenzung.** Alle Aussagen in diesem Protokoll und in den erzeugten
> Dokumenten sind technische Bewertungen der Implementierung gegen den Wortlaut
> von DSGVO, BDSG und HinSchG. Sie sind keine Rechtsberatung und ersetzen keine
> datenschutzrechtliche Würdigung durch einen Rechtsbeistand oder die zuständige
> Aufsichtsbehörde.

---

## 0. Ausgangslage nach Welle 1 und 2

Vor der ersten eigenen Änderung wurde geprüft, was WP2/WP3/WP4 bereits erledigt
haben. Das Ergebnis hat den Zuschnitt von drei Findings verändert:

| Vorbefund         | Stand nach Welle 2                                                                                                                                                                                                                                                                                                                                   | Konsequenz für WP8                                                                                                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S07-01 (Critical) | WP4s `audit_trigger()` schreibt für `wb_case`, `wb_case_message`, `wb_case_evidence`, `wb_report` nur noch einen identitätsfreien Existenzeintrag; `audit_scrub_changes()` entfernt Schlüssel wie `token` generisch. **Gemessen** (`evidence/wp8/repro-01-before.out`): Mailbox-Token, `category` und `ip_hash` stehen nicht mehr im org-weiten Log. | **Neun** der dreizehn `wb_*`-Tabellen waren von WP4s Liste nicht erfasst und schrieben weiter die vollständige Zeile — darunter `wb_protection_case.reporter_user_id`, eine direkte Referenz auf die hinweisgebende Person. Rest geschlossen. |
| S07-05            | `audit_scrub_changes()` + `audit_sensitive_column` schliessen den Schreibpfad; die Regex trifft alle Authentifikatoren des PII-Inventars.                                                                                                                                                                                                            | Offen blieb der **Bestand**: 46 von 147 Zeilen der frisch migrierten Instanz trugen weiterhin bcrypt-Hashes. Einmaliger Bereinigungslauf ergänzt.                                                                                             |
| S07-11            | WP2 hat `audit_log` auf FORCE-RLS mit Org-Policies gestellt; `wb_anonymous_mailbox` hat eine Parent-Policy über `wb_report`.                                                                                                                                                                                                                         | **Bestätigt, kein eigener Fix.**                                                                                                                                                                                                              |
| S07-22            | WP3s Migration 0410 hat `ombudsperson` ins DB-Enum aufgenommen (20 Werte, eine Quelle der Wahrheit).                                                                                                                                                                                                                                                 | **Bestätigt, kein eigener Fix.** Die Rolle wird jetzt auch tatsächlich genutzt (neue Route, neue RLS-Policy).                                                                                                                                 |
| S07-26            | WP5 hat den Bezeichner-Filter im Export-Engine auf eine Allowlist aus `def.exportColumns` und den SQL-Builder umgestellt.                                                                                                                                                                                                                            | **Bestätigt, kein eigener Fix.** Regressionsprüfung ergänzt.                                                                                                                                                                                  |
| S07-27            | `data_export_log` unverändert sauber gehärtet.                                                                                                                                                                                                                                                                                                       | **Bestätigt** (Positivbefund).                                                                                                                                                                                                                |

---

## 1. Findings — Änderung, Nachweis, Status

### S07-01 — Critical — Hinweisgeber-Daten und Mailbox-Token im org-weiten `audit_log`

**Änderung** — Migration `0426_wb_confidentiality_isolation.sql`:

1. Der generische `audit_trigger()` ist von **allen dreizehn** `wb_*`-Tabellen
   entfernt. Der org-weite Log verliert damit auch den Existenzeintrag; das ist
   beabsichtigt — ein Eintrag je Fallnachricht ist ein Aktivitätsprofil, und
   HinSchG §8 kennt kein „aber die Metadaten sind harmlos".
2. `whistleblowing_audit_trigger()` liegt jetzt auf allen dreizehn statt auf drei
   Tabellen. Neun davon haben keine eigene `case_id`; die Zuordnung erfolgt über
   die neue Funktion `wb_case_scope_of(table, row)` (Report → Fall,
   Investigation → Fall, Protection-Event → Protection-Case → Fall). Vorgänge vor
   der Fallanlage (eingehende Meldung, erzeugtes Postfach) laufen unter der
   Report-UUID als Skopus und sind über `wb_case.report_id` verknüpfbar.
3. Der Kettenanteil (`compute_wb_audit_hash_v2`, Advisory-Lock, Tiebreak über
   `entry_hash`, `audit_scrub_changes`, `hash_version = 2`) ist byteidentisch aus
   WP4/0406 übernommen.

**Nachweis** — `evidence/wp8/repro-01-before.out` (Stand vor WP8) und
`evidence/wp8/repro-01-after.sql`; als Test:
`packages/db/tests/integration/gdpr-privacy.test.ts`, Block „S07-01" mit fünf
Prüfungen — 0 `wb_*`-Zeilen im org-weiten Log, kein Trigger mehr, Token/Kategorie/
Melderbezug nirgends auffindbar, und die Gegenprobe, dass das vertrauliche Log
die Vorgänge **doch** enthält (Vertraulichkeit darf nicht dadurch entstehen, dass
gar nichts mehr protokolliert wird).

**Status: geschlossen.**

---

### S07-02 — High — `wb_report.ip_hash`: ungesalzener SHA-256

**Änderung** — `packages/shared/src/wb-crypto.ts`: `hashIp()` ist ein
HMAC-SHA256 unter `WB_PSEUDONYM_KEY` (ersatzweise aus `WB_ENCRYPTION_KEY`
abgeleitet, nie ungesalzen) mit Mandanten-Diskriminator. Duplikaterkennung
innerhalb einer Organisation bleibt, Verknüpfbarkeit über Mandanten hinweg
entfällt. Neu: `ipMatchesHash()` als einziger legitimer Auflösungsweg.
`apps/web/.../portal/report/[orgCode]/route.ts` reicht die `org.id` durch.

**Nachweis** — `packages/shared/tests/wb-crypto.test.ts`: „resists a dictionary
attack over a whole /24 network" fährt genau den Angriff des Berichts (256
Hashes). Der frühere Test „matches SHA-256 reference for a known input" hat den
Defekt nicht gefunden, sondern **festgeschrieben** — er ist mit Begründung im
Code durch drei Prüfungen ersetzt.

**Status: geschlossen.**

---

### S07-03 — High — Tombstone-Hash mit Salt in derselben Zeile

**Änderung** — Migrationen `0425_pii_pseudonym_key.sql` und
`0428_tombstone_hardening.sql`:

- `pii_hmac(value, domain)` — HMAC unter einem Schlüssel, der **nicht neben den
  Daten liegt**. Bevorzugt `PII_PSEUDONYM_KEY` aus der Prozessumgebung (dann auch
  nicht im Datenbank-Dump), ersatzweise ein Installationsschlüssel in
  `pii_pseudonym_key` (deny-all RLS, keine Grants, für keine Anwendungsrolle
  lesbar). Welcher Weg griff, steht als `key_id` an jedem Pseudonym — dasselbe
  Muster wie WP4s `seal_key_id`.
- `pii_pseudonym_key_destroy()` — die von ADR-011 rev.2 §103 vorausgesetzte
  Schlüsselvernichtung, die es nie gab. Erst sie macht aus der
  Pseudonymisierung eine Löschung.
- `tombstone_audit_entry()` nutzt `pii_hmac` statt `sha256(pii || '|' || entry_hash)`.

**Nachweis** — Test „the tombstone hash is not sha256(value || '|' ||
entry_hash)"; `evidence/wp8/repro-art17.out` Block (e): Rückrechnung gegen die
Kandidatenliste liefert 0 Treffer (vorher: exakter Treffer).

**Status: geschlossen.** Restrisiko: ohne gesetztes `PII_PSEUDONYM_KEY` liegt der
Schlüssel in derselben Datenbank — nicht mehr in derselben _Zeile_, aber für einen
Datenbank-Superuser erreichbar. In Abschnitt 4 an WP10 übergeben.

---

### S07-04 — High — `audit_log.entity_title` konserviert den Klarnamen

**Änderung** — `0428_tombstone_hardening.sql`, zwei Eingriffe am WP4-Guard,
ausdrücklich abgestimmt und in Abschnitt 4 an WP4 gemeldet:

1. `entity_title`, `user_agent`, `session_id` kommen auf die Redaktions-Allowlist.
   Keine der drei ist unter v4 eine Hash-Eingabe: `entity_title` geht über
   `audit_content_commitment()`, das beim Tombstone erhalten bleibt;
   `user_agent`/`session_id` gehen in gar keine Formel ein. `hash_version`
   (S03-02) und `content_commitment` bleiben ausgeschlossen, der Trigger bleibt
   `ENABLE ALWAYS`.
2. Das Tor „nur beim Übergang NULL → NOT NULL" wird zu „nur wenn
   `pii_tombstoned_at` vorrückt". Ein Audit-Eintrag kann mehrere Personen
   betreffen; die Löschung für die zweite war vorher technisch unmöglich. Die
   Invariante — diese Spalten ändern sich ausschliesslich im Zuge einer
   protokollierten Redaktion — bleibt vollständig erhalten.

Zusätzlich: `tombstone_audit_entries_for_entity()` und
`tombstone_audit_entries_for_subject()` als Mengen-Einstiegspunkte (S07-28 hielt
fest, dass es keine gab).

**Nachweis** — Test „redacts entity_title, which was previously unreachable by
design", flankiert von „a plain UPDATE is still refused" und „hash_version and
content_commitment stay out of the allowlist". `evidence/wp8/repro-art17.out`
Block (c)/(d): 0 Klartextreste.

**Status: geschlossen.** `audit_log.metadata` bleibt nicht redigierbar — siehe
Restrisiko in Abschnitt 5.

---

### S07-05 — High — Passwort-Hashes und Token im unlöschbaren Log

**Änderung** — Der Schreibpfad war durch WP4 bereits geschlossen (nachgemessen).
Ergänzt in `0428`:

- Einmaliger Bereinigungslauf über den **Bestand**. Für `hash_version = 4` ist
  das hashneutral (`changes` geht nur über das Content-Commitment ein), deshalb
  wird der Guard für die Dauer der Migration ausgesetzt, damit der Vorgang nicht
  als Art.-17-Redaktion zählt. Für v1–v3 ist `changes` direkte Hash-Eingabe;
  dort läuft die Bereinigung über den Redaktionspfad, damit die Kette
  `redacted_legacy` statt `row_mismatch` meldet.
- Dreizehn zusätzliche Zeilen in `audit_sensitive_column` (der von WP4
  vorgesehene Erweiterungsweg): `account.*_token`, `session.session_token`,
  `verification_token.token`, `invitation.token`, `wb_anonymous_mailbox.token`,
  `mobile_session.refresh_token`, `scim_token.token_hash`, dazu `user.avatar_url`
  und `dsr.subject_*` als PII (kein Geheimnis, aber im Log unnötig).

**Nachweis** — Migrationsausgabe „credential purge — 0 v4 rows scrubbed in place,
46 legacy rows redacted"; `SELECT count(*) FROM audit_log WHERE changes::text ~
'\$2[aby]\$'` → 0; Test „scrubs credentials on write".

**Status: geschlossen.**

---

### S07-06 — High — `redact_pii_jsonb()` erfasst nur die oberste Ebene

**Änderung** — `0427_pii_redaction_registry.sql`:

- Die Schlüsselliste wandert aus dem Funktionsrumpf in `pii_redaction_rule`,
  initial befüllt aus `/work/audit/evidence/S07-pii-inventar.csv` (**171** Regeln
  statt 26 Namen): Authentifikatoren → `drop`, direkt identifizierende Spalten →
  `pseudonymise`, alle 124 Freitext-Schlüsselnamen → `drop`, dazu
  Beschäftigten-Leistungsdaten entitätsbezogen (S07-23).
- `redact_pii_jsonb()` ist rekursiv, behandelt Arrays und alle JSON-Typen und hat
  drei Modi. Für Schlüssel ohne Regel entscheidet `pii_key_class()` heuristisch
  nach Namensmuster — eine künftige Spalte ist damit nicht standardmäßig
  ungeschützt.
- Bewusst **nicht** redigiert: Fremdschlüssel auf `user` (die 544 „pseudonym
  identifizierenden" Spalten). Sie tragen den Personenbezug nur mittelbar; er
  endet mit der Anonymisierung der `user`-Zeile.

**Nachweis** — Tests „redacts a nested email that the old top-level-only version
never reached", „covers a key that nobody registered, via the name heuristic",
„registers the whole PII inventory, not 26 keys".

**Status: geschlossen.**

---

### S07-07 — High — Keine automatisierte Löschung nach Aufbewahrungsfristen

**Änderung** — `0429_retention_execution.sql` und
`apps/worker/src/crons/retention-monitoring.ts`:

- `retention_binding` bindet die fachliche Datenkategorie an Tabelle,
  Fristspalte, Strategie und Zusatzbedingung — die Verbindung, die
  `retention_schedule` (nur `data_category varchar(50)` und ein Freitext-JSONB)
  nie hatte.
- `retention_purge_table()` führt eine Bindung aus, **fristbezogen gegen das
  Alter der Daten**, und schreibt jeden Lauf nach `retention_run_log`.
  Entscheidend: die Funktion setzt die Append-only-Rules von `access_log` und
  `data_export_log` für die Dauer _ihrer_ Transaktion aus. Ohne das wäre ein
  `DELETE` dort ein stiller No-op und der Job hätte „gelöscht: 0" gemeldet —
  genau die Klasse Placebo, die dieser Befund beschreibt. Ein generischer
  `app.*`-Schalter (wie das von WP2 entfernte `app.bypass_rls`) wird bewusst
  nicht eingeführt.
- Der Cron rechnet nicht mehr gegen `schedule.createdAt`, löst über die Bindung
  auf und **wirft** bei Fehlern, statt grün zu melden. Kategorien ohne Bindung
  erzeugen weiterhin ein Ticket — mit dem Grund im Klartext.

**Nachweis** — `evidence/wp8/repro-retention.sql`: gewöhnliches `DELETE` bleibt
wirkungslos → Trockenlauf meldet 1 → echter Lauf löscht 1 → nur die überfällige
Zeile ist weg → Rule wieder aktiv → Eintrag in `retention_run_log`. Als Test:
Block „S07-07 / S07-24" mit vier Prüfungen.

**Status: geschlossen.** Der Scheduler gehört WP9 und ist während dieser Welle
entstanden (S10-02); `retention-monitoring` läuft dort um 01:45 UTC.

---

### S07-08 — High — `actor_hash` mit der `case_id` als Salt

**Änderung** — `0426`: `v_actor_hash := pii_hmac(user_id || '|' || case_id,
'wb_actor')` statt `sha256(...)`. Die neue Spalte
`whistleblowing_audit_log.actor_key_id` macht sichtbar, unter welchem Schlüssel
das Pseudonym entstand.

**Nachweis** — Tests „is not sha256(user_id || '|' || case_id)" (Wörterbuch über
die volle Nutzermenge × Fallmenge) und „is not sha256('system' || '|' ||
case_id)".

**Status: geschlossen.**

---

### S07-09 — High — `whistleblowing_audit_log` ohne Mandantengrenze, `admin` lesend

**Änderung** — `0426`: Spalte `org_id` (vom Trigger befüllt, Bestand aus
`wb_case` nachgezogen), Index, und eine neue Lesepolicy
`org_id = current_org AND role IN ('whistleblowing_officer','ombudsperson')`.
`admin` ist raus — wie ADR-011 rev.2 §82-83 es vorschreibt. Der frühere Join auf
`wb_case` entfällt; er lief für report-skopierte Zeilen ins Leere.

**Nachweis** — Tests „carries an org_id on every new row" und „the read policy no
longer lists admin".

**Status: geschlossen.**

---

### S07-10 — High — Art.-35-DPIA-Automatismus vom Aufrufer abschaltbar

**Änderung** — `apps/web/.../processes/[id]/ropa-profile/route.ts`:
`requiresDpia = highRisk || parsed.data.requiresDpia === true` statt
`parsed.data.requiresDpia ?? highRisk`. Ein `requiresDpia: false` bei
vorliegendem Indikator wird ignoriert **und protokolliert**; eine freiwillige
DSFA ohne Indikator bleibt möglich (Art. 35 Abs. 10 unschädlich).

**Nachweis** — `apps/web/src/__tests__/lib/ropa-validation.test.ts`: der Test
„respects explicit requiresDpia=false override even for high-risk" hat das
Verhalten als gewollt festgeschrieben; er ist mit Begründung im Code durch sein
Gegenteil ersetzt, plus eine Prüfung, dass die Entscheidung ohne Indikator beim
Verantwortlichen bleibt.

**Dateihoheit:** `apps/web/src/app/api/v1/processes/**` ist in
`REMEDIATION_PLAN.md` **keinem** Paket zugewiesen. Da das Finding WP8 gehört und
kein Wellen-3-Partner diesen Pfad hält, wurde die Änderung hier vorgenommen —
vermerkt in Abschnitt 4.

**Status: geschlossen.**

---

### S07-11 — Medium — `audit_log` ohne RLS

**Änderung** — keine. WP2 hat `audit_log` auf `relrowsecurity = t`,
`relforcerowsecurity = t` mit vier Org-Policies gestellt; `wb_anonymous_mailbox`
hat eine Parent-Policy über `wb_report`.

**Nachweis** — `packages/db/tests/rls/tenant-isolation-systemtest.test.ts`
(WP2, grün); Katalogabfrage in diesem Protokoll.

**Status: durch WP2 geschlossen, hier bestätigt.**

---

### S07-12 — Medium — HinSchG §11 Abs. 5: keine Löschung nach drei Jahren

**Änderung**:

- `0429`: `whistleblowing_retention_purge(org, days, dry_run)` — löscht die
  Dokumentation abgeschlossener Verfahren über elf abhängige Tabellen in
  FK-Reihenfolge, **einschliesslich der Kopie im vertraulichen
  `whistleblowing_audit_log`**. Das ist der bewusste Vorrang der gesetzlichen
  Löschpflicht vor der Append-only-Eigenschaft des Fachlogs; die Kette wird je
  `case_id` geführt, alle übrigen Fälle bleiben intakt.
- `0433`: `whistleblowing_orphan_report_purge()` — Meldungen, zu denen nie ein
  Fall angelegt wurde, hatten sonst gar keine Frist (`token_expires_at` lässt nur
  den Zugangstoken verfallen, nicht die Zeile).
- `apps/worker/src/crons/retention-whistleblowing.ts` — führt beide aus und
  löscht die Beweismittel-Dateien im Objektspeicher mit; ein Fehlschlag dort ist
  ein Job-Fehler, keine Randnotiz.

**Nachweis** — Test „purges a case that was closed more than three years ago",
inklusive der Prüfung, dass auch die Fachlog-Kopie weg ist.

**Status: geschlossen.** Von WP9 als `retention-whistleblowing` (02:40 UTC)
eingeplant.

---

### S07-13 — Medium — Kein Auskunfts- oder Übertragbarkeitsverfahren

**Änderung**:

- `0430_dsr_subject_collector.sql`: `dsr_subject_index` wird **aus dem
  Datenbankkatalog erzeugt** (`dsr_subject_index_refresh()`) — jede Tabelle mit
  FK auf `user` und jede mit E-Mail- oder Personennamensspalte, 59 Einträge.
  `dsr_collect_subject_data()` sammelt darüber und liefert JSONB;
  `p_portability = true` beschränkt auf von der Person bereitgestellte Daten
  (Art. 20). Geheimnisse gehen durch `audit_scrub_secrets_jsonb()`.
  `dsr` bekommt `subject_user_id`, `collected_at`, `collected_by`,
  `collection_summary`.
- `apps/web/.../dpms/dsr/[id]/collect/route.ts` (POST = Sammellauf mit
  Zusammenfassung im Vorgang, GET = Auskunftsdatei) und `.../erase/route.ts`
  (Art. 17, `dryRun` als Regelfall, `confirm: true` für die echte Ausführung).
  Beide verlangen `dsr.verified_at` — Art. 12 Abs. 6; eine Auskunft an die
  falsche Person ist selbst eine Datenschutzverletzung.
- **Ausnahme `wb_*`**: nicht im Register. Eine Auskunft nach Art. 15 darf nicht
  das Werkzeug sein, mit dem eine beschuldigte Person die hinweisgebende Person
  identifiziert (Art. 15 Abs. 4 DSGVO, HinSchG §§ 8, 9). Die Antwort weist die
  Einschränkung als `excluded` aus, statt sie zu verschweigen.
- Der Volltext wird **nicht** gespeichert — eine gespeicherte Auskunft wäre eine
  zweite Kopie derselben Daten.

**Nachweis** — `evidence/wp8/repro-dsr-collect.sql` (Art. 15 findet fünf
Fundstellen über vier Kategorien, Art. 20 lässt die Protokolle weg, der
Passwort-Hash ist redigiert); Tests „collects the subject's data across schemas"
und „excludes the whistleblowing tables from the access request".

**Status: geschlossen.**

---

### S07-14 — Medium — Massenexport ohne Rolle, ohne Vier-Augen, falsch gekennzeichnet

**Änderung**:

- `apps/web/.../export/bulk/route.ts` baut WP3s `decideBulkExport()` ein (Rolle,
  höchstens fünf Entitätstypen, Zeilenobergrenze über den **gesamten** Vorgang,
  Vier-Augen bei Personenbezug). Die Vier-Augen-Frage wird erst gestellt, wenn
  der Export tatsächlich Personenbezug hat — sonst würde eine Freigabe verbraucht,
  bevor die Rollenprüfung greift.
- `0432_export_four_eyes.sql`: `export_approval` mit
  `CHECK (approved_by <> requested_by)` — das Prinzip hängt an einem
  Constraint, nicht an Anwendungslogik —, Ablauf, Einmalverwendung und
  Zustandsguard. `export_approval_consume()` prüft und verbraucht atomar.
- Neuer gemeinsamer Helfer `apps/web/src/lib/export-audit.ts`:
  `contains_personal_data` wird aus den tatsächlich exportierten Spalten der
  Entity-Registry abgeleitet (vorher: zweielementige Literalliste, während
  `owner_email`, `contact_person`, `reporter_email`, `tax_id` exportiert wurden),
  `ip_address` wird gesetzt (war immer NULL), und `logExportOrThrow()` **wirft**
  — ein Export ohne Nachweis wird nicht ausgeliefert (503).
- Eingebaut in `export/bulk`, `export/[entityType]`, `dpms/ropa/export`
  (jetzt rollenbeschränkt statt für jeden Angemeldeten), `dpms/dpia/[id]/export-pdf`
  und `dpms/annual-report/[year]/pdf` (beide standen auf der Liste der 19
  ungeloggten Pfade), `dpms/dsr/[id]/collect` (GET).

**Nachweis** — Tests „refuses an approval granted by the requester themselves",
„consumes a valid approval exactly once", „refuses an approval that does not
cover the requested entity types".

**Status: geschlossen für die WP8-Routen.** Die übrigen ungeloggten Exportpfade
liegen in fremder Dateihoheit — Abschnitt 4.

---

### S07-15 — Medium — Retention-Löschung schreibt den Datensatz in den unlöschbaren Log

**Änderung** — `apps/worker/src/crons/document-retention-purge.ts`:

1. `purgedFiles` (Dateipfade mit dem ursprünglichen Dateinamen) wandert von
   `metadata` nach `changes`. Grund: `metadata` ist unter v4 eine **direkte**
   Eingabe von `compute_audit_hash_v4()` und damit die einzige PII-tragende
   Spalte, die eine spätere Redaktion nicht anfassen kann, ohne die Kette zu
   brechen. In `metadata` bleiben Zählwerte.
2. Nach dem Commit ruft der Job `tombstone_audit_entries_for_entity(org,
'document', id, 'retention_purge')`. Der Audit-Trail behält, **dass** und
   **wann** gelöscht wurde; der Inhalt geht. Das Content-Commitment bleibt, die
   Kette verifiziert weiter.
3. Nebenbefund aus dem Bericht: die leeren `catch`-Blöcke. Eine nicht gelöschte
   Datei und ein fehlgeschlagener Purge werden jetzt gezählt und gemeldet; eine
   fehlgeschlagene Redaktion lässt den Job scheitern — eine nicht redigierte
   Kopie ist eine nicht vollzogene Löschung.

**Nachweis** — dieselbe Mechanik wie in Block „S07-13 + S07-28" (Kette bleibt
`healthy` nach der Redaktion); kein eigener Cron-Test, weil der Job keinen hat
(vermerkt in Abschnitt 4 an WP11).

**Status: geschlossen.**

---

### S07-16 — Medium — Copilot-RAG-Index sammelt soft-gelöschte Datensätze

**Änderung** — `apps/worker/src/crons/copilot-rag-indexer.ts` +
`0431_search_index_softdelete.sql`:

- `deleted_at IS NULL` im Lesequery.
- `onConflictDoUpdate` statt `onConflictDoNothing` — eine Korrektur muss im Index
  ankommen (Art. 5(1)(d)).
- `copilot_rag_prune(org)` als Bereinigungspfad; der Cron ruft ihn **vor** dem
  Indizieren.
- Der leere `catch` wird zu einer gezählten und gemeldeten Fehlerliste.

**Nebenbefund, der beim Fix auffiel:** `copilot_rag_source` hatte **keinen
Unique-Constraint** ausser dem Primärschlüssel. `onConflictDoNothing()` konnte
also nie greifen — jeder Sechs-Stunden-Lauf legte für jedes Risiko eine weitere
Zeile mit Titel und Beschreibung an, unbegrenzt wachsend. Migration 0431
dedupliziert und legt `crs_unique_source (org_id, source_type, entity_id,
chunk_index)` an.

**Nachweis** — Tests „copilot_rag_prune removes entries whose source is gone" und
„copilot_rag_source has the unique key its upsert always assumed".

**Status: geschlossen.**

---

### S07-17 — Medium — DPMS-Jahresbericht zählt soft-gelöschte Datensätze mit

**Änderung** — `apps/web/.../dpms/annual-report/[year]/route.ts` und
`.../pdf/route.ts`: `isNull(deletedAt)` in allen fünf Zählpfaden
(`ropa_entry` ×2, `dpia` ×2, `tia`) beider Varianten.

**Nachweis** — Codeprüfung; der Bericht ist ein Rechenschaftsnachweis nach
Art. 5(2)/Art. 30, kein Datenpfad mit Testfixture.

**Status: geschlossen.**

---

### S07-18 — Medium — Drittlandübermittlung an KI-Anbieter nicht steuerbar, nicht dokumentiert

**Änderung** — Neu: `docs/compliance/subprocessors-and-third-country-transfers.md`
mit der vollständigen Aufstellung (Hetzner, Resend, Backblaze, **Anthropic,
OpenAI, Google**, FreeTSA, OpenTimestamps), den Bedingungen, unter denen jeder
Empfänger aktiv wird, und der ausdrücklichen Klarstellung, dass „keine
Drittlandsübermittlung" nur bei ausschliesslich lokalen Modellen zutrifft. Die
Aussage in `gdpr-readiness-checklist.md` ist entsprechend korrigiert.

**Der technische Teil — Anbieter je Mandant, `fail-closed` statt stillem
Cloud-Rückfall, Auswertung des vorhandenen `data_residency`-Modells — liegt in
`packages/ai/**` und ist als S05-01/-03/-22 WP6 zugewiesen.** Abschnitt 4.

**Status: dokumentarisch geschlossen, technisch an WP6 übergeben.**

---

### S07-19 — Low — `WB_ENCRYPTION_KEY`: kein Rotationspfad, keine AAD, kein Startcheck

**Änderung** — `packages/shared/src/wb-crypto.ts`:

1. Ein Schlüssel für alle Mandanten — **offen**, Betriebs-/KMS-Entscheidung. Die
   Schlüsselkennung im Chiffrat (`v2:<keyId>:…`) ist die Vorarbeit dafür.
2. `WB_ENCRYPTION_KEY_PREVIOUS` — Rotation ohne Datenverlust, wie bei
   `SECRET_ENCRYPTION_KEY`.
3. AAD-Bindung: ein Nachrichtenchiffrat gehört an `wb_case_message:<caseId>`.
   Wer es von Fall A nach Fall B kopiert, bekommt jetzt einen Fehler statt einer
   stillen Entschlüsselung.
4. Doku-Drift korrigiert: `docs/env-vars-reference.md` und `.env.example` sagen
   jetzt „Verschlüsselung **at rest**" statt „Ende-zu-Ende-Verschlüsselung der
   Case-Attachments"; beides traf nicht zu.
5. `assertWbCryptoConfigured()` / `isWbCryptoConfigured()`: das Meldeportal weist
   ohne Schlüssel mit **503** ab und protokolliert den Grund, statt jede Meldung
   mit einem 500 zu verlieren (HinSchG §12).

Altformat-Chiffrate bleiben lesbar.

**Nebenbefund:** `wb_report.contact_email` war `varchar(320)` — die Länge einer
Klartextadresse, obwohl dort das Chiffrat steht (bei einer 100-stelligen Adresse
~356 Zeichen). Der Meldevorgang wäre mit einem 22001 abgebrochen, nachdem die
Meldung abgesetzt war. Migration 0433 stellt auf `text` um.

**Nachweis** — `packages/shared/tests/wb-crypto.test.ts`: v2-Umschlag,
Altformat-Kompatibilität, AAD-Fehlbindung, Rotation.

**Status: 4 von 5 geschlossen; Punkt 1 (Schlüssel je Mandant) als Restrisiko
geführt.**

---

### S07-20 — High — Hinweisgeber-Beweismittel werden nie gespeichert, Antwort trotzdem 201

**Änderung** — `apps/web/.../portal/mailbox/[token]/evidence/route.ts`,
vollständig neu:

1. **Erst speichern** (`getFileStorage().put()`), dann verifizieren
   (`exists()` — ein Backend, das `put` still verschluckt, darf nicht als Erfolg
   durchgehen), dann die Datenbankzeile. Schlägt die Speicherung fehl: **502**,
   keine Zeile, kein 201. Schlägt das Insert fehl, wird das verwaiste Objekt
   entfernt.
2. Der Speicherschlüssel enthält keinen vom Aufrufer bestimmten Anteil mehr —
   nur eine Endung aus einer Allowlist plus UUID. Der Path-Traversal-Kandidat aus
   dem Nebenbefund entsteht gar nicht erst.
3. Der Dateiname stand über den generischen Trigger im org-weiten `audit_log`
   („Kuendigung_Mueller_2026.pdf" ist identifizierend). Der Trigger liegt seit
   0426 nicht mehr auf den wb-Tabellen; zusätzlich ist `file_name` als `drop` im
   Redaktionsregister.
4. `0433`: `wb_case_evidence.stored_at` + `storage_backend` und ein
   `CHECK (is_immutable IS NOT TRUE OR stored_at IS NOT NULL)` (NOT VALID) —
   eine Zeile kann sich nicht mehr als unveränderliches Beweismittel ausgeben,
   ohne belegten Speichervorgang. Die Mailbox-Ansicht zeigt der hinweisgebenden
   Person `stored: true/false`.

**Status: geschlossen.**

---

### S07-21 — Low — Die als Kompensation genannte Route existiert nicht

**Änderung** — `apps/web/.../whistleblowing/audit-log/route.ts` neu angelegt.
Rollen `whistleblowing_officer` und `ombudsperson` (nicht `admin`), org-gefiltert,
mit Paginierung. Der `actor_hash` wird gekürzt ausgeliefert und die Antwort sagt
im `meta`-Block, dass eine Re-Identifikation den Schlüssel und ein dokumentiertes
Vier-Augen-Verfahren braucht.

**Status: geschlossen.**

---

### S07-22 — Low — Rolle `ombudsperson` fehlt im DB-Enum

**Änderung** — keine. WP3s Migration 0410 hat das Rollenmodell auf eine Quelle
der Wahrheit gebracht; `ombudsperson` ist im Enum. Die von ADR-011 rev.2
vorgesehene Zweiteilung des Meldestellen-Zugriffs ist damit herstellbar und wird
in der neuen RLS-Policy (0426) und der neuen Route auch genutzt.

**Status: durch WP3 geschlossen, hier bestätigt und angewandt.**

---

### S07-23 — Low — Beschäftigten-Leistungsdaten dauerhaft im Audit-Trail

**Änderung**:

- `0427`: `academy_quiz_attempt.{answers_json, score_pct, passed,
attempt_number, duration_seconds}`, `academy_enrollment.{progress_pct,
completed_lessons}` und `policy_quiz_response.{selected_option_index,
is_correct}` als entitätsbezogene `drop`-Regeln — eine Art.-17-Redaktion
  erfasst sie jetzt. Bewusst entitätsbezogen: `status`, `score` und `passed` sind
  in anderen Tabellen keine Leistungsdaten.
- `0429`: Retention-Bindungen für `academy_quiz_attempt` und
  `policy_quiz_response` (Vorgabe drei Jahre, § 26 BDSG — Nachweis der
  Unterweisung, danach zweckerfüllt).

**Status: geschlossen.** Die mitbestimmungsrechtliche Bewertung (§ 87 Abs. 1
Nr. 6 BetrVG) bleibt Sache des Betreibers; technisch existieren jetzt Frist und
Löschpfad.

---

### S07-24 — Low — Zugriffs-, Sitzungs- und Signaturprotokolle ohne Löschfrist

**Änderung** — `0429` legt elf Plattform-Vorgaben in `retention_binding` an
(`access_log` 90 Tage, `abac_access_log` 180, `portal_audit_trail` und
`sovereignty_audit_log` 365, `session` 30, `mobile_session` 90,
`portal_session` 180, `data_export_log` 1095, Schulungsergebnisse 1095,
`notification` 365). `apps/worker/src/crons/retention-access-logs.ts` setzt sie
über alle Mandanten durch.

Bewusst **nicht** in dieser Liste: `audit_log` und die Sign-off-Tabellen. Deren
Personenbezug wird durch Redaktion beendet, nicht durch Löschung — das ist der
Zielkonflikt aus S07-28, aufgelöst in
`docs/compliance/gdpr-erasure-vs-immutability.md`.

**Status: geschlossen.** Von WP9 als `retention-access-logs` (02:00 UTC)
eingeplant.

---

### S07-25 — Low — `search_index` hält Volltexte soft-gelöschter Datensätze

**Änderung** — `0431`: alle vier `sync_*_search_index()`-Funktionen entfernen den
Indexeintrag, wenn `deleted_at` gesetzt ist (vorher fiel ein Soft-Delete als
UPDATE in den `ON CONFLICT DO UPDATE`-Zweig und **aktualisierte** den Volltext
beim Löschen). Einmaliger Bereinigungslauf über den Bestand.

**Nachweis** — Test „removes a soft-deleted risk from the search index".

**Status: geschlossen.**

---

### S07-26 — Low — Bezeichner-Injektion im Export-Filter

**Änderung** — keine. WP5 hat `fetchEntityData()` auf eine Allowlist aus
`def.exportColumns` und `sql.identifier()` umgestellt; der Wert geht als Parameter.

**Status: durch WP5 geschlossen, hier bestätigt.**

---

### S07-27 — Info — `data_export_log` ist sauber gehärtet

Unverändert: FORCE-RLS mit Org-Isolation, Append-only per Rule, Indizes. Die
Retention-Löschung (0429) ist der einzige Pfad, auf dem eine Zeile verschwinden
kann, und sie ist an die Frist gebunden und protokolliert.

**Status: bestätigt (Positivbefund).**

---

### S07-28 — Info — Zielkonflikt Art. 17 vs. Unveränderlichkeit begonnen, nicht zu Ende geführt

**Änderung** — Neu: `docs/compliance/gdpr-erasure-vs-immutability.md`. Es
beschreibt die Trennung von Ereignis und Inhalt, die Rolle des
Content-Commitments, das Schlüsselmanagement samt Vernichtung, was ein
Löschantrag konkret auslöst, was ausdrücklich nicht gelöscht wird und warum, und
die vier offenen Punkte. Jede Zusage ist mit dem Test benannt, der sie belegt.

Die sechs technischen Lücken aus der Tabelle des Befundes sind geschlossen
(Tombstone-Key, `entity_title`, Redaktionstiefe, Mengen-Einstiegspunkt,
Sekundärbestände) bzw. als Restrisiko geführt (Legal Hold, Backups).

**Status: geschlossen.**

---

### S07-29 — Info — Selbsteinschätzung „~95 %" nicht getragen

**Änderung** — `docs/compliance/gdpr-readiness-checklist.md` vollständig neu,
auf den Stand **nach** den Fixes. Die Prozentzahl ist ersatzlos entfallen; sie
hat genau das getan, was der Befund ihr vorwirft. Stattdessen: eine Tabelle, die
für jede der acht geprüften Positionen zeigt, was dort behauptet wurde und was
tatsächlich der Fall war, dann der Ist-Stand mit vier Statuswerten (umgesetzt /
teilweise / offen / organisatorisch), eine ausdrückliche Einschränkung zu
Art. 5(1)(e) (die Jobs brauchen einen Scheduler), ein HinSchG-Abschnitt und eine
Liste offener Punkte, die die betriebliche Bedingung an erster Stelle nennt.

**Status: geschlossen.**

---

## 2. Zusammenfassung

| Status                                          | Findings                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Geschlossen mit eigener Änderung                | S07-01, -02, -03, -04, -05, -06, -07, -08, -09, -10, -12, -13, -14, -15, -16, -17, -19, -20, -21, -23, -24, -25, -28, -29 (24) |
| Durch Welle 1/2 geschlossen, hier bestätigt     | S07-11 (WP2), S07-22 (WP3), S07-26 (WP5), S07-27 (Positivbefund) (4)                                                           |
| Dokumentarisch geschlossen, technisch übergeben | S07-18 (an WP6) (1)                                                                                                            |

Kein Finding wurde als Falsch-Positiv verworfen.

## 3. Abnahme

| Prüfung                                            | Ergebnis                                                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Migrationen gegen leere Datenbank                  | 402/402, 603 Tabellen, Exit 0 (inkl. der parallel entstandenen Migrationen von WP6/WP7/WP9)                            |
| `tsc --noEmit` `apps/worker`                       | fehlerfrei                                                                                                             |
| `tsc --noEmit` `apps/web`                          | fehlerfrei (Exit 0)                                                                                                    |
| `packages/db` Integration (8 Dateien)              | 101 grün, 1 Skip                                                                                                       |
| `packages/db` RLS-Systemtest (10 Dateien)          | 79 grün                                                                                                                |
| `packages/db` Unit                                 | 433 grün                                                                                                               |
| `packages/shared`                                  | 1944 grün, 1 vorbestehender Fremdfehler (`xliff.test.ts`)                                                              |
| Neue Integrationstests `gdpr-privacy.test.ts`      | 37 grün                                                                                                                |
| Art.-17-Löschung über alle Schemas + Kettenprüfung | 0 Klartextreste, `audit_chain_verify().healthy = true`                                                                 |
| Wörterbuchangriff auf `ip_hash` / `actor_hash`     | 0 Treffer                                                                                                              |
| Mailbox-Token im Audit-Log                         | 0 Treffer                                                                                                              |
| Retention löscht fristbezogen                      | überfällige Zeile weg, frische bleibt, Nachweis geschrieben                                                            |
| Hinweisgeber-Upload                                | speichert und verifiziert; bei Speicherfehler 502, kein 201                                                            |
| Massenexport ohne Rolle / über Limit               | 403 bzw. 413, Freigabe nur einmal verwendbar (`apps/web/src/__tests__/api/export-bulk-four-eyes.test.ts`, 6 Prüfungen) |
| `apps/web` Vitest                                  | die beiden auto-generierten Smoke-Suiten laufen für alle WP8-Routen grün; drei Fremdfehler, siehe Abschnitt 4          |
| Neue Web-Tests                                     | `export-bulk-four-eyes.test.ts` (6) und `export-audit.test.ts` (8) grün                                                |
| `apps/worker` Vitest                               | 256 grün; drei Fremdfehler in `control-embedding-sync`, `overdue-tasks`, `programme-health-recompute` (nicht WP8)      |

## 4. Bedarf an andere Pakete

### An WP9 (Worker, Cron) — **erledigt, während dieses Paket lief**

1. **Registrierung: erledigt.** WP9 hat parallel `lib/job-registry.ts` und
   `lib/scheduler.ts` gebaut (S10-02) und die beiden neuen Jobs bereits
   aufgenommen: `retention-access-logs` (02:00 UTC) und
   `retention-whistleblowing` (02:40 UTC), versetzt zu
   `document-retention-purge` (01:30) und `retention-monitoring` (01:45).
   Damit ist die betriebliche Bedingung aus S07-07/-12/-24 erfüllt — der
   Restrisiko-Absatz unten ist entsprechend zu lesen.

2. **Alarm** auf einen Fehlschlag dieser vier Jobs. Sie werfen jetzt bewusst,
   statt grün zu melden; ein stiller Fehlschlag ist eine nicht durchgesetzte
   gesetzliche Frist.

3. `apps/worker/src/crons/document-retention-purge.ts` gibt jetzt zusätzlich
   `filesFailed`, `auditEntriesRedacted`, `redactionFailures` und `purgeFailures`
   zurück; ein Dashboard, das die Rückgabe auswertet, sollte die vier Felder
   kennen.

4. **Reihenfolge beachten:** `retention-whistleblowing` löscht Zeilen, die
   `document-retention-purge` nicht mehr sehen darf, und umgekehrt. Die aktuelle
   Staffelung (01:30 / 01:45 / 02:00 / 02:40) trennt sie sauber; falls die Zeiten
   noch einmal bewegt werden, sollten die vier Läufe disjunkt bleiben.

### An WP10 (Betrieb, Deployment)

1. **`PII_PSEUDONYM_KEY` und `WB_PSEUDONYM_KEY` in die Produktionsumgebung
   aufnehmen** und in die Secret-Rotation einbeziehen — analog zu
   `AUDIT_SEAL_KEY`. Ohne sie greift ein Installationsschlüssel _in_ der
   Datenbank: besser als der Ist-Zustand (kein Anwendungsrollenzugriff), aber der
   Schlüssel liegt dann im Dump. Die Variablen sind in
   `docs/env-vars-reference.md` und `.env.example` dokumentiert.
2. **`WB_ENCRYPTION_KEY_PREVIOUS`** in das Rotationsverfahren aufnehmen; ein
   Re-Seal-Skript wie für `SECRET_ENCRYPTION_KEY` fehlt noch.
3. **Backup-Aufbewahrung und Löschkonzept abstimmen.** Eine Art.-17-Löschung
   wirkt erst endgültig, wenn das letzte Backup aus der Zeit vor dem Antrag
   abgelaufen ist. Das gehört in das Löschkonzept des Verantwortlichen, nicht in
   den Code.
4. **Schlüsselvernichtung** (`pii_pseudonym_key_destroy`) ist bewusst nicht an
   `grc_app` gegrantet und über keine API erreichbar. Sie braucht ein
   dokumentiertes betriebliches Verfahren mit Vier-Augen-Prinzip.

### An WP4 (Audit-Trail) — geänderte WP4-Objekte

Zwei Objekte in WP4s Hoheit wurden geändert, beides minimal und additiv:

1. **`audit_log_tombstone_only_guard()`** (Migration 0428): drei Spalten mehr auf
   der Redaktions-Allowlist (`entity_title`, `user_agent`, `session_id` — keine
   davon ist unter v4 eine Hash-Eingabe) und das Tombstone-Tor von „NULL → NOT
   NULL" auf „`pii_tombstoned_at` rückt vor". `hash_version` und
   `content_commitment` bleiben ausgeschlossen (S03-02), `ENABLE ALWAYS` bleibt,
   ein gewöhnliches UPDATE wird weiterhin abgewiesen. Ohne (1) war S07-04 nicht
   behebbar, ohne (2) war eine Löschung für die zweite betroffene Person einer
   Zeile technisch unmöglich.
2. **`packages/db/tests/integration/audit-chain-per-tenant.test.ts`**: die
   Zusicherung „Tombstoning a second time must fail" ist durch den positiven Fall
   plus zwei Guard-Prüfungen ersetzt, mit Begründung im Code.
   `audit-tamper-evidence.test.ts` ist unverändert und grün.
3. **Bitte prüfen:** `audit_log.metadata` ist unter v4 eine direkte
   Hash-Eingabe und damit die einzige PII-tragende Spalte, die eine Redaktion
   nicht anfassen kann. `app.audit_reason` landet dort als Freitext. Die saubere
   Lösung wäre, `metadata` in `audit_content_commitment()` aufzunehmen statt in
   die Zeilenformel — ein v5-Übergang und deshalb WP4s Entscheidung.

### An WP2 (RLS)

1. **`whistleblowing_audit_log` hat jetzt `org_id`** und ist damit erstmals
   seedbar — sie taucht deshalb neu im RLS-Systemtest auf. Ihre Lesepolicy
   verlangt zusätzlich zur Mandantengrenze eine ROLLE
   (`whistleblowing_officer`/`ombudsperson`, ADR-011 rev.2 §82-83), die der Test
   nicht setzt; die eigene Zeile ist für ihn zu Recht unsichtbar. Sie steht
   deshalb in `ROLE_GATED_TABLES` in
   `packages/db/tests/rls/tenant-isolation-systemtest.test.ts` — bitte gegenlesen,
   ob die Ausnahme dort richtig aufgehoben ist oder in `rls-audit.ts` gehört.
   Die Mandantengrenze der Tabelle wird in `gdpr-privacy.test.ts` geprüft.
2. **Neue Tabellen mit RLS**, bitte in die WP2-Bewertung aufnehmen:
   `pii_pseudonym_key` (deny-all, Absicht), `pii_redaction_rule` (read-all,
   write-deny), `retention_binding` und `retention_run_log` (org-scoped read,
   write-deny), `dsr_subject_index` (read-all, write-deny), `export_approval`
   (org-scoped), `gdpr_erasure_log` (org-scoped read, write-deny).
3. **`wb_anonymous_mailbox.token` steht weiterhin im Klartext** in der Datenbank
   (WP3 hat `token_hash` für `dd_session` vorgemacht). Der Token ist seit 0426
   nicht mehr im Audit-Log, aber ein Datenbanklesezugriff genügt weiterhin zur
   Übernahme des Meldekanals. Empfehlung: analog auf `token_hash` umstellen —
   berührt Schema, Resolver (0412) und die Mailbox-Route, also drei Hoheiten.

### An WP6 (AI-Layer)

**S07-18 ist technisch WP6s Sache.** Die Dokumentation ist korrigiert und nennt
Anthropic, OpenAI und Google als mögliche Empfänger. Damit die Zusage „keine
Drittlandsübermittlung" wieder haltbar wird, braucht es aus S05-01/-03/-22:
Anbieterwahl je Mandant statt prozessglobal, `fail-closed` statt stillem
Cloud-Rückfall, Auswertung des vorhandenen `data_residency`-Modells und — für den
Datenschutz besonders wichtig — eine Redaktionsschicht vor dem Versand
(`grep -niln "redact|anonymi[sz]e|scrub|mask" packages/ai/src/` fand nichts).
Sobald das steht, gehört die Zeile in
`docs/compliance/subprocessors-and-third-country-transfers.md` aktualisiert.

**Fremdfehler in den Smoke-Suiten:** `src/__tests__/api/all-mutating-routes-auth-smoke.test.ts`
scheitert an `/api/v1/ai/policy` und `/api/v1/processes/generate-bpmn` mit
`No "AI_EGRESS_MODES"/"ALL_PROVIDERS" export is defined on the "@grc/ai" mock`.
Die beiden Routen lesen die Konstanten auf Modulebene; die Smoke-Suite mockt
`@grc/ai` mit einer Factory ohne sie. WP8 ist derselben Falle bei
`lib/export-audit.ts` begegnet und hat sie dort durch Literale plus einen
Superset-Test aufgelöst (`export-roles-superset`) — dasselbe Muster passt hier.
Auch `tests/crons/control-embedding-sync.test.ts` schlägt fehl.

### An WP7 (DMS)

1. **`apps/web/src/app/api/v1/documents/**` gehört WP7.** Zwei Bedarfe:
   - Der Löschpfad `documents/[id]/erase` sollte nach dem harten Löschen
     `tombstone_audit_entries_for_entity(orgId, 'document', id, 'gdpr_art_17')`
     aufrufen — sonst bleibt die vollständige Kopie der gelöschten Zeile im
     append-only `audit_log` stehen (S07-15 in seiner allgemeinen Form). Die
     Funktion liegt in Migration 0428 bereit.
   - Kein Personenbezug in `audit_log.metadata` — die Spalte ist unter v4 nicht
     redigierbar. `document-retention-purge.ts` ist bereits umgestellt.
2. Der zwischenzeitliche Typecheck-Fehler in
   `apps/web/src/__tests__/api/documents-upload-immutability.test.ts` ist
   während der Welle behoben worden; `tsc --noEmit -p apps/web/tsconfig.json`
   ist zum Abschluss von WP8 fehlerfrei.

### An die Pakete mit ungeloggten Exportrouten (S07-14, verteilt)

19 der 25 Exportrouten schreiben nichts nach `data_export_log`. Der gemeinsame
Helfer steht bereit — `apps/web/src/lib/export-audit.ts`,
`logExportOrThrow({ … })` — und ist in den fünf WP8-Routen eingebaut. Offen sind
u. a. `audit-mgmt/…/checklists/[id]/export`, `compliance/cci/export-pdf`,
`dashboards/[id]/export-pdf`, `eam/bi-export`, `esg/report/[year]/export`,
`export/schedules(+[id])`, `isms/reviews/[id]/export/pdf`, `isms/soa/export`,
`kris/export`, `policies/distributions/[id]/export-pdf`,
`processes/[id]/export/xml`, `processes/[id]/raci/export`,
`processes/[id]/ropa/export`, `processes/ropa-export`,
`rcsa/campaigns/[id]/export-pdf`, `risk-quantification/export`,
`translations/export`. Besonders dringlich: `processes/ropa-export` — ein zweiter,
ungeloggter Pfad auf dasselbe Art.-30-Verzeichnis.

### An WP11 (Testfundament)

1. `packages/db/tests/integration/gdpr-privacy.test.ts` und die
   RLS-/Integrationssuiten laufen nur über
   `npm run test:integration --workspace=@grc/db` mit gesetzter `DATABASE_URL`,
   also nicht in `npm test`. Die Art.-17-Prüfung ist das Abnahmekriterium dieses
   Pakets und sollte in CI verpflichtend laufen (S11-11).
2. `apps/worker/src/crons/document-retention-purge.ts` hat keinen Cron-Test,
   obwohl er der einzige Job ist, der hart löscht.
3. `packages/shared/tests/xliff.test.ts` → „should sanitize target text (XSS
   prevention)" schlägt fehl und ist **nicht** von WP8 verursacht (weder
   `xliff.ts` noch der Test sind im Arbeitsbaum geändert).

### Ungeklärte Dateihoheit — hier geändert, bitte gegenlesen

Diese Pfade sind in `REMEDIATION_PLAN.md` **keinem** Paket zugewiesen; die
Findings gehören WP8, und kein Wellen-3-Partner hält sie:

- `apps/web/src/app/api/v1/processes/[id]/ropa-profile/route.ts` (S07-10)
- `apps/web/src/app/api/v1/portal/report/[orgCode]/route.ts` (S07-02, S07-19.5 —
  zwei kleine Eingriffe: `hashIp(ip, org.id)` und der Startcheck)
- `packages/db/src/schema/whistleblowing.ts`, `.../dpms.ts` (Drizzle-Spalten zu
  den Migrationen 0430/0433 — für die Schema-Drift-Prüfung relevant)
- `packages/shared/src/schemas/import-export.ts` (`approvalId` im
  `bulkExportSchema`)
- `apps/web/src/__tests__/lib/ropa-validation.test.ts` (der Test, der S07-10
  festschrieb)
- `docs/env-vars-reference.md`, `.env.example` (S07-19.4)

## 5. Restrisiko

**Was jetzt gilt.** Ein Löschantrag nach Art. 17 beendet den Personenbezug über
alle registrierten Schemas — Fachdaten anonymisiert, Zugangsdaten vernichtet,
Sitzungen gelöscht, Audit-Trail redigiert — und die Hash-Kette verifiziert danach
weiter. Das ist gemessen, nicht behauptet: 0 Klartextreste,
`audit_chain_verify().healthy = true`. Die drei Schein-Pseudonymisierungen sind
durch HMAC unter einem Schlüssel ersetzt, der nicht neben den Daten liegt, und
die Rückrechnungen des Auditberichts laufen ins Leere. Das Hinweisgeber-Modul ist
technisch vertraulich: keine `wb_*`-Zeile erreicht mehr den org-weiten Log, das
Fachlog ist mandantengetrennt und nur für die Meldestellen-Rollen lesbar.

**Die betriebliche Bedingung.** Die Retention-Jobs sind gebaut, getestet und
belegen jeden Lauf; WP9 hat sie während dieser Welle in den neuen Scheduler
aufgenommen (02:00 und 02:40 UTC). Damit ist Art. 5(1)(e) erstmals nicht nur
konfigurierbar, sondern durchgesetzt — vorausgesetzt, der Scheduler läuft
tatsächlich im Betrieb. Offen bleibt `PII_PSEUDONYM_KEY`: ohne ihn ist die
Pseudonymisierung gegen jede Anwendungsrolle wirksam, gegen einen
Datenbank-Superuser aber nicht.

**Drei technische Restrisiken.** Erstens `audit_log.metadata`: unter v4 direkte
Hash-Eingabe und deshalb nicht redigierbar; ein Freitext-`reason` mit Klartext
überlebt eine Löschung. Zweitens Backups: ein Restore aus der Zeit vor dem Antrag
bringt den Personenbezug zurück, und ARCTOS kennt keinen Wiederanwendungs-
mechanismus — das ist über die Backup-Aufbewahrung zu steuern. Drittens der Legal
Hold: ADR-011 rev.2 führt ihn selbst als zurückgestellt, `legal_hold` existiert
nur auf `document`, und der Vorrang einer Aufbewahrungspflicht ist heute eine
organisatorische Prüfung des DSB vor der Ausführung — der `dryRun` unterstützt
ihn dabei, ersetzt ihn aber nicht.

### Zum Zielkonflikt Art. 17 gegen Unveränderlichkeit — klare Aussage

Der Konflikt ist **auflösbar und hier aufgelöst**, weil im Audit-Trail zwei Dinge
zusammenstehen, die nicht dasselbe sind: das _Ereignis_ (wer wann was getan hat,
an welcher Kettenposition) und der _Inhalt_ (Name, Adresse, Freitext, voller
Zeilenabzug). Die Nachweisfunktion braucht das Ereignis; Art. 17 zielt auf den
Inhalt. WP4s Content-Commitment macht die Trennung technisch möglich — der
Zeilenhash bindet ein Commitment über den Inhalt, nicht den Inhalt selbst —, und
WP8 hat sie zu Ende geführt: die Redaktion erreicht jetzt alle PII-tragenden
Spalten inklusive `entity_title`, arbeitet rekursiv über die gesamte
`changes`-Struktur, ist über einen Mengen-Einstiegspunkt für einen ganzen
Löschantrag aufrufbar, und die Kette verifiziert danach unverändert weiter.

Was dabei entsteht, ist zunächst eine **Pseudonymisierung**, keine Löschung —
nach Art. 4 Nr. 5 DSGVO bleiben pseudonymisierte Daten personenbezogen. Zur
Löschung wird sie erst durch die **Vernichtung des Schlüssels**, und genau
deshalb ist `pii_pseudonym_key_destroy()` der Teil, den ADR-011 rev.2 vorausgesetzt
und niemand gebaut hatte. Wer die Zusage „wir löschen im Audit-Trail" geben will,
muss den Schlüssel ausserhalb der Datenbank halten und ein Verfahren für seine
Vernichtung haben; ohne beides ist die Zusage technisch nicht gedeckt. Das ist die
Aussage, die in einer Due Diligence trägt — und sie ist präziser als das „✅", das
die Checkliste vorher an dieser Stelle führte.
