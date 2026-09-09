# ARCTOS — Register aller offenen Punkte

**Stand:** 2026-09-02 · **Repo:** `/work/repo`, Branch `audit/full-2026-08-31`, HEAD `4caff361`
**Zweck:** Sammlung und Ordnung, kein Plan. Jede Zeile ist ein offener Punkt mit belegter
Herkunft. Wo ein Bericht etwas anderes sagt als der Code, gewinnt der Code — die Abweichung
steht in Abschnitt B.

**Quellen:** 17 Berichte in `docs/bpmn-engine/` (9.865 Zeilen) · `docs/audits/ARCTOS-FULL-2026-08-31-Abschlussbericht.md`
§5 · `docs/audits/ARCTOS-FULL-2026-08-31/` (Findings-Register, 12 Umsetzungsprotokolle) ·
`/work/audit/remediation/` (VERIFIKATION.md, RESTDEFEKTE.md) · Code und die vier Ratschen
(`lint-ratchet`, `coverage-gate`, `audit-i18n-usage`, `audit-dead-exports`), am 2026-09-02 selbst
ausgeführt.

**Kategorien:** `Produktdefekt` · `fehlende Funktion` · `Testlücke` · `Codequalität` · `Betrieb` ·
`Doku` · `Entscheidung des Eigentümers` · `Zeitkriterium`.
**Umfang:** S ≤ 1 Tag · M ≤ 1 Woche · L ≤ 1 Monat · XL > 1 Monat.

---

## Register

| ID     | Titel                                                                                                                                                                                                      | Herkunft (Datei + Abschnitt)                                                                                                                                                                                               | Kategorie                             | Umfang        | Blockiert durch                                                                      | Wert                                                                                                                                                                             |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OP-001 | Keine Oberfläche für die zehn neuen GRC-Tabellen (Lanes, SoD, Schritt-ROPA, Schritt-BIA, Schritt-Dokument, Aktivitätszuordnung)                                                                            | `docs/bpmn-engine/STUFE2-E-SCHEMA.md` §6.4                                                                                                                                                                                 | fehlende Funktion                     | XL            | —                                                                                    | Die Daten, von denen 23 Layer leben, sind heute nur per SQL pflegbar; erst eine Maske macht die Diagrammschicht für Anwender nutzbar.                                            |
| OP-002 | `process_lane` wird beim Import nicht befüllt — Lane-Zugehörigkeit bleibt geometrisch geraten                                                                                                              | `STUFE2-E-SCHEMA.md` §6.6; Code: kein `INSERT INTO process_lane` außerhalb `packages/db/tests/rls/process-diagram-grc-isolation.test.ts:139`                                                                               | Produktdefekt                         | M             | OP-001 (teilweise)                                                                   | Bei überlappenden Rahmen ordnet die Diagrammschicht Schritte heute der falschen Lane zu; F5/F17 werden damit belastbar.                                                          |
| OP-003 | `user_diagram_preference` (0452) wird von niemandem geschrieben; `GrcViewSelect` hält die Sicht in React-State                                                                                             | `STUFE2-E-SCHEMA.md` §6.5; Code: `apps/web/src/components/bpmn/grc-view-select.tsx`, keine Referenz auf `userDiagramPreference` außerhalb `packages/db/src/schema/process-diagram-grc.ts:448`                              | fehlende Funktion                     | S             | —                                                                                    | Die gewählte GRC-Sicht überlebt einen Seitenwechsel; die Tabelle steht bereits.                                                                                                  |
| OP-004 | Layer F14 (Vorfälle am Schritt) nicht gebaut                                                                                                                                                               | `STUFE2-E-SCHEMA.md` §6.1; `STUFE2-A2-GRC.md` §6                                                                                                                                                                           | fehlende Funktion                     | S             | —                                                                                    | `security_incident.process_step_id` steht seit 0454; eine Abfrage plus Badge macht Vorfälle am Element sichtbar.                                                                 |
| OP-005 | Layer F16 (offene Maßnahmen mit Fälligkeit) nicht gebaut                                                                                                                                                   | `STUFE2-E-SCHEMA.md` §6.1; `STUFE2-A2-GRC.md` §6                                                                                                                                                                           | fehlende Funktion                     | S             | —                                                                                    | Wie F14: `work_item.process_step_id` steht, Fälligkeiten werden am Prozessschritt sichtbar.                                                                                      |
| OP-006 | Layer F11 (Kostenverteilung / Kostentreiber) nicht gebaut — Slot „Lane-Fußzeile" existiert nicht                                                                                                           | `STUFE2-A2-GRC.md` §6                                                                                                                                                                                                      | fehlende Funktion                     | M             | Entscheidung: Slotsystem um einen Lane-Fußzeilen-Slot erweitern                      | Kostenanteile je Lane werden im Diagramm sichtbar statt nur im Gutter.                                                                                                           |
| OP-007 | Layer F12 (EAM-Anwendungslandschaft) nicht gebaut — braucht eine zweite Zeichenebene                                                                                                                       | `STUFE2-A2-GRC.md` §6                                                                                                                                                                                                      | fehlende Funktion                     | XL            | OP-018 (Modellierungsschicht)                                                        | Anwendungen und Zuordnungslinien auf der Fläche statt nur als Badge.                                                                                                             |
| OP-008 | Layer F15 (KRI-Schwellenampel) nicht gebaut — `kri_measurement` hat keinen Zeitreihenvertrag                                                                                                               | `STUFE2-A2-GRC.md` §6                                                                                                                                                                                                      | fehlende Funktion                     | M             | Entscheidung: Zeitreihenvertrag + Richtungsaussage                                   | Ohne Richtung wäre der Badge eine Zahl ohne Bedeutung; mit ihr ein Frühwarnsignal.                                                                                               |
| OP-009 | Layer F18 (Zeitreise / Änderungssicht) nicht gebaut — braucht zwei Szenen gleichzeitig                                                                                                                     | `STUFE2-A2-GRC.md` §6                                                                                                                                                                                                      | fehlende Funktion                     | L             | —                                                                                    | Diff zweier Prozessstände auf der Fläche; `packages/shared/src/bpmn-diff.ts` ist die Grundlage.                                                                                  |
| OP-010 | F17 nur halb: Quote je Lane gebaut, Aufschlüsselung je Rolle im Panel fehlt                                                                                                                                | `STUFE2-A2-GRC.md` §6                                                                                                                                                                                                      | fehlende Funktion                     | S             | —                                                                                    | Die Kenntnisnahmelücke wird handlungsfähig statt nur zählbar.                                                                                                                    |
| OP-011 | Sicht „Modellierung": Validierungsmarker (BR) — Slot angelegt, Layer fehlt                                                                                                                                 | `STUFE2-A2-GRC.md` §6                                                                                                                                                                                                      | fehlende Funktion                     | S             | Zuständigkeit `packages/bpmn/src/verify/`                                            | Modellierungsfehler erscheinen am Element statt in einer Liste daneben.                                                                                                          |
| OP-012 | Kantenkennzahlen (`edges`: Häufigkeit, Verzweigungswahrscheinlichkeit) — braucht `process_event_transition_map`                                                                                            | `STUFE2-E-SCHEMA.md` §6.2; `apps/web/src/lib/grc-overlay.ts:363` `MISSING_TODAY` (Eintrag `edges`)                                                                                                                         | fehlende Funktion                     | M             | —                                                                                    | Process-Mining-Aussagen auf Kantenebene; schaltet zusammen mit OP-013 vier Vertragsfelder frei.                                                                                  |
| OP-013 | `process_event` trägt keinen Lebenszyklus — `meanDurationMinutes` / `isBottleneck` nicht berechenbar                                                                                                       | `STUFE2-E-SCHEMA.md` §3.4; `apps/web/src/lib/grc-overlay.ts` `MISSING_TODAY`                                                                                                                                               | fehlende Funktion                     | M             | —                                                                                    | Engpassanalyse wird möglich; heute wäre jede Dauer eine andere Größe unter demselben Namen.                                                                                      |
| OP-014 | `process_conformance_result.fitness_gaps` liefert Knoten statt Kantenpaare — `GrcConformanceSummary.deviations` bleibt leer                                                                                | `STUFE2-E-SCHEMA.md` §6.3; `MISSING_TODAY` (`diagram.conformance.deviations`)                                                                                                                                              | Produktdefekt                         | M             | Mining-Strang                                                                        | Konformitätsabweichungen werden im Diagramm als Kante darstellbar statt gar nicht.                                                                                               |
| OP-015 | `process_framework_mapping` führt nur den Rahmenwerkscode, keinen Anzeigenamen                                                                                                                             | `STUFE2-E-SCHEMA.md` §3.4; `MISSING_TODAY` (`frameworks[].frameworkName`)                                                                                                                                                  | Doku                                  | S             | —                                                                                    | Nutzer sehen „ISO 27001" statt „ISO27001-A.5.1"; kosmetisch, aber im Audit-Kontext lesbarer.                                                                                     |
| OP-016 | `diagram.framework` ist ein Sichtwahlparameter ohne Heimat in der Oberfläche                                                                                                                               | `STUFE2-E-SCHEMA.md` §3.4; `MISSING_TODAY`                                                                                                                                                                                 | fehlende Funktion                     | S             | OP-003                                                                               | Die Rahmenwerkauswahl der Sicht F8 wird bedienbar statt fest verdrahtet.                                                                                                         |
| OP-017 | `controls[].lastTestResult` / `.lastEvidenceAt` werden abgeleitet, nicht gelesen — bewusste Entscheidung                                                                                                   | `STUFE2-E-SCHEMA.md` §2.1; `MISSING_TODAY`                                                                                                                                                                                 | Doku                                  | S             | —                                                                                    | **Streichkandidat.** Kein Nutzen aus einer Änderung; die Ableitung ist die richtige Lösung, der `MISSING_TODAY`-Eintrag nur ein Hinweis.                                         |
| OP-018 | Drill-down in Subprozesse — der Importer zeichnet nur die erste `BPMNPlane`                                                                                                                                | `STUFE2-D-OFFENE-PUNKTE.md` §3.2; `STUFE2-A1-MODELING.md` §7.2; `STUFE2-B1-EDITOR.md` §7.2                                                                                                                                 | fehlende Funktion                     | L             | —                                                                                    | Verschachtelte Prozesse werden bearbeitbar; zugleich Ursache der größten `intentional`-Divergenzklasse.                                                                          |
| OP-019 | Automatischer Typwechsel Ereignis → Boundary-Event beim Anheften fehlt                                                                                                                                     | `STUFE2-D-OFFENE-PUNKTE.md` §3.2; `STUFE2-A1-MODELING.md` §7.1                                                                                                                                                             | fehlende Funktion                     | M             | OP-020 (nicht zeitgleich mit Auto-Resize ändern)                                     | Ein Zwischenereignis auf eine Aktivität zu ziehen erzeugt das, was der Nutzer meint, statt eines ungültigen Modells.                                                             |
| OP-020 | 34 Divergenzen `waypoints/bpmn:SequenceFlow/count` gegen bpmn-js (Verdacht: Relayout beim Redo)                                                                                                            | `STUFE2-D-OFFENE-PUNKTE.md` §5.1, §2.4                                                                                                                                                                                     | Produktdefekt                         | M             | —                                                                                    | Größter Einzelposten der 77 `ours-wrong`-Klassen; jeder Speichervorgang erzeugt sonst einen Diff gegen die Referenz.                                                             |
| OP-021 | 20 Divergenzen `waypoints/bpmn:SequenceFlow/position` (Restfälle nach der Docking-Korrektur)                                                                                                               | `STUFE2-D-OFFENE-PUNKTE.md` §5.2, §2.3                                                                                                                                                                                     | Produktdefekt                         | M             | —                                                                                    | Geometrieparität mit bpmn-js; Voraussetzung für den XML-Vergleich im Shadow-Compare.                                                                                             |
| OP-022 | 9 Divergenzen `element-set` / `element-type` (teils Folgeschaden der positionellen `gen-`-Ausrichtung des Prüfstands)                                                                                      | `STUFE2-D-OFFENE-PUNKTE.md` §5.3, §2.8                                                                                                                                                                                     | Testlücke                             | M             | OP-020                                                                               | Der Prüfstand misst dann die Engine und nicht sich selbst.                                                                                                                       |
| OP-023 | 4 Divergenzen `candidate-set/*/more-ours` — ein `bpmn:SequenceFlow` zu viel nach `connect` + `undo`                                                                                                        | `STUFE2-D-OFFENE-PUNKTE.md` §5.4                                                                                                                                                                                           | Produktdefekt                         | S             | —                                                                                    | Undo hinterlässt kein Geisterelement mehr.                                                                                                                                       |
| OP-024 | 2 Divergenzen `bounds/bpmn:EndEvent` und `bounds/bpmn:SubProcess` (Lane-Inhalte beim Poolwachstum, 5 px)                                                                                                   | `STUFE2-D-OFFENE-PUNKTE.md` §5.5                                                                                                                                                                                           | Produktdefekt                         | S             | —                                                                                    | Letzte Container-Geometrieabweichung; klein, aber sie hält die Klasse offen.                                                                                                     |
| OP-025 | 2 Divergenzen `outcome/createShape` (Task bzw. EventBasedGateway in der Wurzel von `synth-nested-subprocesses`)                                                                                            | `STUFE2-D-OFFENE-PUNKTE.md` §5.6                                                                                                                                                                                           | Produktdefekt                         | S             | OP-018                                                                               | Regelparität beim Anlegen in verschachtelten Wurzeln.                                                                                                                            |
| OP-026 | Zwei lesende Einbindungen ohne GRC-Sichtwahl (Dialog „Version ansehen", `my-processes/[id]`)                                                                                                               | `STUFE2-D-OFFENE-PUNKTE.md` §1.6, §5.8                                                                                                                                                                                     | fehlende Funktion                     | S             | Entscheidung: gehört eine Sichtwahl in die Mitarbeitersicht?                         | GRC-Overlays auch beim Lesen; eine Zeile Verdrahtung je Stelle.                                                                                                                  |
| OP-027 | Kein E2E-Test bedient die BPMN-Fläche — weder Maus noch Tastatur                                                                                                                                           | `STUFE2-C-ABSCHLUSS.md` §5.1; Code: keine `djs-`/Canvas-Interaktion in `apps/web/e2e/**`, `tests/e2e/**`                                                                                                                   | Testlücke                             | L             | OP-053 (Produktionsbau als Ziel)                                                     | Der einzige Nachweis, dass ein Mensch mit dem Editor ein Diagramm zeichnen kann; Plan §5.6 Kriterium 6.                                                                          |
| OP-028 | `chrome: "full"` im Lesemodus nicht in Betrieb — jede lesende Fläche bekommt `minimal`                                                                                                                     | `STUFE2-C-ABSCHLUSS.md` §5.12; `STUFE2-D-OFFENE-PUNKTE.md` §3.2                                                                                                                                                            | fehlende Funktion                     | S             | Entscheidung: ausgegraute Palette bei fehlendem Recht?                               | Wer nicht bearbeiten darf, sieht warum, statt eine Fläche ohne Werkzeuge.                                                                                                        |
| OP-029 | Moduswechsel zur Laufzeit (Viewbox, Zoom, Selektion, Layer erhalten) nicht gebaut                                                                                                                          | `STUFE2-B1-EDITOR.md` §7.12; `STUFE2-C-ABSCHLUSS.md` §5.9                                                                                                                                                                  | fehlende Funktion                     | M             | —                                                                                    | Umschalten Lesen ↔ Bearbeiten ohne Verlust des Arbeitsstands.                                                                                                                    |
| OP-030 | Beschriftung von `bpmn:Group` schreibt `name` statt `bpmn:CategoryValue`                                                                                                                                   | `STUFE2-A1-MODELING.md` §7.3; `STUFE2-B1-EDITOR.md` §7.9                                                                                                                                                                   | Produktdefekt                         | S             | —                                                                                    | Gruppenbeschriftungen bleiben beim Austausch mit anderen BPMN-Werkzeugen erhalten.                                                                                               |
| OP-031 | Kein Space-, Lasso-, Hand-Werkzeug (Module vorhanden, Palette-Einträge und Zustandsmodell fehlen)                                                                                                          | `STUFE2-B1-EDITOR.md` §7.7; `STUFE2-C-ABSCHLUSS.md` §5.8                                                                                                                                                                   | fehlende Funktion                     | S             | —                                                                                    | Vier der 21 Editorfunktionen aus Plan §5.6 Kriterium 4.                                                                                                                          |
| OP-032 | Keine Mehrfachauswahl per Tastatur über einen Bereich („alles in dieser Lane")                                                                                                                             | `STUFE2-B1-EDITOR.md` §7.11                                                                                                                                                                                                | fehlende Funktion                     | S             | —                                                                                    | Tastaturbedienung erreicht Parität mit der Maus; a11y-relevant.                                                                                                                  |
| OP-033 | Eingeklappte Subprozesse behalten selektierbare Kinder (`hidden` statt entfernt)                                                                                                                           | `STUFE2-B1-EDITOR.md` §7.3; `STUFE2-A1-MODELING.md` §7.5                                                                                                                                                                   | Produktdefekt                         | S             | Entscheidung aus A1 §7.5                                                             | `Strg+A` und die Ansage zählen keine unsichtbaren Elemente mehr mit.                                                                                                             |
| OP-034 | Kontrast der BPMN-Bedienelemente ungemessen — axe schaltet `color-contrast` in jsdom ab                                                                                                                    | `STUFE2-B1-EDITOR.md` §7.10; `STUFE2-C-ABSCHLUSS.md` §5.3; Abschlussbericht §5 O-I                                                                                                                                         | Testlücke                             | M             | OP-027 (Browserlauf)                                                                 | Plan §4.4 (Fokusring ≥ 3:1) wird nachweisbar statt behauptet.                                                                                                                    |
| OP-035 | NVDA / VoiceOver nie ausgeführt — kein Test mit assistiver Technologie                                                                                                                                     | `STUFE2-C-ABSCHLUSS.md` §5 Kriterium 5; Abschlussbericht §5 O-I                                                                                                                                                            | Testlücke                             | M             | manuelle Abnahme, echte Geräte                                                       | Ohne sie ist keine EN-301-549-Aussage möglich (siehe OP-062).                                                                                                                    |
| OP-036 | Leistungsbudget des BPMN-Editors nicht gemessen                                                                                                                                                            | `STUFE2-C-ABSCHLUSS.md` §5 Kriterium 7                                                                                                                                                                                     | Testlücke                             | S             | OP-053                                                                               | Plan §5.6 Kriterium 7; ohne Zahl ist „schnell genug" eine Behauptung.                                                                                                            |
| OP-037 | `packages/shared` parst BPMN weiterhin selbst — 1.529 Zeilen in sechs Dateien                                                                                                                              | `STUFE2-B2-EINBINDUNG.md` §5.5; `STUFE2-C-ABSCHLUSS.md` §5.13; Code: `packages/shared/src/{bpmn-diff,bpmn-parser,bpmn-validator}.ts`, `src/lib/{bpmn-raci-engine,bpmn-walkthrough-engine,excel-to-bpmn}.ts` = 1.529 Zeilen | Codequalität                          | L             | `@grc/bpmn` als maßgebliche Interpretation                                           | Zwei Antworten auf dieselbe Frage verschwinden; jede Woche Verzug erhöht die Zahl der Divergenzstellen.                                                                          |
| OP-038 | Zwei ambiente `declare module "bpmn-moddle"` (Paket und App)                                                                                                                                               | `STUFE2-B2-EINBINDUNG.md` §5.1 Punkt 2; Code: `packages/bpmn/src/model/bpmn-moddle.d.ts:12` **und** `apps/web/src/types/bpmn-moddle.d.ts:15`                                                                               | Codequalität                          | S             | —                                                                                    | Ein stiller Fehlerherd verschwindet — die schmalere App-Fassung kennt weder `ModdleWarning` noch die zweiargumentige `toXML`-Signatur.                                           |
| OP-039 | Vertikale Pools nur teilweise geprüft — der Korpus enthält keinen senkrechten Pool                                                                                                                         | `STUFE2-A1-MODELING.md` §7.4                                                                                                                                                                                               | Testlücke                             | S             | —                                                                                    | Die Symmetrie der Lane-Geometrie wird belegt statt angenommen; Risiko mittel.                                                                                                    |
| OP-040 | `moveShape` bewegt Beschriftungen und Anhefter nicht mit — Aufruferdisziplin nötig                                                                                                                         | `STUFE2-A1-MODELING.md` §7 („Nur teilweise tragfähig", Punkt 7)                                                                                                                                                            | Codequalität                          | S             | —                                                                                    | Ein Aufrufer, der `moveShape` statt `moveElements` nimmt, hinterlässt eine dauerhaft falsche DI; ein Lint- oder Typ-Guard verhindert das.                                        |
| OP-041 | Lane-Geometrie: Kind-Lanes wachsen nicht mit, wenn eine Lane mit Kindern vergrößert wird                                                                                                                   | `STUFE2-A1-MODELING.md` §7.9                                                                                                                                                                                               | Produktdefekt                         | S             | —                                                                                    | Sichtbarer Geometriefehler bei geschachtelten Lanes.                                                                                                                             |
| OP-042 | `connection.move` über Containergrenzen relativiert die Wegpunkte nicht                                                                                                                                    | `STUFE2-A1-MODELING.md` §7.10                                                                                                                                                                                              | Produktdefekt                         | S             | —                                                                                    | Werkzeuge, die container-relative Koordinaten erwarten, lesen das Ergebnis sonst anders.                                                                                         |
| OP-043 | Kein XSD-Schema-Validator — Invarianten prüfen Referenzintegrität, nicht Schemakonformität                                                                                                                 | `STUFE2-A1-MODELING.md` §7.11                                                                                                                                                                                              | Testlücke                             | M             | —                                                                                    | `cancelActivity="ja"` fällt heute niemandem auf; ein XSD-Lauf gegen `BPMN20.xsd` fängt eine ganze Fehlerklasse.                                                                  |
| OP-044 | Datenassoziationen flach modelliert (`sourceRef` als einelementige Liste statt `ioSpecification`)                                                                                                          | `STUFE2-A1-MODELING.md` §7.8                                                                                                                                                                                               | Codequalität                          | M             | —                                                                                    | Austausch mit Camunda-Werkzeugen wird spezifikationstreu.                                                                                                                        |
| OP-045 | Renderer zeichnet Choreographie- und Konversationselemente nicht                                                                                                                                           | `SPIKE-MESSUNG-DRAW.md` §2.3                                                                                                                                                                                               | fehlende Funktion                     | M             | Entscheidung: bietet ARCTOS das je an? (Plan N1)                                     | **Streichkandidat**, solange das Produkt Choreographien nicht anbietet — heute nur als gestricheltes Rechteck sichtbar.                                                          |
| OP-046 | Renderer-Kleinlücken: `ImplicitThrowEvent`, `participantMultiplicity`, Nachrichtensymbol am MessageFlow, `isMarkerVisible=false`, DI-Farbattribute, Label-Kollisionsvermeidung, Clipping am Subprozessrand | `SPIKE-MESSUNG-DRAW.md` §2.3                                                                                                                                                                                               | fehlende Funktion                     | M             | —                                                                                    | Sieben kleine Darstellungsunterschiede zu bpmn-js; einzeln 15–30 LOC, zusammen die letzte Renderparität.                                                                         |
| OP-047 | 4 von 6 reparierten `audit_log`-Schreibwegen ohne Test (`controlled-copy`, `erase`, `verify-integrity`, `processes/bulk`)                                                                                  | `E2E-TRIAGE-4.md` §9; Code: nur `apps/web/src/__tests__/api/document-signature-requests.test.ts` referenziert `lib/audit-entry`                                                                                            | Testlücke                             | S             | —                                                                                    | Acht Schreibwege waren seit 0407 tot und niemand merkte es; ohne Test kann das erneut passieren.                                                                                 |
| OP-048 | `db:create-admin` setzt keine Mandanten-Regel durch — spätere Mitgliedschaften bleiben möglich                                                                                                             | `E2E-TRIAGE-4.md` §9                                                                                                                                                                                                       | Betrieb                               | S             | Entscheidung: gilt die Ein-Mitgliedschafts-Regel auch für Betreiberkonten?           | Der Mandanten-Zwiespalt (OP-056) kann nicht über ein neu angelegtes Konto zurückkommen.                                                                                          |
| OP-049 | Kontrastkombination `bg-red-500` + kleiner weißer Text nicht systematisch gesucht                                                                                                                          | `E2E-TRIAGE-4.md` §9; behoben nur `notification-bell.tsx`                                                                                                                                                                  | Testlücke                             | S             | —                                                                                    | Die a11y-Smoke deckt drei Seiten ab; eine baumweite Suche schließt die Klasse statt des Einzelfalls.                                                                             |
| OP-050 | UI-Aufrufe mit `limit > 100` laufen in 422 → stiller Leerzustand                                                                                                                                           | `E2E-TRIAGE-3.md` §6; `E2E-TRIAGE-4.md` §9; Code gemessen: **30** Fundstellen in `apps/web/src` (26× `limit=200`, 1× 300, 2× 500, 1× 10000), 34 repoweit — der Bericht nennt 37                                            | Produktdefekt                         | M             | Entscheidung: Aufrufstellen auf 100 + Blätterung **oder** `MAX_PAGE_SIZE` anheben    | Ganze Listen erscheinen leer statt unvollständig; das ist die gefährlichere Fehlerform.                                                                                          |
| OP-051 | Migration `0439` verweist auf `packages/db/tests/unit/work-item-type-registry.test.ts`, den es nicht gibt                                                                                                  | `E2E-TRIAGE-3.md` §6; `E2E-TRIAGE-4.md` §9; Code: `packages/db/drizzle/0439_work_item_type_catalog_gaps.sql:38`, Datei existiert nicht (`find` leer)                                                                       | Doku                                  | S             | —                                                                                    | Entweder der Test entsteht (dann hält er die Katalogregistrierung) oder der Verweis fällt weg; heute belegt er etwas, das nicht existiert.                                       |
| OP-052 | `f-17-schema-drift`: 4 fehlende Tabellen (`account`, `session`, `verification_token`, `audit_anchor_seal`), Drift-Endpunkt antwortet 503                                                                   | `E2E-TRIAGE-2.md` §6; `E2E-TRIAGE-3.md` §6; `E2E-TRIAGE-4.md` §9; Code: `tests/e2e/regression/f-17-schema-drift.spec.ts:30` toleriert ≤ 5                                                                                  | Produktdefekt                         | S             | Entscheidung: Auth.js-Adaptertabellen anlegen oder als bewusst tot dokumentieren     | Ein Gesundheitsendpunkt, der dauerhaft 503 meldet, wird ignoriert — genau die Klasse Defekt, die dieser Audit gefunden hat.                                                      |
| OP-053 | Produktionsbau löscht `.next/standalone/apps/web/.env.local`; kein Skript kopiert es zurück                                                                                                                | `E2E-TRIAGE-4.md` §5, §7; Code: weder `Dockerfile`, `apps/web/scripts/next-build.mjs` noch `deploy/**` kopiert `.env.local` zurück                                                                                         | Betrieb                               | S             | —                                                                                    | Nach jedem Neubau startet der Server ohne `AUTH_SECRET` und jede Anmeldung landet auf `/api/auth/error`; heute steht nur ein Merksatz im Bericht.                                |
| OP-054 | `AUDIT_INTEGRITY`-Rate-Limit von 1 Anfrage/Minute ist ungewöhnlich eng                                                                                                                                     | `E2E-TRIAGE-2.md` §6 (`f-18-integrity`)                                                                                                                                                                                    | Entscheidung des Eigentümers          | S             | Entscheidung: ist 1/min so gemeint?                                                  | Ein absichtlich enges Limit gehört begründet, ein versehentliches korrigiert; heute weiß es niemand.                                                                             |
| OP-055 | Detailrouten liegen unter Modulpfaden, Listen unter Wurzelpfaden (`findings`, `audit-mgmt`, `vendors`)                                                                                                     | `E2E-TRIAGE-2.md` §6; `E2E-TRIAGE-3.md` §6                                                                                                                                                                                 | Codequalität                          | M             | —                                                                                    | Keine Fehlfunktion, aber die Ursache dafür, dass drei Specs auf die 404-Seite zeigten; einheitliche Pfade verhindern die Wiederholung.                                           |
| OP-056 | Mandanten-Zwiespalt: `arctos-org-id` ist ein `Secure`-Cookie und erreicht Playwrights `request`-Kontext gegen `http://` nicht                                                                              | `E2E-TRIAGE-3.md` §6; `E2E-TRIAGE-4.md` §1 (für Rollenkonten gelöst, für das Admin-Konto offen)                                                                                                                            | Testlücke                             | M             | Vollauf davor und danach nötig                                                       | UI- und API-Specs behaupten gegen denselben Mandanten; ohne Fix kann eine Änderung über 40 grüne Specs stillschweigend verschieben.                                              |
| OP-057 | `admin@arctos.local` ist Plattform-Admin — `f-02b` kann nicht grün werden, ohne seine Aussage zu verlieren                                                                                                 | `E2E-TRIAGE.md` §7.4                                                                                                                                                                                                       | Testlücke                             | S             | OP-048                                                                               | Das Testkonto prüft wieder die Rechteschranke statt sie zu umgehen.                                                                                                              |
| OP-058 | Kein Smoke-Durchlauf über die großen Listenendpunkte nach dem Wickeln der 1.170 Routen                                                                                                                     | `E2E-TRIAGE.md` §7.5                                                                                                                                                                                                       | Testlücke                             | S             | —                                                                                    | Die mechanische Transformation über 1.168 Route-Dateien ist typgeprüft, aber nie zur Laufzeit bestätigt.                                                                         |
| OP-059 | Repository ist öffentlich lesbar — `lod-coverage.csv` liefert 1.801 Route/Rolle-Paare und die sieben anonymen Endpunkte                                                                                    | Abschlussbericht §5 O-A; `umsetzungsprotokolle/WP10.md` §4.1                                                                                                                                                               | Entscheidung des Eigentümers          | S             | GitHub-Einstellung des Eigentümers                                                   | Solange es so ist, sind alle übrigen Maßnahmen nachrangig.                                                                                                                       |
| OP-060 | Git-Historie enthält Dev-/CI-Passwörter und Arbeitsplatzpfade                                                                                                                                              | Abschlussbericht §5 O-B; `WP10.md` §4.4                                                                                                                                                                                    | Entscheidung des Eigentümers          | M             | OP-059 (bei öffentlichem Repo nur begrenzt wirksam)                                  | Ein Rewrite lohnt nur zusammen mit OP-059; die Passwörter sind rotiert.                                                                                                          |
| OP-061 | bpmn.io-Wasserzeichen: kommerzielle Lizenz oder Wasserzeichen im Produkt                                                                                                                                   | Abschlussbericht §5 O-C; `WP10.md` §4.2                                                                                                                                                                                    | Entscheidung des Eigentümers          | S             | Geschäftsentscheidung                                                                | Die einzige lizenzkonforme Alternative zum sichtbaren Wasserzeichen; jede CSS-Lösung ist ein Verstoß.                                                                            |
| OP-062 | EN 301 549 nicht erklärbar — kein Seitenlauf im Browser, keine Fokusreihenfolge über ganze Seiten, keine assistive Technologie                                                                             | Abschlussbericht §5 O-I                                                                                                                                                                                                    | Testlücke                             | L             | OP-034, OP-035, OP-093                                                               | Ohne Konformitätsprüfung darf in keinem Vergabeverfahren Konformität behauptet werden.                                                                                           |
| OP-063 | Lint-Altbestand in `apps/worker`, `packages/*`, `scripts` eingefroren statt abgearbeitet                                                                                                                   | Abschlussbericht §5 O-G; `VERIFIKATION.md` Teil D O-1; Code: `.eslint-ratchet.json` Baseline 404                                                                                                                           | Codequalität                          | L             | —                                                                                    | Das Plankriterium „0 Fehler in allen Workspaces" bleibt sonst dauerhaft unerfüllt.                                                                                               |
| OP-064 | **Lint-Ratsche ist verletzt:** 418 Befunde gegen Baseline 404, `no-console` 135 > 121 (+14)                                                                                                                | Code: `node scripts/lint-ratchet.mjs` am 2026-09-02 → Exit ≠ 0; Verursacher `packages/db/src/seed-e2e-users.ts` (8), `seed-demo.ts` (3), `packages/bpmn/test/model/measure-roundtrip.ts` (3)                               | Codequalität                          | S             | —                                                                                    | Das CI-Tor ist heute rot; entweder Logger benutzen oder Baseline mit Begründung nachziehen.                                                                                      |
| OP-065 | Pakete mit abgeschwächten Compiler-Optionen — Restschuld beim Einschalten: shared 502, db 641, auth 321, email 542                                                                                         | Abschlussbericht §5 O-H (nennt 3 Pakete); `WP12.md` §3.13 (nennt 10); Code: `noUncheckedIndexedAccess: false` in **10** `packages/*/tsconfig.json` (ai, auth, automation, db, email, events, graph, reporting, shared, ui) | Codequalität                          | XL            | —                                                                                    | Eine ganze Klasse von Laufzeitfehlern („index kann `undefined` sein") wird vom Compiler gefangen statt in Produktion.                                                            |
| OP-066 | `packages/auth` und `packages/email` Function-Coverage gefallen — **Coverage-Gate ist rot**                                                                                                                | `WP11.md` §6.3; Code: `node scripts/coverage-gate.mjs` am 2026-09-02 → `packages/auth functions 59,09 % < 62,50 %`, `packages/email functions 95,50 % < 97,46 %`                                                           | Testlücke                             | S             | —                                                                                    | Ungetesteter neuer Code in zwei Paketen; im Aggregat geht das unter, die relative Ratsche fängt es.                                                                              |
| OP-067 | `coverage/coverage-baseline.json` steht auf dem Audit-Stand (20,41 % / 13,89 %), gemessen sind 23,27 % / 16,97 %                                                                                           | `WP10.md` §4.16; Code: `coverage/coverage-baseline.json` vs. `coverage/aggregated-summary.json`                                                                                                                            | Betrieb                               | S             | OP-066 (erst nach grünem Lauf nachziehen)                                            | Die Ratsche ist heute zu locker; jede Absenkung bis 20,41 % bliebe unbemerkt.                                                                                                    |
| OP-068 | `packages/bpmn` fehlt in `coverage/aggregated-summary.json` — Floor 40/30 gesetzt, aber nicht aggregiert                                                                                                   | Code: `vitest.coverage.shared.ts:115` definiert den Floor, `coverage/aggregated-summary.json` listet nur 12 Pakete ohne bpmn                                                                                               | Testlücke                             | S             | —                                                                                    | Das neue Kernpaket zählt in keiner Gesamtzahl mit; sein Coverage-Verfall wäre unsichtbar.                                                                                        |
| OP-069 | Gesamt-Coverage 23,27 %, `apps/web` 15,37 % Lines / 10,5 % Branches — Fachlogik der 1.357 Routen ungedeckt                                                                                                 | `WP11.md` §5.1; Code: `coverage/aggregated-summary.json`                                                                                                                                                                   | Testlücke                             | XL            | —                                                                                    | Keine Zahl, auf der eine Zulassungsentscheidung aufbauen kann; sie steigt nur durch geschriebene Tests.                                                                          |
| OP-070 | 96 von 482 Pages und 75 von 134 Komponenten ohne i18n-Anbindung                                                                                                                                            | `WP12.md` S14-14; Abschlussbericht §5 O-I; Code: `node scripts/audit-i18n-usage.mjs` → `96/482 pages, 75/134 components`                                                                                                   | fehlende Funktion                     | XL            | Produktentscheidung: mehrere hundert Rechtsbegriffe in zwei Sprachen                 | Zweisprachigkeit ist Produktzusage; die AI-Act-Seiten sind der heikelste Teil.                                                                                                   |
| OP-071 | **i18n-Untranslated-Ratsche ist verletzt:** 171 Dateien gegen Budget 169                                                                                                                                   | Code: `node scripts/audit-i18n-usage.mjs --max-untranslated 169` am 2026-09-02 → `FAIL … budget 169`; `.github/workflows/i18n-coverage.yml:155`                                                                            | Codequalität                          | S             | OP-070                                                                               | Die Ratsche soll Zuwachs verhindern — sie ist bereits um zwei Dateien überschritten.                                                                                             |
| OP-072 | **i18n-Bundle out of sync:** `common.ismsAssessment.actions.retry` fehlt im Laufzeitbündel für `de` und `en`                                                                                               | Code: `node scripts/audit-i18n-usage.mjs` am 2026-09-02 → `FAIL runtime bundle out of sync: 2`                                                                                                                             | Produktdefekt                         | S             | —                                                                                    | Ein im Code benutzter Schlüssel erreicht die Laufzeit nicht; der Nutzer sieht den Rohschlüssel. `apps/web/scripts/build-messages.ts` neu laufen lassen.                          |
| OP-073 | 6.796 Katalogschlüssel werden von keiner statischen Aufrufstelle erreicht (Budget 6.800)                                                                                                                   | `WP12.md` S14-21; Code: `audit-i18n-usage.mjs` → `6796`                                                                                                                                                                    | Codequalität                          | L             | 400 Aufrufstellen bauen ihren Schlüssel dynamisch — Massenlöschung ist ein Risiko    | Der Katalog wird wartbar; jede automatische Löschung braucht vorher die dynamischen Aufrufstellen.                                                                               |
| OP-074 | Dead-Exports-Report ist veraltet: eingecheckt 1.991 in 322 Dateien, gemessen **2.706 in 461 Dateien**                                                                                                      | Code: `docs/perf/dead-exports-report.md:15` gegen `node scripts/audit-dead-exports.mjs` am 2026-09-02                                                                                                                      | Codequalität                          | L             | —                                                                                    | +715 tote Exports seit der letzten Messung; es gibt **kein** CI-Gate darauf (kein Treffer in `.github/**`).                                                                      |
| OP-075 | Kein CI-Gate auf `audit-dead-exports.mjs` — die Zahl kann beliebig wachsen                                                                                                                                 | Code: `grep -rl dead-exports .github/ package.json` → leer                                                                                                                                                                 | Codequalität                          | S             | OP-074                                                                               | Die drei anderen Ratschen (Lint, Coverage, i18n) haben ein Tor; diese nicht.                                                                                                     |
| OP-076 | 129 `any` in `apps/web/src/app/api/v1/**` — Regel dort namentlich ausgenommen                                                                                                                              | `WP12.md` §3.6; Hotspots `processes/audit-pack` (14×), `tprm/vendors/[id]/onboarding-pack` (12×), `audit-mgmt/audits/[id]/audit-pack` (12×), `whistleblowing/statistics` (8×)                                              | Codequalität                          | L             | —                                                                                    | Die Ausnahme macht die Schuld sichtbar; sie abzutragen heißt, die vier Hotspots zu typisieren.                                                                                   |
| OP-077 | 483 tote Bindungen in denselben Routen (`no-unused-vars` dort ausgenommen)                                                                                                                                 | `WP12.md` §3.7                                                                                                                                                                                                             | Codequalität                          | M             | —                                                                                    | Der AST-Codemod ist erprobt; 800 Diff-Zeilen in fremden Routen waren der einzige Grund für den Aufschub.                                                                         |
| OP-078 | 6 Routen mit `const module = …` (`@next/next/no-assign-module-variable` dort aus)                                                                                                                          | `WP12.md` §3.8                                                                                                                                                                                                             | Codequalität                          | S             | —                                                                                    | Lokale Umbenennung; danach kann die Ausnahme fallen.                                                                                                                             |
| OP-079 | RFC 7807 Phase 3b: Routen ohne `withErrorHandler` liefern weiterhin `{ error: … }`                                                                                                                         | `WP12.md` S14-16, §3.9                                                                                                                                                                                                     | Codequalität                          | M             | OP-084 (115 ungewickelte Routen)                                                     | Einheitliches Fehlerformat für alle Integratoren; heute 107 von 1.362 Routen.                                                                                                    |
| OP-080 | `react-hooks/exhaustive-deps` und die sieben React-Compiler-Regeln aus `eslint-plugin-react-hooks@7` sind aus (23 bzw. 36 Fundstellen)                                                                     | `WP12.md` §3.14                                                                                                                                                                                                            | Codequalität                          | L             | OP-027 (ohne E2E nicht verifizierbar)                                                | Saubere Auflösung ist `@tanstack/react-query` — bereits Abhängigkeit —, aber eine Verhaltensänderung in 19 Seiten.                                                               |
| OP-081 | `server-only`-Guard fehlt in `packages/db/src/index.ts` und `packages/auth/src/providers.ts`                                                                                                               | `WP12.md` §3.5 (S12-10)                                                                                                                                                                                                    | Codequalität                          | S             | neue Abhängigkeit `server-only` → Lockfile-Änderung                                  | Ein Fehlimport aus einer `"use client"`-Datei wird ein Buildfehler statt eines Shims, der Serverkonstanten inlinen kann.                                                         |
| OP-082 | `/trust` nicht in `PUBLIC_PREFIXES` — Trust Center bleibt hinter dem Login                                                                                                                                 | `WP12.md` §3.1 (S12-05 Defekt A)                                                                                                                                                                                           | fehlende Funktion                     | S             | —                                                                                    | Die Voraussetzung ist erfüllt (`withOrgReadContext`); eine Zeile in `packages/auth/src/rbac.ts`.                                                                                 |
| OP-083 | S01-04 Restlücke: die `user`-Policy trägt eine kontextlose Disjunktion (Anmeldung liest per E-Mail)                                                                                                        | `WP2.md` §6.1; Status dort **teilweise**                                                                                                                                                                                   | Produktdefekt                         | M             | S02-05 (`packages/auth/src/providers.ts:197,341`)                                    | Der saubere Weg ist eine `SECURITY DEFINER`-Funktion (Muster `app_current_org_scope()` in 0396); bis dahin ist die Isolation der `user`-Tabelle schwächer als die aller anderen. |
| OP-084 | 115 Routen ohne `withErrorHandler` nutzen den kontextlosen Basis-Pool                                                                                                                                      | `WP2.md` §6.2 (S01-21/S01-22)                                                                                                                                                                                              | Produktdefekt                         | M             | —                                                                                    | Fail-closed gilt nur für Tabellen mit org_id-Policy; die Wickelung macht die Zusage vollständig.                                                                                 |
| OP-085 | Session-Invalidierung beim Rollenentzug fehlt (S01-22)                                                                                                                                                     | `WP2.md` §6.2; liegt vollständig in `packages/auth/**`                                                                                                                                                                     | Produktdefekt                         | M             | —                                                                                    | Ein entzogenes Recht wirkt sofort statt erst beim nächsten Token-Refresh.                                                                                                        |
| OP-086 | `includeDescendants` im Audit-Log ist unter RLS wirkungslos (S01-26, Status **teilweise**)                                                                                                                 | `WP2.md` §4 S01-26, §6.4; Ort `apps/web/src/app/api/v1/audit-log/route.ts:48-60`                                                                                                                                           | Produktdefekt                         | S             | —                                                                                    | Entweder die rekursive CTE durch `SELECT * FROM app_current_org_scope()` ersetzen oder den Parameter entfernen; beides besser als der Status quo.                                |
| OP-087 | Event-Trigger `arctos_rls_guard_trg` greift nur bei `CREATE`, nicht bei `ALTER … DISABLE RLS` oder `DROP POLICY`                                                                                           | `WP2.md` §6.12                                                                                                                                                                                                             | Codequalität                          | M             | bewusst so; Coverage-Gate und Systemtest melden es                                   | Ein Dauerschutz statt einer Meldung nach der Tat.                                                                                                                                |
| OP-088 | Fünf Tabellen sind nicht per Zeilenprobe auf Mandantentrennung geprüft                                                                                                                                     | `WP2.md` §2 (Ende), §6.13                                                                                                                                                                                                  | Testlücke                             | S             | —                                                                                    | Der Systemtest deckt dann alle mandantenbezogenen Objekte statt fast aller.                                                                                                      |
| OP-089 | Zwei Materialized Views bleiben mandantenübergreifend materialisiert (Zugriff nur entzogen)                                                                                                                | `WP2.md` §6.14                                                                                                                                                                                                             | Codequalität                          | S             | beide derzeit unbenutzt                                                              | **Streichkandidat**, solange sie unbenutzt sind — wer sie öffnet, muss eine org-Filterung mitliefern.                                                                            |
| OP-090 | Worker läuft als DB-Superuser: `docker-compose.production.yml` und `ci.yml` noch nicht auf `grc_worker` umgestellt (S01-09, Status **teilweise**)                                                          | `WP2.md` §4 S01-09, §6.9                                                                                                                                                                                                   | Betrieb                               | S             | —                                                                                    | Bis dahin muss der Worker `ARCTOS_ALLOW_PRIVILEGED_DB=true` setzen — RLS ist für ihn wirkungslos. Einziger unmittelbar deploy-relevanter Punkt aus WP2.                          |
| OP-091 | `GRC_APP_PASSWORD` ohne `:?`-Pflichtprüfung in `docker-compose.production.yml:212` (S01-11, Status **teilweise**)                                                                                          | `WP2.md` §4 S01-11, §6.10                                                                                                                                                                                                  | Betrieb                               | S             | —                                                                                    | Konsistent zu `DB_PASSWORD`/`AUTH_SECRET`/`CRON_SECRET` derselben Datei; ein leeres Passwort startet sonst still.                                                                |
| OP-092 | CI-Gate `audit-rls-coverage.mjs --check` und die RLS-Suite mit `APP_DATABASE_URL` fehlen in `ci.yml`                                                                                                       | `WP2.md` §6.11 (zugleich S11-11)                                                                                                                                                                                           | Testlücke                             | S             | —                                                                                    | Ohne `APP_DATABASE_URL` läuft die RLS-Suite als Superuser und ist wertlos.                                                                                                       |
| OP-093 | a11y-Lauf (`apps/web/src/__tests__/a11y/`) gehört in dieselbe CI-Stufe wie die Unit-Tests                                                                                                                  | `WP12.md` §3.15                                                                                                                                                                                                            | Testlücke                             | S             | —                                                                                    | Braucht keine DB, kein Netz, keinen Browser; heute läuft er nicht bei jedem PR.                                                                                                  |
| OP-094 | Modul-/Rollenguard hängt an den Middleware-Headern `x-arctos-path` / `x-arctos-method`                                                                                                                     | `WP3.md` §5.1                                                                                                                                                                                                              | Codequalität                          | M             | —                                                                                    | Ein Pfad ohne Middleware verliert heute den Modulguard; die Ausfallrichtung ist restriktiv, die Abhängigkeit trotzdem unschön.                                                   |
| OP-095 | Plattform-Admin nur am DB-Prompt vergebbar — Migration 0411 muss eingespielt sein                                                                                                                          | `WP3.md` §5.2                                                                                                                                                                                                              | Betrieb                               | S             | Betreiberschritt                                                                     | Ohne 0411 antwortet jeder Schreibzugriff auf globale Tabellen mit 403 — korrekt, aber als Betriebsereignis sichtbar zu machen.                                                   |
| OP-096 | SAML: weder Ablauf noch Kette des IdP-Zertifikats werden geprüft — ein abgelaufenes Zertifikat verifiziert                                                                                                 | `WP3.md` §5.3                                                                                                                                                                                                              | Produktdefekt                         | M             | —                                                                                    | Zertifikatsrotation wird ein Betriebsvorgang mit Warnung statt einer stillen Annahme.                                                                                            |
| OP-097 | Klartext-Tokenspalten `dd_session.access_token` und `user.ical_token` leben bis zum `DROP COLUMN` weiter (S02-20 halb geschlossen)                                                                         | `WP3.md` §5.4; Nummernkreis 0413/0414 frei                                                                                                                                                                                 | Produktdefekt                         | S             | Rotationsfenster muss ablaufen (Zeitkriterium)                                       | Das Leseleck schließt vollständig; bis dahin ist es nur halb zu.                                                                                                                 |
| OP-098 | S02-07 (Massenexport) und die Mailbox-Route (S02-05) sind mechanisch fertig, aber nicht eingebaut                                                                                                          | `WP3.md` §5.5                                                                                                                                                                                                              | fehlende Funktion                     | S             | Einbau bei WP8                                                                       | Bis zum Einbau greift der Rollenboden, die Vier-Augen-Prüfung nicht.                                                                                                             |
| OP-099 | `…/comments/[commentId]/resolve/route.ts:19-36` nimmt die erste Rollenzeile ohne `ORDER BY`                                                                                                                | `WP12.md` §3.4 (S12-13)                                                                                                                                                                                                    | Produktdefekt                         | S             | —                                                                                    | Ein Nutzer mit `viewer` **und** `admin` bekommt heute je nach Heap-Reihenfolge eine 403.                                                                                         |
| OP-100 | Kein Scheduler-Nachholmechanismus für verpasste Läufe (`job_run`)                                                                                                                                          | `WP9.md` §5.5                                                                                                                                                                                                              | fehlende Funktion                     | M             | —                                                                                    | Ein Job, dessen Minute in ein Neustartfenster fiel, läuft heute gar nicht.                                                                                                       |
| OP-101 | Rate Limiting ist prozesslokal — bei N Web-Containern gilt `N × capacity`                                                                                                                                  | `WP9.md` §5.1; `WP10.md` §4.9; `apps/web/src/lib/rate-limit.ts`                                                                                                                                                            | Betrieb                               | M             | Redis-Backend                                                                        | Ein Login-Lockout überlebt einen Neustart und gilt über alle Container. Für die Ein-Container-Installation folgenlos.                                                            |
| OP-102 | Generische E-Mail-Vorlage ersetzt 48 fachliche Vorlagen                                                                                                                                                    | `WP9.md` §5.2                                                                                                                                                                                                              | fehlende Funktion                     | L             | —                                                                                    | Eine DSGVO-Art.-33-Warnung verdient dieselbe Sorgfalt wie die 27 handgeschriebenen.                                                                                              |
| OP-103 | Vierzehn Pfade melden ehrlich „nicht implementiert" — Connector-Tests, Identity-Prüfungen, Marketplace-Scanner, Simulation, Import, Evidenzprüfung, Modelltraining, acht Modul-Prozesse                    | `WP9.md` §5.3; `apps/worker/src/lib/module-aware-cron.ts:10-17`                                                                                                                                                            | fehlende Funktion                     | XL            | —                                                                                    | Sie existieren heute nicht; der Fix stellte die Ehrlichkeit her, nicht die Funktion.                                                                                             |
| OP-104 | `CLAUDE.md`, `docs/STATUS.md` und `docs/feature-catalog.md` führen mehrere dieser Pfade als „✅ Done"                                                                                                      | `WP9.md` §5.3; Abschlussbericht §6; S14-02 nennt die Fundstellen                                                                                                                                                           | Doku                                  | M             | OP-103                                                                               | Nachweislich falsche Zusagen in der Produktdokumentation.                                                                                                                        |
| OP-105 | Dedup-Schlüssel enthält einen Hash des Titels — Titeländerung erzeugt eine zusätzliche Zustellung                                                                                                          | `WP9.md` §5.4                                                                                                                                                                                                              | Codequalität                          | S             | bewusster Kompromiss                                                                 | **Streichkandidat**: lieber einmal zu viel als eine unterdrückte Fristmeldung.                                                                                                   |
| OP-106 | `job_run` ist Betriebsprotokoll, kein Nachweis (nicht an der Audit-Kette, 90-Tage-Löschung)                                                                                                                | `WP9.md` §5.6                                                                                                                                                                                                              | Doku                                  | S             | —                                                                                    | Wer daraus eine Compliance-Aussage ableitet, muss das gesondert begründen — heute steht das nur im Protokoll.                                                                    |
| OP-107 | `apps/worker/tests/crons/control-embedding-sync.test.ts` rot (der `@grc/ai`-Mock exportiert `providerPlacements` nicht)                                                                                    | `WP9.md` §5.7                                                                                                                                                                                                              | Testlücke                             | S             | WP6-Dateihoheit                                                                      | Eine rote Testdatei beim Abschluss einer Welle; sie gehört grün oder begründet.                                                                                                  |
| OP-108 | `it.fails` in `scheduled-notifications` markiert einen echten Defekt in fremder Datei                                                                                                                      | `WP11.md` §5.3 (WP9 2.5)                                                                                                                                                                                                   | Produktdefekt                         | S             | WP9                                                                                  | Bleibt er länger als eine Iteration stehen, steht in der Suite eine Erwartung, dass etwas kaputt ist.                                                                            |
| OP-109 | `apps/web/src/__tests__/api/ai-assist-routes.test.ts` ist lastabhängig — ein Hook-Fehlschlag überspringt still 10 Tests                                                                                    | `WP11.md` §6.2                                                                                                                                                                                                             | Testlücke                             | S             | —                                                                                    | Ein fehlgeschlagener Hook bleibt ein Fehlschlag statt wie eine bewusste Auslassung auszusehen.                                                                                   |
| OP-110 | Drei Testdateien mit unvollständigem `vi.mock("@/lib/api-errors")` testen die RFC-7807-Normalisierung nicht                                                                                                | `WP12.md` §3.17 (`lib/api-wrapper.test.ts`, `api/wave-25-block-b-c.test.ts`, `api/wave-24-block-c-d.test.ts`)                                                                                                              | Testlücke                             | S             | —                                                                                    | Die Tests sind grün, weil der Wrapper einen Fehlschlag der Normalisierung abfängt — sie prüfen sie nicht.                                                                        |
| OP-111 | `packages/db/src/seed-all.ts:179` benutzt `ALTER TABLE … ENABLE TRIGGER ALL` auf 13 Tabellen — dieselbe Falle wie WP11 2.4                                                                                 | `WP11.md` §6.4                                                                                                                                                                                                             | Produktdefekt                         | S             | —                                                                                    | Heute folgenlos; sie zündet, sobald ein `ENABLE ALWAYS`-Guard auf eine dieser Tabellen gelegt wird.                                                                              |
| OP-112 | TOCTOU zwischen DNS-Prüfung und `fetch` in `safeFetch` — robuster Fix ist ein undici-Dispatcher mit IP-Pinning                                                                                             | `WP5.md` §4                                                                                                                                                                                                                | Produktdefekt                         | M             | ändert das HTTP-Verhalten aller ausgehenden Aufrufe                                  | Die SSRF-Schranke wird gegen DNS-Rebinding dicht.                                                                                                                                |
| OP-113 | `custom_sql` bleibt eine Lesefläche: Org-Admin/Auditor kann jede Zeile lesen, die `grc_app` in seiner Org lesen darf                                                                                       | `WP5.md` §4; `WP5.md` §0                                                                                                                                                                                                   | Entscheidung des Eigentümers          | M             | Entscheidung: Feature behalten oder entfernen                                        | Bewusst akzeptiert; identisch zur Lage bei `bi-reports/execute`. Die Entscheidung gehört dokumentiert, nicht revidiert.                                                          |
| OP-114 | `assertZipWithinLimits` vertraut dem Central Directory — ein Archiv kann beim Entpacken mehr liefern                                                                                                       | `WP5.md` §4                                                                                                                                                                                                                | Codequalität                          | S             | —                                                                                    | Zweite und dritte Schicht fangen es ab; die Pre-Flight-Prüfung wird ehrlich beschrieben oder gehärtet.                                                                           |
| OP-115 | Magic-Bytes-Prüfung ist keine Inhaltsprüfung — eine Datei mit `%PDF`-Header und beliebigem Rest passiert                                                                                                   | `WP5.md` §4                                                                                                                                                                                                                | Doku                                  | S             | ClamAV bleibt zuständig                                                              | **Streichkandidat** als Defekt; als Zusage gehört die Grenze in die Doku.                                                                                                        |
| OP-116 | S04-09 (Fehlerbehandlung in Handlern) ist zu ~8 % abgedeckt — 23 von 276 Handlern                                                                                                                          | `WP5.md` §4                                                                                                                                                                                                                | Codequalität                          | L             | fremde Dateihoheit                                                                   | Inkonsistente Fehlerbehandlung, kein Sicherheitsthema; zusammen mit OP-079 zu erledigen.                                                                                         |
| OP-117 | Ausgehendes Klartext-HTTP für Threat-Feeds ist ab jetzt abgelehnt (`WEBHOOK_ALLOW_HTTP=1` als Ausstieg)                                                                                                    | `WP5.md` §4                                                                                                                                                                                                                | Betrieb                               | S             | —                                                                                    | Bewusste, dokumentierte Regression; Pilotkunden mit HTTP-Feeds brauchen die Variable.                                                                                            |
| OP-118 | AI-Egress-Default ist `any_configured` — die Data-Sovereignty-Zusage hält nur bei gesetzter Richtlinie                                                                                                     | `WP6.md` §5                                                                                                                                                                                                                | Entscheidung des Eigentümers          | S             | Betreiberentscheidung (`egress_mode=local_only` oder `organization.data_residency`)  | Wer die Zusage unbedingt halten will, muss sie setzen; der Default ist bewusst nicht restriktiv.                                                                                 |
| OP-119 | Keine inhaltliche Datenminimierung: bei erlaubter Cloud-Verarbeitung gehen die vollständigen Fachtexte hinaus                                                                                              | `WP6.md` §5; Weg in `WP6.md` §4.9 an WP8 übergeben                                                                                                                                                                         | fehlende Funktion                     | L             | —                                                                                    | Die Zusage „Data Sovereignty" umfasst dann auch den Umfang, nicht nur das Ziel.                                                                                                  |
| OP-120 | Verschlüsselung at rest im Dokumentenspeicher ist eine Betreibermaßnahme (Garage kann SSE nicht)                                                                                                           | `WP7.md` §4 (erstens)                                                                                                                                                                                                      | Entscheidung des Eigentümers          | M             | Betreiberentscheidung: LUKS oder SSE-fähiges Backend                                 | Wer AES-256 at rest für DMS-Dokumente braucht, muss handeln; heute steht es sichtbar statt implizit.                                                                             |
| OP-121 | Signaturkette ist ungeschlüsselt — ein PostgreSQL-Superuser kann den Trigger entfernen                                                                                                                     | `WP7.md` §4 (zweitens); `WP4.md` §5                                                                                                                                                                                        | Produktdefekt                         | L             | OP-125 (WORM-Spiegelung)                                                             | Belastbare Tamper-Evidence ist heute allein der HMAC-gesiegelte `audit_log`.                                                                                                     |
| OP-122 | Mandantentrennung im Objektspeicher ist applikativ, nicht strukturell — ein Bucket pro Mandant fehlt                                                                                                       | `WP7.md` §4 (drittens), Weg in `WP7.md` §3                                                                                                                                                                                 | fehlende Funktion                     | L             | —                                                                                    | `orgScopedStorage` lebt im selben Prozess wie der Code, den sie schützt; Codeausführung im Web-Container umgeht sie.                                                             |
| OP-123 | Kein Streaming: Upload, Download und Hash-Berechnung halten die Datei vollständig im Heap; released PDFs > 20 MB werden abgewiesen                                                                         | `WP7.md` §1 (S06-…, Status **teilweise geschlossen**), §4 (viertens)                                                                                                                                                       | Produktdefekt                         | L             | `WATERMARK_MAX_BYTES` als Zwischenlösung                                             | Große Dokumente werden auslieferbar statt mit `reason: too_large` abgewiesen.                                                                                                    |
| OP-124 | `audit_log.metadata` ist unter Hash-v4 direkte Hash-Eingabe und deshalb nicht redigierbar — ein Freitext-`reason` mit Klartext überlebt eine Art.-17-Löschung                                              | `WP8.md` §5 (erstens)                                                                                                                                                                                                      | Produktdefekt                         | M             | —                                                                                    | Der Löschpfad wird vollständig; heute bleibt eine benannte Lücke.                                                                                                                |
| OP-125 | WORM-Spiegelung der Ankersiegel außerhalb der Datenbank (WP4 Phase 2)                                                                                                                                      | `WP4.md` §5; `WP10.md` §4.13                                                                                                                                                                                               | fehlende Funktion                     | L             | Append-only-Speicher außerhalb der DB (Betreiber)                                    | Der einzige Schritt, der die Restlücke gegen einen Datenbank-Superuser schließt.                                                                                                 |
| OP-126 | Restore aus einem Backup vor dem Löschantrag bringt den Personenbezug zurück — kein Wiederanwendungsmechanismus                                                                                            | `WP8.md` §5 (zweitens)                                                                                                                                                                                                     | fehlende Funktion                     | M             | über Backup-Aufbewahrung steuerbar                                                   | Art. 17 hält auch über einen Restore hinweg.                                                                                                                                     |
| OP-127 | Legal Hold existiert nur auf `document`; der Vorrang einer Aufbewahrungspflicht ist eine organisatorische Prüfung                                                                                          | `WP8.md` §5 (drittens); ADR-011 rev.2 führt ihn selbst als zurückgestellt                                                                                                                                                  | fehlende Funktion                     | L             | —                                                                                    | Der Zielkonflikt Löschpflicht ↔ Aufbewahrungspflicht wird technisch entschieden statt per DSB-Handgriff.                                                                         |
| OP-128 | Re-Seal-Skript für `WB_ENCRYPTION_KEY` fehlt — Rotation nur mit dauerhaftem `WB_ENCRYPTION_KEY_PREVIOUS`                                                                                                   | `WP10.md` §4.12 (WP8-Punkt 2)                                                                                                                                                                                              | Betrieb                               | S             | —                                                                                    | Analog zu `scripts/encrypt-connector-secrets.mjs`; Schlüsselrotation wird ein normaler Vorgang.                                                                                  |
| OP-129 | `webhook_registration.secret_hash` enthält keinen Hash, sondern das Klartext-HMAC-Geheimnis (S10-26, Status **teilweise**)                                                                                 | `WP9.md` §2 S10-26; `WP10.md` §4.10; Migration 0436 kennzeichnet es nur                                                                                                                                                    | Doku                                  | S             | drei Dateihoheiten                                                                   | Die Umbenennung nach `signing_secret` beendet eine irreführende Spaltenbezeichnung in einem Sicherheitskontext.                                                                  |
| OP-130 | Doku-Drift rund um den Worker (S10-27, Status **teilweise**): `docs/STATUS.md:321` (124 statt 131 Cron-Jobs), `:350`, `:92`, `docs/ADR-019` behauptet ein Caddy-Limit, das es nicht gibt                   | `WP9.md` §2 S10-27                                                                                                                                                                                                         | Doku                                  | S             | —                                                                                    | Vier belegte Falschaussagen in der Betriebsdokumentation.                                                                                                                        |
| OP-131 | `deploy/update-all.sh` fährt `sort` und `                                                                                                                                                                  |                                                                                                                                                                                                                            | true`und ruft`db-backup.sh` nicht auf | `WP1.md` §7.2 | Betrieb                                                                              | S                                                                                                                                                                                | —   | Ein fehlgeschlagener Schritt im Deploy bricht ab statt still weiterzulaufen. |
| OP-132 | `docs/ADR-023` steht auf _Proposed_, obwohl §1/§3/§4 implementiert sind                                                                                                                                    | `WP1.md` §7.2                                                                                                                                                                                                              | Doku                                  | S             | —                                                                                    | Der Entscheidungsstand entspricht der Umsetzung.                                                                                                                                 |
| OP-133 | `docs/runbook.md` §5 (Compensating-Migration-Flow) fehlt                                                                                                                                                   | `WP1.md` §7.2                                                                                                                                                                                                              | Doku                                  | S             | —                                                                                    | Der dokumentierte Rückweg für eine fehlerhafte Migration existiert.                                                                                                              |
| OP-134 | Migrationen `0383`, `0385`, `0386` sind `Breaking` und brauchen ein Pre-Deploy-Backup; `0387` legt 450 Indizes an (Wartungsfenster)                                                                        | `WP1.md` §7.2                                                                                                                                                                                                              | Betrieb                               | S             | erster Produktionsrollout                                                            | Ein Rollout ohne Wartungsfenster auf einer befüllten Datenbank ist sonst ein Ausfall.                                                                                            |
| OP-135 | Vier Migrationen brauchen einen zweiten Pass (`0068`, `0069`, `0071`, `0106`)                                                                                                                              | `WP1.md` §7.4                                                                                                                                                                                                              | Codequalität                          | M             | topologische Sortierung würde ausgelieferte Migrationen ändern                       | Der Migrationslauf wird einpassig und damit erklärbar.                                                                                                                           |
| OP-136 | `dashboard_widget_config` (13 System-Dashboards) und `notification_template` (3 RCSA-Vorlagen) haben kein Zielmodell; die Seeds sind No-Ops                                                                | `WP1.md` §7.5                                                                                                                                                                                                              | fehlende Funktion                     | M             | fachliche Entscheidung                                                               | Entweder ein org-gebundenes Zielmodell oder die Seeds entfallen; heute liegt totes Gewicht im Seed.                                                                              |
| OP-137 | Fünf Spalten, in denen die Datenbank strenger ist als der Code (`*_sign_off.ip_address` als `inet`, `catalog_entry_mapping.*` als Enum)                                                                    | `WP1.md` §7.6 (`ACCEPTED_TYPE_DRIFT`)                                                                                                                                                                                      | Codequalität                          | S             | Code-Seite liegt bei WP7 bzw. dem Katalogmodul                                       | Der Drift-Check wird wieder eine vollständige Aussage.                                                                                                                           |
| OP-138 | Veralteter Kommentar in `packages/db/src/index.ts:157` nennt `create-missing-tables.ts` noch als Teil des Ablaufs                                                                                          | `WP1.md` §7.1                                                                                                                                                                                                              | Doku                                  | S             | —                                                                                    | Der Kommentar beschreibt ein Skript, das genau der Defekt war, den der Audit fand.                                                                                               |
| OP-139 | `account`, `session`, `verification_token` tragen RLS ohne jede Policy (deny-all) und werden nicht benutzt                                                                                                 | `/work/audit/remediation/RESTDEFEKTE.md` „Weiterhin offen"; `WP1.md` §7.1 (account-Policy über `user_id`)                                                                                                                  | Codequalität                          | S             | Entscheidung: entfernen oder als bewusst tot dokumentieren                           | Löst zugleich drei der vier Meldungen in OP-052 auf.                                                                                                                             |
| OP-140 | `getControlCoverage` enthält einen sinnlosen `LEFT JOIN process_control pc ON pc.process_id IS NOT NULL` (Kreuzprodukt)                                                                                    | `RESTDEFEKTE.md` „Weiterhin offen"; Code: `packages/reporting/src/threat-dashboard.ts:246`                                                                                                                                 | Codequalität                          | S             | von keiner Route erreichbar                                                          | **Streichkandidat**, solange die Funktion tot ist — sonst ein Kreuzprodukt in einem Reporting-Pfad.                                                                              |
| OP-141 | Prettier-Tor rot im Arbeitsbaum: 159 Dateien, überwiegend eingecheckte `coverage/`-Artefakte, die `.gitignore` nicht ausnimmt                                                                              | `RESTDEFEKTE.md` „Weiterhin offen"; `STUFE2-D-OFFENE-PUNKTE.md` §6 (sieben weitere Dateien aus fremden Strängen)                                                                                                           | Codequalität                          | S             | —                                                                                    | Ein Formatier-Tor, das dauerhaft rot ist, wird ignoriert; die `coverage/`-Artefakte gehören nicht ins Repo.                                                                      |
| OP-142 | `0394` ist ein Einmal-Scan — eine spätere FOR-ALL-Migration mit `org_id IS NULL` brächte S01-07 lautlos zurück                                                                                             | `VERIFIKATION.md` Teil D O-9                                                                                                                                                                                               | Codequalität                          | S             | Dauerschutz ist heute allein der RLS-Systemtest                                      | Ein wiederkehrender Scan statt einer Momentaufnahme.                                                                                                                             |
| OP-143 | `grc_platform` im Container ist nicht auf Branch-Stand (528 Tabellen, alter `audit_trigger` auf `wb_report`, kein `export_approval`)                                                                       | `VERIFIKATION.md` Teil D O-10                                                                                                                                                                                              | Betrieb                               | S             | —                                                                                    | Wer dagegen misst, misst einen anderen Codestand — das erklärt vermutlich die zwei nicht reproduzierbaren Testfehler B.1/B.2.                                                    |
| OP-144 | `@grc`-Scope auf npmjs.com nicht registriert (Dependency Confusion)                                                                                                                                        | `WP10.md` §4.3 (S08-13)                                                                                                                                                                                                    | Entscheidung des Eigentümers          | S             | Konto des Eigentümers                                                                | Verhindert, dass ein Dritter den Scope belegt.                                                                                                                                   |
| OP-145 | Acht überholte `dependabot/*`-Branches auf origin                                                                                                                                                          | `WP10.md` §4.5 (S08-20)                                                                                                                                                                                                    | Betrieb                               | S             | Eigentümer                                                                           | Kein Rückstau-Eindruck, den es nicht mehr gibt.                                                                                                                                  |
| OP-146 | Erster Lauf der Betriebsskripte auf Staging steht aus (`update-all.sh`, `rollback.sh`, `db-backup.sh`, `offsite-sync.sh`, `dr-restore-drill.sh`)                                                           | `WP10.md` §4.6, §5 („richtig geschrieben, nicht erprobt"); Abschlussbericht §7                                                                                                                                             | Betrieb                               | M             | Staging-Umgebung mit Docker-Daemon                                                   | Genau dieser Unterschied hat die drei falschen Rollback-Kommandos aus S13-05 entstehen lassen.                                                                                   |
| OP-147 | Alarm-Zustellkanal nicht eingerichtet (`ALERT_WEBHOOK_URL`, `HEALTHCHECKS_URL`)                                                                                                                            | `WP10.md` §4.7 (S13-11, S13-12), §5; Abschlussbericht §5 O-D                                                                                                                                                               | Betrieb                               | S             | Eigentümer setzt die Variablen                                                       | Ein Alarm, den niemand empfängt, ist kein Alarm; der Dead-Man's-Switch ist der einzige Mechanismus, der „Host tot" meldet.                                                       |
| OP-148 | Zweite Replik für echtes Zero-Downtime (S13-22, Status **teilweise**)                                                                                                                                      | `WP10.md` §1 S13-22, §4.8; Weg in `docs/runbook.md` §6                                                                                                                                                                     | Entscheidung des Eigentümers          | L             | Architekturentscheidung; Voraussetzung Expand/Contract-Disziplin (ADR-023)           | Deployments ohne Ausfallfenster.                                                                                                                                                 |
| OP-149 | Fachliche DMS-Alarmschwellen fehlen (`controlled_copy_watermark_failed`, `uncontrolled_copy_download`, `storage_integrity_mismatch`)                                                                       | `WP10.md` §4.11                                                                                                                                                                                                            | Entscheidung des Eigentümers          | S             | fachliche Entscheidung über die Schwellen                                            | Der Mechanismus steht; ohne Schwellen feuert er nie.                                                                                                                             |
| OP-150 | Required Checks in GitHub nicht konfiguriert — vier Workflows sind pfadgefiltert, ein leerer Check-Satz ist nicht von einem grünen zu unterscheiden                                                        | `WP10.md` §4.14                                                                                                                                                                                                            | Entscheidung des Eigentümers          | S             | GitHub-Einstellung                                                                   | Insbesondere `Security Audit` (das Gate aus S08-03) muss required sein.                                                                                                          |
| OP-151 | Zwei neue Workflows nicht in der Branch-Protection: `openapi-breaking-change.yml` und der Job `i18n-code-vs-catalog`                                                                                       | `WP12.md` §3.10                                                                                                                                                                                                            | Betrieb                               | S             | OP-150                                                                               | Die beiden neuen Tore wirken erst, wenn sie required sind.                                                                                                                       |
| OP-152 | 222 `console.*`-Aufrufe (58 web, 164 worker) gehen am Field-Scrubbing vorbei                                                                                                                               | `WP10.md` §4.15 (S13-15), §5                                                                                                                                                                                               | Codequalität                          | M             | **vor** dem Anschluss an einen externen Log-Empfänger (ADR-017)                      | Sonst ist die Zusage „keine sensiblen Daten im Log" wieder eine Behauptung.                                                                                                      |
| OP-153 | `E2E_EMAIL` / `E2E_PASSWORD` nicht als Repository-Secrets angelegt — der E2E-Job fällt auf                                                                                                                 | `WP10.md` §4.17                                                                                                                                                                                                            | Betrieb                               | S             | Eigentümer                                                                           | Beabsichtigtes Fail-loud; ohne die Secrets läuft die Suite in CI nicht.                                                                                                          |
| OP-154 | Trigger-Zustand auf allen bestehenden Datenbanken einmalig prüfen — ein Guard kann vorhanden und trotzdem wirkungslos sein (`tgenabled <> 'A'`)                                                            | `WP10.md` §4.18; belegt: `audit_anchor_append_only_trg`/`audit_anchor_no_truncate` auf `'O'`, `audit_log_tombstone_guard` auf `'D'`                                                                                        | Betrieb                               | S             | Betreiberschritt je Installation                                                     | Auf einer Produktivdatenbank wäre eine deaktivierte Löschsperre auf `audit_log` ein Auditbefund erster Ordnung.                                                                  |
| OP-155 | Schema-Drift-Endpunkt vergleicht den ENABLE-Zustand von Triggern nicht                                                                                                                                     | `WP10.md` §4.18 („Für WP1 relevant"); S09-09                                                                                                                                                                               | Testlücke                             | S             | OP-154                                                                               | Genau dieser Zustand ist der Unterschied zwischen „Guard vorhanden" und „Guard wirkt".                                                                                           |
| OP-156 | Seed-Admin und ggf. `AUTH_SECRET` rotieren — ein Sitzungstoken liegt in der öffentlichen Historie (`1a19506c`, `415f50ff`)                                                                                 | `WP10.md` §4.19; `WP11.md` §6.1                                                                                                                                                                                            | Entscheidung des Eigentümers          | S             | Eigentümer; entschärfend: localhost-gebunden, seit 2026-04-06 abgelaufen, Seed-Konto | Rotation beendet die Gültigkeit sofort — anders als die Historienbereinigung (OP-060).                                                                                           |
| OP-157 | Verschachtelte interaktive Elemente in der Budget-Karte (`<button>` in `<button>`) — ungültiges HTML                                                                                                       | `WP12.md` §3.20                                                                                                                                                                                                            | Produktdefekt                         | M             | Designentscheidung: Kachel mit benanntem Link statt flächig klickbarer Fläche        | Das Verhalten ist zwischen Browsern nicht definiert; a11y-relevant.                                                                                                              |
| OP-158 | `messages/{de,en}/identity.json:111` („Self-hosted. Keine US-Cloud-Abhängigkeit.") — WP6 hat eine Präzisierung vorgeschlagen                                                                               | `WP12.md` §3.17                                                                                                                                                                                                            | Entscheidung des Eigentümers          | S             | Produkt-/Marketingabstimmung                                                         | Für die Standardkonfiguration richtig; mit gesetzten Cloud-Keys irreführend.                                                                                                     |
| OP-159 | `ARCTOS_BUILD_IGNORE_TS_ERRORS=1` existiert als Schalter — er darf nicht benutzt werden, um Typfehler loszuwerden                                                                                          | `WP12.md` §3.19; `apps/web/next.config.ts`                                                                                                                                                                                 | Doku                                  | S             | —                                                                                    | Ein sichtbarer, bewusster Akt statt eines stillen `ignoreBuildErrors: true`; die Regel gehört in den Review-Leitfaden.                                                           |
| OP-160 | `bpmn-grc-bridge.ts` führt eine zweite, veraltete `MISSING_TODAY`-Liste mit zehn Einträgen                                                                                                                 | Code: `apps/web/src/components/bpmn/bpmn-grc-bridge.ts:124-180` gegen `apps/web/src/lib/grc-overlay.ts:363` (7 Einträge) — Details in Abschnitt B                                                                          | Doku                                  | S             | —                                                                                    | Zwei Listen mit widersprüchlichem Inhalt; die ältere behauptet fehlende Tabellen, die es seit 0444–0454 gibt.                                                                    |
| OP-161 | Shadow-Compare-Betrieb: 30 Tage bzw. 500 Speichervorgänge ohne Abweichung                                                                                                                                  | `STUFE2-D-OFFENE-PUNKTE.md` §4; `STUFE2-C-ABSCHLUSS.md` §5 Kriterium 3; Plan §5.6 Kriterium 3                                                                                                                              | Zeitkriterium                         | XL            | **verstrichene Zeit unter echter Benutzung** — nicht durch Testläufe ersetzbar       | Der einzige Nachweis, dass die eigene Engine im Alltag nichts verliert; sinnvoll, ihn jetzt zu beginnen.                                                                         |
| OP-162 | Pilotphase nicht begonnen — Kriterium 8 („keine offene Regression ‚hoch' aus der Pilotphase") ist unbewertbar                                                                                              | `STUFE2-C-ABSCHLUSS.md` §5 (Kriterientabelle)                                                                                                                                                                              | Zeitkriterium                         | XL            | OP-161, OP-027, OP-036                                                               | Das Wasserzeichen kann erst fallen, wenn alle acht Kriterien gleichzeitig erfüllt sind.                                                                                          |
| OP-163 | XML-Vergleich im Shadow-Compare ist abgeschaltet — die Klasse `both-lossy` kann heute gar nicht auftreten                                                                                                  | `STUFE2-A3-VERIFIKATION.md` §3.9 („Zur Null bei `both-lossy`")                                                                                                                                                             | Testlücke                             | M             | OP-020, OP-021 (sinnvoll erst bei kurzer `ours-wrong`-Liste)                         | Die Null bedeutet heute nicht „moddle verliert nichts", sondern „auf dieser Ebene nicht messbar".                                                                                |
| OP-164 | Erster Staging-Lauf ist der eigentliche Beweis: Backup, Off-Site-Verschlüsselung, DR-Restore, Alarmzustellung, Scheduler sind nur gegen Testdatenbanken verifiziert                                        | Abschlussbericht §7                                                                                                                                                                                                        | Betrieb                               | M             | OP-146                                                                               | Alle Kontrollen, die im Betrieb wirken sollen, sind nie gegen eine Produktivumgebung gelaufen.                                                                                   |
| OP-165 | Rechtliche Würdigung steht aus (Signaturklasse, Art. 17 gegen Unveränderlichkeit, ab wann Pseudonymisierung als Löschung gilt)                                                                             | Abschlussbericht §7                                                                                                                                                                                                        | Entscheidung des Eigentümers          | M             | anwaltliche Prüfung                                                                  | Die Remediation stellt technische Voraussetzungen her; die Bewertung ist keine Rechtsberatung.                                                                                   |
| OP-166 | Kein Penetrationstest gegen eine laufende Produktivinstanz                                                                                                                                                 | Abschlussbericht §7 („Grenzen dieses Audits")                                                                                                                                                                              | Testlücke                             | L             | Produktivinstanz                                                                     | Der Audit war statisch plus Testumgebung; die Angriffsfläche im Betrieb ist unvermessen.                                                                                         |

---

## A. Nicht durch Arbeit lösbar

Ehrlich abgegrenzt: „braucht 30 Tage Laufzeit" ist etwas anderes als „ist aufwendig".

### A.1 Zeitkriterien — Arbeit hilft nicht, nur verstrichene Zeit

| ID     | Punkt                                                                                             | Was die Zeit leisten muss                                                                                                                                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OP-161 | Shadow-Compare-Betrieb, 30 Tage bzw. 500 Speichervorgänge ohne Abweichung (Plan §5.6 Kriterium 3) | Echte Benutzung durch echte Nutzer. Weder mehr Testläufe noch mehr erzeugte Folgen ersetzen das — beides misst etwas anderes. `shadowCompare()` trägt es ohne Umbau, der Editor kann seit Stufe C speichern. **Der Betrieb kann heute beginnen**; jeder Tag ohne Start ist ein verlorener Tag. |
| OP-162 | Pilotphase für Kriterium 8 („keine offene Regression ‚hoch'")                                     | Ein Release-Zyklus mit Nutzern. Ohne Pilotphase ist das Kriterium nicht erfüllbar, sondern unbewertbar.                                                                                                                                                                                        |
| OP-097 | Rotationsfenster für `dd_session.access_token` / `user.ical_token`                                | Ausgegebene Links müssen ablaufen, bevor `DROP COLUMN` folgen darf. Die Arbeit danach ist eine Migration (S).                                                                                                                                                                                  |

### A.2 Entscheidungen des Eigentümers / Betreibers — außerhalb des Repositories

| ID              | Punkt                                                             | Wer entscheidet, wo                                                                  |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| OP-059          | Repository auf privat stellen                                     | Eigentümer, GitHub-Interface. Solange offen, sind alle übrigen Maßnahmen nachrangig. |
| OP-060          | Historienbereinigung                                              | Eigentümer; bei öffentlichem Repo ohnehin nur begrenzt wirksam.                      |
| OP-061          | bpmn.io: kommerzielle Lizenz oder Wasserzeichen                   | Geschäftsentscheidung. Keine CSS-Regel ist zulässig.                                 |
| OP-144          | `@grc`-Scope auf npmjs.com registrieren                           | Eigentümer, npm-Konto.                                                               |
| OP-145          | Acht überholte `dependabot/*`-Branches schließen                  | Eigentümer, GitHub.                                                                  |
| OP-147          | `ALERT_WEBHOOK_URL` / `HEALTHCHECKS_URL` setzen                   | Betreiber, `/opt/arctos/.env`. Code ist fertig und ohne diesen Schritt folgenlos.    |
| OP-148          | Zweite Replik für Zero-Downtime                                   | Architekturentscheidung des Betreibers.                                              |
| OP-149          | Schwellen der fachlichen DMS-Alarme                               | Fachliche Entscheidung.                                                              |
| OP-150 / OP-151 | Required Checks konfigurieren                                     | Eigentümer, GitHub Branch Protection.                                                |
| OP-153          | `E2E_EMAIL` / `E2E_PASSWORD` als Repository-Secrets               | Eigentümer, GitHub Actions Secrets.                                                  |
| OP-154          | Trigger-`ENABLE ALWAYS` auf bestehenden Datenbanken prüfen        | Betreiber, je Installation, einmalig.                                                |
| OP-156          | Seed-Admin und ggf. `AUTH_SECRET` rotieren                        | Eigentümer. Rotation beendet die Gültigkeit sofort, anders als OP-060.               |
| OP-095          | Migration 0411 einspielen (Plattform-Admin am DB-Prompt)          | Betreiber.                                                                           |
| OP-118          | AI-Egress-Richtlinie setzen (`local_only` / `data_residency`)     | Betreiber; der Default `any_configured` ist bewusst nicht restriktiv.                |
| OP-120          | Verschlüsselung at rest (LUKS oder SSE-fähiges Backend)           | Betreiber.                                                                           |
| OP-125          | Append-only-Speicher für die WORM-Spiegelung bereitstellen        | Betreiber; die Arbeit danach ist L.                                                  |
| OP-158          | Formulierung „Keine US-Cloud-Abhängigkeit"                        | Produkt-/Marketingentscheidung.                                                      |
| OP-165          | Rechtliche Würdigung (Signaturklasse, Art. 17, Pseudonymisierung) | Anwaltliche Prüfung; keine technische Arbeit.                                        |
| OP-113          | `custom_sql` als Lesefläche behalten oder entfernen               | Produktentscheidung; bewusst akzeptiert.                                             |
| OP-054          | `AUDIT_INTEGRITY` 1/min — so gemeint oder nicht?                  | Entscheidung, dann S Arbeit.                                                         |

### A.3 Braucht eine Umgebung, die es hier nicht gibt — Arbeit hilft, aber nicht allein

Diese sind **nicht** Zeitkriterien, sondern Ressourcenfragen. Sie werden hier getrennt genannt,
weil sie in den Berichten gern mit A.1 vermischt werden.

- **OP-146 / OP-164** — Staging mit Docker-Daemon und Produktions-Stack. Die Skripte sind
  geschrieben und geprüft, nur nie ausgeführt.
- **OP-062 / OP-034 / OP-035** — Browserlauf, echte Geräte, assistive Technologie.
- **OP-166** — laufende Produktivinstanz für einen Penetrationstest.
- **OP-143** — eine Datenbank auf Branch-Stand.

---

## B. Widersprüche und Dubletten — gegen den Code geprüft

### B.1 Zwei `MISSING_TODAY`-Listen, eine davon nachweislich falsch

`apps/web/src/components/bpmn/bpmn-grc-bridge.ts:124` führt zehn Einträge und behauptet unter
anderem:

- „Es gibt keine Lane-Tabelle (`process_lane`) und keine SoD-Regelmenge (`sod_rule`)" (Zeile 170)
- „`process_step_raci` fehlt" (Zeile 156)
- „`process_step.step_key` existiert nicht" (Zeile 175)
- „`finding.due_at` existiert im Schema nicht"

**Der Code sagt etwas anderes.** `packages/db/drizzle/0444_process_lane.sql`,
`0446_sod_rule.sql`, `0447_process_step_raci.sql` und `0445_process_step_identity.sql`
(`step_key`) existieren; `apps/web/src/app/api/v1/processes/[id]/diagram-overlay/route.ts:400`
und `:427` lesen `process_lane` und `sod_rule` produktiv;
`packages/db/src/schema/process-diagram-grc.ts:66` definiert `processLane`.
**Es gilt:** `apps/web/src/lib/grc-overlay.ts:363` mit **sieben** Einträgen ist die maßgebliche
Liste; die Fassung in `bpmn-grc-bridge.ts` ist der Stand vor Stufe E und gehört gestrichen oder
auf die neue verwiesen (→ OP-160). Ein Wächtertest prüft nur die Liste in `grc-overlay.ts`
(`apps/web/src/__tests__/lib/grc-overlay.test.ts:742`), nicht die in der Brücke — die falsche
Liste hat also keinen Wächter.

### B.2 „Produktionsbuild nicht herstellbar" gegen „Compiled successfully"

- Abschlussbericht §5 **O-E** und `VERIFIKATION.md` Teil D **O-7**: „nicht herstellbar (> 7 GB RAM)".
- `WP12.md` S12-16: „offen — scheitert **nicht** am Speicher", Turbopack-Verklemmung.
- `E2E-TRIAGE-4.md` §6.3: `npm run build --workspace=@grc/web` → „**Compiled successfully**,
  Finished TypeScript in 4.8min", mit `ignoreBuildErrors=false`.

**Es gilt:** Der Bau **läuft** — auf der Maschine des Eigentümers, gegen `81200d89` plus dem
Änderungssatz von Runde 4. Er läuft **nicht** in der Auditumgebung (2 vCPU, 7 GB). Das ist eine
Umgebungs-, keine Produktaussage. Nachfolgeposten ist nicht der Bau selbst, sondern OP-053
(der Bau löscht `.env.local`) — das ist der Teil, der reproduzierbar Schaden anrichtet.

### B.3 „Playwright-E2E: kein grüner Gesamtlauf" gegen 199/199

- Abschlussbericht §5 **O-F**: „Ein vollständiger Lauf kam nicht zustande: 31 von 47
  Regressions-Specs, 13 grün, 11 rot, 7 übersprungen. Es gibt keine Vergleichsbasis."
- `VERIFIKATION.md` Teil D **O-5**: „Neun weitere E2E-Regressionsfehler … plus die 16 nie
  erreichten Specs."
- `E2E-TRIAGE-4.md` §6.1: „Lauf 8: **199 Tests — 199 bestanden, 0 gescheitert, 0 übersprungen**,
  4,5 min", Lauf 9 als Wiederholung unverändert.

**Es gilt:** Der grüne Vollauf existiert und ist zweimal reproduziert. Die vier Triage-Runden
haben O-F/O-5 abgearbeitet. Was **offen bleibt**, ist nicht der Lauf, sondern das, was er nicht
abdeckt: die Canvas-Bedienung (OP-027) und der Mandanten-Zwiespalt für das Admin-Konto (OP-056).

### B.4 „Drei Pakete mit abgeschwächten Compiler-Optionen" gegen zehn

- Abschlussbericht §5 **O-H** und `VERIFIKATION.md` **O-8**: „`db`, `shared` und `auth`".
- `WP12.md` §3.13: „in den **zehn** Paket-Konfigurationen aus".
- **Code:** `noUncheckedIndexedAccess: false` steht in **zehn** `packages/*/tsconfig.json` —
  `ai`, `auth`, `automation`, `db`, `email`, `events`, `graph`, `reporting`, `shared`, `ui`.
  `tsconfig.base.json:16-17` setzt beide Flags auf `true`.

**Es gilt:** zehn Pakete. Die im Abschlussbericht genannten Zahlen (641/502/321) sind die
gemessene Restschuld dreier Pakete, nicht die Zahl der betroffenen Pakete; `email` mit 542
fehlt dort ganz (→ OP-065).

### B.5 „404 eingefrorene Lint-Befunde" gegen 418 gemessen

- Abschlussbericht §5 **O-G**, `RESTDEFEKTE.md` **O-1**, `.eslint-ratchet.json`: Baseline **404**.
- **Code:** `node scripts/lint-ratchet.mjs` am 2026-09-02 → **418** Befunde, `no-console`
  **135 > 121 (+14)**, Exit ≠ 0.

**Es gilt:** Die Ratsche ist **verletzt**, nicht nur unerfüllt. Die 14 stammen aus
`packages/db/src/seed-e2e-users.ts` (8, aus E2E-Triage 3), `packages/db/src/seed-demo.ts` (3,
aus E2E-Triage 1) und `packages/bpmn/test/model/measure-roundtrip.ts` (3) — also aus den
Arbeitssträngen nach dem Audit (→ OP-064).

### B.6 „37 UI-Aufrufe mit `limit > 100`" gegen 30 gemessen

- `E2E-TRIAGE-3.md` §6 und `E2E-TRIAGE-4.md` §9: **37**.
- **Code:** 30 Fundstellen in `apps/web/src` (26× `limit=200`, 1× `300`, 2× `500`, 1× `10000`),
  34 im ganzen Repo ohne `node_modules`.

**Es gilt:** 30 in der Oberfläche. Die Differenz ist vermutlich eine andere Zählmethodik
(Serverpfade oder Tests mitgezählt); die Fehlerklasse ist unverändert (→ OP-050).

### B.7 „6.794 / 6.795 ungenutzte i18n-Schlüssel" gegen 6.796

- `WP12.md` S14-21: „Stand nach dieser Remediation: **6.794**", Budget 6.800.
- **Code:** `audit-i18n-usage.mjs` → **6.796**.

Innerhalb des Budgets, aber gestiegen. Die parallel gemeldete Zahl „74 Komponenten ohne i18n"
(WP12 S14-14) ist inzwischen **75**, und damit ist die Untranslated-Ratsche gerissen (→ OP-071).

### B.8 „1.991 tote Exports" gegen 2.706

- `docs/perf/dead-exports-report.md:15` (eingecheckt): **1.991 in 322 Dateien**.
- **Code:** `node scripts/audit-dead-exports.mjs` am 2026-09-02 → **2.706 in 461 Dateien**.

**Es gilt:** 2.706. Der eingecheckte Report ist um 715 Einträge veraltet, und es gibt kein
CI-Gate, das das bemerkt hätte (→ OP-074, OP-075). _(Der Report wurde nach der Messung wieder
auf den eingecheckten Stand zurückgesetzt — diese Datei ist die einzige Änderung dieser Arbeit.)_

### B.9 Dieselbe Restlücke in zwei Protokollen: Drill-down

`STUFE2-A1-MODELING.md` §7.2 (Modellierungsschicht), `STUFE2-B1-EDITOR.md` §7.2 (Bedienung),
`STUFE2-C-ABSCHLUSS.md` §5.5, `STUFE2-D-OFFENE-PUNKTE.md` §3.2, `SPIKE-MESSUNG-DRAW.md` §2.3
und `STUFE2-A2-GRC.md` §6 nennen es je einzeln. Es ist **ein** Arbeitspaket (→ OP-018), nicht
sechs; die GRC-Schicht kompensiert es fachlich über die Roll-up-Rechnung.

### B.10 Auto-Resize: in C §5.6 offen, in D §2.6 geschlossen

`STUFE2-C-ABSCHLUSS.md` §5.6 und `STUFE2-B1-EDITOR.md` §7.5 führen „Kein Auto-Resize" als offen.
`STUFE2-D-OFFENE-PUNKTE.md` §2.6 und §0 („Container-Bounds — Auto-Resize gebaut", `bounds`-Klassen
von 8+7 auf 1+0) führen es als geschlossen. **Es gilt D** — der spätere Bericht; C und B1 sind
Momentaufnahmen davor. Rest ist OP-024 (2 verbliebene `bounds`-Fälle).

### B.11 `MISSING_TODAY`-Umfang: 13 → 10 → 7

`STUFE2-C-ABSCHLUSS.md` §5.11 spricht von „zehn Vertragsfeldern", `STUFE2-D-OFFENE-PUNKTE.md` §0
von 13, `STUFE2-E-SCHEMA.md` §0 von 7. **Der Code sagt 7** (`grc-overlay.ts:363`, gezählt).
Die Zehn in C beziehen sich auf die Brückenliste aus B.1.

### B.12 Findings-Register: nur ein „teilweise", die Protokolle nennen deutlich mehr

`FINDINGS_REGISTER.md` enthält genau **einen** Treffer für „teilweise" (S05-11, in der
Befundbeschreibung, nicht im Status). Die Umsetzungsprotokolle führen dagegen mindestens
**zwölf** Findings mit Status „teilweise": S01-04, S01-09, S01-11, S01-26 (WP2), S03-10 (WP4),
S06-… Speicherdeckelung (WP7 §1), S10-26, S10-27 (WP9), S13-22, Health-Endpunkt-Umfang (WP10),
S12-05, S14-14, S14-16, S14-18, S14-19 (WP12). **Es gilt:** Das Register führt keinen
Umsetzungsstand je Finding — wer nur dorthin sieht, hält 323 Findings für geschlossen. Die
Teilstände dieses Registers sind OP-083, OP-086, OP-090, OP-091, OP-100, OP-123, OP-129,
OP-130, OP-148, OP-070, OP-079, OP-076.

---

## C. Bereits erledigt, aber noch als offen geführt

Im Code nachgeprüft. Diese Punkte gehören aus den jeweiligen Berichten ausgetragen.

| Geführt als offen in                                                                                               | Punkt                                                                                                                                                                                                                              | Codebefund                                                                                                                                           | Urteil                                                                                   |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `STUFE2-B2-EINBINDUNG.md` §5.1 Punkt 1                                                                             | `"./grc"` fehlt in `packages/bpmn/package.json#exports` — „blockiert die GRC-Dekoration"                                                                                                                                           | `packages/bpmn/package.json#exports` führt `.`, `./model`, `./draw`, `./viewer`, `./modeling`, `./editor`, **`./grc`**                               | **erledigt**                                                                             |
| `STUFE2-B2-EINBINDUNG.md` §5.2 („die wichtigste offene Vorbedingung für den Pilotbetrieb")                         | `@grc/bpmn` fehlt in `apps/web/package.json`; `transpilePackages` fehlt                                                                                                                                                            | `apps/web/package.json:21` `"@grc/bpmn": "^0.1.0"`; `apps/web/next.config.ts:29` listet `@grc/bpmn` in `transpilePackages`                           | **erledigt**                                                                             |
| `STUFE2-B2-EINBINDUNG.md` §5.4                                                                                     | `ReplaceMenu.ts:120` setzt `node.innerHTML` und bricht den Sicherheitstest S12-15                                                                                                                                                  | `packages/bpmn/src/editor/ReplaceMenu.ts:123` — Kommentar „[ARCTOS-FULL-2026-08-31 · S12-15] Kein `innerHTML`", kein `innerHTML =` mehr im Quelltext | **erledigt**                                                                             |
| `STUFE2-C-ABSCHLUSS.md` §5.11                                                                                      | „`decorateGrc` hat noch keinen Datenlieferanten … keine Seite reicht ihn durch"                                                                                                                                                    | Endpunkt `apps/web/src/app/api/v1/processes/[id]/diagram-overlay/route.ts` existiert; zwei Einbindungen reichen durch (`STUFE2-D` §1.6)              | **erledigt**, Rest ist OP-026                                                            |
| `STUFE2-C-ABSCHLUSS.md` §5.6, `STUFE2-B1-EDITOR.md` §7.5                                                           | Kein Auto-Resize                                                                                                                                                                                                                   | `STUFE2-D` §2.6 gebaut; `bounds/bpmn:{SubProcess,Participant}` von 8+7 auf 1+0                                                                       | **erledigt**, Rest ist OP-024                                                            |
| `STUFE2-C-ABSCHLUSS.md` §5.7/§5.8, `STUFE2-B1-EDITOR.md` §7.4/§7.6                                                 | Containerwechsel per Tastatur, Suche im Diagramm, Tastaturhilfe (`?`)                                                                                                                                                              | `STUFE2-D-OFFENE-PUNKTE.md` §3.1 „Geschlossen"                                                                                                       | **erledigt**                                                                             |
| `STUFE2-C-ABSCHLUSS.md` §5 Kriterium 2 („9 Divergenzklassen"), `STUFE2-A3-VERIFIKATION.md` §3.9 (143 Abweichungen) | Divergenzzahlen                                                                                                                                                                                                                    | `STUFE2-D` §0: 147 → **77** `ours-wrong`, 26 `intentional`, 5 `reference-wrong`, 0 unklassifiziert                                                   | **überholt** — die aktuelle Zahl ist 77, aufgeschlüsselt in OP-020…OP-025                |
| `STUFE2-A2-GRC.md` §6 / `STUFE2-D` §1.5                                                                            | Zehn GRC-Layer bleiben leer, weil das Schema fehlt (`process_lane`, `sod_rule`, `process_step_raci`, `process_step_ropa`, `process_step_data_category`, `process_step_bia`, `process_step_document`, `process_event_activity_map`) | Migrationen `0444`–`0454` vorhanden; `STUFE2-E` §0: **23 von 23 Layern** bekommen Daten                                                              | **erledigt** — offen ist nur die Pflegeoberfläche (OP-001) und der Import (OP-002)       |
| `E2E-TRIAGE-2.md` §6 (C-15)                                                                                        | Die drei `coverage`-Routen sind untracked; jeder frische Klon antwortet 404                                                                                                                                                        | `git ls-files` führt `compliance/coverage/route.ts`, `audit-mgmt/universe/coverage/route.ts`, `processes/[id]/coverage/route.ts`                     | **erledigt**                                                                             |
| `E2E-TRIAGE.md` §7.2/§7.3 (C-04, C-06, C-07)                                                                       | Organisationsliste unter RLS, CSP-Inline-Script, reservierte Verbindungen                                                                                                                                                          | In `E2E-TRIAGE-2.md` §2 einzeln behoben und gemessen                                                                                                 | **erledigt**                                                                             |
| `E2E-TRIAGE-2.md` §6                                                                                               | `isms-workflow:96` (SoA), `management-review:27` (`actionElementId`), `process-map:37` (`childCount`), `f-18-integrity`, `b-01`/`b-02`/`i-02`                                                                                      | `E2E-TRIAGE-3.md` §2.1–2.6 behoben; Migration `0442_management_review_action_element_id.sql` existiert                                               | **erledigt** (Ausnahme: das Rate-Limit selbst → OP-054)                                  |
| `E2E-TRIAGE-3.md` §6                                                                                               | Die zwei übersprungenen Specs (`document-signature.spec.ts:74`, `i-08-cve-flow.spec.ts:6`)                                                                                                                                         | `E2E-TRIAGE-4.md` §3/§4: beide Skips entfernt, `seed_demo_15_cve.sql` neu, Lauf 8 = 199/199/0                                                        | **erledigt**                                                                             |
| `VERIFIKATION.md` Teil D **O-2**                                                                                   | `POST /api/v1/organizations` schlägt unter `grc_app` fehl (42501)                                                                                                                                                                  | `packages/db/drizzle/0438_organization_insert_policy.sql` vorhanden; `RESTDEFEKTE.md` Defekt 1 mit Nachweis                                          | **erledigt**                                                                             |
| `VERIFIKATION.md` Teil D **O-3**                                                                                   | `GET /api/v1/isms/threats/heatmap` → 500 (`v.asset_id does not exist`)                                                                                                                                                             | Route ruft `getThreatHeatmap` aus `@grc/reporting`; kein rohes `v.asset_id` mehr; `RESTDEFEKTE.md` Defekt 2 mit Nachweis                             | **erledigt**                                                                             |
| `VERIFIKATION.md` Teil D **O-4**                                                                                   | `POST /api/v1/findings` → 500 (FK `work_item_type`)                                                                                                                                                                                | `packages/db/drizzle/0439_work_item_type_catalog_gaps.sql` registriert `finding` und 15 weitere Typen                                                | **erledigt** — Restposten ist nur der Testverweis (OP-051)                               |
| `VERIFIKATION.md` Teil D **O-6**                                                                                   | Drift-Check kennt kein `extra-in-db`                                                                                                                                                                                               | `RESTDEFEKTE.md` Defekt 3 mit Nachweis (Richtung ergänzt, Bereinigung durchgeführt)                                                                  | **erledigt**                                                                             |
| Abschlussbericht §5 **O-E**                                                                                        | Produktionsbuild nicht herstellbar                                                                                                                                                                                                 | `E2E-TRIAGE-4.md` §6.3: „Compiled successfully", 4,8 min TypeScript, `ignoreBuildErrors=false`                                                       | **erledigt** auf der Zielmaschine — siehe B.2; Nachfolgeposten OP-053                    |
| Abschlussbericht §5 **O-F** / `VERIFIKATION.md` **O-5**                                                            | Playwright-E2E: kein vollständiger Lauf, 11 rote Specs ohne Vergleichsbasis                                                                                                                                                        | `E2E-TRIAGE-4.md` §6.1: 199/199/0, zweimal reproduziert                                                                                              | **erledigt** — siehe B.3                                                                 |
| `STUFE2-A3-VERIFIKATION.md` §3.1–§3.8, `packages/bpmn/test/verify/known-findings.ts`                               | Acht benannte Modellierungsbefunde (Undo entfernt DI nicht, `PARENT_LINK_BROKEN` zu streng, …)                                                                                                                                     | `KNOWN_FINDINGS` ist **leer**; alle Einträge stehen mit `fixedIn` in `RESOLVED_FINDINGS`                                                             | **erledigt**                                                                             |
| `STUFE2-B2-EINBINDUNG.md` §5.3, `STUFE2-A3` §3.7                                                                   | `move` auf ein BoundaryEvent verliert `attachedToRef` (16/200 Folgen rot)                                                                                                                                                          | `STUFE2-C-ABSCHLUSS.md` §2 und §4.2: `PROPERTY_STRICT=1` von 16/200 auf **0**, 5 von 5 Startwerten grün                                              | **erledigt**                                                                             |
| `WP12.md` §3.19                                                                                                    | 91 Typfehler in `apps/web` (88× `.rows`, 3× `chainSeq`)                                                                                                                                                                            | `VERIFIKATION.md` A.1 und A.2 behoben; Abnahme „Typecheck 12/12, Ausgang 91 Fehler"                                                                  | **erledigt**                                                                             |
| `WP12.md` §3.16                                                                                                    | `loading-spinner.tsx` → das `it.fails` in `all-components-smoke.test.tsx` muss umgewandelt werden                                                                                                                                  | `WP11.md` §5.3: „der zweite `it.fails` (`LoadingSpinner`) wurde von WP12 behoben und ist wieder ein normales `it`"                                   | **erledigt**                                                                             |
| Alle Berichte der bpmn-engine-Reihe („Nicht committet. Wie beauftragt.")                                           | Der Arbeitsstand liege unkommittiert im Arbeitsverzeichnis                                                                                                                                                                         | `git status --short` ist leer; `HEAD` = `4caff361` „feat(grc,e2e): zehn fehlende Tabellen, alle 23 Layer scharf, E2E 199/199"                        | **überholt** — die Arbeit ist committet; die Sätze in den Berichten sind Momentaufnahmen |

---

## D. Unbelegte Vermutungen

Punkte, die in der Kandidatenliste des Auftrags standen, für die ich aber **keine** Herkunft
in den Quellen und keine Fundstelle im Code gefunden habe. Sie stehen hier statt im Register.

| Vermutung                                         | Was ich stattdessen gefunden habe                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| „`CLAMAV_OPTIONAL`" als offener Punkt             | Kein offener Punkt mehr. `packages/shared/src/lib/clamav.ts:85` implementiert den Ausstieg, `.env.example:210/218/421` und `docs/env-vars-reference.md:249` dokumentieren ihn, `E2E-TRIAGE-4.md` §3.3 führt ihn als erledigt. Offen ist allenfalls die Betreiberentscheidung, clamd zu betreiben statt den Ausstieg zu setzen (Teil von OP-147/OP-D). |
| „1.991 tote Exports"                              | Der eingecheckte Wert; gemessen sind 2.706 (→ B.8, OP-074).                                                                                                                                                                                                                                                                                           |
| „Coverage 23,3 % gesamt und 15,4 % in `apps/web`" | Bestätigt: 23,27 % / 15,37 % (`coverage/aggregated-summary.json`). Als Zahl belegt, als offener Punkt in OP-069 geführt.                                                                                                                                                                                                                              |
| „6.795 ungenutzte i18n-Schlüssel"                 | Gemessen 6.796 (→ B.7).                                                                                                                                                                                                                                                                                                                               |
| „96 von 482 Seiten ohne i18n"                     | Bestätigt (`audit-i18n-usage.mjs`); zusätzlich 75 von 134 Komponenten, wodurch die Ratsche reißt (→ OP-071).                                                                                                                                                                                                                                          |

Außerdem nicht belegbar, weil außerhalb dieses Arbeitsverzeichnisses:

- Der tatsächliche Sichtbarkeitsstatus des GitHub-Repositories (OP-059) — belegt ist nur die
  Aussage in `WP10.md` §4.1 und `WP11.md` §6.1 („beide Commits liegen auf `origin/main` eines
  öffentlichen Repositories", geprüft mit `git branch -r --contains`).
- Der Zustand der Instanz auf dem Rechner des Eigentümers (`E2E-TRIAGE.md` §7.7).

---

## E. Zahlen auf einen Blick

**166 offene Punkte.**

| Kategorie                    | Anzahl |
| ---------------------------- | ------ |
| fehlende Funktion            | 34     |
| Codequalität                 | 31     |
| Produktdefekt                | 28     |
| Testlücke                    | 25     |
| Betrieb                      | 19     |
| Entscheidung des Eigentümers | 14     |
| Doku                         | 13     |
| Zeitkriterium                | 2      |

| Umfang | Anzahl |
| ------ | ------ |
| S      | 93     |
| M      | 45     |
| L      | 20     |
| XL     | 8      |

**Streichkandidaten** (kein nennbarer Wert oder bewusste Entscheidung): OP-017, OP-045, OP-089,
OP-105, OP-115, OP-140.

**Vier Tore sind heute rot:** Lint-Ratsche (OP-064), Coverage-Gate (OP-066), i18n-Bundle
(OP-072) und i18n-Untranslated-Ratsche (OP-071). Keines davon steht in einem der Berichte —
alle vier stammen aus der Messung vom 2026-09-02.

---

## Nachtrag 2026-09-03 — ein neuer Punkt aus der Abnahme der Wellen 0–3

| ID     | Titel                                                                          | Herkunft                                                                  | Kategorie             | Umfang                                                                                                                            | Blockiert durch | Wert                                                             |
| ------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------- |
| OP-167 | **Der Produktionsbau bricht ab: `/_global-error` lässt sich nicht prerendern** | Eigene Messung 2026-09-03 auf der Maschine des Eigentümers, vier Bauläufe | Betrieb (Fremdfehler) | **behoben 2026-09-09** — es war kein Fremdfehler, sondern `NODE_ENV=development` im eigenen Bau-Rezept; siehe Nachtrag 2026-09-09 | —               | Ohne Produktionsbau gibt es kein Deployment und keinen E2E-Lauf. |

**Was gemessen wurde.** `next build` bricht bei 516 von 688 Seiten ab:

```
Error occurred prerendering page "/_global-error"
TypeError: Cannot read properties of null (reading 'useContext')
    at ignore-listed frames { digest: '3120278025' }
```

Vier Läufe, vier Ausschlüsse — die Ursache liegt **nicht** in diesem Repository:

| Lauf                                         | Ergebnis                           | Was er ausschliesst                                     |
| -------------------------------------------- | ---------------------------------- | ------------------------------------------------------- |
| unverändert                                  | rot, `digest: 3120278025`          | —                                                       |
| `global-error.tsx` auf ein Minimum reduziert | rot, **derselbe** digest           | Der Inhalt unserer Datei.                               |
| `global-error.tsx` ganz entfernt             | rot, **derselbe** digest           | Unsere Datei überhaupt — Next erzeugt die Route selbst. |
| Node 24.13 statt 25.2                        | rot, **derselbe** digest           | Die Node-Version.                                       |
| `--debug-prerender`                          | **grün**, 688/688 Seiten, 0 Fehler | —                                                       |

Dazu: nur eine React-Kopie im Baum (19.2.7), `package-lock.json` seit dem letzten
grünen Bau unverändert, und die Dateien der Anwendungshülle (`layout.tsx`,
`global-error.tsx`, `not-found.tsx`, die vier Provider) sind seit dem letzten
erfolgreichen Bau bei `4caff361` **nicht angefasst** worden.

**Es ist ein bekannter Fehler in Next.js 16.2.x** (vercel/next.js#95741, gemeldet
für 16.2.6 und 16.2.10; wir fahren 16.2.11). Die Ursache dort: mehrere Routen
werden beim statischen Erzeugen als ungekeyte Geschwister in einen Renderdurchgang
gebündelt, und welche Route dabei abstürzt, hängt von der Verteilung auf die
Arbeiter ab. **Das erklärt, warum der Bau bei 685 Seiten durchlief und bei 688
nicht mehr**: die Bündelung hat sich mit den neuen Seiten verschoben. Der
vorherige grüne Lauf war Glück, kein Beweis.

**`--debug-prerender` ist keine Lösung.** Es schaltet ausweislich der Next-Doku
`serverMinification` und `turbopackMinify` ab, erzeugt Server-Sourcemaps und
setzt `prerenderEarlyExit=false` — und die Doku sagt ausdrücklich: „Do not deploy
builds generated with `--debug-prerender` to production." Der Lauf ist der
Beleg für die Diagnose, nicht der Weg zum Artefakt.

### Die zwei Wege — was davon gemessen ist

**(a) `next build --webpack`.** Gemessen, zweimal, und **kein Ersatz auf
Zuruf**:

- Der erste Lauf starb an `JavaScript heap out of memory` beim voreingestellten
  Heap von 4 GB. Webpack braucht für diesen Baum deutlich mehr; mit 16 GB läuft
  er weiter.
- Der zweite Lauf kam bis TypeScript und brach dort ab — mit einem Fehler, den
  der Turbopack-Bau **gar nicht erhebt**:

  ```
  Type '{ __tag__: "GET"; __param_position__: "second";
          __param_type__: { params: Promise<{ id: string }> } | undefined }'
  does not satisfy the constraint 'ParamCheck<RouteContext>'.
    Type 'undefined' is not assignable to type 'RouteContext'.
  ```

  Der Webpack-Pfad erzeugt strengere Routentypen, und unsere
  `withErrorHandler`-Wickel deklarieren den zweiten Parameter optional. Das ist
  behebbar, aber es ist eigene Arbeit an über tausend Routen und keine
  Bauflagge.

Dazu kommt: Commit `cea14434` hat den **Turbopack-Produktionsbau ausdrücklich
gewählt**. Ihn wegen eines Fremdfehlers aufzugeben, ist eine Entscheidung und
keine Reparatur.

**(b) Anhebung auf Next 16.3.4 — gemessen, und sie hilft nicht.** Auf der
Maschine des Eigentümers installiert und gebaut:

- Der Bau kam weiter als je zuvor und meldete `✓ Compiled successfully in 64s`.
- Danach fünf TypeScript-Fehler in drei Testdateien, alle aus **einer** Ursache:
  Next 16.3 bringt eine eigene Deklaration von `import.meta.glob` mit, die kein
  Typargument nimmt, während Vites Deklaration eines nimmt
  (`TS2558: Expected 0 type arguments, but got 1`).
- Nach deren Behebung läuft die Erzeugungsphase — **und bricht an derselben
  Stelle ab**, mit einem anderen digest: `1660660369` statt `3120278025`.

**Ein Fehler in der Beweisführung, offen benannt.** Der Zwischenstand
„Compiled successfully" wurde einmal als Beleg dafür genommen, der Absturz sei
weg, und in einem Commit so festgehalten. Er war es nicht: die
TypeScript-Fehler hatten den Bau **vor** der Erzeugungsphase beendet, in der er
sonst scheitert. Ein Teilsignal als Ergebnis gelesen — genau die Fehlerform,
gegen die dieses Register angetreten ist. Der Commit ist berichtigt, die
Anhebung zurückgenommen.

Die Version bleibt deshalb auf **16.2.11**: eine Anhebung, die den Grund für die
Anhebung nicht beseitigt, ist Rauschen in einem Zweig, der auf Freigabe wartet.
Die drei `import.meta.glob`-Aufrufstellen sind trotzdem umgestellt — die
typargumentfreie Form ist unter beiden Deklarationen gültig und macht eine
spätere Anhebung um diese fünf Fehler billiger.

### Was daneben aufgefallen ist

Der Bau meldete vier Warnungen `Module not found: Can't resolve
'../model/index.js'` aus `packages/bpmn/src/viewer/BpmnCanvas.ts`. Der Pfad
stand dort in einer **Variablen** samt `@vite-ignore`, mit der Begründung „so
übersetzt dieses Paket auch dann, wenn `src/model/index.ts` (anderer
Arbeitsstrang) noch nicht existiert". Der Strang ist längst gelandet; die
Krücke war zum Defekt geworden — ein Bezeichner in einer Variablen ist für den
Bündler nicht auflösbar, die Endung `.js` ist dieselbe Fehlerklasse, die in
diesem Audit schon 711 Importe in 139 Dateien betraf, und das `try/catch`
verdeckte den Auflösefehler hinter einer freundlichen Meldung. Behoben:
gewöhnlicher dynamischer Import mit literalem Bezeichner, Trägheit erhalten.

### Nachtrag 2026-09-03 — zwei neue Punkte aus der Abnahme von Welle 4a

Bei der Wiederholung der Abnahme gegen eine **von Null migrierte** Datenbank
(426/426 Migrationen, 614 Tabellen) mit der produktionsnahen Rolle `grc_app`
und `FORCE ROW LEVEL SECURITY` — so, wie `deploy/provision-grc-app.sh` sie
einrichtet — sind zwei Punkte aufgefallen, die vorher nicht sichtbar sein
konnten. Sie gehoeren zusammen: der erste hat den zweiten verdeckt.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Beleg                     | Art     | Stand   |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------- | ------- |
| OP-168 | **Ein Datenbanktest konnte unter produktionsnahen Bedingungen nie laufen.** `apps/worker/tests/lib/job-runtime.db.test.ts` nahm fuer seinen **Fixture**-Kanal `APP_DATABASE_URL ?? DATABASE_URL`, also bevorzugt die RLS-gebundene Rolle. Schon das Anlegen der Fixture-Organisation scheiterte damit an `new row violates row-level security policy for table "organization"` — im `beforeAll`, weshalb alle sechs Zusicherungen als _skipped_ endeten statt als _failed_. Der Test lief ausschliesslich dort durch, wo `APP_DATABASE_URL` FEHLTE. | Eigene Messung 2026-09-03 | Test    | behoben |
| OP-169 | **Der gesamte Benachrichtigungspfad des Workers haengt an BYPASSRLS.** `insertNotification` schrieb ohne Organisationskontext; die Policy `notification_org_isolation` verlangt `org_id = current_setting('app.current_org_id')`. **41 der 44 Cron-Jobs** setzen keinen Kontext (nur `calendar-digest`, `calendar-overdue-check` und `overdue-tasks` tun es ueber `withOrgContext`). Sie schrieben bisher nur deshalb erfolgreich, weil die Worker-Rolle BYPASSRLS traegt.                                                                          | Eigene Messung 2026-09-03 | Produkt | behoben |

**Warum das zusammengehoert.** OP-169 war messbar, sobald OP-168 behoben war
— vorher starb die Suite eine Ebene zu frueh. Es ist dasselbe Muster, das
dieses Audit schon dreimal gefunden hat: **die Wache ueber der Sache war
kaputt, nicht die Sache** — nur diesmal war die Sache es auch.

**Die Tragweite von OP-169.** Zwei Folgen, beide unangenehm:

1. RLS war fuer den Benachrichtigungspfad **wirkungslos**. Die Mandanten-
   trennung dieser Tabelle beruhte allein darauf, dass jeder Job die richtige
   `org_id` in die Zeile schreibt — nicht auf der Policy.
2. Die Entprivilegierung des Workers (OP-090, der einzige unmittelbar
   deploy-relevante Punkt des Registers) haette **41 Jobs auf einen Schlag**
   brechen lassen. Ein Punkt, an dem 41 andere haengen, war als
   Rollen-Konfiguration gefuehrt und war in Wirklichkeit Anwendungscode.

**Behebung — zentral, nicht 41-fach.** `notify.ts` ist ausweislich seines
eigenen Kopfes „der einzige Schreibpfad fuer Benachrichtigungen"; dort sitzt
schon die Dedup-Garantie zentral statt 44-fach. Der Organisationskontext sitzt
jetzt daneben: Ohne uebergebene Transaktion oeffnet `insertNotification` eine
eigene und setzt `app.current_org_id` **transaktionslokal**
(`set_config(..., true)`) aus der `org_id` der Zeile — dieselbe Regel wie
`withOrgContext` (S10-14), also kein Sitzungszustand auf einer gepoolten
Verbindung. Uebergibt der Aufrufer eine Transaktion, bleibt sie unangetastet:
dort haelt der Aufrufer den Kontext, und ein `SET LOCAL` von hier aus wuerde
ihn fuer den Rest SEINER Transaktion ueberschreiben.

**Nachweis.** `job-runtime.db.test.ts` laeuft jetzt in beiden Umgebungen
(6/6 mit und ohne `APP_DATABASE_URL`); die gesamte Worker-Suite ist in beiden
Faellen gruen (134 Dateien, 397 Tests). Dazu ein neuer, **datenbankfreier**
Test `notify-org-context.test.ts`: Der Datenbanktest deckt denselben Fall ab,
aber nur wenn die Umgebung `APP_DATABASE_URL` setzt — genau daran ist der
Befund vorbeigelaufen, und ein Tor, das nur unter einer ungenannten Bedingung
ausloest, ist kein Tor. Der neue Test prueft am Aufrufmuster nach, DASS der
Kontext gesetzt wird, und braucht dafuer weder Rolle noch Server. Gegen den
alten Stand von `notify.ts` faellt er (nachgemessen), gegen den neuen laeuft er.

### Nachtrag 2026-09-09 — CI zu OP-245: ein Coverage-Tor, das seit dem Minor-Batch rot war, und drei Jobs, die zum ersten Mal liefen

Die Übergabe verlangte, die CI zu prüfen, nicht nur den lokalen Lauf. Das
war nötig: auf diesem Zweig war seit `f102816f` **kein** Lauf des
CI-Workflows grün, und weil Lint jedes Mal zuerst fiel, sind Security Audit,
Unit Tests und E2E Smoke seitdem nie gelaufen. Mit dem Lint-Job auf 0
liefen sie zum ersten Mal — und zeigten drei Dinge, von denen keines zu
OP-245 gehört, aber jedes vor OP-245 unsichtbar war.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Beleg                                                                                                                                                                                                               | Art                                                     | Stand                             |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------- |
| OP-250 | **Ein E-Mail-Test lud `EmailService` per `await import()` im Testkörper — und damit alle React-Email-Templates innerhalb des 5-Sekunden-Limits des Tests.** Auf dem CI-Runner braucht das 6,1 s (die Import-Phase der Datei liegt dort bei ~23 s kalt), lokal 0,6 s; der Test `renders every registered key without throwing` fiel, bevor ein einziges Template gerendert war. Der Import steht jetzt auf Modulebene, wo vitest ihn nicht gegen ein Zeitlimit misst; der Test selbst braucht 6 ms. `vi.mock("resend")` ist gehoistet und wirkt wie zuvor. Keine Erwartung und kein Zeitlimit wurde geändert.                                                                                                                                                                                              | CI-Lauf 34371008020, Job Unit Tests: `Test timed out in 5000ms` bei `template-coverage.test.ts:157`; lokal danach 10/10, tsc 0, eslint 0                                                                            | Testsuite (latent seit 2026-09-01, erst jetzt sichtbar) | **behoben**                       |
| OP-251 | **Der E2E-Smoke-Job kann seit dem 2026-09-02 nicht grün werden.** `auth.setup.ts` verlangt seit der Mehr-Konten-Testbasis (`81200d89`) ein `E2E_ROLE_PASSWORD` und Konten, die `npm run db:seed:e2e-users` mit genau diesem Passwort angelegt hat. `ci.yml` seedet diese Konten nirgends, und der Schritt, der fällt (`Run Playwright smoke (fast fail)`), bekommt nicht einmal die vorhandenen Secrets `E2E_EMAIL`/`E2E_PASSWORD` — die stehen nur am Schritt danach. Die Meldung ist klar und gewollt (ein stiller Skip wäre wieder ein Tor, das nichts prüft), aber der Job ist damit seit einer Woche ein sicherer Rotfall. Nicht angefasst: `.github/workflows/**` liegt bei der Cloud-Sitzung (Vorgabe des Eigentümers).                                                                            | CI-Lauf 34371008020, Job E2E Smoke Tests: `No password for the primary E2E account. Provision it with E2E_ROLE_PASSWORD='<12+ chars>' npm run db:seed:e2e-users`                                                    | CI-Workflow (Cloud-Sitzung)                             | **behoben 2026-09-09** (Welle 8m) |
| OP-252 | **`notice:check` und `prettier --check` verlangten verschiedene Bytes für dieselbe Datei.** `generate-notice.mjs` schrieb unausgerichtete Markdown-Tabellen (`\|---\|---:\|`), der Prettier-Schritt im Lint-Job verlangt ausgerichtete. Die eingecheckte `THIRD-PARTY-LICENSES.md` war seit `da7f5505` (2026-09-01, „Vollverifikation") die Prettier-Fassung — damit war `notice:check` seitdem in jedem Lauf rot; als `452205ad` die Erzeuger-Fassung einspielte, wurde stattdessen Prettier rot. Der Erzeuger formatiert seine Markdown-Ausgabe jetzt selbst mit Prettier (Repo-Konfiguration), vor dem Schreiben und vor dem Vergleich. Kein Tor wurde gelockert.                                                                                                                                      | CI-Läufe 34371008020 (Security Audit: `✗ veraltet`) und 34374305993 (Lint: `[warn] THIRD-PARTY-LICENSES.md`); Linux-Klon auf `2d815a66`: `--check` grün, `prettier --check` grün                                    | Werkzeug (zwei Tore gegeneinander, seit 2026-09-01)     | **behoben**                       |
| OP-253 | **Der Unit-Test-Job hängt an einem Paket-Spiegel, den er nicht braucht.** Der Schritt, der `cairosvg` für die Raster-Tests installiert, beginnt mit `sudo apt-get update -qq` unter `set -euo pipefail`; auf dem Runner-Image ist die Google-Chrome-Quelle (`dl.google.com/linux/chrome-stable`) vorkonfiguriert, und wenn deren Index gerade rotiert (`Hash Sum mismatch`), stirbt der Job mit Exit 100, **bevor ein Test läuft**. Am 2026-09-09 zwischen 17:16 und 18:10 UTC dreimal hintereinander auf `d3637701`, in drei Versuchen; der E2E-Job traf es im selben Fenster zweimal beim Playwright-Install. Abhilfe liegt in `ci.yml` (Quelle vor dem Update entfernen oder das Update auf die benötigten Quellen beschränken) — nicht angefasst, `.github/workflows/**` liegt bei der Cloud-Sitzung. | Lauf 34382535195, Versuche 1–3, Job Unit Tests, Schritt der cairosvg-Installation: `E: Failed to fetch https://dl.google.com/linux/chrome-stable/deb/dists/stable/main/binary-amd64/Packages.gz  Hash Sum mismatch` | CI-Workflow (Cloud-Sitzung)                             | **behoben 2026-09-09** (Welle 8m) |

**CI auf `6e3991d4`** (der Push mit den 95 Commits): acht von zehn Workflows grün. Rot: Coverage (siehe unten — seit `a3ff1b07`) und der CI-Workflow, dort allein der Lint-Job am Schritt `op-index.mjs`, weil `docs/OFFENE-PUNKTE-INDEX.md` nach dem neuen Nachtrag nicht neu erzeugt war (mit `194aeda1` nachgezogen). Der Lint-Job selbst: 0 ESLint-Fehler mit 7.1.1, Ratsche 0/0 — die Cloud-Sitzung hatte ihn zuletzt mit 416 Fehlern rot gesehen (`3351dcb2`).

**CI auf `194aeda1`** (Index nachgezogen, Coverage-Baseline): neun von zehn Workflows grün, Coverage darunter. Der CI-Workflow kam zum ersten Mal seit `f102816f` am Lint-Job vorbei und fiel in drei Jobs, die seitdem nie gelaufen waren: Security Audit (`✗ veraltet: NOTICE`, `THIRD-PARTY-LICENSES.md`), Unit Tests (OP-250) und E2E Smoke (OP-251); Build und Integration Tests waren grün.

**NOTICE und THIRD-PARTY-LICENSES.md waren veraltet — seit OP-234, nicht
seit OP-245.** Der Security-Audit-Job meldete beide Dateien als nicht mehr
zum installierten Baum passend: nach dem Abhängigkeits-Upgrade hat der
Produktionsbaum 440 statt 441 Pakete, drei Lizenzsummen haben sich
verschoben. Der Nachtrag zu OP-234 hätte `npm run notice` enthalten müssen;
das ist mit `452205ad` nachgeholt, erzeugt im Linux-Klon auf `194aeda1`
(Node 22 wie CI), `--check` danach grün. Auf Windows lässt sich das Skript
nicht ausführen: `scripts/lib/dep-tree.mjs:23` ruft `execFileSync("npm")`
ohne Shell auf und stirbt mit `ENOENT` — **dieselbe Klasse wie die vier
Runner-Skripte unter OP-246, eine fünfte Stelle**, die in der Tabelle dort
fehlt — OP-246 wurde aus dem Testlauf heraus gezählt, und die Lizenz-Skripte
laufen in keinem Test. `check-dependency-hygiene.mjs:146` hat denselben
Aufruf. Beides gehört zu OP-246 und bleibt dort offen.

**Das Coverage-Tor war rot — und zwar seit `a3ff1b07`, also seit dem
Minor-Batch aus OP-234, nicht seit OP-245.** Die Ratsche meldete
`packages/auth lines: 65.00 % < Baseline 65.60 %` und `statements: 63.61 % <
64.28 %` (Toleranz 0,5). Gemessen, bevor irgendetwas angefasst wurde:

| Stand                                     | in `packages/auth` aufgelöst              | lines | statements | functions | branches |
| ----------------------------------------- | ----------------------------------------- | ----: | ---------: | --------: | -------: |
| `6faa7ada` (letzter grüner Coverage-Lauf) | geschachtelt: vitest + coverage-v8 4.1.10 | 65,28 |      64,00 |     68,38 |    52,62 |
| `a3ff1b07` (erster roter Lauf)            | gehoben: 4.1.11 (die Schachtel ist weg)   | 65,00 |      63,61 |     68,38 |    52,62 |
| `6e3991d4` (dieser Push)                  | 4.1.11                                    | 65,00 |      63,61 |     68,38 |    52,62 |

(Lokal im Linux-Klon gemessen, deshalb 65,28 statt der 65,60 aus CI — die
Differenz zwischen den Maschinen ist konstant, die zwischen den Ständen nicht.)
`git diff 6faa7ada..a3ff1b07 -- packages/auth/src` ist **leer**. Funktionen
und Zweige sind identisch; nur die Zeilen- und Anweisungszählung ist anders,
und sie wechselt genau dort, wo das Werkzeug wechselt. Das ist keine
verlorene Abdeckung, sondern ein anderes Lineal.

**Entscheidung:** die Baseline von `packages/auth` auf die CI-gemessenen
Werte des neuen Werkzeugs gesetzt (65,00 / 63,61), über den dafür
vorgesehenen Weg — Eintrag in `_history` von `.coverage-ratchet.json` mit
Datum, Deltas und Begründung, so wie `coverage-gate.mjs --update-baseline
--reason` ihn schreibt; von Hand nur deshalb, weil `--update-baseline` die
Baseline _aller_ zwölf Workspaces aus einer lokalen Messung neu setzen würde,
und die lokale Messung auf Windows ist nicht die, gegen die CI misst. Die
Gesamtwerte sind im selben CI-Lauf gestiegen (lines 34,32 → 35,78 %). Das
Skript sagt zu Recht „der übliche Weg ist nicht die Absenkung, sondern der
fehlende Test" — hier fehlt kein Test, hier hat sich das Zählen geändert;
wer die 0,6 % trotzdem mit Tests zurückholen will, findet in
`packages/auth/src` die Kandidaten unverändert vor.

**CI auf `2d815a66`** (NOTICE, OP-250): neun von zehn Workflows grün, der
CI-Workflow rot im Lint-Job — am Prettier-Schritt, an der eben erzeugten
`THIRD-PARTY-LICENSES.md`. Das ist OP-252 oben: die Datei, die
`notice:check` verlangt, war nicht die, die Prettier verlangt.

**CI auf `277b564c`** (OP-252): neun von zehn Workflows grün, der CI-Workflow rot am Lint-Job — diesmal an `check-op-numbers.mjs`: `OP-252 — scripts/generate-notice.mjs` stand im Code, aber noch nicht im Register, weil dieser Nachtrag erst mit dem nächsten Commit kommt. Das Tor tut, was es soll. Prettier und die Ratschen waren in demselben Job grün, `THIRD-PARTY-LICENSES.md` eingeschlossen. Der Lauf auf dem Commit, der diesen Nachtrag trägt, ist der Beleg für die Kette dahinter; erwartet rot bleibt allein E2E Smoke (OP-251).

**CI auf `235662a4`** (dieser Nachtrag): der Lint-Job grün, damit zum
ersten Mal alle nachgelagerten Jobs gelaufen — Integration Tests grün, drei
rot. E2E Smoke wie erwartet (OP-251). Security Audit kam an NOTICE vorbei und
fiel eine Stufe später: **die SBOM war veraltet** (`generate-sbom.mjs --check`,
Stand 2026-09-01, vor OP-234 — dieselbe Herkunft wie NOTICE, eine Stufe
weiter hinten im selben Job). Neu erzeugt im Linux-Klon, 847 / 440
Komponenten, `sbom:check` und Prettier grün (`e8d32995`). Unit Tests: 908
von 909 grün; rot allein `packages/bpmn test/grc/decorate.test.ts` —
`zeichnet beobachtete, nicht modellierte Pfade als Geisterkante` mit 5,6 s
über vitests 5-s-Vorgabe, lokal 0,9 s. Der Test dekoriert
`synth-large-flat-process` (52 Aufgaben, 30 kB BPMN) im vollen statischen
Renderer; die zwei Nachbartests auf demselben Korpus lagen bei 2,8 und 3,7 s.
Das ist die Klasse „Zeitlimit unter Last" aus OP-246, nicht ein Defekt des
Codes: alle drei tragen jetzt das ausdrückliche 30-s-Limit der Korpus-Tests
unter `test/draw`, die Erwartungen sind unverändert (`d3637701`).

**CI auf `d3637701`** (SBOM, Zeitlimit): neun von zehn Workflows grün. Der CI-Workflow brauchte **vier Anläufe** (Lauf 34382535195, Versuche 1–4), und keiner der drei verlorenen ging auf den Code zurück: Unit Tests und E2E starben in Versuch 1 und 2, Unit Tests noch einmal in Versuch 3, jeweils in `apt-get update` am Google-Chrome-Spiegel des Runners (`Hash Sum mismatch`, OP-253), bevor ein Test lief. In Versuch 4: **Lint, Type Check, DB Migration, Security Audit (NOTICE, THIRD-PARTY-LICENSES, SBOM alle aktuell), Integration Tests und Unit Tests grün — 909 von 909**, `Geisterkante` dort mit 5,1 s, also auch diesmal über der alten 5-s-Vorgabe. Rot bleiben E2E Smoke (OP-251, dieselbe Meldung) und dahinter das Pilot Readiness Gate, das ohne `STAGING_URL` absichtlich laut fällt statt still zu überspringen (#S13-30) — beides Secrets bzw. `ci.yml`, beides beim Eigentümer und der Cloud-Sitzung. Build wird von E2E übersprungen. Was der Code auf diesem Zweig zu verantworten hat, ist damit grün.

**Offen aus diesem Nachtrag:** OP-251 und OP-253 (beide Cloud-Sitzung, `ci.yml`), und unter
OP-246 die fünfte und sechste `execFileSync("npm")`-Stelle. Zu OP-245
selbst: nichts.

### Nachtrag 2026-09-09 — OP-245 geschlossen: 416 Fundstellen des neueren Plugins abgetragen, der Pin ist weg

Lokale Sitzung auf der Maschine des Eigentümers, Start bei `3351dcb2`
(Entscheidung des Eigentümers: Weg B). Übergabe war `HANDOVER-OP-245.md`
aus der Cloud-Sitzung; deren Zahlen wurden zuerst nachgemessen, dann
umgesetzt. Arbeitsteilung: ein Pilot von Hand, dann vierzehn parallel
arbeitende Agenten mit einem schriftlichen Rezept (Muster aus Welle 7b,
`catalogs/objects/page.tsx`) und einem zweiten für die nicht-mechanischen
Gestalten; jede Datei wurde einzeln gegen ESLint 7.1.1 geprüft, jeder
Bericht gelesen, die Verhaltensänderungen stehen unten gesammelt.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Beleg                                                                                                               | Art           | Stand       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------- | ----------- |
| OP-245 | **`eslint-plugin-react-hooks` 7.1.1 bleibt, die 416 Fundstellen sind abgetragen, der Pin auf 7.0.1 ist entfernt.** 384 × `set-state-in-effect`, 15 × `refs`, 9 × `purity`, 4 × `static-components`, 3 × `immutability`, 1 × `preserve-manual-memoization` in 354 Dateien — jede neu _erkannt_, keine neu _eingeführt_. Aufgelöst mit den Gestalten aus Welle 7b: Abruf beim Einhängen auf `@tanstack/react-query` (346 Stellen), abgeleiteter Zustand beim Rendern, vom Server gesäte Formulare als eigenes, mit dem Stand eingehängtes Bauteil, Uhrzeit als externer Speicher (`useNow`), Rückruf-Referenzen im Effekt statt beim Rendern. Kein `eslint-disable`, die Ratsche unverändert, keine Regel angefasst. | `eslint . --quiet` in apps/web mit 7.1.1: **0**; `lint-ratchet.mjs` 0/0 und 44/44; tsc 13 × Exit 0; Messungen unten | Code-Qualität | **behoben** |

**Erst nachgemessen** (§3 der Übergabe), mit 7.1.1 per `--no-save` über den
Pin installiert, `apps/web/eslint.config.mjs` unverändert:
416 Fundstellen in 354 Dateien, Verteilung wie in der Übergabe. Die
`set-state-in-effect`-Gestalten nach dem geflaggten Ausdruck: `void fetchX()`
276, `fetchX()` 71, direktes `setX(...)` 26, Rest 11 — 347 von 384 sind
derselbe Griff.

**Was gemessen wurde, nach der Umsetzung.**

| Prüfung                                                             | Ergebnis                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint . --quiet` (apps/web) mit `eslint-plugin-react-hooks` 7.1.1 | **0** (vorher 416; Zwischenstand nach den mechanischen Stapeln 16, davon 11 in neun Dateien, die zwischen den Stapeln durchgefallen waren — mit dem Register nachgezogen)                                                                                                                             |
| `node scripts/lint-ratchet.mjs`                                     | **Exit 0** — apps/web 0 Befunde gegen Baseline 0, Wurzel 44 gegen 44, gemessen mit 7.1.1 als aufgeloester Version (ein erster Lauf nach dem Entfernen des Pins hatte noch 7.0.1 aus dem Lockfile aufgeloest — deshalb `npm update eslint-plugin-react-hooks`, dann erneut gemessen)                   |
| `npm ls eslint-plugin-react-hooks` nach Entfernen des Pins          | genau eine Kopie, **7.1.1**, ueber eslint-config-next 16.3.4; keine geschachtelte 7.0.1 mehr unter apps/web                                                                                                                                                                                           |
| `tsc --noEmit` apps/web                                             | **Exit 0**, 0 Fehler, nach allen 349 geaenderten Dateien (zwei Zwischenlaeufe waehrend der Agentenarbeit zeigten nur Momentaufnahmen halbfertiger Dateien)                                                                                                                                            |
| `vitest run` apps/web (mit Testdatenbank)                           | **3.019 von 3.027**; die acht roten sind die sieben bekannten Windows-Ausfaelle aus OP-246 (CRLF, Pfadtrenner, PoC-Datei ausserhalb des Repos) plus `all-components-smoke`, das unter der Last der vier parallelen Pruefungen ins 15-s-Limit lief — isoliert 17/17. Kein Ausfall durch die Umstellung |
| `prettier --check .`                                                | grün (`--end-of-line auto`, s. OP-234)                                                                                                                                                                                                                                                                |
| CI (`gh run list --branch audit/full-2026-08-31`)                   | nach dem Push angestossen — Ergebnis im Folge-Nachtrag                                                                                                                                                                                                                                                |

**Was je Gestalt geschehen ist.**

- **Abruf beim Einhängen (346 + die bedingten/verketteten Abrufe):** `useQuery`
  mit vollständigem `queryKey` (jede Kennung, jeder Filter, jede Seite, die
  in der Anfrage steckt), `isPending` für einen Ladezustand, der mit `true`
  beginnt, `isFetching` für den Aktualisieren-Knopf, `enabled` für die alten
  `if (id)`-Bedingungen, bisherige Funktionsnamen (`fetchData`, `reload`,
  `load`) als dünne Hüllen um `refetch`/`invalidateQueries`, damit die
  Aufrufstellen unverändert bleiben. Lokale Nachbesserungen nach Mutationen
  (`setItems(prev => …)`) wurden zu `queryClient.setQueryData` auf demselben
  Schlüssel, wo die Seite auf die sofortige Anzeige baut (elf Dateien), sonst
  zu einem erneuten Abruf. Listen mit Seiten- oder Filterwechsel tragen
  `placeholderData: keepPreviousData`, damit die alten Zeilen stehen bleiben
  (marketplace, tasks, automation/executions, isms/cve, budget/costs,
  programmes/my-work, risk-acceptances, graph-Suche).
- **Vom Server gesäte Formulare (Welle 7b, `ropa`-Muster) — 16 Stellen:** das
  Formular ist ein eigenes Bauteil, initialisiert per `useState(() => seed)`
  und mit einem Schlüssel eingehängt, der nur dann wechselt, wenn ein
  _neuer_ Stand das Formular zurücksetzen soll (nach erfolgreichem
  Speichern), nicht bei jedem Hintergrundabruf: admin/sso, bcms/crisis/[id],
  bcms/bia/[id], budget/[year], controls/findings/analytics (SLA-Editor),
  dashboards/[id], organizations/[id], onboarding, erm/risks/[id]/fair,
  isms/assessments/[id]/wizard, programmes/[id]/steps/[stepId],
  tprm/questionnaires/[id]/edit, settings/notifications,
  components/process/process-review-config, components/bpmn/arctos-properties-panel,
  die vier ai-act-Detailseiten.
- **Direktes `setX` im Effekt (26):** abgeleitet beim Rendern (`useMemo`,
  `override ?? default`), in den Handler verlegt, der die Änderung auslöst
  (Suchfeld leeren, Sortierentwurf verwerfen, Dialog öffnen/schliessen),
  oder Teil eines Abrufs geworden (`setLoading(true)` am Anfang eines
  Effekts war immer ein Abruf).
- **`refs` (15):** die "jeweils jüngster Rückruf"-Referenzen in
  `arctos-bpmn-canvas`, `bpmn-viewer-legacy` und `grc-view-select` wurden
  beim Rendern _beschrieben_; die Zuweisung liegt jetzt in einem Effekt vor
  den Effekten, die sie lesen. Die acht Fundstellen in `processes/[id]/page.tsx`
  waren ein echter Defekt (OP-247 unten).
- **`purity` (9):** `Date.now()` in "vor x Minuten"-Helfern. Neuer Hook
  `src/hooks/use-now.ts` (`useSyncExternalStore`, Takt eine Minute,
  Server-Momentaufnahme = Modulstart, damit Hydrierung nicht abweicht) — die
  Anzeigen laufen damit zum ersten Mal wirklich mit.
- **`static-components` (4):** `getLucideIcon()` als Typ im Rendern →
  `<ModuleIcon name=…/>` aus Welle 7a; stateless, deshalb in der Sache
  harmlos. **`immutability` (3):** Funktionen vor ihrer Verwendung erklärt
  oder in den Modulraum verlegt. **`preserve-manual-memoization` (1):**
  `userId` gehoben, damit Abhängigkeitsliste und Rumpf dasselbe lesen.

**Verhaltensänderungen, die für alle umgestellten Seiten gelten** — kein
Einzelfall, sondern die Folge des Musters, und deshalb hier einmal:

1. Ein erneuter Abruf (Aktualisieren-Knopf, nach einer Mutation) zeigt
   keinen Vollbild-Spinner mehr; der Inhalt bleibt stehen, `isPending` gilt
   nur vor dem ersten Ergebnis. Auf `processes/[id]` hat das Nebenwirkung:
   vorher wurde bei jedem Abruf der ganze Reiterbaum samt BPMN-Editor
   ausgehängt.
2. Netzfehler (im Unterschied zu Nicht-ok-Antworten) werden nicht mehr
   verschluckt, sondern landen im Fehlerzustand der Abfrage; gerendert wird
   dasselbe (leere Liste, "nicht gefunden"), aber der Provider wiederholt
   einmal (`retry: 1`), bevor der Fehler steht — eine Sekunde später als
   vorher. Wo die alte `catch`-Logik einen Toast oder `console.error`
   trug, steht sie unverändert im `queryFn`.
3. `staleTime` 60 s: eine Seite, die innerhalb einer Minute erneut
   eingehängt wird, zeigt zuerst den Zwischenspeicher; ein ausdrücklicher
   `refetch` fragt immer an. Reiter-Daten (rcsa/campaigns/[id],
   processes/[id]) werden beim Zurückschalten binnen 60 s nicht neu geladen.
4. Bei gepaarten Abrufen in einem `queryFn` setzt eine Nicht-ok-Antwort den
   betroffenen Teil auf seinen Anfangswert, statt den vorigen Wert zu halten.

**Zwei Defekte, die die Regeln freigelegt haben** — beide als Nebenwirkung
der vorgeschriebenen Auflösung behoben, weil die Behebung _ist_ die
Auflösung; hier benannt, damit sie nicht in einem Lint-Commit verschwinden:

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Beleg                                                                                              | Art     | Stand                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------- | -------------------- |
| OP-247 | **Rückgängig/Wiederholen im Prozesseditor blieben nach der ersten Änderung stehen.** `canUndo`/`canRedo` wurden beim Rendern aus `editorRef.current` gelesen, aber nichts rendert `EditorTab` nach einem Kommando neu — `onChanged={markChanged}` setzt nur einmal `hasChanges`. Sichtbar: nach der ersten Bearbeitung blieb Rückgängig gesperrt, nach einem Rückgängig blieb Wiederholen gesperrt. Jetzt Zustand, geschrieben aus `onChanged` bei jedem `commandStack.changed`, in beiden Engines. | `processes/[id]/page.tsx` 1489–1490 (alt), `react-hooks/refs` × 8; `grc-maintenance-surface` 32/32 | Produkt | behoben (mit OP-245) |
| OP-248 | **Ungespeicherte Risikobewertung im Krisenszenario wurde vom nächsten Abruf überschrieben.** Jeder `fetchData()` — Logeintrag anlegen, Teammitglied entfernen, aktivieren/abschliessen, ERM-Sync — schrieb `likelihood`/`treatmentStrategy` mit dem Serverwert zurück: "Hoch" wählen, Logeintrag schreiben, und die Auswahl springt zurück. Jetzt ein eigenes Bauteil, gesät beim Einhängen, Schlüssel erst nach erfolgreichem Speichern erhöht.                                                    | `bcms/crisis/[id]/page.tsx` 94–96 (alt)                                                            | Produkt | behoben (mit OP-245) |

**Beobachtungen der Agenten, bewusst NICHT mitbehoben** — vorbestehendes
Verhalten, das die Umstellung sichtbar gemacht hat und das je einzeln eine
Entscheidung braucht (ein Sammelpunkt, damit keine Nummer ohne Zeile
existiert):

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Beleg                  | Art     | Stand                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------- | --------------------------------- |
| OP-249 | **Fünf Stellen, an denen ein Fehler keinen Nutzer erreicht:** (1) `programmes/[id]/steps/[stepId]`: die drei Freigabe-Knöpfe `await fetch(...)` ohne `r.ok` — ein 4xx/5xx ist stumm, die Seite lädt nur neu; (2) `graph/explorer`: ein gescheiterter Teilgraph-Abruf hat keine Meldung — vorher blieb still der alte Graph stehen, jetzt steht still der Leerzustand; (3) `catalogs/controls` und `catalogs/risks`: bei Nicht-ok blieben die Zuweisungen des _vorigen_ Eintrags unter dem neu gewählten stehen (jetzt leer, aber weiter ohne Meldung); (4) `admin/sso`: der Aktiv-Schalter sät das ganze Formular neu und verwirft ungespeicherte Eingaben — so war es, so ist es; (5) `processes/[id]/compare`: gleiche Version links und rechts liess den vorigen Vergleich unter falscher Beschriftung stehen (jetzt Leerzustand). | Agentenberichte OP-245 | Produkt | offen — je einzeln zu entscheiden |

**Windows-Ränder (OP-246), unverändert:** die sieben bekannten Windows-Ausfälle
der Suite (CRLF, Pfadtrenner, die PoC-Datei ausserhalb des Repos) bleiben,
und `all-components-smoke` läuft unter Last der vier parallelen Prüfungen ins
15-Sekunden-Limit — isoliert 17/17.

**Sieben Prüfungen mussten einen `QueryClientProvider` bekommen**, weil sie
umgestellte Seiten oder Bauteile nackt einhängen (die App hat ihn im
Wurzel-Layout): `wave7a-hook-deps`, `wave8b-module-teaser`, `wave6b-switch-effect`,
`risk-acceptance-cockpit`, `grc-view-select`, `bpmn-chrome-plane`, dazu der
Test `wave8e-incompatible-library` — alle im Muster von
`wave7b-set-state-in-effect.test.tsx`. Keine Erwartung wurde geändert.

**Commits:** ein Pilot, dann je Verzeichnis ein Commit mit den Zählern im
Betreff, die zwei Defekte eigens, die Prüfungen eigens, zuletzt der Pin —
95 Commits von `3351dcb2` bis zu dem, der diesen Nachtrag trägt (Pilot, useNow, OP-247, OP-248, 89 Verzeichnisse, Prüfungen, Pin).

**Offen unter OP-245:** nichts. OP-249 trägt die fünf Beobachtungen.

### Nachtrag 2026-09-09 — OP-234 geschlossen: Next 16.3.4, sharp 0.35.4, und der Rest des Baums

Lokale Sitzung auf der Maschine des Eigentümers, Start bei `f102816f`, elf
Commits bis zu dem, der diesen Nachtrag trägt. Erfolgskriterium wie vorgegeben: `node scripts/audit-gate.mjs`
Exit 0 — nicht „npm install lief durch".

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Beleg                                                                                                                              | Art            | Stand       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------- |
| OP-234 | **Next 16.2.11 → 16.3.4, sharp 0.35.3 → 0.35.4.** Die zwei kritischen Advisories (`GHSA-p293-qw3h-jr36`, `GHSA-2xp9-vwfh-vxw4`, beide unauthentifizierte RCE) und das hohe in sharp (`GHSA-rgj7-g3m4-5g8c`) sind geschlossen. Genau eine Next-Version im Baum (`npm ls next --all`), genau eine React-Kopie (19.2.8). Danach der Rest der Abhängigkeiten: alle Minor/Patch-Stände, sechs Majors umgesetzt, sieben mit Grund zurückgestellt — Tabellen unten. Kein Allowlist-Eintrag nötig; die Liste in `scripts/audit-gate.mjs` bleibt leer. | `audit-gate.mjs` Exit 0 auf Windows und im CI-äquivalenten Linux-Lauf; Build 690/690 mit `server.js`; `/login` 200; Testlauf unten | **Sicherheit** | **behoben** |

**Was gemessen wurde.** In der Reihenfolge der Vorgabe:

| Prüfung                                                                                                | Ergebnis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ls next --all`                                                                                    | eine Version, 16.3.4 (vorher 16.2.11; nach dem naiven `npm install next@16.3.4 -w @grc/web` wären es zwei gewesen — genau wie in der Vorgabe vorausgesagt, deshalb Override, Peer in packages/auth und die zwei gestrichenen Lockfile-Einträge)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `node scripts/audit-gate.mjs`                                                                          | **Exit 0**, „keine neuen high/critical-Advisories in Produktions-Dependencies" (vorher Exit 1 mit den drei genannten)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `tsc --noEmit` in allen 13 Workspaces                                                                  | 13 × Exit 0, nach jedem Schritt erneut                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run test` — Linux (WSL Debian, Node 22.20, `npm ci`, `--concurrency=1`)                           | **11 von 13 Tasks** auf dem Commit der letzten Abhängigkeit (`70a51b47`); `audit-gate.mjs` dort Exit 0. Die zwei roten Tasks sind aufgeklärt und nicht das Upgrade: `@grc/bpmn` — elf Bildvergleiche in `raster.test.ts`, die auf dem Vor-Upgrade-Commit `f102816f` mit demselben Rasterizer (ImageMagick 7.1.1, cairosvg 2.7.1) **identisch rot** sind, also die Werkzeugversionen und nicht das Rendering; `@grc/web` — zwei `waitFor`-Timeouts der BPMN-Viewer-Tests, die isoliert auf beiden Commits grün sind (unten), und der Test `wave8e-incompatible-library`, der nach dem Hook-Namen `useReactTable` suchte — durch die Umbenennung auf `useLegacyTable` angepasst (beide Namen zählen jetzt). Auf dem gepushten Commit `7c93880b` (Test- und Doku-Fixes eingeschlossen, `VITEST_MAX_WORKERS=8`): **12 von 13**, web 3.034/3.034, rot nur noch die elf Bildvergleiche in bpmn. Ein Lauf auf dem Vor-Upgrade-Commit `1a57f7c2` ergab dasselbe Bild: 11/13, Ausfälle bpmn (cairosvg fehlte damals) und drei Last-Timeouts in web |
| `npm run test` — Windows (Node 24.13)                                                                  | 8 von 13 Tasks grün; die fünf roten sind **Windows-Befunde der Testsuite, nicht des Upgrades** — Liste und Beleg unten unter OP-246                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Produktionsbau (`NODE_ENV` leer, Typprüfung scharf)                                                    | **grün**: `✓ Compiled successfully in 72s`, Typprüfung 13 s, **690/690** Seiten, Exit 0, `.next/standalone/apps/web/server.js` vorhanden (Commit `70a51b47`; die drei Commits danach ändern Tests, Doku und einen Lint-Pin, keinen Bau-Input)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `node server.js` aus dem Standalone-Verzeichnis                                                        | `/login` → 200, `/api/health` → 200 (Datenbank erreichbar), unangemeldete Route → 307 auf `/login`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `check-gate-inputs` / `check-workflow-script-deps` / `check-op-numbers` / `audit-dead-exports --check` | 13/13 · ohne Befund · ohne Befund · 2.468 in 459 Dateien, keine Regression                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `lint-ratchet.mjs`                                                                                     | **Exit 0** — Wurzel (apps/worker, packages, scripts) 44 Befunde gegen Baseline 44, apps/web 0 gegen 0 — gemessen mit `eslint-plugin-react-hooks` 7.0.1; mit 7.1.1 wären es 416 in apps/web, siehe OP-245                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `prettier --check .`                                                                                   | grün mit `--end-of-line auto`; ohne den Schalter meldet er auf diesem Checkout jede Datei, weil `core.autocrlf=true` sie mit CRLF ausliefert — ein Befund des Checkouts, nicht des Codes (im Linux-Klon ist die Prüfung ohne Schalter grün)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

**Was angehoben wurde (von → nach).**

| Bereich                                         | Pakete                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sicherheit (der Anlass)                         | next 16.2.11 → 16.3.4 (Override `^16.3.4` in der Wurzel, Range in apps/web, **neu als peer- und devDependency in packages/auth** — next-auth verlangt den Peer, der Workspace hatte ihn nie deklariert), eslint-config-next 16.2.11 → 16.3.4, sharp 0.35.3 → 0.35.4 (Override `>=0.35.4`)                                                                                     |
| Exakt gepinnt, von Hand                         | react/react-dom 19.2.7 → 19.2.8 (Override und Ranges gemeinsam; die Begründung des Pins aus `57ad2763` — eine React-Instanz — gilt weiter), recharts 3.10.0 → 3.10.1, jose 6.2.10 → 6.2.12                                                                                                                                                                                    |
| Minor/Patch (`npm update --save`, 14 Manifeste) | u. a. lucide-react 1.25 → 1.43, bpmn-js 18.21 → 18.28, next-intl 4.13.2 → 4.14.2, resend 6.17 → 6.26, @playwright/test 1.61 → 1.63, vitest 4.1.10 → 4.1.11 (schliesst `GHSA-82fw-gwwq-j7x9`), typescript (Wurzel) 6.0.2 → 6.0.3, turbo 2.10.5 → 2.10.12, alle @radix-ui-Pakete, @tanstack/react-query, hono, tsx, fast-xml-parser, papaparse, @anthropic-ai/sdk 0.112 → 0.124 |
| Majors, umgesetzt                               | @grc/bpmn: min-dash 4.2 → 5.1, min-dom 4.2 → 5.3, jsdom 25 → 29 (Stand von bpmn-js 18.28) · @grc/ai: openai 6.49 → 7.12 · apps/web: react-grid-layout 1.5 → 2.2, motion 12.43 → 13.2, @tanstack/react-table 8.21 → 9.2 · web + reporting: pdfkit 0.19 → 0.20 · svix aus dem Worker **entfernt** (deklariert, nirgends importiert)                                             |

**Was die Majors gekostet haben.**

- **react-grid-layout 2:** liefert eigene Typen (der `@ts-expect-error` am Import ist weg), hat `WidthProvider` durch den Hook `useContainerWidth` ersetzt und die Props `isDraggable`/`isResizable`/`draggableHandle`/`compactType`/`useCSSTransforms` in `dragConfig`/`resizeConfig`/`compactor` verlegt; `onLayoutChange` liefert ein `readonly`-Array. Eine Datei (`dashboards/[id]/page.tsx`). Der erste Commit dazu (`67dcab30`) ging mit tsc Exit 2 ab, weil ich das Ergebnis zu spät gelesen habe — der Folge-Commit `e2663893` benennt das.
- **@tanstack/react-table 9:** ein Neubau (Store, komponierbare Features, `ColumnDef` mit drei Generics; 290 Typfehler nach dem Install). Der Einstieg `@tanstack/react-table/legacy` behält die v8-Form — `useLegacyTable`, `LegacyColumnDef<TData, TValue>`, die `get*RowModel`-Fabriken. Umgestellt: zwei Aufrufstellen, 21 Typ-Importe, `TData extends RowData`, `pageIndex` im initialen Pagination-State, `VisibilityState` heisst `ColumnVisibilityState`; `DataTable` verliert ein nie genutztes zweites Generic. Komponententests 85/85. Die `incompatible-library`-Ausnahme aus ADR-028 zielt weiter auf dieselben zwei Dateien.
- **motion 13, pdfkit 0.20, openai 7, min-dash/min-dom 5, jsdom 29:** ohne Codeänderung; tsc und die jeweiligen Suiten grün.

**Was zurückgestellt wurde — jeweils mit Grund, keines mit Advisory, daher kein Allowlist-Eintrag.**

| Paket                                       | Verfügbar | Grund                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| undici 7.29.1 → 8.10.2 (packages/shared)    | 8.10.2    | **Gemessen, dann zurückgenommen.** Mit undici 8 fallen drei Tests der DNS-Pinning-Schicht (OP-112): `fetch failed … InvalidArgumentError: invalid onRequestStart method`. Ursache: der gepinnte `Agent` wird an Nodes **globales** `fetch` übergeben, und das spricht das Dispatcher-Protokoll der von Node gebündelten undici (7.18.2 in Node 24, älter in Node 22); undici 8 hat dieses Protokoll geändert. Der Wechsel setzt voraus, dass entweder Node eine undici 8 bündelt oder die Schicht auf undicis eigenes `fetch` umgestellt wird — eine Entscheidung für den Sicherheitspfad, nicht ein Versionssprung nebenbei. |
| eslint 9.39.5 → 10.10.0                     | 10.10.0   | Drei Plugins des Lint-Setups deklarieren ESLint 9 als Obergrenze: eslint-plugin-jsx-a11y 6.10.2 (`^9`), eslint-plugin-react 7.37.5 (`^9.7`), eslint-plugin-import 2.32.0 (`^9`). Ein Install gegen die Peer-Ranges wäre genau die Art Bau, die dieses Register anderswo als Befund führt.                                                                                                                                                                                                                                                                                                                                     |
| vitest / @vitest/coverage-v8 4.1.11 → 5.0.0 | 5.0.0     | Major der Testinfrastruktur in 13 Workspaces samt Coverage-Floors (`vitest.coverage.shared.ts`); das Advisory der 4.1.x-Linie ist mit 4.1.11 geschlossen. Eigener Arbeitsschritt, nicht Beifang eines Sicherheits-Upgrades.                                                                                                                                                                                                                                                                                                                                                                                                   |
| @types/node 22.20 → 26.5                    | 26.5.0    | Die Laufzeit ist Node 22 (Dockerfile, `engines`); Typen einer anderen Major als der Laufzeit sind ein Fehler, kein Fortschritt.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| typescript 5.9.3 → 7.0.2 (Workspaces)       | 7.0.2     | TypeScript 7 ist der native Compiler; die Wurzel steht bereits auf 6.0.3, die Workspaces auf `^5.7` (die Inkonsistenz ist in CLAUDE.md notiert). Ein Compilerwechsel ist ein eigener Punkt mit eigener Messung.                                                                                                                                                                                                                                                                                                                                                                                                               |
| zod 3.25.76 → 4.5.4                         | 4.5.4     | 423 Dateien importieren zod; „Zod für jede Validierung" ist Architekturregel. Eigener Punkt.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| next-auth 5.0.0-beta.32                     | —         | **Nicht angehoben, weil es nichts anzuheben gibt:** beta.32 ist der jüngste Stand der 5er-Linie (`npm view next-auth dist-tags` → `beta: 5.0.0-beta.32`); `latest` ist 4.24.15 und wäre ein Rückschritt.                                                                                                                                                                                                                                                                                                                                                                                                                      |

**Zwei Dinge, die nicht in der Vorgabe standen.**

1. **Die im Cloud-Container gemeldete `TS7006` in `middleware.ts:121` liess sich lokal nicht reproduzieren** — weder mit TypeScript 5.9.3 (apps/web) noch mit 6.0.3 (Wurzel), jeweils mit einer unveränderten Kopie der Datei im Baum. Wahrscheinlichste Erklärung: im Container fehlte `next` als Peer von next-auth in packages/auth, sodass `NextAuthRequest extends NextRequest` nicht auflöste und `req` zu `any` wurde; mit dem deklarierten Peer ist die Inferenz intakt. Der Parameter trägt jetzt trotzdem den echten Typ `NextAuthRequest` — explizit statt inferiert, ohne Cast.
2. **npm hat beim ersten Install alle 26 `@esbuild/*`-Plattformeinträge aus dem Lockfile gestrichen** und die Windows-Binary nicht installiert; `tsx` und damit `migrate-all` starben mit „The package @esbuild/win32-x64 could not be found". Ursache war die versteckte `node_modules/.package-lock.json` aus dem Linux-Container: npm 11.6 auf Windows hielt die Plattformpakete danach für überzählig, auch nach Wiederherstellung der Einträge. Erst das Löschen der versteckten Datei und ein Install mit dem im `packageManager` gepinnten npm 11.12.0 brachten die 26 Einträge zurück. Für jeden weiteren Install auf dieser Maschine: **`npx npm@11.12.0`**, nicht das globale npm 11.6.

**Neuer Punkt daraus: OP-246 — die Testsuite ist auf Windows nicht lauffähig, aus benennbaren Gründen.** Auf Windows (Node 24.13, `core.autocrlf=true`) waren nach dem Next-Upgrade fünf der 13 Tasks rot — keiner davon wegen des Upgrades, was der Linux-Lauf auf demselben Commit belegt. Die Klassen:

| Klasse                                                                                     | Betroffen                                                                                                                                                                                                                                                                                                         | Stand                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spawnSync("npx", …)` ohne Shell → `ENOENT`, Exit 1 **ohne Ausgabe**                       | `packages/db/tests/run-db-suites.mjs`, `apps/worker/tests/require-db.mjs`, `apps/web/src/__tests__/run-db-suites.mjs`, `scripts/lint-ratchet.mjs`                                                                                                                                                                 | **behoben**: vitest bzw. ESLint werden über `process.execPath` und den aufgelösten Binary-Pfad gestartet; danach db-Integration 105/105, db-RLS 186/186, web-RLS 24/24 auch auf Windows |
| Pfadtrenner: Tests vergleichen `src/...`-Pfade mit `path.join`-Ergebnissen                 | `packages/shared/tests/dpms-tia-retention.test.ts` (2), `apps/web/src/__tests__/lib/client-pagination-contract.test.ts` (2), `apps/web/src/__tests__/i18n/wave8d-compact-currency.test.ts` (1)                                                                                                                    | offen; Muster: `expected 'lib/format-date.ts', received 'lib\format-date.ts'`                                                                                                           |
| CRLF: Tests suchen `\n`-getrennte Textblöcke in Dateien, die der Checkout mit CRLF liefert | `apps/web/src/__tests__/a11y/theme-contrast.test.ts`, `apps/worker/tests/no-fabricated-evidence.test.ts`, `apps/worker/tests/docs-vs-honest-refusals.test.ts` (2)                                                                                                                                                 | offen; entweder `.gitattributes` `eol=lf` für die gelesenen Dateien oder `\r?\n` in den Tests                                                                                           |
| Fixture ausserhalb des Repos                                                               | `documents-controlled-copy`, `documents-upload-immutability`, `pdf-watermark` (2): lesen `/work/audit/evidence/S06/poc_owner_pw_only.pdf` — einen Pfad, den es nur im Cloud-Container gibt                                                                                                                        | offen; die PoC-Datei gehört als Fixture ins Repo, sonst prüft der Test auf jeder anderen Maschine nichts                                                                                |
| Werkzeug-/Laufzeitvoraussetzung                                                            | `packages/bpmn/test/verify/raster.test.ts` (cairosvg, unter Windows ohne Cairo-DLL nicht installierbar); `packages/shared/tests/excel-to-bpmn-streaming.test.ts` (4: exceljs' Streaming-Reader liefert unter Windows kein `workbook.model.sheets` — mit Node 20, 24 und 25 gemessen, also nicht die Node-Version) | offen; cairosvg ist im WSL-Debian jetzt installiert (`python3-cairosvg`), dort grün                                                                                                     |
| Zeitlimit unter Last                                                                       | zwei Lint-Tests (`api-v1-lint-gate`, `no-assign-module-variable`) mit 15 s Timeout; auf Linux unter voller Parallelität ausserdem `all-components-smoke`, `bpmn-chrome-plane`, `bpmn-engine-switch` — **isoliert auf 16.3.4 und 16.2.11 identisch grün (2–3,6 s)**, der Gesamtlauf mit `--concurrency=1` grün     | Befund der Maschine (32 Kerne → viele vitest-Worker gleichzeitig), nicht des Codes                                                                                                      |

**Was verhindert, dass es unbemerkt zurückkommt.** Nichts Neues — das Gate ist `audit-gate.mjs`, und es steht auf 0. Neu ist nur, dass die vier Runner-Skripte auf Windows ein Ergebnis melden statt eines stummen Exit 1.

**Offen unter OP-234:** nichts. Die sieben zurückgestellten Pakete stehen oben mit Grund; vier davon (undici 8, vitest 5, TypeScript 7, zod 4) sind eigene Arbeitsschritte, keine Reste dieses Punkts.

**Dasselbe hat die Cloud-Sitzung parallel gefunden und als OP-245 registriert (Welle 8l, `b8dd38a3`).** Hier die lokale Messung und die vorläufige Entscheidung: Das Minor-Update von `eslint-config-next` (16.3.4) zog `eslint-plugin-react-hooks` von 7.0.1 auf 7.1.1 (veröffentlicht am 2026-09-08). Mit 7.1.1 meldet die Lint-Ratsche in `apps/web` **416 Befunde gegen eine Baseline von 0**: `set-state-in-effect` 384×, `refs` 15×, `purity` 9×, `static-components` 4×, `immutability` 3×, `preserve-manual-memoization` 1×. Gegenprobe an einer Datei (`dashboards/[id]/page.tsx`, von mir angefasst): 7.1.1 → 2 Fehler in Zeilen, die ich nicht berührt habe; 7.0.1 → 0. Das sind also keine 416 neuen Defekte, sondern eine erweiterte Erkennung derselben Regeln (Aufrufketten wie `fetchX()` im Effekt gelten jetzt als `setState` im Effekt). Die Ratsche sagt zu Recht „beheben, nicht aufnehmen" — aber 416 Stellen sind kein Beifang eines Sicherheits-Upgrades. Entscheidung: **`eslint-plugin-react-hooks` als exakte devDependency `7.0.1` in apps/web** (erfüllt das `^7.0.0` von eslint-config-next und dedupliziert darauf), damit die Baseline weiter gegen die Plugin-Version gemessen wird, für die sie kalibriert wurde; die Übernahme von 7.1 mit ihren 416 Stellen ist OP-245 — dort stehen die drei Wege (A: Plugin festnageln, B: jetzt abarbeiten, C: `warn` unter der Ratsche) als Entscheidung des Eigentümers. Diese Sitzung hat **Weg A vorläufig** genommen, weil das Sicherheits-Upgrade sonst am Lint-Tor hängen bliebe; die Entscheidung bleibt offen und ist mit einer Zeile (`devDependencies` in apps/web) umkehrbar. Ein Override in der Wurzel wurde zuerst versucht: npm 11.12 hat das Paket damit gar nicht mehr installiert (`Cannot find module`), auch nach Löschen des Lockfile-Eintrags und der versteckten `node_modules/.package-lock.json` — deshalb die direkte Abhängigkeit.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                | Beleg                                                                            | Art       | Stand     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | --------- | --------- |
| OP-246 | **Die Testsuite läuft auf Windows nicht durch — aus fünf benennbaren, vom Upgrade unabhängigen Gründen** (Tabelle oben): `spawnSync("npx")` ohne Shell (behoben, vier Skripte), Pfadtrenner in fünf Tests, CRLF-empfindliche Textsuche in vier Tests, eine Fixture ausserhalb des Repos in vier Tests, zwei Werkzeugvoraussetzungen (cairosvg, exceljs-Streaming). | Windows-Lauf 8/13 gegen Linux-Lauf 11/13 auf demselben Commit; Einzelbelege oben | Testsuite | teilweise |

### Nachtrag 2026-09-09 — Welle 8i: ein doppelter Schlüssel, und eine Prüfung, die ihn nicht finden konnte

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Beleg                                                                             | Art | Stand   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --- | ------- |
| OP-239 | **Ein doppelter `env:`-Schlüssel in `ci.yml` hat den gesamten CI-Workflow drei Commits lang nicht starten lassen.** GitHub quittiert das nur mit `This run likely failed because of a workflow file issue` — kein Job, kein Protokoll, keine Zeile, die auf die Stelle zeigt. Und die Übersicht des Pull Requests sah trotzdem teilweise grün aus, weil die übrigen, eigenständigen Workflows davon nichts wissen. Von mir verursacht: ich habe einem Schritt ein `env:` gegeben, der schon eines hatte. | `f102816f`, `cd6e551d`, `d07362ee` — CI jeweils `failure` nach unter einer Minute | Tor | behoben |

**Geprüft hatte ich es** — mit `yaml.safe_load`, und genau das ist der Befund.
Die YAML-Spezifikation verbietet doppelte Schlüssel; die verbreiteten Lader
nehmen sie stillschweigend hin und behalten den letzten. **Die Prüfung war
grün, weil sie blind war** — dieselbe Klasse wie die achtzehn Checks, die
dieses Audit gesammelt hat, diesmal in meinem eigenen Werkzeug.

`scripts/check-workflow-yaml.mjs` liest jede Workflow-Datei mit einem Lader,
der bei doppelten Schlüsseln abbricht, und prüft zusätzlich die zwei anderen
Formfehler, die GitHub mit derselben Zeile quittiert: ein Job ohne `steps`,
ein Schritt ohne `uses` und ohne `run`.

Gegenprobe, an derselben Datei gemessen:

| Prüfung                   | Ergebnis                     |
| ------------------------- | ---------------------------- |
| `yaml.safe_load`          | „ohne Befund"                |
| `check-workflow-yaml.mjs` | Exit 1, mit Datei und Stelle |

### Nachtrag 2026-09-09 — Welle 8h: die Frage „was ist offen?" war nur über eine Sortierregel zu beantworten

**Eigener Fehler, siebte Instanz — und zweimal am selben Tag.** Ich habe dem
Eigentümer fünf Punkte als offen gemeldet (OP-175, OP-176, OP-177, OP-179,
OP-180), von denen vier längst behoben waren, und OP-173 dazu. Beide Male habe
ich den Stand aus der **Reihenfolge** der Nachträge erschlossen statt ihn
nachzuschlagen — erst mit der falschen Regel (letzte Fundstelle = neueste; es
ist die erste, weil Nachträge oben eingefügt werden), dann mit der richtigen
Regel, die aber **nicht durchgehend gilt**: der Nachtrag an Zeile 566 ist auf
2026-09-03 datiert und steht über Nachträgen vom 2026-09-09.

Die Ursache ist nicht Unaufmerksamkeit. Sie ist, dass die einfachste Frage an
ein Register — _welche Punkte sind offen?_ — erschlossen werden musste, statt
irgendwo zu stehen.

**`scripts/op-index.mjs` schreibt sie jetzt hin.** Je Nummer der jüngste
Eintrag, bestimmt nach dem **Datum** des Nachtrags und bei Gleichstand nach
der Position; Ergebnis ist `docs/OFFENE-PUNKTE-INDEX.md`. Ohne Argument prüft
das Skript, dass der eingecheckte Index dem Register entspricht — dieselbe
Mechanik wie bei der generierten API-Doku, und aus demselben Grund: ein Index,
den niemand nachzieht, beantwortet die Frage falsch statt gar nicht.

**Gemessener Stand aus dem Index (238 Nummern):** 6 offen, 1 teilweise,
2 Entscheidung, **159 ohne Stand**, 70 behoben.

**Die 159 sind der eigentliche Befund.** Die Haupttabelle des Registers hat
gar keine Stand-Spalte — für zwei Drittel aller Punkte ist „ist das erledigt?"
aus dem Register **nicht** zu beantworten, nur aus den Nachträgen, und nur für
die, die je einen bekommen haben. Das ist keine Nachlässigkeit im Einzelfall,
sondern eine Lücke in der Form des Registers. Sie ist hier benannt und nicht
behoben: eine Stand-Spalte für 166 Altpunkte nachzutragen heißt, 166 Punkte
gegen den Code zu prüfen — das ist Arbeit, keine Formatierung.

| OP     | Was                                                                                                                                                                                                                                                                                                          | Beleg                                                                | Art  | Stand   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ---- | ------- |
| OP-173 | „`apps/web` hat keine Lint-Ratsche" — das galt bis Welle 4b-5 und steht seitdem falsch im Register. `.eslint-ratchet.json._scopes` führt `root` **und** `apps/web`; der Lauf misst dort 2.301 Dateien gegen Baseline 0, in einem eigenen Arbeitsverzeichnis mit der strengeren `apps/web/eslint.config.mjs`. | `[apps/web] . (cwd apps/web): 0 Befunde (Baseline 0), 2.301 Dateien` | Doku | behoben |

### Nachtrag 2026-09-09 — OP-238: eine frische Installation, die migriert bevor sie die Rolle anlegt, bekommt keine Anwendung

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Beleg                                                                                                                                    | Art         | Stand       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------- |
| OP-238 | **Der EXECUTE-Grant auf `app_current_org_scope()` ist an die Existenz der Rolle zum Migrationszeitpunkt gebunden.** `0396_rls_log_tables.sql:117` entzieht der Funktion erst `PUBLIC` und vergibt sie dann in einem `DO`-Block unter `IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app')`. Existiert die Rolle beim Migrieren nicht, wird der GRANT **stillschweigend übersprungen** — und `deploy/provision-grc-app.sh` holt ihn nicht nach, weil es EXECUTE bewusst nicht pauschal vergibt (`0398_secdef_function_hardening.sql` hat es gezielt entzogen). Da **jede** RLS-Policy diese Funktion aufruft, scheitert danach **jede Abfrage der Anwendung** mit `permission denied for function app_current_org_scope`. | in CI zweimal gemessen; lokal, wo die Rolle vor den Migrationen existierte, trägt die Funktion `grc_app=X/grc` und die Abfrage liefert 0 | **Betrieb** | **behoben** |

**Die Kette ist vollständig gemessen**, in beide Richtungen:

| Reihenfolge                           | ACL auf `app_current_org_scope()` | Abfrage als `grc_app`      |
| ------------------------------------- | --------------------------------- | -------------------------- |
| Rolle **vor** den Migrationen (lokal) | `grc=X/grc,grc_app=X/grc`         | `0`                        |
| Rolle **nach** den Migrationen (CI)   | ohne `grc_app`                    | `ERROR: permission denied` |

**In CI behoben**, indem die Provisionierung jetzt **vor** den Migrationen
läuft — in beiden Jobs, `database` und `e2e-smoke`. Das ist zugleich die
Reihenfolge, die eine Installation einhalten muss.

**Das Skript nimmt den Zustand jetzt ab.** Es kann den fehlenden Grant nicht
nachholen, ohne die Härtung aus `0398_secdef_function_hardening.sql`
zurückzunehmen — ein pauschaler `GRANT EXECUTE ON ALL FUNCTIONS` gäbe `grc_app`
Zugriff auf die `SECURITY DEFINER`-Funktionen, die mit Superuser-Rechten laufen
und RLS umgehen. Das war ausdrücklich der Befund S01-13.

Was es kann, ist verhindern, dass der kaputte Zustand unbemerkt ausgeliefert
wird: `provision-grc-app.sh` prüft am Ende je Datenbank
`has_function_privilege('grc_app', 'public.app_current_org_scope()',
'EXECUTE')` und endet mit Exit 1 samt Ursache und den zwei Abhilfen (Migration
erneut fahren — sie ist idempotent — oder bei einer Neuinstallation vor den
Migrationen provisionieren). Läuft die Prüfung vor den Migrationen, sagt sie
ausdrücklich „kein Befund, aber auch keine Abnahme" statt still grün zu sein.

Beide Richtungen gemessen: mit Grant `✓`, Exit 0; nach `REVOKE EXECUTE` die
volle Meldung und Exit 1; nach erneutem `GRANT` wieder `✓`.

**Fallstrick, der dabei fast durchgerutscht wäre:** Die erste Fassung der
Abnahme rief `psql_db "$DB" -tAc "…"`. `psql_db` liest SQL aber von der
Standardeingabe (`-f -`) und reicht keine weiteren Argumente durch — die
Abfrage lief ins Leere, das Ergebnis war leer, und die Abnahme meldete
„Funktion nicht vorhanden?" statt zu prüfen. Sie wäre still durchgelaufen. Ein
eigener `psql_query`-Helfer holt jetzt Einzelwerte.

### Nachtrag 2026-09-09 — Welle 8g, zweiter Durchgang: der PR-Lauf hat drei fehlende API-Routen aufgedeckt

Nach dem Zusammenführen mit `189cb05a` (OP-167) lief die CI erneut. Drei von
vier neu betrachteten Fehlschlägen waren **keine** Nachwehen der Reparatur,
sondern eigene Befunde.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Beleg                                                             | Art               | Stand   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------- | ------- |
| OP-235 | **Drei API-Routen liegen auf der Platte und in keinem Klon — und die Oberfläche ruft eine davon.** `.gitignore:89 test-results/` (gedacht für die Ausgabe von Playwright) verschluckt `connectors/[id]/test-results/`, `devops-connectors/test-results/` und `identity-connectors/test-results/`. Es sind vollständige Handler mit `withAuth`, Modulprüfung, Paginierung und org-gebundenen Abfragen. `app/(dashboard)/connectors/[id]/page.tsx:67` ruft `/api/v1/connectors/${id}/test-results?limit=20` — in Produktion also gegen eine **404**. Das ist **C-15 zum zweiten Mal**, mit einer anderen Regel und drei anderen Routen. | frischer Checkout: 1.358 Pfade, Arbeitsbaum: 1.361                | **Produktdefekt** | behoben |
| OP-236 | **`packages/bpmn` hat in CI noch nie eine Coverage-Summary erzeugt.** Der Bildvergleichstest rastert SVG über `cairosvg` und vergleicht über ImageMagick; beides sind Prozesse, keine npm-Abhängigkeiten, und kein Job installierte sie. Der Test bricht **zu Recht** hart ab statt zu überspringen — die Folge war aber, dass die Aggregation seit jeher mit „no coverage-summary.json for: packages/bpmn" endete.                                                                                                                                                                                                                   | `AssertionError: cairosvg is not importable`                      | Testlücke         | behoben |
| OP-237 | Der Forward-only-Check liest die ersten **40** Zeilen einer Migration nach dem Remediation-Marker. In `0099_phase2_missing_tables.sql` steht er auf **Zeile 171** — die Datei galt dem Check deshalb als unerlaubt geänderte, ausgelieferte Migration.                                                                                                                                                                                                                                                                                                                                                                                | `##[error]ADR-014 is forward-only` bei genau einer von 28 Dateien | Tor               | behoben |

**Wie OP-235 gefunden wurde, ist der Teil, der zählt.** Der Check „Generated
API docs are reproducible" war rot, und die naheliegende Erklärung — „die Doku
ist veraltet" — war die falsche. Ich hatte sie neu erzeugt und committet, und
CI erzeugte trotzdem eine **andere**: 76 Zeilen weniger. Erst der Vergleich
zweier Läufe desselben Generators, einmal im Arbeitsbaum und einmal in einem
frischen `git worktree` auf denselben Commit, zeigte den Unterschied — drei
Pfade, die es nur auf der Platte gibt.

**Nachtrag zu OP-233, eine Stunde später gemessen:** Der geänderte Testwert
hat den PR-Lauf trotzdem nicht grün gemacht — und der Grund ist lehrreich.
gitleaks scannt im PR die **Commit-Spanne**, nicht den Arbeitsbaum. Der alte
Wert steht weiter in Commit `39ca631` vom 2026-09-01, und der liegt in der
Spanne. Für einen Fund in einem **abgeschlossenen** Commit ist der
Fingerabdruck das richtige Mittel und der Pfad das falsche: er nennt genau
einen Commit, eine Datei, eine Regel und eine Zeile — und er fällt in die
sichere Richtung, denn wird die Historie doch umgeschrieben, zeigt er ins
Leere und der Fund erscheint wieder. `.gitleaksignore` trägt diese eine Zeile.
Gegen die echte Historie gemessen: mit der Datei `no leaks found`, ohne sie
sofort wieder `generic-api-key`.

**Die Antwort ist diesmal nicht eine dritte Ausnahme.** Auf C-15 folgte eine
Ausnahme für `coverage/`; sie hat den nächsten Fall mit `test-results/` nicht
verhindert. `scripts/check-gate-inputs.mjs` fragt jetzt nicht mehr nach
einzelnen Regeln, sondern: **liegt unter `apps/web/src/app` eine Quelldatei,
die git nicht sieht?** Das fängt jede künftige Regel, gleich wie sie heißt.
Gegengeprüft mit einer neu angelegten Route unter einem ignorierten Pfad:
Exit 1 mit Regel und Fundstelle; mit Ausnahme Exit 0.

### Nachtrag 2026-09-09 — OP-167 geschlossen: elf Bauläufe gegen eine Umgebungsvariable

Lokale Sitzung auf der Maschine des Eigentümers, Checkout `1649027f`, Next
16.2.11, Node 24.13, `next.config.ts` bis Lauf 16 unverändert. Übergabe war
`docs/HANDOVER-OP-167.md`; deren Experiment A (`serverMinification` /
`turbopackMinify` abschalten) wurde **nicht** gebaut, weil sich vorher aus
dem Next-Quellcode ergab, dass `--debug-prerender` mehr umschaltet, als die
Übergabe annahm — und der Unterschied dort lag.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Beleg                                                                      | Art                                            | Stand       |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- | ----------- |
| OP-167 | **Der Produktionsbau läuft.** Die Ursache war `set NODE_ENV=development` im eigenen Bau-Rezept (Übergabe §7), nicht Next.js. Mit der Variable lädt der Prerender-Worker Nexts _Entwicklungs_-Laufzeit, während der gebaute Code fest an die _Produktions_-Laufzeit gebunden ist — zwei React-Kopien, `useContext` auf einem `null`-Dispatcher. Ohne die Variable baut derselbe Checkout in unter zwei Minuten grün, `server.js` startet und antwortet. Ein Guard in `next.config.ts` weist einen solchen Bau jetzt nach zwei Sekunden mit Begründung ab. | Läufe 12–17 unten; `apps/web/src/lib/build-env-guard.ts` + Test (6/6 grün) | Betrieb — **eigener** Fehler, kein Fremdfehler | **behoben** |

**Was gemessen wurde.** Sechs Bauläufe, jeder mit gelöschtem `.next`, jeder
mit `ARCTOS_BUILD_IGNORE_TS_ERRORS=1` (damit die Erzeugungsphase erreicht
wird) und `--max-old-space-size=12288`. Erfolgskriterium wie in der Übergabe:
nicht `✓ Compiled`, sondern `.next/standalone/apps/web/server.js`.

| #   | Lauf                                                                                                     | Ergebnis                                                                                                                                                                                                                                                                         | Was er belegt / ausschliesst                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | `NODE_ENV` **nicht gesetzt** (Next setzt `production`), Config unverändert                               | **grün**, 688/688, Exit 0, `server.js` vorhanden, 1 min 46 s                                                                                                                                                                                                                     | Derselbe Checkout, der elfmal rot war, baut. Next 16.2.11, Turbopack, die Seitenzahl, unser `global-error.tsx` und `next-intl` scheiden als Ursache aus — endgültig, nicht nur je einzeln.                                                                                                |
| 13  | wie 12, nur `NODE_ENV=development` in der Prozessumgebung                                                | **rot**, Abbruch bei 516/688, `digest: 3120278025`, kein `server.js`                                                                                                                                                                                                             | Die Gegenprobe: die Variable allein reproduziert den Fehler wortgleich, gleicher Digest, gleiche Stelle. Zeile 2 des Logs: `⚠ You are using a non-standard "NODE_ENV" value in your environment` — diese Warnung stand in jedem der elf roten Logs.                                       |
| 14  | wie 13, mit einem `--require`-Hook, der je Prozess protokolliert, welche Next-Laufzeitdatei geladen wird | **rot**; 31 Worker laden `app-page-turbo.runtime.prod.js` aus dem gebauten Chunk — **einer davon (pid 75652) lädt zusätzlich `app-page-turbo.runtime.dev.js`**, aus `node_modules/next/dist/server/route-modules/app-page/module.compiled.js:22`, genau beim Start der Erzeugung | Der Mechanismus mit Stack, statt einer Vermutung: zwei Laufzeitdateien in **einem** Prozess. Das ist der „echte Stack", den §5 der Übergabe suchte — er liegt nicht im ignore-gelisteten Fehler, sondern eine Ebene früher, beim Laden.                                                   |
| 15  | `NODE_ENV` nicht gesetzt, aber `NODE_ENV=development` in `apps/web/.env.local`                           | **grün**, 688/688, `server.js` vorhanden; Log ohne die Warnung aus Lauf 13                                                                                                                                                                                                       | Env-Files sind für diesen Fehler **wirkungslos**: Next setzt `NODE_ENV` vor dem Lesen der Dateien und lässt es von ihnen nicht überschreiben (`@next/env`, `processEnv`). Die Begründung in `docs/STATUS.md` vom 2026-07-23 — „Zeile aus `.env` entfernt" — deckte den Mechanismus nicht. |
| 16  | wie 12, Artefakt-Lauf, danach `node server.js` aus dem Standalone-Verzeichnis                            | **grün**; Server `✓ Ready`, `/login` → 200 in 50 ms, `/api/health` → 503 (keine Datenbank erreichbar, erwartet), `/_not-a-route` und `/de/login` → 307 auf `/login?callbackUrl=…`                                                                                                | Das Artefakt ist nicht nur vorhanden, es läuft. Die 503 auf `/api/health` ist die korrekte Antwort eines Servers ohne DB, kein Baufehler.                                                                                                                                                 |
| 17a | `NODE_ENV=development` **mit** dem neuen Guard in `next.config.ts`                                       | Abbruch nach **2 s**: `Error: [next.config] NODE_ENV=development is set in the environment of \`next build\` … (OP-167). Unset NODE_ENV … or pass --debug-prerender`                                                                                                             | Der Fehler ist jetzt in Sekunden benannt statt nach zwölf Minuten als Digest.                                                                                                                                                                                                             |
| 17  | wie 16, **mit** dem Guard in `next.config.ts`, `NODE_ENV` nicht gesetzt                                  | **grün**, 688/688, Exit 0, `server.js` vorhanden, 1 min 43 s                                                                                                                                                                                                                     | Der Guard blockiert keinen korrekten Bau. Das ist der Stand, mit dem die Testinstanz gebaut werden kann.                                                                                                                                                                                  |

**Der Mechanismus.** `next build` ersetzt `process.env.NODE_ENV` im
gebündelten Code statisch durch `"production"`
(`next/dist/build/define-env.js:77` — `dev || allowDevelopmentBuild ?
'development' : 'production'`). Deshalb enthält kein Server-Chunk mehr eine
`NODE_ENV`-Abfrage; stattdessen steht dort 2.732-mal fest
`require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js")`.
Der Worker der statischen Erzeugung ist dagegen **ungebündelter** Next-Code:
`export/routes/app-page.js` → `route-modules/app-page/module.render` →
`module.compiled.js`, und diese Datei wählt die Laufzeit zur Laufzeit an
`process.env.NODE_ENV` — mit `development` also `app-page-turbo.runtime.dev.js`.
Jede der beiden Laufzeitdateien bringt ihr eigenes React mit
(`react.production.js` bzw. `react.development.js`, nachgezählt). Gerendert
wird mit dem `react-dom-server` der Dev-Kopie, die Komponenten der Seite rufen
ihre Hooks aber auf der Prod-Kopie auf, deren Dispatcher niemand gesetzt hat —
`ReactSharedInternals.H` ist `null`, und der erste Hook stirbt:
`Cannot read properties of null (reading 'useContext')`. Dass es genau
`/_global-error` trifft, liegt nicht an dieser Route: **alle** unsere Seiten
sind `force-dynamic`, prerendert werden nur die beiden synthetischen Routen.
Darum auch Lauf 8 der Übergabe (ein Worker → Abbruch bei 0/688): die erste
Seite, die überhaupt gerendert wird, ist die erste, die stirbt.

**Warum `--debug-prerender` grün war (Lauf 5).** Die Übergabe las die Doku:
Minification aus, Sourcemaps an, `prerenderEarlyExit=false`. Der Code tut
mehr (`next/dist/cli/next-build.js:65` und `server/config.js:1387 ff.`): das
Flag setzt `process.env.NODE_ENV = 'development'` **und**
`experimental.allowDevelopmentBuild = true`. Damit ist auch der gebündelte Code
`development`, beide Hälften laden dieselbe Laufzeitdatei — grün. Es war nie
die Minification. Experiment A der Übergabe hätte deshalb zwei weitere rote
Läufe geliefert.

**Warum elf Läufe daran vorbeigingen — drei Dinge, die schon da waren.**

1. Die Warnung stand in **Zeile 2 jedes roten Logs**: `non-standard "NODE_ENV"
value in your environment`. Sie wurde als Rauschen behandelt wie der
   `ECONNREFUSED`-Prewarm.
2. `docs/STATUS.md` (Abschnitt 2026-07-23) **nannte die Ursache bereits**:
   „React-Dev/Prod-Dispatcher-Mismatch, non-standard-node-env". Nur war die
   damalige Abhilfe — die Zeile aus den `.env`-Files zu entfernen — eine
   Begründung, die den Mechanismus nicht deckte (Lauf 15); als der Fehler
   im September wiederkam, wurde er als neuer Fremdfehler gelesen statt als
   derselbe Defekt mit anderer Quelle.
3. Die Quelle war das Bau-Rezept selbst: `NODE_ENV=development` wurde für
   `npm install` gesetzt (mit `production` fehlen die devDependencies — das
   stimmt), und dann für den Bau nicht wieder entfernt. Das Rezept in
   `docs/HANDOVER-OP-167.md` §7 ist korrigiert.

Das ist, in der Zählung dieses Registers, die **fünfte Fundstelle derselben
Form** — eine wahre Aussage, die mehr abdeckt, als sie belegt: „`NODE_ENV=production`
bricht den Install" wurde zu „also `development` setzen", und das galt dann
auch für den Bau. Und es ist die zweite Fundstelle der Form „stand schon in
der eigenen Doku, wurde nicht wieder gelesen".

**Was dieses Register zurücknimmt.** Die Kategorie „Fremdfehler in Next.js
16.2.x" für OP-167 (Haupttabelle, korrigiert), die Zuordnung zu
vercel/next.js#95741 (bereits am 2026-09-03 zurückgenommen, jetzt gegenstandslos),
und die drei Optionen der „Vorlage an den Eigentümer" vom 2026-09-03 (auf einen
Fix warten, auf Webpack wechseln, Canary prüfen) — keine davon war nötig.
Deliverable 2 der Übergabe (Minimalreproduktion für #95741) entfällt aus
demselben Grund. Bestehen bleibt der Webpack-Befund aus Übergabe §6
(`node:stream` erreicht über das `@grc/shared`-Barrel eine Client-Seite):
er ist ein eigener Defekt und von OP-167 unabhängig.

**Was verhindert, dass es ein zwölftes Mal passiert.**
`apps/web/src/lib/build-env-guard.ts` wird beim Laden von `next.config.ts`
ausgeführt und wirft, wenn `NODE_ENV=development` gesetzt ist, `argv` ein
`next build` ist und `--debug-prerender` fehlt (das ist der eine
Entwicklungsbau, den Next selbst konsistent macht). `next dev`, `next start`
und die Build-Worker (anderes `argv`) sind nicht betroffen. Sechs Unit-Tests
in `src/__tests__/lib/build-env-guard.test.ts`, ESLint sauber. Kein ADR: es
gibt keine Architekturentscheidung zu dokumentieren, nur eine Regel, die der
Code jetzt selbst durchsetzt.

**Offen unter OP-167:** nichts. Der Bau für die Testinstanz kann heute
erfolgen. Die Docker-Pipeline war nie betroffen — das Node-Image setzt
`NODE_ENV` im Build-Stage nicht, und `Dockerfile:135` setzt `production` erst
im Runtime-Stage.

### Nachtrag 2026-09-09 — Welle 8g: die CI war rot, und ich habe lokal gemessen

Einzelheiten in `docs/UMSETZUNG-WELLE-8G.md`.

**Der Befund über allen anderen.** Bis heute habe ich ausschließlich **lokal**
gemessen und nie die CI des Pull Requests angesehen. PR #431 war rot: **11 von
21 Checks** gescheitert, während hier jedes Gate grün meldete. Alle bisherigen
„alle Tore grün"-Aussagen dieses Registers galten für den lokalen Lauf. Das ist
die sechste eigene Fundstelle derselben Klasse — ein vorhandenes Artefakt nicht
gelesen — und die folgenreichste.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Beleg                                                                          | Art            | Stand                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | -------------- | ---------------------- |
| OP-227 | **Der i18n-Parity-Job installierte nichts und war seit Welle 8c tot.** Er lief lange ohne Abhängigkeiten, weil `audit-i18n-coverage.mjs` nur `node:`-Module benutzte. In Welle 8c bekam das Skript `prettier` (OP-220). Seitdem: `ERR_MODULE_NOT_FOUND`, Job beendet, **und der Schritt darunter, der auf Schlüsselverlust prüft, lief nie** — der Check aus Welle 8c war ab dem Tag seiner Einführung wirkungslos. Von mir verursacht.                                                                                                                                                                                                    | `Cannot find package 'prettier' imported from scripts/audit-i18n-coverage.mjs` | Tor            | behoben                |
| OP-228 | **Derselbe Fehler im wöchentlichen Volllauf des Geheimnis-Scanners, seit `dcded077` (2026-09-05).** `full-history-scan` ruft `scripts/audit-secrets.mjs`, installiert nichts, und das Skript importiert seit Welle 5c `prettier`. Der Schritt, den Welle 5b ausdrücklich **scharf gestellt** hatte, nachdem er zuvor mit `continue-on-error` **und** `\|\| true` zwei Wellen lang einen echten Treffer verdeckt hatte, stirbt seitdem an einem fehlenden Modul. Gefunden hat das kein Mensch, sondern der neue Check beim ersten Lauf.                                                                                                     | `check-workflow-script-deps.mjs`                                               | Tor            | behoben                |
| OP-229 | **Der ADR-023-Kopfcheck prüfte nur, DASS die Zeile da ist, nicht was darauf steht.** 25 neue Migrationen trugen gar keinen Kopf (der PR-Check war deshalb rot); zehn weitere trugen `Locking: none` — ein Wort, das ADR-023 §4 nicht kennt (`no\|short\|long`). Ein Kopf mit einem erfundenen Wert ist so viel wert wie keiner, er sieht nur aus wie einer.                                                                                                                                                                                                                                                                                | 25 ohne Kopf, 10 mit unzulässigem Wert                                         | Tor            | behoben                |
| OP-230 | **Die CI legte `grc_app` selbst an — ohne `GRANT EXECUTE`.** Die RLS-Policies rufen `app_current_org_scope()`; die Abfrage endete mit `permission denied for function`. Der Vergleich `[ "$ROWS" != "0" ]` konnte eine fehlgeschlagene **Abfrage** nicht von einer verletzten **Policy** unterscheiden und meldete `RLS FAILURE — expected 0 rows, got` (leer). Ein Check, der über das Falsche redet. `deploy/provision-grc-app.sh` ist die eine gültige Fassung; die CI benutzt sie jetzt.                                                                                                                                               | beides nachgestellt: alte Grants → `permission denied`, Skript → `0`           | Tor            | behoben                |
| OP-231 | **`apps/web/messages/de.json` ist Bauausgabe und steht in `.gitignore`** — und zwei Suiten aus Welle 7a/7b lasen sie direkt. Lokal war sie immer da, in CI nie: `ENOENT`, und die Meldung sagte niemandem warum. Dieselbe Klasse wie C-15 und OP-066.                                                                                                                                                                                                                                                                                                                                                                                      | `no such file or directory … apps/web/messages/de.json`                        | Testlücke      | behoben                |
| OP-232 | `docs/openapi.yaml` und `docs/API_REFERENCE.md` waren veraltet (1.372 Routen, 2.042 Operationen).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `2.243 insertions, 1.685 deletions`                                            | Doku           | behoben                |
| OP-233 | **Zwei Scanner, zwei Bewertungen derselben Testfixtures.** gitleaks lief „zero config" und meldete zwei Funde, die `scripts/audit-secrets.mjs` längst als bewertete Fixtures führt. Einer war gar keine Ausnahme wert: der Testwert in `portal-auth.test.ts` ist beliebig und ist jetzt **geändert** statt ausgenommen.                                                                                                                                                                                                                                                                                                                    | gemessen mit gitleaks 8.24.3, beide Richtungen                                 | Betrieb        | behoben                |
| OP-234 | **Zwei kritische Advisories gegen die ausgelieferte Next-Version, dazu eines mit hoher Schwere in `sharp`.** `GHSA-p293-qw3h-jr36` (unauthentifizierte RCE auf Windows-Hosts) und `GHSA-2xp9-vwfh-vxw4` (unauthentifizierte RCE in der Bildoptimierung bei AVIF) betreffen `… \|\| 15.6.0-canary.0 - 16.3.2`; wir fahren **16.2.11**. Behoben ab **16.3.3**, verfügbar ist 16.3.4. `sharp` < 0.35.4 (`GHSA-rgj7-g3m4-5g8c`); installiert ist 0.35.3, gepinnt über `overrides` in der Wurzel. **Behoben 2026-09-09:** Next 16.3.4, sharp 0.35.4, `audit-gate.mjs` Exit 0 — Messung und der Rest des Baums im Nachtrag 2026-09-09 zu OP-234. | `scripts/audit-gate.mjs`, Exit 1 → **Exit 0** (2026-09-09)                     | **Sicherheit** | **behoben 2026-09-09** |

**Der Beleg für OP-167 lag im Protokoll dieses PR.** Der E2E-Job baut die
Anwendung in CI, und sein Log zeigt `✓ Compiled successfully in 90s`,
TypeScript beendet, `Collecting page data` erreicht — **ohne** den Absturz auf
`/_global-error`. CI setzt `NODE_ENV` nicht. Gescheitert ist der Job an etwas
anderem: der Laufzeit-Wächter aus #SEC-F01 verweigerte einen Pool, der als
`grc` (SUPERUSER, BYPASSRLS) verbindet, weil `APP_DATABASE_URL` fehlte. Der
Wächter hatte recht; der Job hatte die Rolle nie. Beides ist behoben — und der
E2E-Lauf prüft jetzt den Pfad, der RLS tatsächlich durchsetzt.

**Neu und in CI eingehängt:** `scripts/check-workflow-script-deps.mjs`. Für
jeden Job wird geprüft, ob er Abhängigkeiten installiert, und wenn nicht, ob
die von ihm aufgerufenen Skripte aus `scripts/` ohne Pakete auskommen. Der
erste scharfe Lauf fand OP-228 — eine Fundstelle, nach der niemand gesucht
hatte.

### Nachtrag 2026-09-09 — Welle 8e: OP-080 geschlossen, und wieder eine Begründung, die zu weit reichte

Einzelheiten in `docs/UMSETZUNG-WELLE-8E.md`, Entscheidung in
`docs/ADR-028-tanstack-table-und-react-compiler.md`.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Beleg                                                                             | Art          | Stand   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------ | ------- |
| OP-080 | **Die letzte der acht Compiler-Regeln stand global auf `off`.** Ihre Begründung war wahr — `@tanstack/react-table` gibt Funktionen zurück, die der React Compiler nicht memoisieren kann, und die Meldung ist ausdrücklich eine Mitteilung („Compilation Skipped"), kein Defekt. Nur galt sie für **2.298 Dateien**, obwohl sie über **zwei** etwas aussagte: eine dritte `useReactTable`-Stelle wäre stillschweigend dazugekommen, gedeckt von einer Begründung, die sie nie gemeint hat. Die Regel steht jetzt auf `error`, `off` gilt namentlich für die zwei bekannten Dateien. | Dritte Aufrufstelle eingesetzt: `✖ 1 problem (1 error)`, Exit 1; entfernt: Exit 0 | Codequalität | behoben |

**Das ist die vierte Fundstelle derselben Form** in dieser Remediation: eine
wahre Begründung, die mehr abdeckt als das, was sie begründet. Vorher waren
es die `no-console`-Ausnahmeliste (erlaubte genau die vier Level, auf denen
man Fehlerobjekte ausgibt — 23 gezählt, 88 vorhanden), `allowThrow: true` mit
fachlich korrekter Beschreibung daneben, und „Playwright braucht den
Production-Build", das vier Punkte blockierte und nie zutraf.

**Alle acht Regeln aus `eslint-plugin-react-hooks@7` sind damit wirksam** —
sieben ohne Ausnahme, eine mit einer bezifferten und begründeten. Von den
notierten 59 Fundstellen waren 76 vorhanden; ungedeckelt ist keine mehr.

### Nachtrag 2026-09-09 — Welle 8d: die Zahl unter der Achse, und ein Datum, das der Empfänger falsch lesen musste

Einzelheiten in `docs/UMSETZUNG-WELLE-8D.md`.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                           | Beleg                                                            | Art               | Stand     |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------- | --------- |
| OP-222 | **`formatCompactEUR` lag als byteweise identische Kopie in vier FAIR-Seiten — und hatte zwei Fehler, von denen nur einer das Gebietsschema war.** Sie rundete auf ganze Tausender: **999.999 wurde zu „1000k"**, direkt unter einem Tick, der „1.0M" heißt; 12.500 wurde zu „13k". Das ist in jeder Sprache falsch. Dazu war der Dezimaltrenner fest der englische Punkt, während die Oberfläche daneben deutsch formatierte. | `alt(999_999) === "1000k"`, im Test als Gegenprobe mitgeführt    | Produktdefekt     | behoben   |
| OP-223 | **Der Wachposten gegen fest verdrahtete Gebietsschemata kannte nur die halbe Form.** `toLocaleString("de-DE")` fiel auf, `new Intl.NumberFormat("de-DE")` nicht — dieselbe Wirkung, anderer Aufruf. Genau darüber sind die 20 Geldbeträge aus OP-203 durchgerutscht. Die Regel deckt jetzt beide Formen, an allen drei Fundstellen derselben Prüfung.                                                                         | Gegenprobe: alte Regel 0 Treffer, neue 1 Treffer, Test rot       | Testlücke         | behoben   |
| OP-224 | **Benachrichtigungstexte werden beim Schreiben festgelegt, der Empfänger steht erst beim Lesen fest.** `title` und `message` sind fertige Zeichenketten in der Datenbank; jeder Empfänger kann eine andere Sprache haben. Der Betreff der E-Mail wird über `templateKey` zweisprachig aufgelöst, der Meldungstext nicht. Sprachrichtig wird das erst, wenn die Meldung je Empfänger aus `templateData` gerendert wird.        | `packages/email/src/template-registry.ts` löst nur `subject` auf | fehlende Funktion | **offen** |

**Der Fund mit der unmittelbarsten Wirkung ist ein Datum.** In
`api/v1/policies/distributions/[id]/activate/route.ts` stand ein **englischer
Satz mit einem deutsch formatierten Datum**: `Please read and acknowledge by
01.12.2026.` Für den englischen Empfänger ist die gepunktete Form nicht nur
fremd, sie ist **mehrdeutig** — `01.12.` liest sich als 12. Januar. Bei einer
Fristmitteilung darf sich der Empfänger in der Frist nicht irren können. Da an
dieser Stelle kein Gebietsschema existiert (siehe OP-224), steht dort jetzt
ISO 8601: in beiden Sprachen eindeutig, in keiner falsch.

**OP-203 ist damit fertig beziffert.** Von den 18 benannten Fundstellen ist auf
den Bildschirmpfaden **keine** mehr übrig — unter der erweiterten Regel aus
OP-223 gemessen: 0 in `app/(dashboard)`, `app/(portal)` und `components`. Was
bleibt, sind **26 Fundstellen in 12 Exportdateien**, und dort ist die
Umstellung keine Formatierungsfrage: die Dokumente sind durchgehend deutsch
geschrieben („Erstellt am", „Organisation", „Stand"). Ein englisch
formatiertes Datum in einem deutschen Bericht macht ihn nicht richtiger,
sondern uneinheitlich — dasselbe Argument, mit dem Welle 5a ihre
Teiländerung an `admin/rls-audit` zurückgenommen hat: ganz oder gar nicht.
Die Liste steht jetzt als Zahl je Datei in
`wave8d-compact-currency.test.ts` §2 und fällt, sobald sie wächst.

### Nachtrag 2026-09-09 — Nachtrag zum Nachtrag: zwei Nummern waren doppelt vergeben

**Eigener Fehler, fünfte Instanz.** Ich habe den Nachtrag zu Welle 8b/8c
geschrieben, ohne nachzusehen, **welche Nummern Welle 8b bereits vergeben
hatte**. `docs/UMSETZUNG-WELLE-8B.md` §6 führt seit dem Schreiben OP-218 und
OP-219, und beide Nummern stehen so im Code
(`hooks/use-module-config.tsx`, `components/module/module-teaser.tsx`,
`__tests__/components/wave8b-module-teaser.test.tsx`). Ich habe dieselben
zwei Nummern im Register an zwei **andere** Punkte vergeben. Zwei Nummern,
zwei Bedeutungen, und der Code sagte etwas anderes als das Register.

Dieselbe Klasse wie die vier davor: ein vorhandenes Artefakt nicht gelesen
und trotzdem darüber geschrieben. Aufgefallen ist es erst beim Nachsehen für
die nächste Welle, an einem Kommentar im Quelltext.

**Aufgelöst zugunsten des Älteren:** Welle 8b behält OP-218 und OP-219 —
sie stehen im Code, und ein Kommentar, den jemand liest, wiegt schwerer als
eine Zeile, die ich gerade erst geschrieben habe. Meine zwei Punkte heißen
jetzt **OP-225** (Schlüsselverlust im Katalog) und **OP-226** (zweite
`EU_EEA_COUNTRIES`). Die beiden Punkte aus Welle 8b sind hier nachgetragen —
sie fehlten im Register ganz, was der eigentliche Grund für die Kollision
war: eine Nummer, die nur im Protokoll und im Code steht, ist für den
nächsten Schreiber unsichtbar.

**Der Check dazu:** `scripts/check-op-numbers.mjs` prüft, dass keine Nummer
zweimal in derselben Tabelle steht und dass keine Nummer im Repository
verwiesen wird, die das Register nicht kennt — die zweite Prüfung hätte
genau diesen Fehler gefunden. Als Schritt im `lint`-Job von `ci.yml`
eingehängt, das Register als elfte Gate-Eingabe registriert. Beide
Richtungen gegengeprüft; Einzelheiten in `docs/UMSETZUNG-WELLE-8F.md`.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Beleg                                    | Art           | Stand   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------- | ------- |
| OP-218 | **Auf jeder Modulseite blitzte beim Laden der Teaser mit dem rohen Modulschlüssel auf.** `orgId` kommt aus `useSession()` und ist in **zwei** völlig verschiedenen Lagen `null`: „die Sitzung ist noch nicht da" und „die Sitzung ist da und hat keine Organisation". `ModuleConfigProvider` behandelte beide gleich und meldete `loading: false` mit leerer Liste — für jedes `ModuleGate` ist das `status: "disabled"`, also der Teaser. Dazu eine Konsolenwarnung an den Betreiber über eine fehlende `module_definition`-Zeile, die es gab. Behoben durch ein `sessionLoading`-Flag, das die zwei Lagen unterscheidet, statt sie zusammenzuwerfen — die naheliegende Behebung („bei `orgId === null` in `loading` bleiben") hätte ein Konto ohne Mitgliedschaft in einen Dauerladekreis geschickt. | `docs/UMSETZUNG-WELLE-8B.md` §6          | Produktdefekt | behoben |
| OP-219 | **Der 21. stumme Zweig, und er saß im Teaser selbst.** `if (res.ok) { refetch(); }` ohne `else`, dazu ein `catch`, der den Fehler ausdrücklich verwarf („handled silently; admin page has full error handling"). Ein Administrator drückte „Modul aktivieren", die Antwort war 403 oder 409, und die Seite blieb unverändert stehen — kein Hinweis, keine Spur. Der Kommentar beschrieb den Mangel und wurde als Konfiguration gelesen: dieselbe Mechanik wie `allowThrow: true` aus Welle 4b-7.                                                                                                                                                                                                                                                                                                       | `components/module/module-teaser.tsx:52` | Produktdefekt | behoben |

### Nachtrag 2026-09-09 — Welle 8b/8c: ein Check, den es nicht gab, und ein Fehler, den ich selbst gemacht habe

Einzelheiten in `docs/UMSETZUNG-WELLE-8B.md` und `docs/UMSETZUNG-WELLE-8C.md`.

Sprachlich: Ab hier stehen die englischen Fachbegriffe, die im deutschen
Entwickleralltag ohnehin benutzt werden — Gate, Check, Ratchet, Barrel,
Commit, Build, Lint. Die früheren Protokolle haben dafür deutsche Wörter
erfunden („Tor", „Ratsche", „Fehlerwickel"), die niemand liest und niemand
sucht. Das war ein Fehler; die alten Dateien tragen ihn noch.

**Welle 8b** hat OP-202 abgeschlossen (11 Seiten mit Scheinbindung
umgestellt) und dabei etwas an sich selbst gefunden, das schwerer wiegt als
die Welle:

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Beleg                                                                              | Art       | Stand   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------- | ------- |
| OP-225 | **Ein verschwundener Übersetzungsschlüssel war die einzige Änderung am Katalog, die kein Check sehen konnte.** Beim Einpflegen wurden 24 vorhandene `esgAdvanced.materiality.*`-Schlüssel in **beiden** Sprachen überschrieben. `audit-i18n-coverage.mjs` vergleicht DE gegen EN — eine symmetrische Löschung lässt beide Seiten deckungsgleich und ist dort per Konstruktion unsichtbar. `audit-i18n-usage.mjs --max-unused` zählt Schlüssel ohne Aufrufstelle; verschwindet ein unbenutzter, **sinkt** die Zahl und der Check wird grüner. Zugleich ist es die Änderung, die der Nutzer sofort sieht: die Seite zeigt den rohen Schlüssel. | Gegenprobe an einer symmetrischen Löschung: alter Check Exit 0, neuer Check Exit 1 | Testlücke | behoben |

Behoben mit `scripts/i18n-key-inventory.mjs` und `.i18n-keys-ratchet.json`
(80 Namespaces, 19.994 Schlüssel DE+EN): Der Bestand je Namespace und Sprache
darf wachsen, nicht sinken. Eine Absenkung ist nicht verboten, sondern
begründungspflichtig — `--update --reason "…"` schreibt den Grund nach
`_history`. Als Schritt in `.github/workflows/i18n-coverage.yml` und als
Gate-Eingabe in `scripts/check-gate-inputs.mjs` registriert; letzteres ist
gegengeprüft, es meldete die noch nicht eingecheckte Datei sofort.

**Welle 8c** hat OP-201 geschlossen — und dabei denselben Defekt neu erzeugt,
den sie beseitigen sollte.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Beleg                                               | Art           | Stand                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------ |
| OP-201 | Dritte `ADEQUACY_COUNTRIES`-Liste in `apps/web/src/app/api/v1/tprm/sub-processors/route.ts`, ohne `US` — die Liste vor dem EU-US Data Privacy Framework vom 10.07.2023. Ein US-Subprozessor wurde damit als Drittland ohne Angemessenheitsbeschluss bewertet.                                                                                                                                                                                                                                                                                                                                                                                                       | Route importiert jetzt aus `@grc/shared`            | Produktdefekt | behoben                                                                              |
| OP-226 | **Beim Zusammenführen ist eine zweite `EU_EEA_COUNTRIES` entstanden.** Die EU/EWR-Liste der Route wurde nach `dpms-tia.ts` gezogen, ohne zu prüfen, ob es den Namen im Paket schon gibt — es gab ihn, als Array in `types/eam-advanced.ts`, seit `e40ab5a5` und ohne einen einzigen Verwender. Damit war exakt der Zustand wiederhergestellt, den Welle 6a beseitigt hatte: der namentliche Export in `index.ts` verdeckt den gleichnamigen Stern-Export aus `types.ts`, und was aus `@grc/shared` herauskommt, ist nicht die Liste, die man in der Datei liest. Die Zusicherung aus Welle 6a hat es nicht gesehen, weil sie **einen Namen fest verdrahtet** hatte. | 30 Codes, inhaltlich deckungsgleich; null Verwender | Codequalität  | behoben                                                                              |
| OP-220 | `scripts/audit-i18n-coverage.mjs` schreibt rohes Markdown in eine **eingecheckte** Datei (`docs/i18n-coverage-report.md`), die unter den Format-Schritt aus `ci.yml` fällt. Der Generator schreibt `\|---\|`, prettier `\| --- \|`. Wer den Report neu erzeugte und committete, machte das Format-Gate rot, ohne dass irgendetwas darauf hinwies. `audit-dead-exports.mjs` und `audit-secrets.mjs` lösen das seit OP-074 dadurch, dass der Generator selbst formatiert; dieser hier zog nicht nach.                                                                                                                                                                 | gemessen am 2026-09-09 an genau diesem Weg          | Codequalität  | behoben                                                                              |
| OP-221 | **`npm run lint` ist auf diesem Branch rot und war es immer.** `turbo lint` bricht bei jedem ESLint-Error ab; im Root-Scope stehen 44 eingefrorene Altbefunde. CI prüft einen anderen Weg: `npx eslint .` nur in `apps/web` (0 Befunde) plus `scripts/lint-ratchet.mjs`. Beides ist grün, das dokumentierte Kommando nicht. Wer `npm run lint` ruft, sieht einen Fehlschlag, der nichts über seine Änderung aussagt.                                                                                                                                                                                                                                                | `Failed: @grc/email#lint, @grc/auth#lint, …`        | Doku          | **behoben 2026-09-09** (Welle 8o) — Entscheidung des Eigentümers: Ratsche eingehängt |

**Was OP-226 aufgedeckt hat, ist nicht die Kopie, sondern der Weg dorthin.**
Aufgefallen ist sie nicht an einer Zusicherung, sondern am Dead-Exports-Ratchet
— und dort als angebliche **Verbesserung**: `eam-advanced.ts: 28 < Baseline 29`.
Der tote Export war nicht verschwunden; er war durch den neuen Import in der
TPRM-Route nur namentlich erreichbar geworden, und der Detektor löst über den
Namen auf und traf die falsche Datei. Ein Gate, das grün meldet, was ein Defekt
ist. Die Zusicherung in `packages/shared/tests/dpms-tia-retention.test.ts` zählt
jetzt beide Namen über eine Liste statt eines verdrahteten Bezeichners und prüft
zusätzlich, dass der namentliche Export im Barrel auf die Heimatdatei zeigt.
Beide Richtungen gemessen: rot bei wiedereingeführter Kopie, rot bei entferntem
Barrel-Export, grün sonst.

**Eigener Fehler, vierte Instanz derselben Klasse.** Die Gegenprobe zur
Barrel-Zusicherung meldete zunächst „25 passed" — der Test war also
angeblich nicht scharf. Er war es; die Probe war kaputt. Die Kette lautete
`sed … && grep -c "EU_EEA_COUNTRIES" … && npx vitest …`, und `grep -c` endet
bei **null Treffern** mit Status 1. Die Kette brach vor `vitest` ab; die
Ausgabe „25 passed" stammte vom nachfolgenden Wiederherstellungslauf. Ich
hatte die Abwesenheit einer Fehlermeldung als Ergebnis gelesen — dieselbe
Klasse wie `✓ Compiled successfully` als Beweis für einen behobenen Absturz,
wie das grüne Coverage-Gate gegen eine veraltete Datei und wie der
Secret-Scan-Report, der vor der zu findenden Zeile erzeugt wurde. **Regel
daraus:** eine Gegenprobe zählt nur, wenn der Fehlschlag selbst im Protokoll
steht — nicht die Abwesenheit eines Erfolgs.

**Gemessener Gesamtstand nach 8b/8c** (voller Durchlauf am 2026-09-09, frische
Datenbank von null): 429/429 Migrationen, 617 Tabellen, DB-Integrität ohne
Regression gegen die Baseline, **7.813 Tests grün in 13 von 13 Tasks**, 13
Typechecks ohne Befund, Format über das ganze Repository grün, Lint-Ratchet
44 (von 45, `no-useless-escape` vollständig behoben), Dead-Exports-Ratchet
2.468, Secret-Scan 0 Befunde, alle vier i18n-Checks grün.

### Nachtrag 2026-09-09 — Welle 8a: das Regressionsprojekt ist vollständig gemessen

Einzelheiten in `docs/UMSETZUNG-WELLE-8A.md`.

**62 von 62 Tests gemessen, 62 grün, 0 rot, 0 ungemessen** (Welle 6c: 26
gemessen, 36 ungemessen). Ehrlich dazu: Das ist eine **Summe über zwölf
Abschnitte**, kein Durchlauf am Stück. Vier Abschnitte sind unter Last
abgebrochen und wurden einzeln nachgemessen — alle grün.

**Der bekannte rote Test war zweierlei.** `n-01` galt seit Welle 7a als „rot,
aber kein Rückschritt". Beides stimmte, und beides war zu wenig:

1. **Ein Testfehler.** Der Test las den Seiteninhalt **einmal**, nach
   `waitForLoadState("networkidle")` mit `.catch()`. Der Beleg steckt in der
   empfangenen Zeichenkette: `"A / U / Organisation / U / © 2026 ARCTOS"` — das
   ist der erste Frame, **bevor** die Sitzung geladen ist. Dieselbe Zeile stand
   in **sieben** Spezifikationen. Die Erwartung ist unverändert; nur das Lesen
   wiederholt jetzt.
2. **Ein Produktdefekt auf derselben Seite**, den der Test wegen (1) nie
   erreichen konnte.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Beleg                                                                    | Art     | Stand   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------- | ------- |
| OP-216 | **„Verknüpfte Kontrollen" auf `/risks/[id]` war strukturell immer leer.** Die Seite rief `GET /api/v1/controls?riskId=…` — diese Route führt seit `#WAVE6-CROSS-01` eine strikte Parameter-Erlaubnisliste und antwortet auf jeden unbekannten Parameter mit **422**. Der Zweig `if (clRes?.ok)` war damit nie wahr, und es gab **kein `else`**: Die Karte meldete immer „Keine Kontrollen verknüpft", auch wenn `risk_control` Zeilen hatte. Dieselbe Welle hatte mit `GET /api/v1/risks/:id/controls` den richtigen Endpunkt bereits angelegt — nur die Aufrufstelle blieb stehen. | `422 {"fieldErrors":{"riskId":["is not a recognized query parameter"]}}` | Produkt | behoben |
| OP-217 | **Dasselbe in der Gegenrichtung.** Der Reiter „RCM" auf `/controls/[id]` rief `GET /api/v1/controls/<uuid>/rcm` — dieses Segment existiert nicht, **404**, ebenfalls ohne `else`. Richtig ist `GET /api/v1/controls/:id/risks`.                                                                                                                                                                                                                                                                                                                                                     | `404 GET /api/v1/controls/<uuid>/rcm`                                    | Produkt | behoben |

Beide tragen dieselbe Signatur: **`if (res.ok)` ohne `else`**. Das sind das
**siebzehnte und achtzehnte** wirkungslose Kontrolle dieses Audits — und die
ersten beiden, die nicht in einem Prüfwerkzeug sitzen, sondern **im Produkt
selbst**. Die neuen Prüfungen sagen deshalb nicht „die Seite liefert 200",
sondern: die Seite setzt **keinen abgelehnten API-Aufruf** ab.

**Vier Prüfungen waren seit Welle 6b unerfüllbar** — englische Zeichenketten
gegen eine inzwischen übersetzte Oberfläche, dazu ein `/^Pruefen$/` gegen
„Prüfen". Rot geworden sind sie nie, weil das Projekt ungemessen war. Ein
Testbestand, den niemand ausführt, altert unbemerkt.

**Nicht behoben, benannt:** `GET /api/v1/findings/<uuid>/status-history` gibt
404 — Route und Tabelle existieren nicht; das wäre ein neues Merkmal, keine
Reparatur. Und jede Modulseite zeigt beim Laden kurz den rohen
Übersetzungsschlüssel des Modul-Teasers; die Behebung ändert die Prüfung vor
jeder Modulseite und braucht eine eigene Welle.

**Zwei Fallstricke fürs Protokoll:** Ein `kill -9` auf den Next-Server mitten
im Schreiben beschädigt `.next` — danach `GET /api/auth/session 404` und alle
vier Anmeldungen rot, was wie ein kaputtes Anmeldeverfahren aussieht und keines
ist. Und `pkill -f playwright` bringt die eigene Shell um, sobald deren
Kommandozeile das Muster enthält — auch dann, wenn sie das Skript nur per
Heredoc **schreibt**.

### Nachtrag 2026-09-08 — Welle 7b: `set-state-in-effect` ist an, und die Sortierung war falsch

Einzelheiten in `docs/UMSETZUNG-WELLE-7B.md`. **20 → 0 Fundstellen, 2.294
Dateien, kein einziges `eslint-disable`.** Die Ratsche misst `apps/web` mit
0 bei Baseline 0 — **mit** eingeschalteter Regel. Damit sind **sieben von acht**
Hook-Regeln an; übrig bleibt nur `incompatible-library` (2× `useReactTable`),
von hier aus ohne Bibliothekswechsel nicht behebbar.

**Der methodisch wichtigste Teil: die Sortierung aus Welle 7a war falsch.**
7a hatte recht, dass die alte Begründung („alle sind Abruf beim Einhängen,
react-query löst es") nur auf 9 von 20 zutrifft — aber ihre Aufteilung der
übrigen elf stimmte nicht. Es sind **sieben** Gestalten, nicht vier, und die
Gruppe „Browserspeicher" war um **drei** Fundstellen zu gross:

| Gestalt                           |  7a | gemessen | Auflösung               |
| --------------------------------- | --: | -------: | ----------------------- |
| A Abruf beim Einhängen            |   9 |        9 | `@tanstack/react-query` |
| B Formular-Reset                  |   4 |        4 | Einhängen statt Effekt  |
| C Browserspeicher                 |   5 |    **2** | `useSyncExternalStore`  |
| C′ gespiegelter **Server**zustand |   — |    **2** | beim Rendern ableiten   |
| D Anhydrier-Wachtposten           |   2 |    **1** | `useSyncExternalStore`  |
| D′ Eigenschaftsübergang           |   — |    **1** | Anpassung beim Rendern  |
| E abgeleiteter Anzeigezustand     |   — |    **1** | beim Rendern ableiten   |

`use-nav-preferences.tsx` liest **keinen** Browserspeicher, es spiegelt ein
react-query-Ergebnis. Hätte man Gestalt C geschlossen auf
`useSyncExternalStore` umgestellt, wären zwei Fundstellen **falsch** behoben
worden — **und der schwerste Defekt dieser Welle wäre stehen geblieben.**

| OP     | Was                                                                                                                                                                                                                                                                  | Art     | Stand   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- |
| OP-212 | **Die Navigationsgruppe der aufgerufenen Seite fiel wieder zu.** Die Seitenleiste meldet die Gruppe des Pfads beim ersten Rendern; der Effekt setzte danach den _gespeicherten_ Stand und gewann. Spur des alten Standes: `erm=offen isms=zu` → `erm=zu isms=offen`. | Produkt | behoben |
| OP-213 | **Ein unbekannter Wert im Browserspeicher wurde zum Layoutnamen.** `as LayoutMode` war eine Behauptung; `"compact"` wurde übernommen, und keine Ansicht traf zu.                                                                                                     | Produkt | behoben |
| OP-214 | **Gesperrter Browserspeicher legte den Anbieter lahm** — ungeschützter Zugriff im Effekt. `use-tab-navigation.tsx` hatte für denselben Zugriff seit jeher ein `try/catch`.                                                                                           | Produkt | behoben |
| OP-215 | **Die Dokumentensuche zeigte die Treffer der vorletzten Eingabe.** Ohne Ordnung zwischen zwei Anfragen gewann die zuletzt eintreffende, nicht die jüngste.                                                                                                           | Produkt | behoben |

**Drei Prüfungen konnten zunächst nicht fallen — und das war der Fund.**
Prüfung 1 wartete auf `loading === false` und war gegen den alten Stand
**grün**: Sie las zwei Festschreibungen _vor_ dem Defekt. Ohne den zweiten
Blick wäre OP-212 als „nicht vorhanden" gebucht worden.

**Und eine ehrliche Fehlanzeige.** Für Gestalt B haben zwei Messgeräte nichts
gesehen (`seen=[]`, `written=[]`): ein `useLayoutEffect`-Zeuge, der an den
fraglichen Festschreibungen nicht teilnahm, und ein Aufzeichner am
Prototyp-Setzer, den React auf dem Element verdeckt. Ergebnis: Radix hängt
`DialogContent` eine Festschreibung nach `open` ein, der Rückstelleffekt lief
vorher — **es gibt dort keinen sichtbaren Defekt.** Statt einer Prüfung steht
deshalb eine Begründung in der Datei. Das ist die richtige Antwort: Nichts
behaupten, was sich nicht messen lässt.

**Was mit Begründung bleibt:** `incompatible-library` (2, gehört in einen ADR)
und `sidebar.tsx:272`, das `setActiveGroup` beim Rendern in den Anbieter ruft
— nicht behoben, weil der offensichtliche Weg (ab in einen `useEffect`) eine
**neue** Fundstelle genau dieser Regel erzeugt hätte. Der davon verursachte
Defekt ist behoben; die Warnung braucht eine Welle mit `sidebar.tsx` als
Gegenstand.

### Nachtrag 2026-09-08 — Welle 7a: OP-080, die Regeln sind an

Einzelheiten in `docs/UMSETZUNG-WELLE-7A.md`. Die Begründung für den Aufschub
lautete wörtlich, eine Umstellung sei „eine Verhaltensänderung in 18/19 Seiten,
die dieses Paket ohne die E2E-Suite nicht verifizieren kann" — seit OP-204 ist
sie hinfällig, und die Verhaltensänderungen sind genau so verifiziert worden,
wie es die Begründung verlangt hat.

**Und wieder stimmten die Registerzahlen nicht.** „23 bzw. 36" sind gemessen
**37 bzw. 39**; vier der acht Einzelzahlen waren zu niedrig.

| Regel                         | notiert | gemessen | nachher |            |
| ----------------------------- | ------: | -------: | ------: | ---------- |
| `exhaustive-deps`             |      23 |   **37** |   **0** | an         |
| `purity`                      |       8 |        8 |   **0** | an         |
| `static-components`           |       3 |        3 |   **0** | an         |
| `immutability`                |       2 |    **3** |   **0** | an         |
| `preserve-manual-memoization` |       1 |        1 |   **0** | an         |
| `refs`                        |       1 |    **2** |   **0** | an         |
| `set-state-in-effect`         |      19 |   **20** |      20 | bleibt aus |
| `incompatible-library`        |       2 |        2 |       2 | bleibt aus |

**Sechs von acht Regeln sind an, ohne ein einziges `eslint-disable`.**

**Produktdefekte:**

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                      | Art     | Stand   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- |
| OP-209 | **Der Schlagwortfilter der Suche erreichte die Anfrage nie.** `handleSearch` war mit `[query, scope]` gemerkt, las aber `tagFilter`. Folge: Suchbegriff tippen, dann Schlagwort setzen → die Anfrage geht **ohne `tags`** hinaus; bei leerer Suchzeile tut die Suche **gar nichts**.                                                                                                     | Produkt | behoben |
| OP-210 | **Ein offener Reiter wurde nie aktualisiert** (`openTab` gab `prev` zurück). Die Beschriftung blieb nach einem Sprachwechsel deutsch — und wanderte falschsprachig in den Sitzungsspeicher; nach dem Umbenennen eines Assets blieb der alte Name stehen. Der Defekt hatte **zwei Hälften**: die fehlende Abhängigkeit _und_ `openTab` selbst — die Regel allein hätte ihn nicht behoben. | Produkt | behoben |
| OP-211 | **Die Reiterleiste zeigte nie die Seite, mit der sie geöffnet wurde.** Der Provider setzte `setTabs(hydrated)` mit festem Wert; Kindeffekte laufen vor Elterneffekten, also warf er die Anmeldung der Seite weg. Gemessen bei leerem Speicher: `tabs.length` 0 (alt) gegen 1 (neu). Aufgefallen ist er nur, **weil eine andere Prüfung zunächst nicht fallen konnte**.                   | Produkt | behoben |

Dazu 14 Fundstellen, die übersetzten Text einfroren (BPMN-Einblendungsnamen,
`aria-label` der Zeichenfläche, Datums- und Zahlenspalten in vier Tabellen —
dieselbe Klasse wie OP-202/203), und drei Verweise, die **beim Rendern**
geschrieben wurden und damit auch aus verworfenen Rendervorgängen wirken.

**Zwei Regeln verdeckten einander**, in beide Richtungen gemessen:
`immutability` brach die Compilation von `catalogs/objects` und `field.tsx` ab,
sodass `set-state-in-effect` beziehungsweise `refs` dort **nie gemeldet**
wurden. Eine abgeschaltete Regel kann also nicht nur selbst schweigen, sondern
eine andere mit zum Schweigen bringen.

**Was mit Begründung aus bleibt.** `set-state-in-effect` (20): Die alte
Begründung („alle sind Abruf beim Einhängen, react-query löst es") trifft auf
**9 von 20** zu. Es sind vier verschiedene Gestalten — Abruf (9),
Formular-Reset (4), Browserspeicher (5), Übergangszustand (2) —, und sie
verlangen eine eigene Welle mit eigenem Vorher-/Nachher-Lauf.
`incompatible-library` (2): beide `useReactTable`, eine Mitteilung über eine
fremde Bibliothek, von hier aus ohne Bibliothekswechsel nicht behebbar.

**Nachgezogen bei der Abnahme:** Die Umstellung auf eine Modulkomponente liess
`getWidgetRenderer` ohne Aufrufer zurück — nur noch von einem Sammelexport
geführt, den niemand importiert. Das Dead-Exports-Tor hat das gemeldet; es
fordert wörtlich „Entfernen, nicht in die Ratsche aufnehmen", also ist die
Funktion entfallen und die Ratsche steht unverändert.

### Nachtrag 2026-09-08 — Welle 6c: OP-027 geschlossen, und die Blockade, die es nie gab

Einzelheiten in `docs/UMSETZUNG-WELLE-6C.md`.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Beleg                     | Art                      | Stand   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------ | ------- |
| OP-204 | **Der Playwright-Lauf war nie durch OP-167 blockiert.** `playwright.config.ts` startet ausserhalb von CI `npm run dev`, nicht `next start`. Gemessen: Dev-Server `✓ Ready in 1667ms`, danach vier Anmeldungen und 135 Web- plus 26 Regressionstests gegen denselben Server. Die Begründung „ohne Produktionsbau nicht möglich" hat **vier Punkte lahmgelegt** (OP-027, OP-036, OP-080 und den Lauf selbst) und war nie nachgeprüft.                                                                      | Eigene Messung 2026-09-08 | Tor                      | behoben |
| OP-205 | **Die eigene BPMN-Engine zeichnete jede Form neben ihre eigene Klickfläche.** `g.djs-visual` bei `439,761` gegen `rect.djs-hit` bei `260,602` — Differenz **179/159**, exakt die Modellkoordinaten von `StartEvent_1`. Ursache: doppelte Verschiebung (der Renderer zeichnet absolut, `diagram-js` verschiebt die Gruppe zusätzlich). Folge: Ein Klick auf das sichtbare Element traf leere Fläche, es gab keine Auswahl, kein Kontextmenü — und damit **keinen Weg, auf dieser Fläche zu modellieren**. | Eigene Messung 2026-09-08 | Produkt                  | behoben |
| OP-206 | **Tastaturbedienung der Fläche im Browser wirkungslos.** Die Zuhörer sassen auf `.djs-container`, der Tabstopp auf dessen Elternknoten; `keydown` steigt auf, nicht ab. Beleg: Statusansage „Ziel 1 von 1: Aufgabe Task_1", `Enter` → **0 Kanten**; dasselbe Ereignis synthetisch an `.djs-container` → 1 Kante. Die Einheitstests schicken genau dorthin.                                                                                                                                               | Eigene Messung 2026-09-08 | Produkt/Barrierefreiheit | behoben |
| OP-207 | **Gezeichnetes liess sich nicht speichern.** `onChanged` wird durchgereicht, aber von `ArctosBpmnCanvas` nie ausgelesen — `hasChanges` bleibt `false`, `Save` dauerhaft `disabled`.                                                                                                                                                                                                                                                                                                                      | Eigene Messung 2026-09-08 | Produkt                  | behoben |
| OP-208 | **Der Demo-Seed war auf einer Datenbank von Null dreifach tot.** `fix_soa_annex_a.sql` lief vor `seed_demo_00_platform.sql`, also bevor es die Organisation gab → FK-Verletzung → Rollback der ganzen Datei, und `seed_demo_01_assets_isms` sowie `seed_demo_15_cve` fielen mit. `3 of 56 seed file(s) failed` → nach dem Verschieben **56/56 ok**, `soa_entry` 0 → 101, `cve_asset_match` 0 → 54.                                                                                                       | Eigene Messung 2026-09-08 | Produkt                  | behoben |

**OP-204 ist das vierzehnte Tor dieses Audits, das nicht auslösen konnte** —
und die unangenehmste Bauart bisher: keine falsch-grüne Prüfung, sondern eine
**Begründung**, die vier Punkte stilllegte und die niemand nachgemessen hat.
Ehrlich dazu gehört: `next dev` prerendert nicht, kann OP-167 also weder
finden noch widerlegen, und taugt nicht als Messumgebung — OP-036 hängt
weiterhin am Produktionsbau, OP-167 blockiert weiterhin das **Deployment**.
Aber eben nur das.

**OP-205 ist das fünfzehnte blinde Tor, und das lehrreichste.** Keiner der 40
Formtests konnte den Fehler sehen, weil `test/draw/helpers/render.ts` jede
Form mit `x: overrides.x ?? 0, y: overrides.y ?? 0` anlegt — **bei (0,0) ist
die doppelte Verschiebung die Identität**. Das gesamte Formtestwerk war gegen
genau diesen Defekt blind. Die Behebung bleibt entsprechend klein: Der
Renderer bleibt absolut (der statische Weg, die Prüfbilder und die vierzig
Tests hängen daran), nur der `diagram-js`-Weg schiebt die Gruppe um `(-x, -y)`
zurück.

**OP-027 ist geschlossen.** `apps/web/e2e/bpmn-canvas-modeling.spec.ts`, zwei
Tests als `process_owner`: eine Aufgabe aus dem Vorrat setzen, über das
Kontextmenü mit dem Startereignis verbinden, speichern — und die **im DOM
gelesenen** Bezeichner im zurückgelesenen XML wiederfinden, mit
`sourceRef`/`targetRef` und als abgeleiteter `process_step`. Dass die
schwächere Fassung nicht genügt hätte, ist gemessen: Die erste Version
speicherte `sourceRef="Activity_…" targetRef="Activity_…"` — eine Schleife auf
sich selbst, die ein „es gibt eine Kante" bestanden hätte.

**Zählung, ehrlich:** `web` **135/135 grün** in 22 Spezifikationen plus vier
Anmeldungen, kein `skip`. Vom `regression`-Projekt sind **26 von 62 gemessen,
alle grün; 36 Tests in 22 Spezifikationen sind ungemessen — nicht rot.** Der
Gegner war die Maschine: `next-server` wächst auf 5,2 GB, danach Lastmittel 22
bei 99 % Systemzeit. Sechs Ausfälle im Abschnittslauf waren maschinenbedingt
und isoliert alle grün.

**Was das für OP-080 heisst:** Die Begründung „ohne E2E nicht verifizierbar"
ist entfallen. Der Punkt ist damit nicht erledigt, aber nicht mehr blockiert.

### Nachtrag 2026-09-07 — Welle 6b: zwei Tore, mit einem Zeichen ausgehebelt

Einzelheiten in `docs/UMSETZUNG-WELLE-6B.md`. `ai-act`, `settings`, `admin`
und `admin/rls-audit` sind fertig — `ai-act` **vollständig** (21 statt der
gelisteten 10 Dateien), sichtbare Zeichenketten dort 516 → **0**. Damit ist
`toLocale*("xx-XX")` im Bildschirmbereich auf 0 und die namentliche Ausnahme
in `wave5a-surfaces.test.ts` gestrichen.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                      | Beleg                     | Art     | Stand                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------- | --------------------- |
| OP-202 | **19 Dateien banden next-intl an `_t` und benutzten die Bindung nie.** Für die i18n-Ratsche galten sie als übersetzt (sie sucht das blosse _Vorkommen_ von `useTranslations`), und der führende Unterstrich brachte zugleich `no-unused-vars` zum Schweigen. **Zwei Tore mit einem einzigen Zeichen ausgehebelt** — auf dem Bildschirm stand fest verdrahtetes Deutsch. Sieben davon im regulatorisch exponiertesten Modul des Produkts. | Eigene Messung 2026-09-07 | Tor     | behoben               |
| OP-203 | **`Intl.NumberFormat("de-DE", { style: "currency" })` an 20 Fundstellen in 19 Dateien**, ausnahmslos Geld. Der Wachposten aus Welle 5a kennt nur `toLocale*`; sein „70 → 2" war für seine Regel richtig und für die Sache unvollständig. Für Geld gab es überhaupt kein gemeinsames Mittel — jetzt `formatCurrency`.                                                                                                                     | Eigene Messung 2026-09-07 | Produkt | 1 behoben, 18 benannt |

Das sind **das zwölfte und dreizehnte Tor** in diesem Audit, die nicht
auslösen konnten. OP-202 ist die unangenehmste Variante bisher: Welle 5a hatte
vor genau dieser Fehlerform gewarnt („ein `useTranslations`, das niemand
benutzt, senkt die Ratsche und ändert am Bildschirm nichts") — sie war da
schon real, nur ungezählt.

**Der Zähler ist präzisiert, und die Ratschenzahl STEIGT deshalb: 107 → 118.**
Angebunden ist eine Datei jetzt erst, wenn mindestens eine Bindung auch
**aufgerufen** wird (`bindsButNeverCalls`). 118 ist die erste ehrliche Zahl
dieser Ratsche; beide Richtungen geprüft, grün bei 118 und rot bei 117.
Geprüft wird der Bezeichner, nicht der Unterstrich — `_t` ist nicht das
Problem, der ungenutzte Aufruf ist es.

**Das Phänomen aus Welle 5a wiederholte sich hier nicht.** Gegen alle 79
Namensräume gemessen: 398 Treffer, davon nur 6 mehrwortig (Navigations-
beschriftungen). Für diese Bereiche war OP-070 wirklich Übersetzungs- und
nicht Verkabelungsarbeit. Es kam allerdings in zwei Gestalten wieder, die kein
Textabgleich findet: `admin/connectors` baute `common.dashboard.timeAgo.*`
von Hand nach, samt selbstgebauter Mehrzahl.

**Weitere Befunde:** `badge: "neu"` als Text statt Schlüssel (englische Nutzer
lasen „NEU"); **60 Auswahlknöpfe der Rollen-Berechtigungsmatrix ohne
zugänglichen Namen**, dazu `<td>` statt `<th scope="row">`; `toFixed(1)`
gebietsschemablind (deutsch „12.5 %"); rohe ISO-Daten; vier von Hand gebaute
Mehrzahlen; HTML-Entitäten (`Verst&ouml;&szlig;e`); durchgehend abgeschnittene
Umlaute (dieselbe Klasse wie OP-191) — und **sechs gerenderte englische
`HTTP ${status}`-Meldungen**, die der Test nebenbei fand.

**Methodisch bemerkenswert:** Drei Renderprüfungen fielen gegen den alten
Stand zunächst **nicht** — weil `settings` und `rls-audit` für den Nutzer
schon zweisprachig waren. Statt die Regel weich zu lesen, sind sie so
umgeschnitten worden, dass jede eine vorher falsche Aussage trägt. Erst das
hat den `settings`-Befund scharf gemacht. Von 56 Zusicherungen fallen 55
gegen `e084dc26`; die eine, die auf dem alten Stand leer wahr ist, ist als
solche offengelegt.

**Offen:** die 18 verbliebenen Geldformatierer, zwölf Dateien mit
Scheinbindung ausserhalb `ai-act` (70 Textknoten) — jetzt aber **gezählt**,
und englischer Text, der aus `api/**` kommt.

### Nachtrag 2026-09-05 — Welle 6a: elf Jobs, die Erfolg meldeten

Einzelheiten in `docs/UMSETZUNG-WELLE-6A.md`. Erledigt: OP-112, N-1, N-2;
N-3 begründet **nicht** verdrahtet.

**OP-112 ist scharf.** `npm ls undici --all --omit=dev` ging von `(empty)` auf
`@grc/shared@0.1.0 → undici@7.29.0`. Eigener Rebinding-Versuch mit zwei Servern
auf demselben Port und einem umschwenkenden Resolver: **ungepinnt →
`server=B-rebind-ziel`, gepinnt → `server=A-oeffentlich-validiert`**, null
Resolver-Aufrufe des Agents. Vier Aufrufer pinnen jetzt.

**N-1 — Migration 0479**, `CHECK (weight > 0)`. Selbst gegen eine frische
Datenbank von Null nachgeprüft: **429/429, 617 Tabellen**, und die Bedingung
steht als `audit_qa_checklist_item_weight_positive` im Schema.

**N-2 waren nicht „ca. 75", sondern 265** — 127 in elf Paketen und **138 in
`apps/worker`**, das in Welle 4b-6 gar nicht gezählt worden war. Alle
abgetragen, ohne `!` und ohne `as`; der Schalter steht jetzt in 12 von 12
Projekten. Die Lint-Ratsche fällt **282 → 45** (`no-unused-vars` 249 → 12).

**Und genau wie in Welle 4b-3 war die Regel ein Defektdetektor.** Elf
Produktdefekte, die schwersten zuerst:

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                           | Art                  | Stand            |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------- |
| OP-196 | **Jede eingebaute Dauerprüfungsregel schrieb „bestanden", ohne zu prüfen.** `executeBuiltinRule` gab `[]` zurück, mit dem Kommentar „For now, return empty (pass)"; der Aufrufer macht daraus `resultStatus = "pass"` und legt das als **unveränderliches** Ergebnis ab. In einem GRC-Produkt ist das erfundener Prüfnachweis. Selbst nachgemessen am alten Stand `dcded077`. | **Produkt/Nachweis** | verweigert jetzt |
| OP-197 | **`risk-prediction-weekly` quittierte jede Woche `status:"success"`** — der Rumpf war `return {0,0,0}`. Der zugehörige Test bestand aus `expect(threw).toBe(false)` und deckte damit den Stub.                                                                                                                                                                                | Produkt/Nachweis     | verweigert jetzt |
| OP-198 | **`fetchPostureScore` schrieb `value: 0, trend: "stable"` in jeden ISMS-Bericht**, ohne je Daten zu lesen. Meldet jetzt `"n/a"`.                                                                                                                                                                                                                                              | Produkt/Nachweis     | behoben          |
| OP-199 | **`tech-radar-migration-alerts` meldete `alertsCreated` als Zahl der Kandidaten** und erzeugte nie eine Warnung.                                                                                                                                                                                                                                                              | Produkt/Nachweis     | verweigert jetzt |
| OP-200 | **`automation_rule.cooldown_minutes` war ohne Wirkung** — es gab zwei Cooldown-Methoden, und der Produktionspfad rief die mit fest verdrahteter Stunde. Die zugehörige Suite lief nur gegen einen leeren Cache und konnte den Cooldown nie prüfen: **das elfte Tor in diesem Audit, das nicht auslösen konnte.**                                                              | Produkt              | behoben          |
| OP-201 | **Eine zweite, verdeckte `ADEQUACY_COUNTRIES`-Liste** mit dem Nicht-ISO-Code `"UK"` statt `GB`. Eine **dritte** Kopie in der TPRM-Route weicht wieder ab — **ihr fehlen die USA**. Zwei entfernt, die dritte benannt.                                                                                                                                                         | Produkt              | teilweise        |

Dazu vier fachliche Festlegungen, die benannt und nicht geraten wurden:
Der Berichtszeitraum wird in drei Vorlagen gedruckt (`Period: {{period.label}}`),
aber von **keiner** der 16 Datenquellen gelesen; `architecture_rule.condition`
wird nie ausgewertet (eine Einstellung ohne Wirkung); ein Kommentar nannte
einen `interface-notification`-Cron, den es nicht gibt — **ein
Schnittstellenausfall benachrichtigt niemanden**; und `wb-retaliation-check`
wendet seine HinSchG-Indikatoren nie an, es stellt nur zu, was ohnehin schon
markiert war.

**N-3 — die Entscheidung, und warum sie so lautet.** `computeQaScore` hat null
Aufrufer, `updateQaChecklistSchema` keine Route, `overall_score` ist in 0 von 0
Zeilen gefüllt, die Seite zeigt ein festes `--`. Verdrahtet wurde **nicht** —
und zwar nicht aus Bequemlichkeit: Gemessen an genau der Checkliste, die die
POST-Route anlegt (15 Positionen, `compliance` durchweg NULL, weil es keinen
Schreibweg gibt), liefert die Funktion `{"score":0,"rating":"red"}`. **Jede
QA-Bewertung im Produkt trüge die Note „rot"** — nicht weil geprüft wurde,
sondern weil nichts geprüft werden kann. Eine leere Spalte ist sichtbar
unfertig; eine konstante rote Bewertung sieht aus wie ein Befund.

Beim Nachmessen kam der Defekt heraus, den N-3 gar nicht nannte: **1 von 15
bewertet ergab `{"score":100,"rating":"green"}`**, identisch mit 15 von 15 —
`compliance = null` („noch nicht bewertet") wurde wie `not_applicable`
behandelt. Derselbe Hebel auf Grün wie das negative Gewicht aus Welle 4b-6.
Das Ergebnis trägt jetzt `assessed`/`total`.

**Ein Grenzübertritt, ausdrücklich benannt:** Der Strang hat
`docs/feature-catalog.md` angefasst (drei Inventarzeilen, Zähler 19 → 22),
obwohl die Datei nicht in seiner Hoheit stand. Sie ist Tor-Eingabe von
`docs-vs-honest-refusals.test.ts`; die Alternativen waren ein rotes Tor oder
das Zurücknehmen von OP-196/197/199 — also das **Wiederherstellen erfundener
Nachweise**. Die Entscheidung war richtig und gehört trotzdem benannt.

### Nachtrag 2026-09-05 — Welle 5c: die Folgearbeiten, und ein zehnter stummer Bereich

Einzelheiten in `docs/UMSETZUNG-WELLE-5C.md`. Abgearbeitet wurden die
Codeänderungen, die Welle 5b gemessen, benannt und wegen fremder Dateihoheit
liegen gelassen hatte.

| OP     | Ergebnis                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OP-114 | **behoben** — `excel-to-bpmn.ts` liest über `stream.xlsx.WorkbookReader` mit Zeilen- (10.000) und Zellgrenze. Gemessen an einer 7,72-MB-Tabelle mit 200.000 Zeilen: **756 MB / 5.409 ms → 178 MB / 767 ms**. Der alte Stand wandelte bei `maxRows: 5` klaglos 12 Zeilen um.                                                                                                                                       |
| OP-128 | **behoben** — `scripts/reseal-wb-secrets.mjs`, gegen `grc_v4c` mit echtem Bestandsfall gelaufen: 4 Werte umgeschlüsselt, zweiter Lauf 0 (idempotent), falscher PREVIOUS-Schlüssel → „4 UNREADABLE", Exit 1. **Falle dabei:** `WB_PSEUDONYM_KEY` wird aus `WB_ENCRYPTION_KEY` abgeleitet — eine Rotation zerstört still alle `wb_report.ip_hash`. Das Skript verweigert deshalb ohne gesetztes `WB_PSEUDONYM_KEY`. |
| OP-100 | **behoben** — `findMissedRuns`/`reconcileMissedRuns` gegen `job_run`; gegen die laufende Datenbank: kein Nachholen ohne Historie, ein zwei Tage alter Lauf → 1 nachgeholt mit `trigger_source='catchup'`, zweiter Aufruf 0.                                                                                                                                                                                       |
| OP-112 | **nicht gebaut, mit Messung.** Der Dispatcher trägt (pinnendes `connect.lookup`, nachgemessen gegen `rebind.invalid`) — aber `npm ls undici --all --omit=dev` ergibt **`(empty)`**: undici kommt nur über `jsdom`, eine devDependency. Ein Import in produktivem Code bräche jeden ausgehenden Aufruf. Es fehlt genau eine Zeile in `packages/shared/package.json`; Rezept und Messung stehen im Code.            |

**Die beiden Kommentarzahlen stimmten nicht — und hatten Nachbarn.**
„fourteen" → **13 Dateien / 24 Pfade / 12 Modulprozesse**; „129 jobs" → **131**,
und ungefragt gleich mit: „roughly 40k rows a day" → gemessen **4.053**
(Faktor 10) und „some at minute cadence" → **genau einer**. Die „129" stand
ausserdem an zwei weiteren Stellen. Die Tests rechnen alle diese Zahlen jetzt
nach, statt sie zu behaupten.

| OP     | Was                                                                                                                                                                                                                                                                                                                                    | Beleg                     | Art | Stand   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | --- | ------- |
| OP-194 | **Der Platzhalterfilter des Geheimnis-Scanners prüfte die GANZE ZEILE.** Ein echter Schlüssel neben einem `example.com` war damit unsichtbar. Gemessen: alter Stand 0 Funde / Exit 0, neuer Stand 1 Fund / Exit 1. Die Umstellung auf musterbegrenzte Prüfung kostet gegen den heutigen Baum **nichts**.                               | Eigene Messung 2026-09-05 | Tor | behoben |
| OP-195 | **`audit-dead-exports.mjs` hielt jede Prüfnaht für toten Code**, die nur aus Tests heraus benutzt wird — der Import-Index las ausschliesslich `SRC_DIRS`. Das Tor forderte wörtlich „Entfernen, nicht in die Ratsche aufnehmen", hätte also zum **Löschen benutzter Exporte** aufgefordert. Korrigiert: 2767 in 471 → **2464 in 458**. | Eigene Messung 2026-09-05 | Tor | behoben |

Damit ist OP-194 **der zehnte** Fall in diesem Audit, in dem ein Tor nicht
auslösen konnte, und OP-195 einer, in dem ein Tor zur falschen Handlung
aufgefordert hätte. Beide Ratschen sind auf den gemessenen Stand
nachgezogen — `(fatal-or-directive)` 1 → 0 und Dead-Exports 2765/470 →
2464/458, letztere ausdrücklich als **Werkzeugkorrektur** und nicht als
Arbeitsergebnis begründet — und beide anschliessend durch künstliche
Verletzung geprüft.

**Und noch einmal derselbe eigene Fehler, diesmal von einem Strang selbst
gefunden:** Der Geheimnis-Scanner war rot, weil `docs/UMSETZUNG-WELLE-5B.md`
den Fund erklärt und dabei das Muster ausschreibt — der eingecheckte Report
war **vor** dieser Zeile erzeugt worden. „Artefakt statt Messung", in genau
dem Dokument, das diesen Fehler anprangert. Behoben über ein neues,
**musterbegrenztes** Ausnahmefeld; gegengeprüft, dass ein anderer Fund in
derselben Datei weiterhin Exit 1 meldet.

**Nebenbefund:** Der Kommentar in `index.ts:452` („node: bricht den
Client-Bundle") ist Webpack-Überlieferung. Gegen dasselbe `next@16.2.11` mit
Turbopack in drei Varianten gemessen: **alle Exit 0**.

### Nachtrag 2026-09-05 — Welle 5b: die Doku, und ein neuntes Tor

Einzelheiten in `docs/UMSETZUNG-WELLE-5B.md`. Erledigt: OP-104 (Kern), OP-051,
OP-133, OP-134, OP-115, OP-114 (dokumentarisch), OP-112, OP-117, OP-106,
OP-100 (dokumentarisch), OP-130, OP-151, OP-159, OP-053. Bereits vorher
erledigt und nur noch nachgetragen: OP-131, OP-132, OP-138.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                    | Beleg                     | Art | Stand   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | --- | ------- |
| OP-193 | **Das Geheimnis-Tor lief mit `continue-on-error: true` UND `\|\| true`.** Beide Abschaltungen zusammen haben den Exit-1 des Skripts verworfen; der eingecheckte Report stammte vom 2026-09-01 und meldete „3901 Dateien, 0 Funde". Neu erzeugt: **4420 Dateien, 2 CRITICAL** — beide in `packages/shared/tests/logger-scrubbing.test.ts:100`, **eingeschleppt von Welle 4b-2 (OP-152) dieses Audits** und zwei Wellen lang unsichtbar. | Eigene Messung 2026-09-05 | Tor | behoben |

Das ist **das neunte Tor in diesem Audit, das nicht auslösen konnte** — und
das erste, das einen Befund aus der eigenen Arbeit verdeckt hat. Die zwei
Treffer waren die Eingabewerte des Tests, der beweist, dass der Scrubber sie
schwärzt (ein erfundener JWT-Kopf, ein `sk-`-Muster, eine Verbindungszeichen-
kette mit dem Passwort `geheim`, eine PEM-Kopfzeile ohne Schlüsselmaterial) —
fände der Scanner sie nicht, wäre der Test wertlos. Sie stehen jetzt als
bewertete Ausnahme in `KNOWN_TEST_FIXTURES`, der Schritt ist scharf, und die
Gegenprobe in einer verfolgten Datei ergibt 2 CRITICAL / Exit 1. Der
Kommentar im Workflow schreibt die PEM-Kopfzeile bewusst **nicht** aus —
sonst meldet der Scanner seine eigene Dokumentation als Fund; genau so
gemessen, die Treffer wanderten nach dem Eintragen der Ausnahme auf die
Workflow-Datei.

**OP-104 — was nachweislich falsch war.** Zwölf `✅ Done`-Zeilen in
`CLAUDE.md`, `STATUS.md` und `feature-catalog.md` standen auf Fähigkeiten, die
501 antworten oder `failed` melden. Dazu Zahlen, die sich **innerhalb
derselben Datei** widersprachen:

- `CLAUDE.md:135` „31 catalog frameworks" gegen Zeile 21 „46" → gemessen **46**
- `CLAUDE.md:136` „401 cross-framework mappings" → gemessen **943**
- `CLAUDE.md:63` „0001–0361, 340 files" gegen Zeile 18 „402" → gemessen **428**
- Die Zähltabelle „re-measured 2026-09-01": **8 von 12 Zeilen überholt**
- `docs/feature-catalog.md:130` nennt einen Prüfbefehl
  `SELECT count(*) FROM cross_framework_mapping;` → `ERROR: relation does not
exist` (die Tabelle heisst `framework_mapping`). **Die Doku-Drift-Korrektur
  war selbst gedriftet.**
- `docs/runbook.md` §5: Der dokumentierte Prüfbefehl
  `grep -l '^-- Breaking: *true'` findet **nichts**, weil der Header
  `yes-breaking` schreibt — er gab **vor einem Breaking-Rollout Entwarnung**.
  Korrigiert findet er 0383/0385/0386.

Auch hier stimmten die Registerzahlen nicht: OP-103 „vierzehn Pfade" →
**19 in 12 Dateien**; OP-145 „acht" Dependabot-Branches → **10**.

**Codeänderungen, die nötig sind und bewusst NICHT gemacht wurden** (Quellcode
lag ausserhalb der Dateihoheit dieses Strangs) — in dieser Reihenfolge:

1. **OP-114**: `packages/shared/src/lib/excel-to-bpmn.ts:54` — `wb.xlsx.load()`
   auf `WorkbookReader` umstellen. Dieser Pfad hat als **einziger keine zweite
   Schicht**, entgegen dem bisherigen Registertext.
2. **OP-128**: ein Re-Seal-Skript für `WB_ENCRYPTION_KEY`.
3. **OP-112**: undici-Dispatcher mit IP-Pinning in `url-safety-server.ts`.
4. **OP-100**: Nachholabgleich gegen `job_run` in `job-registry.ts`.
5. Zwei Kommentare tragen falsche Zahlen weiter:
   `no-fabricated-evidence.test.ts:11` („fourteen", zählt 13) und
   `job-run-retention.ts:4` („129 jobs" gegen 132).

**OP-136 ist bestätigt und eine fachliche Entscheidung:**
`dashboard_widget_config` und `notification_template` existieren gar nicht —
die zugehörigen Seeds sind No-Ops.

### Nachtrag 2026-09-05 — Welle 5a: OP-070, und wofür die Übersetzungen schon da waren

Einzelheiten in `docs/UMSETZUNG-WELLE-5A.md`.

**Auch hier stimmte die Registerzahl nicht.** „96 Seiten" ist seit WP12 alt;
selbst gemessen waren es **151 Dateien** (78 Seiten + 73 Komponenten) mit rund
3.059 Zeichenketten — die Ratsche stand exakt ausgereizt. Nachher: **131**
(72 + 59), rund 2.833 Zeichenketten. Beide CI-Ratschen sind nachgezogen
(`--max-unused 2166 → 2133`, `--max-untranslated 151 → 131`) und in beide
Richtungen nachgeprüft: grün beim gesetzten Wert, rot eins darunter.

**Der Befund, der drei Punkte miteinander verbindet: die Übersetzungen
existierten längst.** 185 der 2.166 „toten" Katalogschlüssel standen **wortgleich
als Literal** in genau den Seiten, die als „ohne i18n" gezählt werden.
`portal.*` (41), `wbPortal.*` (23) und `ddResults.*` (4) waren vollständig in
beiden Sprachen da — und von **null** Aufrufstellen erreicht. Das ist der
**dritte unabhängige Grund**, warum die Liste aus OP-073 keine Löschliste ist:
Nach den Phantomen aus der doppelten `common.json` und der variabel
durchgereichten Navigation nun Schlüssel, die nicht tot sind, sondern nur noch
nicht angeschlossen. Wer diese Liste abgearbeitet hätte, hätte die fertige
Übersetzung gelöscht und die hartcodierte Fassung stehen lassen.

**Sechs Defekte, die dabei sichtbar wurden:**

| OP     | Was                                                                                                                                                                                                                                                                                                                                                | Art              | Stand              |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------ |
| OP-188 | **`DataTable` zeigte deutschen Nutzern Englisch** — „No results.", „Page x of y", „row(s)" in **27 Listenansichten**. Der Kopfkommentar der Datei beschrieb den Zustand und bot den Aufrufern einen Ausweg an; **keiner der 27 hat ihn genommen**.                                                                                                 | Produkt          | behoben            |
| OP-189 | **Externe Besucher konnten die Sprache gar nicht wählen.** `NEXT_LOCALE` wird erst beim Speichern des Profils gesetzt, also nach der Anmeldung. Die Endseiten des Lieferantenportals (`dd/expired`, `dd/complete`) sind fest **englisch** — ohne Sprachwähler wäre ihr Übersetzen eine Verschlechterung für englischsprachige Lieferanten gewesen. | Produkt          | behoben            |
| OP-190 | **87 Fundstellen formatieren fest `de-DE`**, 12 davon in Dateien, die der Ratsche als übersetzt gelten — sieben im Budgetmodul, also **Geldbeträge auf englischen Seiten**. `lib/format-date.ts` gibt es seit FE-HIGH-2 genau dafür und war dort nicht angeschlossen. Im Bildschirmbereich 70 → 2.                                                 | Produkt          | weitgehend behoben |
| OP-191 | **Der HinSchG-Meldekanal hatte neun Wörter falsch geschrieben** („Identitaet", „geschuetzt", „verschluesselt" …). Der Katalog schreibt sie richtig — die transliterierten Umlaute waren eine Folge der Hartcodierung.                                                                                                                              | Produkt          | behoben            |
| OP-192 | **Vier Bedienelemente ohne zugänglichen Namen** (Tag entfernen, Antwort senden, Beweismittel hochladen, drei Werkzeugknöpfe). Im Meldekanal ist das der Unterschied zwischen bedienbar und nicht.                                                                                                                                                  | Barrierefreiheit | behoben            |
| —      | **13 der 151 gezählten Dateien zeigen gar keinen Text** — der Zähler nimmt dort Tailwind-Klassenketten für Sätze. Die ehrliche Restschuld ist damit **118, nicht 131**. Beziffert statt behoben (`scripts/**` lag ausserhalb der Dateihoheit dieses Strangs).                                                                                      | Tor              | offen              |

**Bewusst nicht übersetzt:** `legal/imprint` und `legal/privacy` (133
Zeichenketten). Gesetzliche Pflichtangaben mit massgeblicher deutscher Fassung;
eine englische Fassung ist eine Rechtsentscheidung mit Prüfvorbedingung, keine
Behebung. Die Fusszeile darüber ist umgestellt, der **Weg** zu den Dokumenten
also zweisprachig.

**Offen, in dieser Reihenfolge:** `ai-act` (10 Dateien, 494 Zeichenketten) →
`settings` (3, 298) → `admin` (12, 297) → `admin/rls-audit`. Die Teiländerung
an der letzten wurde **zurückgenommen**, weil sie die Datei inkonsistent
gemacht hätte — eine halb umgestellte Datei ist schlechter als eine ganz
hartcodierte.

### Nachtrag 2026-09-04 — OP-079/OP-116, und der schwerste Befund des Audits

Einzelheiten in `docs/UMSETZUNG-WELLE-4B-7.md`.

**Die Registerzahlen stimmten in beiden Fällen nicht.** Selbst nachgemessen:
OP-079 nannte „107 von 1.362" — tatsächlich **1.372 Routendateien, 2.039
exportierte Handler, 94 ungewickelt in 49 Dateien** (mit Auflösung der
Alias-Exporte; ohne sie zählt man fälschlich 97). Nachher: **62 in 25
Dateien**, ausnahmslos konstante Weiterleitungen, Discovery/405-Antworten und
zwei Health-Sonden — ohne `await`, ohne Datenbank, ohne Wurfpfad, namentlich in
einem Strukturtest festgehalten. Fehlerantworten, die den Aufrufer als
`{error}` erreichten: **75 → 0**.

OP-116 nannte „23 von 276" — tatsächlich **284 lesende GET-Dateien, 29 mit
Schema (10,2 %)**. Nebenbei: Der Registertitel („Fehlerbehandlung in
Handlern") beschreibt etwas anderes als seine Quelle S04-09 („GET-Handler ohne
Query-Schema"). Die Defektklasse dahinter ist geschlossen: 12 UUID-Flüsse in 8
Dateien und 12 Datumsflüsse in 6 Dateien → je 0.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Beleg                                                                                    | Art            | Stand   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------- | ------- |
| OP-187 | **Der zentrale Fehlerwickel gab Treibertext an den Aufrufer — für alle 1.945 gewickelten Handler.** `withErrorHandler` setzte für die Verstossklassen 23xxx/22xxx `detail: e.detail ?? e.message` und denselben Text noch einmal in `errors[0].message` — dreissig Zeilen über der eigenen WAVE11-Regel „NEVER returned in the response body", die ausgerechnet nur für den unbekannten 500er galt. **Eigene Nachmessung gegen das laufende Schema:** `INSERT INTO "user" (email) …` → `DETAIL: Failing row contains (…)` mit der **vollständigen Zeile**; 30 weitere Tabellen führen NOT-NULL-Spalten mit `hash`/`secret`/`token`. Und `user_email_unique` ist **`ON public."user" USING btree (email)`**, also global statt je Organisation — ein Verstoss dagegen bestätigt die Existenz einer Adresse **über Mandantengrenzen hinweg**. | Eigene Messung 2026-09-04; alter Code `9504a98a:apps/web/src/lib/api-wrapper.ts:482-483` | **Sicherheit** | behoben |

`sanitiseDbError` behält jetzt die Spalte und die Art des Verstosses und lässt
Werte, Constraint- und Relationsnamen weg; der volle Text steht unverändert im
Log unter derselben `requestId`. Das ist der Unterschied, um den es geht: Die
Diagnose bleibt, sie steht nur nicht mehr in der Antwort.

**Zwölf weitere Produktdefekte**, die schwersten zuerst:

- **`GET /api/v1/health` gab `err.message` an unauthentifizierte Aufrufer** —
  Rollenname, Host, Port, Datenbankname — direkt unter der Zusage „prevent info
  leaks to unauthenticated callers". `/api/health` machte es seit jeher richtig.
- **SCIM-Gruppen stehen auf einer Tabelle, die es nicht gibt.** `user_group`
  kommt in keiner Migration und keinem Schema vor, nur in diesen zwei Dateien.
  Vier Unwahrheiten nebeneinander: `GET /Groups` → 200 mit `totalResults: 0`,
  `GET /Groups/:id` → 404 „not found", `POST`/`PATCH` → 500 mit
  `relation "user_group" does not exist`. Der `catch` schluckte zusätzlich einen
  **Deadlock** (gemessen: 200 mit leerer Liste).
- **SCIM `POST /Users`** gab `err.message` zurück — dasselbe
  Cross-Tenant-Orakel: Die RLS-gefilterte Vorprüfung sieht die fremde Person
  nicht, das INSERT schon.
- **SCIM `/Users/[id]`: vier Handler ohne jedes `try`** — eine nicht-UUID-
  Kennung ergab einen 500er mit leerem Rumpf.
- **SAML-ACS: `await req.formData()` ungeschützt**, Wurf bei falschem
  Content-Type. **Die Smoke-Suite hatte diesen Wurf per `allowThrow: true`
  ausdrücklich erlaubt** — mit zutreffender technischer Beschreibung. Ein Befund,
  als Konfiguration gelesen. Die Ausnahme ist gestrichen und wird von keinem
  Eintrag mehr gesetzt.
- **`auth/sso/config?orgId=<keine uuid>`** → 500 mit leerem Rumpf,
  unauthentifiziert, bei **jedem Besuch der Anmeldeseite**; `branding/css/…`
  ebenso.
- **12 Datumsfilter**: `new Date("garbage")` ergibt `Invalid Date`, der Treiber
  wirft einen `RangeError` **ohne SQLSTATE**, und der Wickel ordnet nach Code
  zu — also **500** statt 422. Betraf unter anderem die
  ABAC-Zugriffsprotokollansicht.

**Was begründet offen bleibt:** die 255 rohen Query-Leser (jede
Schemaumstellung ist eine unverifizierbare Verhaltensänderung pro Route; die
Defektklasse ist geschlossen, gemessen mit zwei benannten Suchmustern — andere
Formen wie `sql`-Interpolation sind damit ausdrücklich **nicht**
ausgeschlossen), die `user_group`-Migration (fremde Dateihoheit), das
mandantenübergreifende Verknüpfen eines bestehenden SCIM-Kontos
(Produktentscheidung), und die 62 konstanten Handler.

**Und ein achter Fall der bekannten Art.** Die Smoke-Suite hat den SAML-Wurf
nicht übersehen — sie hat ihn **erlaubt**, mit einer korrekten Begründung
daneben. Damit ist die Liste um eine Variante reicher: Ein Tor kann nicht nur
falsch zielen, es kann den Befund auch ausdrücklich als zulässig führen.

### Nachtrag 2026-09-04 — OP-173, OP-065 und sechzehn Defekte aus einem Compiler-Schalter

Zwei Stränge, beide abgeschlossen. Einzelheiten in
`docs/UMSETZUNG-WELLE-4B-5.md` und `-4B-6.md`.

**OP-173 — `apps/web` ist jetzt in der Ratsche**, und zwar als **eigener
Bereich**, nicht im selben Topf: Ein Rückgang in `apps/worker` hätte sonst
einen Anstieg in `apps/web` gedeckt. Zwei ESLint-Läufe mit je eigenem `cwd`,
weil Flat Config vom Arbeitsverzeichnis aus sucht — aus der Wurzel gelintet
fiele `apps/web` unter die Wurzelkonfiguration, die es ausdrücklich ignoriert,
und heraus käme eine **plausible falsche Null**. Stand: `root` 283,
`apps/web` 0. In sechs Lagen gegengeprüft, jede rot.

Die beiden Altfehler waren keine Formalie:

- `grc-maintenance-surface.test.ts:263` behauptete `expect(0 || null).toBeNull()`
  unter der Überschrift „Der Gegenbeweis" — eine Aussage über JavaScript, nicht
  über die geprüfte Funktion. Sie wäre auch grün geblieben, wenn es die
  Funktion gar nicht mehr gäbe.
- `bpmn-moddle-declaration.test.ts:105` benutzte `require("node:fs")` in einer
  ESM-Datei, die drei Zeilen höher aus **demselben** Modul statisch importiert.
  Gemessen: `node --input-type=module -e 'require("node:fs")'` →
  `ReferenceError: require is not defined in ES module scope`. Getragen hat es
  allein der CJS-Interop von Vitest; unter jedem nativen ESM-Lader wäre der
  einzige Aufrufer des geprüften Wächters beim ersten Aufruf gestorben.

**Die SECURITY-DEFINER-Frage ist beantwortet.** 54 gegen Baseline 45: neun
Funktionen aus den Migrationen 0440, 0455, 0457 und 0477, alle nach dem
Baseline-Stand `f11c5895` entstanden, **alle gerechtfertigt** — ein
RLS-Policy-Helfer, der Anmeldepfad ohne Request-Kontext (er _ersetzt_ die
kontextlose Disjunktion der `user`-Policy; die Zahl stieg, weil die Fläche
sank), die Session-Invalidierung und die vier Wächter des RLS-Dauerschutzes.
Gegen `pg_proc` nachgemessen: alle neun mit festem `search_path`, kein
`EXECUTE` für PUBLIC. Baseline mit Begründung nachgezogen — und dabei fiel auf,
dass `--update-baseline` genau die Bequemlichkeit zuliess, die OP-064 für die
Lint-Ratsche abgestellt hat: Jede **Lockerung** verlangt jetzt ein `--reason`
mit `_history`-Eintrag.

**OP-065 — die Option ist in allen zehn Paketen an.** Die geerbten Zahlen
(shared 502, db 641, auth 321, email 542) stimmten nicht mehr; sie zählten zwei
Schalter zusammen und bei `email` überwiegend JSX-Syntaxfehler. Nachgemessen,
nur `noUncheckedIndexedAccess`, je Paket die **eigenen** Dateien: db 452,
shared 278, ai 80, auth 30, automation 17, events 8, email 8, reporting 4,
graph 3, ui 0 — **880**. Alle abgetragen, **kein `!`, kein `as`**.

**Sechzehn Produktdefekte hat dieser eine Compiler-Schalter ans Licht
gebracht.** Die schwersten:

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Art     | Stand   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- |
| OP-184 | **Der DER-Parser lässt sich mit sechs Bytes zum Stillstand bringen.** `length = (length << 8) \| …` rechnet vorzeichenbehaftet; vier Längenbytes ergeben eine **negative** Länge, `readChildren` setzt `off = child.end` und läuft rückwärts. Eigene Nachmessung gegen den alten Stand: `30 84 ff 00 00 00` → `end = -16777210`, **kein Wurf**; der neue Stand lehnt dieselben Bytes präzise ab („declares 4278190080 content bytes but only 0 are present"). Der Parser liest RFC-3161-Antworten **und gespeicherte `audit_anchor.proof`**. | Produkt | behoben |
| OP-185 | **Der ZIP-Bombenwächter meldete „entpackt sich zu nichts".** `buf[off]` jenseits des Puffers ist `undefined` und im Bit-Ausdruck **0**; ein Eintrag, der sich über `0xffffffff` als ≥ 4 GiB deklariert, wurde mit `uncompressedSize = 0` durchgewinkt. Erreichbar über `POST /api/v1/import/upload`.                                                                                                                                                                                                                                         | Produkt | behoben |
| OP-186 | **`freetsa.ts` warf am eigenen Fehlermodell vorbei** — rund 25 ungeprüfte Zugriffe; eine verstümmelte Antwort ergab einen rohen `TypeError` statt `TimestampValidationError` und landete so als `last_error` am Anker.                                                                                                                                                                                                                                                                                                                       | Produkt | behoben |

Dazu der Prototypen-Durchgriff aus OP-171s Nachbarschaft gleich **dreifach**:
`isValidWpTransition` wirft bei `toString`; `resolveField` gibt für
`userLang="constructor"` eine **Funktion** zurück, wo `string` deklariert ist;
und `getNestedValue` — im Kopf als „Safely resolve nested property" bezeichnet
— rendert `{{org.constructor}}` als `function Object() { [native code] }` in
einen Bericht. In `UserInvited.tsx` verweigert React daraufhin das Rendern.

**Und ein Hebel für eine erfundene grüne Bewertung:** `computeQaScore` lieferte
nicht nur `NaN` bei Gewicht 0 und `-Infinity` bei negativem Gewicht, sondern
für `[{compliant, 5}, {non_compliant, -1}]` **125/green**. Behoben mit
Gewichtsfilter; die Invariante `score ∈ [0,100]` ist jetzt bewiesen.

**Die Quoting-Umgehung ist geschlossen** — und zwar durch **lexikalisches
Verbot** des `"` vor der Musterprüfung, nicht durch ein `"?` in der Regex: Das
nähme genau eine Schreibweise heraus und liesse `""` und `U&"…"` stehen.
Gemessen war: `SELECT pg_sleep(3600)` abgelehnt, `SELECT "pg_sleep"(3600)`
**durchgelassen**, ebenso `"current_setting"`, `"pg_read_file"`, `"dblink"`.

**Drei Punkte bleiben offen und sind aufgenommen:** ein fehlender
CHECK-Constraint auf `weight` (die richtige Stelle, denn `weight` steht in
keinem Zod-Schema), der Rest von `noUnusedLocals` (rund 75), und — der
unangenehmste — **der QA-Bewertungspfad ist gar nicht verdrahtet**:
`computeQaScore` hat keinen Aufrufer, `overall_score` bleibt leer.

### Nachtrag 2026-09-03 — Welle 4c: die Kennzahlen, und was hinter ihnen stand

OP-074, OP-075, OP-073, OP-089 und ein Teil von OP-069 sind abgearbeitet.
Einzelheiten in `docs/UMSETZUNG-WELLE-4C.md`.

| OP     | vorher                                                    | nachher                                                                                     |
| ------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| OP-074 | Report nannte 1.991 in 322 Dateien; gemessen 2.765 in 470 | Report auf den gemessenen Stand geschrieben                                                 |
| OP-075 | kein Tor                                                  | vierte Ratsche mit **drei Armen** (Gesamtzahl, je Datei, Aktualität des Reports), in der CI |
| OP-073 | 6.805 gegen Budget 6.800 — **das Tor war rot**            | **2.166**; **kein Schlüssel gelöscht**                                                      |
| OP-089 | zwei mandantenübergreifende Materialized Views            | Migration 0478: **keine Materialized View mehr im Schema**, 428/428 von Null, 617 Tabellen  |
| OP-069 | gesamt 33,92 % Zeilen                                     | **34,34 %**; `api.ts` 69,9 → 80,1 %, `api-wrapper.ts` 60,0 → 97,8 %                         |

**OP-073 — die Liste taugte nicht als Löschliste, und das ist der Befund.**
Zwei unabhängige Defekte des Detektors, beide korrigiert:

1. **4.331 der 6.805 Einträge waren Phantome.** `common.json` steht durch die
   Merge-Regel aus `i18n/request.ts` **zweimal** im Nachrichtenbaum (Wurzel und
   `common`). Von 12.956 gezählten „Nachrichten" sind 4.340 Dubletten; der Code
   erreicht je Nachricht nur eine Schreibweise, die andere galt als tot.
2. **Die Hauptnavigation stand auf der Liste.** 35 Aufrufstellen reichen den
   Schlüssel als Variable durch (`t(item.labelKey)`) — das sah der Detektor
   nicht. Ergebnis: **204 von 205** Schlüsseln aus `nav-config.ts` und **113 von
   113** aus `module-tab-config.ts` galten als „nie erreicht".

Hätte jemand diese Liste als Arbeitsauftrag genommen, wäre **die Navigation
entbeschriftet** worden. Belastbar tot sind 278 Schlüssel in vier nie
gebundenen Namensräumen; ihre Löschung liegt in `apps/web/messages/**` und
wartet auf einen eigenen Schnitt.

**OP-089 — und ein zweiter Befund darunter.** RLS trägt auf einer Materialized
View nicht (PostgreSQL kennt dafür kein `ENABLE ROW LEVEL SECURITY`, und der
REFRESH läuft im Kontext des Eigentümers). Getragen hat die normale View mit
`security_invoker = true`; alle fünf Basistabellen führen bereits RLS, FORCE
und org-Policy. Nebenbei: Im ganzen Repository steht **kein einziges
`REFRESH`** — die beiden Views waren seit ihrer Anlage nicht nur unsicher,
sondern **leer**. Und `ALTER DEFAULT PRIVILEGES` aus 0399/0437 gab den neuen
Views ungefragt `arwd` für `grc_app` _und_ `grc_worker`, weshalb die Migration
ein ausdrückliches `REVOKE ALL` voranstellt.

**Vier weitere Tore standen bei `8a212b47` rot.** Der Reihe nach:

| OP     | Was                                                                                                                                                                                                                                                                                                                           | Art | Stand   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| OP-183 | **Das Prettier-Tor der CI las `.prettierignore` nie.** `--ignore-path .gitignore` **ersetzt** die Vorgabeliste, statt sie zu ergänzen. Lokal meldete `npm run format` grün (es läuft ohne `--ignore-path`, also greift `.prettierignore`), in der CI wurde eine andere Dateimenge geprüft. Zwei Massstäbe für dieselbe Frage. | Tor | behoben |
| —      | Die i18n-Ratsche (6.805 gegen Budget 6.800) — mit OP-073 erledigt.                                                                                                                                                                                                                                                            | Tor | behoben |
| —      | Die Coverage-Ratsche (`packages/shared` functions). **Verursacht durch `logger.ts` aus meinem eigenen Commit `08a4ae4f`.** Mit Tests geschlossen, **nicht** abgesenkt.                                                                                                                                                        | Tor | behoben |
| —      | Der eingecheckte RLS-Report (616 gegen 617 Objekte).                                                                                                                                                                                                                                                                          | Tor | behoben |

**Ein Fehler von mir, offen benannt.** Ich habe bei der Abnahme von Welle 4b-2
`npm run coverage:gate` laufen lassen und grün gemeldet — gegen einen
**veralteten** `coverage/aggregated-summary.json` aus einem früheren Lauf. Das
Tor war zu diesem Zeitpunkt in Wahrheit rot, und zwar durch meine eigene
Änderung. Es ist dieselbe Fehlerform wie bei der Messung zu Next 16.3.4: ein
Artefakt als Ergebnis gelesen, ohne zu prüfen, ob es den aktuellen Stand
beschreibt. Die Abnahme erzeugt den Bericht jetzt neu, bevor sie das Tor
befragt.

**Damit sind es sechs Tore in diesem Audit, die nicht auslösen konnten** — eine
ignorierte Tor-Eingabe, ein `git diff` auf ungetrackte Pfade, ein `tee` ohne
`pipefail`, ein Test der an seiner Vorbedingung starb (OP-168), eine Suite die
ihre Voraussetzung erriet (OP-170), eine `allow`-Liste die das Gefährliche
durchliess (OP-171) — und mit OP-183 ein siebtes: ein Tor, das die falsche
Dateimenge prüfte. Das neue Dead-Exports-Tor ist deshalb in fünf Lagen künstlich
verletzt und jedes Mal rot geworden, darunter eigens der Fall, den OP-074
beschreibt.

**Aufgenommen, nicht behoben** (ausserhalb der Dateihoheit dieses Strangs):
`SELECT "pg_sleep"(3600)` passiert die Ausnahmeliste für Custom-SQL, weil der
Funktionsname in Anführungszeichen steht; `isValidWpTransition` wirft bei
`"toString"`; `computeQaScore` liefert `NaN` bei Gewicht 0; und
`verify-db-integrity.mjs` ist mit 54 gegen 45 SECURITY-DEFINER-Funktionen rot —
die Baseline wurde bewusst **nicht** angehoben.

### Nachtrag 2026-09-03 — die Restdefekte aus Strang 3, und ein 500er, der nie auffiel

Strang 4 hat die fünf Produktdefekte abgearbeitet, die Strang 3 gefunden,
benannt und bewusst nicht behoben hatte. Einzelheiten in
`docs/UMSETZUNG-WELLE-4B-4.md`.

| OP     | Ergebnis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OP-175 | **behoben** — und zwar **gegen** das Beilegen der PDF entschieden: `documents/[id]/download` setzt am Berichtsdokument vier Kontrollen durch (Wasserzeichen S06-07, SHA-256-Abgleich S06-09, Protokolleintrag je Download S06-08, Rohfassung nur admin/quality_manager), das Pack steht aber vier Rollen offen. Die Bytes hineinzukopieren wäre ein Weg an allen vieren vorbei gewesen. Die README nennt jetzt Titel, Dokumentkennung und den kontrollierten Downloadpfad.                                                                                                                                                                                                             |
| OP-176 | **6 von 7** Routen wirken jetzt; **4** Parameter bleiben mit Begründung offen — siehe unten.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| OP-177 | **behoben.** Die vom ursprünglichen Autor offengelassene Auflösung ist im Schema eindeutig: `audit_qa_review.reviewer_id` → `"user"(id)`, und `audit_resource_allocation.auditor_id` → `auditor_profile(id)` → `auditor_profile.user_id` → `"user"(id)` mit UNIQUE `ap_user_idx`, also 1:1 und verlustfrei. Beim Nachschlagen kamen **zwei weitere** Konfliktwege heraus, die der Kopfkommentar nicht nannte: `audit.lead_auditor_id` und `audit.auditor_ids`. Die Teamliste ist die häufigere Besetzung — nur `audit_resource_allocation` zu prüfen hätte wieder eine Kontrolle ergeben, die selten trifft. Jetzt drei Konfliktwege und zwei Vorbedingungen, 422 mit `conflict`-Feld. |
| OP-179 | **behoben** — `UNION ALL`-Verzeichnis, darauf `LIMIT/OFFSET`, `count(*)` und Facetten sehen **dieselbe volle Menge**, feste Sortierung. `?page=abc` wird abgefangen (hätte mit OFFSET einen Datenbankfehler ergeben).                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| OP-180 | **2 von 2 behoben** — `entity_type` steht in der DELETE-Bedingung, die Szenarien sind über `simulation_scenario.process_id` an den Prozess gebunden.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

**Der schwerste Fund kam nebenbei:**

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                              | Beleg                                                                                                                                                                                                              | Art     | Stand   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------- |
| OP-182 | **Die Auditorenansicht war seit jeher leer.** `role-dashboards/data/auditor` enthielt `WHERE status = 'open'` gegen den Enum `finding_status` (`identified, in_remediation, remediated, verified, accepted, closed`). Die Abfrage steht **unbedingt** im Pfad, die Route lief also **bei jedem Aufruf in einen 500er**, und die Seite rendert bei fehlendem `data` `null`. Kein Fehlschlag, keine Meldung, nur eine leere Seite. | Eigene Nachmessung 2026-09-03 gegen das laufende Schema: `select 1 from finding where status = 'open'` → `ERROR: invalid input value for enum finding_status: "open"`; alter Code `3dbc48f5:…/auditor/route.ts:54` | Produkt | behoben |

Repariert mit der Hausdefinition `["identified","in_remediation"]`, die fünf
andere Routen bereits verwenden.

**Ein Fallstrick, der ohne Messung gegen die laufende Datenbank durchgegangen
wäre.** Drizzle expandiert ein JS-Array im `sql`-Baustein zur
**Parameterliste**, nicht zum Array: `ANY(${arr}::finding_status[])` wird zu
`ANY(($2, $3)::finding_status[])` und schlägt fehl. Sichtbar erst zur
Laufzeit — mit grünem `tsc`, grünem Lint und grünem Unit-Test wären drei
Bedingungen in Produktion gefallen. Daher `api/v1/_lib/pg-array.ts`. Das ist
dieselbe Klasse wie OP-182 und wie der `as any`-Befund aus Strang 3: **der
Compiler beruhigt, die Datenbank entscheidet.**

**Was mit Begründung offen bleibt** (nicht behoben, weil es kein Ziel gibt):

- `status` in `role-dashboards/data/auditor`, `departmentId` und `timeRange` in
  `role-dashboards/data/department-manager`, `depth` in
  `predictive-risk/correlations`.
- `departmentId` hat **beweisbar kein Ziel**: `task` hat keine Abteilung,
  `risk.department`/`control.department` sind `varchar`, `eam_org_unit` hängt
  nur an `eam_business_context`/`process_lane`. Dahinter steckt der eigentliche
  Befund: Die Route filtert auf `assignee_id = ctx.userId` — ein
  „Abteilungsleiter"-Dashboard **ohne Abteilungsbegriff**. Das ist Produktarbeit,
  kein Nachziehen.
- Die Marktplatzsuche wirkt in der Oberfläche noch nicht:
  `extensions/marketplace/page.tsx` hält `search` im Zustand und sendet es nie
  (ausserhalb der Dateihoheit dieses Strangs).

### Nachtrag 2026-09-03 — OP-076/OP-077 erledigt: zwei „Stilregeln", die Defektdetektoren waren

OP-076 (129 `any`), OP-077 (483 tote Bindungen) und der Restbestand von OP-152
(56 `console.*`) in `apps/web/src/app/api/v1/**` sind abgetragen; die
namentlichen Ausnahmen in `apps/web/eslint.config.mjs` sind **ersatzlos
entfernt**. Selbst nachgemessen über alle 1.376 Routendateien: **0 Befunde**,
und die drei Regeln stehen dort nachweislich auf Schwere 2 (`error`) — die
Null kommt nicht daher, dass niemand hinsieht. Einzelheiten in
`docs/UMSETZUNG-WELLE-4B-3.md`.

Gemessen statt geschätzt: `no-unused-vars` **500** (Register: 483) → 0,
`no-explicit-any` **128** (Register: 129) → 0, `no-console` **53**
(Register: 56) → 0.

**Der eigentliche Befund ist nicht die Zahl.** Die beiden abgeschalteten
Regeln waren keine Stilregeln, sondern **Defektdetektoren**. Acht
Produktdefekte hingen an genau der Meldung, die seit WP12 auf `off` stand:

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Art     | Stand                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------ |
| OP-181 | **Vier von fünf Spalten des DSGVO-Meldeprotokolls waren immer leer.** `dpms/data-breach/[id]/notification-pack` griff unter `(n: any)` auf `recipient`, `channel`, `notifiedAt` und `status` zu — **diese Spalten gibt es in `data_breach_notification` nicht** (sie heissen `recipient_email`, `sent_at`, `response_status`; ein `channel` existiert gar nicht; gegen das laufende Schema nachgeprüft). `csv(undefined)` schreibt eine leere Zelle: Das Meldeprotokoll im Paket zu Art. 33/34 DSGVO war seit jeher bis auf die erste Spalte leer, **ohne dass irgendetwas fehlschlug**. | Produkt | behoben                                                      |
| —      | **`resolved_at` blieb beim Abschluss eines KI-Vorfalls leer.** In `ai-act/incidents/[id]` wurde `resolvedClause` gebaut und nie in das UPDATE eingesetzt. Für Art. 73 KI-VO ist der Abschlusszeitpunkt ein berichtspflichtiges Datum.                                                                                                                                                                                                                                                                                                                                                    | Produkt | behoben                                                      |
| OP-177 | **Die Unabhängigkeitsprüfung des QA-Reviewers findet nicht statt.** In `audit-mgmt/qa-review` steht die Abfrage unter der Überschrift „reviewer must NOT be in audit_resource_allocation" — ihr Ergebnis liest niemand. Ein Mitglied des Prüfteams kann sich selbst als QA-Reviewer eintragen.                                                                                                                                                                                                                                                                                           | Produkt | **offen**                                                    |
| OP-178 | **`catalogs/active-entries` baut SQL per Zeichenkette** (`WHERE org_id = '${ctx.orgId}'`). Beide Werte sind heute nicht steuerbar, die Form ist trotzdem falsch. Eine zweite Abfrage war **tot und immer fehlschlagend** (`$1::uuid[]` ohne Parameter) und wurde von einem leeren `catch` verschluckt.                                                                                                                                                                                                                                                                                   | Produkt | behoben                                                      |
| OP-179 | **Der EAM-Katalog kann nicht geblättert werden.** `offset` wurde berechnet und nie angewandt — jede Seite ist die erste.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Produkt | **offen** (Fassung von `total` und Facetten ist mitzuklären) |
| OP-176 | **Sieben Routen prüfen einen Parameter und werfen ihn weg** (`timeRange`, `framework`, `minCorrelation`, `search`, `page` …). Die Eingabeprüfung bleibt, die Wirkung fehlt.                                                                                                                                                                                                                                                                                                                                                                                                              | Produkt | **offen**                                                    |
| OP-180 | **Zwei Routen werten ihr Pfadsegment nicht aus** (`import/mappings/[entityType]` DELETE; `processes/[id]/simulation/compare`). Organisationsgebunden, also kein Mandantenleck — aber die URL verspricht mehr, als der Handler prüft.                                                                                                                                                                                                                                                                                                                                                     | Produkt | **offen**                                                    |
| OP-175 | **Ein Paket kündigt eine Datei an, die es nie enthält** (`report.pdf` im Audit-Pack).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Produkt | **offen**                                                    |
| OP-174 | **Roher Treibertext in der Antwort** (`programmes/journeys/[id]/next-actions`) — dieselbe Reparatur wie in der Schwesterroute aus E2E-TRIAGE-2026-09-02, diese Datei war dort nicht erfasst.                                                                                                                                                                                                                                                                                                                                                                                             | Produkt | behoben                                                      |

Dazu zwei Befunde, die keine eigene Nummer brauchen, aber die Richtung zeigen:
`processes/[id]/dmn-links` gab die DMN-Entscheidungen **fremder Prozesse**
zurück (behoben), und `reports/soa` zählte „Teilweise umgesetzt", übersetzte es
in beiden Sprachen — und liess die Kachel weg, so dass die Kachelzeile nicht
aufging (behoben).

**`as any` hatte eine Wirkung, nicht nur eine Typlücke.** Nachgemessen:
`SELECT … WHERE status = 'bogus'` → `ERROR: invalid input value for enum
wb_case_status`. Ein Tippfehler im Filter wurde damit zum **500er**; im
SSO-Rückkanal machte derselbe Cast einen Tippfehler in der IdP-Rollenzuordnung
zum **fehlgeschlagenen Login**. Jetzt 422 beziehungsweise Rückfall auf
`viewer`, geprüft über `column.enumValues`. Das ist der Punkt: Der Cast hat den
Compiler beruhigt und den Fehler an die Datenbank weitergereicht.

**Was daraus für dieses Register folgt.** Eine abgeschaltete Lint-Regel ist
hier kein Stilverzicht gewesen, sondern ein **abgeschalteter Detektor** — und
sie stand mit der Begründung „800 Diff-Zeilen in fremden Dateien" seit WP12
aus. Die Diff-Zeilen kamen; acht Produktdefekte kamen mit. Sie waren die ganze
Zeit sichtbar, es sah nur niemand hin.

Randbefund: 16 Routen importierten `requireModule` und riefen es nie auf — für
`data-sovereignty` und `role-dashboards` gibt es gar keinen Modulschlüssel. Der
Import war Kopiervorlage und **las sich wie eine vorhandene Prüfung**.

### Nachtrag 2026-09-03 — OP-152 erledigt, und drei Punkte, die dabei auffielen

OP-152 ist abgetragen: `no-console` fällt im gemessenen Bereich der Ratsche von
**23 auf 0**, die Gesamtzahl von 306 auf 283. Einzelheiten in
`docs/UMSETZUNG-WELLE-4B-2.md`. Drei Beobachtungen gehören ins Register, weil
sie über den Punkt hinausreichen.

| OP     | Was                                                                                                                                                                                                                                                                                                                                | Beleg                     | Art     | Stand   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------- | ------- |
| OP-171 | **Die Ratsche sah 23 Befunde, wo 88 Aufrufe standen.** Die Regel war nicht aus, sie war nachsichtig: `allow: ["warn","error","info","debug"]` nahm genau die vier Stufen aus, auf denen man ein Fehlerobjekt ausgibt — also die Form, um die es bei OP-152 geht. Gezählt wurde nur `console.log`.                                  | Eigene Messung 2026-09-03 | Tor     | behoben |
| OP-172 | **`redactEmail` liess den ersten Buchstaben des lokalen Teils stehen** (`p***@domain`) und schrieb ihn auf dem VORGABEPFAD der Produktion (`EMAIL_ENABLED=false`) an den Log-Empfänger. Die Begründung an der Aufrufstelle sagt seit S10-24, Vorlagenschlüssel und Domain reichten zur Diagnose — der Buchstabe war nie gefordert. | Eigene Messung 2026-09-03 | Produkt | behoben |
| OP-173 | **`apps/web` hat keine Lint-Ratsche.** Der grösste Workspace des Repositories wird von `.eslint-ratchet.json._targets` nicht erfasst; sein Bestand an Lint-Befunden ist nicht gedeckelt. Bis Welle 4b kannte seine Konfiguration ausserdem `no-console` überhaupt nicht.                                                           | Eigene Messung 2026-09-03 | Tor     | offen   |

**Was OP-171 mit den bisherigen Funden verbindet.** Es ist der fünfte Fall
derselben Art in diesem Audit: ein Tor, das nicht auslösen kann. Vorher waren es
eine ausgeschlossene Tor-Eingabe, ein `git diff` auf ungetrackte Pfade, ein
`tee` ohne `pipefail`, ein Datenbanktest, der an seiner eigenen Vorbedingung
starb (OP-168), und eine Suite, die ihre Voraussetzung erriet (OP-170). Hier
war es eine Ausnahmeliste, die das Gefährliche durchliess und das Harmlose
zählte.

**Was bei OP-172 methodisch wichtig ist.** Der neue Logger maskiert
adressartige Werte von sich aus (`p***@domain`, nachgemessen). Das ist
Tiefenverteidigung — hatte aber zur Folge, dass die bestehende Zusicherung
„schreibt die Empfängeradresse nicht nach stdout" **nicht mehr unterscheiden
konnte**, ob der `EmailService` selbst redigiert: Die Gegenprobe mit entfernter
Quell-Redigierung lief grün. Erst nachdem `redactEmail` vollständig redigiert
(`***@domain`), trennt der Unterschied zur blossen Logger-Maskierung die beiden
Schichten wieder. Ein zusätzlicher Schutz kann eine Zusicherung blind machen;
das ist kein Grund gegen den Schutz, wohl aber einer, die Zusicherung danach
neu gegenzuprüfen.

### Nachtrag 2026-09-03 — OP-170: eine Suite, die ihre eigene Voraussetzung erriet

Beim Gesamtlauf gegen die frisch migrierte Datenbank `grc_v4b` fiel
`organizations-create-rls.test.ts` aus — und zwar als vermeintlicher
RLS-Defekt. Er war keiner.

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Beleg                                                                                      | Art  | Stand   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---- | ------- |
| OP-170 | **Die Routenketten-Suite lief still gegen die falsche Datenbank und notfalls unter der falschen Rolle.** Jede der vier Dateien hatte einen fest verdrahteten Rueckfallwert auf `…/grc_platform`. Fehlte `APP_DATABASE_URL`, legte der privilegierte Kanal die Fixtures in der einen Datenbank an, waehrend die geprüfte Rolle in einer **anderen** suchte. Fehlte sie ganz, konnte die Suite als SUPERUSER laufen und trotzdem gruen melden — ein Test namens „unter grc_app", der die Rolle nie sah. | Eigene Messung 2026-09-03: `DATABASE_URL` → `grc_v4b`, `APP_DATABASE_URL` → `grc_platform` | Test | behoben |

**Warum das hierher gehoert.** Es ist zum vierten Mal dasselbe Muster:
_die Wache ueber der Sache war kaputt_. Ein Test, der seine eigene
Voraussetzung erraet, prueft etwas anderes als sein Name behauptet — und der
Rueckfallwert war nicht nur unnoetig, er war irrefuehrend: Der Fehlschlag las
sich wie ein Mandantentrennungsproblem und war ein Umgebungsfehler.

**Behebung.** Ein Setup-Modul
(`src/__tests__/rls-route-chain/setup-require-roles.ts`, in
`vitest.rls.config.ts` als `setupFiles` eingehaengt) bricht ab, wenn eine der
beiden Verbindungen fehlt **oder** wenn sie auf verschiedene Datenbanken
zeigen. Die fuenf fest verdrahteten Rueckfallwerte in den vier Dateien sind
entfernt. Nachgemessen in drei Lagen: ohne `APP_DATABASE_URL` bricht die
Suite ab, bei verschiedenen Datenbanken bricht sie ab und nennt beide Namen,
richtig gesetzt laeuft sie (4 Dateien, 24 Tests). Die CI setzt beide Werte
bereits auf dieselbe Datenbank (`grc_platform_test`), ist also nicht
betroffen.

### Nachtrag 2026-09-03 — die Canary, und was sie widerlegt hat

Auf Weisung des Eigentümers („probiere erst mal die canary") wurde
**Next 16.4.0-canary.15** gemessen. Vier weitere Bauläufe, diesmal mit einer
Vorsichtsmassnahme aus dem eigenen Fehler von gestern: die Typprüfung wurde
über den bestehenden, umgebungsgeschützten Schalter
`ARCTOS_BUILD_IGNORE_TS_ERRORS=1` übersprungen — nicht um Fehler zu
verstecken, sondern damit der Bau die **Erzeugungsphase überhaupt erreicht**,
in der der Absturz sitzt. Genau daran war die Messung zu 16.3.4 gescheitert.

**(1) Die Canary hilft nicht.** `✓ Compiled successfully in 63s`, dann
`Collecting page data`, dann `Generating static pages (516/688)` und derselbe
Abbruch: `Error occurred prerendering page "/_global-error"` ·
`TypeError: Cannot read properties of null (reading 'useContext')` ·
`STANDALONE_SERVER_JS=MISSING`. Diesmal ist die Erzeugungsphase nachweislich
erreicht worden; die Messung ist vollständig.

**(2) Ein Arbeiter statt 31 — und damit fällt die bisherige Erklärung.**
Mit `experimental.cpus: 1` bricht der Bau bei **`(0/688)`** ab, also an der
allerersten Seite. Damit ist die bisherige Zuordnung zu
vercel/next.js#95741 („route batching during static generation")
**widerlegt**: Der Fehler hängt weder an der Zahl der Seiten noch an der
Stapelbildung. Er ist deterministisch und trifft `/_global-error` als Erstes.
Der beobachtete Umschlag bei 685→688 Seiten war ein Zufall der
Arbeiterverteilung, nicht die Ursache. Diese Korrektur betrifft eine Aussage,
die dieses Register selbst aufgestellt hat — sie wird hier nicht
stillschweigend ersetzt, sondern benannt.

**(3) Ohne unsere `global-error.tsx` — derselbe Absturz.** Die Datei wurde für
einen Baulauf beiseitegelegt, so dass Next seine **eigene** Vorgabeseite
erzeugt. Ergebnis: identischer Fehler an identischer Stelle. Damit liegt der
Defekt beweisbar **nicht** in unserem Code. Die Datei ist wiederhergestellt.

**(4) Ohne das next-intl-Plugin — derselbe Absturz.** `withNextIntl` wurde für
einen Baulauf umgangen. Identischer Fehler. Damit scheidet auch eine
Wechselwirkung mit der Übersetzungsschicht aus. Die Konfiguration ist
wiederhergestellt.

**Was daraus folgt.** Der Absturz ist ein Fehler in Turbopacks
Produktions-Erzeugung der synthetischen Route `/_global-error` — ohne Zutun
unseres Codes, unserer Konfiguration und unserer Abhängigkeiten, und in
16.2.11, 16.3.4 und 16.4.0-canary.15 gleichermassen. Der Fehlerbericht kann
jetzt mit vier trennscharfen Messungen statt einer Korrelation angereichert
werden; die Zuordnung zu #95741 ist zurückzunehmen.

### Vorlage an den Eigentümer

Beide gemessenen Wege scheiden aus: `--debug-prerender` darf laut Next-Doku
nicht deployt werden, `--webpack` erzeugt strengere Routentypen und bräuchte
Nacharbeit an über tausend Routen, und 16.3.4 behebt den Fehler nicht.

Was bleibt, ist eine Entscheidung des Eigentümers:

1. **Auf einen Fix warten** und den Fehlerbericht mit unseren sechs Messungen
   anreichern (vercel/next.js#95741 sucht ausdrücklich Reproduktionen „mit der
   Grösse eines echten Produktionsbaums").
2. **Auf Webpack wechseln** und die Routentypen nachziehen — bezifferbare
   Arbeit, aber sie nimmt die Turbopack-Entscheidung aus `cea14434` zurück.
3. **Eine Canary-Fassung von 16.3.x prüfen**, in der der Fehler möglicherweise
   behoben ist.

Bis dahin ist der Produktionsbau blockiert und mit ihm der Playwright-Lauf.
Alles andere — 13 Typprüfungen, 6.680 Tests, 426 Migrationen von Null, die RLS-
und Integritätssuiten und alle Tore — ist grün und von diesem Punkt nicht
berührt.

### Nachtrag 2026-09-09 — Welle 8j: das Provisionierungsskript konnte keinen Fehler melden

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Beleg                                                                                                  | Art     | Stand   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------- | ------- |
| OP-240 | **`deploy/provision-grc-app.sh` hat drei Fehlerprüfungen, und alle drei konnten nie auslösen.** Das Muster war `grep -E '^(ERROR\|FATAL):'` — mit Anker. psql stellt einer Fehlerzeile aber seinen eigenen Ortsvermerk voran, sobald es aus einer Datei liest, und der Wrapper `psql_db` liest über `-f -` genau so. Damit meldeten Rollenanlage, Worker-Rolle und der gesamte Grant-Block **ausnahmslos Erfolg** — auch bei abgebrochenem SQL und selbst bei abgelehnter Verbindung. | Eigene Messung 2026-09-09, Container-Postgres 16                                                       | Tor     | behoben |
| OP-241 | **Vier Jobs in zwei Workflow-Dateien provisionierten in der falschen Reihenfolge**, und die Korrektur aus OP-238 hat den Fehler nur verschoben: das Skript lief nun _ganz_ vor den Migrationen, also vergab es `GRANT … ON ALL TABLES` auf eine leere Datenbank. Das Skript hat jetzt zwei Phasen (`--nur-rollen` vor den Migrationen, der volle Lauf danach), und eine Prüfung hält die Reihenfolge in jedem Job fest.                                                               | CI-Lauf `34340833273` (`schema-drift.yml`); `ci.yml` Jobs `integration-tests`, `e2e-smoke`, `database` | Betrieb | behoben |

**Wie OP-240 gefunden wurde.** Nicht durch Lesen. Der CI-Lauf `34340833273`
meldete in `schema-drift.yml` genau den Befund, den die Abnahme aus OP-238
sucht: `grc_app darf app_current_org_scope() NICHT ausführen`. Beim Nachstellen
im Container fiel auf, dass der Schritt davor — derselbe Lauf, dieselbe
Datenbank — `✓ grc_drift: Grants + Default-Privileges + FORCE RLS gesetzt.`
gesagt hatte. Beides zugleich kann nicht stimmen.

Nachgemessen an einer leeren Datenbank:

```
$ psql -d leer -f - < grant-block.sql
psql:<stdin>:90: ERROR:  grc_app hat auf keine einzige Tabelle SELECT — Grants wirkungslos

$ … | grep -E '^(ERROR|FATAL):'
(keine Ausgabe)
```

Die Selbstprüfung am Ende des Grant-Blocks (`RAISE EXCEPTION`, eingebaut unter
WP2/S01-10 gegen genau diesen Fall) hat die ganze Zeit korrekt ausgelöst. Nur
gehört hat sie niemand. Beim Nachmessen kam eine dritte Fehlerform dazu, die
der Anker ebenfalls nicht traf — `psql: error: connection to server … failed:
FATAL: password authentication failed`: auch bei **abgelehnter Verbindung**
meldete das Skript `✓ Rolle grc_app bereit.`, ohne eine einzige Anweisung
ausgeführt zu haben.

Gegenprobe, gemessen:

| Lauf                               | vorher                     | nachher                                                     |
| ---------------------------------- | -------------------------- | ----------------------------------------------------------- |
| leere Datenbank, voller Lauf       | `✓ … gesetzt.`, Exit **0** | `✗ … Grants wirkungslos`, Exit **1**                        |
| `--nur-rollen`, leere Datenbank    | (gab es nicht)             | `✓ Rolle grc_app bereit.`, Phase 2 übersprungen, Exit **0** |
| Datenbank mit Tabelle, voller Lauf | `✓`, Exit 0                | `✓`, Exit 0 — unverändert                                   |

**Warum OP-241 kein zweiter Anlauf von OP-238 ist.** OP-238 war richtig
diagnostiziert (die Rolle muss vor den Migrationen da sein, sonst fällt der
`IF EXISTS`-Grant aus `0396_rls_log_tables.sql:117` still aus) und falsch
behoben: ich habe den **ganzen** Aufruf vor die Migrationen gezogen. Das
Skript hat aber zwei Phasen mit zwei verschiedenen richtigen Zeitpunkten —
die Rolle davor, die Grants danach, weil `GRANT … ON ALL TABLES IN SCHEMA
public` nur auf die Tabellen wirkt, die es im Moment des GRANT gibt. Dass das
in CI trotzdem grün aussah, lag an OP-240.

**Die Prüfung.** Vier gleiche Fälle in zwei Dateien sind eine Klasse, und die
Antwort auf eine Klasse ist eine Prüfung, keine fünfte Einzelkorrektur:
`scripts/check-provision-order.mjs` liest jeden Workflow-Job und verlangt die
Rollen vor der ersten und die Grants nach der letzten Migration. Sie ist als 13. Tor-Eingabe eingetragen und meldet beide Nullfälle als Befund (Skript
fehlt, oder kein Job ruft es auf) — ein Tor, das ohne Eingabe grün ist, ist
kein Tor (OP-092).

Gegenproben, gemessen — jeweils mit dem Fehlschlag im Protokoll:

- Rollen-Hälfte aus `schema-drift.yml` entfernt (Stand vor dieser Welle):
  Exit 1, `Job schema-and-rls migriert (Zeile 88), ohne vorher die Rollen anzulegen`.
- `ci.yml` auf den ausgelieferten Stand zurückgesetzt: Exit 1, **sechs**
  Befunde über die Jobs `integration-tests`, `e2e-smoke`, `database` — je
  einer für die fehlende Rollen-Hälfte und einer für die Grants vor der
  Migration.
- `deploy/provision-grc-app.sh` entfernt: Exit 1 statt „0 Jobs, grün".

### Nachtrag 2026-09-09 — Welle 8j, zweiter Befund: ein Tor, das würfelt

| OP     | Was                                                                                                                                                                                                                                                                                                                                                              | Beleg                                                                       | Art | Stand   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --- | ------- |
| OP-242 | **Der Job `Lint & Type Check` lag mit 9m09s bis 10m14s auf seinem 10-Minuten-Budget** — sein Ergebnis hing an der Tagesform des Runners, nicht am Code. Und die sechs Prüfschritte hinter dem Typecheck (Tor-Eingaben, OP-Nummern, Punkte-Index, Workflow-Prüfungen) sind in beiden roten Läufen nie gelaufen, obwohl sie zusammen unter einer Sekunde brauchen. | Läufe `34329853763` ✓ 9m09s, `34327735425` ✗ 10m12s, `34341489367` ✗ 10m14s | Tor | behoben |

**Gemessen aus dem Protokoll von `34341489367`** — Schrittdauern, aus den
Zeitstempeln der `##[group]`-Marken:

| Schritt              | Dauer        |
| -------------------- | ------------ |
| `npm ci`             | 27 s         |
| ESLint (apps/web)    | 1 m 05 s     |
| ESLint-Ratsche       | 1 m 18 s     |
| Dead-Exports-Ratsche | 2 s          |
| Prettier             | 53 s         |
| **tsc — web**        | **5 m 32 s** |
| tsc — worker         | 27 s         |
| tsc — alle Pakete    | abgebrochen  |

Der Typecheck ist zwei Drittel des Jobs und hat mit Lint nichts zu tun. Er
läuft jetzt als eigener Job `typecheck` (Budget 20 Minuten) parallel zu
`lint` (Budget 10, gemessener Bedarf rund 4 Minuten); die vier nachgelagerten
Jobs hängen an `needs: [lint, typecheck]`, verlieren also keine Absicherung.
`npm ci` fällt dafür ein zweites Mal an — rund 27 Sekunden, und damit
billiger als ein Tor, dessen Aussage vom Zufall abhängt.

**Warum das kein reines Budgetproblem ist.** Die naheliegende Antwort wäre
`timeout-minutes: 20` für denselben Job gewesen. Sie hätte den Lauf grün
gemacht und die eigentliche Eigenschaft gelassen: ein serieller Block, in dem
ein langsamer Schritt sechs schnelle Prüfungen mit sich reißt, die er nicht
einmal kennt. Genau so sind in den Läufen `34327735425` und `34341489367`
die Prüfungen aus den Wellen 8f–8j nie zur Ausführung gekommen.

### Nachtrag 2026-09-09 — Welle 8k: was Next 16.3.4 an der Oberfläche gefunden hat

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                       | Beleg                                                           | Art           | Stand   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------- | ------- |
| OP-243 | **Sieben Stellen in `apps/web` navigierten mit `window.location.href` statt mit dem Router** — jede davon ein vollständiger Seitenneuaufbau mitten in der Anwendung: React-State weg, Übersetzungen und Layout neu geladen, sichtbares Flackern. Gefunden von der neuen Regel `@next/next/no-location-assign-relative-destination`, die mit Next 16.3.4 dazugekommen ist. | Lauf `34342970651`, Job `Lint & Type Check`; lokal nachgemessen | Produktdefekt | behoben |

**Die Ratsche hat das Richtige getan.** `apps/web` ist seit Welle 4b-5 bei
**0** gedeckelt, und der Lauf meldete:

```
[apps/web] . (cwd apps/web): 7 Befunde (Baseline 0), 2301 Dateien.
      7  @next/next/no-location-assign-relative-destination  (Baseline 0)
✗ Neue Regelverletzung … — in der Baseline nicht vorhanden.
  Beheben, nicht in die Ratsche aufnehmen.
```

Genau so ist es gemacht worden — die Ratsche steht unverändert bei 0.

**Sechs der sieben** waren Navigationen zu eigenen Seiten und sind auf
`useRouter().push()` umgestellt (`admin/languages`, `admin/languages/queue`
je zweimal, `isms/assets`, `organizations/new`). In den ersten beiden Dateien
gab es den Hook noch nicht; er ist dazugekommen.

**Die siebte** ist ein CSV-Export
(`/api/v1/audit-mgmt/audits/…/export?format=csv`, ISO 17021-1 § 9.5) und
damit weder Seitennavigation noch ein Fall für eine Ausnahme: `router.push`
wäre hier falsch, weil es die API-Route als Seite zu laden versuchte. Sie ist
jetzt ein `<a download>` im `asChild`-Button — der Browser holt die Datei, die
Seite bleibt stehen. **Kein `eslint-disable`.**

**Nachgemessen:** Ratsche `apps/web` 7 → 0 Befunde, `root` unverändert 44;
`tsc --noEmit -p apps/web/tsconfig.json` grün.

**Am Rande, aus demselben Lauf:** `Type Check` brauchte 8m47s und `Lint`
3m00s — zusammen 11m47s gegen das 10-Minuten-Budget, das der gemeinsame Job
hatte. Die Trennung aus OP-242 war keine Kosmetik; ohne sie wäre dieser Befund
zum vierten Mal in einem Timeout verschwunden.

### Nachtrag 2026-09-09 — Welle 8l: zwei Befunde aus dem Abhängigkeits-Update

| OP     | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Beleg                                                                  | Art                          | Stand                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------- | ---------------------- |
| OP-244 | **`Review Dependencies` meldet `jszip` als GPL — das Paket ist aber doppelt lizenziert.** Die eigene Angabe lautet `(MIT OR GPL-3.0-or-later)`; die GitHub-Lizenzdatenbank normalisiert das zu „GPL-3.0-only OR MIT", und die Action bewertet einen ODER-Ausdruck nicht als Wahl, sondern fällt über den Zweig auf der Sperrliste. Sie meldet also nicht, dass GPL-Code ausgeliefert wird, sondern dass sie den Ausdruck nicht auswerten kann.                                                                                                                                                                                                                                                                                                                                                                         | Lauf `34345848114`                                                     | Tor                          | behoben                |
| OP-245 | **`eslint-plugin-react-hooks` 7.0.1 → 7.1.1 bringt 416 neue Fehler in 354 Dateien — ohne dass sich eine Zeile Anwendungscode geändert hätte.** 384 davon `react-hooks/set-state-in-effect`, die Regel, die Welle 7b mit 20 Fundstellen auf 0 gebracht hat. Der Sprung ist die Regel, nicht der Code. **Nachtrag 2026-09-09 (lokale Sitzung, OP-234):** Weg A vorläufig genommen — exakte devDependency `eslint-plugin-react-hooks@7.0.1` in apps/web, Ratsche wieder 0/0. **Entscheidung des Eigentümers am 2026-09-09: Weg B** — die neuere Version bleibt, die 416 Stellen werden abgearbeitet; übergeben an die lokale Sitzung, Auftrag in `docs/HANDOVER-OP-245.md`. **Umgesetzt 2026-09-09 (lokale Sitzung):** alle 416 Stellen abgetragen, Pin entfernt, ESLint mit 7.1.1 auf 0 — Nachtrag 2026-09-09 zu OP-245. | Eigene Messung 2026-09-09 gegen `a3ff1b07`, bestätigt gegen `29224b2f` | Entscheidung des Eigentümers | **behoben 2026-09-09** |

**OP-244, warum das keine Aufweichung ist.** Der Eintrag steht in
`allow-dependencies-licenses`, aber aus einem anderen Grund als trufflehog:
trufflehog ist AGPL und läuft nur in CI, jszip liegt im Web-Bundle
(Offline-Prüfarchiv, ADR-011 rev.3). Die Begründung ist nicht „läuft nur in
CI", sondern „ist gar kein Copyleft-Paket" — der Urheber räumt die Wahl
ausdrücklich ein, ARCTOS nimmt MIT. Die Regel „nur CI-/Dev-Werkzeuge in dieser
Liste" gilt unverändert weiter; dieser Eintrag ist die benannte Ausnahme davon
und fällt weg, sobald die Action ODER-Ausdrücke auswertet. jszip kam mit
`ccd171f4` und liegt in `main` — neu ist die Meldung, nicht das Paket: erst
`3.10.1 → 3.10.2` aus OP-234 hat es in den PR-Diff gebracht, den die Action
prüft.

**OP-245, die Messung.** Gegen denselben Commit `a3ff1b07`, dieselbe
`apps/web/eslint.config.mjs`, nur die Version des Plugins getauscht:

| `eslint-plugin-react-hooks` | Fehler in `apps/web`  |
| --------------------------- | --------------------- |
| 7.0.1                       | **0**                 |
| 7.1.1                       | **416** (354 Dateien) |

Aufgeschlüsselt bei 7.1.1:

| Regel                                     | Fundstellen |
| ----------------------------------------- | ----------- |
| `react-hooks/set-state-in-effect`         | 384         |
| `react-hooks/refs`                        | 15          |
| `react-hooks/purity`                      | 9           |
| `react-hooks/static-components`           | 4           |
| `react-hooks/immutability`                | 3           |
| `react-hooks/preserve-manual-memoization` | 1           |

**Warum das eine Entscheidung ist und keine Aufgabe.** Welle 7b hat
`set-state-in-effect` einzeln durchgearbeitet — 20 Fundstellen, sieben
Gestalten, jede mit eigener Auflösung (`@tanstack/react-query`, Einhängen
statt Effekt, `useSyncExternalStore`, Ableitung beim Rendern), Beleg in
`docs/UMSETZUNG-WELLE-7B.md`. Auf denselben Maßstab gebracht sind 384
Fundstellen in 354 Dateien kein Audit-Befund mehr, sondern ein eigenes
Vorhaben in der Größenordnung XL — und der Anlass ist ein Minor-Sprung eines
Lint-Plugins, nicht ein Defekt, den jemand eingebaut hat.

Drei Wege, alle mit ihrem Preis:

| Weg                                                                                           | Was er kostet                                                                  | Was er aufgibt                                                                                   |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **A** `eslint-plugin-react-hooks` auf `~7.0.1` festnageln, OP-245 als eigenes Vorhaben führen | eine Zeile; das Sicherheits-Update aus OP-234 (Next, sharp) bleibt vollständig | die neuen Prüfungen wirken vorerst nicht — datiert und benannt, nicht vergessen                  |
| **B** die 416 jetzt abarbeiten                                                                | 354 Dateien, Maßstab Welle 7b; Wochen, nicht Stunden                           | die Testinstanz bleibt so lange auf dem alten Stand                                              |
| **C** die sechs Regeln auf `warn` und unter die Ratsche mit dem gemessenen Stand              | wenige Zeilen; die Zahl kann nur noch fallen                                   | `apps/web` ist nicht mehr bei 0 gedeckelt — der Deckel, den Welle 4b-5 gesetzt hat, wird weicher |

**Entschieden am 2026-09-09: Weg B.** Der Eigentümer hält an der neueren
Version fest — „da wir die neuere Version nutzen wollen". Die 416 Stellen
werden abgearbeitet, nicht umgangen. Weg A bleibt bis zum Abschluss als
**Gerüst** stehen (die exakte devDependency `7.0.1` in `apps/web`), damit der
Lint-Job währenddessen etwas aussagt statt pauschal rot zu sein; er fällt im
**letzten** Commit dieser Arbeit, zusammen mit den Korrekturen, die die Zahl
auf 0 bringen.

Weder Weg A noch Weg C sind dabei stillschweigend mitgenommen worden: keine
Regel ist abgeschaltet, die Ratsche steht unverändert bei 0, und kein
`eslint-disable` ist gesetzt.

**Übergeben an die lokale Sitzung.** Der vollständige Auftrag steht in
`docs/HANDOVER-OP-245.md`: die nachgemessene Aufteilung (346 der 384
`set-state-in-effect`-Fundstellen sind **dieselbe** Gestalt — Abruf beim
Einhängen; 321 der 344 betroffenen Dateien liegen unter
`src/app/(dashboard)` und tragen **genau eine** Fundstelle), das bereits im
Repository vorhandene Vorbild aus Welle 7b
(`catalogs/objects/page.tsx`, `@tanstack/react-query` 5.102.8 ist installiert
und in 17 Dateien im Einsatz), die vollständige Aufzählung der 32
Nicht-`set-state`-Befunde, und die Reihenfolge: erst **eine** Pilotdatei zur
Abstimmung der Gestalt, dann Stapel je Verzeichnis, dann die Einzelfälle,
zuletzt der Pin.

**Eine Warnung ist im Auftrag ausdrücklich vermerkt.** Vier der 15
`refs`-Befunde liegen in `components/bpmn/arctos-bpmn-canvas.tsx` — der
eigenen Engine. Wo die Regel recht hat und die Behebung ein Umbau wäre, gehört
das in dieses Register, nicht in ein erzwungenes Refactoring.

### Nachtrag 2026-09-09 — Welle 8m: die zwei CI-Punkte aus OP-245, beide in `.github/workflows/**`

Die lokale Sitzung hat OP-251 und OP-253 benannt und ausdrücklich nicht
angefasst, weil `.github/workflows/**` bei der Cloud-Sitzung liegt. Beide sind
hier behoben.

| OP     | Was                                                                                                                                                                           | Beleg                                         | Art     | Stand   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------- | ------- |
| OP-251 | **Der E2E-Smoke-Job legte die Konten nie an, auf die er sich anmeldet — und das Passwort kam aus einer Quelle, aus der es gar nicht kommen kann.**                            | Lauf `34371008020`; eigene Messung 2026-09-09 | Betrieb | behoben |
| OP-253 | **Der Unit-Job starb an einem Paketspiegel, den er nicht braucht** — der Google-Chrome-Quelle des Runner-Images. Drei von vier Anläufen an einem Tag, bevor je ein Test lief. | Lauf `34382535195`, Versuche 1–3              | Betrieb | behoben |

**OP-253 — die Abhilfe ist eine Action, nicht drei Kopien.** Der Schritt
begann mit `sudo apt-get update -qq` unter `set -euo pipefail`; rotiert der
Chrome-Index gerade, endet das mit `Hash Sum mismatch` und Exit 100, und der
Job ist tot, bevor ein Test läuft. Betroffen waren **drei** Stellen in **zwei**
Dateien — `ci.yml` (`unit-tests`, und `e2e-smoke` über
`playwright install --with-deps`, das intern `apt-get` ruft) und
`coverage.yml`. Drei gleiche Fälle sind eine Klasse.

`.github/actions/apt-ohne-fremdquellen` schaltet vor jedem apt-Zugriff **alle**
Fremdquellen unter `sources.list.d` ab — nicht über einen festen Dateinamen,
der still wirkungslos wäre, sobald das Image ihn ändert, sondern über alles,
was nicht die Ubuntu-Quelle ist, mit gezählter Ausgabe. Zwei Sicherungen
gehören dazu: bleibt danach **keine** Ubuntu-Quelle übrig, bricht die Action ab
(sonst wäre die Folgemeldung `Unable to locate package` und damit irreführend);
und der Exit-Code von `apt-get update` entscheidet nichts mehr — die Frage ist,
ob sich die gebrauchten Pakete installieren lassen, und die beantwortet
`apt-get install`, das weiterhin hart fällt. Ein kaputter **Ubuntu**-Index wird
also nicht verschluckt, er fällt eine Zeile später mit der richtigen Meldung.

`scripts/check-apt-sources.mjs` hält das fest: jeder Job, der `apt-get`,
`apt install` oder `playwright install --with-deps` benutzt, muss die Action
vorher aufrufen. Sie ist 14. Tor-Eingabe. Gegenproben, gemessen — der
Fehlschlag jeweils im Protokoll:

- Aufruf im Job `unit-tests` entfernt: Exit 1, `benutzt apt (Zeile 340), ruft
aber ./.github/actions/apt-ohne-fremdquellen nicht auf`.
- Action selbst entfernt: Exit 1 statt „0 Jobs, grün" — dieselbe
  OP-092-Vorsorge wie bei `check-provision-order.mjs`.
- Und noch eine, ungeplant: `check-gate-inputs.mjs` hat die neue Action
  gemeldet, bevor sie `git add` gesehen hatte — „ist NICHT von git verfolgt".
  Das Tor aus OP-090 hat an seinem eigenen Neuzugang funktioniert.

**OP-251 — zwei Fehler, und der zweite ist der interessantere.**

_Erstens:_ `auth.setup.ts` verlangt seit `81200d89` ein `E2E_ROLE_PASSWORD` und
vier Konten, die `db:seed:e2e-users` mit **genau diesem** Passwort angelegt
hat. `ci.yml` hat sie nie angelegt und reichte stattdessen
`secrets.E2E_PASSWORD` durch. Das **kann** nicht stimmen: die Datenbank dieses
Jobs entsteht in diesem Job neu, aus Migrationen und Seed; gegen ein frisch
gehashtes Konto passt nur das Passwort, mit dem es gerade angelegt wurde. Ein
Wert aus den Repository-Secrets ist per Bauart nicht dieses Passwort. Der Job
erzeugt es jetzt selbst aus `/dev/urandom` (24 Zeichen), maskiert es mit
`::add-mask::`, seedet damit und wirft es mit dem Lauf weg. **Kein Secret, kein
Wert im Repository**, und die Konten leben nur in dieser Wegwerf-Datenbank.
`secrets.E2E_EMAIL` behält seinen Sinn — es benennt, welches Konto das primäre
ist, und der Seeder legt genau dieses an.

_Zweitens, und das hätte auch mit richtigem Passwort nicht funktioniert:_
`E2E_ORG_ID` war nicht gesetzt, und die Vorgabe des Seeders ist die
Demo-Mandanten-UUID `ccc4cc1c-4b09-499c-8420-ebd8da655cd7`, die **nur**
`packages/db/sql/seed_demo_00_platform.sql` schreibt. Der E2E-Job läuft aber
`src/seed.ts`, und der legt „Meridian Holdings GmbH" mit einer **erzeugten** id
an. Nachgemessen im Container gegen eine frisch migrierte Datenbank
(429/429 Migrationen, `src/seed.ts` grün):

```
SELECT count(*) FROM organization WHERE id='ccc4cc1c-4b09-499c-8420-ebd8da655cd7';
 0
SELECT id, name FROM organization ORDER BY created_at LIMIT 1;
 3410dec6-35a4-48a6-b112-3541bf91f316  Meridian Holdings GmbH
```

Die id wird deshalb aus der Datenbank gelesen, nicht angenommen; findet der
Schritt keinen Demo-Mandanten, bricht er ab und gibt die vorhandenen
Organisationen aus, statt in eine unverständliche Playwright-Meldung zu laufen.

**Die ganze Kette ist im Container durchgespielt worden**, nicht nur die
Änderung gelesen: Rollen → 429/429 Migrationen → Grants → `src/seed.ts` →
id ermitteln → `seed-e2e-users --org <id>` mit erzeugtem Passwort. Ergebnis
Exit 0, vier Konten:

```
e2e-admin@arctos.local      roles=admin                       memberships=1
e2e-owner@arctos.local      roles=process_owner               memberships=1
e2e-reviewer@arctos.local   roles=auditor,compliance_officer  memberships=2
e2e-approver@arctos.local   roles=admin                       memberships=1
```

Das primäre Konto hält seine einzige Mitgliedschaft im geseedeten Mandanten —
genau die Bedingung, gegen die `auth.setup.ts` `currentOrgId` prüft.

**Was hier NICHT behoben ist.** Das Pilot Readiness Gate fällt ohne
`STAGING_URL` weiterhin laut statt still (#S13-30). Das ist so gewollt und ein
Secret, keine Workflow-Frage — es bleibt beim Eigentümer.

**Nachtrag zu Welle 8m — OP-246, die zwei letzten `npm`-Aufrufe ohne Shell.**
Die lokale Sitzung hat vier Runner-Skripte portabel gemacht (OP-234) und
`scripts/lib/dep-tree.mjs` sowie `scripts/check-dependency-hygiene.mjs` als
noch offen benannt, weil OP-246 ausserhalb ihres Auftrags lag. Sie liegen in
`scripts/**` und sind hier nachgezogen.

`execFileSync("npm", …)` ohne Shell scheitert auf Windows mit `ENOENT`, bevor
irgendetwas läuft — dort heisst das Programm `npm.cmd`, und ohne Shell findet
keine PATHEXT-Auflösung statt. Der Aufrufer bekommt einen Fehler, der nach
„npm kaputt" aussieht und „falscher Dateiname" bedeutet. Sechs Fundstellen in
diesem Audit sind genug für **eine** Stelle statt sechs verstreuter: der Name
steht jetzt in `scripts/lib/npm-befehl.mjs`.

**Die erste Fassung dieser Korrektur war falsch, und nur das Nachmessen auf
Windows hat es gezeigt.** Naheliegend war `npm.cmd` auf Windows. Gemessen auf
der Maschine des Eigentümers:

```
execFileSync("npm",     …)  →  Error: spawnSync npm ENOENT
execFileSync("npm.cmd", …)  →  Error: spawnSync npm.cmd EINVAL
```

Seit der Gegenmaßnahme zu CVE-2024-27980 weigert sich Node, eine `.cmd`-Datei
ohne Shell zu starten. Der verbreitete Rat „nimm `npm.cmd`" ist damit veraltet.
Der Weg, der auf beiden Plattformen ohne Shell funktioniert, ist derselbe, den
die vier Runner-Skripte aus OP-234 nehmen: nicht das Startprogramm suchen,
sondern den JavaScript-Einstiegspunkt und ihn mit der laufenden Node-Binärdatei
ausführen. Beide Orte gemessen — Windows `C:\nvm4w\nodejs\node_modules\npm\
bin\npm-cli.js`, Linux `/opt/node22/lib/node_modules/npm/bin/npm-cli.js`.

Findet sich keiner der beiden, fällt POSIX auf `npm` im PATH zurück (dort ein
gewöhnliches Programm) und Windows bricht mit einer Meldung ab, die den Grund
nennt — statt eines `ENOENT`, das nach „npm kaputt" aussieht.

`shell: true` wäre die kürzere Antwort und die schlechtere — sie reicht die
Argumente durch eine Shell, und damit hinge die Bedeutung von `&`, `|` und `^`
plötzlich am Inhalt der Argumente.

**Beobachtung am Rande, nicht behoben.** `check-dependency-hygiene.mjs` meldet
im Arbeitsbaum eines Entwicklers `[stray] @grc/web@0.1.0 — .env.local`. Die
Datei ist von `.gitignore` erfasst und existiert in CI nicht, dort ist der
Schritt also grün. Lokal ist er es nicht, und ein Tor, das aus einem Grund rot
ist, der mit dem gesuchten Defekt nichts zu tun hat, gewöhnt seine Leser das
Hinsehen ab. Die naheliegende Abhilfe — ignorierte Dateien überspringen —
wäre allerdings kein reiner Gewinn: sie könnte eine echte mitgelieferte
Arbeitsdatei in einem Fremdpaket verdecken, das zufällig auf eine Ignore-Regel
passt. Deshalb hier als Beobachtung notiert statt still geändert.

### Nachtrag 2026-09-09 — Welle 8n: was der E2E-Job zeigte, sobald er überhaupt lief

Der Lauf `34395761770` ist der erste, in dem die volle Playwright-Suite je
gestartet ist. Vier Schritte, die seit dem 2026-09-02 nie grün waren, sind es
jetzt — und dahinter lag ein Befund, den vorher niemand sehen konnte.

| OP     | Was                                                                                                                                                                                                                                                                                   | Beleg                         | Art     | Stand   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------- | ------- |
| OP-254 | **Die E2E-Datenbank hatte den Demo-Datensatz nie.** Der Job fährt `src/seed.ts` — Organisationen, Benutzer, Rollen. Die Suite prüft gegen die Demo-Daten: `ai-act-workflow.spec` sucht `AIS-001`, und die Zeile steht in `seed_demo_12_ai_act.sql`, die nur `src/seed-demo.ts` fährt. | Lauf `34395761770`, Test 9–11 | Betrieb | behoben |

**Was OP-251 gebracht hat, gemessen.** Alle vier Anmeldungen aus
`auth.setup.ts` grün — `authenticate as admin` (2,3 s), `owner`, `reviewer`,
`approver` —, der Rauchtest 8/8 in 14,5 s, und dann 201 Tests gestartet. Vorher
endete derselbe Job in `auth.setup.ts` mit „No password for the primary E2E
account". Auch die zwei Provisionierungs-Hälften aus OP-241 sind hier grün
(`grc_app-Rollen anlegen` vor den Migrationen, `grc_app-Grants + Abnahme`
danach), und `Run ./.github/actions/apt-ohne-fremdquellen` (OP-253) ebenfalls.

**Der Lauf wurde nicht durch ein Zeitlimit abgeschnitten, sondern von mir.**
`concurrency: cancel-in-progress: true` — mein eigener Push von `7fa0147e` hat
den laufenden Lauf für `d8e5d824` abgebrochen (`The operation was canceled`,
12m45s). Das ist Bedienung, kein Defekt, gehört aber ins Protokoll, damit die
Zahl später nicht als Zeitlimit gelesen wird.

**OP-254 und die Falle, die ich mir dabei selbst gestellt hätte.** Die erste
Fassung des Seeding-Schrittes hat den Mandanten über
`WHERE name = 'Meridian Holdings GmbH' LIMIT 1` gesucht. Das war richtig,
solange der Job nur `src/seed.ts` fuhr. Mit dem Demo-Datensatz gibt es diesen
Namen **zweimal** — gemessen im Container gegen eine frisch migrierte
Datenbank nach beiden Seeds:

```
c2446a5c-64f1-40a7-862a-8ab084f66f41  Meridian Holdings GmbH
ccc4cc1c-4b09-499c-8420-ebd8da655cd7  Meridian Holdings GmbH (Demo Tenant)
3410dec6-35a4-48a6-b112-3541bf91f316  Meridian Holdings GmbH
```

`LIMIT 1` hätte still eine davon genommen. Und die Demo-Daten liegen in
**keiner** der beiden gleichnamigen, sondern in `ccc4cc1c…`:

```
AIS-001  org=ccc4cc1c-4b09-499c-8420-ebd8da655cd7
AIS-002  org=ccc4cc1c-4b09-499c-8420-ebd8da655cd7
AIS-003  org=ccc4cc1c-4b09-499c-8420-ebd8da655cd7
```

Ein Konto im falschen Mandanten sieht eine leere Anwendung, und die Suite fällt
an einer Assertion, die nach einem Produktfehler aussieht. Der Mandant ist
deshalb jetzt der Literalwert `ccc4cc1c…` — derselbe, den `seed-e2e-users.ts`
als Vorgabe führt und `playwright.config.ts` annimmt — und er wird **geprüft,
nicht angenommen**: fehlt er, bricht der Schritt ab und gibt die vorhandenen
Organisationen aus.

**Die ganze Kette ist im Container durchgespielt**, nicht nur gelesen: Rollen →
429/429 Migrationen → Grants → `src/seed.ts` → `src/seed-demo.ts` (alle
Referenz- und Demo-Dateien `ok`) → `seed-e2e-users --org ccc4cc1c…`. Ergebnis:

```
e2e-admin@arctos.local  älteste Mitgliedschaft in ccc4cc1c-4b09-499c-8420-ebd8da655cd7
AI-Systeme im Mandanten: 5
```

Das primäre Konto hält seine älteste Mitgliedschaft genau dort, wo die Daten
liegen — die Bedingung, gegen die `auth.setup.ts` `currentOrgId` prüft.

**Offen und noch nicht beurteilt:** die Unit-Tests sind in diesem Lauf mit
einer DOM-Assertion und einem 15-Sekunden-Zeitlimit gefallen
(`expected null not to be null`, `Test timed out in 15000ms`), obwohl derselbe
Job auf `d3637701` 909/909 grün war. Der Verdacht ist Lastabhängigkeit wie bei
den Korpus-Tests aus OP-246; beurteilt ist er nicht, weil der Lauf abgebrochen
wurde, bevor das Protokoll abrufbar war.

### Nachtrag 2026-09-09 — Welle 8o: `npm run lint` prüft jetzt das, was CI prüft (OP-221)

**Entscheidung des Eigentümers am 2026-09-09:** die Ratsche in das
dokumentierte Kommando einhängen. Damit ist OP-221 behoben.

Die Lage vorher: `npm run lint` war `turbo lint`, brach an 44 eingefrorenen
Altbefunden im Root-Scope ab und sagte damit nichts über die Änderung des
Aufrufers. CI prüfte einen anderen Weg — `npx eslint .` in `apps/web` plus
`scripts/lint-ratchet.mjs` — und der war grün. Das naheliegende Kommando war
das falsche.

`scripts/lint-ratchet.mjs` lintet ohnehin **alle zwölf** Workspaces selbst und
braucht turbo dafür nicht. Also:

| Kommando               | vorher                           | jetzt                                   |
| ---------------------- | -------------------------------- | --------------------------------------- |
| `npm run lint`         | `turbo lint` — rot, ohne Aussage | die Ratsche — dasselbe, was CI prüft    |
| `npm run lint:raw`     | gab es nicht                     | `turbo lint`, rohe Ausgabe je Workspace |
| `npm run lint:ratchet` | wortgleich mit dem Neuen         | entfallen (rief niemand auf)            |

Gegenproben, beide gemessen — der Fehlschlag im Protokoll:

- Sauberer Baum: `npm run lint` → **Exit 0**,
  `root 44/44, apps/web 0/0, ✓ Keine Lint-Regression.`
- Mit einer eingesetzten Verletzung (`export function probe(x: any)` in
  `apps/web/src/lib/`): **Exit 1**,
  `apps/web · Neue Regelverletzung "@typescript-eslint/no-explicit-any" (1×) —
in der Baseline nicht vorhanden. Beheben, nicht in die Ratsche aufnehmen.`
  Die Datei ist danach wieder entfernt.

`docs/onboarding.md` nannte den Befehl innerhalb von `apps/web`; das Tor gilt
für den ganzen Baum und wird jetzt aus der Wurzel aufgerufen.
`.github/pull_request_template.md` verlangt „`npm run lint` grün" — das ist ab
hier eine erfüllbare Zusage.

**Nicht mitgemacht:** die 44 Altbefunde im Root-Scope bleiben stehen und
bleiben gedeckelt. Sie verschwinden durch Arbeit, nicht durch eine
Umverdrahtung.
