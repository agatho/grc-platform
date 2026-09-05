# Welle 3b — Die fehlenden Layer und die Vertragsfelder

**Plan:** `docs/UMSETZUNGSPLAN-OFFENE-PUNKTE.md` §5 · **Register:** `docs/OFFENE-PUNKTE-REGISTER.md`
**Stand vorher:** `c635a970` · **Branch:** `audit/full-2026-08-31` · **Datum:** 2026-09-03

---

## 1. Das Muster dieses Strangs

Zwölf Punkte, und zwölfmal dieselbe Frage in verschiedener Verkleidung:
**Wo steht die Wahrheit, und wer hat sie bisher geraten?**

`STUFE2-A2-GRC.md` §6 hat sechs Layer zurückgestellt, jeden mit einer knappen
Begründung — „braucht einen Zeitreihenvertrag", „braucht eine Richtungsaussage",
„Slot existiert nicht". Bei fünf von sechs stellte sich beim Nachsehen heraus,
dass die vermisste Grundlage **da war** und nur an einer anderen Stelle stand,
als der Bericht gesucht hat:

| Punkt      | Der Bericht vermisste …                | Tatsächlich stand die Wahrheit in …                                            |
| ---------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| **OP-008** | „`kri_measurement` hat keine Richtung" | `kri.direction` — seit Sprint 2, am KRI statt an der Messung.                  |
| **OP-010** | „Aufschlüsselung je Rolle fehlt"       | `process_step.lane_step_id` + `process_step_raci` — seit Migration 0445.       |
| **OP-015** | „nur der Rahmenwerkscode"              | `catalog.name` über `catalog_id`, das die Zuordnungstabelle seit jeher trägt.  |
| **OP-004** | „Layer nicht gebaut"                   | `security_incident.process_step_id` — seit 0454. Es fehlten Abfrage und Layer. |
| **OP-005** | dito                                   | `work_item.process_step_id` — seit 0454.                                       |

Nur **einer** der sechs war wirklich ohne Grundlage, und dort geht der Befund
tiefer als die gemeldete Spalte (OP-013, §8).

Der zweite Faden zieht sich durch OP-016 und OP-017: **ein Vertragsfeld ohne
Bedienelement ist keine Zusage, sondern eine Behauptung** — und die
`MISSING_TODAY`-Liste, die das festhalten soll, war selbst zur zweiten Wahrheit
geworden.

---

## 2. OP-004 und OP-005 — Vorfälle und offene Maßnahmen am Schritt

**Befund.** F14 (Vorfälle am Schritt) und F16 (offene Maßnahmen mit Fälligkeit)
nicht gebaut; im Register beide als S geschätzt mit dem Hinweis, die Spalte
stehe seit 0454.

**Das stimmte.** `security_incident.process_step_id` und
`work_item.process_step_id` stehen seit Migration 0454. Gefehlt haben die
Abfragen im Overlay-Endpunkt und die zwei Layer — nicht die Daten. Vor dieser
Welle wäre `?layers=incident` eine Zusage ohne Deckung gewesen.

**Die fachliche Festlegung, die dabei zu treffen war.** `incident_status` hat
sieben Stufen. Welche davon „abgeschlossen" heisst, ist keine Frage der
Zeichenschicht, und sie wird deshalb **im Endpunkt** entschieden und nicht im
Layer: ein Vorfall gilt als abgeschlossen, wenn `closed_at` gesetzt ist **und**
der Status `closed` lautet. Beides einzeln reicht nicht — ein Datum ohne Status
ist ein Datenfehler, ein Status ohne Datum eine unvollständige Schliessung.
Steht die Entscheidung im Layer, hat jede Sicht ihre eigene Auffassung davon,
was offen ist.

---

## 3. OP-006 — Kostenverteilung je Lane, und der Slot, den es nicht gab

**Befund.** F11 nicht gebaut, „Slot ‚Lane-Fußzeile' existiert nicht"; im
Register als M mit der Entscheidung „Slotsystem um einen Lane-Fußzeilen-Slot
erweitern".

**Die Quelle ist `simulation_activity_param`, nicht `grc_cost_entry` — und das
ist eine gemessene Entscheidung.** `STUFE2-A2-GRC.md` §6 nennt für den Layer den
Kostentreiber; `grc_cost_entry` führt Kosten aber auf der Ebene des **Moduls**,
nicht des Prozessschritts. Eine Lane-Quote daraus wäre eine Zahl, die aussieht
wie eine Aussage über diesen Prozess und keine ist — genau die Fehlerform, gegen
die Welle 1b angetreten ist. `simulation_activity_param` trägt den Kostensatz je
Aktivität und ist damit die einzige Grundlage, aus der sich ein Anteil je Lane
ohne Erfindung errechnen lässt.

**Der Slot.** Neu, und bewusst ein eigener: der Anteilsbalken teilt sich keinen
Slot mit einem Badge. Die Priorität entscheidet nur, welcher von zwei
Fußzeilen-Layern gewinnt, wenn beide aktiv sind — nicht, ob Balken oder Badge
gezeigt wird. Ein Slotsystem, in dem zwei verschiedene Darstellungsarten um
denselben Platz konkurrieren, verliert bei jeder Erweiterung eine davon
stillschweigend.

---

## 4. OP-008 — Die KRI-Schwellenampel und die Richtung, die es gab

**Befund.** F15 nicht gebaut, „`kri_measurement` hat keinen Zeitreihenvertrag";
im Register mit der offenen Entscheidung „Zeitreihenvertrag + Richtungsaussage".
Der Bericht argumentiert: „Ohne Richtung wäre der Badge eine Zahl ohne
Bedeutung."

Das Argument ist richtig — 82 % Verfügbarkeit ist gut, 82 % Fehlerquote nicht —
und die Richtung **steht seit Sprint 2 in `kri.direction`**. Sie stand nur nicht
dort, wo der Bericht gesucht hat: am KRI, nicht an der Messung. Das ist auch die
richtige Stelle, denn die Richtung ist eine Eigenschaft der Kennzahl und nicht
eines einzelnen Messwerts.

**Der Bezug zum Schritt läuft über das Risiko, nicht über eine eigene Spalte.**
Ein KRI ist das Frühwarnsignal eines Risikos (`kri.risk_id`); welche Risiken an
einem Schritt hängen, sagt die vorhandene Risiko-Schritt-Zuordnung. Eine neue
`kri.process_step_id` hätte eine zweite Wahrheit über dieselbe Beziehung
angelegt — und die erste wäre irgendwann veraltet.

---

## 5. OP-010 — F17 ganz statt halb

**Befund.** „Quote je Lane gebaut, Aufschlüsselung je Rolle im Panel fehlt."

**Was die Aufschlüsselung braucht: zu wissen, wer in einer Lane arbeitet.** In
einer Lane arbeitet in aller Regel mehr als ihre Trägerrolle. Welche Rollen das
sind, sagt `process_step.lane_step_id` zusammen mit `process_step_raci` — die
Spalte, die Strang 3a in derselben Welle erstmals befüllt (sie war in 17 von 17
Zeilen `NULL`, siehe `docs/UMSETZUNG-WELLE-3A.md`). Vorher hätte man die
Lane-Zugehörigkeit geometrisch raten müssen, und eine geratene Zuordnung von
Verantwortlichkeit ist in einem GRC-Produkt schlimmer als keine.

Mitgelesen werden auch die Rollen, die **in** der Lane arbeiten, nicht nur die
Trägerrolle — sonst stünde in der Aufschlüsselung eine UUID statt eines
Rollennamens, und die Abbildung verwürfe die Zeile stillschweigend.

---

## 6. OP-011 — Der Validierungsmarker

**Befund.** „Sicht ‚Modellierung': Validierungsmarker (BR) — Slot angelegt,
Layer fehlt", zurückgestellt mit „die Sicht ist angelegt und lässt den Slot
frei".

**Gebaut**, und über allem — aber **nur in der Sicht ‚Modellierung'**. Die
Begründung für beides ist dieselbe: ein Dokument, das ein Fremdwerkzeug nicht
mehr lesen kann, macht jede fachliche Aussage darüber gegenstandslos. Deshalb
steht der Marker in dieser Sicht ganz oben. In den acht anderen Sichten ist der
Layer gar nicht aktiv — dort zeichnet niemand, dort liest man Kontrollen und
Risiken, und ein Schemabefund wäre Lärm über einer Frage, die nicht gestellt
wurde.

Die Befunde kommen aus `packages/bpmn/src/verify/` — demselben Prüfer, den
Welle 2a als lexikalischen Schemaprüfer über den Rohtext gebaut hat.

---

## 7. OP-012 — Kantenkennzahlen, und was ein Endpunkt nicht erfinden darf

**Befund.** „Kantenkennzahlen (`edges`: Häufigkeit,
Verzweigungswahrscheinlichkeit) — braucht `process_event_transition_map`."

**Die Tabelle gibt es jetzt** (Migration `0476`), befüllt vom Cron
`process-mining-conformance` aus demselben Ereignisprotokoll wie die
Konformitätszusammenfassung — dem zuletzt importierten. Zwei Protokolle
nebeneinander zu addieren wäre eine Häufigkeit über zwei verschiedene Zeiträume
unter einem Namen.

**Der `edges`-Eintrag in `MISSING_TODAY` bleibt trotzdem stehen, und der Grund
ist der interessante Teil.** Die Zahlen gibt es. Was es weiterhin nicht gibt,
ist der **Schlüssel** dieses Records: die BPMN-Kennung eines `SequenceFlow`
steht in keiner Tabelle des Schemas — `process_step` führt Knoten, Kanten führt
niemand —, und dieser Endpunkt parst kein BPMN. Er könnte eine Kanten-ID also
nur **erfinden**.

Geliefert wird deshalb `diagram.transitions` als **Knotenpaar**; die
Diagrammschicht löst es über die Szene auf (`resolveTransitions`), genau wie bei
`conformance.deviations` seit Migration 0465. Das ist dieselbe Antwort auf
dieselbe Frage, und sie ist die richtige: die Kennung einer Kante kennt nur, wer
das Diagramm vor sich hat.

---

## 8. OP-013 — Der einzige Punkt, dessen Grundlage wirklich fehlt

**Befund.** „`process_event` trägt keinen Lebenszyklus —
`meanDurationMinutes` / `isBottleneck` nicht berechenbar."

**Nachgemessen, und der Befund geht tiefer als die Spalte.** `process_event`
trägt genau einen Zeitstempel je Ereignis und kein Lebenszyklus-Merkmal
(`start`/`complete`). Ohne Anfang **und** Ende gibt es keine Dauer, und ohne
Dauer keinen Engpass; die Differenz zum nächsten Ereignis desselben Falls wäre
die **Wartezeit davor**, nicht die Bearbeitungszeit — zwei verschiedene Grössen
unter einem Namen.

Der eigentliche Fund liegt eine Ebene tiefer: der XES-Importer
(`event-logs/upload/route.ts`, `parseXes`) liest ausschliesslich `concept:name`,
`time:timestamp` und `org:resource` und schreibt `additionalData` fest auf `{}`.
Die Zeichenkette `lifecycle` kommt **im ganzen Repository nicht ein einziges Mal
vor**, obwohl `lifecycle:transition` zum XES-Standard gehört und in jedem echten
Protokoll steht.

**Eine Lebenszyklus-Spalte an `process_event` wäre deshalb heute eine Spalte,
die niemand befüllt** — dieselbe zweite Wahrheit, aus der Migration 0453
`control.last_test_result` bewusst _nicht_ angelegt hat. Die Reihenfolge ist:
erst Parser, dann Spalte, dann Kennzahl. Übergeben an den Mining-Strang, mit
diesem Text im `MISSING_TODAY`-Eintrag, damit die nächste Person nicht wieder
bei der Spalte anfängt.

---

## 9. OP-015 — Der Anzeigename, der bereitstand

**Befund.** „`process_framework_mapping` führt nur den Rahmenwerkscode, keinen
Anzeigenamen." Nutzer sehen `ISO27001-A.5.1` statt „ISO 27001".

`catalog.name` **ist** der Anzeigename, den `frameworkName` meint, und die
Zuordnungstabelle trägt `catalog_id` seit jeher. Ein Verbund, kein Schema.

**Warum es trotzdem niemandem aufgefallen ist**, ist der lehrreiche Teil: die
`MISSING_TODAY`-Sonde für `frameworks[].frameworkName` lief ins Leere, weil der
Prüfdatensatz **gar keine Rahmenwerkzuordnung enthielt**. Sie las an einer
Stelle nach, an der keine Zeile stand, fand nichts und bestätigte damit den
Eintrag, den sie hätte widerlegen sollen. Der maximal besetzte Datensatz führt
die Zuordnung jetzt — siehe §10.

---

## 10. OP-016 und OP-017 — Die Wächterliste, die selbst zur zweiten Wahrheit wurde

`MISSING_TODAY` in `apps/web/src/lib/grc-overlay.ts` ist die Liste der
Vertragsfelder, die der Endpunkt **nicht** liefert, jeweils mit Begründung. Sie
ist eine gute Einrichtung — und sie hatte zwei Defekte, die sich gegenseitig
gedeckt haben.

**(1) Ein Eintrag ohne Bedienelement.** `diagram.framework` stand mit der
Begründung dort: „Auswahlparameter der Sicht F8, keine hinterlegte Tatsache — er
gehört an die Sichtwahl der Oberfläche." Der Grund war richtig, die Folge
falsch: **genau dort gab es ihn nicht.** Ein Auswahlparameter ohne Bedienelement
ist keine Auswahl, sondern eine Behauptung. Die Rahmenwerkauswahl ist jetzt
gebaut, der Eintrag gestrichen — mit einem Wächter, der beides zusammenhält: ein
Rahmenwerk anzubieten, wo der `framework`-Layer gar nicht aktiv ist, wäre ein
Bedienelement ohne Wirkung; es **nicht** anzubieten, wo er aktiv ist, liesse die
Sicht unbedienbar.

**(2) Zwei Wächter über zwei verschiedene Eingaben.** Der mechanische Wächter
(„die Liste führt kein Feld, das der Endpunkt inzwischen liefert") und der
Wächter über die Abwesenheit maßen gegen **unterschiedliche** Prüfdatensätze.
Genau durch diese Lücke ist OP-017 gefallen — und OP-015 gleich mit (§9). Der
maximal besetzte Datensatz ist herausgezogen und wird von beiden benutzt; er
führt jetzt auch Vorfall, Maßnahme und Rahmenwerkzuordnung, sonst prüfte der
Wächter ihre Abwesenheit an einer Stelle, an der nie eine Zeile stand.

**OP-017 selbst war ein Streichkandidat, und er wird gestrichen.**
`controls[].lastTestResult` / `.lastEvidenceAt` werden abgeleitet statt gelesen,
und das ist die richtige Lösung — genau deshalb hat Migration 0453 die Spalte
`control.last_test_result` bewusst nicht angelegt. Der Eintrag war ein Hinweis,
kein Mangel.

**Ergebnis:** `MISSING_TODAY` schrumpft von **sieben auf drei** Einträge, und
alle drei nennen jetzt einen konkreten nächsten Schritt statt eines Zustands.

---

## 11. OP-003 — Die gewählte Sicht überlebt den Seitenwechsel

**Befund.** „`user_diagram_preference` (0452) wird von niemandem geschrieben;
`GrcViewSelect` hält die Sicht in React-State."

Gebaut: `GET`/`PUT` unter `…/diagram-overlay/preference` plus
`components/bpmn/grc-view-preference.ts`. Die Voreinstellung wird **sofort**
geholt — ohne sie könnte die Fläche die zuletzt gewählte Sicht nicht
wiederherstellen, und genau das ist der Zweck. Eine Zeile, ein Index: das ist
der Preis dafür, dass die Wahl den Seitenwechsel überlebt.

Die Komponente liest die Prozesskennung notfalls aus der Route und tut ohne
Prozessbezug nichts — der Zustand der meisten Tests, und der Grund, aus dem sie
dort nicht in eine Abfrage läuft.

Migration `0475` ergänzt dabei das Rahmenwerk in der Voreinstellung, damit die
Auswahl aus OP-016 denselben Weg nimmt wie die Sichtwahl.

---

## 12. Abnahme

| Prüfung                                    | Ergebnis                             |
| ------------------------------------------ | ------------------------------------ |
| Migrationen von Null (PG 16 + pgvector)    | ✅ **426/426**, 614 Tabellen, Exit 0 |
| Schema-Drift, beide Richtungen             | ✅ 12/12 grün                        |
| RLS-Abdeckung gegen die frische Datenbank  | ✅ **616 Objekte, 0 Lücken**         |
| RLS-Suite                                  | ✅ 165/165                           |
| `tsc --noEmit` über 13 Projekte            | ✅ 0 Fehler                          |
| `packages/bpmn`                            | ✅ **902 Tests** (vorher 845)        |
| `apps/web`                                 | ✅ **2.669 Tests** (vorher 2.562)    |
| `apps/worker`                              | ✅ 388 (+6 übersprungen, begründet)  |
| `packages/shared` · `db` · `auth`          | ✅ 1.973 · 107 · 244                 |
| i18n-Ratsche                               | ✅ 151 gegen Budget 151              |
| Route-RLS-Kontext, Compose-Rollen, Pinning | ✅ Exit 0                            |
| `lint-ratchet`, `prettier --check`         | ✅ Exit 0                            |

**Layer:** 11 → **15** von 18 (`F1`–`F11`, `F13`–`F16`).
**`MISSING_TODAY`:** 7 → **3** Einträge.

---

## 13. Was an die folgenden Wellen weitergeht

- **OP-013 (Lebenszyklus im Ereignisprotokoll)** — und zwar in der Reihenfolge
  Parser → Spalte → Kennzahl. Der XES-Importer liest `lifecycle:transition`
  heute nicht; die Zeichenkette kommt im Repository nicht vor. Erst wenn er es
  liest, ist eine Spalte etwas anderes als eine zweite Wahrheit.
- **`edges` als Kanten-ID** (OP-012, Restteil). Die Zahlen stehen; der Schlüssel
  fehlt, weil das Schema Kanten nicht führt. Entweder das Schema führt sie, oder
  die Auflösung bleibt Sache der Diagrammschicht — beides vertretbar, aber es
  ist eine Entscheidung und keine Nacharbeit.
- **F12 (EAM-Landschaft, OP-007)** und **F18 (Zeitreise, OP-009)** bleiben
  zurückgestellt wie im Plan §5 begründet: die eine braucht eine zweite
  Zeichenebene, die andere zwei Szenen gleichzeitig.
- **`user_diagram_preference` je Nutzer und Prozess** ist gebaut; eine
  organisationsweite Voreinstellung („welche Sicht sieht ein Prüfer zuerst")
  wäre der nächste Schritt und ist eine Produktentscheidung.
