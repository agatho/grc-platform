# Art. 17 DSGVO gegen unveränderliche Protokolle — wie ARCTOS den Zielkonflikt auflöst

_Stand: 2026-09-01 · Bezug: ADR-011 rev.2/rev.4, Audit ARCTOS-FULL-2026-08-31 (S07-03 bis S07-06, S07-15, S07-28)_

> **Abgrenzung.** Dieses Dokument beschreibt die technische Umsetzung. Es ist keine
> Rechtsberatung und ersetzt keine datenschutzrechtliche Würdigung durch einen
> Rechtsbeistand oder die zuständige Aufsichtsbehörde. Ob im Einzelfall eine
> Aufbewahrungspflicht (§ 147 AO, § 257 HGB), ein Rechtsstreit oder ein Legal Hold
> der Löschung vorgeht, entscheidet die verantwortliche Stelle.

## 1. Warum es diesen Konflikt gibt

Ein GRC-Produkt lebt davon, dass sein Protokoll nicht nachträglich veränderbar ist.
ARCTOS setzt das durch: `audit_log` ist append-only (Regeln gegen `DELETE`, Guard
gegen `UPDATE`, `TRUNCATE`-Sperre), jede Zeile hängt kryptografisch an ihrer
Vorgängerin, und die Kettenspitzen werden extern verankert und HMAC-gesiegelt.

Art. 17 DSGVO verlangt vom selben System die unverzügliche Löschung
personenbezogener Daten. Beides gleichzeitig geht nicht — es sei denn, man trennt
zwei Dinge, die im Audit-Trail meist zusammen stehen:

- **Das Ereignis** — wer wann welche Aktion auf welchem Objekt ausgeführt hat, und
  an welcher Stelle der Kette das steht. Das ist die Nachweisfunktion.
- **Der Inhalt** — Name, E-Mail-Adresse, IP-Adresse, Freitext, der vollständige
  Zeilenabzug im `changes`-Feld. Das ist der Personenbezug.

Die Kette darf das Ereignis nicht verlieren. Der Inhalt darf gehen.

## 2. Wie die Trennung technisch aussieht

Seit Migration 0400 (WP4) bindet die Hashformel v4 nicht mehr den Inhalt direkt
ein, sondern ein **Content-Commitment**:

```
content_commitment = SHA-256( changes | user_email | user_name | ip_address | entity_title )
entry_hash         = SHA-256( previous_hash | id | org_id | user_id | entity_type |
                              entity_id | action | content_commitment | action_detail |
                              metadata | created_at | scope )
```

Eine Redaktion überschreibt die fünf Inhaltsspalten und **lässt
`content_commitment` unangetastet**. Der `entry_hash` rechnet damit weiterhin
auf, die Kette bleibt geschlossen, und die Verifikation meldet die Zeile als
`ok`. Was verloren geht, ist die Möglichkeit, das Commitment gegen den Inhalt zu
prüfen — genau das ist der Preis der Löschung, und er ist an der Spalte
`pii_tombstoned_at` sichtbar.

Für Zeilen, die vor v4 geschrieben wurden, ging der Inhalt direkt in den Hash ein.
Dort kann die Redaktion nicht hashneutral sein. Diese Zeilen werden als
`redacted_legacy` geführt, und die Redaktion selbst ist ein eigener, verketteter
Audit-Eintrag (`entity_type = 'audit_log'`, `action_detail = 'pii_tombstone'`) —
eine tombstonete v1–v3-Zeile **ohne** diesen Nachweis meldet die Verifikation als
Manipulation, nicht als Löschung.

## 3. Der Schlüssel, ohne den es keine Löschung wäre

ADR-011 rev.2 §103 formulierte die Voraussetzung:

> „Re-Identifikation der Person aus dem Hash ist nicht möglich, **wenn der
> Tombstone-Key nach Ablauf vernichtet wird**"

Diesen Schlüssel gab es bis zur Remediation nicht. Gebildet wurde
`SHA-256(PII | entry_hash)` — und `entry_hash` steht als Spalte derselben Zeile
daneben. Der Auditor hat daraus mit einer Kandidatenliste (dem Inhalt der
`user`-Tabelle) Name und E-Mail-Adresse in Sekunden zurückgerechnet. Nach Art. 4
Nr. 5 DSGVO war das eine Pseudonymisierung, keine Löschung.

Seit Migration 0425 gilt:

|                             |                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Verfahren                   | HMAC-SHA256 mit Domänentrennung je Einsatzzweck                                                                     |
| Schlüsselquelle (bevorzugt) | `PII_PSEUDONYM_KEY` aus der Prozessumgebung — liegt dann **nicht** in der Datenbank und **nicht** im Datenbank-Dump |
| Schlüsselquelle (Rückfall)  | Installationsschlüssel in `pii_pseudonym_key`; deny-all RLS, keine Grants, für keine Anwendungsrolle lesbar         |
| Sichtbarkeit                | `key_id` an jedem Pseudonym (`env:…` / `db-local` / `destroyed`)                                                    |
| Vernichtung                 | `pii_pseudonym_key_destroy(key_id, reason)` — überschreibt das Material unwiderruflich                              |

**Erst die Schlüsselvernichtung macht aus der Pseudonymisierung eine Löschung.**
Sie ist bewusst nicht über eine API erreichbar: sie betrifft alle Pseudonyme der
Installation gleichzeitig und ist ein betrieblicher Vorgang mit Vier-Augen-Prinzip,
kein Klick im DSB-Arbeitsvorrat.

## 4. Was ein Löschantrag konkret auslöst

`POST /api/v1/dpms/dsr/:id/erase` (Rollen `admin`, `dpo`; Identitätsprüfung nach
Art. 12 Abs. 6 vorausgesetzt) ruft `gdpr_erase_subject()` auf:

| Schritt | Wirkung                                                                               | Umsetzung                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Kontaktangaben in allen registrierten Tabellen werden durch einen Platzhalter ersetzt | `dsr_subject_index` (aus dem Datenbankkatalog erzeugt, Migration 0430)                                                                 |
| 2       | Authentifikatoren der Person werden vernichtet, das Konto deaktiviert                 | `user.password_hash` überschrieben, `ical_token`/`avatar_url` geleert                                                                  |
| 3       | Sitzungen und Geräte werden hart gelöscht                                             | `session`, `mobile_session`                                                                                                            |
| 4       | Audit-Trail wird redigiert, nicht gelöscht                                            | `tombstone_audit_entries_for_subject()` (Migration 0428)                                                                               |
| 5       | Nachweis wird geschrieben                                                             | `gdpr_erasure_log` — die E-Mail-Adresse steht dort nur als HMAC, damit der Löschnachweis nicht die letzte Kopie des Personenbezugs ist |

Der Vorlauf `dryRun: true` ist der Regelfall: der DSB sieht, welche Tabellen mit
wie vielen Zeilen betroffen wären, bevor etwas unumkehrbar wird. Die echte
Ausführung verlangt zusätzlich `confirm: true`.

## 5. Was ausdrücklich NICHT gelöscht wird — und warum

**Hinweisgeberdaten (`wb_*`).** Sie folgen der Frist aus § 11 Abs. 5 HinSchG
(drei Jahre nach Abschluss des Verfahrens, durchgesetzt vom Cron
`retention-whistleblowing`), nicht dem Löschantrag einer beliebigen Person. Eine
Auskunft nach Art. 15 oder eine Löschung nach Art. 17 darf nicht das Werkzeug
werden, mit dem eine beschuldigte Person die Identität der hinweisgebenden Person
ermittelt oder Beweismittel beseitigt — Art. 15 Abs. 4 DSGVO (Rechte anderer
Personen) und §§ 8, 9 HinSchG. Anträge im Zusammenhang mit einem Meldeverfahren
laufen ausschliesslich über die Meldestelle.

**Das Ereignis selbst.** Zeile, Zeitpunkt, Aktion, Entitätstyp und Kettenposition
bleiben. Ein Audit-Trail, aus dem Einträge verschwinden können, ist kein
Audit-Trail; Art. 17 Abs. 3 lit. b/e erkennt Aufbewahrungs- und Nachweiszwecke
ausdrücklich als Ausnahme an.

**`audit_log.metadata`.** Diese Spalte ist unter v4 eine **direkte** Eingabe der
Hashformel — sie zu redigieren würde die Kette brechen. Konsequenz für die
Umsetzung: in `metadata` gehört kein Personenbezug. Der Retention-Purge für
Dokumente schreibt die Dateipfade deshalb seit dieser Remediation nach `changes`
statt nach `metadata`; in `metadata` bleiben Zählwerte. Ein Restrisiko bleibt für
den freien `reason`-Text, den `app.audit_reason` in `metadata` ablegt — das ist in
Abschnitt 7 als offener Punkt geführt.

## 6. Der zweite Löschantrag auf dieselbe Zeile

Ein Audit-Eintrag kann mehrere Personen betreffen. Vor der Remediation warf
`tombstone_audit_entry()` bei einer bereits redigierten Zeile eine Ausnahme, und
der Guard liess Änderungen nur beim Übergang `pii_tombstoned_at NULL → NOT NULL`
zu: für die zweite Person war die Löschung technisch unmöglich.

Der Guard prüft jetzt, ob `pii_tombstoned_at` **vorrückt**. Die Invariante bleibt
dieselbe — diese Spalten ändern sich ausschliesslich im Zuge einer
protokollierten Redaktion, ein gewöhnliches `UPDATE` wird weiterhin abgewiesen —,
aber eine spätere, weitere Redaktion ist möglich. `hash_version` und
`content_commitment` bleiben ausgeschlossen (S03-02).

## 7. Was offen bleibt

1. **`metadata`-Freitext.** `app.audit_reason` landet unverändert in
   `audit_log.metadata` und ist unter v4 nicht redigierbar, ohne die Kette zu
   brechen. Solange Bedienende dort Klartext eintragen, überlebt er eine Löschung.
   Die saubere Lösung wäre, `metadata` in das Content-Commitment aufzunehmen statt
   in den Zeilenhash; das ist eine Änderung an WP4s Hashformel und damit ein
   v5-Übergang.
2. **Backups.** Ein Restore aus einem Backup, das vor der Löschung entstanden ist,
   bringt den Personenbezug zurück. ARCTOS kennt dafür heute keinen
   Wiederanwendungsmechanismus. Betrieblich ist das über die Backup-Aufbewahrung
   zu steuern (Löschung wirkt endgültig, sobald das letzte Backup aus der Zeit vor
   dem Antrag abgelaufen ist) und im Löschkonzept des Verantwortlichen zu
   dokumentieren.
3. **Objektspeicher.** Dateien werden von den Retention-Jobs mit gelöscht; für
   Löschanträge, die einzelne Dokumente betreffen, führt der Weg über das
   DMS-Modul.
4. **Legal Hold.** ADR-011 rev.2 führt „R5 Legal Hold Integration" selbst als
   zurückgestellt. `legal_hold` existiert nur auf `document`; eine
   Sperrwirkung gegen `gdpr_erase_subject()` gibt es nicht. Bis dahin ist der
   Vorrang einer Aufbewahrungspflicht eine organisatorische Kontrolle: der DSB
   prüft sie vor der Ausführung, der `dryRun` unterstützt ihn dabei.

## 8. Belege

| Zusage                                 | Prüfbar über                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Löschung wirkt über alle Schemas       | `packages/db/tests/integration/gdpr-privacy.test.ts` → „erases the subject across all schemas and keeps the chain healthy" |
| Kette verifiziert nach der Löschung    | derselbe Test; `audit_chain_verify('org:<id>')` → `healthy: true`                                                          |
| Tombstone-Hash ist nicht rückrechenbar | „the tombstone hash is not sha256(value \|\| '\|' \|\| entry_hash)"                                                        |
| `entity_title` wird redigiert          | „redacts entity_title, which was previously unreachable by design"                                                         |
| Guard-Invariante hält weiter           | „a plain UPDATE is still refused" / „hash_version and content_commitment stay out of the allowlist"                        |
| Löschnachweis ohne PII-Kopie           | „leaves an accountability record that is not itself a PII copy"                                                            |
