# Welle 2b — Bedienung und Reichweite der BPMN-Engine

**Plan:** `docs/UMSETZUNGSPLAN-OFFENE-PUNKTE.md` §4 · **Register:** `docs/OFFENE-PUNKTE-REGISTER.md`
**Stand vorher:** `b14f56a0` · **Branch:** `audit/full-2026-08-31` · **Datum:** 2026-09-02/03

---

## 1. Zwölf Punkte, ein Muster

Der Auftrag führte zwölf Punkte: Drill-down, Typwechsel beim Anheften,
Sichtwahl, `chrome`, Moduswechsel, drei Werkzeuge, Bereichsauswahl, zwei
BPMN-Interpretationen, zwei Typdeklarationen, Renderer-Lücken und eine
veraltete Liste. Sie sehen unverbunden aus. Nach der Reproduktion sind es im
Wesentlichen **drei** Befunde, und der erste erklärt sieben der zwölf:

**„Die Fähigkeit ist gebaut. Sie ist nur nicht verdrahtet."**

| Punkt      | Was gebaut war                                                                                  | Was fehlte                                                               |
| ---------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **OP-018** | `buildScene(definitions, diagramIndex)` — seit dem Spike, samt Warnung                          | Niemand rief sie je mit etwas anderem als `0` auf                        |
| **OP-018** | `importer.import(defs, { diagramIndex })` in der Modellierungsschicht                           | dito                                                                     |
| **OP-019** | `BpmnRules.canAttach` erlaubt Zwischenereignisse ausdrücklich                                   | Die Bedienschicht lehnte sie ab — mit einer Begründung, die überholt war |
| **OP-028** | `editorChromeModule`, `editorModulesFor({ chrome: "full" })`, `EditorConfiguration.showsChrome` | Eine fest verdrahtete Zeile in `apps/web`                                |
| **OP-026** | `GrcViewSelect`, `useGrcOverlay`, der Overlay-Endpunkt                                          | Zwei Einbindungen setzten die drei Teile nicht zusammen                  |
| **OP-031** | `hand-tool`, `lasso-tool`, `space-tool` in `node_modules`                                       | **Mehr als der Bericht sagt:** die Module waren gar nicht registriert    |
| **OP-160** | Die maßgebliche `MISSING_TODAY` in `lib/grc-overlay.ts`                                         | Daneben stand eine zweite, ältere, ohne Wächter                          |

Das ist kein Zufall, sondern die Signatur eines Vorhabens, das in Schichten
gebaut wurde: `packages/bpmn` hat vorgelegt, und die letzte Zeile Verdrahtung
fiel jeweils zwischen zwei Dateihoheiten. **Der teuerste Teil dieser Welle war
nicht das Bauen, sondern das Nachweisen, dass nichts zu bauen war.**

Die zwei übrigen Befunde:

**„Der Bericht ist älter als der Code."** Drei der zwölf Registereinträge
stimmen gegen den heutigen Quelltext nicht mehr (OP-019, OP-038, OP-031 —
Abschnitt 15). In zwei Fällen ist die gemeldete Lücke geschlossen, in einem
ist sie **größer** als gemeldet.

**„Zwei Antworten auf dieselbe Frage — und die zweite ist messbar falsch."**
OP-037 war als Codequalitätspunkt geführt. Die Reproduktion hat einen
Produktdefekt gefunden: `packages/shared` lehnte gültige BPMN-Dateien ab, weil
es Präfixe statt Namensräume verglich (Abschnitt 11).

---

## 2. OP-018 — Drill-down in Subprozesse

**Befund (Register, L, größter Posten):** „Der Importer zeichnet nur die erste
`BPMNPlane`."

**Reproduktion.** `test/corpus/synth-nested-subprocesses.bpmn` ist die einzige
der 26 Korpusdateien mit mehr als einer Ebene. Gemessen:

```
[OP-018] BPMNDiagram-Ebenen: 2
[OP-018] Ebene 0: root=Process_Nested shapes=3 conns=2
         warn=["Definitionen enthalten 2 Diagramme; gezeichnet wird Nr. 1."]
[OP-018] Ebene 1: root=Sub_L1      shapes=4 conns=3
[OP-018] semantische FlowElements gesamt: 23
```

**Was tatsächlich vorlag — und der Bericht nicht sagt.** `buildScene` nimmt
seit dem Spike einen `diagramIndex` entgegen und **kann** jede Ebene zeichnen;
`importer.import` ebenso. Beide warnten sogar darüber, dass sie eine Ebene
unterschlagen — und niemand konnte etwas dagegen tun. Es fehlte nicht das
Zeichnen, sondern **die Navigation**: welche Ebene gehört zu welchem Element,
wie kommt man hinein, wie zurück, und wie sagt man das an.

Es fehlte außerdem an einer Stelle, an der es unsichtbar war: `currentScene()`
rechnete die Szene nach einer Bearbeitung mit der impliziten `0` neu. Wer auf
Ebene 2 bearbeitet hätte, hätte danach eine Textalternative und einen
SVG-Export von Ebene 1 bekommen.

**Reparatur.**

- `src/draw/planes.ts` (neu, 171 Zeilen) beantwortet die Frage, die vorher
  niemand stellte: `planesOf`, `planeIndexFor`, `planePath`, `planeLabel`.
  Die Zuordnung ist rein datengetrieben (`plane.bpmnElement === subProcess`) —
  geraten wird nichts. `parentIndex` entsteht aus einem zweiten Durchlauf, weil
  die Dokumentreihenfolge über die Verschachtelung nichts aussagt.
- `BpmnCanvas` bekommt `getPlanes`, `getPlaneIndex`, `getPlanePath`,
  `canDrillDown`, `canDrillUp`, `showPlane`, `drillDown`, `drillUp`,
  `currentPlaneLabel` und feuert `plane.changed`.
- **Bedienung, beide Eingabearten, alle Modi.** Tastatur `o` / `Umschalt+O` in
  `viewer/a11y.ts` — dort und nicht in `EditorKeyboard`, weil auch die lesende
  Fläche drillt und dort keine Bedienschicht registriert ist. Maus:
  Doppelklick in `BpmnCanvas` (ebenfalls modusunabhängig) und ein
  Kontextmenü-Eintrag „Ebene öffnen (Taste O)", der nur erscheint, wenn
  tatsächlich eine Ebene dahinter liegt.
- **Ansage.** Sie steht in `showPlane`, nicht in `GraphA11y`: der Wechsel setzt
  die a11y-Schicht neu auf, und die Live-Region der alten Instanz ist danach
  aus dem Dokument entfernt. Ein Satz, den niemand mehr liest, ist schlimmer
  als keiner.
- `currentScene()` rechnet mit `this.planeIndex`.
- **Oberfläche:** eine Brotkrume über der Fläche, sichtbar, sobald das Dokument
  mehr als eine Ebene hat — nicht erst, wenn man schon drin ist. Die
  vorletzte Fassung hing an der Länge des Pfades und war damit genau dort
  unsichtbar, wo der Hinweis gebraucht wird.

**Was nicht geht, offen benannt.** Im Bearbeitungsmodus **endet die
Rückgängig-Kette am Ebenenwechsel.** Der Grund ist gemessen, nicht vermutet:

```
importer.import(defs, { diagramIndex: 1 })  ohne vorheriges clear()
→ Error: element <Sub_L1> already exists
```

Die zweite Ebene will `Sub_L1` als Wurzelelement anlegen, und `Sub_L1` steht
bereits als Form der ersten Ebene in der Registry. `bpmn-js` löst das, indem es
dem Ebenen-Wurzelelement eine eigene Kennung gibt (`Sub_L1_plane`) und alle
Ebenen gleichzeitig importiert; das liegt in `src/modeling/importer.ts` — fremde
Dateihoheit. Der Ebenenwechsel baut deshalb neu auf. **Das Modell überlebt das
vollständig** (der moddle-Baum wird nicht angefasst; ein Test hält das fest),
Zusicherung Z-D bleibt in Kraft, nur der Kommandostapel nicht. Weitergereicht
in §16.

**Wächter.** `test/viewer/drilldown.test.ts` — 14 Zusicherungen, darunter drei,
die den Kern tragen: die Ebene wird gezeichnet, Z-D gilt über den Wechsel
hinweg (byteweise identischer Export), und die Bedienung läuft **ausschließlich
über `KeyboardEvent`s** samt Prüfung der Live-Region.
`apps/web/src/__tests__/components/bpmn-chrome-plane.test.tsx` prüft die
Brotkrume am echten Aufbau.

**Gegenprobe.** `drillDown` auf `return false` gesetzt → 5 von 14 rot,
darunter der Tastaturtest und der Bearbeitungstest.

---

## 3. OP-019 — Typwechsel Ereignis → Randereignis beim Anheften

**Befund:** „Automatischer Typwechsel Ereignis → Boundary-Event beim Anheften
fehlt." Abhängigkeit im Register: „nicht zeitgleich mit Auto-Resize ändern".

**Reproduktion.**

```
creation.attachBoundary(task, { type: "bpmn:IntermediateCatchEvent", … })
→ { shape: null, rejected: "Nur ein Randereignis lässt sich an eine
     Aktivität anheften." }
```

**Was tatsächlich vorlag — Abweichung zum Register.** Die Begründung im
Quelltext lautete: „`src/modeling` erlaubt zwar das Anheften eines
Zwischen-Ereignisses, aber das Verhalten, das daraus ein `bpmn:BoundaryEvent`
macht, ist dort ausdrücklich nicht gebaut (STUFE2-A1 §7, Punkt 1)."

**Gegen den Code geprüft trägt das nicht mehr.** `BpmnRules.canAttach` lässt
`bpmn:IntermediateThrowEvent` und `bpmn:IntermediateCatchEvent` ausdrücklich
zu; der Kommentar dort lautet wörtlich „(und zwischenzeitliche Ereignisse, die
dabei zu welchen werden)". Und `modeling.replaceShape` gibt es samt Übernahme
von `extensionElements`, ID und Anheftern. **Die Regel erlaubte es, die
Operation konnte es, und allein die Schicht dazwischen sagte nein.** Der Punkt
liegt vollständig in der Bedienschicht — die Abhängigkeit zum Auto-Resize
(OP-020) besteht nicht.

**Reparatur.** Zwei Wege, weil der Nutzer die Handlung auf zwei Arten meint:

1. **Anlegen und anheften.** `asBoundaryItem` übersetzt einen Paletteneintrag
   in das, was am Rand einer Aktivität gemeint ist: aus einem Zwischenereignis
   wird ein `bpmn:BoundaryEvent` **mit derselben Ereignisdefinition** — sie ist
   der Grund, warum der Nutzer _dieses_ Ereignis gewählt hat. `bpmn:StartEvent`
   und `bpmn:EndEvent` bleiben draußen (ein Start am Rand ist der Auslöser eines
   Ereignis-Subprozesses und entsteht dort), alles Nicht-Ereignis ebenso.
2. **Ein vorhandenes Element anheften.** `attachExisting` — erst
   `updateAttachment`, dann `replaceShape`. Die Reihenfolge ist Absicht: der
   `ReplaceShapeHandler` übernimmt `host` und legt mit `attach: true` an; wer
   umgekehrt vorginge, hätte zwischendurch ein `bpmn:BoundaryEvent` ohne Wirt —
   genau den Zustand, den `BOUNDARY_WITHOUT_HOST` zu Recht bemängelt.
   Erreichbar über den Containerwechsel (`m`), weil dort schon die Frage „wohin
   gehört das?" gestellt wird; die Aktivität steht jetzt als Anheftziel in
   derselben Kandidatenliste, angesagt als „Anheften an" statt „Container".

**Der Wechsel wird angesagt.** „…angeheftet und dabei in ein Randereignis
umgewandelt. Die Kennung `Event_1` bleibt erhalten." Ein stiller Typwechsel
wäre eine Überraschung; die Kennung zu nennen ist nötig, weil Risiken,
Kontrollen und Kommentare aus der Datenbank daran hängen.

**Wächter.** `test/editor/attach-boundary.test.ts`, 9 Zusicherungen. Einer
davon belegt ausdrücklich die Registerabweichung (`canAttach` liefert
`"attach"`), einer führt die ganze Handlung über Tastenereignisse aus, einer
prüft die geschriebene Datei (`attachedToRef="Task_A"`, kein
`intermediateCatchEvent` als Rest).

**Testkorrektur, offen benannt.** `test/editor/context-pad.test.ts` enthielt
eine Zusicherung namens „heftet **nur typrichtige** Randereignisse an", die die
Ablehnung festhielt. Das war die Bedienlücke selbst, nicht ihr Wächter. Sie ist
umgedreht und um die Ablehnung dessen ergänzt, was am Rand tatsächlich nichts
zu suchen hat (ein Gateway) — der Test ist strenger geworden, nicht schwächer.

**Gegenprobe.** `asBoundaryItem` auf „nur echte Randereignisse" zurückgebaut →
3 rot.

---

## 4. OP-026 — Zwei lesende Einbindungen ohne GRC-Sichtwahl

**Befund:** „Zwei lesende Einbindungen ohne GRC-Sichtwahl (Dialog ‚Version
ansehen', `my-processes/[id]`)." Register-Aufwand: S, „eine Zeile Verdrahtung
je Stelle". Offene Entscheidung: „gehört eine Sichtwahl in die
Mitarbeitersicht?"

**Reproduktion.** `GrcViewSelect` und `useGrcOverlay` sind gebaut und an zwei
Stellen verdrahtet (`processes/[id]/page.tsx:943` und `:1485`). An den zwei
gemeldeten Stellen stand `<BpmnViewer xml={…} />` ohne beides — die 23
GRC-Layer waren dort unerreichbar, obwohl der Endpunkt die Daten liefert.

**Reparatur.** **Nicht** eine Zeile je Stelle. Die Verdrahtung besteht aus
einem Haken, einem Zustand, einem Auswahlfeld und zwei bedingt gesetzten Props;
an vier Stellen kopiert wäre das genau die Form, aus der die Abweichungen
entstehen, die dieser Audit an anderer Stelle gefunden hat
(`UMSETZUNG-WELLE-1C.md` §1: „Der Einzelfall ist behoben, die Frage war nie
gestellt"). Stattdessen `BpmnGrcViewer` in `components/bpmn/bpmn-viewer.tsx` —
einmal, mit `processId` und `versionId` als einziger Schnittstelle. Die
Aufrufstellen ändern sich um eine Komponente und zwei Props.

`versionId` gehört dazu: der Dialog zeigt eine bestimmte Fassung, und
`useGrcOverlay` kennt den Parameter (`?version=`). Ohne ihn läge über einer
alten Fassung der Stand von heute.

**Die offene Entscheidung, getroffen: ja, mit Vorgabe „aus".** `null` heißt
ausdrücklich aus — dann wird der Overlay-Endpunkt gar nicht erst befragt, es
entsteht keine zusätzliche Last, und die Mitarbeitersicht verhält sich wie
bisher. Wer die Sicht einschaltet, sieht Daten, die er ohnehin sehen darf: der
Endpunkt prüft die Rechte, nicht das Auswahlfeld. Eine Mitarbeitersicht, in der
die Risikoampel des eigenen Prozesses nicht zu sehen ist, wäre schwerer zu
begründen als eine, in der sie ausgeschaltet vorliegt.

**Warum die Komponente in `bpmn-viewer.tsx` steht und nicht in einer eigenen
Datei.** Sie stand zuerst in `bpmn-grc-viewer.tsx` — und ließ damit die
i18n-Ratsche auf 152 gegen ein Budget von 151 steigen. Der Grund ist ein
bekannter Fehlalarm des Zählers (`showsLiteralText` wertet
`className="mb-1 flex justify-end"` als „satzförmiges Literal"); der Zähler
begründet seine Konservativität in seinem eigenen Kommentar und hat damit
recht. Die Ratsche höher zu stellen war ausgeschlossen; eine Datei zu erfinden,
die den Fehlalarm umgeht, wäre unehrlich. Die Komponente in die Datei zu legen,
in die sie fachlich gehört — die Weiche der lesenden Flächen —, löst beides.

**Ausnahme von der Dateihoheit, angesagt.** Zwei Seiten außerhalb meines
Bereichs sind geändert, je um einen Import und einen Komponentenaustausch:
`my-processes/[id]/page.tsx` (2 Zeilen) und `processes/[id]/page.tsx`
(Versionsdialog, plus eine eigene dynamische Einbindung, damit die neun Sichten
nicht in das Bündel jeder Prozessseite geraten). Ohne sie ist der Punkt nicht
geschlossen, und beide sind additiv.

**Wächter.** Drei Zusicherungen in `bpmn-chrome-plane.test.tsx`: die Wahl
erscheint mit Prozesskennung, sie fehlt ohne, und der Endpunkt wird erst
befragt, wenn eine Sicht gewählt ist — mitsamt `version=v-3` in der URL.

---

## 5. OP-028 — `chrome: "full"` im Lesemodus

**Befund:** „`chrome: "full"` im Lesemodus nicht in Betrieb — jede lesende
Fläche bekommt `minimal`." Offene Entscheidung: „ausgegraute Palette bei
fehlendem Recht?"

**Reproduktion.** Eine Zeile, `arctos-bpmn-canvas.tsx`:

```ts
chrome: mode === "edit" ? "full" : "minimal",
```

Kein Aufrufer konnte etwas anderes wählen — es gab keine Prop dafür. Damit war
`editorChromeModule` (gebaut in Stufe B1, samt `EditorConfiguration.showsChrome`
und der `aria-disabled`-Behandlung in `PaletteProvider`) vollständig
unerreichbar.

**Die offene Entscheidung, getroffen — und der Code hatte sie schon
begründet.** `packages/bpmn/src/editor/modules.ts` schreibt seit Stufe B1
wörtlich: „Auf `processes/[id]` folgt `readOnly` aus einem **fehlenden Recht**.
Eine ausgegraute Palette mit ‚Bearbeitung erfordert die Rolle
Prozessmodellierer' ist dort ehrlicher als eine Oberfläche, die so tut, als
gäbe es die Funktion nicht. Im Mitarbeiterportal dagegen folgt `read` aus dem
**Kontext** — dort will niemand eine dauerhaft graue Werkzeugleiste sehen."

Die Entscheidung ist damit nicht der Modus, sondern die **Herkunft** des
Lesemodus, und die kennt nur die Aufrufstelle:

| Einbindung                                   | Herkunft des `read` | `chrome`  |
| -------------------------------------------- | ------------------- | --------- |
| `bpmn-editor.tsx` (`readOnly = !canEdit`)    | fehlendes Recht     | `full`    |
| `bpmn-viewer.tsx` (Vorschau, Dialog, Portal) | Kontext             | `minimal` |

**Reparatur.** `chrome` als Prop an `ArctosBpmnCanvas`, weitergereicht an
`BpmnCanvas` **und** an `config.editor` (dort landet die Begründung).
`defaultChromeFor` liefert `full` — die zurückhaltendere Vorgabe wäre hier die
falsche, weil eine fehlende Palette nichts über ein fehlendes Recht sagt. Die
Begründung kommt aus `messages/{de,en}/bpmn.json` unter
`bpmn.chrome.disabledReason`.

**`aria-disabled` statt `disabled`** — das war schon gebaut und ist jetzt
sichtbar: ein `disabled`-Knopf fällt aus Fokus und Ansage, und dann erfährt ein
Tastaturnutzer nie, dass es die Funktion gibt und warum sie gerade nicht geht.
Genau das soll `full` verhindern.

**Wächter.** Vier Zusicherungen am echten Aufbau (`@grc/bpmn` ist im Test
nicht gemockt): Palette vorhanden, jeder Knopf `aria-disabled="true"` und
**nicht** `disabled`, mindestens einer nennt den Grund; mit `minimal` keine
Palette; `BpmnViewer` wählt `minimal`.

**Gegenprobe.** Die alte Zeile wieder eingesetzt → rot.

---

## 6. OP-029 — Moduswechsel zur Laufzeit

**Befund:** „Moduswechsel zur Laufzeit (Viewbox, Zoom, Selektion, Layer
erhalten) nicht gebaut."

**Reproduktion.** Der Aufbaueffekt hing an `[xml, mode]`. Ein Wechsel
`read → edit` zerstörte die Instanz und baute sie neu auf; danach stand die
Ansicht wieder auf `fit-viewport`, die Auswahl war leer, und seit dieser Welle
wäre auch die Ebene zurückgesetzt. Bei `synth-large-flat-process` (60 Knoten)
sucht man ein herangezoomtes Detail danach wieder.

**Warum der Neuaufbau bleibt.** Die Modulliste eines `didi`-Containers steht
beim Bootstrap fest; `edit` registriert `modeling`, `read` nicht. Einen
laufenden Container umzuhängen hieße, die Modullogik ein zweites Mal zu
bauen — und sie wäre die Stelle, an der Lesen und Bearbeiten wieder
auseinanderlaufen, also genau das, was `BpmnCanvas` („ein Bauteil, drei Modi")
verhindern soll. Erhalten wird deshalb der **Zustand**, nicht die Instanz.

**Reparatur.** `takeSnapshot` im Aufräumpfad (vor `destroy()`, danach ist der
Container weg), `restoreSnapshot` nach dem Import. Gemerkt werden Viewbox,
Zoomstufe, Auswahl (als Kennungen, nicht als Objekte — die Objekte sind nach
dem Neuaufbau andere) und die Ebene. Reihenfolge beim Wiederherstellen: Ebene
zuerst, denn sie entscheidet, welche Elemente es überhaupt gibt.

Zwei Absicherungen mit Begründung im Code: jeder Zugriff in `try/catch` (beim
Aufräumen kann der Container schon aus dem Dokument sein, und ein gescheiterter
Schnappschuss darf den Moduswechsel nicht mitreißen), und der Schnappschuss
trägt sein XML mit — ein Stand gehört zu **einem** Dokument, und eine Viewbox
aus einem fremden zeigte auf leere Fläche.

**Wächter.** Zwei Zusicherungen: nach `read → edit` steht dieselbe Ebene, und
nach einem Wechsel des Diagramms wird nichts wiederhergestellt.

**Gegenprobe.** `restoreSnapshot` ausgehängt → rot.

---

## 7. OP-031 — Space-, Lasso- und Hand-Werkzeug

**Befund (Register):** „Kein Space-, Lasso-, Hand-Werkzeug (**Module
vorhanden**, Palette-Einträge und Zustandsmodell fehlen)."

**Reproduktion — der Bericht untertreibt.**

```
grep -rn "lasso\|space-tool\|hand-tool" packages/bpmn/src/
→ 1 Treffer, und der steht in einem Kommentar (src/verify/shadow.ts:339)
```

Die Module liegen in `node_modules/diagram-js/lib/features/`, waren aber in
**keiner** Modulliste registriert; `injector.get("lassoTool", false)` lieferte
`null`. Es fehlten also nicht Palette-Einträge zu vorhandenen Diensten, sondern
die Dienste selbst.

**Reparatur.**

- `HandToolModule`, `LassoToolModule`, `SpaceToolModule` in
  `editorModule.__depends__` (`tool-manager` kommt über deren `__depends__`
  mit).
- `src/editor/Tools.ts` (neu, 341 Zeilen) als **Zustandsmodell**: genau ein
  Werkzeug aktiv, `Escape` beendet, die Palette zeigt es mit `aria-pressed`.
  Der Zustand wird bewusst **hier** geführt und nicht aus `toolManager`
  abgeleitet: der kennt nur Werkzeuge, die über einen Zeigervorgang aktiv
  wurden (`dragging.context()`), und wäre bei reiner Tastaturbedienung dauerhaft
  leer — die Palette bekäme nie ein `aria-pressed`.
- Palette: eine eigene Gruppe „Werkzeuge", **vor** dem Elementvorrat. Für die
  Tastatur ist das die wichtigere Reihenfolge: wer den Bereich mit `F6` betritt,
  landet auf dem Werkzeug und nicht auf dem achtzehnten Elementtyp.
- Tasten `h` / `l` / `s`, dieselben wie in jedem BPMN-Werkzeug. Ein aktives
  Werkzeug hat Vorrang vor allem anderen in `handleModes` — das ist die
  Bedeutung von „Werkzeug": solange es an ist, meinen die Tasten etwas anderes.
  Ohne diesen Vorrang wäre der Zustand bloß eine Anzeige.

**Jedes Werkzeug hat einen Tastatur-Zwilling** — die Regel aus Plan §4.2:

| Werkzeug    | Maus              | Tastatur                                            |
| ----------- | ----------------- | --------------------------------------------------- |
| Hand (`h`)  | Fläche ziehen     | `Strg`+Pfeil verschiebt die Ansicht (seit A1)       |
| Lasso (`l`) | Rahmen aufziehen  | `Strg+Umschalt+A` wählt alles im Container (OP-032) |
| Platz (`s`) | Trennlinie ziehen | Pfeiltasten ab dem fokussierten Element             |

Der Platz-Zwilling ist der einzige wirklich neue. Was sich bewegt und was
mitwächst, rechnet `spaceTool.calculateAdjustments` — **dieselbe** Rechnung wie
der Mausvorgang. Sie nachzubauen hieße, zwei Antworten auf „wächst der Pool
mit?" zu haben.

`activateDiagramTool` fasst den Aufruf in `try` — `toggle()` fragt den zuletzt
gesehenen Mauszeiger, und in einer Sitzung ohne Mausbewegung (jeder
Tastaturlauf, jeder Test) gibt es den nicht. Der Zustand dieses Dienstes darf
davon nicht abhängen.

**Wächter.** `test/editor/tools-range.test.ts`, Teil 1: die vier Dienste sind
im Container, die Palettengruppe hat drei benannte Knöpfe mit `aria-pressed`,
jede Taste schaltet ein und aus **mit Ansage**, genau eines ist aktiv, `Escape`
beendet, jede Taste steht in `KEY_BINDINGS`. Der Platz-Zwilling wird über
`act()` geprüft — also mit Invariantenprüfung nach der Handlung _und_ nach dem
Undo — und die Zusicherung ist zweiseitig: hinter dem Schnitt rückt etwas,
**davor nichts**. Das ist die Aussage, die ein falsch gesetztes `start` als
Erstes bricht.

**Testkorrektur.** Zwei vorhandene Tests zählten die Palettenknöpfe gegen
`DEFAULT_PALETTE_ITEMS.length`. Die Zahl bleibt exakt (`… + TOOL_IDS.length`) —
sie hat seit dieser Welle zwei Quellen.

**Gegenprobe.** Modulregistrierung entfernt → 3 rot.

---

## 8. OP-032 — Mehrfachauswahl per Tastatur über einen Bereich

**Befund (`STUFE2-B1-EDITOR.md` §7.11, wörtlich):** „`Strg+Leertaste` nimmt das
fokussierte Element hinzu, `Strg+A` alles — ‚alles in dieser Lane' gibt es
nicht."

**Reproduktion.** Bestätigt. Um die Elemente **einer** Lane von
`synth-collaboration-pools-lanes` zu wählen, brauchte es je eine Fokusfahrt und
ein `Strg+Leertaste`; mit der Maus genügt ein Lassozug. Das ist der Abstand.

**Reparatur — zwei Bereiche, weil „Bereich" zwei Dinge heißt.**

1. **Der Container** (`Strg+Umschalt+A`) — „alles in dieser Lane", der Fall,
   den der Befund nennt. Der Bereich ist die Lane, der Pool, der Subprozess:
   eine Aussage des **Modells**, nicht der Geometrie. Genau deshalb ist er der
   bessere Tastaturzwilling des Lassos — er trifft, was zusammengehört, und
   nicht, was zufällig nebeneinander liegt.
2. **Die Strecke** (`Umschalt+Leertaste`) — vom Anker bis zum fokussierten
   Element. Die Tastaturform von „anklicken, dann mit Umschalt woanders hin
   klicken". Zweischrittig wie `ConnectMode` und `ContainerMode`, damit sich die
   Bedienung nicht auseinanderentwickelt.

**Warum die Zeichenordnung und nicht die Ablaufordnung.** Die Graphnavigation
des Betrachters läuft topologisch — richtig zum Lesen. Für eine Strecke wäre
sie falsch: an einer Verzweigung ist „alles dazwischen" topologisch nicht
definiert, und der Benutzer sieht ohnehin eine Fläche. Genommen wird die
Ordnung, die die Formen auf dem Bildschirm haben.

Beide zählen nur, was sichtbar ist (`visibility.ts`, OP-033) und lassen
Beschriftungs-Shapes aus — eine Auswahl, die Beschriftungen mitzählt, sagt
Zahlen an, die zu nichts auf dem Bildschirm passen.

**Ansage.** „7 Elemente in ‚Vertrieb' ausgewählt." Zahl **und** Container: für
einen Screenreader-Nutzer ist die Ansage die einzige Auskunft darüber, was
gerade markiert ist (dieselbe Überlegung wie in `UMSETZUNG-WELLE-1C.md` §6).

**Wächter.** Sechs Zusicherungen, darunter zwei, die tragen: die Auswahl
enthält **nur** Elemente desselben Containers, und sie ist **kleiner** als
`Strg+A` — sonst wäre die Taste ohne Wert. Die Strecke wird einmal über die
API und einmal ausschließlich über Tastenereignisse geprüft.

**Gegenprobe.** `Strg+Umschalt+A` aus der Tastenbehandlung entfernt → 2 rot.

---

## 9. OP-038 — Zwei ambiente `declare module "bpmn-moddle"`

**Befund (Register):** „Die schmalere App-Fassung kennt weder `ModdleWarning`
noch die zweiargumentige `toXML`-Signatur."

**Reproduktion — der Bericht ist überholt.** Beide Dateien führen heute
`ModdleWarning`, `FromXmlResult`, `ToXmlOptions` und `toXML(element, options)`.
Nach Entfernung der Kommentare und Normalisierung des Leerraums sind sie
**zeichengleich**. `apps/web/src/types/bpmn-moddle.d.ts` sagt das in seinem
eigenen Kopf: „The declarations are now identical in substance; when one
changes, change both." Und der gemeldete Folgefehler tritt nicht mehr auf:
`npx tsc --noEmit -p apps/web/tsconfig.json` läuft mit den
`@grc/bpmn/grc`- und `@grc/bpmn/draw`-Importen der Diagrammfläche fehlerfrei
durch.

**Was bleibt.** Der Befund dahinter: zwei ambiente Deklarationen desselben
Moduls in zwei TypeScript-Programmen sind ein stiller Fehlerherd — und „change
both" ist ein Kommentar, kein Wächter. Genau dieser fehlende Wächter ist die
Ursache, aus der die Drift überhaupt entstehen konnte.

**Was nicht gemacht wurde und warum.** Die Zusammenführung berührt
`packages/bpmn/src/model/bpmn-moddle.d.ts` — ausdrücklich fremde Dateihoheit in
dieser Welle. Gebaut ist stattdessen die Hälfte, die sofort beißt:
`apps/web/src/__tests__/components/bpmn-moddle-declaration.test.ts` vergleicht
die **Typfläche** beider Dateien (ohne Kommentare, die sich unterscheiden
sollen), prüft die drei konkret gemeldeten Teile in beiden, und zählt, dass es
genau **zwei** solche Deklarationen im Baum gibt — eine dritte wäre die nächste
Stufe desselben Fehlers.

---

## 10. OP-046 — Renderer-Kleinlücken

**Befund:** sieben Punkte aus `SPIKE-MESSUNG-DRAW.md` §2.3.

**Reproduktion, je Punkt gemessen.** Keine der Lücken kommt im Testkorpus vor
(`isMarkerVisible` nur als `"true"`, kein `bioc:`, kein
`participantMultiplicity`, kein `implicitThrowEvent`). **Deshalb bewegt sich
kein einziges Referenzbild** — und deshalb braucht jede Lücke eine eigene
Zusicherung: der Korpustest kann sie nicht sehen.

| Lücke                            | Stand   | Was gemacht wurde                                                                                                |
| -------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `ImplicitThrowEvent`             | behoben | in `EVENT_TYPES`, `isThrowing`, `hasDoubleBorder`, Typlabel. Vorher: gestricheltes Rechteck `data-unsupported`   |
| `isMarkerVisible=false`          | behoben | BPMN 2.0 §12.2.2 erlaubt die leere Raute; ein so gespeichertes Diagramm sah nach dem Laden anders aus als vorher |
| `participantMultiplicity`        | behoben | drei Striche unten mittig, nur bei `maximum > 1` (ohne `maximum` gilt laut Metamodell 1)                         |
| Nachrichtensymbol am MessageFlow | behoben | am **Punkt auf halber Länge des Polygonzugs**, nicht in der Mitte der Bounding-Box; gefüllt = gesendet           |
| DI-Farbattribute                 | behoben | `bioc:*` und `color:*`, **nur Hexfarben**                                                                        |
| Label-Kollisionsvermeidung       | offen   | siehe unten                                                                                                      |
| Clipping am Subprozessrand       | offen   | siehe unten                                                                                                      |

**Zur DI-Farbe, gegen die Spike-Notiz.** Der Spike führt sie als „bewusst
offen — ARCTOS färbt über GRC-Layer, nicht über DI". Umgesetzt ist sie
trotzdem, aus zwei Gründen: sie ist eine Aussage des **Dokuments** (Dateien aus
Camunda und Signavio tragen sie), die GRC-Schicht zeichnet als eigene Ebene
darüber und kollidiert nicht, und ein Round-Trip, der eine Farbe behält aber
nicht zeigt, ist die verwirrendere Hälfte. Die Übersteuerung sitzt bewusst als
**Nachlauf** über dem fertig gezeichneten Element und nicht in jeder der vierzig
Palettenstellen — so bleiben Produktpalette (samt Hochkontrastfassung) und
Dokumentfarbe getrennt und an einer Stelle abschaltbar.

**Nur Hexfarben.** Der Wert stammt aus einer hochgeladenen Datei und landet in
einem SVG-Attribut. `url(…)`, `expression(…)`, `red; stroke: black` und
`javascript:1` werden verworfen — schweigend, weil eine unbrauchbare Farbe kein
Grund ist, ein Diagramm nicht zu zeichnen. Sechs dieser Eingaben stehen als
Zusicherung im Test.

**Zurückgestellt, mit Begründung:**

- **Label-Kollisionsvermeidung.** Kein 15–30-Zeilen-Posten, sondern ein
  Layoutverfahren: Beschriftungen folgen der DI beziehungsweise einer
  Standardbox, und sie einander ausweichen zu lassen heißt, die DI zu
  **verändern** — womit der Export nicht mehr die geladene Datei wäre und
  Zusicherung Z-D fiele. Das ist eine Entscheidung über den Vertrag der
  Zeichenschicht, keine Renderlücke.
- **Clipping am Subprozessrand.** Die Szene ist flach: Kinder eines
  aufgeklappten Subprozesses sind Geschwister, keine Kinder einer SVG-Gruppe.
  Ein `clipPath` je Subprozess bräuchte eine Umstellung der Zeichenreihenfolge
  auf verschachtelte Gruppen — und die berührt `compareShapes`, den
  SVG-Export und die a11y-Reihenfolge. Der Spike sagt selbst „fällt erst beim
  Bearbeiten auf"; dort fängt es das Auto-Resize ab.

**Wächter.** `test/draw/renderer-gaps.test.ts`, 15 Zusicherungen.
**Gegenprobe.** Alle drei behobenen Zeichenpfade ausgehängt → 6 rot.

---

## 11. OP-037 — `packages/shared` parst BPMN selbst

**Befund:** „1.529 Zeilen in sechs Dateien." Warnung im Auftrag: 1.950 Tests
hängen daran.

**Reproduktion — die Zahl stimmt, die Aufteilung nicht.** Von den sechs Dateien
lesen nur **vier** BPMN; `bpmn-diff.ts` (106 Zeilen) benutzt `parseBpmnXml`, und
`excel-to-bpmn.ts` (321 Zeilen) **schreibt** BPMN, liest keines. Die
tatsächliche Lesefläche war 1.102 Zeilen in vier Dateien, in zwei Bauarten:

- **`fast-xml-parser` + Präfixvergleich:** `bpmn-parser.ts` (251),
  `bpmn-validator.ts` (358)
- **Reguläre Ausdrücke über dem rohen XML:** `bpmn-raci-engine.ts` (239),
  `bpmn-walkthrough-engine.ts` (254)

**Der Produktdefekt, den die Reproduktion gefunden hat.** Dasselbe Dokument,
fünf Präfixe:

```
[OP-037] prefix="bpmn:"      → steps=3
[OP-037] prefix=""           → steps=3
[OP-037] prefix="ns0:"       → Fehler „missing <bpmn:definitions> root element"
[OP-037] prefix="b:"         → Fehler „missing <bpmn:definitions> root element"
[OP-037] prefix="semantic:"  → Fehler „missing <bpmn:definitions> root element"
```

Die Zeile war `parsed["bpmn:definitions"] || parsed["definitions"]` — sie
vergleicht **Präfixe**. `ns0:` schreiben Werkzeuge auf JAXB-Basis, `semantic:`
schreibt Signavio; beides sind gültige BPMN-2.0-Dokumente. Im Betrieb heißt
das: `POST /api/v1/processes/import-bpmn-xml` lehnt sie mit „Invalid BPMN XML"
ab, und beim Speichern einer Version (`versions/route.ts:67`) entsteht **keine
einzige** `process_step`-Zeile — ohne Fehlermeldung, weil der Aufrufer den Wurf
abfängt. Das ist die stille Fehlerform, die dieser Audit an anderer Stelle als
die gefährlichste benannt hat.

Bei den regulären Ausdrücken ist es dieselbe Krankheit, mit fünf weiteren
Symptomen:

| Eingabe                                   | regulärer Ausdruck         | Wirklichkeit                          |
| ----------------------------------------- | -------------------------- | ------------------------------------- |
| `<ns0:lane …>`, `<semantic:lane …>`       | kein Treffer               | gültiges BPMN                         |
| `<bpmn:lane name="A" id="L1">`            | kein Treffer               | Attributreihenfolge ist bedeutungslos |
| `<bpmn:lane id="L1"/>` (selbstschließend) | kein Treffer               | gültige leere Lane                    |
| `<!-- <bpmn:task id="X"/> -->`            | **Treffer**                | ein Kommentar ist kein Element        |
| `name="a &gt; b"`                         | `a &gt; b`                 | `a > b`                               |
| `<x:task id="Fremd"/>` bei `x`≠`bpmn`     | Treffer, wenn `x` = `bpmn` | fremdes Element                       |

Und, der eigentliche Befund zu diesen beiden Dateien:

```
grep -rl "raci-engine\|walkthrough-engine" packages/shared/tests apps/web/src
→ null Treffer
```

**Sie liefen an keiner Stelle durch einen Test.** Falsch _und_ unbeobachtet —
die riskanteste der sechs Dateien.

**Reparatur — datei-für-datei, mit gemessenem Stand.**

| Datei                        | Zeilen  | Stand nach dieser Welle                             |
| ---------------------------- | ------- | --------------------------------------------------- |
| `bpmn-parser.ts`             | 251→307 | **umgestellt** auf `parseXml` aus `@grc/bpmn/util`  |
| `bpmn-raci-engine.ts`        | 239→222 | **umgestellt**, fünf reguläre Ausdrücke entfallen   |
| `bpmn-walkthrough-engine.ts` | 254→257 | **umgestellt**, vier reguläre Ausdrücke entfallen   |
| `bpmn-diff.ts`               | 106     | **erledigt ohne Änderung** — benutzt `parseBpmnXml` |
| `bpmn-validator.ts`          | 358     | **zurückgestellt**, siehe unten                     |
| `excel-to-bpmn.ts`           | 321     | **nicht zutreffend** — schreibt BPMN, liest keines  |

Gelesen wird jetzt mit `parseXml` aus `@grc/bpmn/util` — demselben Leser, den
die Engine für ihren Kanonisierer benutzt: **synchron** (das ist die
Bedingung, unter der die API-Routen unverändert bleiben; `moddle` wäre `async`
und hätte vier Aufrufstellen in fremder Dateihoheit aufgerissen),
abhängigkeitsfrei, namensraumbewusst, mit dekodierten Entitäten.
`src/lib/bpmn-extract.ts` (neu, 280 Zeilen) ist die eine Stelle für die zwei
Motoren: ein Baum, ein Durchlauf statt drei bis vier Läufen über dasselbe
Dokument.

**Zwei beabsichtigte Verhaltensunterschiede, beide begründet.**

1. **Dokumentreihenfolge statt Gruppierung nach Tag.** `fast-xml-parser`
   bündelt gleiche Tags; `sequenceOrder` folgte damit der Reihenfolge der
   Tag-_Namen_. Ein Diagramm Start → Aufgabe → Ende → Aufgabe bekam die
   Reihenfolge Start, Aufgabe, Aufgabe, Ende. Die vorhandenen Tests fordern nur
   „lückenlos und aufsteigend" (`bpmn-parser.test.ts:87`) und bleiben grün.
2. **Ohne Namensraumdeklaration wird der lokale Name genommen.** Solche Dateien
   erzeugt der Excel-Import; sie abzulehnen wäre eine Verschlechterung. Es ist
   der einzige Fall, in dem geraten wird, und er steht als Zusicherung im Test.

**`bpmn-validator.ts` zurückgestellt — Begründung.** Es ist kein
Interpretationsproblem mehr, sondern ein **Regelwerk**: 358 Zeilen, deren Kern
25 fachliche Prüfungen sind (kein Startereignis, unverbundene Knoten,
Gateway-Bedingungen), gehalten von 207 Zeilen Test. Der XML-Leser darin ist
zwanzig Zeilen; ihn zu tauschen ist billig, aber der eigentliche Punkt ist die
Frage, ob diese Prüfungen neben `packages/bpmn/src/modeling/invariants.ts`
stehen bleiben sollen — und `invariants.ts` gehört einem anderen Strang. Eine
halbe Umstellung an dieser Datei hätte den Widerspruch verdeckt statt ihn zu
lösen. Weitergereicht in §16.

**Ausnahmen von der Dateihoheit, angesagt.** Zwei additive Zeilen in
`package.json`: `"./util": "./src/util/index.ts"` in
`packages/bpmn/package.json#exports` und `"@grc/bpmn": "^0.1.0"` in
`packages/shared/package.json#dependencies`. Ohne die zweite liefe der Import
zwar (der npm-Workspace symlinkt), aber nur zufällig — `STUFE2-B2-EINBINDUNG.md`
§5.2 hat genau das für `apps/web` als untragbar benannt, und dieselbe
Begründung gilt hier.

**Wächter.** Zwei neue Dateien, 23 Zusicherungen:
`tests/bpmn-parser-namespaces.test.ts` (dasselbe Dokument unter fünf Präfixen
liefert dasselbe; ein fremder Namensraum wird abgelehnt; Dokumentreihenfolge;
Fremdelemente bleiben draußen) und `tests/bpmn-extract.test.ts` — jede Zeile
dort ist ein Fall, den die alte Regex-Fassung nachweislich falsch machte, und
die letzten drei sind die **ersten Tests überhaupt** für `deriveRACIFromBPMN`
und `deriveWalkthroughFromBPMN`.

---

## 12. OP-160 — die zweite, veraltete `MISSING_TODAY`

**Befund (Register B.1):** `bpmn-grc-bridge.ts` führt zehn Einträge; acht davon
behaupten fehlende Tabellen und Spalten, die es seit den Migrationen
`0444`–`0454` gibt. Der vorhandene Wächtertest prüft nur die Liste in
`lib/grc-overlay.ts` — die falsche Liste hat keinen.

**Reproduktion.** Alle acht gegen den Code geprüft, alle acht bestätigt:

| Behauptung der alten Liste                                 | Wirklichkeit                                   |
| ---------------------------------------------------------- | ---------------------------------------------- |
| „keine Lane-Tabelle (`process_lane`) und keine `sod_rule`" | `0444_process_lane.sql`, `0446_sod_rule.sql`   |
| „`process_step_raci` fehlt"                                | `0447_process_step_raci.sql`                   |
| „`process_step.step_key` existiert nicht"                  | `0445`; `grc-overlay.ts:946` liefert `stepKey` |
| „`finding.due_at` existiert im Schema nicht"               | `grc-overlay.ts:856` liefert `dueAt`           |
| „`process_step_ropa`, `_bia`, `_document` fehlen"          | `0448`, `0449`, `0450`                         |
| „ohne `process_event_activity_map` keine Zuordnungsquote"  | `0451`                                         |
| „Vorfälle und Maßnahmen haben keinen Elementbezug"         | `0454_element_level_links.sql`                 |
| „`/call-links` liefert nur Name und ID" (kein Roll-up)     | `grc-overlay.ts:988` rechnet es                |

**Reparatur.** Die eigene Liste ist gestrichen; die Brücke reicht die
maßgebliche durch (`export { MISSING_TODAY } from "@/lib/grc-overlay"`). An
ihre Stelle tritt `BRIDGE_LIMITS` — und der Unterschied ist die **Art der
Aussage**: `MISSING_TODAY` sagt, was das _Produkt_ nicht erhebt; `BRIDGE_LIMITS`
sagt, was die vier alten Routen nicht ausliefern. Keine Zeile dort nennt eine
fehlende Tabelle, denn es gibt alle. Verschwimmt der Unterschied, entsteht die
Dublette von Neuem.

**Wächter — drei Zusicherungen, weil der Befund drei Teile hat.**

1. Die Brücke reicht durch (`toBe`, Objektidentität), führt also keine zweite
   Liste mehr.
2. **Keine** der beiden Listen darf behaupten, eine der neun widerlegten
   Tabellen/Spalten fehle — geprüft mit einem Muster über den Begründungstext,
   für beide Listen.
3. Jede Zeile in `BRIDGE_LIMITS` begründet mit dem, was eine **Route** liefert.

Der zweite ist der, den es vorher nicht gab und der die Wiederholung
verhindert.

---

## 13. OP-045 — Choreographie und Konversation: zurückgestellt

**Zurückgestellt, wie im Auftrag als Kandidat benannt.** Die Begründung ist
nicht „keine Zeit", sondern:

1. **Der Bedarf ist nicht belegt.** Kein Element von `bpmn:Choreography*` oder
   `bpmn:Conversation*` kommt in einer der 26 Korpusdateien vor, in keinem der
   eingecheckten Seed-Diagramme und in keiner der Bestandsaufnahmen
   (`inventar_bpmn_elementtypen.csv` führt acht Knotentypen).
2. **Das Produkt bietet es nicht an.** Plan N1 nennt es ausdrücklich als
   Nicht-Ziel; der Paletten-Katalog (`src/editor/catalog.ts`) begründet in
   seinem Kopf, warum er 17 statt 60 Einträge führt — genau um die
   Modellierungsfehler zu vermeiden, die eine überfüllte Palette erzeugt.
   Choreographien zeichnen zu können, ohne sie modellieren zu können, wäre eine
   halbe Funktion.
3. **Der Ausfall ist bereits sichtbar und nicht still.** Ein nicht
   unterstützter Typ wird als gestricheltes Rechteck mit Typnamen und
   `data-unsupported="true"` gezeichnet, und der Korpustest prüft, dass im
   gesamten Korpus **kein einziges** solches Element auftritt. Ein Dokument mit
   Choreographien würde also sofort auffallen, statt lautlos falsch auszusehen.

Das Register führt OP-045 selbst unter „Streichkandidaten" (Abschnitt E).
**Empfehlung: streichen**, mit Wiedervorlage, sobald ein Kunde eine
Choreographie-Datei einreicht — dann sind es die im Spike geschätzten ~200
Zeilen und ein klarer Anlass.

---

## 14. Abnahme

Alle Zahlen aus Läufen dieser Arbeit am 2026-09-02/03.

| Prüfung                                           | vorher                   | nachher                  |
| ------------------------------------------------- | ------------------------ | ------------------------ |
| `packages/bpmn` — `npx vitest run`                | 739 Tests / 45 Dateien   | **829 / 53**, grün       |
| davon aus dieser Welle                            | —                        | **53 Tests / 4 Dateien** |
| `packages/shared` — `npx vitest run`              | 1.950 / 82               | **1.973 / 84**, grün     |
| davon aus dieser Welle                            | —                        | **23 Tests / 2 Dateien** |
| `apps/web` — `npx vitest run`                     | 2.545 / 108 (abgeleitet) | **2.562 / 110**, grün    |
| davon aus dieser Welle                            | —                        | **17 Tests / 2 Dateien** |
| `tsc --noEmit` `packages/bpmn`                    | 0 Fehler                 | **0**                    |
| `tsc --noEmit` `packages/shared`                  | 0 Fehler                 | **0**                    |
| `tsc --noEmit` `apps/web/tsconfig.json`           | 0 Fehler                 | **0**                    |
| `audit-i18n-usage --max-untranslated 151`         | RESULT: OK               | **RESULT: OK** (151/151) |
| `a11y/nested-interactive` + `a11y/contrast-pairs` | 13 grün                  | **13 grün**              |
| Referenzbilder (`test/verify/baseline/*.png`)     | —                        | **unverändert**          |

**Zu den drei Zahlen im Einzelnen.**

- **`packages/bpmn` 739 → 829.** Davon 53 aus dieser Welle. Die übrigen 37
  stammen aus dem parallel laufenden Strang 2a, der im selben Arbeitsbaum
  arbeitet (`src/modeling/**`, `src/verify/**`). Während der Messung war
  `test/modeling/labels.test.ts` einmal rot — Ursache war eine damals
  halbfertige Änderung an `src/modeling/BpmnLayouter.ts`, also fremde
  Dateihoheit; beim Abschlusslauf ist alles grün.
- **`apps/web` „vorher" ist abgeleitet, nicht gemessen** — 2.562 minus die 17
  Zusicherungen dieser Welle. Ein eigener Ausgangslauf wurde nicht gemacht;
  das ist die einzige Zahl dieser Tabelle, die nicht aus einem eigenen
  Ausgangslauf stammt, und sie ist deshalb so gekennzeichnet.
- **i18n 151/151.** Die Ratsche steht exakt auf dem Budget. Vier neue Schlüssel
  (`bpmn.chrome.disabledReason`, `bpmn.plane.*`) in `messages/{de,en}/bpmn.json`
  **und** im Laufzeitbündel `messages/{de,en}.json` — die zweite Hälfte prüft
  dasselbe Skript und war der erste Fehlschlag.

**Gegenproben.** Für jede Reparatur wurde der Defekt künstlich wieder
eingebaut und der Lauf beobachtet:

| Punkt      | Rückbau                                      | rot      |
| ---------- | -------------------------------------------- | -------- |
| OP-018     | `drillDown` → `return false`                 | 5 von 14 |
| OP-031/032 | Modulregistrierung und `Strg+Umschalt+A` weg | 5 von 15 |
| OP-019     | `asBoundaryItem` auf „nur Randereignisse"    | 3 von 9  |
| OP-028/029 | alte `chrome`-Zeile, `restoreSnapshot` weg   | 2 von 11 |
| OP-046     | drei Zeichenpfade ausgehängt                 | 6 von 15 |

---

## 15. Korrekturen am Register

| Punkt      | Was das Register sagt                                                                                                    | Was der Code sagt                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OP-019** | Abhängigkeit: „nicht zeitgleich mit Auto-Resize (OP-020) ändern"; A1 §7: das Verhalten fehlt in der Modellierungsschicht | `BpmnRules.canAttach` lässt Zwischenereignisse **ausdrücklich** zu, `replaceShape` existiert. Der Punkt liegt vollständig in der Bedienschicht; die Abhängigkeit besteht nicht.                            |
| **OP-031** | „Module vorhanden, Palette-Einträge und Zustandsmodell fehlen"                                                           | Die Module waren **nicht registriert**; `injector.get("lassoTool", false)` lieferte `null`. Der Punkt war größer als gemeldet.                                                                             |
| **OP-038** | „Die schmalere App-Fassung kennt weder `ModdleWarning` noch die zweiargumentige `toXML`-Signatur"                        | Beide Fassungen sind heute substanzgleich; der gemeldete Typfehler tritt nicht auf. Offen ist nur die Dublette selbst — jetzt mit Wächter.                                                                 |
| **OP-037** | „1.529 Zeilen in sechs Dateien" (Codequalität)                                                                           | Vier Dateien lesen BPMN (1.102 Zeilen); `bpmn-diff` benutzt den Parser, `excel-to-bpmn` **schreibt** BPMN. Und: **Produktdefekt**, nicht nur Codequalität — `ns0:`/`semantic:`-Dokumente wurden abgelehnt. |
| **OP-018** | „Der Importer zeichnet nur die erste `BPMNPlane`"                                                                        | Zeichenschicht und Importer können jede Ebene seit dem Spike (`diagramIndex`) und **warnen** sogar darüber. Es fehlte die Navigation, nicht das Zeichnen.                                                  |
| **OP-046** | Sieben Kleinlücken, „einzeln 15–30 LOC"                                                                                  | Fünf davon trifft das. Label-Kollision und Clipping sind keine Kleinlücken, sondern Entscheidungen über den Vertrag der Zeichenschicht (§10).                                                              |
| **OP-026** | „eine Zeile Verdrahtung je Stelle"                                                                                       | Vier Teile je Stelle. Einmal gebaut statt viermal kopiert — sonst wäre es der Befund aus `UMSETZUNG-WELLE-1C.md` §1 in neuer Form.                                                                         |
| **OP-045** | „Streichkandidat, solange das Produkt Choreographien nicht anbietet"                                                     | Bestätigt und belegt: null Vorkommen im Korpus, null in der Bestandsaufnahme, Plan N1 nennt es als Nicht-Ziel. **Empfehlung: streichen.**                                                                  |

---

## 16. Was an die folgenden Wellen weitergeht

**An den Strang, dem `packages/bpmn/src/modeling/` gehört (Welle 2a oder
später):**

- **Mehrere Ebenen gleichzeitig importieren.** Der Ebenenwechsel im
  Bearbeitungsmodus beendet heute die Rückgängig-Kette, weil `importer.import`
  das Wurzelelement der zweiten Ebene unter der Kennung des Subprozesses
  anlegt und damit mit dessen Form der ersten Ebene kollidiert
  (`Error: element <Sub_L1> already exists`). Der Weg ist der von `bpmn-js`:
  dem Ebenen-Wurzelelement eine eigene Kennung geben (`<id>_plane`) und alle
  Ebenen in einem Durchlauf importieren; `canvas.setRootElement` schaltet dann
  nur um. `BpmnCanvas.showPlane` ist darauf vorbereitet — es müsste nur den
  Zweig für den Neuaufbau verlieren.
- **Die zwei ambienten `declare module "bpmn-moddle"` zusammenführen.**
  `apps/web/src/types/bpmn-moddle.d.ts` löschen und die Fassung des Pakets
  maßgeblich machen. Der Wächter
  (`apps/web/src/__tests__/components/bpmn-moddle-declaration.test.ts`) hält sie
  bis dahin in Deckung; nach dem Löschen wird seine dritte Zusicherung („genau
  zwei") auf eine zu ändern sein.

**An Welle 4 (Test- und Codequalität):**

- **OP-027 bekommt vier neue Kandidaten.** Die Bedienfunktionen dieser Welle
  sind in jsdom geprüft; was jsdom nicht kann, ist der **Zug**: Lasso-Rahmen,
  Platz-Trennlinie und Hand-Ziehen laufen im Browser und sind hier nur über
  ihre Tastatur-Zwillinge belegt. Ein E2E-Test, der den Canvas bedient, sollte
  mit diesen dreien anfangen — sie sind die einzigen Bedienfunktionen des
  Editors, deren Mausweg gar keinen Nachweis hat.
- **`bpmn-validator.ts` (358 Zeilen).** Die Umstellung des XML-Lesers ist
  zwanzig Zeilen; die eigentliche Frage ist, ob seine 25 fachlichen Prüfungen
  neben `packages/bpmn/src/modeling/invariants.ts` stehen bleiben. Das ist eine
  Entscheidung über die Architektur, nicht über eine Datei — und sie gehört zu
  demselben Schnitt wie OP-043 (XSD-Validator).

**An Welle 3 (GRC-Oberfläche):**

- **Die Ebenen-Brotkrume ist die Stelle, an der der Drill-down der GRC-Schicht
  ankommen kann.** `plane.changed` liefert Index und Pfad; eine Sicht, die auf
  Ebene 2 andere Zahlen zeigt als auf Ebene 1, hat damit den Haken, den sie
  braucht. Heute rechnet die Roll-up-Rechnung über alle Ebenen (Register B.9);
  das bleibt richtig, ist aber ab jetzt eine Wahl und keine Notlösung mehr.

**An die Entscheidung des Eigentümers:**

- **OP-045 streichen.** Belegt in §13. Ohne einen Kunden, der eine
  Choreographie-Datei einreicht, ist es Arbeit ohne Adressat — und der
  Ausfallweg ist sichtbar, nicht still.

**Offen geblieben, ohne Nachfolger:**

- **Label-Kollisionsvermeidung** und **Clipping am Subprozessrand** (§10). Beide
  sind Entscheidungen über den Vertrag der Zeichenschicht — die erste berührt
  Zusicherung Z-D, die zweite die Zeichenreihenfolge, den SVG-Export und die
  a11y-Ordnung. Sie gehören zusammen mit dem Layoutthema aufgerufen, nicht
  einzeln nachgezogen.
