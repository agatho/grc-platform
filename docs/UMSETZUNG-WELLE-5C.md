# Welle 5c — die vier Codeänderungen, die Welle 5b liegen lassen musste

**Grundlage:** `docs/OFFENE-PUNKTE-REGISTER.md` OP-114, OP-128, OP-112, OP-100
sowie der Nachtrag vom 2026-09-05 (§ „Codeänderungen, die nötig sind und
bewusst NICHT gemacht wurden") · `docs/UMSETZUNG-WELLE-5B.md` §3.6 und §5
**Punkte:** OP-114 (Kern) · OP-128 · OP-112 (gemessen, nicht gebaut) · OP-100 ·
zwei Kommentarkorrekturen · nachgezogen: der blockierende Befund aus 5b §5.1
**Stand:** Branch `audit/full-2026-08-31`, aufsetzend auf `c2eea595`
**Gebiet:** `packages/*/src/**`, `packages/*/tests/**`, `apps/worker/src/**`,
`apps/worker/tests/**`, `scripts/**`, dieses Dokument

---

## 1. Ergebnis in einem Satz

Der BPMN-Excel-Pfad hat die beiden Schichten bekommen, die ihm als einzigem
Einlesepfad fehlten — **756 MB Spitzenspeicher auf 178 MB**, bei einer Datei,
die die vorhandene Schicht 1 anstandslos durchgelassen hat. Dazu ein
Re-Seal-Skript für `WB_ENCRYPTION_KEY`, das gegen echte Chiffrate gelaufen ist,
und ein Nachholabgleich, der einen versäumten Lauf am lebenden `job_run`
erkennt und nachholt.

OP-112 ist **nicht gebaut, sondern gemessen**: der undici-Dispatcher trägt
technisch (mit Beleg), aber `undici` liegt in diesem Baum ausschliesslich als
Entwicklungsabhängigkeit von `jsdom`. `npm ls undici --omit=dev` ist leer. Ein
Import in `url-safety-server.ts` würde in Produktion jeden ausgehenden Aufruf
brechen.

Und, wie in jeder Welle dieses Audits: **die Zahlen in den Kommentaren stimmten
nicht — auch die nicht, nach denen niemand gefragt hatte.**

| Messgröße                                                     |          vorher |           nachher |
| ------------------------------------------------------------- | --------------: | ----------------: |
| BPMN-Excel: Spitzen-RSS bei 200.000 Zeilen (7,72 MB Datei)    |      **756 MB** |        **178 MB** |
| BPMN-Excel: Laufzeit derselben Datei                          |    **5.409 ms** |        **767 ms** |
| BPMN-Excel: Schutzschichten                                   |     **1 von 3** |       **3 von 3** |
| Re-Seal-Weg für `WB_ENCRYPTION_KEY`                           | nicht vorhanden | Skript + 12 Tests |
| Versäumte Cron-Läufe: erkannt / nachgeholt                    | **nein / nein** |       **ja / ja** |
| `no-fabricated-evidence.test.ts:7`: genannte / gezählte Zahl  |         14 / 13 |           13 / 13 |
| `job-run-retention.ts:4`: genannte / gemessene Jobzahl        |       129 / 131 |         131 / 131 |
| `job-run-retention.ts:5`: genannte / gemessene Zeilen pro Tag |  40.000 / 4.053 |     4.053 / 4.053 |
| `scripts/audit-secrets.mjs`: Funde / Exitcode                 |       **2 / 1** |         **0 / 0** |
| Tote Exporte (Ratsche 2765 in 470)                            |   2767 in 471 ✗ |     2464 in 458 ✓ |

---

## 2. OP-114 — der Einlesepfad ohne zweite Schicht

### 2.1 Zuerst messen: Schicht 1 allein genügt nicht

`#S04-04` hat gemessen, dass eine gültige `.xlsx` mit 1,85 Mio. Zeilen auf
9,3 MB komprimiert und `ExcelJS.Workbook.xlsx.load()` daraus 2,26 GB RSS
machte. Der CSV/XLSX-Importpfad
(`apps/web/src/lib/import-export/file-parser.ts`) hat daraufhin drei Schichten
bekommen. `packages/shared/src/lib/excel-to-bpmn.ts:43` hatte nur die erste,
und Welle 5b hat festgehalten, dass der Registertext OP-114 („Zweite und dritte
Schicht fangen es ab") für diesen Aufrufer nicht galt.

Was 5b noch nicht gemessen hat: **Schicht 1 hätte den Angriff auch dann nicht
verhindert, wenn sie perfekt funktioniert.** Sie lehnt ab, was über 100 MB
entpackt. Eigene Messung am 2026-09-05, eine mit `WorkbookWriter` erzeugte
Tabelle mit 200.000 Zeilen:

```
$ node bench-op114.mjs build 200000
built 200000 rows -> 7.72 MB

$ npx tsx -e "inspectZipArchive(...)"
archive 7.72 MB
total uncompressed 67.5 MB; ratio 8.7
  xl/worksheets/sheet1.xml 67.5 MB
```

7,72 MB — unter der 10-MB-Grenze der Upload-Route. 67,5 MB entpackt — unter den
100 MB von `SPREADSHEET_ZIP_LIMITS`. Verhältnis 8,7 : 1 — weit unter der
Schranke von 150 : 1. **Schicht 1 lässt diese Datei durch, und zwar zu Recht:
sie ist keine Bombe, sie ist nur gross.**

Der Rest ist Arithmetik des alten Codes:

```
$ node --max-old-space-size=4096 bench-op114.mjs old
old: 200000 rows kept
old: peak RSS 756 MB, 5409 ms

$ node --max-old-space-size=4096 bench-op114.mjs new
new: 10000 rows kept, limit 10000
new: peak RSS 178 MB, 767 ms
```

Der Speicher des alten Wegs wächst linear mit der Zeilenzahl; die 100-MB-Grenze
aus Schicht 1 erlaubt rund das Anderthalbfache dieser Datei. Der neue Weg ist
nach oben geschlossen — er hört bei 10.000 Zeilen auf, unabhängig davon, was in
der Datei noch käme.

### 2.2 Was gebaut wurde

`convertExcelToBPMN` liest jetzt über `ExcelJS.stream.xlsx.WorkbookReader`,
mit denselben Optionen wie `file-parser.ts`, und prüft zwei Obergrenzen
**bevor** eine Zeile behalten wird:

- `MAX_BPMN_IMPORT_ROWS = 10_000` — jede Zeile wird ein BPMN-Knoten; 10.000
  Aktivitäten sind kein Prozessmodell mehr.
- `maxRows * 32` Zellen — der zweite Weg, an einer reinen Zeilengrenze vorbei
  Speicher zu belegen: wenige Zeilen, zehntausende Spalten.

Beide sind **Konstanten, keine Umgebungsvariablen**. Eine neue
`process.env`-Lesung müsste in `.env.example` nachgezogen werden
(`scripts/check-env-example.mjs` erzwingt das), und ein Schutzwert, den der
Betreiber hochdrehen kann, ist die falsche Voreinstellung. Aufrufer mit
anderem Bedarf übergeben die Grenze als zweites Argument — davon lebt auch der
Test.

Die aufrufende Route (`apps/web/**`, ausserhalb der Dateihoheit) bleibt
unverändert: die Überschreitung kommt als `errors`-Eintrag zurück, und
`import-excel/route.ts:60` macht daraus wie bisher einen 422.

Nebenbei entfallen die beiden `eslint-disable @typescript-eslint/no-explicit-any`
und der `as any`-Cast, den der alte `wb.xlsx.load(Buffer.from(buffer) as any)`
brauchte: `Readable.from(Buffer.from(buffer))` passt ohne Umweg auf die
veröffentlichte exceljs-Signatur. `node scripts/lint-ratchet.mjs` meldet
dadurch eine Verbesserung (siehe §7).

### 2.3 Die Frage, die zuerst zu klären war: darf `node:stream` hier stehen?

`excel-to-bpmn.ts` wird über `packages/shared/src/index.ts:449` re-exportiert
und ist damit aus Client-Komponenten erreichbar — 20 geprüfte
`"use client"`-Dateien importieren aus `@grc/shared`. Der Kommentar in
`index.ts:452` verbietet genau das:

> These modules import node: built-ins (crypto, fs, tls via the OTS lib) and
> cannot be re-exported here or client bundles break.

und `url-safety.ts:404` nennt den Fehler beim Namen: „bundle breaks Next.js
build (UnhandledSchemeError on `node:` prefix)".

**Nachgemessen, statt geglaubt.** Ein minimales Next-Projekt gegen dasselbe
`next@16.2.11` aus diesem Baum, mit genau der fraglichen Form — eine
Client-Komponente, ein Barrel mit `export *`, und dahinter ein Modul mit
`node:stream`:

```
Variante A (statischer Top-Level-Import, Funktion nur re-exportiert)  → EXIT=0
Variante B (statischer Import, Client-Komponente RUFT die Funktion)   → EXIT=0
Variante C (dynamisches `await import("node:stream")`)                → EXIT=0
   ✓ Compiled successfully in 3.7s
```

Die Warnung stammt aus der **Webpack-Zeit**. Next 16 baut hier mit Turbopack
(`next.config.ts` setzt `turbopack.root`, die Bauausgabe meldet
„▲ Next.js 16.2.11 (Turbopack)"), und Turbopack stolpert über das
`node:`-Schema nicht.

Gewählt ist trotzdem der **dynamische** Import, direkt neben dem ohnehin
vorhandenen `await import("exceljs")`. Er hält den statischen Modulgraphen des
Barrels frei von Node-Built-ins, kostet in einer bereits asynchronen Funktion
nichts, und gilt auch dann noch, wenn jemand wieder mit `--webpack` baut. Die
Messung steht als Begründung im Code.

Der vollständige `next build` von `apps/web` ist **nicht** gelaufen: er stand
nach 30 Minuten bei 94 % CPU und 5,6 GB von 8 GB RAM noch in
„Creating an optimized production build" und hätte jede andere Messung dieser
Welle blockiert. `npx tsc --noEmit -p apps/web/tsconfig.json` ist grün (Exit 0).

### 2.4 Der Test, und dass er fällt

`packages/shared/tests/excel-to-bpmn-streaming.test.ts`, sechs Prüfungen, baut
echte `.xlsx`-Dateien mit exceljs:

- Schicht 2: `xlsx.load(` kommt im **Code** (ohne Kommentare) nicht mehr vor,
  `stream.xlsx.WorkbookReader` schon;
- Gleichlauf: eine gewöhnliche Tabelle ergibt dasselbe BPMN wie vorher —
  Aktivitäten, Lanes, fünf `sequenceFlow` bei vier Schritten;
- Schicht 3: Zeilen- und Zellgrenze brechen ab, mit der genauen Meldung;
- die Vorgabegrenze ist um Grössenordnungen strenger als Schicht 1.

Der Kommentarfilter ist kein Detail: die erste Fassung prüfte die rohe Quelle
und fiel an der **Erklärung** von `wb.xlsx.load()` im Kopf der Datei. Ein Test,
der die eigene Begründung für einen Rückfall hält, ist wertlos.

**Fallnachweis gegen den alten Stand** (`git stash push` nur auf
`excel-to-bpmn.ts`, danach `git stash pop`):

```
$ npx vitest run tests/excel-to-bpmn-streaming.test.ts
  × liest die Arbeitsmappe nicht mehr mit xlsx.load() ein
  × bricht ab, sobald mehr Zeilen kommen als erlaubt
  × bricht ab, sobald mehr Zellen kommen als erlaubt
  × hält eine Vorgabegrenze, die kleiner ist als die ZIP-Vorprüfung
AssertionError: expected '<?xml version="1.0" encoding="UTF-8"?…' to be ''
      Tests  4 failed | 2 passed (6)
```

Die dritte Zeile ist der eigentliche Nachweis: der alte Stand hat eine Tabelle
mit zwölf Zeilen bei `maxRows: 5` **fertig umgewandelt**.

---

## 3. OP-128 — Rotation, die eine ist

### 3.1 Was für `WB_ENCRYPTION_KEY` gilt — und was für die anderen beiden

`docs/env-vars-reference.md:53-55` führt drei Schlüssel getrennt, und die
Unterschiede sind der ganze Punkt:

| Schlüssel           | Regel                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `AUDIT_SEAL_KEY`    | **nicht rotierbar, niemals vernichten.** Rotation nur mit neuer `AUDIT_SEAL_KEY_ID` und Aufbewahrung der alten Schlüssel |
| `PII_PSEUDONYM_KEY` | die **Vernichtung** ist der DSGVO-Löschpfad, eigenes Verfahren in `docs/runbook.md` §7 (Vier-Augen-Prinzip)              |
| `WB_ENCRYPTION_KEY` | „Bestandschiffrate nur über `WB_ENCRYPTION_KEY_PREVIOUS` lesbar; **Re-Seal nötig**"                                      |

Nur für den dritten gibt es ein Re-Seal, und nur für ihn darf es eins geben.
Das steht so im Kopf des Skripts, damit die drei bei der nächsten Gelegenheit
nicht doch verwechselt werden.

### 3.2 Die Falle vor der Rotation, die im Register nicht steht

`wb-crypto.ts:getPseudonymKey()` leitet den Pseudonymisierungsschlüssel **aus
`WB_ENCRYPTION_KEY` ab**, wenn `WB_PSEUDONYM_KEY` nicht gesetzt ist. An
`WB_ENCRYPTION_KEY` hängt damit ein zweiter Schlüssel, den kein Re-Seal
reparieren kann: `wb_report.ip_hash` ist ein HMAC über eine IP-Adresse, die
nirgends gespeichert ist.

Gemessen in `packages/shared/tests/wb-crypto-reseal-format.test.ts`:

- ohne gesetztes `WB_PSEUDONYM_KEY` liefert `hashIp()` nach dem
  Schlüsselwechsel einen anderen Wert, und `ipMatchesHash()` auf den alten
  Hash ergibt `false` — **still, ohne Fehlermeldung**;
- mit `WB_PSEUDONYM_KEY` auf dem aus dem ALTEN Schlüssel abgeleiteten Wert
  bleibt beides erhalten.

Das Skript **verweigert deshalb den Dienst**, solange `WB_PSEUDONYM_KEY` nicht
explizit gesetzt ist, und nennt den Befehl, der den Wert erzeugt.
`--allow-derived-pseudonym-key` übergeht das bewusst.

Und dieser Befehl war beim ersten Schreiben selbst falsch — die naheliegende
Form mit drei `-e`-Flags:

```
$ node -e "const c=require('crypto');" -e "console.log(...)" -e ".update(...)"
[eval]:1
.update('wb-pseudonym-v1').digest('hex'))
^
Expression expected
```

`node` wertet bei mehreren `-e` nur das **letzte** aus. Korrigiert auf eine
Zeile mit einem `-e` und wörtlich ausgeführt:

```
$ WB_ENCRYPTION_KEY_PREVIOUS=<alt> node -e "console.log(require('node:crypto')…)"
6c96306c9abf49cce233dfb3bd64e5db3bb0127a4c2b5806adcb7c10d7f1723b
```

Derselbe Wert, den `getPseudonymKey()` intern bildet — der Test rechnet ihn
nach. Ein Ratschlag in einer Sperrmeldung, der nicht läuft, ist dieselbe
Fehlerklasse wie das `grep -l '^-- Breaking: *true'` aus Welle 5b.

### 3.3 Das Skript

`scripts/reseal-wb-secrets.mjs`, gebaut wie
`scripts/encrypt-connector-secrets.mjs` (idempotent, `--dry-run`, gibt niemals
Klartext oder Schlüsselmaterial aus). Vier Spalten, alle über `encrypt()` aus
`@grc/shared` geschrieben:

```
wb_report.description   wb_report.contact_email   wb_case.resolution   wb_case_message.content
```

Drei Entscheidungen, die nicht selbstverständlich sind:

1. **Idempotenz über Probeentschlüsselung, nicht über die Schlüsselkennung.**
   Der Umschlag trägt zwar `v2:<keyId>:…`, aber im Auslieferungszustand ist
   `keyId` für beide Schlüssel `default`. Geprüft wird deshalb: öffnet der
   NEUE Schlüssel die Zeile → überspringen; öffnet nur der ALTE → umschreiben;
   öffnet keiner → **zählen und mit Exit 1 beenden**, nichts anfassen.
2. **Die AAD-Bindung bleibt erhalten.** `wb_case_message.content` trägt je nach
   Schreibpfad `wb_case_message:<caseId>` (Portal) oder gar nichts
   (Sachbearbeitung). Die Bindung steht im Umschlag und wird unverändert
   übernommen — ein Re-Seal, das sie fallen lässt, hebt S07-19.3 auf.
3. **Auch der Probelauf braucht beide Schlüssel.** Ob eine Zeile noch unter dem
   alten liegt, ist nur durch Entschlüsseln feststellbar.

**Gegen die echte Datenbank gelaufen** (`grc_v4c`, ein Bestandsfall mit allen
vier Spalten, danach gelöscht):

```
$ … --dry-run
wb_report.description: 1 non-empty, 0 already on the current key, 1 would re-seal
wb_report.contact_email: 1 non-empty, 0 already on the current key, 1 would re-seal
wb_case.resolution: 1 non-empty, 0 already on the current key, 1 would re-seal
wb_case_message.content: 1 non-empty, 0 already on the current key, 1 would re-seal

$ …            (ohne --dry-run)
wb_report.description: … 1 re-sealed (1 written)      [4 ×]
4 value(s) re-sealed. …then remove WB_ENCRYPTION_KEY_PREVIOUS from the environment

$ …            (zweiter Lauf)
wb_report.description: 1 non-empty, 1 already on the current key, 0 re-sealed (0 written)

$ …            (mit falschem PREVIOUS)
wb_report.description: … 0 would re-seal, 1 UNREADABLE
4 value(s) opened with NEITHER key. Nothing was changed for them.
EXIT=1
```

Nachkontrolle der vier Zeilen, direkt aus der Datenbank gelesen:

```
description   | aad: -                              | NEW: "…" | OLD: null
contact_email | aad: -                              | NEW: "…" | OLD: null
resolution    | aad: -                              | NEW: "…" | OLD: null
message       | aad: wb_case_message:cccccccc-…    | NEW: "…" | OLD: null
```

Der alte Schlüssel öffnet nichts mehr, die Bindung steht. Genau das ist der
Zweck: `WB_ENCRYPTION_KEY_PREVIOUS` darf danach aus der Umgebung.

### 3.4 Das Format steht zweimal da — also wird es geprüft

Eine `.mjs` kann `wb-crypto.ts` nicht importieren. Deshalb liegt das
Umschlagformat als eigenes Modul `scripts/lib/wb-envelope.mjs` (neben dem
bestehenden `scripts/lib/dep-tree.mjs`) statt inline im Skript: als Modul lässt
es sich prüfen.

`packages/shared/tests/wb-crypto-reseal-format.test.ts` (12 Prüfungen)
verschlüsselt mit der einen Seite und entschlüsselt mit der anderen — in beide
Richtungen, mit und ohne AAD, im Alt- und im v2-Format, samt vollständigem
Re-Seal-Durchlauf und Idempotenz-Gegenprobe.

**Gegenprobe durch künstliche Verletzung.** Zwei Versuche, und der erste ist
der lehrreichere:

```
WB_IV_BYTES: 16 → 12    →  Tests 12 passed (12)      — schlägt NICHT an
`v2:` → `v3:`           →  Tests 5 failed | 7 passed — schlägt an
```

Die IV-Länge ist **nicht** der gefährliche Fall: die IV steht im Umschlag, GCM
nimmt jede Länge, `createDecipheriv` bekommt sie zurück. Der Kommentar im Modul
hatte das Gegenteil behauptet („ein Chiffrat mit anderer IV-Länge ist nicht
entschlüsselbar") und ist auf den gemessenen Stand korrigiert. Was wirklich
bricht, ist jede Änderung an der Zerlegung — Präfix, Reihenfolge, Kodierung,
AAD-Abschnitt —, und genau darauf zielt der Test.

---

## 4. OP-112 — der Weg trägt, die Abhängigkeit nicht

Der Auftrag war ausdrücklich: erst prüfen, ob `undici` verfügbar ist, und wenn
der Weg nicht trägt, das **mit Messung** sagen, statt etwas Halbes zu bauen.

### 4.1 Der Mechanismus funktioniert

Ein HTTP-Server auf `127.0.0.1`, ein Hostname, den kein Resolver kennt, und ein
`Agent`, dessen `connect.lookup` die Adresse festnagelt:

```
$ node op112-probe.mjs
status: 200 | body: host=rebind.invalid:35463
lookup calls: [{"hostname":"rebind.invalid","opts":{"hints":32,"all":true}}]
```

Node 22.22.2 nimmt einen fremden Dispatcher in `fetch(url, { dispatcher })` an,
`Host` und TLS-SNI bleiben der Hostname (das Zertifikat wird also weiter gegen
ihn geprüft), und `lookup` wird mit `all: true` gerufen — die Rückgabe muss
deshalb ein **Array** sein. Der erste Versuch mit der Einzeladressform endete
in `Invalid IP address: undefined`; das ist die Stelle, an der eine Umsetzung
ohne Probe scheitert.

### 4.2 Woran es scheitert

```
$ npm ls undici --all
`-- @grc/web@0.1.0 -> ./apps/web
  `-- jsdom@29.1.1
    `-- undici@7.29.0 overridden

$ npm ls undici --all --omit=dev
`-- (empty)
```

`undici` liegt im Baum ausschliesslich als transitive Abhängigkeit von `jsdom`,
und `jsdom` ist eine **devDependency** von `apps/web` (Testumgebung). Eine
Produktionsinstallation (`npm ci --omit=dev`) hat es nicht.

`packages/shared/src/lib/url-safety-server.ts` läuft aber in Produktion — an
ihm hängen `packages/auth/src/oidc/discovery.ts`,
`packages/auth/src/saml/metadata-parser.ts`,
`apps/worker/src/crons/threat-feed-sync.ts` und sieben weitere Aufrufer. Ein
`import`/`await import` auf undici würde dort mit `ERR_MODULE_NOT_FOUND` enden
und **jeden ausgehenden Aufruf brechen** — aus einer Härtung würde ein Ausfall.

Ein optionaler Import mit stillem Rückfall auf ungepinntes `fetch` wäre die
schlechtere Variante desselben Fehlers: eine Schranke, die in Produktion
abgeschaltet ist und nichts davon meldet. Dieser Audit hat neun Tore gefunden,
die genau so gebaut waren.

### 4.3 Was fehlt, ist eine Zeile ausserhalb der Dateihoheit

`"undici": "^7.29.0"` in den `dependencies` von `packages/shared/package.json`,
plus der zugehörige `package-lock.json`-Eintrag. Beide liegen ausserhalb des
Gebiets dieser Welle, und `package-lock.json` ist eine der neun Tor-Eingaben,
die `scripts/check-gate-inputs.mjs` führt. Die Fassung 7.29.0 ist über die
`overrides` der Wurzel ohnehin schon festgenagelt, der Baum enthielte also
keine neue Fassung.

Danach ist der Dispatcher wörtlich einsetzbar: die in
`checkResolvedHostIsPublic` aufgelösten Adressen in ein `lookup` schliessen,
das `all: true` beachtet, und den Agent je Aufruf an `fetch` übergeben. Die
vollständige Messung mit dem lauffähigen Rezept steht als Kommentar am Fuss von
`url-safety-server.ts`; der veraltete Klammerzusatz „(follow-up)" im
Kopfkommentar von `checkResolvedHostIsPublic` verweist jetzt dorthin.

---

## 5. OP-100 — ein versäumter Lauf hinterlässt keine Spur

### 5.1 Das Problem in einem Satz

Der Scheduler feuert einen Job genau dann, wenn die laufende Minute auf seinen
Ausdruck passt. Fällt diese eine Minute in ein Neustart-, Deploy- oder
Ausfallfenster, läuft der Job an diesem Tag **gar nicht** — und es entsteht
keine Zeile in `job_run`, über die ein Alarm stolpern könnte. Die Ersatzabfrage
in `docs/runbook.md` §8 findet nur Jobs, die schon einmal liefen; die Lücke ist
eine **fehlende** Zeile.

### 5.2 Was gebaut wurde

`apps/worker/src/lib/scheduler.ts` bekommt `previousRunAtOrBefore` — das
Gegenstück zu `nextRunAfter`, „at or before" und nicht „strictly before", damit
ein Neustart exakt in der Minute eines Jobs dessen eigenen Termin nicht
überspringt.

`apps/worker/src/lib/job-registry.ts` bekommt zwei Funktionen:

- `findMissedRuns(jobs, lastRunByJob, now)` — **rein**, ohne Datenbank, und
  deshalb ohne Umschweife prüfbar;
- `reconcileMissedRuns(jobs, now)` — eine Aggregatabfrage über den vorhandenen
  Index `job_run_name_started_idx`, dann `runJob(job, "catchup")` je Treffer.

`apps/worker/src/index.ts` ruft es beim Start, aber nur wenn der Scheduler
wirklich läuft (bei `CRON_SCHEDULER_ENABLED != true` ist auch das Nachholen
aus) und bewusst nicht awaited — der Worker muss seinen Port binden.

Drei Grenzen, damit daraus kein Selbstbeschuss wird:

1. **Ein Job ohne jede Zeile in `job_run` wird nicht nachgeholt.** Beim ersten
   Start einer Installation ist nichts versäumt worden, und 131 Jobs
   gleichzeitig gegen eine frische Datenbank wären der Thundering Herd, den die
   gestaffelten Zeitpläne gerade vermeiden.
2. **Taktungen unter einer Stunde werden nicht nachgeholt.**
   `webhook-dispatch` (`*/2`) heilt sich binnen zwei Minuten selbst.
3. **`runJob` nimmt dieselbe Advisory-Lock wie der Scheduler.** Zwei
   gleichzeitig hochfahrende Container holen denselben Job nicht zweimal nach.

`trigger_source` bekommt den vierten Wert `catchup`. Die Spalte ist ein
`varchar(20)` ohne CHECK-Constraint (Migration 0435) und hat ausser dem
Scheduler keinen Leser — es braucht also keine Migration, und
`packages/db/src/schema/platform.ts` sagt jetzt, warum.

`emitCronEvent` kennt nur `info` und `error`; ein versäumter Lauf wird als
`error` gemeldet, weil `error` auf stderr geht, wo der Alarmpfad aus ADR-017
hinsieht. Eine dritte Stufe einzuführen hätte die stdout/stderr-Zuordnung für
alle Cron-Ereignisse verändert.

### 5.3 Gemessen, nicht nur getestet

`apps/worker/tests/lib/job-catchup.test.ts` (16 Prüfungen) deckt die reine
Entscheidung ab, mit einer Negativkontrolle gegen die echte Registry: wäre die
Vergleichsrichtung vertauscht, meldete der Fall „alle Jobs liefen gerade" alle
131 statt keinen.

Dazu ein Durchlauf gegen die **laufende Datenbank** mit einem synthetischen Job
(`run` = Zähler, danach aufgeräumt):

```
--- Fall 1: keine Historie -> kein Nachholen ---
missed: 0 | run() gerufen: 0
--- Fall 2: letzter Lauf 2 Tage her -> nachholen ---
missed: welle5c-catchup-probe dueAt=2026-09-04T06:30:00.000Z | run() gerufen: 1
job_run-Zeilen: [{"trigger_source":"scheduler","status":"success"},
                 {"trigger_source":"catchup","status":"success"}]
--- Fall 3: zweiter Aufruf direkt danach -> nichts mehr offen ---
missed: 0 | run() gerufen: 1
aufgeraeumt
```

Die Aggregatabfrage läuft, der Lauf wird nachgeholt, die Zeile trägt
`catchup`, und der Vorgang terminiert — der zweite Aufruf findet nichts mehr,
weil der Nachholauf selbst eine Zeile hinterlassen hat.

**Fallnachweis gegen den alten Stand** (`git stash push` auf die vier
Quelldateien):

```
      Tests  13 failed | 3 passed (16)
TypeError: previousRunAtOrBefore is not a function
TypeError: findMissedRuns is not a function
```

Die drei, die bestehen, sind die Kennzahl-Prüfungen aus §6 — sie hängen nicht
an dieser Änderung.

---

## 6. Zwei Kommentare — und die Zahlen daneben, nach denen niemand gefragt hat

Der Auftrag nannte zwei falsche Zahlen und riet, selbst nachzumessen, weil die
genannte Zahl erfahrungsgemäss nicht die einzige ist. Sie war es nicht.

### 6.1 `apps/worker/tests/no-fabricated-evidence.test.ts:7`

„a pattern repeated across **fourteen** code paths", darunter dreizehn Zeilen.
Beides nachgemessen:

| Grösse                                      | gemessen |
| ------------------------------------------- | -------: |
| Dateien in der Liste (`CASES.length`)       |   **13** |
| davon adressierbare Pfade                   |   **24** |
| — zwölf Dateien mit je einem Pfad           |       12 |
| — `module-aware-cron.ts` mit Modulprozessen |       12 |

„Vierzehn" war weder das eine noch das andere. Die Liste ist eine **Datei**-Liste,
also steht dort jetzt „thirteen files" — und der Test rechnet `CASES.length`,
die zwölf Modulprozesse und die 24 Pfade bei jedem Lauf nach, statt die Zahl im
Fliesstext zu führen.

Dazu die Abgrenzung, die sonst als dritter Widerspruch stehen bliebe: das sind
**nicht** die „19 Pfade in 12 Dateien" aus Welle 5b. Diese Liste sagt, was
einmal **erfunden** hat; die Liste in `docs/feature-catalog.md` sagt, was
**heute** verweigert. `executive-kpi-snapshot.ts` steht hier und dort nicht,
weil es inzwischen misst; von den zwölf Prozessen in `module-aware-cron.ts`
zählt 5b nur die acht, die noch verweigern, weil die anderen vier delegiert
sind. Beide Zahlen sind richtig — sie beantworten verschiedene Fragen.

**Gegenprobe durch künstliche Verletzung**: den Kopfsatz auf „fourteen code
paths" zurückgesetzt →
`AssertionError: Der Kopfkommentar nennt wieder eine Zahl, die nicht CASES.length ist`,
`Tests 1 failed | 16 passed`.

### 6.2 `apps/worker/src/crons/job-run-retention.ts:4`

„129 jobs, some at minute cadence, produce roughly 40k rows a day." Drei
Aussagen, drei Messungen:

| Aussage                  | gemessen                              |
| ------------------------ | ------------------------------------- |
| „129 jobs"               | **131** (`JOB_REGISTRY.length`)       |
| „roughly 40k rows a day" | **4.053**                             |
| „some at minute cadence" | **einer** (`webhook-dispatch`, `*/2`) |

Die 4.053 sind aus den 131 Cron-Ausdrücken ausgezählt: Minuten × Stunden je
Ausdruck, mal die Tage im Jahr, an denen der Tagesteil zutrifft, geteilt durch 366. Die 40.000 sind offenbar eine Hochrechnung „viele Jobs im Minutentakt" —
Faktor zehn daneben. Die Aufräumentscheidung bleibt richtig (4.053 × 90 Tage
sind rund 365.000 Zeilen), aber eine Begründung mit einer zehnfach zu hohen
Zahl ist keine.

Dieselbe „129" stand auch in `apps/worker/src/index.ts:65` und im Kommentar von
`tests/lib/job-registry.test.ts`. Beide korrigiert;
`tests/lib/job-catchup.test.ts` hält alle drei Zahlen an `JOB_REGISTRY` fest,
und zwar über den **gemessenen** Wert statt über ein Verbotsmuster auf „129" —
die Korrekturen zitieren die alte Zahl, ein Verbotsmuster hätte die
Berichtigung selbst getroffen.

---

## 7. Was nebenbei gefunden wurde

### 7.1 Der Geheimnis-Scanner war rot — und der eingecheckte Report sagte das Gegenteil

Welle 5b hat das Tor scharf gestellt und in §5.1 als **blockierend** übergeben.
Beim Aufsetzen dieser Welle neu gemessen:

```
$ node scripts/audit-secrets.mjs
Scanning 4424 files...
  Findings: 2
  Critical: 2
$ echo $?
1
```

Die zwei Treffer stehen aber nicht mehr in `logger-scrubbing.test.ts` — die
Ausnahme dafür ist eingetragen — sondern in **`docs/UMSETZUNG-WELLE-5B.md:245`**,
also in dem Dokument, das den Fund erklärt und dafür die PEM-Kopfzeile
ausschreibt. Der eingecheckte Report vom `2026-09-05T01:17:55Z` meldete
„4420 Dateien, Findings: 0"; er war **vor** dieser Zeile erzeugt worden.

Das ist derselbe Fehler, den derselbe Abschnitt anprangert: _ein Artefakt aus
einem früheren Lauf ist keine Messung._ Welle 5b hat ihn im eigenen
Abnahmeblock wiederholt, und der Nachtrag im Register schreibt „der Schritt ist
scharf" für einen Baum, in dem der Schritt rot war.

Behoben, und zwar präziser als mit einer weiteren Blankoausnahme:
`KNOWN_TEST_FIXTURES` kennt jetzt ein optionales Feld **`patterns`**. Ein
Eintrag ohne das Feld nimmt eine Datei wie bisher für **alle** Muster aus der
Fundliste — bei einer Testfixture richtig, bei einer Prosadatei zu grob. Der
neue Eintrag für die Wellendokumentation gilt nur für die beiden Muster, die
auf einen PEM-Kopf ohne Schlüsselmaterial anschlagen.

**Gegenprobe durch künstliche Verletzung**, ein erfundener AWS-Schlüssel in
derselben Datei:

```
Findings: 1 | Critical: 1 | EXIT=1
| `docs/UMSETZUNG-WELLE-5B.md` | 558 | AWS Access Key | critical | `AKIAQRSTUVWX…[len=20]` |
| `docs/UMSETZUNG-WELLE-5B.md` | 245 | Private Key Header | (bewertete Ausnahme) |
```

Die Ausnahme deckt genau das, was sie decken soll, und nichts weiter. Datei
danach byteweise zurückgespielt, `git status` sauber.

### 7.2 Ein zehnter stummer Bereich: der Platzhalterfilter prüfte die ganze Zeile

Beim Bauen der Gegenprobe fiel auf, dass der erste Versuch mit
`AKIAIOSFODNN7EXAMPLE` **nicht** gemeldet wurde. Grund:

```js
// scripts/audit-secrets.mjs, vorher
if (/placeholder|example|dummy|changeme|xxxxx/i.test(line)) continue;
```

Geprüft wurde die **Zeile**, nicht der Treffer. Ein echter Schlüssel neben
einer `example.com`-Adresse, einem `# Beispiel:`-Kommentar oder einem
Platzhalter in derselben Tabellenzeile war unsichtbar.

Beide Richtungen gemessen, mit demselben eingeschleusten Schlüssel auf einer
Zeile, die das Wort `example.com` enthält:

```
alte Fassung (test(line))  →  Findings: 0   EXIT=0     ← unsichtbar
neue Fassung (test(m[0]))  →  Findings: 1   EXIT=1     ← gefunden
```

Und die Kosten der Umstellung, gegen den heutigen Baum gemessen: **keine.**
Mit und ohne die Zeilenfassung meldet der Scanner 0 Funde — sie hat also
nichts geschützt und nur verdeckt. `AKIAPLACEHOLDER…`, `sk-dummy…` und
`password: "changeme"` fallen weiterhin durch, denn sie tragen das Wort im
Treffer selbst.

### 7.3 Der Report des Scanners brachte `prettier --check` zu Fall

Mit der gewachsenen Ausnahmetabelle schreibt der Scanner Markdown, das
`npx prettier --check .` beanstandet. Ein Prüfschritt, dessen Ausführung das
Formattor rot macht, erzieht zum Nichtausführen. `audit-dead-exports.mjs`
formatiert seinen Report seit OP-074 durch Prettier; `audit-secrets.mjs` tut es
jetzt auch.

### 7.4 `audit-dead-exports.mjs` hielt jede Test-Prüfnaht für toten Code

Der neue Nachholabgleich exportiert `findMissedRuns` und `MissedRun`, damit die
**reine** Entscheidungsfunktion ohne Datenbank prüfbar ist. Das Tor meldete:

```
✗ Gesamt: 2767 tote Exporte > Baseline 2765 (+2).
✗ apps/worker/src/lib/job-registry.ts: 2 tote Export(e) … — MissedRun, findMissedRuns.
  Entfernen, nicht in die Ratsche aufnehmen.
```

Der Import-Index des Werkzeugs las nur `SRC_DIRS`. Ein Symbol, das eine
Testsuite importiert, galt damit als tot — und der Autor hatte genau zwei
Auswege: die Prüfnaht wieder entfernen oder die Ratsche hochstellen.
`CONTRIBUTING.md` nennt beides als abzulehnende Abkürzung, und der Kopf des
Skripts führt „Falsch-Positive möglich" ohnehin schon als bekannte Schwäche.
**Ein Symbol, das ein Test importiert, ist importiert.**

`IMPORT_ONLY_DIRS` (die sieben `tests/`-Verzeichnisse) speisen jetzt den
Import-Index; ihre eigenen Exporte werden weiterhin nicht gezählt, `walk()`
läuft dafür unverändert nur über `SRC_DIRS`.

```
vorher:   2767 tote Exporte in 471 Dateien   (Baseline 2765 in 470)  ✗
nachher:  2464 tote Exporte in 458 Dateien   (Baseline 2765 in 470)  ✓
```

Die 303 Exporte Unterschied sind Prüfnähte, die es schon vor dieser Welle gab.
Der Report ist neu erzeugt; die Baseline **nicht** abgesenkt — das ist ein
eigener, im Diff sichtbarer Schritt (`--update-baseline`), und er gehört zu
einer Welle, die ihn auch belegen kann. Er steht in §9.

---

## 8. Abnahme

Alle gegen `c2eea595` plus die Änderungen dieser Welle, am 2026-09-05.

```
$ npx tsc --noEmit -p packages/shared/tsconfig.json      exit=0
$ npx tsc --noEmit -p apps/worker/tsconfig.json          exit=0
$ npx tsc --noEmit -p packages/db/tsconfig.json          exit=0
$ npx tsc --noEmit -p apps/web/tsconfig.json             exit=0

$ cd packages/shared && npx vitest run
 Test Files  90 passed (90)
      Tests  2131 passed (2131)

$ cd apps/worker && npx vitest run
 Test Files  138 passed (138)
      Tests  441 passed (441)

$ npx prettier --check .
All matched files use Prettier code style!

$ node scripts/lint-ratchet.mjs
  [root] …: 249 no-unused-vars, 26 no-explicit-any … (alle = Baseline)
  [apps/web] …: 0 Befunde (Baseline 0), 2287 Dateien.
Verbesserungen — bitte Baseline nachziehen (`--update`):
  ↓ root · (fatal-or-directive): 0 < Baseline 1 — vollständig behoben.
✓ Keine Lint-Regression.

$ node scripts/check-gate-inputs.mjs
✓ 9 Tor-Eingaben sind vorhanden, verfolgt und nicht ignoriert;
  package-lock.json stimmt mit allen Workspace-Manifesten überein.

$ node scripts/audit-dead-exports.mjs --check
Dead-Exports-Ratsche: 2464 tote Exporte in 458 Dateien (Baseline 2765 in 470).
✓ Keine Regression bei toten Exporten; Report ist aktuell.

$ node scripts/audit-secrets.mjs
Scanning 4424 files...
  Findings: 0
exit=0

$ npm run test:coverage      # 13 successful, 13 total — Bericht NEU erzeugt
$ npm run coverage:gate
  Metrik        Baseline   Aktuell   Δ
  lines          34.32 %   34.65 % +0.33
  statements     34.75 %   35.05 % +0.30
  functions      33.42 %   33.71 % +0.29
  branches       25.84 %   26.15 % +0.31
✓ Coverage-Gate bestanden — keine Regression gegenüber der Baseline.
```

Der Coverage-Bericht ist **vor** dem Tor neu erzeugt worden; der zuvor
eingecheckte Stand war vom selben Tag, 21:15, und damit ein Artefakt.
Der Geheimnis-Scan-Report ebenfalls (`docs/security/secret-scan-report.md` ist
im Diff).

Nicht committet, nicht gepusht.

---

## 9. Was offen bleibt, und warum

**Begründet offen, mit Datei und Zeile:**

1. **OP-112 bleibt offen.** Nicht aus Zeitmangel: `undici` ist in diesem Baum
   keine Produktionsabhängigkeit (§4.2), und die eine Zeile, die das ändert,
   liegt in `packages/shared/package.json` und `package-lock.json` — beide
   ausserhalb der Dateihoheit dieser Welle, letztere eine Tor-Eingabe. Das
   Rezept mit Messung steht am Fuss von `url-safety-server.ts`; wer die
   Abhängigkeit aufnimmt, kann es unverändert einsetzen.

2. **Zwei Ratschen sind zu hoch und wurden nicht abgesenkt.**
   - `.eslint-ratchet.json`: `root · (fatal-or-directive)` steht auf 1,
     gemessen sind 0 (die beiden `eslint-disable`-Zeilen in `excel-to-bpmn.ts`
     sind mit dem `as any` entfallen). `node scripts/lint-ratchet.mjs --update`
     wurde in dieser Umgebung von der Freigabeprüfung abgelehnt; das Tor ist
     grün, die Ratsche schützt nur einen Befund zu wenig.
   - `.dead-exports-ratchet.json`: 2765 in 470 gegen gemessene 2464 in 458
     (§7.4). Eine Absenkung ist ein eigener, im Diff sichtbarer Schritt und
     verlangt eine Welle, die die 303 Differenzen einzeln verantwortet — hier
     stammen sie aus einer Werkzeugkorrektur, nicht aus Aufräumarbeit.

   Beide Tore sind heute grün. Beide sind lockerer, als sie sein müssten.

3. **`apps/web` ist nicht gebaut worden** (§2.3). `tsc --noEmit` ist grün,
   das Bündelverhalten von `node:stream` ist am Ersatzprojekt gegen dasselbe
   `next@16.2.11` gemessen, aber der Volllauf von `next build` hat diese
   Umgebung überfordert. Wer den nächsten Vollbau fährt, hat damit eine
   Vorhersage zum Nachprüfen.

4. **Der Registertext zu OP-114 stimmt weiterhin nicht** („Zweite und dritte
   Schicht fangen es ab", Art „Codequalität", Aufwand S). Gemessen war es ein
   Pfad ohne zweite Schicht, mit 756 MB Wirkung. `docs/OFFENE-PUNKTE-REGISTER.md`
   liegt ausserhalb der Dateihoheit dieser Welle.

5. **Unberührt und ausserhalb des Gebiets:** OP-136 (fachliche Entscheidung),
   OP-151/OP-150 (Required Checks, Umbau der pfadgefilterten Workflows),
   OP-145 (zehn `dependabot/*`-Branches), OP-102, OP-101, OP-055, OP-048,
   OP-135, OP-143.

**Bewusst nicht getan:**

- Keine neue Umgebungsvariable für die Grenzen aus §2.2 — `.env.example` liegt
  ausserhalb des Gebiets, und ein hochdrehbarer Schutzwert ist die falsche
  Voreinstellung.
- `emitCronEvent` hat keine `warn`-Stufe bekommen (§5.2): das hätte die
  stdout/stderr-Zuordnung aller Cron-Ereignisse verändert, für einen
  Log-Level.
- Der Re-Seal hebt Bestandschiffrate im **Altformat**, die der aktuelle
  Schlüssel öffnet, nicht auf `v2:` an. Sie bleiben lesbar; eine
  Formatmigration ist eine andere Aufgabe als eine Schlüsselrotation.
