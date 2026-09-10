# E2E-Triage 3 — ARCTOS, die 10 Restfehlschlaege

**Lauf 4 (Ausgangslage):** 196 Tests — 184 bestanden, **10 gescheitert**, 2 uebersprungen.
**Lauf 7 (nach dieser Runde, gemessen):** 199 Tests — **197 bestanden, 0 gescheitert, 2 uebersprungen**, Laufzeit 5,2 min.
**Stand:** `710df2b8`, Branch `audit/full-2026-08-31`.
**Umgebung:** `http://127.0.0.1:3000`, Produktionsbau, PostgreSQL 17 auf Port 5433,
Demo-Bestand vorhanden.

Alle Befunde sind an der laufenden Instanz und an ihrer Datenbank **gemessen**,
nicht aus dem Code abgeleitet. Wo ein Fehlschlag einen Produktdefekt zeigte,
wurde der Defekt behoben; keine Erwartung wurde abgeschwaecht.

**Abgrenzung:** waehrend dieser Runde lief parallel eine zweite Arbeit im
selben Arbeitsverzeichnis (BPMN-Editor / GRC-Overlay, u. a.
`processes/[id]/page.tsx`, `packages/bpmn/**`, Migration `0443`). Der
gemessene Lauf 7 wurde gegen einen Baum ausgefuehrt, der **ausschliesslich**
`710df2b8` plus die hier beschriebenen Aenderungen enthaelt — die Zahl unten
gehoert also zu diesem Aenderungssatz und zu keinem anderen.

---

## 1. Der Hauptfall: die Suite hatte ein Konto, das Produkt verlangt drei

`bpm-approval-pipeline` lief bis Zeile 240 von 250 und scheiterte an
`422 „Separation of duties: the person defining the approval chain cannot be
the reviewer"`. Zwei Runden hatten das als „braucht einen zweiten Nutzer"
notiert und dort aufgehoert.

Beim Aufbau des zweiten Kontos zeigte sich, dass die Funktionstrennung im
Freigabezyklus nicht an **einer**, sondern an **drei** unabhaengigen Stellen
erzwungen wird — und dass ein einziges `admin`-Konto alle drei gleichzeitig
erfuellt, weshalb keine davon je geprueft wurde:

| Stelle                                                               | Regel                                                                                                                                                     |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROCESS_TRANSITION_ROLES` (`packages/shared/src/process-status.ts`) | `draft->in_review` = process_owner/admin, `in_review->approved` = auditor/admin **oder der eingetragene Reviewer**, `approved->published` = **nur admin** |
| `POST /processes/:id/approval-steps`                                 | eine Kette, die ihren eigenen Autor als Gate benennt, wird bei der Definition abgelehnt (WP3/S02-12)                                                      |
| `canDecideApprovalStep`                                              | wer eingereicht, die Version erstellt oder die Kette definiert hat, darf sie nicht entscheiden — **auch nicht als admin**                                 |

### 1.1 Die Konten — reproduzierbar, nicht per Hand

Neu: **`packages/db/src/seed-e2e-users.ts`**, `npm run db:seed:e2e-users`.

| Konto                       | Rolle(n)                        | Aufgabe im Zyklus                                                                                                   |
| --------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `e2e-owner@arctos.local`    | `process_owner`                 | legt Prozess, Version, Schritte, Mapping und Kette an; darf nichts davon freigeben                                  |
| `e2e-reviewer@arctos.local` | `auditor`, `compliance_officer` | eingetragener Reviewer → `in_review->approved` und das Review-Gate                                                  |
| `e2e-approver@arctos.local` | `admin`                         | `approved->published` und das Approval-Gate; ausserdem der Org-Admin **ohne** `platform_admin`, den `f-02b` braucht |

Eigenschaften, die absichtlich so sind:

- **Genau eine Mitgliedschaft pro Konto.** Die aktive Organisation einer
  Sitzung ist das Cookie `arctos-org-id` oder, wenn es nicht ankommt,
  `roles[0].orgId` (`packages/auth/src/context.ts`). **Gemessen:** dieses
  Cookie wird mit `Secure` gesetzt, kommt also gegen ein `http://`-Ziel im
  Browser-Kontext an, aber **nicht** im `request`-Fixture von Playwright — die
  API-Specs liefen deshalb bisher in `roles[0].orgId` (dem aeltesten
  Mandanten des Admin-Kontos, `6d2a7cf8`), waehrend die UI-Specs im
  Demo-Mandanten `ccc4cc1c` liefen. Mit genau einer Mitgliedschaft loesen
  beide Wege bei den Rollenkonten dieselbe Organisation auf, per Konstruktion.
  (Der Zwiespalt beim Admin-Konto bleibt bestehen und ist unter „Offen"
  vermerkt.)
- **Kein `platform_admin`.** Ein vorhandener Eintrag wird widerrufen. Fuer
  einen Plattform-Administrator ist `201` beim Anlegen eines Top-Level-Mandanten
  die _richtige_ Antwort — `f-02b` konnte deshalb nie das pruefen, was sein Name
  sagt.
- **Kein Passwort im Repository.** `E2E_ROLE_PASSWORD` ist Pflicht (>= 12
  Zeichen); das Skript legt kein Standardpasswort an (WP3/S02-01).
- **`must_change_password = false`** — es sind Fixtures, deren Passwort der
  Betreiber setzt; der Erstanmeldungs-Zwang von `db:create-admin` waere fuer
  einen nicht-interaktiven Lauf eine Sackgasse.
- **Idempotent**: erneutes Ausfuehren setzt Passwort-Hash, Aktivierung,
  Sperre und Rollenmenge neu.

### 1.2 Die Fixture-Schicht

- `apps/web/e2e/fixtures/storage.ts`: `STORAGE_STATE_OWNER`,
  `STORAGE_STATE_REVIEWER`, `STORAGE_STATE_APPROVER` plus `ROLE_ACCOUNTS` mit
  denselben Vorgaben, die der Seed schreibt.
- `apps/web/e2e/auth.setup.ts`: aus einem Setup-Test wurden vier. Jeder
  Rollen-Setup **scheitert** — er ueberspringt sich nicht —, wenn das Konto
  fehlt oder die erwarteten Rollen nicht traegt, und sagt in der Meldung, dass
  `npm run db:seed:e2e-users` fehlt.
- `tests/e2e/fixtures/auth.ts`: neues `loginAs(page, email, password)`;
  `login()` ist ein Aufruf davon.

### 1.3 Die Zusicherung wurde nicht weicher, sondern zum ersten Mal geprueft

`bpm-approval-pipeline` laeuft jetzt vollstaendig durch und behauptet dabei
**mehr** als vorher — vier Verweigerungen, die die Suite bisher nie gesehen
hat:

1. der Ersteller (`process_owner`) bekommt auf `in_review->approved` **403**;
2. der Reviewer bekommt auf `approved->published` **403**;
3. eine Kette, in der sich der Ersteller selbst als Reviewer eintraegt, wird
   mit **422 „Separation of duties…"** abgelehnt;
4. der Ersteller bekommt auf **beide** Gate-Schritte der gueltigen Kette
   **403 „Separation of duties: you submitted or defined this approval…"**.

Danach entscheidet der Reviewer das Review-Gate, der Approver das
Approval-Gate, und die Kette wird gegengeprueft: `decidedBy` der beiden Gates
sind die Konten, die entschieden haben, und nicht der Ersteller. Zusaetzlich
prueft der Test vorab, dass Ersteller, Reviewer und Approver **drei
verschiedene** Konten sind — sonst waeren alle vier Zusicherungen leer.

---

## 2. Die uebrigen neun, einzeln

### 2.1 `isms-workflow:96` (SoA) — **Produktdefekt**, kein Locator-Problem

Runde 2 notierte „der Text steht im HTML, der Locator findet ihn nicht" und
liess es unklassifiziert. **Gemessen:** das einzige Vorkommen von
„Kontrollen" im Dokument war ein `title=`-Attribut eines Navigationslinks —
ein Attribut ist kein Text, `getByText` hat also korrekt nichts gefunden.
`page.locator("body").innerText()` der Seite `/isms/soa`:

```
… SoA … Erklärung zur Anwendbarkeit (SoA) … Alle | Anwendbar | …
Keine SoA-Einträge gefunden. Aus ISO 27002-Katalog generieren.
```

— waehrend `GET /api/v1/isms/soa` im selben Mandanten **200** mit Eintraegen
liefert (gemessen: 7.115 Bytes).

**Ursache**, `apps/web/src/app/(dashboard)/isms/soa/page.tsx:96`:

```ts
const params = new URLSearchParams({ limit: "200" });   // 1
const res = await fetch(`/api/v1/isms/soa?${params}`);
if (res.ok) { … }                                        // 2
```

1. `paginate()` deckelt `limit` auf `MAX_PAGE_SIZE = 100` und weist alles
   Groessere **absichtlich** mit 422 ab (#NIGHT-059, „silent caps mean the
   caller never learns the API has a ceiling"). Im Serverlog der laufenden
   Instanz steht der Beweis:
   `GET /api/v1/isms/soa?limit=200 … must be <= 100`.
2. `if (res.ok)` verwirft den 422 spurlos: `rows` bleibt `[]`, `stats` bleibt
   `null`, die Seite rendert ihren Leerzustand — und bietet als Abhilfe „aus
   dem Katalog generieren" an, was Duplikate der bereits vorhandenen
   Eintraege erzeugt haette.

Die Erklaerung zur Anwendbarkeit ist das zentrale ISO-27001-Dokument dieses
Moduls; sie als leer anzuzeigen ist der schlechtestmoegliche Fehlermodus.

_Behoben:_ die Seite blaettert mit `limit=100` durch (`page`/`totalPages`) und
**meldet** einen fehlgeschlagenen Ladevorgang als Fehler (`role="alert"` +
Wiederholen), statt ihn als „keine Eintraege" darzustellen. Der Test wurde
gleichzeitig **schaerfer** gefasst: er prueft jetzt zusaetzlich, dass der
Leerzustand _nicht_ erscheint, dass kein Ladefehler steht und dass die Tabelle
Zeilen hat — ein Test namens „loads with Annex A controls" muss rot werden,
wenn die SoA leer ist.

**Das ist ein Klassendefekt, kein Einzelfall.** Im Anwendungscode stehen
**37** Aufrufe mit `limit` > 100 (u. a. `/users?limit=200` auf
`access-reviews` und `tasks`, `/catalogs/.../entries?limit=300` auf
`catalogs/controls` und `catalogs/risks`, `/api/v1/risks?limit=200` und
`/api/v1/catalogs?type=control&limit=200` in `audit/executions/[id]`,
`/assets|/controls|/isms/risk-scenarios?limit=200` im ISMS-Wizard). Im
Serverlog der laufenden Instanz sind `?limit=200` und `?limit=300` mehrfach
protokolliert. Behoben ist hier nur der Fall, auf den ein Test zeigt — der
Rest steht unter „Offen".

### 2.2 `management-review:27` (`actionElementId`) — **Produktdefekt**

**Gemessen:** `POST /api/v1/isms/reviews/:id/items` mit Massnahme antwortet
`{"actionWorkItemId":"0c117077-…","actionElementId":null}`.

Der Handler ist korrekt: er liest `element_id` aus dem `RETURNING` des
INSERTs, und `generate_work_item_element_id` ist ein **BEFORE**-INSERT-Trigger,
dessen Ergebnis darin enthalten waere. Der Trigger steigt aber sofort aus:

```sql
SELECT element_id_prefix INTO v_prefix FROM work_item_type WHERE type_key = NEW.type_key;
IF v_prefix IS NULL THEN RETURN NEW; END IF;
```

`0369_management_review_cockpit.sql` registriert `management_review_action`
**ohne** `element_id_prefix` — die Spalte steht nicht einmal in seiner
Spaltenliste. Fachliche Wirkung: die Element-ID ist die menschenlesbare
Referenz einer Massnahme; ohne sie zeigt die Reviewdetailseite
(`isms/reviews/[id]/page.tsx:1435`) eine leere Zelle und der 9.3-PDF-Export
(`export/pdf/route.ts:180`) eine Zeile, die mit einem Leerzeichen beginnt —
das Management-Review-Protokoll nennt seine Beschluss-Massnahmen ohne
Aktenzeichen.

_Behoben:_ Migration **`0442_management_review_action_element_id.sql`** — Praefix
`MRA` (frei; die 26 vergebenen Praefixe wurden gegen die Datenbank geprueft),
Bestandszeilen mit derselben Nummerierung nachgezogen, die der Trigger
verwendet, plus drei Selbstpruefungen. **Nachgemessen ohne Neubau:**
`element_id_prefix = 'MRA'`, `actionElementId` gesetzt, Test gruen.
Der Test prueft zusaetzlich, dass die Listenansicht dieselbe Element-ID
aufloest wie die Anlage-Antwort.

### 2.3 `process-map:37` (`childCount`) — **Produktdefekt, zwei Felder auf einmal**

**Gemessen** an der laufenden Instanz: ein Elternprozess mit einem Kind meldet
`childCount: 0`, und ein Prozess mit gespeicherter BPMN-Version meldet
`hasDiagram: false`.

**Ursache** — `apps/web/src/app/api/v1/processes/map/route.ts:112`. Beide
Unterabfragen referenzierten die aeussere Zeile mit `${process.id}`. In einer
**Select-Listen**-Position rendert Drizzle eine Spalte als blankes `"id"` (nur
in WHERE/ORDER BY qualifiziert es). Das erzeugte SQL — mit
`query.toSQL()` reproduziert — lautet:

```sql
select "id",
  (SELECT count(*)::int FROM process c WHERE c.parent_process_id = "id" AND c.deleted_at IS NULL),
  EXISTS (SELECT 1 FROM process_version v WHERE v.process_id = "id" AND …)
from "process" where ("process"."org_id" = $1 AND …)
```

Innerhalb der Unterabfragen bindet `"id"` an die **innere** Relation — `c.id`
bzw. `v.id` —, weil der innere Namensraum den aeusseren verdeckt. Die
Bedingungen lauten damit „ein Prozess, dessen Elternprozess er selbst ist" und
„eine Version, deren Id ihre eigene Prozess-Id ist": beide unerfuellbar.
`childCount` war also **immer 0** und `hasDiagram` **immer false** — fuer jeden
Mandanten. Die Prozesslandkarte zeigt an keiner Kachel einen Hinweis auf
Unterprozesse und an keiner ein Diagramm-Kennzeichen.

Dieselbe Stelle steht ein zweites Mal in
`apps/web/src/app/api/v1/processes/tree/route.ts:35` — die Prozess-Baumansicht
meldet aus demselben Grund fuer jeden Knoten `childCount: 0`.

_Behoben:_ beide Referenzen ausdruecklich qualifiziert (`"process"."id"`), mit
einer Notiz an der Codestelle, warum. Der Test prueft jetzt zusaetzlich
`hasDiagram` (dasselbe Statement, derselbe Defekt, bisher von nichts geprueft)
und dass ein Blatt weiterhin `childCount: 0` meldet — die Zahl muss je Zeile
stimmen, nicht konstant sein.

### 2.4 `f-18-integrity` — der Limiter ist falsch dimensioniert

**Gemessen** (drei Aufrufe direkt hintereinander, ein Nutzer):

```
GET /api/v1/audit-log/integrity  ->  200
GET /api/v1/audit-log/integrity  ->  429   Retry-After: 60
GET /api/v1/audit-log/integrity  ->  429   Retry-After: 60
```

ADR-019 §57 fordert „1 req/min pro User" fuer die Hash-Ketten-Pruefung, und
diese **Dauerrate** ist richtig: der Endpunkt rechnet jede Audit-Zeile des
Mandanten neu und ist der teuerste Lesevorgang des Produkts. `capacity: 1`
ist aber nicht diese Regel, sondern diese Regel mit **Burst 1**: ein
Token-Bucket der Groesse 1 ist nach dem ersten Aufruf leer, der zweite wird
abgewiesen, egal wie weit die beiden innerhalb des Fensters auseinanderliegen.

Was das im Produkt kostet, nicht nur in der Suite: `/audit-log` ruft den
Endpunkt beim Mounten auf. Seite oeffnen, wegblaettern, innerhalb der Minute
zurueck — und die Integritaetsanzeige des Audit-Trails meldet einen Fehler.
Bis zu dieser Runde meldete sie ihn als nacktes `HTTP 429`, was auf genau
dieser Flaeche wie „der Audit-Trail konnte nicht verifiziert werden" liest.
Eine Kontrolle, die beim Zurueckblaettern Alarm schlaegt, ist schlechter als
keine Anzeige.

_Behoben, zweiteilig:_

- `LIMITS.AUDIT_INTEGRITY` = **5 / 300 s**. Das ist ADR-019s Mittelwert
  unveraendert (5/300 s = 1/60 s), mit Burst 5. Weiter subjektgeschluesselt,
  weiter fail-open, weiter ueber `RATE_LIMIT_AUDIT_INTEGRITY` ueberschreibbar.
  ADR-019 ist entsprechend ergaenzt (Rate + Burst, mit Messung).
- `audit-log/page.tsx` unterscheidet einen 429 jetzt ausdruecklich von einem
  Pruefungsfehler und nennt die Wartezeit: „nicht geprueft (nicht: nicht
  bestanden)".

Die Spec `f-18` selbst blieb unangetastet — ihre Null-Toleranz auf
`rowMismatches`/`chainMismatches` steht unveraendert.

### 2.5 `b-01`, `b-02`, `i-02` — veraltete Erwartung, und dahinter ein zweiter Fehler

Alle drei liefen bis Lauf 3 als „skipped" (`test.skip(!id, …)` griff, weil die
Suite im leeren Mandanten lief) und schlugen beim ersten echten Lauf auf
`toMatchObject({ ok: expect.any(Boolean) })` an — eine Form, die keiner der
drei Endpunkte je geliefert hat.

Die tatsaechlichen Vertraege, gegen die Instanz geprueft:

| Spec   | Antwort                                                                             |
| ------ | ----------------------------------------------------------------------------------- |
| `b-01` | `{data:{biaAssessmentId, snapshot, coverageStats, b1:{passed,blockers[]}, b2:{…}}}` |
| `b-02` | `{data:{bcpId, status, snapshot, b3:{passed,blockers[]}, b5:{…}, b6:{…}}}`          |
| `i-02` | `{data:{assessmentRunId, stats:{…}, coverage, blockers[], passed}}`                 |

Ersetzt wurde die leere Formpruefung nicht durch eine andere Formpruefung,
sondern durch die **Invariante**: `passed` muss aus den Blockern folgen —
`passed === (Anzahl Blocker mit severity 'error' === 0)`. `expect.any(Boolean)`
konnte einen Gate-Verdict, der seinen eigenen Blockern widerspricht, nicht
erkennen; das ist der Fehler, der hier zaehlt. Zusaetzlich: `scoredImpacts <=
totalProcessImpacts` bzw. `completedEvaluations <= totalEvaluations`, und jeder
Blocker traegt Code und gueltige Severity.

**Zweiter Fehler in `i-02`, unabhaengig davon:** der „verbotene Uebergang"
schickte `{ to: "finalize" }`. Das Schema der Route
(`isms/assessments/[id]/transition/route.ts:30`) nimmt `targetStatus` aus einem
Enum von fuenf Werten, in dem „finalize" nicht vorkommt — der beobachtete 422
kam aus `safeParse`, die Zustandsmaschine wurde **nie erreicht**.
`expect([400, 409, 422]).toContain(...)` machte beide Faelle ununterscheidbar.
Jetzt werden sie getrennt geprueft:

- fehlerhafter Body → 422 mit `error: "Validation failed"`;
- `targetStatus = <aktueller Status>` (aus **jedem** Zustand in
  `ALLOWED_TRANSITIONS` unzulaessig, also unabhaengig von der Seed-Phase) →
  422 mit `blocked: true`, `currentStatus` und Blocker `invalid_transition`;
- und der abgewiesene Uebergang darf den Lauf **nicht** bewegt haben.

### 2.6 `f-02b` — kein Produktdefekt, aber jetzt ueberhaupt pruefbar

Zwei Runden fuehrten dies als „Umgebung": `E2E_EMAIL` wurde mit
`db:create-admin --platform-admin` provisioniert, und fuer einen
Plattform-Administrator ist 201 beim Anlegen eines Top-Level-Mandanten die
richtige Antwort. Die Zusicherung konnte also nicht bedeuten, was sie sagt —
unabhaengig davon, wie sich das Produkt verhaelt.

_Behoben ohne die 403 anzutasten:_ der Test meldet sich als
`e2e-approver@arctos.local` an — Organisations-Admin, kein `platform_admin` —
und prueft vorab ueber die Sitzung, dass das Konto `admin` traegt. Genau dieser
Prinzipal ist gemeint. **Nachgemessen: gruen.**

### 2.7 `E2E_ORG_ID` und `RATE_LIMIT_AUTH`

**`E2E_ORG_ID`** steht jetzt als Vorgabe in beiden Playwright-Konfigurationen
(`playwright.config.ts`, `apps/web/playwright.config.ts`):

```ts
const DEMO_TENANT_ORG_ID = "ccc4cc1c-4b09-499c-8420-ebd8da655cd7";
if (process.env.E2E_ORG_ID === undefined)
  process.env.E2E_ORG_ID = DEMO_TENANT_ORG_ID;
```

Das ist kein Umgebungsgeheimnis: `packages/db/sql/seed_demo_00_platform.sql`
schreibt diese Id woertlich, sie ist auf jeder Datenbank gleich, die
`db:seed:demo` gesehen hat. Setzen der Variable ueberschreibt, Setzen auf leer
schaltet die Mandanten-Fixierung ab.

**`RATE_LIMIT_AUTH`** gehoert nicht in die Playwright-Konfiguration und steht
dort auch nicht: die Variable liest der **Server**
(`apps/web/src/lib/rate-limit.ts`), nicht der Testlaeufer — ein dort gesetzter
Wert waere ein beruhigendes Nichts. Stattdessen ist der Grund beseitigt, aus
dem die Suite sie brauchte:

- das `regression`-Projekt traegt jetzt den Storage-State des Setup-Projekts
  (`use: { storageState: STORAGE_STATE }`), und
- `loginAs()` benutzt eine vorhandene Sitzung, statt sich erneut anzumelden;
  das Formular kommt nur noch zum Einsatz, wenn keine Sitzung da ist oder ein
  Spec ein **anderes** Konto will (`f-02b`).

Aus 46 Anmeldungen pro Lauf von einer Adresse gegen ein 10/min-Limit werden
damit vier (die vier Setup-Anmeldungen) plus eine fuer `f-02b`. Der Limiter
bleibt unveraendert.

---

## 3. Was dabei zusaetzlich sichtbar wurde

- **Der Mandanten-Zwiespalt der Suite.** Gemessen am gespeicherten
  Storage-State: das Cookie `arctos-org-id` traegt `secure: true`. Gegen
  `http://127.0.0.1:3000` erreicht es den Browser-Kontext, nicht aber
  Playwrights `request`-Kontext. Folge: UI-Specs behaupten gegen `ccc4cc1c`
  (Demo-Mandant), API-Specs gegen `6d2a7cf8` (aelteste Mitgliedschaft des
  Admin-Kontos). `E2E_ORG_ID` wirkt also nur fuer die Haelfte der Suite, obwohl
  der Kommentar an der Setup-Stelle etwas anderes nahelegte. Fuer die
  Rollenkonten ist das durch die Ein-Mitgliedschafts-Regel geloest; fuer das
  Admin-Konto steht es unter „Offen", weil ein Eingriff dort 40+ gruene Specs
  in einen anderen Mandanten verschoben haette.
- **`0439` verweist auf einen Test, den es nicht gibt.** Die Migration nennt
  `packages/db/tests/unit/work-item-type-registry.test.ts` als dauerhafte
  Gegenprobe; die Datei existiert im Repository nicht. `0442` behauptet daher
  keine solche Gegenprobe, sondern protokolliert am Ende, welche aktiven
  `work_item_type` noch ohne `element_id_prefix` sind.

---

## 4. Vollstaendige Tabelle (alle 10)

| #   | Spec / Test                                 | Kat. | Ursache                                                                      | Zustand in Lauf 7          |
| --- | ------------------------------------------- | ---- | ---------------------------------------------------------------------------- | -------------------------- |
| 1   | bpm-approval-pipeline                       | E→C  | Funktionstrennung an drei Stellen; die Suite hatte ein Konto                 | **gruen**                  |
| 2   | isms-workflow:96 SoA                        | C    | `limit=200` → 422, Status verworfen → Leerzustand ueber vollem Mandanten     | **gruen**                  |
| 3   | management-review:27                        | C    | `management_review_action` ohne `element_id_prefix` (0369)                   | **gruen**                  |
| 4   | process-map:37                              | C    | unqualifizierte Korrelation → `childCount` immer 0, `hasDiagram` immer false | **gruen**                  |
| 5   | f-18-integrity                              | C    | `AUDIT_INTEGRITY` mit Burst 1; 429 als Pruefungsfehler dargestellt           | **gruen**                  |
| 6   | b-01-bia-lifecycle                          | B    | `{ok}` gegen `{data:{b1,b2,…}}`                                              | **gruen**                  |
| 7   | b-02-bcp-lifecycle                          | B    | `{ok}` gegen `{data:{b3,b5,b6,…}}`                                           | **gruen**                  |
| 8   | i-02-assessment-lifecycle                   | B+D  | `{ok}`; zusaetzlich `{to:"finalize"}` — Schema statt Zustandsmaschine        | **gruen**                  |
| 9   | f-02-org-create:91 (`f-02b`)                | E    | Suite lief als Plattform-Admin                                               | **gruen**                  |
| 10  | (Umgebung) `E2E_ORG_ID` / `RATE_LIMIT_AUTH` | E    | Vorgaben lagen in der Erinnerung des Betreibers                              | **geloest / dokumentiert** |

Zwei Fehlschlaege **entstanden erst durch diese Runde** und sind ebenfalls
behoben (Abschnitt 5.2): `x-03-auditor-portal` (mein geteilter Storage-State
machte den „anonymen" Kontext angemeldet) und eine Hydrations-Race im
Login-Formular, die `r-02` und `f-02b` sporadisch rot machte.

---

## 5. Messungen

### 5.1 Vollauf

```
Lauf 4 (Ausgangslage):  196 Tests — 184 bestanden, 10 gescheitert, 2 uebersprungen   9,4 min
Lauf 7 (dieser Stand):  199 Tests — 197 bestanden,  0 gescheitert, 2 uebersprungen   5,2 min
```

199 statt 196: die drei zusaetzlichen Tests sind die Rollen-Anmeldungen des
Setup-Projekts (`authenticate as owner|reviewer|approver`). **Alle 10
beauftragten Fehlschlaege sind gruen; kein zuvor gruener Test ist rot.**

Zwischenstaende, weil sie zwei ehrliche Zwischenbefunde festhalten:

| Lauf | Ergebnis                 | Anmerkung                                                                           |
| ---- | ------------------------ | ----------------------------------------------------------------------------------- |
| 5    | 194 / 3 / 2, 7,0 min     | zwei selbstverursachte Fehler (5.2) + eine Hydrations-Race                          |
| 6    | 167 / 26 / 6, 4,5 min    | **429 auf dem `default`-Eimer** — die schneller gewordene Suite ueberzog ihr Budget |
| 7    | **197 / 0 / 2, 5,2 min** | mit den E2E-Budgets des Servers aus `.env.example`                                  |

### 5.2 Die zwei Fehler, die diese Runde selbst erzeugt hat

Beide sind behoben; sie stehen hier, weil sie die Art von Befund sind, die man
sonst als „flaky" abtut.

- **`x-03-auditor-portal:30`.** Der Test baut mit `browser.newContext()` einen
  „anonymen" Kontext. Dieser uebernimmt die Kontextoptionen aus `use` — also
  seit dieser Runde den Storage-State des Setup-Projekts. Der „anonyme"
  Besucher war angemeldet, das Portal rendert fuer ihn korrekt, und der Test
  meldete ein Leck, das es nicht gibt. **Gegen die laufende Instanz gemessen,
  waehrend der Test rot war:** `GET /audit/external-portal` ohne Cookies →
  `307 /login?callbackUrl=…`. _Behoben:_ `storageState: undefined` und eine
  Vorbedingung, die prueft, dass der Kontext wirklich keine Cookies traegt.
  Dieselbe Explizitheit in `document-signature.spec.ts`, das aus demselben
  Grund einen zweiten Nutzer anmeldet.
- **Hydrations-Race im Login-Formular** (`r-02`, `f-02b` in Lauf 5).
  `waitForSelector` liefert das Eingabefeld, sobald es im servergerenderten
  Markup steht; React setzt seine kontrollierten Felder beim Hydrieren zurueck
  und verwirft, was dazwischen getippt wurde. Die Fehlerseite zeigt das
  Passwort gefuellt und **das E-Mail-Feld leer**, das Formular sendet nicht,
  und `access_log` enthaelt fuer diesen Moment **keinen** Anmeldeversuch — die
  Suite meldete also einen „Timeout" fuer etwas, das den Server nie erreicht
  hat. _Behoben:_ fuellen, den Feldinhalt **pruefen**, erst dann klicken (bis
  zu drei Versuche, danach eine benannte Fehlermeldung) — in
  `tests/e2e/fixtures/auth.ts` und `apps/web/e2e/auth.setup.ts`.

### 5.3 Die Rate-Limits, ehrlich

Die Umstellung auf einen geteilten Storage-State machte den Lauf um rund ein
Drittel schneller (7,0 → 4,5 min) — und damit ueberzog die Suite in Lauf 6 das
**Produktbudget** `RATE_LIMIT_DEFAULT` (300 Anfragen/min **pro Nutzer**): 26
Tests scheiterten mit 429. Das ist kein Produktdefekt: die Suite fuehrt alle
199 Tests seriell unter EINEM Prinzipal aus, gemessen rund 2.400 API-Aufrufe
in 4,5 Minuten, also ueber 500/min auf einen `u:<userId>`-Eimer.

Der Limiter wurde **nicht** angefasst. Stattdessen bekommt die Testumgebung ein
Testumgebungs-Budget, und zwar an einer Stelle, an der es steht statt erinnert
zu werden — `.env.example`, Abschnitt „E2E-Testumgebung":

```
RATE_LIMIT_DEFAULT=3000/60
RATE_LIMIT_AUTH=1000/60
```

Beide sind **serverseitig** — sie in `playwright.config.ts` zu setzen waere ein
beruhigendes Nichts, weil der Testlaeufer sie nicht liest. Lauf 7 lief mit
genau diesen beiden Variablen am Server und sonst nichts.

### 5.4 Ohne Neubau gemessen (nur Migration / Daten)

| Messung                                                         | vorher      | nachher            |
| --------------------------------------------------------------- | ----------- | ------------------ |
| `work_item_type.element_id_prefix` (`management_review_action`) | `NULL`      | **`MRA`**          |
| `POST /isms/reviews/:id/items` → `actionElementId`              | `null`      | **gesetzt**        |
| `bpm-approval-pipeline` (3 Konten, alte Binaries)               | rot bei 240 | **gruen, 250/250** |

### 5.5 Nach dem Neubau gemessen

| Messung                                      | vorher                         | nachher                                  |
| -------------------------------------------- | ------------------------------ | ---------------------------------------- |
| `/api/v1/processes/map` → `childCount`       | immer `0`                      | **1 bei einem Kind**                     |
| `/api/v1/processes/map` → `hasDiagram`       | immer `false`                  | **true bei gespeichertem BPMN**          |
| `/isms/soa` fuer den Demo-Mandanten          | „Keine SoA-Eintraege gefunden" | **Tabelle mit Eintraegen**               |
| `GET /audit-log/integrity` 2× hintereinander | `200`, dann `429`              | **`200`, `200`**                         |
| `app-paths-manifest.json`                    | 1 `coverage`-Route             | **alle 3** (C-15 endgueltig geschlossen) |

### 5.6 Gruen geblieben

```
npx tsc --noEmit -p apps/web/tsconfig.json   -> keine Ausgabe
cd apps/web && npx vitest run                -> 104 Dateien, 2.473 Tests, alle bestanden
tsx packages/db/src/migrate-all.ts           -> 407/407 migrations applied
```

Der Migrationslauf schliesst die neue `0442` ein; `migrate-all` meldet
`Pass 2: 0 recovered, 0 still failing`.

---

## 6. Offen

- **Die zwei uebersprungenen Tests** (unveraendert gegenueber Lauf 4), jetzt
  benannt:
  - `document-signature.spec.ts:74` — `test.skip(!signer, "Demo user … not
found in the current org")`. Das ist ein **Symptom des Mandanten-Zwiespalts**
    aus Abschnitt 3: der `request`-Kontext landet in `6d2a7cf8`, wo die
    Demo-Personas nicht existieren; im Demo-Mandanten `ccc4cc1c` gibt es sie.
  - `i-08-cve-flow.spec.ts:6` — `test.skip(!id, "no CVE matches available")`.
    Echte Seed-Luecke: `db:seed:demo` legt keine CVE-Matches an.
- **Der Mandanten-Zwiespalt selbst.** `arctos-org-id` ist ein `Secure`-Cookie
  und erreicht Playwrights `request`-Kontext gegen `http://` nicht; UI-Specs
  behaupten gegen `ccc4cc1c`, API-Specs gegen `6d2a7cf8`. Bewusst **nicht** in
  dieser Runde angefasst: die naheliegende Korrektur (das Cookie im
  gespeicherten Zustand auf `secure: false` setzen, wenn das Ziel `http://`
  ist) haette ueber 40 gruene Specs in einen anderen Mandanten verschoben. Fuer
  die Rollenkonten ist es durch die Ein-Mitgliedschafts-Regel erledigt; fuer
  das Admin-Konto gehoert es in eine eigene Runde, mit einem Vollauf davor und
  danach.
- **37 UI-Aufrufe mit `limit` > 100.** `/isms/soa` war der Fall, auf den ein
  Test zeigte; die anderen 36 stehen unveraendert im Code und erzeugen
  dieselbe Klasse von Fehler (422 → stiller Leerzustand). Im Serverlog dieser
  Instanz protokolliert sind mindestens `/api/v1/users?limit=200`
  (`access-reviews`, `tasks`, mehrere Auswahlfelder),
  `/api/v1/catalogs/controls/<id>/entries?limit=300`,
  `/api/v1/kris?limit=200`, `/api/v1/bcms/crisis?limit=200`. Zwei Wege stehen
  offen und schliessen sich nicht aus: die Aufrufstellen auf `limit=100` +
  Blaetterung umstellen, **oder** `MAX_PAGE_SIZE` fuer Listen anheben, die
  ohnehin vollstaendig geladen werden sollen. Beides ist eine eigene Aufgabe;
  Voraussetzung ist, dass kein Aufrufer einen Nicht-200 weiter verwirft.
- **`0439` verweist auf einen nicht existierenden Test**
  (`packages/db/tests/unit/work-item-type-registry.test.ts`). Entweder den Test
  schreiben oder den Verweis entfernen — `0442` behauptet ihn nicht.
- **`f-17-schema-drift`** meldet weiterhin vier fehlende Tabellen (`account`,
  `session`, `verification_token`, `audit_anchor_seal`); drei davon sind
  Auth.js-Adaptertabellen, die die JWT-Strategie nicht braucht. Der Test
  toleriert bis zu fuenf und ist gruen — der Drift-Endpunkt antwortet aber
  weiterhin 503. Unveraendert offen aus Runde 2.
- **Detailrouten** (`controls/findings/[id]`, `audit/executions/[id]`,
  `tprm/vendors/[id]`) liegen unter Modulpfaden, waehrend die Listen unter
  `/findings`, `/audit-mgmt`, `/vendors` liegen. Keine Fehlfunktion,
  unveraendert offen aus Runde 2.
- **Nicht committet.** Wie beauftragt: alle Aenderungen liegen im
  Arbeitsverzeichnis, einschliesslich der neuen Migration `0442` und
  `packages/db/src/seed-e2e-users.ts`.

---

## 7. Wie der Lauf reproduziert wird

```bash
# 1. Server (E2E-Budgets, siehe .env.example)
RATE_LIMIT_DEFAULT=3000/60 RATE_LIMIT_AUTH=1000/60 \
PORT=3000 HOSTNAME=127.0.0.1 node apps/web/.next/standalone/apps/web/server.js

# 2. Migrationen + Demo-Daten
npm run db:migrate-all
npm run db:seed:demo

# 3. Rollenkonten (idempotent)
E2E_ROLE_PASSWORD='<12+ Zeichen>' npm run db:seed:e2e-users

# 4. Suite
E2E_EMAIL=<admin> E2E_PASSWORD=<...> \
E2E_ROLE_PASSWORD='<derselbe Wert>' \
E2E_BASE_URL=http://127.0.0.1:3000 \
npx playwright test --reporter=line
```

`E2E_ORG_ID` muss nicht gesetzt werden — `playwright.config.ts` setzt den
Demo-Mandanten als Vorgabe.
