# Welle 6a — OP-112 scharf, und was `noUnusedLocals` freigelegt hat

**Grundlage:** `docs/UMSETZUNG-WELLE-5C.md` §4 (OP-112, gemessen statt gebaut) ·
`docs/UMSETZUNG-WELLE-4B-6.md` §8 (N-1, N-2, N-3) ·
`docs/OFFENE-PUNKTE-REGISTER.md` ab dem Nachtrag vom 2026-09-03
**Punkte:** OP-112 · N-1 · N-3 · N-2
**Stand:** Branch `audit/full-2026-08-31`, aufsetzend auf `dcded077`
**Gebiet:** `packages/*/src|tests|tsconfig.json|package.json`, `package-lock.json`,
`apps/worker/src|tests|tsconfig.json`, `packages/db/drizzle/0479_*`, dieses Dokument
— sowie, erzwungen durch ein Tor, drei Zeilen in `docs/feature-catalog.md` (§7.1)

---

## 1. Ergebnis in einem Satz

Der Rebinding-Schutz ist **scharf und gemessen** — ohne Pin landete der
Aufruf beim Angreiferziel, mit Pin bei der geprüften Adresse —, das Gewicht
in der QA-Checkliste hat endlich einen CHECK-Constraint, und
`noUnusedLocals` hat in zwölf Projekten **265 ungenutzte Bindungen** und
dahinter **elf Produktdefekte** freigelegt, davon vier vom Typ „meldet
Erfolg, ohne etwas getan zu haben".

| Messgröße                                            |            vorher |                   nachher |
| ---------------------------------------------------- | ----------------: | ------------------------: |
| `npm ls undici --all --omit=dev`                     |       **(empty)** |  **@grc/shared → 7.29.0** |
| DNS-Rebinding: wohin `safeFetch` verbindet           | **Angreiferziel** |      **geprüfte Adresse** |
| Namensauflösungen zwischen Prüfung und Verbindung    |             **1** |                     **0** |
| Aufrufer mit gepinntem `fetch`                       |         **0 / 4** |                 **4 / 4** |
| CHECK auf `audit_qa_checklist_item.weight`           |   nicht vorhanden |      `CHECK (weight > 0)` |
| QA-Bewertung: 1 von 15 Positionen geprüft            |   **100 / green** | **100 / green, 1 von 15** |
| `noUnusedLocals`: Projekte mit dem Schalter an       |        **1 / 12** |               **12 / 12** |
| Eigene Fundstellen (11 Pakete + `apps/worker`)       |           **265** |                     **0** |
| Lint-Ratsche `no-unused-vars`                        |           **249** |                    **12** |
| Lint-Ratsche gesamt (root)                           |           **282** |                    **45** |
| Cron-Pfade, die ehrlich verweigern (OP-104-Inventar) |            **19** |                    **22** |
| Migrationen von Null                                 |         428 / 428 |             **429 / 429** |

---

## 2. OP-112 — der Dispatcher, jetzt im Weg statt im Kommentar

### 2.1 Was 5c gemessen hat, und was daran fehlte

Welle 5c hat den Weg belegt (undici-`Agent` mit pinnendem `connect.lookup`,
`fetch(url, { dispatcher })` nimmt ihn an) und ihn **bewusst nicht
eingesetzt**: `undici` lag im Baum ausschliesslich als transitive
Entwicklungsabhängigkeit von `jsdom`. Ein Import hätte in Produktion
(`npm ci --omit=dev`) jeden ausgehenden Aufruf mit `ERR_MODULE_NOT_FOUND`
gebrochen.

Der Bericht von 5c ist die Messung eines anderen Laufs. Hier steht meine.

### 2.2 Die Abhängigkeit, gemessen vorher und nachher

```
$ npm ls undici --all --omit=dev          # vorher
grc-platform@ /work/repo
`-- (empty)

$ npm ls undici --all                     # vorher
`-- @grc/web@0.1.0 -> ./apps/web
  `-- jsdom@29.1.1
    `-- undici@7.29.0 overridden
```

`"undici": "^7.29.0"` in die `dependencies` von
`packages/shared/package.json`, dann `npm install --package-lock-only`.
Der Sperrdatei-Diff ist **zwei Zeilen** und sagt genau das Richtige:

```diff
   "node_modules/undici": {
       "version": "7.29.0",
-      "dev": true,
       "license": "MIT",
...
       "dependencies": {
         "@grc/bpmn": "^0.1.0",
         "fast-xml-parser": "^5.10.1",
+        "undici": "^7.29.0",
         "zod": "^3.24"
```

Die entfallene Markierung `"dev": true` ist der eigentliche Beleg: npm
rechnet das Paket jetzt der Produktionsinstallation zu.

```
$ npm ls undici --all --omit=dev          # nachher
`-- @grc/shared@0.1.0 -> ./packages/shared
  `-- undici@7.29.0 overridden
```

Keine neue Fassung im Baum — `overrides` der Wurzel nagelt `undici@^7` seit
jeher auf `^7.29.0`.

### 2.3 Die Fassung geprüft, bevor eine API gewählt wurde

`node_modules/undici/types/connector.d.ts` in 7.29.0:

```ts
export type BuildOptions = (ConnectionOptions | TcpNetConnectOpts | IpcNetConnectOpts) & { … }
```

`TcpNetConnectOpts` trägt `lookup?: LookupFunction` — der Pin ist also eine
**deklarierte** Option, kein undokumentierter Griff. Genutzt wird deshalb
`node:net`'s `LookupFunction` als Typ der eigenen Funktion, nicht eine
handgeschriebene Signatur; der erste Versuch mit einer eigenen Signatur ist
an genau dieser Stelle vom Übersetzer abgelehnt worden
(`TS2322: … 'readonly ResolvedAddress[]' is 'readonly' and cannot be
assigned to the mutable type 'LookupAddress[]'`).

### 2.4 Der Rebinding-Angriff, selbst nachgemessen

5c hat gezeigt, dass der Pin _greift_. Das ist nicht dasselbe wie: er
_schliesst die Lücke_. Der Nachweis dafür braucht einen Resolver, der
zwischen Prüfung und Verbindung **umschwenkt** — genau das ist DNS-Rebinding.

Aufbau: zwei HTTP-Server auf **demselben Port**, `127.0.0.1` und `127.0.0.2`,
und ein Resolver, der beim ersten Aufruf `127.0.0.1` liefert (das, was die
Prüfung sieht) und danach `127.0.0.2` (das eigentliche Ziel). Die beiden
Fälle unterscheiden sich in nichts ausser der Adresse.

```
$ node op112-probe.mjs
Vorabpruefung loest auf auf: [{"address":"127.0.0.1","family":4}]
UNGEPINNT   -> server=B-rebind-ziel            host=rebind.invalid:34965
GEPINNT     -> server=A-oeffentlich-validiert  host=rebind.invalid:34965
lookup-Aufrufe des Agents: [{"hostname":"rebind.invalid","opts":{"hints":32,"all":true}}]
Resolver-Aufrufe gesamt: 2 [{"call":1,…"127.0.0.1"},{"call":2,…"127.0.0.2"}]
```

Drei Aussagen in vier Zeilen:

1. **Die Lücke war real.** Ungepinnt landete der Aufruf beim Rebind-Ziel,
   obwohl die Prüfung eine Zeile vorher eine andere Adresse freigegeben hatte.
2. **Der Pin schliesst sie.** Gepinnt landete er bei der geprüften Adresse.
3. **`Host` bleibt der Hostname** in beiden Fällen — der Pin wirkt nur auf die
   Transportadresse, TLS-SNI und Zertifikatsprüfung bleiben unberührt. Ein
   `fetch` auf die IP hätte beides zerstört.

Der Agent ruft `lookup` mit `{ all: true }`; die Rückgabe **muss** ein Array
sein. `createPinnedDispatcher` bedient beide Formen.

### 2.5 Was gebaut wurde

`packages/shared/src/lib/url-safety-server.ts`:

- `ResolvedAddress` / `ResolvedHostCheckResult` — der `ok`-Zweig der Prüfung
  trägt jetzt **die geprüften Adressen**. `ResolvedHostCheckResult` ist über
  `Extract<WebhookUrlCheckResult, …>` aus dem gemeinsamen Vertrag abgeleitet,
  nicht danebengeschrieben; Bestandsaufrufer übersetzen unverändert.
- `createPinnedDispatcher(addresses)` — der Agent. Lehnt eine leere Liste
  **laut** ab, statt still ungepinnt zu fetchen.
- `fetchPinned(url, addresses, init)` — `fetch` mit Pin, schliesst den Agent
  danach (`close()` wartet auf den Antwortkörper, wird deshalb nicht awaited).
- `fetchResolvedHost(url, check, init)` — der Weg für Aufrufer mit eigener
  `fetch`-Schleife. Eine leere Adressliste entsteht an **genau einer Stelle**
  im Baum: `WEBHOOK_ALLOW_PRIVATE_HOSTS=1` hat die Prüfung abgeschaltet und
  deshalb gar nicht aufgelöst. Dann gibt es nichts festzunageln — und nichts
  zu schützen.

Vier Aufrufer fahren jetzt gepinnt: `safeFetch` selbst,
`apps/worker/src/webhooks/webhook-delivery.ts`,
`apps/worker/src/crons/automation-engine-init.ts` und
`apps/worker/src/crons/interface-health-check.ts` (dort musste das
Prüfergebnis erst aus dem `try`-Block heraus, damit die Adressen den `fetch`
erreichen).

**Der eine Typ-Sonderfall, benannt statt versteckt.** `@types/node`
beschreibt `RequestInit.dispatcher` über sein mitgeliefertes
`undici-types@6.21.0`, der Agent stammt aus `undici@7.29.0`; die
Deklarationen sind strukturell unvereinbar (abweichende `FormData`- und
Iterator-Signaturen), obwohl es zur Laufzeit funktioniert — §2.4. Die
Verengung sitzt an **einer** Stelle (`fetchPinned`) und nur auf dem
`dispatcher`-Feld; Methode, Header, `redirect` und `signal` bleiben überall
voll typgeprüft.

Dazu ein zweiter, beim Übersetzen gefundener Punkt: dieselbe Datei wird unter
**zwei verschiedenen `lib`-Einstellungen** übersetzt. In `apps/web` gilt die
DOM-Deklaration von `RequestInit`, und die kennt `dispatcher` nicht —
`Pick<RequestInit, "dispatcher">` ist dort ein Übersetzungsfehler
(`TS2344: Type '"dispatcher"' does not satisfy the constraint
'keyof RequestInit'`). `Omit` ist in beiden Fällen gültig; deshalb steht in
der Datei `Omit` und nicht `Pick`, mit der Begründung daneben.

### 2.6 Die Tests, und dass sie fallen

`packages/shared/tests/url-safety-dns-pinning-op112.test.ts`, 9 Prüfungen an
**echten Sockets** — keine Attrappe für den Verbindungsaufbau. Darunter eine
**Negativkontrolle**, die den alten Zustand beschreibt („ohne Pin gewinnt der
Angreifer-Resolver") und deshalb gegen beide Stände grün ist. Das ist Absicht:
sie belegt, dass der Aufbau den Angriff überhaupt reproduziert.

**Fallnachweis gegen den alten Stand** (`git stash push` nur auf
`url-safety-server.ts`):

```
  × mit Pin entscheidet die gepruefte Adresse, nicht der Resolver
  × laesst Host-Header (und damit TLS-SNI) auf dem Hostnamen stehen
  × verweigert einen Pin ohne Adresse, statt still ungepinnt zu fetchen
  × fetcht auf die geprueften Adressen und befragt den Resolver nicht erneut
  × checkResolvedHostIsPublic gibt die geprueften Adressen heraus
  × Fluchtluke WEBHOOK_ALLOW_PRIVATE_HOSTS=1: keine Adressen, also kein Pin
      Tests  6 failed | 1 passed (7)
```

**Gegenprobe durch künstliche Verletzung** — `safeFetch` auf blankes `fetch`
zurückgedreht, sonst nichts:

```
  × fetcht auf die geprueften Adressen und befragt den Resolver nicht erneut
AssertionError: expected 1 to be +0
```

Das Rebind-Ziel wurde getroffen. Das Tor löst aus.

Dasselbe für den Worker-Pfad (`fetchResolvedHost` → `fetch` in
`webhook-delivery.ts`):

```
  × delivers to a safe URL with HMAC signature + timestamp headers
  × delivers a pending row via the hardened path and marks it delivered
AssertionError: expected [] to deeply equal [ [ { …(2) } ] ]
```

Die beiden Worker-Attrappen bildeten den alten Vertrag ab
(`checkResolvedHostIsPublic` ohne `addresses`, Zustellung über blankes
`fetch`). Sie bilden jetzt den echten ab und **halten fest, worauf gepinnt
wurde** — wäre die Zustellung wieder ungepinnt, bliebe die Liste leer.

---

## 3. N-1 — der CHECK, den die Anwendung seit 4b-6 ersetzt hat

Welle 4b-6 hat `computeQaScore` gegen jedes Gewicht abgesichert und
festgehalten: die richtige Stelle ist ein CHECK-Constraint, denn `weight`
steht in **keinem** Zod-Schema. Nachgemessen:

```
$ grep -n weight packages/shared/src/schemas/audit-advanced.ts
(updateQaChecklistSchema trägt id, compliance, reviewerComment — kein weight)

$ psql grc_v4c -c "\d audit_qa_checklist_item"
 weight | integer | not null | 3
(keine Check constraints)

$ select count(*), min(weight), max(weight), count(*) filter (where weight<=0)
    from audit_qa_checklist_item;   ->  0 | (null) | (null) | 0
```

`packages/db/drizzle/0479_qa_checklist_weight_check.sql` (nächste freie
Nummer; 0478 war die höchste). `> 0`, nicht `>= 0`: ein Gewicht 0 heisst
fachlich „zählt nicht", und dafür gibt es bereits `compliance =
'not_applicable'`. Der Constraint ist zusätzlich in
`packages/db/src/schema/audit-advanced.ts` als `check(...)` gespiegelt, damit
Schema und Datenbank nicht auseinanderlaufen (ADR-014).

**Bestandsdaten.** Die Tabelle ist in dieser Umgebung leer; die
Normalisierung im Migrationskopf ist hier ein No-op. Sie steht trotzdem da,
weil eine Migration, die auf fremden Bestandsdaten scheitern kann, keine
Migration ist — und sie ist **bedeutungserhaltend**: `computeQaScore`
behandelt `weight <= 0` seit 4b-6 wie `not_applicable`, die Zeile bekommt
also genau die Bedeutung geschrieben, nach der sie schon bewertet wurde.
Gegen echte Verletzerzeilen ausgeführt:

```
| item_number | compliance     | weight
|           1 | not_applicable |      3   (war compliant / -1)
|           2 | not_applicable |      3   (war compliant /  0)
```

**Gegenprobe durch künstliche Verletzung** — der Constraint muss fallen, nicht
nur dastehen:

```
INSERT … weight = 3    ->  INSERT 0 1
INSERT … weight = 0    ->  ERROR: … violates check constraint
                           "audit_qa_checklist_item_weight_positive"
UPDATE … weight = -1   ->  ERROR: … violates check constraint …
UPDATE … weight =  0   ->  ERROR: … violates check constraint …
```

**Gegen eine FRISCHE Datenbank von Null** (eigene DB, `init-extensions.sql`
plus `vector` und `timescaledb`):

```
$ DATABASE_URL=…/grc_w6a npx tsx src/migrate-all.ts
  Pass 1: 425 succeeded, 4 deferred
  Pass 2: 4 recovered, 0 still failing
✓ 617 tables created
✓ 429/429 migrations applied

$ select conname, pg_get_constraintdef(oid) …
audit_qa_checklist_item_weight_positive = CHECK ((weight > 0))
```

---

## 4. N-3 — der QA-Bewertungspfad: die Messung, die Entscheidung, und der Defekt dazwischen

### 4.1 Selbst nachgemessen

```
$ grep -rn "computeQaScore" --include=*.ts --include=*.tsx apps packages | grep -v /tests/
packages/shared/src/schemas/audit-advanced.ts:213:export function computeQaScore(
(sonst nichts)

$ grep -rn "updateQaChecklistSchema" … | grep -v /tests/
packages/shared/src/schemas/audit-advanced.ts:162:export const updateQaChecklistSchema
(sonst nichts)

$ grep -n "^export const \(GET\|POST\|PATCH\|PUT\|DELETE\)" \
      apps/web/src/app/api/v1/audit-mgmt/qa-review/route.ts
198:export const POST …
363:export const GET …

$ psql grc_v4c -tAc "select count(*), count(overall_score) from audit_qa_review;"
0|0
```

Bestätigt, und ergänzt: die zugehörige Seite
`apps/web/src/app/(dashboard)/audit/qa-review/page.tsx` ist 54 Zeilen lang
und rendert an der Stelle der Bewertung ein **fest verdrahtetes `--`**. Der
Pfad ist nicht „unvollständig verdrahtet" — er ist auf allen drei Schichten
ein Rumpf: keine Erfassung der Konformität, kein Schreiben der Bewertung,
keine Anzeige.

### 4.2 Die Entscheidung: nicht verdrahten — und warum

**Erstens, Dateihoheit.** Jede Stelle, die `computeQaScore` rufen könnte, ist
die Route oder die Seite, beide unter `apps/web/**`. Das liegt ausserhalb des
Gebiets dieser Welle.

**Zweitens, und das ist der eigentliche Grund: ein Aufruf allein wäre
schlimmer als keiner.** Die POST-Route legt fünfzehn Positionen aus
`QA_CHECKLIST_TEMPLATE` an, mit Gewichten 3–5 und `compliance = NULL` —
einen Schreibweg für `compliance` gibt es nicht. Was `computeQaScore` auf
genau dieser Checkliste liefert, gemessen am 2026-09-07:

```
wie die Route sie anlegt: {"score":0,"rating":"red"}
```

Verdrahtet man nur den Aufruf, trägt **jede QA-Bewertung im Produkt** die
Note „rot" — nicht weil geprüft wurde, sondern weil nichts geprüft werden
kann. Eine leere Spalte ist sichtbar unfertig; eine konstante rote Bewertung
sieht aus wie ein Befund. Das ist genau die Fehlerform, die
`no-fabricated-evidence.test.ts` in dreizehn anderen Dateien festhält.

**Drittens** ist die fehlende Hälfte eine fachliche Festlegung: wer die
Konformität setzen darf (IIA 1300 verlangt Unabhängigkeit, die POST-Route
prüft sie bereits für den Reviewer), ob die Bewertung ein Freigabetor ist,
und was mit einer angefangenen Bewertung geschieht. Das gehört dem
Eigentümer.

**Was stattdessen getan wurde:** die Zusage ist an ihrer eigenen Stelle
benannt — der Kopfkommentar von `computeQaScore` trägt die Messung mit Datum.
Ein Test, der „diese Funktion hat keinen Aufrufer" festschreibt, ist bewusst
**nicht** gebaut: er müsste an dem Tag fallen, an dem jemand das Richtige tut.

### 4.3 Der Defekt, den die Messung freigelegt hat — und der behoben ist

Beim Nachrechnen fiel auf, was N-3 nicht nannte. Dieselbe Checkliste, einmal
mit **einer** und einmal mit **allen fünfzehn** Positionen als `compliant`:

```
1 von 15 bewertet:  {"score":100,"rating":"green"}
15 von 15 bewertet: {"score":100,"rating":"green"}
```

**Ununterscheidbar.** `compliance === null` heisst „noch nicht bewertet" —
die Spalte kennt für „zählt nicht" den eigenen Wert `not_applicable` —, und
beide fielen gleichermassen aus der Bewertung. Eine QA-Bewertung, an der
genau ein Haken gesetzt ist, las sich damit wie eine vollständig
durchgeführte. Das ist dieselbe Fehlerklasse wie das negative Gewicht aus
F-5: ein Hebel, mit dem sich „grün" erzeugen lässt, ohne die Arbeit zu tun.

Der Quotient ist nicht falsch — 100 % der **bewerteten** Positionen sind
konform. Falsch ist, ihn ohne seinen Nenner herauszugeben. Das Ergebnis trägt
deshalb jetzt `assessed` und `total`.

**Bewusst NICHT getan:** unbewertete Positionen mit 0 zu verrechnen. Das wäre
die fachliche Festlegung „nicht bewertet = nicht konform" und gehört nicht in
diese Funktion.

**Fallnachweis** (`git stash push` auf `schemas/audit-advanced.ts`):
`Tests 12 failed | 66 passed (78)` — darunter alle drei neuen N-3-Prüfungen
und die neun Bestandszusicherungen, deren Erwartung um den Nenner erweitert
wurde.

---

## 5. N-2 — `noUnusedLocals`, und die elf Produktdefekte dahinter

### 5.1 Die Erwartung war zu niedrig

4b-6 §7.2 bezifferte „ca. 75" — gemessen an den vier grössten Paketen. Über
alle zwölf Projekte, jeweils nur die **eigenen** Dateien:

| Projekt               | eigene Fundstellen |
| --------------------- | -----------------: |
| `apps/worker`         |            **138** |
| `packages/db`         |                 39 |
| `packages/ui`         |                 38 |
| `packages/shared`     |                 31 |
| `packages/reporting`  |                  9 |
| `packages/auth`       |                  4 |
| `packages/automation` |                  2 |
| `packages/email`      |                  2 |
| `packages/ai`         |                  1 |
| `packages/graph`      |                  1 |
| `packages/bpmn`       |                  0 |
| `packages/events`     |                  0 |
| **Summe**             |            **265** |

`apps/worker` war in 4b-6 gar nicht gezählt und ist der grösste Posten. Seine
`tsconfig.json` erbt **nicht** von `tsconfig.base.json`; der Schalter musste
dort einzeln gesetzt werden.

Alle 265 sind abgetragen — **keine per `!`, keine per `as`, keine per
`// @ts-expect-error`**. Der Schalter steht in allen zwölf Projekten an; die
Begründung samt gemessener Zahl steht in jeder `tsconfig.json`.

### 5.2 Die elf Produktdefekte

Vier davon sind vom Typ „meldet Erfolg, ohne etwas getan zu haben" — dieselbe
Familie, die `apps/worker/tests/no-fabricated-evidence.test.ts` für dreizehn
Dateien festhält. Sie sind **behoben**, nicht nur benannt.

#### D-1 · `automation_rule.cooldown_minutes` war eine Einstellung ohne Wirkung

`packages/automation/src/rule-engine.ts`. Unbenutzt: `desc`, `gte` aus
drizzle. Dahinter: es gab **zwei** Cooldown-Methoden.
`isInCooldown(ruleId, entityId)` hatte eine Stunde fest verdrahtet — mit dem
Kommentar „Default cooldown: check against rule (retrieved from DB inline) /
For now use the cache timestamp approach". `isInCooldownWithMinutes(…, minutes)`
nahm den konfigurierten Wert und hatte **ausserhalb der Tests keinen
Aufrufer**. Der Produktionspfad rief die erste.

Wirkung: eine Regel mit `cooldown_minutes = 5` feuerte höchstens stündlich
(zwölfmal seltener als konfiguriert), eine mit `1440` stündlich statt einmal
am Tag. Die Ratenschranke eine Zeile tiefer reichte ihren Konfigurationswert
immer schon durch — genau daran war der Unterschied zu sehen.

Behoben: eine Methode, der Aufrufer reicht `rule.cooldownMinutes ?? 60`
durch (60 ist der DEFAULT der Spalte). Zwei Methoden für dieselbe Frage waren
die Ursache; es steht nur noch eine da.

#### D-2 · Die Suite, die den Cooldown nie prüfen konnte

`packages/automation/src/__tests__/rule-engine-throttling.test.ts`, Titel
„boundary cases". **Jede** Zusicherung lief gegen einen leeren
Zwischenspeicher, und bei leerem Speicher gibt `isInCooldown` immer `false`
zurück — unabhängig davon, was die Methode rechnet. Die Kommentare sagten es
selbst: „if cache is empty, both return false". Der db-Mock lieferte immer
`[]`, `handleEvent` hatte also nichts auszuführen.

Das ist ein weiteres Tor, das nicht auslösen konnte. Der Mock liefert jetzt
steuerbare Regeln, der Speicher wird über den **öffentlichen** Weg
(`handleEvent`) gefüllt, und die Zusicherungen prüfen den konfigurierten Wert.

**Fallnachweis** (`git stash push` auf `rule-engine.ts`):

```
  × nimmt eine KURZE konfigurierte Dauer ernst (5 statt 60 Minuten)
  × nimmt eine LANGE konfigurierte Dauer ernst (1440 statt 60 Minuten)
      Tests  2 failed | 82 passed (84)
```

Die übrigen bestehen gegen beide Stände — sie benutzen 60 Minuten, wo alter
und neuer Code dasselbe antworten. Genau das macht die zwei zum Nachweis.

#### D-3 · `risk-prediction-weekly` quittierte jede Woche Erfolg

`apps/worker/src/crons/risk-prediction-weekly.ts`. Unbenutzt: **zwei
vollständige Import-Deklarationen**, `ALERT_THRESHOLD`, `MIN_DATA_MONTHS`,
`sigmoid`, `predictEscalation` — die gesamte Vorhersagemaschinerie. Der Rumpf
war:

```ts
const processed = 0;
const alerts = 0;
const skipped = 0;
// This worker runs across all orgs — simplified stub for now.
return { processed, alerts, skipped };
```

Der Job steht in `JOB_REGISTRY` und läuft montags um 03:00. Über
`withCronInstrumentation` hinterliess er dabei **jede Woche eine `job_run`-Zeile
mit `status: "success"`** — eine Risikovorhersage, die nie stattgefunden hat,
mit grüner Quittung. Nicht erfundene Zahlen, sondern erfundene Tätigkeit.

Behoben nach dem Muster von `connector-health-monitor.ts`: gibt es kein
aktives Modell, ist die Null gemessen und wird zurückgegeben; gibt es Modelle,
wirft der Job `NotImplementedEvidenceError` und schreibt nichts.
`predictEscalation` ist **exportiert und geprüft** statt gelöscht — der
Algorithmus ist vollständig und richtig, er hatte nur nie einen Aufrufer.

**Der Test, der das gedeckt hat**, ist die zweite Hälfte des Befunds. Er
lautete in seiner ganzen Substanz `expect(threw).toBe(false)` — „der Job wirft
nicht", für einen Job, der nichts tat. Er hätte jeder Verweigerung im Weg
gestanden. Ersetzt; sein Anliegen steht als erste Zusicherung der neuen Suite,
jetzt mit einer Aussage.

**Fallnachweis:** `Tests 5 failed | 1 passed (6)` gegen den alten Stand.

#### D-4 · `tech-radar-migration-alerts` zählte Warnungen, die es nie erzeugt hat

`apps/worker/src/crons/tech-radar-migration-alerts.ts`. Unbenutzt:
`technologyApplicationLink`, `architectureElement`, `and` — die Bausteine der
nie geschriebenen Aufgabenerzeugung. Der Kopfkommentar sagt „creates tasks".
Der Rumpf zählte Technologien im Ring `hold` mit Anwendungen und gab die Zahl
als **`alertsCreated`** zurück, ohne eine Aufgabe, Benachrichtigung oder Zeile
zu schreiben. Der wöchentliche Lauf quittierte „n Warnungen erzeugt", und
niemand hatte je eine bekommen. Verweigert jetzt.

#### D-5 · Eine eingebaute Dauerprüfung bestand immer, ohne zu prüfen

`apps/worker/src/crons/continuous-audit-runner.ts`. Unbenutzt: `checkType`,
gelesen aus `rule.dataSource.check_type`. Darunter stand „Built-in rule
implementations would go here / For now, return empty (pass)", und
`executeBuiltinRule` gab `[]` zurück. Der Läufer schreibt bei leerer
Ausnahmeliste `resultStatus: "pass"` in `continuous_audit_result` — eine
kontinuierliche Prüfung vom Typ `builtin` hat also bei **jedem** Lauf ein
sauberes Ergebnis persistiert, ohne irgendetwas geprüft zu haben.

Verweigert jetzt. Der vorhandene `catch` des Läufers schreibt dafür
`resultStatus: "error"` — der Job bricht nicht ab, die anderen Regeln laufen
weiter, und der Auditor sieht einen Fehler statt eines Bestehens.

#### D-6 · Eine erfundene Kennzahl in jedem ISMS-Bericht

`packages/reporting/src/section-data-fetcher.ts`. Aufgefallen über dieselbe
Regelklasse (die Lint-Ratsche meldete `ctx` als ungenutztes Argument): eine
Datenquelle, die ihren Kontext nicht anfasst, liest nichts.
`fetchPostureScore` gab `{ value: 0, label: "Security Posture Score",
trend: "stable" }` zurück, mit dem Kommentar „return placeholder if no data" —
ohne je nach Daten gefragt zu haben. In jedem erzeugten Bericht stand damit
eine Sicherheitsbewertung von 0 mit stabilem Trend, ununterscheidbar von einer
gemessenen. Dieselbe Fehlerklasse wie `auditSlaCompliance: 0 // Placeholder`
aus `executive-kpi-snapshot.ts`, die `no-fabricated-evidence.test.ts`
namentlich führt.

Ein Wurf wäre hier falsch — er bräche den ganzen Bericht ab, statt einen
Abschnitt ehrlich zu machen. `KPIData.value` ist `number | string`; die
Kennzahl meldet jetzt `"n/a"` unter dem Etikett „(not computed)", und `trend`
entfällt, weil es keinen gibt. **Fallnachweis:** 2 von 11 Prüfungen fallen
gegen den alten Stand.

#### D-7 · Zwei Listen der DSGVO-Angemessenheitsbeschlüsse, und die verdeckte war falsch

`packages/shared/src/types/eam-advanced.ts` exportierte ein zweites
`ADEQUACY_COUNTRIES` — als Array, neben dem `Set` in
`src/state-machines/dpms-tia.ts`. Beide erreichen das Barrel: das eine über
`export *` aus `types.ts:39`, das andere über einen **namentlichen** Export in
`index.ts:259`. Der namentliche verdeckt den Stern-Export. Gemessen:

```
$ npx tsx -e 'import { ADEQUACY_COUNTRIES } from "./src/index"; …'
Typ: [object Set]
enthaelt GB: true | enthaelt UK: false
Anzahl: 15
```

Die verdeckte Kopie hatte keinen Verwender und trug für das Vereinigte
Königreich den Code **`"UK"`**. Das ist kein ISO-3166-1-alpha-2-Code (das ist
`GB`); ein Ländercode aus der Datenbank hätte sie nie getroffen. Eine
verdeckte, nie erreichte und zusätzlich falsche Kopie einer rechtlich
relevanten Liste ist schlimmer als keine — sie ist entfernt.

Der Test, der das gefunden hätte, prüft nicht den **Inhalt** (der war ja
richtig — die falsche Liste war unsichtbar), sondern die **Zahl der
Deklarationen**. Er fällt gegen den alten Stand:

```
  × wird in packages/shared/src genau einmal deklariert
```

**Was dabei offen bleibt:** eine DRITTE Kopie liegt inline in
`apps/web/src/app/api/v1/tprm/sub-processors/route.ts:90` und weicht ihrerseits
ab — **ihr fehlen die USA**. Derselbe Sachverhalt bekommt dort also eine
andere Antwort als aus `assessTransferRisk`: ein Unterauftragsverarbeiter mit
Hosting in den USA verlangt dort eine TIA, hier nicht. `apps/web/**` liegt
ausserhalb der Dateihoheit; §7.

#### D-8 · Der Berichtszeitraum, den keine Datenquelle liest

`packages/reporting/src/section-data-fetcher.ts` importierte `eq`, `and`,
`gte`, `lte`, `count` aus drizzle und benutzte **keinen davon** — die
Operatoren für genau die Filter, die fehlen. Gemessen:

```
$ grep -c "parameters" packages/reporting/src/section-data-fetcher.ts
1          (nur die Deklaration von FetchContext.parameters)
```

Fünf Standardvorlagen erklären einen Parameter `period` vom Typ `daterange`,
und **drei schreiben ihn in den Berichtstext**:

```
"Report generated on {{report.date}}. Period: {{period.label}}."
"Audit summary report for {{period.label}}. Generated {{report.date}}."
"Sustainability and ESG compliance report for {{period.label}}. …"
```

`generator.ts:90-94` füllt diese Variablen und reicht dieselben Parameter als
`FetchContext.parameters` weiter — und keine der 16 Datenquellen sieht sie an.
`fetchRiskTrend` verdrahtet sogar ein eigenes Fenster (`interval '12 months'`).
**Ein erzeugter Bericht nennt einen Berichtszeitraum und zeigt Zahlen, die ihn
nicht einhalten.** In einem GRC-Produkt ist das eine falsche Angabe über den
Umfang der eigenen Nachweise.

**Nicht behoben, und das ist die Entscheidung, nicht die Zeit.** Die 16
Quellen zerfallen in Bestandsgrössen (Risikoregister, Kontrollbestand, Ø-CES:
der Stand HEUTE — ein Filter auf `created_at` würde bestehende Risiken
ausblenden und den Bericht falsch machen) und Ereignisgrössen (Neuzugänge,
Vorfälle im Zeitraum). Welche Quelle zu welcher Klasse gehört und auf welcher
Datumsspalte sie filtert, ist eine fachliche Festlegung; sie im Vorbeigehen zu
raten würde die Zahlen **jedes** bestehenden Berichts still verändern. Der
Befund steht mit der vollständigen Messung am Feld `parameters`.

#### D-9 · `architecture_rule.condition` wird nie ausgewertet

`apps/worker/src/crons/eam-rule-evaluator.ts`. `const condition =
rule.condition as Record<string, unknown>` — und keine Zeile darunter hat die
Variable angefasst. Ausgewertet wird ausschliesslich `rule.ruleType`, mit fest
verdrahtetem SQL je Typ. Zwei Regeln desselben Typs mit verschiedenen
Bedingungen liefern dieselben Verstösse; die Spalte ist eine Einstellung ohne
Wirkung. Dieselbe Form wie D-1 — nur lässt sie sich hier nicht in einer Zeile
beheben: es gibt keinen Auswerter für diese Bedingungen. Benannt am Fundort.

#### D-10 · Ein Kommentar, der einen Cron nennt, den es nicht gibt

`apps/worker/src/crons/interface-health-check.ts` entnahm `previousStatus`
und liess es fallen, mit der Erklärung „real notification dispatch happens in
the interface-notification cron downstream". Gemessen:

```
$ grep -rn "interface-notification" --include=*.ts apps packages
apps/worker/src/crons/interface-health-check.ts:129   (dieser Satz)
$ ls apps/worker/src/crons/ | grep -i interface
interface-health-check.ts
```

Es gibt keinen solchen Cron und keinen Eintrag dafür in `JOB_REGISTRY`.
**Fällt eine Anwendungsschnittstelle aus, erfährt es niemand.** Die tote
Entnahme ist entfernt, der Satz durch die Messung ersetzt, die Felder auf dem
Rückgabewert bleiben stehen — sie sind genau das, was ein Versand bräuchte.
Wer benachrichtigt werden soll, ist eine fachliche Festlegung.

#### D-11 · Die Repressalien-Indikatoren wurden nie angewandt

`apps/worker/src/crons/wb-retaliation-check.ts` definierte eine Liste `rules`
mit fünf Einträgen — Ereignisart, Zeitfenster in Monaten, Schwere
(`termination / 0 Monate / critical`, `performance_review / 6 Monate /
suspicious`, …) — und keine Zeile darunter hat sie gelesen. Der Job liest
stattdessen Ereignisse, deren Spalte `flag` **bereits** auf `suspicious` oder
`critical` steht, und leitet sie weiter. Er erkennt also keine Repressalie; er
stellt zu, was jemand anders schon markiert hat. Das Zeitfenster gegenüber
`protection_start_date` — der Kern des Indikators nach HinSchG § 36 — wird
nirgends geprüft, obwohl die Abfrage die Spalte mitliest. Die tote Liste ist
entfernt, damit sie nicht als Umsetzung gelesen wird; der Befund steht an
ihrer Stelle.

### 5.3 Zwei kleinere Funde, ohne Produktwirkung

- **`budget-forecast.ts`** führte je Budget und Lauf eine zweite Abfrage auf
  `grc_budget_line` aus, deren Ergebnis keine Zeile las — eine
  Datenbankrunde für nichts. Entfernt; die Attrappe im Test hatte die tote
  Abfrage mitkodiert und ist mitgezogen worden, **ohne** eine Erwartung zu
  ändern.
- **`fair-monte-carlo.ts`** berechnete `baselineAle` und las es nie. Der Rest
  der Funktion misst die Empfindlichkeit über die Streuung je Parameter und
  normiert auf deren Summe; ein Bezugswert kommt darin nicht vor. Ein
  Überbleibsel der klassischen Tornado-Form — entfernt, das Ergebnis ändert
  sich nicht.

### 5.4 Was die Test-Importe verrieten

Sechs Testdateien importierten Symbole, die keine Zusicherung anfasste — ein
Import ist keine Abdeckung, die Suite behauptete sie trotzdem. Statt die
Importe zu streichen, sind die fehlenden Prüfungen nachgezogen worden
(`cciDepartmentsQuerySchema`, `cciSnapshotSchema`,
`updateTranslationStatusSchema`, `xliffImportSchema`, `csvImportSchema`,
`ADEQUACY_COUNTRIES`). Dabei kam D-7 heraus — und ein kleinerer Befund:
`cciSnapshotSchema` trägt den Kommentar „for API response validation" und hat
**ausserhalb dieser Suite keinen Aufrufer**. Es validiert keine Antwort.
Dieselbe Form wie N-3, nur ohne Sicherheitswirkung.

### 5.5 Die dreizehn toten Enum-Spiegel

`packages/shared/src/schemas/**` enthielt vierzehn `const …Values`-Arrays, die
ein DB-Enum spiegelten und von keinem Zod-Schema benutzt wurden (`testStatusValues`,
`campaignStatusValues`, `assessmentStatusValues`, drei ESG-Statuslisten, drei
SCIM-Schema-URIs, …). Stichprobe `testStatusValues` gegen `testStatusEnum` in
`packages/db/src/schema/control.ts:84`: **wertgleich**, also keine Drift. Sie
sind entfernt; das DB-Enum bleibt die eine Quelle. Beobachtung ohne Behebung:
`scimCreateUserSchema.schemas` ist `z.array(z.string()).min(1)` und nimmt jede
Zeichenkette an — die drei URI-Konstanten waren offenbar für genau diese
Prüfung gedacht. Sie nachzuziehen ist eine Interoperabilitätsentscheidung
(Entra sendet zusätzliche Erweiterungs-URIs) und steht in §7.

---

## 6. Abnahme

Alles am 2026-09-07 gegen den Arbeitsstand dieser Welle gemessen.

```
$ npx tsc --noEmit -p packages/{ai,auth,automation,bpmn,db,email,events,graph,reporting,shared,ui}/tsconfig.json
   je 0 Fehler   (alle mit noUnusedLocals AN)
$ npx tsc --noEmit -p apps/worker/tsconfig.json     exit=0   (noUnusedLocals AN)
$ npx tsc --noEmit -p apps/web/tsconfig.json        exit=0

$ npm run test:coverage                    Tasks: 13 successful, 13 total
    @grc/shared 2161   @grc/web 2862   @grc/worker 446   @grc/bpmn 909
    @grc/auth 244   @grc/email 197   @grc/ai 154   @grc/db 126
    @grc/automation 84   @grc/reporting 51   @grc/graph 47   @grc/ui 39
    @grc/events 20                                        — alle passed

$ cd packages/db && npx vitest run -c vitest.integration.config.ts   105 passed
$ cd packages/db && npx vitest run -c vitest.rls.config.ts           186 passed

$ npx prettier --check .
All matched files use Prettier code style!

$ node scripts/lint-ratchet.mjs
  [root] 45 Befunde (Baseline 45), 1238 Dateien
       26 no-explicit-any (26) · 12 no-unused-vars (12) · 3 no-control-regex (3)
        2 no-empty (2) · 1 no-require-imports (1) · 1 no-useless-escape (1)
  [apps/web] 0 Befunde (Baseline 0), 2287 Dateien
✓ Keine Lint-Regression.

$ node scripts/check-gate-inputs.mjs
✓ 9 Tor-Eingaben sind vorhanden, verfolgt und nicht ignoriert;
  package-lock.json stimmt mit allen Workspace-Manifesten überein.

$ node scripts/audit-dead-exports.mjs --check
Dead-Exports-Ratsche: 2469 tote Exporte in 459 Dateien (Baseline 2469 in 459).
✓ Keine Regression bei toten Exporten; Report ist aktuell.

$ node scripts/audit-secrets.mjs
Scanning 4430 files...   Findings: 0    exit=0

$ node scripts/verify-db-integrity.mjs
  tables 606/606 · rlsPolicies 2639/2639 · rlsEnabledTables 559/559
  rlsForcedTables 558/558 · auditTriggers 291/291 · appendOnlyRules 9/9
  tombstoneGuards 1/1 · tamperGuardsNotEnabledAlways 0/0 · securityDefinerFns 54/54
✓ Keine Regression gegenüber der gemessenen Baseline.

$ node scripts/coverage-gate.mjs           # gegen einen FRISCH erzeugten Bericht
  lines       34.32 % -> 34.71 %  +0.39
  statements  34.75 % -> 35.11 %  +0.36
  functions   33.42 % -> 33.80 %  +0.38
  branches    25.84 % -> 26.21 %  +0.37
✓ Coverage-Gate bestanden.

$ # frische Datenbank von Null
$ DATABASE_URL=…/grc_w6a npx tsx src/migrate-all.ts
✓ 617 tables created · ✓ 429/429 migrations applied
```

Der Coverage-Bericht ist **vor** dem Tor neu erzeugt worden (7 min 24 s,
13 von 13 Aufgaben erfolgreich); der Geheimnis-Scan-Report und der
Dead-Exports-Report ebenfalls. Beide liegen im Diff.

**Zwei Ratschen wurden abgesenkt bzw. angepasst, beide über den vorgesehenen
Weg mit `--reason`:**

- `.eslint-ratchet.json`: `no-unused-vars` 249 → 12, Gesamt 282 → 45.
  Gegenprobe durch künstliche Verletzung: eine ungenutzte Konstante in
  `packages/events/src/index.ts` →
  `✗ root · @typescript-eslint/no-unused-vars: 13 > Baseline 12 (+1)`,
  **Exitcode 1**. Danach zurückgespielt, Exitcode 0.
- `.dead-exports-ratchet.json`: 2464 → 2469. Fünf Drizzle-Tabellendefinitionen
  verlieren ihren letzten TS-Importeur, weil in fünf Crons ein **ungenutzter**
  Import entfernt wurde. Alle fünf Tabellen existieren in der Datenbank
  (gemessen gegen `grc_v4c`, je 1 Treffer in `information_schema.tables`);
  ihre Definitionen zu löschen erzeugte genau die Schema-Drift, gegen die
  ADR-014 geschrieben ist. **Der Import war die Täuschung, nicht die
  Definition.** Gegenprobe: ein erfundener Export in
  `packages/shared/src/logger.ts` → `✗ 5 > Baseline 4 (+1)`, Exitcode 1.

**Ein Nebenbefund am Werkzeug, ohne Eingriff:**
`scripts/audit-dead-exports.mjs` baut seinen Importindex ausschliesslich aus
statischen `import {…} from`-Formen (Zeile 196). Ein über
`const { X } = await import(...)` geholtes Symbol gilt ihm als tot — und das
ist die im Repository verbreitete Testform nach `vi.mock`. `scripts/**` liegt
ausserhalb der Dateihoheit; die zwei neuen Suiten benutzen deshalb statische
Importe (vitest hebt `vi.mock` ohnehin darüber), mit der Begründung im Kopf.

Nicht committet, nicht gepusht.

---

## 7. Was offen bleibt, und warum

**Begründet offen, mit Datei und Zeile:**

1. **N-3 bleibt unverdrahtet** (§4.2). Kein Zeitmangel: der einzige mögliche
   Aufrufer liegt in `apps/web/**`, und ein Aufruf allein erzeugte eine
   konstante rote QA-Bewertung für jede Prüfung im Produkt — gemessen,
   `{"score":0,"rating":"red"}`. Der Defekt **innerhalb** der Funktion ist
   behoben.

2. **Der Berichtszeitraum (D-8)** ist benannt, nicht behoben. Die Zuordnung
   der 16 Datenquellen zu Bestands- und Ereignisgrössen ist eine fachliche
   Festlegung; ein geratener Filter änderte die Zahlen jedes bestehenden
   Berichts still.

3. **Die dritte `ADEQUACY_COUNTRIES`-Kopie** (D-7) liegt in
   `apps/web/src/app/api/v1/tprm/sub-processors/route.ts:90` und weicht ab
   (ohne `US`). Ausserhalb der Dateihoheit; die Divergenz ist real und trifft
   eine rechtliche Bewertung.

4. **`architecture_rule.condition` (D-9), der Ausfallversand für
   Schnittstellen (D-10) und die Repressalien-Erkennung (D-11)** sind Features
   mit fachlicher Festlegung, nicht Aufräumarbeit. Alle drei stehen am
   Fundort mit Messung.

5. **`apps/web/src/app/api/v1/webhooks/[id]/test/route.ts:54`** ruft
   `checkResolvedHostIsPublic` und fetcht danach selbst — **ohne Pin**. Das
   Rebinding-Fenster ist dort weiterhin offen. Die Behebung ist eine Zeile
   (`fetchResolvedHost` statt `fetch`, der Rückgabewert trägt die Adressen
   bereits), sie liegt aber in `apps/web/**`.

6. **`escalatedFindingId`** in `packages/db/src/schema/audit-advanced.ts:322`
   ist ein `uuid` ohne `.references(() => finding.id)`, während `finding` in
   derselben Datei importiert war (und jetzt entfernt ist). Eine echte
   Fremdschlüsselbeziehung verlangt eine zweite Migration und eine Festlegung
   zu `ON DELETE`; diese Welle hat nur die nächste freie Nummer.

7. **`scimCreateUserSchema.schemas`** nimmt jede Zeichenkette an (§5.5). Die
   Prüfung nachzuziehen ist eine Interoperabilitätsentscheidung.

8. **`docs/feature-catalog.md` ist angefasst worden** — drei Zeilen im
   OP-104-Inventar und der Zähler 19 → 22. Die Datei steht nicht in der
   Dateihoheit dieser Welle und auch nicht auf der Sperrliste;
   `apps/worker/tests/docs-vs-honest-refusals.test.ts` führt sie als
   Tor-Eingabe, und eine neue Verweigerung im Code ohne Zeile dort lässt das
   Tor fallen. Die Alternativen wären ein rotes Tor oder das Zurücknehmen von
   D-3/D-4/D-5 gewesen — also das Wiederherstellen erfundener Nachweise.
   Ausdrücklich benannt, damit es nicht als stiller Grenzübertritt durchgeht.

9. **`apps/web` ist nicht gebaut worden.** `npx tsc --noEmit` ist grün; der
   Produktionsbau ist seit OP-167 unabhängig von dieser Welle blockiert.

10. **Unberührt und ausserhalb des Gebiets:** OP-167, OP-173, OP-136,
    OP-151/OP-150, OP-145, OP-102, OP-101, OP-055, OP-048, OP-135, OP-143.

**Bewusst nicht getan:**

- Kein Test, der „`computeQaScore` hat keinen Aufrufer" festschreibt — er
  müsste an dem Tag fallen, an dem jemand das Richtige tut.
- Keine neuen UNIQUE-Constraints, obwohl `unique`/`uniqueIndex` in drei
  Schema-Dateien ungenutzt importiert waren. Gegen die laufende Datenbank
  geprüft: `fair.ts` benutzt die Spaltenform `.unique()` (der Import war der
  Rest), und für `control.ts`/`ics-advanced.ts` liesse sich die beabsichtigte
  Eindeutigkeit nur raten. Eine erfundene Eindeutigkeitsregel ist schlimmer
  als keine.
- Kein Fremdschlüssel auf `rcsa`-Tabellen, obwohl `risk` und `control` dort
  ungenutzt importiert waren: die Beziehung ist polymorph
  (`entity_type` + `entity_id`, so kommentiert), und dafür gibt es in
  PostgreSQL keinen Fremdschlüssel. Die Importe waren Fossilien, das Modell
  ist Absicht.
