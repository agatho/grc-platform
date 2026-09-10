# E2E-Triage 4 — der Mandanten-Zwiespalt, und was er verdeckt hat

**Ausgangslage (Runde 3, Stand `81200d89`):** 199 Tests — 197 bestanden,
0 gescheitert, **2 uebersprungen**.
**Lauf 8 (nach dieser Runde, gemessen):** 199 Tests — **199 bestanden,
0 gescheitert, 0 uebersprungen**, Laufzeit 4,5 min.
**Lauf 9 (Wiederholung auf demselben Datenbestand, ohne erneutes Seeden):**
siehe Abschnitt 6.2.

**Stand:** `81200d89`, Branch `audit/full-2026-08-31`, nicht committet.
**Umgebung:** `http://127.0.0.1:3000`, Produktionsbau, PostgreSQL 17 auf
Port 5433, voller Demo-Bestand.

Alle Befunde sind an der laufenden Instanz und an ihrer Datenbank
**gemessen**. Keine Zusicherung wurde abgeschwaecht; die beiden
uebersprungenen Tests behaupten heute mehr als vor dieser Runde.

**Abgrenzung:** im selben Arbeitsverzeichnis laeuft parallel eine zweite
Arbeit (GRC-Overlay, `packages/db/src/schema/**`, `apps/web/src/lib/
grc-overlay.ts`, `processes/[id]/diagram-overlay/**`, Migrationen ab 0444).
Der gemessene Lauf wurde gegen einen Baum ausgefuehrt, der **ausschliesslich**
`81200d89` plus die hier beschriebenen Aenderungen enthaelt.

---

## 1. Der Zwiespalt, gemessen statt abgeleitet

Zuerst der Befund, gegen die laufende Datenbank erhoben:

| Frage                                           | Messung                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wer traegt die Demodaten?                       | `ccc4cc1c-4b09-499c-8420-ebd8da655cd7` „Meridian Holdings GmbH (Demo Tenant)" — 10 Assets, 9 Dokumente, SoA, Prozesse, KI-Register                                                                                                                         |
| Welchem Mandanten gehoert `admin@arctos.local`? | **Zwanzig** Mitgliedschaften: `c2446a5c`, `6d2a7cf8`, `ccc4cc1c` und **siebzehn** Wegwerf-Organisationen `E2E-F02-*` / `E2E-F02b-*` / `E2E-F15-*`                                                                                                          |
| Was loest `roles[0]` auf?                       | `6d2a7cf8` „Arctis Group GmbH" — **null Assets**                                                                                                                                                                                                           |
| Welche Konten gibt es sonst?                    | `e2e-owner`, `e2e-reviewer`, `e2e-approver` (je genau eine Mitgliedschaft in `ccc4cc1c`), `admin@arctos.dev` (10 Mitgliedschaften, `must_change_password=true`), 10 Demo-Personas `demo.*@arctos.dev` mit `password_hash='disabled:no-login-demo-persona'` |

Die Mechanik dahinter, aus dem Code und an der Instanz bestaetigt:

- Die aktive Organisation einer Sitzung ist das Cookie `arctos-org-id` oder,
  wenn es nicht ankommt, `roles[0].orgId`
  (`packages/auth/src/context.ts:36`). `roles` ist nach
  `user_organization_role.created_at`, dann `org_id` sortiert
  (`packages/auth/src/providers.ts:279`).
- Das Cookie wird mit `secure: NODE_ENV === "production"` gesetzt
  (`context.ts:50`). Der E2E-Server **ist** ein Produktionsbau, das Ziel ist
  `http://`. Ergebnis: das Cookie erreicht den Browser-Kontext, aber nicht
  Playwrights `request`-Fixture.
- Folge: UI-Specs behaupteten gegen `ccc4cc1c`, die `request`-Specs gegen
  `6d2a7cf8` — einen Mandanten ohne ein einziges Asset. **Die Suite lief in
  zwei Mandanten gleichzeitig.**
- Und: `admin@arctos.local` wird von **keinem Seed** angelegt. Es entstand per
  `db:create-admin`. Eine frische Datenbank konnte den Lauf also nicht
  reproduzieren — unabhaengig vom Mandanten.

---

## 2. Die Entscheidung: verschieben, und zwar im Seed

Der Eigentümer hat „ein weiteres Konto anlegen **oder** das vorhandene
verschieben" freigegeben. Gewaehlt ist: **das Hauptkonto gehoert in
`db:seed:e2e-users`, mit genau einer Mitgliedschaft im Demo-Mandanten.**
Beides — anlegen und verschieben — ist derselbe Codeweg; welcher von beiden
laeuft, entscheidet `E2E_EMAIL`:

- ohne `E2E_EMAIL` legt der Seed `e2e-admin@arctos.local` an (der Weg, den
  eine frische Datenbank geht);
- mit `E2E_EMAIL=admin@arctos.local` **verschiebt** er das vorhandene Konto
  des Betreibers (der Weg, den diese Maschine geht — und der, den die
  gewohnte Kommandozeile des Eigentümers weiterhin nimmt).

Warum nicht die naheliegendere Korrektur — das Cookie im gespeicherten
Zustand auf `secure: false` setzen?

1. Sie repariert nur das Symptom auf **einer** Maschine. `admin@arctos.local`
   bliebe ein Konto, das kein Seed erzeugt; die Abnahmebedingung „frische
   Datenbank → Seeds → gruene Suite" waere weiter unerfuellbar.
2. Sie laesst die Mehrfach-Mitgliedschaft bestehen, und die **waechst**:
   `f-02` und `f-15` legen pro Lauf je eine Organisation an und machen den
   Ersteller dort zum Admin. 17 solcher Mitgliedschaften lagen bereits vor.
3. Ein Konto mit einer Mitgliedschaft loest **beide** Wege — Cookie und
   `roles[0]` — per Konstruktion auf dieselbe Organisation auf. Das ist keine
   Reparatur, sondern der Wegfall der Fallunterscheidung: die Rollenkonten
   folgen dieser Regel seit Runde 3, das Hauptkonto folgt ihr jetzt auch. Kein
   Sonderfall in einem einzigen Test.

Die Mandantentrennung weicht dabei nicht auf — sie wird **enger**: aus 20
Mitgliedschaften wird eine. Jede zusaetzliche Berechtigung ist ausdruecklich
begruendet:

| Konto                     | Mitgliedschaft                       | `platform_admin`           | Warum                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e-admin` / `E2E_EMAIL` | 1 × `ccc4cc1c` admin                 | **ja**                     | `f-15` legt einen Top-Level-Mandanten ohne `parentOrgId` an; das ist laut Handler + Migration 0438 eine Plattform-Admin-Handlung. Ohne die Berechtigung waere 403 die richtige Antwort und der Test faelschlich rot. |
| `e2e-owner`               | 1 × `process_owner`                  | nein                       | erzeugende Seite des Freigabezyklus                                                                                                                                                                                  |
| `e2e-reviewer`            | 1 × `auditor` + `compliance_officer` | nein                       | Review-Gate                                                                                                                                                                                                          |
| `e2e-approver`            | 1 × `admin`                          | **nein, aktiv widerrufen** | `f-02b` prueft, dass ein Organisations-Admin _keinen_ Top-Level-Mandanten anlegen darf. Mit `platform_admin` waere die Zusicherung leer.                                                                             |

### 2.1 Warum `roles[0]` dauerhaft stimmt

Eine Mitgliedschaft ist ein Zustand, kein Gesetz: `f-02` und `f-15` legen
waehrend des Laufs neue an. Deshalb setzt der Seed das `created_at` der
gesetzten Mitgliedschaft auf einen festen Zeitpunkt in der Vergangenheit
(`E2E_MEMBERSHIP_EPOCH = 2000-01-01`). `roles[0]` ist die **aelteste** Zeile;
jede vom Lauf erzeugte ist beweisbar juenger. Der Seed prueft das Ergebnis
anschliessend selbst und bricht ab, wenn ein Konto anders aufloesen wuerde:

```
admin@arctos.local           roles=admin  platform_admin=yes  memberships=1
e2e-owner@arctos.local       roles=process_owner   platform_admin=no  memberships=1
e2e-reviewer@arctos.local    roles=auditor,compliance_officer  platform_admin=no  memberships=2
e2e-approver@arctos.local    roles=admin  platform_admin=no  memberships=1
```

(`memberships=2` beim Reviewer sind zwei **Rollen** in derselben einen
Organisation.)

### 2.2 Aus der Reparatur wurde eine Pruefung

`auth.setup.ts` hat den Mandanten bisher **repariert**: passte
`currentOrgId` nicht zu `E2E_ORG_ID`, rief es `switch-org`. Das erreichte
genau die Haelfte der Suite — `switch-org` setzt das `Secure`-Cookie, das die
API-Fixture nie sieht. Der Aufruf ist ersetzt durch eine Zusicherung auf
`currentOrgId` **direkt nach der Anmeldung**, wo dieser Wert per Definition
`roles[0].orgId` ist, also genau der Mandant, in dem jede Anfrage ohne Cookie
landet. Eine Abweichung ist jetzt ein benannter Fehlschlag mit dem Befehl, der
ihn behebt — statt einer stillen Verschiebung. Dieselbe Pruefung gilt fuer die
drei Rollenkonten.

---

## 3. Skip 1: `document-signature` — die Meldung nannte einen von drei Gruenden

`test.skip(!signer, "Demo user risk.manager@arctos.dev not found in the
current org")`. Gemessen sind es **drei** unabhaengige Gruende, von denen der
Skip nur den ersten kannte:

1. **Mandant.** `risk.manager@arctos.dev` sitzt laut `db:seed` in
   `bd583a11` „Meridian Holdings GmbH" — weder im Demo-Mandanten noch in dem,
   den die `request`-Fixture aufloeste.
2. **Passwort.** Der Test hielt `arctos2026!` als Literal. WP3/S02-01 hat
   genau dieses Passwort aus dem Seed entfernt; `packages/db/src/seed.ts:481`
   hasht heute `SEED_DEMO_PASSWORD` oder einen einmalig ausgegebenen
   Zufallswert. Die Anmeldung in Schritt 4 konnte auf keiner nach dieser
   Aenderung geseedeten Datenbank funktionieren.
3. **Erstanmeldung.** Das Konto traegt `must_change_password = true`. Selbst
   mit richtigem Passwort landet die Anmeldung auf der Passwortwechsel-Seite,
   und `waitForURL(/dashboard/)` laeuft ab.

**Behoben:** zweiter Unterzeichner ist `e2e-approver@arctos.local` — vom
selben Seed erzeugt, im selben Mandanten, mit dem Passwort, das der Lauf
ohnehin hat, ohne Erstanmeldungs-Zwang, und mit der Rolle `admin`, die
`PUT /documents/:id/status` verlangt. Aus dem Skip wurde ein **harter
Fehlschlag** mit dem Seed-Befehl in der Meldung, plus einer Vorbedingung, dass
Ersteller und Unterzeichner verschiedene Konten sind — sonst waere die
Vier-Augen-Zusicherung leer.

Dabei sind zwei weitere Defekte aufgefallen, die der Skip verdeckt hatte:

### 3.1 Produktdefekt: `audit_log` — acht Schreibwege, die seit 0407 tot sind

`POST /signature-requests/:id/sign` antwortete **500**:

```
Failed query: insert into "audit_log" ( … )
```

Direkt gegen die Datenbank reproduziert, als Laufzeit-Rolle:

```
node repro.cjs postgres://grc_app:…  →  42501  permission denied for table audit_log
```

Das ist `0407_audit_grants_and_migration_anchor.sql`, die tut, was sie
verspricht: `GRANT SELECT ON audit_log TO grc_app`, dazu ausdruecklich
`REVOKE INSERT, UPDATE, DELETE`, mit der Begruendung „every write goes through
a SECURITY DEFINER trigger or through `write_audit_entry()`". **Acht Stellen
im Anwendungscode schreiben trotzdem direkt** — ihre Kommentare sagen
„chained by the BEFORE INSERT trigger (0401)", was fuer die _Verkettung_
stimmte und drei Migrationen spaeter fuer die _Berechtigung_ falsch wurde.

Gemessen, wie lange das schon so ist:

```sql
SELECT action_detail, count(*) FROM audit_log
 WHERE action_detail IN ('signature_chain_anchor','upload_rejected_infected',
       'upload_rejected_unstampable_pdf','controlled_copy_watermarked', …);
→ keine Zeile, bei 8.997 Audit-Eintraegen insgesamt
```

Fachliche Wirkung: dem Audit-Trail fehlen genau die Ereignisse, die nur diese
Wege schreiben — wer eine Signatur geleistet oder verweigert hat, wer eine
kontrollierte Kopie heruntergeladen hat und ob sie gewaessert war, ein als
infiziert oder als nicht-stempelbar abgewiesener Upload, eine DSGVO-Loeschung,
eine Massenaenderung an Prozessen. Und jeder dieser Wege liess die ganze
Anfrage mit 500 scheitern: die Signatur-Zeremonie war nicht durchfuehrbar.

_Behoben:_ neuer Helfer `apps/web/src/lib/audit-entry.ts` ruft
`write_audit_entry()` — die Funktion, die 0407 benennt und fuer die sie
`GRANT EXECUTE` vergibt. `SECURITY DEFINER`, derselbe BEFORE-INSERT-Trigger,
also identische Verkettung (`previous_hash`, `content_commitment`,
`entry_hash` weiterhin von `audit_log_chain_assign()`). Alle acht Stellen
umgestellt; zwei Unit-Tests, die den direkten Insert nachgestellt hatten,
pruefen jetzt den Inhalt des `write_audit_entry`-Aufrufs (Aktionsdetail,
Entscheidung, Ketten-Hash) — schaerfer als vorher, wo der Audit-Eintrag gar
nicht geprueft wurde.

### 3.2 Der Test behauptete eine Antwortform, die es nie gab

`expect(detailBody.request.status).toBe("completed")` — `GET
/signature-requests/:id` liefert die Anfrage **flach** in `data` (die
_Anlage_-Route liefert `{data:{request,signatures}}`, die Detail-Route nicht).
`detailBody.request` war `undefined`; die Zeile konnte nur einen TypeError
werfen. Ersetzt durch die ganze Zeremonie: Id, Status, zwei Signaturen, beide
`signed`, **zwei verschiedene** Unterzeichner in der definierten Reihenfolge,
und `signatures[1].previousChainHash === signatures[0].chainHash`.

### 3.3 Umgebung: `CLAMAV_OPTIONAL`

Der Upload antwortete **503** „Malware scanning is mandatory in this
environment but no scanner is configured". Das ist S04-06 und es ist richtig:
`isClamAvRequired()` ist unter `NODE_ENV=production` wahr, und der E2E-Server
ist ein Produktionsbau. Fuer eine Testumgebung ohne clamd ist
`CLAMAV_OPTIONAL=1` der dokumentierte Ausstieg — jetzt in `.env.example` und
`docs/env-vars-reference.md`, neben `RATE_LIMIT_DEFAULT` und
`RATE_LIMIT_AUTH`, mit dem Hinweis, dass ein clamd auf 3310 die bessere
Alternative ist. Der Limiter und die Scan-Pflicht bleiben unangetastet.

---

## 4. Skip 2: `i-08-cve-flow` — eine echte Seed-Luecke, und darunter ein Test, der nie etwas geprueft haette

`test.skip(!id, "no CVE matches available")`. Gemessen auf einer vollstaendig
geseedeten Datenbank:

```
cve_feed_item    0 Zeilen
asset_cpe        0 Zeilen
cve_asset_match  0 Zeilen
```

Kein Seed-File hat je in die Vulnerability-Intelligence-Tabellen geschrieben.
Die Listen-Route antwortete 200 mit leerem Array — eine **gueltige** Antwort,
weshalb der Lauf „skipped" meldete und nicht „failed".

Und darunter: die Zeile unter dem Skip schickte
`POST …/acknowledge {note:"E2E-108"}` gegen `expect([200,204])`. Die Route
exportiert **PUT** und nur PUT, ihr Schema ist `{status}` mit ausdruecklich
verbotenem `new`; `note` ist kein Feld, das sie kennt. Der Aufruf haette nur
405 erzeugen koennen. Der Skip hat also verhindert, dass ein dreifach
falscher Aufruf auffaellt.

_Behoben:_

- **Seed:** `packages/db/sql/seed_demo_15_cve.sql` — sechs echte, oeffentliche
  CVEs (Log4Shell, Text4Shell, libwebp, OpenSSL, curl, HTTP/2 Rapid Reset) als
  plattformweite Feed-Eintraege; die CPE-Inventur der neun technischen
  Demo-Assets als Kreuzprodukt (ids ueber `md5()` aus dem Paar abgeleitet,
  also auf jeder Datenbank gleich); daraus die Treffer. Drei benannte Paare
  tragen `acknowledged`, `mitigated`, `not_applicable`, damit Dashboard,
  Statusfilter und der „dieser Uebergang ist nicht mehr erlaubt"-Zweig etwas
  zu tun haben; der Rest ist `new`. **Gemessen nach dem Seeden:** 54 Treffer,
  davon 51 `new`, alle vier Zustaende vertreten.
  Warum ein _Vorrat_: die einzigen Uebergaenge aus `new` sind `acknowledged`
  und `not_applicable`, beide einwegig. Eine einzelne geseedete Zeile haette
  den Test einmal gruen gemacht und beim zweiten Lauf auf derselben Datenbank
  rot — genau die Sorte Blindgaenger, die diese Runde beseitigen soll. Ein
  erneutes `db:seed:demo` stellt die dokumentierten Zustaende wieder her
  (`ON CONFLICT … DO UPDATE`). Die Datei prueft sich am Ende selbst.
- **Test:** kein Skip mehr, und er prueft die Zustandsmaschine statt der
  Existenz einer Route: Liste nicht leer **und ihre Joins loesen auf**
  (`cveIdStr` matcht `CVE-\d{4}-\d{4,}`, `assetName` gesetzt — ein kaputter
  LEFT JOIN liefert sonst Zeilen mit null in jeder Spalte, die ein Mensch
  liest); `?status=new` liefert ausschliesslich `new`; `new → acknowledged`
  wird durchgefuehrt und die Wirkung **zurueckgelesen** (Status, `acknowledgedBy`
  = anfragender Nutzer, `acknowledgedAt`); derselbe Uebergang danach **422**;
  `status:"new"` **400**.

---

## 5. Was sonst noch behoben werden musste, um ueberhaupt messen zu koennen

- **Migration 0443 war nicht angewendet.** `POST /processes/:id/coverage`
  antwortete 500 auf `insert into process_framework_mapping (… "process_step_id" …)`;
  die Spalte existierte in der Datenbank nicht. `0443_process_framework_mapping_step.sql`
  kam mit `81200d89` und war auf dieser Instanz nie gelaufen — die Datenbank
  war einen Commit hinter dem Code. `npm run db:migrate-all` → **408/408**,
  `Pass 2: 0 recovered, 0 still failing`. Betraf `bpm-approval-pipeline` und
  `process-portal`; nach der Migration beide gruen.
- **Der Produktionsbau loescht `.next/standalone/apps/web/.env.local`.**
  Nach dem Neubau meldete Auth.js `MissingSecret` und `UntrustedHost`, und
  jede Anmeldung landete auf `/api/auth/error`. Die Datei muss nach dem Bau
  zusammen mit `.next/static` und `public` zurueckkopiert werden; das steht
  jetzt in Abschnitt 7.
- **Die Datenbank auf 5433 lief in der WSL-Distribution `Debian` und war
  gestoppt** (`pg_lsclusters` → offline). Zwei Vollaeufe scheiterten daran mit
  Anmeldefehlern, bevor der Grund klar war. `service postgresql start` in der
  Distribution genuegt.

---

## 6. Messungen

### 6.1 Vollauf

```
Ausgangslage (Runde 3):  199 Tests — 197 bestanden, 0 gescheitert, 2 uebersprungen
Lauf 8 (dieser Stand):   199 Tests — 199 bestanden, 0 gescheitert, 0 uebersprungen   4,5 min
```

Befehl und Umgebung stehen in Abschnitt 7. **Kein zuvor gruener Test ist rot;
beide Skips sind gruen und pruefen mehr als zuvor.**

### 6.2 Der Weg dorthin, ehrlich

Zwischen dem ersten gruenen Vollauf (Lauf 4) und dem Abnahme-Lauf 8 liegen
vier Laeufe, und sie haben drei Dinge zutage gefoerdert, die ein einzelner
Lauf nicht zeigt. Sie stehen hier, weil sie genau die Sorte Befund sind, die
man sonst als „flaky" abtut.

| Lauf | Ergebnis                 | Was er gezeigt hat                                                                                                            |
| ---- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 1, 2 | Setup rot                | Umgebung: der Bau hatte `.env.local` aus dem Standalone-Verzeichnis geloescht; danach war die WSL-Datenbank auf 5433 gestoppt |
| 3    | 197 / 2 / 0              | Migration `0443` war nicht angewendet — `POST /processes/:id/coverage` → 500                                                  |
| 4    | **199 / 0 / 0**, 5,1 min | erster vollstaendig gruener Lauf, beide Skips aufgeloest                                                                      |
| 5    | 198 / 1 / 0              | **Wiederholung ohne erneutes Seeden.** `isms-workflow` S2.5 rot — Spur zu einem Produktdefekt (6.2.1)                         |
| 6, 7 | 195 / 4 / 0, 196 / 3 / 0 | S2.5 (bis zur Korrektur) und drei `a11y-smoke` — zweiter Produktdefekt (6.2.2)                                                |
| 8    | **199 / 0 / 0**, 4,5 min | **Abnahme.** Achter Lauf auf demselben Datenbestand, ohne erneutes Seeden.                                                    |
| 9    | siehe unten              | Wiederholung von Lauf 8, unveraendert                                                                                         |

#### 6.2.1 Produktdefekt: `a.tier` — die IS-Risikoszenario-Detailseite

`GET /api/v1/isms/risk-scenarios/:id` selektiert `a.tier as asset_tier`. Die
Spalte auf `asset` heisst `asset_tier`; `tier` hat es nie gegeben. Postgres
weist das Statement beim Parsen ab, also antwortete der Endpunkt **fuer jedes
Szenario** mit 500, und die Detailseite zeigte „Risikoszenario nicht
gefunden." ueber einem Szenario, das existiert. Gegen die laufende Instanz
gemessen:

```
GET /api/v1/isms/risk-scenarios/d0000000-…-0431  →  500
psql: column a.tier does not exist
```

Warum das erst jetzt auffiel: `S2.5` klickte die erste Tabellenzeile und
suchte anschliessend die Woerter „Bedrohung" und „Behandlung". „Bedrohung" ist
auch eine **Spaltenueberschrift der Liste**. Ein Klick, der wegen fehlender
Hydration noch nicht navigiert hatte, konnte die erste Zusicherung also
erfuellen — und der Test war gruen, ohne die Detailseite je gesehen zu haben.

_Behoben:_ `a.tier` → `a.asset_tier`. Der Test wartet jetzt auf die
**Navigation** (`waitForURL` auf die Detail-URL) und schliesst den
„nicht gefunden"-Zustand ausdruecklich aus, bevor er die Beschriftungen prueft
— er kann seitdem nicht mehr von der Liste erfuellt werden.

#### 6.2.2 Produktdefekt: der Benachrichtigungs-Zaehler ist nicht barrierefrei

Ab Lauf 6 meldeten drei `a11y-smoke`-Specs `color-contrast`. Alle drei zeigen
auf **dasselbe** Element:

```
<span class="… rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">13</span>
Element has insufficient color contrast of 3.8
(foreground #ffffff, background #fb2c36, 7.5pt bold) — expected 4.5:1
```

Das ist der ungelesen-Zaehler an der Glocke
(`components/layout/notification-bell.tsx:86`). Er wird **nur gerendert, wenn
das angemeldete Konto ungelesene Benachrichtigungen hat** — und das E2E-Konto
hatte nie welche, bis `document-signature` anfing, Signaturanfragen
abzuschliessen: der Abschluss benachrichtigt den Ersteller. Der Defekt ist
aelter als diese Runde; er stand nur nie auf dem Bildschirm, waehrend axe
hinsah. Genau dafuer ist eine a11y-Smoke da.

_Behoben:_ `bg-red-500` (#fb2c36, 3,8:1) → `bg-red-700` (#c10007, **6,5:1**).
Die Zusicherung der drei Specs blieb unangetastet — „keine serious/critical
Verstoesse" steht unveraendert.

#### 6.2.3 Wiederholbarkeit

Lauf 8 ist der achte Lauf auf demselben Datenbestand, Lauf 9 der neunte —
jeder mit neuen Wegwerf-Organisationen fuer das Hauptkonto, einem weiteren
quittierten CVE-Treffer, weiteren Dokumenten, Signaturen und
Benachrichtigungen. **Kein erneutes Seeden dazwischen.**

```
Lauf 8:  199 bestanden, 0 gescheitert, 0 uebersprungen   4,5 min
Lauf 9:  199 bestanden, 0 gescheitert, 0 uebersprungen   4,6 min
```

Der Zustand der Datenbank danach, gemessen — das ist der eigentliche Beweis,
dass die Loesung im Seed und nicht in einem Handgriff steckt:

| Messung                                   | Wert nach neun Laeufen                             |
| ----------------------------------------- | -------------------------------------------------- |
| Mitgliedschaften von `admin@arctos.local` | **15** (1 geseedet + 14 von `f-02`/`f-15` erzeugt) |
| `roles[0].orgId` desselben Kontos         | **`ccc4cc1c…`** — unveraendert der Demo-Mandant    |
| CVE-Treffer gesamt / davon `new`          | 54 / **43** (11 quittiert, der Vorrat traegt)      |
| `audit_log` mit `signature_chain_anchor`  | **20** (vorher: 0 von 8.997)                       |
| `audit_log` mit `controlled_copy…`        | **8** (vorher: 0)                                  |

Die 15 Mitgliedschaften sind genau der Zustand, der den Zwiespalt erzeugt
hatte — und er erzeugt ihn nicht mehr, weil die geseedete Zeile per
`created_at`-Pin die aelteste bleibt. Der Mechanismus ist nicht behauptet,
sondern neun Laeufe lang gemessen.

### 6.3 Gruen geblieben

```
npx tsc --noEmit -p apps/web/tsconfig.json   -> keine Ausgabe, Exit 0
cd apps/web && npx vitest run                -> 104 Dateien, 2.496 Tests, alle bestanden
tsx packages/db/src/migrate-all.ts           -> 408/408 migrations applied
npm run build --workspace=@grc/web           -> Compiled successfully,
                                                Finished TypeScript in 4.8min
```

Zwei Anmerkungen zur Ehrlichkeit dieser Zahlen:

- Der `tsc`-Lauf faellt im **gemeinsamen** Arbeitsverzeichnis an, enthaelt
  also auch die Dateien der parallelen Arbeit. Waehrend dieser Runde meldete
  er zeitweise Fehler in `processes/[id]/diagram-overlay/route.ts` und
  `lib/grc-overlay.ts` — Dateien, die ich nicht anfassen darf und die dort
  gerade bearbeitet wurden. Der oben protokollierte Lauf ist der abschliessende
  und ist sauber.
- Der Produktionsbau auf der Testmaschine lief gegen einen Baum aus
  `81200d89` **plus ausschliesslich diesem Aenderungssatz**, mit
  `ignoreBuildErrors=false` (`next.config.ts:67`), durchlief seinen
  vollstaendigen TypeScript-Schritt und meldete `Compiled successfully`. Das
  ist der Gegenbeweis, der nur meine Aenderungen betrifft.

### 6.4 Ohne Neubau gemessen (Seed und Daten)

| Messung                                           | vorher                | nachher                      |
| ------------------------------------------------- | --------------------- | ---------------------------- |
| Mitgliedschaften `admin@arctos.local`             | **20**                | **1** (Demo-Mandant)         |
| `roles[0].orgId` des Hauptkontos                  | `6d2a7cf8` (0 Assets) | `ccc4cc1c` (Demo-Bestand)    |
| `cve_feed_item` / `asset_cpe` / `cve_asset_match` | 0 / 0 / 0             | 6 / 54 / **54** (51 × `new`) |
| `document-signature`                              | uebersprungen         | **gruen**                    |
| `i-08-cve-flow`                                   | uebersprungen         | **gruen**                    |

### 6.5 Nach dem Neubau gemessen

| Messung                                             | vorher                  | nachher                              |
| --------------------------------------------------- | ----------------------- | ------------------------------------ |
| `POST /signature-requests/:id/sign`                 | `500` (42501)           | **`201`**                            |
| Audit-Eintraege mit `signature_chain_anchor`        | 0 (bei 8.997 Zeilen)    | **geschrieben**                      |
| `GET /documents/:id/download` (kontrollierte Kopie) | Audit-Schreibfehler     | **`X-Controlled-Copy: watermarked`** |
| `POST /processes/:id/coverage`                      | `500` (fehlende Spalte) | **`201`** (nach 0443)                |
| `GET /isms/risk-scenarios/:id`                      | `500` (`a.tier`)        | **`200`**, Detailseite rendert       |
| Kontrast des Benachrichtigungs-Zaehlers             | 3,8:1 (axe, serious)    | **6,5:1**                            |

---

## 7. Wie der Lauf reproduziert wird

Aus dem Nichts, ohne Handgriffe an der laufenden Datenbank:

```bash
# 1. Migrationen
npm run db:migrate-all

# 2. Basis- und Demodaten
npm run db:seed
npm run db:seed:demo            # enthaelt jetzt seed_demo_15_cve.sql

# 3. Alle vier Testkonten (idempotent).
#    Ohne E2E_EMAIL entsteht e2e-admin@arctos.local;
#    mit E2E_EMAIL wird das genannte Konto in den Demo-Mandanten verschoben.
E2E_ROLE_PASSWORD='<12+ Zeichen>' npm run db:seed:e2e-users

# 4. Server — Produktionsbau, mit den drei Testumgebungs-Variablen
RATE_LIMIT_DEFAULT=3000/60 RATE_LIMIT_AUTH=1000/60 CLAMAV_OPTIONAL=1 \
PORT=3000 HOSTNAME=127.0.0.1 node apps/web/.next/standalone/apps/web/server.js

# 5. Suite
E2E_ROLE_PASSWORD='<derselbe Wert>' \
E2E_BASE_URL=http://127.0.0.1:3000 \
npx playwright test --reporter=line
```

`E2E_EMAIL`, `E2E_PASSWORD` und `E2E_ORG_ID` muessen nicht gesetzt werden.
Werden sie gesetzt, muss **derselbe** Wert beim Seed und beim Lauf stehen —
sonst meldet das Setup den Mandanten-Unterschied als benannten Fehlschlag.

Nach einem Neubau (`npm run build --workspace=@grc/web`) sind drei Dinge nach
`apps/web/.next/standalone/apps/web/` zurueckzukopieren: `.next/static`,
`public` **und `.env.local`** — der Bau raeumt das Standalone-Verzeichnis leer,
und ohne `.env.local` startet der Server ohne `AUTH_SECRET`.

---

## 8. Geaenderte Dateien

| Datei                                                       | Aenderung                                                                                                                                     |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/src/seed-e2e-users.ts`                         | viertes (primaeres) Konto, `E2E_EMAIL`/`E2E_PASSWORD`, `platform_admin` je Konto entschieden, `created_at`-Pin, Selbstpruefung auf `roles[0]` |
| `packages/db/sql/seed_demo_15_cve.sql`                      | **neu** — CVE-Feed, Asset-CPEs, 54 Treffer, Selbstpruefung                                                                                    |
| `packages/db/src/seed-demo.ts`                              | die neue Datei in die geordnete Liste aufgenommen                                                                                             |
| `apps/web/e2e/fixtures/storage.ts`                          | `PRIMARY_ACCOUNT` — eine Quelle fuer Adresse und Passwort des Hauptkontos                                                                     |
| `apps/web/e2e/auth.setup.ts`                                | Mandant wird geprueft statt repariert; gilt auch fuer die Rollenkonten                                                                        |
| `tests/e2e/fixtures/auth.ts`                                | Vorgabe `admin@arctos.dev` (nicht anmeldbar) durch das geseedete Hauptkonto ersetzt                                                           |
| `apps/web/e2e/document-signature.spec.ts`                   | Skip entfernt, zweiter Unterzeichner ist ein Rollenkonto, Detail-Vertrag korrigiert und verschaerft                                           |
| `tests/e2e/regression/i-08-cve-flow.spec.ts`                | Skip entfernt, PUT statt POST, Zustandsmaschine statt Existenzpruefung                                                                        |
| `apps/web/src/lib/audit-entry.ts`                           | **neu** — `write_audit_entry()`-Helfer                                                                                                        |
| 6 Dateien mit `tx.insert(auditLog)`                         | auf den Helfer umgestellt (`signature-provider`, `controlled-copy`, `upload`, `erase`, `verify-integrity`, `processes/bulk`)                  |
| 2 Unit-Test-Dateien                                         | pruefen jetzt den Inhalt des Audit-Aufrufs statt nur den Insert                                                                               |
| `apps/web/src/app/api/v1/isms/risk-scenarios/[id]/route.ts` | `a.tier` → `a.asset_tier` (6.2.1)                                                                                                             |
| `apps/web/e2e/isms-workflow.spec.ts`                        | S2.5 wartet auf die Navigation und schliesst den „nicht gefunden"-Zustand aus                                                                 |
| `apps/web/src/components/layout/notification-bell.tsx`      | `bg-red-500` → `bg-red-700` (6.2.2)                                                                                                           |
| `.env.example`, `docs/env-vars-reference.md`                | vier Konten, `E2E_EMAIL`/`E2E_PASSWORD`, `CLAMAV_OPTIONAL`, Server- vs. Testlaeufer-Variablen                                                 |

**Nicht angefasst:** `packages/db/drizzle/**`, `packages/db/src/schema/**`,
`apps/web/src/lib/grc-overlay.ts`,
`apps/web/src/app/api/v1/processes/[id]/diagram-overlay/**`.

---

## 9. Offen

- **Kein Bedarf an einer neuen Migration** aus dieser Runde. Gemeldet wird
  aber ein **Migrationsstand**: `0443` war auf der Testinstanz nicht
  angewendet. Wer die Umgebung neu aufsetzt, braucht `db:migrate-all` vor dem
  Seeden — steht in Abschnitt 7.
- **Sechs weitere direkte `audit_log`-Schreibwege sind jetzt korrekt, aber
  nur zwei davon deckt ein Test ab** (Signatur-Anker, nicht-stempelbarer
  Upload). Fuer die kontrollierte Kopie prueft `document-signature` heute den
  Header, nicht den Audit-Eintrag; `erase`, `verify-integrity` und
  `processes/bulk` haben gar keinen. Sie waren vorher tot und sind es nicht
  mehr — ein Test, der das festhaelt, fehlt.
- **`db:create-admin` setzt weiterhin keine Mandanten-Regel durch.** Es legt
  ein Konto in genau einer Organisation an, aber nichts hindert spaetere
  Mitgliedschaften. Fuer Betreiberkonten ist das richtig; fuer das Konto, mit
  dem jemand die Suite faehrt, ist `db:seed:e2e-users` der Weg.
- **Andere Stellen mit `bg-red-500` + kleinem weissem Text.** Behoben ist der
  Zaehler, auf den ein Test zeigt. Ob dieselbe Kombination anderswo steht, ist
  nicht systematisch geprueft; die a11y-Smoke deckt drei Seiten ab.
- **37 UI-Aufrufe mit `limit` > 100** — unveraendert offen aus Runde 3.
- **`0439` verweist auf einen nicht existierenden Test** — unveraendert offen.
- **`f-17-schema-drift`** meldet weiterhin vier fehlende Tabellen und der
  Drift-Endpunkt antwortet 503 — unveraendert offen aus Runde 2.
- **Nicht committet.** Wie beauftragt.
