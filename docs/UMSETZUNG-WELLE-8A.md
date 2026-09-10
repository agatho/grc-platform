# Welle 8a — die 36 ungemessenen Regressionstests, zu Ende gemessen

**Grundlage:** `docs/UMSETZUNG-WELLE-6C.md` (§8.3, §9) · `docs/UMSETZUNG-WELLE-7B.md`
(§8.1, Fallstricke) · `docs/OFFENE-PUNKTE-REGISTER.md` (Nachtrag 2026-09-08,
Welle 6c) · `playwright.config.ts`, Projekt `regression`
**Stand:** Branch `audit/full-2026-08-31`, aufsetzend auf `b9925761`
**Gebiet:** `tests/e2e/regression/**`, dieses Dokument — sowie, erzwungen durch
zwei gemessene Produktdefekte, `apps/web/src/app/(dashboard)/risks/[id]/page.tsx`
und `apps/web/src/app/(dashboard)/controls/[id]/page.tsx`

---

## 1. Ergebnis in einem Satz

Die 36 ungemessenen Tests sind gemessen — **62 von 62 Tests des
`regression`-Projekts sind grün**, keiner blieb ungemessen —, und die Runde, die
sie zum ersten Mal seit der i18n-Welle 6b tatsächlich **ausgeführt** hat, hat
**zwei Produktdefekte derselben Bauart** freigelegt: zwei Detailseiten holen
ihre Querverweise von einem Endpunkt, den es so nicht gibt, prüfen die Antwort
mit `if (res.ok)` **ohne `else`** — und melden dem Benutzer seit Monaten
„nichts verknüpft", wo die Datenbank eine Verknüpfung führt.

| Messgröße                                                      |                      vorher |       nachher |
| -------------------------------------------------------------- | --------------------------: | ------------: |
| `regression`-Projekt, gemessen                                 |               **26 von 62** | **62 von 62** |
| davon grün                                                     |                      **26** |        **62** |
| davon rot                                                      |                       **0** |         **0** |
| **ungemessen**                                                 | **36 (22 Spezifikationen)** |         **0** |
| `n-01-risk-form-validation`                                    |                     **rot** |      **grün** |
| Produktdefekte, vom Lauf gefunden                              |                           — |   **2 + 2\*** |
| Testdefekte, vom Lauf gefunden                                 |                           — |         **3** |
| Verknüpfte Kontrollen auf `/risks/[id]` (bei 1 `risk_control`) |               **0 gezeigt** | **1 gezeigt** |
| Verknüpfte Risiken auf `/controls/[id]` (bei 1 `risk_control`) |               **0 gezeigt** | **1 gezeigt** |

\* zwei weitere Produktbefunde sind **gemessen, aber nicht behoben** (§7); der
Grund steht dort.

---

## 2. Die Umgebung

Nach dem Rezept aus `UMSETZUNG-WELLE-6C.md` §3, unverändert übernommen:

- Datenbank `grc_e2e6c` (617 Tabellen, 429/429 Migrationen, Demo-Seed 56/56).
  Vorgefunden, nicht neu aufgesetzt; nachgemessen: `organization` 21,
  `soa_entry` 101, `cve_asset_match` 54 — also der Stand, den Welle 6c §4.4
  hergestellt hat.
- Beide Datenbankvariablen gesetzt (`DATABASE_URL` **und** `APP_DATABASE_URL`).
  Das ist keine Kür — mit nur einer bricht die Routenketten-Suite ab, und zwar
  absichtlich. Gemessen:

  ```
  $ DATABASE_URL=…/grc_e2e6c node src/__tests__/run-db-suites.mjs   # ohne APP_…
   ❯ src/__tests__/rls-route-chain/isms-findings-routes.test.ts (0 test)
   ❯ src/__tests__/rls-route-chain/list-endpoints-smoke.test.ts (0 test)
   ❯ src/__tests__/rls-route-chain/risks-route-rls.test.ts (0 test)
   ❯ src/__tests__/rls-route-chain/organizations-create-rls.test.ts (0 test)
  ⎯⎯ Failed Suites 4 ⎯⎯
  ```

- E2E-Konten neu bereitgestellt (`E2E_ROLE_PASSWORD=… npm run db:seed:e2e-users`),
  vier Konten, ein Mandant je Konto.
- Chromium aus `/opt/pw-browsers`; **kein** `playwright install`.
- Wurzelkonfiguration, Projekt `regression`, `workers: 1`, `timeout: 90_000`.
- Gefahren **in Abschnitten** mit hart neu gestartetem Entwicklungsserver
  dazwischen (§8).

---

## 3. Die ehrliche Zählung

`--list` als Grundgesamtheit, damit die Zahl nicht aus einem Lauf stammt, der
selbst schiefgehen kann:

```
$ npx playwright test --project=regression --list
Total: 66 tests in 48 files      ← 62 regression + 4 setup, 47 Spezifikationen + auth.setup.ts
```

| Gruppe                       | Dateien |  Tests |   grün |   rot | ungemessen | Abschnitt            |
| ---------------------------- | ------: | -----: | -----: | ----: | ---------: | -------------------- |
| `b-` (BCMS)                  |       6 |      6 |  **6** |     0 |          0 | `10 passed (1.7m)`   |
| `d-` + `f-`                  |       7 |      8 |  **8** |     0 |          0 | `12 passed (2.1m)`   |
| `i-01…i-05`                  |       5 |      6 |  **6** |     0 |          0 | `10 passed (1.7m)`   |
| `i-06…i-10`                  |       5 |      5 |  **5** |     0 |          0 | `9 passed (1.4m)`    |
| `n-` (Formulare, NIS2)       |       9 |     10 | **10** |     0 |          0 | §4, §5               |
| `p-` (Programme)             |       6 |      6 |  **6** |     0 |          0 | `10 passed (2.1m)`   |
| `r-` (Monitore, Assistenten) |       3 |     11 | **11** |     0 |          0 | §6                   |
| `x-` (Querschnitt)           |       6 |     10 | **10** |     0 |          0 | `9 passed (1.5m)` ×2 |
| **Summe**                    |  **47** | **62** | **62** | **0** |      **0** |                      |

**Was diese Zahl heisst und was nicht.** Sie heisst: jeder der 62 Tests ist
gegen den Endstand dieser Welle mindestens einmal grün **gemessen** worden. Sie
heisst **nicht**: „alle 62 in einem Durchlauf". Der Lauf ist in zwölf
Abschnitten entstanden, wie in Welle 6c und 7b, weil die Maschine einen
Durchlauf nicht trägt (§8). Vier Abschnittsausfälle sind dabei aufgetreten
(`n-06`, `n-07` und viermal `r-02`); alle vier waren maschinenbedingt und in der
isolierten Wiederholung grün — die Belege stehen in §8.2, nicht versteckt in
einer Fussnote.

Zum Vergleich mit Welle 6c: dort 26 gemessen / 36 ungemessen. Die 36 sind jetzt
gemessen, und **keiner von ihnen ist rot geblieben** — aber sechs von ihnen
waren beim ersten Anfassen rot, und was dahinter steckte, ist der eigentliche
Ertrag dieser Welle.

---

## 4. `n-01-risk-form-validation` — was er wirklich war

### 4.1 Der bekannte Fehlschlag, reproduziert

Erster Lauf dieser Welle, Endstand `b9925761`, unverändert:

```
✘  5 [regression] › n-01-risk-form-validation.spec.ts:25:5 › W19-N1: Risk-Create UI
     form — required validation + happy path + persistence (58.4s)

  Error: expect(received).toContain(expected)
  Expected substring: "E2E-N1-3083303"
  Received string:    "A / E / Meridian Holdings GmbH (Demo Tenant) / 12 / EA /
                       © 2026 ARCTOS — …"
```

Welle 7a hatte recht: kein Rückschritt. Aber die Begründung „kein Rückschritt"
war nie die Diagnose.

### 4.2 Erstens: ein Testdefekt, und zwar ein bekannter

Der Schritt 5 lautete:

```ts
await page.goto(`/risks/${riskId}`);
await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
const pageText = await page.locator("body").innerText();
expect(pageText).toContain(title);
```

`waitForLoadState("networkidle")` kehrt **sofort** zurück, wenn im Moment des
Aufrufs kein Abruf läuft — und direkt nach `goto()` ist genau das der Regelfall,
weil die Seite ihre Daten erst nach der Hydrierung holt. Danach liest
`innerText()` **einmal**, und `expect(zeichenkette)` wiederholt nichts.

Der Beleg steht in der empfangenen Zeichenkette selbst. Beim Fehlschlag las der
Test:

```
"A / U / Organisation / U / © 2026 ARCTOS — …"
```

„Organisation" und das Kürzel „U" sind der Zustand **vor** dem Laden der
Sitzung — nicht ein Ladekreis, sondern die Hülle im ersten Frame. Dieselbe
Bauart wie der Testdefekt in `navigation.spec.ts` (Welle 6c §8.2:
`await links.count()` liest einmal). Dieselbe Behebung: die Erwartung bleibt
Wort für Wort stehen, **nur das Lesen wiederholt jetzt**
(`await expect(page.locator("body")).toContainText(title, …)`).

Dieselbe Zeile stand in **sieben** Spezifikationen (`n-01` bis `n-07`); sie ist
in allen sieben ersetzt. Dass sie eine Zeitbombe war und keine Konstante, ist
gemessen: `n-02`, `n-06` und `n-07` fielen im Abschnittslauf und liefen isoliert
grün, `n-01` und `n-05` fielen auch isoliert. Derselbe Defekt, andere Uhr.

### 4.3 Zweitens — und das ist der Ertrag: ein Produktdefekt auf derselben Seite

Beim Nachmessen der Seite mit einer Sonde, die **jede abgelehnte
Schnittstellenantwort** mitschreibt, stand im Protokoll:

```
422 GET /api/v1/controls?riskId=0bfca33b-…&limit=50
    {"title":"Validation failed","status":422,
     "fieldErrors":{"riskId":["is not a recognized query parameter"]}}
```

`GET /api/v1/controls` führt seit `#WAVE6-CROSS-01` eine **strikte
Erlaubnisliste** (`paginate({ allowedParams: [...] })`) und lehnt jeden
unbekannten Parameter mit 422 ab — bewusst, mit Begründung im Quelltext. Die
Risiko-Detailseite ruft ihn trotzdem mit `riskId` auf:

```ts
fetch(`/api/v1/controls?riskId=${riskId}&limit=50`).catch(() => null),
…
if (clRes?.ok) { … setControlLinks(controls); }        // ← nie wahr
```

**Es gibt kein `else`.** Die Karte „Verknüpfte Kontrollen" meldete deshalb
**immer** „Keine Kontrollen verknüpft", auch mit einer Zeile in `risk_control`,
und niemand — Benutzer wie Entwickler — bekam einen Hinweis. Der richtige
Endpunkt existiert seit derselben Welle: `GET /api/v1/risks/:id/controls`
(`#WAVE6-CROSS-02`). Nur die Aufrufstelle blieb stehen.

**Die Behebung** ist eine Zeile: der richtige Endpunkt, und das
`.catch(() => null)` fällt weg, damit ein Netzwerkfehler in das `try` darum
gerät statt in eine stille leere Liste.

### 4.4 Der Nachweis, in beide Richtungen

Der Test bekommt einen Schritt 6, der eine Kontrolle anlegt, sie über
`POST /api/v1/controls/:id/risk-links` an das Risiko hängt und sie im Reiter
„Verknüpfungen" **wiederfindet** — plus die Zusicherung, dass die Seite
überhaupt keinen abgelehnten Aufruf absetzt.

Gegen den **behobenen** Stand:

```
✓  5 [regression] › n-01-risk-form-validation.spec.ts:25:5 › W19-N1: … (35.0s)
   5 passed (1.2m)
```

Gegen den **alten** Stand (`git show HEAD:… > kopie`, kein `git stash` — siehe
§8.3), sonst identisch:

```
✘  5 [regression] › n-01-risk-form-validation.spec.ts:25:5 › W19-N1: … (58.6s)

  Error: expect(locator).toBeVisible() failed
  Locator: getByRole('link', { name: /E2E-N1-0877786-KTRL/ })
  Error: element(s) not found
```

**Die neue Zusicherung fällt gegen den alten Stand.** Ohne sie hätte die
Behebung keinen Wächter.

---

## 5. Produktdefekt 2 — dieselbe Bauart, die Gegenrichtung

Die Sonde aus §4.3 wurde anschliessend über **alle** Seiten gefahren, die die
`n-`- und `r-`-Tests anfassen (zehn Listen- und Monitorseiten, sieben
Detailseiten). Ergebnis:

```
/grc-composite … /isms/cap-monitor … /risks … /controls        >=400: keine
/risks/<id>                                                     >=400: keine   (nach der Behebung aus §4)
/controls/<id>            >=400: 404 GET /api/v1/controls/<uuid>/rcm
/controls/findings/<id>   >=400: 404 GET /api/v1/findings/<uuid>/status-history
/dpms/dpia/<id>, /audit/executions/<id>, /tprm/vendors/<id>     >=400: keine
```

### 5.1 `/controls/[id]` ruft einen Endpunkt, den es nie gab

```ts
fetch(`/api/v1/controls/${controlId}/rcm`),
…
if (rcmRes.ok) { setLinkedRisks(json.data ?? []); }     // ← nie wahr
```

`apps/web/src/app/api/v1/controls/[id]/` hat kein `rcm/`-Segment — die Liste der
Segmente lautet `audit-impact, ces, comments, documents, evidence, findings,
history, risk-links, risks, route.ts, status, tests, transitions`. Der Server
antwortet mit einer HTML-404. Folge: der Reiter **„RKM"** der
Kontroll-Detailseite meldet auch bei vorhandener `risk_control`-Zeile
„Keine Risiko-Kontroll-Zuordnungen gefunden".

Das ist die **Gegenrichtung** von §4.3 — und der richtige Endpunkt trägt
denselben Vermerk: `GET /api/v1/controls/:id/risks`, `#WAVE6-CROSS-02`,
„Reverse direction of /risks/{id}/controls". Beide Endpunkte wurden angelegt,
**keine** der beiden Aufrufstellen wurde umgestellt.

**Die Behebung** ist wieder eine Zeile. Die gelieferten Felder (`id`, `title`,
`riskCategory`, `riskScoreResidual`) sind genau die, die `LinkedRisk` erwartet.

### 5.2 Der Nachweis, in beide Richtungen

`n-02-control-form-validation` bekommt den spiegelbildlichen Schritt 6. Gegen
den **behobenen** Stand:

```
✓  5 [regression] › n-02-control-form-validation.spec.ts:7:5 › W22-C1-02: … (47.2s)
   5 passed (1.7m)
```

Gegen den **alten** Stand:

```
✘  5 [regression] › n-02-control-form-validation.spec.ts:7:5 › W22-C1-02: … (1.5m)

  Error: expect(locator).toBeVisible() failed
  Locator: getByRole('link', { name: /E2E-N2-9303771-RSK/ })
  Error: element(s) not found
```

### 5.3 Warum es niemand sah — das siebzehnte und achtzehnte stumme Tor

Beide Defekte haben dieselbe Signatur:

```ts
const [ …, xRes ] = await Promise.all([ … ]);
if (xRes.ok) { setState(json.data ?? []); }
// kein else, kein Fehlerzustand, keine Meldung
```

Ein `if (res.ok)` ohne `else` ist ein Tor, das **nur im Erfolgsfall auslöst**.
Schlägt der Aufruf fehl, bleibt der Zustand auf seinem Anfangswert — und der
Anfangswert ist die leere Liste, also genau die Aussage „es gibt nichts".
Fehlschlag und Leere sind im Ergebnis nicht unterscheidbar, für niemanden.
Dieselbe Klasse hat Welle 6a schon einmal getroffen (OP-050,
`process-controls-tab.tsx`: „der Auswahldialog öffnete sich **immer leer**"),
und dort steht sie seither als Warnung im Quelltext. Sie war damit nicht
erledigt, sondern nur an einer Stelle.

**Das sind das siebzehnte und achtzehnte stumme Tor dieses Audits** — die ersten
beiden, die nicht in einer Prüfung sitzen, sondern **im Produkt selbst**.

Der neue Wächter dagegen ist in beiden Tests dieselbe Zeile, und sie ist
absichtlich allgemein gehalten:

```ts
expect(
  rejectedCalls,
  "… hat abgelehnte Schnittstellenaufrufe abgesetzt",
).toEqual([]);
```

Nicht „die Seite liefert 200" (das wäre das neunzehnte stumme Tor), sondern:
**keine der Anfragen, die diese Seite von sich aus stellt, wird vom Server
abgelehnt.** Genau das hätte beide Defekte am Tag ihrer Entstehung gemeldet.

---

## 6. Testdefekt 2 und 3 — vier Prüfungen, die seit Welle 6b unerfüllbar waren

`r-02-new-monitor-pages` (2 von 8) und `r-03-compliance-wizards` (2 von 2)
scheiterten reproduzierbar, auch isoliert:

```
Locator: getByText('Overall Compliance Score').first()   Error: element(s) not found
Locator: getByText('Incidents Monitor').first()          Error: element(s) not found
Locator: getByText('AI-Act Compliance Wizard')           Error: element(s) not found
Locator: getByText('GPAI Compliance Wizard')             Error: element(s) not found
```

Die Momentaufnahme des Fehlschlags zeigt, dass die Seiten **vollständig
rendern**:

```yaml
- main:
    - heading "Vorfall-Überwachung" [level=1]
    - paragraph: Fristenüberwachung nach Art. 73 für alle KI-Vorfälle. …
    - paragraph: Kritisch überfällig
    - link "Diskriminierung bei KI-gestützter Bewerberauswahl … 234 Tg. 11 Std. überfällig"
```

Welle 6b hat den AI-Act-Bereich übersetzt (OP-070). Seither heissen die
Überschriften `aiAct.monitor.title` = „Vorfall-Überwachung",
`aiAct.annualReport.overallScore` = „Gesamtbewertung der Konformität",
`aiAct.systemWizard.title` = „KI-Verordnung: Konformitätsassistent",
`aiAct.gpaiWizard.title` = „GPAI-Konformitätsassistent". Die englischen
Zeichenketten in den Prüfungen sind seit dem Tag der Übersetzung
**unerfüllbar** — und sind nie rot geworden, weil dieses Projekt seit Welle 6c
**ungemessen** war. Das ist die praktische Kehrseite von „ungemessen ist nicht
grün": eine Welle konnte eine Prüfung brechen, ohne dass irgendwo etwas auffiel.

Betroffen waren nicht nur die Überschriften, sondern auch die Bedienung:
`getByRole("button", { name: /^Pruefen$/ })` (die Schaltfläche heisst „Prüfen"),
`/Pass|Fail|Warnung/` (die Ergebnisse heissen „Bestanden", „Nicht bestanden",
„Warnung") und `/SYSTEMIC|HIGH-CAPABILITY|STANDARD/` (die Stufen heissen
„SYSTEMISCH", „HOHE LEISTUNGSFÄHIGKEIT", „STANDARD"). **Keine** Zusicherung
wurde dabei aufgeweicht — jede englische Zeichenkette ist durch die deutsche aus
`apps/web/messages/de.json` ersetzt, Wort für Wort, mit Quellenangabe im
Kommentar. Danach:

```
r-02:  12 passed (2.2m)      ← 8 Seiten, alle acht grün
r-03:   6 passed (1.4m)      ← beide Assistenten, samt Klick und Antwortprüfung
```

Bemerkenswert und hier festgehalten: **sechs** der acht `r-02`-Seiten bestehen
mit ihrer englischen Erwartung weiter (`/grc-composite`, `/grc-findings`,
`/grc-risk-sync`, `/dpms/deadline-monitor`, `/bcms/readiness-monitor`,
`/isms/cap-monitor`). Diese Prüfung ist damit ungewollt auch ein Sprachtest: sie
sagt aus, welche Seiten noch **nicht** übersetzt sind. Das gehört fachlich zu
OP-070/OP-202 und ist dort nicht gelistet.

---

## 7. Zwei Produktbefunde, die NICHT behoben sind

Beide sind gemessen. Beide bleiben liegen, und der Grund gehört dazu.

### 7.1 `/controls/findings/[id]` ruft einen Endpunkt, den es nicht gibt

```
404 GET /api/v1/findings/<uuid>/status-history
```

`apps/web/src/app/api/v1/findings/[id]/` enthält `route.ts`, `status`,
`sync-treatment`, `transitions` — kein `status-history`. Es gibt auch **keine
Tabelle** dafür (`information_schema`: nur `translation_status` und
`v_ai_documentation_status`). Die Detailseite füllt `statusHistory` aus dieser
Antwort und zeigt den Abschnitt entsprechend leer.

**Warum nicht behoben:** Anders als in §4 und §5 gibt es hier keinen richtigen
Endpunkt, auf den man den Aufruf umbiegen könnte. Ein Statusverlauf für
Feststellungen müsste erst gebaut werden (Tabelle, Schreibpfad beim
Statuswechsel, Endpunkt) — das ist ein Merkmal, kein Defekt an einer
Aufrufstelle, und es überschreitet „nur den Defekt beheben". Der Aufruf
ersatzlos zu streichen wäre die andere Möglichkeit; sie nähme dem Benutzer
sichtbar nichts, verdeckte aber die offene Lücke. Deshalb: benannt, nicht
angefasst.

### 7.2 Jede Modulseite zeigt kurz „Modul abgeschaltet" — mit dem rohen Schlüssel

`ModuleConfigProvider` bekommt seine `orgId` aus `useSession()`
(`app/(dashboard)/layout.tsx:24`). Solange die Sitzung lädt, ist sie `null`, und
der Anbieter tut dann:

```ts
if (!orgId) {
  setConfigs([]);
  setLoading(false);
  return;
}
```

`loading: false` bei leerer Liste heisst für jeden `ModuleGate`
`status: "disabled"` — also **`ModuleTeaser`**. Und `ModuleTeaser` zeigt, wenn
keine Definition da ist, `definition?.displayNameDe ?? moduleKey`, also den
rohen Schlüssel. Im Wiederholungsprotokoll einer `expect`-Zusicherung steht das
wörtlich:

```
4 × unexpected value "AUOrganisationU© 2026 ARCTOS — …"
2 × unexpected value "AUOrganisationUerm© 2026 ARCTOS — …"      ← „erm" = die Teaser-Überschrift
1 × unexpected value "AEOrganisation12EA© 2026 ARCTOS — …"
```

Dazu die Konsolenwarnung, die den Betreiber in die falsche Richtung schickt:

```
[useModuleConfig] No module_definition row found for moduleKey="erm".
Defaulting to status="disabled". Add a row via migration or seed_platform_baseline.sql.
```

Die Zeile **existiert**; die Warnung entsteht nur, weil „noch nicht geladen" und
„geladen und leer" im Anbieter nicht unterschieden werden.

**Warum nicht behoben:** die naheliegende Behebung — bei `orgId === null` in
`loading` bleiben — ändert das Tor **vor jeder Modulseite der Anwendung**, und
sie hat eine Kehrseite: ein angemeldetes Konto ganz ohne Mitgliedschaft sähe
dann einen Dauerladekreis statt eines Teasers. Das ist eine
Verhaltensänderung mit eigener Reichweite und braucht eine eigene fallende
Prüfung; ein Aufblitzen lässt sich in einem E2E-Test nicht verlässlich
zusichern. Nach dem Vorbild von Welle 7b §7 daher: gemessen, benannt, nicht
angefasst.

---

## 8. Die Maschine — was diese Runde gekostet hat

Kein Produktbefund. Aber ohne diesen Abschnitt kann die nächste Runde die
Zählung in §3 nicht nachvollziehen.

### 8.1 Der Befund, erneut bestätigt

`next-server` wächst mit jeder übersetzten Route. Gemessen in dieser Welle:

| Zustand (eigene Messung, `ps -o rss`)       |     RSS |
| ------------------------------------------- | ------: |
| nach ~10 übersetzten Routen                 | 3283 MB |
| nach einem Abschnitt mit 4 Spezifikationen  | 3271 MB |
| nach einem Abschnitt mit 10 Spezifikationen | 4942 MB |

Bei 8 GB Gesamtspeicher bleiben dann ~1,1 GB für Chromium, Playwright und
Postgres, und die Maschine geht in Speicherrückgewinnung. `vmstat` in diesem
Zustand:

```
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa
30  0      0 1210624   7768 431064    0    0 255772   0 1250 2358  0 100  0  0
```

**100 % Systemzeit, 0 % Benutzerzeit, 250 000 Blöcke Seiteneinlagerung je
Sekunde** — bei `load average 30,65`. In diesem Zustand brauchte eine einfache
Abfrage 5,4 Minuten:

```
GET /api/v1/risks/<uuid>/asset-links?limit=50   200 in 5.4min
```

Ein Abschnitt mit zehn Spezifikationen lief so 34,6 Minuten und verlor zwei
Tests; dieselben zwei Tests brauchten im nächsten Abschnitt mit zwei
Spezifikationen zusammen 2,2 Minuten und waren grün.

### 8.2 Was hilft — und die vier Abschnittsausfälle, offen ausgewiesen

**Kleine Abschnitte (2–4 Spezifikationen) mit hartem Neustart des Servers
dazwischen, `.next` behalten.** `.next` zu behalten ist wichtig: die
Übersetzungszeit einer schweren Route (`/risks/[id]`) passt sonst nicht in das
90-Sekunden-Testlimit. `.next` zu löschen ist nur nach einem Abbruch nötig
(§8.4).

Die vier Ausfälle dieser Welle, jeder mit seiner Wiederholung:

| Test                               | Abschnitt                   | isoliert                |
| ---------------------------------- | --------------------------- | ----------------------- |
| `n-06-vendor-form-validation`      | rot (1.8m, Abschnitt 34.6m) | **grün (25.3s)**        |
| `n-07-contract-form-validation`    | rot (26.8m)                 | **grün (59.2s)**        |
| `r-02` DPMS / BCMS / ISMS / AI-Act | 4 rot (45–54s je Test)      | **8 von 8 grün (2.2m)** |

Zusätzlich fiel ein später Bestätigungslauf von `n-01` + `n-02` zusammen in
denselben Zustand (`2 failed`, 17,8 min für zwei Tests) — beide Tests sind
einzeln mit dem Endstand grün gemessen (§4.4, §5.2). Das ist hier notiert und
nicht weggelassen: **ein Abschnittsausfall unter Last ist kein Befund, aber er
gehört ins Protokoll**, sonst ist „62 von 62 grün" eine Behauptung statt einer
Messung.

### 8.3 Die Fallstricke aus 6c/7b — beide erneut erlebt

**`git stash` bei laufendem Playwright** (Welle 7a): nicht wiederholt. Für die
Gegenproben in §4.4 und §5.2 wurde durchgehend
`git show HEAD:<pfad> > <pfad>` benutzt und die neue Fassung vorher
weggesichert. Das ist atomar genug und lässt keine Datei der Länge 0 zurück.

**`pkill -f <muster>` aus einer Shell, deren Kommandozeile das Muster
enthält** (Welle 7b §8.1): **erneut passiert, zweimal, Rückgabe 144.** Und mit
einer Verschärfung, die dort noch nicht steht: es genügt nicht, den `pkill`-Ruf
in eine Skriptdatei zu verlegen — wenn die Kommandozeile das Skript im selben
Aufruf **schreibt** (`cat > kill.sh <<'EOF' … pkill -f 'sonde' … EOF`), steht
das Muster im Heredoc und damit in der Kommandozeile der Shell. Die Shell bringt
sich beim Schreiben ihres eigenen Aufräumskripts um. Regel für die nächste
Runde: **Skript schreiben und Skript ausführen sind zwei getrennte Aufrufe.**

### 8.4 Ein neuer Fallstrick: `kill -9` auf `next-server` verdirbt `.next`

Welle 6c §9 warnt davor, `.next/dev` bei **laufendem** Server zu löschen. Die
Umkehrung ist genauso teuer und stand noch nirgends: **ein `kill -9`, das den
Server mitten im Schreiben des Zwischenspeichers trifft**, hinterlässt ein
`.next`, mit dem der nächste Server ganze Routenbäume mit 404 beantwortet.
Gemessen:

```
 GET /api/auth/session   404 in 177ms
 GET /api/auth/providers 404 in 346ms
 GET /api/auth/error     404 in 227ms
```

Folge: alle vier Anmeldungen des `setup`-Projekts rot mit
`Received string: "http://localhost:3000/api/auth/error"` — was wie ein
kaputtes Anmeldeverfahren aussieht und keines ist. Nach `rm -rf .next` und
Neustart lief derselbe Abschnitt `6 passed (2.2m)`.

Das Aufräumskript schickt deshalb zuerst `SIGTERM` und wartet bis zu 20
Sekunden, bevor es `SIGKILL` nimmt.

---

## 9. Was geändert wurde

| Datei                                                 | Art     | Was                                                                                                       |
| ----------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/(dashboard)/risks/[id]/page.tsx`    | Produkt | `?riskId=` (422) → `GET /api/v1/risks/:id/controls`; `.catch(() => null)` entfernt                        |
| `apps/web/src/app/(dashboard)/controls/[id]/page.tsx` | Produkt | `/rcm` (404) → `GET /api/v1/controls/:id/risks`                                                           |
| `tests/e2e/regression/n-01-…spec.ts`                  | Test    | einmaliges Lesen → wiederholende Zusicherung; **neu** Schritt 4b/6: Kontrolle verknüpfen und wiederfinden |
| `tests/e2e/regression/n-02-…spec.ts`                  | Test    | dito; **neu** Schritt 4b/6: Risiko verknüpfen und im Reiter „RKM" wiederfinden                            |
| `tests/e2e/regression/n-03…n-07-…spec.ts`             | Test    | einmaliges Lesen → wiederholende Zusicherung (fünf Dateien)                                               |
| `tests/e2e/regression/r-02-…spec.ts`                  | Test    | zwei englische Erwartungen → die übersetzten Überschriften                                                |
| `tests/e2e/regression/r-03-…spec.ts`                  | Test    | vier englische Erwartungen und zwei Schaltflächennamen → die übersetzten                                  |

Kein `test.skip`, kein aufgeweichter Selektor. Die beiden erhöhten Zeitlimits
(`toContainText(…, { timeout: 60_000 })`) ersetzen **keine** Behebung: sie
ersetzen ein Lesen, das gar nicht wiederholte, und sie stehen an einer Stelle,
an der der Entwicklungsserver die Route erst übersetzt (§8.1). Die Zusicherung
dahinter ist unverändert.

---

## 10. Abnahme

| Tor                                  | Ergebnis                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| Playwright, Projekt `regression`     | **62 von 62 gemessen, 62 grün, 0 rot, 0 ungemessen** (§3, zwölf Abschnitte)   |
| `npx tsc --noEmit -p apps/web`       | **exit 0**, keine Ausgabe                                                     |
| `npm test` in `apps/web`             | **133 Dateien / 2957 Tests grün**, dazu **4 Dateien / 24 Tests** Routenketten |
| `npx prettier --check .`             | **All matched files use Prettier code style!**                                |
| `node scripts/lint-ratchet.mjs`      | **45 Befunde (Baseline 45), apps/web 0 (Baseline 0)** — keine Regression      |
| `node scripts/check-gate-inputs.mjs` | **9 Tor-Eingaben vorhanden, verfolgt, nicht ignoriert**                       |
| `node scripts/audit-secrets.mjs`     | **4445 Dateien, 0 Funde**                                                     |

`docs/security/secret-scan-report.md` ist die **Ausgabe** von
`audit-secrets.mjs` und hat sich beim Ausführen des Tors mitgeändert
(Zeitstempel, 4437 → 4445 Dateien).

---

## 11. Was offen bleibt

1. **`GET /api/v1/findings/:id/status-history` gibt es nicht** (§7.1). Der
   Statusverlauf von Feststellungen ist unimplementiert — keine Tabelle, kein
   Endpunkt —, und die Detailseite fragt ihn trotzdem ab.
2. **Der Teaser-Blitz mit dem rohen Modulschlüssel** (§7.2). Betrifft jede
   Modulseite; die Behebung braucht eine eigene Welle mit eigener fallender
   Prüfung.
3. **Sechs der acht `r-02`-Seiten sind nicht übersetzt** (§6). Gehört zu
   OP-070/OP-202 und ist dort nicht gelistet.
4. **OP-036 und OP-167 bleiben unverändert offen.** Diese Welle hat nichts
   gemessen, was daran etwas ändert: `next dev` prerendert nicht und ist keine
   Messumgebung (Welle 6c §2.4, §6).
5. **Ein Durchlauf des ganzen Projekts in einem Stück ist auf dieser Maschine
   weiterhin nicht möglich** (§8). Die Zählung in §3 ist eine Summe über
   Abschnitte, und das bleibt sie, bis der Entwicklungsserver nicht mehr 5 GB
   belegt oder die Maschine mehr Speicher hat.
6. **Das `web`-Projekt ist in dieser Welle nicht gemessen worden.** Welle 7b hat
   es zuletzt mit 135/135 gemessen. Nachgesehen: **keine** Spezifikation unter
   `apps/web/e2e/**` ruft `/risks/<id>` oder `/controls/<id>` auf — die
   Treffer sind `/risks`, `/risks/new`, `/risks/kris`, `/controls`,
   `/controls/new`, `/controls/heatmap`. Die beiden geänderten Zeilen liegen
   damit ausserhalb dessen, was das `web`-Projekt anfasst, und die Wächter
   dafür stehen in `n-01`/`n-02`. Trotzdem gilt: für dieses Projekt liegt in
   dieser Welle **keine eigene Messung** vor, und das als „unberührt" zu buchen
   wäre eine Erfindung.
