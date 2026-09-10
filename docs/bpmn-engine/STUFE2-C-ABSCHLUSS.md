# Stufe 2 / C — Abschluss: Bearbeitungsmodus freigeschaltet, Restdefekte behoben

Repo `/work/repo`, Branch `audit/full-2026-08-31`, Stand über Commit
`17b632bc` (unversioniert). Nicht committet, wie beauftragt.

**In einem Satz:** Der Bearbeitungspfad läuft auf der eigenen Engine — alle
**vier** Einbindungsstellen, lesend wie schreibend —, und der
Eigenschaftstest ist unter `PROPERTY_STRICT=1` erstmals **grün**, von 16/200
rot auf 0/2.000 rot, mit einer leeren Liste bekannter Befunde.

---

## 0. Stand in Zahlen

| Messwert                                                             | vorher (B2)                       | jetzt                  |
| -------------------------------------------------------------------- | --------------------------------- | ---------------------- |
| Einbindungsstellen auf `@grc/bpmn` (bei `ARCTOS_BPMN_ENGINE=arctos`) | 3,5 von 4                         | **4 von 4**            |
| `PROPERTY_STRICT=1`, 200 Folgen                                      | **16 rot**                        | **0 rot**              |
| `PROPERTY_STRICT=1`, 2.000 Folgen (24.000 Operationen)               | nicht gemessen                    | **0 rot**              |
| Offene Einträge in `test/verify/known-findings.ts`                   | 11                                | **0**                  |
| Tests `packages/bpmn`                                                | 694                               | **711**                |
| Tests `apps/web`                                                     | 2.425 grün / 1 rot                | **2.430 grün / 0 rot** |
| `npx tsc --noEmit` über 13 tsconfigs                                 | 2 rot (apps/web über `@grc/bpmn`) | **13 grün**            |
| `npx prettier --check` (Repo-Wurzel)                                 | 45 Dateien rot                    | **grün**               |

---

## 1. Aufgabe 1 — Der Bearbeitungsmodus ist frei

### 1.1 Was freigeschaltet wurde

**`packages/bpmn/src/viewer/BpmnCanvas.ts`** — ein Bauteil, drei Modi, jetzt
auch der dritte:

- Die Modulliste kommt aus `editorModulesFor({ mode, chrome })`. Der Modus
  entscheidet weiterhin allein über die Registrierung: `read`/`review`
  registrieren die Bearbeitungsmodule schlicht nicht. Der Vorbehalt
  (`allowIncompleteEditMode`, `MISSING_EDIT_MODULES`) und die Fehlermeldung
  „Der Editor-Modus ist in diesem Spike nicht ausgeführt" sind **entfallen**.
- **Der Import unterscheidet sich mit dem Modus, und zwar aus einem
  inhaltlichen Grund.** Zum Zeichnen genügt die flache Szene aus
  `src/draw/scene.ts`; zum Bearbeiten braucht es den geschachtelten Baum mit
  `parent`/`children`, `host`/`attachers`, `labelTarget` — den baut
  `src/modeling/importer.ts`. Im Editor-Modus läuft deshalb `bpmnImporter`;
  die Szene entsteht zusätzlich, aber **nur als Projektion** für
  Textalternative, Graphnavigation und SVG-Export, und wird nach jeder
  Änderung neu gerechnet statt fortgeschrieben.
- Neu: `exportXml()`, `dirty`, `getDefinitions()`, `undo()/redo()/canUndo()/
canRedo()`. Der Kommandostapel wird im Lesemodus gar nicht erst geholt —
  `canUndo()` ist dort `false`, weil es ihn nicht gibt, nicht weil jemand es
  behauptet.
- Neue Optionen: `chrome` (zweite Achse aus Plan §2.4), `editor`
  (`config.editor`), `exportXml` (symmetrisch zu `importXml`, damit eine
  Anwendung mit **einer** moddle-Registry liest und schreibt).

**`packages/bpmn/src/viewer/modules.ts`** — `EDITING_MODULES` enthält
`diagram-js/features/modeling` **nicht** mehr. Es registriert `modeling` und
`layouter`, und beides liefert `src/modeling` in einer BPMN-fähigen Fassung;
zwei Anbieter desselben Dienstnamens wären eine Reihenfolgenfrage statt einer
Entscheidung gewesen. Die Modellierungsschicht bringt das generische Modul
über ihre eigenen `__depends__` mit.

**`apps/web/src/components/bpmn/bpmn-editor.tsx`** — die Bedingung ist weg:

```ts
export function editorEngineFor(props) {
  const engine = resolveBpmnEngine(
    props.engine ? { explicit: props.engine } : {},
  );
  if (engine !== "arctos") return "legacy";
  return supportsMode(modeFor(props.readOnly ?? false)) ? "arctos" : "legacy";
}
```

Übrig bleibt der Schalter. `modeFor(readOnly)` übersetzt die Rechtefrage in
den Modus (`true → "read"`, `false → "edit"`), und die Brücke reicht ihn an
den Adapter durch. `SUPPORTED_MODES` im Adapter führt jetzt `"edit"`.

### 1.2 `saveXml` nach Bearbeitung — und Z-D bleibt

Der Adapter gab bisher den Eingabetext zurück, weil er nichts anderes konnte.
Jetzt fragt er `BpmnCanvas.exportXml()`, und **dort** hängt die Entscheidung
am Kommandostapel:

```ts
if (!this.modified && this.sourceXml !== null) return this.sourceXml; // Z-D
return exporter(this.definitions);
```

`modified` setzt ein einziger Zuhörer auf `commandStack.changed`. Damit gilt:

- **unbearbeitet → byteweise identisch.** Nicht „gleichwertig", nicht
  „semantisch gleich": derselbe String. Jede lesende Fläche speichert damit
  bitgleich, ohne dass jemand daran denken muss.
- **bearbeitet → aus dem Modell.** Sonst ginge die Bearbeitung beim Speichern
  verloren — der schlimmste denkbare Fehler dieser Schicht.

Der Import selbst setzt `modified` ausdrücklich zurück; er läuft an der
Kommandokette vorbei und ist kein Bedienschritt.

Belegt in `packages/bpmn/test/draw/viewer.test.ts` („BpmnCanvas
(Bearbeitungspfad)", 4 Tests) und in
`apps/web/src/__tests__/components/bpmn-engine-switch.test.tsx` („Der
Bearbeitungspfad auf der eigenen Engine", 2 Tests) — dort **ohne Mock**: die
Engine zeichnet wirklich, die Palette steht wirklich im DOM
(`document.querySelector(".djs-palette")`), `saveXml()` liefert erst `XML`
zeichengleich und nach einem `updateProperties` den neuen Namen.

### 1.3 `decorateGrc` verdrahtet

- `packages/bpmn/package.json#exports` führt jetzt `"./grc"` — dazu
  `"./modeling"` und `"./editor"`, weil die Fassade beide braucht.
- `apps/web/src/types/bpmn-moddle.d.ts` war die **schmalere** von zwei
  ambienten `declare module "bpmn-moddle"`. Genau daran scheiterte der Import
  von `@grc/bpmn` in `apps/web` (B2 §5.1). Beide Deklarationen sind jetzt
  inhaltlich gleich; `bpmn-grc-bridge.ts` importiert über den regulären
  Unterpfad statt über einen relativen Pfad quer durchs Monorepo.
- Der Aufruf steht in `arctos-bpmn-canvas.tsx` (`useGrcDecoration`):
  `decorateGrc({ root, model: buildOverlayModel(scene, data, { view }), onInteract })`,
  das Modul dynamisch geladen wie die Engine selbst.
- **Die fünf HTML-Badge-Kanäle bleiben aus, solange die Dekoration zeichnet.**
  Dieselbe Aussage zweimal am selben Element wäre kein Mehrwert, sondern ein
  Widerspruch in spe. Ohne `grcOverlayData` läuft alles wie bisher.

Zwei Tests halten beide Richtungen fest („zeichnet ins SVG und lässt die
HTML-Badges weg" / „zeichnet ohne Datensatz nicht").

### 1.4 Ein Fund beim Freischalten: die Fläche hatte kein Aussehen

`@grc/bpmn` bringt bewusst kein Stylesheet mit (B1 §8). `bpmn-editor.css`
importiert `bpmn-js/dist/assets/` — also genau die Abhängigkeit, die dieser
Pfad ablöst, samt Wasserzeichenregel. Ein Editor mit unsichtbarer Palette ist
nicht freigeschaltet, sondern kaputt. Deshalb neu:
`apps/web/src/components/bpmn/arctos-bpmn.css` mit
`@import "diagram-js/assets/diagram-js.css"` (MIT, eigene Abhängigkeit) plus
den drei Klassen, die `src/editor` selbst vergibt
(`arctos-bpmn-replace-menu`, `arctos-bpmn-label-editing`,
`arctos-bpmn-label-input`) und dem Fokusindikator aus Plan §4.4, Regel 6
(doppelter Ring). **Der Kontrast ist rechnerisch gesetzt, aber nicht
gemessen** — siehe §5.

---

## 2. Aufgabe 2 — `move` auf ein BoundaryEvent verlor `attachedToRef`

**Ursache.** `features/attach-support` von `diagram-js` liest nach jedem
`elements.move` das Feld `context.newHost`. Ist es leer, hält es jeden
mitbewegten Anhefter, dessen Wirt **nicht** mitbewegt wurde, für abgelöst und
ruft `modeling.updateAttachment(attacher, undefined)`. Genau das trifft
`moveElements([boundaryEvent], delta)` — den häufigsten Fall überhaupt. Nach
einem Zug um null Pixel steht das Ereignis ohne `attachedToRef` da; `moddle`
verwirft das Attribut beim nächsten Speichern still.

Das ist ein **anderer Pfad** als Befund 1 des Modellierungsstrangs: dort wurde
der **Wirt** verschoben (und `attach-support` bewegt den Anhefter mit), hier
das **Randereignis selbst**.

**Behebung** — `src/modeling/behaviors/BoundaryEventBehavior.ts`,
`keepAttachment()` als `preExecute("elements.move")`:

`bpmn-js` löst denselben Konflikt anders (sein `DetachEventBehavior` ersetzt
das Randereignis beim Ablösen durch ein Zwischen-Ereignis). Diese Schicht
kennt das Ablösen gar nicht — `canMove` erlaubt einem Randereignis nur die
Bewegung innerhalb seines Containers. Es gibt hier also keinen zulässigen
Ablösefall, den man interpretieren müsste: `context.newHost` wird auf den
**bisherigen** Wirt gesetzt, statt an `attach-support` vorbeizuarbeiten. Ein
ausdrückliches `newHost` (auch `null` aus `hints.attach === false`) wird
**nicht** überschrieben — wer ablösen will, sagt es, und dann meldet die
Invariante den Zustand, statt ihn zu verstecken.

**Regressionstest** `test/modeling/findings.test.ts`, „§5.3 (B2) Randereignis
verschieben löst die Anheftung": drei Fälle — die Ein-Operations-Reproduktion
über null Pixel, ein echter Versatz über Undo/Redo, und die Gegenprobe, dass
ein ausdrückliches Ablösen weiterhin durchgeht **und** gemeldet wird.

Wirkung: `PROPERTY_STRICT=1` fiel von **16/200 auf 0/200**.

---

## 3. Aufgabe 3 — Die drei Übergaben aus dem Editor-Strang

### 3.1 `elements.align`, `elements.distribute`, `element.copy`

Sie stehen jetzt in `src/modeling/BpmnRules.ts`. Der Grund, warum das kein
Schönheitsposten war, steht dort im Kommentar: `CommandStack.canExecute`
liefert für ein Kommando **ohne Handler** hart `false` — eine nicht
formulierte Regel _verbietet_ die Funktion, sie erlaubt sie nicht. Ohne diese
drei Zeilen blieben Ausrichten, Verteilen und die **gesamte Zwischenablage**
stumm wirkungslos.

- `canAlign(element)` ist aus `EditorRules` übernommen, nicht neu formuliert:
  rein strukturell, keine Kanten, keine Beschriftungen, keine Rahmen.
- `canCopy(element)` — alles außer der Wurzel; was mit einer Kopie geschehen
  darf, entscheidet `elements.create` beim Einfügen.
- Die Umgehung ist entfernt: `EditorRules` gibt es nicht mehr, `editorRules`
  ist aus `editorModule` verschwunden, und `isAlignable` in
  `src/editor/AlignDistribute.ts` ist eine Weiterreichung von `canAlign` —
  dieselbe Funktion, ein Name.

Test: `test/modeling/rules.test.ts`, „formuliert Ausrichten, Verteilen und
Kopieren — sonst sperren sie".

### 3.2 Mindestmaße als `{ minDimensions }` in `canResize`

`canResize` liefert jetzt `false | { minDimensions }` statt `boolean`, und
`minDimensionsFor` steht in `BpmnRules.ts` — abgeleitet aus `DEFAULT_SIZES`
derselben Schicht, damit es keine zweite Wahrheit über Elementgrößen gibt.
`src/editor/ResizeBehavior.ts` holt die Untergrenze von der Regel und trägt
sie in `context.minDimensions` ein; es entscheidet sie nicht mehr selbst. Ein
fremder Regelanbieter, der nur `true` sagt, wird weiterhin akzeptiert.

`test/modeling/rules.test.ts` prüft die neue Antwortform mit Zahlen
(`Sub_A → 140×120`, `Pool_A → 300×60`, `Start_A → false`).

### 3.3 `DUPLICATE_ID` zählte Fremdschlüssel mit

`src/modeling/invariants.ts` wertet ein `id`-Attribut nur noch dann als
Diagrammkennung, wenn der Typ aus `bpmn:`, `bpmndi:`, `dc:` oder `di:` kommt.
Alles andere ist eine Erweiterung, und dort ist `id` ein Feld des fremden
Schemas — bei ARCTOS ein **Fremdschlüssel**: `arctos:riskRef/@id` nennt die
Kennung eines Risikos in der Datenbank. Zwei Aufgaben mit demselben Risiko
sind der Normalfall.

Der Test, der den Befund festhielt, ist wie angekündigt umgedreht: aus
„BEFUND: DUPLICATE_ID zählt Fremdschlüssel in Erweiterungen mit" wurde „zählt
den Fremdschlüssel `arctos:riskRef/@id` nicht als doppelte Kennung" (mit der
Gegenprobe, dass `risk-4711` nach dem Einfügen wirklich zweimal im Export
steht), plus ein neuer Test „meldet eine doppelte BPMN-Kennung weiterhin",
damit die Einschränkung die Prüfung nicht entschärft. Die Ausnahme
`ignoreInvariants: ["DUPLICATE_ID"]` im Nachbartest ist entfernt.

---

## 4. Aufgabe 4 — Gesamtverifikation

### 4.1 Die Tabelle, mit gemessenen Zahlen

| Prüfung                                                                                                                                                   | Ergebnis                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit` über **alle 13** `tsconfig.json` (apps/web, apps/worker, packages/{ai,auth,automation,bpmn,db,email,events,graph,reporting,shared,ui}) | **13 von 13 fehlerfrei**                                                                              |
| `cd packages/bpmn && npx vitest run --config vitest.config.ts`                                                                                            | **grün — 711 Tests, 42 Dateien**, 112 s                                                               |
| `cd apps/web && npx vitest run`                                                                                                                           | **grün — 2.430 Tests, 101 Dateien**, 105 s                                                            |
| `npx prettier --check "**/*.{ts,tsx,js,mjs,json,md}"` (Wurzel)                                                                                            | **grün** (vorher 45 Dateien rot; siehe §4.3)                                                          |
| `node scripts/audit-gate.mjs`                                                                                                                             | **OK** — keine neuen high/critical-Advisories                                                         |
| `node scripts/check-env-example.mjs` (Zugabe, war bei B2 rot)                                                                                             | **OK** — 114 deklariert, 94 gelesen                                                                   |
| `npx eslint` (packages/bpmn, geänderte apps/web-Dateien)                                                                                                  | **0 Fehler**, 3 Warnungen (`no-console` in `test/model/measure-roundtrip.ts`, fremd und vorbestehend) |
| `PROPERTY_STRICT=1`, 200 Folgen, Startwert 20260901                                                                                                       | **grün (0 rot)** — vorher 16                                                                          |
| `PROPERTY_STRICT=1`, 500 Folgen je Startwert 20260901/424242/20260902/7/1234567/99/20250101                                                               | **7 von 7 grün**                                                                                      |
| `PROPERTY_STRICT=1`, 2.000 Folgen (24.000 Operationen: 17.808 angewandt, 4.482 abgelehnt, 1.710 unauflösbar, **0 geworfen**)                              | **grün**                                                                                              |
| `PROPERTY_STRICT=1`, 3.000 Folgen (36.000 Operationen)                                                                                                    | **grün**                                                                                              |

### 4.2 Der wichtigste Messwert: `PROPERTY_STRICT=1` von 16/200 auf 0

Der Weg dorthin ging über **vier** Befunde, nicht über einen. Jeder ist
einzeln reproduziert, eingeordnet und behoben; keiner steht am Ende in
`known-findings.ts`.

**Befund 1 — `move` auf ein Randereignis (16/200, „echter Fehler").**
Siehe §2. → 0/200.

**Befund 2 — DI der eigenen Datenassoziationen (3/1.000, „echter Fehler").**
Erst bei 1.000 Folgen sichtbar. `remove(D_Task_Erfassen)` — eine einzige
Operation — lässt `DataInputAssoc_1_di` und `DataOutputAssoc_1_di` in der
Ebene stehen. Der Spiegelfall zum schon behobenen
`DATA_ASSOCIATION_DANGLING`: dort ging es um Assoziationen **anderer**
Aktivitäten, die auf ein gelöschtes Datenobjekt zeigen, hier um die, die die
gelöschte Aktivität **selbst besitzt**. Sie verschwinden semantisch mit ihr,
aber ihre `bpmndi:BPMNEdge` bleibt — eine Datenassoziation hat regelmäßig kein
grafisches Element, also fasst die Löschkaskade sie nicht an.
Behebung: `BpmnUpdater.dropOwnedDataAssociationDi`. Test §C.1 (zwei Fälle,
inkl. Undo).

**Befund 3 — der Prüfstand fragte die falsche Frage (mein eigener,
„Werkzeugfehler").** Beide Treiber (`src/verify/drivers/arctos.ts` und
`…/bpmnjs.ts`) fragten im `reparent`-Fall
`rules.allowed("elements.move", { shapes: [target], target })`, wobei
`target` das **bewegte** Element war und nicht das Ziel. Die Regel bekam
damit „darf X in X?" gestellt und antwortete für einen Subprozess mit „ja".
Zwei Folgen, in entgegengesetzte Richtungen falsch:

1. Ein `reparent` auf eine `bpmn:Collaboration` lief an einer Regel vorbei,
   die es verboten hätte — und erzeugte einen `CONTAINER_MISMATCH`, den keine
   Engine verschuldet hatte (1 von 500 bei Startwert 424242).
2. Schlimmer: für gewöhnliche Flussknoten antwortete dieselbe Frage `false`,
   also wurde `reparent` fast immer _abgelehnt_. **Die Operation war praktisch
   nicht geprüft.**

Behebung: `target: parent`. Test `test/verify/reparent-rules.test.ts` — er
hält fest, dass die beiden Fragen verschiedene Antworten haben, und genau
deshalb konnte die Verwechslung so lange unbemerkt bleiben.

**Befund 4 — Kanten überleben den Containerwechsel (10 von 500, „echter
Fehler").** Erst durch Befund 3 überhaupt sichtbar geworden: nachdem
`reparent` wirklich lief, stiegen die Fehlschläge von 0 auf 10/500 — und alle
zehn waren echt. Ein Knoten, der in einen anderen Pool oder Subprozess gezogen
wird, nimmt seine Sequenzflüsse mit; BPMN erlaubt einen Sequenzfluss aber nur
innerhalb _eines_ Containers. Die Datei bekommt einen Fluss, dessen Endpunkte
in zwei Prozessen sitzen; `moddle` verwirft den Verweis beim nächsten
Speichern, während das Bild vollkommen richtig aussieht.

Behebung: `src/modeling/behaviors/ConnectionBehavior.ts`. Nach jedem
`elements.move` wird jede betroffene Kante den Regeln vorgelegt
(`connection.reconnect`); ist sie unzulässig, entscheidet **dieselbe**
Funktion, die auch beim Ziehen einer neuen Kante entscheidet (`canConnect`):
anderer Typ vorgeschlagen → Kante wird ersetzt (Sequenzfluss → Nachrichtenfluss
beim Poolwechsel, Name geht mit); nichts vorgeschlagen → Kante wird entfernt.
Beides in `postExecuted`, also **ein** Strg-Z für Zug und Kantenumbau. Test
§C.2, drei Fälle inkl. Undo.

### 4.3 Einordnung der Restfälle

**Es gibt keine.** `test/verify/known-findings.ts` führt **null** offene
Befunde. Das ist ausdrücklich geprüft und nicht bloß behauptet: jeder der elf
Alt-Einträge wurde einzeln mit seiner eigenen Reproduktion nachgefahren,
darunter der `bpmn-js`-Referenztreiber für `modeling/PARENT_LINK_BROKEN` und
die Vorbelastung des Korpus für `modeling/DI_MISSING`. Keiner reproduziert
noch.

Die elf Alt-Einträge plus die vier neuen stehen jetzt als
`RESOLVED_FINDINGS` in derselben Datei — mit `fixedIn`, also Fundstelle der
Behebung **und** des Regressionstests. Gelöscht wurden sie nicht: sie sind das
einzige Protokoll darüber, was diese Engine einmal falsch gemacht hat, und das
ist derselbe Grund, aus dem `test/modeling/findings.test.ts` eine eigene Datei
ist. Der Wächtertest verlangt für jeden Eintrag eine Fundstelle von mehr als
20 Zeichen.

Ein leeres Register ist der **schärfste** Zustand, den diese Datei haben kann:
`allKnown()` antwortet für jede Kennung `false`, also zählt jeder Befund des
Eigenschaftslaufs als echter Befund — auch ohne `PROPERTY_STRICT=1`. Die
untere Schranke `expect(KNOWN_FINDINGS.length).toBeGreaterThan(0)` im
Wächtertest ist entfallen; null offene Befunde ist das Ziel, nicht ein Fehler
des Registers.

**Was das _nicht_ heißt.** Der Eigenschaftstest prüft Invarianten über drei
Bäume nach jeder Operation. Er prüft **nicht**, ob das Ergebnis dasselbe ist
wie bei `bpmn-js` — das tut der Shadow-Compare, und dort stehen weiterhin
**9 Divergenzklassen als `ours-wrong`** (`src/verify/shadow.ts`,
`DIVERGENCE_RULES`). Plan §5.6, Kriterium 2 verlangt dafür null. Diese neun
sind der ehrlichste offene Posten dieses Berichts.

### 4.4 Prettier: 45 Dateien, und warum

Der Lauf war rot für 45 Dateien, davon rund 30 aus `src/editor/` und
`test/editor/` — also aus den Arbeitssträngen B1 und B2, nicht aus dieser
Arbeit. Da die Prüfung im Auftrag steht und repoweit läuft, ist
`prettier --write` einmal über alles gelaufen. Danach: `tsc` (13/13), beide
Testläufe und der Eigenschaftstest erneut, alle grün. Die Formatierung hat
keine Zeile Verhalten geändert.

---

## 5. Was für einen produktiven Umstieg noch fehlt

Ehrlich, geordnet nach dem, was zuerst weh tut.

**Blockierend für den Pilotbetrieb**

1. **Kein E2E-Test bedient die Fläche.** Weder Maus noch Tastatur. In jsdom
   lässt sich kein Ziehvorgang nachbilden (`dragging` braucht echte
   Zeigerereignisse und Layout); die _Wirkung_ jeder Ziehhandlung ist über den
   wertbasierten Zwilling geprüft, der Zug selbst nicht. Palette und
   Kontextmenü stehen im DOM und sind über die Dienste geprüft — dass ein
   Mensch damit ein Diagramm zeichnen kann, ist **nicht** nachgewiesen.
   Das ist der größte Einzelposten. Plan §5.6, Kriterium 6.
2. **Der Produktionsbau ist ungeprüft.** `npm run build` mit
   `ARCTOS_BPMN_ENGINE=arctos` ist in dieser Arbeit nicht gelaufen. Die
   Vorbedingungen sind erfüllt (`@grc/bpmn` in `dependencies`,
   `transpilePackages`, jetzt zusätzlich der CSS-Import über eine
   bare-specifier-`@import`-Zeile, wie sie `bpmn-editor.css` schon benutzt) —
   geprüft ist es nicht.
3. **Der Kontrast der Bedienelemente ist ungeprüft.** `arctos-bpmn.css` setzt
   den doppelten Fokusring aus Plan §4.4, Regel 6; `axe` schaltet
   `color-contrast` in jsdom selbst ab. Plan §5.6, Kriterium 5 verlangt
   zusätzlich NVDA/VoiceOver von Hand.
4. **Die 9 `ours-wrong`-Divergenzklassen** des Shadow-Compare (§4.3).

**Fehlende Bedienung (aus B1 §7, unverändert)**

5. Kein Drill-down in eingeklappte Subprozesse (der Importer zeichnet die
   erste Ebene).
6. Kein Auto-Resize: ein Element am Rand eines Subprozesses vergrößert ihn
   nicht.
7. Containerwechsel nur mit der Maus — die Tastatur legt frei oder angehängt
   an und verschiebt im Raster, „in Container einfügen" fehlt im Kontextmenü.
8. Keine Suche im Diagramm, keine Tastaturhilfe (`?`), kein Space-/Lasso-/
   Hand-Werkzeug.
9. Kein Moduswechsel zur Laufzeit mit Erhalt von Viewbox, Zoom und Selektion
   (Plan §2.4). `?engine=` wirkt beim Rendern, nicht danach.
10. Beschriftung von `bpmn:Group` schreibt `name` statt eine
    `bpmn:CategoryValue` anzulegen (A1 §7.3).

**Datenseitig**

11. **`decorateGrc` hat noch keinen Datenlieferanten.** Der Aufruf steht, die
    Brücke (`bpmn-grc-bridge.ts`) baut den Datensatz aus den heutigen Routen,
    aber **keine Seite reicht ihn durch** — dafür fehlt der Endpunkt
    `GET /api/v1/processes/:id/diagram-overlay` aus Plan §3.3.6, und eine
    API-Route anzulegen war nicht Teil dieses Auftrags. Solange er fehlt,
    laufen die vier Einbindungen mit den fünf HTML-Badge-Kanälen wie bisher.
    `MISSING_TODAY` nennt die zehn Vertragsfelder, die auch danach leer
    blieben.
12. **`chrome: "full"` im Lesemodus ist nicht in Betrieb.** Der Adapter setzt
    `minimal` für jede lesende Fläche. B1 §2 hat die Achse für den Fall
    gebaut, dass `read` aus einem **fehlenden Recht** folgt
    (`processes/[id]`, `readOnly = !canEdit`) — dort wäre eine ausgegraute
    Palette mit Begründung ehrlicher. Bewusst nicht eingeschaltet: eine
    graue Werkzeugleiste, die noch nie jemand gesehen hat, gehört in eine
    Änderung mit Blick darauf, nicht in diese.
13. **`packages/shared` parst BPMN weiterhin selbst** (1.529 Zeilen
    `fast-xml-parser` + Regex, sechs Dateien). Zwei Antworten auf dieselbe
    Frage, unverändert seit B2 §5.5.

**Für das Wasserzeichen (Plan §5.6, acht Kriterien gleichzeitig)**

| Kriterium                                                     | Stand nach dieser Arbeit                                                                                                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · Round-Trip Z-A/B/C über den Korpus, 10.000 erzeugte Fälle | **erfüllbar** — Korpus grün, `PROPERTY_STRICT` bei 3.000 Folgen grün; die 10.000 sind ein CI-Lauf, kein Baupfad                                                         |
| 2 · Differenztests gegen `bpmn-js` grün                       | **nein** — 9 Divergenzklassen `ours-wrong`                                                                                                                              |
| 3 · Shadow-Compare 30 Tage / 500 Speichervorgänge             | **nicht begonnen** — jetzt aber _möglich_, weil der Editor speichern kann                                                                                               |
| 4 · die 21 Editor-Funktionen mindestens auf heutigem Stand    | **fast** — Palette, ContextPad, Label-Editing, Bendpoints, Resize, Zwischenablage, Tastatur stehen; es fehlen Drill-down, Auto-Resize, Suche, Werkzeuge (§5 Punkte 5–8) |
| 5 · axe auf allen vier Einbindungen + NVDA/VoiceOver          | **teilweise** — Textalternative und Graphnavigation stehen, Kontrast und Screenreader ungeprüft                                                                         |
| 6 · E2E-Suite inkl. Canvas-Interaktion                        | **nein** — kein einziger E2E-Test bedient den Canvas                                                                                                                    |
| 7 · Leistungsbudget                                           | **nicht gemessen**                                                                                                                                                      |
| 8 · keine offene Regression „hoch" aus der Pilotphase         | Pilotphase nicht begonnen                                                                                                                                               |

**Nüchtern:** Der Baupfad ist zu Ende. Was zwischen hier und dem Fallen des
Wasserzeichens liegt, ist keine Schicht mehr, sondern Messen und Warten — ein
E2E-Anzug, ein Leistungsbudget, eine manuelle a11y-Abnahme, die neun
Divergenzklassen und dann mindestens ein voller Release-Zyklus Shadow-Compare.
Die Stufe **S3** des Rollouts (Editor im Shadow-Compare) ist ab jetzt
erreichbar; S2 war es schon.

---

## 6. Geänderte Dateien

**`packages/bpmn` — Quelltext**

| Datei                                             | Was                                                                                                                               |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                    | `exports`: `./grc`, `./modeling`, `./editor`                                                                                      |
| `src/viewer/BpmnCanvas.ts`                        | Editor-Modus, `bpmnImporter`-Pfad, `exportXml`/Z-D, Undo/Redo, `chrome`/`editor`-Optionen                                         |
| `src/viewer/modules.ts`                           | `MISSING_EDIT_MODULES` entfernt, generisches `features/modeling` entfernt                                                         |
| `src/viewer/index.ts`, `src/index.ts`             | Exporte nachgezogen (`editorModulesFor`, `ExportXmlFn`)                                                                           |
| `src/modeling/BpmnRules.ts`                       | `elements.align`/`elements.distribute`/`element.copy`; `canResize → { minDimensions }`; `minDimensionsFor`, `canAlign`, `canCopy` |
| `src/modeling/invariants.ts`                      | `DUPLICATE_ID` nur noch für `bpmn:`/`bpmndi:`/`dc:`/`di:`                                                                         |
| `src/modeling/behaviors/BoundaryEventBehavior.ts` | `keepAttachment()` (Aufgabe 2)                                                                                                    |
| `src/modeling/behaviors/ConnectionBehavior.ts`    | **neu** — Kanten nach Containerwechsel (Befund 4)                                                                                 |
| `src/modeling/BpmnUpdater.ts`                     | `dropOwnedDataAssociationDi` (Befund 2)                                                                                           |
| `src/modeling/index.ts`                           | `connectionBehavior` registriert, Exporte                                                                                         |
| `src/editor/AlignDistribute.ts`                   | `EditorRules` entfernt, `isAlignable` = `canAlign`                                                                                |
| `src/editor/ResizeBehavior.ts`                    | Mindestmaße von der Regel statt eigener Tabelle                                                                                   |
| `src/editor/modules.ts`, `src/editor/index.ts`    | `editorRules` entfernt                                                                                                            |
| `src/verify/drivers/{arctos,bpmnjs}.ts`           | `reparent` fragt die Regel nach dem **Ziel** (Befund 3)                                                                           |

**`packages/bpmn` — Tests**

`test/draw/viewer.test.ts` (+4 Bearbeitungspfad, Modus-Test umgeschrieben),
`test/draw/helpers/jsdom-svg.ts` (`installCssEscape` hierher gezogen, aus
`test/editor/helpers/editor.ts` entdoppelt), `test/modeling/findings.test.ts`
(+3 §5.3, +2 §C.1, +3 §C.2), `test/modeling/rules.test.ts` (`canResize`-Form,
+1 Regeltest), `test/editor/resize-copy.test.ts` (DUPLICATE_ID umgedreht, +1),
`test/verify/known-findings.ts` (leer + `RESOLVED_FINDINGS`),
`test/verify/known-findings.test.ts` (Wächter angepasst),
`test/verify/reparent-rules.test.ts` (**neu**).

**`apps/web`**

`components/bpmn/arctos-bpmn-canvas.tsx` (Modus `edit`, `exportXml`,
Undo/Redo, `useGrcDecoration`, CSS-Import),
`components/bpmn/arctos-bpmn.css` (**neu**),
`components/bpmn/bpmn-editor.tsx` (`editorEngineFor` reduziert, `modeFor`),
`components/bpmn/bpmn-viewer.tsx` + `bpmn-canvas-types.ts`
(`grcOverlayData`/`grcView` durchgereicht),
`components/bpmn/bpmn-grc-bridge.ts` (Import über `@grc/bpmn/grc`),
`types/bpmn-moddle.d.ts` (mit der Paketfassung zusammengeführt),
`__tests__/components/bpmn-engine-switch.test.tsx` (+4).

**Repoweit:** `prettier --write` über
`**/*.{ts,tsx,js,mjs,json,md}` (§4.4).
