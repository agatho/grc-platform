# Stufe 2 / A1 — Modellierungsschicht

**Datum:** 2026-09-02 · **Branch:** `audit/full-2026-08-31` · **Paket:** `packages/bpmn`
**Dateihoheit:** `src/modeling/**`, `test/modeling/**`

---

## 0. Stand in Zahlen

|                       |                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------: |
| Produktivcode         |                                                                                               **7.602 LOC** in 24 Dateien (`src/modeling/`) |
| Testcode              |                                                                                              **4.012 LOC** in 13 Dateien (`test/modeling/`) |
| Tests dieser Schicht  |                                                                                                                                     **173** |
| Tests im Paket gesamt | **585** grün (Ausgangsstand 223; die Differenz jenseits meiner 173 stammt aus den parallel laufenden Strängen `src/grc/` und `src/verify/`) |
| `tsc --noEmit`        |                                                                    fehlerfrei, mit `strict` + `noUncheckedIndexedAccess` + `noUnusedLocals` |
| Invarianten           |                                                                                              **34 Prüfungen**, jede mit eigenem Negativtest |

Eine Änderung außerhalb der Dateihoheit: `src/index.ts` bekam **eine** Zeile
(`export * as modeling from "./modeling/index.js";`), damit die Schicht über die
Paketfläche erreichbar ist. Nichts sonst wurde außerhalb angefasst — `src/model/`,
`src/draw/` und `src/viewer/` sind unverändert.

---

## 1. Die Reihenfolge, die der Spike vorgab

Der Invariantenprüfer entstand **zuerst** und vollständig, bevor die erste
Modellierungsoperation gebaut wurde. Das war keine Formalie: Er hat während des
Baus **sieben Fehler gefunden**, von denen kein einziger im Bild sichtbar
gewesen wäre und von denen mindestens vier eine unlesbare oder unvollständige
Datei erzeugt hätten. Sie stehen einzeln in §6.

`src/modeling/invariants.ts` ist so exportiert, wie der Auftrag es für den
Eigenschaftstest-Strang verlangt:

```ts
import {
  checkInvariants,
  assertInvariants,
  walkDocument,
} from "@grc/bpmn/modeling";

checkInvariants({ definitions }); // nur Baum 1 + 2
checkInvariants({ definitions, elementRegistry }); // alle drei Bäume
assertInvariants({ definitions, elementRegistry }, "nach Operation 17");
```

Der Prüfer **wirft nie**, hat keine Abhängigkeit auf `diagram-js` oder auf den
Rest dieser Schicht, und liefert stabil sortierte Befunde mit Code, Meldung und
Element-Id.

---

## 2. Die Invariantenliste

Alle 33 Prüfungen, gruppiert. Jede hat in `test/modeling/invariants.test.ts`
einen Test, der den Fehler **absichtlich herstellt** und nachweist, dass genau
dieser Code gemeldet wird — ein Prüfer, der nie anschlägt, ist schlimmer als
keiner.

**Semantisch ↔ grafisch (Baum 1 ↔ 3)**
`GRAPHIC_WITHOUT_SEMANTIC` · `GRAPHIC_SEMANTIC_NOT_IN_DOCUMENT` ·
`SEMANTIC_WITHOUT_GRAPHIC` · `GRAPHIC_ID_MISMATCH`

**DI (Baum 2)**
`DI_WITHOUT_BPMN_ELEMENT` · `DI_ORPHANED` · `DI_DUPLICATE` · `DI_MISSING` ·
`DI_BOUNDS_INVALID` · `DI_WAYPOINTS_INVALID` · `DI_BOUNDS_MISMATCH` ·
`DI_WAYPOINTS_MISMATCH` · `DI_NOT_IN_PLANE`

**Flussreferenzen, beidseitig**
`FLOW_WITHOUT_SOURCE` · `FLOW_WITHOUT_TARGET` · `FLOW_SOURCE_NOT_IN_DOCUMENT` ·
`FLOW_TARGET_NOT_IN_DOCUMENT` · `OUTGOING_MISSING` · `INCOMING_MISSING` ·
`OUTGOING_STALE` · `INCOMING_STALE` · `DEFAULT_FLOW_DANGLING` ·
`DATA_ASSOCIATION_DANGLING`

**Enthaltenheit und IDs**
`NODE_IN_TWO_CONTAINERS` · `PARENT_LINK_BROKEN` · `CONTAINER_MISMATCH` ·
`DUPLICATE_ID` · `MISSING_ID`

**Lanes**
`LANE_REF_NOT_IN_DOCUMENT` · `LANE_REF_FOREIGN_PROCESS` · `LANE_REF_DUPLICATE` ·
`LANE_REF_NOT_A_FLOWNODE`

**Boundary Events**
`BOUNDARY_WITHOUT_HOST` · `BOUNDARY_HOST_NOT_ACTIVITY` ·
`BOUNDARY_HOST_MISMATCH` · `BOUNDARY_HOST_FOREIGN_CONTAINER`

**Kollaboration**
`PARTICIPANT_PROCESS_MISSING` · `MESSAGE_FLOW_OUTSIDE_COLLABORATION`

### Drei Entwurfsentscheidungen im Prüfer, die Begründung brauchen

**(a) Enthaltenheit wird über den Eigenschaftsnamen bestimmt, nicht über
`$parent`.** `moddle` unterscheidet zur Laufzeit nicht zwischen
`flow.sourceRef` und `process.flowElements[0]` — beides sind Objektwerte. Der
Baumlauf benutzt deshalb eine Liste bekannter _Referenz_-Eigenschaften
(`REFERENCE_PROPERTIES`, 34 Namen) und behandelt alles andere als Enthaltenheit.
Würde er `$parent` benutzen, könnte ein falsch gesetztes `$parent` die Prüfung
`PARENT_LINK_BROKEN` selbst unwirksam machen.

**(b) `DI_MISSING` gilt nur für _sichtbare_ Elemente.** Ein eingeklappter
Subprozess (`isExpanded="false"` oder ganz ohne DI) zeigt seinen Inhalt nicht,
und BPMN verlangt für diesen Inhalt keine Diagramminformation. Der Bestandskorpus
enthält solche Dateien (`synth-boundary-events`, `synth-nested-subprocesses`).
Eine pauschale Prüfung hätte dort Fehlalarme erzeugt — und nach zwei Fehlalarmen
wird ein Prüfer abgeschaltet.

**(c) `incoming`/`outgoing` werden nur für `SequenceFlow` beidseitig verlangt.**
BPMN 2.0 definiert diese Listen als Verweise auf Sequenzflüsse. Ein
Nachrichtenfluss gehört dort **nicht** hinein; bei ihm wird nur die
Auflösbarkeit beider Endpunkte geprüft.

---

## 3. Abgedeckte Operationen

Für jede Operation aus Punkt 2 des Auftrags gibt es mindestens einen Test, der
die Invarianten **nach der Operation, nach dem Undo und nach dem Redo** prüft.
Das leistet `operate()` aus `test/modeling/helpers/harness.ts` in einem Aufruf,
sodass keine Operation ohne diese Abdeckung geschrieben werden kann.

| Kommando                                         | was die Schicht nachführt                                                                                                                   | Test                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `shape.create`                                   | Container (`flowElements` / `participants` / `laneSets` / `artifacts`), DI-Shape, `bpmnElement`-Rückverweis, `flowNodeRef`, `attachedToRef` | operations, lanes                                 |
| `shape.move`                                     | DI-Bounds, Containerwechsel **nur** bei echtem Wechsel, `flowNodeRef` neu, Boundary-Wirt                                                    | operations (3 Fälle: Lane, SubProcess, innerhalb) |
| `shape.delete`                                   | Lane-Verweise, DI aus der Ebene, semantisches Aushängen, Prozess eines Pools, `default`                                                     | operations                                        |
| `shape.resize`                                   | DI-Bounds, Lane-Neuzuordnung **aller** Knoten im Pool                                                                                       | operations, lanes                                 |
| `shape.toggleCollapse`                           | `isExpanded` in der DI, Bounds                                                                                                              | operations                                        |
| `connection.create`                              | `sourceRef`/`targetRef`, `incoming`/`outgoing` beidseitig, Container je Kantenart, DI-Edge                                                  | operations (3 Kantenarten)                        |
| `connection.delete`                              | beide Listen, `default`, DI, Container                                                                                                      | operations                                        |
| `connection.reconnect`                           | alte **und** neue Listen auf beiden Seiten, `sourceRef`/`targetRef`, `default` des alten Quellknotens, Wegpunkte                            | operations (Quelle + Ziel)                        |
| `connection.layout` / `updateWaypoints` / `move` | DI-Wegpunkte, Containerwechsel                                                                                                              | operations                                        |
| `element.updateProperties`                       | eigener Handler mit exaktem Inversem, `id` in allen drei Bäumen                                                                             | operations                                        |
| `element.updateLabel`                            | `name` bzw. `text`, Beschriftungs-Shape anlegen/entfernen, `BPMNLabel`-Box                                                                  | operations, labels                                |
| `element.updateAttachment`                       | `attachedToRef`, Containerwechsel des Boundary Events                                                                                       | operations                                        |
| `lane.add` / `lane.split` / `lane.remove`        | eigene Kommandos, siehe §4                                                                                                                  | lanes                                             |

Zusätzlich: **`label.create`** (Beschriftungsbox in die DI des Ziels).

---

## 4. Wie die einzelnen Punkte gelöst sind

### Punkt 1 — `BpmnFactory`

`src/modeling/BpmnFactory.ts` erzeugt semantische Objekte **und** ihre
DI-Entsprechung; das eine gibt es nie ohne das andere. `$parent` wird gesetzt,
sobald ein Container bekannt ist — `moddle.create` tut das nicht, und der
Invariantenprüfer meldet ein fehlendes `$parent`.

Die ID-Vergabe (`src/modeling/ids.ts`) liest **einmal das gesamte
Definitions-Dokument** ein — alle `rootElements`, alle `flowElements` aller
Prozesse, `laneSets`, `artifacts`, die vollständige DI und `$attrs["id"]`. Wer
nur den sichtbaren Prozess betrachtet, kollidiert mit einem Element in einem
Pool, den gerade niemand ansieht; `moddle` beschwert sich beim Schreiben nicht.
IDs werden beim Undo **freigegeben**, damit ein Redo dieselbe ID wiederbekommt
und zwei identische Bedienfolgen dieselbe Datei erzeugen (Z-B).

### Punkt 2 — `BpmnUpdater`

Die tragende Entwurfsentscheidung: **Rückwege statt zweiter Implementierung.**
Jede Mutation liefert die Funktion mit, die sie aufhebt (`addToContainer`,
`removeRef`, `setProperty`, `setBounds`, …). Sie werden in der
Kommando-Kontextmappe gesammelt und beim `reverted` rückwärts abgespielt.

Das ist keine Bequemlichkeit, sondern eine strukturelle Zusicherung: Vorwärts-
und Rückwärtsweg entstehen **an derselben Stelle aus derselben Information**.
Eine Mutation ohne Rückweg ist ein Typfehler, kein Testversagen. Die Tests
prüfen die Invarianten nach jedem Undo trotzdem — die Zusicherung deckt die
Mechanik ab, nicht die Absicht.

Kaskaden (Kanten, Beschriftungen, Boundary Events beim Löschen; Anhefter beim
Verschieben) laufen bewusst **nicht** im Updater, sondern als weitere Kommandos
in `preExecute` — teils von `diagram-js` (`DeleteShapeHandler`,
`attach-support`, `label-support`), teils aus `behaviors/`. Damit hängt jede
Teilwirkung am `commandStack` und ein einziges `undo` rollt alles zurück.

### Punkt 3 — `BpmnRules`

Umgesetzt als `RuleProvider` von `diagram-js`; geprüft wird über den
`rules`-Dienst, also genau so, wie Palette und ContextPad es später tun. Die
Verbote sind einzeln formuliert, damit ein Regressionstest zeigen kann, _welches_
gegriffen hat: kein Eingang am Start-Ereignis, kein Ausgang am End-Ereignis,
Boundary Events nur als Quelle, Ereignis-Subprozesse ohne Sequenzflüsse,
Sequenzflüsse nur innerhalb desselben Pools **und** desselben Containers,
Nachrichtenflüsse nur zwischen Pools und nur an nachrichtenfähigen Elementen
(Gateways gehören nicht dazu), Datenassoziationen nur Aktivität ↔ Datenobjekt,
Assoziationen nur zu/von Textannotationen.

`Modeling.connect()` fragt die Regeln nach der **Kantenart**. Liefern sie keine,
entsteht nichts und der Aufruf wirft. Stillschweigend einen Sequenzfluss
anzulegen wäre der bequeme und falsche Weg — dort entstehen die
Nachrichtenflüsse, die in Wahrheit Sequenzflüsse sind.

### Punkt 4 — Lanes

`src/modeling/lanes.ts` plus `src/modeling/cmd/LaneHandlers.ts`.

Die Zuordnung eines Knotens zu seiner Lane wird **geometrisch** gerechnet (die
innerste Lane, die seinen Mittelpunkt enthält) und dann auf `flowNodeRef`
geschrieben — erst aus _jeder_ Lane des Prozesses entfernen, dann in die
Ziel-Lane eintragen. Das „erst überall entfernen" ist die Invariante
`LANE_REF_DUPLICATE`.

`lane.add`, `lane.split` und `lane.remove` sind **zusammengesetzte Kommandos**:
sie tun ihre gesamte Arbeit in `preExecute` und rufen dabei nur vorhandene
Modellierungsoperationen (`createShape`, `resizeShape`, `moveElements`,
`removeShape`). Der `commandStack` fasst das zu einem Undo-Schritt zusammen —
das Inverse eines Lane-Umbaus ist damit die Summe geprüfter Inverser.

Beim Teilen bleibt die vorhandene Lane als **erster** Streifen bestehen und wird
verkleinert; die übrigen entstehen neu. Das erhält ihre ID und damit jeden
Verweis darauf.

### Punkt 5 — Boundary-Attachment

`attach-support` von `diagram-js` trägt das Mitbewegen und Mitlöschen. Ergänzt
ist: `attachedToRef` nachführen (Updater), das Anheften nur an Aktivitäten
(Regeln), und **auf dem Rand bleiben beim Verkleinern des Wirts**
(`behaviors/BoundaryEventBehavior.ts`) — `attach-support` verschiebt Anhefter um
dasselbe Delta wie den Wirt, was beim Verkleinern zu einem Ereignis im Inneren
führt.

### Punkt 6 — Flow-Routing und Docking

`BaseLayouter`, `ManhattanLayout` und `CroppingConnectionDocking` werden
benutzt, nicht nachgebaut. BPMN-spezifisch ist nur die Wahl der bevorzugten
Andockseiten: Sequenzflüsse waagerecht, Kanten aus einem Boundary Event
senkrecht heraus (sonst laufen sie durch ihren eigenen Wirt), Nachrichtenflüsse
senkrecht über die Poolgrenze, Assoziationen gerade.

### Punkt 7 — Label-Verhalten

`label-support` trägt Mitbewegen und Mitlöschen. Ergänzt ist die BPMN-Frage,
_wann es überhaupt eine externe Beschriftung gibt_, und die Pflege der
`BPMNLabel/bounds`.

Bewusst anders als `bpmn-js`: **eine geleerte Beschriftung verschwindet.** In
`bpmn-js` überleben leere Labels als unsichtbare Shapes und hinterlassen beim
Export `BPMNLabel`-Einträge ohne Inhalt.

Beim Lesen gilt **robust lesen, sauber schreiben**: eine vorhandene Box wird nie
überschrieben (sonst verschöbe schon das Öffnen einer fremden Datei jede
Beschriftung), eine fehlende wird berechnet, eine unvollständige (x/y ohne
width/height — kommt im Korpus vor) behält ihre Position und bekommt Maße
ergänzt.

### Punkt 8 — Undo/Redo

`commandStack` von `diagram-js`, siehe die Rückweg-Entscheidung in Punkt 2.
Eigene Handler (`UpdatePropertiesHandler`, `UpdateLabelHandler`) haben echte
`execute`/`revert`-Paare.

`UpdatePropertiesHandler` merkt sich nicht den _Wert_, sondern den **Zustand**
(eigene Eigenschaft vorhanden ja/nein plus Wert) und benutzt `Object.hasOwn`,
nicht `in`: `moddle` legt Schema-Vorgabewerte auf der Prototypkette ab. Mit `in`
gälte jede vorgabebehaftete Eigenschaft als vorhanden, und das Undo schriebe den
Vorgabewert als eigene Eigenschaft zurück — womit beim Export ein Attribut
entstünde, das in der Eingabe nie stand.

---

## 5. Was zusätzlich entstanden ist (im Auftrag nicht genannt, aber nötig)

**`src/modeling/importer.ts` (566 LOC).** Der Betrachter baut aus DI und
Modell eine _flache_ Szene; zum Bearbeiten braucht es die echte Schachtelung
(`parent`/`children`, `host`/`attachers`, `labelTarget`). Zwei bewusste
Eingriffe, beide abschaltbar und beide von Z-C gedeckt:

- **Fehlende DI wird ergänzt** (`repairMissingDi`, Vorgabe an). Der Korpus
  enthält Dateien ohne `BPMNPlane`, mit unvollständiger DI und mit `BPMNShape`
  ohne Bounds.
- **`incoming`/`outgoing` werden aus `sourceRef`/`targetRef` vervollständigt**
  (`normalizeFlowRefs`, Vorgabe an). **Das ist ein Befund:** BPMN kodiert die
  Kante-Knoten-Beziehung doppelt, und `bpmn-moddle` füllt `incoming`/`outgoing`
  **nur** aus den ausgeschriebenen Kindelementen. Fehlen sie in der Datei,
  bleibt die Liste leer, obwohl `sourceRef` aufgelöst ist. Der Bestandskorpus
  schreibt sie durchgängig aus, der Excel-Import und der KI-Generator müssen das
  nicht — und ein Editor, der auf der leeren Liste arbeitet, hängt beim ersten
  Löschen die falschen Kanten ab.

**`src/modeling/session.ts` (218 LOC).** `ModelingSession` bündelt Modulliste,
Import, Export und den Zugriff auf alle drei Bäume. Bewusst Produktivcode: sie
trägt später die React-Fassade (`<BpmnCanvas mode="edit">`), den
Shadow-Compare-Lauf aus §5.4 und die Eigenschaftstests des Nachbarstrangs.

**Grundlinie vorhandener Defekte.** Die Sitzung erhebt die Invarianten direkt
nach dem Import und zieht **befundgenau** (Code _und_ Element) ab, was die
Eingabedatei schon mitbrachte. Damit meldet der Prüfer, was die
Modellierungsschicht kaputt gemacht hat, und nicht, was die Datei mitbrachte —
ohne dass dafür eine ganze Prüfung abgeschaltet werden müsste. Der häufigste
Fall ist Ursache 2 aus der Spike-Auswertung: eine `BPMNShape`, deren
`bpmnElement`-IDREF `moddle` beim Lesen still verworfen hat. Sie ist nach dem
Lesen nicht mehr reparabel — der Zeiger ist weg —, aber sie ist auch nicht das
Werk dieser Schicht. `session.preexistingViolations()` macht sie sichtbar.

---

## 6. Was der Invariantenprüfer gefunden hat

Sieben Fehler, alle **während** des Baus, keiner davon im Bild sichtbar. Das ist
die Rechtfertigung für die vorgegebene Reihenfolge, und es ist die Zahl, die man
gegen den Aufwand des Prüfers halten muss.

1. **Beschriftung gelöscht → beschriftetes Element aus `flowElements` entfernt.**
   `label-support` setzt `labelTarget` bereits im `execute` von `shape.delete`
   auf `null`. Der Updater sah im `executed` kein `labelTarget` mehr, hielt die
   Beschriftung für einen gewöhnlichen Knoten und entfernte deren
   `businessObject` — das des _beschrifteten_ Elements — aus dem Container.
   Befund: `GRAPHIC_SEMANTIC_NOT_IN_DOCUMENT`. Im Bild wäre nur die Beschriftung
   verschwunden; in der Datei hätte das Element gefehlt.
   _Behebung:_ `isLabel()` prüft zusätzlich `type === "label"`.

2. **Knoten auf der Wurzel eines Kollaborationsdiagramms verschwindet beim
   Export.** `bpmn:Collaboration` hat keine `flowElements`. `moddle` nimmt die
   Eigenschaft im Speicher klaglos an und **schreibt sie beim Export nicht**. Im
   Editor war der Knoten da, in der Datei fehlte er — genau die Fehlerart aus der
   Spike-Auswertung. Kein anderer Befund zeigte das an: DI, Referenzen und IDs
   waren stimmig.
   _Behebung:_ neue Prüfung `CONTAINER_MISMATCH`; die Regeln verbieten das
   Ablegen zusätzlich.

3. **Knoten bleibt nach `lane.remove` an der gelöschten Lane hängen.** Die
   Neuzuordnung lief nur für das _bewegte_ Element, nicht für die Knoten, die
   durch das Wachsen einer Nachbarlane neu hineinfallen.
   Befund: `LANE_REF_NOT_IN_DOCUMENT`.
   _Behebung:_ `shape.resize` einer Lane oder eines Pools ordnet alle Knoten des
   Pools neu zu.

4. **`NaN`-Wegpunkte an einem Nachrichtenfluss beim Lane-Umbau.**
   `MoveHelper` von `diagram-js` übergibt
   `connectionStart: sourceMoved && getMovedSourceAnchor(...)` — bei einem nicht
   mitbewegten Endpunkt also den **booleschen** Wert `false`, nicht `undefined`.
   Der Layouter behandelte den Hint mit `??`, wodurch `false` als Startpunkt
   durchlief. `dc:Point/@x="NaN"` liest kein Fremdwerkzeug.
   _Behebung:_ Hints werden auf echte Punkte geprüft; zusätzlich fällt der
   Layouter auf die Formmitten zurück, falls doch ein `NaN` entsteht.

5. **Neu erzeugte Kanten ohne Wegpunkte.** Die Elementfabrik setzte
   `waypoints ??= []`; `CreateConnectionHandler` ruft den Layouter aber nur,
   wenn `connection.waypoints` _falsy_ ist, und ein leeres Array ist truthy.
   _Behebung:_ kein Vorgabewert mehr.

6. **Undo schrieb Schema-Vorgabewerte als eigene Eigenschaften zurück** — siehe
   §4, Punkt 8.

7. **Neuer Pool ohne `bpmn:Process`.** Ein Participant ohne `processRef` ist ein
   Rechteck, kein Pool: die Lanes darin hätten keinen Prozess und `flowNodeRef`
   zeigte auf Knoten, die nirgends stehen. Befund: `LANE_REF_FOREIGN_PROCESS`.
   _Behebung:_ der Prozess entsteht zusammen mit dem Pool und wandert mit ihm in
   `rootElements`.

Zwei weitere Befunde waren **Fehler in den Prüfdaten**, nicht im Code — ein
`default`, das auf einen eingehenden Fluss zeigte, und ein Nachrichtenfluss von
einem Gateway. Auch das ist ein Ergebnis: der Prüfer hält handgeschriebene
Fixtures ehrlich.

---

## 6a. Zweiter Durchgang — Befunde des Verifikationsstrangs

Der Verifikationsstrang (`/work/bpmn-plan/STUFE2-A3-VERIFIKATION.md`) hat acht
Befunde gemeldet. Sechs waren echte Fehler dieser Schicht, einer eine zu strenge
Invariante, einer eine Fehldiagnose mit echter Ursache dahinter. Alle sind
erledigt; jeder hat einen Regressionstest in `test/modeling/findings.test.ts`.

| #   | Befund                                                   | Status                               | Ursache                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | Wegpunkt ohne `x` beim Verschieben um (0,0)              | erledigt (schon im ersten Durchgang) | `MoveHelper` übergibt `connectionStart: false`; der Layouter behandelte den Hint mit `??`. Test hält es fest.                                                                                                                                                                               |
| 3.2 | Subprozess löschen verwaist die eingebettete `BPMNPlane` | behoben                              | `BpmnUpdater.dropOwnPlanes` entfernt die Ebene des Elements **und seiner semantischen Nachfahren**. Nötig, weil ein eingeklappter Subprozess seine Kinder nie grafisch bekommt — kein `shape.delete` läuft für sie.                                                                         |
| 3.3 | Nachrichtenfluss in `incoming`/`outgoing`                | behoben                              | Eintragen jetzt nur für `bpmn:SequenceFlow`; **austragen** weiterhin für alle Typen, damit Altdateien aufgeräumt werden.                                                                                                                                                                    |
| 3.4 | Datenobjekt löschen lässt Datenassoziationen hängen      | behoben                              | `dropDataAssociations` durchsucht den semantischen Baum. Die grafische Kaskade greift dort nicht: `DataOutputAssoc_1` im Korpus hat gar keinen `sourceRef`, ist also nie eine Kante.                                                                                                        |
| 3.5 | Undo entfernt die erzeugte DI nicht                      | **Fehldiagnose, Ursache behoben**    | Die Umkehrfunktion räumt die DI ab (Test). Der Prüfstand sah einen halben Rückbau, weil `attachBoundary` in dieser Schicht **zwei** Kommandos kostete: erzeugen, dann Ereignisdefinition nachtragen. `bpmn-js` braucht eines. Die Elementfabrik nimmt jetzt `eventDefinitionType` entgegen. |
| 3.6 | Undo stellt einen leeren Namen nicht wieder her          | **Fehldiagnose, gleiche Ursache**    | `UpdatePropertiesHandler` stellt `""` korrekt zurück (Test). Der `@name=`-Unterschied stammt aus derselben Kommandozählung.                                                                                                                                                                 |
| 3.7 | Boundary-Event am Ereignis-Subprozess                    | behoben                              | `canAttach` lehnt jetzt Ereignis-Subprozess, Kompensationsaktivität und Receive-Task hinter einem ereignisbasierten Gateway ab.                                                                                                                                                             |
| 3.8 | `PARENT_LINK_BROKEN` zu streng                           | Invariante angepasst                 | `$parent` wird nur noch für Elemente mit eigener Identität verlangt; `dc:*`, `di:*` und `bpmndi:BPMNLabel` sind ausgenommen.                                                                                                                                                                |

**Der Beleg für 3.5/3.6.** Über 125 erzeugte Operationsfolgen **ohne**
`attachBoundary` gilt „n Operationen, n Undos stellen das Dokument wieder her"
ausnahmslos; mit `attachBoundary` schlägt es fehl, und zwar genau in den
Folgen, die eine enthalten. Das ist kein Indiz, sondern eine
Kontrollbedingung — und sie zeigt zugleich, warum die Diagnose nicht bei „die
Umkehrfunktion ist falsch" stehen bleiben durfte.

**Was das für den Verifikationsstrang heißt.** Sein Treiber
(`src/verify/drivers/arctos.ts`, Zeile 427 ff.) legt die Ereignisdefinition
noch in einem zweiten Kommando an — mit dem Kommentar, die Fabrik nehme
`eventDefinitionType` nicht entgegen. Das stimmt nicht mehr. Solange die eine
Zeile dort nicht nachgezogen ist, reproduzieren sich die Befunde
`roundtrip/undo-leaves-di` und `roundtrip/undo-does-not-restore-name` weiter —
als Artefakt des Treibers, nicht der Schicht.

**Die Bilanz dieses Durchgangs** ist der eigentliche Ertrag: Acht Meldungen,
sechs echte Fehler, keiner davon am Bild sichtbar, alle aus **erzeugten**
Operationsfolgen. Meine eigenen 129 handgeschriebenen Tests hatten keinen davon
gefunden. Das ist die Zahl, die man neben die Kostenfrage „lohnt sich der
Eigenschaftstest-Strang" legen muss.

---

## 6b. Nachgezogen: `shape.replace`, Wurzelwechsel, geschachtelte Lanes

**`shape.replace` (Typwechsel).** Eigener Handler statt des generischen von
`diagram-js`, weil der Typwechsel in BPMN kein reines Austauschen ist:
Eigenschaften wandern mit — aber nur die, die der Deskriptor des **neuen** Typs
kennt (sonst nimmt `moddle` sie im Speicher an und lässt sie beim Export weg);
`extensionElements` samt `arctos:grcMetadata` wandert mit; Boundary Events
werden umgehängt (der generische Handler nimmt nur `children`); Kanten bleiben,
soweit die Regeln sie nach dem Wechsel noch zulassen, und verschwinden sonst
sichtbar.

**Die ID bleibt erhalten** — eine bewusste Abweichung von `bpmn-js`. ARCTOS
referenziert BPMN-Elemente aus der Datenbank heraus über ihre ID (Risiken,
Kontrollen, Kommentare, Simulationsdaten). Eine neue ID beim Typwechsel wäre
dort ein stiller Verlust aller Verknüpfungen. `hints.newId` schaltet es ab.

Ein Detail, das der eigene Prüfer erzwungen hat: Die übernommenen Teilbäume
werden **kopiert, nicht geteilt**. Beim Teilen zeigte `extensionElements.$parent`
nach einem Undo auf ein Objekt, das nicht mehr im Baum steht — der Vorwärtsweg
sah richtig aus, der Rückweg nicht.

**Wurzelwechsel Process ↔ Collaboration.** Der Punkt, der im ersten Durchgang
durch eine Verbotsregel ersetzt war, ist jetzt gebaut. Der Kniff: das
**grafische** Wurzelelement bleibt, was es ist — ein Behälter ohne eigene
Aussage. Getauscht werden nur drei Verweise (`root.businessObject`,
`plane.bpmnElement`, `definitions.rootElements`) in einem kleinen Kommando mit
handgeschriebenem Rückweg; alles Übrige sind gewöhnliche
Modellierungsoperationen. Damit entfällt das Umhängen von SVG-Ebenen zwischen
zwei `diagram-js`-Wurzeln vollständig.

Beide Richtungen sind gebaut: Der erste Pool wandelt den Prozess in eine
Collaboration und nimmt ihn als seinen `processRef` (nicht einen neuen — sonst
hinge der bisherige Inhalt an einem Prozess, den keine Ebene mehr zeigt); das
Löschen des letzten Pools bindet zurück und rettet den Inhalt **vor** der
Löschkaskade. Die Reihenfolge dort ist nicht beliebig und im Code begründet.

**Geschachtelte Lanes.** Zwei Fehler, beide vom neuen Testfall aufgedeckt:

1. Das Entfernen der letzten Lane einer Ebene verkleinerte den Pool um die
   Lane-Höhe — bei einer Lane, die den Pool fast ausfüllt, fiel er damit auf die
   Mindesthöhe zusammen. Und bei einer _geschachtelten_ Lane traf es den
   falschen Container: geschrumpft wurde der Pool, obwohl die Lane in einer
   Eltern-Lane lag. Richtig ist: der Container verliert seine Unterteilung,
   nicht seine Größe.
2. Nach dem Entfernen der letzten inneren Lane stand ihr Knoten in **keiner**
   Lane, obwohl er geometrisch mitten in der äußeren liegt. Die Neuzuordnung
   hängt jetzt auch am Löschen einer Lane, nicht nur an deren Größenänderung.

Der Bestandskorpus enthält keinen geschachtelten Fall; die Prüfdatei
`NESTED_LANES` in `test/modeling/helpers/fixtures.ts` schließt die Lücke.

---

## 7. Was **nicht** fertig ist

Die Folgearbeiten hängen daran, deshalb hier präzise statt beschönigend.

### Nicht gebaut, bewusst und dokumentiert

1. **Ereignis → Boundary Event beim Anheften.** `shape.replace` ist gebaut
   (§6b), aber der _automatische_ Typwechsel beim Ziehen eines
   Zwischen-Ereignisses auf eine Aktivität ist es nicht: Die Regeln erlauben das
   Anheften eines `bpmn:IntermediateCatchEvent`, ein Behavior, das daraus ein
   `bpmn:BoundaryEvent` macht, fehlt. Bis dahin sollte der Editor-Strang nur
   bereits typrichtige Boundary Events anheften lassen. Kleiner Posten —
   `ParticipantBehavior` ist das Muster, `modeling.replaceShape` das Werkzeug.

2. **Drill-down in Subprozesse (mehrere Ebenen).** Der Importer zeichnet die
   erste `BPMNDiagram`-Ebene; ein eingeklappter Subprozess mit eigener Ebene wird
   nicht geöffnet. Das Modell trägt es (`planesOf`, `planeOfDi` arbeiten über
   alle Ebenen), die Bedienung fehlt.

3. **`bpmn:Group` und `categoryValueRef`.** Gruppen werden importiert,
   dargestellt und bewegt, aber das Beschriften einer Gruppe schreibt `name`
   statt eine `bpmn:CategoryValue` anzulegen. Für die GRC-Schicht (§3.12) ist
   das nachzuholen.

4. **Vertikale Pools sind nur teilweise geprüft.** Die Lane-Geometrie kennt
   `isHorizontal` und rechnet für beide Achsen, aber alle Tests laufen auf
   waagerechten Pools — der Korpus enthält keinen senkrechten. **Risiko:
   mittel**, die Symmetrie ist ungetestet.

5. **Eingeklappte Subprozesse behalten ihre Kinder in der `elementRegistry`.**
   `shape.toggleCollapse` führt `isExpanded` in der DI nach und ist geprüft, aber
   `diagram-js` setzt die Kinder nur auf `hidden`, statt sie zu entfernen. Für
   das Modell ist das folgenlos (die DI bleibt gültig); für den Editor-Strang
   heißt es, dass ein eingeklappter Subprozess weiterhin selektierbare Kinder
   enthält. Vor dem Bau der Selektion zu klären.

### Nur teilweise tragfähig

7. **`moveShape` bewegt Beschriftungen und Anhefter nicht mit.** Das ist
   Verhalten von `diagram-js` (`label-support` und `attach-support` hängen am
   zusammengesetzten `elements.move`), und `bpmn-js` hat dieselbe Eigenschaft.
   **Konsequenz für den Editor-Strang:** Bedienpfade müssen `moveElements`
   benutzen, nicht `moveShape`. Der `AddLaneHandler` wurde deshalb umgestellt.
   Ein Aufrufer, der es falsch macht, hinterlässt eine Beschriftung an der alten
   Stelle — sichtbar, aber leicht zu übersehen, und in der DI dauerhaft falsch.

8. **Datenassoziationen sind flach modelliert.** `sourceRef` wird als
   einelementige Liste gesetzt, `targetRef` auf die Aktivität. Eine
   spezifikationstreue Lösung ginge über `ioSpecification` mit `DataInput`/
   `DataOutput`. Für den Bestand (der `ioSpecification` nirgends benutzt) trägt
   die flache Variante; für den Austausch mit Camunda-Werkzeugen ist sie zu prüfen.

9. **Lane-Geometrie: eine Lücke bleibt.** Das Entfernen und die Zugehörigkeit
   sind für geschachtelte Lanes gebaut und geprüft (§6b). **Nicht** gebaut ist
   das Nachziehen der Kind-Lanes, wenn eine Lane _mit_ Kindern durch eine
   Größenänderung wächst: die Geschwisterlane füllt die Lücke, ihre eigenen
   Kind-Lanes bleiben aber auf ihrer alten Höhe. Das ist sichtbar und deshalb
   der harmlosere Rest dieses Postens.

10. **`connection.move` über Containergrenzen** führt `flowElements` nach, aber
    die Wegpunkte werden nicht neu relativiert. BPMN-DI ist absolut, insofern
    korrekt — aber ein Werkzeug, das container-relative Koordinaten erwartet,
    liest das Ergebnis anders. Im Korpus nicht beobachtet.

11. **Kein Schema-Validator.** Die Invarianten prüfen Referenzintegrität, nicht
    Schemakonformität. Ein Attribut mit falschem Typ (`cancelActivity="ja"`)
    fällt hier nicht auf. Der Round-Trip-Prüfstand des Modellstrangs fängt das
    teilweise; ein XSD-Lauf gegen `BPMN20.xsd` wäre die saubere Ergänzung und
    ist nicht gebaut.

### Was der Nachbarstrang jetzt braucht

12. **Eigenschaftsbasierte Tests** über zufällige Operationsfolgen: `invariants.ts`
    ist sauber exportiert, `ModelingSession` ist der Einstieg,
    `test/modeling/helpers/harness.ts:operate()` zeigt das Muster
    (Operation → prüfen → Undo → prüfen → Redo → prüfen). Ein Generator braucht
    von hier nur `session.modeling` und `session.assertInvariants()`.

13. **Shadow-Compare gegen `bpmn-js`** (Plan §5.4) steht — er ist vom
    Verifikationsstrang gebaut und hat im ersten Lauf sechs echte Fehler dieser
    Schicht gefunden (§6a). Offen sind seine **restlichen** Abweichungen: Der
    Bericht des Verifikationsstrangs listet in §3.9 unter anderem 34 Fälle
    `waypoints/bpmn:SequenceFlow/position` und 12 Fälle
    `bounds/bpmn:{SubProcess,Participant}` als `ours-wrong`. Das sind
    Layouter- und Auto-Resize-Unterschiede, keine Referenzfehler — sie machen
    kein Dokument unlesbar, aber sie erzeugen bei jedem Speichern einen Diff
    gegen das, was `bpmn-js` geschrieben hätte. Das ist der nächste Posten,
    wenn Parität das Ziel ist.

14. **Auto-Resize fehlt ganz.** Ein Knoten, der über den Rand seines
    Subprozesses oder Pools hinausgezogen wird, vergrößert ihn nicht. `bpmn-js`
    tut das (`features/auto-resize`), und ein Teil der Geometrieabweichungen
    aus Punkt 13 geht darauf zurück. `diagram-js` bringt keinen fertigen
    Baustein dafür mit.

---

## 8. Abnahme

```
npx tsc --noEmit -p packages/bpmn/tsconfig.json          → fehlerfrei
cd packages/bpmn && npx vitest run --config vitest.config.ts
                                                        → 32 Dateien, 585 Tests grün
cd packages/bpmn && npx vitest run --config vitest.config.ts test/modeling
                                                        → 10 Dateien, 173 Tests grün
```

Der Abnahmetest zur Operationsfolge steht in
`test/modeling/roundtrip.test.ts`: **24 Operationen** auf
`synth-collaboration-pools-lanes.bpmn`, jede einzeln mit Undo _und_ Redo
geprüft, danach Export, Reimport und Vergleich des semantischen Abzugs — Typ,
Name, Container, Endpunkte, Lane-Zugehörigkeit, Anheftung, DI-Geometrie. Der
zweite Durchgang ist zusätzlich byteidentisch (Z-B).

Dazu ein Korpuslauf über **15 echte Dateien** (laden → bearbeiten → exportieren
→ reimportieren → vergleichen → löschen) und ein vollständiger Undo-Rückbau, der
nach _jedem_ Schritt prüft und am Ende den Ausgangszustand semantisch
wiederherstellt.

---

## 9. Einordnung gegen die Hochrechnung des Spikes

|                                                        | Schätzung                 | Ist               |
| ------------------------------------------------------ | ------------------------- | ----------------- |
| Modellstrang: Faktor 5–8 gegenüber dem Spike           | 6.000–9.600 LOC produktiv | **6.314**         |
| Renderstrang: 5.000–7.000 produktiv + 6.000–9.000 Test |                           | **6.314 + 2.660** |

Der Produktivcode liegt im unteren Bereich beider Schätzungen. **Der Testcode
liegt deutlich darunter** — das ist keine Ersparnis, sondern eine Verschiebung:
Der Invariantenprüfer (1.271 LOC) steht auf der Produktivseite und ersetzt
Testcode, den man sonst je Operation hätte schreiben müssen. `operate()` prüft
33 Invarianten nach jeder Operation, nach jedem Undo und nach jedem Redo; ein
Test, der dasselbe von Hand behauptet, wäre um ein Vielfaches länger und würde
weniger finden.

Die Vorhersage des Renderstrangs, der Testcode wiege in dieser Schicht schwerer
als der Produktivcode, hat sich damit **nicht** bestätigt — aber nur, weil die
vom Spike geforderten Prüfwerkzeuge tatsächlich zuerst gebaut wurden. Die
6.000–9.000 LOC Testcode bleiben zu erwarten, sobald der
Eigenschaftstest-Strang und der Shadow-Compare dazukommen; die sind in den 2.660
Zeilen hier nicht enthalten.
