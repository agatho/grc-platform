# Welle 3a — Pflegeoberfläche für die GRC-Diagrammdaten

**Plan:** `docs/UMSETZUNGSPLAN-OFFENE-PUNKTE.md` §5 · **Register:** `docs/OFFENE-PUNKTE-REGISTER.md` (OP-001, OP-002)
**Schema:** `docs/bpmn-engine/STUFE2-E-SCHEMA.md` §6.4, §6.6
**Stand vorher:** `c635a970` · **Branch:** `audit/full-2026-08-31` · **Datum:** 2026-09-03

---

## 1. Das Muster

Der Plan nennt OP-001 den grössten Einzelposten des Registers und begründet ihn
mit einer Zahl: „Zehn Tabellen tragen Daten, von denen 23 Diagrammlayer leben."

**Die erste Messung dieser Welle hat den Satz korrigiert.** In der geseedeten
Datenbank `welle1_verify` (424 Migrationen, 613 Tabellen) steht:

| Tabelle                      | Zeilen |
| ---------------------------- | ------ |
| `process_lane`               | **0**  |
| `sod_rule`                   | **0**  |
| `process_step_raci`          | **0**  |
| `process_step_ropa`          | **0**  |
| `process_step_data_category` | **0**  |
| `process_step_recipient`     | **0**  |
| `process_step_bia`           | **0**  |
| `process_step_document`      | **0**  |
| `process_event_activity_map` | **0**  |
| `user_diagram_preference`    | **0**  |

Zum Vergleich: 9 Prozesse, 17 Prozessschritte, 8 Organisationen. Die Tabellen
sind nicht dünn besetzt — sie sind **leer**, und zwar restlos.

Damit fällt das erste Schnittkriterium des Auftrags weg. „Was trägt heute schon
Daten und wird von einem Layer gelesen?" hat die Antwort **nichts**. Der Schnitt
musste an einer anderen Frage entlanglaufen, und das ist die Frage, die dieser
Strang gestellt hat:

> **Wer kann diese Zeile ausser einem Menschen anlegen — und wenn niemand, wie
> viel Diagramm hängt daran?**

Sie ordnet die zehn Tabellen sofort:

- **`sod_rule`** kann **niemand** ausser einem Menschen anlegen. Eine
  Unverträglichkeit zweier fachlicher Aufgaben steht in keinem BPMN-XML und in
  keinem Ereignisprotokoll. Ohne Maske ist Layer F3 nicht „leer", sondern
  **prinzipiell unerreichbar**.
- **`process_lane`** kann eine Maschine zur Hälfte: Name, Art und Reihenfolge
  stehen im XML — der **Träger** (Rolle, Einheit, Dienstleister, Drittland)
  nicht. Genau der Träger ist aber die Compliance-Aussage, aus der F5 eine
  Vertrauensgrenze zieht. Die Maschinenhälfte ist OP-002.
- **`process_event_activity_map`** ist der Gegenpol: sie wird maschinell und in
  einem Zug befüllt (ein Import mit 400 Aktivitätsnamen erzeugt 400 Zeilen,
  `STUFE2-E` §1.7). Eine Maske dafür korrigiert nur — und hat ohne einen
  Importlauf davor nichts zu zeigen.

Das zweite Muster steht quer dazu und war die eigentliche Überraschung von
OP-002:

> **Der Befund lautete „der Importer legt keine Zeilen an". Gemessen sind es
> drei Schreibpfade, und keiner legte Zeilen an.**

Ein Wächter über den Importer allein hätte die anderen zwei nicht gesehen.
Der Wächter in §2.4 steht deshalb über der **Regel** — wer Schritte aus BPMN-XML
schreibt, schreibt auch Lanes — und nicht über der Fundstelle.

---

## 2. OP-002 — `process_lane` wird beim Import nicht befüllt

### 2.1 Befund und Reproduktion

Das Register schreibt: „kein `INSERT INTO process_lane` ausserhalb
`packages/db/tests/rls/process-diagram-grc-isolation.test.ts:139`". Nachgeprüft
am Stand `c635a970`:

```
$ git grep -n "insert(processLane)\|INSERT INTO process_lane" c635a970 -- .
packages/db/tests/rls/process-diagram-grc-isolation.test.ts:139
packages/db/tests/rls/process-diagram-grc-isolation.test.ts:148
```

Zwei Treffer, beide im selben RLS-Test. **Der Registereintrag stimmt.**

Und die Folge davon, ebenfalls gemessen:

```sql
select count(*) filter (where lane_step_id is null), count(*) from process_step;
 17 | 17
```

`process_step.lane_step_id` steht seit Migration 0445 und ist in **jeder**
Zeile NULL. Gelesen wird die Spalte auch nirgends: der einzige Treffer im ganzen
Baum ausserhalb der Migration ist die Schemadefinition selbst.

### 2.2 Warum das ein Produktdefekt ist und nicht nur eine fehlende Funktion

Ohne Zeilen fällt die Diagrammschicht auf `laneOf()` in
`packages/bpmn/src/grc/graph.ts` zurück. Die Datei sagt selbst, was sie tut
(Zeile 57): _„Containment rein geometrisch: BPMN-DI kennt keine
Elternbeziehung … Der engste umschliessende Container gewinnt."_

Bei sauber gestapelten Lanes stimmt das. Bei **überlappenden** Rahmen nicht —
und die erzeugt jeder Editor, der Lanes frei verschieben lässt. Nachgemessen in
`src/__tests__/api/process-lane-import.test.ts`, Teil A, an einer Szene, die
`buildGrcGraph`/`laneOf` unverändert aus `packages/bpmn` bezieht:

```
Lane_Fach   x 160…760, y  80…280   Fläche 600 × 200 = 120.000
Lane_IT     x 160…660, y 180…380   Fläche 500 × 200 = 100.000
Task_Pruefung  Mittelpunkt (350, 240)  — liegt in BEIDEN Rahmen

laneOf(graph, "Task_Pruefung")            → "Lane_IT"     (kleinere Fläche)
Modell: <lane id="Lane_Fach"><flowNodeRef>Task_Pruefung</flowNodeRef>
                                          → "Lane_Fach"
```

Die Geometrie sagt „IT-Betrieb", das Modell sagt „Fachbereich". In einem
GRC-Produkt ist das keine Kosmetik: die Lane trägt die **Verantwortlichkeit**.
Eine falsch zugeordnete Lane heisst falsche Rolle in der SoD-Rückfallbestimmung
(F3), falsche Vertrauensgrenze (F5) und eine Kenntnisnahmequote (F17), die der
falschen Einheit zugerechnet wird.

### 2.3 Reparatur

**BPMN braucht keine Geometrie.** `bpmn:lane` führt seine Mitglieder explizit
als `bpmn:flowNodeRef`, und `bpmn:participant` zeigt über `processRef` auf den
Prozess, dessen Elemente der Pool enthält. Das ist die Aussage des
Modellierers, und sie überlebt jedes Verschieben eines Rahmens.

Neu:

| Datei                                         | Was                                                         |
| --------------------------------------------- | ----------------------------------------------------------- |
| `api/v1/processes/_lib/bpmn-lanes.ts`         | Der Leser: Lanes, Pools, Verschachtelung, Mitgliedschaft    |
| `api/v1/processes/_lib/sync-process-lanes.ts` | Der Schreiber: `process_lane` + `process_step.lane_step_id` |

Gelesen wird mit `parseXml` aus `@grc/bpmn/util` — **derselbe Leser**, auf den
`packages/shared/src/bpmn-parser.ts` in Welle 2b umgestellt wurde, und aus
demselben Grund (OP-037): ein Präfixvergleich lehnt `ns0:`- und
`semantic:`-Dokumente ab, die gültiges BPMN 2.0 sind. Ein Test hält das fest.

**Die Rangfolge der Zuordnung** ist die fachliche Entscheidung dieser Datei:

1. Die **tiefste** Lane, die das Element als `flowNodeRef` führt. „Sachbearbeitung
   Team Nord" ist die genauere Aussage als „Sachbearbeitung", und die
   Verantwortlichkeit hängt an der genaueren.
2. Nur wenn keine Lane das Element nennt: der **Pool** über `processRef`. Ein
   Pool ohne Lanes ist die übliche Form für einen externen Beteiligten — dort
   _ist_ der Pool die Verantwortlichkeitsaussage.
3. Sonst NULL — ausdrücklich zurückgesetzt, nicht stehen gelassen. Eine alte
   Zuordnung, die das Modell nicht mehr trägt, sieht wie eine Aussage aus.

**Die nicht offensichtliche Entscheidung: der Import überschreibt den Träger
nicht.** Rolle, Organisationseinheit, Dienstleister, `is_external` und
`third_country` stehen nicht im XML. Ein `ON CONFLICT DO UPDATE`, das sie
mitschriebe, löschte bei **jedem** Speichern einer Version die Aussage „diese
Lane wird von Dienstleister X in einem Drittland betrieben" — ein
Compliance-Befund, den niemand aufgehoben hat. Aktualisiert werden nur `name`,
`kind` und `sequence_order`.

Aus demselben Grund wird eine **verschwundene** Lane nur gelöscht, wenn sie
keinen Träger führt. `process_lane` kennt kein `deleted_at` (0444), und ein
hartes DELETE auf einer Zeile mit Dienstleister wäre derselbe stille Verlust.
Zeilen mit Träger bleiben stehen, werden als `orphaned` gemeldet und in der
Maske als „nicht mehr im Diagramm" gekennzeichnet — mit einem eigenen
Löschknopf, damit die Entscheidung bei einem Menschen liegt. Kommt die Lane
unter derselben BPMN-ID zurück (der Normalfall nach einem Round-Trip durch ein
fremdes Werkzeug), ist ihr Träger noch da.

### 2.4 Der dritte Schreibpfad, den der Registereintrag nicht nennt

Verdrahtet ist die Synchronisation an **drei** Stellen, nicht an einer:

| Pfad                                                     | Auslöser                  |
| -------------------------------------------------------- | ------------------------- |
| `POST /api/v1/processes/import-bpmn-xml`                 | Import einer Fremddatei   |
| `POST /api/v1/processes/[id]/versions`                   | Speichern im Editor       |
| `promoteWorkingVersion()` — über `status` und `…/decide` | Freigabe/Veröffentlichung |

Der dritte war der Fund. `promoteWorkingVersion()` in
`apps/web/src/lib/process-working-version.ts` zieht die Arbeitskopie zur
freigegebenen Version hoch und **synchronisiert `process_step` selbst** (mit
dem Kommentar „same semantics as the save path"). Ohne einen Nachzug hätte
`process_lane` nach jeder Freigabe den Stand _vor_ der Arbeitskopie gezeigt —
also genau dann falsch, wenn der Prozess produktiv geht.

Die Datei liegt ausserhalb der Dateihoheit dieser Welle. Statt sie anzufassen,
rufen die **beiden aufrufenden Routen** unmittelbar nach der Beförderung
`syncLanesFromCurrentVersion()` auf; die Lücke in der Bibliotheksfunktion steht
als Übergabeeintrag im Wächter und muss verschwinden, sobald jemand sie
schliesst.

### 2.5 Wächter und Gegenprobe

`apps/web/src/__tests__/api/process-lane-import.test.ts` — **15 Tests**, vier
Teile:

- **A** misst den Defekt an `laneOf` aus `packages/bpmn` (unverändert
  importiert, nicht nachgebaut).
- **B** prüft den Leser: Mitglieder, Verschachtelung, Pool-Rückfall,
  `ns0:`-Präfix, „ein Diagramm ohne Lanes ist kein Fehler".
- **C** prüft den Schreibpfad gegen einen kleinen SQL-Doppelgänger: Anlegen,
  Nachziehen, Verschachtelung, **Träger bleibt**, verwaiste Zeile, Rückfall auf
  NULL.
- **D** ist die Regel: jede Route unter `/processes`, die Schritte aus BPMN-XML
  schreibt, ruft die Synchronisation — und tut es im `withAuditContext`-Rahmen.

**Gegenprobe (Defekt künstlich wieder eingebaut, jeweils zurückgebaut):**

| Sabotage                                                       | Ergebnis                             |
| -------------------------------------------------------------- | ------------------------------------ |
| `flowNodeRefs` beim Zuordnen ignorieren (= wieder geometrisch) | 3 Tests rot (A, B)                   |
| `vendor_id = NULL` ins UPDATE aufnehmen                        | 2 Tests rot (C)                      |
| Aufruf aus `versions/route.ts` entfernen                       | 1 Test rot (D)                       |
| _alle drei zusammen_                                           | **6 von 15 rot**, danach wieder grün |

### 2.6 Messung an der echten Datenbank

Gegen `welle1_verify`, mit einem Wegwerf-Prozess und zwei Schritten:

```
Lanes vorher: 0
Statistik:    {"lanesInserted":3,"lanesUpdated":0,"lanesDeleted":0,
               "orphaned":0,"stepsAssigned":2,"stepsCleared":0,"ambiguous":[]}

 step            lane          lane_name       kind
 Task_Pruefung   Lane_Fach     Fachbereich     lane
 Task_Buchung    Lane_IT       IT-Betrieb      lane

 bpmn_element_id  name            kind   sequence_order
 Pool_Haus        Eigenes Haus    pool   0
 Lane_Fach        Fachbereich     lane   1
 Lane_IT          IT-Betrieb      lane   2
```

`Task_Pruefung` landet in `Lane_Fach` — dort, wo das Modell ihn hinstellt, und
nicht dort, wohin die Geometrie ihn gerechnet hätte.

### 2.7 Was OP-002 **nicht** erledigt

Die Tabelle ist gefüllt und `lane_step_id` gesetzt. **Die Diagrammschicht liest
die Spalte noch nicht** — `laneOf()` in `packages/bpmn/src/grc/graph.ts` bleibt
die Quelle der Schritt-zu-Lane-Zuordnung, und diese Datei gehört dem parallelen
Strang. Der Overlay-Endpunkt liest `process_lane` bereits (die `lanes`-Abfrage
steht seit Stufe 2 E), also bekommen **F5 und F17 ab sofort Daten**; die
geometrische Fehlzuordnung eines einzelnen Schritts bei überlappenden Rahmen
verschwindet erst, wenn `laneOf` bei vorhandenem `lane_step_id` daran vorbeigeht.
Siehe §5.

---

## 3. OP-001 — die Pflegeoberfläche

### 3.1 Der Schnitt, und warum er so liegt

Vier von zehn Tabellen haben jetzt eine Maske. Sechs nicht. Der Schnitt folgt
der Frage aus §1:

**Gebaut**

| Tabelle             | Warum zuerst                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sod_rule`          | Die einzige, die **kein** Importpfad je füllen kann. Ohne Maske ist F3 nicht leer, sondern unerreichbar. Zugleich die kleinste Tabelle — bestes Verhältnis von Aufwand zu freigeschaltetem Layer. |
| `process_lane`      | OP-002 legt die Zeilen an; nur der **Träger** braucht einen Menschen. Ohne ihn kann F5 keine Vertrauensgrenze zeichnen, obwohl alle Zeilen da sind — die frustrierendste Form von „leer".         |
| `process_step_raci` | C und I haben ausserhalb dieser Tabelle **keine Heimat** (`process_raci_override` kennt nur rohe Lane-IDs ohne FK auf `custom_role`, `STUFE2-E` §1.3).                                            |
| `process_step_bia`  | Eine Tabelle, zwei Layer (`bcm`, `outage`/F6), ein Formular je Schritt. Bestes Verhältnis unter den verbliebenen.                                                                                 |

**Zurückgestellt, mit Grund**

| Tabelle                      | Grund                                                                                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `process_step_ropa`          | Drei Tabellen in einem Zug (Migration 0448 fasst sie nicht zufällig zusammen). Das ist ein eigenes Arbeitspaket, kein Anhängsel — vier Layer hängen daran, und der Empfängerteil ist polymorph. |
| `process_step_data_category` | Fachlich eine Einheit mit `process_step_ropa`; die Kategoriechips sind ohne die ROPA-Zeile darüber nicht darstellbar.                                                                           |
| `process_step_recipient`     | Ebenso; polymorph über `kind` (vendor \| org_unit) und damit zwei Auswahllisten in einer Maske.                                                                                                 |
| `process_step_document`      | Braucht die Dokumentauswahl aus dem DMS. Die Verknüpfung ist `ON DELETE RESTRICT` und damit ein **Nachweis** — eine halbgare Auswahl wäre hier teurer als keine.                                |
| `process_event_activity_map` | Wird maschinell befüllt. Die Maske korrigiert nur und hat ohne einen Importlauf davor nichts zu zeigen; der Importlauf gehört zum Mining-Strang.                                                |
| `user_diagram_preference`    | Der Schreiber gehört in `components/bpmn/grc-view-select.tsx` — fremde Dateihoheit. **Der parallele Strang arbeitet in dieser Welle daran** (OP-003); siehe §5.                                 |

Der Schnitt steht nicht nur hier, sondern als **prüfbare Liste** im Wächter
(`grc-maintenance-surface.test.ts`, Teil B): gebaut + zurückgestellt muss genau
die zehn Tabellen ergeben, jeder zurückgestellte Eintrag braucht einen Grund,
und sobald eine zurückgestellte Tabelle doch eine Schreibroute bekommt, wird
der Test rot, bis der Eintrag verschwindet.

### 3.2 Was gebaut ist

| Fläche                 | Seite                                  | Lesen                   | Schreiben                                       |
| ---------------------- | -------------------------------------- | ----------------------- | ----------------------------------------------- |
| Lanes und Träger       | `(dashboard)/processes/[id]/lanes`     | `GET  …/[id]/lanes`     | `PATCH`/`DELETE …/[id]/lanes/[laneId]`          |
| Aufgabentrennung       | `(dashboard)/processes/sod-rules`      | `GET  …/sod-rules`      | `POST …/sod-rules`, `PATCH`/`DELETE …/[ruleId]` |
| RACI je Schritt        | `(dashboard)/processes/[id]/step-raci` | `GET  …/[id]/step-raci` | `PUT  …/[id]/step-raci/[stepId]`                |
| Kontinuität je Schritt | `(dashboard)/processes/[id]/step-bia`  | `GET  …/[id]/step-bia`  | `PUT`/`DELETE …/[id]/step-bia/[stepId]`         |

Dazu ein neuer i18n-Namensraum `process-grc` (DE und EN, 99 Schlüssel je
Sprache, deckungsgleich) und ein Verweisband auf der Prozessseite.

### 3.3 Sieben Entscheidungen, die nicht selbstverständlich sind

**1. Das Verweisband ist Teil der Reparatur, nicht Zierrat.**
`processes/[id]/racm` ist gebaut, ohne i18n und **von keiner Stelle im Baum
verlinkt**: gemessen an `c635a970` nennen nur die Seite selbst, drei Tests und
`audit-pack/route.ts` das Wort „racm", und keiner davon ist ein Verweis, dem ein
Benutzer folgen könnte. Eine Pflegeoberfläche, die niemand findet, pflegt
nichts. Der Wächter prüft die vier Verweise mit.

**2. Die Auswahllisten kommen aus der eigenen Route, nicht aus `/admin/roles`,
`/eam/org-units` und `/vendors`.** Die drei hängen an den Modulen `eam` bzw.
`tprm` und an Rollen, die ein `process_owner` nicht hat (`/admin/roles` verlangt
`admin`, `/eam/org-units` verlangt `eam` + `admin|risk_manager|viewer`). Aus
dem Browser eines Prozessverantwortlichen käme dreimal 403 zurück — und die
Maske zeigte drei **leere** Auswahllisten. Das ist OP-050 in Reinform: eine
leere Liste, die wie eine Aussage über den Datenbestand aussieht. Die
Dienstleisterliste hat deshalb eine ausdrückliche Obergrenze (200) mit einem
`vendorsTruncated`-Flag und einem Suchfeld; sie wird nie stillschweigend
gekappt.

**3. Der Träger wird per PATCH gepflegt, und PATCH heisst PATCH.**
`lanePatchFrom()` (`_lib/grc-maintenance.ts`) schreibt **nur** Schlüssel, die im
Aufruf standen. `null` ist ein Wert (löschen), `undefined` ist keiner
(unverändert). Ein `{ vendorId: v.vendorId ?? null, … }` hätte bei jeder
Teiländerung den Dienstleister mitgelöscht — dieselbe Fehlerklasse wie in §2.3,
nur eine Schicht höher.

**4. Die SoD-Selbstpaarung ist erlaubt und in der Maske erklärt.**
`STUFE2-A2-GRC.md` §7.3 verbietet ein `CHECK (role_a_id <> role_b_id)`
ausdrücklich, weil „dieselbe Rolle verantwortet beide Aufgaben" der Verstoss
ist, den ein IKS-Prüfer sucht. Ein `refine` im Zod-Schema wäre dieselbe Sperre
eine Schicht höher gewesen. Der Wächter hält das fest; die Maske sagt es dem
Benutzer, damit es nicht wie ein Eingabefehler aussieht.

**5. Das Spiegelpaar wird als 409 abgefangen, nicht als 500.** Die
Eindeutigkeit über das ungeordnete Paar steht als funktionaler Index in 0446
und **greift** (gemessen, §3.5). Ohne die Vorprüfung sähe der Benutzer einen
Serverfehler statt „für dieses Rollenpaar gibt es bereits eine Regel".

**6. RACI wird ersetzend geschrieben (PUT), nicht additiv.** Die vorhandene
Rehydrierung (`rehydrateFromBpmnXml`) ist ausdrücklich „insert-only; never
deletes". Für eine Pflegemaske ist das zu wenig: „Rolle X ist hier **nicht
mehr** zu konsultieren" ist eine Aussage, die eine Oberfläche treffen können
muss. Löschen und Neuanlegen laufen in **einer** Transaktion mit Audit-Rahmen —
`process_step_raci` hängt am `audit_trigger` (0447), und ein Zwischenzustand
ohne Verantwortlichen wäre in der Prüfungsspur sichtbar.

**7. `0` ist ein Messwert, keine Leere.** `biaValuesFrom()` normalisiert mit
`?? null`, nie mit `|| null`. `simulateOutage` wertet
`workaround_max_duration_minutes = 0` als „die Übergangslösung trägt nicht"
(§7.4). Ein `|| null` machte aus dieser Aussage eine Lücke — und aus einem
Ausfallszenario ein anderes. Die Maske hält den Unterschied ebenfalls: `""`
heisst „nicht bewertet", `"0"` heisst 0.

### 3.4 Der stille Leerzustand

Alle vier Seiten laden über `fetchJson` aus `@/lib/api-client` und rendern im
Fehlerfall `ErrorRetry`, nicht ihren Leerzustand. Kein `?? []`, kein
`catch { setRows([]) }`, kein nacktes `fetch(`. Der Wächter prüft alle drei
Eigenschaften je Seite — einschliesslich der Negativbedingung „kein `fetch(`",
weil genau das der Weg ist, auf dem aus einem 422 ein Datenbestand wird.

Der Leerzustand dieser Seiten ist eine echte Aussage: „dieser Prozess hat keine
Lanes", „es sind noch keine Regeln hinterlegt". Er muss deshalb stimmen.

### 3.5 Wächter und Gegenprobe

`apps/web/src/__tests__/api/grc-maintenance-surface.test.ts` — **32 Tests**:

- **A** die gebaute Fläche: Seite + Leseroute + Schreibroute je Tabelle, i18n,
  Vertragsclient, `ErrorRetry`, Verweise auf der Prozessseite, Audit-Rahmen.
- **B** der Schnitt als prüfbare Liste (siehe §3.1).
- **C** die beiden Umrechnungen (`lanePatchFrom`, `biaValuesFrom`).
- **D** die Verträge: Selbstpaarung erlaubt, Drittland ohne „extern"
  abgelehnt, leerer PATCH abgelehnt, ISO-3166-Form, Kritikalität ohne
  Vorgabewert, negative Minuten abgelehnt und `0` nicht.

**Gegenprobe:**

| Sabotage                                                           | Ergebnis                             |
| ------------------------------------------------------------------ | ------------------------------------ |
| `?? null` → `\|\| null` bei `workaroundMaxDurationMinutes`         | 1 Test rot                           |
| `if ("vendorId" in v)` entfernt                                    | 2 Tests rot                          |
| Verweis auf `step-bia` von der Prozessseite entfernt               | 1 Test rot                           |
| `fetchJson` in einer Seite durch `fetch` ersetzt                   | 1 Test rot                           |
| `.refine((v) => v.roleAId !== v.roleBId)` an `createSodRuleSchema` | 1 Test rot                           |
| _alle fünf zusammen_                                               | **6 von 32 rot**, danach wieder grün |

**Messung an der echten Datenbank** (`welle1_verify`, alle vier Schreibpfade
mit den Tabellenobjekten und Hilfsfunktionen der Routen, danach aufgeräumt):

```
1) Lane-PATCH:               { thirdCountry: 'US', isExternal: true }   ("us" normalisiert)
2a) Selbstpaarung angelegt:  true
2b) Spiegelpaar abgelehnt:   true                                       (sod_rule_pair_uniq greift)
3) RACI nach ersetzendem PUT: [ 'A' ]                                   (C und I sind weg)
4) BIA nach Upsert:          { criticality: 'very_high', rpo: 15, waMax: 0, count: 1 }
```

Zeile 4 ist die wichtigste: **eine** Zeile nach zwei Aufrufen (der
`onConflictDoUpdate` findet `process_step_bia_step_uniq`), und `waMax: 0` ist
durchgekommen.

---

## 4. Abnahme

| Prüfung                                                       | vorher                        | nachher                               |
| ------------------------------------------------------------- | ----------------------------- | ------------------------------------- |
| `apps/web` — `npx vitest run`                                 | 2.562 / 110 Dateien           | **2.660 / 113 Dateien**, 2 rot ¹      |
| davon aus dieser Welle                                        | —                             | **+47 in 2 neuen Dateien**            |
| `packages/db` — `npx vitest run`                              | 107 / 8 Dateien               | **107 / 8** (unverändert)             |
| `apps/web` — `vitest run src/__tests__/a11y/`                 | 30                            | **30**, grün                          |
| `node scripts/audit-i18n-usage.mjs --max-untranslated 151`    | Exit 0, 78/482 + 73/134 = 151 | **Exit 0**, 78/486 + 73/134 = **151** |
| `node scripts/check-route-rls-context.mjs`                    | Exit 0                        | **Exit 0**, 0 neue unwrapped          |
| `node scripts/lint-ratchet.mjs`                               | 306 (Baseline 306)            | **306 (Baseline 306)**                |
| `npx prettier --check .`                                      | Exit 0                        | **Exit 0** für eigene Dateien ²       |
| `tsc --noEmit` (`apps/web`, `packages/db`, `packages/shared`) | 0 Fehler                      | **0 Fehler**                          |
| Migrationen von Null (`welle3a_fresh`)                        | —                             | **425/425**, 613 Tabellen             |
| `audit-rls-coverage.mjs` gegen `welle1_verify`                | —                             | **615 Objekte, 0 Lücken**             |

¹ Die zwei roten Tests stehen in
`src/__tests__/components/bpmn-chrome-plane.test.tsx`. **Die Testdatei selbst
ist unverändert** (`git status` meldet sie nicht); rot wird sie, weil
`components/bpmn/grc-view-select.tsx` jetzt
`/api/v1/processes/[id]/diagram-overlay/preference` abfragt — eine Route und
eine Hilfsdatei (`components/bpmn/grc-view-preference.ts`), die es vor dieser
Welle nicht gab und die **beide in der ausdrücklich fremden Dateihoheit** des
parallelen Strangs liegen (OP-026/OP-003). Die Fehlermeldung nennt genau diese
URL. Kein Pfad dieser Welle berührt sie.

² `apps/web/src/__tests__/api/diagram-overlay-preference.test.ts` ist
unformatiert und gehört dem parallelen Strang; alle Dateien dieser Welle sind
formatiert.

**Die i18n-Ratsche steht auf dem Anschlag und hat sich nicht bewegt.** Vier
neue Seiten sind dazugekommen (482 → 486), und die Zahl der Seiten ohne i18n ist
bei 78 geblieben. Das ist der Zweck der Ratsche und der Beleg, dass die vier
Masken vollständig übersetzt sind.

**Keine Migration belegt.** Der zugewiesene Bereich **0467–0474 bleibt frei**:
alle zehn Tabellen stehen seit 0444–0452, `process_step.lane_step_id` seit
0445, und diese Welle brauchte weder eine neue Spalte noch einen neuen Index.
Eine Migration ohne Bedarf zu schreiben, nur weil ein Bereich reserviert war,
wäre eine Änderung an einem Schema, das stimmt.

---

## 5. Was an die folgenden Wellen weitergeht

**An den BPMN-Strang (`packages/bpmn`, `lib/grc-overlay.ts`, `components/bpmn`)**

- **`lane_step_id` wird geschrieben, aber nicht gelesen.** `laneOf()` in
  `packages/bpmn/src/grc/graph.ts` bestimmt die Lane weiterhin geometrisch. Der
  Schritt, der OP-002 zu Ende bringt: bei vorhandenem `lane_step_id` an der
  Geometrie vorbeigehen und nur dann darauf zurückfallen, wenn die Spalte NULL
  ist. Der Endpunkt müsste `lane_step_id` dafür in `elements[]` mitliefern —
  eine Zeile in einer Abfrage, die es schon gibt.
- **`ambiguous` aus `syncProcessLanes`** meldet Elemente, die mehrere Lanes
  derselben Tiefe beanspruchen (im Modell ein Widerspruch). Heute wird der Fall
  gezählt und nicht angezeigt. Er gehört als Modellierungsbefund neben die
  Validierungsmarker (OP-011).

**An das nächste Paket von OP-001**

- **ROPA je Schritt** (`process_step_ropa` + `…_data_category` +
  `…_recipient`): das grösste verbliebene Stück, vier Layer, drei Tabellen. Die
  Bauform steht: eine 1:1-Maske je Schritt mit zwei untergeordneten Listen; die
  Empfängerliste braucht wegen `kind` (vendor \| org_unit) zwei Auswahlquellen.
- **`process_step_document`**: braucht die Dokumentauswahl aus dem DMS und eine
  Behandlung für `ON DELETE RESTRICT` (Soft-Delete ist der offene Weg, hartes
  Löschen wird laut).
- **`process_event_activity_map`**: erst sinnvoll, wenn der Mining-Strang einen
  Importlauf hat, der sie maschinell füllt. Die Maske ist dann eine
  Korrekturliste mit `mapped_by`/`mapped_at`.

**An die Bibliotheksschicht**

- **`promoteWorkingVersion()`** (`apps/web/src/lib/process-working-version.ts`)
  synchronisiert `process_step` selbst, aber nicht `process_lane`. Die beiden
  aufrufenden Routen holen es nach; sauberer wäre der Aufruf in der
  Bibliotheksfunktion. Der Wächter führt das als Übergabeeintrag, der
  verschwinden muss.

**Beobachtung, kein Auftrag**

- Die Auswahllisten in `/admin/roles`, `/eam/org-units` und `/vendors` sind für
  prozessnahe Rollen nicht erreichbar (403 bzw. Modulsperre). Diese Welle ist
  ausgewichen; die Frage, ob Stammdaten-Auswahllisten eine eigene, schwächer
  geschützte Route brauchen, ist grösser als ein Ausweichmanöver und gehört
  entschieden statt viermal umgangen.

---

## 6. Korrekturen am Register

| Punkt      | Was im Register steht                                                                                                             | Was gemessen wurde                                                                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OP-001** | „Keine Oberfläche für die zehn neuen GRC-Tabellen (Lanes, SoD, Schritt-ROPA, Schritt-BIA, Schritt-Dokument, Aktivitätszuordnung)" | Die Klammer nennt **sechs** Bereiche, der Punkt aber zehn Tabellen. `process_step_raci`, `process_step_data_category`, `process_step_recipient` und `user_diagram_preference` fehlen in der Aufzählung.               |
| **OP-001** | implizit: „die Daten sind da, es fehlt nur die Maske"                                                                             | **Alle zehn Tabellen sind leer** — auch in der geseedeten Datenbank. Es fehlt nicht nur die Maske, es fehlt jede Zeile. Das ändert die Reihenfolge: Tabellen, die kein Automat füllen kann, gehen vor.                |
| **OP-001** | Status offen, Umfang XL                                                                                                           | **Vier von zehn erledigt** (`process_lane`, `sod_rule`, `process_step_raci`, `process_step_bia`). Sechs offen, mit Begründung je Tabelle in §3.1 und als prüfbare Liste im Wächter.                                   |
| **OP-002** | „Importer legt keine `process_lane`-Zeilen an", Umfang M                                                                          | Die Fundstellenangabe stimmt exakt. **Es sind aber drei Schreibpfade**, nicht einer — Import, Versionsspeicherung und die Beförderung der Arbeitskopie. Der dritte war im Bericht nicht genannt.                      |
| **OP-002** | „bei überlappenden Rahmen ordnet die Diagrammschicht Schritte der falschen Lane zu"                                               | **Bestätigt und beziffert** (§2.2). Zusätzlich: `process_step.lane_step_id` war in 17 von 17 Zeilen NULL und wurde von **niemandem** gelesen — die Spalte war seit 0445 tot.                                          |
| **OP-002** | „F5/F17 werden damit belastbar"                                                                                                   | **Halb.** Die Layer bekommen Daten (der Endpunkt liest `process_lane` bereits). Die Schritt-zu-Lane-Zuordnung bleibt geometrisch, bis `packages/bpmn` `lane_step_id` liest — fremde Dateihoheit, weitergereicht (§5). |
| **OP-003** | „`user_diagram_preference` wird von niemandem geschrieben"                                                                        | Bestätigt (0 Zeilen). **Wird im selben Zeitraum vom parallelen Strang bearbeitet** (`components/bpmn/grc-view-preference.ts`, `diagram-overlay/preference/`, Migration 0475) — hier deshalb nicht angefasst.          |
