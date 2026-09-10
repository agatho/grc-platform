# Stufe 2 / E — Das Schema für die zehn leeren GRC-Layer

Repo `/work/repo`, Branch `audit/full-2026-08-31`, aufgesetzt auf `81200d89`.
Nicht committet, wie beauftragt.

**In drei Sätzen.** Zehn der 23 GRC-Diagramm-Layer blieben leer, weil ihnen im
Schema die Heimat fehlte (`STUFE2-D-OFFENE-PUNKTE.md` §1.5); diese Stufe legt
die **zehn Tabellen** und **fünfzehn Spalten in acht Bestandstabellen** aus der
Bedarfsliste `STUFE2-A2-GRC.md` §5 an, gehärtet nach dem Standard, den das Audit
hinterlassen hat. Der Overlay-Endpunkt liest sie: **23 von 23 Layern bekommen
jetzt echte Daten**, `MISSING_TODAY` schrumpft von dreizehn Einträgen auf
sieben, und keiner der verbliebenen ist eine fehlende Tabelle — es sind
Angaben, die die vorhandenen Daten nachweislich nicht hergeben. Migrationen
`0444`–`0454`, alles additiv, `419/419` gegen eine frische Datenbank.

---

## 0. Stand in Zahlen

| Messwert                                   | vorher (Stand D) | jetzt                                         |
| ------------------------------------------ | ---------------- | --------------------------------------------- |
| Layer mit echten Daten (von 23)            | **13**           | **23**                                        |
| Layergruppen des Endpunkts (`?layers=`)    | 11               | **17**                                        |
| Abfragen des Endpunkts                     | 12               | **23**                                        |
| Einträge in `MISSING_TODAY`                | 13               | **7**                                         |
| davon „Tabelle fehlt"                      | 6                | **0**                                         |
| Migrationen auf frischer Datenbank         | 408/408          | **419/419**, 613 Tabellen                     |
| Neue Tabellen                              | —                | **10**, alle mit `org_id`, RLS **und** FORCE  |
| Erweiterte Bestandstabellen                | —                | **8** (15 Spalten)                            |
| Schema-Drift (beide Richtungen)            | 0                | **0** — 0 fehlende, 0 nur-in-DB, 0 RLS-Lücken |
| RLS-Systemtest, geseedete Objekte          | 535              | **545** — die zehn neuen eingeschlossen       |
| Tests `packages/db` (RLS-Konfiguration)    | 79               | **142**                                       |
| Tests `apps/web` `lib/grc-overlay` + Route | 34               | **59**                                        |

---

## 1. Die zehn Tabellen

Reihenfolge wie in den Migrationen. Jede trägt `org_id NOT NULL` mit
Fremdschlüssel auf `organization`, `ENABLE` **und** `FORCE ROW LEVEL SECURITY`,
eine `FOR ALL`-Policy in der kanonischen NULLIF-Form (USING **und** WITH CHECK),
einen führenden Index auf `org_id` (S09-14), je einen Index auf jedem
Fremdschlüssel (S09-13) und einen `GRANT` an `grc_app`. Wo unten „Audit: ja"
steht, hängt zusätzlich der `audit_trigger` (S03-13).

### 1.1 `process_lane` — Migration 0444

**Zweck.** Lane bzw. Pool eines Diagramms mit ihrem _Träger_: Rolle,
Organisationseinheit, Dienstleister, Drittland.

**Felder.** `bpmn_element_id`, `step_key`, `name`, `kind` (`lane|pool`),
`parent_lane_id`, `org_unit_id`, `custom_role_id`, `vendor_id`, `is_external`,
`third_country char(2)`, `sequence_order`.

**Entscheidungen.**

- **Eigene Tabelle statt `process_step.step_type += lane`** — die Vorlage
  stellte beides zur Wahl. Der Ausschlag gab nicht die Ästhetik, sondern eine
  Nebenwirkung: eine Lane als `process_step`-Zeile geriete in **jede
  bestehende Abfrage über Schritte**, die heute richtig ist (Risikoanzahl je
  Schritt, Kontrollabdeckung, Conformance-Quote). Das wäre eine stille
  Verfälschung von Bestandszahlen.
- **`vendor_id` und `custom_role_id` mit `ON DELETE RESTRICT`** (S09-10). Der
  Dienstleister an einer Lane _ist_ die Vertrauensgrenze; verschwände er still,
  verschwände mit ihm die Doppelkante von F5 — ein Compliance-Befund, den
  niemand aufgehoben hat. `org_unit_id` dagegen `SET NULL`: eine
  Organisationseinheit ist eine Beschriftung, kein Befund.
- `process_id` `CASCADE` (wie `process_step`), `parent_lane_id` `CASCADE` (eine
  Lane in einem gelöschten Pool ist ein Widerspruch, kein Rest).

**Audit: ja.** Wer eine Lane von der eigenen Einheit auf einen Dienstleister im
Drittland umschreibt, ändert eine Datenschutzaussage über den ganzen Prozess.

**Lebendige Layer:** `trust-boundary` (F5), `lane` (F17) — und der
Lane-Rückfall der Rollenbestimmung in `sod` (F3).

### 1.2 `sod_rule` — Migration 0446

**Zweck.** Die Regelmenge der Aufgabentrennung. Im Schema gab es dafür nichts:
`abac_policy` und `access_review` beschreiben _Zugriffsrechte_, nicht die
Unverträglichkeit zweier _fachlicher Aufgaben_.

**Felder.** `role_a_id`, `role_b_id`, `severity`, `rationale`, `framework_ref`,
`is_active`.

**Entscheidungen.**

- **Kein `CHECK (role_a_id <> role_b_id)`** — ausdrücklich verboten
  (`STUFE2-A2-GRC.md` §7.3). Der eigentliche Verstoß, den ein IKS-Prüfer sucht,
  ist „dieselbe Rolle verantwortet beide Aufgaben", also genau die
  Selbstpaarung. Ein Test legt sie an und liest sie zurück.
- **`severity` als Werteliste in der Vertragsform**, nicht als
  `finding_severity`. Der Enum ist seit 0293 ISO-19011-konform und kennt zehn
  Werte, von denen keiner `low`/`medium`/`high`/`critical` heißt; der Endpunkt
  musste dafür bereits eine verlustbehaftete Zuordnung bauen (D §1.3). Eine
  Regelwerkseinstufung ist keine Auditfeststellung nach ISO 19011 — sie hier
  gleich in der Vertragsform zu führen erspart die zweite Übersetzung und ihre
  Fehlerklasse.
- **Eindeutigkeit über das ungeordnete Paar**
  (`UNIQUE(org_id, LEAST(a,b), GREATEST(a,b))`). Ohne das ließen sich (A,B) und
  (B,A) beide anlegen, und `computeSod` fände jeden Konflikt zweimal — die
  Kopfzeile meldete „2 Konflikte" für einen. Ein Test legt das Spiegelpaar an
  und erwartet den Fehlschlag.
- Beide Rollen-FKs `RESTRICT`: eine Regel, die durch das Löschen einer Rolle
  verschwindet, nimmt eine Kontrolle mit.

**Audit: ja, und hier am stärksten.** Diese Tabelle _ist_ die Kontrolle; eine
deaktivierte Regel lässt einen Konflikt aus dem Diagramm verschwinden.

**Lebendiger Layer:** `sod` (F3).

### 1.3 `process_step_raci` — Migration 0447

**Zweck.** Vollständige RACI-Zuordnung je Schritt. C und I hatten überhaupt
keine Heimat: `process_raci_override` führt sie zwar, benennt die Beteiligten
aber über rohe BPMN-Lane-IDs ohne Fremdschlüssel auf `custom_role`.

**Felder.** `process_step_id`, `role_id`, `raci_role`, `source`, `note`.

**Entscheidungen.**

- **Die Bestandsspalten an `process_step` bleiben** und werden nicht migriert —
  sie sind die Quelle des heute funktionierenden `raci`-Layers. Der Endpunkt
  liest beides, mit einer festgelegten und getesteten **Vorrangregel**: eine
  Zeile dieser Tabelle gewinnt gegen die denormalisierte Spalte, weil sie die
  spezifischere und die pflegbare Angabe ist. C und I ausschließlich von hier.
- **`varchar(1)`, nicht `char(1)`** — zwei gemessene Gründe: `bpchar` füllt mit
  Leerzeichen auf (jeder Leser müsste `trim()`, ausgerechnet in der Spalte, die
  „wer ist rechenschaftspflichtig" beantwortet), und der typgetriebene
  Wertgenerator des RLS-Systemtests erkennt eine Werteliste nur in der Form
  `((spalte)::text = ANY …)`, die PostgreSQL für `varchar` erzeugt und für
  `bpchar` nicht. **Mit `char(1)` wäre diese Tabelle als einzige der zehn im
  Systemtest nicht geprüft gewesen** — nachgemessen an `_wp2_seed_errors`, wo
  sie in der ersten Fassung als einziger Fehler stand.
- `role_id` `RESTRICT`, `process_step_id` `CASCADE` (wie
  `process_step_control`).

**Audit: ja.**

**Lebendige Felder:** `raci.consulted`, `raci.informed`.

### 1.4 `process_step_ropa`, `process_step_data_category`, `process_step_recipient` — Migration 0448

**Zweck.** Art.-30-Angaben je Schritt, ihre Datenkategorien und ihre Empfänger.
Drei Tabellen in einer Migration, weil sie fachlich eine Einheit sind.

**Warum je Schritt.** `process_ropa_profile` gibt es seit 0333, aber 1:1 je
Prozess. Die Sicht „Datenschutz" beantwortet gerade die Frage, **welcher**
Schritt personenbezogene Daten verarbeitet — färbte man alle gleich, wäre die
Antwort immer „alle". Der Prozessbezug bleibt bestehen und gültig; der Endpunkt
liest ausschließlich die Schrittebene.

**Entscheidungen.**

- `legal_basis` benutzt den vorhandenen Enum `ropa_legal_basis` (die
  Art.-6-Liste) statt eines freien varchar daneben.
- `UNIQUE(process_step_id)` — der Vertrag führt `ropa` als Einzelobjekt; zwei
  widersprüchliche Verarbeitungsaussagen zu einem Schritt sind kein
  Modellierungsfall, sondern ein Datenfehler.
- `retention_months integer` (nicht Intervall): F10 rechnet in Monaten, die
  Filterschwelle der Sicht ist „< 12 Monate".
- `dpia_id` `RESTRICT`: eine DPIA ist Nachweis. Verschwände sie, kippte der
  Badge von „DPIA" auf „DPIA!" (erforderlich, aber nicht verknüpft) — ein
  Befund, der entstünde, ohne dass jemand an der Verarbeitung etwas geändert
  hat.
- **`is_special_category` wird redundant an der Zuordnung geführt**, nicht aus
  der Kategorie abgeleitet: `ropa_data_category` kennt nur `category varchar`
  als Freitext und keine Art.-9-Markierung. Sie aus dem Text zu erraten wäre
  eine Erfindung.
- **`ropa_data_category_id` `CASCADE`** — die **einzige** Stelle dieser Arbeit
  mit CASCADE, und deshalb ausdrücklich begründet: die Kategorie ist ein
  Stammsatz des VVT, die Zuordnung nur ein Verweis. Ohne Stammsatz hat der
  Kategoriechip keinen Titel und ist nicht darstellbar; eine Zeile
  stehenzulassen, die nichts zeigen kann, wäre kein Nachweis. Was verschwindet,
  hält der Audit-Trigger fest — er feuert auch bei kaskadiertem DELETE.
- `process_step_recipient` ist **polymorph** (`kind` = vendor | org_unit) und
  trägt deshalb keinen FK auf `recipient_id`; stattdessen CHECK, Index auf
  `(org_id, kind, recipient_id)` und zwei Joins im Endpunkt. Zwei getrennte
  nullable FK-Spalten wären die Alternative gewesen — sie hätten eine
  XOR-Bedingung gebraucht und jede Abfrage um ein COALESCE erweitert, ohne mehr
  zu garantieren.

**Audit: ja, auf allen dreien.** Art. 30 verlangt das Verzeichnis, Art. 5(2)
die Rechenschaft darüber.

**Lebendige Layer:** `privacy` (Formkodierung Personenbezug), die Kategoriechips
desselben Layers, `dpia`, `retention` (F10) — und die Personenbezugsprüfung,
ohne die F5 nur „Übergang ohne hinterlegten Personenbezug" melden kann.

### 1.5 `process_step_bia` — Migration 0449

**Zweck.** Kontinuitätskennzahlen je Schritt.

**Felder.** `criticality`, `mtpd_minutes`, `rto_minutes`, `rpo_minutes`,
`impact_categories jsonb`, `workaround`,
`workaround_max_duration_minutes`, `bia_assessment_id`.

**Entscheidungen.**

- **Minuten, nicht Stunden.** `bia_process_impact` führt `mtpd_hours` je
  _Prozess_. §3.10 rechnet den Reißpunkt als **Minimum über die Schritte** —
  ohne Elementebene gäbe es nichts zu minimieren, und die Zahl in der Kopfzeile
  wäre geschätzt statt gerechnet. Die Auflösung wird gebraucht: ein RPO von 15
  Minuten ist in Stunden nicht darstellbar, und genau solche Werte stehen in
  IT-Kontinuitätsplänen. Der Endpunkt liest ausschließlich diese Tabelle,
  mischt also keine Einheiten.
- `criticality` **NOT NULL ohne Vorgabewert**: der Vertrag führt das Feld als
  Pflicht, und ein Vorgabewert wäre hier eine Behauptung.
- `workaround_max_duration_minutes` lässt **0 ausdrücklich zu**:
  `simulateOutage` wertet 0 als „trägt nicht" (§7.4). Die 0 ist eine Aussage,
  kein fehlender Wert — sie darf nicht verboten und nicht auf NULL normalisiert
  werden. Ein Test hält das fest.
- `impact_categories jsonb` hält die Stelle frei, ohne eine Struktur zu
  behaupten, die heute niemand liest.

**Audit: ja.** MTPD/RTO/RPO sind die Zahlen, gegen die eine ISO-22301- bzw.
BSI-200-4-Prüfung den Plan hält.

**Lebendige Layer:** `bcm` (§3.10), `outage` (F6).

### 1.6 `process_step_document` — Migration 0450

**Zweck.** „Welche Arbeitsanweisung regelt **diesen** Schritt". `process_document`
hängt am Prozess; ein Prozess mit vierzig Aktivitäten und zwölf SOPs zeigte
sonst an jeder Aktivität dieselben zwölf.

**Entscheidungen.** `document_id` `RESTRICT` (S09-10) — die Verknüpfung ist ein
Nachweis: „dieser Schritt ist durch eine freigegebene Anweisung geregelt" ist
genau die Aussage, die ein Auditor stichprobenartig prüft. `document` kennt
Soft-Delete, der normale Weg bleibt also offen; nur das harte Löschen wird laut
(ein Test belegt es). `relation_type` mit fester Werteliste statt Freitext.

**Audit: ja.**

**Lebendiger Layer:** `document` (§3.6).

### 1.7 `process_event_activity_map` — Migration 0451

**Zweck.** Zuordnung _Aktivitätsname des Ereignisprotokolls → Prozessschritt_.
`process_event.activity` ist ein Name aus einem Fremdsystem, keine BPMN-ID;
ohne die Zuordnung gibt es keine Abdeckungsquote, und `conformanceGate`
**verweigert** die Heatmap ohne sie ausdrücklich.

**Entscheidungen.**

- `event_log_id` `CASCADE` (die Zuordnung ist eine Ableitung aus dem Protokoll,
  kein eigenständiger Nachweis), `process_step_id` `SET NULL` (verschwindet der
  Schritt, ist die Aktivität _nicht zugeordnet_ — die wahre Aussage; ein Test
  belegt es).
- Der Endpunkt liest die Zuordnung über `process_step_id IS NOT NULL`, **nicht**
  über `match_kind`. Damit können die beiden nicht auseinanderlaufen.
- `confidence numeric(5,4)` mit CHECK 0…1 — nicht 0…100, sonst bisse sich die
  Spalte mit dem 0…1-Vertrag der Diagrammschicht.

**Audit: NEIN — die begründete Ausnahme.** Diese Tabelle wird maschinell und in
einem Zug befüllt: ein Import mit 400 Aktivitätsnamen erzeugt 400 Zeilen. Ein
Audit-Trigger schriebe dafür 400 Einträge mit vollständigem Zeilenabbild in
eine hashverkettete Tabelle, deren Zweck es ist, _seltene und bedeutsame_
Änderungen nachweisbar zu halten — das verdünnt den Nachweis, statt ihn zu
stärken. Was ihn stattdessen trägt: `process_event_log.imported_by`/`imported_at`
(der Import ist das Ereignis, das jemand ausgelöst hat, und er ist belegt) und
`mapped_by`/`mapped_at` an der Zeile, das die **händische** Zuordnung
namentlich festhält — und genau die ist die Ermessensentscheidung, die eine
Abdeckungsquote verschieben kann.

**Lebendiger Layer:** `conformance` (F7).

### 1.8 `user_diagram_preference` — Migration 0452

**Zweck.** Zuletzt gewählte GRC-Sicht je Nutzer, Mandant und Bezugsraum
(§3.3.4). Die einzige der zehn Tabellen, die keinen Layer freischaltet.

**Entscheidungen.**

- **`org_id NOT NULL`**, obwohl die Vorlage die Spalte nicht nennt: ein Nutzer
  kann Mitglied mehrerer Organisationen sein, und die passende Sicht hängt an
  der Rolle, die er _dort_ hat. Ohne `org_id` wäre die Tabelle außerdem eine
  mandantenlose Ablage in einem Produkt, dessen tragende Zusage die
  Mandantentrennung ist (ADR-001).
- **Zwei Policies mit unterschiedlichem Zuschnitt**, nicht die Verdopplung, die
  `user_nav_preference` trägt: dort stehen eine org-weite und eine
  nutzerbezogene `FOR ALL`-Policy nebeneinander, beide PERMISSIVE und damit per
  OR verknüpft — womit die engere folgenlos bleibt. Hier deckt `…_org_read` nur
  SELECT ab und `…_own_write` alles übrige, aber ausschließlich für die eigenen
  Zeilen. Damit ist die Schreibbeschränkung tatsächlich wirksam.

**Audit: nein.** Eine Anzeigevoreinstellung ist kein Nachweis; ein Eintrag je
Sichtwechsel in einer hashverketteten Tabelle wäre Rauschen.

---

## 2. Die Erweiterungen der Bestandstabellen

| Tabelle                      | Spalten                                                    | Migration | Regel                    |
| ---------------------------- | ---------------------------------------------------------- | --------- | ------------------------ |
| `process_step`               | `step_key uuid NOT NULL`, `parent_step_id`, `lane_step_id` | 0445      | SET NULL                 |
| `simulation_activity_param`  | `step_key uuid`                                            | 0445      | —                        |
| `control`                    | `is_key`, `owner_role_id`, `evidence_due_at`               | 0453      | `owner_role_id` SET NULL |
| `dpia`                       | `process_step_id`                                          | 0454      | SET NULL                 |
| `security_incident`          | `process_step_id`                                          | 0454      | SET NULL                 |
| `work_item`                  | `process_step_id`                                          | 0454      | SET NULL                 |
| `process_kpi_definition`     | `process_step_id`, `sequence_flow_id`                      | 0454      | SET NULL / kein FK       |
| `eam_bpmn_element_placement` | `process_step_id`, `label_visible`, `relation_type`        | 0454      | SET NULL                 |
| `process_framework_mapping`  | `process_step_id`                                          | _0443_    | bereits in Stufe D       |

**Die dreizehn Zeilen der Vorlage, abgehakt.** §5.2 führt dreizehn
Erweiterungen. Zehn davon stehen in der Tabelle oben, eine
(`process_framework_mapping`) hat Stufe D bereits erledigt, eine
(`finding.due_at`) wird begründet nicht angelegt (§2.1), und die dreizehnte ist
keine Spalte, sondern die Frage „`process_step.step_type` erweitern **oder**
`process_lane` separat" — sie ist mit 0444 zugunsten der eigenen Tabelle
entschieden (§1.1).

**`process_step.step_key` NOT NULL, nicht nullable.** Die BPMN-Element-ID ist
die ID aus dem XML; ein fremder Editor darf sie beim Re-Export neu vergeben,
und dann hängen Risiken, Kontrollen und Feststellungen an Schritten, die es
nicht mehr gibt. Ein nullable Schlüssel hätte das Problem nur verschoben: die
eine Zeile ohne Schlüssel ist genau die, an der die Zuordnung reißt.
`DEFAULT gen_random_uuid()` befüllt den Bestand im selben Zug; additiv, weil
der Vorgabewert für jede vorhandene Zeile einen Wert erzeugt, den vorher
niemand kannte.

**`parent_step_id` SET NULL, nicht CASCADE.** Die Vorlage nennt die Spalte,
nicht die Löschregel. CASCADE wäre hier besonders teuer: ein
Subprozess-Schritt trägt Kinder, und diese Kinder tragen Risiken, Kontrollen,
Feststellungen und Nachweise. Wer im Editor einen aufgeklappten Subprozess
löscht, löschte damit still die Prüfungsspur mehrerer Aktivitäten.

**`lane_step_id` zeigt auf `process_lane`.** Die Vorlage lässt offen, worauf —
was folgerichtig ist, solange nicht entschieden ist, ob Lanes eigene Zeilen in
`process_step` sind. 0444 hat das entschieden. Der Name bleibt der der Vorlage,
damit die Bedarfsliste nachvollziehbar bleibt; der Spaltenkommentar nennt das
Ziel.

**`simulation_activity_param`: `step_key` daneben, kein Typwechsel.** Die
Vorlage schreibt „`activity_id` → `step_key`". Wörtlich wäre das ein Typwechsel
an der Spalte, die **heute der einzige funktionierende Träger des
`operations`-Layers** ist — sie hält die BPMN-Element-ID und wird vom Endpunkt
direkt als Elementschlüssel gelesen. Der Typwechsel hätte einen funktionierenden
Layer abgeschaltet, um einen Round-Trip-Fall abzusichern, den es heute nicht
gibt. `step_key` kommt deshalb als zusätzliche nullable Spalte; sobald sie
flächendeckend gepflegt ist, kann eine spätere Migration die Reihenfolge
umdrehen — in die andere Richtung ginge es nicht mehr.

### 2.1 Zwei Spalten der Vorlage, die bewusst **nicht** kommen

**`control.last_test_result` und `.last_evidence_at`** (§5.2 nennt sie mit dem
„bzw. `control_test_execution`", das die Unsicherheit der Vorlage schon
anzeigt). Beide sind heute bereits ableitbar und werden abgeleitet: der
Endpunkt liest den letzten Test aus `control_test` und den jüngsten Nachweis
aus `evidence(entity_type='control')`, als korrelierte Unterabfragen, indiziert
und getestet. Eine gespeicherte Kopie daneben wäre eine **zweite Wahrheit, die
nichts pflegt** — kein Trigger, kein Dienst, kein Anwendungspfad schriebe sie
fort. Der erste Kontrolltest nach der Migration ließe `last_test_result` auf dem
Stand von heute stehen, und das Prüfungswerkzeug zeigte „zuletzt geprüft:
bestanden" für eine Kontrolle, die gestern durchgefallen ist. `evidence_due_at`
kommt dagegen sehr wohl: die nächste **Fälligkeit** ist aus dem Bestand nicht
ableitbar (aus `control.frequency` ließe sie sich hochrechnen, aber eine
hochgerechnete Fälligkeit ist wieder eine Behauptung).

**`finding.due_at`.** Die Begründung der Vorlage stimmt (A3 ist dreistufig), die
Schlussfolgerung nicht: `finding.remediation_due_date` existiert seit jeher und
**ist** die Fälligkeit, die A3 meint; der Endpunkt liest sie seit Stufe D §1.3
und die Ampel ist befüllt. Eine zweite Spalte daneben wäre eine zweite Wahrheit
über dieselbe Frist, und die erste Anwendung, die nur eine der beiden pflegt,
macht die Ampel unbrauchbar. Statt der Spalte steht jetzt ein
`COMMENT ON COLUMN`, der die vorhandene benennt — damit die nächste Lesung der
Bedarfsliste nicht wieder an derselben Stelle stolpert.

---

## 3. Der Endpunkt: 23 von 23 Layern

`GET /api/v1/processes/:id/diagram-overlay` bekommt **elf weitere Abfragen**
(12 → 23) und **sechs weitere Layergruppen** (`lane`, `sod`, `ropa`, `bia`,
`document`, `conformance`). `?layers=` filtert weiter _wirklich_: ein Test
zählt die Datenbankaufrufe (`?layers=lane` → drei Abfragen statt 23).

| Layer                      | Quelle                                                          | Anmerkung                                                                 |
| -------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `sod` (F3)                 | `sod_rule` ⋈ `custom_role`, `process_step_raci`, `process_lane` | Nur aktive Regeln; eine Regel mit unbekannter Rolle wird nicht mitgezählt |
| `outage` (F6)              | `process_step_bia` + `?outage=<assetId>&outageElapsed=<min>`    | Das Szenario ist eine **Auswahl**, keine hinterlegte Tatsache (§3.2)      |
| `bcm` (§3.10)              | `process_step_bia`                                              | Minuten; unlesbare Kritikalität wird verworfen, nicht auf `low` gesetzt   |
| `privacy` (§3.9)           | `process_step_ropa` ⋈ `process_step_data_category`              | Kategorien ohne ROPA-Zeile erzeugen **keinen** Personenbezug              |
| `dpia` (§3.9)              | `process_step_ropa.dpia_id` ⋈ `dpia.status`                     | `rejected` wird `required`, nicht `done` (§3.3)                           |
| Kategoriechips             | `process_step_data_category.is_special_category`                | Art.-9-Stufe ausdrücklich gesetzt, nicht aus dem Namen erraten            |
| `retention` (F10)          | `process_step_ropa.retention_months`                            |                                                                           |
| `trust-boundary` (F5)      | `process_lane` ⋈ `vendor` ⋈ `eam_org_unit`                      | Personenbezug aus dem ROPA-Datensatz der Kantenenden                      |
| `lane` (F17)               | `process_lane` + Quoten je Rolle                                | Quote nur bei vorhandener Pflichtschulung bzw. -verteilung (§3.1)         |
| `conformance` (F7)         | `process_event_activity_map` ⋈ `process_event`                  | Abdeckungsquote gemessen, nicht geschätzt; `reworkLoops` gezählt          |
| `document` (§3.6)          | `process_step_document` ⋈ `document`                            | Zeile ohne Titel fällt weg — eine nackte UUID ist kein Dokument           |
| `controls[].isKey`         | `control.is_key`                                                | Eine _nicht abgefragte_ Spalte wird nicht zu `false`                      |
| `controls[].ownerRole`     | `control.owner_role_id` ⋈ `custom_role`                         | Macht die Selbstkontroll-Prüfung (§3.4/A4) rechenbar                      |
| `controls[].evidenceDueAt` | `control.evidence_due_at`                                       |                                                                           |
| `raci.consulted/.informed` | `process_step_raci`                                             | Zeile schlägt Spalte; C und I nur von hier                                |
| `elements[].stepKey`       | `process_step.step_key`                                         |                                                                           |

### 3.1 Die Lane-Quoten — und warum „0 %" verboten ist

`GrcLaneData.trainingRatio` ist „Anteil der Rollenmitglieder mit abgeschlossener
Pflichtschulung". Gerechnet wird über `user_custom_role` ⋈ `academy_enrollment`
(`status='completed'`, Kurse mit `is_mandatory`) bzw. ⋈ `policy_acknowledgment`
(`status='acknowledged'`, Verteilungen mit `is_mandatory`).

Der eigentliche Punkt der Abfrage sind zwei `EXISTS`: **hat der Mandant
überhaupt eine Pflichtschulung / eine Pflichtverteilung?** Ohne sie wäre ein
Mandant ohne Pflichtschulung ununterscheidbar von einem, in dem niemand sie
absolviert hat — und die Fläche zeigte „0 %" als Befund. `0/0` ist keine
Null-Prozent-Quote, sondern keine Quote. Zwei Tests halten beide Fälle fest.

`academy_course.target_roles` bleibt bewusst ungenutzt: es ist ein `jsonb` ohne
festgelegte Form, und eine Rolle darin zu suchen wäre geraten.

### 3.2 Das Ausfallszenario steht in der Abfrage, nicht in der Datenbank

`?outage=<uuid>` und `?outageElapsed=<minuten>`. Welches Asset ausfällt, ist
eine Frage des Betrachters. Ohne Auswahl liefert der Endpunkt kein
`diagram.outage`, `simulateOutage` gibt `undefined` zurück und der Layer
schweigt — statt einen Ausfall zu unterstellen, den niemand angenommen hat. Der
Assetname wird aus den bereits geladenen Zeilen aufgelöst; die ID als Namen
auszugeben wäre die Sorte Platzhalter, die dieser Endpunkt nicht macht.

### 3.3 Vier Stellen, an denen die naive Abbildung falsch gewesen wäre

1. **`dpia_status`.** `rejected` heißt: die Verarbeitung darf so nicht laufen.
   Als „abgeschlossen" anzuzeigen wäre die Umkehrung der Aussage. Ebenso ist
   `pending_dpo_review` laufend, nicht fertig.
2. **`is_key`.** `undefined` heißt „nicht abgefragt". Daraus `false` zu machen
   wäre die Aussage „keine Schlüsselkontrolle".
3. **Kategorie ohne ROPA-Zeile.** `personalDataStage` liest
   `isProcessingActivity`; eine Kategorie allein ist keine Feststellung „hier
   wird verarbeitet". Ein Schritt ohne ROPA-Zeile bekommt deshalb kein `ropa`,
   auch wenn er Kategorien trägt.
4. **`workaroundMaxDurationMinutes = 0`.** Wegzuoptimieren wäre bequem und
   falsch: `simulateOutage` wertet 0 als „trägt nicht" und lässt den Schritt
   als blockiert gelten. Fiele die 0 weg, gälte der Schritt als gedeckt.

### 3.4 Was `MISSING_TODAY` noch führt — sieben Einträge, keine fehlende Tabelle

| Feld                                               | Grund                                                                                                                                                                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frameworks[].frameworkName`                       | `process_framework_mapping` führt nur den Code; ausgegeben wird der Code, eine Abkürzung statt eines erfundenen Namens (unverändert)                                                                                  |
| `conformance.meanDurationMinutes`, `.isBottleneck` | `process_event` trägt **einen** Zeitstempel je Ereignis und kein Lebenszyklus-Merkmal. Ohne Anfang **und** Ende keine Dauer; die Differenz zum nächsten Ereignis wäre die Wartezeit davor, nicht die Bearbeitungszeit |
| `diagram.conformance.deviations`                   | `fitness_gaps` führt `{activity, type, frequency, percentage}` — einen Knoten. Der Vertrag verlangt ein **Kantenpaar**                                                                                                |
| `elements[].incidents`, `.workItems`               | Der Elementbezug existiert seit 0454; die Layer F14/F16 sind bewusst nicht gebaut. Ein Feld zu liefern, das keine Schicht liest, ist Ballast — eine Zeile Abfrage, sobald ein Layer es braucht                        |
| `controls[].lastTestResult`, `.lastEvidenceAt`     | Werden geliefert, aber **abgeleitet**; als Spalten bewusst nicht angelegt (§2.1)                                                                                                                                      |
| `edges`                                            | Häufigkeit je **Kante** bräuchte eine Zuordnung auf Übergänge; 0451 ordnet Aktivitäten zu. `carriesPersonalData` ist nicht mehr nötig — `computeTrustBoundaries` leitet es aus den Kantenenden ab                     |
| `diagram.framework`                                | Auswahlparameter der Sicht F8, keine hinterlegte Tatsache                                                                                                                                                             |

Ein neuer Wächtertest prüft die **Gegenrichtung**: dass `MISSING_TODAY` kein
Feld mehr führt, das der Endpunkt inzwischen liefert. Das ist die eigentliche
Gefahr dieser Liste — dass sie nach einer Schemaerweiterung stehen bleibt und
behauptet, etwas sei unmöglich, was längst geliefert wird.

---

## 4. Tests

**`packages/db/tests/rls/process-diagram-grc-isolation.test.ts` — 63 Tests.**

Je Tabelle (zehn × fünf = 50): die eigene Zeile ist sichtbar (sonst wäre der
Test wertlos — eine Tabelle, die niemandem etwas zeigt, besteht jede
Isolationsprüfung); die fremde Zeile ist **per Primärschlüssel-ID** unsichtbar,
mit Gegenbeweis als Superuser, dass sie existiert; UPDATE und DELETE auf die
fremde Zeile treffen null Zeilen; ein INSERT mit fremder `org_id` wird von
`WITH CHECK` abgewiesen statt still umgeschrieben. Als Rolle `grc_app`, mit
geprüftem `rolsuper=false`/`rolbypassrls=false`.

Dazu dreizehn fachliche Tests: die Abfragen des Endpunkts gegen echte Zeilen —
Lane-Träger mit Drittland, die SoD-Selbstpaarung, das ungeordnete Regelpaar,
RACI mit C und I, ROPA samt Kategorie und Empfänger, MTPD in Minuten, das
Dokument am Schritt **und nicht** am Nachbarschritt, Conformance mit
Abdeckungsquote 0,75 und einem Rework-Fall, `is_key`/`owner_role_id`,
`step_key`-Eindeutigkeit — und drei Tests der Löschregeln (Dokument mit
Verknüpfung nicht hart löschbar, Rolle mit SoD-Regel nicht löschbar, gelöschter
Schritt macht die Aktivität unzugeordnet statt die Zeile mitzunehmen).

Seed-Daten liegen **in der Testdatei**, nicht in `src/seed*.ts` oder
`sql/seed_demo_*.sql` — dort arbeitet der parallele Strang.

**`apps/web/src/__tests__/lib/grc-overlay.test.ts`** wächst um 24 Tests; der
`MISSING_TODAY`-Test ist nachgezogen und arbeitet jetzt mit einem **maximal
besetzten** Datensatz (jede der zehn Tabellen liefert eine Zeile) — genau der
Fall, in dem eine versehentliche Erfindung sichtbar würde.

**Der Test, der geändert werden musste, und warum das keine Abschwächung ist.**
`process-diagram-overlay.test.ts` prüfte „unbekannte Layergruppe → 422" am
Beispiel `?layers=ropa`. `ropa` ist seit 0448 eine gültige Gruppe. Die Aussage
des Tests bleibt unverändert; er braucht nur einen Namen, den es wirklich nicht
gibt. Daneben stehen zwei neue: dass die sechs neuen Gruppen angenommen werden,
und dass `?outage=` eine UUID verlangt.

---

## 5. Verifikation

| Prüfung                                                                 | Ergebnis                                                       |
| ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| `migrate-all` gegen **frische, leere** Datenbank (PostgreSQL 16)        | **419/419 angewandt, 613 Tabellen, Exit 0**                    |
| Schema-Drift, beide Richtungen                                          | **0 fehlend, 0 nur-in-DB, 0 RLS-Lücken, 0 Doppeldefinitionen** |
| RLS + FORCE + Policy auf allen zehn neuen Tabellen                      | **10 von 10**                                                  |
| Führender `org_id`-Index (S09-14) auf den neuen Tabellen                | **10 von 10** — keine in der Lückenliste                       |
| Index auf jedem Fremdschlüssel (S09-13) der neuen Tabellen              | **alle** — keine in der Lückenliste                            |
| `cd packages/db && npx vitest run`                                      | **grün — 107 Tests, 8 Dateien**                                |
| `npx vitest run --config vitest.rls.config.ts`                          | **grün — 142 Tests, 11 Dateien** (vorher 79/10)                |
| RLS-Systemtest: geseedete Objekte                                       | **545**, die zehn neuen darunter, **0 Seed-Fehler** auf ihnen  |
| `cd packages/bpmn && npx vitest run --config vitest.config.ts`          | **grün — 727 Tests, 43 Dateien**                               |
| `cd apps/web && npx vitest run`                                         | **grün — siehe §5.1**                                          |
| Alle 23 Endpunktabfragen gegen das Schema, **leer** und **mit Fixture** | **fehlerfrei, erwartete Zeilen**                               |
| `npx tsc --noEmit` über alle Projekte                                   | **fehlerfrei**                                                 |

Die elf neuen Abfragen wurden zusätzlich einzeln gegen die frische Datenbank
gefahren — erst leer (Syntax, Spaltennamen, Enum-Literale), dann mit einem
Fixture aus zwei Prozessschritten, zwei Lanes, einer SoD-Regel, drei
RACI-Zeilen, einer ROPA-Zeile mit Kategorie und Empfänger, zwei BIA-Zeilen,
einem Dokument, vier Ereignissen und einer Aktivitätszuordnung. Gerechnet wurde
dabei: Abdeckungsquote `0,75` (drei von vier Ereignissen zugeordnet), eine nicht
zugeordnete Aktivität, `observedCases 2`, `reworkLoops 1`, `trainingRatio 0,5`
(zwei Mitglieder, einer geschult) und **keine** `acknowledgmentRatio` (keine
Pflichtverteilung im Mandanten) — die Zahlen, die das Fixture hergibt.

---

## 6. Was offen bleibt

1. **F14 und F16 sind nicht gebaut.** `security_incident.process_step_id` und
   `work_item.process_step_id` stehen seit 0454; der Vertrag hält
   `incidents`/`workItems` vor. Der Layer ist je eine Stunde Arbeit — und je
   eine Zeile Abfrage im Endpunkt.
2. **Kantenkennzahlen (`edges`).** Häufigkeit und Verzweigungswahrscheinlichkeit
   je Kante brauchen eine Zuordnung des Ereignisprotokolls auf **Übergänge**,
   nicht auf Aktivitäten. Das ist eine eigene Tabelle
   (`process_event_transition_map`) und gehört in dasselbe Arbeitspaket wie eine
   Lebenszyklus-Spalte an `process_event` — die zugleich
   `meanDurationMinutes`/`isBottleneck` freischalten würde.
3. **`process_conformance_result.fitness_gaps` liefert Knoten, nicht Kanten.**
   `GrcConformanceSummary.deviations` bleibt deshalb leer. Die Umstellung
   gehört dem Mining-Strang.
4. **Die Oberfläche pflegt die neuen Tabellen noch nicht.** Es gibt keine Maske
   für Lanes, SoD-Regeln, Schritt-ROPA, Schritt-BIA oder die
   Aktivitätszuordnung. Der Endpunkt liest, was da ist; **eingetragen** wird es
   heute nur über SQL bzw. den Import. Das ist der größte offene Posten dieser
   Stufe und ein eigenes Arbeitspaket je Modul.
5. **`user_diagram_preference` wird noch von niemandem geschrieben.**
   `GrcViewSelect` hält seine Wahl weiter in React-State; die Tabelle steht,
   die Verdrahtung fehlt.
6. **`process_lane` wird beim Import nicht befüllt.** Der
   Modellierungsimporter liest Lanes aus dem XML, legt aber keine Zeilen an.
   Solange das fehlt, bestimmt die Diagrammschicht die Lane-Zugehörigkeit
   weiterhin geometrisch (engster umschließender Rahmen) — das funktioniert,
   rät aber bei überlappenden Rahmen.
7. **Unverändert offen aus D §5** — die geometrischen Divergenzklassen
   (`waypoints/*`), Drill-down, Typwechsel beim Anheften, der
   Shadow-Compare-Betrieb.

---

## 7. Geänderte Dateien

**Neu**

`packages/db/drizzle/0444_process_lane.sql`,
`0445_process_step_identity.sql`,
`0446_sod_rule.sql`,
`0447_process_step_raci.sql`,
`0448_process_step_ropa.sql`,
`0449_process_step_bia.sql`,
`0450_process_step_document.sql`,
`0451_process_event_activity_map.sql`,
`0452_user_diagram_preference.sql`,
`0453_control_key_and_owner_role.sql`,
`0454_element_level_links.sql`,
`packages/db/src/schema/process-diagram-grc.ts`,
`packages/db/tests/rls/process-diagram-grc-isolation.test.ts`.

**Geändert**

| Datei                                                             | Was                                                       |
| ----------------------------------------------------------------- | --------------------------------------------------------- |
| `packages/db/src/index.ts`                                        | Das neue Schemamodul importiert, gebündelt, exportiert    |
| `packages/db/src/schema/process.ts`                               | `stepKey`, `parentStepId`, `laneStepId` + drei Indizes    |
| `packages/db/src/schema/control.ts`                               | `isKey`, `ownerRoleId`, `evidenceDueAt` + drei Indizes    |
| `packages/db/src/schema/dpms.ts`                                  | `dpia.processStepId`                                      |
| `packages/db/src/schema/isms.ts`                                  | `securityIncident.processStepId`                          |
| `packages/db/src/schema/work-item.ts`                             | `workItem.processStepId`                                  |
| `packages/db/src/schema/bpm-advanced.ts`                          | `processKpiDefinition.processStepId`, `.sequenceFlowId`   |
| `packages/db/src/schema/eam-governance.ts`                        | drei Spalten an `eamBpmnElementPlacement`                 |
| `packages/db/src/schema/abac.ts`                                  | `simulationActivityParam.stepKey`                         |
| `apps/web/src/lib/grc-overlay.ts`                                 | Elf neue Zeilenformen, die Abbildung, `MISSING_TODAY` neu |
| `apps/web/src/app/api/v1/processes/[id]/diagram-overlay/route.ts` | Elf Abfragen, sechs Gruppen, `?outage=`                   |
| `apps/web/src/__tests__/lib/grc-overlay.test.ts`                  | +24 Tests, `MISSING_TODAY`-Block nachgezogen              |
| `apps/web/src/__tests__/api/process-diagram-overlay.test.ts`      | 422-Fall auf einen echten Unbekannten, +3 Tests           |

**Nicht angefasst**, wie beauftragt: `packages/db/src/seed*.ts`,
`packages/db/sql/seed_demo_*.sql` (paralleler Arbeitsstrang), und aus
`packages/bpmn/src/grc/**` keine Zeile — der Vertrag trug alle zehn Layer
bereits vollständig, es fehlte ihm nur der Datenlieferant.
