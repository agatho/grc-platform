# ADR-011 rev.4 — Tamper-Evidence des Audit-Trails (Hash-Kette, gesiegelte Anker, Verifikation)

| **ADR-ID**     | **011**                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------- |
| **Title**      | **Audit Trail Architecture — rev.4 (Content-Commitment, gesiegelte Anker, echte Verifikation)**     |
| **Status**     | **Accepted**                                                                                       |
| **Date**       | 2026-09-01 (rev.4) · 2026-04-20 (rev.3)                                                             |
| **Supersedes** | rev.3 (erweitert rev.2)                                                                            |
| **Context**    | GDPR Art. 5 + Art. 17, ISO 27001 A.12.4, DORA Art. 28, eIDAS, HinSchG §8, Audit ARCTOS-FULL-2026-08-31 (Stream S03) |

> **Dateiname:** die Datei heißt weiterhin `ADR-011-rev3.md`, weil sie aus
> Code, Tests und bereits ausgelieferten Archiv-READMEs verlinkt ist.
> Inhaltlich ist dies rev.4.

## Kontext

Rev.2 etablierte die per-Tenant-SHA-256-Hash-Kette: innerhalb der Kette
ist nichts unbemerkt manipulierbar. Rev.3 ergänzte externe Anker gegen das
verbleibende Problem — ein Betreiber-Admin mit DB-Schreibrecht kann die
gesamte Kette rückwirkend neu berechnen.

**Rev.3 hat dieses Versprechen nicht eingelöst.** Der Audit
ARCTOS-FULL-2026-08-31 (Stream S03: 20 Findings, davon 2 Critical) hat den
Angriff, gegen den rev.3 schützen sollte, auf einem Klon der
Produktionsdatenbank vollständig reproduziert. Rev.4 beschreibt, was
vorher galt und was jetzt gilt — weil eine Architekturdokumentation, die
eine nicht vorhandene Kontrolle behauptet, in einem Compliance-Produkt
selbst ein Compliance-Mangel ist.

### Zusage in rev.3 gegen Messung

| Zusage | Befund |
|---|---|
| „Was wir nach diesem Zeitpunkt schreiben, können wir nicht mehr rückwirkend umschreiben, ohne dass ein externer Zeuge widerspricht." | Der Zeuge lag in derselben Datenbank. `audit_anchor` hatte keine Append-only-Regel, keinen Guard, kein RLS; der Produktivcode überschrieb die Tabelle selbst per `onConflictDoUpdate`. `UPDATE audit_anchor SET merkle_root = repeat('0',64)` war Teil des reproduzierten Angriffs. |
| „Platform-Vendor verliert ab Anchor-Zeitpunkt die Möglichkeit, Audit-Events rückwirkend zu manipulieren." | Ein einziges vom Guard **erlaubtes** UPDATE (`changes` + `hash_version = 0`) machte beliebige Inhaltsfälschung unsichtbar, **ohne** die Kette anzufassen: `entry_hash` blieb unverändert, die Merkle-Wurzel damit bit-identisch (`06985925db83…` vor und nach der Fälschung), der bereits erteilte FreeTSA-Zeitstempel bestätigte die manipulierte Kette weiterhin, `/integrity` meldete `healthy: true`. |
| „Läuft 00:05 UTC" (D3) | Es gab keinen Scheduler. Der Worker ist ein HTTP-Listener; im Repository existierte kein Cron-Eintrag, kein systemd-Timer, kein k8s-CronJob für diesen Job. Der externe Anker — die Grundlage der Revision — lief in der ausgelieferten Konfiguration nie. |
| Ankerschranke `#WAVE10-CRITICAL-01` | Sie hatte Zweige für `hash_version` 1 und 2 und einen `ELSE entry_hash`-Fallback, aber keinen für v3, also für 100 % der Live-Zeilen: sie verglich jeden gespeicherten Hash mit sich selbst und meldete konstant 0 Brüche. Der Nightly-Cron hatte überhaupt keine Schranke. |
| Verifikationspfad D6 | Die Anleitung nannte die v1-Formel für v3-Daten (0 von 142 Zeilen trafen), dem Export fehlten vier Hash-Eingaben, und die angegebene Ordnung `(created_at, id)` erzeugte 23 vorgetäuschte Kettenbrüche in 142 Zeilen. Das mitgelieferte Python prüfte nur Merkle-über-gespeicherte-Hashes und meldete für den Inhaltsangriff wörtlich „All anchors matched". |
| TSA-Antwort als Beweis | Sie wurde nie geprüft: kein Nonce-Abgleich, kein `messageImprint`-Vergleich, keine Signatur-, keine Zertifikatsprüfung. Akzeptanzkriterium war HTTP 200 plus `PKIStatus = 0`. `verified_at` existierte als Spalte, die kein Codepfad je schrieb. |
| „Downloadable-Archive-Export … Phase 2", „OTS-Upgrade-Job … Phase 2" | Beides war längst implementiert; die Roadmap unterschätzte den Stand. |

Die ehrliche Zusammenfassung des Zustands vor rev.4: **die Kette war eine
Integritätsprüfung gegen versehentliche Korruption, keine Tamper-Evidence
gegen einen privilegierten Akteur.**

## Entscheidung

### D1. Hash-Formel v4: Commitment statt Nutzdaten (Migration 0400)

v1–v3 hashten die Nutzdaten direkt und ließen vier Spalten ganz außen vor:
`user_email`, `user_name`, `ip_address`, `entity_title` — genau die
Felder, die UI und Export als „Akteur" anzeigen, und drei davon standen
zugleich auf der UPDATE-Allowlist. Eine Handlung war einem anderen
Menschen zuschreibbar, ohne dass irgendeine Prüfung anschlug.

```
content_commitment = SHA256( changes | user_email | user_name |
                             ip_address | entity_title )

entry_hash = SHA256( previous_hash | id | org_id | user_id |
                     entity_type | entity_id | action |
                     content_commitment | action_detail | metadata |
                     created_at_utc | previous_hash_scope )
```

Drei Wirkungen aus einer Konstruktion:

* Die Akteursfelder sind kryptografisch gebunden; `id` ebenfalls, sodass
  Zeilen nicht mehr umgehängt werden können.
* Der Verifizierer prüft zusätzlich, ob sich das Commitment aus den
  aktuellen Spaltenwerten reproduzieren lässt. Wer `changes` ändert, muss
  das Commitment ändern; das ändert `entry_hash`; das ändert die
  verankerte Merkle-Wurzel — die außerhalb dieses Systems signiert ist.
* Eine DSGVO-Redaktion darf die Nutzdaten überschreiben und das Commitment
  erhalten; die Zeile rechnet weiterhin nach (D5).

**Bestandszeilen werden nicht neu gehasht.** Ein Rehash berechnet die
Hashes aus dem *aktuellen* Inhalt und macht damit jede vorangegangene
Fälschung endgültig — genau das empfahl der `remedy`-Text des alten
`/integrity`-Endpunkts, und genau das hätte jede bereits erteilte
Merkle-Wurzel entwertet. v1–v3-Zeilen verifizieren weiter unter ihrer
eigenen Formel; der Wechsel ist als Migrations-Anker in der Kette selbst
protokolliert.

`hash_version = 0` ist kein „Migration ausstehend" mehr, sondern ein
Befund: für v0 existiert keine Formel, die Zeile ist von niemandem
prüfbar, `healthy` ist `false`.

### D2. Die Kette vergibt die Tabelle, nicht der Aufrufer (Migration 0401)

Bis rev.3 berechnete `audit_trigger()` die Hashes und schrieb dann die
Zeile. Sechs Produktivpfade — darunter DSGVO-Löschung,
Retention-Hard-Delete und Controlled-Copy-Download — schrieben per
`INSERT` an ihm vorbei und landeten mit `entry_hash = NULL` und
`previous_hash_scope = NULL` in der Tabelle: außerhalb jeder Prüfung und
jedes Ankers. `/integrity` wies sie als historischen Altbestand aus,
während laufender Produktivcode sie erzeugte.

Die Kettenlogik liegt jetzt in einem `BEFORE INSERT`-Trigger auf
`audit_log`. Jeder Insert — Trigger, Anwendungs-SQL, Migration, `psql` —
wird skopiert, von Geheimnissen bereinigt, committet und gehasht. Vom
Aufrufer gelieferte Kettenwerte werden **verworfen**, nicht übernommen:
ein gefälschter Scope hätte eine Zeile in die Kette eines anderen
Mandanten gelegt.

Alle Guards sind `ENABLE ALWAYS`. `SET session_replication_role =
'replica'` — der Bypass, mit dem der Audit die Kette komplett neu
berechnet hat, und ein Muster, das das Projekt in seinen eigenen Tests
verwendet — schaltet sie nicht mehr ab. `TRUNCATE` wird auf allen
Log-Tabellen abgewiesen. Ein `DELETE` bleibt ein No-Op, wird aber in
`audit_log_write_attempt` protokolliert statt wie bisher als „DELETE 0",
also als Erfolg, zurückgemeldet.

### D3. Gesiegelte Anker (Migration 0403)

`audit_anchor` ist für seine Beweisfelder append-only: `merkle_root` und
`leaf_count` eines abgeschlossenen Ankers sind unveränderlich; nur der
dokumentierte OpenTimestamps-Upgrade-Pfad und der Retry eines
**fehlgeschlagenen** Versuchs dürfen schreiben.

Zusätzlich existiert ein zweites Register, `audit_anchor_seal`:

* eigene Rolle `grc_audit_seal` als Eigentümer, `REVOKE` gegen `grc_app`
  und `PUBLIC`, `FORCE ROW LEVEL SECURITY` mit einer Deny-all-Policy, die
  sich nur innerhalb der `SECURITY DEFINER`-Siegelfunktionen öffnet;
* jedes Siegel verkettet auf das vorherige (`prev_seal_hash`), mit
  `UNIQUE NULLS NOT DISTINCT (prev_seal_hash)`: eine Zeile
  herauszuschneiden oder nachträglich einzufügen bricht die Kette;
* jedes Siegel trägt einen **HMAC unter einem Schlüssel, der nicht in der
  Datenbank liegt** (`AUDIT_SEAL_KEY` aus der Anwendungsumgebung, per
  Session-GUC übergeben).

`audit_anchor_verify()` ist die Prüfung, die es vorher nicht gab. Sie
meldet `anchor_digest_mismatch` (Anker überschrieben), `seal_missing`,
`anchor_missing`, `seal_chain_broken`, `seal_hash_invalid`,
`seal_hmac_invalid` und `seal_unsigned`.

### D4. Eine Verifikation, vier Aufrufer (Migration 0404)

Die Prüflogik existierte viermal: im `/integrity`-Endpunkt, in der
Ankerschranke, im DR-Drill-Skript — und im Nightly-Cron gar nicht. Sie
sind auseinandergelaufen, mit dem oben beschriebenen Ergebnis. **Das
Kopieren war der Defekt.** Es gibt jetzt genau eine Implementierung,
`audit_chain_check()` in der Datenbank; `/integrity`, die manuelle
Ankerroute, der Nightly-Anker-Cron und der Verifikations-Cron rufen sie
alle auf. Eine unbekannte Hash-Version ist ein Fehler, kein
stillschweigend passierender `ELSE`.

### D5. DSGVO Art. 17 gegen Unveränderlichkeit

Der Zielkonflikt war nicht gelöst, sondern verdeckt:
`tombstone_audit_entry()` schreibt `changes` um, und `changes` war
Hash-Eingabe. Nach dem **ersten** echten Löschantrag lieferte
`/integrity` dauerhaft 503. Code, ADR und Integrationstest behaupteten das
Gegenteil; der Test prüfte nur `expect(after.entry_hash).toBe(originalHash)`
— Hash-*Gleichheit*, nie *Verifizierbarkeit*.

Rev.4 löst ihn:

* **v4-Zeilen**: die Redaktion überschreibt die Nutzdaten und erhält das
  Commitment. Die Zeile rechnet weiterhin nach, die Kette bleibt intakt,
  die personenbezogenen Daten sind weg.
* **v1–v3-Zeilen**: nicht rückwirkend reparierbar, ihre Nutzdaten waren
  direkte Hash-Eingabe. Für sie wird die Redaktion als **eigenes,
  gehashtes, verankerbares Kettenglied** geschrieben (`entity_type =
  'audit_log'`, `action_detail = 'pii_tombstone'`: wer, wann, warum). Der
  Verifizierer meldet sie als `redacted_legacy` — kein Bruch. Eine
  tombstonierte Zeile **ohne** dieses Ereignis ist ein Befund: so sieht
  eine als Löschung getarnte Manipulation aus.

Die Guard-Allowlist erlaubt die Redaktionsspalten ausschließlich auf dem
Übergang `pii_tombstoned_at NULL → NOT NULL`, also beim ersten und
einzigen Tombstone der Zeile. `hash_version` und `content_commitment`
stehen nicht darauf und werden nie darauf stehen.

### D6. Merkle-Konstruktion v2 (RFC 6962)

v1 folgte der Bitcoin-Konvention (ungerade Ebene: letztes Element mit sich
selbst paaren) ohne Domain-Separation. Damit erzeugen `[a,b,c]` und
`[a,b,c,c]` dieselbe Wurzel (CVE-2012-2459-Klasse), und ein innerer Knoten
ist formal als Blatt präsentierbar. Die verankerte Wurzel legte die
abgedeckte Menge also nicht eindeutig fest; einziges
Unterscheidungsmerkmal war `audit_anchor.leaf_count` — in derselben,
ungeschützten Tabelle.

```
v2:  leaf = SHA256(0x00 || entry_hash)
     node = SHA256(0x01 || left || right)
     ungerade Ebene: letzter Knoten wird unverändert hochgereicht
     root = SHA256(0x02 || uint64_be(leaf_count) || tree_root)
```

Die Blattzahl ist damit in der Wurzel gebunden. Alte Anker bleiben
verifizierbar; `audit_anchor.merkle_version` sagt, welche Konstruktion
eine gegebene Wurzel erzeugt hat.

**Blattreihenfolge ist `chain_seq`**, nicht `(created_at, id)`. Der
Trigger stempelt `now()`, also für alle Zeilen einer Transaktion denselben
Wert; der Tiebreak über eine Zufalls-UUID sortierte 23 von 142 Zeilen an
eine andere Position. Trigger, Verifizierer, Ankerbau und Archiv-Export
verwenden jetzt dieselbe Ordnung.

### D7. TSA-Antworten werden geprüft

`packages/shared/src/lib/freetsa.ts` validiert, bevor es etwas
zurückgibt, das der Aufrufer als Beweis ablegt, und wirft sonst:

1. `PKIStatus` muss 0 sein; `grantedWithMods` wird abgelehnt.
2. Der `messageImprint` muss SHA-256 sein und byteweise der eingereichten
   Wurzel entsprechen.
3. Der Nonce der Antwort muss dem gesendeten entsprechen (RFC 3161 §2.4.2
   — der einzige Replay-Schutz des Protokolls; er wurde vorher erzeugt,
   zurückgegeben und von keinem Aufrufer gepinnt).
4. Die CMS-Signatur muss verifizieren: `message-digest`-Attribut gegen
   SHA-256 über den `eContent`, Signatur über die DER-`SET OF`
   `signedAttrs` unter dem öffentlichen Schlüssel des Signaturzertifikats.
5. `genTime` muss im Gültigkeitszeitraum des Zertifikats liegen und darf
   nicht in der Zukunft liegen.
6. Ist ein Vertrauensanker konfiguriert (`FREETSA_CA_PEM`), muss das
   Zertifikat von ihm ausgestellt sein. Ohne Anker ist das Ergebnis
   `chainVerified: false` — nicht stillschweigend „verifiziert".

`audit_anchor.tsa_verified` unterscheidet „gespeichert" von „geprüft".
`verified_at` wird vom periodischen Re-Verifikationsjob geschrieben.

### D8. Automatische Verifikation in Produktion

Vorher prüfte nichts in Produktion die Kette. Der einzige wiederkehrende
Check, `scripts/dr-restore-drill.sh`, berechnete **keinen einzigen Hash
neu**, nahm nur die 1000 jüngsten Zeilen und tolerierte bis zu zehn
Kettenbrüche als „bekanntes Migrationsartefakt" — ein ausdrückliches
Manipulationsbudget von zehn Zeilen, im direkten Widerspruch zu ADR-026.

`apps/worker/src/crons/audit-chain-verify.ts` läuft über die
**vollständige** Kette jedes Mandanten, rechnet jede Zeile nach, prüft
jeden Anker gegen sein Siegel, re-verifiziert gespeicherte
RFC-3161-Beweise, schreibt das Ergebnis nach `audit_chain_verification`
und meldet `healthy: false` mit benannter Ursache. Keine Stichprobe, keine
Toleranzschwelle.

Zum „bekannten Artefakt": es war keins. Migration `0328` verkettete in
`(created_at, id)`-Reihenfolge neu, während `0313` und der Verifizierer
`chain_seq` verwenden — auf einer aus den Migrationen erzeugten Datenbank
messbar 21 von 146 Zeilen. Migration `0402` repariert das
**hashwahrend**: sie nummeriert `chain_seq` entlang der vorhandenen
`previous_hash`-Verkettung um und rechnet keinen einzigen Hash neu, sodass
jede bereits erteilte Merkle-Wurzel gültig bleibt.

### D9. Kein Fork, unabhängig vom Isolationslevel (Migration 0402)

Der Advisory-Lock aus 0343 serialisiert Schreiber, refresht aber nicht
deren Snapshot: unter `repeatable read` liest der entsperrte Schreiber
weiterhin das alte Kettenende und forkt die Kette (vom Audit
reproduziert). Der Kommentar in 0284 („parallel inserts within one tenant
are strictly serialised") behauptete eine Eigenschaft, die der Lock nicht
liefert.

Die Sign-off-Ketten lösen dasselbe Problem seit 0341 korrekt und auf der
richtigen Ebene: `UNIQUE NULLS NOT DISTINCT` auf (Parent,
`previous_chain_hash`). Eine Constraint wird gegen den *committeten*
Zustand geprüft, nicht gegen den Transaktions-Snapshot, und hält deshalb
auf jedem Isolationslevel. `audit_log` verwendet jetzt dieselbe
Konstruktion (`audit_log_scope_prev_uniq`); der Advisory-Lock bleibt als
Optimierung erhalten, damit der Normalfall nicht in eine Constraint läuft.

### D10. Offline-Verifikationspfad

Der Archiv-Export (`GET /api/v1/audit-log/archive`) enthält jetzt jedes
Feld, das in den Digest eingeht: `chainSeq`, `hashVersion`,
`actionDetail`, `metadata`, `contentCommitment`, `piiTombstonedAt`.
`changes` und `metadata` werden als **exakte PostgreSQL-`jsonb::text`-
Darstellung** exportiert — ein JSON-Round-Trip durch eine andere
Bibliothek ordnet Schlüssel um und verändert die gehashten Bytes.

`verify/verify_archive.py` (weiterhin auch als `rebuild_merkle.py`
ausgeliefert) prüft in drei Stufen und in dieser Reihenfolge:

1. **Zeile** — jeden `entry_hash` aus dem Zeileninhalt neu berechnen,
   inklusive Commitment gegen die Nutzdaten.
2. **Kette** — `previous_hash` gegen die Vorgängerzeile in
   `chain_seq`-Reihenfolge.
3. **Anker** — Merkle-Wurzel des Tages rekonstruieren und mit der
   signierten vergleichen.

Die Reihenfolge ist nicht kosmetisch: Stufe 3 allein — das, was das alte
`rebuild_merkle.py` tat — beweist nichts über den Inhalt der Zeilen.

### D11. Die Grenze, ausdrücklich

**Ein PostgreSQL-Superuser kann jeden Trigger und jede Tabelle löschen.
Nichts innerhalb einer Datenbank ist gegen den Eigentümer dieser Datenbank
manipulationssicher** — und der Worker läuft laut
`docker-compose.production.yml` bewusst als Superuser `grc`.

Was rev.4 ändert, ist der Unterschied zwischen *tamper-proof* und
*tamper-evident*: eine Manipulation scheitert, oder sie hinterlässt eine
Lücke, die benannt wird.

| Angriff | vor rev.4 | nach rev.4 |
|---|---|---|
| `changes` ändern | erkannt | erkannt |
| `changes` + `hash_version = 0` | **nicht erkannt**, `healthy: true`, Merkle-Wurzel identisch | UPDATE abgewiesen; per Superuser erzwungen → `unverifiable_version`, `healthy: false` |
| `user_email` / `user_name` / `ip_address` ändern | **nicht erkannt**, gar nicht gehasht | UPDATE abgewiesen; erzwungen → `commitment_mismatch` |
| Kette neu berechnen unter `session_replication_role='replica'` | **nicht erkannt** | Guards feuern trotzdem (`ENABLE ALWAYS`); per Superuser erzwungen → `commitment_mismatch` |
| `audit_anchor` überschreiben | **nicht erkannt** | UPDATE abgewiesen; erzwungen → `anchor_digest_mismatch` gegen das Siegel |
| Siegel mitfälschen | – | erfordert den HMAC-Schlüssel, der nicht in der Datenbank liegt |
| `TRUNCATE audit_log` | **nicht erkannt**, gesamter Trail weg | abgewiesen, auch unter `replica` |
| Alles löschen inkl. Siegelregister, als Superuser | **nicht erkannt** | erkennbar **nur** gegen eine außerhalb gehaltene Kopie |

Die letzte Zeile ist die verbleibende Restlücke, und sie ist
konstruktionsbedingt. Deshalb ist der Archiv-Export keine Bequemlichkeit,
sondern die einzige Kontrolle, die ein kompromittiertes System überlebt —
und die einzige, die der Anbieter nicht für den Kunden ausführen kann. Sie
gehört als Pflicht ins Kundenrunbook, nicht als Angebot in die
Feature-Liste. Der ausgelieferte Archiv-README sagt das inzwischen
wörtlich, unter „What this archive does not prove".

## Betriebsanforderungen

Ohne diese vier Punkte ist rev.4 unvollständig:

1. **`AUDIT_SEAL_KEY`** in der Anwendungsumgebung setzen, außerhalb der
   Datenbank verwahren, rotierbar über `AUDIT_SEAL_KEY_ID`. Ohne ihn sind
   Siegel verkettet, aber nicht signiert; `/integrity` meldet das als
   `anchor_unsealed`.
2. **`FREETSA_CA_PEM`** setzen, damit die Zertifikatskette geprüft wird
   und nicht nur die Signatur.
3. **Scheduler** für `POST /crons/daily-audit-anchor` und
   `POST /crons/audit-chain-verify`. Der Worker bringt keinen mit; ohne
   externen Scheduler läuft weder Anker noch Verifikation. Empfehlung:
   Anker täglich 00:05 UTC, Verifikation täglich 02:00 UTC.
4. **Alarm auf `healthy === false`** aus dem Verifikations-Cron und auf
   Zeilen in `audit_log_write_attempt`. Ein Befund, den niemand liest, ist
   kein Befund.

**Verhaltensänderung:** `POST /crons/daily-audit-anchor {"date": "…"}`
verankert jetzt **den angegebenen Tag**. Vorher verankerte er den Tag
davor — der HTTP-Handler baute ein Datum, von dem der Job dann einen Tag
abzog —, im Widerspruch zum Kommentar im Code.

## Bewertete Alternativen

| Option | Vorteile | Nachteile | Wahl |
|---|---|---|---|
| **FreeTSA + OpenTimestamps dual, gesiegelt (rev.4)** | Redundanz, Bitcoin-trustless + Sekunden-Latenz, 0 €, Anker gegen Überschreiben gesichert | zwei Integrationen, HMAC-Schlüssel muss verwaltet werden | ✅ |
| Anker in derselben DB ohne Siegel (rev.3) | einfach | der „externe Zeuge" ist überschreibbar — der reproduzierte Angriff | ❌ (Ist-Zustand vor rev.4) |
| Nur FreeTSA | einfacher, sofort verifizierbar | Single Server → Single Point of Failure | — |
| Nur OpenTimestamps | trustless via Bitcoin | 1–2 h Latenz bis zum vollen Proof | — |
| Bestandszeilen auf v4 rehashen | eine einzige Formel im System | macht jede vorangegangene Fälschung endgültig und entwertet jede bereits erteilte Merkle-Wurzel | ❌ ausdrücklich verworfen |
| Anker in eine separate DB-Instanz | echte Trennung von Daten und Beweis | zweiter Cluster, Betrieb, Migrationspfad | Phase 2 |
| Siegelzeilen in WORM-Objektspeicher spiegeln | verlässt die Reichweite des DB-Superusers — schließt D11 | Storage-Abhängigkeit, Retention-Kosten | Phase 2 |
| Kommerzielle eIDAS-QTSP (D-Trust, DigiCert) | qualifizierter Zeitstempel, maximale juristische Anerkennung in DE/EU | ~500–2000 €/Jahr, kommerzielle Abhängigkeit | Phase 2 |
| Eigener Bitcoin-Node + Direkt-`OP_RETURN` | volle Autonomie | ~5–20 € Gebühr pro Commit, Node-Betrieb | — |
| Ethereum-Smart-Contract | billiger als BTC, programmierbar | wenige Auditoren akzeptieren Ethereum-State als Beweis | — |

## Konsequenzen

### Positiv

* Die Angriffe, die der Audit reproduziert hat, werden abgewiesen oder
  erkannt — nachgewiesen in
  `packages/db/tests/integration/audit-tamper-evidence.test.ts`, das jeden
  einzelnen davon ausführt (31 Tests).
* Der Zielkonflikt DSGVO Art. 17 ↔ Unveränderlichkeit ist für neue Zeilen
  gelöst statt verdeckt.
* Die Verifikation existiert einmal statt viermal und kann nicht mehr
  auseinanderlaufen.
* Der Offline-Pfad funktioniert: 142 von 142 statt 0 von 142.
* Geheimnisse (Passwort-Hashes, OIDC-Client-Secrets, Access-/Refresh-
  Tokens, Hinweisgeber-Tokens) landen nicht mehr im unlöschbaren Log.

### Negativ / Kompromisse

* **Schlüsselverwaltung.** `AUDIT_SEAL_KEY` ist ein neues Geheimnis mit
  Lebenszyklus. Geht er verloren, sind alte Siegel nicht mehr HMAC-prüfbar
  (die Verkettung bleibt). `seal_key_id` erlaubt Rotation.
* **Zwei Hash-Versionen dauerhaft im Bestand.** Der Preis dafür, nicht zu
  rehashen. Der Verifizierer beherrscht v1–v4; v0 ist ein Befund.
* **Kein Schutz gegen den Superuser**, siehe D11. Die verbleibende
  Kontrolle ist eine außerhalb gehaltene Archivkopie.
* **Schreibkosten.** Jeder Audit-Insert berechnet zusätzlich ein
  Commitment und durchläuft die Geheimnisprüfung. Letztere hat einen
  Schnellpfad (eine Regex über die serialisierte Nutzlast), sodass der
  Normalfall den rekursiven Durchlauf überspringt.
* **Der Advisory-Lock bleibt ein Schreibengpass pro Mandant**, weil
  `audit_trigger` an über 500 Tabellen hängt. Unverändert gegenüber
  rev.3; für Stream S09/S10 vermerkt.
* **Byte-Genauigkeit bleibt eine Voraussetzung.** Eine Migration, die
  `created_at`-Präzision, IDs oder die `jsonb`-Textdarstellung ändert,
  bricht die Verifikation. ADR-014 verbietet solche Änderungen auf
  Log-Tabellen; rev.4 erweitert das ausdrücklich auf `content_commitment`
  und `chain_seq`.

## Roadmap

**Erledigt (früher als „Phase 2" geführt):** Archiv-Export,
OTS-Upgrade-Job.

**Phase 2**

* Siegelzeilen in einen Append-only-/WORM-Speicher außerhalb dieser
  Datenbank spiegeln (`audit_anchor_seal_export()` liefert sie bereits als
  JSONL). Erst das schließt die Restlücke aus D11.
* QTSP-Integration (D-Trust oder DigiCert) als dritter Provider.
* `audit_log` und `audit_anchor` in ein separates DB-Cluster mit eigener
  Rolle.

**Phase 3**

* Eigener Bitcoin-Pruned-Node für autonome OTS-Verifikation ohne
  Explorer-API-Abhängigkeit.
* QTSP-Failover über zwei Jurisdiktionen.

## Referenzen

* RFC 3161 — Internet X.509 PKI Time-Stamp Protocol
* RFC 6962 §2 — Certificate Transparency, Merkle-Baum mit Domain-Separation
* CVE-2012-2459 — Merkle-Duplikationsmehrdeutigkeit
* ADR-011 rev.2 — Per-Tenant-Chain (Grundlage)
* ADR-026 — Hash-Chain-Migration und Kontinuitätsbeweis
* Auditbericht ARCTOS-FULL-2026-08-31, Stream S03 (20 Findings)
* eIDAS-Verordnung (EU) 910/2014 · `§ 371a ZPO`
* OpenTimestamps: https://petertodd.org/2016/opentimestamps-announcement
* FreeTSA: https://freetsa.org
