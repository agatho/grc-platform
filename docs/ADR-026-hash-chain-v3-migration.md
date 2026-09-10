# ADR-026: Hash-Chain-Versionierung & Kontinuitätsbeweis

**Status:** Accepted (rev.2, 2026-09-01) · ursprünglich 2026-05-20
**Supersedes:** none (verfeinert ADR-011 rev.4)
**Authors:** Maintainer + autonome Wave-24-Session; rev.2 aus der Remediation ARCTOS-FULL-2026-08-31 (Stream S03, WP4)

## Kontext

Das Audit-Log von ARCTOS nutzt eine SHA-256-Hash-Kette, um
Manipulationsversuche erkennbar zu machen (ADR-011). Jede Zeile speichert
`entry_hash` und `previous_hash`; die aus den Feldern rekonstruierte
Prüfsumme muss dem gespeicherten Wert entsprechen, und aufeinanderfolgende
`previous_hash`/`entry_hash`-Paare müssen zusammenpassen. Das ist der
Kern der Nachweisführung für ISO 27001 A.12.4.2 und GoBD §147.

Die Hash-_Formel_ ist über die Spalte `hash_version` versioniert. Vier
Generationen sind ausgeliefert:

| Version | Migration | Felder | Anmerkung                                                                                                           |
| ------- | --------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| v1      | 0284      | 9      | rev.2-Trigger                                                                                                       |
| v2      | 0309      | 11     | rev.3-Trigger — ergänzt `action_detail`, `metadata`                                                                 |
| v3      | 0327/0328 | 11     | rev.3 + `created_at` als UTC-ISO gerendert                                                                          |
| v4      | 0400/0401 | 12     | rev.4 — `id` und ein **Content-Commitment** über `changes`, `user_email`, `user_name`, `ip_address`, `entity_title` |

Der Übergang v2 → v3 war durch einen CI-Flake erzwungen: das
Hetzner-Cluster läuft in `Europe/Berlin`, CI in UTC, und die v2-Formel
verwendete `created_at::text`, das in der _Session_-Zeitzone serialisiert.
Eine auf Hetzner gehashte Zeile scheiterte auf CI und umgekehrt.

Der Übergang v3 → v4 hat einen anderen Grund, und er ist schwerer: der
Audit ARCTOS-FULL-2026-08-31 hat gezeigt, dass `user_email`, `user_name`,
`ip_address` und `entity_title` überhaupt nicht in den Digest eingingen
und zugleich per UPDATE änderbar waren, und dass ein einziges erlaubtes
UPDATE (`changes` + `hash_version = 0`) jede Inhaltsfälschung unsichtbar
machte, ohne die Kette anzufassen. Details in ADR-011 rev.4, D1 und D5.

## Entscheidung

### v3 → v4 ist ein Formelwechsel **ohne** Rehash

ADR-026 rev.1 beschrieb für v2 → v3 einen Rehash: Migration 0328 schrieb
jede Zeile mit der neuen Formel neu. Für v3 → v4 wird das **ausdrücklich
nicht** getan, und rev.1s Vorlage („eine künftige v4-Umstellung muss
demselben Template folgen … rehasht bestehende Zeilen in
chain_seq-Reihenfolge") wird damit widerrufen.

Ein Rehash berechnet Hashes aus dem _aktuellen_ Zeileninhalt. Das hat drei
Folgen, die rev.1 nicht bewertet hat:

1. **Er macht eine vorangegangene Fälschung endgültig.** Wenn eine Zeile
   zwischen Anker und Rehash verändert wurde, schreibt der Rehash einen
   Hash, der zur Fälschung passt. Genau diesen Schritt empfahl der alte
   `remedy`-Text des `/integrity`-Endpunkts bei `v0`-Zeilen — also in
   exakt der Situation, in der eine Manipulation am wahrscheinlichsten
   ist.
2. **Er entwertet jeden bereits erteilten externen Zeitstempel.** Die
   verankerten Merkle-Wurzeln sind über die _alten_ `entry_hash`-Werte
   gebildet. Nach einem Rehash stimmt keine davon mehr mit den Daten
   überein, und der Beweiswert der Anker vor dem Rehash ist weg.
3. **Er tut genau das, was ein Angreifer täte.** Der reproduzierte
   S03-01-Angriff besteht aus „Inhalt ändern, Kette neu berechnen".
   Ein legitimer Rehash ist von ihm anhand der Daten nicht zu
   unterscheiden.

Deshalb: v1-, v2- und v3-Zeilen behalten ihre Hashes und verifizieren
weiter unter der Formel, mit der sie geschrieben wurden. Nur neue Zeilen
sind v4. `audit_chain_check()` beherrscht alle vier Formeln.

Migration 0328 bleibt historisch gültig; ihre Nebenwirkung wird in rev.2
allerdings benannt (siehe „Korrekturen").

### Was Kontinuität nach rev.2 bedeutet

Kontinuität ist bewiesen, wenn **alle drei** gelten:

1. **Verifizierbarer Bestand.** Jede Zeile rechnet unter ihrer eigenen
   Formelversion nach, jede Kettenverknüpfung hält, und für v4 zusätzlich:
   das Content-Commitment lässt sich aus den aktuellen Spaltenwerten
   reproduzieren. Das ist `audit_chain_check()`; es gibt genau eine
   Implementierung davon.
2. **Migrations-Anker.** Der Formelwechsel ist als reguläres, gehashtes
   Kettenglied protokolliert: `entity_type='database'`,
   `action='migration_run'`, `action_detail='<Migrationsnummer>'`,
   geschrieben von `record_migration_anchor()` (Migration 0407). Der
   Anker ist der explizite Querverweis zwischen den Formel-Epochen.
3. **Externer Zeitstempel.** `audit_anchor.hash_version` und
   `audit_anchor.anchored_at` sagen, welche Epoche ein Anker abdeckt. Der
   Endpunkt liefert den letzten Vor-v4- und den ersten v4-Anker.

`totalContinuityValid` ist **nicht** mehr aus dem Versionshistogramm
allein ableitbar. Es ist an das Ergebnis von `audit_chain_verify()`
gekoppelt.

### Runtime-Nachweis-Endpunkt

`GET /api/v1/audit-log/integrity/continuity` (admin / auditor / ciso /
compliance_officer):

```json
{
  "data": {
    "currentVersion": 4,
    "versionDistribution": {
      "v0_broken": 0,
      "v1": 0,
      "v2": 0,
      "v3": 15425,
      "v4": 812
    },
    "chainVerification": {
      "healthy": true,
      "rowMismatches": 0,
      "chainMismatches": 0,
      "commitmentMismatches": 0,
      "unverifiableVersion": 0,
      "unchainedRows": 0,
      "anchorIssues": 0
    },
    "migrationAnchors": [
      {
        "migration": "0400",
        "name": "audit_chain_v4_commitment",
        "appliedAt": "2026-09-01T04:12:07Z",
        "rowsRehashed": 0,
        "purpose": "v3 → v4: row id and a content commitment become hash inputs; existing rows are NOT rehashed"
      }
    ],
    "freeTsaAnchors": {
      "lastV2Anchor": "2026-08-31T00:05:11Z",
      "firstV3Anchor": "2026-09-02T00:05:09Z"
    },
    "continuityClaim": "v3_with_legacy",
    "totalContinuityValid": true,
    "notes": ["..."]
  }
}
```

`continuityClaim`:

- `"monolithic_v3"` — alle Zeilen unter einer einzigen Formelversion, und
  alle verifizieren. (Der Name ist aus API-Kompatibilität beibehalten; er
  bedeutet „monolithisch", nicht „v3".)
- `"v3_with_legacy"` — mehrere Formelversionen koexistieren, jede Zeile
  verifiziert unter ihrer eigenen, und der Wechsel ist durch einen
  Migrations-Anker belegt oder betrifft nur TZ-invariante Formeln.
- `"unmigrated"` — `v0`-Zeilen vorhanden, oder die kryptografische
  Verifikation schlägt fehl, oder es existieren noch
  zeitzonenabhängige v1/v2-Zeilen ohne dokumentierten Migrations-Anker.
  **Nicht kontinuitätsgültig.**

`totalContinuityValid` ist `true` genau dann, wenn
`chainVerification.healthy` **und** `versionDistribution.v0_broken === 0`
**und** der Claim nicht `"unmigrated"` ist.

### `hash_version = 0` ist ein Befund, kein Zustand

Für v0 existiert keine Formel. Eine v0-Zeile ist von niemandem prüfbar.
Der Verifizierer zählt sie unter `unverifiableVersion` und setzt `healthy`
auf `false`. Der frühere `remedy`-Text („Migrationen 0327 und 0328
ausführen") ist entfernt: er war der falsche Rat, weil `hash_version` auf
der UPDATE-Allowlist stand und eine v0-Zeile daher genauso gut das
Ergebnis eines Angriffs wie einer Migration sein konnte. Der richtige
Umgang ist forensisch: gegen einen offline gehaltenen Archiv-Export
prüfen.

## Korrekturen gegenüber rev.1

Rev.1 stützte den Kontinuitätsbeweis auf zwei Mechanismen, die im Code
nicht existierten. Beide sind jetzt gebaut; die falschen Aussagen werden
hier ausdrücklich zurückgezogen, weil sie in Prüfungen als Nachweis
geführt wurden.

| Aussage in rev.1                                                                                       | Realität bei der Prüfung                                                                                                                                                                                                                                | Stand jetzt                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| „every migration … is itself written to `audit_log` (via the migration audit trigger added in 0341)"   | 0341 enthält null Trigger. Der Enum `audit_action` hatte keinen Wert `migration_run`, daher scheiterte der Cast in der Lesequery, der Fehler wurde von einem leeren `catch` verschluckt und `migrationAnchors` war strukturell **immer** `[]`.          | Enum-Wert und Schreiber existieren (Migration 0407, `record_migration_anchor()`). Der Anker für 0400 wird von der Migration selbst geschrieben.                  |
| JSON-Beispiel zeigt `migrationAnchors` als geliefert                                                   | siehe oben — konstant leer                                                                                                                                                                                                                              | tatsächlich befüllt                                                                                                                                              |
| „`entity_id='0328'`"                                                                                   | `entity_id` ist eine `uuid`-Spalte und kann „0328" nicht aufnehmen                                                                                                                                                                                      | die Migrationsnummer steht in `action_detail` und `entity_title`; die Query filtert darauf                                                                       |
| `freeTsaAnchors` als geliefert dargestellt                                                             | `audit_anchor` hatte weder `anchored_at` noch `hash_version`; die Query warf, ein leeres `catch` verschluckte es, das Ergebnis war konstant `{null, null}`. Der Code gestand das im Kommentar ein („Wire-up happens in a follow-up PR"), das ADR nicht. | beide Spalten existieren (Migration 0403), die Query läuft ohne `catch`                                                                                          |
| „`totalContinuityValid` … iff v0 == 0 und Claim == monolithic_v3"                                      | Damit war der Wert ein reines Versionshistogramm ohne kryptografischen Gehalt: eine vollständig neu berechnete Kette ist „monolithic_v3 / valid: true". `scripts/pilot-readiness-gate.sh` macht den Produktivstart von genau diesem Wert abhängig.      | an `audit_chain_verify()` gekoppelt                                                                                                                              |
| „timestamps the Merkle root … **monthly**"                                                             | Der Code verankert **täglich**; ADR-011 sagt ebenfalls täglich. Rev.1 widersprach beiden.                                                                                                                                                               | täglich, konsistent formuliert                                                                                                                                   |
| „restricted by RLS + DB-trigger-protected columns; see ADR-018 §4"                                     | `audit_log` hatte kein RLS (bewusst, Migration 0379), und die Trigger-geschützten Spalten schlossen `changes` und `hash_version` **nicht** ein — die beiden, auf die es ankam.                                                                          | Guard erlaubt nur noch den Tombstone-Übergang; `hash_version` und `content_commitment` sind nie änderbar                                                         |
| „The DR drill … checks the chain on every nightly restore (threshold 10 from the rehash artifact era)" | Das Skript berechnete keinen einzigen Hash neu, nahm nur die 1000 jüngsten Zeilen und tolerierte zehn Brüche — im direkten Widerspruch zum Satz zwei Absätze darüber, dass ein Bruch nach dem Rehash ein echtes Tamper-Signal sei.                      | vollständige Verifikation als eigener Cron ohne Toleranz (ADR-011 rev.4 D8); die Herkunft der „Artefakte" ist geklärt und hashwahrend repariert (Migration 0402) |
| „A future v4 transition must follow the same template: … rehashes existing rows"                       | —                                                                                                                                                                                                                                                       | **widerrufen.** v4 rehasht nicht; Begründung oben.                                                                                                               |

### Zur Herkunft der „Rehash-Artefakte"

Rev.1 nannte Kettenbrüche nach 0328 „a real tamper signal … not expected
drift" und das DR-Skript nannte dieselben Brüche im selben Repository
„known migration 0327 rehash artifact". Beide konnten nicht recht haben.

Die Ursache ist gefunden: `0313` füllte `chain_seq` und stellte Trigger
und Verifizierer auf `chain_seq` um; `0328` verkettete anschließend in
`ORDER BY created_at, id` neu. Für Zeilen einer Transaktion ist
`created_at` identisch, der Tiebreak also eine Zufalls-UUID — jede solche
Gruppe wurde in einer Reihenfolge verkettet, die `chain_seq` widerspricht.
Auf einer allein aus den Migrationen erzeugten Datenbank: 21 von 146
Zeilen im Platform-Scope.

Migration `0402` repariert das **hashwahrend**: sie nummeriert `chain_seq`
entlang der vorhandenen `previous_hash`-Verkettung um und berechnet keinen
einzigen Hash neu. Jeder `entry_hash` bleibt byteidentisch, jede bereits
erteilte Merkle-Wurzel bleibt gültig. Die Umnummerierung findet nur statt,
wenn der Zeigergraph eines Scopes ein sauberer einzelner Pfad über alle
Zeilen ist; andernfalls wird gewarnt und nichts angefasst.

## Konsequenzen

- Ein künftiger v5-Übergang folgt der v4-Vorlage: neue Formel, neue
  Zeilen, **kein** Rehash, Migrations-Anker in der Kette, Verifizierer
  lernt die neue Version. Der Verifizierer trägt damit dauerhaft alle
  Formelgenerationen — das ist der Preis dafür, Geschichte nicht
  umzuschreiben, und er ist niedriger als der Preis der Alternative.
- Das Pilot-Readiness-Gate (Block C) prüft weiterhin
  `totalContinuityValid`, aber der Wert bedeutet jetzt etwas: er lässt
  sich nicht mehr durch ein Versionshistogramm erschleichen.
- Ein externer Prüfer kann Kontinuität weiterhin in O(1) über diesen
  Endpunkt lesen — sollte sich aber nicht darauf beschränken. Die
  belastbare Prüfung ist der Archiv-Export gegen eine außerhalb der
  Plattform gehaltene Kopie (ADR-011 rev.4, D10 und D11).

## Referenzen

- ADR-011 rev.4 — Hash-Kette, gesiegelte Anker, Verifikation
- Migration 0327/0328 — v3-Helper und Rehash (historisch)
- Migration 0400 — v4-Formel und Content-Commitment
- Migration 0401 — Kettenzuweisung im BEFORE-INSERT-Trigger, Guards
- Migration 0402 — hashwahrende `chain_seq`-Reparatur, Fork-Constraint
- Migration 0403 — gesiegelte Anker
- Migration 0404 — `audit_chain_check()` als einzige Verifikation
- Migration 0407 — `migration_run`-Enum und `record_migration_anchor()`
- `apps/worker/src/crons/audit-chain-verify.ts` — automatische Prüfung
- Auditbericht ARCTOS-FULL-2026-08-31, Stream S03, Findings S03-02, S03-04, S03-08, S03-12, S03-20
