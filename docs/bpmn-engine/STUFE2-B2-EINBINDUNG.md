# Stufe 2 / Arbeitsstrang B2 — Einbindung der eigenen BPMN-Engine in `apps/web`

**Zeitraum:** 2026-09-01/02 · **Branch:** `audit/full-2026-08-31` · **nicht committet**

**Auftrag:** zwei im Spike sichtbar gewordene Renderfehler beheben, eine Zeile im
Prüftreiber nachziehen, und — der Hauptteil — die eigene Engine so in `apps/web`
einbinden, dass **beide Implementierungen im Baum liegen und zur Laufzeit
umschaltbar sind**. Nicht Ablösung, sondern Parallelbetrieb: damit sich der
Umstieg belegen lässt statt behaupten.

**Dateihoheit:** `apps/web/src/components/bpmn/**`, `apps/web/src/lib/feature-flags*`,
`packages/bpmn/src/draw/**`, `packages/bpmn/test/draw/**`,
`packages/bpmn/src/verify/drivers/**`. Zwei Ausnahmen sind in §6 begründet.
`packages/bpmn/src/editor/`, `src/modeling/`, `src/grc/`, `src/model/` blieben
unangetastet (zweiter Arbeitsstrang, läuft parallel).

---

## 1. Aufgabe 1 — die zwei Renderfehler

Beide sind behoben. Beide wurden **durch Rastern und Ansehen** verifiziert, nicht
nur durch Tests — der Spike hatte genau dafür argumentiert, und diese Arbeit hat
das ein drittes Mal bestätigt: der eigentliche Auslöser des zweiten Fehlers war
im SVG-Quelltext unsichtbar und erst im Bild zu erkennen.

**Belege** (`/work/bpmn-plan/belege/`, jeweils SVG + PNG in 3-facher Auflösung):

| Datei                                               | vorher                                       | nachher                                       |
| --------------------------------------------------- | -------------------------------------------- | --------------------------------------------- |
| `repo-seed-goods-receipt`                           | `vorher/repo-seed-goods-receipt.png`         | `nachher/repo-seed-goods-receipt.png`         |
| `synth-collaboration-pools-lanes`                   | `vorher/synth-collaboration-pools-lanes.png` | `nachher/synth-collaboration-pools-lanes.png` |
| Ursprung des Nachrichtenflusses, 10-fach vergrößert | `vorher/crop-origin-vorher.png`              | `nachher/crop-origin-nachher.png`             |
| Ziel des Nachrichtenflusses, 10-fach                | —                                            | `nachher/crop-ziel-nachher.png`               |

### 1.1 Beschriftungsumbruch (`src/draw/text.ts`)

**Befund.** `repo-seed-goods-receipt` zeigte die Aufgabe „Nach Behandlungsklassen
sortieren" als drei Zeilen: `Nach` / `Behandlungskla` / `ssen sortieren`. Die
dritte Zeile ist das eigentliche Problem: sie beginnt mit einem Wortbruchstück,
das der Leser nicht als solches erkennt, und setzt es mit einem vollständigen
Wort in eine Zeile. Wer das Diagramm liest, liest „ssen sortieren" als Wortpaar.

**Messung statt Vermutung.** Die Form ist 100 px breit, die Textbreite also
90 px (`shape.width − 2 × LABEL_PADDING`). „Behandlungsklassen" misst nach der
eigenen Metrik 9,227 em × 12 px = **110,7 px**. Das Wort passt also tatsächlich
nicht in eine Zeile; ein Bruch _im_ Wort ist an dieser Stelle unvermeidlich. Der
Fehler war nicht, dass gebrochen wurde, sondern **wo und wie unmarkiert**.

**Was jetzt gilt** — eine strikte Reihenfolge statt „bevorzugt":

1. **Wortgrenzen.** Ein Wort, das als Ganzes in eine Zeile passt, wird nie
   zerteilt. Das ist der Normalfall und war es auch vorher schon.
2. **Trennstellen im Wort.** Erst wenn ein Wort allein zu breit ist, wird es an
   `-`, `/`, `_`, `.`, `,`, `:`, `;`, `\` und am Übergang Klein→Groß zerlegt.
   `Lieferanten-Stammdaten-Pflege` bricht damit an den Bindestrichen,
   `wareneingangPruefungDurchfuehren` an den camelCase-Grenzen — beides Fälle,
   die in generierten Diagrammen (Excel-Import, KI-Erzeugung) häufig sind.
3. **Harter Bruch.** Nur wenn auch ein Stück ohne Trennstelle zu breit ist. Es
   bekommt dann einen **Trennstrich**, der in die Breitenrechnung eingeht. Aus
   `Behandlungskla / ssen sortieren` wird `Behandlungskla- / ssen sortieren`:
   dieselbe Zeilenzahl, aber die Fortsetzung ist als Fortsetzung lesbar.

**Prüfung gegen die eigene Messfunktion.** `test/draw/text.test.ts` hat einen
neuen Block `Wortgrenzen` mit sechs Fällen. Er prüft ausschließlich gegen
`measureText` — jsdom hat keine Textmetrik (`getComputedTextLength` fehlt,
`getBBox` liefert Nullflächen), eine Prüfung gegen den DOM würde nichts messen,
sondern nur die Nullwerte von jsdom bestätigen. Das steht als Begründung im
Test, damit niemand ihn später „richtigstellt".

Geprüft wird: (a) kein Fragment stammt aus einem Wort, das in eine Zeile gepasst
hätte; (b) jede Zeile bleibt `≤ width`, über fünf Textsorten inkl. einer
40-stelligen Prüfsumme und eines Einzelzeichens; (c) ohne zu breites Wort gibt
es keinen einzigen Trennstrich; (d) der Trennstrich steht nie auf der letzten
Zeile; (e) Trennstellen schlagen den harten Bruch; (f) camelCase.

### 1.2 Kreis am Ursprung des Nachrichtenflusses (`src/draw/markers.ts`)

**Befund und drei Ursachen.** Der Marker `messageflow-start` war vorhanden und
korrekt referenziert — im SVG-Quelltext war nichts zu sehen. Erst das Rasterbild
zeigte, dass an der Quelle nur ein Punkt von etwa einem Pixel stand. Drei
Ursachen, alle drei erst am Bild gefunden:

1. **Halbierte Größe.** Der Marker hat `markerUnits="userSpaceOnUse"`, eine
   `viewBox="0 0 20 20"` und `markerWidth="10"`. Damit wird jede viewBox-Einheit
   auf 0,5 px abgebildet: der Kreis mit `r=3,5` war **3,5 px im Durchmesser**.
   Neben einer 2 px starken Kante ist das nichts.
2. **Halb unter der Quellform.** `refX` lag auf dem Kreismittelpunkt, der
   Anfangspunkt der Kante liegt auf der Kontur der Quellform. Die untere Hälfte
   des Kreises verschwand unter deren 2 px starkem Strich.
3. **Der Kreis war kein Kreis.** `stroke-dasharray` ist eine vererbte
   Eigenschaft. Nach SVG 1.1 erbt Markerinhalt vom `<marker>`-Element, nicht von
   der referenzierenden Kante — mehrere Renderer machen es trotzdem falsch und
   ziehen das Strichmuster des Nachrichtenflusses in den Marker hinein. Aus dem
   Kreis wird dann ein aufgebrochener Bogen. **Nachgemessen:** `cairosvg`
   behandelt `stroke-dasharray="none"` wie „nicht gesetzt" und erbt weiter; erst
   ein numerisches Muster gewinnt. Beleg: `belege/dash.svg` (zwei identische
   Marker, oben an einer gestrichelten, unten an einer durchgezogenen Kante) →
   `belege/dash.png` mit `none` (oberer Kreis aufgebrochen) gegen
   `belege/dash2.png` mit `10000 1` (beide Kreise geschlossen).

**Behoben:**

- `viewBox` wird 1:1 abgebildet (`markerWidth/Height = 20`), der Kreis hat
  **7 px Durchmesser** — die Größe, die die BPMN-Notation dafür vorsieht.
- `refX = cx − r − 1`: der Kreis sitzt tangential **vor** dem Anfangspunkt,
  vollständig außerhalb der Quellform (das `−1` ist die halbe Strichstärke der
  Kontur).
- Jeder Markerinhalt bekommt `stroke-dasharray="10000 1"` — ein Muster, das
  länger ist als jeder Markerumriss und deshalb in jedem Renderer durchgezogen
  wirkt. Das behebt nebenbei einen dritten, nicht beauftragten Fehler: die
  Pfeilspitze der **Assoziation** war in `synth-data-objects-and-artifacts`
  ebenfalls gepunktet statt durchgezogen (im Vergleichsbild der Referenzbilder
  gut zu sehen).
- Die offene Pfeilspitze am Ziel wurde auf dieselbe Größenordnung gebracht
  (8 px statt 5 px) und ist ausdrücklich offen: `fill="none"`, kein `z` im Pfad.

**Prüfung.** `test/draw/shapes.test.ts` hat zwei neue Fälle, die **Geometrie**
prüfen statt bloßer Anwesenheit: Durchmesser ≥ 6 px nach Umrechnung von
viewBox-Einheiten in Benutzerpixel, `refX ≤ cx − r`, Flächenfarbe ≠ Linienfarbe,
`stroke-dasharray` gesetzt; und für das Ziel `fill="none"` ohne `z`.

**Zwei Referenzbilder erneuert.** `test/verify/baseline/synth-collaboration-pools-lanes.png`
und `…/synth-data-objects-and-artifacts.png`. Beide Änderungen wurden vor dem
Erneuern im Bildvergleich angesehen; sie sind die beabsichtigte Wirkung. Das ist
die eine Stelle, an der ich außerhalb meiner Dateihoheit gearbeitet habe — ohne
sie wäre der Rasterlauf rot, und die Bilder sind der Zweck der Korrektur (§6).

---

## 2. Aufgabe 2 — `attachBoundary` kostet ein Kommando

`src/verify/drivers/arctos.ts` legte die Ereignisdefinition in einem zweiten
Kommando an, mit dem Kommentar, die Elementfabrik nehme `eventDefinitionType`
nicht entgegen. Seit der letzten Änderung an `src/modeling` nimmt sie es
entgegen (`ElementFactory.ts:55`, `applyEventDefinition`), und die Fabrik selbst
begründet dort ausführlich, warum das dort hingehört: „Wer es zweistufig baut,
erzeugt zwei Einträge auf dem Kommandostapel — und dann stellt ein Undo pro
Bedienschritt das Dokument nicht mehr her."

**Geändert:** der Typ wird jetzt als `eventDefinitionType` an `createShape`
gereicht; das zweite `modeling.updateProperties(...)` und der lokale
`SemanticFactory`-Vertrag sind entfallen (−16 Zeilen netto).

**Folge, wie erwartet:** die beiden Einträge `roundtrip/undo-leaves-di` und
`roundtrip/undo-does-not-restore-name` in `test/verify/known-findings.ts` sind
gegenstandslos und **entfernt**. Dass sie wirklich weg sind und nicht nur aus
der Liste gestrichen: der Eigenschaftslauf meldet Verstöße, die _nicht_ in der
Liste stehen, als Fehler. Der Standardlauf ist grün — also treten sie nicht mehr
auf.

**Zahlen.**

| Lauf                             | vorher                     | nachher                          |
| -------------------------------- | -------------------------- | -------------------------------- |
| `npx vitest run` (packages/bpmn) | grün                       | grün — **694** Tests, 41 Dateien |
| `PROPERTY_STRICT=1`              | rot, **18 von 200** Folgen | rot, **16 von 200** Folgen       |

`PROPERTY_STRICT=1` war **schon vor dieser Arbeit rot** und ist es geblieben,
mit zwei Folgen weniger. Der Rest ist **kein** Treiberproblem, sondern ein
Defekt in `src/modeling` (fremde Dateihoheit) — mit einer Ein-Operations-Folge
reproduzierbar, siehe §5.

---

## 3. Aufgabe 3 — die Einbindung

### 3.1 Was im Code stand (Bestandsaufnahme nachgeprüft)

Die zehn Dateien unter `apps/web/src/components/bpmn/` bestätigen den Kernbefund
der Bestandsaufnahme: **nur zwei** von ihnen fassen `bpmn-js` überhaupt an.

| Datei                          | LOC | bpmn-js-Berührung                                       |
| ------------------------------ | --: | ------------------------------------------------------- |
| `bpmn-editor.tsx`              | 672 | `Modeler`/`NavigatedViewer`, 5 Dienste, 4 Methoden      |
| `bpmn-viewer.tsx`              | 360 | `NavigatedViewer`, 4 Dienste, 2 Methoden                |
| `bpmn-a11y.tsx`                | 331 | nur strukturelle Annahmen (`canvas`, `elementRegistry`) |
| `arctos-properties-panel.tsx`  | 603 | keine                                                   |
| `arctos-grc-extractor.ts`      | 344 | keine (Regex, `@deprecated`)                            |
| `shape-side-panel.tsx`         | 287 | keine (String-Mapping)                                  |
| `risk-link-search.tsx`         | 216 | keine                                                   |
| `bpmn-toolbar.tsx`             | 181 | keine                                                   |
| `arctos-moddle-extension.json` | 118 | wird als `moddleExtensions` gereicht                    |
| `bpmn-editor.css`              |  55 | CSS-Klassen von diagram-js/bpmn-js                      |

**Von 3.167 Zeilen sind 1.032 engineabhängig — 33 %.** Das ist die Zahl, die
erklärt, warum der Adapter so schmal ausfällt: vier der fünf benutzten Dienste
(`canvas`, `elementRegistry`, `eventBus`, `overlays`) sind unverändert
`diagram-js` und laufen 1:1 weiter. Nur die Klasse darüber ist eine andere.

### 3.2 Was gebaut wurde

Sieben Dateien, davon fünf neu:

| Datei                                              | LOC | Rolle                             |
| -------------------------------------------------- | --: | --------------------------------- |
| `apps/web/src/lib/feature-flags.ts`                | 154 | der Schalter, reine Funktion      |
| `components/bpmn/bpmn-canvas-types.ts`             | 108 | Prop-Oberfläche, engineunabhängig |
| `components/bpmn/arctos-bpmn-canvas.tsx`           | 572 | **der Adapter** — `@grc/bpmn`     |
| `components/bpmn/bpmn-grc-bridge.ts`               | 385 | API-Antworten → `GrcOverlayData`  |
| `components/bpmn/bpmn-editor.tsx`                  | 103 | Weiche (war: 672 Zeilen Editor)   |
| `components/bpmn/bpmn-viewer.tsx`                  |  54 | Weiche (war: 360 Zeilen Viewer)   |
| `components/bpmn/bpmn-editor-legacy.tsx`           | 624 | bisheriger Editor, unverändert    |
| `components/bpmn/bpmn-viewer-legacy.tsx`           | 347 | bisheriger Viewer, unverändert    |
| `__tests__/components/bpmn-engine-switch.test.tsx` | 354 | 16 Tests, beide Stellungen        |

**Neu geschrieben: 1.376 Zeilen** (Adapter, Brücke, Schalter, Typen, Weichen).
**Verschoben, inhaltlich unverändert: 971 Zeilen** (die beiden Legacy-Dateien).
**Test: 354 Zeilen.**

**Keine einzige Aufrufstelle wurde geändert.** `processes/[id]/page.tsx` (2.151
Zeilen) und `my-processes/[id]/page.tsx` (383 Zeilen) sind im `git diff` nicht
enthalten. Sie laden weiterhin
`import("@/components/bpmn/bpmn-editor").then((m) => m.BpmnEditor)` und
`import { BpmnViewer } from "@/components/bpmn/bpmn-viewer"` — Modulpfad,
Exportname und Prop-Oberfläche sind identisch. Das ist die Zusage des Adapters,
und sie ist am Diff nachprüfbar.

### 3.3 Der Schalter

```
ARCTOS_BPMN_ENGINE = legacy | arctos        (Vorgabe: legacy)
```

Vorrangordnung, stark → schwach, alle Quellen als Argument überschreibbar
(`resolveBpmnEngine` ist eine reine Funktion, deshalb ohne Rendern testbar):

1. `engine`-Prop an der Einbindung
2. `?engine=arctos` in der Adresszeile — Plan §5.4, Stufe S1 („nur lesende
   Ansichten, intern")
3. `globalThis.__ARCTOS_BPMN_ENGINE__` — Konsole und Tests, ohne Neuladen
4. `NEXT_PUBLIC_ARCTOS_BPMN_ENGINE` — die Fassung, die Next.js ins Client-Bündel
   einsetzt
5. `ARCTOS_BPMN_ENGINE` — dieselbe Angabe serverseitig
6. Vorgabe `legacy`

Warum **zwei** Variablennamen: die Diagrammfläche ist eine Client-Komponente,
und Next.js setzt nur `NEXT_PUBLIC_`-Namen ins Client-Bündel ein. Ein
`process.env.ARCTOS_BPMN_ENGINE` wäre im Browser still `undefined` — der
Schalter hätte dort nie gewirkt. Beide werden als **wörtliche** Zugriffe
geschrieben, weil Next.js nur solche ersetzt.

**Ein unbekannter Wert wird nicht geraten**, sondern fällt auf `legacy` zurück.
Ein Tippfehler in der Betriebskonfiguration darf nicht dazu führen, dass
unbemerkt die neue Engine ausgeliefert wird. Auch das ist geprüft.

### 3.4 Welche der vier Einbindungsstellen laufen auf der eigenen Engine

| #   | Stelle                                                                        | `mode` | bei `ARCTOS_BPMN_ENGINE=arctos` |
| --- | ----------------------------------------------------------------------------- | ------ | ------------------------------- |
| 1   | `processes/[id]/page.tsx:922` — Übersicht, „BPMN Preview"                     | read   | **`@grc/bpmn`**                 |
| 2   | `processes/[id]/page.tsx:1680` — Dialog „Version ansehen"                     | read   | **`@grc/bpmn`**                 |
| 3   | `my-processes/[id]/page.tsx:289` — Mitarbeitersicht                           | read   | **`@grc/bpmn`**                 |
| 4a  | `processes/[id]/page.tsx:1442` — Editor, `readOnly = !canEdit` **ohne** Recht | read   | **`@grc/bpmn`**                 |
| 4b  | dieselbe Stelle **mit** Bearbeitungsrecht                                     | edit   | `bpmn-js` (Rückfall)            |

**Drei von vier vollständig, die vierte zur Hälfte.** Der Rückfall bei 4b ist
Absicht und im Code als Bedingung sichtbar (`editorEngineFor`), nicht als
Zufall: `BpmnCanvas` verweigert den Modus `edit`, solange `paletteProvider`,
`contextPadProvider` und `labelEditingProvider` fehlen
(`packages/bpmn/src/viewer/modules.ts`, `MISSING_EDIT_MODULES`). Eine Fläche
auszuliefern, die aussieht wie ein Editor, aber keine Palette hat, wäre der
schlechtere Fehler. Der zweite Arbeitsstrang baut diese Module gerade in
`packages/bpmn/src/editor/`; **wenn sie stehen, entfällt genau eine Bedingung**
in `editorEngineFor` und eine Zeile in `SUPPORTED_MODES` — sonst nichts.

Das entspricht Plan §5.4 exakt: Stufe **S2** ist erreicht (alle lesenden
Ansichten auf der eigenen Engine, umschaltbar je Aufruf), S3 (Editor im
Shadow-Compare) noch nicht.

### 3.5 Was der Adapter kann — und was nicht

**Kann:**

- BPMN-XML laden und zeichnen (35 Elementtypen aus `src/draw`)
- alle **fünf** Badge-Kanäle über denselben `overlays`-Dienst mit denselben
  Positionen und denselben `aria-label`-Texten: `risk-badge`, `control-badge`,
  `lod-stripe`, `finding-badge`, `call-activity-badge`
- `element.click` und `element.dblclick` (Drill-Down) wie bisher, **plus**
  `element.activate` — das Tastatur-Gegenstück (Enter auf einem Element), für
  das der Legacy-Pfad keine Entsprechung hat
- Textalternative zum Bild (`BpmnTextAlternative`, WCAG 1.1.1) — dieselbe
  Komponente wie im Legacy-Pfad
- Tastaturnavigation **über den Graphen**: `GraphA11y` der Engine wandert mit
  einem roving tabindex in topologischer Ordnung über die Elemente. Der
  Legacy-Pfad kann das ausdrücklich nicht (`bpmn-a11y.tsx:29-33`: „Nicht-Ziel").
  Das ist der erste Punkt, an dem die eigene Engine **besser** ist, nicht nur
  gleichwertig.
- `saveSvg()` über den statischen Renderer — die Ausgabe enthält die ARIA-Namen
  und keinen Canvas-Zustand (Zoom, Selektionsmarker)

**Kann nicht:**

- **bearbeiten.** Siehe 3.4. `canUndo()/canRedo()` liefern deshalb `false` statt
  `true` vorzutäuschen; die Werkzeugleiste zeigt die Schaltflächen dann
  deaktiviert, was der Wahrheit entspricht.
- **`saveXml()` nach einer Bearbeitung.** Der Adapter gibt den Eingabetext
  zurück. Das ist Plan §5.1, Z-D („read-preserve-write") — und solange nur
  gelesen wird, ist es die stärkste Form von „bit-treu", die es gibt: byteweise
  identisch, garantiert. Sobald bearbeitet werden kann, muss hier
  `exportXml(definitions)` aus `src/model` stehen.
- **PNG-Export.** Der Toolbar-Pfad geht über `saveSvg()` → `<img>` → Canvas
  (`hooks/use-bpmn-editor.ts`, fremde Datei) und funktioniert unverändert; nicht
  eigens geprüft, weil jsdom kein `canvas` hat.
- **`?engine=`-Umschalten ohne Neuladen.** Die Weiche liest den Schalter beim
  Rendern; ein Moduswechsel zur Laufzeit mit Erhalt von Viewbox, Zoom und
  Selektion (Plan §2.4) ist nicht gebaut.
- **die GRC-Dekoration zeichnen.** Die Brücke liefert den Datensatz (3.6), aber
  `decorateGrc` wird noch nicht aufgerufen — der Grund ist ein fehlender
  Exports-Eintrag, siehe §5.

### 3.6 Die GRC-Brücke

`bpmn-grc-bridge.ts` bildet die heutigen API-Antworten auf `GrcOverlayData` ab,
den Vertrag aus `STUFE2-A2-GRC.md` §4.1. Der dort geplante Endpunkt
`GET /api/v1/processes/:id/diagram-overlay` **existiert nicht**, und ihn
anzulegen hieße, eine API-Route zu ändern — verboten. Die Brücke baut denselben
Datensatz aus dem zusammen, was heute schon geliefert wird:

| Vertragsfeld               | heutige Quelle                                  | Zustand                                             |
| -------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| `elements[].risks`         | `GET /processes/:id/risks`                      | vollständig, ohne `controlIds` und ohne Bruttoscore |
| `elements[].controls`      | `GET /processes/:id/control-coverage`           | **nur Zählwerte** — siehe unten                     |
| `elements[].findings`      | `GET /processes/:id/findings` + `process.steps` | Schwere und Status ja, `dueAt` nein                 |
| `elements[].lineOfDefense` | `process.steps[].lineOfDefense`                 | vollständig                                         |
| `elements[].calledProcess` | `GET /processes/:id/call-links`                 | ohne `rollup`                                       |
| alles Übrige               | —                                               | leer, mit Bedarfsvermerk                            |

**Die eine Stelle, an der ich mich entscheiden musste.** `control-coverage`
liefert je Aktivität `controlCount` und `effectiveCount`, nicht die Kontrollen.
`GrcControl` verlangt `id`, `title`, `effectiveness`. Die Brücke **erfindet
keine Titel**: sie erzeugt Platzhalter mit der ID `coverage:<elementId>:<n>`,
leerem Titel und der Wirksamkeit, die aus den beiden Zählwerten tatsächlich
folgt. Damit rechnet die Abdeckungsampel (F1) richtig, und jede Stelle, die die
ID weiterreicht, erkennt an ihrem Präfix, dass sie kein `control.id` ist. Ein
erfundener Titel („Kontrolle 1") wäre in einem Prüfungswerkzeug schlimmer als
eine sichtbare Lücke.

**Der Bedarf ist ein Datum, kein Kommentar.** `MISSING_TODAY` ist eine
auswertbare Liste von zehn Vertragsfeldern mit Begründung — von
`elements[].controls[].title` bis `lanes`/`edges`/`diagram.sodRules`. Ein Test
prüft, dass jedes darin genannte Feld im Ergebnis tatsächlich **fehlt** statt
still mit einem Ersatzwert dazustehen.

Die Funktion ist rein: kein `fetch`, kein `Date.now()`, Bezugszeitpunkt als
Argument. Wenn der Endpunkt aus §3.3.6 gebaut wird, ist `buildGrcOverlayData`
seine serverseitige Implementierung — sie ist bewusst nicht an React gebunden.

### 3.7 Der `arctos:grcMetadata`-Pfad

**Geprüft: der Adapter bedient ihn unverändert.** Er benutzt für Import und
Export dieselbe geteilte moddle-Registry wie der Rest der Anwendung —
`arctosModdle` aus `@/lib/bpmn-arctos-parse`, erzeugt mit derselben
`arctos-moddle-extension.json`, die heute als `moddleExtensions` an den
bpmn-js-Modeler geht. Damit gilt:

- `xml:tagAlias: "lowerCase"` wirkt identisch (es ist eine Eigenschaft von
  `moddle`, nicht von `bpmn-js`) — `<arctos:grcMetadata>` bleibt lesbar;
- fremde `extensionElements` (camunda, zeebe) überleben, weil `moddle` sie in
  `$children` behält;
- die Testabdeckung von `injectGrcMetadataModdle` (ersetzen statt duplizieren)
  bleibt gültig, weil sie auf `bpmn-moddle` arbeitet, nicht auf `bpmn-js`;
- der Adapter schreibt heute ohnehin den Eingabetext zurück (Z-D), kann den
  Pfad also nicht beschädigen.

Der Test in §4 prüft zusätzlich, dass der **Legacy**-Zweig die Erweiterung
weiterhin registriert (`moddleExtensions.arctos` ist im Konstruktorargument).

**Was ein Umbau bräuchte** — der Plan verlangt, aus dem Seiteneffekt eine
ausdrückliche Importaktion zu machen. Heute ruft
`POST /api/v1/processes/:id/versions` bei **jedem** Speichern
`rehydrateFromBpmnXml()` (Zeile 232) in einem `try/catch`, das Fehler nur auf
die Konsole schreibt (Zeile 241). Die Funktion schreibt aus dem XML
Risiko-, Kontroll- und Dokumentverknüpfungen, `line_of_defense`,
ROPA-Profile und `called_process_id` in die Datenbank — die `text`-Spalte
`process_version.bpmn_xml` ist damit eine zweite Wahrheitsquelle, und sie
unterliegt keiner RLS. Ein Umbau bräuchte:

1. **Eine Route**, die den Import auslöst, statt ihn am Speichern zu hängen:
   `POST /api/v1/processes/:id/import-grc-links` mit einem Vorschau-Schritt
   („N Verknüpfungen würden angelegt"), Bestätigung und Protokolleintrag. Der
   Aufruf in `versions/route.ts` entfällt ersatzlos.
2. **Eine Entscheidung über den Vorrang.** Heute ist `rehydrate` „insert-only,
   nie löschend" — das XML kann Verknüpfungen _hinzufügen_, aber keine
   entfernen. Wer im Editor eine Risikoverknüpfung löscht und speichert, hat sie
   danach immer noch. Das ist der eigentliche Defekt, nicht die Spalte.
3. **Die Berechtigungsprüfung.** `rehydrate` läuft heute mit den Rechten des
   Speichernden (`admin`, `process_owner`). Ein XML-Import kann damit
   Verknüpfungen auf Risiken und Kontrollen anlegen, die der Importierende
   selbst nicht sehen darf — die IDs stehen im XML, die Prüfung findet nicht
   statt. Eine ausdrückliche Importaktion muss jede referenzierte ID gegen die
   RLS-Sicht des Nutzers prüfen und nicht auflösbare Verweise **melden** statt
   zu überspringen.
4. **Eine Migration nicht.** Additiv genügt: ein `process_grc_import`-Protokoll
   (wer, wann, welche Version, welche Verknüpfungen) macht den Vorgang
   nachvollziehbar. Die Spalte `bpmn_xml` bleibt, was sie ist — das Diagramm.

Alle vier Punkte liegen in fremden Dateien (`app/api/**`, `lib/bpmn-arctos-*`,
`packages/db/src/schema/**`) und wurden **nicht** angefasst.

---

## 4. Prüfung

| Prüfung                                                | Ergebnis                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `npx tsc --noEmit -p packages/bpmn/tsconfig.json`      | **fehlerfrei**                                                               |
| `npx tsc --noEmit -p apps/web/tsconfig.json`           | **fehlerfrei** (Laufzeit ~9 min)                                             |
| `cd packages/bpmn && npx vitest run`                   | **grün** — 694 Tests, 41 Dateien                                             |
| `cd packages/bpmn && PROPERTY_STRICT=1 npx vitest run` | rot: 16/200 (vorher 18/200), Ursache in `src/modeling` — §5                  |
| `cd apps/web && npx vitest run`                        | 2.425 grün, **1 rot** — `packages/bpmn/src/editor/ReplaceMenu.ts`, fremd, §5 |
| `node scripts/check-env-example.mjs`                   | **rot** — zwei fehlende Einträge in `.env.example`, Text in §6               |

**Der Adapter mit beiden Schalterstellungen:**
`apps/web/src/__tests__/components/bpmn-engine-switch.test.tsx`, 16 Tests.

- vier Tests auf die Schalterauflösung (Vorgabe `legacy`; beide
  Umgebungsvariablen mit richtigem Vorrang; die vollständige Vorrangordnung;
  ein Tippfehler führt nicht zu `arctos`)
- `engine="legacy"`: `bpmn-js` wird instanziiert (gemockt), die
  arctos-Moddle-Erweiterung geht mit, **kein** `data-bpmn-engine="arctos"` im DOM
- `engine="arctos"`: `@grc/bpmn` zeichnet **wirklich** (nicht gemockt) — im DOM
  steht ein `<svg>`, und darin `[data-element-id="Task_1"]` und `="Start_1"`;
  `bpmn-js` wurde **nicht** angefasst
- `engine="arctos"`: die Textalternative enthält „Antrag pruefen"
- die Modusregel des Editors (lesend → `arctos`, bearbeitbar → `legacy`)
- acht Tests auf die GRC-Brücke, inkl. „liefert leer statt geraten"

jsdom hat kein SVG-Layout (`getBBox`, `getCTM`, `createSVGPoint`,
`transform.baseVal` fehlen). Der Test benutzt dafür `installSvgPolyfills` aus
`packages/bpmn/test/draw/helpers/jsdom-svg.ts` — dieselbe Rechenhilfe, die die
Engine für ihre eigenen Tests mitbringt, damit keine zweite, abweichende Fassung
entsteht.

**Dabei gefunden und behoben:** `readModelElements` setzt die bpmn-js-Zusicherung
voraus, dass jedes Element einen `type` trägt. `diagram-js` kennt zusätzlich ein
implizites Wurzelelement ohne Typ; ungefiltert lief die Textalternative in
`undefined.replace(...)`. Der Adapter filtert es jetzt weg. Ein Fehler, den nur
das tatsächliche Rendern gefunden hat — kein Typfehler, keine Warnung.

---

## 5. Was andere Pakete nachziehen müssen

**Fünf Punkte. Vier davon blockieren den nächsten Schritt.**

### 5.1 `packages/bpmn` — `"./grc"` in die Exports (blockiert die GRC-Dekoration)

`packages/bpmn/package.json#exports` führt `.`, `./model`, `./draw`, `./viewer`
— **kein** `./grc`. `STUFE2-A2-GRC.md` §4.3 nennt das bereits als offenen Punkt
und verweist auf den Wurzelimport `import { grc } from "@grc/bpmn"` als
Übergang. Der funktioniert aus `apps/web` **nicht**: der Wurzelindex zieht
`src/model/io.ts` mit, und dort gilt unter dem tsconfig von `apps/web` eine
zweite, schmalere `declare module "bpmn-moddle"`
(`apps/web/src/types/bpmn-moddle.d.ts`), die weder `ModdleWarning` noch die
zweiargumentige `toXML`-Signatur kennt. Ergebnis: zwei Typfehler in einer
fremden Datei, ausgelöst allein durch den Import.

Deshalb importiert `bpmn-grc-bridge.ts` den Vertrag heute über einen relativen
Pfad und **nur als Typ** (`import type`, zur Laufzeit vollständig weg). Das ist
tragfähig für die Abbildung, aber es verhindert, `decorateGrc` und
`buildOverlayModel` aufzurufen — dafür bräuchte es einen Laufzeitimport.

**Zu tun (fremde Dateien):**

1. `"./grc": "./src/grc/index.ts"` in `packages/bpmn/package.json#exports`.
2. Die beiden `declare module "bpmn-moddle"` zusammenführen — entweder
   `apps/web/src/types/bpmn-moddle.d.ts` löschen und die Fassung des Pakets
   maßgeblich machen, oder die App-Fassung um `ModdleWarning` und die
   `toXML(element, options)`-Signatur ergänzen. **Zwei ambiente Deklarationen
   für dasselbe Modul sind auf Dauer ein stiller Fehlerherd**, unabhängig von
   diesem Vorhaben.

Danach ist die GRC-Dekoration ein Aufruf im Adapter:
`decorateGrc({ root, model: buildOverlayModel(canvas.getScene(), data, { view }), onInteract })`.

### 5.2 `apps/web/package.json` — `@grc/bpmn` als Abhängigkeit eintragen

`apps/web` hat **keine** Abhängigkeit auf `@grc/bpmn`. Es funktioniert heute nur,
weil der npm-Workspace `node_modules/@grc/bpmn` auf `packages/bpmn` symlinkt und
die Auflösung deshalb greift. Für `tsc` und `vitest` reicht das; für den
Next.js-Produktionsbau ist es **nicht** verlässlich, weil das Paket
TypeScript-Quelltext ausliefert (`"main": "src/index.ts"`).

**Zu tun:**

1. `"@grc/bpmn": "^0.1.0"` in `apps/web/package.json#dependencies`.
2. `transpilePackages: ["@grc/bpmn"]` in `apps/web/next.config.ts` — sonst
   erreicht der TS-Quelltext des Pakets den Client-Bau nicht.

Ohne beides ist der Schalter im Entwicklungs- und Testbetrieb benutzbar, aber
ein Produktionsbau mit `ARCTOS_BPMN_ENGINE=arctos` ist nicht abgesichert. **Das
ist die wichtigste offene Vorbedingung für den Pilotbetrieb.**

### 5.3 `packages/bpmn/src/modeling` — `move` auf ein BoundaryEvent löst die Anheftung

Der Defekt, der `PROPERTY_STRICT=1` rot hält. **Eine Operation genügt:**

```
runSequence(driver, base, [{"kind":"move","target":{"kind":"flowNode","index":2},"dx":0,"dy":0}])
→ [error] ref/boundary-attached-to @ Boundary_Timer: boundary event has no attachedToRef
→ [error] modeling/BOUNDARY_WITHOUT_HOST @ Boundary_Timer
```

Ein Randereignis um **null Pixel** zu verschieben verliert seinen `attachedToRef`.
16 von 200 erzeugten Folgen laufen hinein; alle 16 haben dieselbe Signatur. Das
ist kein Treiber- und kein Renderproblem: es liegt im Bewegungspfad
(`BpmnUpdater`/`BoundaryEventBehavior`/`MoveElements`). Fremde Dateihoheit,
deshalb nur gemeldet. Es war vor dieser Arbeit schon so (18 von 200); meine
Änderung an `attachBoundary` hat zwei Folgen davon beseitigt.

### 5.4 `packages/bpmn/src/editor/ReplaceMenu.ts` — `innerHTML =` bricht einen Sicherheitstest

`apps/web/src/__tests__/security/frontend-invariants.test.ts` (S12-15 / M3)
prüft baumweit, dass es keine HTML-Injektionssenke gibt. `ReplaceMenu.ts:120`
setzt `node.innerHTML = …`. Das ist die **einzige** rote Zusicherung im
`apps/web`-Lauf, sie stammt aus dem parallel laufenden Editor-Arbeitsstrang und
war vor dieser Arbeit schon rot. Empfehlung: `textContent` plus
`document.createElement`, oder — falls Markup nötig ist — eine
Ausnahmeliste im Test mit ausdrücklicher Begründung.

### 5.5 `packages/shared` — die zweite BPMN-Interpretation

Unverändert und weiterhin ein Divergenzrisiko: `packages/shared` parst BPMN in
1.529 Zeilen mit `fast-xml-parser` und Regex (`bpmn-parser.ts`,
`bpmn-validator.ts`, `bpmn-raci-engine.ts`, …). Sobald `@grc/bpmn` die
maßgebliche Interpretation ist, sollten diese sechs Dateien auf dessen
Modellschicht umgestellt werden — Plan §6.7 („Konvergenz mit `packages/shared`").
Kein Blocker, aber jede Woche Verzug erhöht die Zahl der Stellen, an denen zwei
Antworten auf dieselbe Frage existieren.

---

## 6. Zwei Ausnahmen von der Dateihoheit — und zwei, die ich nicht gemacht habe

**Gemacht (beide angesagt, beide minimal):**

1. `packages/bpmn/test/verify/baseline/{synth-collaboration-pools-lanes,
synth-data-objects-and-artifacts}.png` — Referenzbilder erneuert. Der
   Auftrag war, die Renderfehler zu beheben; die Referenzbilder frieren nach
   Aussage von `STUFE2-A3-VERIFIKATION.md` §2 ausdrücklich **auch die Mängel**
   ein. Beide Änderungen wurden vor dem Erneuern im Bildvergleich angesehen.
2. `apps/web/src/__tests__/security/frontend-invariants.test.ts` — eine
   Erlaubnisliste um `NEXT_PUBLIC_ARCTOS_BPMN_ENGINE` ergänzt. Der Test sagt in
   seinem eigenen Kommentar: „A new NEXT_PUBLIC_ variable fails here until
   someone has looked at it." Ich habe hingesehen und das Ergebnis der Prüfung
   dort hinterlegt: der Wert ist eines von zwei Literalen, kein Geheimnis, keine
   Mandantenkennung, kein Endpunkt — und die Belegung ist am gerenderten DOM
   (`data-bpmn-engine`) ohnehin ablesbar.

**Nicht gemacht — Text und Zeile stattdessen hier:**

### `.env.example` — zwei Zeilen, nach Zeile 317

`node scripts/check-env-example.mjs` läuft blockierend in CI und ist **jetzt
rot**, weil die zwei neuen Variablen dort fehlen. Einzufügen im Block „Build
metadata" **nach Zeile 317** (`# NEXT_PUBLIC_GIT_SHA=abcdef123`), als neuer
Absatz:

```
# BPMN-Engine (Uebergangsbetrieb). "legacy" = bpmn-js (Vorgabe, mit
# bpmn.io-Wasserzeichen), "arctos" = die eigene Engine auf diagram-js.
# Wirkt zur Laufzeit; pro Aufruf mit ?engine=arctos ueberschreibbar.
# Die NEXT_PUBLIC_-Fassung ist die, die im Browser wirkt — die Diagramm-
# flaeche ist eine Client-Komponente.
# ARCTOS_BPMN_ENGINE=legacy
# NEXT_PUBLIC_ARCTOS_BPMN_ENGINE=legacy
```

Auskommentiert genügt (das Skript akzeptiert das für optionale Werte), und
`legacy` ist ohnehin die Vorgabe im Code.

### `docs/env-vars-reference.md` — ein Abschnitt, nach Zeile 233

Einzufügen unmittelbar **nach Zeile 233** (der `NEXT_TELEMETRY_DISABLED`-Zeile
im Abschnitt „Build / Next.js"), als eigener Abschnitt vor „## Inspektion":

```markdown
## Frontend-Schalter

| Variable                         | req/opt | Beschreibung                                                                                                               |
| -------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `ARCTOS_BPMN_ENGINE`             | opt     | `legacy` (Vorgabe) oder `arctos`. Waehlt die BPMN-Engine der Diagrammflaeche. Serverseitige Fassung.                       |
| `NEXT_PUBLIC_ARCTOS_BPMN_ENGINE` | opt     | dieselbe Angabe fuer das Client-Buendel — **diese** wirkt im Browser, weil die Diagrammflaeche eine Client-Komponente ist. |

`legacy` ist `bpmn-js` (Custom-Lizenz, Wasserzeichenpflicht), `arctos` die
eigene Engine auf `diagram-js` + `bpmn-moddle` (beide MIT). Vorrang, stark nach
schwach: `engine`-Prop → `?engine=arctos` in der Adresszeile →
`window.__ARCTOS_BPMN_ENGINE__` → `NEXT_PUBLIC_ARCTOS_BPMN_ENGINE` →
`ARCTOS_BPMN_ENGINE` → `legacy`. Ein unbekannter Wert wird **nicht** geraten,
sondern faellt auf `legacy` zurueck.

Bei `arctos` laufen die drei lesenden Einbindungen und der Editor ohne
Bearbeitungsrecht auf der eigenen Engine; der bearbeitbare Editor faellt
bewusst auf `bpmn-js` zurueck, solange Palette und ContextPad fehlen
(`apps/web/src/components/bpmn/bpmn-editor.tsx`, `editorEngineFor`).
Zurueckschalten wirkt sofort und ohne Deploy (Plan §5.7).
```

---

## 7. Wie weit ist das Wasserzeichen noch entfernt

Die Lizenzklausel fällt erst, wenn `bpmn-js` **entfernt** ist (Plan §5.6, acht
Kriterien gleichzeitig). Stand nach dieser Arbeit, ehrlich:

| Kriterium (§5.6)                                              | Stand                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1 · Round-Trip Z-A/B/C über den Korpus, 10.000 erzeugte Fälle | teilweise — Korpus grün, `PROPERTY_STRICT` 16/200 rot (§5.3)                   |
| 2 · Differenztests gegen `bpmn-js` grün                       | teilweise — Werkzeug steht, offene Befunde in `STUFE2-A3`                      |
| 3 · Shadow-Compare 30 Tage / 500 Speichervorgänge             | **nicht begonnen** — setzt den bearbeitbaren Editor voraus                     |
| 4 · die 21 Editor-Funktionen mindestens auf heutigem Stand    | **nein** — Palette, ContextPad, Label-Editing im Bau                           |
| 5 · axe auf allen vier Einbindungen + NVDA/VoiceOver          | teilweise — Textalternative und Graphnavigation stehen, manuelle Prüfung fehlt |
| 6 · E2E-Suite inkl. Canvas-Interaktion                        | **nein** — es gibt bis heute keinen einzigen E2E-Test, der den Canvas bedient  |
| 7 · Leistungsbudget                                           | **nicht gemessen**                                                             |
| 8 · keine offene Regression „hoch" aus der Pilotphase         | Pilotphase nicht begonnen                                                      |

**Was diese Arbeit bewegt hat:** die Fassade steht, drei von vier Einbindungen
laufen umschaltbar auf der eigenen Engine, der Rückfallweg ist ein Schalter ohne
Deploy. Damit ist Stufe **S2** des Rollouts erreicht — die Stufe, ab der Nutzer
die eigene Engine tatsächlich sehen, ohne dass Daten in Gefahr sind, weil Lesen
nichts beschädigen kann.

**Was noch fehlt, ist die Bearbeitung.** Das Wasserzeichen hängt an genau einem
verbleibenden Block: Palette, ContextPad, Label-Editing und der
Shadow-Compare-Betrieb, der die Modellierung 30 Tage lang gegen `bpmn-js` misst.
Der Editor-Arbeitsstrang baut die ersten drei gerade. Danach ist S3 → S4 → S5
kein Baupfad mehr, sondern eine Wartezeit von mindestens einem vollen
Release-Zyklus (Plan §5.7) — und die ist gewollt.

**Nüchtern gesagt: der Schalter steht, die Hälfte der Einbindung läuft, und die
verbleibende Hälfte ist nicht mehr diese Schicht, sondern die
Modellierungsschicht.**
