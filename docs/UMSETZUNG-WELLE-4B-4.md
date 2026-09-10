# Welle 4b, Strang 4 — OP-175, OP-176, OP-177, OP-179, OP-180

**Grundlage:** `docs/UMSETZUNG-WELLE-4B-3.md` §3.2 / §4.1 und der Nachtrag
„OP-076/OP-077 erledigt" in `docs/OFFENE-PUNKTE-REGISTER.md` ·
**Punkte:** OP-175, OP-176, OP-177, OP-179, OP-180
**Stand:** Branch `audit/full-2026-08-31`, aufsetzend auf `3dbc48f5`
**Gebiet:** `apps/web/src/app/api/v1/**`

---

## 1. Was hier zu tun war

Strang 3 hat beim Abtragen zweier Lint-Ausnahmen fünf Produktdefekte
gefunden, benannt und **bewusst nicht behoben** — sie lagen jenseits von
OP-076/OP-077. Dieser Strang behebt sie. Allen fünf ist dieselbe Form
gemeinsam, und sie ist die eigentliche Klammer dieses Dokuments:

> **Der Code sagt etwas, das er nicht tut.** Ein geprüfter Abfrageparameter
> ohne Wirkung. Ein Pfadsegment ohne Bedingung. Eine Paketliste mit einer
> Datei, die nicht beiliegt. Eine Unabhängigkeitsprüfung, deren Ergebnis
> niemand liest.

Für einen Leser ist die Kontrolle in allen fünf Fällen **vorhanden**:
Überschrift, `parse`-Aufruf, Pfad, Zeile in der README. Nur die Wirkung
fehlt. Das ist gefährlicher als eine offensichtlich fehlende Kontrolle,
weil niemand danach sucht.

| Punkt      | Ergebnis                                                                     |
| ---------- | ---------------------------------------------------------------------------- |
| **OP-175** | behoben — gegen das Beilegen, für eine ehrliche Ankündigung entschieden (§2) |
| **OP-176** | 5 der 7 Routen wirken jetzt; 4 Parameter bleiben **begründet offen** (§3)    |
| **OP-177** | behoben — die Auflösung steht im Schema und ist nachgeschlagen (§4)          |
| **OP-179** | behoben — Seite, `total` und Facetten sehen jetzt dieselbe Menge (§5)        |
| **OP-180** | behoben, beide Routen (§6)                                                   |

Dazu **ein neuer Befund**, den keiner der fünf Punkte nannte und der der
schwerste dieses Strangs ist: das Auditoren-Dashboard war seit jeher
komplett kaputt (§3.3, OP-182).

---

## 2. OP-175 — ein Paket, das eine Datei ankündigt, die es nie enthält

`audit-mgmt/audits/[id]/audit-pack` schrieb in die README-Zeile
`Contents:` ein `- report.pdf`, sobald am Audit ein Berichtsdokument hing.
Ein `zip.file("report.pdf", …)` gibt es in der Datei nicht und hat es nie
gegeben; der Kopfkommentar behauptete dasselbe („plus the report document
if attached").

Der Auftrag verlangte eine **begründete** Entscheidung: erzeugen oder
Ankündigung entfernen. Entschieden ist **gegen das Beilegen**, und zwar
nicht aus Aufwand:

Der Bericht ist ein DMS-Dokument, und `documents/[id]/download` setzt an
ihm vier Kontrollen durch, die ein ZIP nicht mitbringt:

| Kontrolle                                                       | Kennung |
| --------------------------------------------------------------- | ------- |
| Wasserzeichenpflicht für freigegebene PDF (kontrollierte Kopie) | #S06-07 |
| SHA-256-Abgleich der Bytes gegen `document.file_sha256`         | #S06-09 |
| Protokolleintrag je Download                                    | #S06-08 |
| unmarkierte Rohfassung nur für `admin` / `quality_manager`      | —       |

Das Audit-Pack steht dagegen `admin`, `auditor`, `compliance_officer` und
`quality_manager` offen. Die Bytes hineinzukopieren wäre also nicht „eine
Datei mehr", sondern ein Weg an vier absichtlich gesetzten Kontrollen
vorbei — ausgerechnet in dem Strang, der fehlende Kontrollen
wiederherstellt. Ein Paket, das lügt, ist schlimm; ein Paket, das eine
Dokumentenlenkung aushebelt, ist schlimmer.

Die README benennt den Bericht jetzt mit Titel und Kennung und sagt, wo er
kontrolliert zu bekommen ist:

```
- (report not included) "Prüfbericht 2026" — controlled document
  <uuid>, download via /api/v1/documents/<uuid>/download
```

und ohne angehängten Bericht schlicht
`- (no report document attached to this audit)`. Damit wird `report_title`
zum ersten Mal gelesen; die nur für das falsche Versprechen selektierte
Unterabfrage `report_path` ist entfallen (ein Rundlauf zur Datenbank
weniger pro Paket).

---

## 3. OP-176 — sieben Routen prüfen einen Parameter und werfen ihn weg

### 3.1 Der Maßstab, nach dem entschieden wurde

Ein zod-Schema mit Vorgabewerten ist eine **Zusage**: „ohne `timeRange`
bekommst du das letzte Quartal". Wer die Zusage nicht einlöst, hat keinen
fehlenden Komfort, sondern einen gebrochenen Vertrag — und weil die
Vorgabe greift, auch für jeden Aufrufer, der gar nichts gesetzt hat. Wo es
für einen Parameter **genau eine** Lesart gibt, ist er umgesetzt. Wo es
keine gibt, bleibt er offen und ist an Ort und Stelle beschrieben.

### 3.2 Umgesetzt

| Route                          | Parameter        | Was jetzt geschieht                                                                                                                                                                       |
| ------------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `horizon-scanner/items`        | `framework`      | `affected_frameworks @> ARRAY[…]` — in der Listen- **und** der Zählabfrage, sonst stünde eine gefilterte Liste unter einer ungefilterten Gesamtzahl                                       |
| `predictive-risk/correlations` | `minCorrelation` | schneidet `correlated_entities` ab; die Vorgabe ist 0.5, es war also auch die unbeschickte Antwort falsch                                                                                 |
| `plugins/marketplace`          | `search`         | `ILIKE` über `title` und `short_description`; beide Spalten liegen auf `extension_marketplace`, deshalb kommt die Zählabfrage weiter ohne den Verbund auf `plugin` aus                    |
| `eam/catalog`                  | `page`           | siehe §5 — mit OP-179 zusammen gelöst                                                                                                                                                     |
| `academy/dashboard`            | `timeRange`      | fenstert die **Ereignisse** (Einschreibungskohorte über `created_at`, Zertifikate über `issued_at`), nicht den Kurskatalog: „Kurse gesamt" heißt nicht „in diesem Quartal angelegt"       |
| `role-dashboards/data/auditor` | `timeRange`      | fenstert die erhobenen Feststellungen und die Kennzahl `recent_evidence` — deren fest verdrahtete 90 Tage sind **genau** die Vorgabe `quarter`, für bisherige Aufrufer ändert sich nichts |

Die drei Dashboards geben `timeRange` (und `academy` zusätzlich `since`)
in der Antwort zurück. Ohne diese Rückgabe lässt sich von außen nicht
unterscheiden, ob ein Filter gewirkt hat — genau der Zustand, der den
Befund vier Wellen lang getragen hat.

### 3.3 Der Fund darunter: OP-182

Beim Anfassen des Auditoren-Dashboards fiel eine Zeile auf, die mit
OP-176 nichts zu tun hat:

```sql
FROM finding WHERE org_id = … AND status = 'open'
```

`finding.status` ist der Aufzählungstyp `finding_status`, und „open" ist
keiner seiner Werte. Gemessen gegen die laufende Datenbank:

```
grc_v4b=> SELECT count(*) FROM finding WHERE status = 'open';
ERROR:  invalid input value for enum finding_status: "open"
grc_v4b=> SELECT enum_range(NULL::finding_status);
 {identified,in_remediation,remediated,verified,accepted,closed}
```

Diese Abfrage ist bei **jedem** Aufruf fehlgeschlagen. Sie steht
unbedingt im Pfad, also endete die ganze Route mit einem 500er — und die
Oberfläche (`role-dashboards/auditor/page.tsx`) rendert bei fehlendem
`json.data` schlicht `null`. **Die Auditorenseite war seit jeher leer.**

Die Reparatur erfindet keine Bedeutung: die Liste
`["identified", "in_remediation"]` steht wortgleich in fünf anderen
Routen (`audit-mgmt/audit-impact-kris`, `audit-mgmt/audits/[id]/report`,
`controls/[id]/audit-impact`, `risks/[id]/audit-impact`,
`risks/audit-impact-summary`) und ist damit die Hausdefinition von „offen"
in der Auditsicht.

Bemerkenswert ist nicht der Tippfehler, sondern was er über die Abdeckung
sagt: **eine ganze Seite der Anwendung war tot, und keine Prüfung hat es
gemeldet.** Ein Aufzählungswert, der nicht existiert, ist zur Bauzeit
unsichtbar, weil er in einer rohen SQL-Zeichenkette steht.

### 3.4 Begründet offen geblieben

Vier Parameter bleiben ohne Wirkung. Jeder ist an seiner Stelle im
Quelltext beschrieben, damit die Evidenz nicht wandert.

**(a) `role-dashboards/data/auditor` · `status`.** Der Parameter führt
`open | in_progress | closed`, die Spalte den Aufzählungstyp
`finding_status` mit sechs anderen Werten. Nur `closed` kommt in beiden
vor. Eine Zuordnung der übrigen wäre eine Erfindung — und das Repository
trägt für den Endzustand **bereits zwei unvereinbare Auffassungen**
nebeneinander: `not in ('closed','verified')` in `executive/dashboard` und
`findings/analytics/aging` gegen `not in ('closed','verified','accepted')`
in `controls/effectiveness` und `controls/findings-summary`. Wer hier
zuordnet, entscheidet nebenbei diesen Widerspruch mit. Das ist eine
Produktentscheidung, keine Reparatur.

**(b) `role-dashboards/data/department-manager` · `departmentId`.** Der
Parameter ist `z.string().uuid()` und hat **kein Ziel**. Nachgeschlagen im
laufenden Schema:

```
grc_v4b=> SELECT table_name, column_name, data_type FROM information_schema.columns
          WHERE column_name = 'department' AND table_name IN ('risk','control');
 control | department | character varying
 risk    | department | character varying
```

`task` führt überhaupt keine Abteilung; `risk.department` und
`control.department` sind Namen, keine Schlüssel. Die einzige
schlüsselgeführte Abteilungstabelle des Schemas ist `eam_org_unit`, und
sie wird ausschließlich von `eam_business_context` und `process_lane`
referenziert — es gibt keinen Weg von ihr zu `task`, `risk` oder
`control`.

**(c) `role-dashboards/data/department-manager` · `timeRange`.** Hier
fehlt nicht der Schlüssel, sondern die Kennzahl. Alle drei Blöcke zählen,
was der Aufrufer **gerade besitzt** („Offene Aufgaben", „Meine Risiken",
„Meine Kontrollen"). Ein Fenster über `created_at` ließe eine alte,
weiterhin offene Aufgabe verschwinden: es machte die Kachel falsch statt
genauer.

Der tiefere Befund liegt darunter und erklärt (b) und (c) zugleich: die
Route filtert durchweg auf `assignee_id = ctx.userId` bzw.
`owner_id = ctx.userId`. Sie zeigt die **persönliche** Arbeitsliste des
Aufrufers, nicht die seiner Abteilung — eine „Abteilungsleiter"-Ansicht
ohne Abteilungsbegriff. Solange das so ist, kann kein Abteilungsparameter
sinnvoll ankommen.

**(d) `predictive-risk/correlations` · `depth`.** In OP-176 nicht genannt,
aber derselbe Fall: geprüft (`1..3`, Vorgabe 2) und ohne Wirkung. Das ist
kein Filter, den man nachtragen könnte — er verlangt einen
Nachbarschaftslauf über mehrere Stufen, den die Route nicht hat: sie liest
eine einzige Zeile `risk_prediction` und deren `correlated_entities`.

---

## 4. OP-177 — die Unabhängigkeitsprüfung des QA-Reviewers

Das war der Punkt, an dem ausdrücklich **nichts erfunden** werden sollte.
Deshalb zuerst das Nachschlagen, dann die Umsetzung.

### 4.1 Was im Schema steht

Der ursprüngliche Autor hatte die Auflösung `auditor_profile` → `user`
offengelassen („need to resolve auditor profiles"). Sie ist eindeutig:

```
grc_v4b=> \d audit_qa_review
  audit_qa_review_reviewer_id_fkey    FOREIGN KEY (reviewer_id) REFERENCES "user"(id)

grc_v4b=> \d audit_resource_allocation
  audit_resource_allocation_auditor_id_fkey
      FOREIGN KEY (auditor_id) REFERENCES auditor_profile(id)

grc_v4b=> \d auditor_profile
  "ap_user_idx" UNIQUE, btree (user_id)
  auditor_profile_user_id_fkey        FOREIGN KEY (user_id) REFERENCES "user"(id)
```

`reviewer_id` ist eine **Benutzer**kennung, `auditor_id` eine
**Profil**kennung, und `ap_user_idx` macht die Zuordnung Profil↔Benutzer
**1:1**. Ein Benutzer kann also nicht über zwei Profile am selben Auftrag
hängen; der Verbund ist verlustfrei. **Es gibt einen tragfähigen Weg, und
er ist keine Konstruktion.**

Beim Nachschlagen kamen zwei weitere Wege heraus, die die ursprüngliche
Überschrift gar nicht nannte und die beide ohne Umweg vergleichbar sind:

```
grc_v4b=> \d audit
  lead_auditor_id | uuid   →  audit_lead_auditor_id_user_id_fk → "user"(id)
  auditor_ids     | uuid[]
```

`audit.auditor_ids` ist die Teamliste, die die Oberfläche unter
„Auditoren" aus den Benutzern der Organisation setzt
(`audit/executions/[id]/page.tsx`) — also ebenfalls Benutzerkennungen.
**Diese Liste ist die häufigste Besetzung**, denn ein Auftrag kommt ohne
Ressourcenplanung aus. Hätte die Prüfung nur auf
`audit_resource_allocation` gesehen — den einen Weg, den der
Kopfkommentar nannte —, wäre sie für die meisten Aufträge stumm geblieben:
eine Prüfung, die dasteht und nichts trifft. Genau der Zustand, den dieser
Strang beseitigt.

### 4.2 Was umgesetzt ist

`POST /audit-mgmt/qa-review` weist mit **422** und `code:
qa_reviewer_not_independent` ab, wenn der Reviewer

- `audit.lead_auditor_id` dieses Auftrags ist (`conflict: lead_auditor`),
- in `audit.auditor_ids` dieses Auftrags steht (`conflict: audit_team`),
- eine Zeile in `audit_resource_allocation` zu diesem Auftrag hat, über
  `auditor_profile.user_id` aufgelöst (`conflict: resource_allocation`,
  mit `allocatedRole`).

Zwei Vorbedingungen kamen dazu, ohne die die Prüfung nichts aussagt:

- **Der Auftrag muss zu dieser Organisation gehören.** `audit_qa_review`
  bekam bisher `org_id: ctx.orgId` und ein beliebiges `auditId` aus der
  Abfragezeichenkette; der Fremdschlüssel auf `audit(id)` ist nicht
  mandantengebunden. Ein Auftrag einer fremden Organisation hätte unter
  `ctx.orgId` keine Zuteilungszeilen — die Unabhängigkeitsprüfung ginge
  **leer durch**. Jetzt: 404.
- **Der Reviewer muss Mitglied dieser Organisation sein**, geprüft über
  `user_organization_role` nach dem Muster, das
  `control-test-campaigns` bereits benutzt. Sonst gälte dasselbe: keine
  Teamzugehörigkeit, also formal unabhängig.

**Nicht geprüft wird `audit.auditee_id`.** Die geprüfte Stelle ist eine
andere Konfliktart als die Teamzugehörigkeit, und welche Rolle sie in der
QA spielen soll, sagt weder Schema noch Code. Das ist bewusst offen und
steht als Kommentar an der Stelle.

---

## 5. OP-179 — der EAM-Katalog lässt sich blättern

`offset` wurde berechnet und nie angewandt: die drei Teilabfragen holten
je `LIMIT pageSize` **ohne** `OFFSET`, die Antwort schnitt
`items.slice(0, pageSize)` und gab `page` zurück. Jede Seite war die
erste.

Die tote Rechnung zu entfernen hätte den Befund verdeckt; sie einzusetzen
hätte ihn verschoben: `offset` auf drei getrennte Teilabfragen anzuwenden
blättert **drei** Listen unabhängig voneinander, nicht die eine Liste, die
der Aufrufer sieht. Dazu die beiden Folgefehler, die das Register
ausdrücklich mitzuklären verlangte:

- `total` war `items.length`, also die Größe der bereits abgeschnittenen
  Menge — die Seitenzahl der Oberfläche war damit **immer 1**;
- die Facetten wurden über genau dieselbe abgeschnittene Menge gezählt:
  die Zählstände neben den Filtern beschrieben die angezeigte Seite und
  nicht den Bestand.

Die Liste entsteht jetzt in **zwei Schritten**:

1. **Ein Verzeichnis** (`catalog`) als `UNION ALL` über die drei Quellen —
   nur Kennung, Quellenrang, Objekttyp, Status, Typ, Name. Darauf laufen
   `ORDER BY … LIMIT … OFFSET` (die Seite), `count(*)` (`total`) und die
   Facetten. **Alle drei sehen dieselbe, vollständige Menge.** Die
   Zuordnung `architecture_type` → Objekttyp, die vorher in JavaScript
   nach dem Abschneiden geschah, steht dafür als `CASE` im Verzeichnis;
   nur so kann der `objectType`-Filter vor `LIMIT` greifen.
2. **Die Volldatensätze zu den Kennungen dieser Seite**, je Quelle mit der
   bisherigen Spaltenauswahl. Die Form der Einträge bleibt damit
   unverändert; die Reihenfolge der Antwort ist die des Verzeichnisses,
   nicht die der drei Nachladeabfragen.

Neu ist eine **feste Reihenfolge** (`source_rank, name NULLS LAST, id`).
Ohne sie ist Blättern nicht definiert. `source_rank` hält die bisherige
Gruppierung (Architekturelemente, dann Fähigkeiten, dann Datenobjekte);
innerhalb einer Gruppe entscheidet der Name. Bei Gleichstand in den
Facetten entscheidet der Wert, damit zwei Aufrufe dieselbe Reihenfolge
liefern.

Mitgenommen: `parseInt(url.searchParams.get("page") ?? "1")` prüfte
nichts. `?page=abc` ergab `NaN`, was **ohne** `OFFSET` folgenlos blieb —
mit `OFFSET` wäre daraus ein Datenbankfehler geworden. Die Untergrenze
gehört zur Reparatur, nicht zur Kür.

**Ausdrücklich nicht mitrepariert**, weil es ein anderer Befund ist:
`search` wirkt weiterhin nur auf `architecture_element` und
`eam_data_object` (eine Katalogsuche, die Geschäftsfähigkeiten nicht
findet), `keyword` nur auf `architecture_element` (obwohl
`business_capability.keywords` existiert und mit `bc_keywords_gin` sogar
indiziert ist). Beides still mitzuändern wäre dasselbe Vergehen in die
andere Richtung.

---

## 6. OP-180 — zwei Routen werten ihr Pfadsegment aus

**`import/mappings/[entityType]` (DELETE).** Gelöscht wurde allein nach
`?id=` und `org_id`. Ein DELETE auf
`/import/mappings/asset?id=<zuordnung-einer-risikoabbildung>` traf damit
eine Zuordnung, die gar nicht unter der aufgerufenen URL liegt — und
antwortete `success: true`. Der Entitätstyp ist jetzt Teil der
WHERE-Bedingung; ein Treffer unter dem falschen Pfad ist ein 404 wie jeder
andere Nichttreffer.

**`processes/[id]/simulation/compare`.** Verglichen wurden zwei Szenarien
allein nach `?scenarioA/B=` und `org_id`; Szenarien **verschiedener**
Prozesse derselben Organisation ließen sich gegeneinanderstellen. Der
einzige Weg vom Ergebnis zum Prozess führt über das Szenario
(`process_simulation_result.scenario_id` → `simulation_scenario`, das
`process_id` trägt); beide Ergebnisse sind jetzt über diesen Verbund an
den Prozess des Pfades gebunden. Kein Mandantenleck war es vorher nicht,
aber die Antwort trug den Prozess im Pfad und meinte ihn nicht.

Die Sortierung (`executedAt` aufsteigend, also der **älteste** Lauf) ist
unverändert übernommen. Ob ein Vergleich den ersten oder den letzten Lauf
meint, ist eine Produktfrage und war nicht Gegenstand von OP-180 — sie
steht in §7.

---

## 7. Nachweis

### 7.1 Ein Messfehler, der ohne die Datenbank durchgegangen wäre

Beim Bauen der Bedingungen fiel etwas auf, das kein Typprüfer sieht.
**Drizzle setzt ein JavaScript-Array in einem `sql`-Baustein nicht als
Array-Parameter ein, sondern als Parameterliste.** Gemessen gegen die
laufende Datenbank:

```
sql`… status = ANY(${["identified","in_remediation"]}::finding_status[])`
→ … status = ANY(($2, $3)::finding_status[])
→ Failed query
   params: identified,in_remediation
```

Die naheliegende Schreibweise ist also nicht unschön, sie **läuft nicht** —
und zwar erst zur Laufzeit, weil TypeScript den zusammengesetzten Text
nicht sieht. Der Helfer `api/v1/_lib/pg-array.ts` baut stattdessen
`ARRAY[$2, $3]::<typ>`: jeder Wert bleibt ein eigener Parameter, das Array
entsteht in SQL. Sein `cast` geht durch `sql.raw` und darf nur eine im
Quelltext ausgeschriebene Typkonstante sein — die Lehre aus OP-178 steht
als Auflage im Kopf der Datei.

Dass dieser Fehler auffiel, ist kein Verdienst der Testabdeckung, sondern
der Auflage, gegen die **laufende** Datenbank zu messen. Ohne sie wären
drei der hier gebauten Bedingungen mit grünem `tsc`, grünem Lint und
grünen Unit-Tests in Produktion gegangen und dort beim ersten Aufruf
gefallen — dieselbe Klasse wie OP-182 in §3.3.

### 7.2 Prüfungen

| Prüfung                                            | Ergebnis                                     |
| -------------------------------------------------- | -------------------------------------------- |
| `npx tsc --noEmit -p apps/web/tsconfig.json`       | Exit 0                                       |
| `npm test` in `apps/web` (mit beiden Verbindungen) | **119 Dateien, 2.730 Tests** grün            |
| dazu die DB-Suite aus `run-db-suites.mjs`          | 4 Dateien, 24 Tests grün                     |
| `npm run test:rls`                                 | 4 Dateien, 24 Tests grün                     |
| `npx prettier --check .`                           | „All matched files use Prettier code style!" |
| `node scripts/lint-ratchet.mjs`                    | 283 (Baseline 283), keine Regression         |
| `node scripts/check-gate-inputs.mjs`               | 7 Tor-Eingaben, grün                         |

Gegen `3dbc48f5` waren es 118 Dateien / 2.709 Tests; die 21 neuen sind die
Datei aus §7.3.

Die drei Regeln, die Strang 3 in `api/v1` scharf gestellt hat, halten:

```
$ npx eslint "src/app/api/v1/**/*.ts" \
    --rule '{"@typescript-eslint/no-unused-vars":"error",
             "@typescript-eslint/no-explicit-any":"error",
             "no-console":"error"}' -f json | …
{}
```

`npx eslint .` über ganz `apps/web` meldet **dieselben zwei Fehler wie
vorher** und keinen weiteren:

```
src/__tests__/api/grc-maintenance-surface.test.ts:263      no-constant-binary-expression
src/__tests__/components/bpmn-moddle-declaration.test.ts:105  @typescript-eslint/no-require-imports
```

Beide gehören zu OP-173 (`apps/web` hat als einziger Workspace keine
Lint-Ratsche) und liegen in Testdateien, die dieser Strang nicht anfasst.

### 7.3 Der neue Test, und dass er fallen kann

**`src/__tests__/api/welle-4b-4-parameter-pfade-pakete.test.ts`** —
21 Prüfungen über alle fünf Punkte und OP-182.

**Gegenprobe (Eiserne Regel 3).** Die Testdatei gegen `3dbc48f5` laufen
lassen (`git stash push`, die Datei bleibt als ungetrackt liegen):

```
Tests  19 failed | 2 passed (21)
```

Die **zwei** bestehenden sind die beabsichtigten Gegenproben, und sie
müssen auf beiden Ständen halten, sonst würden die Zusicherungen daneben
nichts mehr unterscheiden:

- „lässt einen unabhängigen Reviewer durch" — sonst wiese die Route
  einfach jeden ab;
- „ohne `framework` keine Bedingung" — sonst filterte sie immer.

Zwei Feinheiten, die der Test selbst gefunden hat:

- **`sqlParams` musste zwei Formen kennen.** Drizzle 0.45 legt einen in
  eine `sql`-Vorlage interpolierten Wert **roh** in `queryChunks`, während
  `eq()`/`gte()` ihn in ein `Param`-Objekt (`{ value, encoder }`) fassen.
  Eine Fassung, die nur die eine Form las, hielt vier Zusicherungen für
  leer — sie hätten gegen den neuen Stand fälschlich gemeldet, der Filter
  wirke nicht.
- **Eine erste Fassung der Audit-Pack-Prüfung ging bei der Gegenprobe grün
  durch.** Der Mock lieferte `report_document_id`, aber nicht
  `report_path` — und `report_path` war die einzige Spalte, an der die
  alte Fassung ihre `- report.pdf`-Zeile festmachte. Der alte Stand
  kündigte deshalb gar nichts an, und die Zusicherung „kündigt kein
  report.pdf an" hielt aus dem falschen Grund. Die Fassung im Repository
  liefert `report_path` mit. **Ein Test, der nicht fallen kann, ist kein
  Test** — dieselbe Lehre wie bei `dmn-links` in Welle 4b-3 §6.3.

Wie dort unterscheidet der Abfrageverteiler an der **Tabelle**
(`selectByTable`) und nicht an der Aufrufreihenfolge: der alte Stand hat
in `qa-review` weniger Abfragen, ein reihenfolgeblinder Mock hätte ihm die
falsche Antwort gegeben.

---

## 8. Was offen bleibt

- **Vier Parameter aus §3.4** (`status` im Auditoren-Dashboard;
  `departmentId` und `timeRange` im Abteilungsleiter-Dashboard; `depth`
  in `predictive-risk/correlations`). Jeder ist an seiner Stelle im
  Quelltext begründet.
- **Das Abteilungsleiter-Dashboard hat keinen Abteilungsbegriff** (§3.4).
  Das ist der Rahmen um (b) und (c) und eine Produktfrage: Solange die
  Route `assignee_id = ctx.userId` filtert, ist sie ein persönliches
  Dashboard mit einem irreführenden Namen.
- **Die Marktplatzsuche wirkt noch nicht in der Oberfläche.**
  `extensions/marketplace/page.tsx` hält ein `search`-Feld im Zustand und
  legt es **nicht** in die Abfragezeichenkette
  (`params.set("pricingModel", …)` und sonst nichts). Die Route kann jetzt
  suchen; die Seite fragt noch nicht danach. Die Datei liegt außerhalb der
  Dateihoheit dieses Strangs.
- **`eam/catalog`: `search` und `keyword` decken nicht alle drei Quellen**
  (§5).
- **`processes/[id]/simulation/compare` vergleicht den ältesten Lauf**
  (§6).
- **`audit.auditee_id` bleibt aus der Unabhängigkeitsprüfung heraus**
  (§4.2).
- **OP-173 bleibt der Rahmen um alles hier.** Ohne Lint-Ratsche für
  `apps/web` hängt die Null aus §7.2 allein am Tor-Test aus Welle 4b-3.

---

## 9. Was mir aufgefallen ist, das vorher niemand wusste

**Eine geprüfte Eingabe ist noch keine wirksame Eingabe — und sie sieht
genauso aus.** Sieben Routen führten einen `parse`-Aufruf, drei davon
sogar mit einem sauberen 422 bei ungültigen Werten. Von außen ist eine
Route mit wirkungslosem Filter von einer mit wirkendem **nicht zu
unterscheiden**, solange man die Daten nicht kennt: die Antwort ist
plausibel, nur zu groß. Die drei Dashboards geben ihr angewandtes Fenster
jetzt in der Antwort zurück; das ist billiger als jede Prüfung und macht
den Unterschied sichtbar.

**Der schwerste Fund war keiner der fünf Punkte.** Das Auditoren-Dashboard
(§3.3) war seit jeher vollständig kaputt — eine leere Seite, ein 500er bei
jedem Aufruf, ein Aufzählungswert, den es nicht gibt. Gefunden wurde er
nicht durch Suchen, sondern weil OP-176 die Datei überhaupt erst
aufgeschlagen hat. Zwei Wellen lang hat niemand gemerkt, dass eine ganze
Rollenansicht der Anwendung nichts anzeigt. **Kaputt und unbemerkt ist
nicht dasselbe wie selten benutzt — es heißt, dass es keine Prüfung gibt,
die den Erfolgsfall dieser Seite behauptet.**

**Der Auftrag „schau im Schema nach, statt zu raten" hat mehr gebracht als
die Antwort, die er suchte.** Bei OP-177 war die offengelassene Frage
(`auditor_profile` → `user`) im Schema eindeutig beantwortet — und beim
Nachschlagen kamen zwei weitere Wege heraus (`lead_auditor_id`,
`auditor_ids`), die der ursprüngliche Kopfkommentar gar nicht nannte und
die zusammen die **häufigere** Teamzugehörigkeit abdecken. Hätte man nur
die im Kommentar genannte Tabelle geprüft, stünde am Ende wieder eine
Kontrolle da, die selten etwas trifft. Bei OP-176 lief es andersherum:
dieselbe Methode hat für `departmentId` **bewiesen**, dass es kein Ziel
gibt. Dasselbe Werkzeug hat einmal eine Lösung freigelegt und einmal eine
Erfindung verhindert.

**Und die Datenbank hat einen Fehler gefunden, den kein Werkzeug der
Bauzeit sieht** (§7.1). Drizzles Array-Interpolation, der falsche
Aufzählungswert im Dashboard, der 500er statt 422 aus Welle 4b-3 — das ist
dreimal dieselbe Klasse: **SQL entsteht aus Zeichenketten, und
Zeichenketten prüft niemand außer Postgres.** Solange rohes SQL in den
Routen steht, ist eine laufende Datenbank im Prüflauf keine Bequemlichkeit,
sondern die einzige Instanz, die diese Klasse überhaupt melden kann.
