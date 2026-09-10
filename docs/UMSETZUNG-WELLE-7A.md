# Welle 7a — OP-080: sechs Regeln an, zwei ehrlich beziffert aus

**Datum:** 2026-09-08 · **Branch:** `audit/full-2026-08-31` · **Basis:** `b0bbd396`
**Betroffen:** `apps/web/eslint.config.mjs` · 39 Dateien unter `apps/web/src/**`
(ohne `src/app/api/**`) · ein neuer Test unter `apps/web/src/__tests__/hooks/`

---

## 1. Kurzfassung

| Frage                                                     | vor 7a |          nach 7a |
| --------------------------------------------------------- | -----: | ---------------: |
| Abgeschaltete Hook-Regeln in `apps/web/eslint.config.mjs` |  **8** |            **2** |
| Fundstellen dieser acht Regeln, **selbst gemessen**       | **76** |           **22** |
| Fundstellen laut Register/Konfiguration (WP12)            |     59 |                — |
| Produktdefekte, die das Einschalten freigelegt hat        |      — |            **5** |
| Lint-Ratsche `apps/web`                                   |      0 |            **0** |
| `web`-E2E-Projekt                                         |      — | **135/135 grün** |

**Die Begründung von WP12 war in beiden Hälften falsch.** Sie lautete: eine
Umstellung sei „eine Verhaltensänderung in 18/19 Seiten, die dieses Paket ohne
die E2E-Suite nicht verifizieren kann".

- Die E2E-Suite läuft — das hat Welle 6c mit OP-204 gemessen.
- **Die Zahlen stimmten nicht.** Vier der acht notierten Zahlen waren zu
  niedrig, `exhaustive-deps` um **14**.
- **Die Beschreibung stimmte nicht.** Die Konfiguration behauptete für
  `set-state-in-effect`, „every one of them is the same shape: a `useEffect`
  that fetches on mount", und die Auflösung sei `@tanstack/react-query` in
  19 Seiten. Nachgezählt gilt das für **9 von 20** Fundstellen in **6** Dateien
  (§6).

---

## 2. Erst messen — die Zahlen je Regel

Gemessen am 2026-09-08 mit **derselben** Konfiguration, die auch die Ratsche
misst (`cwd: apps/web`), die acht Regeln je einzeln auf `error` gehoben:

```
$ cd apps/web
$ npx eslint . --no-error-on-unmatched-pattern -f json \
    --rule '{"react-hooks/exhaustive-deps":"error", …}' | <zählen>
Dateien gelintet: 2290
```

| Regel                                     | notiert (WP12) | **gemessen 08.09.** | nachher | Stand  |
| ----------------------------------------- | -------------: | ------------------: | ------: | ------ |
| `react-hooks/exhaustive-deps`             |             23 |              **37** |   **0** | **AN** |
| `react-hooks/set-state-in-effect`         |             19 |              **20** |      20 | aus    |
| `react-hooks/purity`                      |              8 |               **8** |   **0** | **AN** |
| `react-hooks/static-components`           |              3 |               **3** |   **0** | **AN** |
| `react-hooks/immutability`                |              2 |               **3** |   **0** | **AN** |
| `react-hooks/incompatible-library`        |              2 |               **2** |       2 | aus    |
| `react-hooks/preserve-manual-memoization` |              1 |               **1** |   **0** | **AN** |
| `react-hooks/refs`                        |              1 |               **2** |   **0** | **AN** |
| **Summe**                                 |         **59** |              **76** |  **22** |        |

Die Registerzahlen „23 bzw. 36" waren also **37 bzw. 39**. Das ist die
Fortsetzung des Musters dieses Audits: in diesem Verfahren war bisher jede
übernommene Registerzahl falsch.

**Regel für Regel, nicht alles auf einmal.** Die Konfiguration führt jede
Regel weiterhin einzeln, „damit eine andere Art von Meldung NICHT
mitgeschwiegen wird". Diese Trennung ist erhalten; die sechs eingeschalteten
Regeln stehen nirgends mehr in der Datei und gelten wie jede andere Regel des
Regelwerks.

---

## 3. Die Produktdefekte

Fünf Befunde, jeder mit dem Beleg, an dem er gemessen wurde. Vier davon hat
`exhaustive-deps` freigelegt; der fünfte fiel beim **Schreiben der Prüfung**
zum zweiten auf.

### 3.1 Der Schlagwortfilter auf `/search` erreichte die Anfrage nicht

`src/app/(dashboard)/search/page.tsx:130`

```
React Hook useCallback has a missing dependency: 'tagFilter'.
```

`handleSearch` las `tagFilter` an **zwei** Stellen — im Wachtposten und beim
Bauen der Abfrage — und war mit `[query, scope]` gemerkt. `useCallback` gibt
bei unveränderten Abhängigkeiten die **alte** Funktion zurück, also die mit
dem Stand von `tagFilter` aus dem Augenblick, in dem zuletzt getippt oder der
Suchbereich gewechselt wurde. Zwei sichtbare Folgen:

- Suchbegriff getippt, **danach** ein Schlagwort gesetzt: die Anfrage geht
  **ohne** `tags`-Parameter hinaus. Der Nutzer sieht den Filter auf dem
  Bildschirm und bekommt ungefilterte Ergebnisse.
- Leere Suchzeile, nur ein Schlagwort: im alten Abschluss ist `tagFilter` noch
  leer, der Wachtposten greift, und `handleSearch` tut **gar nichts**.

**Beleg** (`wave7a-hook-deps.test.tsx`, Prüfung 3): Suchbegriff tippen,
Schlagwort wählen, Enter — die abgesetzte URL wird gelesen.

```
Gegen den alten Stand von search/page.tsx:
  ×  schickt `tags=` mit, wenn das Schlagwort NACH dem Suchbegriff gesetzt wird
     Tests  1 failed | 5 passed (6)
Gegen den neuen Stand:  6 passed
```

### 3.2 `openTab` aktualisierte einen offenen Reiter nie

`src/hooks/use-tab-navigation.tsx`

Hier stand `return prev`, sobald ein Reiter mit derselben Kennung existierte.
Beschriftung, Ziel und Sinnbild blieben damit für immer die aus dem Augenblick
der Anlage. Das traf zwei Fälle:

- **Sprachwechsel.** `/assets` und `/work-items` melden ihren Reiter mit
  `t("title")` an. Der Sprachwähler setzt nur einen Keks und ruft
  `router.refresh()` — Clientkomponenten werden dabei **nicht** neu
  eingehängt. Die Reiterleiste blieb deutsch, während die übrige Oberfläche
  englisch war, und `saveSessionTabs` schrieb den falschsprachigen Text
  zusätzlich in den Sitzungsspeicher, wo er die Sitzung überlebte.
- **Umbenennen.** `/assets/[id]` und `/work-items/[id]` melden den Namen des
  Objekts als Beschriftung an. Nach einer Umbenennung stand im Reiter weiter
  der alte Name.

Der Defekt hatte **zwei Hälften**, und die Regel zeigte nur die eine: die
Effekte auf den vier Seiten hatten `t` bzw. `assetId`/`itemId` nicht in ihren
Abhängigkeiten (`exhaustive-deps`), und selbst wenn sie erneut gelaufen wären,
hätte `openTab` nichts geändert. **Beide** Hälften sind behoben; die Regel
allein hätte den Defekt nicht beseitigt.

`openTab` gibt `prev` unverändert zurück, wenn Beschriftung, Ziel und Sinnbild
gleich sind — sonst erzeugte jeder Aufruf ein neues Feld und der
Persistenz-Effekt (`[tabs, initialized]`) liefe in eine Schleife. Dass diese
Falle nicht zuschnappt, ist mitgeprüft.

### 3.3 Die Reiterleiste zeigte nie die Seite, mit der sie geöffnet wurde

`src/hooks/use-tab-navigation.tsx` — **aufgefallen, weil Prüfung 3.2 zunächst
nicht fallen konnte.**

Der Anbieter setzte beim Aufbau `setTabs(hydrated)` mit einem **festen Wert**.
Die vier Seiten, die ihren Reiter anmelden, sind Kinder dieses Anbieters
(`(dashboard)/layout.tsx`), und Kindeffekte laufen **vor** denen des
Elternteils. Beim ersten Aufbau lief also erst `openTab(...)` und unmittelbar
danach `setTabs(hydrated)`, das die soeben angemeldete Anmeldung wegwarf.

**Beleg**, gemessen in beide Richtungen (jsdom, ein Aufbau):

```
ALT:  leerer Sitzungsspeicher        → tabs.length = 0   (Reiter weg)
      vorbefüllter Sitzungsspeicher  → n = 1  ReiterX: false  Alt: true
NEU:  leerer Sitzungsspeicher        → tabs.length = 1
      vorbefüllter Sitzungsspeicher  → n = 2  ReiterX: true   Alt: true
```

Sichtbar wurde es im Browser erst nach einer Navigation, weil `openTab` dann in
einer späteren Festschreibung läuft. Behoben mit einem funktionalen
Aktualisierer, der bereits Angemeldetes stehen lässt.

### 3.4 Zugängliche Namen und Zahlenformate froren in der Sprache des Aufbaus ein

Vierzehn der 37 `exhaustive-deps`-Fundstellen sind dieselbe Klasse wie OP-202
und OP-203 aus Welle 6b: **übersetzter Text, der in einem Effekt oder einer
Merkung gesetzt wird, deren Abhängigkeitsliste `t` bzw. den
Gebietsschema-Formatierer nicht nennt.** Weil der Sprachwähler
Clientkomponenten nicht neu einhängt, blieb das Gesetzte in der alten Sprache
stehen, während die Oberfläche wechselte.

| Ort                                     | Was einfror                                        |
| --------------------------------------- | -------------------------------------------------- |
| `bpmn-editor-legacy.tsx` (5 Effekte)    | zugängliche Namen der fünf Einblendungskanäle      |
| `bpmn-viewer-legacy.tsx` (2 Effekte)    | dieselben Namen im Lesepfad                        |
| `arctos-bpmn-canvas.tsx`                | `aria-label` der Zeichenfläche + Ebenen-Ersatztext |
| `access-log`, `audit-log` (`useMemo`)   | Zeitstempel in der Tabelle (`numberLocale`)        |
| `catalogs/objects`, `users` (`useMemo`) | Datumsspalten (`formatDate` / `formatDateTime`)    |
| `assets`, `work-items` (+ Detailseiten) | Reiterbeschriftung (siehe 3.2)                     |

Alle Einblendungs-Effekte räumen ihre eigenen Einblendungen zuerst ab
(`overlays.remove({ type })`) und sind damit wiederholbar; `t` in der Liste ist
gefahrlos. Für die Zeichenfläche ist der zugängliche Name in einen **eigenen**
Effekt gewandert (`[ready, t, describedById]`), damit er der Sprache folgt,
ohne die Fläche neu aufzubauen.

**Ehrlich benannt, was NICHT folgt:** `arctos-bpmn-canvas.tsx` übergibt
`disabledReason` als **Konstruktionsoption** an die Engine. Sie lässt sich
nachträglich nicht wechseln, und sie in die Abhängigkeiten zu nehmen hieße, die
Fläche bei jedem Sprachwechsel abzureißen — samt Blickausschnitt, Auswahl und
Ebene. Dieser eine Hinweistext bleibt in der Sprache des Aufbaus stehen; das
steht als Kommentar an der Fundstelle.

### 3.5 Drei Verweise wurden beim Rendern geschrieben

`react-hooks/refs`, 2 Fundstellen gemessen, eine dritte erst nach einer
anderen Behebung sichtbar (§5.2):

- `arctos-bpmn-canvas.tsx` (`useOverlayChannel`)
- `components/ui/modal-shell.tsx` (`onCloseRef`)
- `components/ui/field.tsx` (`fallbackRef`)

Ein Schreibzugriff auf einen Verweis **während des Renderns** wirkt auch aus
einem Rendervorgang, den React wieder verwirft (Übergänge, Suspense, doppeltes
Rendern im Strict Mode). Der Dialog hätte bei `Escape` dann ein `onClose`
gerufen, das nie festgeschrieben wurde. Alle drei ziehen den Verweis jetzt im
**Effekt** nach, jeweils vor dem verbrauchenden Effekt; die Reihenfolge ist an
jeder Fundstelle begründet.

---

## 4. Was die anderen eingeschalteten Regeln gebracht haben

### 4.1 `purity` (8 → 0) — `Date.now()` im Renderpfad

An drei Stellen von `modern-dashboard.tsx` stand `Date.now()` im Renderpfad,
zweimal davon **in derselben Bedingung** („überfällig" / „fällig in ≤ 3
Tagen") — zwei Ablesungen der Uhr in einem Ausdruck. Unrein heißt hier
konkret: derselbe Rendervorgang kann zwei Werte sehen, und Server- und
Browserdurchlauf sehen ohnehin verschiedene — das ist die Klasse, aus der
Abweichungen beim Anhydrieren entstehen.

Alle acht benutzen jetzt `useNow()` aus next-intl — **einen** Zeitpunkt je
Einhängung, aus demselben Anbieter, den die Seiten für Sprache und Zeitzone
schon benutzen. In `programmes/[id]/timeline` musste der Aufruf an den Anfang
der Komponente, weil darunter frühe Rücksprünge stehen; das prüft
`rules-of-hooks` nach (gemessen, der Zwischenstand war rot).

### 4.2 `static-components` (3 → 0) — Elementtyp aus einem Aufruf

`admin/modules`, `layout/tab-bar` und `dashboard/dashboard-widget-frame`
schrieben `const Icon = getLucideIcon(...)` bzw.
`const WidgetRenderer = getWidgetRenderer(...)` in den Komponentenrumpf und
setzten das Ergebnis als JSX-Typ ein. Die Regel sieht dabei nur, dass der Typ
aus einem **Aufruf** stammt; über die Funktionsgrenze kann sie nicht nachsehen,
ob immer dieselbe Komponente herauskommt. Sie hat in der Sache recht: ein
wechselnder Typ an derselben Stelle hängt den Teilbaum aus und wieder ein — der
Zustand der Kachel wäre weg.

**Nachgemessen, welche Form die Regel akzeptiert** (Sondierungsdatei, danach
gelöscht):

```
const Icon = MAP[name] ?? Box;   <Icon/>   → keine Meldung
const Icon = f(name);            <Icon/>   → Meldung
const R = M1[k] ?? (wt ? M2[wt] : undefined) ?? A;  <R/>  → keine Meldung
```

Der Nachschlag steht deshalb jetzt dort, wo er nachprüfbar ist: in
`components/module/module-icon.tsx` (neu) und in einer Modulkomponente
`WidgetRenderer` in der Registry. `getLucideIcon`/`getWidgetRenderer` bleiben
für Aufrufer ohne JSX bestehen. **Kein `eslint-disable`.**

### 4.3 `immutability` (3 → 0)

- `catalogs/objects/page.tsx`: der Effekt stand **vor** der Erklärung von
  `fetchObjects` und rief eine Bindung auf, die beim Rendern noch in der
  zeitlichen Totzone lag. Derselbe Fehler wie die fehlende Abhängigkeit an
  derselben Zeile; beides behoben.
- `layout/locale-switcher.tsx`: Zuweisung an `document.cookie` im
  Komponentenrumpf. Nachgemessen: dieselbe Zuweisung in einer Funktion auf
  Modulebene meldet die Regel **nicht** — und dorthin gehört sie ohnehin, weil
  Name und Eigenschaften des Kekses eine Angelegenheit für sich sind.
- `components/ui/field.tsx`: Zuweisung an ein Hook-Argument
  (`forwardedRef.current = node`). Als `assignForwardedRef` auf Modulebene
  benannt statt an der Stelle wiederholt.

### 4.4 `preserve-manual-memoization` (1 → 0)

`programme-gantt.tsx`: die `useMemo` für die Monatsmarken benutzte `xPct`, ohne
es zu nennen, und zählte statt dessen `rangeStart`/`rangeEnd` auf — `totalDays`,
das `xPct` ebenfalls liest, fehlte. Dass daraus heute keine falsche Marke folgt,
hängt allein daran, dass alle drei aus **derselben** `useMemo` stammen. Als
`useCallback` gefasst und genannt; die Meldung des Compilers entfiel damit
gleich mit.

### 4.5 Zwei nutzlose Merkungen

- `translation/language-tabs.tsx`: `normalizedValue` wurde bei jedem Rendern
  neu gebaut — ein neues Objekt — und steht in den Abhängigkeiten von **drei**
  `useCallback`. Deren Merkung war damit wirkungslos; sie entstanden ohnehin
  bei jedem Rendern neu, und jede Kindkomponente, die einen als Eigenschaft
  bekommt, rendert mit. `useMemo` an der Quelle stellt die Merkung her, statt
  sie zu behaupten.
- `layout/org-switcher.tsx`: die Liste der erreichbaren Organisationen war
  **Zustand** und wurde von einem Effekt aus dem react-query-Ergebnis
  gespiegelt. Das kostete einen zusätzlichen Renderdurchlauf je Änderung — der
  Kopf zeigte kurz „keine Auswahl", weil `orgs.length <= 1` im ersten Durchlauf
  noch galt — und zwang die Abhängigkeitsliste zur Unwahrheit (sie nannte
  `session` ersatzweise für ein bei jedem Rendern neu gebautes Feld). Jetzt
  beim Rendern abgeleitet; Effekt und falsche Liste entfallen.

---

## 5. Zwei Regeln, die einander verdeckt haben

Rein mechanisch, in beide Richtungen gemessen — und der Grund, warum
„eine Regel je Eintrag" keine Formalie ist.

### 5.1 `immutability` verdeckte `set-state-in-effect`

`catalogs/objects/page.tsx` meldete im **alten** Stand:

```
ALT  65 [react-hooks/immutability]
     66 [react-hooks/exhaustive-deps]
    167 [react-hooks/exhaustive-deps]
```

— und **kein** `set-state-in-effect`. Nach der Behebung des
`immutability`-Befunds meldet dieselbe Datei `set-state-in-effect:85`. Der
Compiler brach vorher an dem Fehler ab und kam nie bis zum Effekt.

Das ist der Grund, warum `set-state-in-effect` mit **20 vorher und 20 nachher**
in der Datei steht, obwohl `org-switcher` (§4.5) eine Fundstelle abgetragen
hat: die Zusammensetzung hat sich um **−1/+1** verändert. Eine reine
Summenbetrachtung hätte „nichts passiert" gemeldet.

### 5.2 `immutability` verdeckte `refs`

Dieselbe Mechanik in `components/ui/field.tsx`: erst nachdem die Zuweisung an
`forwardedRef` ausgelagert war (§4.3), meldete die Datei
`react-hooks/refs:269` — den Verweis, der beim Rendern geschrieben wurde
(§3.5). Vorher kam der Compiler nicht bis dorthin.

---

## 6. Was mit Begründung abgeschaltet bleibt

### 6.1 `react-hooks/set-state-in-effect` — 20 Fundstellen

Die alte Begründung nannte **eine** Gestalt und **eine** Auflösung. Fundstelle
für Fundstelle nachgezählt sind es **vier** Gestalten, und die genannte
Auflösung trifft auf **9 von 20** zu:

| Gestalt                                    | Fundstellen | Dateien | react-query die Auflösung?    |
| ------------------------------------------ | ----------: | ------: | :---------------------------- |
| **A** Abruf beim Einhängen                 |       **9** |       6 | **ja** — bereits Abhängigkeit |
| **B** Formular beim Öffnen zurücksetzen    |       **4** |       4 | nein — kein Abruf             |
| **C** Browserspeicher beim Einhängen lesen |       **5** |       3 | nein — `useSyncExternalStore` |
| **D** Anzeigezustand aus einem Übergang    |       **2** |       2 | nein                          |

- **A** — `bcms/bia/[id]/processes`, `catalogs/objects`, `dashboard/page` (4×),
  `processes/[id]/ropa`, `documents/entity-documents-panel` (2×)
- **B** — `organizations`, `tasks`, `settings/notifications/scheduled`,
  `layout/modern-sidebar`
- **C** — `hooks/use-layout-preference`, `hooks/use-nav-preferences` (2×),
  `hooks/use-tab-navigation` (2×)
- **D** — `bpmn/bpmn-toolbar` („Gespeichert" mit Zeitgeber),
  `layout/theme-switcher` (`mounted`-Wachtposten gegen Serverabweichung)

**Warum sie aus bleibt:** 15 Dateien, davon 11 Fundstellen, für die die
genannte Auflösung nachweislich nicht zutrifft. Das ist eine eigene Welle mit
eigenem Vorher-/Nachher-Lauf, keine Zugabe zu dieser. Der Unterschied zum
Zustand vor 7a: der Grund heißt jetzt **„noch nicht getan" mit gemessener Zahl
und benannter Gestalt**, nicht mehr „nicht verifizierbar".

Die Zahl ist gedeckelt: `.eslint-ratchet.json` steht für `apps/web` auf **0**,
jede **neue** Fundstelle irgendeiner Regel lässt die Ratsche fallen.

### 6.2 `react-hooks/incompatible-library` — 2 Fundstellen

`audit-log/page.tsx:1321` und `components/ui/data-table.tsx:68`, beide
derselbe Aufruf:

```
Compilation Skipped: Use of incompatible library
TanStack Table's `useReactTable()` API returns functions that cannot be
memoized safely
```

Das ist eine **Mitteilung** („Compilation Skipped") über eine fremde
Bibliothek, kein Defekt an der Fundstelle: der Compiler verzichtet dort auf die
Optimierung. Es gibt keine Behebung außer dem Verzicht auf
`@tanstack/react-table`, und das entscheidet keine Lint-Regel. Anders als bei
6.1 steht hier nicht „noch nicht getan", sondern **„von hier aus nicht
behebbar"**.

---

## 7. Die Prüfungen — und der Nachweis, dass sie fallen

`apps/web/src/__tests__/hooks/wave7a-hook-deps.test.tsx`, sechs Prüfungen in
vier Gruppen. Jede wurde gegen den **alten** Stand genau der Datei gefahren,
die sie meint:

```
$ git stash push -- apps/web/src/hooks/use-tab-navigation.tsx
  ×  übernimmt eine geänderte Beschriftung, statt `prev` zurückzugeben
  ×  erzeugt bei unverändertem Reiter KEINEN neuen Zustand (keine Schleife)
  ×  wechselt von Arbeitsobjekte nach Work Items
  ×  bei leerem Sitzungsspeicher bleibt der eigene Reiter stehen
  ×  ein gespeicherter Reiter überlebt daneben
     Tests  5 failed | 1 passed (6)

$ git stash push -- apps/web/src/app/(dashboard)/search/page.tsx
  ×  schickt `tags=` mit, wenn das Schlagwort NACH dem Suchbegriff gesetzt wird
     Tests  1 failed | 5 passed (6)

$ git stash push -- apps/web/src/app/(dashboard)/work-items/page.tsx
  ×  wechselt von Arbeitsobjekte nach Work Items
     Tests  1 failed | 5 passed (6)

Neuer Stand:  Tests  6 passed (6)
```

**Eine Warnung in eigener Sache, im Sinne von OP-205.** Die erste Fassung der
Sprachwechsel-Prüfung las `getAllByText("Arbeitsobjekte")` und war **grün,
obwohl der Reiter gar nicht existierte** — sie hatte die Überschrift der Seite
gefunden. Genau die Bauart, an der das Formtestwerk in Welle 6c gescheitert
ist, hier an der eigenen Prüfung. Gelesen wird jetzt `getByTitle(...)`: der
Beschriftungsknopf eines Reiters trägt `title={tab.label}` und ist das einzige
Element mit diesem Merkmal. Die Überschrift wird **zusätzlich** geprüft, damit
ein Fehlschlag unterscheidbar bleibt — wechselt auch sie nicht, ist die Prüfung
kaputt und nicht das Produkt.

Und die zweite Prüfung derselben Gruppe deckt die Falle der Behebung ab: ein
`setTabs` mit jedes Mal neuem Feld würde den Persistenz-Effekt endlos wecken.
Gemessen wird das an der Zahl der Schreibvorgänge in den Sitzungsspeicher.

---

## 8. Verifikation der Verhaltensänderungen — der E2E-Lauf

Das war die Bedingung, die die alte Begründung gestellt hat. Sie ist erfüllt.

### 8.1 Aufbau

Datenbank `grc_e2e6c` aus Welle 6c (21 Organisationen, 58 Nutzer, 66
Arbeitsobjekte), `apps/web/.env.local` zeigt bereits dorthin. Die vier
E2E-Konten mussten mit einem bekannten Kennwort neu bereitgestellt werden
(`E2E_ROLE_PASSWORD=… npm run db:seed:e2e-users`) — die Hashes aus Welle 6c
waren nicht rekonstruierbar. Chromium aus `/opt/pw-browsers`, **kein**
`playwright install`. Wurzelkonfiguration, Projekt `web`, `workers: 1`.

Gefahren **in Abschnitten** mit frisch gestartetem Entwicklungsserver und
gelöschtem `.next` dazwischen — die Abschnittsführung aus `UMSETZUNG-WELLE-6C.md`
§9. Ihre Begründung ist hier erneut gemessen: `next-server` wächst auf **5,1 GB**
RSS, danach Lastmittel **26** bei praktisch freiem Speicher, und in diesem
Zustand laufen Tests in ihr 90-Sekunden-Limit, ohne dass am Produkt etwas fehlt.

### 8.2 `web`-Projekt — 135 von 135 grün

| Abschnitt                                           |   Tests |    grün |
| --------------------------------------------------- | ------: | ------: |
| a11y-smoke, ci-smoke, navigation                    |      13 |      13 |
| platform-smoke                                      |      40 |    40\* |
| bpmn-canvas-modeling, process-map, process-portal   |       4 |       4 |
| budget, catalog-activation, catalogs, reports       |      13 |      13 |
| isms-workflow                                       |      15 |      15 |
| api-auth                                            |       2 |       2 |
| ai-act-workflow, management-review                  |      14 |      14 |
| document-signature, audit-cis-ig-flow               |       3 |       3 |
| bpm-approval-pipeline, bpm-racm-perf, bpm-ropa-flow |       5 |       5 |
| cross-module-workflows (7 Abschnitte)               |      27 |    27\* |
| **Summe**                                           | **135** | **135** |

Dazu je Aufruf vier Anmeldungen im `setup`-Projekt, alle grün. Kein
`test.skip`.

\* Fünf Ausfälle im Abschnittslauf (`risk creation form renders`,
`dashboard has no console errors`, zwei BCMS-Seiten, `EU taxonomy page loads`)
waren **maschinenbedingt** und isoliert alle grün — dieselbe Klasse wie die
sechs aus Welle 6c §9. Jeder wurde nach einem Neustart mit gelöschtem `.next`
einzeln wiederholt und bestanden.

**Was das für diese Welle belegt.** Der Lauf deckt die berührten Oberflächen
ab: `assets` und `assets/[id]` (isms-workflow S1.2), `audit/executions/[id]`
(audit-cis-ig-flow), die BPMN-Flächen in beiden Engines
(bpmn-canvas-modeling, bpm-approval-pipeline), `my-processes`
(process-portal), `esg/yoy` (cross-module ESG), die Programmseiten,
`processes`, `catalogs/objects` und `catalogs/lifecycle`, die Reiterleiste
(cross-module „horizontal tab navigation renders on module pages"), die
Seitenleiste und den Sprachwähler. `dashboard has no console errors` ist der
direkte Wachtposten für die `useNow()`-Umstellung in `modern-dashboard.tsx`:
eine Abweichung beim Anhydrieren erschiene dort als Konsolenfehler.

### 8.3 `regression`-Projekt — 13 Tests gemessen, 12 grün

Nicht Gegenstand dieser Welle (der Bestand ist API-lastig), aber die Gruppen
mit Bezug zu den berührten Dateien sind gefahren:

| Spezifikation                           | grün | rot |
| --------------------------------------- | ---: | --: |
| `x-01-org-switch` (2), `x-02-i18n` (1)  |    3 |   0 |
| `p-03`, `p-04`, `p-05` (Programmseiten) |    3 |   0 |
| `n-01-risk-form-validation`             |    0 | 1\* |

Die übrigen 43 Spezifikationen des `regression`-Projekts sind **ungemessen —
nicht rot.** Welle 6c hat davon 26 gemessen; diese Welle hat die Zahl nicht
fortgeschrieben.

\* **`n-01` ist kein Rückschritt dieser Welle — in beide Richtungen
gemessen.** Der Test liest den Titel eines soeben angelegten Risikos auf
`/risks/[id]`; die Seite liefert dort nur die Hülle (`„A / U / Organisation /
U / © 2026 ARCTOS …"`). Gefahren auf dem **unveränderten** Stand
(`git checkout -- apps/web/src`, frischer Server, einmal kalte und einmal warme
Route): **derselbe Fehlschlag, dieselbe Zeichenkette.** Zusätzlich mit einem
eigenen Playwright-Skript geprüft, dass `/risks/[id]` auf **beiden** Ständen
identisch rendert (`„RSK-001 Ransomware-Angriff auf kritische Systeme"`),
sobald der Server frisch ist. `/risks/[id]` gehört nicht zu den berührten
Dateien. Der Punkt gehört zur `n-*`-Gruppe, die Welle 6c ausdrücklich als
„nicht zu Ende gemessen" führt.

**Ein Irrweg, damit die nächste Runde ihn nicht wiederholt.** Der erste
Verdacht war ein Rückschritt dieser Welle, weil `/risks/[id]` auf dem neuen
Stand nur die Hülle zeigte. Das war ein **Zustand des Servers**, kein Defekt:
derselbe Aufruf gegen einen frisch gestarteten Server mit gelöschtem `.next`
rendert vollständig. Und: `git stash` auf `apps/web/src` **während** ein
Playwright-Lauf und ein Entwicklungsserver laufen, bricht unter der Last mitten
im Schreiben ab und hinterlässt Dateien der Länge 0. Wer vergleichen will,
sichert vorher mit `git diff > patch` plus einer Kopie und stellt mit
`git apply` wieder her — und beendet zuerst alle Läufe.

---

## 9. Abnahme

| Tor                                          | Ergebnis                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p apps/web/tsconfig.json` | **exit 0**, keine Ausgabe                                                         |
| `npm test` (apps/web)                        | **132 Dateien, 2.953 Tests grün** + 4/24 DB-Suiten                                |
| `npm run test:rls` (apps/web)                | **4 Dateien, 24 Tests grün**                                                      |
| Playwright `web`-Projekt                     | **135/135 grün** (§8.2)                                                           |
| Playwright `regression` (Auswahl)            | **12/13 grün**, 1 vorbestehend rot (§8.3)                                         |
| `npx prettier --check .`                     | **All matched files use Prettier code style!**                                    |
| `node scripts/lint-ratchet.mjs`              | `[apps/web] … 0 Befunde (Baseline 0), 2292 Dateien` — **✓ Keine Lint-Regression** |
| `node scripts/check-gate-inputs.mjs`         | **✓ 9 Tor-Eingaben vorhanden**                                                    |
| `node scripts/audit-secrets.mjs`             | **4.439 Dateien, 0 Findings**                                                     |

Die Ratsche misst mit `cwd: apps/web` gegen **genau die geänderte
Konfiguration** — die 0 ist also die Zahl **mit** den sechs eingeschalteten
Regeln, nicht ohne sie.

---

## 10. Was OP-080 danach noch ist

Der Punkt ist **zu drei Vierteln abgetragen**: 76 gemessene Fundstellen, 54
behoben, 22 übrig — und die 22 verteilen sich auf genau zwei Regeln mit je
eigener, gemessener Begründung (§6).

Wer den Rest angeht:

- **`set-state-in-effect`, Gestalt A (9 Fundstellen, 6 Dateien)** ist die
  Umstellung auf `@tanstack/react-query`, die WP12 gemeint hat. Sie ist der
  einzige Teil, für den diese Auflösung stimmt, und sie ist klein genug für
  eine eigene Welle. Die Abschnittsführung aus §8.1 übernehmen und den
  `web`-Lauf **zweimal** fahren — einmal vor, einmal nach.
- **Gestalt B, C und D (11 Fundstellen)** brauchen je eine andere Antwort
  (abgeleiteter Zustand beim Rendern, `useSyncExternalStore`, ein Schlüssel
  statt eines Effekts). Sie unter derselben Nummer mitzuschleifen wäre die
  Wiederholung des Fehlers, den §2 an WP12 zeigt.
- **`incompatible-library`** ist keine Aufgabe, sondern eine Eigenschaft von
  `@tanstack/react-table`. Wenn sie stört, ist die Frage der Bibliothekswechsel
  — und dann gehört sie in einen ADR, nicht in eine Lint-Konfiguration.
