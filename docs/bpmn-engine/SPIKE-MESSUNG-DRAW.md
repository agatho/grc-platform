# Spike-Messung — Render- und Viewer-Schicht

**Gegenstand:** Kann eine Eigenimplementierung auf `diagram-js` (MIT) den heutigen
`bpmn-js`-Einsatz ersetzen? Dieses Protokoll misst den Teil **Zeichnen +
Betrachter + Barrierefreiheit**. Die Modell-/Round-Trip-Schicht misst der zweite
Arbeitsstrang separat.

- **Repo:** `/work/repo`, Branch `audit/full-2026-08-31`, Paket `packages/bpmn`
- **Erhebungsdatum:** 2026-09-01
- **Grundlage:** `BESTANDSAUFNAHME.md` (Ist-Zustand), `ARCTOS_BPMN_ENGINE_PLAN.md` §2 und §4
- **Nicht committet**, wie vorgegeben.

Alle Zahlen sind nachgezählt (`wc -l`, Testlauf-Ausgabe). Wo geschätzt wird, steht
„geschätzt" dabei.

---

## 1. Was gebaut wurde

### 1.1 Zeichenschicht `packages/bpmn/src/draw/`

| Datei               |       LOC | Inhalt                                                                                                      |
| ------------------- | --------: | ----------------------------------------------------------------------------------------------------------- |
| `BpmnRenderer.ts`   |       933 | `BaseRenderer`-Ableitung; 13 Zeichenroutinen; als diagram-js-Modul registriert                              |
| `icons.ts`          |       661 | Alle Symbole als SVG-Pfade: 12 Ereignisdefinitionen, 7 Aufgabentypen, 6 Aktivitätsmarker, 5 Gateway-Symbole |
| `semantic.ts`       |       391 | Typabfragen auf dem moddle-Baum, Marker-Ableitung, deutsche Typnamen                                        |
| `text.ts`           |       345 | Textlayout ohne DOM-Messung (Breitenschätzung, Umbruch, Kürzung)                                            |
| `scene.ts`          |       336 | BPMN-DI → flache Szene (Shapes, Kanten, externe Beschriftungen, Zeichenreihenfolge)                         |
| `markers.ts`        |       230 | Sechs `<marker>`-Definitionen (Pfeilspitzen, Raute, Schrägstrich, Kreis) je SVG-Dokument                    |
| `StaticRenderer.ts` |       203 | Dieselbe Zeichenlogik ohne Canvas → eigenständige `.svg`-Datei                                              |
| `svg.ts`            |       180 | SVG-DOM-Hilfen, Pfadbau, harte Zahlprüfung (NaN wirft)                                                      |
| `theme.ts`          |        96 | Strichstärken, Größen, Farbpaletten (normal + `prefers-contrast: more`)                                     |
| `types.ts`          |        77 | Strukturelle Typen (keine Abhängigkeit zur Modellschicht)                                                   |
| `index.ts`          |        49 | diagram-js-Moduldeklaration + öffentliche Fläche                                                            |
| **Summe `draw/`**   | **3.501** |                                                                                                             |

### 1.2 Betrachter `packages/bpmn/src/viewer/`

| Datei                |       LOC | Inhalt                                                                                                            |
| -------------------- | --------: | ----------------------------------------------------------------------------------------------------------------- |
| `BpmnCanvas.ts`      |       346 | **Ein** Einstiegspunkt mit Modus-Schalter, Import, Zoom/Pan, Auto-Fit, Selektion, Overlays, SVG-Export, Aufräumen |
| `a11y.ts`            |       344 | Roving-Tabindex, Graphnavigation, Live-Region, zentrale ARIA-Namen                                                |
| `TextAlternative.ts` |       202 | Prozesstabelle (DOM) + Fließtextform des Ablaufs                                                                  |
| `order.ts`           |       161 | Topologische Reihenfolge, Lane-Zuordnung                                                                          |
| `modules.ts`         |        86 | Modullisten je Modus; Liste der bewusst fehlenden Editor-Module                                                   |
| `index.ts`           |        26 | öffentliche Fläche                                                                                                |
| **Summe `viewer/`**  | **1.165** |                                                                                                                   |

`src/index.ts` (66 LOC) fasst beides zusammen.

**Produktivcode gesamt: 4.732 LOC.**

### 1.3 Tests `packages/bpmn/test/draw/`

| Datei                  |       LOC | Inhalt                                                         |
| ---------------------- | --------: | -------------------------------------------------------------- |
| `shapes.test.ts`       |       662 | ein Test je Elementtyp: Form, Symbol, Marker, Randstärke       |
| `helpers/jsdom-svg.ts` |       465 | SVG-Geometrie-Polyfills für jsdom (siehe §4)                   |
| `a11y.test.ts`         |       281 | Fokusmodell, Tastatur, Live-Region, Textalternative, axe-core  |
| `corpus.test.ts`       |       232 | Rendering-Durchlauf über den Korpus + Erzeugung der SVG-Belege |
| `viewer.test.ts`       |       191 | Bootstrap, Import, Dienste, Overlays, Zoom, Aufräumen          |
| `helpers/render.ts`    |       149 | Zeichenhilfen ohne Canvas                                      |
| `text.test.ts`         |        54 | Textlayout                                                     |
| **Summe**              | **2.034** |                                                                |

**Verhältnis Test zu Produktiv: 0,43 : 1.** Das liegt unter der Planannahme
(§2.3: „etwa das Gleiche an Testcode"), weil ein Formtest sehr dicht ist: eine
Zusicherung je Merkmal, kein Aufbauaufwand. Für die Modellschicht wird das
Verhältnis deutlich höher liegen (Round-Trip- und Eigenschaftstests).

---

## 2. Ergebnis

### 2.1 Testlauf

```
npx tsc --noEmit -p packages/bpmn/tsconfig.json     → fehlerfrei (strenge Flags,
                                                       inkl. noUncheckedIndexedAccess)
cd packages/bpmn && npx vitest run --config vitest.config.ts
  → 8 Testdateien, 223 Tests, alle grün
  → davon aus diesem Arbeitsstrang: 5 Dateien, 118 Tests
```

**Anmerkung zum Testaufruf:** Vom Repo-Wurzelverzeichnis aus findet
`npx vitest run --config packages/bpmn/vitest.config.ts` keine Tests, weil
`include: ["test/**/*.test.ts"]` paketrelativ gemeint ist, vitest den Pfad aber
gegen das Arbeitsverzeichnis auflöst. Das ist **keine Eigenheit dieses Pakets** —
`packages/shared`, `packages/db` und alle übrigen Konfigurationen im Repo sind
genauso gebaut, und `turbo run test` ruft sie im jeweiligen Paketverzeichnis auf.
`packages/bpmn/vitest.config.ts` liegt außerhalb der Dateihoheit dieses
Arbeitsstrangs und wurde deshalb nicht geändert; ein `root: __dirname` in der
Konfiguration würde beide Aufrufwege gleichziehen.

### 2.2 Unterstützte Elementtypen — 35

**Knoten (30):**
Start-, End-, Intermediate-Catch-, Intermediate-Throw-, Boundary-Event ·
Task, UserTask, ServiceTask, SendTask, ReceiveTask, ManualTask,
BusinessRuleTask, ScriptTask · CallActivity, SubProcess, AdHocSubProcess,
Transaction · Exclusive-, Parallel-, Inclusive-, EventBased-, ComplexGateway ·
DataObjectReference, DataStoreReference, DataInput, DataOutput ·
Participant (Pool, auch „black box"), Lane · TextAnnotation, Group

**Kanten (5):** SequenceFlow (normal / bedingt / Standard), MessageFlow,
Association (gerichtet und ungerichtet), DataInputAssociation,
DataOutputAssociation

**Dazu:** der Pseudotyp `label` für externe Beschriftungen — bewusst beibehalten,
weil der ARCTOS-Anwendungscode bereits darauf filtert (Bestandsaufnahme 4.4/4).

**Notationsmerkmale, die tatsächlich umgesetzt sind:** dünner/dicker/doppelter/
gestrichelter Rand · gefangene vs. geworfene Ereignissymbole (ungefüllt vs.
gefüllt) · 12 Ereignisdefinitionen als eigene Pfade · Aktivitätsmarker
(zugeklappt, Schleife, parallele und sequenzielle Mehrfachinstanz, Kompensation,
ad hoc) nebeneinander statt übereinander · Gateway-Symbole · Pfeilspitzen je
Kantenart, Raute für bedingte und Schrägstrich für Standardflüsse · Pool-/Lane-
Kopfleisten mit gedrehter Beschriftung, waagerecht und senkrecht · Datenobjekt
mit Eselsohr und Sammlungsmarker · Zylinder für Datenspeicher · Textumbruch mit
Kürzung.

### 2.3 Lücken — was der Renderer _nicht_ zeichnet

Nicht unterstützte Typen werden **sichtbar** als gestricheltes Rechteck mit
Typnamen und `data-unsupported="true"` gezeichnet, nicht stumm weggelassen. Der
Korpustest prüft, dass im gesamten Korpus **kein einziges** solches Element
auftritt.

| Lücke                                                                                     | Einordnung                                                                                      |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Choreographie (`Choreography`, `ChoreographyTask`, `SubChoreography`, `CallChoreography`) | ARCTOS bietet das nicht an (Plan N1). Aufwand ~200 LOC, wenn je gebraucht.                      |
| Konversation (`Conversation`, `SubConversation`, `CallConversation`, `ConversationLink`)  | dito                                                                                            |
| `ImplicitThrowEvent`                                                                      | Randfall der Ausführungssemantik; im Bestand nie                                                |
| Mehrfachbeteiligter-Marker am Pool (`participantMultiplicity`)                            | drei Striche unten mittig, ~15 LOC                                                              |
| Nachrichtensymbol an der Mitte eines MessageFlow                                          | ~30 LOC                                                                                         |
| DI-Farbattribute (`bioc:stroke/fill`, `bpmndi` color)                                     | ARCTOS färbt über GRC-Layer, nicht über DI — bewusst offen                                      |
| `isMarkerVisible=false` am ExclusiveGateway                                               | das X wird immer gezeichnet                                                                     |
| Drill-Down in weitere `BPMNDiagram`-Ebenen                                                | nur die erste Ebene wird gezeichnet; ARCTOS drillt heute über eigene Seiten, nicht über bpmn-js |
| Kollisionsvermeidung bei Beschriftungen                                                   | Beschriftungen folgen der DI bzw. einer Standardbox; sie weichen einander nicht aus             |
| Ausschneiden von Kindelementen am Rand aufgeklappter Subprozesse                          | fällt erst beim Bearbeiten auf                                                                  |

### 2.4 Sichtbare Belege

`packages/bpmn/test/draw/rendered/` — **24 eigenständige SVG-Dateien** (gefordert
waren fünf), bei jedem Testlauf neu erzeugt, plus `_index.html` als Kontaktbogen.
Vollständige Liste:

```
repo-parser-mixed-types-subprocess.svg   synth-all-event-types.svg
repo-prd-procurement.svg                 synth-all-gateway-types.svg
repo-prd-sales-with-gateway.svg          synth-all-task-types.svg
repo-prd-single-start-event.svg          synth-boundary-events.svg
repo-seed-customer-service.svg           synth-cdata-umlauts-entities.svg
repo-seed-goods-receipt.svg              synth-collaboration-pools-lanes.svg
repo-seed-management-review.svg          synth-comments-and-pi.svg
repo-seed-order-callactivity.svg         synth-dangling-references.svg
repo-seed-risk-management.svg            synth-data-objects-and-artifacts.svg
repo-seed-tour-planning.svg              synth-default-namespace-unprefixed.svg
                                         synth-foreign-camunda-extensions.svg
                                         synth-large-flat-process.svg
                                         synth-nested-subprocesses.svg
                                         synth-unusual-attribute-order.svg
```

Die restlichen Korpusdateien haben keinen DI-Abschnitt und ergeben bewusst eine
leere Szene; der Test prüft, dass genau das der Grund ist (kein `BPMNShape` in der
Quelle) und nicht ein Renderfehler.

Zugesichert je gerendertem Diagramm: kein Fehler · jedes Modellelement hat genau
eine SVG-Entsprechung · jede Elementgruppe hat `role` und zugänglichen Namen ·
keine Nullflächen · kein `NaN`/`Infinity`/`undefined` im erzeugten SVG · die
`viewBox` umschließt alle Elemente · die Textalternative zählt so viele Schritte,
wie die Szene Knoten hat.

---

## 3. Barrierefreiheit — Stand

Ausgangslage (Audit-Finding **S14-10**): im heutigen BPMN-Modul in allen sechs
Dateien **null** `aria-*`, `role`, `tabIndex`, Tastatur-Handler.

**Umgesetzt:**

- Fläche ist **ein** Tabstopp: `role="application"`, `aria-roledescription`,
  `aria-label`, `tabindex=0`
- Roving-Tabindex über die Diagrammelemente in **topologischer** Ordnung
  (Startereignisse in Lesereihenfolge → entlang der Sequenzflüsse → Unerreichbares)
- Tastenbelegung: `→`/`←` nächstes/voriges Element · `↓`/`↑` Zweigwechsel an
  Verzweigungen · `Strg`/`Alt` + Pfeile verschieben die Fläche · `Leertaste`
  auswählen · `Enter` aktivieren (feuert `element.activate`) · `0`/`Home`
  einpassen · `+`/`-` zoomen · `Esc` verlassen
- `role` (`button` für Knoten, `img` für Artefakte und Kanten) und `aria-label`
  auf jedem `g.djs-element`; die Visuals darunter sind `aria-hidden`, damit der
  Name genau einmal vorkommt
- `aria-live="polite"`-Statusregion, die bei jedem Fokuswechsel einen Satz meldet,
  an Verzweigungen inklusive Anzahl und Namen der Zweige
- Textalternative in zwei Formen aus derselben Quelle: Tabelle (Nr., Name, Typ,
  Lane, Vorgänger, Nachfolger; `<caption>`, `scope="col"`/`scope="row"`) und
  Fließtext des Ablaufs. **Gleiche Nummerierung wie die Tastaturordnung** —
  „Schritt 7" meint im Bild und in der Tabelle dasselbe.
- Der SVG-Export trägt `role="img"`, `<title>`, `<desc>` (die Fließtextform) und
  die `aria-label` der Elemente — anders als heutige HTML-Overlays, die im Export
  fehlen (Plan §4.5).

**Messung mit `axe-core@4.12.1` in jsdom:** Textalternative und Diagrammfläche
haben **null** Verstöße.

Ein Befund aus dieser Messung ist in den Code eingegangen: `aria-posinset` und
`aria-setsize` waren zunächst auf den Elementgruppen gesetzt und wurden von axe
zu Recht als `aria-allowed-attr` beanstandet — ARIA 1.2 erlaubt sie nur an
Listen-, Options-, Zeilen- und Tab-Rollen, nicht an `button`/`img`. Die Position
steht jetzt in `data-order`, wird angesagt und erscheint in der Textalternative.

**Was jsdom nicht prüfen kann** (im Code als `JSDOM_LIMITATIONS` hinterlegt und
selbst getestet, damit es nicht untergeht):

1. **Farbkontrast.** `axe-core` schaltet `color-contrast` in jsdom ab — es kann
   die tatsächlichen Farben nicht berechnen (jsdom meldet dabei sichtbar
   „HTMLCanvasElement's getContext() not implemented"). Die Kontrastregeln aus
   Plan §4.4 (Badge-Text ≥ 4,5:1, Badge-Fläche ≥ 3:1 gegen Form _und_
   Hintergrund, Fokusring ≥ 3:1) sind damit **ungeprüft**. Sie brauchen einen
   echten Browser — Plan §6.3/§6.6.
2. **Schriftmetrik.** `getComputedTextLength()` existiert nicht. Der Zeilenumbruch
   ist nur gegen die _eigene_ Breitenschätzung geprüft, nicht gegen echtes
   Rendering. Ob eine Beschriftung im Browser wirklich in die Form passt, ist
   offen.
3. **Fokus-Sichtbarkeit** und ob ein fokussiertes Element im Viewport liegt.
4. **Tatsächliche Screenreader-Ausgabe.** Dass die Live-Region existiert und ihren
   Text ändert, ist geprüft; dass NVDA/JAWS/VoiceOver das vorlesen, nicht.
5. **Pixel-/Bildvergleich.** Es gibt kein Rasterbild; Formen sind über Attribute
   und Pfaddaten geprüft.

Zur Kontrolle wurden die erzeugten SVG-Dateien außerhalb der Testsuite mit
`sharp`/librsvg rasterisiert und angesehen. Das hat einen Fehler gefunden, den
kein Test der Suite gefunden hätte (siehe §4).

---

## 4. Aufwand: wo es unerwartet schwer und wo es unerwartet leicht war

### Unerwartet **leicht**

- **`diagram-js` als Unterbau.** Ein eigener Renderer ist eine
  `BaseRenderer`-Ableitung und ein zwölfzeiliges Modul. Canvas, ElementRegistry,
  EventBus, Overlays, Selection, Zoom/Pan haben ohne jede Anpassung funktioniert.
  Der Overlay-Test hängt ein Badge exakt so an, wie `bpmn-editor.tsx` es heute
  tut — unverändert lauffähig. Die Aussage aus Bestandsaufnahme 4.2 („alle sechs
  genutzten Dienste existieren dort unverändert") hat sich bestätigt.
- **Die Formen selbst.** Rechtecke, Kreise, Rauten, Zylinder, Eselsohren: reine
  Geometrie, in Stunden erledigt. Das Zahnrad des ServiceTask wird aus Zähnezahl
  und Radien _gerechnet_ statt als Literalpfad gepflegt — dieselbe Zeilenzahl,
  aber änderbar.
- **Die Modus-Achse.** „`readOnly` registriert die Bearbeitungsmodule nicht"
  ist tatsächlich eine Zeile: `modulesFor(mode)`. Der Test, dass `read` und
  `review` dieselbe Modulliste laden, ist zwei Zeilen. Die heutige Trennung in
  `Modeler` und `NavigatedViewer` ist technisch nicht nötig — bestätigt.
- **Barrierefreiheit _in_ der Engine.** Weil der zugängliche Name zentral aus dem
  Modell entsteht, ist er per Konstruktion an jedem Element vorhanden. Die
  Nachrüstung in `bpmn-a11y.tsx` (331 LOC daneben) leistet weniger.

### Unerwartet **schwer**

- **jsdom hat kein SVG-Layout — 465 LOC Polyfill.** Das ist der größte einzelne
  Überraschungsposten und größer als jede produktive Datei außer dem Renderer
  selbst. Es fehlen `getBBox`, `getCTM`, `createSVGPoint`, `createSVGTransform`
  und die `transform.baseVal`-Liste; dazu sind `clientWidth`/`clientHeight` immer
  0, was jede Zoomrechnung zu `NaN` macht. Besonders unangenehm: `diagram-js`
  schreibt das `transform`-Attribut an manchen Stellen direkt (`setCTM` in
  `Canvas.js`) statt über die Transformliste — im Browser hält das SVG-DOM beides
  synchron, in jsdom muss man die Liste aus dem Attribut nachziehen. Bis das
  gefunden war, meldete `canvas.zoom()` stumm `NaN`.
  **Konsequenz für den Plan:** Stufe 3 der Testpyramide (§6.3, echter Browser) ist
  keine Kür. Die jsdom-Stufe trägt Struktur- und ARIA-Prüfungen, nicht Geometrie.
- **Ein Fehler, den nur das Auge fand.** Das erzeugte SVG hatte `xmlns` doppelt
  (einmal von Hand gesetzt, einmal vom `XMLSerializer`). In jsdom fällt das nicht
  auf; librsvg lehnt die Datei mit „Attribute xmlns redefined" ab. Gefunden erst
  beim Rasterisieren zur Sichtprüfung. Es gibt jetzt einen Test darauf.
  **Konsequenz:** Für den SVG-Export braucht es eine Prüfung mit einem _fremden_
  Parser, nicht nur mit dem eigenen.
- **Gefangen vs. geworfen.** Der erste Entwurf hatte zwei Farbrollen
  („gefüllt"/„ungefüllt") — damit lässt sich der BPMN-Unterschied zwischen
  gefangenen und geworfenen Ereignissen nicht ausdrücken, und beide sahen
  identisch aus. Auch das hat kein Test gefunden, sondern die Sichtprüfung.
  Behoben mit drei Rollen (`body`/`line`/`detail`); das war eine
  Struktur-, keine Kosmetikänderung.
- **Textlayout ohne Messung.** Weder jsdom noch der Worker können Text messen,
  und `getComputedTextLength()` ist auch im Browser teuer. Ergebnis: eine
  Vorschubbreiten-Tabelle für eine Grotesk-Schrift (345 LOC mit Umbruch, hartem
  Wortbruch und Kürzung). Deterministisch und serverseitig brauchbar — aber eine
  **Schätzung**, deren Abweichung vom echten Rendering im Browser noch zu messen
  ist.
- **Die DI-Beschriftungsbox ist unzuverlässig.** Ein knappes Drittel des Korpus
  hat gar keine `BPMNLabel`-Bounds (Generatoren schreiben sie nicht), und wo sie
  steht, ist sie manchmal zu schmal, sodass ein Wort mitten im Wort umbrach.
  Beides musste die Szenenschicht abfangen (Standardbox unter dem Element; die
  DI-Box gilt als Empfehlung, nicht als Grenze). Das ist genau die Sorte
  Sonderfall, die der Plan für `import` mit „mechanisch, aber fehleranfällig"
  beschreibt (§2.3) — die Einschätzung war richtig.

### Werkzeugaufrufe als Zeitnäherung

Rund **100** Werkzeugaufrufe in einer Sitzung, grob aufgeteilt:

| Art                                                                | Anzahl (gezählt/geschätzt) |
| ------------------------------------------------------------------ | -------------------------: |
| Lesen und Analysieren (Plan, Bestandsaufnahme, `diagram-js`-Typen) |                        ~28 |
| Neue Dateien schreiben                                             |                         25 |
| Gezielte Änderungen                                                |                        ~21 |
| Compiler- und Testläufe                                            |                        ~14 |
| Sichtprüfung (Rasterisieren + Ansehen)                             |                         ~8 |
| Erkundungsproben (jsdom-Tauglichkeit, TS-Konfiguration)            |                         ~8 |

Zum Vergleich: `bpmn-js/lib/draw` umfasst 3.328 LOC; dieser Arbeitsstrang hat für
denselben Zweck **3.501 LOC** in `draw/` gebraucht — plus 1.165 LOC Betrachter und
Barrierefreiheit, die es in `bpmn-js` in dieser Form nicht gibt. Die Planschätzung
für `draw` lautete 1.400–1.800 LOC (§2.3). **Sie ist um Faktor ~2 zu niedrig.**
Der Unterschied steckt nicht in den Formen, sondern in Textlayout (345),
Szenenaufbau/DI-Abgleich (336 — im Plan als eigener Posten `import` mit 700–900
geführt), Symbolvorrat (661) und Markern (230).

---

## 5. Einschätzung: wie schwer wird die Modellierungsschicht?

Das ist die Zahl, an der die Gesamtentscheidung hängt. Ehrliche Antwort:
**deutlich schwerer als der Renderer — Faktor 3 bis 5 im Aufwand und Faktor 10 im
Risiko.** Begründung aus der Erfahrung dieses Spikes, nicht aus dem Bauchgefühl:

**Warum der Renderer vergleichsweise einfach war:** Er ist eine **reine
Funktion**. Eingabe: ein Element mit Bounds. Ausgabe: SVG-Knoten. Kein Zustand,
keine Reihenfolge, keine Rückwirkung. Jeder Fehler ist an einem Bild sofort
sichtbar und mit einem einzigen Test einzufangen. Deshalb waren 3.500 LOC in einer
Sitzung machbar.

**Warum die Modellierungsschicht das nicht ist:** Sie hält **drei Bäume synchron**
— den semantischen (`flowElements`, `sourceRef`/`targetRef`, `incoming`/`outgoing`),
den DI-Baum (`BPMNShape`/`BPMNEdge` im `BPMNPlane`) und die diagram-js-Grafik. Jede
Operation berührt alle drei, und der Fehler zeigt sich **nicht im Bild**, sondern
in der Datei, die ein anderes Werkzeug später nicht mehr lesen kann. Diese Spike-
Erfahrung ist übertragbar: Die zwei ernsthaften Fehler, die hier auftraten
(doppeltes `xmlns`, gefangen/geworfen ununterscheidbar), hat **keiner der 118
Tests** gefunden, sondern das Auge. In der Modellschicht gibt es dieses Auge nicht
— ein falsch umgehängter `flowNodeRef` sieht auf dem Bildschirm völlig richtig aus.

Konkret nach Teilaufgaben:

| Teilaufgabe                             | Schwierigkeit gegenüber `draw` | Warum                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`BpmnUpdater`** (drei Bäume synchron) | **4–6×**                       | Kein visuelles Feedback; Fehler wirken sich erst beim Export oder im Fremdwerkzeug aus. Braucht Eigenschaftstests („für jede Kommandofolge ist das erzeugte XML schemagültig und die Referenzen sind vollständig") statt Beispieltests. Das ist der Posten, der das Vorhaben zum Kippen bringen kann.                                                                                                                                                                     |
| **Lane-Splitting / Container-Wechsel**  | **3–4×**                       | Der Sonderfall, den der Plan §2.3.1 nennt, ist real: Ziehen in eine Lane ändert `flowNodeRef`, aber nicht `flowElements`; Ziehen in einen SubProcess ändert `flowElements` **und** die Koordinatenbasis. Zwei Regeln, die sich äußerlich gleich anfühlen und intern gegenläufig sind. Schon der _lesende_ Teil davon (welches Element liegt in welcher Lane) musste hier geometrisch gelöst werden — die Zugehörigkeit steht im XML an ganz anderer Stelle als in der DI. |
| **Boundary-Attachment**                 | **2×**                         | Mechanisch überschaubar (`attachedToRef` + `attach-support` aus diagram-js), aber mit vielen Randfällen: Verschieben des Wirts, Löschen des Wirts, Nicht-Unterbrechung, Position auf der Kante. Der Renderer-Teil davon ist trivial (36 px Kreis, gestrichelt) — der Modellteil ist es nicht.                                                                                                                                                                             |
| **Flow-Routing**                        | **1,5–2×**                     | `diagram-js` bringt `BaseLayouter`, Manhattan-Routing und `CroppingConnectionDocking` fertig mit. Zu bauen ist die BPMN-Konfiguration (Andockseiten je Typ, Kanten um Pools herum, Ausgänge eines Gateways fächern). Der kleinste der vier Posten — und der einzige, bei dem man das Ergebnis sieht.                                                                                                                                                                      |
| **Label-Platzierung**                   | **1,5×**                       | Anspruchsvoller als hier gebaut: hier folgt die Beschriftung der DI bzw. einer Standardbox. Beim Bearbeiten muss sie mitwandern, beim Erzeugen kollisionsfrei gesetzt werden und die `BPMNLabel`-Bounds mitschreiben. Der Korpus zeigt, dass fremde Werkzeuge diese Bounds unzuverlässig pflegen — man muss also robust _lesen_ und sauber _schreiben_.                                                                                                                   |

**Übertragung auf die Planzahl.** Der Plan schätzt `features/modeling` auf
2.800–4.000 LOC (§2.3). Wenn die `draw`-Schätzung um Faktor 2 danebenlag und die
Modellierungsschicht strukturell schwerer prüfbar ist, ist **5.000–7.000 LOC
Produktivcode plus 6.000–9.000 LOC Testcode** die realistischere Erwartung — mit
der im Plan genannten Unsicherheit von ±50 % nach oben, nicht nach unten. Der
Testcode wiegt hier schwerer als der Produktivcode; das ist keine Schwäche der
Schätzung, sondern die Eigenschaft eines Bausteins, dessen Fehler man nicht sieht.

**Was daraus folgt — drei Empfehlungen:**

1. **Die Reihenfolge des Plans stimmt, aber die Betonung nicht.** Renderer und
   Betrachter sind in der gemessenen Größenordnung erledigt; sie sind kein Risiko.
   Wer den Fortschritt an schönen Bildern misst, wird nach zwei Wochen zufrieden
   und nach vier Monaten überrascht sein.
2. **Der Read-only-Pfad ist früher lieferbar als gedacht.** Drei der vier
   Einbindungen in ARCTOS sind nur lesend (Bestandsaufnahme 1.5). Der hier gebaute
   Stand trägt sie fachlich bereits — es fehlen Feinschliff, Browsertests und die
   GRC-Layer, nicht die Substanz. Das ist eine belastbare Zwischenstufe, an der
   sich die Investitionsentscheidung noch einmal überprüfen lässt, **bevor** AP6
   beginnt.
3. **Ohne Shadow-Compare-Speichern (§5.4) und Eigenschaftstests kein AP6.** Die
   Absicherung muss vor dem Updater stehen, nicht nach ihm. Sonst fehlt genau das
   Auge, das in diesem Spike zweimal den Unterschied gemacht hat.

---

## 6. Dateien

**Produktiv (dieser Arbeitsstrang):**
`packages/bpmn/src/draw/` (11 Dateien) · `packages/bpmn/src/viewer/` (6 Dateien) ·
`packages/bpmn/src/index.ts`

**Tests:** `packages/bpmn/test/draw/` (5 Testdateien, 2 Hilfsdateien)

**Belege:** `packages/bpmn/test/draw/rendered/*.svg` (24) und
`packages/bpmn/test/draw/rendered/_index.html`
