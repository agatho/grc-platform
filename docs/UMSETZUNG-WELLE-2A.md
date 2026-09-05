# Welle 2a — BPMN-Divergenzen und Modellierungsschicht

**Plan:** `docs/UMSETZUNGSPLAN-OFFENE-PUNKTE.md` §4 · **Register:** `docs/OFFENE-PUNKTE-REGISTER.md`
**Stand vorher:** `b14f56a0` · **Branch:** `audit/full-2026-08-31` · **Datum:** 2026-09-02

---

## 1. Was dieser Strang war — und was er geworden ist

Beauftragt waren zwölf Punkte: sechs Divergenzklassen gegen `bpmn-js`
(OP-020 bis OP-025) und sechs offene Punkte der Modellierungsschicht (OP-039
bis OP-044). Die Berichte, aus denen sie stammen, beschreiben sie als
Feinarbeit — „kosmetisch im Bild", „5 px", „sichtbar und deshalb der
harmlosere Rest", „im Korpus nicht beobachtet".

Nach dem Nachmessen ist das Muster ein anderes, und es ist bei elf der zwölf
Punkte dasselbe:

**Der Bericht hat die Ursache an der Stelle gesucht, an der sich der Fehler
zeigte — und sie lag jedes Mal eine Schicht tiefer und war statisch.**

| Punkt      | Vermutete Ursache                                         | Gemessene Ursache                                                                                                     |
| ---------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **OP-020** | „Relayout beim Redo" — ein Zustandsproblem                | Eine Tabellenzeile: `["straight", "h:h"]` als Vorgabe für **jeden** Sequenzfluss. Kein Undo/Redo im kleinsten Fall.   |
| **OP-021** | „Restfälle nach der Docking-Korrektur"                    | Ein fehlender Baustein: importierte Wegpunkte tragen kein `original`, also rechnet jede Kante mit dem falschen Anker. |
| **OP-023** | „ein `bpmn:SequenceFlow` zu viel nach `connect` + `undo`" | Eine Regel, die eine Frage beantwortete, die ihr niemand stellt — und dabei die eigentliche Prüfung übersprang.       |
| **OP-024** | „Lane-Inhalte beim Poolwachstum, 5 px"                    | 20 px, und ein Knoten, der dabei **die Lane wechselt** — also die Verantwortlichkeit.                                 |
| **OP-025** | „Task bzw. EventBasedGateway in der Wurzel"               | Ein `IntermediateThrowEvent` in einem **eingeklappten** Subprozess, in einem anderen Dokument.                        |
| **OP-039** | „Risiko mittel, die Symmetrie ist ungetestet"             | Die Symmetrie war nicht nur ungetestet, sie fehlte: `redistributeLanes` teilte auch senkrechte Lanes nach Höhe.       |
| **OP-042** | „Wegpunkte werden nicht relativiert"                      | Kein Defekt. BPMN-DI ist absolut; „relativieren" wäre der Fehler.                                                     |
| **OP-043** | „ein XSD-Lauf wäre die saubere Ergänzung"                 | Ein XSD-Lauf über das **Modell** kann den genannten Fall gar nicht finden — der Wert ist da schon umgedeutet.         |
| **OP-044** | „flach statt `ioSpecification`"                           | Nicht die `ioSpecification` fehlt, sondern ein **zulässiges Ziel**: `targetRef` zeigte auf eine Aktivität.            |

Praktisch heißt das: **die teuerste Arbeit dieses Strangs war das Messen, nicht
das Reparieren.** Fünf der sechs Divergenzklassen ließen sich auf drei
Codestellen zurückführen, sobald die kleinste reproduzierende Folge gefunden
war; zwei davon sind je eine Zeile.

Und es heißt zweitens, dass ein Registereintrag hier eine Behauptung ist und
kein Befund. Neun der zwölf Einträge stimmten in der Sache nicht mehr oder
nicht genau — §18 führt sie einzeln auf.

**Zahlen in einem Satz:** `ours-wrong`-Divergenzen **77 → 20**, Tests
`packages/bpmn` **753 → 829 grün**, ein neuer Prüfer (Schemakonformität) und
ein neues Korpusdokument (senkrechter Pool), das schon beim Einzug einen
Absturz im Eigenschaftslauf aufgedeckt hat.

---

## 2. Der Prüfstand zuerst — sonst misst man gegen ein Gerücht

Der Shadow-Compare-Lauf war reproduzierbar, aber nicht **ablesbar**: das
Histogramm ging über `console.info` heraus, und vitest zeigt die Ausgabe eines
grünen Tests nicht an. Wer Zahlen belegen sollte, brauchte eine Wegwerfdatei —
und damit lief die Zahl im Protokoll und die Zahl im Prüfstand auseinander,
sobald jemand die Wegwerfdatei anders parametrierte.

`test/verify/shadow.test.ts` schreibt jetzt denselben Lauf, der grün oder rot
wird, auf Wunsch als Bericht:

```
SHADOW_SEED=13337 SHADOW_SEQUENCES=100 SHADOW_LENGTH=10 \
SHADOW_REPORT=/tmp/shadow npx vitest run test/verify/shadow.test.ts
```

Ohne die Variable ändert sich nichts. **Jede Zahl in diesem Protokoll stammt
aus diesem Aufruf**, nicht aus einem Bericht.

Erster Lauf, vor jeder Änderung — die Zahlen des Berichts `STUFE2-D`
reproduzieren sich exakt:

```
{"ours-wrong":77,"intentional":26,"reference-wrong":5}   unklassifiziert: 0
```

---

## 3. OP-020 — 34 Divergenzen `waypoints/…/count`

**Befund (Register).** „34 Divergenzen `waypoints/bpmn:SequenceFlow/count`
gegen bpmn-js (Verdacht: Relayout beim Redo)."

**Reproduktion.** 34 bestätigt. Die Verteilung über die Basisdokumente
(`synth-foreign-camunda-extensions` 13, `repo-prd-sales-with-gateway` 8,
`synth-collaboration-pools-lanes` 8, …) legte nahe, dass es kein
Einzelfallproblem ist. Der Verdacht des Berichts ließ sich in **einem Schritt**
widerlegen: Verkürzt man die Folge auf ihr erstes Präfix, bleibt die Divergenz
stehen.

```
run 0, synth-foreign-camunda-extensions
  0  reparent(flowNode#18 into container#18, at 500,100)
-- prefix 1: FF_1: 2 waypoints vs 4
                   FF_3: 2 waypoints vs 4
```

**Eine einzige Operation, kein Undo, kein Redo.** Die Klasse hatte keine
Zustandsursache.

**Was tatsächlich vorlag.** `BpmnLayouter.preferredLayouts()` lieferte für
jeden Sequenzfluss `["straight", "h:h"]`. In `ManhattanLayout` ist `"straight"`
kein Feinschliff, sondern ein **Vorrang**: `tryLayoutStraight` zieht
achsenüberlappende Formen auf eine gemeinsame Achse, und die Kante besteht
danach aus genau zwei Punkten. Eine von Hand gelegte Vier-Punkt-Führung ist
weg, sobald irgendetwas die Kante anfasst. Die Referenz führt `"straight"`
ausschließlich für Nachrichtenflüsse und für Kanten an aufgeklappten
Subprozessen (`BpmnLayouter.js`, `PREFERRED_LAYOUTS_HORIZONTAL`).

Der Vergleich der beiden Tabellen zeigte, dass ARCTOS' Fassung nicht nur eine
Zeile zu viel, sondern fünf zu wenig hatte: Gateways (`v:h` heraus, `h:v`
hinein), Schleifen auf dasselbe Element, `preserveDocking` an Subprozessen und
Nachrichtenflüssen, die feinere Seitenwahl an Boundary Events — und die
gesamte **senkrechte** Hälfte (siehe OP-039).

**Reparatur.** `src/modeling/BpmnLayouter.ts` trägt die vollständige
BPMN-Entscheidungstabelle. Die _Rechnung_ bleibt bei `diagram-js`
(`repairConnection`, `withoutRedundantPoints`, `getOrientation`, `getMid`) —
nachgebaut wäre daraus eine zweite Wahrheit über dieselbe Geometrie.
BPMN-spezifisch und damit unsere Sache ist nur, welche Andockseiten eine
Kantenart bevorzugt.

**Messung, in Stufen:**

| Stand                                       | `…/count` |
| ------------------------------------------- | --------: |
| vorher                                      |    **34** |
| nur `"straight"` aus der Vorgabe gestrichen |         9 |
| vollständige Tabelle                        |         2 |
| zusätzlich der Andockpunkt aus OP-021       |     **1** |

Der verbliebene Fall ist Folge des `DropOnFlowBehavior` der Referenz (OP-023),
nicht der Kantenführung.

**Wächter.** `test/modeling/layout.test.ts`, Abschnitt OP-020: vier Tests, die
die Tabelle direkt prüfen — gewöhnlicher Fluss `["h:h"]` und ausdrücklich
**nicht** `"straight"`, Gateway heraus/hinein, `preserveDocking` am
aufgeklappten Subprozess, Assoziation gerade.

**Gegenprobe.** `default: ["h:h"]` auf `["straight", "h:h"]` zurückgesetzt →
Test rot, und `…/count` steigt im Vergleichslauf wieder auf 9. Zurückgebaut →
grün.

---

## 4. OP-021 — 20 Divergenzen `waypoints/…/position`

**Befund (Register).** „20 Divergenzen `waypoints/bpmn:SequenceFlow/position`
(Restfälle nach der Docking-Korrektur)."

**Reproduktion.** 20 bestätigt (+2 `MessageFlow`). Nach der Tabellenkorrektur
aus §3 **stieg** die Klasse zunächst auf 25 — die Kanten wurden jetzt richtig
geführt und die verbleibende Abweichung damit erst sichtbar.

Zwei Muster ließen sich trennen:

- **(A) Wegpunkt 0 um eine halbe Formbreite daneben** (18 px an einem 36 px
  breiten Ereignis, 50 px an einer 100 px breiten Aktivität);
- **(B) Zwischenpunkt um 3 bis 5 px daneben**, und die Referenz stand dabei
  immer auf einem Vielfachen von 10.

**Was tatsächlich vorlag — (A).** Ein Wegpunkt trägt zwei Bedeutungen: den
gezeichneten Punkt auf der Kontur und, als `waypoint.original`, den Punkt, den
das Routing gemeint hat. Jede Neuberechnung (`repairConnection`,
`getDockingPoint`, `getMovedSourceAnchor`) arbeitet mit `original ?? point`.
Aus importierter DI kommt nur die gezeichnete Hälfte — `di:waypoint` kennt kein
`original`.

Gemessen mit einem Haken am Layouter beider Engines, `reparent(F_Task …)` auf
`synth-foreign-camunda-extensions`:

```
ARCTOS  in=[{x:188,y:120},{x:240,y:120}]
        out=[{x:188,y:138}, …]           ← untere **rechte Ecke** der Bounding-Box
bpmnjs  in=[{x:188,y:120,original:{x:170,y:120}}, …]
        out=[{x:170,y:138}, …]           ← Unterseite des Kreises
```

Ohne `original` nimmt `getDockingPoint` die x-Koordinate des abgeschnittenen
Punkts und setzt sie auf die Unterkante — das ist die Ecke der Bounding-Box
eines Kreises, also gar nicht auf der Form. Und der Effekt kumuliert: der Punkt
auf der Kontur wird zur Vorlage für den nächsten Punkt auf der Kontur.

Die Referenz hat dafür einen eigenen Baustein, `ImportDockingFix`, der nach dem
Import je Kante `original` aus dem Schnitt des ersten Segments mit dem
**Mittelkreuz** der Form rekonstruiert. ARCTOS hatte ihn nicht — er ist in
keinem Bericht erwähnt, weil ihn niemand gesucht hat.

**Reparatur (A).** `src/modeling/docking.ts` — dieselbe Rechnung, mit den
Rändern, die die Referenz offenlässt: schneidet das Segment beide Mittellinien,
gewinnt die nähere; schneidet es keine, bleibt der Punkt ohne `original`.
`importer.ts` ruft sie beim Anlegen jeder Kante.

**Was tatsächlich vorlag — (B).** Kein Modellunterschied. `bpmn-js`' Modeler
bringt `GridSnappingLayoutConnectionBehavior` mit, das nach jedem
`connection.create` und `connection.layout` die **mittleren** Segmente einer
Route auf ein 10-px-Raster zieht (`snapMiddleSegments`). Belegt am Layouter
selbst: für dieselbe Verbindung liefern beide Engines byteweise dieselbe Route
(Knick bei x=345), und erst danach steht in der Referenz 350.

Rasterfang ist eine **Bedienhilfe** und gehört in den Editor, nicht ins Modell:
ein Dokument, das ein kopfloser Import-/Export-Lauf schreibt, darf eine von
Hand gelegte Kante nicht um fünf Pixel verschieben. Die Klasse ist deshalb
umgestuft — aber nicht pauschal. `isGridSnapDifference()` verlangt **drei**
Bedingungen zugleich: ein innerer Wegpunkt, die Referenz exakt auf dem Raster
und wir nicht, und ein Abstand von höchstens einer halben Rasterweite. Eine
echte Routingdifferenz erfüllt das nicht und behält die Signatur ohne Zusatz —
ein _neuer_ Wegpunktfehler lässt die Suite weiterhin fehlschlagen.

**Messung.**

| Stand                         | `SequenceFlow/position` | `MessageFlow/position` |
| ----------------------------- | ----------------------: | ---------------------: |
| vorher                        |                  **20** |                      2 |
| nach der Tabelle (§3)         |                      25 |                      2 |
| nach `fixImportDockings`      |                       9 |                      2 |
| nach der Rasterumstufung      |                   **1** |                  **1** |
| davon umgestuft `…/grid-snap` |                       8 |                      1 |

**Wächter.** `test/modeling/layout.test.ts`, Abschnitt OP-021: `original` auf
beiden Enden mit den gemessenen Zahlen (188/120 gezeichnet, 170/120 logisch);
der Ausgang auf der Kantenmitte statt in der Ecke nach einer echten Bewegung;
ein vorhandenes `original` wird nicht überschrieben; parallele Geraden liefern
keinen erfundenen Schnittpunkt.

**Gegenprobe.** Aufruf von `fixImportDockings` im Importer auskommentiert →
zwei Tests rot, `…/position` steigt von 1 auf 25. Zurückgebaut → grün.

---

## 5. OP-022 — 9 Divergenzen `element-set` / `element-type`

**Befund (Register).** „9 Divergenzen `element-set` / `element-type` (teils
Folgeschaden der positionellen `gen-`-Ausrichtung des Prüfstands)",
Kategorie **Testlücke**.

**Reproduktion: 11, nicht 9.** Die Klasse verteilt sich auf sieben Signaturen
(`element-type/BoundaryEvent/vs/IntermediateCatchEvent` 3,
`element-set/gen-/only-ours` 2, `…/only-reference` 2 und vier weitere je 1).

**Was tatsächlich vorliegt.** Eine einzige Verhaltensdifferenz, plus deren
Nachwirkung:

`bpmn-js` hat ein `DetachEventBehavior`: ein Randereignis, das seinen Wirt
verlässt, wird durch ein `bpmn:IntermediateCatchEvent` **ersetzt**. ARCTOS
verweigert das Ablösen stattdessen (`BoundaryEventBehavior.keepAttachment`),
mit einer im Code ausgeschriebenen Begründung: ein `bpmn:BoundaryEvent` ohne
`attachedToRef` ist ungültiges BPMN, und `moddle` verwirft das Attribut beim
nächsten Speichern still. Beide Antworten erzeugen ein gültiges Dokument. Ab
dieser Stelle laufen die erzeugten Kennungen auseinander, und die übrigen
`element-type`-Meldungen sind diese Drift, keine eigenen Defekte.

**Der Vorschlag des Berichts wurde gebaut, gemessen und wieder entfernt.**
`STUFE2-D` §2.8 nennt als nächste Verbesserung eine „inhaltsbasierte
Ausrichtung (Typ + Container + Nachbarn)". Sie wurde gebaut — erzeugte Elemente
nach Typ und Container gruppiert und innerhalb der Gruppe nummeriert — und
gegen denselben Lauf gemessen:

| Ausrichtung                                      | `ours-wrong` gesamt |
| ------------------------------------------------ | ------------------: |
| positionell (Bestand)                            |              **20** |
| Typ + Container, Dokumentordnung in der Gruppe   |                  52 |
| zusätzlich mit dem Namen im Gruppenschlüssel     |                  70 |
| Typ + Container, Ordnung nach Name und Geometrie |                  52 |

**Warum sie schlechter ist.** Die Gruppierung nach Typ entkoppelt die
Nummerierung von Formen und Kanten — und genau das darf sie nicht.
`CandidateOrder` (`src/verify/driver.ts`) sorgt dafür, dass beide Engines
dieselben Elemente in derselben Reihenfolge **erzeugen**, und die
Dokumentreihenfolge des Exports folgt der Erzeugungsreihenfolge. Die globale
Position ist damit keine Verlegenheitslösung, sondern die Größe, die zwischen
den beiden Engines tatsächlich übereinstimmt. Fehlt einer Seite eine Form,
verschiebt sich in der Gruppierung nur die Formgruppe, und die Kanten paaren
sich anschließend gegen fremde Endpunkte: `element-set/…/sourceRef` stieg von
1 auf 13.

Der Code ist zurückgebaut; die Messtabelle und die Begründung stehen als
Kommentar über `normalizeGeneratedIds` in `src/verify/snapshot.ts`, damit
niemand denselben Weg ein zweites Mal geht.

**Ergebnis: 11 → 11, unverändert.** Das ist das ehrliche Ergebnis dieses
Punktes. Was sich geändert hat, ist die Diagnose: die Klasse ist kein
Prüfstandsfehler, wie das Register annimmt, sondern die Nachwirkung **einer**
bewussten Verhaltensdifferenz. Die Regelbegründung in `DIVERGENCE_RULES` sagt
das jetzt mit Zahlen. Der Punkt geht als Entscheidungsfrage weiter (§12), nicht
als Prüfstandsarbeit.

---

## 6. OP-023 — 4 Divergenzen `candidate-set/*/more-ours`

**Befund (Register).** „4 Divergenzen `candidate-set/*/more-ours` — ein
`bpmn:SequenceFlow` zu viel nach `connect` + `undo`."

**Reproduktion.** 4 bestätigt (2 × `flowNode`, 2 × `removable`). Die Meldungen
nennen die Kennungen, die nur eine Seite kennt — und in **keinem** der vier
Fälle ist ein Undo beteiligt.

**Was tatsächlich vorlag, Teil 1 (2 von 4).** Beide `flowNode`-Fälle nennen
dasselbe Element: `IntermediateThrowEvent_1`. Es entstand aus

```
createShape(bpmn:IntermediateThrowEvent, in Sub_Pruefung)   ARCTOS: applied, bpmn-js: rejected
```

Die Regel `shape.create` in `BpmnRules.ts` begann mit einer Abkürzung:

```ts
if (canAttach([c.shape], target) === "attach") return true;
```

Sie war doppelt falsch. Erstens fragt `diagram-js` das Anheften ohnehin zuerst
(`features/create/Create.js` prüft `shape.attach` und erst danach
`shape.create`) — die Abkürzung beantwortete eine Frage, die an dieser Regel
nie gestellt wird. Zweitens erlaubte sie das **Ablegen**, wo nur das Anheften
zulässig wäre: Ein Zwischenereignis ist ein Anheftkandidat, jede Aktivität ein
möglicher Wirt, also lieferte `shape.create` `true` — und der Aufrufer rief
danach `modeling.createShape(shape, position, parent)` **ohne** `isAttach`. Das
Ereignis landete als gewöhnliches Kind _im_ Subprozess. Da `Sub_Pruefung`
eingeklappt ist, war es auf keiner Ebene sichtbar; `canDrop`s ausdrückliches
Verbot „ein eingeklappter Subprozess nimmt nichts auf" lief nie.

**Reparatur.** Die Abkürzung ist entfernt; `shape.create` beantwortet
`canDrop`. Das schließt zugleich OP-025 (§8).

**Was tatsächlich vorliegt, Teil 2 (2 von 4, offen).** Die beiden
`removable`-Fälle sind das `DropOnFlowBehavior` der Referenz: Wer einen
Flussknoten auf einer Sequenzkante ablegt oder erzeugt, bekommt bei `bpmn-js`
die Kante geteilt und den Knoten eingereiht. ARCTOS kennt das nicht, behält die
Kante und lässt den Knoten unverbunden darauf liegen. Sichtbar auch als
`element-set/bpmn:SequenceFlow/sourceRef` („FF_3: `F_Service` gegen `F_Start`"
nach einem einzigen `reparent`).

Das ist keine Datenverfälschung, sondern eine fehlende Bedienhilfe. Sie ist
nicht Teil dieses Auftrags und geht mit Begründung an Welle 2b (§12), wo mit
OP-019 der verwandte Punkt schon liegt — beides ist „die Engine reagiert
darauf, wo man etwas fallen lässt".

**Messung:** 4 → **2**.

---

## 7. OP-024 — 2 Divergenzen `bounds/bpmn:EndEvent` und `bpmn:SubProcess`

**Befund (Register).** „2 Divergenzen `bounds/bpmn:EndEvent` und
`bpmn:SubProcess` (Lane-Inhalte beim Poolwachstum, 5 px)." Der Bericht
`STUFE2-D` §2.6 stuft es ein: „Keine Seite verliert Daten, beide Dokumente sind
gültig."

**Reproduktion.** Beide bestätigt — aber der `EndEvent`-Fall ist keine 5 px,
sondern **20** (y=255 gegen y=275). Das war Anlass genug, ihn nachzustellen.
`synth-collaboration-pools-lanes`, `Participant_Bank` von 260 auf 390 px:

```
vorher : Lane_Sachbearbeitung y= 80 h=130  → Start_Bank, Task_Bank_Pruefen
         Lane_Genehmigung     y=210 h=130  → Task_Bank_Entscheiden, End_Bank
nachher: Lane_Sachbearbeitung y= 80 h=195  → Start_Bank, Task_Bank_Pruefen,
                                             ⚑ Task_Bank_Entscheiden
         Lane_Genehmigung     y=275 h=195  → End_Bank
         End_Bank y=252 — oberhalb der Oberkante seiner eigenen Lane (275)
```

**Was tatsächlich vorlag.** Nicht Kosmetik. Die Lane-Kante wandert unter dem
Knoten weg, `BpmnUpdater.syncLaneMembership` rechnet die Zugehörigkeit nach
jeder Größenänderung aus der Geometrie neu — und `Task_Bank_Entscheiden` gehört
danach der Sachbearbeitung. In diesem Produkt sagt die Lane, **wer** den
Schritt tut: `flowNodeRef` trägt die Zuordnung, an der RACI (§3.4 des Plans)
und die Verteidigungslinie hängen. Eine Größenänderung an einer ganz anderen
Stelle des Diagramms ändert damit still die Verantwortlichkeit. Das ist
dieselbe Fehlerform, die `docs/UMSETZUNG-WELLE-1B.md` als den gefährlichsten
Typ dieses Produkts beschreibt: eine Aussage, die aussieht wie ein Ergebnis.

**Reparatur.** `redistributeLanes` verschiebt den Inhalt einer **Blatt**-Lane um
dasselbe Stück, um das ihre führende Kante gewandert ist — Lanes mit
Kind-Lanes überlassen das den Kindern, sonst wanderte ein Knoten zweimal.

Eine Einschränkung, die den Unterschied macht: verschoben wird **nur, wer sonst
herausfiele** (Mittelpunkt außerhalb der neuen Lane). Die naive Fassung
(„alles mitziehen") ließ einen Bestandstest fehlschlagen, und zwar zu Recht:
`shape.resize` auf `Sub_A` in der Prüffixtur `COLLABORATION` lässt den Pool
wachsen, und die Umverteilung hätte den gerade vom Benutzer auf y=230 gesetzten
Subprozess nach y=275 geschoben — die Größenänderung hätte ihre eigene Ursache
verschoben.

**Was offen bleibt und warum.** Die Divergenz selbst besteht fort (255 gegen
275): die Referenz zieht über den `SpaceTool` **den ganzen** Lane-Inhalt mit,
ARCTOS das Minimum. Beide Dokumente sind gültig, keines verliert Daten; das
Urteil bleibt `ours-wrong` nach Beweislast, weil das Verhalten der Referenz das
ist, was Benutzer des alten Editors kennen. Der **semantische** Defekt ist weg.

`bounds/bpmn:SubProcess` (515 gegen 520) bleibt unverändert und bleibt die
Position der neu erzeugten Form. Auffällig ist die Korrelation zur
Rasterklasse aus §4 — 520 liegt auf dem Raster, 515 nicht —, aber die Rechnung
läuft durch die Randabstände des Auto-Resize und wurde nicht zu Ende verfolgt.
Deshalb behält die Klasse ihr Urteil, statt auf einen Verdacht hin umgestuft zu
werden.

**Wächter.** `test/modeling/geometry.test.ts`, Abschnitt OP-024: die
Lane-Zuordnung bleibt über das Poolwachstum erhalten, der Knoten liegt danach
auch geometrisch in seiner Lane, und das Undo nimmt die Verschiebung zurück.

**Gegenprobe.** `moveLaneContents` aus `redistributeLanes` entfernt →
`Task_Bank_Entscheiden` steht wieder in der falschen Lane, Test rot.

---

## 8. OP-025 — 2 Divergenzen `outcome/createShape`

**Befund (Register).** „2 Divergenzen `outcome/createShape` (Task bzw.
EventBasedGateway in der Wurzel von `synth-nested-subprocesses`)", blockiert
durch OP-018 (Drill-down).

**Reproduktion.** Zahl bestätigt, Inhalt nicht. Beide Fälle lauten:

```
createShape(bpmn:IntermediateThrowEvent, in Sub_Pruefung):
  ARCTOS applied, bpmn-js rejected
```

Anderes Dokument (`synth-boundary-events`), anderer Elementtyp, anderer
Container — und **nicht** von OP-018 abhängig. `Sub_Pruefung` ist ein
eingeklappter Subprozess.

**Was tatsächlich vorlag.** Dieselbe Regelabkürzung wie in §6.

**Reparatur.** Siehe §6. **Messung: 2 → 0.**

**Wächter.** Der Vergleichslauf selbst: die Signatur
`outcome/createShape/applied-vs-rejected` steht weiterhin mit Urteil
`ours-wrong` in `DIVERGENCE_RULES`; tritt sie wieder auf, ist sie sofort
sichtbar. Dazu deckt der Bestandstest `test/modeling/rules.test.ts` den
`canDrop`-Zweig ab, der jetzt wieder erreicht wird.

---

## 9. OP-039 — vertikale Pools nur teilweise geprüft

**Befund (Register).** „Vertikale Pools nur teilweise geprüft — der Korpus
enthält keinen senkrechten Pool." `STUFE2-A1` §7.4: „Risiko: mittel, die
Symmetrie ist ungetestet."

**Reproduktion.** Bestätigt: `grep -l 'isHorizontal="false"' test/corpus/*.bpmn`
liefert nichts. Von 52 Korpusdateien war keine einzige senkrecht.

**Reparatur, Teil 1 — das fehlende Prüfmaterial.**
`test/corpus/synth-vertical-pool-lanes.bpmn`: bewusst als Spiegelbild von
`synth-collaboration-pools-lanes` gebaut — derselbe Prozess, dieselben
Elementarten, um 90 Grad gedreht. Pool 500 × 620, zwei Lanes als Spalten,
Gateway, Boundary Event an der **rechten** Kante, Nachrichtenfluss quer über
die Poolgrenze. Wer die Achsen in einer Rechnung vertauscht, bekommt hier eine
Lane, die aus dem Pool ragt, oder eine Kante quer durch ihn hindurch.

**Reparatur, Teil 2 — die fehlende Hälfte der Kantenführung.** Der Layouter
kannte nur waagerechte Pools. `VERTICAL_LAYOUTS` ist die gespiegelte Tabelle:
`v:v` als Vorgabe, `h:v`/`v:h` an Gateways, Schleifen andersherum,
Nachrichtenflüsse waagerecht. `isDirectionHorizontal()` liest die Richtung am
**Pool**, nicht am Element — eine Aktivität in einem senkrechten Pool wird
senkrecht verbunden.

**Reparatur, Teil 3 — der Fund, den das Korpusdokument sofort gemacht hat.**
Beim ersten vollen Lauf mit der neuen Datei brach der Eigenschaftslauf ab:

```
Seed 20260901, sequence 50, base "synth-vertical-pool-lanes"
  createShape(bpmn:SubProcess, in Participant_Amt) threw:
  width and height cannot be less than 10px
```

`redistributeLanes` teilte **immer** die Höhe und übernahm **immer** die
Breite. In einem senkrechten Pool sind die Lanes Spalten: sie sind so hoch wie
der Pool und teilen seine Breite. Die alte Rechnung gab jeder Spalte die volle
Pool-Höhe _und_ eine Höhe aus dem Höhenverhältnis — die letzte Spalte bekam als
Rest eine negative Höhe, und `diagram-js` warf. Die Zeile war bis dahin nie
ausgeführt worden, weil es kein Dokument gab, das sie erreicht hätte.

`redistributeLanes` rechnet jetzt entlang der Achse, die die Lanes vorgeben.

**Wächter.** `test/modeling/layout.test.ts`, Abschnitt OP-039: Leserichtung am
Pool statt am Element, reiner Prozess bleibt waagerecht, die Tabelle tauscht
die Achsen (`v:v`, `v:h`, `h:v`), Nachrichtenfluss waagerecht, Boundary Event
an der Seitenkante läuft waagerecht heraus, und eine echte Bearbeitung im
senkrechten Pool mit Undo und allen Invarianten. Dazu läuft der
Eigenschaftslauf jetzt über das Dokument.

**Gegenprobe.** `VERTICAL_LAYOUTS` durch `HORIZONTAL_LAYOUTS` ersetzt → drei
Tests rot. Zurückgebaut → grün.

---

## 10. OP-040 — `moveShape` bewegt Beschriftungen und Anhefter nicht mit

**Befund (Register).** „`moveShape` bewegt Beschriftungen und Anhefter nicht
mit — Aufruferdisziplin nötig", Kategorie Codequalität.

**Reproduktion.** Bestätigt, mit Zahlen. `synth-all-event-types`,
`moveShape(E_Start_Message, +120/+40)`: die Beschriftung blieb auf x=125
stehen, während das Ereignis nach x=245 wanderte. `synth-boundary-events`,
`moveShape(Task_Freigabe, +60/−30)`: `Boundary_Timer` blieb bei y=272, sein
Wirt ging nach y=332.

**Was tatsächlich vorlag.** Eine Eigenschaft von `diagram-js`: `label-support`
und `attach-support` hängen am zusammengesetzten `elements.move`, nicht am
einzelnen `shape.move`. `bpmn-js` hat sie ebenso. Der Bericht zieht daraus die
Konsequenz „Bedienpfade müssen `moveElements` benutzen".

**Eine Regel, an die sich jeder Aufrufer erinnern muss, ist keine Regel** — und
die Fehlerform ist die unangenehme: Ein Etikett, das an der alten Stelle liegen
bleibt, sieht aus wie das Etikett eines anderen Elements. Keine Invariante
fängt es, weil das Ergebnis wohlgeformtes BPMN ist.

**Reparatur.** `BpmnModeling.moveShape` entscheidet selbst: Hat die Form
Beschriftungen oder Anhefter, läuft die Bewegung über `moveElements` und nimmt
sie mit; hat sie keine — der häufigere Fall —, bleibt es beim einfachen
`shape.move`, damit ein Undo genau einen Schritt zurückgeht.

Die Abbruchbedingung ist die interessante Stelle: `MoveHelper.moveClosure`, der
Innenteil von `elements.move`, ruft für **jede** Form dieses `moveShape`, mit
`{ recurse: false, layout: false }`. Ohne die Abfrage darauf kreisen die beiden
Ebenen gegeneinander — gemessen als `RangeError: Maximum call stack size
exceeded`. `recurse === false` heißt „ein zusammengesetzter Zug läuft bereits";
dort ist `shape.move` genau richtig.

**Wächter.** `test/modeling/geometry.test.ts`, Abschnitt OP-040: Beschriftung
wandert mit, Anhefter wandert mit, und — als Gegengewicht — eine Form ohne
Anhang erzeugt weiterhin **ein** Kommando, das ein einzelnes Undo zurücknimmt.

**Gegenprobe.** Die Bedingung auf `false` gesetzt → zwei Tests rot.

---

## 11. OP-041 — Lane-Geometrie: Kind-Lanes wachsen nicht mit

**Befund (Register).** „Lane-Geometrie: Kind-Lanes wachsen nicht mit, wenn eine
Lane mit Kindern vergrößert wird."

**Reproduktion.** Bestätigt. Prüffixtur `NESTED_LANES`, `Lane_Aussen` von 200
auf 300 px: `Lane_Innen1` und `Lane_Innen2` blieben bei 100 + 100. 100 px der
Eltern-Lane gehörten danach zu keiner Kind-Lane.

**Was tatsächlich vorlag.** `redistributeLanes` konnte die Rekursion in
Kind-Lanes schon; sie wurde nur von genau einer Stelle gerufen — dem
Auto-Resize eines **Pools**. Eine Größenänderung einer Lane von Hand hatte
keinen Aufrufer.

Der Bericht nennt den Punkt „sichtbar und deshalb der harmlosere Rest". Er ist
es nicht: der Streifen ohne Kind-Lane ist genau die Fläche, in der ein Knoten
seine `flowNodeRef` verliert — dieselbe Mechanik wie in §7.

**Reparatur.** `src/modeling/behaviors/LaneResizeBehavior.ts` hängt an
`shape.resize` jeder Lane und jedes Pools und verteilt die Kind-Lanes neu. Als
`postExecuted`-Interceptor mit eigenen `shape.resize`-Kommandos — damit ist die
Zusatzregel automatisch Teil desselben Undo-Schritts, ohne handgeschriebenen
Rückbau.

Ein Hint (`laneRedistribution`) trennt die beiden Besitzer: `AutoResizeBehavior`
markiert die Größenänderung, die es selbst gleich verteilt. Ohne ihn verteilte
das neue Verhalten dieselben Lanes ein zweites Mal, beim zweiten Mal gegen
bereits verteilte Bounds — gemessen führte das auf
`synth-collaboration-pools-lanes` zu negativen Lane-Höhen und derselben
Ausnahme wie in §9.

**Wächter.** `test/modeling/geometry.test.ts`, Abschnitt OP-041: die neue Höhe
verteilt sich lückenlos und im bisherigen Verhältnis (150 + 150 = 300, Kanten
exakt aneinander und bündig mit der Eltern-Lane); das Undo zieht zurück; eine
Blatt-Lane bleibt unangetastet.

**Gegenprobe.** `LaneResizeBehavior` aus `modeling/index.ts` ausgetragen → Test
rot. Zurückgebaut → grün.

---

## 12. OP-042 — `connection.move` über Containergrenzen

**Befund (Register).** „`connection.move` über Containergrenzen relativiert die
Wegpunkte nicht", Kategorie **Produktdefekt**.

**Das trifft nicht zu — und der Bericht sagt es selbst.** `STUFE2-A1` §7.10:
„BPMN-DI ist absolut, insofern korrekt — aber ein Werkzeug, das
container-relative Koordinaten erwartet, liest das Ergebnis anders. Im Korpus
nicht beobachtet."

Nachgeprüft: Ein solches Werkzeug wäre selbst im Unrecht. `dc:Point` einer
`bpmndi:BPMNEdge` steht im Koordinatensystem der `BPMNPlane`, und eine
`BPMNPlane` gibt es je Diagrammebene, nicht je Subprozess-Rechteck. Die
Wegpunkte beim Containerwechsel zu „relativieren" hieße, sie um den Ursprung
des neuen Containers zu verschieben — die Kante läge danach an einer anderen
Stelle im Bild als vorher, ohne dass jemand sie bewegt hätte. Das wäre der
Defekt.

**Was fehlte, ist nicht die Umrechnung, sondern der Wächter.** Dass ein
Containerwechsel die Kante semantisch mitnimmt und die Geometrie dabei
konsistent bleibt, war nirgends festgehalten. `test/modeling/geometry.test.ts`,
Abschnitt OP-042, hält es jetzt fest: `Sub_Start`, `Sub_End` und `Sub_Flow` aus
`Sub_A` heraus in `Lane_A1` bewegt, und dann drei Aussagen —

1. der semantische Container ist nachgeführt (`Sub_A` → `Process_A`),
2. die Wegpunkte sind um dasselbe Delta gewandert wie die Formen, absolut; eine
   Relativierung ergäbe hier einen Sprung um den Ursprung von `Sub_A` (290/230),
3. und sie docken weiterhin an ihren Endpunkten an.

**Kein Produktcode geändert.** Der Registereintrag gehört korrigiert (§13).

---

## 13. OP-043 — kein XSD-Schema-Validator

**Befund (Register).** „Kein XSD-Schema-Validator — Invarianten prüfen
Referenzintegrität, nicht Schemakonformität." `STUFE2-A1` §7.11 nennt das
Beispiel `cancelActivity="ja"` und schlägt „einen XSD-Lauf gegen `BPMN20.xsd`"
vor.

**Reproduktion — und der Grund, warum der Vorschlag so nicht funktioniert.**

```
<bpmn:boundaryEvent id="B" attachedToRef="T" cancelActivity="ja"/>
  moddle.fromXML  → { cancelActivity: false },  warnings: []
  moddle.toXML    → cancelActivity="false"
```

`bpmn-moddle` meldet **nichts** und deutet den Wert um. `false` heißt auf einem
Randereignis „nicht unterbrechend"; die Schemavorgabe ist `true`. Aus einem
Tippfehler wird eine stille Umdeutung des Prozesses: Ein Randereignis, das den
Vorgang abbrechen sollte, läuft danach nebenher weiter — und die Datei, die das
behauptet, hat ARCTOS geschrieben. Dasselbe gilt für `isInterrupting`,
`isExecutable`, `isCollection`, `parallelMultiple`.

**Daraus folgt die Bauform:** Eine Schemaprüfung, die auf dem geparsten Modell
arbeitet, kann diesen Fehler grundsätzlich nicht finden. Im Moment, in dem ein
Modell existiert, ist `"ja"` zu `false` geworden und von einem echten `false`
nicht mehr unterscheidbar. **Geprüft wird der Rohtext.**

**Reparatur.** `src/verify/schema.ts`. Statt einen XSD-Prozessor als
Abhängigkeit aufzunehmen, benutzt der Prüfer das Schema, das ohnehin da ist:
das **Metamodell von `bpmn-moddle`** ist die maschinenlesbare Form derselben
Deklarationen. Vier Befundarten:

1. lexikalische Attributtypen (`Boolean`, `Integer`, `Real`) gegen die
   Schreibweisen aus XML Schema Part 2;
2. unbekannte Attribute an bekannten Typen — nur im BPMN-, DI-, DC- und
   BPMNDI-Namensraum; fremde Vokabulare (Camunda, Signavio, `arctos:`) bleiben
   ausdrücklich unangetastet, weil ihr Bewahren eine Zusage dieser Schicht ist;
3. unbekannte Elemente in denselben Namensräumen;
4. leere Kennungen.

Eine Falle beim Bauen, die die Messung sofort zeigte: Ein Elementname ist in
BPMN nicht nur ein Typ, sondern auch eine **Eigenschaft** seines Elternelements
— `<bpmn:incoming>` gehört zu `bpmn:FlowNode`, `<di:waypoint>` zu
`bpmndi:BPMNEdge`. Die erste Fassung ohne Elternstapel meldete allein in
`synth-without-di-section` 10 Befunde, sämtlich falsch.

**Was der Prüfer ausdrücklich nicht sagt:** dass eine Datei ohne Befund
schemakonform _ist_. Inhaltsmodelle, Kardinalitäten und die Regeln, die BPMN
2.0 im Fließtext statt im Schema formuliert, prüft er nicht. Das steht im
Dateikopf, damit niemand die Aussage überdehnt.

**Wächter.** `test/verify/schema.test.ts`, 8 Tests. Der erste ist der
wichtigste: er prüft dasselbe Dokument einmal durch den Prüfer und einmal durch
`moddle.fromXML` und pinnt beide Ergebnisse — der Befund **und** die stille
Umdeutung. Dazu die vier gültigen `xsd:boolean`-Schreibweisen und vier
ungültige, fremde Namensräume, DI-Attribute, Zeilennummern über Kommentare
hinweg, und ein Lauf über den **gesamten Korpus** (53 Dateien, kein Befund) —
sonst prüften alle Werkzeuge dieses Pakets über Material, das das eigene Schema
verletzt.

---

## 14. OP-044 — Datenassoziationen flach modelliert

**Befund (Register).** „Datenassoziationen flach modelliert (`sourceRef` als
einelementige Liste statt `ioSpecification`)", Kategorie Codequalität,
Umfang M.

**Reproduktion und Korrektur der Diagnose.** Der Bericht beschreibt den Punkt
als fehlende `ioSpecification`. Gemessen ist die Sache enger — und ernster.
`BpmnUpdater.wireEndpoints` setzte für **beide** Richtungen:

```ts
sourceRef = [sourceBo];
targetRef = targetBo;
```

Bei einer eingehenden Assoziation ist `targetBo` die **Aktivität**, bei einer
ausgehenden steht sie in `sourceRef`. `bpmn:DataAssociation` typisiert beide
Enden als `bpmn:ItemAwareElement` — Datenobjekt, Datenspeicher, Property,
DataInput/DataOutput. Eine `bpmn:Task` ist keines davon. Das Ergebnis ist
wohlgeformtes XML und **ungültiges BPMN**: ein schemaprüfender Leser weist die
Datei zurück, ein nicht prüfender löst die Referenz auf einen Typ auf, den er
dort nicht erwartet. Genau der Fall, für den der Registereintrag „Austausch
mit Camunda-Werkzeugen" als Wert nennt.

Es fehlt also nicht die `ioSpecification`, sondern ein zulässiges Ziel. Das
Mittel dafür ist Stand der Technik und steht in der Referenz ausdrücklich als
„as demanded by the BPMN 2.0 XSD schema" (`DataInputAssociationBehavior`): eine
`bpmn:Property` mit dem vereinbarten Namen `__targetRef_placeholder` an der
Aktivität. Fremde Werkzeuge erkennen sie an diesem Namen als Platzhalter.

**Reparatur.** `BpmnUpdater.wireEndpoints` trennt die beiden Richtungen:
eingehend zeigt `targetRef` auf die Platzhalter-Property (bei Bedarf angelegt,
eine je Aktivität, nicht eine je Kante), ausgehend bleibt `sourceRef` leer —
`sourceRef` ist 0..\*, und die Aktivität steht ohnehin als `$parent` da.

**Wächter.** `test/modeling/data-associations.test.ts`, 5 Tests. Der
entscheidende prüft nicht die Struktur im Speicher, sondern die **Datei**: der
Export enthält `__targetRef_placeholder`, enthält **nicht** `targetRef="Task_D"`
— und besteht den Schemaprüfer aus §13. Zwei Reparaturen, die sich gegenseitig
belegen.

**Gegenprobe.** Beide Zweige auf den alten Stand zurückgesetzt → alle 5 Tests
rot.

---

## 15. Abnahme

| Prüfung                                                                               | Ergebnis                                                   |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `npx tsc --noEmit -p packages/bpmn/tsconfig.json`                                     | ✅ fehlerfrei                                              |
| `cd packages/bpmn && npx vitest run`                                                  | ✅ **829 Tests, 53 Dateien** grün (vorher 753 / 46, 1 rot) |
| davon aus dieser Welle                                                                | 4 neue Dateien, **36 Tests**, +1 korpusgetriebener Fall    |
| Shadow-Compare, 100 Folgen à 10, Seed 13337 — `ours-wrong`                            | **77 → 20**                                                |
| … `intentional` / `reference-wrong` / unklassifiziert                                 | 26 → 35 / 5 → 5 / **0 → 0**                                |
| Shadow-Compare, Import über den Korpus                                                | ✅ 20 Abweichungen, alle `intentional` — unverändert exakt |
| Eigenschaftslauf, 200 Folgen (Teil der Suite)                                         | ✅ grün, inkl. des neuen senkrechten Pools                 |
| `npx eslint packages/bpmn/src/{modeling,verify} packages/bpmn/test/{modeling,verify}` | ✅ 0 Fehler, 0 Warnungen                                   |
| `npx prettier --check` über die geänderten Verzeichnisse                              | ✅ grün                                                    |

### Divergenzklassen einzeln

| Signatur                                      | vorher | nachher | Punkt     |
| --------------------------------------------- | -----: | ------: | --------- |
| `waypoints/bpmn:SequenceFlow/count`           | **34** |   **1** | OP-020    |
| `waypoints/bpmn:SequenceFlow/position`        | **20** |   **1** | OP-021    |
| `waypoints/bpmn:MessageFlow/position`         |      2 |       1 | OP-021    |
| — davon umgestuft `…/position/grid-snap`      |      — |   9 int | OP-021    |
| `element-set` + `element-type` (7 Signaturen) | **11** |  **11** | OP-022    |
| `candidate-set/*/more-ours`                   |  **4** |   **2** | OP-023    |
| `bounds/bpmn:EndEvent`                        |      1 |       1 | OP-024    |
| `bounds/bpmn:SubProcess`                      |      1 |       1 | OP-024    |
| `outcome/createShape/applied-vs-rejected`     |  **2** |   **0** | OP-025    |
| `outcome/reparent/applied-vs-rejected`        |      1 |       1 | begründet |
| `element-name/bpmn:SequenceFlow/name`         |      1 |       1 | gering    |
| **Summe `ours-wrong`**                        | **77** |  **20** |           |

### Geänderte und neue Dateien

**Neu**

`packages/bpmn/src/modeling/docking.ts` ·
`packages/bpmn/src/modeling/behaviors/LaneResizeBehavior.ts` ·
`packages/bpmn/src/verify/schema.ts` ·
`packages/bpmn/test/corpus/synth-vertical-pool-lanes.bpmn` ·
`packages/bpmn/test/modeling/layout.test.ts` ·
`packages/bpmn/test/modeling/geometry.test.ts` ·
`packages/bpmn/test/modeling/data-associations.test.ts` ·
`packages/bpmn/test/verify/schema.test.ts`

**Geändert**

| Datei                                          | Was                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| `src/modeling/BpmnLayouter.ts`                 | vollständige Entscheidungstabelle, senkrechte Hälfte (OP-020/039) |
| `src/modeling/importer.ts`                     | Aufruf von `fixImportDockings` (OP-021)                           |
| `src/modeling/BpmnRules.ts`                    | `shape.create` ohne die Anheft-Abkürzung (OP-023/025)             |
| `src/modeling/Modeling.ts`                     | `moveShape` nimmt Beschriftung und Anhefter mit (OP-040)          |
| `src/modeling/behaviors/AutoResizeBehavior.ts` | achsengerechte Umverteilung, Lane-Inhalte (OP-024/039/041)        |
| `src/modeling/BpmnUpdater.ts`                  | Datenassoziationen auf ItemAwareElements (OP-044)                 |
| `src/modeling/index.ts`                        | `LaneResizeBehavior` registriert                                  |
| `src/verify/shadow.ts`                         | Rasterklasse, sechs Regeln mit gemessener Begründung neu gefasst  |
| `src/verify/snapshot.ts`                       | Messtabelle zur verworfenen Inhaltsausrichtung (OP-022)           |
| `src/verify/index.ts`                          | Schemaprüfer ausgeliefert                                         |
| `test/verify/shadow.test.ts`                   | `SHADOW_REPORT` — der Lauf schreibt seinen eigenen Bericht        |
| `test/modeling/labels.test.ts`                 | ein Test geschärft (`v:h` → `b:h`), begründet im Kommentar        |
| `test/corpus/INDEX.md`                         | Nachtrag zum senkrechten Pool                                     |

Nicht angefasst und deshalb nicht in dieser Abnahme: `src/draw/**`,
`src/editor/**`, `src/viewer/**`, `test/draw/**`, `test/editor/**`,
`test/viewer/**` — dort arbeitet ein zweiter Strang gleichzeitig. Der
Gesamt-Testlauf oben schließt seine Dateien ein.

---

## 16. Ein Test, der geschärft und nicht abgeschwächt wurde

`test/modeling/labels.test.ts` erwartete `preferredLayouts(Flow_B)` enthalte
`"v:h"`. Die neue Tabelle liefert `["b:h"]`.

Das ist keine Abschwächung, sondern die schärfere Aussage. `v` heißt
„senkrecht, Seite offen"; `b` legt fest, dass die Kante nach **unten**
herausläuft. `Boundary_1` sitzt in der Prüffixtur mittig auf der Unterkante von
`Task_A` (262…298 × 182…218 an 200…300 × 120…200), und genau das ist die Seite,
auf der eine Kante ihren Wirt nicht durchschneidet. Die Erwartung ist jetzt
`toEqual(["b:h"])` statt `toContain("v:h")` — sie kann also **mehr**
fehlschlagen als vorher, nicht weniger. Die Begründung steht im Test.

---

## 17. Was an die folgenden Wellen weitergeht

- **`DropOnFlowBehavior`** (neu, aus OP-023). Einen Flussknoten auf einer Kante
  ablegen soll die Kante teilen und den Knoten einreihen. Die Referenz kann es,
  ARCTOS nicht; verbleibende Divergenzen: 2 × `candidate-set/removable/more-ours`,
  1 × `element-set/bpmn:SequenceFlow/sourceRef`, 1 × `waypoints/…/count`. Gehört
  zu Welle 2b neben OP-019 — beides ist „die Engine reagiert darauf, wo man
  etwas fallen lässt".
- **`DetachEventBehavior` — eine Entscheidung, keine Reparatur** (aus OP-022).
  Die Referenz ersetzt ein abgelöstes Randereignis durch ein
  Zwischen-Fang-Ereignis; ARCTOS verweigert das Ablösen. Beide Antworten sind
  in sich stimmig und erzeugen gültige Dokumente. Solange die Entscheidung
  offen ist, bleiben 11 Divergenzen der Klassen `element-set`/`element-type`
  stehen — als Drift der erzeugten Kennungen ab dem Punkt, an dem die beiden
  Engines auseinanderlaufen, nicht als 11 eigene Defekte. Die Frage gehört
  zusammen mit OP-019 gestellt, denn sie ist deren Umkehrung.
- **Rasterfang im Editor** (aus OP-021). Neun Divergenzen sind heute
  `…/grid-snap` und damit `intentional`, weil ARCTOS' Modellschicht kein Raster
  hat und keins haben soll. Baut der Editor-Strang Rasterfang, sollten die
  beiden Engines wieder übereinstimmen und die Klasse **verschwinden**, statt
  toleriert zu werden. Der Kommentar an der Regel sagt das ausdrücklich.
- **`bounds/bpmn:SubProcess`, 5 px** (aus OP-024). Die Korrelation zur
  Rasterklasse ist auffällig (520 auf dem Raster, 515 nicht), aber die Rechnung
  läuft durch die Randabstände des Auto-Resize und wurde nicht zu Ende
  verfolgt. Nicht umgestuft, damit kein Verdacht als Befund gilt.
- **Der Schemaprüfer gehört in die CI** (aus OP-043). Er läuft heute über den
  Korpus. Der eigentliche Nutzen liegt einen Schritt weiter: jedes Dokument,
  das ARCTOS **schreibt**, sollte ihn passieren, bevor es in die Datenbank
  geht. Das berührt `apps/web` und ist deshalb hier nicht gebaut.
- **Der Korpus braucht mehr Ränder** (aus OP-039). Ein einziges neues Dokument
  hat sofort einen Absturz aufgedeckt, der seit dem Bau der Lane-Geometrie
  unbemerkt darin lag. Naheliegende Lücken, die derselbe Handgriff schließen
  würde: ein aufgeklappter Subprozess **mit** angrenzenden Sequenzflüssen (kein
  einziges Korpusdokument hat einen — der `preserveDocking`-Test in
  `layout.test.ts` musste deshalb mit Attrappen arbeiten), und die 25 Dateien
  ohne DI, die alle operationsbasierten Werkzeuge heute ausschließen müssen.

---

## 18. Korrekturen am Register

Neun der zwölf Einträge stimmten in der Sache nicht mehr oder nicht genau.

| ID         | Was im Register steht                                                                               | Was gemessen wurde                                                                                                                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OP-020** | „Verdacht: Relayout beim Redo"                                                                      | **Widerlegt.** Kleinste reproduzierende Folge ist eine einzige `reparent`-Operation ohne Undo/Redo. Ursache: eine Zeile der Layout-Vorgabe.                                                                                        |
| **OP-021** | „Restfälle nach der Docking-Korrektur"                                                              | Zwei eigene Ursachen: ein fehlender `ImportDockingFix` (echter Defekt) und der Rasterfang der Referenz (kein Modellunterschied).                                                                                                   |
| **OP-022** | „9 Divergenzen", „teils Prüfstandsfehler", Kategorie **Testlücke**                                  | **11**, nicht 9. Und kein Prüfstandsfehler: die vom Bericht vorgeschlagene inhaltsbasierte Ausrichtung wurde gebaut und macht es **schlechter** (20 → 52).                                                                         |
| **OP-023** | „ein `bpmn:SequenceFlow` zu viel nach `connect` + `undo`"                                           | Kein Undo beteiligt. 2 von 4 aus einer Regelabkürzung in `shape.create` (behoben), 2 von 4 aus dem fehlenden `DropOnFlowBehavior`.                                                                                                 |
| **OP-024** | „Lane-Inhalte beim Poolwachstum, **5 px**"                                                          | 20 px, und ein Knoten **wechselt dabei die Lane** — also die Verantwortlichkeit. Kein kosmetischer Posten. Der 5-px-Fall ist der zweite (`SubProcess`) und ein anderer.                                                            |
| **OP-025** | „Task bzw. EventBasedGateway in der Wurzel von `synth-nested-subprocesses`", blockiert durch OP-018 | `IntermediateThrowEvent` in `Sub_Pruefung` von `synth-boundary-events`, einem **eingeklappten** Subprozess. Nicht von OP-018 abhängig. Behoben.                                                                                    |
| **OP-041** | „sichtbar und deshalb der harmlosere Rest"                                                          | Derselbe Mechanismus wie OP-024: der Streifen ohne Kind-Lane ist die Fläche, in der ein Knoten seine `flowNodeRef` verliert.                                                                                                       |
| **OP-042** | Kategorie **Produktdefekt**                                                                         | **Kein Defekt.** BPMN-DI ist absolut; eine Relativierung wäre der Fehler. Kein Produktcode geändert, nur ein Wächter ergänzt.                                                                                                      |
| **OP-044** | „flach modelliert (`sourceRef` statt `ioSpecification`)", Kategorie Codequalität                    | Es fehlt nicht die `ioSpecification`, sondern ein **zulässiges Ziel**: `targetRef` zeigte auf eine Aktivität, die kein `ItemAwareElement` ist. Das erzeugte Dokument war ungültiges BPMN — also Produktdefekt, nicht Codequalität. |

Unverändert zutreffend: **OP-039**, **OP-040**, **OP-043**.

Ein Nachtrag zum Bericht `STUFE2-D` §2.3, der nicht zum Register gehört, aber
zum Verständnis: Die dortige Beschreibung des Docking-Fehlers („die Wegpunkte
begannen in den Mittelpunkten") war richtig für den gerechneten Fall und
unvollständig für den importierten. Nach der Korrektur von 2026-08-31 schnitt
ARCTOS ab, während die Referenz weiterhin vom logischen Anker aus rechnete —
die Differenz von einer halben Formbreite blieb, nur mit vertauschten Vorzeichen.
Sichtbar wurde das erst, als die Kantenführung selbst stimmte.

---

## Nachtrag aus der Abnahme (2026-09-03)

Beim Verifizieren der Welle sind zwei Stellen aufgefallen, die beide dieselbe
Klasse haben und beide erst durch die Coverage-Ratsche sichtbar wurden.

**Die Ratsche hat gehalten, wo sie sollte.** `packages/bpmn` fiel bei den
Funktionen um 0,04 Punkte — 1537 von 1706 statt 1538. Weniger als eine
Funktion, innerhalb der Toleranz des Tors, und trotzdem hat
`--update-baseline` die Anhebung verweigert und nach einer Begründung
verlangt. Das war richtig: die Begründung wäre gewesen „ist doch nur ein
Rundungsrest", und darunter lagen zwei Funktionen, die noch nie gelaufen sind.

**(1) `formatSchemaFindings` — der Formatierer, der nur im Fehlerfall läuft.**
Der neue Schemaprüfer wird im Korpustest über alle 53 Dateien aufgerufen, aber
sein Formatierer nur im Zweig `findings.length > 0` — und der Korpus ist
sauber. Die Funktion lief in keinem grünen Lauf. Wirft sie, geht die
Fehlermeldung verloren, die den Fehler erklären sollte, und der Test scheitert
an seiner eigenen Diagnose statt an der Sache. Fünf Tests, darunter der Fall
„kein Befund" (`""` und nicht `"undefined"`) und „keine Kennung, kein Attribut"
(kein `#undefined` im Bericht).

**(2) `shrinkSequence` — der Schrumpfer, der nur läuft, wenn eine Eigenschaft
bricht.** Zwölf der 21 Funktionen in `src/verify/property.ts` waren ohne
Abdeckung, darunter die gesamte Delta-Debugging-Maschinerie. Das ist die
teurere der beiden: Der Schrumpfer ist das Werkzeug, auf das sich ein
Entwickler an genau dem Tag verlässt, an dem eine Eigenschaft zum ersten Mal
wirklich bricht. Ist er defekt, liefert der erste echte Fehlschlag einen
falschen oder unbrauchbaren Minimalfall.

Elf Tests gegen ein Läufer-Doppel, das eine bekannte Bedingung als Fehlschlag
meldet — geprüft wird die Schrumpflogik, nicht die Engine: welche Kandidaten
sie bildet, wann sie einen Fehlschlag als „denselben" akzeptiert
(Invariantenkennung, nicht Meldung), der Rückfall auf `phase:` bei einem
Fehlschlag ohne Invariante, der Versuchshaushalt, und dass sie nie auf die
leere Folge kürzt.

**Drei dieser elf Tests waren zuerst rot — und der Code hatte recht.** Meine
Erwartungen waren überspezifiziert:

| Erwartet                     | Gemessen               | Warum der Code recht hat                                                                                                                                     |
| ---------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rename(#3, "boom")` bleibt  | `rename(#1, "boom")`   | Der Schrumpfer halbiert auch Auswahlindizes; die Auflösung ist modulo der Kandidatenzahl, ein kleinerer Index liest sich besser. Steht so im Code begründet. |
| `move(137, -42)` bleibt ganz | `move(137, 0)`         | `dy` trug den Fehlschlag nicht. Genau die Trennung, die der Bericht leisten soll.                                                                            |
| Folge bleibt ungekürzt       | Name wurde vereinfacht | Mein Doppel unterschied nach **Länge**; die Vereinfachung einzelner Operationen lässt die Länge gleich.                                                      |

Die Erwartungen sind nachgezogen, der Code unverändert — und die
Index-Halbierung ist jetzt als eigener Test festgehalten, weil sie sonst wie
ein Fehler aussieht: der Bericht nennt eine andere Nummer als der Lauf.

`packages/bpmn`: 829 → **845 Tests**, Funktionsabdeckung 89,97 % → **90,44 %**.
