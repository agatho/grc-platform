# BPMN-Testkorpus

52 Diagramme. Sie sind die Messgrundlage für die Round-Trip-Zusicherungen
(§5.1 des Plans) und später für Importer, Renderer und Modellierungsregeln.

Zwei Gruppen:

| Präfix | Herkunft | Anzahl |
|---|---|---:|
| `repo-*` | **Aus dem Repository extrahiert.** Jedes BPMN-XML-Literal, das auf Branch `audit/full-2026-08-31` real vorkommt — Seed-SQL, Unit-Tests, E2E-Fixtures, PRD-Beispiele. Herkunft je Datei unten mit Datei und Zeile. | 33 |
| `synth-*` | **Für diesen Spike gebaut.** Härtefälle, die im Bestand nicht vorkommen, im Zielbild aber sehr wohl (Lanes/Pools, Boundary Events, Message Flows, DataObjects, verschachtelte SubProcesses, alle Gateway- und Ereignistypen, fremde `extensionElements`, ungewöhnliche Attributreihenfolge, CDATA/Umlaute, fehlende DI). | 19 |

Die Bestandsaufnahme (§1.4b) zählt 27 XML-Literale im Repo, die zusammen
**8 Elementtypen** abdecken. Nach dem Zerlegen in einzelne Dateien und dem
Entfernen einer exakten Dublette sind es 33 Dateien; die synthetischen 19
heben die Abdeckung auf **über 60 BPMN-Elementtypen**.

**Nicht aufgenommen:**

- `packages/ai/src/prompts/bpm.ts:21` — dort steht nur der Platzhalter
  `"<bpmn:definitions ...>...</bpmn:definitions>"` im Prompt-Text, kein Diagramm.
- `apps/web/src/app/api/v1/processes/{import-bpmn-xml,ai/generate-from-text}/route.ts`
  — dort steht der Regex `/<(bpmn:)?definitions\b/i` als Plausibilitätsprüfung,
  kein Diagramm.
- `packages/db/sql/seed_demo_09_processes.sql` — legt `process_step`-Zeilen an,
  aber kein `bpmn_xml`.
- Eine exakte Dublette in `packages/shared/tests/bpmn-parser.test.ts:192`
  (identisch mit `:176`, hier als `repo-parser-di-without-bounds`).

**Was noch fehlt** (§5.5 des Plans nennt vier Quellen, zwei davon sind hier nicht
beschaffbar): ein anonymisierter **Produktivexport** echter
`process_version.bpmn_xml` — die laufende DB hat 0 Zeilen in `process_version`,
und ob es in produktiven Mandanten Bestandsdiagramme gibt, ist ungeklärt —
sowie Exporte aus **Fremdwerkzeugen** (Camunda Modeler, Signavio, Visio, ADONIS).
`synth-foreign-camunda-extensions` und `synth-default-namespace-unprefixed` bauen
deren Eigenheiten nach, ersetzen echte Exporte aber nicht.

---

## `repo-*` — aus dem Repository extrahiert

| Datei | Herkunft | Elem. | Besonderheit |
|---|---|---:|---|
| `repo-seed-management-review` | `packages/db/sql/seed_demo_14_july_features.sql:172` | 43 | Seed-Demo, vollständige DI, `bpmn:`-Präfix durchgängig, ASCII-transliterierte Umlaute („faellig") |
| `repo-seed-risk-management` | `…seed_demo_14_july_features.sql:184` | 43 | wie oben, vier Tasks |
| `repo-seed-order-callactivity` | `…seed_demo_14_july_features.sql:196` | 43 | **einziges `bpmn:callActivity` im gesamten Repo-Bestand** |
| `repo-seed-customer-service` | `…seed_demo_14_july_features.sql:208` | 34 | Seed-Demo, drei Flows |
| `repo-seed-tour-planning` | `…seed_demo_14_july_features.sql:220` | 34 | Ziel der Call Activity aus `repo-seed-order-callactivity` |
| `repo-seed-goods-receipt` | `…seed_demo_14_july_features.sql:232` | 34 | Seed-Demo |
| `repo-parser-mixed-types-subprocess` | `packages/shared/tests/bpmn-parser.test.ts:11` | 23 | reichste Typmischung im Bestand: `userTask`, `serviceTask`, `exclusiveGateway`, `subProcess` mit innerem `task`; **DI ohne `di:waypoint`** |
| `repo-parser-empty-process` | `…bpmn-parser.test.ts:115` | 2 | `<bpmn:process/>` leer und selbstschließend — Untergrenze des Importers |
| `repo-parser-di-without-bounds` | `…bpmn-parser.test.ts:176` | 5 | `BPMNPlane` ohne ein einziges `BPMNShape` |
| `repo-parser-start-end-with-di` | `…bpmn-parser.test.ts:208` | 6 | Start/Ende ohne Sequenzfluss dazwischen — unverbundener Graph |
| `repo-parser-no-di-section` | `…bpmn-parser.test.ts:225` | 5 | **kein `bpmndi:BPMNDiagram`** (Bestandsfall des Zielbild-Härtefalls) |
| `repo-parser-partial-di` | `…bpmn-parser.test.ts:245` | 7 | DI nur für einen Teil der Elemente |
| `repo-validator-valid-minimal` | `packages/shared/tests/bpmn-validator.test.ts:10` | 7 | die „gültige" Referenz der Validator-Regeln |
| `repo-validator-missing-start-event` | `…bpmn-validator.test.ts:21` | 5 | verletzt Regel 1 (kein StartEvent) |
| `repo-validator-missing-end-event` | `…bpmn-validator.test.ts:30` | 5 | verletzt Regel 2 (kein EndEvent) |
| `repo-validator-disconnected-task` | `…bpmn-validator.test.ts:39` | 8 | verletzt Regel 3 (unverbundenes Element) |
| `repo-validator-gateway-condition-expression` | `…bpmn-validator.test.ts:53` | 13 | verletzt Regel 4 (Gateway ohne Default); **einziges `conditionExpression` im Bestand** |
| `repo-diff-base-v1` | `packages/shared/tests/bpmn-diff.test.ts:7` | 5 | Ausgangsversion des Versionsvergleichs |
| `repo-diff-added-task-v2` | `…bpmn-diff.test.ts:16` | 6 | dazu: ein Task hinzugefügt |
| `repo-diff-removed-task` | `…bpmn-diff.test.ts:26` | 4 | dazu: Task entfernt |
| `repo-diff-renamed-task` | `…bpmn-diff.test.ts:34` | 5 | dazu: Task umbenannt |
| `repo-diff-modified-truncated` | `…bpmn-diff.test.ts:83` | 5 | Prozess ohne EndEvent — Diff über unvollständige Diagramme |
| `repo-arctos-basic-no-extensions` | `apps/web/src/__tests__/lib/bpmn-arctos-parse.test.ts:13` | 4 | Ziel des Schreibpfads: `userTask` + `serviceTask`, noch **ohne** `extensionElements` |
| `repo-arctos-foreign-extension-and-existing-grcmetadata` | `…bpmn-arctos-parse.test.ts:25` | 9 | **der Vertragsfall aus §5.3:** `<foo:props value="keep-me"/>` muss überleben, vorhandenes `arctos:grcMetadata` muss *ersetzt statt dupliziert* werden |
| `repo-arctos-full-grcmetadata` | `apps/web/src/__tests__/lib/bpmn-arctos-rehydrate.test.ts:14` | 12 | vollständiges `grcMetadata`: `riskRefs`, `controlRefs`, `documentRefs`, `ropa`; UUID-Platzhalter der Testdatei eingesetzt |
| `repo-arctos-without-metadata` | `…bpmn-arctos-rehydrate.test.ts:65` | 3 | Gegenprobe: Rehydrierung muss Nullstatistik liefern |
| `repo-extractor-legacy-regex-fixture` | `apps/web/src/__tests__/components/arctos-grc-extractor.test.ts:10` | 3 | Fixture des `@deprecated` Regex-Pfads |
| `repo-e2e-approval-initial` | `apps/web/e2e/bpm-approval-pipeline.spec.ts:74` | 5 | E2E: über die API angelegtes Diagramm |
| `repo-e2e-approval-changed` | `…bpm-approval-pipeline.spec.ts:199` | 5 | E2E: zweite Version, Task umbenannt |
| `repo-e2e-process-portal` | `apps/web/e2e/process-portal.spec.ts:21` | 5 | E2E: Mitarbeiterportal-Sicht |
| `repo-prd-sales-with-gateway` | `docs/PRD_Sprint3.md:316` | 60 | größtes Bestandsbeispiel: Gateway mit zwei Zweigen, vollständige DI mit Waypoints |
| `repo-prd-procurement` | `docs/PRD_Sprint3.md:372` | 52 | vier `userTask` in Reihe, vollständige DI |
| `repo-prd-single-start-event` | `docs/PRD_Sprint3.md:1901` | 7 | minimales Diagramm mit genau einem Shape |

## `synth-*` — für den Spike gebaute Härtefälle

| Datei | Elem. | Was daran hart ist |
|---|---:|---|
| `synth-collaboration-pools-lanes` | 93 | `collaboration` mit zwei `participant`, zwei `messageFlow`, `laneSet` mit zwei `lane` und `flowNodeRef`, zwei Prozesse, `sendTask`/`receiveTask`, DI für Pools und Lanes. **Kommt im Bestand kein einziges Mal vor** und ist trotzdem Voraussetzung für §3.11 (SoD/Organisation) |
| `synth-boundary-events` | 78 | drei `boundaryEvent` (Timer/Error unterbrechend, Message nicht-unterbrechend) an Task und SubProcess; `attachedToRef` und `cancelActivity` sind genau die Attribute, die ein `BpmnUpdater` bei jedem Verschieben mitpflegen muss |
| `synth-all-gateway-types` | 82 | alle fünf Gateway-Typen inkl. `default`, `conditionExpression` mit `xsi:type`, `eventGatewayType`, `instantiate` |
| `synth-all-event-types` | 77 | Message-/Timer-/Signal-/Error-/Escalation-/Link-/Terminate-Definitionen, Link-Paar (throw/catch), Ereignis-Subprozess mit `triggeredByEvent` |
| `synth-all-task-types` | 69 | alle acht Task-Arten plus `callActivity` mit `standardLoopCharacteristics` |
| `synth-nested-subprocesses` | 78 | drei Verschachtelungsebenen (`subProcess` → `subProcess` mit `multiInstanceLoopCharacteristics` → `transaction`), dazu `adHocSubProcess`; **zwei `BPMNDiagram`-Abschnitte** (Drill-Down-Ebene als eigene Plane) |
| `synth-data-objects-and-artifacts` | 69 | `dataObject`/`dataObjectReference`/`dataStore`/`dataStoreReference`, `dataInputAssociation`/`dataOutputAssociation` mit `property`-Ziel, `textAnnotation` + `association`, `group` + `categoryValue` |
| `synth-foreign-camunda-extensions` | 51 | `camunda:`, `zeebe:` und `signavio:` nebeneinander — `formData` mit verschachtelter `validation`, `inputOutput`, Attribute im Fremd-Namensraum (`camunda:historyTimeToLive`) — **und** ein `arctos:grcMetadata` im selben `extensionElements`. Der Nichtverlust-Fall aus §5.3 |
| `synth-foreign-namespace-declared-locally` | 6 | Fremd-Namensraum **nicht** an der Wurzel, sondern am Extension-Element selbst deklariert. §5.3 nennt das ausdrücklich als „Fixture-Fall, kein Vertrauensfall" |
| `synth-grcmetadata-uppercase-tagalias` | 9 | `<arctos:GrcMetadata>` mit **großem G**, wie ein naiver Fremdexporter schriebe. §5.2 verlangt: wird gelesen, wird immer klein zurückgeschrieben |
| `synth-schema-default-attributes` | 26 | 16 Attribute, deren Wert dem Schema-Default entspricht, alle explizit hingeschrieben. Isoliert die häufigste Round-Trip-Abweichung an einer Stelle |
| `synth-dangling-references` | 20 | jede IDREF zeigt ins Leere (`dataStoreRef`, `messageRef`, `errorRef`, `BPMNShape/@bpmnElement`) — der Fall, den ein Teilexport aus einem Fremdrepository erzeugt |
| `synth-unusual-attribute-order` | 25 | Attribute in absichtlich unüblicher Reihenfolge, `xmlns:`-Deklarationen hinter fachlichen Attributen, `dc:Bounds` als `height width y x` |
| `synth-cdata-umlauts-entities` | 56 | CDATA in `documentation` und `conditionExpression`, Umlaute/ß/§/€, typografische Anführungszeichen, Gedankenstrich, Emoji, `&amp;`/`&lt;`/`&gt;` in Attributwerten und Elementnamen |
| `synth-without-di-section` | 23 | vollständiger Prozess mit Gateway und zwei Enden, **ohne jedes `bpmndi:`** — der Fall „KI- oder Excel-Import ohne Layout" (§2.3, AP17) |
| `synth-default-namespace-unprefixed` | 25 | `<definitions xmlns="…">` ohne Präfix, DI-Präfixe `omgdc`/`omgdi` statt `dc`/`di` — so schreibt Trisotech |
| `synth-comments-and-pi` | 19 | XML-Kommentare vor der Wurzel, in `definitions`, im Prozess und in einem Flow-Node, dazu eine Processing Instruction und ein Fußkommentar |
| `synth-excel-import-lanes` | 23 | die Ausgabe von `packages/shared/src/lib/excel-to-bpmn.ts` mit eingesetzten Werten: `collaboration` + `participant` + `laneSet`, **ohne DI**, Sequenzflüsse mit `name`-Attribut nach `targetRef` |
| `synth-large-flat-process` | 556 | 60 Knoten, 61 Flows, vollständige DI — Größenordnung für das Leistungsbudget (§6.8) und für die Frage, ob der Kanonisierer skaliert |

---

## Wie der Korpus benutzt wird

- `test/model/corpus.ts` lädt alle Dateien (`loadCorpus()`), das Präfix bestimmt
  `origin: "repo" | "synth"`.
- `test/model/roundtrip.test.ts` fordert für **jede `repo-*`-Datei** alle vier
  Zusicherungen ohne Ausnahme und misst die `synth-*`-Dateien gegen eine
  namentlich begründete Abweichungsliste.
- `test/model/measure-roundtrip.ts` erzeugt `test/model/ROUNDTRIP-REPORT.md`.

Neue Dateien brauchen nur abgelegt und hier eingetragen zu werden; der Loader
findet sie von selbst.
