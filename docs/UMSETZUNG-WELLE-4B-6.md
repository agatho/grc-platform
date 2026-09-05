# Welle 4b, Strang 6 — OP-065: die abgeschwächten Compiler-Optionen

**Grundlage:** `docs/OFFENE-PUNKTE-REGISTER.md` OP-065 und §B.4 ·
`docs/UMSETZUNG-WELLE-4C.md` §6, Befunde F-3, F-4, F-5
**Punkte:** OP-065 (XL), dazu F-3 / F-4 / F-5 aus Welle 4c
**Stand:** Branch `audit/full-2026-08-31`, aufsetzend auf `01d0e4cc`
**Gebiet:** `packages/*/tsconfig.json`, `packages/*/src/**`, `packages/*/tests/**`

---

## 1. Was hier zu tun war — und was das Messen zuerst ergab

OP-065 stand als Kennzahl im Register: „Restschuld beim Einschalten: shared
502, db 641, auth 321, email 542". Der Auftrag war, **zuerst zu messen** und
erst danach zu handeln. Das hat sich gelohnt, denn keine dieser vier Zahlen
beschreibt, was heute im Weg steht.

### 1.1 Woher die geerbten Zahlen kommen

Sie stehen als Kommentar in zehn `tsconfig.json` und tragen dort das Datum
**2026-09-01**. Der Kommentar sagt selbst, was er zählt: „errors with **both**
ON" — also `noUncheckedIndexedAccess` **und** `noUnusedLocals` zusammen. Bei
`email` steht ausserdem ein Sternchen: „*jsx was unset". Der grösste Teil der
542 waren also JSX-Syntaxfehler, keine Indexzugriffe.

Nachgemessen am **2026-09-03 gegen denselben Stand `01d0e4cc`**, mit beiden
Schaltern, im ausgecheckten Baum:

| Paket    | geerbt (2026-09-01) | beide Schalter heute | davon eigene Dateien |
| -------- | ------------------: | -------------------: | -------------------: |
| `shared` |                 502 |                  344 |                  308 |
| `db`     |                 641 |                  562 |                  491 |
| `auth`   |                 321 |                   88 |                   34 |
| `email`  |               542\* |                   10 |                   10 |

Die geerbten Zahlen sind also **veraltet**, nicht falsch gezählt: zwischen dem
2026-09-01 und heute liegen die Wellen 4a, 4b-1 bis 4b-5 und 4c. Sie als
Ausgangslage zu übernehmen, hätte den Punkt dreimal so gross aussehen lassen,
wie er ist.

### 1.2 Die zweite Verzerrung: geliehene Fehler

Ein Paket, das man mit `tsc -p` prüft, zieht die **Quellen** seiner
Workspace-Abhängigkeiten in dasselbe Programm. Schaltet man
`noUncheckedIndexedAccess` in `ai` ein, meldet der Compiler die Fundstellen in
`packages/shared/src` **mit** — obwohl sie `ai` nicht gehören. Fünf Pakete
haben so dieselben 115 `shared`-Fundstellen jeweils erneut gezählt.

Diese Arbeit misst deshalb zweierlei getrennt: was ein Lauf insgesamt meldet,
und was davon **dem Paket selbst** gehört.

### 1.3 Die Zahl, um die es wirklich geht

Gemessen am 2026-09-03 gegen `01d0e4cc`, **nur**
`noUncheckedIndexedAccess`, je Paket:

| Paket        | Lauf gesamt | eigene Dateien | davon `src` | davon `tests` |
| ------------ | ----------: | -------------: | ----------: | ------------: |
| `db`         |         584 |        **452** |          57 |           395 |
| `shared`     |         285 |        **278** |         172 |           106 |
| `ai`         |         202 |         **80** |           9 |            71 |
| `auth`       |         152 |         **30** |          28 |             2 |
| `automation` |         139 |         **17** |          17 |             0 |
| `events`     |         130 |          **8** |           0 |             8 |
| `email`      |           8 |          **8** |           2 |             6 |
| `reporting`  |         126 |          **4** |           4 |             0 |
| `graph`      |          10 |          **3** |           3 |             0 |
| `ui`         |           0 |          **0** |           0 |             0 |
| **Summe**    |             |        **880** |     **292** |       **588** |

`bpmn` ist nicht betroffen — dieses Paket startet seit jeher mit den strengen
Flags, sein tsconfig sagt auch, warum („Geometriecode ist genau die Sorte
Code, bei der `noUncheckedIndexedAccess` sich auszahlt").

Zwei Dinge fallen an dieser Tabelle auf, und beide haben die Reihenfolge der
Arbeit bestimmt:

1. **Zwei Drittel der Fundstellen liegen in Testdateien** (588 von 880). Dort
   trifft ein `undefined` keinen Nutzer, sondern eine Zusicherung.
2. **`ui` ist bereits sauber.** Der Schalter stand dort seit dem 2026-09-01
   grundlos auf `false`.

---

## 2. Ergebnis in einem Satz

**Der Schalter steht in allen zehn Paketen wieder auf dem ererbten `true`.**
Alle 880 Fundstellen sind abgetragen — keine per `!`, keine per `as`. Dabei
sind **sechzehn Produktdefekte** ans Licht gekommen, davon fünf gemessen und
über eine API erreichbar; der schwerste tötet den Worker-Prozess mit sechs
Bytes.

| Punkt              | Ergebnis                                                                      |
| ------------------ | ----------------------------------------------------------------------------- |
| **OP-065**         | behoben — 10 von 10 Paketen, `noUncheckedIndexedAccess` überall `true`        |
| **F-3** (Quoting)  | behoben (§3.1)                                                                |
| **F-4** (Prototyp) | behoben (§3.2), und **zweimal derselbe Defekt anderswo gefunden** (§4.6/§4.7) |
| **F-5** (QA-Score) | behoben (§3.3), inkl. des vierten Falls `-Infinity`                           |

`noUnusedLocals` bleibt in allen zehn Paketen **aus**. Das ist eine andere
Fehlerklasse (toter Code, nicht Laufzeitverhalten), sie hat mit OP-065 nichts
zu tun, und sie mit hineinzunehmen hätte den Diff verdoppelt, ohne einen
einzigen Defekt zu finden. Der Stand ist beziffert: §7.2.

---

## 3. Die drei bestellten Defekte

Alle drei sitzen in `packages/shared/src/schemas/audit-advanced.ts`. Welle 4c
hatte sie gemessen und **bewusst ohne Test liegen gelassen**, weil ein Test den
Zustand festgeschrieben hätte. Der Kopfkommentar von
`packages/shared/tests/audit-custom-sql.test.ts` sagte das ausdrücklich. Er ist
jetzt umgeschrieben, und die Tests halten den **behobenen** Zustand fest —
jeder mit dem gemessenen alten Verhalten im Kommentar.

### 3.1 F-3 — der Funktionsname in Anführungszeichen

`FORBIDDEN_FUNCTIONS` verlangt `\b(name|…)\s*\(`, also die Klammer
**unmittelbar** hinter dem Namen. Ein doppelt zitierter Bezeichner schiebt ein
`"` dazwischen. Gemessen am 2026-09-03 gegen `01d0e4cc`:

```
abgelehnt      SELECT pg_sleep(3600)              Function 'pg_sleep' is not allowed …
DURCHGELASSEN  SELECT "pg_sleep"(3600)
DURCHGELASSEN  SELECT "current_setting"('x')
DURCHGELASSEN  SELECT "pg_read_file"('/etc/passwd')
DURCHGELASSEN  SELECT "dblink"('a','b')
abgelehnt      SELECT "INSERT" FROM t             Keyword 'INSERT' is not allowed …
abgelehnt      SELECT 1 FROM "DELETE"             Keyword 'DELETE' is not allowed …
```

Die letzten beiden Zeilen sind der Beleg für die Feststellung des Finders, dass
die **Stichwortliste nicht betroffen** ist: ihre Alternativen enden auf `\b`,
und `"` ist eine Wortgrenze.

**Was gemacht wurde — und was ausdrücklich nicht.** Der Vorschlag aus 4c war,
das Muster um `"?` zu erweitern. Der Auftrag hat das untersagt, und zu Recht:
das nimmt genau eine Schreibweise heraus. PostgreSQL kennt in zitierten
Bezeichnern auch das verdoppelte `""` und mit `U&"…"` eine weitere Kodierung.
Wer eine Sperrliste über zitierte Namen laufen lässt, muss die Zitierregeln der
Datenbank nachbauen — genau das, was der Modulkopf ausdrücklich ablehnt („we do
not attempt to tokenize SQL").

Der `"` ist deshalb **lexikalisch verboten**, bei den anderen lexikalischen
Prüfungen (Kommentare, Dollar-Quoting) und damit **vor** der Musterprüfung. Das
kostet nichts: alle Bezeichner dieses Schemas sind kleingeschriebenes
snake_case, und `continuous_audit_rule` ist in der Datenbank leer (nachgesehen:
`select rule_type, count(*) … group by 1` → keine Zeile), es gibt also auch
keine gespeicherte Regel, die daran zerbräche.

Der Grund, den der Aufrufer sieht, nennt die Regel und nicht die Funktion —
`Double-quoted identifiers are not allowed in custom audit SQL (a quoted name
hides it from the function blocklist; e.g. "pg_sleep"(…))`. Ein Test hält genau
das fest, damit eine spätere „Vereinfachung" auf `"?` daran scheitert.

### 3.2 F-4 — `isValidWpTransition` und die Prototypenkette

```ts
return WP_STATUS_TRANSITIONS[current]?.includes(next) ?? false;
```

`?.` schützt gegen `undefined`, nicht gegen eine **geerbte Funktion**. Für
`current = "toString"` liefert der Zugriff `Function.prototype.toString`; der
Kurzschluss greift nicht, `.includes` gibt es dort nicht, der `?? false`-Zweig
war für diese Schlüssel **unerreichbar**. Gemessen:

```
draft          → true
erfunden       → false
toString       → WIRFT TypeError: WP_STATUS_TRANSITIONS[current]?.includes is not a function
constructor    → WIRFT TypeError
valueOf        → WIRFT TypeError
hasOwnProperty → WIRFT TypeError
__proto__      → WIRFT TypeError
```

Behoben mit `Object.hasOwn` — die Frage, die immer gemeint war: steht dieser
Status in _dieser_ Tabelle. Kein `!` hinter dem Zugriff; der Wert wird
entnommen und geprüft.

### 3.3 F-5 — `computeQaScore`, und der vierte Fall

Die Wache prüfte `applicable.length === 0`, also ob es **Positionen** gibt —
nicht, ob es **Gewicht** gibt. `audit_qa_checklist_item.weight` ist `integer
NOT NULL DEFAULT 3` **ohne CHECK-Constraint**
(`packages/db/src/schema/audit-advanced.ts:388`), 0 und negative Werte sind also
speicherbar. Gemessen:

```
leer                 → score=0        rating=red     JSON {"score":0,…}
nur not_applicable   → score=0        rating=red
Gewicht 0            → score=NaN      rating=red     JSON {"score":null,…}
alle Gewichte 0      → score=NaN      rating=red
[{compliant,-1},{compliant,1}]      → score=NaN
[{compliant,-1},{non_compliant,1}]  → score=-Infinity
[{compliant, 5},{non_compliant,-1}] → score=125      rating=green
normal               → score=75       rating=yellow
```

Die ersten Fälle sind eine **Bewertung ohne Zahl**: der Aufrufer bekommt
`rating: "red"` neben `score: null`. Der Auftrag nennt zusätzlich den
`-Infinity`-Fall, den `Number.isNaN` beim Aufrufer **nicht** fängt — bestätigt.

Dabei ist ein **vierter** Fall aufgefallen, den weder F-5 noch der Auftrag
nannte und der der schwerste ist: `[{compliant, 5}, {non_compliant, -1}]` ergibt
**125 / green**. Ein negatives Gewicht war ein Hebel, mit dem sich eine grüne
QA-Bewertung erzeugen liess, obwohl eine Position nicht konform ist.

Zwei Änderungen, beide sagen dasselbe — _ein Gewicht ≤ 0 ist kein Gewicht_:

1. Positionen ohne verwertbares Gewicht fallen aus `applicable` heraus, genau
   wie `not_applicable`; fachlich sagen sie dasselbe. `Number.isFinite` fängt
   zusätzlich `NaN` und `±Infinity` ab, die über die öffentliche Signatur
   (`weight: number`) hereinkommen können.
2. Die Wache fragt, ob am Ende **Gewicht** übrig ist (`totalWeight <= 0`).

Damit gilt bewiesen: alle `wᵢ > 0`, alle `sᵢ ∈ {0, 50, 100}`, also
`0 ≤ Σ(sᵢ·wᵢ) ≤ 100·Σwᵢ = totalWeight` — `score` ist immer eine ganze Zahl in
`[0, 100]`. Der Beweis steht als Kommentar an der Funktion.

**Was NICHT gemacht wurde, und warum.** Der Auftrag schlug zusätzlich `.min(0)`
am Gewichtsfeld im Zod-Schema vor. Ein solches Feld gibt es nicht:
`updateQaChecklistSchema` trägt `id`, `compliance` und `reviewerComment`, kein
`weight` — das Gewicht kommt aus der Datenbank und wird über keine Route
geschrieben. Eine Zod-Regel für ein Feld zu erfinden, das niemand sendet, wäre
eine Kontrolle ohne Wirkung, also genau die Fehlerform, die Strang 4 abgetragen
hat. Die richtige Stelle ist der **CHECK-Constraint** auf
`audit_qa_checklist_item.weight`; er liegt in `packages/db/drizzle/**` und damit
ausserhalb der Dateihoheit dieses Strangs. Er steht als **N-1** in §8.

### 3.4 Nachweis, dass die Tests gegen den alten Stand fallen

`packages/shared/tests/audit-custom-sql.test.ts` gegen `01d0e4cc`:

```
Tests  19 failed | 56 passed (75)
```

Nach der Behebung: `Tests  75 passed (75)`.

---

## 4. Die Produktdefekte, die der Schalter ans Licht gebracht hat

Nicht jede der 880 Fundstellen ist ein Defekt — die meisten sind Invarianten,
die stimmen, aber nirgends aufgeschrieben waren. Die folgenden sind etwas
anderes: an ihnen tut der Code nachweislich nicht, was er sagt. Sortiert nach
Wirkung.

### 4.1 P-1 — der DER-Parser läuft in eine Endlosschleife · **gemessen, tödlich**

`packages/shared/src/lib/asn1-der.ts`. `readNode` hatte **keine einzige**
Bereichsprüfung. Er liest die Antwort einer RFC-3161-Zeitstempelstelle
(`freetsa.ts`), also Bytes von dem, der die TLS-Verbindung terminiert — und im
Wiederholungslauf (`apps/worker/src/crons/audit-chain-verify.ts`) ausserdem
`audit_anchor.proof` aus der Datenbank.

Die Längenrechnung war

```ts
length = (length << 8) | buf[offset + 2 + i];
```

`<<` rechnet in **32 Bit mit Vorzeichen**. Vier Längenbytes mit gesetztem
obersten Bit ergeben eine **negative** Länge und damit ein `end`, das **vor dem
eigenen Anfang** liegt. `readChildren` setzt `off = child.end` — der Versatz
läuft also rückwärts und arbeitet sich in Zweierschritten wieder nach oben.
Dabei trifft er exakt die 0 (weil `-16777210` gerade ist), liest dort denselben
Knoten erneut und springt wieder zurück: **eine Endlosschleife, die in jeder
Runde einen Knoten in ein Feld schiebt.**

Gemessen am 2026-09-03 gegen `01d0e4cc`, Eingabe `30 84 ff 00 00 00` — **sechs
Bytes**:

```
erstes child.end:    -16777210
Schleifenrunden:     50.000.000   (Deckel erreicht, kein Ende in Sicht)
Dauer:               1862 ms      (ohne das Sammeln der Knoten)
```

Ohne Deckel, also mit dem echten `readChildren`, endete der Messlauf mit
**Exit 137** — vom Kernel wegen Speichermangels beendet. Derselbe Effekt trat
im Testlauf auf: gegen `01d0e4cc` meldet Vitest
`Error: Worker exited unexpectedly` und **keiner** der 15 Tests der neuen Datei
kommt zum Ergebnis.

Zwei weitere Wege desselben Parsers, ebenfalls gemessen:

```
readNode(Buffer.alloc(0))       → { tag: undefined, len: 0, end: 2 }
readNode([0x30])                → { tag: 48, len: 0, end: 2 }
readNode([0x04, 0x10, 0x01])    → deklariert 16 Inhaltsbytes, liefert 1, end: 18
readNode([0x30,0x80,0x01,0x02]) → BER-„indefinite length", als Länge 0 gelesen
```

Der erste Fall ist besonders hinterhältig: `tag` war als `number` deklariert und
trug in Wahrheit `undefined`. Jeder Tag-Vergleich beim Aufrufer liest das als
„passt nicht" — die Antwort gilt als _falsch geformt für diesen Zweig_, nicht
als _verstümmelt_.

**Behoben:** `readNode` prüft Tag, Längenbyte, Längenbytes und die
Inhaltslänge gegen den Puffer und wirft sonst. Die Länge wird mit
`length * 256 + b` gerechnet statt mit `<< 8`, bleibt also ≥ 0. `lenBytes === 0`
(BER-indefinite) und `lenBytes > 4` werden abgelehnt. Damit gilt beweisbar
`end ≥ off + 2`, und `readChildren` kommt immer voran — das steht als Kommentar
an der Schleife statt als Sondergrenze darin.

Der Ausgang ist der richtige: `freetsa.ts` fängt jeden Fehler dieses Pfades und
macht daraus einen `TimestampValidationError` — der Zeitstempel gilt dann als
nicht erbracht, und genau das ist er auch.

### 4.2 P-2 — der Bombenwächter meldet „entpackt sich zu nichts" · **gemessen, erreichbar**

`packages/shared/src/lib/zip-safety.ts`. Die Leser

```ts
function readUInt32LE(buf, off) { return (buf[off] | (buf[off+1] << 8) | …) >>> 0; }
```

lasen ohne Bereichsprüfung. Ausserhalb des Puffers ist `buf[off]` `undefined`,
und JavaScript macht daraus im Bit-Ausdruck stillschweigend eine **0** —
`ToInt32(undefined) === 0`. Nicht `NaN`, nicht eine Ausnahme: die Zahl null.

Die Schranke im ZIP64-Zusatzfeld prüft `field + 8 <= exEnd`, und `exEnd` kommt
aus der **deklarierten** Feldlänge, nicht aus der vorhandenen Datei. Das Loch
dazwischen ist genau acht Bytes breit. Gemessen am 2026-09-03 gegen `01d0e4cc`
mit einem 300-Byte-Archiv, dessen Eintrag sich über `0xffffffff` ausdrücklich
als ZIP64-gross (≥ 4 GiB) deklariert und dessen Zusatzfeld zwölf Bytes lang
sein soll, von denen vier im Puffer liegen:

```
inspectZipArchive: DURCHGELASSEN
  entries            = 1
  uncompressedSize   = 0
  totalUncompressed  = 0
  ratio              = 0
```

**Erreichbar** über `POST /api/v1/import/upload` →
`apps/web/src/lib/import-export/file-parser.ts:160` → `assertZipWithinLimits`.
Die zweite Schicht (der streamende `WorkbookReader` mit eigenen Obergrenzen)
besteht weiter; der Modulkopf sagt aber, wie bei F-3, dass keine Schicht die
einzige sein darf — und die erste war für diese Schreibweise wirkungslos.

**Behoben:** ein `readByte`, das den Grenzfall zu dem macht, was der Modulkopf
für ihn ohnehin vorsieht — „cannot inspect ⇒ do not inflate" — und einen
`ZipBombError` wirft. Ein Vorgabewert (`?? 0`) wäre derselbe Defekt mit einer
Zeile mehr gewesen.

Regressionstests in `packages/shared/tests/zip-safety-s04-04.test.ts`, gegen
`01d0e4cc` rot:

```
× liest ein ZIP64-Zusatzfeld nicht über das Dateiende hinaus
    AssertionError: expected function to throw an error, but it didn't
× meldet für ein abgeschnittenes Archiv keine Grösse von 0
    AssertionError: expected +0 not to be +0
Tests  2 failed | 8 passed (10)
```

Der zweite Test ist bewusst unabhängig von der Fehlermeldung formuliert: ein
Archiv, das sich nicht vollständig vermessen lässt, darf **niemals** mit
`totalUncompressed === 0` durchgereicht werden — gleich, wie die Behebung das
erreicht.

### 4.3 P-3 — der Zeitstempelprüfer wirft am eigenen Fehlermodell vorbei

`packages/shared/src/lib/freetsa.ts` hat rund 25 Elemente eines DER-Baums
direkt indiziert: `tst[2]`, `readChildren(imprintSeq[0])[0]`,
`readChildren(readChildren(mdAttr)[1])[0]`. Fehlt eines davon, war das Ergebnis
keine Ablehnung, sondern

```
TypeError: Cannot read properties of undefined (reading 'value')
```

Das fliegt am gesamten Fehlermodell dieses Moduls vorbei: **jeder** andere
Ablehnungsgrund kommt als `TimestampValidationError` mit einem benannten
`reason` heraus, dieser als roher Programmierfehler. Im Wiederholungslauf
(`apps/worker/src/crons/audit-chain-verify.ts:302`) landet er als `last_error`
an einem Anker — eine Meldung, mit der ein Betreiber nichts anfangen kann, für
einen Zustand, der schlicht „die Antwort ist verstümmelt" heisst.

**Behoben** mit einem `requireChild(nodes, index, what)`, das denselben
`reason: "malformed"` wirft wie die benachbarten Längenprüfungen von Hand.
Ein Helfer statt 25 `if`-Zeilen — und statt 25 `!`.

Zwei weitere Stellen im selben Modul:

- `timingSafeEqualBuffers`: `a[i] ^ b[i]` war `undefined ^ undefined`, und das
  ist in JavaScript **0** — ein Vergleich, der bei einem Lesefehler „gleich"
  gesagt hätte. Die Längen sind zwar oben geprüft; die Schleife läuft jetzt
  über `entries()` und die Laufzeit bleibt konstant.
- `decodeOid`: erstes Byte und Rest werden zerlegt statt indiziert; die
  Längenabfrage wird dadurch ersetzt, nicht ergänzt.

### 4.4 P-4 — `encodeInteger` erzeugt ungültiges DER für negative Werte

Derselbe Parser, die Gegenrichtung. Der Kommentar sagt seit jeher
„non-negative integer"; durchgesetzt hat der Code das nicht. Für einen
negativen Wert läuft `while (n > 0n)` **kein einziges Mal**, `tmp` bleibt leer,
`undefined & 0x80` ergibt 0 — und heraus kommt ein INTEGER mit Inhaltslänge 0.
Gemessen:

```
encodeInteger(-1)      → 0200
encodeInteger(-12345n) → 0200
```

Das ist kein ungenauer Wert, das ist ungültiges DER, und es wäre erst beim
Gegenüber aufgefallen. Jetzt wirft die Funktion.

### 4.5 P-5 — `encodeOid` schreibt aus `NaN` eine 0x00

`parseInt("a")` ist `NaN`, `NaN * 40 + NaN` ist `NaN`, und `Buffer.from([NaN])`
schreibt daraus stillschweigend ein `0x00`. Gemessen:

```
encodeOid("2.a.1")                  → 060201
encodeOid("2.16.840.1.101.3.4.2.1") → 0609608648016503040201
```

Eine falsche OID hätte also eine **syntaktisch gültige, inhaltlich falsche**
Kennung erzeugt — die unangenehmste Sorte Fehler in einer Signaturkette.
Behoben durch eine Prüfung auf ganze, nicht-negative Bögen; die bisherige
Längenprüfung `parts.length < 2` ist durch die Zerlegung ersetzt, nicht
ergänzt.

### 4.6 P-6 — `resolveField` gibt eine Funktion zurück, wo `string` steht · **F-4, zum zweiten Mal**

`packages/shared/src/utils/language-resolver.ts`. Der Compiler beanstandete
`field[Object.keys(field)[0]]`; dahinter lag dieselbe Fehlerklasse wie F-4.
Gemessen am 2026-09-03 gegen `01d0e4cc` mit `field = { de: "Titel", en:
"Title" }`:

```
userLang=de           typeof=string    → Titel
userLang=fr           typeof=string    → Titel
userLang=constructor  typeof=function  → function Object() { [native code] }
userLang=toString     typeof=function  → function toString() { [native code] }
userLang=valueOf      typeof=function  → function valueOf() { [native code] }
userLang=__proto__    typeof=object    → [object Object]
```

Die Signatur sagt `string`. **Ehrliche Einordnung:** über die heutigen Routen
ist das nicht erreichbar — `translationExportQuerySchema`
(`packages/shared/src/schemas/translation.ts:146`) engt `source`/`target` auf
`z.enum(supportedLanguages)` ein. Die Zusicherung lag damit aber beim
**Aufrufer**, nicht bei dieser Funktion, und der nächste Aufrufer erbt sie
nicht mit.

Behoben mit `Object.hasOwn`, und zusätzlich mit einer Typprüfung: ein
JSONB-Feld kann auch eine Zahl tragen, und `resolveField({de: 42, …}, "de",
"en")` gab bis hierher die **Zahl 42** an einen Aufrufer zurück, der `string`
erwartet. Die Rückfallkette selbst (Nutzersprache → Organisationssprache →
erster Schlüssel) bleibt unverändert.

### 4.7 P-7 — „Safely resolve nested property" löste Prototyp-Eigenschaften auf · **F-4, zum dritten Mal**

`packages/reporting/src/variable-resolver.ts`. Der Kopfkommentar der Funktion
sagt „Safely resolve nested property from dot-notated path"; der Zugriff
`(current as Record<string, unknown>)[part]` fragte die Prototypenkette mit.
Gemessen mit `{ org: { name: "ACME" } }`:

```
{{org.name}}        → "ACME"
{{org.unbekannt}}   → ""
{{org.constructor}} → "function Object() { [native code] }"
{{org.__proto__}}   → "[object Object]"
```

Der Text einer **Berichtsvorlage** ist damit ein Weg, Fremdes in einen
erzeugten Bericht zu schreiben. `VARIABLE_PATTERN` lässt nur zwei Abschnitte
zu, die Tiefe war also begrenzt — die Klasse ist es nicht.

**Ein Test hat dabei eine erste, falsche Behebung abgefangen**, und das ist der
Grund, ihn hier zu nennen. Der erste Versuch stieg bei einer fehlenden eigenen
Eigenschaft mit `return undefined` aus. `tests/variable-resolver.test.ts` fiel
sofort:

```
× returns empty string for known namespace with unknown property
    AssertionError: expected '{{org.nonexistent}}' to be ''
```

Die Funktion unterscheidet zwei Ausgänge, und der Test hält sie fest:
`undefined` heisst „Pfad nicht auflösbar" und lässt `{{…}}` als Platzhalter
stehen (Sichtbarkeit beim Entwerfen der Vorlage), ein aufgelöster leerer Wert
ergibt `""`. Eine fehlende eigene Eigenschaft gehört in den zweiten Topf.
Behoben wurde also der Code, nicht die Erwartung — die Prüfung setzt jetzt
`current = undefined` und lässt die bestehende Auswertung entscheiden.

### 4.8 P-8 — eine unbekannte Rolle macht die Einladungs-E-Mail unbrauchbar · **gemessen**

`packages/email/src/templates/UserInvited.tsx`:

```ts
const roleLabel = roleLabels[lang][roleName] || roleName;
```

`roleName` ist `string` und kommt aus dem Aufrufer. Für `"constructor"` liefert
der Zugriff den Object-Konstruktor; `|| roleName` greift darauf **nicht** — eine
Funktion ist wahr. Aus einer unbekannten Rolle wurde damit kein Rohwert,
sondern eine kaputte E-Mail. Gegen `01d0e4cc` gemessen, mit React als Zeuge:

```
Functions are not valid as a React child. This may happen if you return Object
instead of <Object /> from render. …
× zeigt für den Prototyp-Schlüssel constructor den Rohwert, nicht eine Funktion
× zeigt für den Prototyp-Schlüssel toString den Rohwert, nicht eine Funktion
× zeigt für den Prototyp-Schlüssel valueOf den Rohwert, nicht eine Funktion
× zeigt für den Prototyp-Schlüssel hasOwnProperty den Rohwert, nicht eine Funktion
Tests  4 failed | 2 passed | 36 skipped (42)
```

Behoben mit `Object.hasOwn`. Zusätzlich ist der äussere Record jetzt auf
`Record<UserInvitedProps["lang"], …>` typisiert statt auf `string` — die
Schlüssel des Props sagen es genauer, und damit **entfällt** eine Prüfung,
statt eine hinzuzukommen.

### 4.9 P-9 — die Wiederholung ohne Wartezeit

`packages/email/src/EmailService.ts`. `RETRY_DELAYS` (Zeile 148, drei Werte)
und `MAX_ATTEMPTS` (Zeile 149, die Zahl 3) standen unabhängig nebeneinander;
die Schleife lief über `attempt` und schlug die Wartezeit in
`RETRY_DELAYS[attempt]` nach. `setTimeout(fn, undefined)` wartet **0 ms**. Wer
`MAX_ATTEMPTS` erhöht hätte, bekäme also keinen Fehler, sondern eine
Wiederholung ohne Backoff — genau gegen einen ratenbegrenzenden Anbieter.

Behoben, indem die Schleife über `RETRY_DELAYS.entries()` läuft: Versuchsnummer
und Wartezeit kommen gemeinsam heraus, der Indexzugriff verschwindet, und
`MAX_ATTEMPTS` ist jetzt `RETRY_DELAYS.length` — die beiden Konstanten können
nicht mehr auseinanderlaufen.

### 4.10 P-10 bis P-16 — die kürzeren

| Nr.      | Ort                                                     | Was der Code tat                                                                                                                                                                                                  |
| -------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P-10** | `db/src/programme-soa-sync.ts`                          | `result.subtaskAction = "created"` wurde gesetzt, **bevor** die zurückgegebene Zeile gelesen war. Bleibt sie aus, ist nichts angelegt worden — und der Ergebnisbericht behauptet es trotzdem. Jetzt `requireRow`. |
| **P-11** | `db/src/seeds/programme-templates.ts`                   | Drei `.returning()`-Zeilen ungeprüft. Ein Seed, der nach einem fehlgeschlagenen INSERT weiterläuft, baut halbe Bäume und meldet am Ende „templatesSeeded: 12".                                                    |
| **P-12** | `shared/src/lib/excel-to-bpmn.ts`                       | `nodeIds.get(rows[0].stepNumber)!` — bei fehlendem Ziel hätte das `!` das Wort `undefined` in das erzeugte **BPMN-XML** geschrieben. Jetzt wird der Fluss weggelassen.                                            |
| **P-13** | `shared/src/cci/calculator.ts`                          | `getPreviousPeriod("2026")` → `monthStr` undefined → `NaN` → die Periode `"NaN-NaN"`; `getPeriodRange` daraus `Invalid Date`. Latent — die Aufrufer übergeben `YYYY-MM`.                                          |
| **P-14** | `shared/src/utils/fair-monte-carlo.ts`                  | `new Array(n).fill(0)` ergibt `any[]`; die Indexzugriffe darauf liefen **ganz an der Prüfung vorbei**. Jetzt `number[]`.                                                                                          |
| **P-15** | `db/src/create-admin.ts`                                | `name = arg("name") ?? email.split("@")[0]` war `string \| undefined` und ging als Parameter in ein `sql`-Template — `undefined` ist dort kein gültiger Parameter (TS1320 am `await`).                            |
| **P-16** | `shared/src/lib/file-signature.ts`, `.../zip-safety.ts` | `looksLikeText` zählte ein `undefined`-Byte weder als druckbar noch als verdächtig; `assertZipWithinLimits` startete `reduce` mit `entries[0]`. Beides durch Invarianten gedeckt, beides jetzt ohne Indexzugriff. |

---

## 5. Wie die 880 abgetragen wurden

Der Auftrag war ausdrücklich: `arr[0]!` ist keine Behebung. Vier Muster haben
gereicht, und drei davon **entfernen** den Indexzugriff, statt ihn abzusichern.

**(a) Über den Wert statt über den Index.** `for (const x of arr)`,
`arr.entries()`, `arr.map`, `arr.reduce`. Das ist der beste Fall: der Wert
kommt aus der Iteration und ist deshalb gar kein `T | undefined`. So gelöst
u. a. in `url-safety.ts` (drei Schleifen zu einer zusammengefasst),
`distributions.ts`, `fair-simulation.ts`, `merkle-tree.ts` (ein `levelPairs`
für alle vier Baumschleifen), `ai/src/router.ts`, `email/src/EmailService.ts`.

**(b) Die Invariante als Prüfung schreiben, wo sie die Bedingung ersetzt.**
`const [a, b] = arr; if (a === undefined || b === undefined) return null;`
**anstelle** von `if (arr.length < 2) return null`. Gleich viele Zweige,
dieselbe Aussage — nur so, dass der Compiler sie nachvollzieht. So in
`auth/src/scim/filter-parser.ts`, `asn1-der.ts` (`encodeOid`),
`shared/src/lib/freetsa.ts` (`decodeOid`).

**(c) `?? <Vorgabe>`, wo die Vorgabe dieselbe Antwort ist wie der andere
Zweig.** `return level[0] ?? null` in einer Funktion, die für „nichts gefunden"
ohnehin `null` liefert; `?? ""` für eine Fanggruppe, die bei einem geglückten
Treffer da ist. **Jedes** dieser `??` ist an Ort und Stelle begründet — und wo
die Vorgabe eine Richtung hat, ist die sichere gewählt: in
`isPrivateIPv6Literal` liest eine fehlende Gruppe als `0`, was eine Adresse
eher **privat** macht und nie eher öffentlich; in der Binärsuche von
`buildExceedanceCurve` zählt ein nicht lesbarer Wert als „über der Schwelle",
was das Fenster verkleinert und die Suche terminieren lässt.

**(d) Ein benannter Helfer statt vieler `!`.** Vier Stück, jeder mit einem
Kommentar, der die Entscheidung trägt:

| Helfer                                                 | Ort                             | Entscheidung                                                                |
| ------------------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------- |
| `requireChild(nodes, i, what)`                         | `shared/src/lib/freetsa.ts`     | fehlendes DER-Element ⇒ `TimestampValidationError("malformed")`             |
| `requireRow(rows, what)`                               | `db/src/sql-result.ts`          | keine Zeile ⇒ Abbruch mit Namen, statt `undefined` als UUID weiterzureichen |
| `requireRow` / `requireAt`                             | `db/tests/helpers.ts`           | fehlende Fixture ⇒ benannter Fehlschlag an der Entstehungsstelle            |
| `at(arr, i)`, `group1(m)`, `column(cols, i)`, `pick()` | je Testdatei bzw. `utils/xliff` | dasselbe für Tests und Fanggruppen                                          |

`db/src/sql-result.ts` ist bewusst der **eine** Ort, an dem für dieses Paket
entschieden wird, was „kein Datensatz" bedeutet — acht Skripte hatten die
Entscheidung vorher gar nicht getroffen, und acht Kopien desselben Helfers
hätten sie achtmal getroffen.

### 5.1 Der eine Fall, in dem ein Test die Behebung korrigiert hat

Siehe §4.7. Der Test wurde nicht angepasst; der Code wurde es. Ein zweiter,
kleinerer Fall: `resolveField({de: 42, …}, "de", "en")` liefert nach der
Behebung `""` statt der Zahl 42 — die **Rückfallkette** bleibt dabei
unverändert (erster Schlüssel, nicht erster brauchbarer), und die Testerwartung
sagt das jetzt ausdrücklich, samt der Begründung.

---

## 6. Wo der Schalter jetzt steht

**Überall an.** In allen zehn `packages/*/tsconfig.json` ist die Zeile
`"noUncheckedIndexedAccess": false` entfernt; es gilt das ererbte `true` aus
`tsconfig.base.json:16`. `packages/bpmn` hatte sie nie.

Der Kommentarblock in den zehn Dateien ist ersetzt: er trägt jetzt die
gemessene Tabelle aus §1.3 statt der Zahlen vom 2026-09-01, sagt warum die
alten Zahlen abwichen, und verweist hierher.

```
$ npx tsc --noEmit -p packages/<paket>/tsconfig.json
packages/ai          0     packages/graph       0
packages/auth        0     packages/reporting   0
packages/automation  0     packages/shared      0
packages/bpmn        0     packages/ui          0
packages/db          0     apps/web             0
packages/email       0     apps/worker          0
packages/events      0
```

**Es gibt kein Paket, in dem der Schalter aus bleibt.** Damit entfällt der
Abschnitt „gemessene Zahl und Grund", den der Auftrag für diesen Fall vorsah.

---

## 7. Was offen bleibt — beziffert

### 7.1 `packages/db/drizzle/**`

Der CHECK-Constraint auf `audit_qa_checklist_item.weight` (§3.3) verlangt eine
Migration und liegt ausserhalb der Dateihoheit. `computeQaScore` ist gegen
jedes Gewicht robust; die **Datenbank** nimmt ein negatives Gewicht weiter an.
→ **N-1** in §8.

### 7.2 `noUnusedLocals`

In allen zehn Paketen weiter **aus**. Gemessen am 2026-09-03 gegen `01d0e4cc`,
mit beiden Schaltern gegen nur `noUncheckedIndexedAccess`, jeweils eigene
Dateien:

| Paket    | beide | nur nUIA | Rest ≈ `noUnusedLocals` |
| -------- | ----: | -------: | ----------------------: |
| `shared` |   308 |      278 |                  ca. 30 |
| `db`     |   491 |      452 |                  ca. 39 |
| `auth`   |    34 |       30 |                   ca. 4 |
| `email`  |    10 |        8 |                   ca. 2 |

Das ist eine andere Fehlerklasse — ungenutzte Bezeichner, nicht
Laufzeitverhalten — und überschneidet sich mit der bereits stehenden
Lint-Ratsche (`@typescript-eslint/no-unused-vars`, Baseline 249). Sie hier
mitzunehmen hätte den Diff um ein Drittel vergrössert, ohne einen einzigen
Defekt zu finden. → **N-2** in §8.

### 7.3 `scripts/lint-ratchet.mjs` ist nicht prettier-konform

`npx prettier --check .` meldet **eine** Datei, und sie gehört nicht zu diesem
Strang: `scripts/lint-ratchet.mjs` ist eine unversionierte Änderung des
Parallelstrangs. Nachgewiesen: die Fassung aus `HEAD` ist konform.

```
$ git show HEAD:scripts/lint-ratchet.mjs > /tmp/lr-head.mjs
$ npx prettier --check /tmp/lr-head.mjs
All matched files use Prettier code style!
```

Die Datei wurde nicht angefasst.

---

## 8. Neue Punkte für das Register

| Nr.     | Punkt                                                                                                                                                                                                                                                                         | Beleg                                 | Art          |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------ |
| **N-1** | `audit_qa_checklist_item.weight` hat keinen CHECK-Constraint. `computeQaScore` verkraftet jetzt jedes Gewicht, die Datenbank nimmt ein negatives weiter an. Ein Gewicht 0 heisst fachlich `not_applicable`, und dafür gibt es bereits einen Wert.                             | `db/src/schema/audit-advanced.ts:388` | Produkt      |
| **N-2** | `noUnusedLocals` steht in zehn Paketen aus; gemessene Restschuld ca. 75 in den vier grössten (§7.2).                                                                                                                                                                          | eigene Messung 2026-09-03             | Codequalität |
| **N-3** | Der QA-Bewertungspfad ist unvollständig verdrahtet: `computeQaScore` hat **keinen** Aufrufer, `updateQaChecklistSchema` **keine** Route (`qa-review/route.ts` kennt nur GET und POST), und `audit_qa_review.overall_score` wird nirgends geschrieben. Die Spalte bleibt leer. | eigene Messung 2026-09-03             | Produkt      |

---

## 9. Abnahme

Alles unten am 2026-09-03 auf dem Arbeitsstand dieses Strangs gemessen.

**Typprüfung** — 13 Projekte, alle mit `noUncheckedIndexedAccess` an:

```
packages/{ai,auth,automation,bpmn,db,email,events,graph,reporting,shared,ui}  je 0
apps/web  0        apps/worker  0
```

**Testsuiten** — alle betroffenen, vollständig:

| Suite                       |               Ergebnis |
| --------------------------- | ---------------------: |
| `packages/shared`           |  2113 passed (88 Dat.) |
| `packages/db` (unit)        |             122 passed |
| `packages/db` (integration) |             105 passed |
| `packages/db` (rls)         |             186 passed |
| `packages/ai`               |  151 passed, 3 skipped |
| `packages/auth`             |             244 passed |
| `packages/automation`       |              82 passed |
| `packages/bpmn`             | 895 passed, 14 skipped |
| `packages/email`            |             197 passed |
| `packages/events`           |              20 passed |
| `packages/graph`            |              47 passed |
| `packages/reporting`        |              49 passed |
| `packages/ui`               |              39 passed |
| `apps/worker`               |  409 passed (136 Dat.) |
| `apps/web` (vitest + db)    |       2759 + 24 passed |

**Tore:**

```
$ npx prettier --check .
[warn] scripts/lint-ratchet.mjs        ← Fremdstrang, siehe §7.3

$ node scripts/lint-ratchet.mjs
  [root] 285 Befunde (Baseline 283) … [apps/web] 0 (Baseline 0)
  ✓ Keine Lint-Regression.

$ node scripts/check-gate-inputs.mjs
  ✓ 9 Tor-Eingaben sind vorhanden, verfolgt und nicht ignoriert.

$ node scripts/audit-dead-exports.mjs --check
  Dead-Exports-Ratsche: 2765 tote Exporte in 470 Dateien (Baseline 2765 in 470).
  ✓ Keine Regression bei toten Exporten; Report ist aktuell.

$ rm -rf coverage && npm run test:coverage    # FRISCH erzeugt
$ node scripts/coverage-gate.mjs
  Metrik        Baseline   Aktuell   Δ
  lines          34.32 %   34.40 % +0.08
  statements     34.75 %   34.82 % +0.07
  functions      33.42 %   33.50 % +0.08
  branches       25.84 %   25.96 % +0.12
  ✓ Coverage-Gate bestanden — keine Regression gegenüber der Baseline.
```

### 9.1 Zwei Zwischenstände, die das Coverage-Tor rot hatten

Das gehört hierher, weil es die Arbeit an einer Stelle korrigiert hat.

Der erste Lauf gegen einen frischen Bericht meldete:

```
✗ packages/email branches: 91.05 % < Baseline 91.63 %
✗ packages/db     branches: 27.33 % < Baseline 28.04 %
```

Ursache waren **meine eigenen** Schutzzweige: jeder `if (x === undefined)` und
jedes `??`, dessen Vorgabe beweisbar nie greift, ist ein Zweig, den kein Test
je durchläuft. Die Baseline anzuheben war keine Option; sie liegt ausserdem
ausserhalb der Dateihoheit. Behoben wurde die **Ursache**:

- `email`: der äussere Record von `roleLabels` ist jetzt nach Sprache
  typisiert, wodurch eine Prüfung **entfällt**; die Wiederholungsschleife läuft
  über `RETRY_DELAYS.entries()`, wodurch zwei weitere entfallen (§4.9). Beides
  ist zugleich besserer Code als die Absicherung, die es ersetzt.
- `db`: acht Kopien von `requireRow` in acht Skripten wurden zu **einer** in
  `src/sql-result.ts` zusammengezogen (sieben Zweige weniger), und die drei
  Prüfungen in `programme-soa-sync.ts` / `programme-templates.ts` laufen jetzt
  über denselben Helfer.

Der zweite Lauf war deswegen bei `lines/statements/functions` rot: der neue,
exportierte Helfer war ungedeckt. Das ist kein Zähltrick, sondern eine echte
Lücke — behoben mit `packages/db/tests/unit/sql-result.test.ts` (8 Tests), das
zugleich die drei **vorher völlig ungedeckten** Helfer `toRows`, `firstRow` und
`rowCount` abdeckt. Deren Modulkopf beschreibt eine Fehlerklasse, die dieses
Repository schon einmal 40 Fundstellen gekostet hat; jetzt hält ein Test sie
fest.

---

## 10. Neue Tests, und dass sie gegen den alten Stand fallen

**67 neue Tests.** Jeder trägt das gemessene alte Verhalten im Kommentar.

| Datei                                        | vorher | nachher | neu | gegen `01d0e4cc`                          |
| -------------------------------------------- | -----: | ------: | --: | ----------------------------------------- |
| `shared/tests/audit-custom-sql.test.ts`      |     54 |      75 | +21 | 19 rot                                    |
| `shared/tests/asn1-der-bounds.test.ts` (neu) |      — |      15 | +15 | Worker getötet; ohne den Endlosfall 9 rot |
| `shared/tests/language-resolver.test.ts`     |     41 |      50 |  +9 | 8 rot                                     |
| `shared/tests/zip-safety-s04-04.test.ts`     |      8 |      10 |  +2 | 2 rot                                     |
| `reporting/tests/variable-resolver.test.ts`  |     16 |      22 |  +6 | 5 rot                                     |
| `email/tests/template-render-smoke.test.ts`  |     36 |      42 |  +6 | 4 rot                                     |
| `db/tests/unit/sql-result.test.ts` (neu)     |      — |       8 |  +8 | `requireRow` existierte nicht             |

Der Nachweis für `asn1-der-bounds.test.ts` ist ein besonderer und deshalb hier
ausgeschrieben. Gegen `01d0e4cc` **terminiert die Datei nicht** — der Testfall
zur negativen Kindlänge nimmt den Testlauf mit:

```
$ timeout -s KILL 45 npx vitest run packages/shared/tests/asn1-der-bounds.test.ts
  Tests   (15)          ← kein einziges Ergebnis
  Errors  1 error
  Duration 22.70s
  ⎯⎯ Unhandled Error ⎯⎯
  Error: [vitest-pool]: Worker forks emitted error.
  Caused by: Error: Worker exited unexpectedly
```

Ohne diesen einen Fall (`-t "readNode"` bzw. `-t "encode"`) liefern die
übrigen gegen den alten Stand:

```
Tests  7 failed | 2 passed | 6 skipped (15)
Tests  2 failed | 2 passed | 11 skipped (15)
```

Nach der Behebung: `Tests  15 passed (15)`.

---

## 11. Geänderte Dateien

129 Dateien in `packages/**`, davon 10 `tsconfig.json`, plus dieses Dokument.
`git diff --stat`: **3.539 Zeilen hinzugefügt, 1.180 entfernt**.

| Bereich                                                   | Umfang                                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/*/tsconfig.json`                                | 10 Dateien — Schalter entfernt, Kommentarblock durch die gemessene Tabelle ersetzt      |
| `packages/shared/src/**`                                  | 19 Dateien — 172 Fundstellen, darunter P-1 bis P-6, P-12 bis P-16                       |
| `packages/db/src/**`                                      | 12 Dateien — 57 Fundstellen, darunter P-10, P-11, P-15; neuer Helfer in `sql-result.ts` |
| `packages/{ai,auth,automation,email,graph,reporting}/src` | 15 Dateien — 63 Fundstellen, darunter P-7, P-8, P-9                                     |
| `packages/*/tests/**`                                     | 63 Dateien — 588 Fundstellen; 2 neue Testdateien, 5 erweiterte                          |
| `docs/UMSETZUNG-WELLE-4B-6.md`                            | dieses Dokument                                                                         |

**Nicht angefasst:** `apps/**`, `scripts/**`, `.eslint-ratchet.json`,
`.coverage-ratchet.json`, `.dead-exports-ratchet.json`, `.github/**`,
`docs/OFFENE-PUNKTE-REGISTER.md`, `packages/db/drizzle/**`. Nicht committet,
nicht gepusht.
