# Welle 7b — OP-080: `set-state-in-effect` ist an, und die Gestalt-Aufteilung stimmte auch nicht

**Datum:** 2026-09-08 · **Branch:** `audit/full-2026-08-31` · **Basis:** `42aba1a7`
**Betroffen:** `apps/web/eslint.config.mjs` · 14 Dateien unter `apps/web/src/**`
(ohne `src/app/api/**`) · eine neue Datei `src/hooks/use-hydrated.ts` · ein neuer
Test unter `apps/web/src/__tests__/hooks/`

---

## 1. Kurzfassung

| Frage                                                          | vor 7b |          nach 7b |
| -------------------------------------------------------------- | -----: | ---------------: |
| Fundstellen `react-hooks/set-state-in-effect`, selbst gemessen | **20** |            **0** |
| Abgeschaltete Hook-Regeln in `apps/web/eslint.config.mjs`      |  **2** |            **1** |
| `eslint-disable` an einer Fundstelle                           |      0 |            **0** |
| Produktdefekte, die das Einschalten freigelegt hat             |      — |            **4** |
| Prüfungen, die zunächst NICHT fallen konnten                   |      — |            **3** |
| Lint-Ratsche `apps/web`                                        |      0 |            **0** |
| `web`-E2E-Projekt                                              |      — | **135/135 grün** |

**Die Gestalt-Aufteilung aus Welle 7a war näher an der Wahrheit als die
Registerbegründung — aber immer noch nicht die Wahrheit.** 7a hat richtig
erkannt, dass „alle sind Abruf beim Einhängen" nur für 9 von 20 gilt. Die
übrigen elf hat sie in drei Gestalten sortiert (B 4 / C 5 / D 2). Fundstelle für
Fundstelle nachgesehen sind es **sieben** Gestalten, und die Gestalt C
(„Browserspeicher") war um **drei** Fundstellen zu groß gefasst (§3).

Das ist die Fortsetzung des Musters dieses Audits, eine Ebene tiefer: nicht mehr
die Zahl war falsch, sondern die **Einordnung** — und die Einordnung ist es, die
über die richtige Behebung entscheidet.

---

## 2. Erst selbst messen

Gemessen am 2026-09-08 mit derselben Konfiguration, die auch die Ratsche misst
(`cwd: apps/web`), die Regel einzeln auf `error` gehoben:

```
$ cd apps/web
$ npx eslint . --no-error-on-unmatched-pattern -f json \
    --rule '{"react-hooks/set-state-in-effect":"error"}'
Dateien gelintet: 2292
```

```
src/app/(dashboard)/bcms/bia/[id]/processes/page.tsx:73:16
src/app/(dashboard)/catalogs/objects/page.tsx:85:10
src/app/(dashboard)/dashboard/page.tsx:305:5
src/app/(dashboard)/dashboard/page.tsx:353:5
src/app/(dashboard)/dashboard/page.tsx:359:5
src/app/(dashboard)/dashboard/page.tsx:388:7
src/app/(dashboard)/organizations/page.tsx:113:9
src/app/(dashboard)/processes/[id]/ropa/page.tsx:95:20
src/app/(dashboard)/settings/notifications/scheduled/page.tsx:120:15
src/app/(dashboard)/tasks/page.tsx:162:15
src/components/bpmn/bpmn-toolbar.tsx:84:7
src/components/documents/entity-documents-panel.tsx:86:5
src/components/documents/entity-documents-panel.tsx:109:25
src/components/layout/modern-sidebar.tsx:70:7
src/components/layout/theme-switcher.tsx:22:19
src/hooks/use-layout-preference.tsx:16:16
src/hooks/use-nav-preferences.tsx:116:21
src/hooks/use-nav-preferences.tsx:184:7
src/hooks/use-tab-navigation.tsx:133:5
src/hooks/use-tab-navigation.tsx:158:7
SUMME 20
```

**20 Fundstellen in 15 Dateien — die Zahl aus Welle 7a ist bestätigt.** Die
Dateiliste ebenfalls, Zeile für Zeile.

---

## 3. Die Gestalten — was die Nachschau geändert hat

Welle 7a führte vier Gestalten. Nach Einzelbetrachtung sind es sieben; drei der
fünf Fundstellen, die 7a als „Browserspeicher beim Einhängen lesen" führte, lesen
gar keinen Browserspeicher.

| Gestalt                                    |  7a | **7b** | Auflösung               |
| ------------------------------------------ | --: | -----: | ----------------------- |
| **A** Abruf beim Einhängen                 |   9 |  **9** | `@tanstack/react-query` |
| **B** Formular beim Öffnen zurücksetzen    |   4 |  **4** | Einhängen statt Effekt  |
| **C** Browserspeicher beim Einhängen lesen |   5 |  **2** | `useSyncExternalStore`  |
| **C′** gespiegelter Serverzustand          |   — |  **2** | beim Rendern ableiten   |
| **D** Wachtposten gegen Serverabweichung   |   2 |  **1** | `useSyncExternalStore`  |
| **D′** Übergang einer Eigenschaft          |   — |  **1** | Anpassung beim Rendern  |
| **E** abgeleiteter Anzeigezustand          |   — |  **1** | beim Rendern ableiten   |

**Was 7a falsch einsortiert hat, und warum es zählt:**

- `use-nav-preferences.tsx:116` und `:184` standen unter C. Die Datei liest
  **keinen** Browserspeicher — sie holt die Einstellungen über `useQuery` vom
  Server und spiegelt das Ergebnis in ein eigenes Zustandsfeld. Das ist genau die
  Klasse, die Welle 7a bei `org-switcher` selbst beschrieben hat (7a §4.5).
  `useSyncExternalStore`, die für C vorgesehene Auflösung, wäre hier **falsch**;
  die richtige ist, den Zwischenspeicher der Abfrage zur einzigen Quelle zu
  machen. Und in dieser Fundstelle steckte der schwerste Produktdefekt der Welle
  (§4.1).
- `use-tab-navigation.tsx:158` stand unter C. Dort wird `activeTab` aus
  `pathname` und `tabs` nachgezogen — abgeleiteter Anzeigezustand, kein Speicher.
- `theme-switcher.tsx` und `bpmn-toolbar.tsx` standen beide unter D. Sie haben
  nichts gemein außer „ist keins der anderen": der eine ist ein
  Anhydrier-Wachtposten (`useSyncExternalStore`), der andere die Erkennung eines
  Eigenschaftsübergangs (Anpassung beim Rendern).

Die Aufteilung ist keine Buchhaltung. **Hätte man C mit fünf Fundstellen
geschlossen auf `useSyncExternalStore` umgestellt, wären zwei davon falsch
behoben** — und der Defekt in §4.1 wäre dabei stehen geblieben.

---

## 4. Die Produktdefekte

Vier Befunde, jeder mit dem Beleg, an dem er gemessen wurde.

### 4.1 Die Navigationsgruppe der aufgerufenen Seite fiel wieder zu

`src/hooks/use-nav-preferences.tsx` — Gestalt C′

Zwei Setzer stritten um dasselbe Feld:

- `components/layout/sidebar.tsx:272` ruft `setActiveGroup(<Gruppe des Pfads>)`
  während des **ersten Renderns** — also lange bevor
  `/api/v1/users/me/nav-preferences` geantwortet hat.
- Der Effekt in `use-nav-preferences.tsx:179` setzte `expandedGroups` auf den
  **gespeicherten** Stand, sobald die Einstellungen eintrafen.

Der Effekt lief später und gewann. Wer `/risks` aufrief, sah die ERM-Gruppe
aufgehen und einen Augenblick später wieder zuklappen — während statt dessen die
Gruppe aufging, die er das letzte Mal offen hatte.

**Beleg**, die Spur beider Stände in derselben Prüfumgebung (jsdom, gespeichert
`collapsedGroups: ["isms"]`, Pfad `/risks` → Gruppe `erm`):

```
ALT:
  render loading=true  collapsedGroups=[]       erm=zu     isms=zu
  render loading=true  collapsedGroups=[]       erm=offen  isms=zu
  render loading=false collapsedGroups=[]       erm=offen  isms=zu
  render loading=false collapsedGroups=["isms"] erm=offen  isms=zu
  render loading=false collapsedGroups=["isms"] erm=zu     isms=offen   ← der Defekt

NEU (Endstand):                                 erm=offen  isms=zu
```

**Behoben, nicht umgeschichtet.** Der Wettlauf wird nicht durch eine andere
Reihenfolge aufgelöst, sondern dadurch, dass es nur noch **einen** Stand gibt:
der gespeicherte Stand ist die **Saat** (`new Set(prefs.collapsedGroups)`), was
in dieser Sitzung auf- oder zugeklappt wurde, liegt als **Auflage** darüber
(`expandedOverride`). Eine Auflage kann die Saat nicht mehr verlieren, und die
Saat kann die Auflage nicht mehr überschreiben.

Dieselbe Behebung trägt beide Fundstellen der Datei ab: `serverPrefs` wird nicht
mehr in `localPrefs` gespiegelt, sondern der Zwischenspeicher der Abfrage ist die
Quelle; `persist` schreibt ihn **sofort** fort (vorher erst nach der Antwort des
Servers) und schickt danach den PUT hinterher.

### 4.2 Ein unbekannter Wert im Browserspeicher wurde zum Layoutnamen

`src/hooks/use-layout-preference.tsx:15` — Gestalt C

```js
const saved = localStorage.getItem("arctos-layout") as LayoutMode | null;
if (saved) setLayout(saved);
```

`as LayoutMode` war eine **Behauptung**. Stand dort etwas anderes als `classic`
oder `modern` — eine ältere Fassung, ein fremdes Skript, eine halb geschriebene
Zeichenkette —, wurde genau das zum Layoutnamen, und **keine** der beiden
Ansichten traf zu.

**Beleg** (`wave7b-set-state-in-effect.test.tsx`, Prüfung 2): `arctos-layout` auf
`"compact"` gesetzt, dann den Anbieter aufbauen.

```
Gegen den alten Stand von use-layout-preference.tsx:
  ×  ein unbekannter Wert im Speicher wird NICHT zum Layoutnamen
     Tests  2 failed | 3 passed (5)
Gegen den neuen Stand:  5 passed
```

### 4.3 Ein gesperrter Browserspeicher legte den Anbieter lahm

`src/hooks/use-layout-preference.tsx:15` — dieselbe Zeile

Der Zugriff auf `localStorage` **wirft**, wenn der Speicher gesperrt ist (Safari
im privaten Modus, blockierter Speicher von Drittanbietern). Er lag ungeschützt
in einem Effekt; die Ausnahme riss den Anbieter und mit ihm den ganzen Teilbaum
mit.

Bemerkenswert daran: `use-tab-navigation.tsx` hatte für **denselben** Zugriff
schon seit jeher ein `try/catch` (`loadSessionTabs`, `loadPinnedIds`). Die
Vorsicht war im Haus, nur nicht an dieser Stelle.

**Beleg** (Prüfung 3): `Storage.prototype.getItem` wirft `SecurityError` — alter
Stand rot, neuer Stand grün (Ausgabe siehe §4.2, beide Prüfungen fallen
gemeinsam).

### 4.4 Die Dokumentensuche zeigte die Treffer der vorletzten Eingabe

`src/components/documents/entity-documents-panel.tsx:89–110` — Gestalt A

`loadAvailableDocs` schrieb sein Ergebnis mit `setAvailableDocs` ungeprüft in
denselben Zustand — ohne Wachtposten gegen das Aushängen und ohne jede Ordnung
zwischen zwei laufenden Anfragen. Kommen die Antworten in der falschen
Reihenfolge zurück (im Netz der Regelfall bei schnellem Tippen), **gewinnt die
zuletzt eintreffende**, nicht die jüngste. Der Nutzer sah die Treffer zu `A`,
während `AB` in der Suchzeile stand.

**Beleg** (Prüfung 4): zwei Tastenfolgen, Antworten absichtlich in umgekehrter
Reihenfolge freigegeben.

```
Gegen den alten Stand von entity-documents-panel.tsx:
  ×  eine spaet eintreffende alte Antwort ueberschreibt die neue nicht
     AssertionError: expected null to be truthy
     Tests  1 failed | 4 passed (5)
Gegen den neuen Stand:  5 passed
```

`@tanstack/react-query` löst das nicht nebenbei, sondern strukturell: der
Suchbegriff ist Teil des Abfrageschlüssels, also hat jede Anfrage ihren eigenen
Platz und die Ansicht liest immer den zum aktuellen Schlüssel.

---

## 5. Was je Gestalt geschehen ist

### 5.1 Gestalt A — Abruf beim Einhängen (9 Fundstellen, 6 Dateien)

Die einzige Gestalt, für die die alte Registerbegründung zutrifft. Umgestellt auf
`@tanstack/react-query`; Ladezustand, Fehlerzustand und Abbruch kommen jetzt aus
der Bibliothek statt aus gespiegelten Zustandsfeldern und eigenhändigen
`cancelled`-Wachtposten.

| Datei                        | Fundst. | Besonderheit                                                     |
| ---------------------------- | ------: | ---------------------------------------------------------------- |
| `dashboard/page.tsx`         |       4 | vier Abrufe × drei Zustandsfelder; `enabled: ermEnabled`         |
| `entity-documents-panel.tsx` |       2 | zweiter Abruf `enabled: linkDialogOpen`; §4.4                    |
| `bcms/bia/[id]/processes`    |       1 | Inline-Editor: Serverstand + Auflage statt eines Feldes          |
| `catalogs/objects`           |       1 | erst nach 7a sichtbar (7a §5.1)                                  |
| `processes/[id]/ropa`        |       1 | Formular als eigenes Bauteil, mit dem geladenen Stand eingehängt |

**Zwei Stellen brauchten mehr als eine Umschreibung**, weil der Serverstand dort
nicht der Anzeigestand ist:

- `bcms/bia/[id]/processes` ist ein **Inline-Editor**. Vorher waren Serverstand
  und Eingaben dasselbe Zustandsfeld, weshalb ein erneuter Abruf offene Eingaben
  stillschweigend überschrieben hätte. Jetzt liegt eine Auflage je Zeile über dem
  Serverstand; nach erfolgreichem Speichern fällt die Auflage der Zeile weg und
  es wird neu abgerufen.
- `processes/[id]/ropa` ist ein **Formular, dessen Saat der Server setzt** — die
  Route setzt `requiresDpia` selbst. Das Formular ist deshalb in ein eigenes
  Bauteil gewandert, das mit dem geladenen Stand **eingehängt** wird; der
  Schlüssel wird nur nach erfolgreichem Speichern erhöht, nicht bei jedem Abruf,
  sonst risse ein Hintergrundabruf dem Nutzer das Formular unter den Händen weg.

### 5.2 Gestalt B — Formular beim Öffnen zurücksetzen (4 Fundstellen)

`organizations`, `tasks`, `settings/notifications/scheduled`,
`layout/modern-sidebar`.

Kein Abruf — `@tanstack/react-query` wäre hier keine Antwort, sondern eine
Verschlechterung. Die Antwort, die React selbst gibt, ist das **Einhängen**:
`DialogContent` liegt hinter Radix' `DialogPortal` ohne `forceMount`, seine
Kinder sind also nur eingehängt, solange der Dialog offen ist. Der Formularzustand
ist deshalb in ein Bauteil **unterhalb** von `DialogContent` gewandert und
entsteht bei jedem Öffnen neu. Für `organizations` hält ein `key` das auch dann
durch, wenn zwischen zwei Öffnungen eine andere Organisation gewählt wurde.

`modern-sidebar` war der Sonderfall: die Sucheinblendung war **dauerhaft**
eingehängt und gab nur `null` zurück, solange sie zu war — deshalb überlebte der
Suchtext das Schließen überhaupt und musste eigens gelöscht werden. Die
Aufrufstelle hängt sie jetzt nur ein, solange sie offen ist; die
`open`-Eigenschaft entfällt mitsamt dem `if (!open) return null`, und die Zuhörer
von `useModalDialog` (Escape, Tabfalle, `aria-hidden` der übrigen Seite) laufen
nur noch, solange die Einblendung wirklich sichtbar ist.

**Ehrlich dazu: Gestalt B hat KEINEN sichtbaren Defekt hergegeben.** Siehe §6.2 —
zwei Messgeräte haben das gezeigt, und es steht in der Prüfdatei statt einer
Prüfung, die das Gegenteil behaupten würde.

### 5.3 Gestalt C — Browserspeicher beim Einhängen (2 Fundstellen)

`use-layout-preference.tsx:16` und `use-tab-navigation.tsx:133`. Beide auf
`useSyncExternalStore` mit eigener Server-Momentaufnahme umgestellt. React nimmt
beim Anhydrieren die Server-Momentaufnahme und wechselt unmittelbar danach auf
die des Browsers — dieselbe Abfolge wie beim alten Effekt, aber ohne Zustandsfeld
und ohne Abweichung beim Anhydrieren.

`use-tab-navigation.tsx` ist dabei am weitesten gegangen: **die Reiter leben nur
noch im Sitzungsspeicher.** Es gibt keinen gespiegelten React-Zustand mehr, kein
`initialized`-Merkerfeld und keinen Persistenz-Effekt. Das ist nicht Kosmetik —
es nimmt **OP-211 die Ursache statt nur die Wirkung**: Kindeffekte laufen vor
denen des Elternteils, und ein `setTabs(...)` des Elternteils konnte die soeben
angemeldete Anmeldung eines Kindes wegwerfen. Ein Kind, das jetzt anmeldet,
schreibt in denselben Speicher, aus dem der Anbieter liest; es gibt nichts mehr,
was es überholen könnte.

Die Falle der 7a-Behebung ist mitgenommen: bei unveränderten Werten wird **nicht**
geschrieben — sonst schriebe jeder Aufruf in den Speicher, benachrichtigte die
Zuhörer, löste ein neues Rendern aus und damit den anmeldenden Effekt erneut. Die
Prüfung aus Welle 7a, die genau das an der Zahl der Schreibvorgänge misst, ist
grün geblieben (§6.3).

### 5.4 Gestalt C′ — gespiegelter Serverzustand (2 Fundstellen)

`use-nav-preferences.tsx`, beide Fundstellen. Siehe §4.1.

### 5.5 Gestalt D — Wachtposten gegen Serverabweichung (1 Fundstelle)

`theme-switcher.tsx:22`. Das Muster

```js
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return null;
```

ist `set-state-in-effect` in Reinform. Es ist in `hooks/use-hydrated.ts` (neu)
als `useIsHydrated()` gefasst — `useSyncExternalStore` mit einem Abonnement, das
nie benachrichtigt, weil der Wert sich nach dem Anhydrieren nicht mehr ändern
kann.

### 5.6 Gestalt D′ — Übergang einer Eigenschaft (1 Fundstelle)

`bpmn-toolbar.tsx:84`. Der Effekt erkannte den Übergang `saving` wahr → falsch
und rief `setShowSaved(true)` synchron im Effektrumpf. Die Anpassung gehört ins
**Rendern**: React merkt die Zustandsänderung während des Renderns, verwirft die
begonnene Ausgabe und rendert unmittelbar erneut — ohne den Bildschirm dazwischen
anzufassen und ohne eine zweite Festschreibung.

**Nachgemessen, dass die Regel diese Form akzeptiert und die alte meldet**
(Sondierungsdatei, danach gelöscht):

```
Anpassung beim Rendern + Zeitgeber im Effekt   → keine Meldung
setShowSaved(true) im Effektrumpf              → react-hooks/set-state-in-effect
```

Der alte Rumpf hatte zudem eine stille Eigenheit: `setPrevSaving` stand **nur**
im „else"-Zweig, also blieb `prevSaving` nach dem ersten Speichern für immer wahr.
Sichtbar wurde das nicht — die Bedingung ergab zufällig weiter das Richtige —,
aber der Merker log über seinen eigenen Namen. **Das ist ausdrücklich KEIN
Produktdefekt**, und es steht hier, damit die nächste Runde es nicht für einen
hält.

### 5.7 Gestalt E — abgeleiteter Anzeigezustand (1 Fundstelle)

`use-tab-navigation.tsx:158`. `activeTab` war nie eine eigene Tatsache: der Effekt
setzte genau die Kennung des Reiters, dessen Ziel dem Pfad entspricht, sonst
`null`. Jetzt beim Rendern abgeleitet — was nebenbei den Renderdurchlauf spart,
in dem die Leiste noch den vorigen Reiter hervorhob.

---

## 6. Die Prüfungen — und drei, die zunächst nicht fallen konnten

`apps/web/src/__tests__/hooks/wave7b-set-state-in-effect.test.tsx`, vier
Prüfungen. Jede wurde gegen den alten Stand genau der Datei gefahren, die sie
meint (`git show HEAD:<datei> > <datei>`, danach aus einer Sicherung
zurückgestellt — **kein `git stash` bei laufendem Playwright**, siehe 7a §8.3):

```
$ git show HEAD:apps/web/src/hooks/use-layout-preference.tsx > …
  ×  ein unbekannter Wert im Speicher wird NICHT zum Layoutnamen
  ×  ein gesperrter Browserspeicher legt den Anbieter nicht lahm
     Tests  2 failed | 3 passed (5)

$ git show HEAD:apps/web/src/components/documents/entity-documents-panel.tsx > …
  ×  eine spaet eintreffende alte Antwort ueberschreibt die neue nicht
     Tests  1 failed | 4 passed (5)

$ git show HEAD:apps/web/src/hooks/use-nav-preferences.tsx > …
  ×  die Gruppe des Pfads bleibt offen, wenn der Server eine ANDERE gespeichert hat
     Tests  1 failed | 4 passed (5)

Neuer Stand:  Tests  4 passed (4)   (+ Welle 7a: 6 passed)
```

**Der wichtigste Teil dieses Abschnitts sind die drei Anläufe, die grün waren,
obwohl sie es nicht sein durften.** Sechzehn blinde Tore hat dieses Audit
gefunden; hier sind drei weitere, und alle drei in den eigenen Prüfungen.

### 6.1 Prüfung 1 las eine Festschreibung zu früh

Die erste Fassung wartete auf `loading === false` und war damit **grün gegen den
alten Stand**. Die Spur in §4.1 zeigt warum: `loading` wird frei, **bevor** die
gespiegelten Einstellungen überhaupt im Anbieter angekommen sind — zwei
Festschreibungen vor dem Defekt.

Gewartet wird jetzt darauf, dass der gespeicherte Stand **wirklich** da ist
(`prefs.collapsedGroups === ["isms"]`), und danach wird die Warteschlange
geleert. Erst dann steht fest, was der Nutzer zu sehen bekommt.

**Ohne diesen zweiten Blick wäre der Defekt aus §4.1 als „nicht vorhanden"
gebucht worden** — er ist der schwerste der Welle.

### 6.2 Zwei Messgeräte für Gestalt B, die beide nichts gesehen haben

Für die vier Fundstellen der Gestalt B steht **keine** Prüfung in der Datei. Zwei
Anläufe haben gemessen, dass es dort nichts zu widerlegen gibt:

| Anlauf                                                   | Ergebnis     | Warum blind                                                                                            |
| -------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------ |
| Zeuge mit `useLayoutEffect` als Geschwister der Seite    | `seen=[]`    | rendert nur mit, wenn sein eigener Elternteil rendert — der `open`-Zustand liegt IN der Seite          |
| Aufzeichner am Setzer `HTMLInputElement.prototype.value` | `written=[]` | React legt für ein gesteuertes Feld einen eigenen Setzer auf dem ELEMENT an, der den Prototyp verdeckt |

Beide zusammen zeigen: der Rückstelleffekt des alten Standes lief, **bevor** Radix
den Dialoginhalt einhängte — `DialogContent` erscheint eine Festschreibung später
als die Eigenschaft `open`. Der veraltete Entwurf wurde also nie festgeschrieben.

**Die Umstellung der Gestalt B ist damit eine reine Strukturänderung.** Sie trägt
die Fundstellen ab und nimmt der Klasse die Grundlage, aber sie behebt keinen
sichtbaren Defekt — und genau das steht in der Prüfdatei, statt einer Prüfung,
die das Gegenteil behaupten würde. Ihre Absicherung ist §8.3.

### 6.3 Die Prüfungen aus Welle 7a sind der Regressionsschutz

`use-tab-navigation.tsx` ist vollständig neu geschrieben. Die sechs Prüfungen aus
`wave7a-hook-deps.test.tsx` — OP-210 (Reiter wird aktualisiert), OP-211 (die
Anmeldung der Seite überlebt), die Schleifenfalle, der Sprachwechsel — sind
**unverändert grün geblieben**. Sie messen Verhalten, nicht Aufbau, und haben die
Umstellung deshalb überstanden, ohne angefasst zu werden. Das ist der Nachweis,
dass die neue Bauart dieselben Zusagen hält.

```
$ npx vitest run src/__tests__/hooks/wave7b-… src/__tests__/hooks/wave7a-…
  Test Files  2 passed (2)
       Tests  10 passed (10)
```

---

## 7. Ein Befund über die Aufrufstelle, der NICHT behoben ist

`components/layout/sidebar.tsx:272` ruft `setActiveGroup(...)` aus einem
`useMemo` — also **während des Renderns der Seitenleiste**, in einen Zustand des
Anbieters darüber. React nennt das „Cannot update a component while rendering a
different component".

Es ist **nicht** behoben, und der Grund gehört benannt: der offensichtliche Weg —
den Aufruf in einen `useEffect` zu verlegen — würde eine **neue** Fundstelle
dieser Regel erzeugen. Die richtige Auflösung ist, dass der Anbieter die Gruppe
des Pfads selbst kennt, statt sie sich von einem Kind melden zu lassen; dafür
müsste die Zuordnung Pfad → Gruppe aus `sidebar.tsx` heraus. Das ist eine
Umstellung an einer Datei, die diese Welle sonst nicht anfasst, und sie hat mit
`set-state-in-effect` nichts zu tun.

Der Defekt, den dieser Aufruf **verursacht hat**, ist behoben (§4.1) — die
Auflage-über-Saat-Bauart ist gegen die Reihenfolge unempfindlich. Was bleibt, ist
die Warnung selbst.

---

## 8. Verifikation der Verhaltensänderungen — der E2E-Lauf

### 8.1 Aufbau

Datenbank `grc_e2e6c` aus Welle 6c, `apps/web/.env.local` zeigt bereits dorthin.
Die vier E2E-Konten neu bereitgestellt
(`E2E_ROLE_PASSWORD=… npm run db:seed:e2e-users`). Chromium aus
`/opt/pw-browsers`, **kein** `playwright install`. Wurzelkonfiguration, Projekt
`web`, `workers: 1`.

Gefahren **in Abschnitten** mit frisch gestartetem Entwicklungsserver und
gelöschtem `.next` dazwischen — die Abschnittsführung aus `UMSETZUNG-WELLE-6C.md`
§9. Ihre Begründung ist erneut gemessen: `next-server` wächst auf **5,2 GB** RSS,
danach **Lastmittel 34** bei 1 GB freiem Speicher; in diesem Zustand laufen Tests
in ihr Limit, ohne dass am Produkt etwas fehlt.

**Ein Fallstrick, damit die nächste Runde ihn nicht wiederholt.** `pkill -f
playwright` aus einer Shell, deren eigene Kommandozeile das Wort enthält, bringt
die Shell um sich selbst (gemessen: Rückgabe 144, Sitzung weg). Das Aufräumen
gehört in eine **Skriptdatei**, deren Kommandozeile das Suchmuster nicht enthält.

### 8.2 `web`-Projekt — 135 von 135 grün

| Abschnitt                                                                                        |   Tests |    grün |
| ------------------------------------------------------------------------------------------------ | ------: | ------: |
| a11y-smoke, ci-smoke, navigation                                                                 |      13 |      13 |
| platform-smoke                                                                                   |      40 |      40 |
| catalogs, catalog-activation, budget, reports                                                    |      13 |      13 |
| bpmn-canvas, bpm-\*, process-map/-portal, audit, api-auth, management-review, document-signature |      14 |    14\* |
| isms-workflow                                                                                    |      15 |      15 |
| ai-act-workflow                                                                                  |      13 |      13 |
| cross-module-workflows (zwei Hälften)                                                            |      27 |      27 |
| **Summe**                                                                                        | **135** | **135** |

Dazu je Abschnitt vier Anmeldungen im `setup`-Projekt, alle grün. Kein
`test.skip`.

\* `process-portal` fiel im Abschnittslauf mit `0ms` aus (Server bei 5,2 GB,
Lastmittel 25). Nach Neustart mit gelöschtem `.next` isoliert wiederholt:
**5 passed (1.6m)**. Dieselbe Klasse wie die sechs aus Welle 6c §9 und die fünf
aus Welle 7a §8.2.

**Was der Lauf für diese Welle belegt.** Er deckt die berührten Oberflächen ab:
`/dashboard` (ci-smoke „dashboard loads after login", a11y-smoke, platform-smoke
„dashboard has no console errors" — der direkte Wachtposten für die vier
react-query-Umstellungen), die Reiterleiste (isms-workflow „horizontal tab
navigation works", cross-module „horizontal tab navigation renders on module
pages"), die Seitenleiste (navigation ×5, cross-module „sidebar shows condensed
navigation"), den Themenwähler (platform-smoke „theme can be switched via user
menu"), die BPMN-Werkzeugleiste in **beiden** Engines (bpmn-canvas-modeling), den
ROPA-Weg (bpm-ropa-flow) und `/organizations` (platform-smoke).

### 8.3 Die sechs Seiten OHNE E2E-Spezifikation — eigens gemessen

`/tasks`, `/settings/notifications/scheduled`, `/catalogs/objects`,
`/bcms/bia/[id]/processes`, `/processes/[id]/ropa` und der Bearbeiten-Dialog auf
`/organizations` haben **keine** Spezifikation im Bestand. Der Lauf oben belegt
für sie nichts, und das als „abgedeckt" zu buchen wäre eine Erfindung.

Sie sind deshalb mit einem eigenen Playwright-Skript gegen denselben Server
gemessen — außerhalb von `apps/web/e2e`, an dem ein anderer Strang arbeitet:

```
✓ /catalogs/objects: HTTP 200 / Inhalt statt Dauerladekreis (436 Zeichen) / keine Konsolenfehler
✓ /tasks: Dialog öffnet / frisches Formular leer / schliesst / nach Wiederöffnen leer / keine Konsolenfehler
✓ /settings/notifications/scheduled: HTTP 200 / Inhalt (326 Zeichen) / keine Konsolenfehler
✓ /organizations: 3 Bearbeiten-Knöpfe / Formular aus der Zeile gesät ("E2E-F02-193980")
                  / nach Wiederöffnen wieder der Stand der Zeile / keine Konsolenfehler
✓ /bcms/bia/[id]/processes: HTTP 200 / kein Dauerladekreis / keine Konsolenfehler
✓ /processes/[id]/ropa: HTTP 200 / Formular statt Dauerladekreis / keine Konsolenfehler

23/23 Prüfungen grün
```

**Drei Fehlschläge des ersten Anlaufs, und was sie wirklich waren** — notiert,
weil zwei davon wie Regressionen dieser Welle aussahen:

- `/catalogs/objects` und `/processes/[id]/ropa` lieferten 91 bzw. 119 Zeichen.
  Das war der Entwicklungsserver **beim Übersetzen der Route**, nicht ein
  Dauerladekreis: mit 20 s Wartezeit statt 3,5 s stehen 436 bzw. 331 Zeichen mit
  dem vollständigen Inhalt da.
- `/tasks` meldete `[ModuleConfig] fetch error: Failed to fetch`. Das war eine
  **abgebrochene Anfrage der vorigen Navigation**, die nach dem Zurücksetzen des
  Zählers eintrudelte; mit derselben längeren Wartezeit verschwindet sie.
- `#org-name` erschien nicht. Ursache ist **nicht** diese Welle: der Knopf
  „Organisation erstellen" ist ein `Link` nach `/organizations/new` und öffnet
  den Dialog gar nicht — `_openCreate` ist ungenutzter Bestand. Der Dialog ist nur
  über „Bearbeiten" in einer Zeile erreichbar, und das ist auch der einzige Weg,
  bei dem das Formular aus `editingOrg` gesät wird.

---

## 9. Abnahme

| Tor                                           | Ergebnis                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p apps/web/tsconfig.json`  | **exit 0**, keine Ausgabe                                                         |
| `npm test` (apps/web)                         | **133 Dateien, 2.957 Tests grün** + 4 Dateien / 24 Tests DB                       |
| `npm run test:rls` (apps/web)                 | **4 Dateien, 24 Tests grün**                                                      |
| Playwright `web`-Projekt                      | **135/135 grün** (§8.2)                                                           |
| Eigene Messung der 6 ungedeckten Seiten       | **23/23 grün** (§8.3)                                                             |
| `npx prettier --check .`                      | **All matched files use Prettier code style!**                                    |
| `node scripts/lint-ratchet.mjs`               | `[apps/web] … 0 Befunde (Baseline 0), 2294 Dateien` — **✓ Keine Lint-Regression** |
| `node scripts/check-gate-inputs.mjs`          | **✓ 9 Tor-Eingaben vorhanden**                                                    |
| `node scripts/audit-dead-exports.mjs --check` | **2.469 in 459 (Baseline 2.469 in 459) — ✓ keine Regression**                     |
| `node scripts/audit-secrets.mjs`              | **4.442 Dateien, 0 Findings**                                                     |

Die Ratsche misst mit `cwd: apps/web` gegen **genau die geänderte
Konfiguration** — die 0 ist also die Zahl **mit** eingeschalteter Regel.

---

## 10. Was von OP-080 übrig ist

| Regel                                     | notiert (WP12) | gemessen | heute  |
| ----------------------------------------- | -------------: | -------: | ------ |
| `react-hooks/exhaustive-deps`             |             23 |       37 | **AN** |
| `react-hooks/set-state-in-effect`         |             19 |       20 | **AN** |
| `react-hooks/purity`                      |              8 |        8 | **AN** |
| `react-hooks/static-components`           |              3 |        3 | **AN** |
| `react-hooks/immutability`                |              2 |        3 | **AN** |
| `react-hooks/preserve-manual-memoization` |              1 |        1 | **AN** |
| `react-hooks/refs`                        |              1 |        2 | **AN** |
| `react-hooks/incompatible-library`        |              2 |        2 | aus    |
| **Summe**                                 |         **59** |   **76** | **2**  |

**Sieben von acht Regeln sind an; 74 von 76 gemessenen Fundstellen sind
abgetragen, ohne ein einziges `eslint-disable`.**

Übrig bleibt `react-hooks/incompatible-library` mit 2 Fundstellen
(`audit-log/page.tsx:1321`, `components/ui/data-table.tsx:68`, beide
`useReactTable`). Ihre Begründung ist unverändert und lautet **nicht** „noch nicht
getan", sondern **„von hier aus nicht behebbar"**: es ist eine Mitteilung
(`Compilation Skipped`) über eine fremde Bibliothek, und die einzige Behebung
wäre der Verzicht auf `@tanstack/react-table`. Das entscheidet kein Lint-Eintrag,
sondern ein ADR.

**Was ausserdem offen bleibt, mit Grund:**

- Der `setActiveGroup`-Aufruf beim Rendern in `sidebar.tsx` (§7). Kein
  `set-state-in-effect`, aber eine echte React-Warnung; die Behebung gehört in
  eine Welle, die `sidebar.tsx` zum Gegenstand hat.
- Für Gestalt B gibt es keine Einheitsprüfung, weil es nichts zu widerlegen gab
  (§6.2). Ihr Schutz ist der E2E-Lauf und die Messung in §8.3.
