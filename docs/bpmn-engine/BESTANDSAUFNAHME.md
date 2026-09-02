# ARCTOS — Bestandsaufnahme BPMN-Editor

**Zweck:** Messung des Ist-Zustands vor der Ablösung von `bpmn-js` (Custom-Lizenz
mit Wasserzeichen-Klausel) durch eine Eigenimplementierung auf `diagram-js` (MIT)
und `bpmn-moddle` (MIT).

- **Repo:** `/work/repo`, Branch `audit/full-2026-08-31` (nur gelesen, nichts geändert)
- **Erhebungsdatum:** 2026-09-01
- **Maßgeblich für Schemafragen:** `packages/db/src/schema/**` (die laufende DB ist
  nicht auf Branch-Stand — sie hat 534 Tabellen, aber **0 Zeilen** in `process`,
  `process_version`, `process_step`; sie taugt daher nur für Struktur-, nicht für
  Häufigkeitsfragen. Alle Zähl-Aussagen unten stammen aus dem Repo.)
- **Beilagen:** `inventar_pakete.csv`, `inventar_dateien.csv`,
  `inventar_bpmn_elementtypen.csv`, `inventar_grc_objekte.csv`,
  `editor_funktionen.csv`

Alle Zahlen sind nachgezählt. Wo geschätzt wurde, steht „geschätzt" dabei.

---

## Kernbefund vorab

Die bpmn-js-API-Oberfläche, die ARCTOS tatsächlich benutzt, ist **sehr klein**:
sechs Services (`canvas`, `elementRegistry`, `eventBus`, `overlays`,
`commandStack`, plus die Instanzmethoden `importXML`/`saveXML`/`saveSVG`/
`destroy`) und die Konstruktoroption `moddleExtensions`. Es ist **kein einziges**
eigenes diagram-js-Modul registriert (`additionalModules` kommt im ganzen Repo
nicht vor), es wird **kein** Renderer, **keine** Palette, **kein** ContextPad und
**kein** Modeling-Command überschrieben oder auch nur aufgerufen.

Das Risiko der Eigenimplementierung liegt damit nicht in der Integration, sondern
im **Nachbau des BPMN-Renderings, der Palette/ContextPad-Bedienung und der
BPMN-spezifischen Modellierungsregeln** — also in den ~27.400 Zeilen `bpmn-js`,
die heute unsichtbar dahinterstehen und die niemand im Repo direkt anfasst.

---

# Aufgabe 1 — Vollständiges Inventar der BPMN-Nutzung

## 1.1 npm-Pakete aus dem bpmn.io-Ökosystem

**Direkte Abhängigkeiten — ausschließlich im Workspace `apps/web` (`@grc/web`).**
Kein anderer Workspace (`packages/shared`, `packages/db`, `packages/ui`,
`packages/ai`, `packages/graph`, `packages/reporting`, `packages/automation`,
`packages/events`, `apps/worker`) hat eine bpmn.io-Abhängigkeit — geprüft über
alle 11 `package.json`.

| Paket                      | Version (installiert) | Lizenz                                                             | Art                                   |
| -------------------------- | --------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| `bpmn-js`                  | 18.21.0               | **`SEE LICENSE IN LICENSE`** (Camunda, MIT + Wasserzeichenpflicht) | direkt                                |
| `bpmn-js-properties-panel` | 5.61.0                | MIT                                                                | direkt — **wird nirgends importiert** |
| `bpmn-moddle`              | 10.0.0                | MIT                                                                | direkt                                |

**Transitiv (über `bpmn-js` / `bpmn-moddle`), 19 Pakete:**
`@bpmn-io/diagram-js-ui@0.2.4`, `bpmn-moddle@10.0.0`, `clsx@2.1.1`,
`diagram-js@15.22.0`, `diagram-js-direct-editing@3.5.1`, `didi@11.0.0`,
`domify`, `htm`, `ids@3.0.2`, `inherits-browser@0.1.0`, `min-dash@5.1.0`,
`min-dom@5.3.0`, `moddle@8.1.0`, `moddle-xml@12.0.0`, `object-refs@0.4.0`,
`path-intersection@4.1.0`, `preact`, `saxen`, `tiny-svg@4.1.4`.
Alle MIT bzw. ISC (`inherits-browser`).

**Nur wegen des ungenutzten `bpmn-js-properties-panel` installiert: 41 Pakete.**
Darunter der komplette CodeMirror-/Lezer-/FEEL-Stack
(`@codemirror/*` ×7, `@lezer/*` ×6, `@bpmn-io/feel-*`/`feelers-*` ×6,
`@bpmn-io/properties-panel`, `camunda-bpmn-js-behaviors`, `camunda-bpmn-moddle`,
`zeebe-bpmn-moddle`, `focus-trap`, `tabbable`, `semver`, …). Vollständige Liste
in `inventar_pakete.csv`. Das ist ein sofort abbaubarer Ballast, unabhängig vom
Vorhaben.

**Die Lizenzklausel** (`node_modules/bpmn-js/LICENSE`), die das Vorhaben auslöst:

> The source code responsible for displaying the bpmn.io project watermark that
> links back to https://bpmn.io as part of rendered diagrams MUST NOT be removed
> or changed. When this software is being used in a website or application, the
> watermark must stay fully visible and not visually overlapped by other elements.

Sie ist im Repo an vier Stellen verankert und CI-durchgesetzt:

- `scripts/license-gate.mjs:68` — `ACKNOWLEDGED["bpmn-js"].requiresWatermark = true`
- `scripts/license-gate.mjs:130` — `checkBpmnWatermark()` scannt `apps/`+`packages/`
  nach fünf Mustern, die `.bjs-powered-by` ausblenden oder überdecken würden
- `apps/web/src/components/bpmn/bpmn-editor.css:14-46` — dokumentierte
  Nicht-Entfernen-Regel; bis 2026-08-31 stand hier `display:none !important`
- `NOTICE:38` und `THIRD-PARTY-LICENSES.md:41`

Nach der Ablösung entfallen alle vier Verankerungen; `license-gate.mjs` muss
angepasst werden (sonst schlägt der Gate mit „ACKNOWLEDGED-Eintrag ohne Paket" um
oder wird stumm).

## 1.2 Dateien mit bpmn.io-Bezug

### `apps/web/src/components/bpmn/` — 10 Dateien, 3.167 Zeilen

| Datei                          | LOC | Aufgabe                                                                                                                                                                                                                                                                                          | genutzte bpmn-js-Oberfläche                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------ | --: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bpmn-editor.tsx`              | 672 | React-Wrapper um den **Modeler** (bzw. NavigatedViewer bei `readOnly`); 5 Overlay-Kanäle; Ctrl/Cmd+S; Drill-Down; imperative Ref (`saveXml`, `saveSvg`, `undo`, `redo`, `canUndo`, `canRedo`, `getModeler`)                                                                                      | `bpmn-js/lib/Modeler`, `bpmn-js/lib/NavigatedViewer` (dynamischer Import, `ssr:false`); Optionen `container`, `keyboard:{bindTo:document}`, `moddleExtensions`; Services `canvas` (`zoom`, `scroll`), `elementRegistry` (`getAll`), `eventBus` (`on`), `overlays` (`add`, `remove`), `commandStack` (`undo/redo/canUndo/canRedo`); Methoden `importXML`, `saveXML({format:true})`, `saveSVG`, `destroy` |
| `bpmn-viewer.tsx`              | 360 | React-Wrapper um den **NavigatedViewer**, read-only; Risk-Badges + Call-Activity-Drill-Down                                                                                                                                                                                                      | `bpmn-js/lib/NavigatedViewer`; `canvas`, `elementRegistry`, `eventBus`, `overlays`; `importXML`, `destroy`                                                                                                                                                                                                                                                                                              |
| `bpmn-a11y.tsx`                | 331 | WCAG-Nachrüstung (S14-10): `canvasA11yProps` (`role="application"`, `tabIndex=0`), `useBpmnKeyboardNavigation` (Pfeile pannen, +/- zoomen, 0/Home fit), `makeInteractiveOverlay` (Overlay-Badges als `role=button`/`role=img`), `BpmnTextAlternative` (Tabellen-Äquivalent), `readModelElements` | nur strukturelle Annahmen: `canvas.zoom/scroll`, `elementRegistry.getAll()` liefert `{id,type,businessObject.name}`; filtert `bpmn:Process`, `bpmn:Collaboration`, `label`                                                                                                                                                                                                                              |
| `arctos-properties-panel.tsx`  | 603 | GRC-Eigenschaftenpanel für das **selektierte** Element: LoD, RACI (R/A/C/I), verknüpfte Controls, Call-Activity-Ziel. Reines Formular über REST — **kein** bpmn-js-Bezug                                                                                                                         | keine                                                                                                                                                                                                                                                                                                                                                                                                   |
| `shape-side-panel.tsx`         | 287 | Seitenpanel: Elementtyp-Icon/Label, verknüpfte Risiken, Responsible-Rolle                                                                                                                                                                                                                        | nur String-Mapping `bpmn:xxx` → `StepType`; **keine** bpmn-js-API                                                                                                                                                                                                                                                                                                                                       |
| `arctos-grc-extractor.ts`      | 344 | Legacy-Regex-Reader/Writer für `arctos:*` im rohen XML; beide Hauptfunktionen `@deprecated`                                                                                                                                                                                                      | keine (Regex auf XML-String)                                                                                                                                                                                                                                                                                                                                                                            |
| `arctos-moddle-extension.json` | 118 | **Die** ARCTOS-Moddle-Extension (Schema für `arctos:*`)                                                                                                                                                                                                                                          | wird als `moddleExtensions.arctos` an Modeler/Viewer und an `BpmnModdle()` gereicht                                                                                                                                                                                                                                                                                                                     |
| `bpmn-toolbar.tsx`             | 181 | Toolbar: Save, Export (XML/SVG/PNG), Undo/Redo, Versions-/Dirty-/ReadOnly-Anzeige                                                                                                                                                                                                                | keine (nur Callbacks)                                                                                                                                                                                                                                                                                                                                                                                   |
| `risk-link-search.tsx`         | 216 | Risiko-Suche/Verknüpfung im Seitenpanel                                                                                                                                                                                                                                                          | keine                                                                                                                                                                                                                                                                                                                                                                                                   |
| `bpmn-editor.css`              |  55 | importiert `bpmn-js/dist/assets/diagram-js.css`, `bpmn-js.css`, `bpmn-font/css/bpmn-embedded.css`; `.bjs-container`, `.bjs-powered-by{z-index:2}`, `.djs-minimap{…}`                                                                                                                             | CSS-Klassen von diagram-js/bpmn-js                                                                                                                                                                                                                                                                                                                                                                      |

### Weitere Importstellen im Repo (außerhalb `components/bpmn/`)

| Datei                                                               | Bezug                                                                                                                                                       |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/bpmn-arctos-parse.ts` (228 LOC)                   | `import { BpmnModdle } from "bpmn-moddle"` — serverseitiges Lesen der `arctos:*`-Metadaten; `arctosModdle` = geteilte Registry                              |
| `apps/web/src/lib/bpmn-arctos-write.ts` (189 LOC)                   | `import type { ModdleElement } from "bpmn-moddle"`; schreibt/ersetzt `arctos:grcMetadata` über das Objektmodell und serialisiert mit `toXML({format:true})` |
| `apps/web/src/lib/bpmn-arctos-rehydrate.ts` (217 LOC)               | nutzt `parseArctosGrcMetadataMap`; schreibt DB-Querverweise aus dem XML zurück und baut sie für den Export wieder auf                                       |
| `apps/web/src/types/bpmn-moddle.d.ts` (36 LOC)                      | eigene Typdeklaration — `bpmn-moddle` liefert keine Typen                                                                                                   |
| `apps/web/src/app/(dashboard)/processes/[id]/page.tsx` (2.151 LOC)  | `dynamic(() => import(".../bpmn-editor"))` + `.../bpmn-viewer`, jeweils `ssr:false`; Kommentar: „bpmn-js does NOT work with SSR"                            |
| `apps/web/src/app/(dashboard)/my-processes/[id]/page.tsx` (383 LOC) | `import { BpmnViewer }` (statisch)                                                                                                                          |
| `apps/web/src/__tests__/components/all-components-smoke.test.tsx`   | `vi.mock("bpmn-js")` und `vi.mock("bpmn-js/lib/Modeler")` mit einer Stub-Klasse                                                                             |
| `apps/web/eslint.config.mjs:155`                                    | `react-hooks/incompatible-library` abgeschaltet — „recharts/bpmn-js interop"                                                                                |
| `scripts/license-gate.mjs`, `scripts/generate-notice.mjs`           | Wasserzeichen-/Lizenzgate (s. o.)                                                                                                                           |

### BPMN-Verarbeitung **ohne** bpmn.io (eigene, MIT-freie Implementierung)

`packages/shared` hat **keine** bpmn.io-Abhängigkeit und parst BPMN selbst — mit
`fast-xml-parser` bzw. Regex. Diese 1.529 Zeilen sind von der Umstellung
**nicht** betroffen und zeigen zugleich, dass ARCTOS bereits eine zweite,
unabhängige BPMN-Interpretation pflegt (Divergenzrisiko):

| Datei                                                | LOC | Aufgabe                                                                        | Parser            |
| ---------------------------------------------------- | --: | ------------------------------------------------------------------------------ | ----------------- |
| `packages/shared/src/bpmn-parser.ts`                 | 251 | XML → `ProcessStep`-Sätze (Sync in `process_step`)                             | `fast-xml-parser` |
| `packages/shared/src/bpmn-validator.ts`              | 358 | 4 konfigurierbare Regeln (StartEvent, EndEvent, disconnected, Gateway-Default) | `fast-xml-parser` |
| `packages/shared/src/bpmn-diff.ts`                   | 106 | Versionsvergleich                                                              | —                 |
| `packages/shared/src/lib/bpmn-raci-engine.ts`        | 239 | RACI aus Lanes/Pools/MessageFlows ableiten                                     | Regex             |
| `packages/shared/src/lib/bpmn-walkthrough-engine.ts` | 254 | Schritt-für-Schritt-Ausführungssicht                                           | Regex             |
| `packages/shared/src/lib/excel-to-bpmn.ts`           | 321 | Excel-Import → BPMN-XML erzeugen                                               | String-Bau        |

## 1.3 Custom-Module und Extensions — was ist wirklich gebaut worden?

Systematisch gesucht nach `additionalModules`, `__init__`, `BaseRenderer`,
`customRenderer`, `moddleExtensions`, `$inject`, Palette-/ContextPad-Provider.
Ergebnis:

| „Modul"                                                                                                          | Was es wirklich ist                                                                                                                                    | bpmn-js-Integrationstiefe                                                                                         |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `arctos-moddle-extension.json`                                                                                   | **Echte bpmn.io-Erweiterung** (Moddle-Package `ArctosGRC`, `uri: https://arctos.grc/schema/bpmn/1.0`, prefix `arctos`, `tagAlias: lowerCase`, 9 Typen) | wird als `moddleExtensions` registriert — die **einzige** Stelle, an der ARCTOS in die bpmn.io-Mechanik eingreift |
| `arctos-grc-extractor.ts`                                                                                        | Regex-Reader/Writer auf dem rohen XML-String, ausdrücklich „works without modifying bpmn-js core". Beide Hauptfunktionen `@deprecated`                 | **keine**                                                                                                         |
| `bpmn-arctos-parse.ts` / `-write.ts`                                                                             | serverseitige moddle-basierte Nachfolger von `arctos-grc-extractor` (B1.2/B1.3)                                                                        | nur `bpmn-moddle`, nicht bpmn-js                                                                                  |
| `bpmn-arctos-rehydrate.ts`                                                                                       | DB-Rehydrierung aus dem XML + Export-Aufbau                                                                                                            | **keine**                                                                                                         |
| `bpmn-a11y.tsx`                                                                                                  | React-/DOM-Nachrüstung um den Canvas herum                                                                                                             | nur `canvas`/`elementRegistry`                                                                                    |
| 5 Overlay-Kanäle im Editor (`risk-badge`, `control-badge`, `lod-stripe`, `finding-badge`, `call-activity-badge`) | imperativ erzeugte `HTMLElement`, über den Standard-`overlays`-Service gehängt                                                                         | Standard-API, kein Modul                                                                                          |

**Es gibt keine registrierten diagram-js-Module, keinen eigenen Renderer, keine
eigene Palette, kein eigenes ContextPad, keine eigenen Modeling-Behaviors und
keine `bpmnlint`-Regeln.** Das ist für die Planung die wichtigste Zahl von
Aufgabe 1.

## 1.4 Tatsächlich verwendete BPMN-Elementtypen

Zwei getrennte Messungen. Vollständig in `inventar_bpmn_elementtypen.csv`.

### (a) Was der Code erzeugen/erkennen **kann**

Der Editor selbst schränkt nichts ein — der bpmn-js-Modeler bietet seine
vollständige Palette an. Die Obergrenze setzt vielmehr die ARCTOS-Verarbeitung.
`packages/shared/src/bpmn-parser.ts` und `bpmn-validator.ts` kennen zusammen
**25 Elementtypen** (jeweils in prefixed und unprefixed Schreibweise):

- **Tasks (8):** `task`, `userTask`, `serviceTask`, `sendTask`, `receiveTask`,
  `manualTask`, `businessRuleTask`, `scriptTask`
- **Gateways (5):** `exclusiveGateway`, `parallelGateway`, `inclusiveGateway`,
  `eventBasedGateway`, `complexGateway`
- **Events (5):** `startEvent`, `endEvent`, `intermediateCatchEvent`,
  `intermediateThrowEvent`, `boundaryEvent`
- **Subprozesse (3):** `subProcess`, `adHocSubProcess`, `transaction`
- **CallActivity (1):** `callActivity`
- **Kanten/Struktur (3):** `sequenceFlow`, `conditionExpression`, `process`

Der Parser mappt diese auf **5** DB-Werte (`step_type`-Enum): `task`, `gateway`,
`event`, `subprocess`, `call_activity`. Alles darüber hinaus (Lanes, Pools,
DataObjects, Message Flows, Textannotationen, Artefakte) landet **nicht** in
`process_step` und ist damit für jede DB-gestützte Verknüpfung unsichtbar.

Ausnahme: `bpmn-raci-engine.ts` liest zusätzlich `lane`, `laneSet`,
`flowNodeRef`, `participant`, `messageFlow` — aber nur für die abgeleitete
RACI-Matrix, nicht für `process_step`.

### (b) Was in Seed-Daten, Tests und Beispiel-XML **real vorkommt**

Gezählt über alle XML-Literale im Repo (Seed-SQL, Unit-Tests, E2E-Fixtures).
Die laufende DB enthält 0 Prozesse, liefert also keine zusätzliche Evidenz.

| Elementtyp                                                                                    |  Vorkommen (real) | Fundorte                                                                       |
| --------------------------------------------------------------------------------------------- | ----------------: | ------------------------------------------------------------------------------ |
| `bpmn:definitions`                                                                            |                27 | alle                                                                           |
| `bpmn:process`                                                                                |                25 | alle                                                                           |
| `bpmn:sequenceFlow`                                                                           |                32 | Seed-Demo (21), validator-Tests (11)                                           |
| `bpmn:task`                                                                                   |                31 | Seed-Demo (14), diff-Tests (6), validator-Tests (7), E2E (3), parser-Tests (1) |
| `bpmn:startEvent`                                                                             |                22 | Seed-Demo (6), diff (5), validator (4), parser (4), E2E (3)                    |
| `bpmn:endEvent`                                                                               |                20 | Seed-Demo (6), diff (4), validator (4), parser (4), E2E (2)                    |
| `bpmn:userTask`                                                                               |                10 | parser-Tests (5), arctos-Tests (5)                                             |
| `bpmn:serviceTask`                                                                            |                 3 | parser-Tests (1), arctos-parse-Test (2)                                        |
| `bpmn:exclusiveGateway`                                                                       |                 2 | parser-Tests, validator-Tests                                                  |
| `bpmn:callActivity`                                                                           |                 1 | **Seed-Demo** (`seed_demo_14_july_features.sql`)                               |
| `bpmn:subProcess`                                                                             |                 1 | parser-Tests                                                                   |
| `bpmn:conditionExpression`                                                                    |                 1 | validator-Tests                                                                |
| `bpmn:extensionElements`                                                                      |                 3 | arctos-Tests                                                                   |
| DI: `bpmndi:BPMNShape` / `BPMNEdge` / `BPMNPlane` / `BPMNDiagram`, `dc:Bounds`, `di:waypoint` | 27/21/11/11/33/42 | Seed-Demo + parser-Tests                                                       |
| `arctos:grcMetadata` (+ riskRefs/controlRefs/documentRefs/raci/ropa)                          |            5 (+9) | arctos-Tests                                                                   |

**Nicht ein einziges Mal** kommen real vor: `laneSet`/`lane`/`flowNodeRef`
(nur in Codelisten des RACI-Engines), `participant`/`collaboration`,
`messageFlow`, `dataObject`/`dataObjectReference`/`dataStoreReference`,
`textAnnotation`/`association`, `boundaryEvent`, `intermediate*Event`,
`parallelGateway`, `inclusiveGateway`, `eventBasedGateway`, `complexGateway`,
`transaction`, `adHocSubProcess`, `sendTask`/`receiveTask`/`manualTask`/
`businessRuleTask`/`scriptTask`.

**Interpretation:** Real gebraucht werden heute **6 Elementtypen** —
`startEvent`, `endEvent`, `task`, `userTask`/`serviceTask`, `exclusiveGateway`,
`sequenceFlow` — plus `callActivity` (ein Seed-Beispiel) und `subProcess`. Der
Rest ist Codepfad ohne Datenbasis. Für eine Eigenimplementierung heißt das: ein
belastbarer MVP-Renderer braucht ca. 8–10 Formen, nicht 60.

## 1.5 Viewer vs. Modeler — Seiten gezählt

**Modeler (bearbeitbar): genau 1 Seite, 1 Einbindung.**

- `apps/web/src/app/(dashboard)/processes/[id]/page.tsx`, Tab **„editor"**
  (Zeile 1442, `<BpmnEditorDynamic>`). `readOnly = !canEdit` — bei fehlender
  Berechtigung wird derselbe Komponentenbaum mit dem NavigatedViewer geladen
  (`bpmn-editor.tsx:164`).

**Viewer (nur lesend): 3 Einbindungen auf 2 Seiten.**

1. `processes/[id]/page.tsx:922` — Overview-Tab, „BPMN Preview"
   (mit Call-Activity-Badges + Drill-Down)
2. `processes/[id]/page.tsx:1680` — Versions-Tab, Dialog „Version ansehen"
3. `my-processes/[id]/page.tsx:289` — Portal-/Mitarbeitersicht (nur `xml`,
   keine Overlays, `minHeight=420`)

Zum Vergleich: unter `(dashboard)/processes/**` liegen **14 Seiten**
(`bia`, `compare`, `maturity`, `mining`, `racm`, `ropa`, `vsm`, `cockpit`,
`governance`, `new`, Liste, Detail; dazu `my-processes` ×2) und **96 API-Routen**
unter `api/v1/processes/**`. Von diesen 14 Seiten zeigen **2** ein Diagramm.
Alle übrigen 12 arbeiten rein tabellarisch/formularbasiert auf demselben Prozess.

## 1.6 Persistenz des BPMN-XML und die ARCTOS-Erweiterungen

**Spalte / Tabelle / Format**

- `process_version.bpmn_xml` — `text`, **nullable**
  (`packages/db/src/schema/process.ts:179`).
- Daneben: `process_version.diagram_json` (`jsonb`, ungenutzt für BPMN),
  `diff_summary_json` (`jsonb`), `version_number` (int, unique je Prozess),
  `is_current` (bool), `version_type` (`working` | `released`).
- Es gibt keine zweite XML-Spalte. `process.metro_layout` (`jsonb`) und
  `value_stream_map.diagram_data` (`jsonb`) sind eigene, BPMN-fremde Layouts.
- Format: BPMN 2.0 mit DI, formatiert (`saveXML({format:true})`).
  Präfix in Seed und Tests durchgängig `bpmn:`; der `shared`-Parser akzeptiert
  bewusst auch unpräfigierte Varianten.

**Schreibpfade**

- Client: `useBpmnEditor.save()` → `editorRef.saveXml()` → `POST
/api/v1/processes/:id/versions` mit `{ bpmnXml, changeSummary }`
- Server: `POST .../versions` legt eine neue `process_version` an und ruft
  `rehydrateFromBpmnXml()` (`lib/bpmn-arctos-rehydrate.ts`)
- Import: `POST /api/v1/processes/import-bpmn-xml`, `POST
/processes/import-excel`, `POST /processes/generate-bpmn` (KI),
  `POST /processes/ai/generate-from-text`

**Lesepfade**

- `GET /processes/:id/export/xml` — rohes XML als Datei
- `GET /processes/:id/versions/:versionId/xml-with-grc-attrs` — XML **plus**
  aktuell aus der DB rekonstruierte `arctos:*`-Extension-Elemente
  (`buildArctosLinksFromDb` → `injectGrcMetadataModdle`)
- Client-Export: XML / SVG (`saveSVG`) / PNG (SVG→Canvas, Faktor 2)

**ARCTOS-eigene Erweiterungen im XML — das kritische Stück**

- **Namespace:** `https://arctos.grc/schema/bpmn/1.0`, Präfix `arctos`
- **Anker:** `<bpmn:extensionElements>` **am einzelnen Flow-Node**
- **Wurzelelement:** `<arctos:grcMetadata>` mit
  - Attributen: `lineOfDefense`, `complianceProfile`, `calledProcessId`,
    `isCriticalProcess` (bool, default false)
  - Kindern: `<arctos:riskRefs>/<arctos:riskRef id title inherentScore
residualScore status>`, `<arctos:controlRefs>/<arctos:controlRef id title
effectiveness controlType>`, `<arctos:documentRefs>/<arctos:documentRef id
title documentType>`, `<arctos:raci responsibleRoleId accountableRoleId
consultedRoleIds informedRoleIds>`, `<arctos:bcmKpi mtpdMinutes rtoMinutes
rpoMinutes criticality>`, `<arctos:ropa isProcessingActivity purpose
legalBasis requiresDpia>`

Anforderungen an die Eigenimplementierung, die sich daraus zwingend ergeben:

1. `moddleExtensions` muss weiterhin funktionieren (`bpmn-moddle` liefert das —
   siehe 4.3), sonst gehen `arctos:*`-Elemente beim Round-Trip verloren.
2. `injectGrcMetadataModdle` garantiert heute ausdrücklich, dass **fremde**
   `extensionElements` (camunda, zeebe, …) erhalten bleiben und ein vorhandenes
   `arctos:grcMetadata` **ersetzt statt dupliziert** wird. Das ist Verhalten mit
   Testabdeckung (`__tests__/lib/bpmn-arctos-parse.test.ts`,
   `bpmn-arctos-rehydrate.test.ts`) und muss erhalten bleiben.
3. Zwei parallele Reader existieren: der `@deprecated` Regex-Pfad
   (`arctos-grc-extractor.ts`, noch von `__tests__/components/
arctos-grc-extractor.test.ts` benutzt) und der moddle-Pfad. Bei der
   Umstellung ist der Regex-Pfad ein sauberer Kandidat zum Entfernen.
4. Die `xml:tagAlias: "lowerCase"`-Einstellung: Typ `GrcMetadata` wird als
   `<arctos:grcMetadata>` serialisiert. `localType()` in `bpmn-arctos-parse.ts`
   vergleicht deshalb case-insensitiv gegen `"grcmetadata"`. Jede Eigenlösung,
   die `tagAlias` nicht identisch umsetzt, produziert stumm unlesbare Altdaten.

---

# Aufgabe 2 — GRC-Feature-Inventar für die Diagrammfläche

## 2.1 Was heute an Prozess bzw. Prozesselement hängt

Gezählt im Schema (`packages/db/src/schema/**`, 534 Tabellen in der DB, ~120
Schema-Dateien):

- **Tabellen mit `process_id` (Prozessebene): 26** — verteilt auf 11 Schema-Dateien
  (`architecture_element`, `bia_process_impact`, `continuity_strategy`, `dpia`,
  `eam_business_context`, `essential_process`, `finding`, `process_approval_step`,
  `process_asset`, `process_comment`, `process_conformance_result`,
  `process_control`, `process_document`, `process_event_log`,
  `process_framework_mapping`, `process_kpi_definition`,
  `process_maturity_assessment`, `process_review_schedule`, `process_risk`,
  `process_ropa_profile`, `process_sign_off`, `process_step`, `process_version`,
  `ropa_entry`, `simulation_scenario`, `value_stream_map`) — in der laufenden DB
  gegengeprüft: 30 Spalten `process_id`/`process_step_id` über 30 Tabellen
- **Tabellen mit `process_step_id` (Elementebene über `process_step`): 4** —
  `process_step_risk`, `process_step_control`, `process_step_asset`,
  `finding.process_step_id`
- **Tabellen mit direkter BPMN-ID (Elementebene ohne `process_step`): 3** —
  `process_step.bpmn_element_id`, `process_raci_override.activity_bpmn_id` +
  `participant_bpmn_id`, `eam_bpmn_element_placement.bpmn_node_id`,
  sowie `simulation_activity_param.activity_id`

`process_step` ist die Brücke: `UNIQUE(process_id, bpmn_element_id)`. Jede
Elementverknüpfung, die nicht über `process_step` läuft, kennt nur die rohe
BPMN-ID und bricht, wenn das Element umbenannt/gelöscht wird.

## 2.2 Was davon im Diagramm sichtbar ist — und was nur daneben

**Im Diagramm sichtbar (5 Overlay-Kanäle, alle im Editor, 2 davon auch im Viewer):**

| Kanal                 | Overlay-Typ           | Position     | Inhalt                                                       | Quelle                                |
| --------------------- | --------------------- | ------------ | ------------------------------------------------------------ | ------------------------------------- |
| Risiken               | `risk-badge`          | oben rechts  | `Anzahl · Höchstscore`, Ampel (>15 rot, >8 gelb, sonst grün) | `useProcessStepRisks`                 |
| Kontrollabdeckung     | `control-badge`       | oben links   | `🛡 wirksam/gesamt`, 4-stufige Farbe                          | `GET /processes/:id/control-coverage` |
| Line of Defense       | `lod-stripe`          | linke Kante  | 4px-Farbstreifen (1./2./3./oversight)                        | `process.steps[].lineOfDefense`       |
| Offene Feststellungen | `finding-badge`       | unten rechts | `⚠ Anzahl`, rot bei kritischen                               | `GET /processes/:id/findings`         |
| Call-Activity         | `call-activity-badge` | unten links  | `↗ Name`, klick-/tastaturbedienbar, Doppelklick im Viewer    | `GET /processes/:id/call-links`       |

Die ersten vier sind über vier Buttons oben rechts im Canvas ein-/ausschaltbar
(`processes/[id]/page.tsx:1650-1680`). Standardmäßig ist **nur** „Risks" an.

**Nur in Formularen daneben — 14 Tabs auf der Detailseite** (`page.tsx:588-604`):
`overview`, `editor`, `versions`, `risks`, `history`, `comments`, `controls`,
`bia`, `findings`, `compliance`, `approval`, `signoff`, `audit-trail`,
`documents`. Dazu 12 Unterseiten (`bia`, `compare`, `maturity`, `mining`,
`racm`, `ropa`, `vsm`, …) und das Seitenpanel (`ShapeSidePanel` +
`ArctosPropertiesPanel`), das erst nach Klick auf ein Element erscheint.

**Das ist die Lücke, um die es geht:** von rund 30 fachlichen Objektarten, die
sinnvoll am Diagramm hängen könnten, sind heute **5** am Element sichtbar. Alles
Weitere existiert im Datenmodell, im API und in einem Formular — aber nicht auf
der Fläche, auf der der Prozess besprochen wird.

## 2.3 Inventar der Fachobjekte

Vollständig mit Tabellen, heutigem Verknüpfungsgrad, sinnvollen Elementtypen und
Sichtbarkeitsempfehlung in **`inventar_grc_objekte.csv`** (36 Zeilen). Zusammenfassung:

### A — heute schon auf Elementebene verknüpft **und** im Diagramm sichtbar (5)

| Fachobjekt                              | Tabelle(n)                                           | Granularität            |
| --------------------------------------- | ---------------------------------------------------- | ----------------------- |
| Risiko                                  | `risk`, `process_step_risk`, `process_risk`          | Element **und** Prozess |
| Kontrolle                               | `control`, `process_step_control`, `process_control` | Element **und** Prozess |
| Feststellung                            | `finding.process_step_id` / `.process_id`            | Element **und** Prozess |
| Line of Defense                         | `process_step.line_of_defense` (`lod_enum`)          | Element                 |
| Untergeordneter Prozess (Call Activity) | `process_step.called_process_id`                     | Element                 |

### B — heute auf Elementebene verknüpft, aber **nicht** im Diagramm sichtbar (5)

| Fachobjekt                        | Tabelle(n)                                                                                                                                      | wo es heute lebt                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Asset / Anwendung am Schritt      | `process_step_asset` → `asset`                                                                                                                  | nur API (`/steps/:id/assets`), **keine UI im Panel**                                                              |
| RACI (R/A/C/I)                    | `process_step.raci_responsible_role_id`, `.raci_accountable_role_id`, `process_raci_override(activity_bpmn_id, participant_bpmn_id, raci_role)` | `ArctosPropertiesPanel` + RACM-Unterseite                                                                         |
| EAM-Objekt-Platzierung            | `eam_bpmn_element_placement(bpmn_node_id, position_x, position_y)`                                                                              | **nur API** `GET/POST/DELETE /api/v1/eam/bpmn-placements` — es gibt keinerlei UI, die diese Platzierungen rendert |
| Simulationsparameter je Aktivität | `simulation_activity_param(activity_id, duration_min/most_likely/max, cost_per_execution, resource_id, gateway_probabilities)`                  | Simulations-Unterseite                                                                                            |
| DMN-Entscheidung                  | `dmn_decision.linked_process_step_id`                                                                                                           | `/dmn`-Liste (kein DMN-Editor im Repo)                                                                            |

### C — heute nur auf **Prozessebene** verknüpft; Elementebene wäre fachlich sinnvoll (14)

| Fachobjekt                              | Tabelle(n)                                                                                                                                                        | sinnvolle Elementtypen                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Dokument / Richtlinie / SOP             | `process_document` → `document`                                                                                                                                   | Task, SubProcess, DataObject                                                                     |
| ROPA / Verarbeitungstätigkeit           | `process_ropa_profile`, `ropa_entry.process_id`                                                                                                                   | Task, SubProcess, DataObject, Lane                                                               |
| DPIA                                    | `dpia.process_id`, `process_ropa_profile.dpia_id`                                                                                                                 | SubProcess, Task                                                                                 |
| Compliance-Anforderung / Katalogeintrag | `process_framework_mapping` → `catalog_entry`                                                                                                                     | Task, Gateway, SubProcess                                                                        |
| BIA / Kritikalität, MTPD/RTO/RPO        | `bia_process_impact`, `essential_process`, `continuity_strategy`                                                                                                  | SubProcess, Task, Lane                                                                           |
| Prozess-KPI                             | `process_kpi_definition`, `process_kpi_measurement`                                                                                                               | Task, SequenceFlow, ganzer Prozess                                                               |
| Reifegrad                               | `process_maturity_assessment`, `process_maturity_questionnaire`                                                                                                   | ganzer Prozess                                                                                   |
| Freigabe / Sign-off                     | `process_approval_step`, `process_sign_off` (Hash-Kette)                                                                                                          | ganzer Prozess / Version                                                                         |
| Kommentar                               | `process_comment(entity_type ∈ {process, process_step}, entity_id)`                                                                                               | **Element bereits im Schema und im API vorgesehen — die UI ruft nur `entityType="process"` auf** |
| Event-Log / Mining                      | `process_event_log`, `process_event(activity: varchar)`, `process_conformance_result(bottlenecks, rework_loops, fitness_gaps jsonb)`, `process_mining_suggestion` | Task (Verknüpfung heute nur über **Aktivitätsname**, nicht ID)                                   |
| Value Stream Map                        | `value_stream_map(diagram_data jsonb)`                                                                                                                            | Task, SequenceFlow                                                                               |
| Simulationsergebnis                     | `simulation_scenario`, `process_simulation_result`                                                                                                                | Task, Gateway                                                                                    |
| Architekturelement (EAM)                | `architecture_element.process_id`, `eam_business_context.process_id`                                                                                              | Task, Lane, DataObject                                                                           |
| Aufgabe / Maßnahme                      | `task`, `work_item` (kein `process_id`)                                                                                                                           | Task, Gateway                                                                                    |

### D — heute **gar nicht** mit Prozessen verknüpft, aber fachlich naheliegend (12)

| Fachobjekt                | Tabelle(n)                                                          | mögliche Elementtypen                |
| ------------------------- | ------------------------------------------------------------------- | ------------------------------------ |
| Kontrolltest              | `control_test`, `control_test_campaign`                             | Task (über die verknüpfte Kontrolle) |
| Nachweis / Evidenz        | `evidence`, `evidence_artifact`                                     | Task                                 |
| Datenkategorie            | `ropa_data_category`, `ropa_data_subject`, `eam_data_object`        | DataObject, DataStore                |
| Vorfall / Incident        | `security_incident`, `incident_timeline_entry`, `dora_ict_incident` | Task, Lane                           |
| Auditfeststellung / Audit | `audit`, `audit_checklist_item`, `audit_universe_entry`             | Task, SubProcess                     |
| Lieferant / Vendor        | `vendor`, `vendor_risk_assessment`, `contract`                      | Task, Lane, Pool, MessageFlow        |
| Schulung                  | `academy_course`, `academy_enrollment`                              | Task, Lane                           |
| Kosten / Budget           | `grc_budget_line`, `grc_cost_entry`, `grc_time_entry`               | Task, SubProcess                     |
| KRI                       | `kri`, `kri_measurement`                                            | Task, Gateway                        |
| Rolle / Stakeholder       | `custom_role`, `stakeholder`, `user_organization_role`              | Lane, Pool                           |
| Richtlinien-Kenntnisnahme | `policy_distribution`, `policy_acknowledgment`                      | Task                                 |
| SoD / Zugriff             | `abac_policy`, `access_review`                                      | Lane, Task                           |

## 2.4 Was am Element **sichtbar** sein müsste vs. erst beim Klick

Empfehlung je Klasse (Detail je Objekt in `inventar_grc_objekte.csv`):

**Immer sichtbar (Badge / Marker / Farbe) — Signal „hier stimmt etwas nicht":**

- Risiko-Score-Ampel (bereits da)
- Kontrollabdeckung wirksam/gesamt (bereits da)
- Offene/kritische Feststellungen (bereits da)
- LoD-Farbstreifen (bereits da)
- Drill-Down-Pfeil bei Call Activity (bereits da)
- **Neu:** personenbezogene Daten / ROPA-Marker (DSGVO-Relevanz), fehlende
  Freigabe/Sign-off, offene Maßnahme, veraltetes/nicht freigegebenes Dokument,
  Mining-Abweichung (Bottleneck/Rework), Kostentreiber, Reifegrad-Lücke

**Erst beim Anklicken (Seitenpanel):**

- Titel/Status jeder verknüpften Kontrolle, jedes Risikos, jedes Dokuments
- vollständige RACI-Zuordnung inkl. C/I
- ROPA-Felder (Zweck, Rechtsgrundlage, Aufbewahrung, TOMs)
- BCM-Kennzahlen (MTPD/RTO/RPO)
- Simulationsparameter, KPI-Zeitreihen
- Historie/Audit-Trail des Elements

**Grundsatz aus dem Ist-Zustand:** Der A11y-Baustein (`bpmn-a11y.tsx`) zeigt,
dass jede Farb-/Formkodierung zwingend ein textliches Äquivalent braucht — der
`lod-stripe` trägt heute bereits ein explizites `aria-label`, weil eine 4px-Farbe
allein WCAG 1.4.1 verletzt. Jeder neue visuelle Kanal muss das mitliefern, sonst
fällt die Neuimplementierung hinter den erreichten Stand zurück.

---

# Aufgabe 3 — Was der Editor heute kann

Vollständig in `editor_funktionen.csv`. Legende: **✅ vorhanden** ·
**◐ teilweise** · **✖ nicht vorhanden**.

| #   | Funktion                                        | Stand                 | Fundstelle / Bemerkung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Palette**                                     | ✅ (bpmn-js-Standard) | Kein eigener Palette-Provider; die volle BPMN-Palette ist aktiv, obwohl real nur ~6 Typen genutzt werden (1.4b).                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2   | **Kontextmenü / ContextPad**                    | ✅ (Standard)         | Kein `ContextPadProvider`-Override im Repo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3   | **Label-Editing**                               | ✅ (Standard)         | `diagram-js-direct-editing@3.5.1` + `bpmn-js/lib/features/label-editing`. Doppelklick im Edit-Modus bleibt bewusst dem Label-Editing überlassen (`bpmn-editor.tsx:249-260`).                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 4   | **Undo / Redo**                                 | ◐                     | `commandStack.undo/redo/canUndo/canRedo` über `BpmnEditorRef` (`bpmn-editor.tsx:539-601`), Buttons in `bpmn-toolbar.tsx:143-160`. **Aber:** `canUndo={editorRef.current?.canUndo() ?? false}` (`page.tsx:1409`) wird im Render gelesen, ohne dass `commandStack.changed` ein Re-Render auslöst → die Buttons bleiben faktisch deaktiviert, bis die Seite aus anderem Grund neu rendert. Tastatur-Undo (Ctrl+Z) funktioniert über das bpmn-js-Keyboard-Modul.                                                                                                                                  |
| 5   | **Zoom / Pan**                                  | ✅                    | Maus: `ZoomScrollModule` + `MoveCanvasModule` (bpmn-js-Standard). Tastatur: `useBpmnKeyboardNavigation` (Pfeile ±60px, `+`/`-` ×1,2, `0`/`Home` = fit-viewport), gebunden am Canvas-Element. Initial `canvas.zoom("fit-viewport")`.                                                                                                                                                                                                                                                                                                                                                           |
| 6   | **Minimap**                                     | ✖                     | `bpmn-editor.css:50` positioniert `.djs-minimap` — aber `diagram-js-minimap` ist **nicht installiert** und nirgends importiert. Die CSS-Regel ist tot.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7   | **Auto-Layout**                                 | ✖                     | Kein Layout-Algorithmus im Repo. `bpmn-js` bringt `auto-place` (Position beim Anhängen) mit, aber kein Re-Layout ganzer Diagramme. Erzeugte Diagramme (Excel-Import, KI) bringen DI aus dem Generator mit.                                                                                                                                                                                                                                                                                                                                                                                    |
| 8   | **Lanes / Pools**                               | ◐                     | Im Canvas voll bedienbar (bpmn-js-Standard). **Aber:** `bpmn-parser.ts` überführt Lanes/Pools **nicht** in `process_step` → keine DB-Verknüpfung, keine Overlays, kein Seitenpanel. Nur `bpmn-raci-engine.ts` liest Lanes (Regex) für die abgeleitete RACI-Matrix. In Seed/Tests kommt keine einzige Lane vor.                                                                                                                                                                                                                                                                                |
| 9   | **Kollaboration (mehrere Nutzer gleichzeitig)** | ✖                     | Keine WebSocket-/CRDT-/Presence-Infrastruktur für den Editor. Nebenläufigkeit wird über Versionen und die `working`/`released`-Unterscheidung (`process_version.version_type`) abgefedert, nicht verhindert.                                                                                                                                                                                                                                                                                                                                                                                  |
| 10  | **Validierung**                                 | ◐                     | Eigene Engine `packages/shared/src/bpmn-validator.ts` (4 Regeln: fehlendes StartEvent/EndEvent, unverbundene Elemente, Gateway ohne Default; je Regel `error`/`warning`/`disabled`), org-weit konfigurierbar über `GET/PUT /organizations/:id/bpmn-validation-config`. Ausgeliefert als **Zähler auf dem Overview-Tab** (`page.tsx:1051-1078`). **Kein `bpmnlint`, keine Marker am Element, kein Live-Feedback im Editor.**                                                                                                                                                                   |
| 11  | **Import**                                      | ✅                    | `POST /processes/import-bpmn-xml`, `POST /processes/import-excel` (+ Template-Download), `POST /processes/generate-bpmn` (KI, mehrere Provider, governance-geprüft), `POST /processes/ai/generate-from-text`.                                                                                                                                                                                                                                                                                                                                                                                 |
| 12  | **Export**                                      | ✅                    | Toolbar-Dropdown: BPMN XML / SVG (`saveSVG`) / PNG (`use-bpmn-editor.ts:56-93`, SVG→`<img>`→Canvas ×2 → `toBlob`). Server: `GET /processes/:id/export/xml`, `GET /processes/:id/versions/:vid/xml-with-grc-attrs`, `GET /processes/:id/raci/export`, `/ropa/export`, `POST /processes/audit-pack`.                                                                                                                                                                                                                                                                                            |
| 13  | **Tastaturbedienung**                           | ◐                     | War laut Audit-Finding **S14-10** praktisch nicht vorhanden (Baseline im Quellcode dokumentiert: `grep -c "aria-\|tabIndex\|onKeyDown\|role=" src/components/bpmn/*.tsx` → **0 in allen sechs Dateien**). Nachgerüstet: fokussierbarer Canvas (`role="application"`, `tabIndex=0`), Pan/Zoom/Fit per Tastatur, Overlay-Badges als `role="button"` mit Enter/Space, Ctrl/Cmd+S zum Speichern. **Weiterhin nicht vorhanden:** Element-zu-Element-Navigation _innerhalb_ des SVG per Tastatur (ausdrücklich als Nicht-Ziel dokumentiert, `bpmn-a11y.tsx:29-33`); Ersatz ist die Tabellenansicht. |
| 14  | **Barrierefreiheit**                            | ◐                     | `BpmnTextAlternative` — sichtbare, aufklappbare Tabelle aller Elemente (Name/Typ/ID), Zeilen selektieren das Element; `aria-describedby` vom Canvas darauf. Alle 5 Overlay-Kanäle haben `aria-label` (i18n in `messages/{de,en}/bpmn.json`). Getestet in `__tests__/a11y/components-axe.test.tsx` und `e2e/a11y-smoke.spec.ts` (axe). Lücke: Kontrastprüfung der Badge-Farben auf dem Diagramm, Fokusreihenfolge zwischen Canvas und Overlays.                                                                                                                                                |
| 15  | **Druck / Bildexport**                          | ◐                     | SVG und PNG ja (s. 12). **Kein PDF-Export des Diagramms** — `pdf-lib`/`pdfkit` sind vorhanden, werden aber für Berichte genutzt, nicht für den Canvas. Kein `@media print`-Stylesheet für die Diagrammseite.                                                                                                                                                                                                                                                                                                                                                                                  |
| 16  | **Versionierung**                               | ✅                    | `process_version` mit `version_number` (unique je Prozess), `is_current`, `version_type` (`working`/`released`), `change_summary`, `diff_summary_json`. UI: Versions-Tab, Ansehen-Dialog mit Viewer, Restore (`POST /versions/restore`), Vergleich (`/versions/compare`, `/compare-detailed`, Seite `processes/[id]/compare`), Diff-Engine `packages/shared/src/bpmn-diff.ts`.                                                                                                                                                                                                                |
| 17  | **Kommentare**                                  | ◐                     | `process_comment` mit Threads, Mentions, Resolve. Schema **und** API unterstützen `entity_type = "process_step"` (`components/process/process-comments.tsx:49`), die UI ruft aber ausschließlich `entityType="process"` auf (`page.tsx:663`). **Keine Kommentar-Pins am Diagramm.**                                                                                                                                                                                                                                                                                                           |
| 18  | **Simulation**                                  | ◐                     | Vollständiges Backend: `simulation_scenario`, `simulation_activity_param` (je Aktivität: 3-Punkt-Dauer, Kosten, Ressource, Gateway-Wahrscheinlichkeiten), `process_simulation_result`, Routen `/simulation/{run,results,compare,cost,scenarios}`. **Kein Token-Flow, keine Animation, keine Ergebnisdarstellung am Diagramm** — nur eigene Seiten. `bpmn-js-token-simulation` ist nicht installiert.                                                                                                                                                                                          |
| 19  | **Properties-Panel (bpmn.io)**                  | ✖                     | `bpmn-js-properties-panel@5.61.0` ist deklariert, aber **nirgends importiert**. ARCTOS hat stattdessen `arctos-properties-panel.tsx` (eigenes Formular über REST).                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 20  | **Drill-Down in Sub-/Call-Prozesse**            | ✅ (ARCTOS-eigen)     | Badge `↗`, Doppelklick im Viewer, `router.push('/processes/:childId?from=…')`; Rückweg über `GET /processes/:id/call-links`. bpmn-js' eigenes `drilldown`-Feature (Sub-Prozess aufklappen) wird **nicht** genutzt.                                                                                                                                                                                                                                                                                                                                                                            |
| 21  | **SSR**                                         | n/a                   | Editor und Viewer werden auf der Hauptseite über `next/dynamic` mit `ssr:false` geladen; auf `my-processes/[id]` ist der Viewer **statisch** importiert (nur wegen `"use client"` unkritisch).                                                                                                                                                                                                                                                                                                                                                                                                |

---

# Aufgabe 4 — Technische Randbedingungen

## 4.1 Welche bpmn-js-Teile werden konkret gebraucht?

**Direkt im ARCTOS-Code angesprochene Oberfläche — vollständig:**

```
Klassen:   bpmn-js/lib/Modeler            (Editor)
           bpmn-js/lib/NavigatedViewer    (Viewer + readOnly-Editor)
Optionen:  { container, keyboard:{bindTo:document}, moddleExtensions:{arctos} }
Methoden:  importXML(xml) · saveXML({format:true}) · saveSVG() · destroy() · get(name)
Services:  canvas          → zoom(mode|number), scroll({dx,dy})
           elementRegistry → getAll()  [erwartet {id, type, businessObject.name}]
           eventBus        → on("commandStack.changed"|"element.click"|"element.dblclick")
           overlays        → add(elementId, type, {position:{top|bottom|left|right}, html}) · remove({type})
           commandStack    → undo() · redo() · canUndo() · canRedo()
CSS:       bpmn-js/dist/assets/diagram-js.css
           bpmn-js/dist/assets/bpmn-js.css
           bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css
```

Das ist alles. **Kein** `modeling`, **kein** `elementFactory`, **kein**
`bpmnFactory`, **kein** `palette`/`contextPad`/`popupMenu`/`replace`-Zugriff,
**kein** `canvas.addMarker`, **kein** `BaseRenderer`, **kein**
`additionalModules` — im ganzen Repo nachgeprüft.

**Was trotzdem nachgebaut werden muss, weil es implizit gebraucht wird** — das
ist der eigentliche Aufwand:

| Nachzubauendes bpmn-js-Teil                                                                                                                                                                                                                                                                                             |    Umfang (LOC in bpmn-js 18.21.0) | Warum unverzichtbar                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/draw` — `BpmnRenderer`, `PathMap`, `TextRenderer`                                                                                                                                                                                                                                                                  |                              3.328 | Ohne Renderer sieht man nichts. Enthält die BPMN-Formensprache inkl. Marker (Multi-Instance, Loop, Ad-hoc, Kompensation) und Label-Layout. |
| `lib/import` — `Importer`, `BpmnTreeWalker`, `BpmnImporter`                                                                                                                                                                                                                                                             | ~1.100 (geschätzt aus Verzeichnis) | Übersetzt moddle-Baum + DI in diagram-js-Shapes/Connections.                                                                               |
| `lib/features/modeling` (BpmnRules, Behaviors, Commands, `BpmnLayouter`)                                                                                                                                                                                                                                                |                             10.922 | BPMN-Semantik beim Bearbeiten: was darf woran, Lane-Splitting, Boundary-Attachment, Flow-Routing. Der größte Einzelposten.                 |
| `lib/features/palette` + `context-pad` + `replace` + `popup-menu`                                                                                                                                                                                                                                                       |                              3.199 | Die Bedienung selbst. Hier ist der größte Freiheitsgrad — ARCTOS braucht nicht die volle BPMN-Palette (1.4b).                              |
| `lib/features/label-editing`                                                                                                                                                                                                                                                                                            |                   ~700 (geschätzt) | Direkte Beschriftung; setzt auf `diagram-js-direct-editing` (MIT, wiederverwendbar).                                                       |
| `lib/features/drilldown`, `di-ordering`, `auto-place`, `auto-resize`, `snapping`, `grid-snapping`, `ordering`, `search`, `copy-paste`, `align/distribute`, `keyboard`, `editor-actions`, `outline`, `interaction-events`, `space-tool`, `replace-preview`, `append-preview`, `modeling-feedback`, `rules`, `label-link` |                    Rest von 27.401 | Komfort. Einzeln verzichtbar, in Summe der Unterschied zwischen „Prototyp" und „Editor".                                                   |
| **`bpmn-js` gesamt**                                                                                                                                                                                                                                                                                                    |                     **27.401 LOC** |                                                                                                                                            |

Der Export als SVG (`saveSVG`) lebt in `BaseViewer` und ist eine dünne
Serialisierung des Canvas-SVG — leicht nachbaubar.

## 4.2 Was `diagram-js@15.22.0` bereits von sich aus leistet

Gegen die **tatsächlich installierte** Version geprüft
(`node_modules/diagram-js/lib`, 31.844 LOC, MIT). Nicht nachzubauen:

**Kern (`lib/core`):** `Canvas` (Viewport, Zoom, Scroll, Root-Elemente, Layer,
Marker), `ElementRegistry`, `ElementFactory`, `EventBus`, `GraphicsFactory`.
**Infrastruktur:** `lib/command` (CommandStack inkl. **Undo/Redo**),
`lib/model`, `lib/layout` (`BaseLayouter`, `CroppingConnectionDocking`,
Manhattan-Routing), `lib/draw` (`BaseRenderer`, `DefaultRenderer`, Styles),
`lib/i18n`, `lib/ui`, `lib/util`, DI-Container `didi`.

**44 fertige Features** in `lib/features/`:
`align-elements`, `attach-support`, `auto-place`, `auto-resize`, `auto-scroll`,
`bendpoints`, `change-support`, `clipboard`, `complex-preview`, `connect`,
`connection-preview`, `context-pad`, `copy-paste`, `create`,
`distribute-elements`, `dragging`, `editor-actions`, `global-connect`,
`grid-snapping`, `hand-tool`, `hover-fix`, `interaction-events`, `keyboard`,
`keyboard-move-selection`, `label-support`, `lasso-tool`, `modeling`, `mouse`,
`move`, `ordering`, `outline`, **`overlays`**, `palette`, `popup-menu`,
`preview-support`, `replace`, `resize`, `root-elements`, `rules`, `scheduler`,
`search`, `search-pad`, `selection`, `snapping`, `space-tool`, `tool-manager`,
`tooltips`.
Dazu `lib/navigation/`: `movecanvas` (Pan), `zoomscroll` (Zoom), `keyboard-move`.

**Konkret für ARCTOS heißt das:** _alle sechs_ heute genutzten Services
existieren in diagram-js unverändert — `canvas`, `elementRegistry`, `eventBus`,
`overlays`, `commandStack` (über `lib/command`) und die Modeling-Basis. Die
Overlay-Logik (5 Kanäle, ~230 Zeilen im Editor) läuft **1:1 weiter**. Ebenso
Palette-, ContextPad- und Popup-Menu-**Rahmen** — nur ihre BPMN-Inhalte fehlen.

## 4.3 Was `bpmn-moddle@10.0.0` leistet — und was offen bleibt

**Leistet (MIT, mit `moddle@8.1.0` + `moddle-xml@12.0.0` + `saxen`):**

- vollständiges BPMN-2.0-Metamodell als JSON-Schema (BPMN, BPMNDI, DC, DI)
- `fromXML(xml)` → typisierter Objektbaum mit `$type`, `$parent`, Referenzauflösung
- `toXML(root, {format})` → gültige Serialisierung inkl. Namespace-Deklarationen
- **Extension-Packages** (`BpmnModdle({arctos: …})`) — genau der Mechanismus,
  auf dem `arctos-moddle-extension.json` beruht; `xml.tagAlias`, `isAttr`,
  `isMany`, `superClass` funktionieren identisch
- Erhalt unbekannter Extension-Elemente über `$children`/`any`

**Bleibt offen (bpmn-moddle liefert es nicht):**

1. **DI ↔ Grafik.** `bpmn-moddle` liest `BPMNShape`/`BPMNEdge`/`Bounds`/
   `waypoint`, aber verknüpft sie nicht mit Formen. Der Abgleich
   `bpmnElement`-Referenz ↔ Shape und die Erzeugung der diagram-js-Elemente ist
   `bpmn-js/lib/import` — nachzubauen.
2. **DI beim Schreiben.** Neu erzeugte/verschobene Elemente brauchen korrekt
   gepflegte `BPMNShape`/`BPMNEdge` samt `di-ordering`; das macht heute
   `bpmn-js/lib/features/modeling`.
3. **Semantische Regeln.** Was an was darf (BoundaryEvent nur an Aktivitäten,
   SequenceFlow nicht über Pool-Grenzen, MessageFlow nur zwischen Pools) —
   das ist `BpmnRules`, nicht moddle.
4. **ID-Vergabe.** `ids@3.0.2` (MIT) erzeugt kollisionsfreie BPMN-IDs; separat
   einzubinden.
5. **Validierung gegen das Metamodell.** moddle wirft bei grobem Unsinn, prüft
   aber keine BPMN-Wohlgeformtheit. ARCTOS hat dafür bereits
   `packages/shared/src/bpmn-validator.ts` (4 Regeln) — ausbaufähig.

## 4.4 Stellen, an denen bpmn-js-internes Verhalten angenommen wird

Systematisch gesucht (`djs-`, `bjs-`, `bpmn-icon`, `data-element-id`,
Event-Namen, DOM-Struktur) in `apps/`, `packages/`, `tests/`, `apps/web/e2e/`.

| #   | Annahme                                                                                                                                   | Fundstelle                                                                                                                 | Bricht bei Eigenimplementierung?                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | CSS-Klassen `.bjs-container`, `.bjs-powered-by`, `.djs-minimap`                                                                           | `bpmn-editor.css:9,44,50`                                                                                                  | **Ja** — `.bjs-*` sind bpmn-js-spezifisch. `.bjs-powered-by` verschwindet mit dem Wasserzeichen (gewollt). `.djs-minimap` ist ohnehin tot.                                                                            |
| 2   | Die drei Stylesheets aus `bpmn-js/dist/assets/**` inkl. **BPMN-Icon-Font** (`bpmn-font`)                                                  | `bpmn-editor.css:4-6`                                                                                                      | **Ja** — Palette und ContextPad rendern ihre Icons über diese Font. Ein eigener Editor braucht eigene Icons oder eine eigenständig lizenzierte Icon-Quelle (`bpmn-font` liegt in `bpmn-js/dist`, fällt also mit weg). |
| 3   | Event-Namen `element.click`, `element.dblclick`, `commandStack.changed`                                                                   | `bpmn-editor.tsx:208,234,254`; `bpmn-viewer.tsx:133,150`                                                                   | **Nein**, sofern diagram-js verwendet wird — alle drei sind diagram-js-Events (`lib/features/interaction-events`, `lib/command`).                                                                                     |
| 4   | Elementtypen als `bpmn:`-präfigierte Strings (`element.type !== "bpmn:Process"`, Filter auf `bpmn:Collaboration` und `"label"`)           | `bpmn-editor.tsx:238`; `bpmn-viewer.tsx:137`; `bpmn-a11y.tsx:322-324`; `page.tsx:1295-1300`; `shape-side-panel.tsx:60-100` | **Ja, wenn** die Eigenimplementierung andere Typ-Strings vergibt. Der Pseudotyp `"label"` ist eine bpmn-js-Erfindung für Label-Shapes und muss bewusst reproduziert oder ersetzt werden.                              |
| 5   | `element.businessObject.name` als Zugriffspfad                                                                                            | `bpmn-editor.tsx:243`; `bpmn-viewer.tsx:143`; `bpmn-a11y.tsx:311,329`                                                      | **Ja** — `businessObject` ist die bpmn-js-Brücke zum moddle-Objekt. Nachbaubar, aber Vertrag.                                                                                                                         |
| 6   | `overlays.add(elementId, type, {position:{top/bottom/left/right}, html})` mit HTML-`transform: translate(±50%,…)` zum Feinjustieren       | 5× in `bpmn-editor.tsx`, 2× in `bpmn-viewer.tsx`                                                                           | **Nein** — reine diagram-js-API. Die Pixelwerte (`-14`) hängen aber an der Shape-Geometrie des bpmn-js-Renderers; nach Neu-Rendering nachzujustieren.                                                                 |
| 7   | `canvas.zoom("fit-viewport")`, `canvas.zoom("")` als Getter, `canvas.scroll({dx,dy})`                                                     | `bpmn-editor.tsx:195,610`; `bpmn-a11y.tsx:108-129`                                                                         | **Nein** — diagram-js-`Canvas`-API, unverändert.                                                                                                                                                                      |
| 8   | `keyboard: { bindTo: document }` als Konstruktoroption                                                                                    | `bpmn-editor.tsx:172`                                                                                                      | Teilweise — diagram-js `lib/features/keyboard` kennt die Option, die bpmn-spezifischen Bindings (`bpmn-js/lib/features/keyboard`) fehlen.                                                                             |
| 9   | `new BpmnClass(...)` erwartet Default-Export aus `bpmn-js/lib/{Modeler,NavigatedViewer}`                                                  | `bpmn-editor.tsx:164-168`; `bpmn-viewer.tsx:97`                                                                            | **Ja** — Importpfad ändert sich; genau **3** Stellen.                                                                                                                                                                 |
| 10  | Kein SSR (`ssr:false`, „bpmn-js does NOT work with SSR")                                                                                  | `page.tsx:81-107`                                                                                                          | Bleibt gleich — jede DOM-/SVG-basierte Lösung ist Client-only.                                                                                                                                                        |
| 11  | ESLint-Ausnahme `react-hooks/incompatible-library` wegen bpmn-js-Interop                                                                  | `apps/web/eslint.config.mjs:155`                                                                                           | Kann nach Umstellung wieder eingeschaltet werden (Chance, kein Risiko).                                                                                                                                               |
| 12  | Testmocks `vi.mock("bpmn-js")` / `vi.mock("bpmn-js/lib/Modeler")` mit Stub-Klasse (`importXML`, `saveXML`, `destroy`, `on`, `off`, `get`) | `__tests__/components/all-components-smoke.test.tsx:118-138`                                                               | **Ja** — Mocks müssen auf den neuen Modulpfad umgeschrieben werden, sonst importiert der Smoke-Test die echte Implementierung in jsdom.                                                                               |

**E2E:** In `apps/web/e2e/` (20 Specs) und `tests/e2e/regression/` (47 Specs,
**kein einziger** mit BPMN-Bezug) gibt es
**keinerlei** Zugriff auf bpmn-js-DOM. `bpm-approval-pipeline.spec.ts` und
`process-portal.spec.ts` erzeugen BPMN-XML über die API und prüfen danach nur
Listen/Status. Der Canvas selbst wird von **keinem** E2E-Test bedient. Das ist
gleichzeitig eine gute Nachricht (nichts bricht) und ein Risiko (nichts fängt
eine Regression ab). `a11y-smoke.spec.ts` prüft Seiten mit axe, aber ohne
Interaktion im Diagramm.

**Unit-Tests mit BPMN-Bezug:** 3 in `apps/web` (`arctos-grc-extractor`,
`bpmn-arctos-parse`, `bpmn-arctos-rehydrate`) + 3 in `packages/shared`
(`bpmn-parser`, `bpmn-validator`, `bpmn-diff`). Alle arbeiten auf XML-Strings,
keiner auf einer bpmn-js-Instanz. **Es gibt keinen einzigen Test, der den Editor
oder den Viewer mit echtem bpmn-js rendert.**

---

## Anhang — Zahlen auf einen Blick

| Messgröße                                                                   | Wert                            |
| --------------------------------------------------------------------------- | ------------------------------- |
| bpmn.io-Pakete: direkt / transitiv / nur wegen ungenutztem Properties-Panel | 3 / 19 / **41**                 |
| Workspaces mit bpmn.io-Abhängigkeit                                         | 1 von 11 (`apps/web`)           |
| Dateien in `components/bpmn/` (LOC)                                         | 10 (3.167)                      |
| Dateien, die bpmn-js/bpmn-moddle direkt importieren                         | 5 Quell- + 1 Typ- + 1 Testdatei |
| Eigene BPMN-Verarbeitung ohne bpmn.io (`packages/shared`, LOC)              | 6 Dateien (1.529)               |
| Registrierte diagram-js-Custom-Module                                       | **0**                           |
| Moddle-Extensions                                                           | 1 (`ArctosGRC`, 9 Typen)        |
| bpmn-js-Services im Einsatz                                                 | 5 (+4 Instanzmethoden)          |
| Editor-Seiten / Viewer-Einbindungen                                         | 1 / 3 (auf 2 Seiten)            |
| Prozess-Seiten insgesamt / Prozess-API-Routen                               | 14 / 96                         |
| Tabs auf der Prozess-Detailseite                                            | 14                              |
| BPMN-Elementtypen, die der Code kennt / real vorkommen                      | 25 / 8                          |
| `step_type`-Enum-Werte in der DB                                            | 5                               |
| Tabellen mit `process_id` / `process_step_id` / direkter BPMN-ID            | 26 / 4 / 4                      |
| Overlay-Kanäle am Element                                                   | 5                               |
| GRC-Fachobjekte im Inventar (A/B/C/D)                                       | 36 (5 / 5 / 14 / 12)            |
| LOC bpmn-js / diagram-js (installiert)                                      | 27.401 / 31.844                 |
