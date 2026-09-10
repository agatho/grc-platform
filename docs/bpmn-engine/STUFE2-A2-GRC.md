# Stufe 2 / Arbeitsstrang A2 — Die GRC-Diagrammschicht

**Paket:** `packages/bpmn/src/grc/**`, `packages/bpmn/test/grc/**`
**Grundlage:** ARCTOS_BPMN_ENGINE_PLAN.md §3 (vollständig), §4.2–§4.4; BESTANDSAUFNAHME.md Aufgabe 2
**Stand:** alle Tests grün (143 eigene Tests), `tsc --noEmit` mit den strengen Flags fehlerfrei,
axe-core über fünf Sicht/Diagramm-Kombinationen ohne Verstoß.

---

## 0. Was diese Schicht ist — und was sie ausdrücklich nicht ist

Sie bringt GRC-Information auf die Diagrammfläche: sie bekommt einen **typisierten
Datensatz** (`GrcOverlayData`, die Nutzlast des in §3.3.6 geplanten Overlay-Endpunkts),
rechnet daraus ein **Überlagerungsmodell**, zeichnet dieses ins SVG und meldet
Interaktionen nach oben.

Sie hat **keinen Datenbankzugriff**, kennt weder Drizzle noch `fetch`, kein React und
keine Route. Sie läuft deshalb unverändert im Browser, in jsdom und im Worker
(serverseitiger PDF-/PNG-Export). Das ist keine Zierde: Ein exportiertes Auditdiagramm,
das die GRC-Marker _nicht_ enthält, ist der heutige Zustand (`saveSVG()` liefert das
Diagramm ohne die HTML-Overlays) und einer der Mängel, die dieser Strang behebt (§4.5).

```
contract.ts        Was die Anwendung liefert, was zurückkommt   (der Vertrag)
      ↓
analysis / sod / trust / outage / graph    reine Rechenkerne, kein DOM
      ↓
slots + layers + catalog + views           Signale, Budget, Konflikte, Sichten
      ↓
engine.ts  →  decorate.ts | text-alternative.ts | announce.ts
              (SVG)        (Tabelle)              (Live-Region)
```

Die drei Ausgabewege benutzen **dasselbe** Modell. Eine Ampel, die man sieht, aber nicht
hört, kann in dieser Anordnung nicht entstehen — das ist der strukturelle Kern der
Barrierefreiheit hier, kein nachträglicher Anbau.

---

## 1. Umgesetzte Funktionen

### Aus §3.12 (Reihung des Plans)

| #                   | Funktion                                | Umgesetzt als                                                                                         | Wirkung                                                                                                                                            |
| ------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1**              | Kontrollabdeckungs-Heatmap              | `computeCoverage` + Layer `control-coverage` (Formkodierung, 4 Stufen + Schraffur)                    | Zeigt **unkontrolliertes Restrisiko** statt Kontrollanzahl: `Σ residualScore der Risiken mit ≥1 wirksamer Kontrolle / Σ aller`.                    |
| **F2**              | Risikokonzentration & Roll-up           | `rollupRisk` + Layer `risk` (Badge TR, Marker `»` für geerbt), Erbrechnung auch für die Formkodierung | Subprozess, Lane, Pool und Call Activity zeigen das aggregierte Risiko ihrer Kinder bzw. des Zielprozesses.                                        |
| **F3**              | SoD-Konfliktbögen                       | `computeSod` + Layer `sod` (Badge TR beidseitig, gestrichelter Bogen mit Schloss, Kopfzeile)          | Aufgabentrennungsverstöße stehen zwischen den Lanes statt in Excel; Erreichbarkeitsprüfung verhindert Falschbefunde in getrennten Gateway-Zweigen. |
| **F4**              | Nachweisfälligkeits-Ampel               | `computeEvidence` + Layer `evidence` (Formkodierung + Badge BL mit Tagesangabe)                       | „Welche Schritte haben keinen frischen Nachweis?" — vier Stufen: aktuell / ≤30 T / überfällig / **nie**.                                           |
| **F5**              | Datenfluss über Vertrauensgrenzen       | `computeTrustBoundaries` + Layer `trust-boundary` (Doppelkante + Länderchip)                          | Beantwortet auf der Fläche, wo personenbezogene Daten den Verantwortungsbereich verlassen.                                                         |
| **F6**              | Ausfall-/Abhängigkeitssimulation        | `simulateOutage` + Layer `outage` (Schraffur, „BLOCK"-Marker, Kopfzeile mit MTPD-Reißpunkt)           | „Anwendung X fällt aus" → betroffen / blockiert / Ausweichverfahren, plus Reißpunkt in Minuten.                                                    |
| **F7**              | Conformance-Heatmap mit Abdeckungsquote | `conformanceGate` + Layer `conformance` (Heat, Kantenstärke, Geisterkanten, Gutter)                   | Heatmap **nur** mit ausgewiesener Quote; ohne `coverageRatio` wird die Funktion verweigert und begründet.                                          |
| **F8**              | Framework-Abdeckungssicht               | `computeFrameworkElement`, `summarizeFramework` + Layer `framework` (Chips TL, Kopfzeile, Legende)    | „Zeig mir ISO 27001 A.5 über diesen Prozess": Abdeckungsgrad je **Anforderung**, Lücken namentlich.                                                |
| **F9**              | Element-Kommentare                      | Layer `comments` (Pin-Schiene links außen)                                                            | Kommentare bekommen eine eigene Schiene, konkurrieren nie mit einem Befund.                                                                        |
| **F10**             | Aufbewahrungs-/Löschsicht               | `computeRetention` + Layer `retention` (Gutter-Frist, Badge BR) + Filter „Löschfrist < 12 Monate"     | Zeigt, wo aufbewahrungspflichtige Daten entstehen und wann gelöscht werden muss.                                                                   |
| **F13**             | Kontrolltest-Ergebnis am Schritt        | Layer `control-test` (Badge TR)                                                                       | Nicht „es gibt eine Kontrolle", sondern „sie wurde geprüft und hat bestanden".                                                                     |
| **F17** (teilweise) | Qualifikationslücke                     | Layer `lane` (Quote am Lane-Rand)                                                                     | Schulungs- und Kenntnisnahmequote je Lane, sobald `process_lane` steht.                                                                            |

### Aus §3.4/§3.5 (Objektgruppen A und B), weil die Sichten sie brauchen

| Objekt                                                      | Layer             | Slot                      |
| ----------------------------------------------------------- | ----------------- | ------------------------- |
| A2 Kontrolle (wirksam/gesamt)                               | `control`         | Badge TL                  |
| A3 Feststellung mit Fälligkeit (offen / ≤14 T / überfällig) | `finding`         | Badge BR                  |
| A4 Line of Defense                                          | `line-of-defense` | 4-px-Kante links          |
| A5 Call Activity mit Roll-up                                | `call-activity`   | Badge BL                  |
| B1 Asset/Anwendung am Schritt                               | `asset`           | Badge TL                  |
| B2 RACI (R/A-Kürzel, C/I im Text)                           | `raci`            | Badge BL                  |
| B4 Simulationsparameter (Dauer · Kosten · Anzahl)           | `operations`      | Gutter + Kantenstärke     |
| §3.9 Personenbezug / Datenkategorie / DPIA                  | `privacy`, `dpia` | Formkodierung, TL, TR, BL |
| §3.10 BIA (Kritikalität, RTO/RPO/MTPD, Ausweichverfahren)   | `bcm`             | Formkodierung, Gutter, BL |
| §3.6 Dokument/SOP                                           | `document`        | Badge BR                  |
| §3.11 Lane-Träger (Vendor, Drittland, Quoten)               | `lane`            | Badges am Lane-Rand       |

**23 Layer** insgesamt, alle mit Pflichtmethode `describe()`; ohne sie verweigert
`createLayerRegistry` die Registrierung (getestet).

---

## 2. Das Slot- und Layer-System, wie gebaut

### 2.1 Slots (§3.3.1)

```
          ┌──────────────────────────────┐
     [TL] │                              │ [TR]      TL,TR,BL,BR : Badge-Slots
      ▌   │      Rechnung prüfen         │           ▌  : LoD-Kante (4 px, fest)
      ▌   │                              │           Fläche : Formkodierung
     [BL] │                              │ [BR]      (Füllung + Schraffur)
          └──────────────────────────────┘
   ◉        RTO 4 h · RPO 15 min                     ◉ : Pin-Schiene (Kommentare)
```

Sieben Andockstellen, feste Maße in `tokens.ts`, kein Layer erfindet eigene:
**4 Badge-Slots**, **1 Formkodierung**, **1 Gutter** (max. 1 Zeile, max. 3 Kennzahlen),
**1 Pin-Schiene**, dazu die **LoD-Kante** und die **Kantendekoration**
(Strichstärke = Häufigkeit, Doppelstrich = Vertrauensgrenze, gestrichelt = nie beobachtet).

Umsetzungsdetails, die sich beim Bauen als tragend erwiesen haben:

- **Gezeichnet wird in die Elementgruppe (`g.djs-element`) in absoluten
  BPMN-DI-Koordinaten** — derselben Konvention, die `BpmnRenderer` benutzt. Dadurch klebt
  die Dekoration an der Form, gleich ob die Gruppe zusätzlich eine Translation trägt
  (`diagram-js`-Fläche) oder nicht (statisches Export-SVG). Diagrammweite Dekoration
  (Bögen, Geisterkanten, Kopfzeile, Legende) liegt in einer eigenen Gruppe und addiert
  die Translation der Endpunkte hinzu.
- **Die Formkodierung färbt die tragende Kontur** (`.bpmn-outline`) statt eine Fläche
  darüberzulegen. Eine Fläche _darunter_ wäre unsichtbar (die Kontur ist weiß gefüllt),
  eine _darüber_ würde Beschriftung und Symbol verdecken. Die ursprüngliche Füllung wird
  gesichert und beim Aufräumen zurückgestellt.
- **Badges werden auf halbe Elementbreite begrenzt** (Untergrenze 48 px) und gekürzt;
  der vollständige Text steht im zugänglichen Namen und in der Tabelle.
- **Rahmen (Lane/Pool) bekommen ihre Badges am rechten Innenrand gestapelt**, nicht in
  den geometrischen Ecken — dort stünden sie halb außerhalb oder auf den Aktivitäten.
- **Gutter nur unter Aktivitäten**: Ereignisse und Gateways tragen ihre Beschriftung
  außerhalb der Form, genau dort, wo der Gutter läge.

### 2.2 Budget und Konfliktlösung (§3.3.2)

1. Leere Layer melden gar kein Signal und belegen keinen Slot.
2. Kollidieren zwei Layer auf einem Slot, gewinnt die höhere Priorität; bei Gleichstand
   entscheidet die Layer-ID alphabetisch — **nie** die Registrierungsreihenfolge.
   (Getestet: zweimal dieselbe Eingabe ergibt zeichengleich dasselbe Bild.)
3. **Höchstens drei Badge-Slots** sind belegt; der schwächste weicht.
4. **Höchstens eine Formkodierung**; die Sicht bestimmt, welcher Layer sie stellen darf.
5. Alles Verdrängte geht in den **Sammel-Badge** `+n` im freien Slot. Er ist nie stumm:
   er nennt in Name, Ansage und Tabellenspalte, was er verdeckt.

Prioritätsordnung (`catalog.ts::PRIORITY`), Leitgedanke: _Befund schlägt Zustand; was
gerade ausdrücklich simuliert wird, schlägt alles._
`outage 98 > sod 95 > control-coverage 90 > evidence 88 > privacy 86 > risk 85 >
conformance 84 > bcm 82 > finding 80 > control 78 > framework 76 > control-test 74 >
dpia 72 > call-activity 66 > line-of-defense 62 > asset 58 > lane 55 > raci 54 >
document 48 > retention 46 > operations 40 > trust-boundary 36 > comments 30`.

### 2.3 Sichten und Rollen (§3.3.3, §3.3.4)

Neun Sichten als benannte Presets, eins zu eins nach der Tabelle in §3.3.3:
`modeling`, `risk-control`, `compliance`, `privacy`, `continuity`, `operations`,
`organization`, `architecture`, `responsibility`. Jede nennt ihre Layer und den Layer,
der die Formkodierung stellen darf. Rollenvoreinstellungen in `ROLE_DEFAULT_VIEW`;
unbekannte Rollen bekommen „Verantwortung" (die Sicht ohne Befunddarstellung).
Einzelne Layer lassen sich zuschalten (`extraLayers`) — das Budget greift trotzdem.

### 2.4 Die drei unverhandelbaren Regeln (§3.3.5)

1. **Nichts wird ausgeblendet.** Filter setzen `opacity 0.25` auf die _ganze_
   Elementgruppe (inklusive ihrer Badges) und melden im Protokoll „nichts ausgeblendet".
   Zwei Filter sind gebaut (`openFindingsFilter`, `shortRetentionFilter`,
   dazu `outageFilter`).
2. **Farbe ist nie der einzige Träger.** Jeder Ton hat ein Formzeichen (▲ ■ ● ▪ ○ §),
   ein Wort (`TONE_WORD`) und einen Zahlenwert; jede Heat-Stufe zusätzlich eine
   Schraffurdichte.
3. **Jede Dekoration hat einen Text.** `describe()` ist Pflicht im Interface _und_ wird
   zur Laufzeit geprüft.

---

## 3. Barrierefreiheit — Stand

- **Zugänglicher Name:** Jede gezeichnete Angabe wird an das `aria-label` der
  Elementgruppe angehängt (Basisname gesichert, dadurch idempotent bei Sichtwechseln).
  Die Dekoration selbst ist durchgehend `aria-hidden` — der Name trägt sie genau einmal.
- **Textalternative:** `buildGrcTextAlternative` erweitert die Prozesstabelle um **eine
  Spalte je aktivem Layer mit Inhalt**; leere Layer bekommen keine Spalte. Der Spaltentext
  ist die _Vereinigung_ aus `layer.describe()` und den Texten der tatsächlich gezeichneten
  Signale — strukturell, nicht nach Disziplin. Kopfzeilen, Sicht, Datenstand und
  Filterhinweis stehen in `notes` und in der `<caption>`.
- **Live-Region:** `announcementFor()` liefert den GRC-Teil des Fokussatzes,
  `diagramAnnouncement()` die Einstiegsansage (Sicht, Befunde, Datenstand).
- **Tastatur:** `GrcBadgeCursor` setzt `.` / `,` aus §4.2 um (Badges des fokussierten
  Elements durchlaufen und vorlesen), `Enter` löst dasselbe Ereignis aus wie ein Klick.
  Badges sind **bewusst keine eigenen Tabstopps**: 40 Aktivitäten × 3 Badges wären 120
  zusätzliche Halte.
- **axe-core:** null Verstöße über fünf Kombinationen aus Korpusdiagramm und Sicht
  (Risiko & Kontrolle, Compliance, Datenschutz, Organisation & SoD, Kontinuität) sowie
  über die GRC-Textalternative.
- **Kontrast (§4.4):** als Rechnung hinterlegt, nicht als Behauptung
  (`test/grc/contrast.test.ts`, 25 Prüfungen). Gemessene Werte:

  | Ton      | solid     | Weißtext | vs. Weiß | tint      |  L\* | Elementtext auf tint |
  | -------- | --------- | -------: | -------: | --------- | ---: | -------------------: |
  | critical | `#A4262C` |     7,26 |     7,26 | `#F5C2BC` | 82,7 |                11,33 |
  | warn     | `#8A5A00` |     5,93 |     5,93 | `#FBE3A2` | 90,8 |                14,12 |
  | ok       | `#1F6B3A` |     6,52 |     6,52 | `#C9E7D2` | 89,0 |                13,47 |
  | info     | `#1C4E80` |     8,57 |     8,57 | `#D6E4F7` | 90,1 |                13,86 |
  | neutral  | `#444D56` |     8,60 |     8,60 | `#EEF1F4` | 95,0 |                15,75 |
  | accent   | `#5B3E9B` |     8,05 |     8,05 | `#E4D8F5` | 88,1 |                13,13 |

  Schlechtestes Badge-gegen-Tönung-Paar: `warn` auf `critical`-Tönung mit **3,76:1**
  (Schwelle 3:1). Elementkontur gegen jede Tönung ≥ 11:1. Farbfehlsichtigkeit wird nach
  Viénot/Brettel/Mollon simuliert; der Test belegt ausdrücklich, dass `critical` und
  `warn` unter Deuteranopie zusammenrücken — **deshalb** das Formzeichen.

**Was hier nicht geprüft werden kann** (Grenzen von jsdom, siehe
`test/draw/helpers/jsdom-svg.ts`): tatsächlicher Bildschirmkontrast, Fokus-Sichtbarkeit,
Screenreader-Ausgabe, Pixelvergleich. Dafür braucht es Stufe 3 (echter Browser).

---

## 4. Der Schnittstellenvertrag

### 4.1 Eingang — `GrcOverlayData` (`contract.ts`)

Genau die Nutzlast des in §3.3.6 geplanten Endpunkts:

```
GET /api/v1/processes/:id/diagram-overlay?version=:vid&layers=risk,control,…
→ { computedAt, ttlSeconds?,
    elements: { "<bpmnElementId>": GrcElementData },
    edges?:   { "<flowId>":        GrcEdgeData },
    lanes?:   { "<laneId>":        GrcLaneData },
    diagram?: GrcDiagramData }
```

- `computedAt` ist **Pflicht**: jede Anzeige aus zwischengespeicherten Daten muss ihren
  Stand nennen können („Stand: vor 3 Minuten"). Ein Diagramm mit stillschweigend
  veralteten Kontrollständen ist ein Prüfungsrisiko. Der Wert erscheint in Legende,
  Textalternative und Einstiegsansage.
- **Jedes Feld ist optional.** Fehlt es, heißt das „nicht vorhanden **oder** nicht
  sichtbar" — die Schicht unterscheidet das bewusst nicht, weil die RLS-Filterung
  serverseitig stattfindet (§3.3.6).
- `GrcElementData` trägt: `risks`, `controls`, `findings`, `lineOfDefense`,
  `calledProcess` (mit `rollup`), `assets`, `raci`, `simulation`, `dmnDecision`, `ropa`,
  `bia`, `documents`, `frameworks`, `comments`, `conformance`, `incidents`, `workItems`,
  `stepKey`.
- `GrcDiagramData` trägt `sodRules`, `outage` (Szenario), `framework` (Auswahl),
  `conformance` (Quote, nicht zugeordnete Aktivitäten, Abweichungen) und `asOf`
  (Bezugszeitpunkt aller Fristen; Vorgabe `computedAt`).

**Alle Fristenrechnungen sind rein und nehmen den Bezugszeitpunkt als Argument** — kein
Test hängt an `Date.now()`, keine Anzeige an der Zeitzone des Servers.

### 4.2 Ausgang — `GrcInteraction`

Die Schicht öffnet **kein** Panel und navigiert nirgendwohin; sie meldet, was gemeint war:

| Ereignis          | Nutzlast                                                                              |
| ----------------- | ------------------------------------------------------------------------------------- |
| `badge.activate`  | `elementId`, `layerId`, `slot`, `refs: GrcObjectRef[]` (die Objekte hinter dem Badge) |
| `overflow.open`   | `elementId`, `suppressed: {layerId, text}[]`                                          |
| `pin.open`        | `elementId`, `openThreads`                                                            |
| `shape.activate`  | `elementId`, `layerId`                                                                |
| `edge.activate`   | `edgeId`, `layerId`                                                                   |
| `arc.activate`    | `conflictId`, `elementIds: [a, b]`                                                    |
| `banner.activate` | `layerId`, `text`                                                                     |

Aufrufflächen: `decorateGrc({ root, model, onInteract })` (Maus) und `GrcBadgeCursor`
(Tastatur) erzeugen **dieselben** Ereignisse.

### 4.3 Öffentliche Funktionen

```ts
buildOverlayModel(scene, data, { view, extraLayers?, filter?, selectedConflictId? })
decorateGrc({ root, model, onInteract?, legend?, banner? })   // → { …, destroy() }
renderGrcScene(scene, data, { view, legend, … })              // statisches Export-SVG
buildGrcTextAlternative(scene, model) / renderGrcTextAlternativeTable(alt)
announcementFor(model, elementId) / diagramAnnouncement(model) / new GrcBadgeCursor(…)
GRC_VIEWS / viewById / defaultViewForRole(role) / resolveView(view, registry, extra)
```

Ausgeliefert über `packages/bpmn/src/index.ts` als Namensraum `grc` (eine Zeile).
**Offen, weil fremde Datei:** ein Eintrag `"./grc": "./src/grc/index.ts"` in
`packages/bpmn/package.json#exports` wäre der saubere Unterpfad-Import; bis dahin
`import { grc } from "@grc/bpmn"`.

---

## 5. Schemabedarf

**Es wurde keine Migration und keine Schemadatei angefasst.** Was die Schicht braucht,
damit ihre Felder befüllbar werden — geordnet nach §3.13, mit Tabelle, Spalte, Typ und
Begründung. Alles additiv (nullable Spalten, neue Tabellen), kein Datenverlustrisiko.

### 5.1 Neu anzulegende Tabellen

| Tabelle                      | Spalten (Kern)                                                                                                                                                                                                                                                                                                                                                                 | Wofür in dieser Schicht                                                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `process_lane`               | `id uuid pk`, `org_id uuid`, `process_id uuid`, `bpmn_element_id varchar(100)`, `step_key uuid`, `name text`, `kind varchar(10)` (`lane\|pool`), `parent_lane_id uuid null`, `org_unit_id uuid null`, `custom_role_id uuid null`, `vendor_id uuid null`, `is_external boolean default false`, `third_country char(2) null`, Zeitstempel; `UNIQUE(process_id, bpmn_element_id)` | **`GrcLaneData`** — ohne sie sind F5 (Vertrauensgrenzen), F3 (Lane-Bezug der Konflikte), F17 (Quoten) und jede Lane-Aggregation datenlos. Heute gibt es keine Lane-Tabelle.                                                                               |
| `process_step_raci`          | `id uuid pk`, `org_id`, `process_step_id uuid`, `role_id uuid`, `raci_role char(1)`, `source varchar(12)` (`manual\|derived\|override`); `UNIQUE(process_step_id, role_id, raci_role)`                                                                                                                                                                                         | **`GrcRaci.consulted/informed`** haben heute keine DB-Heimat (nur Komma-String im XML). Ohne sie ist F3 auf die zwei denormalisierten Spalten an `process_step` beschränkt.                                                                               |
| `sod_rule`                   | `id uuid pk`, `org_id`, `role_a_id uuid`, `role_b_id uuid`, `severity varchar(10)`, `rationale text`, `framework_ref varchar(80)`, `is_active boolean`                                                                                                                                                                                                                         | **`GrcSodRule`** — F3 hat sonst keine Regelmenge. Im Schema existiert dafür nichts (`abac_policy`/`access_review` decken Zugriffsrechte ab, nicht Aufgabentrennung). **Die Selbstpaarung `role_a_id = role_b_id` muss erlaubt sein** (Begründung in 7.3). |
| `process_step_ropa`          | `id`, `org_id`, `process_step_id uuid`, `is_processing_activity boolean`, `purpose text`, `legal_basis varchar`, `retention_months integer null`, `retention_basis text`, `requires_dpia boolean`, `dpia_id uuid null`, `transfer_third_country boolean`, `transfer_country char(2) null`, `transfer_safeguard varchar`, `notes text`                                          | **`GrcRopa`** — trägt Formkodierung Personenbezug, DPIA-Befund, F10 (Aufbewahrung) und die Personenbezugsprüfung von F5. Heute kennt die DB nur `process_ropa_profile` je Prozess (1:1), obwohl das XML es je Flow-Node modelliert.                       |
| `process_step_data_category` | `process_step_id uuid`, `ropa_data_category_id uuid`, `is_special_category boolean`, `subject_type_id uuid null`                                                                                                                                                                                                                                                               | **`GrcDataCategory`** — Kategoriechip TL und die Stufe „besondere Kategorie" (Art. 9 DSGVO).                                                                                                                                                              |
| `process_step_recipient`     | `process_step_id uuid`, `recipient_id uuid`, `kind varchar(12)` (`vendor\|org_unit`)                                                                                                                                                                                                                                                                                           | `GrcRopa.recipients`; speist außerdem die VVT-Aggregation.                                                                                                                                                                                                |
| `process_step_bia`           | `process_step_id uuid`, `criticality varchar(10)`, `mtpd_minutes integer`, `rto_minutes integer`, `rpo_minutes integer`, `impact_categories jsonb`, `workaround text`, `workaround_max_duration_minutes integer`                                                                                                                                                               | **`GrcBia`** — F6 rechnet den MTPD-Reißpunkt als Minimum über die betroffenen Schritte. Ohne Elementebene bleibt nur `bia_process_impact(process_id)`, und der Reißpunkt wäre geschätzt statt gerechnet.                                                  |
| `process_step_document`      | `process_step_id uuid`, `document_id uuid`, `relation_type varchar(20)`                                                                                                                                                                                                                                                                                                        | `GrcElementData.documents` — Layer `document` (Sicht „Verantwortung"). n:m, deshalb eigene Tabelle (Regel G).                                                                                                                                             |
| `process_event_activity_map` | `id`, `org_id`, `event_log_id uuid`, `activity_name varchar(500)`, `process_step_id uuid null`, `match_kind varchar(12)` (`exact\|normalized\|fuzzy\|manual\|unmapped`), `confidence numeric`, `mapped_by uuid`, `mapped_at timestamptz`; `UNIQUE(event_log_id, activity_name)`                                                                                                | **`GrcConformanceElement.matchKind` + `GrcConformanceSummary.coverageRatio`** — F7 wird ohne diese Quote **nicht ausgeliefert** (der Torwächter ist gebaut und getestet). `process_event.activity` ist ein Name, keine BPMN-ID.                           |
| `user_diagram_preference`    | `user_id uuid`, `scope varchar(40)`, `active_view varchar(32)`, `layers jsonb`, `updated_at`                                                                                                                                                                                                                                                                                   | Speichert die zuletzt gewählte Sicht je Nutzer und Prozessart (§3.3.4). Eine Präferenztabelle existiert im Schema nicht.                                                                                                                                  |

### 5.2 Zu erweiternde Tabellen

| Tabelle                                 | Spalte                                                                                   | Typ                                                      | Warum                                                                                                                                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `process_step`                          | `step_key`                                                                               | `uuid not null`, `UNIQUE(process_id, step_key)`          | Stabile Identität über Round-Trips durch fremde Editoren (§3.2). Der Vertrag führt `GrcElementData.stepKey` bereits mit; solange er fehlt, ist der Schlüssel des Datensatzes die BPMN-ID.                            |
| `process_step`                          | `parent_step_id`, `lane_step_id`                                                         | `uuid null`                                              | Containment und Lane-Zugehörigkeit. **Solange sie fehlen, bestimmt diese Schicht beides geometrisch** (engster umschließender Rahmen) — das funktioniert, ist aber eine Notlösung: bei überlappenden Rahmen rät sie. |
| `control`                               | `is_key`                                                                                 | `boolean default false`                                  | `GrcControl.isKey` — Schlüsselkontrollen im Text der Kontrollbeschreibung (Annahme des Plans in §3.4/A2).                                                                                                            |
| `control` bzw. `control_test_execution` | `owner_role_id`, `last_test_result`, `last_evidence_at`, `evidence_due_at`               | `uuid null`, `varchar(10)`, `timestamptz`, `timestamptz` | F4 und F13 brauchen Fälligkeit und Ergebnis je Kontrolle; die Selbstkontroll-Prüfung (§3.4/A4) braucht die verantwortliche Rolle der Kontrolle.                                                                      |
| `finding`                               | `due_at`                                                                                 | `timestamptz null`                                       | A3 ist dreistufig (offen / ≤14 T / überfällig) — heute gibt es nur die Anzahl.                                                                                                                                       |
| `dpia`                                  | `process_step_id`                                                                        | `uuid null`                                              | Regel G: der Auslöser ist meist _ein_ Schritt; der DPIA-Badge zeigt den Befund „erforderlich, aber nicht verknüpft".                                                                                                 |
| `process_framework_mapping`             | `process_step_id`                                                                        | `uuid null`                                              | F8 auf Elementebene; ohne sie bleibt die Abdeckung eine Prozessaussage.                                                                                                                                              |
| `process_kpi_definition`                | `process_step_id`, `sequence_flow_id`                                                    | `uuid null`, `varchar(100) null`                         | Durchlaufzeit zwischen zwei Schritten (Gutter/Kante).                                                                                                                                                                |
| `security_incident`                     | `process_step_id`                                                                        | `uuid null`                                              | F14 (nicht gebaut, Vertrag vorbereitet: `GrcElementData.incidents`).                                                                                                                                                 |
| `work_item`                             | `process_step_id` **oder** `work_item_entity_link(work_item_id, entity_type, entity_id)` | `uuid null`                                              | F16 (nicht gebaut, Vertrag vorbereitet: `GrcElementData.workItems`).                                                                                                                                                 |
| `simulation_activity_param`             | `activity_id` → `step_key`                                                               | `uuid`                                                   | Sonst bricht die Zuordnung beim Re-Export durch ein fremdes Werkzeug.                                                                                                                                                |
| `eam_bpmn_element_placement`            | `process_step_id`, `label_visible`, `relation_type`                                      | `uuid null`, `boolean default true`, `varchar(20)`       | F12 (nicht gebaut — siehe 6.).                                                                                                                                                                                       |
| `process_step.step_type`                | Enum um `lane`, `pool`, `data_object`, `data_store` **oder** `process_lane` separat      | —                                                        | Empfehlung dieser Schicht: **`process_lane` separat**, DataObjects über `process_step`. Lanes haben eigene Attribute (Vendor, Drittland, Rolle), die an `process_step` nichts zu suchen haben.                       |

### 5.3 Ein neuer Endpunkt

`GET /api/v1/processes/:id/diagram-overlay` genau in der Gestalt von §3.3.6 — ein Aufruf,
ein Cache-Eintrag, eine RLS-Prüfung, `computedAt`. Die Antwortstruktur ist mit
`GrcOverlayData` bereits typisiert; die Schicht braucht **keine** weitere Route.
Der Join, der heute nirgends existiert: `process_step_risk ⋈ process_step_control ⋈
control.effectiveness` je Schritt (F1) — er gehört in den Endpunkt, nicht in den Client.

---

## 6. Was nicht gebaut wurde — und warum

| #          | Funktion                                    | Grund                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F11**    | Kostenverteilung / Kostentreiber            | Der Gutter zeigt bereits `Dauer · Kosten · Anzahl` aus `simulation_activity_param` (B4). Was fehlt, ist der **Anteilsbalken unter der Lane** aus `grc_cost_entry`/`grc_time_entry`. Das ist ein eigener Slot („Lane-Fußzeile"), den §3.3.1 nicht vorsieht — ihn zu erfinden hätte das Slotsystem aufgeweicht, bevor es sich bewährt hat. Bewusst zurückgestellt.                                                                                                                 |
| **F12**    | EAM-Anwendungslandschaft auf der Fläche     | Braucht **eigene Shapes auf einem zweiten `diagram-js`-Layer** mit eigener Geometrie aus `eam_bpmn_element_placement`, dazu Bearbeitung im Modus `edit` und einen Palette-Abschnitt. Das ist keine Dekoration mehr, sondern eine zweite Zeichenebene — sie gehört in denselben Arbeitsstrang wie die Modellierung (`src/modeling/`), nicht in die Überlagerung. Der Vertrag hält `GrcAsset` bereits vor, die Sicht „Architektur" existiert und zeigt heute die Assets als Badge. |
| **F14**    | Vorfälle am Schritt                         | Reine Badge-Arbeit, aber ohne `security_incident.process_step_id` gäbe es nichts zu zeigen. Vertrag vorbereitet (`GrcElementData.incidents`), Layer wäre eine Stunde Arbeit, sobald die Spalte steht.                                                                                                                                                                                                                                                                            |
| **F15**    | KRI-Schwellenampel                          | Braucht `kri_measurement` als Zeitreihe **und** eine Aussage über die Richtung (Pfeil). Ohne Zeitreihenvertrag wäre der Badge eine Zahl ohne Bedeutung. Zurückgestellt, weil er dem Nutzer sonst mehr Sicherheit vorspiegelt, als die Daten hergeben.                                                                                                                                                                                                                            |
| **F16**    | Offene Maßnahmen mit Fälligkeit             | Wie F14: fehlender Prozessbezug an `work_item`/`task`. Vertrag vorbereitet (`GrcElementData.workItems`).                                                                                                                                                                                                                                                                                                                                                                         |
| **F18**    | Zeitreise / Änderungssicht                  | Braucht **zwei** Szenen gleichzeitig und einen Abgleich über `step_key` — die Schicht ist auf eine Szene gebaut. Das ist eine eigene Funktion („Diff-Sicht") mit eigenem Modell, nicht ein Layer. `packages/shared/src/bpmn-diff.ts` ist die Grundlage; empfohlen als eigener Arbeitsschritt.                                                                                                                                                                                    |
| F17 (halb) | Qualifikations-/Kenntnisnahmelücke          | Die Quote je Lane ist gebaut (`lane`-Layer). Was fehlt, ist die Aufschlüsselung je Rolle im Panel — das ist Anwendungssache, nicht Diagrammschicht.                                                                                                                                                                                                                                                                                                                              |
| —          | Sicht „Modellierung": Validierungsmarker BR | Die Validierung gehört `src/verify/` (anderer Arbeitsstrang, fremde Dateihoheit). Die Sicht ist angelegt und lässt den Slot frei; der Layer kann ohne Änderung an dieser Schicht nachgereicht werden.                                                                                                                                                                                                                                                                            |
| —          | Sicht „Architektur": Zuordnungslinien       | Teil von F12.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| —          | Drilldown in Subprozesse                    | `buildScene` zeichnet nur die erste `BPMNDiagram`-Ebene (Spike-Beschränkung, dokumentiert in `scene.ts`). Die Roll-up-Rechnung kompensiert das fachlich (Aggregat am eingeklappten Subprozess), die zweite Ebene selbst gehört in AP „Drilldown".                                                                                                                                                                                                                                |

---

## 7. Befunde aus dem Bauen

### 7.1 Doppelte Verschiebung auf der `diagram-js`-Fläche (fremde Datei, nicht geändert)

`GraphicsFactory.update()` setzt auf jede Elementgruppe `transform=matrix(1,0,0,1,x,y)`,
während `BpmnRenderer` seine Geometrie in **absoluten** DI-Koordinaten zeichnet. Ein Shape
bei (240|60) landet auf der Canvas-Fläche damit bei (480|120). Im statischen Renderer
(kein Transform) stimmt es. Sichtbar ist es heute kaum, weil `fit-viewport` alles wieder
einpasst und nur die _Abstände_ zwischen den Elementen verdoppelt erscheinen.

**Diese Schicht ist davon unabhängig**: Sie zeichnet in dieselbe Gruppe und dieselbe
Konvention, klebt also in beiden Fällen an der Form; für gruppenübergreifende Dekoration
liest sie die Translation der Endpunkte aus. Der Befund gehört trotzdem behoben —
Zuständigkeit: `src/viewer/BpmnCanvas.ts` bzw. `src/draw/BpmnRenderer.ts`.
**Wenn er behoben wird** (Renderer zeichnet relativ), muss in `decorate.ts` genau eine
Stelle nachziehen: die Badge-/Gutter-/Pin-Geometrie benutzt dann `0,0` statt `shape.x,y`.
Das ist in `decorate.ts` im Kopfkommentar als Koordinatenvertrag festgehalten.

### 7.2 Was nur das Rastern gefunden hat

Der Spike-Hinweis hat sich bestätigt. Vier Fehler fand **kein** Test, sondern erst der
Blick auf das gerasterte Bild:

1. **Die Formkodierung war unsichtbar.** Die Tönung lag hinter der weiß gefüllten Kontur.
   Kein Test konnte das sehen: der Knoten war vorhanden, die Attribute stimmten.
   → Die Kontur wird jetzt selbst eingefärbt.
2. **Vier Zeichen wurden zu leeren Kästchen** (`◆`, `↗`, `⚑`, `📄`). Der DOM enthielt den
   richtigen Text; die Schrift kannte ihn nicht.
   → Glyphensatz auf ▲ ■ ● ▪ ○ § » beschränkt, im Token-Kommentar begründet.
3. **Badges überlappten sich** an 100 px breiten Aktivitäten (Kategoriechip über Ampel).
   → Breitengrenze halbe Elementbreite (min. 48 px) mit Kürzung.
4. **Gutter und externe Beschriftung standen übereinander** an Ereignissen, die
   Kopfzeile war rechts abgeschnitten, Lane-Badges lagen halb außerhalb.
   → Gutter nur unter Aktivitäten, Kopfzeile misst ihren Text, Rahmen-Badges am rechten
   Innenrand.

### 7.3 Eine bewusste Abweichung vom Plan (F3)

§3.11 formuliert die SoD-Prüfung über zwei **verschiedene** Rollen, die ein Regelpaar
bilden. Das allein ist kein Befund: dass zwei unverträgliche Aufgaben von zwei
verschiedenen Rollen wahrgenommen werden, ist der _gewünschte_ Zustand. Der eigentliche
Verstoß ist „dieselbe Rolle verantwortet beide Aufgaben". Deshalb lässt `computeSod` die
**Selbstpaarung** `role_a_id = role_b_id` ausdrücklich zu und findet sie; die Paarung
zweier verschiedener Rollen bleibt möglich, weil manche Regelwerke die bloße Nähe zweier
Rollen im selben Pfad beanstanden. **Folge für das Schema:** `sod_rule` darf keine
`CHECK(role_a_id <> role_b_id)`-Bedingung bekommen.

### 7.4 Zwei fachliche Festlegungen, die der Plan offenließ

- **F1:** Ein Risiko _ohne_ Kontrollverknüpfung gilt als unkontrolliert (fehlende Daten
  sind keine Entwarnung). Ein unkontrolliertes Risiko mit Restscore ≥ 15 setzt die Stufe
  auf „unkontrolliert", auch wenn die Quote gut aussieht — sonst verschwindet der Befund,
  wegen dem man das Diagramm öffnet, hinter dem Durchschnitt vieler kleiner Risiken.
- **F6:** Ein Schritt mit dokumentiertem Ausweichverfahren gilt nicht als blockiert
  **und stoppt die Ausbreitung** — er kann den Ablauf fortsetzen. Ein Workaround mit
  `workaround_max_duration_minutes = 0` zählt nicht.

---

## 8. Sichtbare Belege

`packages/bpmn/test/grc/rendered/` (erzeugt von `test/grc/render.test.ts`, echte
Korpusdiagramme + Fixture-Daten aus `test/grc/fixtures.ts`), je Fall `.svg` **und**
`.txt` (die vollständige Textalternative), dazu `_index.html` als Übersicht.

| Datei                                    | Diagramm                                    | Sicht                 | Was zu sehen ist                                                                                                |
| ---------------------------------------- | ------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `01-risiko-kontrolle-vertrieb.svg`       | `repo-prd-sales-with-gateway`               | Risiko & Kontrolle    | F1-Heat (rot + grobe Schraffur an „Angebot erstellen"), F2-Ampel, A3, LoD-Kante, Pin, Sammel-Badge `+1`         |
| `02-compliance-beschaffung.svg`          | `repo-prd-procurement`                      | Compliance & Nachweis | F4 (aktuell/fällig/überfällig/nie), F8-Chips + Abdeckungsgrad in der Kopfzeile, F13                             |
| `03-datenschutz-kreditantrag.svg`        | `synth-collaboration-pools-lanes`           | Datenschutz           | F5-Doppelkante mit `US`-Chip, besondere Kategorie (Schraffur), DPIA-Befund, F10-Gutter                          |
| `04-sod-kreditantrag.svg`                | `synth-collaboration-pools-lanes`           | Organisation & SoD    | F3-Bogen mit Schloss zwischen den Lanes, Kopfzeile mit Selbstkontrolle                                          |
| `05-ausfallsimulation-tourenplanung.svg` | `repo-seed-tour-planning`                   | Kontinuität           | F6: betroffen/Ausweichverfahren, MTPD-Reißpunkt „in 1 h 45 min", RTO/RPO im Gutter                              |
| `06-rollup-callactivity.svg`             | `repo-seed-order-callactivity`              | Risiko & Kontrolle    | F2-Roll-up: Call Activity erbt Risiko **und** Abdeckung des Zielprozesses                                       |
| `07-conformance-grossprozess.svg`        | `synth-large-flat-process` (60 Aktivitäten) | Betrieb & Effizienz   | F7 mit Abdeckungsquote, Kantenstärke, roter Ist-Pfad, nicht zugeordnete Schritte bleiben weiß, Slot-Budget hält |
| `08-loeschsicht-wareneingang.svg`        | `repo-seed-goods-receipt`                   | Datenschutz + Filter  | F10 mit Filter „< 12 Monate": nicht passende Schritte abgeblendet, **nicht** ausgeblendet                       |

Alle acht wurden rasterisiert und angesehen; die dabei gefundenen Fehler stehen in 7.2.

---

## 9. Zahlen

|                   |                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Produktivcode     | **7.382 Zeilen** in 18 Dateien (`src/grc/`), Kommentaranteil hoch                                              |
| Testcode          | **2.954 Zeilen** in 8 Dateien (`test/grc/`)                                                                    |
| Tests             | **143**, alle grün; Gesamtpaket 514 grün (1 Fehlschlag in `test/verify/raster.test.ts`, fremder Arbeitsstrang) |
| Layer             | 23, alle mit `describe()`                                                                                      |
| Sichten           | 9 + 12 Rollenvoreinstellungen                                                                                  |
| axe-core          | 0 Verstöße über 5 Sicht/Diagramm-Kombinationen + Textalternative                                               |
| Kontrastprüfungen | 25, rechnerisch, ohne Screenshot                                                                               |
| Belege            | 8 SVG + 8 Textalternativen + Übersichtsseite                                                                   |

**Nicht angefasst:** `src/draw/`, `src/viewer/`, `src/model/`, `src/modeling/`,
`src/verify/`, Schema, Migrationen, `apps/web`. Einzige Ergänzung außerhalb der eigenen
Hoheit: eine Zeile `export * as grc from "./grc/index.js";` in `src/index.ts`.
