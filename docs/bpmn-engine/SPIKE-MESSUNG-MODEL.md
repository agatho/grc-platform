# Spike-Messung — Modell- und Round-Trip-Schicht

**Zweck:** Grundlage für die Hochrechnung auf die Modellierungsschicht (AP6 des
Plans). Alles hier ist gemessen, nicht geschätzt; wo geschätzt wird, steht es dabei.

- **Zeitraum:** eine Sitzung, 2026-09-01
- **Umfang:** `packages/bpmn/src/model/**`, `src/util/**`, `test/model/**`,
  `test/corpus/**`
- **Nicht enthalten:** Renderschicht (`src/draw/`, `src/viewer/`) — zweiter
  Arbeitsstrang, parallel

---

## 1. Was gebaut wurde

### Produktivcode — `src/`

| Datei                                | LOC | Was drin ist                                                                                                                                                                                                                                                                                                         |
| ------------------------------------ | --: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `util/xml-parse.ts`                  | 348 | eigener XML-Leser: Elemente, Attribute, Text, CDATA, Kommentare, PIs, DOCTYPE, Entity-Dekodierung, strikte Wohlgeformtheitsprüfung. Kein `DOMParser`, weil (a) `tsconfig.base.json` kein DOM-`lib` hat, (b) der Round-Trip-Prüfstand exakt zählen muss, was dasteht, nicht was eine DOM-Implementierung daraus macht |
| `util/xml-canonical.ts`              | 492 | Kanonisierer (Präfixe → URIs, Attribute sortiert, Whitespace normalisiert, Zahlen auf 6 Nachkommastellen, Geschwisterordnung normalisiert außer bei Waypoints/Mixed Content), LCS-basierter Zeilendiff, Knotenzählung und Verlust-/Zugewinn-Vergleich                                                                |
| `model/moddle.ts`                    |  55 | moddle-Registry mit der ARCTOS-Erweiterung, eingefrorene Konstanten (URI, Präfix, `grcmetadata`)                                                                                                                                                                                                                     |
| `model/io.ts`                        | 177 | `importXml` / `exportXml` / `roundTrip`, typisierte Fehler, Z-D-Mechanismus (Quelltext am Baum, `markModified`)                                                                                                                                                                                                      |
| `model/access.ts`                    | 429 | typisierte Zugriffshilfen: Prozesse, Collaboration/Pools, Flow-Nodes, Sequenzflüsse, Lanes + Lane-Mitgliedschaft, Boundary-Attachment, Event-Definitionen, `extensionElements`, `arctos:grcMetadata` (vollständig), DI-Index/Bounds/Waypoints                                                                        |
| `model/types.ts`                     |  80 | Plain-Data-Formen der GRC-Erweiterung                                                                                                                                                                                                                                                                                |
| `model/bpmn-moddle.d.ts`             |  58 | Typdeklaration für `bpmn-moddle` (liefert keine)                                                                                                                                                                                                                                                                     |
| `model/index.ts`, `util/index.ts`    |  67 | öffentliche Oberfläche                                                                                                                                                                                                                                                                                               |
| `model/arctos-moddle-extension.json` | 118 | **Bytekopie** von `apps/web/src/components/bpmn/arctos-moddle-extension.json`; ein Test bricht, sobald die beiden auseinanderlaufen                                                                                                                                                                                  |

**1.706 Zeilen brutto, 1.199 ohne Kommentare und Leerzeilen** (+118 Zeilen JSON,
kopiert, nicht geschrieben).

### Testcode — `test/`

| Datei                         | LOC | Was drin ist                                                                                                                                     |
| ----------------------------- | --: | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `model/assurances.ts`         | 253 | die vier Zusicherungen als eine Messung über eine Datei, plus die informative Geschwisterordnungs-Messung                                        |
| `model/measure-roundtrip.ts`  | 347 | Korpuslauf, Berichtserzeugung, Exit-Code                                                                                                         |
| `model/roundtrip.test.ts`     | 224 | Prüfstand: harte Forderung für alle 33 `repo-*`-Dateien, Abweichungs-Ratsche für die `synth-*`-Dateien, sechs Charakterisierungstests je Ursache |
| `model/model.test.ts`         | 345 | Erweiterungs-Parität, Import/Export, Z-D, Zugriffshilfen, `grcMetadata`                                                                          |
| `model/xml-canonical.test.ts` | 205 | der Kanonisierer selbst — _was muss gleich zählen_, _was darf nie gleich zählen_                                                                 |
| `model/corpus.ts`             |  39 | Korpus-Loader                                                                                                                                    |

**1.413 Zeilen brutto, 1.175 ohne Kommentare und Leerzeilen.**
105 Tests, alle grün, Laufzeit 1,2 s (ohne jsdom-Start).

### Korpus — `test/corpus/`

52 `.bpmn`-Dateien, 1.841 Zeilen XML, plus `INDEX.md` (114 Zeilen).

- **33 aus dem Repo extrahiert** — jedes real vorkommende XML-Literal aus
  Seed-SQL, `packages/shared/tests/*`, `apps/web/src/__tests__/**`,
  `apps/web/e2e/**`, `docs/PRD_Sprint3.md`. Herkunft je Datei mit Zeile im Index.
- **19 selbst gebaut** — Lanes/Pools/MessageFlows, Boundary Events, alle
  Gateway- und Ereignistypen, alle Task-Arten, dreifach verschachtelte
  SubProcesses, DataObjects/Artefakte, camunda+zeebe+signavio-Extensions,
  lokal deklarierter Fremd-Namensraum, `GrcMetadata` mit großem G, explizite
  Schema-Defaults, ins Leere zeigende IDREFs, ungewöhnliche Attributreihenfolge,
  CDATA/Umlaute/Emoji, ohne DI-Abschnitt, unpräfigiertes Default-Namespace-XML,
  Kommentare/PIs, Excel-Import-Ausgabe, 556-Element-Diagramm.

Abdeckung: von **8 BPMN-Elementtypen im Bestand** (Bestandsaufnahme §1.4b) auf
**über 60**.

### Bericht

`packages/bpmn/test/model/ROUNDTRIP-REPORT.md`, 357 Zeilen, maschinell erzeugt.

---

## 2. Ergebnis der Messung

| Zusicherung                               | Dateien     |
| ----------------------------------------- | ----------- |
| Z-A kanonische Äquivalenz                 | 43 / 52     |
| Z-B Idempotenz ab Durchgang 2 (byteweise) | **52 / 52** |
| Z-C Nichtverlust                          | 44 / 52     |
| Z-D Read-preserve-write                   | **52 / 52** |
| alle vier                                 | 43 / 52     |

Aufgeschlüsselt nach Herkunft:

| Gruppe                                | alle vier   |
| ------------------------------------- | ----------- |
| aus dem Repo extrahiert (`repo-*`)    | **33 / 33** |
| selbst gebaute Härtefälle (`synth-*`) | 10 / 19     |

**Kein einziges real im Repo vorkommendes Diagramm weicht ab.** Alle neun
Abweichungen liegen in selbst gebauten Härtefällen und gehen auf vier
Verhaltensweisen von `moddle-xml` zurück:

1. **Attribut mit Schema-Defaultwert wird beim Schreiben weggelassen** —
   16 verschiedene Attribute im Korpus (`boundaryEvent/@cancelActivity`,
   `startEvent/@isInterrupting`, `definitions/@expressionLanguage`,
   `arctos:ropa/@requiresDpia`, …). Nach dem Buchstaben von Z-C ein Verlust,
   nach dem Sinn keiner: das Dokument bedeutet dasselbe. Größte Einzelursache.
2. **Nicht auflösbare IDREF wird verworfen** — `dataStoreRef`, `messageRef`,
   `errorRef`, `BPMNShape/@bpmnElement`. **Das ist echter Datenverlust.** Ein
   Teilexport aus einem Fremdrepository verliert Information beim ersten
   Speichern in ARCTOS. `moddle` warnt (`unresolved reference <…>`), aber die
   Warnung geht heute in `apps/web` nirgends hin.
3. **`xml.tagAlias: "lowerCase"` normalisiert `GrcMetadata` → `grcMetadata`** —
   von §5.2 des Plans ausdrücklich so gefordert, kein Defekt, verschiebt aber Z-A.
4. **Kommentare und Processing Instructions verschwinden** — sie kommen im
   moddle-Baum nicht vor. Außerhalb von Z-C (das Elemente, Attribute und
   Textknoten zählt), aber Inhalt, den jemand absichtlich hingeschrieben hat.

Zusätzlich gemessen, ausdrücklich **keine** Zusicherung: die
**Geschwisterreihenfolge** bleibt in 43 / 52 Dateien erhalten. `moddle-xml`
schreibt Kinder in Schema-Reihenfolge zurück, nicht in Quellreihenfolge — ein
Textdiff einer gespeicherten Datei zeigt also Bewegung auch dort, wo Z-A hält.
Das ist für `bpmn-diff.ts` und die Versionshistorie relevanter als die
Z-A-Zahl selbst.

### Was daraus für §5.6 (Abschaltkriterien) folgt

Kriterium 1 verlangt „Z-A/Z-B/Z-C grün über den **gesamten** Korpus". Auf der
heutigen Basis ist das **nicht erreichbar**, ohne eine der drei Größen
umzudefinieren — und zwar unabhängig davon, wie gut die Eigenimplementierung
wird, weil die Abweichungen aus `bpmn-moddle` stammen, das der Plan bewusst
weiterverwendet. Konkret ist zu entscheiden:

- Z-C so präzisieren, dass ein weggelassenes Attribut mit Schema-Defaultwert
  **kein** Verlust ist (empfohlen — sonst misst man `moddle`, nicht ARCTOS);
- Ursache 2 (verworfene IDREF) **als Fehler stehen lassen** und im Importer
  auffangen: unauflösbare Referenzen als `$attrs` erhalten oder mindestens die
  moddle-Warnung an die Oberfläche durchreichen. Sonst frisst der Shadow-Compare
  aus §5.4 diesen Fall stillschweigend, weil beide Engines gleich verlieren;
- Ursachen 3 und 4 als erwartete Normalisierung dokumentieren.

Der Prüfstand ist so gebaut, dass diese Entscheidung sichtbar wird statt
wegdefiniert: `KNOWN_DEVIATIONS` in `roundtrip.test.ts` listet jede Abweichung
namentlich mit Ursache, und der Test schlägt **in beide Richtungen** fehl — auch
wenn eine Datei aufhört abzuweichen.

---

## 3. Aufwand

**Näherung über Werkzeugaufrufe: rund 45.** Grobe Verteilung:

| Tätigkeit                                                                               | Aufrufe | Anteil |
| --------------------------------------------------------------------------------------- | ------: | ------ |
| Pflichtlektüre und Repo-Erkundung (Plan, Bestandsaufnahme, Extension, moddle-Verhalten) |     ~10 | 22 %   |
| Korpus: Extraktion aus dem Repo, Benennung, 19 Härtefälle schreiben                     |     ~10 | 22 %   |
| Modellschicht (`moddle.ts`, `io.ts`, `access.ts`, `types.ts`, Typdeklaration)           |      ~6 | 13 %   |
| Kanonisierer + XML-Parser, inkl. zwei Korrekturrunden                                   |      ~6 | 13 %   |
| Prüfstand, Messskript, Berichtserzeugung                                                |      ~6 | 13 %   |
| Tests (105)                                                                             |      ~3 | 7 %    |
| Typecheck, Testlauf, Blockade in der Coverage-Konfiguration                             |      ~4 | 9 %    |

Auf Personentage übertragen — **Schätzung, kein Messwert** — entspricht der
Umfang etwa **3–4 PT** für jemanden, der `bpmn-moddle` und das ARCTOS-Repo
bereits kennt; **6–8 PT** ohne diese Vorkenntnis, weil der größte Einzelposten
(der Korpus) reine Fleißarbeit mit hohem Rechercheanteil ist.

---

## 4. Wo es unerwartet leicht war

**`bpmn-moddle` trägt mehr, als der Plan ihm zutraut.** §2.2 sagt, die
Extension „trägt ohne Zutun herüber" — das stimmt und ist stärker als erwartet:
`tagAlias`, `isMany`, `isAttr`, `superClass` und der Erhalt fremder
`extensionElements` funktionieren auf Anhieb. camunda-, zeebe- und
signavio-Elemente überleben den Round-Trip vollständig, verschachtelt, mit
Attributen, **auch wenn der Namensraum nur am Extension-Element selbst
deklariert ist** — der Fall, den §5.3 ausdrücklich als „Fixture-Fall, kein
Vertrauensfall" markiert. Er hält.

**Z-B und Z-D sind geschenkt.** Idempotenz ab Durchgang 2 gilt für alle 52
Dateien byteweise, auf Anhieb, ohne eine Zeile Zutun. Z-D ist ein Symbol am
Objekt und zehn Zeilen Code; die Zusicherung, die dem Eigentümer-Wunsch
„bit-treu" am nächsten kommt, ist die billigste der vier. §5.1 nennt sie
„viel billiger" — das ist untertrieben.

**Die Zugriffshilfen sind mechanisch.** 429 Zeilen `access.ts` waren Fleiß, kein
Denken: der moddle-Baum ist regelmäßig, und die einzige echte Entscheidung war,
dass fehlende Container leere Arrays liefern und nichts wirft.

**Der Extraktion aus dem Repo lag kein Problem zugrunde.** 37 XML-Blöcke, davon
zwei mit Template-Interpolation und eine Dublette, in einem Durchgang mit einem
30-Zeilen-Skript.

## 5. Wo es unerwartet schwierig war

**Der Kanonisierer ist das eigentliche Stück Arbeit, nicht die Modellschicht.**
492 + 348 = 840 Zeilen, fast die Hälfte des Produktivcodes, für etwas, das im
Plan gar nicht als Baustein auftaucht. Drei Fallen, alle erst im Messergebnis
sichtbar geworden:

1. **Zu strenge Kanonisierung erzeugt Falschmeldungen.** Die erste Fassung
   verglich zeilenweise in Dokumentreihenfolge und meldete 50 Abweichungen für
   ein Diagramm, in dem `moddle` `<incoming>` vor `<outgoing>` schreibt. Z-A ist
   im Plan über eine Element*menge* formuliert, nicht über eine Folge — die
   Kanonisierung muss die Geschwisterordnung also normalisieren, aber **nicht**
   bei Waypoints (dort ist die Folge der Streckenzug) und nicht bei Mixed
   Content. Das ist eine fachliche Entscheidung, keine technische, und sie steht
   in keinem Dokument.
2. **Ein naiver Zeilendiff desynchronisiert.** Ein einziges weggelassenes
   Attribut in Zeile 4 ließ alle folgenden Zeilen als verschieden erscheinen —
   50 gemeldete „Abweichungen" für eine Ursache. Erst ein LCS-Alignment machte
   aus dem Rauschen die tatsächliche Aussage: _zwei_ entfernte Zeilen. Ohne
   diesen Schritt wäre der Bericht unbrauchbar gewesen, in beide Richtungen:
   unlesbar **und** irreführend über den Schweregrad.
3. **Der Kanonisierer ist das Messgerät und muss selbst geprüft werden.**
   `xml-canonical.test.ts` ist deshalb zweigeteilt — _was muss gleich zählen_
   und _was darf nie gleich zählen_. Der zweite Teil ist der wichtigere: ohne
   ihn kann ein zu großzügiger Kanonisierer eine kaputte Serialisierung grün
   melden, und niemand merkt es.

**Die Härtefälle selbst zu bauen ist mehr Arbeit als gedacht.** Nicht das
Schreiben, sondern das *Richtig*schreiben: gültige `dataInputAssociation` mit
`property`-Ziel, `laneSet` mit `flowNodeRef`, `BPMNPlane` je Drill-Down-Ebene,
`xsi:type` an `conditionExpression`. Zwei Fixtures waren im ersten Anlauf
unbeabsichtigt fehlerhaft (dangling `dataStoreRef`), was zunächst wie ein Befund
aussah. Daraus wurden zwei Fixtures: eine korrekte und eine, die den Fall
absichtlich herstellt. **Lehre:** ein Härtefall muss genau eine Sache hart machen,
sonst weiß man hinterher nicht, was er gemessen hat.

**Blockade außerhalb der eigenen Dateihoheit.** `packages/bpmn` hatte keinen
Eintrag in `COVERAGE_FLOORS` (`vitest.coverage.shared.ts`); `coverageFor()` wirft
dann beim Laden der Konfiguration, und `vitest` startet gar nicht. Eine Zeile
hinzugefügt (provisorischer Floor 40/30, als solcher kommentiert). Außerdem:
`vitest --config packages/bpmn/vitest.config.ts` vom Repo-Wurzelverzeichnis
findet keine Tests, weil `include` gegen `process.cwd()` aufgelöst wird — der
Lauf muss aus `packages/bpmn` heraus erfolgen (`cd packages/bpmn && npx vitest run`).

---

## 6. Hochrechnung auf die Modellierungsschicht

**Kurz: die Modellierungsschicht ist erheblich schwerer, und diese Messung
belegt es nicht — sie grenzt nur ein, wie viel sie _nicht_ belegt.**

Was hier gebaut wurde, ist **zustandslos und total**: XML rein, Baum raus, Baum
rein, XML raus. Es gibt keinen gültigen und ungültigen Zwischenzustand, keine
Reihenfolge von Operationen, kein Rückgängigmachen. Jede Funktion ist über einer
Datei prüfbar, und der Korpus liefert 52 davon. Deshalb war die Testarbeit
proportional zum Code (1.175 zu 1.199 Zeilen, Verhältnis ~1:1).

Die Modellierungsschicht ist das Gegenteil:

| Eigenschaft   | Modellschicht (hier)               | Modellierungsschicht (AP6)                                                                                                                           |
| ------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zustand       | keiner                             | drei Bäume (semantisch, DI, diagram-js) müssen bei **jedem** Kommando synchron bleiben                                                               |
| Prüfbarkeit   | eine Datei rein, eine Aussage raus | Aussagen über _Folgen_ von Kommandos; der Fehler entsteht in Schritt 3 und zeigt sich in Schritt 7                                                   |
| Testraum      | 52 Dateien, endlich, aufzählbar    | Kreuzprodukt aus ~18 Elementtypen × ~12 Operationen × Container-/Lane-/Pool-Kontext — nicht aufzählbar, nur stichprobenhaft oder eigenschaftsbasiert |
| Rückgängig    | entfällt                           | jedes Kommando braucht ein korrektes Inverses, sonst ist Undo Datenverlust                                                                           |
| Fehlerwirkung | falscher Bericht                   | **falsches XML in `process_version.bpmn_xml`**                                                                                                       |

Drei konkrete Belege aus dieser Messung, die für AP6 direkt zählen:

1. **`access.ts:getLaneOf` musste _suchen_.** Lane-Mitgliedschaft steht in BPMN
   am `bpmn:Lane/flowNodeRef`, nicht am Knoten. Lesen heißt suchen; _Schreiben_
   heißt, bei jedem Verschieben eines Knotens die `flowNodeRef`-Liste der alten
   und der neuen Lane zu pflegen — und bei geschachtelten Lanes die richtige
   Ebene zu treffen. Das ist genau das Beispiel aus §2.3.1, und es ist eines von
   mindestens fünf gleichartigen.
2. **Boundary-Attachment ist schon beim Lesen zweistellig.** `attachedToRef`
   verweist auf die Aktivität, `cancelActivity` entscheidet über das Verhalten,
   und die DI liegt auf dem Rand der Aktivität. Beim Bearbeiten kommen dazu:
   Aktivität verschieben → Boundary mitziehen; Aktivität löschen → Boundary und
   alle daran hängenden Flows löschen; Aktivität ersetzen → Boundary umhängen
   oder verwerfen. Drei Regeln pro Kombination, und keine davon fällt aus
   `diagram-js` heraus.
3. **`moddle` verwirft eine unauflösbare Referenz stillschweigend.** Beim Lesen
   ist das ein dokumentierbarer Befund. Beim _Bearbeiten_ ist es eine Falle: wer
   ein Element löscht, dessen ID noch referenziert wird, erzeugt genau diesen
   Zustand — und die Referenz ist beim nächsten Speichern weg, ohne Fehler.
   Der `BpmnUpdater` muss Referenzintegrität also aktiv herstellen; er kann sich
   nicht darauf verlassen, dass die Serialisierung meckert.

**Einordnung gegenüber der Planschätzung (§2.3: 2.800–4.000 LOC für
`features/modeling`, ±50 %).** Diese Messung gibt keinen Anlass, die Zahl zu
senken, und zwei Gründe, sie eher am oberen Rand zu erwarten:

- Das Verhältnis Test:Produktiv war hier ~1:1 bei zustandslosem Code. Für
  zustandsbehafteten Code mit Undo ist 1,5:1 bis 2:1 realistisch; der Plan setzt
  „etwa das Gleiche an Testcode" an, was für AP6 zu wenig ist.
- Der Kanonisierer, den es jetzt gibt, war im Plan nicht als eigener Posten
  vorgesehen und hat 840 Zeilen gekostet. Vergleichbare „unsichtbare Werkzeuge"
  sind für AP6 absehbar: ein Kommando-Generator für eigenschaftsbasierte Tests
  (§6.1 nennt 10.000 Fälle), ein Baum-Invarianten-Prüfer, der nach jedem
  Kommando alle drei Bäume gegeneinander hält. Beide sind Voraussetzung dafür,
  AP6 überhaupt absichern zu können, und in keiner Zeile der Schätzung enthalten.

**Faktor, ehrlich geschätzt:** die Modellierungsschicht ist **5- bis 8-mal so
aufwendig** wie das, was hier gebaut wurde — nicht weil sie mehr Zeilen hat
(2.800–4.000 gegen 1.200, also Faktor 2,5–3), sondern weil jede Zeile davon
zustandsbehaftet, reihenfolgeabhängig und nur stichprobenhaft prüfbar ist. Die
Modellschicht war in einer Sitzung fertig und misst sich selbst. AP6 wird man
nicht fertig sehen, sondern nur „seit N Speichervorgängen ohne Abweichung" —
weshalb der Shadow-Compare aus §5.4 nicht ein Sicherheitsnetz ist, sondern das
eigentliche Abnahmeverfahren.

---

## 7. Reproduktion

```bash
# Messung + Bericht (Exit 1, wenn eine Zusicherung fällt)
cd /work/repo && npx tsx packages/bpmn/test/model/measure-roundtrip.ts

# Testsuite (muss aus dem Paketverzeichnis laufen, s. §5)
cd /work/repo/packages/bpmn && npx vitest run test/model

# Typecheck
cd /work/repo && npx tsc --noEmit -p packages/bpmn/tsconfig.json
```
