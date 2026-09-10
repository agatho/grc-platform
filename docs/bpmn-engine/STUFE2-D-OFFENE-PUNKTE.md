# Stufe 2 / D — Die offenen Punkte: GRC-Datenweg, Divergenzklassen, Bedienlücken

Repo `/work/repo`, Branch `audit/full-2026-08-31`, aufgesetzt auf `710df2b8`.
Nicht committet, wie beauftragt.

**In drei Sätzen.** Die GRC-Diagrammschicht hat einen Datenlieferanten: ein
Endpunkt liefert für einen Prozess den typisierten Datensatz aus Plan §3.3.6,
und zwei Einbindungsstellen reichen ihn durch — **13 der 23 Layer** bekommen
damit echte Daten, 10 bleiben mangels Schema leer und sagen das auch. Die
Divergenzklassen gegen `bpmn-js` sind von **147 `ours-wrong` auf 77** gefallen,
drei Klassen sind begründet umgestuft und zwei Werkzeugfehler des Prüfstands
behoben; die beiden größten Einzelursachen waren ein nie aufgerufener Dienst
(`CroppingConnectionDocking`) und ein fehlendes Auto-Resize. Von den kleineren
Bedienlücken sind **Auto-Resize, Containerwechsel per Tastatur, Suche und
Tastaturhilfe** geschlossen; Drill-down und der automatische Typwechsel beim
Anheften bleiben offen und stehen begründet in §5.

---

## 0. Stand in Zahlen

| Messwert                                                          | vorher (Stand C)      | jetzt                              |
| ----------------------------------------------------------------- | --------------------- | ---------------------------------- |
| Layer mit echten Daten (von 23)                                   | **0** (kein Endpunkt) | **13**                             |
| Einbindungsstellen, die GRC-Daten durchreichen                    | **0 von 4**           | **2 von 4** (Bearbeiten, Vorschau) |
| `ours-wrong`-Divergenzen, 100 Folgen à 10 Operationen, Seed 13337 | **147**               | **77**                             |
| davon `waypoints/*/position`                                      | 42 + 8 (MessageFlow)  | **20 + 2**                         |
| davon `bounds/bpmn:{SubProcess,Participant}`                      | 8 + 7                 | **1 + 0**                          |
| davon `outcome/connect/applied-vs-rejected`                       | 4                     | **0**                              |
| `intentional` (begründet umgestuft)                               | 0 (nach Bearbeitung)  | **26**                             |
| `reference-wrong`                                                 | 0                     | **5**                              |
| unklassifiziert                                                   | 0                     | **0**                              |
| Tests `packages/bpmn`                                             | 711                   | **727**                            |
| Tests `apps/web`                                                  | 2.430                 | **2.473**                          |
| `npx tsc --noEmit` über 13 tsconfigs                              | 13 grün               | **13 grün**                        |
| `PROPERTY_STRICT=1`, 500 Folgen je Startwert (5 Startwerte)       | grün                  | **5 von 5 grün, 0 geworfen**       |
| Migrationen auf frischer Datenbank von Null                       | 407/407               | **408/408** (neu: `0443`)          |

---

## 1. Aufgabe 1 — `decorateGrc` hat einen Lieferanten

### 1.1 Was gebaut wurde

| Datei                                                             | Was                                                                         |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `apps/web/src/app/api/v1/processes/[id]/diagram-overlay/route.ts` | Der Endpunkt aus Plan §3.3.6 — Beschaffung, sonst nichts                    |
| `apps/web/src/lib/grc-overlay.ts`                                 | Der **reine** Rechenkern: Zeilen → `GrcOverlayData`, ohne Netz und ohne Uhr |
| `apps/web/src/hooks/use-grc-overlay.ts`                           | Ein Aufruf statt vier; `enabled` schaltet die Abfrage ab, nicht die Anzeige |
| `apps/web/src/components/bpmn/grc-view-select.tsx`                | Die Sichtwahl (9 Sichten) samt Datenstand                                   |
| `apps/web/src/app/(dashboard)/processes/[id]/page.tsx`            | Verdrahtung an der Bearbeitungsfläche **und** an der Vorschau               |
| `packages/db/drizzle/0443_process_framework_mapping_step.sql`     | Eine nullable Spalte, die einen ganzen Layer nutzbar macht (§1.4)           |

Die Route folgt den Konventionen des Repos ohne Ausnahme: `withErrorHandler`
**und** `withAuth(...)` — der Wrapper ist nicht Zierde, sondern die Bedingung
dafür, dass `withAuth` die org-gebundene Verbindung binden kann; ohne ihn fragt
der Handler den kontextlosen Pool und RLS filtert jede Zeile weg (der schwerste
Befund der E2E-Triage, `api.ts:184`). Dazu `requireModule("bpm", …)`, die
Rollenliste der lesenden BPM-Routen, Zod über die Abfrageparameter und
`Cache-Control: private` — die Antwort ist RLS-gefiltert und damit
nutzerabhängig.

**`?layers=` filtert wirklich.** Eine abgewählte Gruppe wird nicht nur
weggelassen, sie wird gar nicht erst abgefragt; ein Test zählt die
Datenbankaufrufe (`?layers=line-of-defense` → zwei Abfragen statt zwölf). Ein
unbekannter Gruppenname lässt die Validierung mit 422 fehlschlagen, statt still
ignoriert zu werden — sonst wäre `?layers=ropa` eine Zusage, die niemand
einhält.

### 1.2 Welche Layer echte Daten bekommen

**13 von 23.** Alle aus dem heutigen Schema, ohne eine einzige Ersatzangabe.

| Layer                   | Quelle                                                           | Anmerkung                                                                                                |
| ----------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `risk` (F2)             | `process_step_risk ⋈ risk ⋈ user`                                | Rest- und Bruttoscore, Eigentümer, Behandlungsstrategie                                                  |
| `control` (A2)          | `process_step_control ⋈ control`                                 | **mit Titeln** — die Vorstufe kannte nur Zählwerte und musste Platzhalter erzeugen                       |
| `control-coverage` (F1) | zusätzlich `risk_control`                                        | Der Join aus §3.3.6, den der Plan ausdrücklich in den Endpunkt legt — siehe §1.3                         |
| `evidence` (F4)         | `evidence(entity_type='control')`, `control_test.test_date`      | Jüngster Nachweis je Kontrolle; ohne Fälligkeitsspalte greift die Altersregel der Schicht                |
| `control-test` (F13)    | `control_test.toe_result` des letzten Tests                      | „geprüft und bestanden", nicht „es gibt eine Kontrolle"                                                  |
| `finding` (A3)          | `finding.process_step_id`, `remediation_due_date`                | **Dreistufig** — die Fälligkeit gibt es, sie hieß nur nicht `due_at` (§1.3)                              |
| `line-of-defense` (A4)  | `process_step.line_of_defense`                                   |                                                                                                          |
| `call-activity` (A5)    | `process_step.called_process_id` + serverseitiges Aggregat       | Roll-up: Risikoanzahl, Höchst- und Summenscore, Abdeckungsquote, offene Feststellungen des Zielprozesses |
| `asset` (B1)            | `process_step_asset ⋈ asset`                                     | Kritikalität aus `protection_goal_class`, CIA-Profil aus den drei Vorgabewerten                          |
| `raci` (B2)             | `process_step.raci_*_role_id ⋈ custom_role`                      | **Nur R und A** — C und I haben keine DB-Heimat (§1.5)                                                   |
| `comments` (F9)         | `process_comment(entity_type='process_step')`                    | Offene und Gesamtstränge, letzter Autor, letzter Zeitpunkt                                               |
| `operations` (B4)       | `simulation_activity_param` des zuletzt aktualisierten Szenarios | `activity_id` ist die BPMN-Element-ID — die einzige Quelle, die direkt am Element hängt                  |
| `framework` (F8)        | `process_framework_mapping.process_step_id`                      | **Erst durch Migration 0443** (§1.4); vorher strukturell datenlos                                        |

Zusätzlich befüllt, aber ohne eigenen Layer: `elements[].dmnDecision`
(`dmn_decision.linked_process_step_id`) — der Vertrag führt das Feld, die
Diagrammschicht zeigt es heute nicht.

### 1.3 Drei Stellen, an denen die Vorstufe zu wenig wusste

Der Bericht C hielt fest, dass die Brücke `bpmn-grc-bridge.ts` bestimmte Felder
nicht liefern kann. Zwei dieser Einschränkungen waren Eigenschaften der
**Client-Routen**, nicht des Schemas, und fallen mit dem Endpunkt weg:

1. **Kontrolltitel.** `GET /control-coverage` liefert je Aktivität nur
   `controlCount`/`effectiveCount`; die Brücke musste Platzhalter mit leerem
   Titel erzeugen. Der Endpunkt liest `control` direkt.
2. **`finding.dueAt`.** `MISSING_TODAY` der Brücke nannte „`finding.due_at`
   existiert im Schema nicht". Das stimmt buchstäblich und ist trotzdem
   irreführend: `finding.remediation_due_date` existiert seit jeher und ist
   genau die Fälligkeit, die A3 meint („Fälligkeit der Maßnahme"). Die
   dreistufige Ampel (offen / ≤14 T / überfällig) ist damit ohne jede
   Schemaänderung befüllbar.
3. **`risks[].controlIds`.** Der Join `process_step_risk ⋈ risk_control ⋈
process_step_control` liefert keine Route. Er steht jetzt im Endpunkt, und
   zwar als **Schnitt**: verknüpft wird nur eine Kontrolle, die das Risiko
   behandelt _und_ an diesem Schritt hängt. Ohne den Schnitt wäre die
   Abdeckungsampel systematisch zu grün — `risk_control` ist mandantenweit, eine
   Kontrolle an einem anderen Schritt deckt diesen hier nicht ab. Ein Test hält
   beide Richtungen fest.

**Und eine Stelle, an der ein naiver Endpunkt still falsch gewesen wäre.**
`finding.severity` ist seit Migration 0293 ISO-19011-konform und kennt zehn
Werte (`major_nonconformity`, `opportunity_for_improvement`, …). Keiner davon
heißt `low`/`medium`/`high`/`critical`. Eine Übernahme des Strings hätte
**jede** Feststellung auf `medium` fallen lassen — eine schwere
Nichtkonformität sähe aus wie eine Anmerkung. Die Zuordnung folgt der
Farbordnung, die die Anwendung selbst benutzt
(`components/control/finding-severity-badge.tsx`), und für die oberste Stufe
derselben Menge, mit der `controls/findings-summary` seinen `criticalCount`
bildet. Zehn Einzelfälle stehen als Test.

### 1.4 Die eine Migration: `0443`

Zehn neue Tabellen und dreizehn Spalten nennt `STUFE2-A2-GRC.md` §5. **Eine**
davon macht mit einer einzigen nullable Spalte einen vollständig gebauten Layer
nutzbar: `process_framework_mapping.process_step_id` für die
Framework-Abdeckungssicht F8 (Chips im Slot TL, Kopfzeile mit Abdeckungsgrad,
Legende — alles gebaut und getestet, nur ohne Daten). Alles Übrige braucht neue
Tabellen (`process_lane`, `sod_rule`, `process_step_ropa`, `process_step_bia`,
`process_event_activity_map` …) und gehört in die Arbeitspakete, die diese
Objekte einführen, nicht an den Rand einer Engine-Umstellung.

- `process_step_id uuid NULL`, `ON DELETE SET NULL` — **nicht** CASCADE: wird
  der Schritt gelöscht, fällt die Anforderung auf die Prozessebene zurück, wo
  sie vorher stand. Eine CASCADE entfernte beim Umbau eines Diagramms still
  Compliance-Zuordnungen.
- Der funktionale Eindeutigkeitsindex aus 0335 wird durch eine Variante ersetzt,
  die den Schritt mitführt.
- **Ein Fund beim Verifizieren.** Die Tabelle trug zusätzlich noch die
  ursprüngliche Tabellenbedingung `UNIQUE(process_id, catalog_entry_id)`, die
  0335 übersehen hatte. Sie ist strenger als der funktionale Index, der sie
  ablösen sollte, und hätte die neue Spalte in genau dem Fall unbrauchbar
  gemacht, für den sie da ist: derselbe Katalogeintrag einmal am Prozess und
  einmal an einem Schritt. Gefunden **nur** dadurch, dass die Migration gegen
  eine leere Datenbank gefahren und der Indexbestand danach angesehen wurde.

**Verifikation gegen eine frische Datenbank von Null** (PostgreSQL 16.15,
eigener Cluster, `pgcrypto`, Rollen `grc`/`grc_app`):

```
✓ 603 tables created
✓ 408/408 migrations applied
```

Danach mit Fixturedaten geprüft: Spalte `uuid`, nullable; Index
`pfm_process_step_idx`; Fremdschlüssel `pfm_process_step_fk` mit
`confdeltype='n'` (SET NULL); und der eigentliche Beleg — derselbe
Katalogeintrag ließ sich einmal am Prozess und einmal am Schritt anlegen, und
die Abfrage des Endpunkts liefert genau die Schrittzeile.

Alle **zwölf** Abfragen des Endpunkts wurden zusätzlich gegen dieses Schema
gefahren, erst leer (Syntax, Spaltennamen, Enum-Literale) und dann mit einem
Fixture aus zwei Prozessen, zwei Risiken, zwei Kontrollen, einem Kontrolltest,
einem Nachweis, zwei Feststellungen, einem Asset, zwei Kommentaren, einem
Simulationsszenario und einer DMN-Entscheidung. Der Roll-up des aufgerufenen
Prozesses rechnete dabei `riskCount 1, max 16, sum 16, covered 16,
openFindings 1` — die Zahlen, die das Fixture hergibt.

### 1.5 Welche Layer leer bleiben, und warum

Zehn Layer. `MISSING_TODAY` in `lib/grc-overlay.ts` führt jedes weggelassene
Feld mit Grund; ein Test prüft, dass die dort genannten Felder im Ergebnis
tatsächlich **fehlen**, statt still mit einem Ersatzwert dazustehen.

| Layer                                                      | Fehlt im Schema                                                                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sod` (F3)                                                 | `sod_rule` — es gibt keine Regelmenge für Aufgabentrennung                                                                                           |
| `outage` (F6)                                              | `process_step_bia` (MTPD/RTO/RPO je Schritt); ohne Elementebene wäre der Reißpunkt geschätzt                                                         |
| `bcm` (§3.10)                                              | dito — `bia_process_impact` hängt am Prozess                                                                                                         |
| `privacy`, `dpia`, `dataCategory`, `retention` (§3.9, F10) | `process_step_ropa`, `process_step_data_category` — `process_ropa_profile` ist 1:1 je Prozess                                                        |
| `trust-boundary` (F5), `lane` (F17)                        | `process_lane` — es gibt keine Lane-Tabelle                                                                                                          |
| `conformance` (F7)                                         | `process_event_activity_map` — `process_event.activity` ist ein Name, keine BPMN-ID. Die Schicht **verweigert** F7 ohne Abdeckungsquote ausdrücklich |
| `document` (§3.6)                                          | `process_step_document` — `process_document` hängt am Prozess                                                                                        |

Dazu drei Felder innerhalb sonst gefüllter Layer:

- `controls[].isKey` — `control.is_key` fehlt; jede Schlüsselkontroll-Markierung
  wäre geraten.
- `controls[].ownerRole` — `control.owner_id` zeigt auf einen **Benutzer**, nicht
  auf eine Rolle. Damit ist die Selbstkontroll-Prüfung (§3.4/A4) nicht rechenbar.
- `raci.consulted/informed` — `process_step_raci` fehlt. `process_raci_override`
  kennt C und I zwar, benennt die Beteiligten aber über rohe **BPMN-Lane-IDs**
  ohne Fremdschlüssel auf `custom_role`. Eine Lane als Rolle auszugeben wäre
  genau die Sorte Erfindung, die dieser Endpunkt nicht macht — vierzehn
  Codepfade dieses Produkts haben erfundene Prüfergebnisse geschrieben, und das
  war ein Critical-Finding.

### 1.6 Die Verdrahtung in der Oberfläche

`GrcViewSelect` steht über der Bearbeitungsfläche (`EditorTab`) und über der
Vorschau (`OverviewTab`), jeweils mit eigenem Zustand, weil die beiden Reiter
nie gleichzeitig gerendert werden. **`null` heißt aus** — dann wird der
Endpunkt gar nicht erst befragt und die vier HTML-Badge-Kanäle arbeiten wie
bisher. Ist eine Sicht gewählt, lassen die Kanäle die Fläche in Ruhe: dieselbe
Aussage zweimal am selben Element wäre kein Mehrwert, sondern ein Widerspruch in
spe (die Regel steht seit C §1.3 im Adapter).

Zwei Festlegungen, die nicht offensichtlich sind:

- **Ein Fehlschlag ist kein leerer Datensatz.** `data` bleibt `undefined`, die
  Fläche zeichnet ihre Badges weiter. Ein leerer Datensatz hieße „keine Risiken,
  keine Kontrollen" — das ist eine Aussage, und eine falsche.
- **`computedAt` steht neben der Auswahl.** Es ist Pflichtfeld des Vertrags, und
  eine Antwort ohne es wird verworfen, statt einen Stand zu behaupten, den
  niemand kennt.

Die Sichtliste ist in `grc-view-select.tsx` wiederholt und **nicht** aus
`@grc/bpmn/grc` importiert: ein Wertimport zöge die 23 Layer in das Bündel jeder
Prozessseite, auch dort, wo niemand eine Sicht einschaltet. Ein Test hält die
Wiederholung gegen `GRC_VIEWS` — eine Wiederholung ohne Wächter driftet.

Offen bleiben die zwei **lesenden** Einbindungen ohne eigene Sichtwahl (Dialog
„Version ansehen", Mitarbeitersicht `my-processes/[id]`). Beide sind eine Zeile
Verdrahtung, sobald jemand entscheidet, ob dort eine Sichtwahl hingehört; in
der Mitarbeitersicht spricht einiges dagegen.

---

## 2. Aufgabe 2 — Die Divergenzklassen gegen `bpmn-js`

Gemessen wie im Bericht A3: 100 erzeugte Folgen à 10 Operationen, Startwert
13337, über `representativeBases()`.

```
vorher:   {"ours-wrong":147}
nachher:  {"ours-wrong":77,"intentional":26,"reference-wrong":5}   unklassifiziert: 0
```

### 2.1 Zuerst: zwei Fehler im Prüfstand selbst

Ohne diese beiden hätte die Klassenarbeit die falschen Fragen gestellt.

**(a) Der Referenztreiber zählte Ebenen-Wurzeln als Kandidaten.** `bpmn-js`
hält eine Wurzel je `BPMNPlane`; die Wurzel der Ebene eines aufgeklappten
Subprozesses ist selbst vom Typ `bpmn:SubProcess`. Der `container`-Fall der
beiden Treiber filterte Wurzeln ausdrücklich heraus (mit Begründung im Code),
der `activity`-Fall **nicht**. Gemessen: `synth-boundary-events` bot `bpmn-js`
drei „activity"-Kandidaten (`Sub_Pruefung`, `Sub_Pruefung_plane`,
`Task_Freigabe`) gegen zwei bei ARCTOS — eine Kandidatendivergenz **vor der
ersten Operation**, gemeldet gegen eine Engine, die noch nichts getan hatte.
Gefunden, indem die Kandidatenlisten aller 26 Korpusdokumente direkt nach dem
Import verglichen wurden; behoben in **beiden** Treibern, damit sie dieselbe
Frage stellen und nicht nur zufällig dieselbe Antwort geben.

**(b) `outcome/*/threw` nannte nicht, wer geworfen hat.** Die Klasse war als
`intentional` eingestuft, mit der zutreffenden Begründung, der _Stil_ der
Ablehnung sei keine Modelldifferenz. Das gilt, solange geworfen wird **statt**
abzulehnen — nicht, wenn eine Engine abstürzt. Genau das trat auf, sobald das
Auto-Resize die Geometrie veränderte: `bpmn-js` warf in `LabelLink` über
`path-intersection` (`Cannot read properties of null (reading 'length')`, eine
jsdom-Grenze). Die alte Signatur hätte den Absturz der Referenz als gewollte
Abweichung durchgewinkt. Jetzt: `threw-both` → `intentional`,
`threw-reference` → `reference-wrong`, `threw-ours` → `ours-wrong`.

### 2.2 Die Klassen, einzeln

| Klasse                                 | vorher |  jetzt | Urteil                | Ergebnis                                                      |
| -------------------------------------- | -----: | -----: | --------------------- | ------------------------------------------------------------- |
| `waypoints/bpmn:SequenceFlow/position` |     34 |     20 | `ours-wrong`          | **Hauptursache behoben** (§2.3)                               |
| `waypoints/bpmn:MessageFlow/position`  |      7 |      2 | `ours-wrong`          | dieselbe Ursache                                              |
| `waypoints/bpmn:SequenceFlow/count`    |     19 |     34 | `ours-wrong`          | Teilursache behoben, Klasse wächst durch längere Läufe (§2.4) |
| `candidate-set/*`                      |     53 | 18+7+1 | **`intentional`**     | umgestuft, mit Richtung in der Signatur (§2.5)                |
| `candidate-set/*/more-ours`            |      — |      4 | `ours-wrong`          | Restfall, benannt (§2.5)                                      |
| `bounds/bpmn:{SubProcess,Participant}` |     12 |    1+0 | `ours-wrong`          | **Auto-Resize gebaut** (§2.6)                                 |
| `bounds/bpmn:EndEvent`                 |      — |      1 | `ours-wrong`          | neu sichtbar geworden, benannt (§2.6)                         |
| `outcome/connect/applied-vs-rejected`  |      3 |      0 | —                     | **behoben** (§2.7)                                            |
| `outcome/attachBoundary/…`             |      6 |      0 | —                     | behoben (Vorstrom, `canAttach`)                               |
| `outcome/reparent/applied-vs-rejected` |      — |      1 | `ours-wrong`          | begründet **nicht** angeglichen (§2.7)                        |
| `outcome/createShape/…`                |      — |      2 | `ours-wrong`          | offen, Fall benannt                                           |
| `outcome/*/threw-reference`            |      — |      5 | **`reference-wrong`** | umgestuft (§2.1b)                                             |
| `element-set/*`, `element-type/*`      |      8 |      9 | `ours-wrong`          | Folgeschaden, siehe §2.8                                      |
| `element-name/…/name`                  |      — |      1 | `ours-wrong`          | neu klassifiziert, gering                                     |
| `bounds/…/created`                     |      1 |      0 | `ours-wrong`          | tritt im Lauf nicht mehr auf                                  |

### 2.3 Wegpunktposition — ein Dienst war registriert und wurde nie gerufen

**Der Befund.** `layoutConnection` liefert Wegpunkte, die in den **Mittelpunkten**
von Quelle und Ziel beginnen und enden; so verlangt es `ManhattanLayout`, das
die Mitten braucht, um die Richtung zu bestimmen. Sichtbar werden darf das
nicht — eine Kante, die im Mittelpunkt einer Aktivität beginnt, liegt quer über
deren Beschriftung. `diagram-js` bringt dafür `CroppingConnectionDocking` mit,
und `src/modeling/index.ts` registrierte den Dienst auch als
`connectionDocking`. **Aufgerufen hat ihn niemand.** Die Referenz schneidet in
genau zwei Kommandos ab (`connection.layout`, `connection.create`, in ihrem
`BpmnUpdater`); unser Updater tat es in keinem.

**Wie es gefunden wurde.** Nicht am Bild. Die Signatur meldete durchgängig
Differenzen von einer halben Formbreite — gemessen `170` gegen `188` an einem
36 px breiten Ereignis, also Mitte gegen rechten Rand. Am Bild fiel es nicht
auf, weil die 11 Referenzbilder nur **importierte** Diagramme zeigen und
importierte DI gelesen und nicht gerechnet wird. Der Vergleichslauf ist damit
das einzige Werkzeug der Kette, das diesen Fehler sehen konnte.

**Behebung.** `BpmnUpdater.cropConnection` an denselben zwei Hakenpunkten wie
die Referenz, mit `context.cropped` gegen doppeltes Abschneiden und einem
`try`-Rahmen: ungeschnittene Wegpunkte sind hässlich, eine geworfene Ausnahme
mitten in einem Kommando ist Datenverlust. Wirkung: 42+8 → 20+2.

### 2.4 Wegpunktanzahl — halb behoben, und der Rest ist benannt

**Behoben.** Der Layouter setzte einen fehlenden `connectionStart`/
`connectionEnd`-Hinweis auf `getMid(shape)`. Das ist der richtige Ersatzwert für
eine **neue** Kante und der falsche für eine bestehende: `repairConnection`
entscheidet anhand der beiden Endpunkte, ob die vorhandene Route noch taugt.
Mit der Formmitte statt des bisherigen Andockpunkts wirkte jede Route
reparaturbedürftig und wurde neu gelegt — aus vier Wegpunkten wurden zwei.
Fachlich ist das Verlust: eine von Hand gelegte Kantenführung überlebt das
Verschieben eines _anderen_ Knotens nicht. `dockingOf()` liest den Andockpunkt
jetzt aus den vorhandenen Wegpunkten (samt `original`, dem Punkt vor dem
Abschneiden) — dieselbe Regel, die die Referenz benutzt.

**Belegt in Isolation:** ein `move` eines Flussknotens in
`synth-foreign-camunda-extensions` liefert für `FF_1`…`FF_3` jetzt in **beiden**
Engines byteweise dieselben Wegpunkte (vorher/nachher, vier Punkte, gleiche
Koordinaten).

**Was bleibt.** Dieselbe Signatur tritt weiterhin _innerhalb längerer Folgen_
auf, und in den angesehenen Fällen immer nach einem `undo`/`redo`-Paar. Die
Vermutung: eine Engine legt beim Redo neu, die andere stellt die gespeicherte
Route wieder her. Die Zahl **steigt** gegenüber vorher (19 → 34), weil weniger
Läufe vorzeitig abbrechen — die Klasse wird also nicht schlimmer, sie wird
länger gemessen. Sie ist der größte offene Einzelposten und in `shadow.ts` mit
dieser Diagnose vermerkt.

### 2.5 Kandidatenmenge — umgestuft, mit Richtung

53 Divergenzen in einer Klasse, die zwei **gegensätzliche** Sachverhalte
zusammenwarf. Die Signatur trägt jetzt die Richtung
(`…/more-ours`, `…/more-reference`), und die Meldung nennt die Kennungen, die
nur eine Seite kennt.

- **`more-reference` (26) → `intentional`.** `bpmn-js` materialisiert **jede**
  `BPMNPlane`: ein aufgeklappter Subprozess in eigener Ebene wird eine zweite
  Wurzel, und seine Kinder kommen in die Registry. ARCTOS' Modellierungsimporter
  liest **eine** Ebene (`importer.ts::resolvePlane`) und warnt, wenn das Dokument
  mehr hat. Gemessen an `synth-nested-subprocesses`: `bpmn-js` bietet
  `[Process_Nested, Sub_L1, Sub_L2]`, ARCTOS die ersten beiden. Das ist die
  Drill-down-Lücke (§5), keine Verfälschung: die tieferen Ebenen bleiben
  unangetastet im Dokument stehen, weil nichts in dieser Schicht sie anfasst.
  Sie als Defekt der Engine zu zählen — einmal je erzeugter Folge — hätte die
  Statistik über eine bekannte Funktionslücke geführt.
- **`more-ours` (4) → bleibt `ours-wrong`.** Zwei Ursachen, im Korpus
  unterscheidbar, in der Signatur noch nicht: (a) gewollt — ARCTOS ergänzt beim
  Import fehlende DI und kennt deshalb Flusselemente, die `bpmn-js` mangels
  `BPMNShape` fallen lässt (dieselbe Entscheidung wie
  `bounds|waypoints/*/presence/only-ours`); (b) echt — nach `connect` + `undo`
  ein `bpmn:SequenceFlow` zu viel. (b) hält das Urteil: ein Element zu viel nach
  einem Undo ist der Anfang derselben Familie wie die DI-Lecks, die der
  Eigenschaftstest gefunden hat.

### 2.6 Container-Bounds — Auto-Resize gebaut

`bounds/bpmn:{SubProcess,Participant}` war die fehlende Funktion selbst: ein
Container wuchs nicht, und die beiden Engines endeten 90 px auseinander (300
gegen 390 an `E_EventSub`).

`src/modeling/behaviors/AutoResizeBehavior.ts` benutzt `diagram-js`'
`features/auto-resize` — Auslöser, Randabstände, Auslöseschwelle, Rekursion nach
oben und die Regel `element.autoResize` sind damit **dieselbe Rechnung** auf
beiden Seiten. Nachgebaut wäre daraus eine zweite Wahrheit über dieselbe
Geometrie, und die Zahlen des Vergleichslaufs stimmten bestenfalls zufällig
überein. Eigen ist nur die BPMN-Antwort:

- **Wer wächst:** aufgeklappte `SubProcess`/`Transaction`/`AdHocSubProcess` und
  `Participant`. Ein eingeklappter Subprozess zeigt seinen Inhalt gar nicht;
  ihn wachsen zu lassen wäre eine Reaktion auf etwas, das niemand sieht. Eine
  Lane löst kein Wachstum aus und wächst nicht für sich.
- **Wie ein Pool wächst:** `redistributeLanes` verteilt die neue Höhe im
  bisherigen Verhältnis auf die Lanes, die **letzte** bekommt den Rundungsrest.
  Das ist die Eigenschaft, an der es hängt — bliebe ein Pixel übrig, entstünde
  ein Streifen ohne Lane, und ein Knoten dort verlöre seine `flowNodeRef`. Ein
  Test prüft die Lückenlosigkeit mit Zahlen (700×260 → 700×390, Lanes 130 → 195
  je, Kanten exakt aneinander).

Ergebnis: 12 → 1. Der Rest ist eine 5-px-Differenz (515 gegen 520), die aus der
**Position der neu erzeugten Form** stammt, nicht aus dem Resize.

Neu sichtbar geworden ist dabei `bounds/bpmn:EndEvent` (1): wächst ein Pool,
macht `bpmn-js` mit seinem `resizeLane` zusätzlich **Platz**, indem es den
Inhalt der Lane mitverschiebt (`SpaceTool`-Pfad); ARCTOS verteilt die
Lane-_Bounds_ und lässt die Knoten stehen (End_Bank y=255 gegen y=275). Keine
Seite verliert Daten, beide Dokumente sind gültig. Das Urteil bleibt
`ours-wrong` nach Beweislast: das Verhalten der Referenz ist das, was die
Benutzer des alten Editors kennen.

### 2.7 Regelparität — einer behoben, einer begründet nicht

**`connect` (4 → 0), behoben, und nicht durch Nachahmung.** ARCTOS ließ einen
Nachrichtenfluss auf **jedes** Ereignis enden; gemessener Fall
`Task_Bank_Entscheiden → End_Kunde` über die Poolgrenze. BPMN 2.0 gibt einem
Nachrichtenfluss eine Richtung: senden darf ein _werfendes_ Ereignis (End,
Zwischen-Wurf), empfangen ein _fangendes_ (Start, Zwischen-Fang). Ein
Nachrichtenfluss **auf** ein End-Ereignis hieße „dieses Ereignis empfängt eine
Nachricht" — ein End-Ereignis empfängt nichts, es beendet. Referenz und
Spezifikation stimmen überein, ARCTOS war der Ausreißer.
`BpmnRules.isMessageFlowSource/isMessageFlowTarget` ersetzt die eine bisherige
Funktion `isMessageEndpoint`, die beide Seiten gleich behandelte.

Nicht übernommen wurde die zusätzliche Strenge der Referenz, eine
`bpmn:MessageEventDefinition` zu verlangen: sie lässt ein Ereignis **ohne** jede
Ereignisdefinition ebenfalls zu, und ein frisch gezeichnetes Zwischenereignis
hat noch keine.

Zwei Bestandstests haben dabei ihre Aussage geändert und wurden begründet
umgeschrieben (beide benutzten ein **Start**-Ereignis als Quelle eines
Nachrichtenflusses — genau der Fall, den die Korrektur verbietet):
`operations.test.ts` verbindet jetzt zwei Aktivitäten, `findings.test.ts` §C.2
bewegt eine Aktivität statt des Start-Ereignisses und prüft im selben Zug beide
Richtungen — die Kante, für die es einen Ersatztyp gibt (wird ersetzt), und die,
für die es keinen gibt (wird entfernt).

**`reparent` (1), begründet nicht angeglichen.** ARCTOS erlaubt
`elements.move` für ein Randereignis, wenn das genannte Ziel der Container ist,
den es ohnehin hat — ein Null-Reparent. `bpmn-js` lehnt jede Bewegung eines
Randereignisses mit genanntem Ziel ab, weil es Randereignisse über `attach`
führt. Beide sind in sich stimmig, und die entstehenden Dokumente sind
identisch. **Nicht angeglichen**, weil genau dieser Zweig (`element.parent ===
target`) es `attach-support` erlaubt, einen Wirt samt Anhängern zu bewegen; ihn
zu entfernen machte jede Aktivität mit Randereignis unziehbar — eine Regression,
die weit teurer wäre als eine Divergenz in hundert Folgen. Der Fall steht mit
dieser Begründung in `DIVERGENCE_RULES`.

### 2.8 Elementmenge und -typ (9)

Bleiben `ours-wrong`. Der angesehene Fall ist aufschlussreich: in einer einzigen
Folge treten vier dieser Signaturen gemeinsam auf, weil die beiden Engines nach
einem `attachBoundary` + Ablösen eine **unterschiedliche Zahl** erzeugter
Elemente halten — `bpmn-js` ersetzt ein abgelöstes Randereignis durch ein
Zwischen-Fang-Ereignis (`DetachEventBehavior`), ARCTOS behält den Typ. Die
Ausrichtung der erzeugten Kennungen (`gen-0`, `gen-1`, …) läuft danach
auseinander, und der Vergleich stellt Elemente gegenüber, die nichts
miteinander zu tun haben. Das ist zugleich ein Hinweis auf eine **Schwäche des
Prüfstands**: `normalizeGeneratedIds` richtet positionell aus. Eine
inhaltsbasierte Ausrichtung (Typ + Container + Nachbarn) wäre die nächste
Verbesserung dort — nicht mehr in dieser Stufe.

---

## 3. Aufgabe 3 — Die kleineren offenen Punkte

### 3.1 Geschlossen

| Punkt (aus C §5)                     | Umsetzung                                                   |
| ------------------------------------ | ----------------------------------------------------------- |
| **6. Auto-Resize**                   | `src/modeling/behaviors/AutoResizeBehavior.ts` — siehe §2.6 |
| **7. Containerwechsel per Tastatur** | `src/editor/ContainerMode.ts`, Taste `m`                    |
| **8a. Suche**                        | `src/editor/Find.ts`, Taste `/`                             |
| **8b. Tastaturhilfe**                | `src/editor/KeyboardHelp.ts`, Taste `?`                     |

**Containerwechsel (`m`).** Für ein Pool-Diagramm die spürbarste Lücke: eine
Aktivität in die richtige Lane zu bringen ist dort keine Zierde, sondern die
Aussage des Diagramms — die Lane sagt, _wer_ den Schritt tut, und `flowNodeRef`
hängt daran. Bedient wird wie das Verbinden (`c`): Modus starten, mit `←`/`→`
durch die **zulässigen** Container blättern (`rules.allowed("elements.move", …)`
— genau die Frage, die auch der Zug mit der Maus stellt), `Enter` legt hinein,
`Escape` bricht ab. Dieselben Tasten sind Absicht: beide Betriebsarten stellen
dieselbe Frage („welches von diesen hier?"), und wer eine kann, soll die andere
nicht neu lernen müssen. Die ganze Auswahl wandert gemeinsam; einzeln zu
verschieben ließe das Diagramm zwischendurch in einem Zustand stehen, den die
Invarianten zu Recht bemängeln. Der bisherige Container steht **nicht** zur
Wahl. Fünf Tests, darunter der volle Weg über `KeyboardEvent`s mit Invarianten
nach der Handlung und nach dem Undo (ein Strg-Z).

**Suche (`/`).** Ein Diagramm mit 60 Aktivitäten hat keine Gliederung; die
Graphnavigation führt Schritt für Schritt am Kontrollfluss entlang, und das ist
genau dann zu langsam, wenn man weiß, wohin man will. Getroffen wird auf Name,
Kennung und Typbezeichnung, nach Groß-/Kleinschreibung **und Akzenten**
normalisiert: wer „prufung" tippt, meint „Prüfung", und ein Werkzeug, das
darauf besteht, ist keines. Die Suche blendet nichts aus und ändert nichts — sie
wählt aus, rückt in den Blick und sagt an. Ein Tastendruck im Eingabefeld
schlägt nicht als Editortaste durch (sonst löschte `Entf` beim Tippen das
ausgewählte Element); ein Test hält das fest.

**Tastaturhilfe (`?`).** Die Schicht behauptet, ohne Maus vollständig bedienbar
zu sein. Eine Belegung, die man nur durch Lesen des Quelltextes erfährt, macht
diese Zusage wertlos. `KEY_BINDINGS` ist die **einzige** Quelle, und ein
Wächtertest fährt jede genannte Einzeltaste durch die Tastenbehandlung: eine
Hilfe, die von der Bedienung abweicht, ist schlimmer als keine — sie schickt den
Nutzer auf eine Taste, die nichts tut, und er schließt daraus, dass die Funktion
fehlt.

Beide neuen Flächen bauen ihr DOM mit `createElement`/`textContent` statt
`innerHTML`. Das ist keine Vorsicht, sondern eine Auflage des Repos
(`S12-15`, geprüft von `apps/web/src/__tests__/security/frontend-invariants.test.ts`
über den **ganzen** Baum) — die erste Fassung dieser Dateien ist genau daran
rot geworden.

Die zugehörigen Stile stehen in `apps/web/src/components/bpmn/arctos-bpmn.css`.

### 3.2 Nicht geschlossen, mit Grund

- **Drill-down in Subprozesse.** Der Modellierungsimporter liest eine
  `BPMNPlane` (`resolvePlane`); mehrere Ebenen zu halten heißt, je Ebene eine
  Wurzel zu führen, `elements.move` über Wurzelgrenzen zu klären und den Export
  auf die richtige Ebene zurückzuschreiben. Das ist ein Arbeitspaket, keine
  Ergänzung — und es ist zugleich die Ursache der größten `intentional`-Klasse
  (§2.5). Die tieferen Ebenen bleiben unangetastet im Dokument stehen; es geht
  nichts verloren, es ist nur nicht bearbeitbar.
- **Automatischer Typwechsel Ereignis → Boundary-Event beim Anheften.** Die
  Regel lässt das Anheften eines Zwischenereignisses zu (`canAttach`), der
  Typwechsel selbst fehlt. Ihn in einem `preExecute` von
  `element.updateAttachment` auszulösen hieße, ein Element mitten in einem
  laufenden Kommando zu ersetzen — die Referenz tut das in einem eigenen
  Verhalten auf `elements.move`/`postExecuted`, und das ist der Weg, der hier
  nachzubauen wäre. Bewusst nicht in derselben Änderung wie das Auto-Resize:
  beide greifen in `elements.move` ein, und zwei neue Eingriffe an einer Stelle
  gleichzeitig sind eine Ursache zu viel, wenn etwas schiefgeht.
- **`chrome: "full"` im Lesemodus**, **Moduswechsel zur Laufzeit**,
  **`bpmn:Group`-Beschriftung über `CategoryValue`**, **Space-/Lasso-/
  Hand-Werkzeug** — unverändert offen aus C §5.

---

## 4. Nicht abkürzbar: der Shadow-Compare-Betrieb

Plan §5.6, Kriterium 3 verlangt **30 Tage bzw. 500 Speichervorgänge** ohne
Abweichung. Das ist ein **Zeitkriterium**, kein Arbeitspaket: die Funktion
`shadowCompare()` trägt es ohne Umbau (A3 §6, Punkt 5), und der Editor kann seit
Stufe C speichern — was fehlt, ist verstrichene Zeit unter echter Benutzung.
Es lässt sich weder durch mehr Testläufe noch durch mehr erzeugte Folgen
ersetzen; beides misst etwas anderes. Vermerkt als das, was es ist.

Sinnvoll wäre, den Betrieb **jetzt** zu beginnen: die Zahl der offenen
`ours-wrong`-Klassen ist um die Hälfte gefallen, und die verbliebenen sind
geometrisch (Wegpunkte, 5 px Containerbreite) — sie erzeugen im Betrieb
Abweichungsmeldungen, aber keine Datenverluste.

---

## 5. Was offen bleibt

**Aus dieser Arbeit**

1. `waypoints/bpmn:SequenceFlow/count` (34) — größter offener Posten, Diagnose
   in §2.4 (Verdacht: Relayout beim Redo).
2. `waypoints/bpmn:SequenceFlow/position` (20) — Restfälle nach der
   Docking-Korrektur.
3. `element-set`/`element-type` (9) — teils Folgeschaden der positionellen
   `gen-`-Ausrichtung des Prüfstands (§2.8).
4. `candidate-set/*/more-ours` (4) — ein `bpmn:SequenceFlow` zu viel nach
   `connect` + `undo`.
5. `bounds/bpmn:EndEvent` (1) und `bounds/bpmn:SubProcess` (1) — Lane-Inhalte
   beim Poolwachstum, 5 px an einer erzeugten Form.
6. `outcome/createShape` (2) — Task bzw. EventBasedGateway in der Wurzel von
   `synth-nested-subprocesses`.
7. Drill-down und Typwechsel beim Anheften (§3.2).
8. Die zwei lesenden Einbindungen ohne Sichtwahl (§1.6).

**Datenseitig** — zehn Layer warten auf Schema (§1.5). Nach Hebelwirkung
geordnet: `process_lane` (schaltet F5, F17 und den Lane-Bezug von F3 frei),
`process_step_ropa` + `process_step_data_category` (vier Layer),
`process_step_bia` (zwei), `sod_rule` (einer, aber der prüfungsrelevanteste),
`process_event_activity_map` (F7).

**Unverändert aus C §5** — E2E-Bedienung der Fläche, Produktionsbau mit
`ARCTOS_BPMN_ENGINE=arctos`, gemessener Kontrast, NVDA/VoiceOver,
`packages/shared` als dritte BPMN-Interpretation.

---

## 6. Verifikation

| Prüfung                                                                          | Ergebnis                                                                      |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `npx tsc --noEmit` über **alle 13** `tsconfig.json`                              | **13 von 13 fehlerfrei**                                                      |
| `cd packages/bpmn && npx vitest run --config vitest.config.ts`                   | **grün — 727 Tests, 43 Dateien** (+16)                                        |
| `cd apps/web && npx vitest run`                                                  | **grün — 2.473 Tests, 104 Dateien** (+43)                                     |
| `cd packages/db && npx vitest run`                                               | **grün — 107 Tests**                                                          |
| `PROPERTY_STRICT=1`, 500 Folgen je Startwert 20260902/20260901/424242/4711/13337 | **5 von 5 grün**, je 6.000 Operationen, **0 geworfen**                        |
| Shadow-Compare, 100 Folgen à 10, Seed 13337                                      | **0 unklassifiziert**; 77 `ours-wrong`, 26 `intentional`, 5 `reference-wrong` |
| Shadow-Compare, **Import über den Korpus**                                       | **20 Abweichungen, alle `intentional`** — unverändert exakt                   |
| `npx eslint packages/bpmn/src`, geänderte `apps/web`-Dateien                     | **0 Fehler, 0 Warnungen**                                                     |
| `npx prettier --check` über die geänderten Dateien                               | **grün**                                                                      |
| Migrationen gegen **frische Datenbank von Null** (PostgreSQL 16.15)              | **408/408 angewandt, 603 Tabellen**                                           |
| Alle 12 Endpunktabfragen gegen dieses Schema, leer und mit Fixture               | **fehlerfrei, erwartete Zeilen**                                              |

Nicht meine Dateien und deshalb unangetastet: `apps/web/e2e/**`, `tests/e2e/**`,
`packages/db/src/seed-e2e-users.ts`, `docs/bpmn-engine/E2E-TRIAGE-3.md`,
`packages/db/drizzle/0442_*` (paralleler Arbeitsstrang). Der repoweite
`prettier --check` meldet für genau diese sieben Dateien Formatierungsbedarf;
sie stammen nicht aus dieser Arbeit.

---

## 7. Geänderte Dateien

**Neu**

`apps/web/src/app/api/v1/processes/[id]/diagram-overlay/route.ts`,
`apps/web/src/lib/grc-overlay.ts`,
`apps/web/src/hooks/use-grc-overlay.ts`,
`apps/web/src/components/bpmn/grc-view-select.tsx`,
`apps/web/src/__tests__/lib/grc-overlay.test.ts`,
`apps/web/src/__tests__/api/process-diagram-overlay.test.ts`,
`apps/web/src/__tests__/components/grc-view-select.test.tsx`,
`packages/db/drizzle/0443_process_framework_mapping_step.sql`,
`packages/bpmn/src/modeling/behaviors/AutoResizeBehavior.ts`,
`packages/bpmn/src/editor/ContainerMode.ts`,
`packages/bpmn/src/editor/Find.ts`,
`packages/bpmn/src/editor/KeyboardHelp.ts`,
`packages/bpmn/test/editor/container-find-help.test.ts`.

**Geändert**

| Datei                                                       | Was                                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `packages/bpmn/src/modeling/BpmnUpdater.ts`                 | `cropConnection` — der nie gerufene Dienst (§2.3)                    |
| `packages/bpmn/src/modeling/BpmnLayouter.ts`                | `dockingOf` statt `getMid` als Ersatzwert (§2.4)                     |
| `packages/bpmn/src/modeling/BpmnRules.ts`                   | Richtung des Nachrichtenflusses (§2.7)                               |
| `packages/bpmn/src/modeling/index.ts`                       | `autoResize`, `autoResizeRules` registriert                          |
| `packages/bpmn/src/editor/Keyboard.ts`                      | `m`, `/`, `?`; Betriebsart Containerwechsel                          |
| `packages/bpmn/src/editor/modules.ts`, `index.ts`           | drei neue Dienste registriert und ausgeliefert                       |
| `packages/bpmn/src/verify/shadow.ts`                        | Richtung in `candidate-set` und `threw`; sieben Regeln neu begründet |
| `packages/bpmn/src/verify/drivers/{arctos,bpmnjs}.ts`       | Wurzeln zählen nicht als `activity`-Kandidaten (§2.1a)               |
| `packages/bpmn/test/modeling/{operations,findings}.test.ts` | zwei Tests begründet umgeschrieben (§2.7)                            |
| `packages/db/src/schema/process-grc.ts`                     | `processStepId` deklariert                                           |
| `apps/web/src/app/(dashboard)/processes/[id]/page.tsx`      | Sichtwahl + Datenübergabe an beiden Flächen                          |
| `apps/web/src/components/bpmn/arctos-bpmn.css`              | Stile für Suche, Hilfe, Container-Kandidat                           |
