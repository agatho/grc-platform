# Stufe 2 / B1 — Editor-Bedienung

**Datum:** 2026-09-02 · **Branch:** `audit/full-2026-08-31` · **Paket:** `packages/bpmn`
**Dateihoheit:** `src/editor/**`, `test/editor/**` (+ **eine** Zeile in `src/index.ts`)

---

## 0. Stand in Zahlen

|                       |                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------: |
| Produktivcode         |                                                         **5.403 LOC** in 22 Dateien (`src/editor/`) |
| Testcode              |                                                        **2.367 LOC** in 10 Dateien (`test/editor/`) |
| Tests dieser Schicht  |                                                                                             **101** |
| Tests im Paket gesamt | **694** grün, 41 Dateien (Ausgangsstand 587; die Zahl bewegt sich, weil parallel weitergebaut wird) |
| `tsc --noEmit`        |                             fehlerfrei mit `strict` + `noUncheckedIndexedAccess` + `noUnusedLocals` |
| `axe-core`            |                                                            **0 Verstöße** in 6 Zuständen (siehe §5) |
| Diagramm ohne Maus    |                                    **6 Knoten, 5 Kanten, beschriftet, exportiert, invariantenfrei** |

Eine Änderung außerhalb der Dateihoheit: `src/index.ts` bekam **eine** Zeile
(`export * as editor from "./editor/index.js";`). Sonst nichts —
`src/modeling/`, `src/draw/`, `src/viewer/` und `apps/web` sind unberührt.

---

## 1. Die tragende Entscheidung: eine Bedienung, zwei Eingabearten

Der Auftrag nennt „ohne Maus muss ein vollständiges Diagramm baubar sein" als
den Anspruch, an dem sich die Arbeit misst. Die naheliegende Umsetzung — die
Mausbedienung bauen und danach Tastaturkürzel danebenlegen — führt zuverlässig
zu zwei Bedienungen, die sich unterschiedlich verhalten: andere Elternwahl,
andere Regelprüfung, andere Meldungen. Genau das ist der Ist-Zustand des
Bestandsmoduls (Audit-Finding S14-10: **kein einziger** Tastatur-Handler in
sechs Dateien).

Deshalb ist die Schicht andersherum gebaut. Es gibt je Handlung **einen**
Dienst, der die Frage „wo landet das, ist das erlaubt, was wird angesagt"
beantwortet, und Maus wie Tastatur rufen denselben Dienst:

```
Palette-Klick ─┐
Kontextmenü ───┼──▶ ElementCreation ──▶ rules.allowed(…) ──▶ modeling.…()
Tastatur ──────┘                          │
                                          └──▶ EditorAnnouncer.announce(…)
```

Dasselbe für Verbinden (`ConnectMode`), Beschriften (`LabelEditing`),
Stützpunkte (`BendpointEditing`), Größe (`ResizeBehavior`), Zwischenablage
(`BpmnCopyPaste`), Ausrichten (`AlignDistribute`) und Löschen
(`ArctosContextPadProvider.remove`, den auch die Tastatur benutzt).

Die Folge ist messbar: Der Abnahmetest baut ein Diagramm ausschließlich über
`KeyboardEvent`s und benutzt dabei **keine einzige** Editor-Methode direkt —
nur `F6`, `↓`, `Eingabe`, `F2`, `Escape`. Er kann das, weil es keinen
Bedienweg gibt, den nur die Maus erreicht.

---

## 2. Was gebaut ist

### Punkt 1 — Palette

`src/editor/catalog.ts` + `PaletteProvider.ts` + `PaletteChrome.ts`.

**Inhalt.** 17 Einträge in sechs Gruppen statt der ~60 der vollen BPMN-Palette
(die heute aktiv ist, weil `bpmn-js` keinen Override bekommt —
Bestandsaufnahme, Editorfunktion 1). Enthalten sind die **acht real
vorkommenden** Typen aus `inventar_bpmn_elementtypen.csv` und genau die
Ergänzungen, die das Zielbild aus Plan §3 braucht; jede mit Begründung in einer
Tabelle im Dateikopf (Datenobjekt/Datenspeicher → §3.9, Textanmerkung → §3.7,
Pool → §3.11, Geschäftsregelaufgabe → §3.5 B5, Zwischen-/Randereignis → §3.10,
paralleles Gateway → §3.8, Gruppe → §3.12). Erweiterbar über
`paletteCatalog({ items, additions, exclude })` und über `config.editor`.

Ein `bpmn:BoundaryEvent` steht bewusst **nicht** in der Palette: Es entsteht nur
am Wirt und ist deshalb eine Handlung des Kontextmenüs.

**Form.** Der Rahmen von `diagram-js` erzeugt `<div class="entry"
draggable="true">` mit `title` — mausbedienbar, tastaturtot. Er sieht
`entry.html` genau für diesen Fall vor; jeder Eintrag ist deshalb ein echter
`<button>` mit `aria-label` aus Name **und** Kurzbeschreibung („Aufgabe" vs.
„Benutzeraufgabe" wäre sonst nicht hörbar zu unterscheiden). Die Palette ist
eine `role="toolbar"` mit benannten `role="group"`-Abschnitten und **einem**
Tabstopp (roving tabindex).

**Anlegen per Klick, nicht nur per Ziehen.** Ein Ziehvorgang ist ohne Zeigegerät
nicht nachbildbar, ein Klick ist es. Ist genau ein Knoten ausgewählt und lässt
sich der neue Typ daran anhängen, entstehen **Knoten und Kante in einem
Bedienschritt** (`autoPlace.append`) — das ist der Grund, warum ein Diagramm
ohne Maus überhaupt zügig entsteht. Sonst wird an eine berechnete freie Stelle
im sichtbaren Bereich platziert (nie unter ein vorhandenes Element: für einen
Tastaturnutzer wäre das „verschwunden").

### Punkt 2 — Kontextmenü am Element

`ContextPadProvider.ts` + `ContextPadChrome.ts` + `ReplaceMenu.ts`.

Angeboten wird an einer Form: verbinden, drei Anhänger (Aufgabe, exklusives
Gateway, Endereignis), Anmerkung anfügen, Randereignis anheften, Typ wechseln,
Beschriftung bearbeiten, Lane einfügen/entfernen, löschen. An einer Kante:
Stützpunkt setzen, Anfang/Ende umhängen, beschriften, löschen. Über einer
Mehrfachauswahl: sechs Ausrichtungen, zwei Verteilungen, kopieren, löschen.

**Die Regeln werden beim Aufbau des Menüs gefragt, nicht beim Auslösen.** Ein
Eintrag, der auf Klick „geht nicht" sagt, kostet einen Bedienschritt und lehrt
den Benutzer, dem Menü nicht zu trauen. Der Test dazu ist entsprechend
formuliert: **jeder angebotene Eintrag wird ausgelöst**, danach laufen die
Invarianten, danach das Undo, danach wieder die Invarianten.

**Der Typwechsel** benutzt `modeling.replaceShape` (`shape.replace` aus
`src/modeling`). Geprüft ist beides, worauf es ARCTOS dabei ankommt: die
**Kennung bleibt** (die Datenbank referenziert Elemente über sie) und
`arctos:grcMetadata` wandert mit — samt Attributwerten und Fremdschlüsseln.
Ereignis und Auslöser wechseln in **einem** Strg-Z.

### Punkt 3 — Direktes Beschriften

`LabelEditing.ts`. Doppelklick und `F2`, `<textarea>` über dem Element,
mehrzeilig, `Escape` verwirft (ohne Kommando auf dem Stapel), `Enter`
übernimmt, `Umschalt+Enter` bricht die Zeile um, `Tab` übernimmt und geht in
Lesereihenfolge zum nächsten beschriftbaren Element weiter. Eine geleerte
Beschriftung verschwindet — das Verhalten, das `src/modeling` bewusst anders
macht als `bpmn-js`. Bei einer Beschriftung (`labelTarget`) wird das _Ziel_
bearbeitet, nicht das Beschriftungs-Shape.

**Warum nicht `diagram-js-direct-editing`** (MIT, im Monorepo vorhanden), obwohl
Plan §2.3 es vorsieht: (a) sein Eingabefeld ist ein `contenteditable`-`div` ohne
Rolle und ohne zugänglichen Namen — bei „Barrierefreiheit ist kein Nachtrag"
der falsche Tausch; (b) `@grc/bpmn` **deklariert das Paket nicht**, es liegt nur
hochgehoben im Wurzel-`node_modules` von `apps/web`, und `package.json` liegt
außerhalb dieser Dateihoheit; (c) es liefert keine Typen, unter `strict` wäre
also ohnehin eine eigene Deklarationsdatei fällig. Der Ersatz sind 240 Zeilen.

### Punkt 4 — Stützpunkte und Kantenbearbeitung

`BendpointEditing.ts` + `ConnectMode.ts`. `features/bendpoints` von
`diagram-js` (Griffe, Ziehen, Segmentverschiebung, Einrasten) wird benutzt;
dazu kommt die **wertbasierte** Entsprechung derselben Handlungen für den
Weg ohne Zeigegerät: setzen (in die längste Strecke), verschieben, entfernen,
und eine Stützpunkt-Betriebsart auf `b` (Pfeile wählen, `Umschalt+Pfeil`
verschiebt, `Entf` entfernt, `Escape` beendet).

Alle Indizes zählen **Stützpunkte, nicht Wegpunkte**; die beiden Andockpunkte
gehören dem Layouter und bleiben unangetastet. Ein Test hält fest, dass sie
sich beim Verschieben nicht mitbewegen.

Das **Umhängen** (`connection.reconnect`) läuft über dieselbe Mechanik wie das
Verbinden: nur Ziele, die die Regeln für _diese_ Kantenart zulassen, werden
angeboten — ein Endereignis taucht als neue Quelle eines Sequenzflusses gar
nicht erst auf.

### Punkt 5 — Größe ändern

`ResizeBehavior.ts`. Die Erlaubnis kommt aus `BpmnRules.canResize`, die Griffe
von `features/resize`. Ergänzt sind die **Mindestmaße**: `diagram-js` nimmt ohne
Angabe 10 × 10 an, und ein Pool mit 10 × 10 zeigt weder Namen noch Lanes und
rechnet anschließend jeden Knoten aus sich heraus. Sie werden auf `resize.start`
gesetzt (der dafür vorgesehene Weg) und gelten damit für Maus **und** Tastatur
(`Strg+Umschalt+Pfeil`).

### Punkt 6 — Kopieren, Einfügen, Duplizieren

`CopyPaste.ts` + `copy/serialize.ts`. `features/copy-paste` trägt Baumbildung,
Reihenfolge und Zwischenablage; ergänzt ist die semantische Hälfte über die zwei
dafür vorgesehenen Ereignisse (`copyPaste.copyElement`,
`copyPaste.pasteElement`).

Drei Entscheidungen, jede mit einem Test:

- **Abschrift statt geteilter Objekte.** Beim Kopieren entsteht eine
  Zwischenform aus einfachen Werten, beim Einfügen daraus neue moddle-Objekte.
  Geteilte Teilbäume hingen am `$parent` des Originals — derselbe Fehler, den
  `ReplaceShapeHandler` schon einmal hatte (STUFE2-A1 §6b).
- **Verweise nicht, Enthaltenes schon.** Unterschieden wird über
  `$descriptor.isReference`, nicht geraten. Ein kopiertes `sourceRef` wäre ein
  Zeiger in ein fremdes Diagramm.
- **Die `id` nur auf oberster Ebene neu.** `arctos:riskRef/@id` ist ein
  Fremdschlüssel in die ARCTOS-Datenbank, keine Diagrammkennung — würde er wie
  die Element-`id` verworfen, verlöre die Kopie genau die Verknüpfung,
  deretwegen sie GRC-Daten mitnimmt. Siehe dazu den Befund in §6.

Nicht registrierte Fremd-Erweiterungen (Camunda, Signavio) überleben ebenfalls:
Sie liegen als generische Objekte mit `$children`/`$body` vor und werden über
`moddle.createAny` wieder aufgebaut (Plan §5.3).

### Punkt 7 — Tastaturbedienung

`Keyboard.ts`. Der Zuhörer hängt an `canvas.getContainer()`, der Betrachter
(`src/viewer/a11y.ts`) am **äußeren** Container. Weil Ereignisse von innen nach
außen steigen, ergibt sich die Schichtung von selbst:

> bearbeitende Tasten werden innen verarbeitet und gestoppt;
> navigierende Tasten laufen unberührt zum Betrachter weiter.

Damit bleibt die Navigationsbelegung des Betrachters **unverändert** (Plan §4.2,
Vorgabe 4): blanke Pfeiltasten navigieren weiter, mit `Umschalt` verschieben
sie. Ein Test hält genau das fest.

| Taste                                   | Wirkung                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `F6` / `Umschalt+F6`                    | Bereich wechseln (Zeichenfläche ↔ Palette) — greift **auch aus der Palette heraus** |
| `F2`                                    | Beschriftung des fokussierten Elements                                              |
| `Entf` / `Rück`                         | Auswahl löschen                                                                     |
| `Umschalt+Pfeil`                        | im Raster verschieben · `+Alt` fein                                                 |
| `Strg+Umschalt+Pfeil`                   | Größe ändern                                                                        |
| `c`                                     | Verbinden: Ziele durchblättern, `Enter` verbindet                                   |
| `r` / `Umschalt+R`                      | Typ wechseln (Form) · Kantenanfang/-ende umhängen (Kante)                           |
| `b`                                     | Stützpunkt-Betriebsart                                                              |
| `g`                                     | Einrasten am Raster                                                                 |
| `Umschalt+F10`, `Kontextmenü`           | Kontextmenü öffnen und ersten Eintrag fokussieren                                   |
| `Strg+Z` / `Strg+Y` / `Strg+Umschalt+Z` | rückgängig / wiederholen                                                            |
| `Strg+C` `X` `V` `D`                    | kopieren / ausschneiden / einfügen / duplizieren                                    |
| `Strg+A`                                | alles auswählen · `Strg+Leertaste` Auswahl erweitern                                |
| `Escape`                                | Betriebsart oder Menü abbrechen                                                     |

**Fokus vor Auswahl.** Bezugselement einer Handlung ist das fokussierte
(`document.activeElement` → `[data-element-id]`), erst danach das ausgewählte —
„Selektion ≠ Fokus" aus Plan §4.2, konsequent zu Ende gedacht: Wer mit den
Pfeiltasten auf ein Element gewandert ist und `F2` drückt, meint dieses.

### Punkt 8 — Ausrichten, Verteilen, Raster, Einrasten

`AlignDistribute.ts`. `align-elements`, `distribute-elements`, `snapping` und
`grid-snapping` werden verdrahtet, nicht nachgebaut — ergänzt sind eine
Bedienfläche mit Ansage (die Dienste von `diagram-js` melden nichts) und die
drei fehlenden Regeln aus §6.

### Der Modus-Schalter und die zweite Achse

`modules.ts` **baut auf `src/viewer/modules.ts` auf** und ersetzt es nicht:
`editorModulesFor({ mode, chrome })` ruft `modulesFor(mode)` und legt nur
darauf. Es gibt weiterhin ein Bauteil und eine Wahrheit über den Modus.

`EditorConfiguration.editable` **liest die Modulliste ab** (`injector.get(
"modeling", false) !== null`), statt eine zweite Behauptung aufzustellen. Zwei
Wahrheiten über denselben Zustand sind der kürzeste Weg zu einer Palette, die
Knöpfe anbietet, die nichts tun.

|                   | `chrome="full"`                                   | `chrome="minimal"` |
| ----------------- | ------------------------------------------------- | ------------------ |
| `edit`            | alles aktiv                                       | dito               |
| `read` / `review` | Palette **sichtbar, deaktiviert, mit Begründung** | keine Palette      |

Der Fall unten links ist der, für den die Achse existiert (`processes/[id]`:
`readOnly = !canEdit`). Deaktiviert heißt `aria-disabled`, **nicht** `disabled`:
ein `disabled`-Knopf fällt aus Fokus und Ansage, und dann erfährt ein
Tastaturnutzer nie, dass es die Funktion gibt und warum sie gerade nicht geht.
Der Lesemodus registriert dabei **nur** Palette und Ansage — kein `modeling`,
kein Kontextmenü, keine Tastaturbefehle.

---

## 3. Was von `diagram-js` kommt und nicht nachgebaut wurde

`palette`, `context-pad`, `create`, `connect`, `auto-place`, `copy-paste`,
`clipboard`, `align-elements`, `distribute-elements`, `grid-snapping`,
`bendpoints`, `move`, `resize`, `snapping` — vollständig, wie Plan §2.2 es
vorsieht. Was hier entsteht, sind die BPMN-Inhalte, die Zugänglichkeit und der
Weg ohne Zeigegerät.

**Eine bewusste Ausnahme: `features/popup-menu`.** Der Rahmen ist vorhanden,
rendert aber über die mitgelieferte Preact-Schicht. Damit hinge die
Zugänglichkeit des Typwechsel-Menüs — Rolle, Fokusfalle, Rückweg des Fokus — an
fremdem Markup, das diese Schicht weder prüfen noch ändern kann; `preact` ist
zudem keine deklarierte Abhängigkeit von `@grc/bpmn`. `ReplaceMenu.ts` sind 200
Zeilen DOM mit `role="menu"`, roving tabindex und Fokusrückgabe.

**Kein Quelltext aus `bpmn-js`.** Verhalten nachgebaut, Code nicht übernommen.

---

## 4. Was der Bau gefunden hat

Vier Dinge, die ohne den jeweiligen Test still gescheitert wären.

1. **Regelabfragen mit einem Objekt ohne Typhierarchie liefern immer „nein".**
   `BpmnRules` fragt über `is(bo, "bpmn:FlowNode")`, also über `$instanceOf`.
   Ein `{ $type: "bpmn:Task" }` fällt auf den Namensvergleich zurück und ist
   damit **kein** `bpmn:FlowNode`. Eine Palette, die so prüft, bietet gar nichts
   an — und der Fehler sieht aus wie eine zu strenge Regel. `probe.ts` erzeugt
   deshalb echte moddle-Objekte, ohne den dokumentweiten ID-Zähler zu
   verbrauchen (`moddle.create` statt `BpmnFactory.create`; eine verbrannte ID
   machte zwei gleiche Bedienfolgen unterscheidbar, Z-B).

2. **Regelabfragen ohne Container liefern ebenfalls „nein".**
   `canConnectSequenceFlow` verlangt „derselbe Container"; ein noch nicht
   eingehängtes Shape hat gar keinen. Gefragt wird deshalb mit dem **künftigen**
   Container. Nebenbefund: Ein `diagram-js`-Modellelement lässt sich nicht mit
   Spread kopieren — `businessObject`, `parent` und die Kantenlisten sind nicht
   aufzählbare Zugriffseigenschaften und gingen stillschweigend verloren.

3. **„Keine Regel" heißt in `diagram-js` „verboten", nicht „erlaubt".**
   `Rules.allowed` bildet zwar `undefined` auf `true` ab, fragt aber
   `CommandStack.canExecute`, und das liefert für ein Kommando **ohne Handler**
   hart `false`. Folge: ohne eigenen Provider bleibt die Zwischenablage leer und
   „ausrichten" tut nichts — ohne Fehlermeldung. Siehe §6, Befund 1.

4. **Der Kommandostapel zählt Kommandos, der Benutzer zählt Strg-Z.** Ein
   Anhängen kostet drei Kommandos (`shape.append`, `shape.create`,
   `connection.create`), die `undo()` gemeinsam zurücknimmt. Der Prüfstand
   (`test/editor/helpers/editor.ts`) zählt deshalb in Rückschritten, nicht in
   Kommandos, und `act(…, { undoSteps: 1 })` ist die Zusicherung „ein
   Bedienschritt, ein Strg-Z" — die Eigenschaft, die die Modellierungsschicht
   in §6a ihres Protokolls als Kontrollbedingung benutzt hat.

---

## 5. Abnahme

```
npx tsc --noEmit -p packages/bpmn/tsconfig.json         → fehlerfrei
cd packages/bpmn && npx vitest run --config vitest.config.ts
                                                        → 41 Dateien, 694 Tests grün
cd packages/bpmn && npx vitest run --config vitest.config.ts test/editor
                                                        → 10 Dateien, 101 Tests grün
```

**Diagramm ausschließlich über die Tastatur** (`test/editor/keyboard.test.ts`,
„Ein Diagramm ohne Maus"): aus einem leeren Prozess entstehen über `F6`, `↓`,
`Eingabe`, `F2` und `Escape` sechs Knoten (Startereignis, Benutzeraufgabe,
exklusives Gateway, Serviceaufgabe, Geschäftsregelaufgabe, Endereignis) und
fünf Sequenzflüsse, alle beschriftet. Danach `exportXml()`, **Reimport** und
`checkInvariants()` über dem reimportierten Dokument: null Verletzungen. Nicht
der Editor-Zustand wird geprüft, sondern die Datei. Ein zweiter Test nimmt den
Aufbau Schritt für Schritt zurück und weist nach: drei Bedienschritte, drei
Strg-Z, nach jedem Rückschritt invariantenfrei.

**axe-core, je 0 Verstöße** (`test/editor/a11y.test.ts`):

| Zustand                                          | Verstöße |
| ------------------------------------------------ | -------: |
| Editor mit sichtbarer Palette                    |        0 |
| Editor mit offenem Kontextmenü                   |        0 |
| Editor mit offenem Typwechsel-Menü               |        0 |
| Editor mit laufender Beschriftung                |        0 |
| Kontextmenü über Mehrfachauswahl                 |        0 |
| Lesemodus `chrome="full"` (deaktivierte Palette) |        0 |

Dazu, was `axe` nicht sehen kann: jeder Paletten- und Kontextmenü-Eintrag hat
Rolle, zugänglichen Namen und Tabulator-Index; es gibt je Bereich **einen**
Tabstopp; jede Handlung meldet an die Live-Region des Betrachters; eine zweite
Live-Region wird nicht angelegt, wenn der Betrachter schon eine hat.

**Invarianten nach jeder Bedienhandlung und nach Undo.** `act()` aus
`test/editor/helpers/editor.ts` prüft nach der Handlung, nach **jedem** Undo und
nach jedem Redo. Abgedeckt: Anlegen (frei und angehängt), Anheften eines
Randereignisses, Anmerkung anfügen, alle Kontextmenü-Einträge einzeln, Löschen
(Form und Kante), Beschriften (setzen, leeren, mehrzeilig), Typwechsel (mit und
ohne Ereignisdefinition), Stützpunkt setzen/verschieben/entfernen, Kante
umhängen, Größe ändern, Kopieren/Einfügen/Duplizieren/Ausschneiden, Verschieben
im Raster, Ausrichten, Verteilen.

---

## 6. Befunde für `src/modeling` — notiert, nicht dupliziert

Der Auftrag verlangt: „Wenn du eine Regel brauchst, die es nicht gibt, notiere
sie statt sie hier zu duplizieren." Drei Posten.

**1. Drei fehlende Regeln — und sie sind nicht bloß unvollständig, sie sperren.**
`elements.align`, `elements.distribute` und `element.copy` sind in
`BpmnRules` nicht formuliert. Weil `CommandStack.canExecute` für ein Kommando
ohne Handler `false` liefert, sind Ausrichten, Verteilen und **die gesamte
Zwischenablage** damit stumm wirkungslos. `EditorRules` (in
`AlignDistribute.ts`) formuliert sie vorläufig, bewusst **rein strukturell**
(keine Kanten, keine Beschriftungen, keine Rahmen — ein ausgerichteter Pool
verschöbe die Lane-Zuordnung aller Knoten darin). Fachlich gehören sie zu
`BpmnRules`.

**2. Mindestmaße gehören in die Regeln.** `canResize` beantwortet heute nur
„ja/nein". Die Konvention von `diagram-js` sieht `{ minDimensions }` als Antwort
vor. Bis dahin stehen die Maße in `ResizeBehavior.minDimensionsFor`, abgeleitet
aus `DEFAULT_SIZES` **derselben** Schicht, damit es beim Zusammenführen keine
zweite Wahrheit gibt.

**3. `DUPLICATE_ID` zählt Fremdschlüssel in Erweiterungen mit.** Der
Invariantenprüfer wertet jedes `id`-Attribut im Dokument als Diagrammkennung,
auch `arctos:riskRef/@id`. Das ist dort aber ein Fremdschlüssel in die
ARCTOS-Datenbank: **Zwei Aufgaben, die dasselbe Risiko tragen, sind der
Normalfall** — im Editor genauso wie in jeder von Hand gepflegten Datei. Beim
Kopieren einer Aufgabe mit GRC-Daten schlägt die Prüfung deshalb an, obwohl an
der Kopie nichts falsch ist.

_Vorschlag:_ `DUPLICATE_ID` auf BPMN- und DI-Kennungen einschränken
(`bpmn:`/`bpmndi:`-Typen), Erweiterungs-Namensräume ausnehmen.
`test/editor/resize-copy.test.ts` hält den Befund einzeln fest und schlägt
fehl, sobald er behoben ist — die Ausnahme im Nachbartest ist dann zu
entfernen.

**Weiterhin offen aus STUFE2-A1 §7, mit Auswirkung hier:**

- **Ereignis → Randereignis beim Anheften** ist nicht gebaut. Die Bedienschicht
  hält sich daran und heftet **nur typrichtige** `bpmn:BoundaryEvent` an; ein
  Zwischen-Ereignis wird mit Begründung abgelehnt (Test).
- **Eingeklappte Subprozesse behalten selektierbare Kinder.** Die Auswahl
  respektiert das heute nicht — siehe §7.
- **Auto-Resize fehlt.** Ein Element, das über den Rand seines Subprozesses
  hinaus angelegt wird, vergrößert ihn nicht.

---

## 7. Was ein Nutzer heute noch nicht kann

Ehrlich und vollständig, weil die Folgearbeiten daran hängen.

1. **Elemente mit der Maus frei verschieben und ziehen ist ungeprüft.**
   `features/move`, `create` und `bendpoints` sind verdrahtet und laufen im
   Browser; in jsdom lässt sich ein Ziehvorgang nicht nachbilden
   (`dragging` braucht echte Zeigerereignisse und Layout). Die _Wirkung_ jeder
   Ziehhandlung ist über den wertbasierten Zwilling geprüft, der Zug selbst
   nicht. **Risiko: mittel**, Nachweis gehört in Stufe 5 (E2E).
2. **Drill-down in Subprozesse** — der Importer zeichnet die erste Ebene; ein
   eingeklappter Subprozess mit eigener `BPMNDiagram` lässt sich nicht öffnen
   (A1 §7.2). Der Editor hat dafür folglich auch keine Bedienung.
3. **Eingeklappte Subprozesse haben selektierbare Kinder.** `diagram-js` setzt
   sie beim Kollabieren nur auf `hidden`. `Strg+A` wählt sie mit aus, und die
   Ansage zählt sie mit. Zu klären, sobald A1 §7.5 entschieden ist.
4. **Ein Element in einen Subprozess oder eine Lane _hineinlegen_ geht nur mit
   der Maus.** Die Tastatur legt frei oder angehängt an und verschiebt im
   Raster; einen Containerwechsel gibt es über die Tastatur nicht. Für ein
   Diagramm mit Pools ist das die spürbarste Lücke. (`moveElements` mit `target`
   kann es — es fehlt die Bedienung, etwa „in Container einfügen" im
   Kontextmenü.)
5. **Kein Auto-Resize.** Wer eine Aufgabe an den Rand eines Subprozesses
   anhängt, bekommt sie außerhalb — `bpmn-js` vergrößert den Container.
6. **Keine Suche im Diagramm** (`features/search` ist vorhanden, aber nicht
   verdrahtet) und **keine Tastaturhilfe** (`?`), obwohl Plan §4.2 beide nennt.
   Beides billig, beides nicht gebaut.
7. **Kein Space-Tool, kein Lasso-Tool, kein Hand-Tool.** Die Module gibt es;
   sie brauchen Palette-Einträge und ein Werkzeug-Zustandsmodell.
8. **Kein Undo-Gruppieren über Bedienschritte hinweg** — jeder Schritt ist ein
   Strg-Z. Das ist gewollt; wer zehn Elemente anlegt, drückt zehnmal.
9. **Beschriftung von `bpmn:Group` schreibt `name`** statt eine
   `bpmn:CategoryValue` anzulegen. Der Posten steht in A1 §7.3 und liegt in der
   Modellierungsschicht; die Bedienung würde ihn automatisch erben.
10. **Der Kontrast der Bedienelemente ist ungeprüft.** `axe` schaltet
    `color-contrast` in jsdom selbst ab. Palette, Kontextmenü und
    Typwechsel-Menü bringen zudem **kein Stylesheet** mit — die Klassennamen
    sind gesetzt (`djs-palette-entry`, `arctos-bpmn-replace-menu`,
    `arctos-bpmn-label-input`), das Aussehen liefert `apps/web`. Plan §4.4
    (Fokusindikator ≥ 3:1, doppelter Ring) ist damit **noch nicht erfüllt**;
    das ist der wichtigste offene a11y-Posten und gehört in Stufe 6.
11. **Keine Mehrfachauswahl per Tastatur über einen Bereich.**
    `Strg+Leertaste` nimmt das fokussierte Element hinzu, `Strg+A` alles —
    „alles in dieser Lane" gibt es nicht.
12. **Der Moduswechsel zur Laufzeit** (Plan §2.4: Viewbox, Zoom, Selektion,
    Layer erhalten) ist **nicht** gebaut. `editorModulesFor` liefert die
    Modullisten; das kontrollierte Neuaufsetzen gehört in die React-Fassade
    (`apps/web`, anderer Arbeitsstrang) und braucht von hier nur diese Funktion.

---

## 8. Übergabe

**Für die React-Fassade** (`apps/web/src/components/bpmn/`):

```ts
import { editor } from "@grc/bpmn";

// Modulliste für <BpmnCanvas mode chrome>
const modules = editor.editorModulesFor({ mode: "edit", chrome: "full" });

// oder direkt eine bearbeitbare Sitzung
const session = await editor.createEditorSession(xml, {
  container,
  editor: { chrome: "full", gridStep: 20, hidePaletteItems: ["create.group"] },
});
```

Die Konfiguration wird als Dienst `config.editor` gereicht (wörtlich mit Punkt —
`didi` löst einen Namen mit Punkt nur dann über das Optionsobjekt auf, wenn es
keinen Anbieter dieses Namens gibt). Das erspart es, die Optionen von
`ModelingSession` aufzubohren.

**Was `apps/web` mitbringen muss:** ein Stylesheet für `.djs-palette`,
`.djs-context-pad`, `.arctos-bpmn-replace-menu` und `.arctos-bpmn-label-input`
— einschließlich des Fokusindikators aus Plan §4.4, Regel 6. Ohne es ist die
Bedienung vollständig und unansehnlich.

**Für den Verifikationsstrang:** `editorModule` lässt sich in jeden
`diagram-js`-Aufbau hängen; die Bedienhandlungen sind einzeln als Dienste
erreichbar (`elementCreation`, `connectMode`, `bendpointEditing`,
`bpmnCopyPaste`, `replaceMenu`, `labelEditing`, `alignDistribute`,
`editorKeyboard`) und damit als Vokabular für Eigenschaftstests geeignet — die
21 Editorfunktionen aus A3 §4, Punkt 6, sind von hier aus erreichbar.
