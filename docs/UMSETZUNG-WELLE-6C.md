# Welle 6c — der Playwright-Lauf, und was die Zeichenfläche verbarg

**Grundlage:** `docs/OFFENE-PUNKTE-REGISTER.md` (OP-027, OP-036, OP-080, OP-167 und
die Nachträge vom 03.–07.09.) · `apps/web/e2e/auth.setup.ts` (drei frühere
Triage-Runden) · `apps/web/playwright.config.ts` · `packages/db/src/seed-e2e-users.ts`
**Vorbild:** `docs/UMSETZUNG-WELLE-6A.md`
**Punkte:** OP-167 · OP-027 · OP-036 · OP-080
**Stand:** Branch `audit/full-2026-08-31`, aufsetzend auf `f512c704`
**Gebiet:** `apps/web/e2e/**`, `packages/db/src/seed-demo.ts`, dieses Dokument —
sowie, erzwungen durch drei gemessene Produktdefekte,
`packages/bpmn/src/draw/index.ts`, `packages/bpmn/src/editor/{Keyboard,ConnectMode,dom}.ts`
und `apps/web/src/components/bpmn/arctos-bpmn-canvas.tsx`

---

## 1. Ergebnis in einem Satz

Der E2E-Lauf braucht **keinen Produktionsbau** — er läuft gegen `npm run dev`, so
wie `playwright.config.ts` es seit jeher vorsieht —, und die erste E2E-Runde, die
die BPMN-Zeichenfläche tatsächlich **anfasst**, hat **vier Produktdefekte**
gefunden, von denen drei die eigene BPMN-Engine unbenutzbar machten: die Elemente
wurden neben ihre Klickfläche gezeichnet, die Tastatur des Editors kam im Browser
nie an, und was man trotzdem zeichnete, liess sich nicht speichern.

| Messgröße                                                  |               vorher |                nachher |
| ---------------------------------------------------------- | -------------------: | ---------------------: |
| E2E-Lauf ohne Produktionsbau möglich                       | „blockiert" (OP-167) |       **ja, gemessen** |
| E2E-Tests, die die Zeichenfläche bedienen                  |                **0** |                  **2** |
| Demo-Seed auf einer Datenbank von Null (56 Dateien)        |            **3 rot** |           **56/56 ok** |
| `soa_entry` nach dem Seed                                  |                **0** |                **101** |
| `cve_asset_match` nach dem Seed                            |                **0** |                 **54** |
| arctos-Engine: Abstand Bild ↔ Klickfläche (`StartEvent_1`) |     **179 / 159 px** |              **0 / 0** |
| arctos-Engine: Auswahl nach Klick auf ein Element          |             **leer** |       **StartEvent_1** |
| arctos-Engine: Kontextmenüs nach Klick                     |                **0** |                  **1** |
| arctos-Engine: `Enter` schliesst „Verbinden" ab            |             **nein** |                 **ja** |
| arctos-Engine: Speichern-Knopf nach einer Zeichengeste     |         **disabled** |            **enabled** |
| `web`-Projekt (21 + 1 Spezifikation)                       |      nie vollständig |       **135/135 grün** |
| `regression`-Projekt (46 Spezifikationen)                  |      nie vollständig | **26 von 62 gemessen** |

---

## 2. OP-167 — „blockiert durch den Produktionsbau" war selbst der Befund

### 2.1 Was das Register behauptet

> „Ohne Produktionsbau gibt es kein Deployment und keinen E2E-Lauf."
> (`docs/OFFENE-PUNKTE-REGISTER.md`, Nachtrag 2026-09-03, OP-167)

Der erste Halbsatz stimmt. Der zweite ist falsch, und er steht seit dem 3.9. als
Begründung dafür, dass der Lauf nicht stattfindet.

### 2.2 Was die Konfiguration sagt

`apps/web/playwright.config.ts`, unverändert seit WP11:

```ts
webServer: process.env.CI
  ? undefined
  : {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
    },
```

Ausserhalb von CI startet Playwright **den Entwicklungsserver**, nicht `next start`.
Ein Produktionsartefakt kommt in diesem Pfad nicht vor. `reuseExistingServer: true`
heisst zusätzlich: ein bereits laufender `next dev` wird übernommen.

### 2.3 Was gemessen wurde

Entwicklungsserver aus dem Stand gestartet:

```
▲ Next.js 16.2.11 (Turbopack)
- Local:         http://localhost:3000
- Environments: .env.local
✓ Ready in 1667ms
```

Danach der Anmeldeteil der Suite — die vier Konten, die
`db:seed:e2e-users` bereitstellt:

```
Running 4 tests using 1 worker
  ✓  1 [setup] › e2e/auth.setup.ts:107:6 › authenticate as admin (39.1s)
  ✓  2 [setup] › e2e/auth.setup.ts:155:8 › authenticate as owner (12.4s)
  ✓  3 [setup] › e2e/auth.setup.ts:155:8 › authenticate as reviewer (7.8s)
  ✓  4 [setup] › e2e/auth.setup.ts:155:8 › authenticate as approver (7.3s)
  4 passed (1.3m)
```

Und anschliessend 135 Web-Tests und 26 Regressionstests, alle gegen denselben
Entwicklungsserver (§5).

**Es gilt:** OP-167 blockiert das **Deployment**. Den E2E-Lauf blockiert er nicht,
und hat es nie. Die Abhängigkeit „OP-027 blockiert durch OP-053 (Produktionsbau als
Ziel)" im Register ist damit gegenstandslos; ebenso die Begründung von OP-080
(„ohne E2E nicht verifizierbar"), soweit sie sich auf das Fehlen eines Laufs
stützt.

**Das ist das vierzehnte stumme Tor dieses Audits** — nur diesmal keines, das
falsch grün meldete, sondern eine Begründung, die vier Punkte am Laufen hinderte
und selbst nie nachgeprüft worden war.

### 2.4 Was der Entwicklungsserver **nicht** ersetzt

Ehrlich benannt, damit die Entlastung nicht zu weit gelesen wird:

- **Prerendering.** Genau der Schritt, an dem OP-167 scheitert, findet im
  Entwicklungsbetrieb nicht statt. Ein E2E-Lauf gegen `next dev` kann einen
  Prerender-Absturz **nicht** finden. Er sagt nichts über OP-167 aus — er ist nur
  nicht von ihm abhängig.
- **Leistungsmessung.** Siehe §6 (OP-036).
- **Betriebsnahe Auslieferung.** Kein Minifizieren, keine statischen Seiten, andere
  Zeiten. Für Verhaltenstests belanglos, für Budgets entscheidend.

---

## 3. Die Umgebung, von Null hergestellt

### 3.1 Datenbank

Eine eigene E2E-Datenbank, nicht `grc_v6` (dort fehlt der Demo-Mandant
`ccc4cc1c-…`, den beide Playwright-Konfigurationen anheften):

```
$ createdb grc_e2e6c
$ psql -d grc_e2e6c -c 'CREATE EXTENSION pgcrypto, "uuid-ossp", vector, timescaledb'
$ DATABASE_URL=…/grc_e2e6c npx tsx src/migrate-all.ts
  Pass 1: 425 succeeded, 4 deferred
  Pass 2: 4 recovered, 0 still failing
✓ 617 tables created
✓ 429/429 migrations applied
```

Die vier Erweiterungen sind Voraussetzung und keine Kür: ohne `pgcrypto` scheitern
elf Migrationen an `function digest(text, unknown) does not exist` — nachgemessen,
bevor sie gesetzt waren.

### 3.2 Die E2E-Konten

`npm run db:seed:e2e-users` legt alle vier Konten an; keines musste von Hand
erzeugt werden:

```
Organization: Meridian Holdings GmbH (Demo Tenant) (ccc4cc1c-4b09-499c-8420-ebd8da655cd7)
  e2e-admin@arctos.local     roles=admin                        platform_admin=yes memberships=1
  e2e-owner@arctos.local     roles=process_owner                platform_admin=no  memberships=1
  e2e-reviewer@arctos.local  roles=auditor,compliance_officer   platform_admin=no  memberships=2
  e2e-approver@arctos.local  roles=admin                        platform_admin=no  memberships=1
```

Das Skript aus Triage-Runde 3/4 tut genau, was sein Kopf verspricht. An dieser
Stelle war nichts zu reparieren.

---

## 4. Produktdefekt 1 — der Demo-Seed war auf einer Datenbank von Null dreifach tot

### 4.1 Der Befund

`npm run db:seed:demo` gegen `grc_e2e6c` (429/429 Migrationen, frisch):

```
FAIL  fix_soa_annex_a.sql: insert or update on table "soa_entry" violates
      foreign key constraint "soa_entry_org_id_organization_id_fk"
FAIL  seed_demo_01_assets_isms.sql: null value in column "catalog_entry_id" of
      relation "soa_entry" violates not-null constraint
FAIL  seed_demo_15_cve.sql: seed_demo_15_cve: expected the CPE cross product to
      yield at least 40 matches, found 0 — did seed_demo_01_assets_isms.sql run?
3 of 56 seed file(s) failed
```

### 4.2 Die Ursache

`fix_soa_annex_a.sql` stand in `REFERENCE_SEEDS`, also **vor**
`seed_demo_00_platform.sql`. Die Datei tut zweierlei: Schritt 1/2 projizieren die
97 Annex-A-Einträge aus `catalog_entry` nach `control_catalog_entry`
(mandantenunabhängige Referenzdaten), Schritt 3 legt für die Demo-Organisation
`c2446a5c-64f1-40a7-862a-8ab084f66f41` die `soa_entry`-Zeilen an — und **diese
Organisation entsteht erst in `seed_demo_00_platform.sql`**.

Der Runner führt jede Datei in **einer** Transaktion aus. Schritt 3 verletzte den
Fremdschlüssel, also wurden Schritt 1 und 2 mit zurückgerollt. Ohne
`control_catalog_entry` findet der SoA-Teil von `seed_demo_01_assets_isms.sql`
nichts, bricht die Datei ab und nimmt **Assets, Bedrohungen und Schwachstellen**
mit; ohne Assets kann `seed_demo_15_cve.sql` kein CPE-Kreuzprodukt bilden. Ein
Fehler, drei tote Dateien, und dahinter die halbe ISMS-Demolage.

**Warum es niemandem auffiel.** Auf einer Maschine, auf der der Demo-Seed schon
einmal gelaufen ist, existiert die Organisation bereits, und die Datei läuft durch.
Der Fehler ist ausschliesslich auf einer Datenbank **von Null** sichtbar — dieselbe
Klasse wie OP-168/OP-169 aus dem Nachtrag vom 3.9.

### 4.3 Die Behebung

Ein Listeneintrag, verschoben: `fix_soa_annex_a.sql` steht jetzt in `DEMO_SEEDS`,
zwischen `seed_demo_00_platform.sql` und `seed_demo_data.sql`. Die SQL-Datei ist
unverändert; sie stand nur an der falschen Stelle. Die Begründung steht als
Kommentar daneben, samt der drei Fehlermeldungen, damit die Reihenfolge nicht
wieder „aufgeräumt" wird.

### 4.4 Der Nachweis

Datenbank erneut von Null (dieselben 429 Migrationen), dann Seed:

```
  ok    seed_demo_15_cve.sql
Reference + demo data seeded.        ← 56 von 56, exit 0
```

```
 soa | cce | assets | cve_match | orgs
-----+-----+--------+-----------+------
 101 |  97 |     10 |        54 |   17
```

Vorher: `soa_entry` 0, `control_catalog_entry` 0, `asset` 0, `cve_asset_match` 0.

---

## 5. OP-027 — die Zeichenfläche, zum ersten Mal bedient

### 5.1 Was fehlte

Kein Test in `apps/web/e2e/**` oder `tests/e2e/**` hat je ein `.djs-`-Element
angefasst. `process-map`, `process-portal` und `bpm-approval-pipeline` sprechen die
API an oder prüfen, dass eine Seite lädt. Die zentrale Behauptung des Produkts —
„ein Mensch kann hier ein Diagramm zeichnen" — war unbelegt.

### 5.2 Der neue Test

`apps/web/e2e/bpmn-canvas-modeling.spec.ts`, zwei Tests, beide als
`process_owner` (die produktive Rolle, nicht Administrator — `canEdit` in
`processes/[id]/page.tsx:416` entscheidet daran, ob überhaupt ein Modeler statt
eines Viewers geladen wird):

1. **Vorrat anklicken, Fläche anklicken** → eine Aufgabe **entsteht**; der Test
   liest ihren Bezeichner aus dem DOM.
2. **Startereignis anklicken → Kontextmenü → „verbinden" → Ziel wählen** → eine
   Kante **entsteht**; der Test liest ihren Bezeichner.
3. **„Save" anklicken** → der Knopf muss `enabled` sein (sonst hat die Geste
   `hasChanges` nicht gesetzt) und die Meldung „Version saved" erscheinen.
4. **Rückweg über die API**: `GET /api/v1/processes/:id/versions` →
   `…/versions/:versionId` → das gespeicherte XML muss **genau diese beiden
   Bezeichner** enthalten, der Sequenzfluss muss `sourceRef="StartEvent_1"` und
   `targetRef="<die gezeichnete Aufgabe>"` tragen, und
   `GET …/steps` muss die Aufgabe als abgeleiteten Prozessschritt führen.

**Punkt 4 ist der eigentliche Test.** Ein zusätzliches `<g class="djs-shape">` im
DOM prüft `diagram-js`, nicht ARCTOS. Erst der Rückweg zeigt, dass die Geste durch
`saveXml() → POST /versions → parseBpmnXml → process_step` gelaufen ist, also durch
den Teil, der uns gehört. Und die Bezeichner werden **gelesen und wiedergefunden**,
nicht auf „irgendeine Aufgabe" geprüft — sonst hätte eine falsch verbundene Kante
den Test bestanden. Dass diese Unterscheidung nicht theoretisch ist, zeigt §5.3.

Der zweite Test fährt dieselbe Geste über `?engine=arctos` gegen die
Eigenimplementierung — den Weg, den `feature-flags.ts` für die Pilotphase
ausdrücklich vorsieht.

### 5.3 Was der Test beim ersten Lauf über sich selbst zeigte

Die erste Fassung klickte das Startereignis an und griff sofort zum Kontextmenü.
Das Menü ist **ein wiederverwendeter DOM-Knoten**; direkt nach dem Absetzen der
Aufgabe steht es noch an deren Seite. Ergebnis im gespeicherten XML:

```xml
<bpmn:sequenceFlow id="Flow_0jhvfyl" sourceRef="Activity_0o5ecd6" targetRef="Activity_0o5ecd6" />
```

Quelle gleich Ziel — die Aufgabe mit sich selbst verbunden. Der Test war grün bis
zu genau der Zusicherung, die Quelle und Ziel **benennt**. Eine schwächere
Erwartung („es gibt eine Kante") hätte diese Schleife als Erfolg gemeldet. Die
Zusicherung blieb; gewartet wird jetzt auf die **Auswahl**
(`.djs-element.selected`), nicht auf das blosse Vorhandensein eines Menüs.

Zweite Erkenntnis, ebenfalls gemessen: das Absetzen eines Elements **verschiebt den
Ausschnitt**. `StartEvent_1` wanderte dabei von y=602 auf y=309. Eine vorher
gemerkte Koordinate zeigt danach auf leere Fläche, und der Klick hebt die Auswahl
auf, statt sie zu setzen. Der Test bestimmt die Koordinate deshalb vor jedem Klick
neu.

### 5.4 Das Ergebnis

Gegen den Endstand, Entwicklungsserver mit leerem Turbopack-Zwischenspeicher:

```
Running 6 tests using 1 worker
  ✓  1 [setup] › apps/web/e2e/auth.setup.ts:107:6 › authenticate as admin (34.8s)
  ✓  2 [setup] › … authenticate as owner (15.9s)
  ✓  3 [setup] › … authenticate as reviewer (10.1s)
  ✓  4 [setup] › … authenticate as approver (7.9s)
  ✓  5 [web] › bpmn-canvas-modeling.spec.ts:314 › legacy-Engine: Aufgabe setzen,
       mit dem Start verbinden, speichern — und im gespeicherten XML wiederfinden (1.1m)
  ✓  6 [web] › bpmn-canvas-modeling.spec.ts:390 › arctos-Engine: dieselbe Geste
       auf der Eigenimplementierung (33.1s)
  6 passed (2.8m)
```

**Die Zusicherungen fallen.** Gegen `f512c704` fällt der arctos-Test an drei
verschiedenen Stellen — jede davon ein eigener Produktdefekt (§7). Der
legacy-Test bestand von Anfang an: die Vorgabe-Engine trägt, was das Produkt über
sie behauptet. Das ist der Nachweis, den OP-027 verlangt hat, und er lag bis heute
nicht vor.

---

## 6. OP-036 — und warum er offen bleibt

Der Lauf misst Zeiten, aber keine, die ein Leistungsbudget tragen. Der bestehende
Budgettest liefert:

```
RACM perf samples (ms): 2081, 479, 127, 85, 84 avg=571 max=2081
✓ bpm-racm-perf.spec.ts › racm aggregates within budget (3.0s)
```

Das ist ein API-Budget und war nie strittig. Für den **Editor** gilt: die
gemessenen 33 s bis 1,1 min der neuen Tests bestehen zum weit überwiegenden Teil
aus Übersetzungszeit des Entwicklungsservers — dieselbe Route brauchte kalt
einmal 9,4 Minuten und warm 0,4 Sekunden. Aus solchen Zahlen ein Budget
abzuleiten, wäre genau die Sorte Behauptung, gegen die dieses Register angetreten
ist.

**OP-036 bleibt offen**, und die Begründung ändert sich: nicht mehr „es gibt keinen
Lauf", sondern „ein Entwicklungsserver ist keine Messumgebung". Der Punkt hängt
damit tatsächlich am Produktionsbau, OP-027 nicht mehr.

---

## 7. Drei Produktdefekte in der eigenen BPMN-Engine

Alle drei wurden vom neuen Test gefunden, alle drei sind behoben, alle drei sind
vor und nach der Behebung im Browser gemessen. Sie hängen zusammen: der erste
verdeckte den zweiten, der zweite den dritten.

### 7.1 Jede Form wurde um ihre eigenen Koordinaten neben ihre Klickfläche gezeichnet

**Der Befund.** Leerer Prozess (`EMPTY_BPMN_XML`, `StartEvent_1` bei x=179, y=159),
`getBoundingClientRect` im Browser:

```
g.djs-visual             439,761  36x36     ← das GEZEICHNETE Startereignis
rect.djs-hit djs-hit-all 260,602  36x36     ← die KLICKBARE Fläche
```

Differenz **179 / 159** — die Modellkoordinaten des Elements selbst.

**Die Ursache.** `BpmnRenderer` zeichnet in absoluten Modellkoordinaten
(`drawEvent`: `cx = shape.x + shape.width / 2`). Für den statischen Weg ist das
richtig: `StaticRenderer` setzt eine `viewBox` über die Szenengrenzen und
verschiebt nichts. `diagram-js` dagegen verschiebt die Elementgruppe selbst
(`GraphicsFactory.updateShape` → `translate(gfx, element.x, element.y)`) und
erwartet eine Zeichnung relativ zu (0,0) — so macht es auch `bpmn-js`. Beides
zusammen ergibt die doppelte Verschiebung.

**Die Folge war nicht kosmetisch.** Ein Klick auf das sichtbare Element traf leere
Fläche; `document.elementFromPoint` lieferte das Wurzel-`<svg>`:

```
{"atPoint":"svg.","selected":[],"pads":0}
```

Keine Auswahl, kein Kontextmenü, **kein Weg, auf dieser Fläche zu modellieren**.

**Warum keiner der vierzig Zeichentests das fand.**
`packages/bpmn/test/draw/helpers/render.ts` legt jede Form mit `x: 0, y: 0` an. Bei
(0,0) ist die doppelte Verschiebung die Identität. Das gesamte Formtestwerk konnte
diesen Fehler nicht sehen — **das fünfzehnte blinde Tor dieses Audits.**

**Die Behebung.** Der Renderer bleibt absolut; der statische Weg, die Prüfbilder
und die vierzig Formtests hängen daran. Nur für den `diagram-js`-Weg schiebt eine
Unterklasse (`CanvasBpmnRenderer` in `packages/bpmn/src/draw/index.ts`) die Gruppe
`djs-visual` um `(-x, -y)` zurück. Kanten brauchen nichts: `updateConnection`
verschiebt nicht.

**Der Nachweis.**

```
groupChildren: ["g.djs-visual 260,602 36x36", "rect.djs-hit djs-hit-all 260,602 36x36"]
atPoint: "rect.djs-hit djs-hit-all"
AFTER-CLICK {"selected":["StartEvent_1"],"pads":1,"outline":1}
```

### 7.2 Die Tastaturbedienung des Editors kam im Browser nie an

**Der Befund.** Nach „Verbinden" im Kontextmenü lief die Betriebsart ausweislich
der Statusansage:

> „Verbinden von Startereignis „Start". ein zulässiges Ziel. Pfeiltasten wählen,
> Eingabetaste verbindet, Escape bricht ab. Ziel 1 von 1: Aufgabe Task_1."

`Enter` erzeugte **keine Kante**. Dasselbe Ereignis von Hand an
`.djs-container` geschickt, erzeugte sie sofort:

```
DISPATCH  {"before":0,"afterContainer":1}      ← synthetisch an .djs-container
NACH-ECHTEM-ENTER {"connections":0}            ← echter Tastendruck
```

**Zwei Ursachen, hintereinander.**

1. `EditorKeyboard` hörte auf `canvas.getContainer()` — das ist `.djs-container`,
   ein **Kind** des äusseren `<div>`. Den Tabstopp trägt der äussere `<div>`
   (`GraphA11y`, `viewer/a11y.ts:129`; `focusDiagram` sucht ihn genau deshalb
   aufwärts). Ein `keydown` steigt auf, nicht ab — der Tastendruck erreichte den
   Zuhörer nie. Gemessen: `document.activeElement` war der äussere `<div>`
   (`tabindex=0`), das Ereignis erreichte das Dokument, der Zuhörer nicht.
2. Ein Zuhörer am Dokument in der **Blasenphase** half nicht: `GraphA11y` hängt am
   selben `<div>` und beendet `Enter`, `Escape` und die Pfeiltasten mit
   `event.stopPropagation()` (`a11y.ts:346`). Zwei Tastaturschichten auf derselben
   Fläche, die äussere verbraucht die Tasten der inneren.

**Warum die Einheitstests das nicht zeigten.** Sie schicken ihre Ereignisse direkt
an `canvas.getContainer()`. Dort greift der Zuhörer, weil das Ziel der
Zuhörerknoten selbst ist — ein Tor, das nur unter seiner eigenen Annahme auslöst.
**Das sechzehnte.**

**Die Behebung, so eng wie möglich.** `EditorKeyboard` hört zusätzlich am Dokument
in der **Capture**-Phase, und zwar **nur, solange eine Betriebsart auf Tasten
wartet** (`modeActive()`: Werkzeug aktiv, Verbinden, Container, Stützpunkte). Ohne
laufende Betriebsart gehören Pfeiltasten und `Enter` weiterhin der
Zugänglichkeitsschicht; die Navigation im Diagramm ändert sich nicht. Greift die
Betriebsart, ruft `handle` seinerseits `stopPropagation`, sodass die verbrauchte
Taste nicht zweimal gedeutet wird. Zusätzlich setzt `ConnectMode.begin()` den Fokus
auf die Fläche — wer den Modus mit der Maus startet, soll ihn mit der Tastatur
beenden können. `keyboardHost()` in `dom.ts` hält Fokusziel und Zuhörerknoten
definitorisch beieinander.

**Der Nachweis.** `NACH-ECHTEM-ENTER {"connections":1}`.

### 7.3 Auf der eigenen Engine liess sich eine Zeichnung nicht speichern

**Der Befund.** Nach Setzen einer Aufgabe und Ziehen eines Sequenzflusses:

```
Error: der Speichern-Knopf ist nicht bedienbar — `hasChanges` wurde von der
       Zeichengeste nicht gesetzt (commandStack.changed → onChanged)
  - unexpected value "disabled"
```

**Die Ursache.** `ArctosBpmnCanvasProps` erbt `onChanged` von `BpmnEditorProps`,
und `processes/[id]/page.tsx` reicht es durch (`onChanged={markChanged}`). Die
Komponente hat es **nie ausgelesen**. Der Legacy-Editor tut es
(`bpmn-editor-legacy.tsx:160`, `commandStack.changed`), die eigene Engine nicht.
`hasChanges` blieb damit für immer `false`, und `BpmnToolbar` hängt den
Speichern-Knopf genau daran (`disabled={!hasChanges || saving}`).

**Die Behebung.** Ein Abonnement. `BpmnCanvas` feuert `commandStack.changed`
(`BpmnCanvas.ts:220`) und stellt `on()` bereit; es fehlte allein der Aufruf.

**Der Nachweis.** Der Test klickt „Save", bekommt „Version saved" und findet
Aufgabe und Sequenzfluss im zurückgelesenen XML.

### 7.4 Was diese drei zusammen bedeuten

Die eigene BPMN-Engine — das Ziel des Lizenzumstiegs, Plan §5.4 — war im
Bearbeitungsmodus **vollständig unbenutzbar**: nicht anklickbar, nicht per Tastatur
bedienbar, nicht speicherbar. Sie ist per Vorgabe abgeschaltet
(`BPMN_ENGINE_DEFAULT = "legacy"`), also hat es keinen Benutzer getroffen. Aber die
Umstiegsentscheidung stützte sich auf 909 grüne Einheitstests in `packages/bpmn`,
die alle drei Defekte nicht sehen konnten — zwei davon aus struktureller Blindheit
(Formen bei (0,0), Ereignisse direkt am Container), einer, weil er ausserhalb des
Pakets lag.

---

## 8. Der Lauf — ehrliche Zählung

### 8.1 Wie gezählt wurde

`workers: 1`, wie konfiguriert. Der Lauf lief **in Abschnitten**, mit einem frisch
gestarteten Entwicklungsserver je Abschnitt. Der Grund ist gemessen und in §9
begründet; er ändert nichts an den Ergebnissen, nur an ihrer Erreichbarkeit.

### 8.2 `web`-Projekt — 21 Spezifikationen des Bestands plus eine neue

| Abschnitt                                      |        grün |   rot |
| ---------------------------------------------- | ----------: | ----: |
| a11y-smoke, ai-act-workflow, api-auth          |          19 |     0 |
| audit-cis-ig-flow, bpm-approval, racm, ropa    |           6 |     0 |
| budget, catalog-activation, catalogs, ci-smoke |          14 |     0 |
| cross-module-workflows (7 Abschnitte)          |          27 |     0 |
| document-signature                             |           1 |     0 |
| isms-workflow                                  |          15 |     0 |
| management-review                              |           1 |     0 |
| navigation                                     |           4 |   1\* |
| platform-smoke                                 |          38 | 2\*\* |
| process-map, process-portal, reports           |           5 |     0 |
| **bpmn-canvas-modeling (neu)**                 |       **2** |     0 |
| **Summe**                                      | **132 + 3** | **0** |

**Ehrliche Zählung: 135 von 135 Tests grün**, in 22 Spezifikationsdateien, dazu
4 Anmeldungen im `setup`-Projekt. Kein `test.skip`, kein übersprungener Test.

\* `navigation.spec.ts:19` zählte 5 statt 38 Verweise in der Seitenleiste.
**Kein Produktdefekt, aber ein Testdefekt, der behoben wurde und nicht die
Erwartung:** `await links.count()` liest **einmal**, und `expect(zahl)` wiederholt
nichts — unter Last erwischte der Test die Seitenleiste im Aufbau. Dieselbe Seite
lieferte unmittelbar danach 38 Verweise (gemessen). Die Schwelle `> 5` steht
unverändert; nur das Lesen wartet jetzt (`expect.poll`). Danach 5/5 grün.

\*\* `catalog browser shows seeded catalogs` (3,1 min Zeitüberschreitung) und
`API: create, read, update, delete a risk`. Beide isoliert wiederholt: **6 passed
(38.9s)**. Ursache in §9.

### 8.3 `regression`-Projekt — 26 von 62 Tests gemessen

| Gruppe                             | Dateien | grün | rot | Stand                      |
| ---------------------------------- | ------: | ---: | --: | -------------------------- |
| `b-` (Berechtigungen, Bulk)        |       6 |    6 |   0 | vollständig                |
| `d-` (Daten, Dokumente)            |       3 |    3 |   0 | vollständig                |
| `f-` (Funktionsmatrix)             |       4 |    5 |   0 | vollständig                |
| `i-` (ISMS)                        |      10 |   11 |   0 | vollständig\*              |
| `n-01-nis2-reporting`              |       1 |    1 |   0 | vollständig                |
| `n-` (Formulare), `p-`, `r-`, `x-` |      22 |    — |   — | **nicht zu Ende gemessen** |

\* `i-08-cve-flow` und `i-09-incident-playbook` fielen im Abschnittslauf mit
`page.evaluate: Test timeout` und liefen isoliert grün: **6 passed (2.1m)**.

**Was offen bleibt: 36 Tests in 22 Spezifikationen.** Sie sind nicht rot — sie sind
**ungemessen**. Die `n-*`-Formulartests übersetzen je eigene, schwere Seiten
(`/risks/[id]` allein 61 s), und die Maschine kam in diesem Zeitfenster nicht
durch. Das als „grün" oder „rot" zu buchen wäre eine Erfindung; es steht deshalb
als drittes Feld da.

Zum Vergleich: `E2E-TRIAGE-4.md` §6.1 meldet „199 Tests — 199 bestanden". Diese
Zahl ist hier weder bestätigt noch widerlegt; 161 der 199 sind gemessen, davon
alle grün.

---

## 9. Die Maschine — was den Lauf wirklich behindert hat

Kein Produktbefund, aber die Erklärung für jede Zeitüberschreitung oben, und für
die nächste Runde nützlich.

**Der Entwicklungsserver braucht den ganzen Speicher.** Gemessen:

| Zustand                                           |   RSS `next-server` |
| ------------------------------------------------- | ------------------: |
| Start mit leerem `.next/dev`                      |          **606 MB** |
| nach `/login`                                     |         **1178 MB** |
| nach ~50 übersetzten Routen                       |         **5200 MB** |
| **Neustart** mit dem gewachsenen Zwischenspeicher | **5040 MB, sofort** |

`.next/dev` wuchs auf **3,8 GB**; der Server lädt ihn beim Start. Auf 8 GB bleiben
dann ~1,3 GB für Chromium, Playwright und Postgres — und die Maschine geht in
Speicherrückgewinnung: gemessen `load average 22` bei **99 % Systemzeit** und
0 % Benutzerzeit, während nichts rechnete. In diesem Zustand laufen Tests in ihr
90-Sekunden-Limit, ohne dass am Produkt etwas fehlt. Genau so entstanden die
sechs Ausfälle in §8.2/§8.3, die isoliert alle grün sind.

**Was hilft, gemessen:** Abschnitte von wenigen Spezifikationen mit einem frisch
gestarteten Server dazwischen; und für einen sauberen Durchlauf einer einzelnen
Datei ein **gelöschter** `.next/dev` (Server bleibt dann unter 3,3 GB — so
entstand die Messung in §5.4). Ein Neustart allein genügt nicht, weil der
Zwischenspeicher wieder geladen wird.

**Eine Warnung für die nächste Runde.** `.next/dev` bei **laufendem** Server zu
löschen hinterlässt einen Server, der ganze Routenbäume mit HTML-404 beantwortet:

```
/api/v1/risks/heatmap                              404 text/html
/api/v1/risks/<uuid>                               404 text/html
/api/v1/risks/<uuid>/history                       404 text/html
```

Das sah wie ein Produktdefekt aus („ein soeben angelegtes Risiko ist nicht
lesbar"), war aber keiner: nach einem Neustart antwortet dieselbe Route
`200 application/json`. Nachgemessen in beide Richtungen. Es ist hier notiert,
damit die nächste Runde die Stunde nicht noch einmal ausgibt.

---

## 10. OP-080 — was jetzt gilt

`react-hooks/exhaustive-deps` und die sieben React-Compiler-Regeln stehen im
Register mit „Blockiert durch OP-027 (ohne E2E nicht verifizierbar)".

**Diese Begründung ist ab jetzt hinfällig.** Es gibt einen reproduzierbaren Lauf,
er braucht keinen Produktionsbau, und er deckt mit 135 Web-Tests inklusive
Zeichenfläche genau die Oberflächen ab, auf denen eine Hook-Umstellung Schaden
anrichten könnte.

**Abgetragen ist OP-080 damit nicht** — er ist eine Verhaltensänderung in 19
Seiten und braucht seine eigene Welle. Was sich ändert, ist der Grund, warum er
liegen bleibt: nicht mehr „nicht verifizierbar", sondern „noch nicht getan". Wer
ihn angeht, sollte die Abschnittsführung aus §9 übernehmen und den Lauf
**zweimal** fahren — einmal vor, einmal nach der Umstellung —, sonst ist die
Aussage „nichts kaputtgegangen" wieder nur eine Behauptung.

---

## 11. Abnahme

| Tor                                               | Ergebnis                                                       |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `npx tsc --noEmit -p apps/web/tsconfig.json`      | **exit 0**, keine Ausgabe                                      |
| `npx tsc --noEmit -p packages/bpmn/tsconfig.json` | **exit 0**                                                     |
| `npx prettier --check .`                          | **All matched files use Prettier code style!**                 |
| `node scripts/lint-ratchet.mjs`                   | **45 Befunde (Baseline 45), 0 in apps/web** — keine Regression |
| `node scripts/check-gate-inputs.mjs`              | **9 Tor-Eingaben vorhanden, verfolgt, nicht ignoriert**        |
| `node scripts/audit-secrets.mjs`                  | **4437 Dateien, 0 Funde**                                      |
| `vitest run` in `packages/bpmn`                   | **58 Dateien, 909 Tests, alle grün**                           |
| `vitest run` (BPMN-Komponenten in `apps/web`)     | **3 Dateien, 51 Tests, alle grün**                             |
| Playwright `web`-Projekt                          | **135/135 grün** (§8.2)                                        |
| Playwright `regression`-Projekt                   | **26/62 gemessen, davon 26 grün** (§8.3)                       |

`docs/security/secret-scan-report.md` ist die **Ausgabe** von
`audit-secrets.mjs` und hat sich beim Ausführen des Tors mitgeändert
(Zeitstempel, 4432 → 4437 Dateien).

---

## 12. Was offen bleibt

1. **36 Regressionstests in 22 Spezifikationen sind ungemessen** (§8.3). Sie
   brauchen entweder mehr Zeit oder eine Maschine, auf der der
   Entwicklungsserver nicht 5 GB belegt.
2. **OP-036 bleibt offen** und hängt jetzt nachweislich am Produktionsbau, nicht
   an OP-027 (§6).
3. **OP-167 bleibt offen** — für das Deployment. Als Blocker für OP-027 und
   OP-080 ist er erledigt (§2).
4. **OP-034** (Kontrast der BPMN-Bedienelemente) ist mit diesem Lauf erreichbar
   geworden: der Editor lässt sich jetzt im Browser bis zu geöffneter Palette und
   geöffnetem Kontextmenü fahren, und `axe` kann dort messen, was in jsdom
   abgeschaltet ist. Getan ist es nicht.
5. **Die Werkzeugleiste des Editors ist fest verdrahtetes Englisch** —
   `bpmn-toolbar.tsx` liefert `"Save"`, `"Saving..."`, `"Saved"`, `"Export"`,
   `"Undo"`, `"Redo"`, `"Unsaved changes"` ohne `useTranslations`. Beim Schreiben
   des Tests aufgefallen (der Speichern-Knopf wird über
   `getByRole("button", { name: /^(Save|Saving)/ })` gefunden — ein Selektor, der
   nur funktioniert, weil nichts übersetzt ist). Gehört fachlich zu OP-070/OP-202
   und ist dort nicht gelistet.
6. **Ein Sequenzfluss mit gleicher Quelle und gleichem Ziel** wird von der
   Legacy-Engine erzeugt und gespeichert (§5.3). Ob `bpmn-validator.ts` das
   beanstanden sollte, ist eine fachliche Frage und hier nur benannt.
7. **`fix_soa_annex_a.sql` schreibt SoA-Zeilen für `c2446a5c-…`**, während der
   E2E-Lauf und die Demodaten auf `ccc4cc1c-…` zeigen. Der Seed läuft jetzt
   durch; ob die SoA im richtigen Mandanten landet, ist damit **nicht**
   beantwortet.
