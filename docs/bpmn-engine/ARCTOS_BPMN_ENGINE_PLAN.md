# ARCTOS — Technischer Plan: eigene BPMN-Engine auf `diagram-js` + `bpmn-moddle`

**Stand:** 2026-09-01 · **Grundlage:** `BESTANDSAUFNAHME.md` (Erhebung 2026-09-01,
Repo `/work/repo`, Branch `audit/full-2026-08-31`, nur gelesen) und die vier
Beilage-CSVs. Dieses Dokument wiederholt die Messung nicht, es baut darauf auf.
Wo hier Zahlen stehen, die nicht aus der Bestandsaufnahme stammen, sind sie als
**Schätzung** oder **Annahme** gekennzeichnet.

**Zielgruppe:** Entwicklung, Architektur, Produktverantwortung. Der Plan ist die
Grundlage für ein Vorhaben in der Größenordnung mehrerer Personenmonate; er soll
entscheidbar machen, ob und in welcher Reihenfolge man es angeht.

---

## Inhalt

1. [Ziel und Nicht-Ziele](#1-ziel-und-nicht-ziele)
2. [Architektur](#2-architektur)
3. [Das GRC-Diagramm — der fachliche Kern](#3-das-grc-diagramm--der-fachliche-kern)
4. [Barrierefreiheit von Anfang an](#4-barrierefreiheit-von-anfang-an)
5. [Migration und Kompatibilität](#5-migration-und-kompatibilität)
6. [Testfundament](#6-testfundament)
7. [Arbeitspakete, Reihenfolge, Aufwand](#7-arbeitspakete-reihenfolge-aufwand)
8. [Risiken und Alternativen](#8-risiken-und-alternativen)

---

# 1. Ziel und Nicht-Ziele

## 1.1 Die vier Vorgaben des Eigentümers — und was sie technisch bedeuten

| #   | Vorgabe                                                                | Technische Übersetzung                                                                                    | Kostenträger                                  |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | Kein bpmn.io-Wasserzeichen, keine kommerzielle Lizenz                  | `bpmn-js` muss vollständig aus `apps/web/package.json` und dem Lockfile verschwinden                      | ~127 PT auf dem kritischen Pfad (§7)          |
| 2   | Besser als das, was man kaufen kann                                    | Der Unterschied liegt nicht im BPMN-Editor, sondern in dem, was ARCTOS über den Prozess _weiß_ — siehe §3 | ~130 PT, unabhängig von Vorgabe 1             |
| 3   | Alle sinnvollen GRC-Features am Diagramm nutzbar                       | 36 Fachobjekte, heute 5 sichtbar → Layer-Konzept, Schema-Migrationen, Aggregations-API (§3)               | in 2 enthalten                                |
| 4   | Viewer = Editor mit deaktiviertem Editor, keine zweite Implementierung | Eine Komponente, modulbasierter Moduswechsel (§2.4)                                                       | ~4 PT — **heute schon auf `bpmn-js` machbar** |

**Wichtigste Einordnung vorweg:** Vorgabe 1 ist die teuerste und trägt zu Vorgabe 2
nichts bei. Vorgabe 4 braucht die Ablösung nicht. Vorgaben 2 und 3 — der fachliche
Kern — sind auf `bpmn-js` genauso umsetzbar wie auf einer Eigenimplementierung,
weil sie ausschließlich auf `overlays`, `canvas` und `elementRegistry` beruhen, und
das sind unveränderte `diagram-js`-APIs (Bestandsaufnahme 4.2). Die Konsequenz für
die Reihenfolge steht in §7.4 und §8.4.

## 1.2 Lizenzlage — präzise

**Was MIT ist und bleibt:**

| Paket                                                                                | Version              | Lizenz | Rolle nach der Ablösung                        |
| ------------------------------------------------------------------------------------ | -------------------- | ------ | ---------------------------------------------- |
| `diagram-js`                                                                         | 15.22.0 (31.844 LOC) | MIT    | **direkte** Abhängigkeit (heute nur transitiv) |
| `bpmn-moddle`                                                                        | 10.0.0               | MIT    | bleibt direkte Abhängigkeit                    |
| `moddle`, `moddle-xml`, `saxen`                                                      | 8.1.0 / 12.0.0       | MIT    | transitiv über `bpmn-moddle`                   |
| `diagram-js-direct-editing`                                                          | 3.5.1                | MIT    | direkte Abhängigkeit (heute transitiv)         |
| `tiny-svg`, `min-dom`, `min-dash`, `didi`, `object-refs`, `path-intersection`, `ids` | —                    | MIT    | transitiv über `diagram-js`                    |
| `inherits-browser`                                                                   | 0.1.0                | ISC    | transitiv                                      |
| `diagram-js/assets/diagram-js.css`                                                   | —                    | MIT    | **verwendbar** — eigene Datei des MIT-Pakets   |

**Was die Klausel trägt:** ausschließlich `bpmn-js@18.21.0`
(`SEE LICENSE IN LICENSE`, Camunda Services GmbH). Der Lizenztext ist MIT-artig mit
einer Zusatzbedingung:

> The source code responsible for displaying the bpmn.io project watermark that
> links back to https://bpmn.io as part of rendered diagrams MUST NOT be removed or
> changed. When this software is being used in a website or application, the
> watermark must stay fully visible and not visually overlapped by other elements.

Das Wasserzeichen (`.bjs-powered-by`) wird von `bpmn-js` selbst erzeugt, nicht von
`diagram-js`. `diagram-js` rendert kein Wasserzeichen und hat keine entsprechende
Klausel. Eine Implementierung, die `diagram-js` + `bpmn-moddle` benutzt und
`bpmn-js` nicht enthält, unterliegt der Klausel nicht.

**Drei Fallstricke, die das aushebeln würden:**

1. **Codeübernahme.** Wer Quelltext aus `bpmn-js` (Renderer, `PathMap`, `BpmnRules`,
   Behaviors) kopiert und anpasst, überträgt damit die Lizenz **einschließlich** der
   Wasserzeichenklausel auf das Ergebnis. Die LOC-Zahlen aus der Bestandsaufnahme
   (27.401 gesamt, 10.922 `features/modeling`, 3.328 `draw`) sind **Umfangsindikator,
   keine Quelle.** Als Vorgabe: `bpmn-js` darf als Referenz gelesen werden, aber
   kein Codeblock, kein Pfad-`d`-String, keine Regeltabelle wird übernommen. Das ist
   im Code-Review als Prüfpunkt zu verankern und in der Commit-Historie
   nachvollziehbar zu halten.
2. **Assets.** `bpmn-font` liegt physisch unter
   `node_modules/bpmn-js/dist/assets/bpmn-font/` — Woff/Woff2/TTF/EOT/SVG plus drei
   CSS-Dateien. Sie fällt mit `bpmn-js` weg. _Annahme:_ das Oberpaket `bpmn-font`
   ist eigenständig auf npm unter MIT verfügbar; **vor** AP3 zu verifizieren
   (`npm view bpmn-font license`). Wenn ja, kann die Icon-Font direkt eingebunden
   werden und AP3 wird um ca. 3 PT billiger. Wenn nein, braucht ARCTOS eigene
   BPMN-Icons (SVG-Sprites, ~24 Symbole).
   Ebenso: `bpmn-js/dist/assets/bpmn-js.css` fällt weg; `diagram-js.css` gibt es
   MIT-lizenziert im `diagram-js`-Paket selbst.
3. **Parallelbetrieb.** Solange `bpmn-js` im Bundle ausgeliefert wird — auch hinter
   einem Feature-Flag, auch wenn nur eine Handvoll Organisationen es sehen — wird die
   Software „in a website or application" benutzt, und das Wasserzeichen muss auf den
   von ihr gerenderten Diagrammen sichtbar bleiben. **Kriterium für den Wegfall ist
   nicht das Umschalten des Flags, sondern das Entfernen des Pakets.**

**Was bis dahin gilt** (unverändert einzuhalten):
`scripts/license-gate.mjs:68` (`ACKNOWLEDGED["bpmn-js"].requiresWatermark = true`),
`scripts/license-gate.mjs:130` (`checkBpmnWatermark()` mit fünf Mustern über `apps/`
und `packages/`), `apps/web/src/components/bpmn/bpmn-editor.css:14-46`, `NOTICE:38`,
`THIRD-PARTY-LICENSES.md:41`. Während des Parallelbetriebs muss der Gate
**verschärft**, nicht gelockert werden: er darf das neue Modul nicht mitprüfen (dort
gibt es keine `.bjs-powered-by`-Klasse), muss aber weiter garantieren, dass der
`bpmn-js`-Pfad das Wasserzeichen zeigt. Konkret: der Musterscan bleibt, der
`ACKNOWLEDGED`-Eintrag bleibt, und es kommt eine Prüfung dazu, dass
`packages/bpmn-engine/**` keinen `bpmn-js`-Import enthält.

Nach dem Entfernen (AP10) sind alle fünf Verankerungen anzupassen, sonst schlägt der
Gate mit „ACKNOWLEDGED-Eintrag ohne Paket" fehl oder wird stumm.

## 1.3 Ziele

- **Z1** Diagramme in ARCTOS ohne fremdes Wasserzeichen darstellen und bearbeiten,
  ohne Lizenzkosten und ohne Lizenzverstoß.
- **Z2** BPMN-2.0-XML aus `process_version.bpmn_xml` **verlustfrei** lesen und
  schreiben, einschließlich fremder `extensionElements` und der ARCTOS-Extension —
  Kriterium: kanonische Äquivalenz und Idempotenz, nicht Byte-Gleichheit (§5.1).
- **Z3** Der Umfang der unterstützten BPMN-Elemente deckt die real vorkommenden
  Typen ab (Bestandsaufnahme 1.4b: 8 real, 25 vom Code gekannt) plus die für GRC
  fachlich notwendigen, die heute fehlen: `lane`/`laneSet`, `participant`/
  `collaboration`, `dataObjectReference`/`dataStoreReference`, `textAnnotation`/
  `association`, `boundaryEvent`, `messageFlow`, `parallelGateway`.
- **Z4** Eine Komponente, drei Modi (`edit`, `review`, `read`) — gleiche Formen,
  gleiche Schrift, gleiche Marker, gleiche Tastaturbedienung.
- **Z5** Jedes fachlich sinnvolle GRC-Objekt ist am Diagramm sichtbar oder mit einem
  Klick erreichbar, ohne dass das Diagramm unlesbar wird (§3).
- **Z6** WCAG 2.2 AA für den Diagrammbereich, inkl. Tastaturnavigation _im_ Graphen —
  also über den heutigen, ausdrücklich beschränkten Stand hinaus
  (`bpmn-a11y.tsx:29-33`).
- **Z7** Ein Testfundament, das _vor_ der Implementierung steht. Heute rendert kein
  einziger Test Editor oder Viewer.

## 1.4 Nicht-Ziele

- **N1 Kein vollständiger BPMN-2.0-Editor.** Choreographie, Konversation, Compensation,
  Transaktionen, Multi-Instance-Feinheiten, Event-Subprozesse: nicht im Umfang. Wenn
  ein Bestandsdiagramm sie enthält, werden sie **importiert, gerendert und
  unverändert wieder ausgegeben**, aber nicht bearbeitbar gemacht (siehe §5.3,
  „Read-preserve-write").
- **N2 Keine Ausführungssemantik.** Kein Zeebe/Camunda-Deployment, kein FEEL-Editor,
  keine Token-Ausführung im Engine-Sinn. (Eine _Visualisierung_ von
  Simulationsergebnissen ist dagegen sehr wohl Ziel — §3.8.)
- **N3 Kein DMN-Editor.** `dmn_decision` bleibt eine Datentabelle mit Verknüpfung;
  ein Entscheidungstabellen-Editor ist ein eigenes Vorhaben.
- **N4 Keine Echtzeit-Kollaboration** in diesem Vorhaben. Die Architektur darf sie
  aber nicht ausschließen: alle Modelländerungen laufen über den `CommandStack`,
  damit ein späterer CRDT-/OT-Aufsatz möglich bleibt.
- **N5 Kein Fork von `bpmn-js`.** Rechtlich ausgeschlossen (§1.2, Fallstrick 1).
- **N6 Keine Ablösung von `packages/shared/src/bpmn-*.ts`** in diesem Vorhaben —
  aber die Divergenz zwischen den beiden BPMN-Interpretationen wird zum Risiko
  erklärt und mit einer gemeinsamen Testsuite gedeckelt (§6.7).
- **N7 Kein Anspruch auf Byte-Gleichheit** beim Round-Trip. Siehe §5.1; die Vorgabe
  „bit-treu" wird dort begründet durch ein schärferes, aber erreichbares Kriterium
  ersetzt.

---

# 2. Architektur

## 2.1 Schichtenmodell

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L5  ARCTOS-Anwendung (unverändert bis auf 3 Importstellen)              │
│     processes/[id]/page.tsx · my-processes/[id]/page.tsx                │
│     arctos-properties-panel.tsx · shape-side-panel.tsx · risk-link-…    │
├─────────────────────────────────────────────────────────────────────────┤
│ L4  React-Fassade   apps/web/src/components/bpmn/                       │
│     <BpmnCanvas>  — wählt Implementierung (Flag), hält Ref-API,         │
│                     Overlays, Toolbar, Textalternative                  │
│     bpmn-a11y.tsx (erweitert) · bpmn-toolbar.tsx (unverändert)          │
├─────────────────────────────────────────────────────────────────────────┤
│ L3  packages/bpmn-engine   ← DAS IST DAS VORHABEN                       │
│     grc/       Layer-Engine, Dekoratoren, Aggregations-Client           │
│     palette/ context-pad/ replace/ label-editing/                       │
│     modeling/  BpmnFactory · BpmnUpdater · BpmnRules · BpmnLayouter     │
│     draw/      ArctosBpmnRenderer · Pfad-/Textlayout · Marker           │
│     import/    moddle-Baum + DI  →  diagram-js-Shapes/Connections       │
│     export/    diagram-js + moddle → XML · SVG · PNG · PDF              │
│     a11y/      Graphnavigation, Live-Region, Fokusordnung               │
├─────────────────────────────────────────────────────────────────────────┤
│ L2  bpmn-moddle 10 (MIT) — BPMN-Metamodell, fromXML/toXML,              │
│     Extension-Packages (arctos), Erhalt unbekannter Elemente            │
│     + ids (MIT) für kollisionsfreie BPMN-IDs                            │
├─────────────────────────────────────────────────────────────────────────┤
│ L1  diagram-js 15.22 (MIT) — Canvas, ElementRegistry, EventBus,         │
│     GraphicsFactory, CommandStack, BaseRenderer, Layout-Basis,          │
│     44 Features (overlays, selection, palette-Rahmen, context-pad-      │
│     Rahmen, popup-menu, move, create, connect, resize, bendpoints,      │
│     snapping, copy-paste, align, search, keyboard, …), navigation/      │
│     + diagram-js-direct-editing (MIT)                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ L0  tiny-svg · min-dom · min-dash · didi (DI-Container) — MIT           │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2.2 Was nicht nachgebaut wird

`diagram-js@15.22.0` liefert vollständig und unverändert (Bestandsaufnahme 4.2):
Canvas mit Viewport/Zoom/Scroll/Layern/Markern, `ElementRegistry`, `EventBus`,
`GraphicsFactory`, `ElementFactory`, `CommandStack` **inklusive Undo/Redo**,
`BaseRenderer`, `BaseLayouter` mit Manhattan-Routing und
`CroppingConnectionDocking`, `lib/i18n`, sowie 44 Features und die
Navigations-Module `movecanvas`/`zoomscroll`/`keyboard-move`.

**Alle sechs heute benutzten Services existieren dort unverändert.** Der gesamte
Overlay-Code des Editors (5 Kanäle, ~230 Zeilen, `bpmn-editor.tsx:290-536`) läuft
1:1 weiter. Die Palette, das ContextPad und das Popup-Menü existieren als Rahmen;
nur ihre BPMN-Inhalte fehlen.

`bpmn-moddle@10.0.0` liefert das komplette BPMN-2.0-Metamodell, `fromXML`/`toXML`,
Referenzauflösung, Namespace-Deklarationen, den Erhalt unbekannter
Extension-Elemente und — entscheidend für ARCTOS — den
`moddleExtensions`-Mechanismus samt `xml.tagAlias`, `isAttr`, `isMany`,
`superClass`. Die Datei `arctos-moddle-extension.json` (9 Typen) wird
**unverändert** übernommen; ihr Verhalten hängt an `bpmn-moddle`, nicht an
`bpmn-js`, und trägt damit ohne Zutun herüber.

## 2.3 Was ARCTOS bauen muss — nach abzulösenden `bpmn-js`-Modulen

Die LOC-Spalte „bpmn-js" stammt aus der Bestandsaufnahme (4.1). Die Spalte
„ARCTOS-Umfang" ist eine **Schätzung** auf Basis: (a) reduzierter Elementumfang
(Z3: ~18 statt ~60 Formen), (b) Verzicht auf BPMN-Features, die ARCTOS nachweislich
nicht benutzt, (c) Aufschlag für die GRC-spezifischen Erweiterungen, die `bpmn-js`
nicht hat.

| Baustein                                                                                                                                                 |           `bpmn-js` LOC | ARCTOS-Umfang (geschätzt) | Ehrliche Einordnung                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------: | ------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `draw` — Renderer, Pfade, Textlayout                                                                                                                     |                   3.328 |               1.400–1.800 | **Mittel.** Die Formen selbst sind einfache SVG-Geometrie. Der Aufwand steckt im **Textlayout** (Zeilenumbruch, Zentrierung, externe Labels an Events/Gateways/Kanten) und in den Aktivitätsmarkern. Muss zusätzlich die GRC-Dekoration tragen (§3.3), das gibt es in `bpmn-js` nicht. |
| `import` — Importer, TreeWalker, DI-Abgleich                                                                                                             |                  ~1.100 |                   700–900 | **Gering bis mittel.** Mechanisch, aber fehleranfällig bei Sonderfällen: Labels ohne DI, Kanten ohne Waypoints, `bpmnElement`-Referenzen ins Leere, mehrere `BPMNDiagram`, Collaboration mit Pools. Gut testbar (§6.1).                                                                |
| `features/modeling` — `BpmnFactory`, **`BpmnUpdater`**, `BpmnRules`, ~30 Behaviors, `BpmnLayouter`                                                       |                  10.922 |               2.800–4.000 | **Hoch — der eigentliche Aufwand und das eigentliche Risiko.** Siehe §2.3.1.                                                                                                                                                                                                           |
| `features/palette` + `context-pad` + `replace` + `popup-menu`                                                                                            |                   3.199 |                 700–1.000 | **Gering.** Größter Freiheitsgrad: ARCTOS braucht eine kuratierte Palette (~12 Einträge), nicht die vollständige BPMN-Palette. Der `diagram-js`-Rahmen macht die Mechanik.                                                                                                             |
| `features/label-editing`                                                                                                                                 |                    ~700 |                   300–400 | **Gering.** `diagram-js-direct-editing` (MIT) trägt die Hauptlast; nachzubauen ist die BPMN-spezifische Positionierung/Größe des Editors je Elementtyp.                                                                                                                                |
| Export XML (DI-Pflege)                                                                                                                                   | in `modeling` enthalten |                   300–400 | **Mittel**, siehe §2.3.1 — hängt am Updater.                                                                                                                                                                                                                                           |
| Export SVG / PNG / **PDF (neu)**                                                                                                                         |    dünn in `BaseViewer` |                   250–350 | **Gering.** SVG ist Serialisierung des Canvas-SVG; PNG existiert bereits (`use-bpmn-editor.ts:56-93`); PDF ist neu (heute nicht vorhanden, `pdf-lib` ist im Repo).                                                                                                                     |
| Auto-Layout (in `bpmn-js` **nicht** enthalten)                                                                                                           |                       0 |                   600–900 | **Neu.** Heute gar nicht vorhanden; nötig für KI-/Excel-Import, wenn der Generator keine brauchbare DI liefert. Optional (AP17).                                                                                                                                                       |
| a11y-Graphnavigation (in `bpmn-js` nur rudimentär)                                                                                                       |                       — |                   500–700 | **Neu**, §4.                                                                                                                                                                                                                                                                           |
| GRC-Layer-Engine                                                                                                                                         |                       — |               1.200–1.800 | **Neu**, §3. Der Teil, der den Unterschied zum Kaufprodukt macht.                                                                                                                                                                                                                      |
| Komfort: `search`, `align/distribute`, `space-tool`, `copy-paste`, `outline`, `keyboard`-Bindings, `auto-place`, `auto-resize`, `snapping`-Konfiguration |         Rest der 27.401 |                   400–600 | **Gering** — der `diagram-js`-Anteil ist fertig, es fehlen nur die BPMN-Konfigurationen (welche Typen snappen wie, welche Tastenkürzel).                                                                                                                                               |

**Summe geschätzt: 9.150–12.850 LOC Produktivcode** plus etwa das Gleiche an
Testcode. Das ist knapp die Hälfte von `bpmn-js`, was plausibel ist, weil ein
Drittel des Umfangs dort auf BPMN-Konstrukte entfällt, die ARCTOS nicht anbietet
(N1), und ein weiterer Teil auf Bedienkomfort, den man stufenweise nachrüsten kann.

### 2.3.1 Wo der Aufwand wirklich liegt: `BpmnUpdater`

`diagram-js` verwaltet eine Grafik-Struktur (Shapes, Connections, Bounds,
Waypoints). `bpmn-moddle` verwaltet einen semantischen Baum (`bpmn:Process` mit
`flowElements`, `bpmn:SequenceFlow` mit `sourceRef`/`targetRef`) **und** einen
davon getrennten DI-Baum (`bpmndi:BPMNPlane` mit `BPMNShape`/`BPMNEdge`). Diese
drei Bäume müssen bei **jedem** Kommando synchron gehalten werden. Das leistet in
`bpmn-js` der `BpmnUpdater` — und das ist der Baustein, der darüber entscheidet, ob
das erzeugte XML gültig ist.

Beispiele für das, was dabei schiefgehen kann und deshalb explizit geplant sein muss:

- Eine Aktivität wird in eine Lane gezogen: der semantische Baum ändert sich nicht
  (`flowElements` bleibt am Prozess), aber `bpmn:Lane/flowNodeRef` muss umgehängt
  werden. Zieht man sie in einen SubProcess, ändert sich stattdessen der
  `flowElements`-Container — und die DI-Koordinaten wechseln von absolut zu
  container-relativ.
- Ein SequenceFlow wird umgehängt: `sourceRef`/`targetRef` **und** die
  `incoming`/`outgoing`-Listen beider Knoten **und** die `BPMNEdge`-Waypoints.
- Ein Element wird gelöscht: alle eingehenden/ausgehenden Flows, alle
  `flowNodeRef`-Einträge, alle `dataInputAssociation`, alle Boundary-Events, die
  daran hängen, und die zugehörige `BPMNShape`.
- Ein Pool wird gelöscht: die gesamte `bpmn:Collaboration` kann kollabieren, das
  Wurzelelement wechselt von `Collaboration` zurück zu `Process`.
- Neue Elemente brauchen kollisionsfreie IDs (`ids@3.0.2`) **und** eine
  `BPMNShape`, die in der richtigen Reihenfolge im `BPMNPlane` steht
  (`di-ordering`) — sonst rendern andere Werkzeuge falsch.

**Konsequenz für den Plan:** AP6 (Modeling-Kern) ist der kritische Pfad, hat die
größte Schätzunsicherheit (±50 %) und braucht die stärkste Absicherung
(Shadow-Compare-Speichern, §5.4; Property-Tests, §6.1). Wenn dieses Paket
entgleist, entgleist das Vorhaben.

### 2.3.2 Was gerade _nicht_ aufwendig ist

Die Integrationsfläche zwischen ARCTOS und `bpmn-js` ist winzig: fünf Services,
vier Instanzmethoden, eine Konstruktoroption, kein einziges eigenes Modul
(Bestandsaufnahme, Kernbefund). Die Umstellung des Anwendungscodes betrifft
**drei Importstellen** (`bpmn-editor.tsx:164-168`, `bpmn-viewer.tsx:97`), die
CSS-Importe und die Testmocks. Das ist ein Tag Arbeit. Wer den Aufwand des
Vorhabens am Anwendungscode abschätzt, unterschätzt ihn um zwei Größenordnungen;
wer ihn am `BpmnUpdater` abschätzt, liegt richtig.

## 2.4 Eine Komponente, zwei (drei) Modi

**Fassade.** Genau eine öffentliche React-Komponente:

```tsx
// apps/web/src/components/bpmn/bpmn-canvas.tsx
<BpmnCanvas
  xml={xml}
  mode="edit" | "review" | "read"
  chrome="full" | "minimal"        // Palette/ContextPad-Rahmen anzeigen?
  layers={activeLayers}            // §3.3
  onElementSelect={…} onChange={…} onSave={…}
  ref={ref}                        // saveXml, saveSvg, savePdf, undo, redo, canUndo, canRedo, focusElement, setLayers
/>
```

`bpmn-editor.tsx` und `bpmn-viewer.tsx` verschmelzen darin. Die heutige Trennung in
zwei Klassen (`Modeler` vs. `NavigatedViewer`) ist genau die Ursache dafür, dass
sich lesende und schreibende Ansichten unterschiedlich anfühlen — und sie ist
technisch nicht nötig.

**Modulzusammenstellung.** Der Modus bestimmt die Modulliste beim `didi`-Bootstrap:

| Modulgruppe                                                         | `read` |   `review`    |  `edit`   |
| ------------------------------------------------------------------- | :----: | :-----------: | :-------: |
| core, draw (ArctosBpmnRenderer), import, export                     |   ✔    |       ✔       |     ✔     |
| overlays, selection, interaction-events, outline, hover-fix         |   ✔    |       ✔       |     ✔     |
| navigation (zoomscroll, movecanvas), keyboard, `arctos/a11y`        |   ✔    |       ✔       |     ✔     |
| `arctos/grc` (Layer-Engine, Dekoratoren, Legende)                   |   ✔    |       ✔       |     ✔     |
| search, text-alternative, export-menu                               |   ✔    |       ✔       |     ✔     |
| `arctos/comments` (Kommentar-Pins, §3.7)                            | lesen  | **schreiben** | schreiben |
| modeling, rules, palette, context-pad, replace, popup-menu          |   —    |       —       |     ✔     |
| move, create, connect, resize, bendpoints, snapping, grid-snapping  |   —    |       —       |     ✔     |
| label-editing, copy-paste, align/distribute, space-tool, lasso-tool |   —    |       —       |     ✔     |

**Was daraus folgt — und das ist der Punkt der Vorgabe:** Renderer, Schriftmetrik,
Farbpalette, Marker, Layer, Tastaturnavigation, Seitenpanel und Textalternative sind
in allen drei Modi _dieselben Module mit derselben Konfiguration_. Ein Diagramm
sieht im Mitarbeiterportal pixelgleich so aus wie im Editor. Es gibt keine zweite
Formensprache mehr.

**„Deaktiviert statt versteckt" — mit einer Einschränkung.** Die Vorgabe ist richtig,
wo `readOnly` aus einem **fehlenden Recht** folgt: auf `processes/[id]` gilt heute
`readOnly = !canEdit`, und dort ist eine sichtbare, aber ausgegraute Palette mit
`aria-disabled="true"` und dem Hinweis „Bearbeitung erfordert die Rolle
Prozessmodellierer" ehrlicher als eine Oberfläche, die so tut, als gäbe es die
Funktion nicht. Sie ist **falsch**, wo `read` aus dem **Kontext** folgt: im
Mitarbeiterportal (`my-processes/[id]/page.tsx:289`) und im Versionsdialog
(`page.tsx:1680`) will niemand eine dauerhaft graue Werkzeugleiste sehen. Deshalb
die zusätzliche Achse `chrome="full" | "minimal"`: `full` zeigt deaktivierte
Bedienelemente mit Begründung, `minimal` lässt sie weg. Das ist eine bewusste
Abweichung von der wörtlichen Vorgabe, begründet mit dem Nutzungskontext.

**Moduswechsel zur Laufzeit.** Die heutige Komponente behandelt `readOnly` und
`initialXml` als reine Mount-Werte („Only mount once", `bpmn-editor.tsx`,
`useEffect(..., [])`) — ein Wechsel greift schlicht nicht. Neu: Ein Moduswechsel
führt eine kontrollierte Reinitialisierung durch und stellt **Viewbox, Zoomstufe,
Selektion, aktive Layer und Scrollposition** wieder her, sodass er für den Nutzer
wie ein Zustandswechsel aussieht, nicht wie ein Neuladen. Die aktuelle XML wird vor
dem Wechsel aus der laufenden Instanz gezogen, nicht aus dem Prop.

**Zwei Fehler aus dem Ist-Zustand, die dabei mitgehen (billig, sofort):**

- `canUndo`/`canRedo` werden in `page.tsx:1409` im Render aus `editorRef.current`
  gelesen, ohne dass `commandStack.changed` ein Re-Render auslöst — die Buttons
  bleiben faktisch deaktiviert. Die Fassade abonniert das Event und hält den Zustand
  in React. (~0,5 PT)
- `bpmn-editor.css:50` positioniert `.djs-minimap`, obwohl `diagram-js-minimap` nicht
  installiert ist. Entweder installieren (MIT, ~0,5 PT, echter Nutzen bei großen
  Diagrammen) oder die tote Regel entfernen.

## 2.5 Neuer Workspace

`packages/bpmn-engine` (`@grc/bpmn-engine`) als eigener Turborepo-Workspace, weil:

- die Engine framework-frei bleiben soll (kein React) — damit sie im Worker für
  serverseitiges Rendering (PDF-Export, Audit-Pack, Report-Vorschaubilder) und in
  Tests ohne Next.js benutzbar ist;
- die Testsuite dort ohne Next.js-Overhead läuft;
- die Abhängigkeitsrichtung erzwungen wird: `apps/web` → `@grc/bpmn-engine` →
  `diagram-js`/`bpmn-moddle`, und `@grc/bpmn-engine` importiert **nie** `bpmn-js`
  (ESLint-Regel + Lizenz-Gate, §1.2).

Öffentliche API des Pakets: `createBpmnCanvas(options)`, `importXml`, `exportXml`,
`exportSvg`, die Layer-Registry und die Typen. Kein Zugriff auf interne Module von
außen — der DI-Container bleibt gekapselt.

---

# 3. Das GRC-Diagramm — der fachliche Kern

Dies ist der Abschnitt, der den Unterschied zu einem gekauften BPMN-Werkzeug
begründet. Ein Kaufprodukt kann BPMN besser zeichnen als ARCTOS es je wird. Was es
nicht kann: wissen, dass die Aktivität „Zahlung freigeben" von derselben Rolle
verantwortet wird wie „Rechnung erfassen", dass die einzige wirksame Kontrolle
darauf seit 14 Monaten nicht getestet wurde, dass in Schritt 7 besondere Kategorien
personenbezogener Daten an einen Dienstleister in einem Drittland gehen, und dass
das alles gleichzeitig gilt.

## 3.1 Ausgangslage in Zahlen

36 Fachobjekte im Inventar (`inventar_grc_objekte.csv`):

- **A (5)** — auf Elementebene verknüpft **und** im Diagramm sichtbar:
  Risiko, Kontrolle, Feststellung, Line of Defense, Call Activity.
- **B (5)** — auf Elementebene verknüpft, **nicht** sichtbar:
  Asset am Schritt, RACI, EAM-Platzierung, Simulationsparameter, DMN-Entscheidung.
- **C (14)** — nur auf **Prozessebene** verknüpft, Elementebene fachlich sinnvoll.
- **D (12)** — gar nicht verknüpft, fachlich naheliegend.

26 Tabellen tragen `process_id`, 4 tragen `process_step_id`, 4 tragen eine rohe
BPMN-ID. `process_step` ist die einzige Brücke (`UNIQUE(process_id,
bpmn_element_id)`), und sie kennt nur 5 `step_type`-Werte — Lanes, Pools,
DataObjects und Artefakte landen **nie** in `process_step` und sind damit für jede
DB-gestützte Verknüpfung unsichtbar.

## 3.2 Grundsatzentscheidung: Was gehört ins XML, was in die Datenbank

Heute mischt ARCTOS beides, und zwar so, dass das XML zur zweiten, konkurrierenden
Wahrheit wird: `POST /api/v1/processes/:id/versions` ruft nach jedem Speichern
`rehydrateFromBpmnXml()`, das aus `arctos:riskRefs`/`controlRefs`/`documentRefs`
DB-Querverweise **zurückschreibt**. Gleichzeitig baut
`GET /versions/:vid/xml-with-grc-attrs` dieselben Elemente aus der DB wieder auf.
Es gibt keine definierte Richtung.

### Entscheidung

> **Die Datenbank ist die Wahrheit. Das XML trägt Struktur, Identität und —
> ausschließlich beim Export bzw. bei freigegebenen Versionen — eine erzeugte
> Projektion der GRC-Verknüpfungen.**

**Ins XML gehört:**

| Was                                                                              | Begründung                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BPMN-Struktur + DI                                                               | Definitionsgemäß.                                                                                                                                                                                                                                                                                                                                            |
| `arctos:grcMetadata/@stepKey` (**neu**, UUID)                                    | _Stabile Identität._ Heute hängt jede Elementverknüpfung an `process_step.bpmn_element_id`, also an einem String, den jedes fremde Werkzeug beim Re-Export neu vergeben kann. Ein zusätzlicher, im XML mitgeführter Schlüssel überlebt Umbenennungen und Round-Trips durch fremde Editoren. **Das ist die wichtigste einzelne Schemaänderung dieses Plans.** |
| `@lineOfDefense`, `@isCriticalProcess`, `@complianceProfile`, `@calledProcessId` | _Modelleigenschaften_, keine GRC-Datensätze. Sie beschreiben die Aktivität, nicht ein separat lebendes Objekt mit eigenem Lebenszyklus und eigener Berechtigung.                                                                                                                                                                                             |
| `arctos:ropa`, `arctos:bcmKpi`                                                   | Grenzfall. Entscheidung: sie bleiben im XML **als Projektion** (schreibend nur beim Export), weil ein VVT-Auszug portabel sein muss; die Wahrheit steht künftig in `process_step_ropa` bzw. `process_step_bia` (§3.9, §3.10).                                                                                                                                |
| `arctos:riskRefs`, `controlRefs`, `documentRefs`                                 | **Nur beim Export und in `version_type = 'released'`.** In der Arbeitskopie werden sie nicht geschrieben.                                                                                                                                                                                                                                                    |

**In die Datenbank gehört alles, was:**

1. **abfragbar** sein muss („zeig mir alle Prozesse mit unwirksamen Kontrollen") —
   XML in einer `text`-Spalte ist nicht abfragbar;
2. einen **eigenen Lebenszyklus** hat (ein Risiko lebt weiter, wenn der Prozessschritt
   gelöscht wird);
3. **RLS-geschützt** sein muss — und das ist das entscheidende Argument: eine
   `text`-Spalte hat keine zeilenbasierte Berechtigung. Wer heute XML importiert,
   kann über `rehydrateFromBpmnXml()` Verknüpfungen zu Risiken herstellen, die er
   selbst nicht sehen darf, und umgeht damit die Zugriffskontrolle;
4. **referenziert** wird (Fremdschlüssel, `ON DELETE`-Verhalten, Audit-Trail).

### Konsequenzen, die daraus zwingend folgen

- **`rehydrateFromBpmnXml()` ist kein Speicher-Seiteneffekt mehr.** Es wird zu einer
  ausdrücklichen Aktion „GRC-Verknüpfungen aus XML importieren" mit
  Vorschau-Differenz („12 Risikoverknüpfungen werden angelegt, 3 entfernt"),
  Berechtigungsprüfung je Zielobjekt und Eintrag im Audit-Trail. Beim normalen
  Speichern einer Arbeitsversion wird nichts rehydriert. _Das ist eine
  Verhaltensänderung mit Testabdeckung_ (`__tests__/lib/bpmn-arctos-rehydrate.test.ts`)
  und muss als solche geplant werden — sie steht in AP12.
- **Die Moddle-Extension wird versioniert.** `arctos:grcMetadata/@schemaVersion="2"`
  (Default beim Lesen: `"1"`). Neu in v2: `@stepKey`. `xml.tagAlias: "lowerCase"`
  bleibt unverändert, und `localType()` in `bpmn-arctos-parse.ts` bleibt
  case-insensitiv — sonst werden Altdaten stumm unlesbar (Bestandsaufnahme 1.6,
  Punkt 4).
- **Der Erhalt fremder `extensionElements` bleibt vertraglich zugesichert.**
  `injectGrcMetadataModdle` garantiert heute, dass camunda/zeebe-Elemente erhalten
  bleiben und ein vorhandenes `arctos:grcMetadata` **ersetzt statt dupliziert** wird.
  Das ist getestetes Verhalten und wird 1:1 in die neue Export-Schicht übernommen.
- **Der `@deprecated` Regex-Pfad** (`arctos-grc-extractor.ts`, 344 LOC) wird mit AP12
  entfernt, samt seines Tests.

## 3.3 Das Darstellungssystem — wie ein Diagramm mit 40 Aktivitäten und acht Objektarten lesbar bleibt

Das ist die schwierigste Gestaltungsfrage des Abschnitts. Die heutige Lösung —
fünf frei positionierte HTML-Overlays, vier davon per Einzelschalter zuschaltbar —
skaliert nicht auf 20 Objektarten. Vier Mechanismen lösen das zusammen.

### 3.3.1 Feste Slots statt freier Overlays

Jedes Shape hat ein festes Raster von Dekorationsplätzen. Kein Layer darf woanders
zeichnen.

```
       ┌──────────────────────────────┐
   [TL]│                              │[TR]        TL, TR, BL, BR : Badge-Slots (je 1 Layer)
   ▌   │      Rechnung prüfen         │            ▌               : LoD-Kante (4 px, fest belegt)
   ▌   │                              │            ◆               : Formkodierung (Füllung/Rand/Schraffur)
   ▌   │                              │            ▬▬▬             : Gutter (1 Zeile Kennzahlen)
   [BL]│                              │[BR]        ◉               : Pin-Schiene links außen (Kommentare)
       └──────────────────────────────┘
  ◉     ▬▬▬ 4,2 min · 18 € · 1.240×
```

- **4 Badge-Slots** (TL, TR, BL, BR) — heute schon so belegt (control/risk/call/finding).
- **1 Formkodierung** — Füllfarbe, Randfarbe oder Schraffur des Shapes selbst.
  Diese wird vom Renderer erzeugt, nicht als Overlay: nur so ist sie im SVG-/PNG-/
  PDF-Export enthalten und nur so bleibt sie beim Zoomen korrekt.
- **1 Gutter** unterhalb des Shapes — maximal eine Zeile, maximal drei Kennzahlen.
- **1 Pin-Schiene** links außerhalb — Kommentare und Anhänge, weil die auf jedes
  Element passen und nie mit fachlichen Signalen konkurrieren dürfen.
- **Kantendekoration:** Strichstärke (Häufigkeit), Farbe (Konformität), Beschriftung
  in der Mitte (Wartezeit, Wahrscheinlichkeit), Randstil (Vertrauensgrenze).

### 3.3.2 Slot-Budget mit Sammel-Badge

**Regel: höchstens drei Badge-Slots gleichzeitig belegt, höchstens eine
Formkodierung aktiv.** Die Layer-Engine löst Konflikte deterministisch:

1. Jeder Layer meldet `slot`, `priority` und ob er für dieses konkrete Element
   überhaupt etwas zu sagen hat (leere Layer belegen keinen Slot — ein Schritt ohne
   Risiken zeigt kein Risiko-Badge, das ist heute schon so).
2. Kollidieren zwei Layer auf einem Slot, gewinnt die höhere Priorität; der
   Verlierer geht in den **Sammel-Badge** im vierten Slot: `+2`.
3. Der Sammel-Badge öffnet auf Klick/Enter eine Liste der unterdrückten Signale mit
   direkter Navigation. Er ist nie leer und nie stumm — auch für Screenreader.

So degradiert ein überladenes Diagramm zu „drei Signale plus ein Hinweis, dass es
mehr gibt", statt zur Tapete.

### 3.3.3 Sichten statt Einzelschalter

Ein **Sicht** ist ein benanntes Preset: welche Layer an sind, welche Formkodierung
aktiv ist, welche Legende gezeigt wird, welche Spalten die Textalternative hat.
Nutzer schalten Sichten, nicht Layer. (Fortgeschrittene können Layer einzeln
zuschalten; das Budget aus 3.3.2 greift trotzdem.)

| Sicht                      | Formkodierung                   | TL                  | TR                  | BL                | BR                  | Gutter              | Kante                     |
| -------------------------- | ------------------------------- | ------------------- | ------------------- | ----------------- | ------------------- | ------------------- | ------------------------- |
| **Modellierung**           | Validierungsfehler (roter Rand) | —                   | —                   | —                 | Validierung         | —                   | —                         |
| **Risiko & Kontrolle**     | Restrisiko-Heat                 | Kontrollabdeckung   | Risiko-Ampel        | LoD/RACI          | Feststellungen      | —                   | —                         |
| **Compliance & Nachweis**  | Nachweisfrische                 | Framework-Chips     | Kontrolltest-Ampel  | Evidenz           | Feststellungen      | —                   | —                         |
| **Datenschutz**            | Personenbezug                   | Datenkategorie      | Besondere Kategorie | DPIA-Status       | Aufbewahrung        | Löschfrist          | Vertrauensgrenze          |
| **Kontinuität (BCM)**      | Kritikalität/MTPD               | Abhängige Anwendung | —                   | Ausweichverfahren | —                   | RTO/RPO             | —                         |
| **Betrieb & Effizienz**    | Mittlere Dauer                  | —                   | Engpass             | —                 | Rework              | Dauer·Kosten·Anzahl | Häufigkeit (Strichstärke) |
| **Organisation & SoD**     | Lane-Einfärbung                 | —                   | SoD-Konflikt        | R/A-Kürzel        | Qualifikationslücke | —                   | SoD-Bogen                 |
| **Architektur (EAM)**      | —                               | —                   | —                   | —                 | —                   | —                   | Zuordnungslinie           |
| **Verantwortung** (Portal) | —                               | —                   | —                   | R/A-Kürzel        | Dokument/SOP        | —                   | —                         |

Nur die Zeile „Modellierung" ist im `edit`-Modus voreingestellt. Ein Modellierer
will beim Zeichnen keine Heatmap.

### 3.3.4 Rollenvoreinstellungen

_Annahme: die Zuordnung erfolgt über die vorhandenen Rollen/Berechtigungen
(`custom_role`, `user_organization_role`); eine Tabelle für Nutzereinstellungen
existiert im Schema **nicht** und wird angelegt (§3.12)._

| Rolle                                       | Standardsicht                                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Prozessmodellierer / Prozesseigner (Editor) | Modellierung                                                                                              |
| Risikomanager, 2nd Line of Defense          | Risiko & Kontrolle                                                                                        |
| Interne Revision / Auditor                  | Compliance & Nachweis                                                                                     |
| Datenschutzbeauftragter                     | Datenschutz                                                                                               |
| BCM-Verantwortlicher                        | Kontinuität                                                                                               |
| Prozesseigner (Analyse-Tab), Operations     | Betrieb & Effizienz                                                                                       |
| IAM / Organisation                          | Organisation & SoD                                                                                        |
| Enterprise-Architekt                        | Architektur                                                                                               |
| Mitarbeiter (`my-processes`)                | **Verantwortung** — er will wissen: was ist mein Schritt, wer ist zuständig, welche Arbeitsanweisung gilt |

Die zuletzt gewählte Sicht wird je Nutzer und Prozessart gemerkt.

### 3.3.5 Drei Regeln, die nicht verhandelbar sind

1. **Nichts wird ausgeblendet.** Ein Filter („nur Schritte mit offenen
   Feststellungen") dimmt nicht passende Elemente auf 25 % Deckkraft, entfernt sie
   aber nie. Ein BPMN-Diagramm mit Löchern ist irreführend — der Betrachter kann
   nicht unterscheiden, ob ein Schritt fehlt oder gefiltert ist.
2. **Farbe ist nie der einzige Träger.** Jede Formkodierung hat zusätzlich eine
   Schraffur-Variante und einen Zahlenwert im Gutter oder Badge; jedes Ampelbadge
   trägt zusätzlich ein Formzeichen (▲ hoch / ■ mittel / ● niedrig). Begründung in §4.4.
3. **Jede Dekoration hat einen Text.** Jeder Layer implementiert
   `describe(element): string`. Ohne diese Methode wird der Layer nicht registriert —
   technisch erzwungen über das Interface, nicht durch Disziplin. Das ist die Lehre
   aus dem heutigen `lod-stripe`, der ohne `aria-label` WCAG 1.4.1 verletzen würde.

### 3.3.6 Datenbeschaffung: ein Endpunkt statt N

Heute holt der Editor die Overlay-Daten aus vier getrennten Quellen
(`useProcessStepRisks`, `/control-coverage`, `/findings`, `/call-links`). Bei 20
Layern wären das 20 Anfragen, teils mit N+1-Charakter. Neu:

```
GET /api/v1/processes/:id/diagram-overlay?version=:vid&layers=risk,control,finding,ropa,…
→ { elements: { "<bpmnElementId>": { risk: {...}, control: {...}, … } },
    edges:    { "<flowId>":        { … } },
    legend:   { … },
    computedAt, ttlSeconds }
```

Ein Aufruf, ein Cache-Eintrag, eine RLS-Prüfung, eine `computedAt`-Angabe für die
Anzeige „Stand: vor 3 Minuten". Layer, die der Nutzer nicht sehen darf, kommen nicht
zurück — die Filterung findet serverseitig statt, nicht im Browser.
Leistungsziel: < 400 ms für 200 Elemente × 6 Layer (**Schätzung**, in AP13 zu messen).

## 3.4 Objektgruppe A — was da ist und was besser wird

### A1 Risiko

- **Andockt an:** Task, UserTask, ServiceTask, SendTask, ReceiveTask,
  BusinessRuleTask, Gateway, SubProcess, CallActivity, **neu:** Lane.
- **Visuell:** Ampel-Badge TR mit `Anzahl · Höchstscore` (unverändert). **Neu:**
  Formkodierung „Restrisiko-Heat" — Füllung des Shapes in vier hellen Stufen
  (L\* ≥ 80, damit die Beschriftung 4,5:1 hält) plus Schraffur ab Stufe 3.
- **Neu — Aggregation:** ein SubProcess zeigt das Maximum und die Summe seiner
  Kinder; eine CallActivity zeigt das aggregierte Restrisiko des **Zielprozesses**
  (über `process_step.called_process_id`) — das ist etwas, das kein generischer
  Editor kann, weil er den Zielprozess nicht kennt. Eine Lane zeigt die
  Risikokonzentration ihrer Aktivitäten.
- **Klick:** Seitenpanel mit Titel, inhärentem/residualem Score, Eigentümer,
  Behandlung, Verknüpfung lösen. Doppelklick auf das Badge → Risikodetailseite.
- **Daten:** `risk`, `process_step_risk` (vorhanden), `process_risk` (Prozessebene,
  bleibt für nicht-elementbezogene Risiken).
- **XML/DB:** DB. `arctos:riskRefs` nur als Exportprojektion.

### A2 Kontrolle → **Kontrollabdeckung als Heatmap**

- **Visuell heute:** Badge TL `🛡 wirksam/gesamt`, vierstufig.
- **Neu:** Die Formkodierung „Kontrollabdeckung" beantwortet die Frage, die ein
  Auditor tatsächlich stellt: _nicht_ „wie viele Kontrollen hängen dran", sondern
  „welches Risiko ist hier unkontrolliert". Berechnung je Schritt:

  ```
  abdeckung = Σ(residualScore der Risiken am Schritt, die ≥1 wirksame Kontrolle haben)
              ─────────────────────────────────────────────────────────────────────────
              Σ(residualScore aller Risiken am Schritt)
  ```

  Stufen: kein Risiko (neutral) · vollständig abgedeckt (grün-Tint) · teilweise
  (gelb-Tint + feine Schraffur) · **Risiko ohne wirksame Kontrolle** (rot-Tint +
  grobe Schraffur). Der letzte Fall ist der Befund, wegen dem man das Diagramm
  öffnet. Zusätzlich Markierung von Schlüsselkontrollen (`control.is_key`, _Annahme:
  ein solches Feld existiert oder wird ergänzt_).

- **Daten:** `control`, `process_step_control`, `process_step_risk` — der Join über
  beide ist neu und gehört in den Aggregations-Endpunkt (§3.3.6), nicht in den Client.

### A3 Feststellung

- **Neu:** Fälligkeit statt nur Anzahl. Badge BR wird dreistufig: offen ·
  fällig in ≤ 14 Tagen · überfällig. Kritische Feststellungen bekommen zusätzlich
  einen Rand am Shape.
- **Daten:** `finding.process_step_id` / `.process_id` (beides vorhanden).

### A4 Line of Defense

- **Bleibt** als 4-px-Kante links mit `aria-label`.
- **Neu — Konsistenzprüfung:** ARCTOS kennt LoD je Schritt _und_ die RACI-Rolle je
  Schritt. Ein Schritt der 1. Verteidigungslinie, dessen einzige Kontrolle von
  derselben Rolle verantwortet wird, die die Aktivität ausführt, ist ein
  Selbstkontroll-Befund. Als Warnung im Layer „Organisation & SoD" (§3.11).

### A5 Call Activity / Subprozess

- **Bleibt:** Badge BL `↗ Zielprozess`, Doppelklick-Navigation.
- **Neu:** echtes Aufklappen von SubProcesses über die `root-elements` von
  `diagram-js` (heute wird `bpmn-js`' `drilldown`-Feature nicht benutzt), mit
  Brotkrumenpfad. Und: **Roll-up** — die GRC-Kennzahlen des Zielprozesses werden am
  CallActivity-Shape aggregiert angezeigt, mit Hinweis „geerbt". Ein Prozess, der
  einen unkontrollierten Teilprozess aufruft, ist selbst nicht kontrolliert; das ist
  heute nirgends sichtbar.

## 3.5 Objektgruppe B — verknüpft, aber unsichtbar

### B1 Asset / Anwendung am Schritt

`process_step_asset` existiert, `GET /steps/:id/assets` existiert, **es gibt keine
UI**. Zweifach zu heben:

- Symbol im Slot TL der Sicht „Architektur" bzw. „Kontinuität"; bei mehreren Assets
  das kritischste plus `+n`.
- Klick → Panel mit Assetname, Kritikalität, CIA-Profil, Eigentümer, offenen
  Schwachstellen.
- **Aufwand: gering** (Datenpfad komplett vorhanden). Gehört in AP14.

### B2 RACI / Rolle — und die Lücke bei C und I

Heute zwei parallele Mechanismen: `process_step.raci_responsible_role_id` /
`.raci_accountable_role_id` (Schrittebene, zwei Rollen) und
`process_raci_override(process_version_id, activity_bpmn_id, participant_bpmn_id,
raci_role char(1))` (Versionsebene, rohe BPMN-IDs). Dazu kommt die
Ableitungsmaschine `bpmn-raci-engine.ts` (Regex auf Lanes/Pools/MessageFlows).

**Befund:** _Consulted_ und _Informed_ haben auf Elementebene **keine
Datenbankheimat**. Sie existieren nur als Komma-String im XML
(`arctos:raci/@consultedRoleIds`, `@informedRoleIds`) — also genau in dem Medium,
das laut §3.2 keine Wahrheit sein darf, und ohne Fremdschlüssel auf `custom_role`.

- **Neue Tabelle** `process_step_raci(id, org_id, process_step_id, role_id,
raci_role char(1), source varchar(12) /* manual|derived|override */, …)` mit
  `UNIQUE(process_step_id, role_id, raci_role)`. Die zwei Spalten auf `process_step`
  bleiben als schneller Zugriff für R und A (denormalisiert, per Trigger oder
  Anwendungslogik konsistent gehalten) — oder werden migriert; Entscheidung in AP12
  nach Messung des Abfrageaufkommens.
- `process_raci_override` bleibt für die _Ableitung aus Lanes_ (dort gibt es keinen
  `process_step`), wird aber nach Einführung von `process_lane` (§3.11) darauf
  umgestellt.
- **Visuell:** Kürzel `R`/`A` im Slot BL, Rollenkürzel am Lane-Kopf. Vollständige
  R/A/C/I-Liste im Panel, dort auch inline bearbeitbar.

### B3 EAM-Objektplatzierung — die vollständig gebaute, nie benutzte Funktion

`eam_bpmn_element_placement(process_version_id, eam_element_id, org_id,
placement_type varchar(20), bpmn_node_id varchar(100), position_x numeric,
position_y numeric)` mit drei Indizes und `GET/POST/DELETE
/api/v1/eam/bpmn-placements` — **und keinerlei UI, die das rendert.** Das ist die
größte fertige, ungenutzte Investition im Inventar.

Entwurf:

- Architekturelemente (Anwendungen, Technologien, Schnittstellen) werden als
  **eigene Shapes auf einem separaten `diagram-js`-Layer** gerendert, nicht als
  BPMN-Elemente. **Entscheidend:** Sie dürfen nicht in den BPMN-Baum wandern, sonst
  wird das exportierte XML für fremde Werkzeuge unbrauchbar und verletzt N1.
  Ihre Geometrie steht in `eam_bpmn_element_placement`, nicht in der DI.
- Zwei Platzierungsarten (die Spalte `placement_type` ist dafür da):
  `node` = an ein BPMN-Element angeheftet (Position relativ zum Shape, folgt ihm beim
  Verschieben), `free` = frei auf der Fläche, mit gestrichelter Zuordnungslinie zu
  einem oder mehreren Elementen.
- Bearbeitung nur im Modus `edit` und nur bei aktiver Sicht „Architektur"; ein
  eigener Palette-Abschnitt „Architektur" listet die Anwendungen der Organisation
  mit Suche.
- **Schemaergänzung:** `process_step_id uuid null` (damit die Platzierung eine
  Version des Schritts überlebt), `label_visible boolean default true`,
  `relation_type varchar(20)` (`supports` | `data-store` | `interface`).
- **Nutzen:** Die Frage „welche Anwendung hängt an welchem Prozessschritt und was
  passiert bei ihrem Ausfall" wird auf einen Blick beantwortbar — und speist direkt
  die Ausfallsimulation (§3.10).

### B4 Simulationsparameter je Aktivität

`simulation_activity_param(activity_id, duration_min/most_likely/max,
cost_per_execution, resource_id, gateway_probabilities)` ist vollständig, `activity_id`
ist die BPMN-ID. Heute nur auf einer eigenen Unterseite.

- **Visuell:** Gutter-Zeile in der Sicht „Betrieb & Effizienz":
  `4,2 min · 18 € · 1.240×`. An Gateways: Verzweigungswahrscheinlichkeiten an den
  ausgehenden Kanten (`12 % / 88 %`).
- **Bearbeitung inline:** Klick auf den Gutter-Wert öffnet ein kleines Formular für
  die Drei-Punkt-Schätzung. Das ist der Moment, in dem Simulation von einer
  Spezialistenfunktion zu etwas wird, das der Prozesseigner beim Modellieren
  nebenbei pflegt.
- **Schemaergänzung:** `activity_id` sollte auf `step_key` (§3.2) umgestellt werden,
  weil es sonst beim Re-Export bricht.

### B5 DMN-Entscheidung

`dmn_decision.linked_process_step_id` existiert. Marker am `BusinessRuleTask` (der
Typ kommt heute real nie vor, ist aber im Parser bekannt) und am
`ExclusiveGateway`. Klick → Entscheidungstabelle als Leseansicht. Kein Editor (N3).

## 3.6 Objektgruppe C — der Granularitätswechsel von Prozess auf Element

Das ist der Kern der Schemaarbeit. **Entscheidungsregel**, damit nicht 14-mal neu
diskutiert wird:

> **Regel G:** Gehört ein Objekt fachlich zu _genau einem_ Schritt und existiert es
> pro Prozess mehrfach → zusätzliche Spalte `process_step_id uuid null` an der
> bestehenden Tabelle, `process_id` bleibt für die Roll-up-Sicht.
> Ist die Beziehung _n:m_ → neue Verknüpfungstabelle `process_step_<objekt>`.
> Ist das Objekt fachlich _pro Prozess einmalig_ (Reifegrad, Freigabe, VSM) → es
> bleibt auf Prozessebene; eine Elementebene wäre Scheingenauigkeit.

| Objekt                 | Heute                                       | Änderung                                                                                                                                                               | Regel |
| ---------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Dokument / SOP         | `process_document(process_id)`              | **neu** `process_step_document(process_step_id, document_id, relation_type)`                                                                                           | n:m   |
| ROPA                   | `process_ropa_profile(process_id)` 1:1      | **neu** `process_step_ropa(...)` + `process_step_data_category(...)`; `ropa_entry` wird zur Aggregation                                                                | §3.9  |
| DPIA                   | `dpia(process_id)`                          | `dpia.process_step_id uuid null` (Auslöser ist meist _ein_ Schritt)                                                                                                    | G     |
| Compliance-Anforderung | `process_framework_mapping(process_id)`     | `process_framework_mapping.process_step_id uuid null`                                                                                                                  | G     |
| BIA / MTPD-RTO-RPO     | `bia_process_impact(process_id)`            | **neu** `process_step_bia(...)` — §3.10                                                                                                                                | G     |
| Prozess-KPI            | `process_kpi_definition(process_id)`        | `+ process_step_id`, `+ sequence_flow_id` (Durchlaufzeit zwischen zwei Schritten)                                                                                      | G     |
| Reifegrad              | `process_maturity_assessment(process_id)`   | **keine Änderung** — Reifegrad je Aktivität ist Scheingenauigkeit                                                                                                      | —     |
| Freigabe / Sign-off    | `process_approval_step`, `process_sign_off` | **keine Änderung** — bleibt Prozess/Version; Darstellung als Band über dem Diagramm                                                                                    | —     |
| Kommentar              | `process_comment(entity_type, entity_id)`   | **keine Schemaänderung nötig** — §3.7                                                                                                                                  | —     |
| Event-Log / Mining     | `process_event(activity varchar)`           | **neu** `process_event_activity_map(...)` — §3.8                                                                                                                       | —     |
| Value Stream Map       | `value_stream_map(diagram_data jsonb)`      | Kennzahlen an Kante/Schritt lesen, kein Schemabedarf                                                                                                                   | —     |
| Simulationsergebnis    | `process_simulation_result`                 | Ergebnisse je Aktivität aus dem jsonb lesen                                                                                                                            | —     |
| Architekturelement     | `architecture_element(process_id)`          | über `eam_bpmn_element_placement` (§3.5 B3)                                                                                                                            | —     |
| Aufgabe / Maßnahme     | `task`, `work_item` — **kein Prozessbezug** | `work_item_link` verbindet nur `work_item↔work_item`; **neu** `work_item_entity_link(work_item_id, entity_type, entity_id)` oder `work_item.process_step_id uuid null` | G     |

## 3.7 Element-Kommentare — der billigste Gewinn im ganzen Plan

`process_comment` hat `entity_type varchar(50) default 'process'`, `entity_id uuid`
und einen Index `pc_entity_idx(entity_type, entity_id)`. Threads, `parent_comment_id`,
`mentioned_user_ids`, `is_resolved`/`resolved_by` sind da. Die Komponente
`components/process/process-comments.tsx:49` kennt `entity_type = "process_step"`.
Die API kann es. **Nur die Seite ruft ausschließlich `entityType="process"` auf**
(`page.tsx:663`).

Entwurf:

- **Pin-Schiene** links außerhalb jedes Shapes: ein Sprechblasen-Symbol mit der
  Anzahl offener Threads, farblich neutral (Kommentare sind kein GRC-Befund und
  dürfen nicht mit einem konkurrieren — deshalb eigene Schiene, kein Badge-Slot).
- Klick → Thread im Seitenpanel, `@`-Erwähnung, Auflösen.
- **Reviewmodus** (`mode="review"`): Der Freigabeprozess
  (`process_approval_step`, `process_sign_off`) bekommt eine diagrammnative Form —
  ein Prüfer geht das Diagramm durch, heftet Anmerkungen an konkrete Elemente, und
  der Modellierer sieht beim Bearbeiten genau, wo etwas offen ist. Heute ist die
  Freigabe eine Formularschleife neben dem Diagramm.
- **Aufwand: sehr gering** — Schema, API und Komponente existieren. Im Wesentlichen
  Pin-Rendering, Aufruf mit `entityType="process_step"` und die Modus-Logik.
  **Schätzung: 3–4 PT.** Das ist der beste Nutzen-pro-Aufwand-Posten im Dokument.

## 3.8 Conformance-Heatmap und Process Mining — mit einem ehrlichen Vorbehalt

Vorhanden: `process_event_log`, `process_event(case_id, activity varchar(500),
timestamp, resource)`, `process_conformance_result(conformance_score, total_traces,
conformant_traces, fitness_gaps jsonb, precision_issues jsonb, rework_loops jsonb,
bottlenecks jsonb)`, `process_mining_suggestion`.

**Der Vorbehalt zuerst:** `process_event.activity` ist ein **Name**, keine BPMN-ID.
Der Bezug zwischen Ereignisprotokoll und Diagramm ist heute eine
Zeichenkettenübereinstimmung. Bei „Rechnung prüfen" vs. „Rechnung prüfen (2. Blick)"
vs. „RECHNUNG_PRUEFEN" bricht das stumm — und eine Heatmap, die stumm falsch ist,
ist schlimmer als keine.

- **Neue Tabelle** `process_event_activity_map(id, org_id, event_log_id,
activity_name varchar(500), process_step_id uuid null, match_kind varchar(12)
/* exact | normalized | fuzzy | manual | unmapped */, confidence numeric,
mapped_by, mapped_at)` mit `UNIQUE(event_log_id, activity_name)`.
- Beim Import läuft eine Zuordnungsstufe: exakt → normalisiert (Kleinschreibung,
  Sonderzeichen, Umlaute) → unscharf (Levenshtein/Trigramm, Schwelle 0,85) →
  **manuell**. Nicht zugeordnete Aktivitäten erscheinen in einer Restliste, die der
  Nutzer auflösen muss.
- **Die Heatmap zeigt nur zugeordnete Aktivitäten** und weist die Abdeckungsquote
  ausdrücklich aus: „Heatmap basiert auf 87 % der Ereignisse; 3 Aktivitäten nicht
  zugeordnet." Ohne diese Angabe wird die Funktion nicht ausgeliefert.

Darstellung (Sicht „Betrieb & Effizienz"):

- Formkodierung = mittlere Durchlaufzeit (vier Stufen), Gutter = `ø 4,2 min · n=1.240`.
- **Kantenstärke = Häufigkeit** (1–6 px, logarithmisch), Kanten ohne Ereignisse
  gestrichelt-grau („modelliert, nie beobachtet") — das ist ein Befund für sich.
- **Beobachtete, nicht modellierte Pfade** aus `fitness_gaps` werden als
  gestrichelte rote Kanten _zusätzlich_ eingezeichnet, mit Häufigkeitsangabe. Das ist
  die eigentliche Konformitätsaussage: „in 12 % der Fälle geht es von Schritt 4
  direkt zu Schritt 9 und überspringt die Freigabe."
- `rework_loops` als Schleifensymbol am Schritt, `bottlenecks` als Engpassmarker.
- Klick auf eine Abweichung → `process_mining_suggestion` mit der Option, den
  Vorschlag als Modelländerung zu übernehmen (im Modus `edit`).

## 3.9 Datenschutz auf Elementebene — die zweite ungenutzte Chance

**Der Befund aus der Bestandsaufnahme:** Die Moddle-Extension modelliert
`arctos:ropa(isProcessingActivity, purpose, legalBasis, requiresDpia)` **am
einzelnen Flow-Node** — die Datenbank kennt aber nur `process_ropa_profile` je
Prozess (1:1) und `ropa_entry.process_id`. Das XML kann also mehr als die Datenbank,
und der Writer schreibt Werte, die nie eine DB-Heimat finden. Dasselbe gilt für
`arctos:bcmKpi` (§3.10).

Das ist fachlich falsch herum: Ein Verarbeitungsverzeichnis nach Art. 30 DSGVO wird
zwar _je Verarbeitungstätigkeit_ geführt, aber ob eine Aktivität personenbezogene
Daten verarbeitet, welche Kategorie, mit welcher Rechtsgrundlage und wie lange
aufbewahrt wird, ist eine Eigenschaft des **Schritts**. Genau deshalb sind
DSGVO-Prüfungen so mühsam: niemand weiß, an welcher Stelle im Prozess die Daten
entstehen, wandern und gelöscht werden müssen.

**Schema:**

```
process_step_ropa(id, org_id, process_step_id, is_processing_activity bool,
                  purpose text, legal_basis varchar, retention_months int,
                  retention_basis text, requires_dpia bool, dpia_id uuid null,
                  transfer_third_country bool, transfer_country varchar(2),
                  transfer_safeguard varchar, notes text)
process_step_data_category(process_step_id, ropa_data_category_id,
                           is_special_category bool, subject_type_id uuid null)
process_step_recipient(process_step_id, recipient_id /* vendor|org_unit */, kind)
```

`ropa_entry` / `process_ropa_profile` bleiben — sie werden künftig aus der
Elementebene **aggregiert** erzeugt (Zweck, Kategorien, Empfänger, Aufbewahrung als
Vereinigung über die Schritte). Das VVT wird damit erstmals aus dem Prozessmodell
ableitbar statt parallel gepflegt.

**Darstellung (Sicht „Datenschutz"):**

- Formkodierung: personenbezogene Daten ja/nein/besondere Kategorie (drei Stufen,
  mit Schraffur für „besondere Kategorie").
- TR: Kategoriechip (`Bewerberdaten`, `Gesundheitsdaten`), max. 1 + `+n`.
- BL: DPIA-Status (nicht erforderlich / erforderlich / laufend / abgeschlossen);
  rot, wenn `requires_dpia` gesetzt ist und kein `dpia_id` verknüpft — das ist ein
  echter Compliance-Befund.
- Gutter: **Aufbewahrungs-/Löschfrist** (`36 Mon.`) — siehe §3.12/F10.
- **Kanten:** Jeder Sequence- oder MessageFlow, der eine **Vertrauensgrenze**
  überschreitet, wird eigens gezeichnet: doppelter Strich mit Länderkürzel-Chip.
  Vertrauensgrenze = Wechsel der Lane, deren Träger ein `vendor` ist, oder Wechsel
  in einen Pool mit `transfer_third_country = true`. Damit beantwortet das Diagramm
  die Frage „wo verlassen personenbezogene Daten unseren Verantwortungsbereich" —
  eine Frage, für die es heute in ARCTOS keine Antwort auf einer Fläche gibt.
- Voraussetzung dafür ist `process_lane` (§3.11) und die Nutzung von
  `dataObjectReference`/`dataStoreReference` (heute im Repo mit 0 Vorkommen).

## 3.10 Kontinuität: BCM auf Elementebene und die Ausfallsimulation

Gleiches Muster wie 3.9: `arctos:bcmKpi(mtpdMinutes, rtoMinutes, rpoMinutes,
criticality)` steht im XML am Element, die DB kennt nur `bia_process_impact(process_id)`,
`essential_process`, `continuity_strategy`.

**Schema:** `process_step_bia(process_step_id, criticality, mtpd_minutes,
rto_minutes, rpo_minutes, impact_categories jsonb, workaround text,
workaround_max_duration_minutes)`. `bia_process_impact` bleibt als Prozessaggregat;
das MTPD des Prozesses ist per Definition das Minimum über seine kritischen Schritte
— das kann künftig berechnet statt geschätzt werden.

**Darstellung (Sicht „Kontinuität"):** Formkodierung = Kritikalität, Gutter =
`RTO 4 h · RPO 15 min`, BL = Ausweichverfahren vorhanden ja/nein.

**Ausfallsimulation** — die Funktion, die ein generischer BPMN-Editor nicht bauen
kann, weil ihm die Asset- und Kontinuitätsdaten fehlen:

> Auswahl „Anwendung SAP FI fällt aus" (aus `asset` bzw. `architecture_element`) →
> alle Schritte mit `process_step_asset` auf dieses Asset werden schraffiert;
> alle **nachgelagerten** Schritte (Graphtraversierung über SequenceFlows) werden als
> „blockiert" markiert, sofern sie keinen dokumentierten Workaround haben;
> das Diagramm zeigt oben die aggregierte Auswirkung: „7 von 18 Schritten betroffen,
> geschätzte Prozessunterbrechung > MTPD (4 h) nach 2 h 15 min."

Datenquellen: `process_step_asset`, `process_step_bia`, `asset`,
`continuity_strategy`, plus die Graphstruktur aus dem Diagramm selbst.
Die Traversierung läuft im Client auf dem `elementRegistry` — kein Backend nötig.
**Schätzung: 8–10 PT**, davon die Hälfte Darstellung.

## 3.11 Organisation, Lanes und SoD — die strukturelle Lücke

**Befund:** Es gibt in ARCTOS **keine Tabelle für Lanes oder Pools.**
`bpmn-parser.ts` überführt sie nicht nach `process_step`; in Seed und Tests kommt
keine einzige Lane vor; nur `bpmn-raci-engine.ts` liest sie per Regex für eine
abgeleitete Matrix. Damit ist jedes organisationsbezogene GRC-Objekt —
Rollen, Stakeholder, Lieferanten, Schulung, SoD, Zugriff — vom Diagramm abgeschnitten.

**Neue Tabelle:**

```
process_lane(id, org_id, process_id, bpmn_element_id, step_key uuid,
             name, kind varchar(10) /* lane | pool */,
             parent_lane_id uuid null,
             org_unit_id uuid null, custom_role_id uuid null, vendor_id uuid null,
             is_external bool, third_country varchar(2) null,
             created_at, updated_at, deleted_at)
  UNIQUE(process_id, bpmn_element_id)
```

und an `process_step`: `lane_step_id uuid null` (Lane-Zugehörigkeit) sowie
`parent_step_id uuid null` (Containment in SubProcess/Transaction). Beides fehlt
heute und beides wird für jede Aggregation gebraucht.

**Segregation-of-Duties-Verletzungen zwischen Lanes** — der stärkste Einzelbefund,
den ein GRC-Prozessdiagramm liefern kann:

- **Neue Tabelle** `sod_rule(id, org_id, role_a_id, role_b_id, severity,
rationale, framework_ref, is_active)` — im Schema existiert dafür heute nichts
  (`abac_policy` und `access_review` decken Zugriffsrechte ab, nicht
  Aufgabentrennung).
- **Prüfung** je Prozessversion: für jedes Paar von Aktivitäten (A, B), deren
  _accountable_ oder _responsible_ Rollen ein Paar aus `sod_rule` bilden und die im
  selben Prozesspfad liegen (Erreichbarkeit im Graphen), entsteht ein Befund.
- **Darstellung:** ein deutlich abgesetzter Bogen zwischen den beiden Shapes
  (gestrichelt, eigene Farbe, außerhalb der normalen Kantenführung, mit Schlosssymbol
  in der Mitte) plus Badge TR an beiden Enden. Bei mehr als drei Konflikten wird nur
  der gerade gewählte Bogen gezeichnet, die übrigen erscheinen in einer Liste — sonst
  Tapete.
- Sonderfall aus §3.4/A4: dieselbe Rolle führt eine Aktivität aus **und**
  verantwortet die einzige Kontrolle darauf → „Selbstkontrolle", eigene Warnstufe.
- **Nutzen:** Das ist die klassische Prüfungsfrage in jedem SOX-/IKS-Audit und wird
  heute in Excel beantwortet. Datenquelle vollständig in ARCTOS vorhanden, sobald
  `process_lane` und `process_step_raci` stehen.

An den Lanes hängen dann außerdem, ohne weitere Strukturarbeit:
**Lieferant/Vendor** (`vendor_id` → Symbol am Lane-Kopf, Risikoklasse, SLA,
Unterauftragnehmer — und Auslöser der Vertrauensgrenze aus §3.9),
**Stakeholder/Rolle**, **Schulung** (Qualifikationslücke: Anteil der Rollenmitglieder
mit abgeschlossenem Pflichtkurs, aus `academy_enrollment`) und
**Richtlinien-Kenntnisnahme** (`policy_acknowledgment`-Quote).

## 3.12 Objektgruppe D und weitere Funktionen, die kein Standardeditor bietet

| #   | Funktion                                                 | Nutzen                                                                                                       | Datenquelle                                                                        | Darstellung                                                                                       |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| F1  | **Kontrollabdeckungs-Heatmap**                           | Zeigt unkontrolliertes Restrisiko statt Kontrollanzahl — die Frage, die der Prüfer stellt                    | `process_step_risk` ⋈ `process_step_control` ⋈ `control.effectiveness`             | Formkodierung, 4 Stufen + Schraffur                                                               |
| F2  | **Risikokonzentration & Roll-up**                        | Findet den Schritt/die Lane, in der sich Risiko ballt; erbt Risiko aus Call Activities                       | `process_step_risk`, `called_process_id`, `lane_step_id`                           | Heat auf Lane/SubProcess/CallActivity                                                             |
| F3  | **SoD-Konfliktbögen**                                    | Aufgabentrennungsverstöße werden zwischen Lanes sichtbar statt in Excel                                      | `sod_rule` (neu) ⋈ `process_step_raci` (neu) ⋈ Graph-Erreichbarkeit                | Bogen + Badge, §3.11                                                                              |
| F4  | **Nachweisfälligkeits-Ampel**                            | „Welche Schritte haben keinen frischen Nachweis?" — die Vorbereitungsfrage jedes Audits                      | `control_test`, `evidence.created_at` je Kontrolle am Schritt                      | Formkodierung Sicht „Compliance & Nachweis"; Stufen: aktuell / fällig ≤30 T / überfällig / nie    |
| F5  | **Datenfluss über Vertrauensgrenzen**                    | Wo verlassen personenbezogene Daten die Organisation?                                                        | `process_lane.vendor_id`/`third_country`, `process_step_ropa`                      | Doppelkante + Länderchip, §3.9                                                                    |
| F6  | **Ausfall-/Abhängigkeitssimulation**                     | Was steht still, wenn Anwendung X ausfällt — und ab wann reißt das MTPD?                                     | `process_step_asset`, `process_step_bia`, Graphtraversierung                       | Schraffur + „blockiert"-Marker + Kopfzeile, §3.10                                                 |
| F7  | **Conformance-Heatmap mit Aktivitäts-Zuordnung**         | Modell vs. Realität, mit ausgewiesener Abdeckungsquote                                                       | `process_conformance_result`, `process_event_activity_map` (neu)                   | Heat + Kantenstärke + rote Ist-Pfade, §3.8                                                        |
| F8  | **Framework-Abdeckungssicht**                            | „Zeig mir ISO 27001 A.8 über diesen Prozess" — Anforderungsauswahl, dann Abdeckung und Lücken auf der Fläche | `process_framework_mapping` (+`process_step_id`), `catalog_entry`                  | Chips TL + Lückenmarker; Legende zeigt Abdeckungsgrad                                             |
| F9  | **Element-Kommentare & diagrammnativer Freigabe-Review** | Prüfen und Freigeben passiert dort, wo der Prozess besprochen wird                                           | `process_comment` (fertig), `process_approval_step`                                | Pin-Schiene + Reviewmodus, §3.7                                                                   |
| F10 | **Aufbewahrungs-/Löschsicht**                            | Wo entstehen aufbewahrungspflichtige Daten, wann müssen sie gelöscht werden — heute nirgends visuell         | `process_step_ropa.retention_months`, `ropa_data_category`                         | Gutter-Frist + DataObject-Marker; Filter „Löschfrist < 12 Mon."                                   |
| F11 | **Kostenverteilung / Kostentreiber**                     | Zeigt, wo Aufwand entsteht — Grundlage für Automatisierungsentscheidungen                                    | `simulation_activity_param.cost_per_execution`, `grc_cost_entry`, `grc_time_entry` | Gutter-Betrag + Anteilsbalken unter der Lane; **keine Größenänderung der Shapes** (bricht die DI) |
| F12 | **EAM-Anwendungslandschaft auf der Fläche**              | Die fertig gebaute Platzierungstabelle wird endlich benutzt                                                  | `eam_bpmn_element_placement` (vorhanden)                                           | eigener Layer, §3.5/B3                                                                            |
| F13 | **Kontrolltest-Ergebnis am Schritt**                     | Nicht „es gibt eine Kontrolle", sondern „sie wurde geprüft und hat bestanden"                                | `control_test`, `control_test_execution`                                           | Badge TR, Sicht „Compliance & Nachweis"                                                           |
| F14 | **Vorfälle am Schritt**                                  | Wo ist tatsächlich etwas passiert — die härteste Evidenz für Risikobewertung                                 | `security_incident` (+`process_step_id`, neu), `dora_ict_incident`                 | Badge BR mit Anzahl im gewählten Zeitraum                                                         |
| F15 | **KRI-Schwellenampel**                                   | Frühwarnung statt Nachbetrachtung                                                                            | `kri`, `kri_measurement`, `risk_appetite_threshold`                                | Badge TR mit Pfeilrichtung                                                                        |
| F16 | **Offene Maßnahmen mit Fälligkeit**                      | Was ist an diesem Schritt in Arbeit                                                                          | `work_item`/`task` + neue Verknüpfung (§3.6)                                       | Badge BR                                                                                          |
| F17 | **Qualifikations- und Kenntnisnahmelücke**               | Wer darf den Schritt eigentlich ausführen                                                                    | `academy_enrollment`, `policy_acknowledgment` je Lane-Rolle                        | Lane-Kopf-Quote                                                                                   |
| F18 | **Zeitreise / Änderungssicht**                           | Zwei Versionen überlagert: was kam dazu, was fiel weg, was änderte GRC-Bezug                                 | `process_version`, `bpmn-diff.ts` (vorhanden), Overlay-Differenz                   | grün/rot/gelb umrandete Shapes, „Diff-Sicht"                                                      |

**Zu F18 als eigene Bemerkung:** `packages/shared/src/bpmn-diff.ts` existiert, die
Seite `processes/[id]/compare` existiert — aber der Vergleich ist tabellarisch. Zwei
Versionen _im Diagramm_ zu überlagern ist eine kleine Erweiterung (Import beider XML,
Abgleich über `step_key`, Randfarbe je Änderungsart) mit großem Effekt für Freigabe
und Audit: „was hat sich seit der letzten Freigabe geändert" ist die
Standardprüfungsfrage.

**Was ausdrücklich _nicht_ ans Element gehört** (damit die Liste nicht ausufert):
Reifegrad (Scheingenauigkeit je Aktivität), Sign-off/Freigabe (gilt der Version),
Value-Stream-Kennzahlen als eigener Layer (überlappt vollständig mit „Betrieb &
Effizienz" — dort mitverwenden statt doppeln), Audit-Universe-Zugehörigkeit (gehört
an den Prozess, nicht an den Schritt).

## 3.13 Zusammenfassung der Schemaänderungen

| Art          | Objekt                                                                                                            | Zweck                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **neu**      | `process_step.step_key uuid` + `UNIQUE(process_id, step_key)`                                                     | stabile Identität über Round-Trips, §3.2                                                  |
| **neu**      | `process_step.parent_step_id`, `.lane_step_id`                                                                    | Containment und Lane-Zugehörigkeit für Aggregation                                        |
| **erw.**     | `step_type`-Enum um `lane`, `pool`, `data_object`, `data_store` **oder** eigene Tabelle                           | Entscheidung in AP12; Empfehlung: `process_lane` separat, DataObjects über `process_step` |
| **neu**      | `process_lane`                                                                                                    | Lanes/Pools erstmals in der DB, §3.11                                                     |
| **neu**      | `process_step_raci`                                                                                               | C und I haben heute keine DB-Heimat, §3.5/B2                                              |
| **neu**      | `process_step_document`                                                                                           | Dokument/SOP am Schritt                                                                   |
| **neu**      | `process_step_ropa`, `process_step_data_category`, `process_step_recipient`                                       | Datenschutz auf Elementebene, §3.9                                                        |
| **neu**      | `process_step_bia`                                                                                                | BCM auf Elementebene, §3.10                                                               |
| **neu**      | `sod_rule`                                                                                                        | Aufgabentrennungsregeln, §3.11                                                            |
| **neu**      | `process_event_activity_map`                                                                                      | belastbarer Mining-Bezug, §3.8                                                            |
| **neu**      | `user_diagram_preference(user_id, scope, active_view, layers jsonb)`                                              | Sichtenspeicherung; es gibt keine Präferenztabelle im Schema                              |
| **erw.**     | `eam_bpmn_element_placement` um `process_step_id`, `label_visible`, `relation_type`                               | §3.5/B3                                                                                   |
| **erw.**     | `dpia`, `process_framework_mapping`, `process_kpi_definition`, `security_incident` um `process_step_id uuid null` | Regel G, §3.6                                                                             |
| **erw.**     | `work_item` um Prozessbezug (Spalte oder generische Verknüpfungstabelle)                                          | §3.6                                                                                      |
| **erw.**     | `simulation_activity_param.activity_id` → `step_key`                                                              | Round-Trip-Stabilität                                                                     |
| **geändert** | `rehydrateFromBpmnXml()` wird von Speicher-Seiteneffekt zu expliziter Importaktion                                | §3.2                                                                                      |
| **entfernt** | `arctos-grc-extractor.ts` (344 LOC, `@deprecated`) samt Test                                                      | §3.2                                                                                      |

Alle Migrationen sind additiv (nullable Spalten, neue Tabellen) — kein
Datenverlustrisiko, kein Bedarf für ein Wartungsfenster. Die einzige
verhaltensändernde Migration ist die Umstellung der Rehydrierung; sie braucht ein
eigenes Release mit Kommunikationsschritt.

---

# 4. Barrierefreiheit von Anfang an

Audit-Finding **S14-10** dokumentiert die Ausgangslage: `grep -c
"aria-\|tabIndex\|onKeyDown\|role="` über `src/components/bpmn/*.tsx` ergab **0 in
allen sechs Dateien**. Nachgerüstet wurde ein fokussierbarer Canvas
(`role="application"`, `tabIndex=0`), Pan/Zoom/Fit per Tastatur, `aria-label` an den
fünf Overlay-Kanälen und `BpmnTextAlternative` als Tabellenäquivalent. Ausdrücklich
offengelassen (`bpmn-a11y.tsx:29-33`): **Navigation von Element zu Element im SVG.**

Eine Eigenimplementierung erlaubt, das im Renderer zu verankern statt darum herum.

## 4.1 Rechtlicher Rahmen — ehrlich eingeordnet

- **EN 301 549 v3.2.1**, Kapitel 9 (Web) und 11 (Software), verweist inhaltlich auf
  WCAG 2.1 AA. Das ist die europäische Norm, gegen die öffentliche Auftraggeber
  beschaffen.
- **BFSG** (Barrierefreiheitsstärkungsgesetz, wirksam seit 28.06.2025) gilt für
  Produkte und Dienstleistungen **für Verbraucher**. ARCTOS ist B2B-Software.
  _Annahme:_ Es gibt keine unmittelbare BFSG-Pflicht. Das ist die ehrliche Aussage —
  wer etwas anderes behauptet, überzeichnet.
- **Faktisch bindend ist der Vertrag.** Öffentliche Auftraggeber (BITV 2.0, § 3
  i. V. m. EU-RL 2016/2102) und große Unternehmen fordern
  EN-301-549-Konformitätserklärungen in Ausschreibungen. Wer keine hat, wird
  ausgeschlossen. Das ist der eigentliche Grund, es richtig zu machen.
- **Zielniveau: WCAG 2.2 AA** für den Diagrammbereich, dokumentiert in einer
  Konformitätserklärung mit ausgewiesener Liste bekannter Einschränkungen.

## 4.2 Tastaturnavigation über den Graphen

**Fokusmodell.** Der Canvas ist **ein** Tabstopp (`role="application"`,
`tabIndex=0`). Innerhalb des Canvas wandert ein _roving tabindex_ über die
Diagrammelemente; jedes `<g class="djs-element">` bekommt `tabindex="-1"`,
`role="button"` (bzw. `role="img"` für Artefakte) und ein `aria-label`.

**Reihenfolge.** Nicht die DOM-Reihenfolge (die entspricht der DI-Reihenfolge und ist
willkürlich), sondern eine **topologische Ordnung**: Startereignisse in
Lesereihenfolge → Ablauf entlang der SequenceFlows (bei Verzweigungen: Zweige nach
y-Position, dann x-Position) → danach alles Unerreichbare, sortiert nach Position.
Die Ordnung ist stabil und wird beim Import einmal berechnet. Sie ist **dieselbe**,
die die Textalternative (§4.3) verwendet — Diagramm und Tabelle zählen identisch,
was für die Verständigung („Schritt 7") entscheidend ist.

**Tastenbelegung.**

| Taste                 | Wirkung                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `Tab` / `Shift+Tab`   | Canvas betreten/verlassen (ein Tabstopp)                                                                                     |
| `→` / `←`             | nächstes / voriges Element in topologischer Ordnung                                                                          |
| `↓` / `↑`             | bei Verzweigungen: alternativer ausgehender Zweig; sonst nächstes Element in derselben Lane                                  |
| `Ctrl`/`Alt` + Pfeile | Canvas verschieben (**heute liegen die Pfeile allein darauf** — Umbelegung, dokumentiert und in den Einstellungen umkehrbar) |
| `Enter`               | Seitenpanel zum fokussierten Element öffnen                                                                                  |
| `Space`               | Element selektieren (Selektion ≠ Fokus)                                                                                      |
| `.` / `,`             | Badges des fokussierten Elements durchlaufen und vorlesen                                                                    |
| `F6` / `Shift+F6`     | Regionen wechseln: Werkzeugleiste → Palette → Canvas → Seitenpanel → Textalternative                                         |
| `L`                   | Sichtenmenü, `/` Suche, `?` Tastaturhilfe                                                                                    |
| `0` / `Home`          | fit-viewport, `+` / `-` Zoom (unverändert)                                                                                   |
| `Esc`                 | Canvas verlassen, Fokus zur Werkzeugleiste                                                                                   |

Im Modus `edit` kommen die Bearbeitungskürzel hinzu (`F2` Beschriftung,
`Ctrl+Z/Y`, `Entf`, `Ctrl+C/V`) — die Navigationsbelegung bleibt identisch, damit
sich Lesen und Bearbeiten gleich anfühlen (Vorgabe 4).

**Ansage.** Eine `aria-live="polite"`-Statusregion außerhalb des SVG meldet bei jedem
Fokuswechsel einen Satz, der aus dem Element **und den aktiven Layern** gebildet wird:

> „Aktivität ‚Rechnung prüfen‘, Schritt 4 von 17, Lane Buchhaltung.
> 2 Risiken, höchster Restwert 16 von 25. Kontrollabdeckung 1 von 3 wirksam.
> 1 offene Feststellung, überfällig seit 12 Tagen. Kommentare: 2 offen."

Das ist der Punkt, an dem die GRC-Layer den Unterschied machen: Sie müssen **hörbar**
sein, nicht nur sichtbar. Deshalb die Pflichtmethode `describe(element)` je Layer
(§3.3.5, Regel 3) — ohne sie wird der Layer nicht registriert.

**Verzweigungen ansagen:** An einem Gateway meldet die Region zusätzlich
„3 ausgehende Pfade: ‚Betrag > 10.000‘, ‚Betrag ≤ 10.000‘, Standard" und `↓`/`↑`
wechselt zwischen ihnen. Das ist die Stelle, an der ein Screenreader-Nutzer einen
Prozess sonst verliert.

## 4.3 Die textuelle Alternative — nicht nur Pflicht, sondern nützlich

`BpmnTextAlternative` (heute: Name/Typ/ID) wird zu einer vollwertigen
**Prozesstabelle**:

| Nr. | Name | Typ | Lane / Rolle | Vorgänger | Nachfolger | + je aktivem Layer eine Spalte |
| --- | ---- | --- | ------------ | --------- | ---------- | ------------------------------ |

- Sortierbar, filterbar, nach CSV/XLSX exportierbar (`packages/reporting` ist da).
- Zeilenauswahl fokussiert und selektiert das Element im Diagramm, und umgekehrt —
  Diagramm und Tabelle sind zwei Ansichten desselben Zustands, nicht zwei Dinge.
- **Zusätzlich eine Fließtextform des Ablaufs**, generiert:
  „Der Prozess beginnt mit ‚Rechnung geht ein‘. Danach folgt ‚Rechnung prüfen‘
  (Buchhaltung). An ‚Betrag prüfen‘ verzweigt der Ablauf: bei ‚Betrag > 10.000‘ …"
  Das deckt WCAG 1.1.1 für ein komplexes Bild sauber ab und ist zugleich das, was
  Menschen in Verfahrensdokumentationen ohnehin brauchen.
- **Das ist auch die Antwort auf WCAG 1.4.10 (Reflow, 320 px).** Ein
  Diagramm-Canvas kann nicht umbrechen. Bei schmalem Viewport wird die Tabelle zur
  Primäransicht und das Diagramm zur Zusatzansicht — dokumentiert, nicht behelfsmäßig.

## 4.4 Kontrastregeln für die Marker aus §3

Verbindliche Regeln, die im Design-Token-Satz als Test hinterlegt werden (§6.6):

1. **Badge-Text zu Badge-Fläche ≥ 4,5:1** (WCAG 1.4.3).
2. **Badge-Fläche zu _beidem_: Shape-Füllung und Canvas-Hintergrund ≥ 3:1**
   (WCAG 1.4.11). Badges überlappen die Shape-Kante — beide Nachbarschaften zählen.
3. **Heatmap-Füllungen nur als helle Tönungen mit L\* ≥ 80.** Sonst fällt die
   Elementbeschriftung unter 4,5:1 gegen die Füllung. Intensität wird daher
   **zusätzlich** über Schraffurdichte und den Zahlenwert im Gutter kodiert — nie
   über Farbe allein.
4. **Elementkontur bleibt in jeder Kodierung erhalten** (≥ 3:1 zum Hintergrund).
   Eine Formkodierung darf die BPMN-Formensprache nicht auflösen.
5. **Kein Rot/Grün allein.** Jede Ampel trägt ein Formzeichen (▲/■/●) und einen Wert.
   Getestet gegen Deuteranopie/Protanopie/Tritanopie durch Simulation der
   Token-Palette (deterministischer Unit-Test, kein Screenshot).
6. **Fokusindikator** ≥ 3:1 gegen Shape-Füllung _und_ Canvas, mindestens 2 CSS-Pixel
   dick, mindestens die Elementkontur umschließend (WCAG 2.4.11/2.4.13). Er benutzt
   einen Kanal, den **kein** Layer verwendet: ein doppelter Ring (innen hell, außen
   dunkel), damit er auf jeder Füllung funktioniert.
7. **`prefers-reduced-motion`**: kein Blinken, kein Pulsieren; „überfällig" wird
   statisch kodiert. **`prefers-contrast: more`**: eigener Token-Satz mit
   ausschließlich Konturen und Schraffuren, ohne Füllungen.
8. **Zoom bis 400 %** ohne Informationsverlust: Badges skalieren mit dem Canvas
   (heute HTML-Overlays mit festen Pixelwerten `-14`, die beim Zoomen wandern —
   in der Eigenimplementierung werden die Slots im SVG gerendert und skalieren mit).

## 4.5 Was in der Eigenimplementierung besser geht als in der Nachrüstung

- Slots sind Renderer-Bestandteil → sie sind im **SVG-, PNG- und PDF-Export**
  enthalten. Heutige HTML-Overlays sind es nicht: `saveSVG()` liefert das Diagramm
  ohne die GRC-Badges. Das ist ein realer Mangel des Ist-Zustands — exportierte
  Audit-Diagramme zeigen die GRC-Information nicht.
- `aria-label` wird zentral vom Renderer aus dem Modell plus den Layern erzeugt, nicht
  von 20 Aufrufstellen. Vergessen ist nicht möglich.
- Die Fokusordnung ist im Import berechnet und damit stabil, statt aus der
  DOM-Reihenfolge abgeleitet.

---

# 5. Migration und Kompatibilität

## 5.1 Das Round-Trip-Kriterium: warum nicht „bit-treu"

Die Vorgabe lautet, `process_version.bpmn_xml` müsse „bit-treu weiter gelesen und
geschrieben" werden. **Das ist als Abnahmekriterium nicht haltbar, und zwar aus
einem technischen Grund, nicht aus Bequemlichkeit:** `moddle-xml` serialisiert den
Objektbaum neu. Attributreihenfolge, Namespace-Präfixdeklarationen, Anführungszeichen,
Selbstschließung leerer Elemente, Einrückung und Zeilenenden werden dabei
normalisiert. Schon heute liefert `saveXML({format:true})` für ein importiertes,
unverändertes Fremd-XML kein byteidentisches Ergebnis. Ein Kriterium, das die
bestehende Lösung selbst nicht erfüllt, kann die neue nicht sinnvoll prüfen.

**Was stattdessen gilt — drei Zusicherungen, jede maschinell prüfbar:**

**Z-A · Kanonische Äquivalenz.** `read(x)` und `read(write(read(x)))` sind gleich
unter einer definierten Normalisierung: Attribute sortiert, Namespace-Präfixe auf
kanonische Form abgebildet (`bpmn:`, `bpmndi:`, `dc:`, `di:`, `arctos:`), irrelevante
Leerzeichen entfernt, Zahlen auf 6 Nachkommastellen gerundet. Verglichen wird über:

1. Elementmenge: `{ id, $type, parent-id }` — vollständig identisch;
2. alle Attribute je Element, einschließlich `$attrs` (unbekannte Attribute);
3. alle Extension-Elemente als Teilbaum, **tief gleich** — auch fremde
   (camunda, zeebe, signavio) und auch solche, deren Namespace ARCTOS nicht kennt;
4. DI: `Bounds` und `waypoints` auf 0,5 px genau.

**Z-B · Idempotenz.** Ab dem zweiten Durchgang ist die Ausgabe **byteidentisch**:
`write(read(write(read(x)))) === write(read(x))`. Das ist die praktisch wichtige
Eigenschaft: sie sorgt dafür, dass ein Speichern ohne Änderung keinen Diff erzeugt,
dass `bpmn-diff.ts` keine Phantomänderungen meldet und dass die Versionshistorie
sauber bleibt.

**Z-C · Nichtverlust.** Kein Element und kein Attribut, das in der Eingabe vorkommt,
fehlt in der Ausgabe. Geprüft als Mengeninklusion, nicht als Gleichheit — die
Ausgabe _darf_ mehr enthalten (z. B. ergänzte DI für Elemente ohne Shape), aber nie
weniger.

Für den Sonderfall „Datei wurde importiert und nie bearbeitet" kommt hinzu:

**Z-D · Read-preserve-write.** Solange kein Kommando auf dem `CommandStack` liegt,
wird beim Export der **ursprüngliche XML-Text unverändert durchgereicht**, nicht neu
serialisiert. Damit ist der häufigste Fall — Diagramm ansehen, Version anlegen,
exportieren — tatsächlich byteidentisch, und zwar garantiert. Das ist näher an
„bit-treu" als jede Serialisierungsakrobatik und viel billiger.

## 5.2 Die `tagAlias`-Eigenheit

`arctos-moddle-extension.json` setzt `"xml": { "tagAlias": "lowerCase" }`. Der Typ
`GrcMetadata` wird deshalb als `<arctos:grcMetadata>` serialisiert;
`localType()` in `bpmn-arctos-parse.ts` vergleicht case-insensitiv gegen
`"grcmetadata"`.

**Das trägt ohne Zutun herüber**, weil `tagAlias` eine Eigenschaft von `moddle`/
`moddle-xml` ist, nicht von `bpmn-js`, und die Extension-Datei unverändert
weiterverwendet wird. Trotzdem zwei Pflichttests, weil eine unbemerkte Regression
hier Altdaten **stumm** unlesbar macht:

- Fixture mit `<arctos:grcMetadata>` (Kleinbuchstabe) → wird gelesen;
- Fixture mit `<arctos:GrcMetadata>` (Großbuchstabe, wie ein naiver Fremdexporter
  schreiben würde) → wird ebenfalls gelesen;
- Serialisierung erzeugt **immer** die Kleinschreibvariante.

## 5.3 Fremde Erweiterungen und nicht unterstützte BPMN-Konstrukte

- **Fremde `extensionElements`** bleiben erhalten, weil `bpmn-moddle` unbekannte
  Elemente in `$children` mit `$attrs` behält, sofern der Namespace an einer
  Vorfahrenebene deklariert ist. Ist er es nicht, verhält sich `moddle-xml` je nach
  Version unterschiedlich — das ist ein Fixture-Fall im Korpus (§5.5), kein
  Vertrauensfall.
- `injectGrcMetadataModdle` garantiert heute: fremde Elemente überleben, vorhandenes
  `arctos:grcMetadata` wird **ersetzt statt dupliziert**. Beides ist getestet
  (`__tests__/lib/bpmn-arctos-parse.test.ts`, `bpmn-arctos-rehydrate.test.ts`) und
  wird als Vertrag in die neue Export-Schicht übernommen — die vorhandenen Tests
  laufen unverändert weiter, weil sie auf `bpmn-moddle` arbeiten, nicht auf `bpmn-js`.
- **Nicht unterstützte Konstrukte** (N1: Choreographie, Konversation, Transaktion,
  Compensation, Event-SubProcess): Sie werden importiert und **generisch** gerendert
  (Rechteck bzw. Kante mit Typkennzeichnung und Warnsymbol), sind nicht selektierbar
  für Bearbeitung, und ihr Modellteilbaum wird beim Export unverändert
  zurückgeschrieben. Der Nutzer bekommt einen Hinweis am Diagramm: „Dieses Diagramm
  enthält 2 Elemente, die ARCTOS anzeigt, aber nicht bearbeitet." Das ist ehrlicher
  als stilles Verschlucken und billiger als volle Unterstützung.

## 5.4 Übergangsbetrieb

**Fassade.** Alle drei Importstellen gehen über `<BpmnCanvas>` (§2.4). Diese wählt
die Implementierung:

```
NEXT_PUBLIC_BPMN_ENGINE = "bpmn-js" | "arctos" | "arctos-shadow"     (Standard)
organization.settings.bpmnEngine                                      (Override je Org)
?engine=arctos                                                        (Override je Aufruf, nur intern)
```

_Annahme:_ Es gibt im Schema heute **keine** Feature-Flag-Infrastruktur (geprüft:
kein `feature_flag`, keine `user_preference`). Der Org-Override wird daher als
JSONB-Feld an `organization` ergänzt oder — falls parallel ohnehin ein Flag-System
entsteht — dort eingehängt.

**Fünf Stufen:**

| Stufe  | Was läuft auf der neuen Engine                                           | Risiko                                          | Rücknahme        |
| ------ | ------------------------------------------------------------------------ | ----------------------------------------------- | ---------------- |
| **S0** | nichts; nur die Fassade und der Testkorpus stehen                        | keins                                           | —                |
| **S1** | **Nur lesende Ansichten**, intern (`?engine=arctos`)                     | keins — Lesen kann keine Daten beschädigen      | Flag             |
| **S2** | Lesende Ansichten für Pilot-Organisationen (3 von 3 Viewer-Einbettungen) | gering: falsche Darstellung, keine Datenwirkung | Flag je Org      |
| **S3** | Editor im **Shadow-Compare-Modus** für Piloten                           | gering, siehe unten                             | Flag je Org      |
| **S4** | Editor als Standard, `bpmn-js` bleibt installiert                        | mittel                                          | Flag global      |
| **S5** | `bpmn-js` entfernt — **Wasserzeichen fällt**                             | —                                               | Release-Rollback |

**Shadow-Compare-Speichern (S3) — das zentrale Sicherheitsnetz.** Solange beide
Engines im Bundle sind (das sind sie bis S5 ohnehin), läuft jeder Speichervorgang so:

1. Die neue Engine serialisiert → `xml_neu`.
2. Dasselbe Modell wird zusätzlich durch `bpmn-js` importiert und serialisiert →
   `xml_alt`.
3. Kanonischer Vergleich (§5.1, Z-A). Bei Gleichheit: speichern, Telemetrie „ok".
4. Bei Abweichung: **speichern wird abgelehnt**, `xml_alt` wird gespeichert,
   die Differenz wird als Diagnoseereignis erfasst (anonymisiert: Elementtypen und
   Attributnamen, **kein** Inhalt — sonst wandern Prozessdaten in die Telemetrie),
   und der Nutzer sieht einen unaufgeregten Hinweis.

Kosten: eine zusätzliche Serialisierung pro Speichern (**Schätzung** < 150 ms bei
200 Elementen). Nutzen: Datenbeschädigung durch einen Fehler im `BpmnUpdater` — das
Hauptrisiko des Vorhabens (§2.3.1) — wird praktisch ausgeschlossen, und man bekommt
über Wochen echten Produktivverkehr als Testkorpus. Diese Möglichkeit gibt es
**nur** während des Parallelbetriebs; sie zu nutzen ist der stärkste Grund, die
Ablösung nicht als Big Bang zu fahren.

## 5.5 Testkorpus — und ein unbequemer Befund

Die Bestandsaufnahme stellt fest: die laufende Datenbank hat **0 Zeilen** in
`process`, `process_version`, `process_step`. Im Repo existieren rund 27 XML-Literale
(Seed, Unit-Tests, E2E-Fixtures), die zusammen 8 Elementtypen abdecken.

**Daraus folgt eine Frage, die vor der Aufwandsplanung zu klären ist: Gibt es
überhaupt Bestandsdiagramme?** Wenn in den produktiven Mandanten keine oder nur
wenige Prozesse liegen, ist das Migrationsrisiko nahezu null und ein erheblicher
Teil des Aufwands für Kompatibilität entfällt. Wenn es dort hunderte gewachsener
Diagramme gibt, ist der Korpus der wichtigste Baustein. **Das ist mit einer Abfrage
zu klären, bevor AP1 startet** — und es kann die Schätzung in §7 um ±15 PT
verschieben.

Der Korpus (AP1) besteht unabhängig davon aus vier Quellen:

1. **Repo-Bestand** — alle 27 XML-Literale, extrahiert und als Dateien abgelegt.
2. **Produktivexport** — ein anonymisierter Auszug echter `process_version.bpmn_xml`
   aus den produktiven Mandanten (Namen ersetzt, IDs erhalten), sofern vorhanden.
   Rechtlich abzuklären, technisch trivial.
3. **Fremdwerkzeuge** — je ein Diagramm, exportiert aus Camunda Modeler, Signavio,
   Visio-BPMN und ADONIS. Hier stecken die Namespace-, DI- und
   `extensionElements`-Eigenheiten, an denen Importer scheitern. Diese Dateien selbst
   erzeugen (ARCTOS hat Zugriff auf mindestens den Camunda Modeler, MIT-Tooling), **nicht**
   fremde Testfixtures vendoren.
4. **Generator** — ein Zufallsgenerator für gültiges BPMN (Elementmix, Verschachtelung,
   Lanes, Pools, fremde Extensions, fehlende DI, Sonderzeichen in Namen, sehr lange
   Labels, 500+ Elemente) für eigenschaftsbasierte Tests (§6.1).

## 5.6 Abschaltkriterien für `bpmn-js`

`bpmn-js` wird entfernt, wenn **alle** folgenden Punkte gleichzeitig gelten:

1. Round-Trip Z-A/Z-B/Z-C grün über den **gesamten** Korpus, inkl. 10.000 generierter
   Fälle, in CI reproduzierbar.
2. Differenztests gegen `bpmn-js` (§6.4) über den Korpus grün: gleiche Elementmenge,
   gleiche Bounds (±1 px), gleiche Waypoints (±2 px), kanonisch gleiches
   Export-XML.
3. Shadow-Compare (S3/S4) über **mindestens 30 Kalendertage** und **mindestens
   500 Speichervorgänge** ohne Abweichung.
4. Die 21 Editor-Funktionen aus `editor_funktionen.csv` sind in der neuen Engine
   mindestens auf dem dort dokumentierten Stand — mit zwei bewussten Ausnahmen:
   Nr. 24 (Copy/Paste, Align, Space-Tool, Lasso, Hand-Tool) darf bei der ersten
   Ablösung reduziert sein, Nr. 8 (Lanes/Pools) muss vollständig sein, weil §3.11
   darauf aufbaut.
5. a11y: axe ohne Verstöße auf allen vier Einbettungen, plus die eigenen Regeln
   (§6.6), plus eine manuelle Prüfung mit NVDA und VoiceOver.
6. E2E-Suite (§6.5) grün, inkl. der heute fehlenden Canvas-Interaktionstests.
7. Leistungsbudget eingehalten (§6.8).
8. Keine offene Regression der Schwere „hoch" aus der Pilotphase.

## 5.7 Rückfallweg

- **Bis S4:** Flag umlegen, je Organisation oder global. Sofort wirksam, kein Deploy.
- **S4→S3:** Standard zurück auf `bpmn-js`, neue Engine bleibt für Piloten. Kein
  Datenproblem, weil das gespeicherte XML in beiden Fällen gültiges BPMN 2.0 ist.
- **Nach S5:** `bpmn-js` ist entfernt; Rückfall nur über Release-Rollback. Deshalb
  bleibt zwischen S4 (Standard umgestellt) und S5 (Paket entfernt) **mindestens ein
  vollständiger Release-Zyklus** Abstand. Das kostet einen Monat Wasserzeichen und
  ist es wert.
- **Datenseitig gibt es keinen Rückfallbedarf:** Die neue Engine schreibt BPMN 2.0,
  das `bpmn-js` lesen kann. Die einzige Ausnahme wäre `arctos:grcMetadata@schemaVersion="2"`
  mit `@stepKey` — ein zusätzliches Attribut, das ältere Leser ignorieren. Bewusst so
  entworfen: die Erweiterung ist abwärtskompatibel.

---

# 6. Testfundament

**Ausgangslage:** Es gibt sechs BPMN-bezogene Unit-Tests (drei in `apps/web`, drei in
`packages/shared`), alle auf XML-Strings. **Kein Test rendert Editor oder Viewer.**
In 20 + 47 E2E-Specs gibt es keinen einzigen Zugriff auf den Canvas. Das ist zugleich
die gute Nachricht (nichts bricht bei der Umstellung) und das größte Risiko (nichts
fängt eine Regression ab).

**Grundsatz: Das Testfundament ist Arbeitspaket 1, nicht Arbeitspaket n.** Die
Stufen 1, 4 und teilweise 3 müssen stehen, bevor die erste Zeile Renderer
geschrieben wird — sonst gibt es kein Signal dafür, ob die Implementierung
funktioniert, und man merkt es erst in Produktion.

## 6.1 Stufe 1 — Round-Trip und Eigenschaften (vitest, ohne DOM)

Läuft in `packages/bpmn-engine`, ohne Browser, in Sekunden, bei jedem Commit.

- `assertBpmnEquivalent(a, b)` — die Normalisierung aus §5.1 als wiederverwendbare
  Zusicherung mit lesbarer Fehlermeldung („Attribut `camunda:asyncBefore` an
  `Task_1` fehlt in der Ausgabe").
- Korpus-Durchlauf: für jede Datei Z-A, Z-B, Z-C, Z-D prüfen.
- **Eigenschaftsbasierte Tests** mit dem Generator (§5.5, Quelle 4): 10.000 zufällige
  gültige Diagramme, jeweils Round-Trip. Diese Kategorie findet die Fälle, an die
  niemand denkt — fehlende DI, Kanten in Subprozesse hinein, Labels ohne Bounds,
  Elemente mit identischen Namen, Namen mit `<`/`&`/Emoji.
- **Kommandobasierte Eigenschaftstests** (ab AP6): zufällige Kommandofolgen
  (erzeugen, verschieben, verbinden, löschen, undo, redo) auf einem zufälligen
  Startdiagramm; nach jeder Folge muss das exportierte XML **schemagültig** und
  konsistent sein (jeder `sourceRef`/`targetRef` zeigt auf ein existierendes Element,
  jede `BPMNShape` hat ein `bpmnElement`, jede `flowNodeRef` existiert). Zusätzlich:
  `n`-mal undo nach `n` Kommandos stellt exakt das Ausgangs-XML wieder her. Das ist
  der schärfste Test für den `BpmnUpdater` und der wichtigste Test des Vorhabens.

## 6.2 Stufe 2 — Modell- und Regeltests (vitest + jsdom)

- `BpmnRules`: Tabellen-getriebene Tests („darf `bpmn:BoundaryEvent` an
  `bpmn:UserTask`? ja. An `bpmn:StartEvent`? nein. Darf `bpmn:SequenceFlow` über eine
  Pool-Grenze? nein — das muss ein `MessageFlow` sein.") Eine Zeile pro Regel,
  ~120 Zeilen. Billig und deckt genau das ab, was `bpmn-js`' 10.922 LOC an Semantik
  ausmacht.
- Behaviors: je Verhalten ein Test auf dem _resultierenden Modell_, nicht auf dem DOM.
- `BpmnLayouter`: Waypoint-Berechnung für die typischen Konstellationen
  (horizontal, vertikal, um ein Element herum, Selbstschleife) als Zahlenvergleich.
- **Grenze ehrlich benennen:** jsdom misst keinen Text. Alles, was von
  `getBBox()`/`getComputedTextLength()` abhängt (Zeilenumbruch, Labelgröße,
  Autoresize), ist in jsdom **nicht** testbar und gehört in Stufe 3.

## 6.3 Stufe 3 — Rendering (echter Browser)

- **Primär: SVG-Struktur-Snapshots.** Nach dem Import wird das Canvas-SVG
  serialisiert, normalisiert (IDs auf laufende Nummern, Zahlen gerundet) und als
  Snapshot verglichen. Deterministisch, textuell diffbar, keine Font-Flakiness.
  Matrix: 18 Elementtypen × {ohne Layer, jede Sicht} × {hell, dunkel}.
- **Sekundär: eine kleine Menge Pixel-Screenshots** (Playwright, feste
  Browserversion, feste Schriftart) für das, was Struktur nicht zeigt:
  Textumbruch, Überlappungsfreiheit der Badges, Kontrast in der Praxis.
  Bewusst klein halten — Pixelvergleiche sind die teuersten Tests im Bestand.
- **Diagramm-Galerie:** eine interne Seite, die den gesamten Korpus in der neuen
  Engine rendert, als veröffentlichbare Übersicht für die menschliche
  Sichtprüfung vor jedem Release. Automatisierung ersetzt hier den Blick nicht.

## 6.4 Stufe 4 — Differenztests gegen `bpmn-js` (befristet)

**Die wertvollste Testkategorie — und sie verfällt.** Solange `bpmn-js` im Repo ist,
ist es eine funktionierende Referenzimplementierung. Für jede Korpus-Datei:

| Vergleich                                                        | Toleranz                | Begründung                                                       |
| ---------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------- |
| Elementmenge `{id, type, parent}` aus `elementRegistry.getAll()` | exakt                   | Import muss identisch interpretieren                             |
| Bounds je Shape                                                  | ±1 px                   | DI wird gelesen, nicht berechnet — Abweichung heißt Importfehler |
| Waypoints je Connection                                          | ±2 px                   | Cropping/Docking kann leicht abweichen                           |
| Export-XML                                                       | kanonisch gleich (§5.1) | die eigentliche Zusicherung                                      |
| **Nicht verglichen:** SVG-Pfad-`d`, CSS-Klassen, DOM-Struktur    | —                       | die Eigenimplementierung _soll_ anders zeichnen                  |

Diese Suite muss **früh** entstehen (AP1) und läuft bis AP10. Danach wird sie
gelöscht — bewusst und dokumentiert, nicht durch Vergessen.

## 6.5 Stufe 5 — Interaktion und E2E

**Grundsatz: Interaktionstests behaupten über das exportierte XML, nicht über das
DOM.** „Nach Klick auf Palette-Eintrag ‚Aufgabe‘ und Klick auf (300, 200) enthält das
Export-XML ein `bpmn:Task` mit einer `BPMNShape` an dieser Position" ist robust; ein
CSS-Selektor auf `.djs-shape` ist es nicht.

Abzudeckende Abläufe (Playwright):

1. Element aus der Palette erzeugen, benennen, verbinden, verschieben, löschen —
   jeweils mit Undo und Redo.
2. Lane erzeugen, Aktivität hineinziehen, Lane löschen (`flowNodeRef`-Konsistenz).
3. Boundary-Event anheften und die Trägeraktivität verschieben.
4. Label-Editing mit Sonderzeichen und Zeilenumbruch.
5. Import → Bearbeiten → Speichern → Neuladen → identisches Diagramm.
6. **GRC:** Prozess mit Risiken/Kontrollen/Feststellungen anlegen (API), Diagramm
   öffnen, Sicht wechseln, erwartete Badges und Formkodierung prüfen,
   Element anklicken, Panel prüfen.
7. **Portal-Lesepfad** (`my-processes/[id]`): Diagramm lädt, Sicht „Verantwortung",
   keine Bedienelemente, Textalternative erreichbar.
8. Export XML / SVG / PNG / PDF und Re-Import des exportierten XML.

Das schließt die heutige Lücke: `bpm-approval-pipeline.spec.ts` und
`process-portal.spec.ts` erzeugen BPMN über die API und prüfen danach nur
Listen und Status — der Canvas wird von keinem Test bedient.

## 6.6 Stufe 6 — Barrierefreiheit

- axe (`@axe-core/playwright` ist vorhanden) auf allen vier Einbettungen, mit
  Interaktion, nicht nur beim Laden.
- **Eigene, deterministische Regeln als Unit-Tests** — das ist der Teil, den axe
  nicht kann:
  - jeder Layer implementiert `describe()`; ein Test iteriert die Layer-Registry und
    schlägt fehl, wenn einer es nicht tut;
  - jedes gerenderte `djs-element` hat ein nicht-leeres `aria-label`;
  - **Kontrastberechnung aus den Design-Tokens**: alle Paare (Badge-Text/Badge,
    Badge/Shape, Badge/Canvas, Label/Füllung, Kontur/Hintergrund, Fokusring/beides)
    gegen die Schwellen aus §4.4 — für hell, dunkel und `prefers-contrast: more`;
  - Farbsehsimulation der Palette (drei Typen) mit Mindestabstand zwischen den
    Ampelstufen.
- **Tastatur-Traversierungstest:** ein Test, der mit `→` durch ein 40-Element-Diagramm
  läuft und behauptet, dass jedes Element genau einmal erreicht wird, dass die
  Reihenfolge der Textalternative entspricht und dass die Live-Region bei jedem
  Schritt einen nicht-leeren Text meldet.

## 6.7 Stufe 7 — Konvergenz mit `packages/shared`

ARCTOS pflegt bereits eine **zweite** BPMN-Interpretation ohne bpmn.io
(`bpmn-parser.ts`, `bpmn-validator.ts`, `bpmn-raci-engine.ts`,
`bpmn-walkthrough-engine.ts` — 1.529 LOC, `fast-xml-parser` und Regex). Während des
Übergangs sind es **drei**. Divergenz ist damit kein Risiko mehr, sondern eine
Gewissheit — sie muss nur begrenzt werden.

- **Gemeinsame Konformitätssuite:** derselbe Korpus, dieselben Erwartungen für
  „welche Elemente sieht der Parser, welchen `step_type` vergibt er, welche RACI
  leitet er ab". Wenn Engine und `shared`-Parser dasselbe XML unterschiedlich
  interpretieren, schlägt der Test fehl — egal welcher recht hat.
- **Empfehlung über dieses Vorhaben hinaus:** `packages/shared` auf `bpmn-moddle`
  umstellen (MIT, bereits Abhängigkeit) und die Regex-Engines ablösen. Nicht Teil
  dieses Plans, aber als Folgevorhaben zu notieren — es würde 1.529 LOC
  Eigenimplementierung gegen ~600 tauschen und die Divergenz strukturell beenden.

## 6.8 Leistungsbudget

Als Test, nicht als Absichtserklärung (**Schätzwerte**, in AP2/AP3 zu kalibrieren):

| Messgröße                          | 50 Elemente | 200 Elemente | 500 Elemente |
| ---------------------------------- | ----------: | -----------: | -----------: |
| Import + erstes Bild               |    < 250 ms |     < 700 ms |   < 2.000 ms |
| Layer-Neuberechnung (Sichtwechsel) |     < 80 ms |     < 200 ms |     < 500 ms |
| Overlay-Endpunkt (§3.3.6), 6 Layer |    < 200 ms |     < 400 ms |     < 900 ms |
| Export XML                         |     < 60 ms |     < 200 ms |     < 500 ms |
| Speicherverbrauch der Instanz      |     < 25 MB |      < 60 MB |     < 150 MB |

Ab 500 Elementen wird der Layer-Renderer auf sichtbare Elemente beschränkt
(Viewport-Culling); die Textalternative bleibt vollständig.

## 6.9 Abdeckungsziel

Für `packages/bpmn-engine`: ≥ 85 % Anweisungen in `import/`, `export/`,
`modeling/rules/` und `grc/` (die Bereiche mit Datenwirkung), ≥ 70 % im Rest. Als
Ratchet geführt, analog zu `.eslint-ratchet.json` — die Zahl darf nie sinken.

---

# 7. Arbeitspakete, Reihenfolge, Aufwand

## 7.1 Grundlage und Unsicherheit der Schätzung

Die Zahlen beruhen auf:

- **LOC-Verhältnis** zu `bpmn-js` je Baustein (§2.3), skaliert mit dem reduzierten
  Elementumfang;
- einer angenommenen Produktivität von **50–70 LOC Produktivcode pro Personentag**
  einschließlich Tests, Review und Nacharbeit. Das ist konservativ für
  Anwendungscode und realistisch für Geometrie- und Semantikcode mit hoher
  Testdichte. **Annahme**, nicht gemessen;
- der Erfahrung, dass Bausteine mit vielen Sonderfällen (Modeling-Behaviors,
  Textlayout) systematisch unterschätzt werden — dort ist ein Aufschlag von 30 %
  bereits eingerechnet;
- **Team-Annahme:** zwei Entwickler mit TypeScript- und SVG-Erfahrung, davon einer
  mit `diagram-js`-Einarbeitung. Ohne Einarbeitungszeit gerechnet — die ersten
  ~10 PT von AP2 sind faktisch Einarbeitung.

**Unsicherheitsband:** Engine-Teil (AP0–AP10) **±40 %**, GRC-Teil (AP11–AP18)
**±30 %**, letzterer aber im Umfang steuerbar (Sichten sind einzeln streichbar).

## 7.2 Pakete

| AP       | Inhalt                                                                                                                                                                                        | Abnahme                                                                  |      PT | Unsich.   |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------: | --------- |
| **AP0**  | Vorarbeiten: `bpmn-js-properties-panel` entfernen (spart 41 Pakete), `canUndo`-Fehler beheben, tote `.djs-minimap`-Regel, Fassade `<BpmnCanvas>` einziehen, Flag-Verdrahtung                  | Fassade in allen 3 Importstellen; Bundle kleiner; `canUndo` funktioniert |       5 | ±20 %     |
| **AP1**  | **Testfundament**: Korpus (4 Quellen), `assertBpmnEquivalent`, Generator, eigenschaftsbasierte Round-Trip-Tests, Differenz-Harness gegen `bpmn-js`, CI                                        | Suite läuft grün gegen `bpmn-js` als Referenz                            |      12 | ±25 %     |
| **AP2**  | Workspace `packages/bpmn-engine`, DI-Bootstrap, `bpmn-moddle`-Anbindung, **Import** (moddle + DI → diagram-js), Fehlerbehandlung                                                              | Korpus importiert; Elementmenge und Bounds = `bpmn-js` (§6.4)            |      15 | ±35 %     |
| **AP3**  | **Renderer**: 18 Formen, Marker, Kanten, Textlayout, Label-Positionierung, Icons/Font, Dekorations-Slots (§3.3.1)                                                                             | SVG-Snapshots stabil; Galerie sichtprüfbar                               |      20 | ±40 %     |
| **AP4**  | **Export**: XML (mit DI-Pflege), Read-preserve-write (Z-D), SVG, PNG, **PDF (neu)**                                                                                                           | Z-A/Z-B/Z-C/Z-D grün über den Korpus                                     |       8 | ±30 %     |
| **AP5**  | **Viewer-Ablösung**: Modus `read`, Overlays 1:1, 3 Einbettungen, a11y-Grundlage, Stufe S1/S2                                                                                                  | Viewer läuft für Piloten; visuell abgenommen                             |      10 | ±25 %     |
| **AP6**  | **Modeling-Kern**: `BpmnFactory`, **`BpmnUpdater`**, `BpmnRules`, `BpmnLayouter`, ID-Vergabe, di-ordering                                                                                     | Kommando-Eigenschaftstests (§6.1) grün; Undo stellt Ausgangs-XML her     |      30 | **±50 %** |
| **AP7**  | **Bedienung**: Palette (kuratiert), ContextPad, Replace-Menü, Label-Editing, Snapping, Ausrichten, Kopieren/Einfügen                                                                          | Interaktions-E2E (§6.5, 1–5) grün                                        |      15 | ±35 %     |
| **AP8**  | **Lanes/Pools**: Modellierung, Verhalten, `process_lane`-Synchronisation im Parser                                                                                                            | Lane-E2E grün; `process_lane` gefüllt                                    |      12 | ±40 %     |
| **AP9**  | **Editor-Ablösung**: Modus `edit`/`review`, Shadow-Compare-Speichern, Rollout S3→S4                                                                                                           | 30 Tage / 500 Speichervorgänge ohne Abweichung                           |       8 | ±30 %     |
| **AP10** | **`bpmn-js` entfernen**: Paket, CSS, Icons, Testmocks, `license-gate.mjs`, `NOTICE`, `THIRD-PARTY-LICENSES.md`, ESLint-Ausnahme zurücknehmen                                                  | **Kein `bpmn-js` mehr im Lockfile; Wasserzeichen weg**                   |       4 | ±20 %     |
| **AP11** | **a11y-Ausbau**: Graphnavigation, Live-Region, erweiterte Textalternative + Fließtext, Kontrast-Tests, NVDA/VoiceOver-Durchgang                                                               | §6.6 grün; Konformitätserklärung erstellt                                |      14 | ±30 %     |
| **AP12** | **GRC-Schema**: alle Migrationen aus §3.13, Rehydrierung umstellen, `arctos-grc-extractor` entfernen, Moddle-Extension v2                                                                     | Migrationen produktiv; Rehydrierung ist explizite Aktion                 |      18 | ±30 %     |
| **AP13** | **Layer-Engine**: Registry, Slots, Budget/Sammel-Badge, Sichten, Legende, Rollenvoreinstellungen, `user_diagram_preference`, **Aggregations-Endpunkt** (§3.3.6)                               | Sichten schaltbar; Leistungsbudget eingehalten                           |      16 | ±30 %     |
| **AP14** | **GRC-Welle 1**: Risiko-Heat + Roll-up (F2), Kontrollabdeckung (F1), Feststellungen mit Fälligkeit, Asset am Schritt (B1), **Element-Kommentare + Reviewmodus (F9)**, Dokument/SOP am Schritt | Sichten „Risiko & Kontrolle" und „Verantwortung" abgenommen              |      20 | ±25 %     |
| **AP15** | **GRC-Welle 2**: Datenschutz-Sicht inkl. Vertrauensgrenzen (F5) und Löschfristen (F10), BCM-Sicht + Ausfallsimulation (F6), SoD-Bögen (F3), Nachweisfälligkeit (F4)                           | drei Sichten abgenommen; SoD-Regelwerk pflegbar                          |      22 | ±35 %     |
| **AP16** | **GRC-Welle 3**: Mining/Conformance inkl. `process_event_activity_map` (F7), Framework-Abdeckung (F8), Kosten (F11), EAM-Platzierung (F12), Simulationsparameter inline (B4)                  | drei Sichten abgenommen; Mining weist Abdeckungsquote aus                |      20 | ±35 %     |
| **AP17** | **Auto-Layout** (optional): Schichtalgorithmus für generierte Diagramme (KI-/Excel-Import)                                                                                                    | importierte Diagramme ohne DI sind lesbar                                |      10 | ±50 %     |
| **AP18** | Härtung, Leistungsmessung, Viewport-Culling, Dokumentation, Schulung, Diff-Sicht (F18)                                                                                                        | Budget §6.8 gehalten; Doku vorhanden                                     |      10 | ±30 %     |
|          | **Summe**                                                                                                                                                                                     |                                                                          | **269** |           |

## 7.3 Kritischer Pfad und Parallelität

```
AP0 → AP1 → AP2 → AP3 → AP4 → AP6 → AP7 → AP9 → AP10          ← kritischer Pfad, 117 PT
                          └→ AP5 (Viewer, 10)                  ← ab hier lesende Ansichten neu
                                    └→ AP8 (Lanes, 12) ────────┘  (Vorbedingung für §3.11)
AP11 (a11y) ................ ab AP3, parallel
AP12 (Schema) .............. ab sofort, völlig unabhängig von der Engine
AP13 (Layer-Engine) ........ ab AP12; läuft auf BEIDEN Engines
AP14/15/16 (GRC-Sichten) ... ab AP13; laufen auf BEIDEN Engines
AP17 (Auto-Layout) ......... ab AP6, optional
AP18 (Härtung) ............. Ende
```

**Kritischer Pfad bis zum Wegfall des Wasserzeichens:**
AP0 (5) + AP1 (12) + AP2 (15) + AP3 (20) + AP4 (8) + AP5 (10) + AP6 (30) + AP7 (15)

- AP8 (12) + AP9 (8) + AP10 (4) = **139 PT**. Ohne AP8 (falls Lanes zurückgestellt
  werden — real kommt heute keine einzige Lane vor): **127 PT**.

Bei zwei Entwicklern und ~18 nutzbaren PT pro Person und Monat sind das
**rund 4 Monate** bis zum Wegfall des Wasserzeichens; das Gesamtvorhaben
(269 PT) **rund 7,5 Monate**. Bei drei Entwicklern verkürzt sich der GRC-Teil
deutlich, der Engine-Kern (AP2/AP3/AP6) aber kaum — er ist schlecht teilbar.

**Gesamtaufwand mit Band: 269 PT, Spanne 200–380 PT.** Die untere Grenze setzt
voraus, dass keine Bestandsdiagramme existieren (§5.5), AP8 und AP17 entfallen und
GRC-Welle 3 gestrichen wird. Die obere Grenze tritt ein, wenn AP6 entgleist.

## 7.4 Die entscheidende Beobachtung zur Reihenfolge

**AP12 bis AP16 — das sind 96 PT und der gesamte fachliche Wert — hängen nicht an
der Engine.** Sie bauen auf `overlays`, `canvas` und `elementRegistry`, und diese
drei APIs sind in `bpmn-js` und in der Eigenimplementierung identisch, weil sie beide
Male aus `diagram-js` kommen. Die heutigen fünf Overlay-Kanäle beweisen das.

Daraus folgt eine Reihenfolgeempfehlung, die von der impliziten Reihenfolge des
Auftrags abweicht:

> **Phase 0 (ca. 39 PT, 6–8 Wochen):** AP0 + AP12 + AP13 auf `bpmn-js`.
> Ergebnis: Fassade, „eine Komponente, drei Modi" (Vorgabe 4 erfüllt), Layer-Engine,
> Sichten, Schema für die Elementebene. Das Diagramm wird sofort besser, ohne
> Engine-Risiko.
>
> **Phase 1 (ca. 42 PT):** AP14 + Teile von AP15. Die stärksten GRC-Funktionen sind
> live. Zu diesem Zeitpunkt ist Vorgabe 2 und 3 im Wesentlichen erfüllt.
>
> **Entscheidungspunkt.** Erst jetzt, mit gemessenem Nutzen und einer stabilen
> Layer-Architektur, wird über die 127 PT für die Engine entschieden — mit dem
> Wissen, dass die Layer-Arbeit unverändert weiterläuft, weil sie engine-neutral ist.
>
> **Phase 2 (127 PT):** AP1–AP10, Wasserzeichen fällt.
> **Phase 3:** AP11, AP15/16-Rest, AP17, AP18.

Der einzige Nachteil dieser Reihenfolge: Das Wasserzeichen bleibt etwa drei Monate
länger. Der Vorteil: Der fachliche Nutzen kommt drei Monate früher, und die
teuerste Entscheidung wird mit mehr Wissen getroffen.

## 7.5 Ab wann fällt das Wasserzeichen

**Mit AP10 — und ausschließlich mit AP10.** Nicht mit AP5 (Viewer neu, aber
`bpmn-js` noch im Bundle), nicht mit AP9 (Standard umgestellt, Paket noch da). Das
Kriterium ist das Entfernen des Pakets aus `apps/web/package.json` und dem Lockfile,
weil die Klausel an der Benutzung der Software hängt, nicht an der Sichtbarkeit eines
Codepfads (§1.2, Fallstrick 3).

AP10 selbst ist mit 4 PT klein; es folgt zwingend auf die Abschaltkriterien aus §5.6,
insbesondere die 30 Tage Shadow-Compare. Wer das Wasserzeichen früher entfernt,
verstößt gegen die Lizenz.

---

# 8. Risiken und Alternativen

## 8.1 Risiken

| #   | Risiko                                                                                                                  | Ein­tritt                               | Wirkung                                                                                                   | Gegenmaßnahme                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **`BpmnUpdater` erzeugt ungültiges oder semantisch falsches XML** — Modell, DI und semantischer Baum laufen auseinander | mittel                                  | **sehr hoch** — stille Datenbeschädigung in `process_version.bpmn_xml`, potenziell über Wochen unentdeckt | Shadow-Compare-Speichern (§5.4), Kommando-Eigenschaftstests (§6.1), Undo-Invariante, Read-preserve-write                                                               |
| R2  | **AP6 läuft aus dem Ruder** — die 30 PT werden 60                                                                       | mittel-hoch                             | hoch (Zeit, Vertrauen)                                                                                    | Abbruchkriterium §8.3; Umfangsreduktion über Elementtypen; AP8 als erste Streichoption                                                                                 |
| R3  | **Kein realer Bestandskorpus** — es wird gegen Fiktion getestet                                                         | **hoch** (0 Zeilen in der laufenden DB) | mittel                                                                                                    | vor AP1 klären, ob produktive Diagramme existieren; Generator + Fremdwerkzeug-Exporte als Ersatz                                                                       |
| R4  | **Rechtliche Kontamination durch Codeübernahme** aus `bpmn-js`                                                          | gering                                  | **sehr hoch** — das Vorhaben verfehlt sein einziges Ziel                                                  | schriftliche Regel, Review-Prüfpunkt, kein Vendoring von Assets, `bpmn-font`-Lizenz vorab klären                                                                       |
| R5  | **Drei BPMN-Interpretationen** (Engine, `packages/shared`, `bpmn-js`) driften auseinander                               | hoch                                    | mittel                                                                                                    | gemeinsame Konformitätssuite (§6.7); Folgevorhaben `shared` auf `bpmn-moddle`                                                                                          |
| R6  | **Bedienqualität fällt zurück** — `bpmn-js` ist seit Jahren poliert                                                     | mittel-hoch                             | mittel                                                                                                    | weniger Elementtypen bei gleicher Politur; `bpmn-js` bleibt einen Release lang je Org verfügbar; Nutzertests in der Pilotphase                                         |
| R7  | **Diagramm wird trotz Layer-Konzept zur Tapete**                                                                        | mittel                                  | mittel — die Funktion wird abgeschaltet und war umsonst                                                   | Slot-Budget technisch erzwungen (§3.3.2), Sichten statt Einzelschalter, Nutzertests mit echten Diagrammen vor AP15                                                     |
| R8  | **a11y rutscht ans Ende und fällt weg**                                                                                 | mittel                                  | hoch (Ausschreibungsfähigkeit)                                                                            | Slot-/`describe()`-Pflicht ist Teil des Layer-Interfaces ab AP13, nicht erst AP11; Kontrasttests sind Unit-Tests                                                       |
| R9  | **Leistung bei großen Diagrammen** (500+ Elemente × 6 Layer)                                                            | mittel                                  | mittel                                                                                                    | Budget als Test ab AP2 (§6.8), ein Aggregations-Endpunkt statt N Aufrufen, Viewport-Culling in AP18                                                                    |
| R10 | **Dauerhafte Wartungslast** — ARCTOS pflegt eine BPMN-Engine, die sonst niemand pflegt                                  | **sicher**                              | mittel, aber **permanent**                                                                                | ehrlich einpreisen: **Schätzung 15–25 PT pro Jahr** für Browser-/`diagram-js`-Updates und Fehlerbehebung. Das ist der Preis, den man nach dem Projekt jedes Jahr zahlt |
| R11 | **Schemamigrationen kollidieren mit laufenden Sprints** (14 Tabellen betroffen)                                         | mittel                                  | gering-mittel                                                                                             | alle Migrationen additiv und nullable; die einzige verhaltensändernde (Rehydrierung) bekommt ein eigenes Release                                                       |
| R12 | **`bpmn-font` ist nicht separat MIT-lizenziert**                                                                        | gering                                  | gering (+3 PT)                                                                                            | vorab prüfen (§1.2); Ersatz sind ~24 eigene SVG-Symbole                                                                                                                |

**Der teuerste Irrtum** wäre, mit dem Editor zu beginnen. Wer AP6 vor AP1 und AP5
angeht, hat keine Referenz, kein Sicherheitsnetz und keinen frühen Nutzen — und
merkt einen Fehler im Updater erst, wenn Kundendiagramme beschädigt sind. Die
Reihenfolge Test → Import → Renderer → Export → Viewer → Modeling ist nicht
Geschmackssache; jede Stufe erzeugt das Prüfmittel für die nächste.

**Der zweitteuerste Irrtum** wäre, „bit-treu" als Abnahmekriterium stehenzulassen
und die Migration daran aufzuhängen. Es ist unerreichbar (§5.1), und ein
unerreichbares Kriterium führt entweder zum Abbruch eines funktionierenden Vorhabens
oder — schlimmer — dazu, dass man es stillschweigend aufweicht und am Ende gar keines
mehr hat.

## 8.2 Alternativen

### Alt-A · Wasserzeichen behalten

**Aufwand: 0 PT.** Folge: ein kleiner „bpmn.io"-Schriftzug in der Ecke jedes
Diagramms, auch in SVG-/PNG-Exporten und Audit-Paketen.

Ehrliche Bewertung: Die Lizenz ist ansonsten permissiv und kostenlos. Der
Wasserzeichen-Schriftzug ist ein Positionierungs- und Ästhetikthema, kein
funktionales und kein rechtliches. Zahlreiche kommerzielle Produkte leben damit.
Gegen 269 PT (bzw. 139 PT bis zum Wegfall) gehalten, ist das eine ernstzunehmende
Option — und sie schließt die Alternativen nicht aus: **Alt-A lässt sich mit dem
gesamten Abschnitt 3 kombinieren.** Man bekommt dann „besser als das, was man kaufen
kann" für 96 PT statt für 269, mit Wasserzeichen.

Wenn der Eigentümer das Wasserzeichen als Ausschlusskriterium setzt, ist das eine
legitime Geschäftsentscheidung — sie sollte dann aber als solche benannt werden und
nicht als technische Notwendigkeit.

### Alt-A′ · Kommerzielle bpmn.io-Lizenz

Vom Eigentümer ausgeschlossen (Kostenfreiheit ist Vorgabe). Der Vollständigkeit
halber: Camunda bietet sie an; sie würde das Problem sofort und vollständig lösen.
Der Ausschluss ist eine Kostenentscheidung, keine technische.

### Alt-B · `bpmn-visualization` (Apache-2.0) für lesende Ansichten

Reifer Viewer der Bonitasoft, Apache-2.0, kein Wasserzeichen, gute BPMN-Darstellung,
Overlay-Unterstützung. Würde die drei Viewer-Einbettungen in **geschätzt 8–12 PT**
ersetzen.

**Bewertung: löst das falsche Problem.** Der Editor bliebe auf `bpmn-js`, das Paket
bliebe installiert, die Klausel gälte weiter (§1.2, Fallstrick 3) — das Wasserzeichen
verschwände also nur _optisch_ auf drei Seiten, nicht rechtlich. Schwerer wiegt: Es
wäre eine **zweite Formensprache** neben dem Editor. Das widerspricht Vorgabe 4
direkt und ist genau der Zustand, den ARCTOS heute schon halb hat (Modeler vs.
NavigatedViewer) und loswerden will. Zudem entstünde ein dritter BPMN-Parser
(zusätzlich zu `bpmn-moddle` und `packages/shared`) und die gesamte Layer-Engine aus
§3 müsste doppelt implementiert werden, weil `bpmn-visualization` eine andere
Overlay-API hat.

**Verdikt: nicht empfohlen**, auch nicht als Zwischenschritt. Der einzige Fall, in
dem es sinnvoll wäre: Wenn allein das Mitarbeiterportal (`my-processes`) kurzfristig
wasserzeichenfrei sein _muss_ und der Rest warten kann.

### Alt-C · `maxGraph` (Apache-2.0)

Der aktiv gepflegte TypeScript-Nachfolger von mxGraph. Allgemeiner
Graph-Editor-Baukasten, gute Qualität, keine Lizenzauflagen.

**Bewertung: mehr Arbeit, nicht weniger.** `maxGraph` bringt **keine**
BPMN-Semantik, keine BPMN-Formen, keine DI-Behandlung und keine
`bpmn-moddle`-Anbindung. Alles aus §2.3 müsste ebenso gebaut werden — plus das,
was `diagram-js` heute geschenkt liefert (44 Features, `overlays`, `commandStack`).
Zusätzlich müsste die gesamte ARCTOS-Integration umgeschrieben werden, weil sie
gegen `diagram-js`-APIs geschrieben ist (`canvas`, `elementRegistry`, `overlays`,
`commandStack`). **Schätzung: +40 bis +60 PT gegenüber der `diagram-js`-Variante,
bei gleichem Ergebnis.**

Ein Argument dafür gibt es: `process_notation` kennt neben `bpmn` auch `value_chain`
und `epc`. Wenn ARCTOS mittelfristig **Nicht-BPMN-Notationen** editierbar machen
will, wäre ein allgemeiner Graph-Baukasten die bessere Basis. Das ist ein echter
Abwägungspunkt — aber er sollte dann als eigene Anforderung entschieden werden, nicht
als Nebenwirkung der Lizenzfrage. _(`diagram-js` kann das im Übrigen auch — es ist
selbst notationsneutral; BPMN kommt erst über `bpmn-js` hinzu.)_

### Alt-D · `bpmn-js` forken und das Wasserzeichen entfernen

Rechtlich nicht verfügbar: Die Klausel verbietet genau das („MUST NOT be removed or
changed"). Hier nur genannt, um sie ausdrücklich auszuschließen.

### Alt-E · Nur Abschnitt 3, auf `bpmn-js` — die Empfehlung zur Prüfung

96 PT (AP12–AP16), kein Engine-Risiko, kein Migrationsrisiko, kein Round-Trip-Risiko.
Erfüllt Vorgaben 2 und 3 vollständig und Vorgabe 4 zu großen Teilen (die
Modus-Umstellung von zwei Klassen auf eine ist auf `bpmn-js` in **~4 PT** machbar:
statt `NavigatedViewer` einen `Modeler` ohne die Bearbeitungsmodule instanziieren).
Erfüllt Vorgabe 1 nicht.

Das ist die Alternative mit dem besten Verhältnis von Nutzen zu Risiko — und sie ist
kein Verzicht auf das Vorhaben, sondern dessen Phase 0 und 1 (§7.4). Nach ihr ist
die Engine-Ablösung immer noch vollständig möglich, weil die gesamte Layer-Arbeit
engine-neutral ist.

## 8.3 Abbruchkriterien

Das Vorhaben wird gestoppt und auf Alt-A/Alt-E zurückgeführt, wenn:

1. **nach AP3** (kumuliert 60 PT) die Differenztests gegen `bpmn-js` systematische
   Geometrie- oder Labelabweichungen zeigen, die nicht innerhalb von 5 PT
   schließbar sind — das wäre der Beleg, dass der Import- oder Renderansatz falsch
   ist, und später wird es nur teurer;
2. **AP6** 45 PT überschreitet und die Kommando-Eigenschaftstests weiter fehlschlagen
   — dann ist der `BpmnUpdater` nicht beherrscht, und ohne ihn darf nichts in
   Produktion;
3. der Shadow-Compare (§5.4) in der Pilotphase **anhaltend** Abweichungen liefert,
   die nicht auf einzelne, behebbare Ursachen zurückführbar sind;
4. sich in der Pilotphase zeigt, dass Nutzer die neue Bedienung als Rückschritt
   erleben und das nicht innerhalb von 10 PT behebbar ist;
5. der Eigentümer nach Phase 1 (§7.4) feststellt, dass der fachliche Nutzen erreicht
   ist und das Wasserzeichen die verbleibenden 127 PT nicht wert ist. **Das ist kein
   Scheitern, sondern der Zweck des Entscheidungspunkts.**

## 8.4 Empfehlung

1. **Vor allem anderen:** klären, ob produktive Bestandsdiagramme existieren
   (§5.5, R3). Eine Abfrage, 15 Minuten, verschiebt die Schätzung um ±15 PT.
2. **Phase 0 und 1 durchführen** (AP0, AP12, AP13, AP14 — ca. 59 PT) auf `bpmn-js`.
   Der fachliche Kern (§3) ist das, was ARCTOS von Kaufprodukten unterscheidet, und
   er ist von der Lizenzfrage unabhängig.
3. **Vorgabe 4 sofort erfüllen** — die Zusammenführung von Editor und Viewer zu einer
   Komponente mit Modusschaltung kostet auf `bpmn-js` etwa 4 PT und ist Teil von AP0.
4. **Dann entscheiden**, ob die 127 PT für die Wasserzeichenfreiheit ausgegeben
   werden. Die Entscheidung ist zu diesem Zeitpunkt besser informiert und die
   bisherige Arbeit ist in keinem Fall verloren.
5. **Wenn ja:** strikt in der Reihenfolge AP1 → AP2 → AP3 → AP4 → AP5 → AP6 → AP7 →
   AP9 → AP10, mit Shadow-Compare und den Abschaltkriterien aus §5.6.

---

## Anhang — Annahmen, die zu prüfen sind

| #   | Annahme                                                                                                                  | Wirkung, wenn falsch                       | Prüfung                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| A1  | Es existieren produktive Bestandsdiagramme                                                                               | ±15 PT Migrationsaufwand                   | Abfrage auf die produktiven Mandanten      |
| A2  | `bpmn-font` ist eigenständig unter MIT verfügbar                                                                         | +3 PT für eigene Icons                     | `npm view bpmn-font license`               |
| A3  | Produktivität 50–70 LOC/PT inkl. Tests                                                                                   | Gesamtschätzung skaliert linear            | nach AP2/AP3 nachkalibrieren               |
| A4  | Zwei Entwickler, einer mit `diagram-js`-Einarbeitung                                                                     | Laufzeit, nicht Aufwand                    | Team-Besetzung                             |
| A5  | Es gibt keine Feature-Flag- und keine Nutzerpräferenz-Infrastruktur                                                      | +3 PT in AP0/AP13                          | im Schema geprüft: keine gefunden          |
| A6  | `control` hat oder bekommt ein Feld „Schlüsselkontrolle"                                                                 | Darstellungsdetail in F1                   | Schema prüfen                              |
| A7  | RLS greift auf allen neuen Tabellen aus §3.13 nach demselben Muster wie auf `process_step_*`                             | Sicherheitslücke                           | Migrationsreview + `rls-route-chain`-Tests |
| A8  | Die vorhandenen Tests zu `bpmn-arctos-parse`/`-rehydrate` laufen unverändert weiter, weil sie auf `bpmn-moddle` arbeiten | +2 PT Testanpassung                        | in AP1 verifizieren                        |
| A9  | Leistungsbudget §6.8 ist erreichbar                                                                                      | Viewport-Culling wird Pflicht statt Option | in AP2/AP3 messen                          |
