# Stufe 2 — Prüfwerkzeuge für die Modellierungsschicht

**Datum:** 2026-09-02 · **Branch:** `audit/full-2026-08-31` · **Paket:** `packages/bpmn`
**Bereich:** `src/verify/**`, `test/verify/**`, `test/property/**`

---

## 0. Warum diese Werkzeuge vor der Schicht entstanden, die sie prüfen

Die Spike-Auswertung hat den Befund geliefert, der die Reihenfolge begründet: die zwei
ernstesten gefundenen Fehler — doppeltes `xmlns` und visuell ununterscheidbares
gefangen/geworfen — fand **kein einziger** der 118 Tests, sondern das Rasterisieren und
Ansehen. In der Modellierungsschicht gibt es dieses Auge nicht, weil ihre Fehler sich nicht
im Bild zeigen. Sie zeigen sich in einer Datei, die ein Fremdwerkzeug Monate später nicht
mehr liest.

Fünf Werkzeuge sind entstanden. Sie haben, während dieser Bericht geschrieben wurde,
**sieben echte Fehler in der Modellierungsschicht** gefunden, dazu eine zu streng gefasste
Invariante. Vier der sieben haben eine Reproduktion aus **einer einzigen Operation**, zwei
weitere aus zweien. Keiner davon ist am Bild sichtbar. Genau das war die Behauptung.

---

## 1. Was gebaut wurde

| Werkzeug             | Datei                                                  |       LOC | Was es zusichert                                                       |
| -------------------- | ------------------------------------------------------ | --------: | ---------------------------------------------------------------------- |
| Invariantenprüfer    | `src/verify/invariants.ts`                             |       932 | 35 Invarianten über semantischen Baum und DI, nach **jeder** Operation |
| Eigenschaftstests    | `src/verify/property.ts`, `random.ts`, `operations.ts` |       904 | zufällige Operationsfolgen mit Seed und Schrumpfen                     |
| Vergleichslauf       | `src/verify/shadow.ts`, `snapshot.ts`                  |       899 | dasselbe Diagramm durch beide Engines, jede Abweichung klassifiziert   |
| Bildvergleich        | `src/verify/raster.ts`                                 |       286 | Render → Rasterung → Referenzbild, AA-tolerant, geometrie-intolerant   |
| Leistungsbudget      | `src/verify/budget.ts`                                 |       137 | Zeit und Speicher am größten Korpusdiagramm, als Test                  |
| Treiber + Fassade    | `src/verify/driver.ts`, `drivers/*`, `index.ts`        |     1.246 | eine Schnittstelle, zwei Engines                                       |
| **Produktiv gesamt** |                                                        | **4.404** |                                                                        |
| **Test gesamt**      | `test/verify/**`, `test/property/**`                   | **1.618** |                                                                        |

`npx tsc --noEmit -p packages/bpmn/tsconfig.json` fehlerfrei (strenge Flags, inkl.
`noUncheckedIndexedAccess`). `npx vitest run` grün: **29 Dateien, 541 Tests, 88 s**.
`eslint` ohne Befund.

### Die eine Entwurfsentscheidung, an der alles hängt

Operationen benennen ihre Ziele **nicht über Ids**, sondern über einen Selektor aus
Kategorie und Index (`flowNode#12`), der zur Ausführungszeit gegen die Kandidatenliste der
Engine aufgelöst wird. Ohne das wäre nichts von alledem möglich: jede Engine erfindet eigene
Ids (`Activity_0e81y14` gegen `Task_3`), eine Folge mit Ids wäre weder wiederholbar noch auf
zwei Engines abspielbar. Die Sortierung der Kandidaten ist dabei bewusst **nicht**
lexikografisch — `bpmn-js` würfelt seine Ids, eine Sortierung nach Id macht schon den zweiten
Lauf derselben Folge nicht reproduzierbar. Sortiert wird: Bestandselemente lexikografisch
zuerst, danach die erzeugten in Erzeugungsreihenfolge (`CandidateOrder` in `driver.ts`).

---

## 2. Was die Werkzeuge zusichern

### 2.1 Eigenschaftstests (Aufgabe 1)

**Gelaufen:** 500 zufällige Folgen in zwei Läufen mit verschiedenen Seeds —
200 × 14 Operationen (Seed 20260901) und 300 × 16 (Seed 5150). Zusammen **7.127 ausgeführte
Operationen**, davon 4.923 tatsächlich angewandt, 1.688 von den BPMN-Regeln abgelehnt,
516 ohne passendes Element. Basis sind die **26 Korpusdiagramme, die eine `BPMNDiagram` mitbringen** (s. §4.11).

Geprüft wird nach **jedem einzelnen Schritt**, nicht am Ende der Folge: eine Folge, die valide
endet, aber durch einen kaputten Zustand läuft, ist trotzdem ein Fehler — der Nutzer kann dort
speichern. Zusätzlich am Ende jeder Folge: Export → Neuimport → erneute Prüfung. Das ist die
Stelle, die ein Modell fängt, das im Speicher richtig und auf der Platte falsch ist.

**Schrumpfen** ist umgesetzt als Delta-Debugging (ddmin) über die Operationsliste, gefolgt von
einer Vereinfachung einzelner Operationen (Verschiebung auf 0,0; Name auf `"a"`;
Selektorindex halbiert). Eine Kandidatenfolge zählt nur dann als „schlägt noch fehl", wenn sie
mit **mindestens einer der ursprünglichen Invarianten-Ids** fehlschlägt — ohne diese Sperre
schrumpft ddmin fröhlich auf einen _anderen_, trivialeren Fehler und meldet den falschen.
Gemessene Wirkung: 14 Operationen → 1 Operation in 6–7 Versuchen, 16 → 5 in 98 Versuchen.
Der Bericht nennt zusätzlich die Ids, auf die die Selektoren aufgelöst haben, damit aus
`connect(flowNode#8 → flowNode#2)` ein `Task_MR_Inputs → Task_MR_Beschluesse` wird.

`fast-check` wurde **nicht** installiert. Der Generator ist selbst geschrieben, samt Schrumpfen.
Grund: eine Installation ändert `package.json` und `package-lock.json`, beides außerhalb der
Dateihoheit dieses Arbeitsstrangs, und zwei weitere Agenten arbeiten parallel im selben Baum.

**Basislinien-Abgleich.** Vor der ersten Operation werden die Invarianten des Ausgangsdokuments
erhoben. Nur Verletzungen, die eine Operation _neu_ einführt, zählen als Fehler. Ohne das
meldet jedes Korpusdiagramm mit unvollständiger DI einen Fehler, den keine Operation verursacht
hat.

### 2.2 Vergleichslauf gegen `bpmn-js` (Aufgabe 2)

Zwei Stufen, beide über `ModelingDriver` — dieselbe Schnittstelle für beide Engines.

**Import über den Korpus, ohne jede Bearbeitung.** 26 Diagramme, beide Engines, Vergleich von
Elementmenge, Typ, Container, Referenzen, Bounds (±1 px) und Wegpunkten (±2 px).
**Ergebnis: 20 Abweichungen, alle einer einzigen, gewollten Klasse; null unklassifiziert,
null `ours-wrong`.** Das ist das stärkste Einzelergebnis dieses Berichts: der _Lesepfad_ der
Eigenimplementierung stimmt mit der Referenz überein, und weil DI gelesen und nicht gerechnet
wird, kann eine Übereinstimmung hier nicht zufällig sein.

**Nach Bearbeitung.** 100 Folgen à 10 Operationen: 143 Abweichungen, alle klassifiziert.
Über drei verschiedene Seeds stabil.

**Klassifikation — vier Urteile, keine stille Toleranz.** Eine Abweichung ohne Eintrag in
`DIVERGENCE_RULES` lässt den Test fehlschlagen.

- `both-lossy` wird **gemessen, nicht behauptet**: `lossySignatures()` schickt das
  Ausgangsdokument durch `importXml`/`exportXml` allein und sammelt, was dabei schon verloren
  geht. Eine Abweichung mit dieser Signatur ist per Konstruktion eine Eigenschaft von
  `bpmn-moddle`, die beide Engines erben — genau die vier Ursachen aus
  `ROUNDTRIP-REPORT.md`. Damit kann der Vergleich die dokumentierten Verluste nicht als
  „richtig, weil bpmn-js es auch so macht" durchwinken.
- `intentional`, `reference-wrong`, `ours-wrong` stehen als Regeln mit Begründung im Code.

**Befristung.** Der Kopfkommentar von `src/verify/drivers/bpmnjs.ts` nennt die vier
Bedingungen, an denen man erkennt, dass die Zeit des Prüfstands um ist (Plan §5.6): `bpmn-js`
ist keine Abhängigkeit mehr; die Liste der `ours-wrong`-Klassen ist leer; der
Eigenschaftstest läuft in CI gegen `drivers/arctos.ts`; Shadow-Compare-Speichern hat 30 Tage
und 500 Speichervorgänge ohne Abweichung überstanden. Dann gehen `shadow.ts`,
`drivers/bpmnjs.ts`, `test/verify/jsdom-svg.ts` und `test/verify/shadow.test.ts` **in einem
Commit** — bewusst, nicht durch Vergessen. Bis dahin ist `bpmn-js` nirgends sonst in `src/`
erwähnt, und der Import ist dynamisch, damit ihn kein Bundle versehentlich einzieht.

### 2.3 Bildvergleich (Aufgabe 3)

11 Referenzbilder unter `test/verify/baseline/`, ausgewählt so, dass jede Formfamilie, zu der
der Renderer eine Meinung hat, mindestens einmal vorkommt: Ereignisse, Gateways, Task-Arten,
Boundary-Events, Pools und Lanes, Datenobjekte, verschachtelte Subprozesse, Umlaute und CDATA.
Neuerzeugung ausdrücklich und dokumentiert:

```
cd packages/bpmn
UPDATE_BASELINES=1 npx vitest run --config vitest.config.ts test/verify/raster.test.ts
```

**Die Toleranz ist das eigentliche Entwurfsproblem.** „Antialiasing verzeihen, eine verschobene
Kante nicht" lässt sich nicht als Prozentsatz abweichender Pixel ausdrücken — beide Effekte
verändern etwa gleich viele. Sie unterscheiden sich in der **Form**: Antialiasing ändert einen
Saum von **einem** Pixel Breite, eine verschobene Kante ein Band von **mindestens zwei**. Der
Test ist deshalb morphologisch: Differenzmaske bilden, **erodieren** (ein Pixel überlebt nur,
wenn links _oder_ rechts **und** oben _oder_ unten ebenfalls abweichen), und jedes überlebende
Pixel bedeutet echte Geometrie.

Der erste Versuch war eine volle 3×3-Erosion über alle acht Nachbarn. Die braucht ein
_drei_ Pixel breites Band und ließ eine Verschiebung um zwei Pixel durch. Gefunden hat das der
zweite Selbsttest des Vergleichers — der Grund, warum ein Vergleicher eigene Tests braucht:
drei Tests prüfen, dass er einen Saum verzeiht, eine Zwei-Pixel-Verschiebung nicht verzeiht
und eine Größenänderung meldet. Ein Vergleicher, der immer „gleich" sagt, sieht von außen
genauso aus wie einer, der funktioniert.

**Die Bilder wurden angesehen, nicht nur erzeugt.** Die Notation stimmt: gefangen/geworfen
unterscheidbar, Ereignis-Subprozess gestrichelt, nicht-unterbrechendes Boundary-Event
gestrichelt, Pools mit gedrehten Lane-Köpfen, Nachrichtenflüsse gestrichelt. Sichtbar sind
auch die zwei im Spike notierten Restmängel des Renderers — fehlender Kreis am Ursprung des
Nachrichtenflusses, überlaufende Beschriftungen. Die Referenzbilder frieren sie ein, damit
ihre Behebung als bewusste Änderung erscheint und nicht als Drift.

### 2.4 Round-Trip mit Bearbeitung dazwischen (Aufgabe 4)

`test/model/roundtrip.test.ts` prüft Import → Export für ein **unberührtes** Dokument. Ergänzt
ist der Pfad, an dem das Risiko hängt: Import → n Operationen → Export → Import → Vergleich.

- **R1** Das exportierte Dokument parst. **grün**
- **R2** Der Neuimport liefert dasselbe Modell: gleiche Elemente, Typen, Container, Referenzen,
  Bounds. Verglichen über das _Dokument_, nie über den internen Graphen einer Engine. **grün**
- **R3** Idempotenz ab dem zweiten Durchgang, byteweise (Z-B). Ohne sie erzeugt jedes Speichern
  ohne Änderung einen Diff und `bpmn-diff.ts` meldet Phantomänderungen. **grün**
- **R4** n Undos nach n Operationen stellen das Ausgangsdokument kanonisch wieder her (Z-A).
  **Findet zwei Fehler** (§3.5, §3.6).

### 2.5 Leistungsbudget (Aufgabe 5)

`synth-large-flat-process.bpmn`, 556 Elemente, Median aus 5 Läufen, jsdom, dieselbe Maschine.

| Messgröße                   |       ARCTOS | `bpmn-js` |   Budget | Herkunft des Budgets                        |
| --------------------------- | -----------: | --------: | -------: | ------------------------------------------- |
| Import (Modellschicht)      |  **30,3 ms** |         — |   400 ms | fängt ein versehentliches O(n²)             |
| Rendern nach SVG            |  **96,0 ms** |         — |   900 ms |                                             |
| Import + erstes Bild        |  **89,3 ms** |         — | 2.000 ms | Plan §6.8, 500-Elemente-Spalte, unverändert |
| Export XML                  |  **12,7 ms** |    6,1 ms |   500 ms | Plan §6.8, unverändert                      |
| Import editierbar (Session) | **176,9 ms** |  249,8 ms | 3.000 ms | aus der Messung; §6.8 hat keine Zeile dafür |
| Export aus der Session      |  **15,4 ms** |    6,1 ms |        — |                                             |
| Heap (Import + erstes Bild) | **+29,1 MB** |         — |   150 MB | Plan §6.8                                   |

Der editierbare Import ist **1,4× schneller als `bpmn-js`**, der Export etwa 2,5× langsamer —
beides weit innerhalb des Budgets. Die Budgets liegen bei rund dem Dreifachen der Messung: eng
genug für eine Regression _der Art nach_, weit genug, dass eine langsame Maschine sie nicht
reißt. Ein Budget, das bei 5 % Rauschen fehlschlägt, wird binnen eines Monats gelöscht.

---

## 3. Gefundene Fehler — Meldung an A1

Alle sind mit `PROPERTY_STRICT=1` reproduzierbar und stehen mit Reproduktion und
Begründung in `packages/bpmn/test/verify/known-findings.ts`. **Keiner davon ist am Bild
sichtbar.**

### 3.1 Wegpunkt ohne x-Koordinate · **schwer** · 2 Zeilen Reproduktion

```ts
const s = await createModelingSession(corpus("synth-boundary-events"));
s.modeling.moveElements([s.shape("Task_Freigabe")], { x: 0, y: 0 });
// wirft: "Kante Flow_2 hat einen nicht-endlichen Wegpunkt"
// Flow_2.waypoints = [ {x:340,y:200}, {y:200, original:{y:200}} ]   ← kein x
```

Eine Aktivität mit Boundary-Events um **(0,0)** zu verschieben lässt den zweiten Wegpunkt von
`Flow_2` ohne x-Koordinate zurück. Derselbe Effekt bei `connect()` in einen Subprozess, dessen
Kinder keine DI haben. Der Renderer fängt es ab, die eigene Invariante
`DI_WAYPOINTS_MISMATCH` schlägt an. Folgeschaden: das Boundary-Event verliert dabei seinen
`attachedToRef` (`ref/boundary-attached-to`, `modeling/BOUNDARY_WITHOUT_HOST`) — und ein
`attachedToRef`, den moddle beim nächsten Speichern still verwirft, macht das Ereignis in jedem
Werkzeug unplatzierbar. Ursache im Layouter/Docking-Pfad, nicht im Kommandostapel.

### 3.2 Subprozess löschen verwaist die eingebettete Ebene · **schwer** · 1 Operation

```
runSequence(driver, corpus("synth-nested-subprocesses"),
  [{"kind":"remove","target":{"kind":"removable","index":24}}])   // entfernt Sub_L1
```

Der `<bpmndi:BPMNPlane bpmnElement="Sub_L1">` und **sieben** BPMNShapes/BPMNEdges darin bleiben
im Dokument und zeigen auf Elemente, die es nicht mehr gibt. Beim nächsten Speichern verwirft
moddle die unauflösbaren Referenzen (Round-Trip-Bericht, Ursache 2) und die Datei behält eine
Ebene voll ankerloser Geometrie. Eine Operation, kein Undo, keine exotische Eingabe.

### 3.3 Nachrichtenfluss in `incoming`/`outgoing` · **mittel** · 1 Operation, per Referenz entschieden

```
runSequence(driver, corpus("synth-collaboration-pools-lanes"),
  [{"kind":"connect","source":{"kind":"flowNode","index":12},
    "target":{"kind":"flowNode","index":10}}])
```

Beide Engines legen korrekt einen `<bpmn:messageFlow>` an. ARCTOS schreibt ihn **zusätzlich**
in `<bpmn:incoming>` und `<bpmn:outgoing>`; `bpmn-js` nicht. `bpmn:FlowNode.incoming/outgoing`
sind im BPMN-2.0-Metamodell als `SequenceFlow`-Referenzen typisiert — der nächste Leser löst
also einen Nachrichtenfluss als Sequenzfluss auf. **Das ist der Fall, der den Vergleichslauf
rechtfertigt:** gleiche Eingabe, gleiche Operation, Referenz widerspricht, und das Metamodell
gibt der Referenz recht. Kein Lesen einer der beiden Implementierungen hätte das so schnell
geklärt. Behebung im `BpmnUpdater`: `incoming`/`outgoing` nur für `bpmn:SequenceFlow` pflegen.

### 3.4 Datenobjekt löschen lässt Datenassoziationen hängen · **mittel** · 1 Operation

```
runSequence(driver, corpus("synth-data-objects-and-artifacts"),
  [{"kind":"remove","target":{"kind":"removable","index":8}}])   // DataObjectRef_Antrag
```

`dataInputAssociations` und `dataOutputAssociations` der Tasks zeigen weiter auf das gelöschte
Element (`modeling/DATA_ASSOCIATION_DANGLING`). Die Löschkaskade deckt Sequenzflüsse und
Boundary-Events ab, Datenassoziationen nicht. Gefunden bei Folge 90 von 200 und auf eine
Operation geschrumpft — ein Fall, den niemand von Hand schreibt.

### 3.5 Undo entfernt die erzeugte DI nicht · **mittel** · 2 Operationen

`attachBoundary` auf eine beliebige Aktivität, dann einmal `undo`: im Export steht weiterhin
`<bpmndi:BPMNShape id="BoundaryEvent_1_di_1" bpmnElement="BoundaryEvent_1">` samt Bounds.
Dasselbe bei `connect` + `undo`, das eine BPMNEdge mit Wegpunkten hinterlässt. n Operationen
gefolgt von n Undos stellen das Ausgangsdokument also nicht wieder her: der semantische Baum
stimmt, der DI-Baum ist gewachsen. Jede rückgängig gemachte Bearbeitung hinterlässt etwas mehr
verwaiste Geometrie. Die Umkehrfunktion muss die DI mit abräumen.

### 3.6 Undo stellt einen auf leer gesetzten Namen nicht wieder her · **mittel** · 2 Operationen

`rename(task, "")`, dann `undo`: der Name kommt als `name=""` zurück statt als
`"Rechnung freigeben"`. `UpdatePropertiesHandler` sichert den alten Wert offenbar mit einer
Falsy-Prüfung statt einer Vorhandenseins-Prüfung. Der Generator trifft das, weil
`AWKWARD_NAMES` absichtlich den leeren String und einen reinen Whitespace-String enthält — ein
handgeschriebener Test hätte fast sicher `"Neuer Name"` benutzt.

### 3.7 Boundary-Event an einen Ereignis-Subprozess · **mittel**

ARCTOS heftet ein Boundary-Event an Ziele, die die Referenz ablehnt. `canAttach()` in `bpmn-js`
lehnt Ereignis-Subprozess, Kompensationsaktivität und Receive-Task nach einem
ereignisbasierten Gateway ab; `BpmnRules.canAttach` in ARCTOS prüft nur, dass das Ziel eine
Aktivität ist. Gemessener Fall: `E_EventSub` in `synth-all-event-types`. **Das Urteil ist nicht
„die Referenz sagt es so":** BPMN 2.0 gibt einem Ereignis-Subprozess keine Boundary-Events,
Referenz und Spezifikation stimmen überein, ARCTOS ist der Ausreißer.

### 3.8 `PARENT_LINK_BROKEN` ist zu streng · **Invariante, nicht Engine**

Die Invariante verlangt, dass jedes verschachtelte moddle-Objekt `$parent` trägt.
`moddle-xml` serialisiert Kinder aber über die deklarierte Eigenschaft, nicht über `$parent`;
ein `dc:Bounds` ohne `$parent` läuft korrekt durch den Round-Trip — und **`bpmn-js` setzt es
ebenfalls nicht**. Dass die Invariante auf der Referenzimplementierung anschlägt, ist der
Beleg: sie ist strenger als das Format. Empfehlung: für _referenzierte_ Elemente behalten
(dort steuert `$parent` den Export), für DI-Blattobjekte auf Warnung herabstufen.

### 3.9 Offene Abweichungen gegen `bpmn-js` nach Klassifikation

100 bearbeitete Folgen, Seed 13337, 143 Abweichungen — alle klassifiziert, keine
unklassifiziert:

| Anzahl | Klasse                                                  | Urteil                                                                                               |
| -----: | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
|     34 | `waypoints/bpmn:SequenceFlow/position`                  | `ours-wrong` — dieselbe Ursache wie §3.1                                                             |
|     19 | `waypoints/bpmn:SequenceFlow/count`                     | `ours-wrong` — Layouter routet anders                                                                |
|     53 | `candidate-set/{container,flowNode,activity,removable}` | `ours-wrong` — Modelle enthalten nicht mehr dieselben Elemente, Abspielen bricht ab                  |
|      7 | `waypoints/bpmn:MessageFlow/position`                   | `ours-wrong`                                                                                         |
|     12 | `bounds/bpmn:{SubProcess,Participant}`                  | `ours-wrong` — Container werden nach Bearbeitung unterschiedlich groß (gemessen 300 px gegen 390 px) |
|      6 | `outcome/attachBoundary/applied-vs-rejected`            | `ours-wrong` — §3.7                                                                                  |
|      3 | `outcome/connect/applied-vs-rejected`                   | `ours-wrong` — Regelparität, Fall für Fall zu klären                                                 |
|      4 | `element-set/gen-/only-{ours,reference}`                | `ours-wrong` — unterschiedliche Elemente nach gleicher Folge                                         |
|      4 | `element-type/…`                                        | `ours-wrong` — Folge der Regelabweichung                                                             |
|      1 | `bounds/…/created`                                      | `ours-wrong`, gering — neu erzeugte Form 90 px versetzt                                              |
| **20** | `bounds                                                 | waypoints/*/presence/only-ours` (**nur Import**)                                                     | **`intentional`** — ARCTOS ergänzt fehlende DI, `bpmn-js` nicht |
|      0 | —                                                       | `reference-wrong`                                                                                    |
|      0 | —                                                       | `both-lossy` — **erklärungsbedürftig, s. u.**                                                        |
|      0 | —                                                       | **unklassifiziert**                                                                                  |

**Zur Null bei `both-lossy`:** die Klasse wird nur für Signaturen der Form `xml/…` vergeben,
und der XML-Vergleich ist in diesen Läufen abgeschaltet (`compareXml` ist standardmäßig aus,
weil sein Rauschen den Modellvergleich überdeckt, solange offene Befunde bestehen). Die Null
heißt also **nicht** „moddle verliert hier nichts", sondern „auf dieser Vergleichsebene kann
die Klasse gar nicht auftreten". Die Mechanik ist gebaut und durch `lossySignatures()` gedeckt;
scharf wird sie, sobald der XML-Vergleich eingeschaltet wird — was sinnvoll erst geht, wenn die
`ours-wrong`-Liste kurz ist.

Die einzige `intentional`-Klasse ist echte Absicht: `ModelingSession.repairMissingDi` gibt einem
Flusselement ohne BPMNShape eine berechnete Geometrie. ARCTOS liefert dort ein **Obermenge**,
nie eine Teilmenge — die Gegenrichtung (`presence/only-reference`) ist bewusst _nicht_
klassifiziert und würde den Test fehlschlagen lassen.

### 3.10 Zwei Fehler in den Prüfwerkzeugen selbst — gefunden von deren eigenen Tests

Der Vollständigkeit halber, weil sie zeigen, was ohne die Selbsttests durchgegangen wäre:
`getLanes()` wurde mit einem `laneSet` statt mit dem Container aufgerufen und lieferte deshalb
immer die leere Liste — die Lane-Invariante war stumm. Und `structure/parent-does-not-contain-child`
prüfte nur `flowElements` und meldete darum jeden Participant einer Kollaboration als verwaist.
Beide fand `test/verify/invariants.test.ts`, das für jede Invariante ein absichtlich kaputtes
Dokument baut und die richtige Meldung verlangt.

---

## 4. Was die Werkzeuge **nicht** zusichern

Diese Liste ist der wichtigere Teil des Berichts.

1. **Kein Layout, keine Textmetrik.** Alles läuft in jsdom. Die Textmetrik ist erfunden
   (linear in der Zeichenzahl) — ohne diese Fiktion terminiert `diagram-js`' Zeilenumbruch
   nicht einmal. Labelgrößen, externe Label-Bounds und Autoresize sind daher **nicht**
   vergleichbar und aus dem Vergleich ausgeschlossen. Das ist keine Nachlässigkeit, sondern
   die in Plan §6.2 benannte Grenze: `getBBox()` und `getComputedTextLength()` gehören in
   Stufe 3.
2. **Keine Zeigereingabe.** Palette, Kontextpad, Drag&Drop, Bendpoints, Lasso werden über die
   Modeling-API angesteuert, nicht über Events. Ein Fehler, der nur im Zusammenspiel mit
   `diagram-js`' Interaktionsschicht auftritt, wird hier nicht gefunden.
3. **Der Bildvergleich prüft nur, was gezeichnet wurde, nicht ob es richtig aussieht.** Eine
   Referenz friert den heutigen Stand ein, Mängel eingeschlossen. Und Schriften kommen aus der
   fontconfig der Maschine: auf einer anderen Maschine schlägt der Vergleich aus einem Grund
   fehl, der mit dem Renderer nichts zu tun hat. Ein Fehlschlag heißt „sieh dir das Bild an",
   nie „der Renderer ist kaputt".
4. **Farbe, Kontrast, Fokus-Sichtbarkeit, Screenreader** bleiben ungeprüft — Stufe 6.
5. **Der Vergleich gegen `bpmn-js` endet an der ersten Regelabweichung.** Sobald die beiden
   Engines eine Operation unterschiedlich beantworten, laufen sie nicht mehr dieselbe Folge:
   jeder spätere Selektor löst auf ein anderes Element auf. Der Prüfstand bricht dort ab und
   sagt es. Von 100 bearbeiteten Folgen wurden dadurch 53 vorzeitig beendet — die
   Aussagekraft des _bearbeitenden_ Vergleichs ist also deutlich geringer als die des
   Import-Vergleichs, der exakt und über den ganzen Korpus grün ist.
6. **Der Eigenschaftstest deckt 10 Operationsarten ab, nicht die 21 Editorfunktionen.**
   Copy/Paste, Align, Space-Tool, Bendpoint-Bearbeitung, Lane-Splitting über `addLane`/
   `splitLane`/`removeLane`, Kollabieren/Expandieren und das Umhängen bestehender Kanten
   (`connection.reconnect`) kommen im Vokabular **nicht** vor. Für Lanes heißt das konkret:
   `changeLane` wird als Verschiebung in die Lane-Fläche modelliert, die dedizierten
   Lane-Kommandos sind ungetestet — und §3.11 des Plans baut darauf auf.
7. **Die Hälfte des Korpus ist für diese Werkzeuge unerreichbar.** **25 der 52
   Korpusdateien haben überhaupt keine `BPMNDiagram`** — sie stammen aus Unit-Tests und
   Seed-SQL, die nur den semantischen Baum brauchten. `bpmn-js` weigert sich, sie zu öffnen
   („no diagram to display"), also können weder der Vergleichslauf noch der Eigenschaftstest
   sie als Ausgangsdokument benutzen. Für den Round-Trip-Prüfstand aus Stufe 1 zählen sie
   weiterhin voll. Das ist die billigste offene Verbesserung an der ganzen Prüfkette: DI für
   diese Dateien ergänzen verbreitert **jedes** Werkzeug in diesem Verzeichnis auf einen
   Schlag von 26 auf 52 Dokumente.
8. **Kein Vergleich mit `packages/shared`.** Die dritte BPMN-Interpretation im Repo
   (`bpmn-parser.ts`, 1.529 LOC Regex) ist nicht angebunden. Stufe 7 steht aus.
9. **Die Leistungszahlen sind jsdom-Zahlen.** Sie taugen als Größenordnung und als
   Änderungsdetektor, nicht als Aussage darüber, was ein Nutzer im Browser spürt. Der
   Heap-Wert ist ohne `--expose-gc` eine obere Schranke mit breitem Fehlerbalken; der Test
   sagt selbst, ob er an war.
10. **`known-findings.ts` macht die Suite grün, obwohl sieben Fehler offen sind.** Das ist eine
    bewusste Konstruktion: bekannte Befunde werden bei jedem Lauf laut protokolliert und
    tolerierbar gehalten, **jeder neue Befund lässt die Suite fehlschlagen**. `PROPERTY_STRICT=1`
    schaltet die Toleranz ab. Wer die Zahl der offenen Fehler wissen will, liest sie dort — die
    Datei ist eine Übergabeliste, keine Freigabe.
11. **Der Invariantenprüfer prüft, was er prüft.** 35 Invarianten über zwei Bäume. Der
    grafische Baum wird nur über die Delegation an `src/modeling/invariants.ts` abgedeckt, und
    zwar nur, wenn der Aufrufer eine `elementRegistry` mitgibt — der Eigenschaftstest tut das
    heute nicht. Ein Fehler, der ausschließlich den `diagram-js`-Graphen betrifft und sich
    weder in der Semantik noch in der DI zeigt, wird nicht gefunden.

---

## 5. Bedienung

```bash
cd packages/bpmn

# alles
npx vitest run --config vitest.config.ts

# Eigenschaftstest in groß; PROPERTY_STRICT=1 lässt bekannte Befunde fehlschlagen
PROPERTY_RUNS=2000 PROPERTY_LENGTH=20 PROPERTY_SEED=4711 \
  npx vitest run --config vitest.config.ts test/property/

# Vergleichslauf gegen bpmn-js
SHADOW_SEQUENCES=200 SHADOW_LENGTH=12 \
  npx vitest run --config vitest.config.ts test/verify/shadow.test.ts

# Referenzbilder neu erzeugen — danach ansehen
UPDATE_BASELINES=1 npx vitest run --config vitest.config.ts test/verify/raster.test.ts

# Leistungsbudget mit belastbarem Heap-Wert
node --expose-gc ./node_modules/.bin/vitest run --config vitest.config.ts test/verify/budget.test.ts
```

Die 10.000 generierten Fälle aus Plan §5.6, Kriterium 1, sind mit `PROPERTY_RUNS` erreichbar;
200 Folgen à 14 Operationen brauchen 31 s, 10.000 also grob 25 min — eine Nachtlast, keine
Commit-Last.

---

## 6. Was als Nächstes ansteht

**Für A1**, nach Schwere: §3.1 (Wegpunkt ohne x) und §3.2 (verwaiste Subprozess-Ebene) zuerst
— beide sind stiller Datenverlust beim nächsten Speichern. Danach §3.4 und §3.5 (dieselbe
Familie: Kaskaden und Umkehrfunktionen, die die DI vergessen), dann §3.3 und §3.7 (beide durch
die Referenz entschieden), dann §3.6. §3.8 ist eine Entscheidung über die eigene Invariante,
kein Fehler im Code.

**Für diesen Arbeitsstrang**, in dieser Reihenfolge:

1. Die `elementRegistry` in den Invariantenprüfer durchreichen, damit der dritte Baum
   mitgeprüft wird (Punkt 11 oben).
2. Das Operationsvokabular um die Lane-Kommandos, `connection.reconnect` und
   Kollabieren/Expandieren erweitern (Punkt 6).
3. Regelparität Fall für Fall abarbeiten, damit der bearbeitende Vergleich nicht mehr an der
   ersten Abweichung abbricht (Punkt 5) — erst dann ist er so belastbar wie der
   Import-Vergleich.
4. Stufe 3 im echten Browser: SVG-Struktur-Snapshots und Textmetrik, das was jsdom nicht kann.
5. Shadow-Compare-Speichern (Plan §5.4, Stufe S3) auf Basis von `shadowCompare()` — die
   Funktion ist so geschnitten, dass sie das ohne Umbau trägt.

---

## 7. Ein Satz zur Methode

Der Spike hat gezeigt, dass eine Testsuite die zwei schlimmsten Fehler nicht fand und ein Blick
aufs Bild sie fand. Diese Stufe hat gezeigt, was an die Stelle des Blicks tritt, wenn es kein
Bild gibt: **erzeugte Folgen, Prüfung nach jedem Schritt, und eine zweite Implementierung, die
widerspricht.** Vier der sieben Fehler brauchen genau eine Operation zur Reproduktion, zwei weitere zwei — sie
waren nicht schwer zu finden. Sie waren nur nicht gesucht worden, weil niemand von Hand einen
Test schreibt, der ein Element um (0,0) verschiebt oder einen Namen auf den leeren String setzt.
