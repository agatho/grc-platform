# Welle 4b, Strang 3 — OP-077, OP-076, OP-152 (Restbestand)

**Grundlage:** `docs/UMSETZUNGSPLAN-OFFENE-PUNKTE.md` §6 · **Punkte:** OP-077, OP-076, OP-152
**Stand:** Branch `audit/full-2026-08-31`, aufsetzend auf `08a4ae4f`
**Gebiet:** `apps/web/src/app/api/v1/**` (1.375 Dateien) und die zugehörigen
Ausnahmen in `apps/web/eslint.config.mjs`

---

## 1. Was hier stand, und was daran neu ist

Drei Punkte, ein Gebiet. `apps/web/eslint.config.mjs` hatte für
`src/app/api/v1/**` ein eigenes Konfigurationsobjekt, das zwei Regeln
abschaltete, und die `no-console`-Regel aus Welle 4b-2 ließ dieses
Verzeichnis aus. Alle drei Ausnahmen waren als **Übergabe** begründet, nicht
in der Sache: WP12 hatte die Dateihoheit nicht.

Gemessen zu Beginn (2026-09-03, `eslint --rule` mit demselben Regelsatz, der
für den Rest des Workspaces gilt):

| Regel                                | Register | gemessen |
| ------------------------------------ | -------: | -------: |
| `@typescript-eslint/no-unused-vars`  |      483 |  **500** |
| `@typescript-eslint/no-explicit-any` |      129 |  **128** |
| `no-console`                         |       56 |   **53** |

Die Registerzahlen stammen aus WP12 und sind seither gewandert; gerechnet
wird ab hier mit den gemessenen.

Neu ist vor allem eines: **die 500 toten Bindungen waren nicht 500-mal
dieselbe Sache.** 474 waren tote Importe und unbenutzte Parameter — der Fall,
für den der Codemod gedacht war. Die restlichen 26 waren unbenutzte
_Variablen_ und _Destrukturierungen_, und in acht Fällen war die tote Bindung
der einzige Hinweis darauf, dass eine im Code ausgeschriebene Absicht nie
wirksam geworden ist. Dieselbe Beobachtung noch einmal bei OP-076: eine
`as any[]`-Zusicherung hat vier CSV-Spalten eines DSGVO-Meldepakets seit jeher
leer gelassen, ohne dass irgendetwas fehlschlug.

---

## 2. OP-152 — die 53 letzten `console.*`-Aufrufe

Umgestellt auf `@/lib/logger` nach der Merkregel aus Welle 4b-2: **die
Nachricht ist konstant, die Werte sind Felder.** 41 Dateien, jeder
interpolierte Wert wurde zu einem Feld:

```ts
// vorher
console.error(
  `[documents/upload] ClamAV scan failed (fail-closed): ${scan.error}`,
);
// nachher
log.error("[documents/upload] ClamAV scan failed (fail-closed)", {
  scanError: scan.error,
});
```

Nur was in einem FELD steht, geht durch das Scrubbing; ein in die Nachricht
interpolierter Wert wird lediglich gekürzt. Zwei Kommentare, die noch auf
`console.error` verwiesen, sind mitgezogen.

**Eine Namenskollision musste vorher weg.** `reports/generate/route.ts` band
die eingefügte Protokollzeile der Datenbank an `const [log]` und hätte den
importierten Logger verdeckt. Die Bindung heißt jetzt `generationLog` — die
ehrlichere Benennung, denn sie ist ein `report_generation_log`-Datensatz und
kein Logger.

Danach ist `src/app/api/v1/**/*.{ts,tsx}` in den `files`-Bereich der
`no-console`-Regel aufgenommen. Die Regel steht dort **ohne Optionen**: es
gibt in dieser Konfiguration keinen früheren Block mit einer `allow`-Liste,
die vererbt werden könnte — das ist die Lehre aus Welle 4b-2 und wird vom
Tor-Test eigens geprüft.

---

## 3. OP-077 — 500 → 0, und acht Defekte darunter

### 3.1 Der mechanische Teil (474)

Ein AST-Codemod über die ESLint-Meldungen, nicht über Textmuster:

| Form                            | Zahl | Behandlung                                                        |
| ------------------------------- | ---- | ----------------------------------------------------------------- |
| unbenutzter Import-Spezifikator | 416  | entfernt; 35 Importanweisungen entfielen ganz                     |
| unbenutzter Parameter           | 58   | `_`-Präfix — die Signatur eines Route-Handlers gibt das Framework |
| Variablen / Destrukturierungen  | 26   | **von Hand**, siehe §3.2                                          |

Der Codemod baut die `import`-Anweisung aus den verbleibenden
Spezifikatoren neu auf (inklusive `type`-Modifikatoren und `as`-Aliassen),
statt Textbereiche zu schneiden; Prettier formatiert danach. Ein zweiter
Durchlauf war nötig, weil die Handarbeit aus §3.2 sechs weitere Importe
verwaist zurückließ.

**Ein Muster fiel dabei auf, das keine Lint-Regel sieht.** 16 Routen unter
`data-sovereignty/**` und `role-dashboards/**` importierten
`requireModule` und riefen es nie auf. Das sieht wie eine fehlende
Berechtigungsprüfung aus — ist aber keine: Für beide Bereiche gibt es gar
keinen Modulschlüssel (`MODULE_KEYS` in `packages/shared/src/modules.ts`
kennt 21, weder `data-sovereignty` noch `role-dashboards`). Der Import war
Kopiervorlage. Er ist entfernt, denn ein importierter Wächter, der nie
aufgerufen wird, liest sich für jeden Prüfer wie ein vorhandener.

### 3.2 Die 26, die keine toten Importe waren

Von Hand angesehen, weil eine unbenutzte Zuweisung ein Defekt sein kann.
Sie war es acht Mal.

**Behoben (mit Test, §6):**

| Route                                   | Was die tote Bindung zeigte                                                                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai-act/incidents/[id]` (PUT)           | `resolvedClause` — „If being resolved, set resolved_at" — wurde gebaut und **nie in das UPDATE eingesetzt**. `resolved_at` blieb beim Abschluss eines KI-Vorfalls leer (Art. 73 KI-VO: Meldedatum). |
| `reports/soa`                           | `partiallyImplemented` wurde gezählt, die Beschriftung `soaPartially` liegt in **beiden** Sprachen vor — die Kachel fehlte. Die Kachelzeile ging nicht auf.                                         |
| `processes/[id]/dmn-links`              | `processId` entnommen, in der Abfrage nicht benutzt: die Route gab die DMN-Entscheidungen **fremder Prozesse** derselben Organisation zurück.                                                       |
| `programmes/journeys/[id]/next-actions` | `reason: message` gab den rohen Treibertext an den Aufrufer — genau der Befund, den E2E-TRIAGE-2026-09-02 in der Schwesterroute behoben hat, ohne diese Datei zu erfassen. → **OP-174**             |

**Aufgenommen, nicht behoben** — jeweils mit einem Kommentar an der Stelle,
damit die Evidenz nicht mit der toten Bindung verschwindet:

| Nr.        | Befund                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OP-176** | **Sieben Routen prüfen einen Parameter und werfen ihn weg.** `academy/dashboard`, `role-dashboards/data/auditor`, `role-dashboards/data/department-manager` (je `timeRange`, teils `status`/`departmentId`), `horizon-scanner/items` (`framework`), `predictive-risk/correlations` (`minCorrelation`), `plugins/marketplace` (`search`), `eam/catalog` (`page`). Der `parse`-Aufruf bleibt stehen — er ist die Eingabeprüfung —, gebunden wird nichts mehr.                                     |
| **OP-177** | **Die Unabhängigkeitsprüfung des QA-Reviewers findet nicht statt.** In `audit-mgmt/qa-review` stand unter der Überschrift „reviewer must NOT be in audit_resource_allocation" eine Abfrage, deren Ergebnis nie gelesen wurde, darunter „Simplified: …" und dann nichts. Ein Mitglied des Prüfteams kann sich selbst als QA-Reviewer eintragen. Die Auflösung `auditor_profile` → `user` hat der ursprüngliche Autor ausdrücklich offengelassen; sie zu erfinden wäre schlechter als der Befund. |
| **OP-178** | **`catalogs/active-entries` baut SQL per Zeichenkette.** Zwei rohe Abfragen mit `WHERE org_id = '${ctx.orgId}'` und `"${entityTable}"`. Beide Werte stammen heute aus Sitzung bzw. Ternär, sind also nicht steuerbar — die Form ist trotzdem falsch. Die zweite Abfrage war zusätzlich **tot und immer fehlschlagend**: sie enthielt `$1::uuid[]` ohne Parameter, warf bei jedem Durchlauf und wurde von einem leeren `catch` verschluckt. Die tote Abfrage ist entfernt.                       |
| **OP-179** | **Der EAM-Katalog kann nicht geblättert werden.** `offset` wurde berechnet und nie angewandt; die drei Teilabfragen holen `LIMIT pageSize` ohne `OFFSET`, die Antwort schneidet `slice(0, pageSize)` und gibt `page` zurück. Jede Seite ist die erste. Eine richtige Lösung muss auch `total` und die Facetten klären, die heute über der bereits abgeschnittenen Menge entstehen.                                                                                                              |
| **OP-180** | **Zwei Routen werten ihr Pfadsegment nicht aus.** `import/mappings/[entityType]` (DELETE, löscht nur nach `?id=`) und `processes/[id]/simulation/compare` (vergleicht zwei Szenarien ohne Prozessbezug). Beide sind organisationsgebunden, also kein Mandantenleck — aber die URL verspricht mehr, als der Handler prüft.                                                                                                                                                                       |

Die übrigen 14 waren wirklich Reste: ein nie benutztes Update-Objekt neben
dem echten UPDATE, drei Abfragen, deren Ergebnis niemand liest (ein
Rundlauf zur Datenbank pro Anfrage), ein `today`, ein `buckets`, zwei
Destrukturierungen, die zwei Zeilen später überschrieben werden.

---

## 4. OP-076 — 128 → 0

Die vier Hotspots des Registers zuerst, dann der Rest. Der Löwenanteil
(rund 70 Stellen) ist dieselbe Form: `tx.execute(sql\`…\`)`liefert für rohes
SQL keine ableitbare Zeilenform, also stand dort`as any[]`.

**Die Regel, nach der typisiert wurde.** Die Zeilenform wird aus der
SELECT-Liste der jeweiligen Abfrage benannt und daneben geschrieben. Das
bleibt eine Zusicherung (`as unknown as …`) und keine Ableitung — die
Datenbank kann sie nicht bestätigen —, aber sie ist **überprüfbar**: wer die
SELECT-Liste ändert, sieht die Zeilenform daneben stehen. Genau das ist der
Unterschied zu `any`, das gar nichts behauptet. Wo der Treiber einen Typ
nicht festlegt (`bigint`/`numeric` kommen als Zeichenkette, Zeitstempel je
nach Konfiguration als `Date` oder `string`), steht eine Vereinigung statt
einer Erfindung. Wo eine Abfrage ausschließlich `::int` selektiert, steht
`Record<string, number>` — mehr behauptet die SELECT-Liste nicht.

Vier Stellen ließen sich stattdessen **ableiten** statt zusichern:
`processes/[id]/racm` bezieht seine drei Listenformen über
`(typeof stepsWithRisks)[number][…]` aus den Drizzle-Abfragen darüber,
`processes/[id]/ropa-profile` über `$inferInsert`/`$inferSelect`,
`processes/bulk-approve` über den exportierten `GateBlocker`,
`translations/import` über `ApiContext` (die beiden Hilfsfunktionen
beschrieben ihren Kontext als `{ …; session: any }` und gaben ihn dann an
`withAuditContext` weiter, das den vollen Kontext erwartet).

### 4.1 Was die Typisierung sichtbar gemacht hat

**(a) Vier CSV-Spalten des DSGVO-Meldepakets waren immer leer.** → **OP-181**

`dpms/data-breach/[id]/notification-pack` schreibt `notifications-log.csv`
mit der Kopfzeile `RecipientType,Recipient,Channel,NotifiedAt,Status`. Unter
`(n: any)` griff der Code auf `n.recipient`, `n.channel`, `n.notifiedAt` und
`n.status` zu. **Diese Felder gibt es in `data_breach_notification` nicht** —
sie heißen `recipient_email`, `sent_at`, `response_status`, und ein `channel`
existiert überhaupt nicht. Jeder dieser Zugriffe war `undefined`, und
`csv(undefined)` schreibt eine leere Zelle: das Meldeprotokoll im Paket nach
Art. 33/34 DSGVO war seit jeher bis auf die erste Spalte leer, ohne dass
irgendetwas fehlschlug. Die Kopfzeile nennt jetzt die Spalten, die es gibt;
Test in §6.

**(b) `as any` war nicht nur eine Typlücke, es hatte eine Wirkung.**

```
grc_v4b=> SELECT count(*) FROM wb_case WHERE status = 'bogus';
ERROR:  invalid input value for enum wb_case_status: "bogus"
```

`eq(wbCase.status, status as any)` reichte einen rohen Abfrageparameter an
eine `pgEnum`-Spalte weiter. Ein Aufrufer mit `?status=bogus` bekam einen
**500er aus der Datenbank** statt einer Aussage über seine Eingabe. Dasselbe
in `whistleblowing/cases` (`priority`) und `eam/elements` (`type`). Der neue
Helfer `src/app/api/v1/_lib/enum-filter.ts` engt den Wert an
`column.enumValues` ein — die erlaubten Werte stehen an der Spalte selbst, es
gibt also keine zweite Liste, die vom Schema wegdriften kann. Aus dem 500er
wird ein 422er.

**(c) Dieselbe Form im SSO-Anmeldeweg.** `resolveRole` gibt `string` zurück;
die Zuordnung Gruppe→Rolle stammt aus der IdP-Konfiguration der Organisation
und ist frei getippter Text. Mit `role as any` ging ein Tippfehler dort
ungeprüft in `user_organization_role.role` — die Datenbank wies ihn ab, und
der SSO-Login scheiterte mit einem 500er statt mit einer Rolle. Unbekannte
Werte fallen jetzt auf `viewer` zurück, den Wert, den die Konfiguration
ohnehin als Vorgabe führt, und werden protokolliert.

**(d) Eine Zusicherung verdeckte einen echten Formunterschied.** In
`scim/v2/Users` stand `scimToArctosUser(parsed.data as any)`.
`scimCreateUserSchema` führt `emails` als optional und `type`/`primary` je
Eintrag als optional, während `ScimUser` beide verlangt — dasselbe bei
`groups.display`. Statt die Prüfung abzuschalten wird die Lücke jetzt
geschlossen, mit der Vorgabe aus RFC 7643 §2.4 (`primary` fehlt = false) und
ohne einen `type` zu erfinden.

**(e) Zwei Divisionen rechneten auf Zeichenketten.** In
`whistleblowing/statistics` liefert der Treiber `COUNT(*)` als Zeichenkette.
Drei Stellen wandelten bereits mit `Number(...)` um, zwei nicht
(`sla7dRow.compliant / sla7dRow.total`). Das ging gut, weil JavaScript beim
`/` selbst umwandelt — und weil `any` die Frage gar nicht erst stellte. Die
Zeilenformen nennen den Treibertyp jetzt als `string | number`; die beiden
Divisionen wandeln sichtbar um.

**(f) Ein Paket kündigt eine Datei an, die es nicht enthält.** → **OP-175**

Beim Benennen der Zeilenform von `audit-mgmt/audits/[id]/audit-pack` fiel
auf: die Abfrage selektiert `report_title` und `report_path`, `report_title`
wird nirgends gelesen, und `report_path` nur für die README-Zeile
`- report.pdf`. Ein `zip.file("report.pdf", …)` gibt es nicht. Der
Kopfkommentar der Datei behauptet dasselbe („plus the report document if
attached"). Nicht hier behoben: den Bericht wirklich beizulegen heißt, den
Dateispeicher zu lesen — eine Produktänderung, keine Typisierung.

---

## 5. Welche Ausnahmen gefallen sind

In `apps/web/eslint.config.mjs`:

- Das Konfigurationsobjekt `files: ["src/app/api/v1/**"]` ist **ersatzlos
  entfernt**. Es schaltete `@typescript-eslint/no-explicit-any` und
  `@typescript-eslint/no-unused-vars` ab. (Seine dritte Ausnahme,
  `@next/next/no-assign-module-variable`, war schon in Welle 4b-1 mit OP-078
  gefallen.)
- `src/app/api/v1/**/*.{ts,tsx}` ist in den `files`-Bereich der
  `no-console`-Regel aufgenommen; der Kommentar dort führt das Verzeichnis
  nicht mehr unter „nicht im Geltungsbereich".

Damit gilt in diesem Verzeichnis derselbe Regelsatz wie im Rest des
Workspaces. Die zwei bewusst gebliebenen Ausnahmen von `apps/web` — `any` in
Testcode, `console.*` in `"use client"`-Komponenten — sind nicht berührt; die
erste wird vom Tor-Test ausdrücklich mitgeprüft, damit ein Tor nicht den
Prüfstand mitreißt.

---

## 6. Nachweis

### 6.1 Zahlen vorher/nachher

Gemessen mit
`npx eslint "src/app/api/v1/**/*.ts" --rule '{…}'` (derselbe Regelsatz wie
für den Rest des Workspaces), aus `apps/web`:

| Regel                                | vorher | nachher |
| ------------------------------------ | -----: | ------: |
| `@typescript-eslint/no-unused-vars`  |    500 |   **0** |
| `@typescript-eslint/no-explicit-any` |    128 |   **0** |
| `no-console`                         |     53 |   **0** |

Nach dem Fall der Ausnahmen meldet `npx eslint .` über ganz `apps/web`
**dieselben zwei Fehler wie vorher** und keinen weiteren:

```
src/__tests__/api/grc-maintenance-surface.test.ts:263  no-constant-binary-expression
src/__tests__/components/bpmn-moddle-declaration.test.ts:105  @typescript-eslint/no-require-imports
```

Beide sind gegen `08a4ae4f` nachgemessen (`git stash`, dieselbe Ausgabe) und
liegen in Testdateien, die dieser Strang nicht anfasst. Sie gehören zu
OP-173: **`apps/web` hat als einziger Workspace keine Lint-Ratsche**, sein
eigenes `npm run lint` ist auf diesem Branch rot, und es fällt niemandem auf.

### 6.2 Prüfungen

| Prüfung                                        | Ergebnis                                     |
| ---------------------------------------------- | -------------------------------------------- |
| `npx tsc --noEmit -p apps/web/tsconfig.json`   | Exit 0                                       |
| `npm test --workspace=@grc/web` (Standardlauf) | **118 Dateien, 2.709 Tests** grün            |
| dazu die DB-Suite aus `run-db-suites.mjs`      | 4 Dateien, 24 Tests grün                     |
| `npm run test:rls` (mit beiden Verbindungen)   | 4 Dateien, 24 Tests grün                     |
| `npx prettier --check .`                       | „All matched files use Prettier code style!" |
| `node scripts/lint-ratchet.mjs`                | 283 (Baseline 283), keine Regression         |
| `node scripts/check-gate-inputs.mjs`           | 7 Tor-Eingaben, grün                         |

Die Ratsche misst `apps/worker`, `packages` und `scripts` — dieses Gebiet
liegt außerhalb, sie kann die Verbesserung also gar nicht zeigen. Dass sie
unverändert bleibt, ist die Aussage, die hier zählt: keine Regression
anderswo.

### 6.3 Die neuen Tests, und dass sie fallen können

**`src/__tests__/lint/api-v1-lint-gate.test.ts`** (8 Zusicherungen) ist das
Tor. Es macht zwei unabhängige Aussagen, wie das Tor des Workers:

1. über die **aufgelöste Konfiguration** — was ESLint für eine Routendatei
   tatsächlich einschaltet, nicht was im Text der Konfiguration steht. Bei
   `no-console` zusätzlich, dass **keine `allow`-Liste vererbt** wird; genau
   daran ist die Ratsche in Welle 4b-2 vorbeigelaufen.
2. über den **Baum** — kein `console.*`-Aufruf, kein `any`, kein
   `eslint-disable` auf eine der drei Regeln. Das deckt auch, was ein
   künftiges `ignores` dem Blick von ESLint entzöge.

Eine Feinheit, die der Test selbst gefunden hat: `calculateConfigForFile`
liefert `undefined`, wenn die Datei von der geprüften Konfiguration
ausgenommen ist — und die **Wurzelkonfiguration nimmt `apps/web/**` aus**
(„eigener, strengerer Regelsatz"). Der Test läuft deshalb mit
`cwd: apps/web` und prüft damit genau die Konfiguration, die für diese
Dateien wirklich gilt.

**`src/__tests__/api/welle-4b-3-tote-bindungen.test.ts`** (8 Zusicherungen)
hält die behobenen Defekte fest. Die Zusicherung zu `resolved_at` gilt dem
**zusammengesetzten SQL-Baustein**, nicht dem Quelltext der Route; die
Zusicherungen zu `dmn-links` unterscheiden die Abfragen an der **Tabelle**
und nicht an der Reihenfolge.

**Gegenprobe (Eiserne Regel 3).** Beide Dateien gegen `08a4ae4f` laufen
lassen (`git stash push`, Testdateien bleiben als ungetrackt liegen):

```
api-v1-lint-gate.test.ts               5 failed | 3 passed (8)
welle-4b-3-tote-bindungen.test.ts      7 failed | 1 passed (8)
```

Die drei bestehenden Zusicherungen des Tor-Tests sind die Struktur­aussagen
(„es gibt überhaupt Routendateien", „die Testausnahme steht noch", „kein
`eslint-disable`"); die eine des Defekt-Tests ist die **Gegenprobe** „setzt
`resolved_at` NICHT bei einem anderen Statuswechsel" — sie muss auf beiden
Ständen halten, sonst würde die Zusicherung daneben nichts mehr
unterscheiden.

Eine erste Fassung der `dmn-links`-Zusicherungen ging bei dieser Gegenprobe
**grün durch**: der Mock hatte die Ergebnisse nach Aufrufreihenfolge
verteilt, und der alte Stand hatte nur EINE Abfrage — er bekam damit die als
„Schrittabfrage" gedachte leere Antwort. Ein Test, der nicht fallen kann, ist
kein Test; die Fassung im Repository unterscheidet an der Tabelle.

---

## 7. Was offen bleibt

- **Sieben neue Registereinträge** aus §3.2 und §4.1: OP-174 (behoben),
  OP-175, OP-176, OP-177, OP-178, OP-179, OP-180, OP-181 (behoben). Dieses
  Dokument ist ihr Beleg; das Register selbst liegt außerhalb der Dateihoheit
  dieses Strangs.
- **OP-173 bleibt der Rahmen um alles hier.** Ohne Lint-Ratsche für
  `apps/web` sind die drei Nullen dieses Strangs nur so lange stabil, wie der
  Tor-Test in §6.3 läuft. Er zählt nicht, er verbietet — das ist enger und
  spröder als ein Budget. Zwei bestehende Lint-Fehler in Testdateien belegen,
  wie lange etwas unbemerkt rot stehen kann.
- **`packages/**` behält den nachsichtigen `no-console`-Satz** (Stand aus
  Welle 4b-2, hier nicht berührt).
- Die `"use client"`-Komponenten bleiben bewusst außerhalb der
  `no-console`-Regel; die Begründung steht unverändert in
  `apps/web/eslint.config.mjs` und in `docs/UMSETZUNG-WELLE-4B-2.md` §3.

---

## 8. Was mir aufgefallen ist, das vorher niemand wusste

Drei Dinge, die über die drei Punkte hinausreichen.

**Eine abgeschaltete Lint-Regel ist nicht nur Schuld, sie ist eine
Sichtblende.** Der Auftrag lautete „500 tote Bindungen entfernen" und „128
`any` typisieren — Aufräumarbeit. Herausgekommen sind acht Produktdefekte,
darunter ein leeres Meldeprotokoll im DSGVO-Paket, ein nie gesetztes
Abschlussdatum eines KI-Vorfalls, eine fehlende Unabhängigkeitsprüfung im
Audit-QA und eine Route, die die Daten fremder Prozesse zurückgibt. Keiner
davon wäre durch Lesen aufgefallen; alle acht hingen an genau der Meldung,
die seit WP12 ausgeschaltet war. **Die beiden Regeln waren keine
Stilregeln — sie waren Defektdetektoren, und sie standen zwei Wellen lang
auf `off`.**

**Der Zählstand des Registers ist auf drei Zahlen an einem Punkt gewandert**
(483→500, 129→128, 56→53), ohne dass jemand etwas Falsches getan hätte. Für
`apps/web` gibt es keine Ratsche; die Zahlen im Register sind Momentaufnahmen
aus WP12 und altern still. Eine Zahl ohne Tor ist ein Datum, kein Deckel.

**Der gefährlichste Fund hat mit keinem der drei Punkte zu tun.** In
`audit-mgmt/qa-review` steht die Absicht ausgeschrieben — „reviewer must NOT
be in audit_resource_allocation" —, die Abfrage läuft, und die Prüfung
findet nicht statt. Für einen Außenstehenden, der den Code liest, ist die
Kontrolle vorhanden: Überschrift, Abfrage, Kommentar. Nur das Ergebnis
benutzt niemand. Ein solcher Befund ist mit keiner Testabdeckung zu finden,
die den Erfolgsfall prüft, und mit keinem Lint außer diesem einen — die tote
Bindung war der einzige Zeuge.
