# Welle 4a — Testabdeckung dort, wo sie fehlt

**Plan:** `docs/UMSETZUNGSPLAN-OFFENE-PUNKTE.md` §6 · **Register:** `docs/OFFENE-PUNKTE-REGISTER.md`
**Stand vorher:** `31a2e8a3` · **Branch:** `audit/full-2026-08-31` · **Datum:** 2026-09-03

---

## 1. Das Muster dieses Strangs

Welle 1b hatte einen gemeinsamen Nenner: _eine Zahl, die aussieht wie eine
Aussage, aber aus einem Fehler entstanden ist._ Dieser Strang hat einen
anderen, und er ist unbequemer, weil er die Prüfmittel selbst trifft:

**Eine Prüfung, die nicht fehlschlagen kann — und deshalb wie ein Nachweis
aussieht.**

Sieben Punkte, sieben Formen derselben Sache:

| Punkt      | Was grün war                                  | Warum es nichts bewies                                                                                                                        |
| ---------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **OP-047** | `documents-controlled-copy.test.ts` deckt ab  | Der Test mockt `drizzle-orm.sql` als `noop` — der Audit-Schreibweg ist darin unsichtbar.                                                      |
| **OP-058** | `all-routes-auth-smoke.test.ts`, 1.370 Routen | Alles gemockt, keine Session: geprüft wird der 401, nie der Erfolgspfad. C-01 war ein **200**.                                                |
| **OP-088** | „nicht seedbare Objekte < 20"                 | Ein Budget von 20, das nie ausgeschöpft wird, ist keine Grenze; die Liste stand nur in einem `console.warn`, das vitest bei Grün nicht zeigt. |
| **OP-092** | „RLS coverage — zero gaps"                    | `node … \| tee` unter `bash -e` **ohne** `pipefail`: bricht das Messskript ab, bewertet der Schritt die eingecheckte CSV. Gemessen: Exit 0.   |
| **OP-093** | a11y lief mit                                 | Namenlos. Fällt das Verzeichnis aus dem Glob, sinkt nur eine Testzahl.                                                                        |
| **OP-155** | `/health/schema-drift` meldet `healthy: true` | Der ENABLE-Zustand der Trigger wird nicht gelesen. Ein zurückgestufter Wächter steht unverändert in `pg_trigger` und feuert nicht mehr.       |
| **OP-163** | `both-lossy: 0` im Shadow-Bericht             | Der XML-Vergleich war abgeschaltet. Die Null hiess nicht „bpmn-moddle verliert nichts", sondern „auf dieser Ebene wird nicht gemessen".       |

Drei der sieben Registereinträge waren beim Nachmessen ganz oder teilweise
überholt (OP-088, OP-092, OP-093) — und in allen drei Fällen war der **Rest**
schlimmer als die Behauptung. Das ist die zweite Beobachtung dieses Strangs:
wo ein Bericht altert, altert er selten in die harmlose Richtung.

---

## 2. OP-047 — vier Schreibwege in den Audit-Trail ohne Test

**Befund.** Sechs Stellen schreiben über `writeAuditEntry()`. Zwei sind
gepinnt (`document-signature-requests.test.ts`, `documents-upload-immutability.test.ts`),
vier nicht: `lib/documents/controlled-copy.ts`, `documents/[id]/erase`,
`documents/[id]/verify-integrity`, `processes/bulk`.

**Reproduktion.** `grep -rn "audit-entry" apps packages` liefert die sechs
Aufrufstellen und genau eine Testdatei. `documents-controlled-copy.test.ts`
existiert zwar, aber sie mockt `drizzle-orm` mit `sql: noop` und ersetzt
`recordControlledCopyDownload` durch einen `vi.fn()` — der Schreibweg ist darin
konstruktionsbedingt unsichtbar. Genau diese Blindstelle hat den ursprünglichen
Defekt acht Monate getragen: Migration `0407` entzieht `grc_app` INSERT auf
`audit_log`, die acht damaligen `tx.insert(auditLog)` antworteten `42501`, jeder
Aufruf endete in 500, und die Ereignisse fehlten vollständig.

**Wächter.** `apps/web/src/__tests__/api/audit-entry-write-paths.test.ts`, 12
Tests. Der `drizzle-orm`-Mock behält hier sein `sql`-Template — nur so ist der
SECURITY-DEFINER-Aufruf im Test überhaupt lesbar. Jeder Pfad wird gegen
dieselbe Zusicherung gefahren, und sie prüft **beide** Hälften des Befunds:

- die Zeile geht durch `write_audit_entry(...)`, nicht über `INSERT INTO audit_log`;
- sie läuft in `withAuditContext` (der Ketten-Trigger aus `0401` liest
  `app.current_org_id` von genau dieser Verbindung);
- und `inserted` enthält für `audit_log` **nichts**.

Dazu die Ränder, an denen ein Trail sonst still etwas Falsches sagt: der
`?raw=1`-Bezug bekommt ein eigenes `actionDetail` (er war vor #S06-08 der
einzige unprotokollierte — die Beweislage war invertiert); eine verweigerte
Herausgabe trägt `served: false`; die Massenoperation schreibt **genau einen**
Eintrag mit den tatsächlichen Zahlen (`succeeded: 1, failed: 1`, nicht die
angeforderten); und wo ein Legal Hold die Löschung verweigert, wird **nichts**
geschrieben — ein Wächter, der immer schreibt, belegt nichts.

**Gegenprobe.** In `processes/bulk/route.ts` `writeAuditEntry` wieder durch
`tx.insert(auditLog)` ersetzt: **3 von 12 rot**, mit der Meldung „Die Zeile muss
durch write_audit_entry() gehen … Ausgeführt wurde stattdessen: []".
Zurückgebaut, `git diff` leer, 12/12 grün.

---

## 3. OP-058 — der Smoke, den die 1.170 gewickelten Routen nie hatten

**Befund.** `E2E-TRIAGE.md` §7.5: „Alle sind gewickelt, aber keine wurde zur
Laufzeit überprüft."

**Warum ein Unit-Test das nicht leisten kann.** `all-routes-auth-smoke.test.ts`
fährt alle 1.370 Routen — mit gemocktem `@/lib/api`, gemocktem `@grc/db` und
ohne Session. Es beweist den 401. Über den Erfolgspfad sagt es nichts, und der
Defekt lag genau dort: `200 {"data":[],"total":0}`.

**Wächter.** `apps/web/src/__tests__/rls-route-chain/list-endpoints-smoke.test.ts`
— dieselbe Kette wie ein Browser (`withErrorHandler → withAuth →
establishRequestScopedContext → requireModule → die db-Reads`), gegen eine echte
Datenbank, als Rolle `grc_app`, in einem äusseren `requestDbStorage.run()`-Rahmen.
Elf Listenendpunkte über sieben Module und vier Leseformen: ORM-Select mit
`count()` (risks, controls, findings, documents, processes, vendors, assets,
work-items, isms/incidents), roher `db.execute`-SQL (users) und die
Descendant-Scope-Abfrage auf `audit_log`, dessen Tabelle als einzige abweichende
GRANTs trägt (0407).

Je Endpunkt eine Zeile in Org A **und** eine in Org B. Die Zeile von Org B ist
nicht Zierde: ohne sie wäre „nur eigene Zeilen" auch dann erfüllt, wenn es keine
fremden gäbe. Der Audit-Eintrag wird über `write_audit_entry()` gesetzt, nicht
per INSERT — ein Testaufbau, der die Kette umgeht, prüft danach eine Tabelle,
die es so in Produktion nicht gibt.

Die Zusicherung ist **„mindestens eine Zeile"**, nicht „Status 200": 200 _war_
der Defekt. Dazu ein zwölfter Test, der dieselben elf Endpunkte ohne Session
fährt und 401/403 verlangt — sonst könnte „mindestens eine Zeile" auch von einer
Route kommen, die gar nicht prüft, wer fragt.

**Gegenprobe — und eine Berichtigung an der eigenen Erwartung.** Der erste
Versuch war, einer Route `withErrorHandler` wegzunehmen (`assets`). Der Test
blieb **grün**. Gemessen und verstanden: der äussere `requestDbStorage.run()`
dieser Datei stellt denselben Store bereit, den der Wrapper öffnen würde, also
greift der Vorzugspfad in `establishRequestScopedContext` auch ohne ihn. Was der
Smoke tatsächlich hält, ist die **Herstellung des Mandantenkontexts**, nicht die
Anwesenheit des Wrappers — und das steht jetzt so im Kommentar über der
Zusicherung, statt eine stärkere Aussage zu behaupten als gemessen.

Die wirksame Gegenprobe: in `lib/api.ts` `requestDbStorage.getStore()` durch
`undefined` ersetzt, sodass der Fallback-Pfad (`enterWith`) greift — genau der
Mechanismus von C-01. Ergebnis: **11 von 12 rot**, jeder mit 200 und 0 Zeilen.
Der 401-Test blieb grün, was zeigt, dass die beiden Zusicherungen unabhängig
sind. Zurückgebaut, 12/12 grün.

---

## 4. OP-088 — fünf ungeprüfte Tabellen, aber andere fünf

**Befund laut Register.** `asset_classification_override`, `control_embedding`,
`framework_mapping`, `notification_preference`, `programme_template`.

**Gemessen am 2026-09-03** gegen eine von Null migrierte Datenbank
(426 Migrationen, 614 Tabellen), Seed + Probe des RLS-Systemtests:

| Tabelle                         | Register  | gemessen                                                      |
| ------------------------------- | --------- | ------------------------------------------------------------- |
| `asset_classification_override` | ungeprüft | ungeprüft — `CHECK (length(reason) >= 20)`                    |
| `control_embedding`             | ungeprüft | ungeprüft — `vector(1536) NOT NULL`                           |
| `framework_mapping`             | ungeprüft | **kein `org_id`, `relrowsecurity = false`** — plattformglobal |
| `programme_template`            | ungeprüft | **kein `org_id`, `relrowsecurity = false`** — plattformglobal |
| `notification_preference`       | ungeprüft | **geprüft** (2 Zeilen im Seed)                                |
| `retention_binding`             | —         | **ungeprüft** — Werteliste ohne `::text`-Cast                 |
| `wb_case_evidence`              | —         | **ungeprüft** — spaltenübergreifende CHECK                    |
| `audit_anchor_seal`             | —         | **ungeprüft** — `UNIQUE … NULLS NOT DISTINCT`                 |
| `retention_run_log`             | —         | **ungeprüft** — `bigint`-Primärschlüssel                      |

Es sind also nicht dieselben fünf, und zwei der genannten sind zu Recht nicht
dabei. Wichtiger ist der Grund, aus dem die Verschiebung niemandem aufgefallen
ist: der Test schrieb die Liste in ein `console.warn` und liess bis zu **20**
nicht seedbare Objekte durchgehen. Vitest zeigt die Ausgabe eines grünen Tests
nicht. Ein Budget, das nie ausgeschöpft wird, ist keine Grenze.

**Reparatur, fünf Regeln — vier davon generisch.**

1. **Werteliste ohne Cast.** `_wp2_check_literal` verlangte
   `(col)::text = ANY`. PostgreSQL schreibt den Cast nur für `varchar`; bei
   einer `text`-Spalte steht `CHECK ((strategy = ANY (ARRAY['hard_delete'::text, …])))`.
   Der Cast ist jetzt optional.
2. **Mindestlänge.** Neues `_wp2_check_minlen()` liest `length(col) >= N` aus
   der Constraint und füllt die erzeugte Zeichenkette auf — bis zur
   Höchstlänge, nicht pauschal (eine pauschal verlängerte Zeichenkette bricht
   Tabellen mit `varchar(n)`).
3. **pgvector.** `vector(1536)` fiel in den ELSE-Zweig und lieferte `NULL`. Die
   Dimension wird aus `format_type` gelesen; kein Nullvektor, weil die
   HNSW-Cosinus-Distanz für ihn nicht definiert ist.
4. **Zwei Ausnahmen von „NULLable → überspringen".** Eine NULLable Spalte
   bekommt einen Wert, wenn sie (a) in einer CHECK ihrer Tabelle vorkommt
   (`wb_case_evidence.stored_at` — `is_immutable` hat den Default `true` und
   verlangt dann drei NOT-NULL-Werte) oder (b) zu einem UNIQUE-Index mit
   `NULLS NOT DISTINCT` gehört (`audit_anchor_seal.prev_seal_hash` — beide
   Mandantenzeilen bekamen NULL und kollidierten). Eine Spalte **mit** Default
   bleibt unangetastet: der Default ist eine Aussage des Schemas.
5. **`_wp2_seed_ids.id` ist `text` statt `uuid`.** Fünf Tabellen tragen einen
   `bigint`-Schlüssel; ihre Kennung liess sich nicht ablegen, `new_id` blieb
   NULL, und der Probe-Teil (`WHERE a.id IS NOT NULL`) übersprang sie
   **ohne Fehlermeldung**. `retention_binding` und `retention_run_log` tragen
   `org_id` und RLS — mandantenbezogen und ungeprüft, ohne irgendwo
   aufzutauchen. Verglichen wird jetzt `id::text`.

**Zahlen.** Per Zeilenprobe geprüfte Objekte **543 → 549**; Seed-Fehler
**9 (auf 5 Tabellen) → 0**.

**Wächter.** Der Test verlangt jetzt eine **leere** Fehlerliste statt „< 20",
mit einer Ausnahmeliste `AKZEPTIERT_UNSEEDBAR`, die heute leer ist und deren
überholte Einträge ebenfalls rot machen — eine Ausnahmeliste, die nicht
schrumpfen muss, ist keine. Die fünf Tabellen stehen zusätzlich **namentlich**
in der Pflichtliste: eine blosse Zahl erlaubt es, eine Tabelle gegen eine andere
zu tauschen, ohne dass etwas rot wird, und genau das ist zwischen WP2 und heute
passiert.

**Gegenprobe.** Den Seed auf den Stand von `HEAD` zurückgesetzt und den neuen
Test laufen lassen: **2 von 22 rot** — „seed must cover
asset_classification_override" und „nicht seedbare Objekte … expected [ …(5) ]
to deeply equal []". Zurückgebaut, 22/22 grün, RLS-Suite 167/167.

---

## 5. OP-092 — ein Tor, das nicht fehlschlagen konnte

**Befund laut Register.** „CI-Gate `audit-rls-coverage.mjs --check` und die
RLS-Suite mit `APP_DATABASE_URL` fehlen in `ci.yml`."

**Gemessen: die zweite Hälfte ist erledigt.** `ci.yml` setzt
`APP_DATABASE_URL=postgresql://grc_app:…` auf dem Schritt „RLS isolation tests"
(und auf „Route-chain RLS test"). Der Registereintrag ist insoweit überholt.

**Die erste Hälfte ist schlimmer als beschrieben.** Der Ersatzschritt lautete:

```bash
node scripts/audit-rls-coverage.mjs | tee /tmp/rls-coverage.txt
GAPS=$(awk -F, 'NR>1 && $7 != "OK" …' docs/security/rls-coverage-report.csv)
```

GitHub Actions setzt für ein `run:` ohne `shell:` die Shell `bash -e {0}` —
mit `errexit`, **ohne** `pipefail`. Der Exit-Code einer Pipeline ist der des
letzten Glieds, also der von `tee`, und `tee` gelingt immer. Danach liest `awk`
die **eingecheckte** CSV. Nachgestellt:

```
$ bash -e gate-probe.sh          # node bricht mit exit 1 ab
boom
RLS-Luecken: 0
exit=0
```

Bricht das Messskript ab — keine Datenbank, fehlende Abhängigkeit, SQL-Fehler —,
bewertet der Schritt eine Datei aus dem Repository statt der Datenbank, findet
dort 0 Lücken und wird grün. Das ist dieselbe Klasse wie die beiden Tore, die
der Audit schon gefunden hat.

**Und die Begründung darüber war falsch.** Der Kommentar sagte, `--check`
scheitere am Datenbanknamen in der Kopfzeile. `stripGenerated()` im Werkzeug
entfernt die Zeile `Erzeugt mit …` ausdrücklich. Zeichenweise verglichen ist die
**einzige** Abweichung die Prettier-Formatierung der Tabellen-Trennzeilen:

```
committed: … | Status | Anzahl | | ------------------ | ------- | | OK | 561 |
generiert: … | Status | Anzahl | |---|---| | OK | 561 |
```

Der Vergleich kollabiert Leerraum, aber nicht die Bindestrichlänge.

**Reparatur — zwei Schritte mit je einer Aussage.**

1. **`RLS-Abdeckung — 0 Luecken`**, `shell: bash` (schaltet `pipefail` mit ein),
   `set -euo pipefail`, keine Pipe. Erst Schreibmodus, dann `--check`: nach dem
   Schreiben ist die Datei-Bedingung trivial erfüllt, und der Exit-Code sagt
   genau eins — hat die Datenbank eine RLS-Lücke.
2. **`RLS-Report entspricht dem gemessenen Ist`**: `git ls-files --error-unmatch`
   **vor** dem Vergleich (ein `git diff` auf ignorierte Pfade war C-15/OP-066),
   dann Kopfzeile auf den eingecheckten Wert zurücksetzen, prettier darüber,
   `git diff --exit-code`.

**Gegenproben, alle gemessen.**

| Bedingung                                                | Ergebnis                                       |
| -------------------------------------------------------- | ---------------------------------------------- |
| Messskript bricht ab (alter Schritt)                     | **Exit 0** — das Tor konnte nicht fehlschlagen |
| `ALTER TABLE risk DISABLE ROW LEVEL SECURITY`, `--check` | **Exit 1**, „RLS_MISSING TENANT risk"          |
| Datenbank driftet vom eingecheckten Report               | **Exit 1**, Diff über beide Dateien            |
| Datenbank stimmt mit dem Report überein                  | **Exit 0** — der Schritt kann auch bestehen    |

Der letzte Punkt ist nicht selbstverständlich: ein Tor, das nie grün werden
kann, wird abgeschaltet, und dann ist es genauso wertlos wie eines, das nie rot
wird. Beim ersten Entwurf brach der Schritt mit **141** ab —
`git show … | grep -m1` beendet `grep` vorzeitig, `git show` bekommt SIGPIPE,
und unter `pipefail` ist das ein Fehlschlag. Behoben, indem `grep` zu Ende liest.

**Zusätzlicher Wächter für die zweite Hälfte.**
`packages/db/tests/rls/runtime-role-not-privileged.test.ts`. Der globale
`db`-Proxy nimmt `APP_DATABASE_URL ?? DATABASE_URL` — ein lautloser Fallback auf
den Superuser `grc`, der RLS **unabhängig von FORCE** umgeht. Die Suite wird
dann nicht rot, sondern grün: jede Zusicherung „der fremde Mandant ist nicht
sichtbar" prüft eine Datenbank, in der RLS gar nicht greift. Der Test verlangt
`appDatabaseUrlSet`, `isSuperuser: false`, `canBypassRls: false` — und liest
danach eine Zeile, die der Admin nachweislich sieht und der Laufzeit-Pool ohne
Mandantenkontext nicht. Ohne die Zeile wäre „0 Treffer" kein Ergebnis, sondern
die Abwesenheit von Daten.

Gegenprobe: derselbe Lauf ohne `APP_DATABASE_URL` → **2 von 2 rot**.

---

## 6. OP-155 — der Wächter, der da ist und nicht wirkt

**Befund.** Der Schema-Drift-Endpunkt vergleicht Tabellen, Spalten, Typen,
Nullability und RLS — nicht den ENABLE-Zustand der Trigger.

**Warum das der wichtigste Punkt dieses Strangs ist.** Welle 1b hat gemessen,
dass `ALTER TABLE … ENABLE TRIGGER ALL` nur einen Zielzustand kennt: `'O'`
(origin). Ein Trigger, der vorher `ENABLE ALWAYS` (`'A'`) war, kommt als
origin-only zurück und feuert danach unter `session_replication_role = 'replica'`
**nicht mehr**. Genau so sind die 17 Wächter des Audit-Trails gebaut. Nach einer
solchen Rückstufung steht der Trigger unverändert in `pg_trigger`, mit
unveränderter Definition, und ist wirkungslos, sobald jemand als
Replikationsrolle schreibt — Seed, Datenmigration, Cleanup-Skript. Für ein
Deploy-Gate ist das der Unterschied zwischen „Guard vorhanden" und „Guard wirkt".

**Warum ein Register im Code und keine Ableitung aus den Migrationen.**
Gemessen: ein Textscan über `packages/db/drizzle/*.sql` nach
`ENABLE ALWAYS TRIGGER <name>` findet **11** Namen. Die Datenbank trägt **17**.
Die fehlenden sechs werden in einer Schleife gesetzt —
`0401_audit_chain_assign_and_guards.sql:458`:

```sql
EXECUTE format('ALTER TABLE public.%I ENABLE ALWAYS TRIGGER %I', t, t || '_no_truncate');
```

Ein Soll-Zustand, der ein Drittel der Wächter übersieht, ist schlechter als
keiner. `ALWAYS_ENABLED_GUARDS` führt deshalb alle 17 namentlich, jeder mit
einer Begründung, wovor er schützt.

**Vier Befundklassen.**

| Klasse                | Bedeutung                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `guard-missing`       | Registrierter Wächter fehlt in der Datenbank ganz.                                                |
| `guard-not-always`    | Er steht nicht mehr auf `ENABLE ALWAYS` — der Fall aus 1b.                                        |
| `trigger-disabled`    | Irgendein Trigger steht auf `'D'`; ein abgeschalteter Trigger sieht aus, als wäre er da.          |
| `unregistered-always` | `'A'` in der Datenbank, aber nicht im Register — sonst bliebe die Liste hinter dem Schema zurück. |

Die letzte Klasse ist die Gegenrichtung, ohne die ein Register altert: ein neuer
Wächter aus einer Migration macht den Vergleich rot, bis ihn jemand einträgt.
`NOT tgisinternal` schliesst die RI-Constraint-Trigger aus, die PostgreSQL
selbst anlegt (auf `document` allein 36) — sie würden die 17 begraben.

**Reichweite.** `triggerDrift` geht in `healthy` ein, erscheint im Endpunkt
(`/api/v1/health/schema-drift`) und lässt den CLI-Lauf
`tests/schema-drift-report.ts --fail-on-drift` fehlschlagen — ohne Schalter und
ohne Übergabefrist: anders als bei der RLS-Drift von damals gibt es keinen
bekannten Restbestand, den ein anderes Arbeitspaket erst abbauen müsste.
`compareSchema` bekommt den Trigger-Zustand als **Pflichtparameter**; ein
optionaler wäre entweder laut am falschen Ort (17 fehlende Wächter bei jedem
Aufrufer, der ihn vergisst) oder still (nicht vergleichen) — und still ist genau
der Zustand, den OP-155 beschreibt.

**Wächter mit eingebauter Gegenprobe.**
`packages/db/tests/integration/schema-drift-triggers-live.test.ts` fährt gegen
die laufende Datenbank und **stellt den Defekt selbst her**:

```
ALTER TABLE audit_log DISABLE TRIGGER ALL;
ALTER TABLE audit_log ENABLE  TRIGGER ALL;
→ audit_log_refuse_delete_trg: 'A' → 'O'
→ compareTriggers meldet guard-not-always
→ Zustand je Trigger einzeln wiederhergestellt, danach 0 Drift
```

Wiederhergestellt wird je Trigger einzeln, nicht mit `ENABLE TRIGGER ALL` — das
ist der Befehl, der den Schaden anrichtet. Gemessen nach dem Lauf: 17 × `'A'`,
646 × `'O'`, und auf `audit_log` 5 nicht-interne auf `'A'`, 4 interne auf `'O'`.

Dazu sechs Unit-Tests über die Logik und ein Live-Test, der das Register gegen
die Datenbank abgleicht — inklusive einer Zusicherung, dass die Abfrage
überhaupt Trigger liest (`> 100`): sonst wäre `triggerDrift: []` kein Ergebnis,
sondern nur die Abwesenheit einer Messung.

---

## 7. OP-093 — der a11y-Lauf, der lief und keinen Namen hatte

**Befund laut Register.** „a11y-Lauf gehört in dieselbe CI-Stufe wie die
Unit-Tests … heute läuft er nicht bei jedem PR."

**Gemessen: er lief bereits.** `apps/web/vitest.config.ts` sammelt
`src/__tests__/**/*.test.ts(x)`; `src/__tests__/a11y/` steht nicht in `exclude`.
`npx turbo test` im Job „Unit Tests" führt also 4 Dateien mit 30 Tests mit aus.
Der Registereintrag ist überholt.

**Was trotzdem fehlte.** Er lief **namenlos**. Fällt das Verzeichnis aus dem
Glob — umbenannt, verschoben, oder in `exclude` aufgenommen, wie es
`src/__tests__/rls-route-chain/**` aus gutem Grund ist —, sinkt nur eine
Testzahl. Genau so ist `rls-route-chain` aus dem Standardlauf verschwunden und
brauchte später einen eigenen CI-Schritt.

**Reparatur.** Ein benannter Schritt im Job `unit-tests`, ohne
`--passWithNoTests`.

**Gegenproben, beide Fehlermodi gemessen.**

| Bedingung                                                               | Ergebnis                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------ |
| Verzeichnis weg (`vitest run src/__tests__/a11y-verschoben`)            | **Exit 1**, „No test files found"                |
| a11y-Verstoss (`--color-gray-500` in `globals.css` auf `oklch(0.84 …)`) | **Exit 1**, 5 Tests rot, u. a. „…erreicht 4.5:1" |

Die Änderung an `globals.css` war eine Messung, kein Eingriff: zurückgebaut,
`git diff` leer, 30/30 grün.

---

## 8. OP-163 — `both-lossy` konnte nicht auftreten

**Befund.** `shadowCompare` vergleicht die exportierten Dokumente nur bei
`compareXml === true`. Kein Aufrufer setzt das. `lossySignatures()` erzeugt
ausschliesslich `xml/…`-Signaturen, und `classify` vergibt `both-lossy` allein
über diese Menge — die Klasse war unerreichbar. Die Null im Bericht hiess nicht
„bpmn-moddle verliert nichts", sondern „auf dieser Ebene wird nicht gemessen".

**Reproduktion.** Schalter versuchsweise gesetzt, Lauf über das Korpus:

| Lauf                   | vorher                          | mit XML-Vergleich (roh)                             |
| ---------------------- | ------------------------------- | --------------------------------------------------- |
| Import über das Korpus | `intentional: 20`               | `intentional: 20, unclassified: 260, both-lossy: 6` |
| 8 editierte Sequenzen  | `ours-wrong: 1, intentional: 1` | `+ unclassified: 106, both-lossy: 6`                |

Das erklärt, warum der Schalter aus war („der XML-Diff ist noisy"). Es erklärt
aber auch, warum die Begründung nicht mehr trägt: **254 der 260** Differenzen
stammen aus `{…DI}`/`{…DC}` — Bounds, Waypoints, BPMNShape-/BPMNEdge-Kennungen,
BPMNPlane-Präsenz. Diese Ebene vergleicht `compareSnapshots` bereits, und zwar
**mit Toleranzen** (`BOUNDS_TOLERANCE_PX = 1`, `WAYPOINT_TOLERANCE_PX = 2`). Der
XML-Diff kennt sie nicht und meldet eine 1-px-Abweichung, die eine Ebene höher
als gleich gilt, als harte Differenz.

**Zweiter, ernsterer Fund: die sechs `both-lossy` waren falsch.**
`diffCanonical` ist ein LCS-Diff über die Zeilen einer **sortierten** kanonischen
Form. Fällt ein einziges Attribut weg, ändert sich der Sortierschlüssel seines
Elements, und der ganze Block wandert — der Diff meldet ihn als „entfernt" plus
„hinzugefügt". Gemessen an `synth-boundary-events`: der Modell-Round-Trip
verliert **genau ein** Attribut, `@cancelActivity="true"` (bpmn-moddle schreibt
Vorgabewerte nicht zurück), und produziert daraus **23 Diff-Zeilen** und **12
Signaturen**, darunter `outgoing/<outgoing>` und `text "Flow_Fehler"`.

Da eine Signatur bewusst inhaltsfrei ist (Elementtyp plus Attributname), passte
`xml/{…}outgoing/<{…}outgoing>` anschliessend auf **jede** `outgoing`-Differenz
irgendeines anderen Dokuments — und hätte dort „bpmn-moddle verliert das
ohnehin" behauptet, wo bpmn-moddle nichts verliert. Genau das war der Grund für
die auffällige Asymmetrie im Rohlauf: `outgoing` galt als `both-lossy`,
`incoming` blieb unklassifiziert, obwohl beides derselbe Sachverhalt ist.

**Reparatur, drei Teile.**

1. **`compareXml` ist standardmässig an** (`!== false` statt `=== true`).
2. **`compareXml` filtert die Zeichenebene** (`isDiagramInterchange`): die drei
   DI/DC-Namensräume gehören `compareSnapshots`, dort mit Toleranz. Zweimal
   gemeldet, einmal davon ohne Toleranz, ist schlechter als einmal gemeldet.
3. **`lossySignatures()` zählt nur den Überschuss.** Eine Zeile, die vorher
   **und** nachher im Dokument steht, ist kein Verlust, egal wo der Diff sie
   einsortiert. Die Verlustmenge wird als Multimengen-Differenz über den
   Zeilentext gebildet.

**Zahlen nach der Reparatur.**

| Grösse                                      | vorher | nachher |
| ------------------------------------------- | ------ | ------- |
| Verlustsignaturen über das Korpus           | 24     | **13**  |
| davon auf `synth-boundary-events`           | 12     | **1**   |
| unklassifiziert, Import (mit XML-Vergleich) | 260    | **12**  |
| unklassifiziert, 8 Sequenzen                | 106    | **12**  |

Die 13 verbliebenen Verlustsignaturen sind alle derselbe, nachvollziehbare Fall:
Attribute mit Vorgabewert (`cancelActivity`, `instantiate`, `eventGatewayType`,
`isCollection`, `isSequential`, `expressionLanguage`, `typeLanguage`) plus
Kommentare und Processing Instructions.

**Was übrig bleibt, ist ein echter Befund.** Die 12 verbliebenen Differenzen
sind eine einzige Klasse: ARCTOS schreibt `<bpmn:incoming>`/`<bpmn:outgoing>`
auf Flussknoten, die das Quelldokument **ohne** diese Verweise enthält. Gemessen
an `synth-boundary-events`, load+save mit **null** Operationen:

```
source vs ARCTOS : 35 semantische Differenzen
source vs bpmn-js: 23 semantische Differenzen
```

Die zwölf zusätzlichen sind genau die Verweise, die ARCTOS auf `Sub_Start`,
`Sub_Task` und `Sub_End` des Teilprozesses `Sub_Pruefung` ergänzt. Die übrigen
23 teilen beide Engines.

Semantisch gleichwertig — `incoming`/`outgoing` sind laut Metamodell ableitbar,
ihr Fehlen ist zulässig. Trotzdem ein Befund: es ist eine Byte-Änderung an einem
Dokument, das niemand bearbeitet hat, und damit ein Verstoss gegen Plan §5.1 Z-D
(read-preserve-write). Wer eine Datei öffnet und wieder schliesst, bekommt einen
Diff in seiner Versionsverwaltung. Die Modell-Ebene macht das **nicht**
(`importXml`/`exportXml` lassen die Knoten unverändert, gemessen über
`lossySignatures`); es entsteht in der Modellierungsschicht. Als `ours-wrong`
klassifiziert und an den Modellierungs-Strang weitergereicht — nicht
weggeschwiegen und nicht in `intentional` umdefiniert.

**Wächter.** `packages/bpmn/test/verify/shadow-xml-compare.test.ts`, 7 Tests mit
Attrappen-Treibern. Die Attrappen sind hier nicht Ersatz, sondern Instrument: um
zu zeigen, dass eine Divergenzklasse den Weg durch die Klassifikation findet,
muss man sie erzeugen können, und mit zwei echten Engines liesse sie sich nur
beobachten. Der letzte Test ist die Reproduktion des Befunds selbst: mit
`compareXml: false` — dem Zustand vor dieser Welle — bleibt `both-lossy` leer,
obwohl dieselben zwei Dokumente denselben Unterschied tragen.

**Gegenproben, je einzeln.**

| Rückbau                                       | rot                                                                   |
| --------------------------------------------- | --------------------------------------------------------------------- |
| `compareXml !== false` → `=== true`           | „meldet eine semantische Differenz OHNE gesetzten Schalter"           |
| DI-Filter entfernt                            | „meldet eine reine Geometriedifferenz NICHT als XML-Divergenz"        |
| Multimengen-Abgleich in `lossySignatures` aus | „zählt eine verschobene Zeile nicht als Verlust" (9 statt 1 Signatur) |

---

## 9. Abnahme

Alle Zahlen aus Läufen dieses Strangs, gegen
`postgres://grc@127.0.0.1:5432/final_verify` (426 Migrationen, 614 Tabellen)
bzw. `grc_app` für die RLS-Suiten.

| Prüfung                                          | vorher                    | nachher                      |
| ------------------------------------------------ | ------------------------- | ---------------------------- |
| `apps/web` (`npx vitest run`)                    | 113 Dateien / 2.669 Tests | ✅ **114 / 2.681**           |
| `apps/web` Route-Chain (`vitest.rls.config.ts`)  | 3 / 12                    | ✅ **4 / 24**                |
| `packages/db` (`npx vitest run`)                 | 8 / 107                   | ✅ **8 / 114**               |
| `packages/db` Integration                        | 8 / 101                   | ✅ **9 / 105**               |
| `packages/db` RLS (`vitest.rls.config.ts`)       | 15 / 165                  | ✅ **16 / 167**              |
| `packages/bpmn` (`npx vitest run`)               | 57 / 902                  | ✅ **58 / 909**              |
| `apps/worker` (`npx vitest run`)                 | 132 (+1 skip) / 388 (+6)  | ✅ **unverändert**           |
| `npm test -w @grc/db` (Unit + Integration + RLS) | —                         | ✅ grün                      |
| `tsc --noEmit` über 13 Projekte                  | 0 Fehler                  | ✅ **0 Fehler**              |
| `npx prettier --check .`                         | grün                      | ✅ grün                      |
| `node scripts/lint-ratchet.mjs`                  | 306 (Baseline 306)        | ✅ **306**, keine Regression |
| `node scripts/check-gate-inputs.mjs`             | grün                      | ✅ 7 Tor-Eingaben            |
| `node scripts/coverage-gate.mjs`                 | grün                      | ✅ keine Regression          |
| Schema-Drift-CLI (`--fail-on-drift`)             | —                         | ✅ 0 / 0 / 0 / **0 Trigger** |
| RLS-Zeilenprobe (Objekte)                        | 543                       | ✅ **549**, 0 Seed-Fehler    |
| `ENABLE ALWAYS`-Wächter nach allen Läufen        | 17                        | ✅ **17** (`'A'`), 646 `'O'` |

**Keine Migration.** Der zugewiesene Bereich 0477–0480 ist unberührt: kein Punkt
dieses Strangs brauchte eine Schemaänderung.

---

## 10. Was weitergeht

- **OP-027 (E2E auf der BPMN-Fläche) und OP-036 (Leistungsbudget)** —
  ausgenommen und **nicht** geschrieben. Beide brauchen einen Produktionsbau,
  und der ist durch OP-167 blockiert (Fremdfehler in Next.js). Ein E2E-Test, den
  niemand hat laufen sehen, wäre genau die unverdiente grüne Zahl, gegen die
  dieses Projekt angetreten ist.
- **`ours-wrong`: ARCTOS ergänzt `incoming`/`outgoing`** (neu, aus OP-163). Die
  Modellierungsschicht schreibt Verweise zurück, die das Quelldokument nicht
  hatte — Verstoss gegen Z-D, semantisch harmlos, in der Versionsverwaltung
  sichtbar. Gehört zum Modellierungs-Strang, nicht zum Prüfstand.
- **`docs/security/rls-coverage-report.md` und prettier.** Die saubere Lösung
  wäre, den Report wie `docs/openapi.yaml` in `.prettierignore` aufzunehmen
  (dort steht die Begründung wörtlich: „Der Generator schreibt … nach seinen
  Regeln, nicht nach prettiers") **oder** `--check` formatunabhängig zu
  vergleichen. Beide Dateien — `.prettierignore` und
  `scripts/audit-rls-coverage.mjs` — liegen ausserhalb der Dateihoheit dieses
  Strangs; der CI-Schritt gleicht die Formatierung deshalb an Ort und Stelle
  aus, was funktioniert, aber eine Zeile Werkzeugarbeit spart, die dort besser
  aufgehoben wäre.
- **Verwaiste Audit-Zeilen in `final_verify`.** Die Prüfdatenbank trägt 1.188
  `audit_log`-Zeilen, deren Organisation nicht mehr existiert — Rückstand
  früherer Wellen, entstanden aus `DELETE … WHERE org_id` unter
  `session_replication_role = 'replica'` bei append-only `audit_log`. Die beiden
  neuen DB-Tests dieses Strangs vermeiden das (der eine unterdrückt die
  Audit-Trigger beim Anlegen, der andere lässt die Organisation stehen, wenn
  Audit-Zeilen auf sie zeigen). Der Altbestand bleibt; er lässt sich nur durch
  ein Neuaufsetzen der Datenbank beheben.
- **`compareSchema` hat jetzt fünf Pflichtparameter.** Der nächste Aspekt
  (Sequenzen, Rechte, Kommentare) macht es sechs. Ab dort ist ein Objekt als
  Parameter fällig; heute wäre die Umstellung reine Formarbeit ohne Nutzen.

---

## 11. Korrekturen am Register

| Punkt      | Was das Register sagt                                                                                                                              | Was gemessen wurde                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **OP-088** | Die fünf Tabellen sind `asset_classification_override`, `control_embedding`, `framework_mapping`, `notification_preference`, `programme_template`. | Es sind fünf **andere**: `asset_classification_override`, `control_embedding`, `retention_binding`, `wb_case_evidence`, `audit_anchor_seal`. `framework_mapping` und `programme_template` tragen kein `org_id` und keine RLS — plattformglobal, zu Recht nicht mandantengeprüft. `notification_preference` war bereits wieder erreichbar. Zusätzlich ungeprüft: `retention_run_log`. |
| **OP-092** | „`--check` und die RLS-Suite mit `APP_DATABASE_URL` fehlen in `ci.yml`."                                                                           | `APP_DATABASE_URL` steht seit WP2/WP11 in `ci.yml`. `--check` fehlte tatsächlich — der vorhandene Ersatzschritt konnte aber **überhaupt nicht fehlschlagen** (fehlendes `pipefail` plus Auswertung der eingecheckten CSV). Das ist der schwerere Befund und stand nicht im Register.                                                                                                 |
| **OP-092** | (Kommentar in `ci.yml`) „`--check` scheitert am Datenbanknamen in der Kopfzeile."                                                                  | Falsch: `stripGenerated()` entfernt die Zeile. Die einzige Abweichung ist die Prettier-Formatierung der Tabellen-Trennzeilen.                                                                                                                                                                                                                                                        |
| **OP-093** | „heute läuft er nicht bei jedem PR."                                                                                                               | Er lief: 4 Dateien, 30 Tests, über den Glob von `apps/web/vitest.config.ts` im Schritt „Run tests". Offen war nur, dass er keinen Namen hatte und deshalb still verschwinden konnte.                                                                                                                                                                                                 |
| **OP-163** | „die Klasse `both-lossy` kann heute gar nicht auftreten."                                                                                          | Bestätigt — und die sechs `both-lossy`, die beim blossen Einschalten des Schalters erschienen, waren **falsch**: Sortierverschiebungen des LCS-Diffs, keine Verluste. Ohne die Korrektur an `lossySignatures()` hätte das Einschalten das Urteil an Stellen vergeben, an denen bpmn-moddle nichts verliert.                                                                          |
| **OP-047** | „4 von 6 reparierten Schreibwegen ohne Test."                                                                                                      | Bestätigt, unverändert.                                                                                                                                                                                                                                                                                                                                                              |
| **OP-058** | „Kein Smoke-Durchlauf über die grossen Listenendpunkte."                                                                                           | Bestätigt, unverändert.                                                                                                                                                                                                                                                                                                                                                              |
| **OP-155** | „Schema-Drift-Endpunkt vergleicht den ENABLE-Zustand von Triggern nicht."                                                                          | Bestätigt, unverändert. Ergänzung: eine Ableitung des Soll-Zustands aus den Migrationstexten wäre unbrauchbar — sie fände 11 der 17 Wächter.                                                                                                                                                                                                                                         |
