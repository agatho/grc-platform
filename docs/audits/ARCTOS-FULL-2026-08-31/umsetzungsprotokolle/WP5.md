# WP5 — Input, Injection, SSRF, Upload · Umsetzungsprotokoll

**Audit-ID:** ARCTOS-FULL-2026-08-31 · **Paket:** WP5 (Welle 2) · **Branch:** `audit/full-2026-08-31`
**Umfang:** 11 Findings — `S04-01`…`S04-09`, `S10-16`, `S10-19`
**Grundlage:** `findings/S04-input-injection-upload-ssrf.md`, `findings/S10-worker-cron-resilienz.md`, `evidence/S04/**`

---

## 0. Kernentscheidung: `custom_sql` bleibt — gehärtet statt entfernt

Der Auftrag verlangt eine bewusste Entscheidung, ob die Freitext-SQL-Funktion der
Continuous-Audit-Regeln fachlich gebraucht wird. **Entscheidung: behalten, nach dem Muster
von `bi-reports/queries/execute` härten.** Begründung, in der Reihenfolge des Gewichts:

1. **Entfernen würde das Feature ersatzlos abschalten, nicht nur einschränken.**
   `executeBuiltinRule()` in `continuous-audit-runner.ts` ist ein Stub, der unverändert `[]`
   zurückgibt („Built-in rule implementations would go here"). `api_check` ist im Runner gar
   nicht implementiert. `custom_sql` ist damit **der einzige Regeltyp, der überhaupt etwas
   tut**. Eine Entfernung wäre keine Härtung, sondern eine stille Feature-Löschung — und die
   Continuous-Audit-Oberfläche würde weiter Regeln anlegen lassen, die nie ein Ergebnis
   liefern. Das ist die schlechtere Sicherheitslage, weil es die Kontrolllücke unsichtbar macht.
2. **Das Produkt hat bereits einen sanktionierten, geprüften Mechanismus für genau diesen
   Anwendungsfall.** `bi-reports/queries/execute` führt admin-verfasstes SQL aus und wurde im
   Audit ausdrücklich als korrekt gehärtet bestätigt (`SET LOCAL ROLE grc_app` +
   `SET TRANSACTION READ ONLY` + `startsWith("SELECT")` + `;`-Verbot + Kommentar-Verbot, alles
   in **einer** Transaktion, fail-closed). Zwei Endpunkte mit derselben Fachfunktion und zwei
   verschiedenen Sicherheitsmodellen ist genau die Inkonsistenz, die S04-01 hervorgebracht hat.
   Ein Muster, konsistent angewandt, ist prüfbar; zwei sind es nicht.
3. **Die Restmächtigkeit nach dem Fix ist keine Eskalation mehr.** Unter
   `SET LOCAL ROLE grc_app` + `app.current_org_id` + `READ ONLY` kann eine Regel genau das
   lesen, was ein normaler Nutzer derselben Organisation über die API ohnehin lesen darf.
   Damit sind alle drei Critical-Kriterien des Findings weg: kein RCE (`COPY … FROM PROGRAM`
   erfordert Superuser), kein Cross-Tenant (RLS greift, weil `grc_app` kein `BYPASSRLS` hat),
   kein Audit-Tampering (Transaktion ist read-only).
4. **Eine parametrisierte Regelsprache wäre der bessere Endzustand, aber ein eigenes
   Arbeitspaket.** Sie bräuchte einen Ausdrucks-Parser, eine Feld-/Operator-Registry über ~584
   Tabellen und eine Migration aller bestehenden Regeln. Das im Rahmen der Remediation
   nebenbei zu bauen, hätte ein hohes Risiko, still fehlerhaft zu sein — schlechter als das
   erprobte Muster. → als Folge-Empfehlung notiert (Abschnitt „Bedarf an andere Pakete").

Zusätzlich wurde die **Blocklist durch eine Allowlist ersetzt** und diese **auch zur Laufzeit**
angewandt: die Regelerstellung war nie die einzige Schreibquelle für
`continuous_audit_rule` (Seeds, Migrationen, künftige Importpfade), und die Blocklist war
empirisch umgangen.

---

## 1. Findings — Änderung, Nachweis, Status

### S04-01 · Critical · Beliebige SQL-Ausführung als Superuser über `custom_sql`

**Status: geschlossen**

**Änderung**

- `packages/shared/src/schemas/audit-advanced.ts`
  Die Keyword-Blocklist (`WRITE_KEYWORDS`) ist ersetzt durch
  `validateCustomAuditSql()` — eine Allowlist: genau ein `SELECT`, kein `;`, keine Kommentare
  (`--`, `/*`, `*/`), kein Dollar-Quoting (`$$`, `$tag$`), keine Steuerzeichen, Längenlimit
  8 000 Zeichen, Verbot der Schlüsselwörter
  `INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY|DO|CALL|…|INTO|PROGRAM`
  und der Funktionen `pg_sleep|pg_read_file|pg_ls_dir|lo_import|lo_export|dblink|…`.
  `WITH` ist bewusst **nicht** erlaubt (data-modifying CTE ist ein Schreibzugriff im
  SELECT-Gewand). `isReadOnlySql()` bleibt als Boolean-Wrapper erhalten, damit die
  Erstellungsroute (`audit-mgmt/continuous-rules/route.ts`, fremde Hoheit) die strenge
  Semantik **ohne Signaturänderung** übernimmt.
- `apps/worker/src/crons/continuous-audit-runner.ts`
  `executeCustomSqlRule()` neu: (a) Re-Validierung mit derselben Funktion **zur Laufzeit**;
  (b) eine einzige `db.transaction` mit `SET LOCAL ROLE grc_app` **zuerst**, danach
  `set_config('app.current_org_id', rule.orgId, true)`, danach
  `SET LOCAL statement_timeout = '30s'` als **eigenes** Statement, danach
  `SET TRANSACTION READ ONLY`, zuletzt die validierte Query eingebettet als
  `SELECT * FROM (<sql>) AS custom_audit_rule LIMIT 1000`.
  Das alte `catch { return []; }` ist entfernt — eine abgelehnte oder fehlgeschlagene Regel
  wird als `resultStatus: "error"` mit `errorMessage` persistiert statt als „bestanden"
  getarnt. Fehlt die Rolle `grc_app`, wirft die Transaktion und die Query läuft nie.

**Nachweis**
`apps/worker/tests/crons/continuous-audit-runner-sql-guard.test.ts` (13 Tests, grün):

- 10 Tests fahren die im Bericht belegten Nutzlasten (`SELECT * INTO evil_copy FROM organization`,
  `SELECT 1; DO $$ … EXECUTE 'CRE'||'ATE …' … END $$`, `SELECT 1; COPY t FROM PROGRAM 'id'`,
  `SELECT 1; GRANT ALL … TO PUBLIC`, `SELECT pg_sleep(3600)`, trailing `;`, Kommentar-Splice,
  data-modifying CTE, Block-Kommentar, `pg_read_file`) gegen den Runner und weisen nach, dass
  (a) **kein** an die DB gesendetes Statement die Nutzlast enthält, (b) das
  Multi-Statement-Muster `statement_timeout … ; … SELECT` gar nicht mehr entsteht,
  (c) die Regel als `error` mit `errorMessage` „rejected by validator" endet.
- 1 Test belegt die Reihenfolge `SET LOCAL ROLE grc_app` → `app.current_org_id` →
  `SET TRANSACTION READ ONLY` → Query, dass der Timeout ein eigenes Statement ohne `SELECT`
  ist und die Query ein `LIMIT` trägt.
- 1 Test belegt Fail-closed: fehlt `grc_app` (SQLSTATE 22023), wird die Query **nicht**
  ausgeführt.
- 1 Test belegt, dass eine Regel ohne Query keine leere Anweisung erzeugt.

---

### S04-02 · High · SSRF via SAML-Metadaten- und OIDC-Discovery-Fetch

**Status: geschlossen**

**Änderung** (Guard gehärtet + konsistent angewandt)

- `packages/shared/src/url-safety.ts`
  - `checkOutboundUrl(url, { requireHttps, purpose })` als neue gemeinsame Basis;
    `checkWebhookUrl()` ist jetzt ein dünner Wrapper darauf (Signatur und Meldungen
    unverändert, Webhook-Tests unberührt).
  - **Neu `normalizeNumericIPv4()`**: reproduziert die `inet_aton`-Grammatik (1–4 Teile,
    dezimal / oktal `0…` / hex `0x…`, letzter Teil absorbiert die Restbytes). Die alte
    Prüfung matchte nur `^\d{1,3}(\.\d{1,3}){3}$`, also **nur** dotted-quad — `2130706433`,
    `0x7f000001`, `0177.0.0.1`, `127.1`, `0`, `2852039166` (= 169.254.169.254) liefen durch.
  - **IPv6 wird jetzt expandiert** (`expandIPv6`) statt per Präfix-String verglichen. Die alte
    Prüfung erkannte nur die kürzeste Schreibweise; `0:0:0:0:0:0:0:1`, `::0001`,
    `[0:0:0:0:0:ffff:a9fe:a9fe]` galten als öffentlich. Abgedeckt: `::`/`::1`, `fc00::/7`,
    `fe80::/10`, `fec0::/10`, `ff00::/8`, IPv4-mapped/-compatible und NAT64 `64:ff9b::/96`
    mit privater eingebetteter v4.
  - Zusätzlich: eingebettete Credentials (`https://user:pw@host`) und `.localhost` werden
    abgelehnt; `requireHttps` überstimmt die `WEBHOOK_ALLOW_HTTP`-Ausnahme.
- `packages/shared/src/lib/url-safety-server.ts`
  - **Neu `assertUrlIsSafe()`** (literal + DNS in einem Aufruf) und **`safeFetch()`**.
    `safeFetch` folgt Redirects **selbst** (`redirect: "manual"`, Standard max. 3 Hops) und
    validiert **jeden Hop** neu. Das war die verbleibende Lücke, die eine Vorabprüfung
    prinzipiell nicht schließen kann: `fetch()` folgt bis zu 20 Redirects und nur die
    **erste** URL wurde je geprüft.
- `packages/auth/src/saml/metadata-parser.ts`, `packages/auth/src/oidc/discovery.ts`
  bare `fetch(...)` → `safeFetch(..., { requireHttps: true, maxRedirects: 3 })`.
  **Dateihoheit:** beide Dateien gehören WP3. Geändert wurde ausschließlich der URL-Guard
  (Import + der eine `fetch`-Aufruf); Parsing-, Signatur- und Validierungslogik ist unberührt.
  Unter `apps/web/src/app/api/v1/admin/sso/**` war **keine** Änderung nötig, weil die Routen
  über diese beiden Funktionen gehen — der Fußabdruck in fremder Hoheit ist damit minimal.

**Nachweis**

- `packages/shared/tests/url-safety-ssrf-s04.test.ts` (41 Tests, grün): alle IPv4-Schreibweisen
  von Loopback und IMDS, 13 IPv6-Schreibweisen, Schema-/Credential-Härtung, Redirect auf
  `127.0.0.1` / `169.254.169.254` / `[::1]` / `0.0.0.0` / Dezimal-IP, Redirect der erst im
  zweiten Hop privat wird, DNS-Rebinding, `redirect: "manual"`-Vertrag, Redirect-Obergrenze,
  Positivfall.
- `packages/auth/tests/sso-ssrf-s04-02.test.ts` (21 Tests, grün): beide Pfade
  (`fetchAndParseSAMLMetadata`, `discoverOIDCEndpoints`) gegen `127.0.0.1`,
  `169.254.169.254`, `[::1]`, `0.0.0.0`, Dezimal-IP, RFC1918, `.internal`, Klartext-HTTP,
  Redirect auf eine private Adresse und DNS-Rebinding — jeweils mit der Zusicherung, dass
  `fetch` gar nicht erst aufgerufen wurde. Zwei Positivtests belegen, dass ein echter
  öffentlicher IdP/Provider weiterhin funktioniert.

---

### S04-03 · High · SSRF via ISMS-Threat-Feed-URL (Worker als Superuser)

**Status: geschlossen**

**Änderung**

- `apps/worker/src/crons/threat-feed-sync.ts`: `fetch(source.feedUrl, …)` → `safeFetch(...)`
  mit 30 s Timeout und max. 3 validierten Redirect-Hops. Ein vom Guard abgelehnter Feed wird
  jetzt zusätzlich mit Feed-ID und Org-ID geloggt statt still in den Fehlerzähler zu fallen.
- `apps/web/src/app/api/v1/isms/threats/feeds/route.ts` (POST) und
  `.../feeds/[id]/route.ts` (PUT): Registrierungs- bzw. Änderungszeit-Guard
  (`checkOutboundUrl` + `assertUrlIsSafe`), Antwort 422 mit Begründung.
  Der PUT-Pfad war im Bericht nicht genannt, ist aber dieselbe Lücke: ohne ihn legt man einen
  harmlosen Feed an und zeigt ihn eine Sekunde später auf `169.254.169.254`.
- Beide Ebenen bleiben erhalten (Defence in Depth): Zeilen aus Seeds/Migrationen/Imports
  umgehen die Registrierungsprüfung, und nur der Worker sieht, wo eine Redirect-Kette endet.

**Nachweis**
`apps/worker/tests/crons/threat-feed-sync-ssrf.test.ts` (9 Tests, grün): Loopback, IMDS,
`[::1]`, `0.0.0.0`, Dezimal-IP, interner Datenbank-Host, Redirect auf eine private Adresse,
DNS-Rebinding — jeweils `fetch` nicht aufgerufen bzw. nur der erste Hop, Ergebnis
`errors: 1`, `newItems: 0`. Ein Positivtest belegt, dass ein echter öffentlicher RSS-Feed
weiter synchronisiert.

---

### S04-04 · Medium · XLSX-Dekompressions-/Speicher-Amplifikation → DoS

**Status: geschlossen**

**Änderung** (drei Schichten)

- **Neu `packages/shared/src/lib/zip-safety.ts`**: abhängigkeitsfreier Leser des
  ZIP-Central-Directory (inkl. ZIP64) mit `inspectZipArchive()` und
  `assertZipWithinLimits()`. Grenzen für Tabellenkalkulationen: 100 MB Gesamtexpansion,
  80 MB je Member, Verhältnis 150:1, 2 048 Einträge. Ein Archiv, das sich **nicht** vermessen
  lässt (kein EOCD, kaputtes Central Directory), wird abgelehnt — „nicht messbar" heißt
  „nicht entpacken", nie „trotzdem entpacken".
- `apps/web/src/lib/import-export/file-parser.ts`: Pre-Flight vor jedem XLSX-Parse; Umstellung
  von `Workbook.xlsx.load(buffer)` (materialisiert das ganze Blatt) auf den **Streaming**
  `ExcelJS.stream.xlsx.WorkbookReader`; harte Ober­grenzen 100 000 Zeilen /
  10 000 000 Zellen (`IMPORT_MAX_ROWS` überschreibbar), die den Lauf **abbrechen** statt still
  zu kürzen. Die Zeilengrenze gilt auch für CSV, damit die nachgelagerten Stufen einen
  Vertrag sehen.
- `packages/shared/src/lib/excel-to-bpmn.ts`: derselbe Pre-Flight vor `wb.xlsx.load()`
  (Pfad `processes/import-excel`).

**Nachweis**

- `packages/shared/tests/zip-safety-s04-04.test.ts` (8 Tests, grün): baut echte ZIP-Container
  und weist nach, dass die **gemessene PoC-Form** (Archiv < 10 MB, deklariertes Blatt 134 MB)
  abgelehnt wird, ebenso einzelner Übergroß-Member, Gesamtexpansion, Verhältnis, Anzahl
  Einträge, unlesbares Archiv; Positivfall und Größenbericht.
- `apps/web/src/__tests__/lib/import-file-parser-limits.test.ts` (8 Tests, grün): `parseFile()`
  lehnt die Bombe mit `ImportTooLargeError` ab, obwohl sie unter dem 10-MB-Upload-Limit
  liegt; ein echtes, mit exceljs erzeugtes Workbook wird über den Streaming-Reader korrekt
  geparst (Header, Zeilen, Preview identisch zur alten Semantik); CSV-Zeilengrenze greift.

---

### S04-05 · Medium · CSV-Formula-Injection in mehreren Export-Endpunkten

**Status: geschlossen**

**Änderung** — zentral, ein Helfer, überall verwendet:

- `apps/web/src/lib/import-export/csv-sanitizer.ts`: neu `toCsvCell(value, delimiter)` und
  `toCsvRow(values, delimiter)` — neutralisiert erst (`^[=+\-@\t\r]` → `'`-Präfix), quotet
  dann für den jeweiligen Delimiter (`,` oder `;`). **`escapeCsvField()` neutralisiert jetzt
  ebenfalls**, damit jede verbliebene Aufrufstelle des alten Zwei-Schritt-Idioms von selbst
  sicher ist (die doppelte Anwendung ist nachweislich idempotent). `objectsToCsv()` nutzt
  denselben Weg.
- Ad-hoc-Escaper entfernt und ersetzt in:
  `isms/soa/export`, `kris/export`, `risks/export`,
  `processes/[id]/raci/export` (hatte **gar kein** Escaping — rohes `join(",")`),
  `audit-mgmt/audits/[id]/checklists/[checklistId]/export`,
  `apps/web/src/lib/ropa-export.ts` (bedient `processes/ropa-export` und
  `processes/[id]/ropa/export`).
- Zusätzlich (gleiche Defektklasse, sonst wäre der Fix ein Placebo — siehe Abschnitt 2):
  `audit-mgmt/audits/[id]/audit-pack`, `tprm/vendors/[id]/onboarding-pack`,
  `processes/audit-pack`.

**Nachweis**
`apps/web/src/__tests__/api/csv-formula-injection-s04-05.test.ts` (25 Tests, grün):
sieben Nutzlasten (`=cmd|'/C calc'!A1`, `=HYPERLINK(...)`, `+`, `-`, `@`, `\t`, `\r`) über
`toCsvCell`, `escapeCsvField`, `toCsvRow`, `objectsToCsv` und beide Delimiter; Quoting-,
Array- und Idempotenz-Verträge; **End-to-End gegen den echten Endpunkt**
`GET /api/v1/isms/soa/export`: ein bösartiger Control-Titel und eine bösartige Begründung
erscheinen als Daten, aber keine Zelle beginnt nach dem Entquoten mit einem Formel-Trigger.

---

### S04-06 · Low · Upload vertraut dem Client-`Content-Type`, kein Magic-Byte-Check

**Status: geschlossen für die Pfade in WP5-Hoheit; Helfer bereitgestellt, Einbindung im
DMS-Upload an WP7 übergeben**

**Änderung**

- **Neu `packages/shared/src/lib/file-signature.ts`**: abhängigkeitsfreie Magic-Byte-Erkennung
  (`sniffFileType`, `verifyUploadSignature`, `looksLikeText`) für PDF, ZIP/OOXML/ODF, OLE2,
  PNG/JPEG/GIF/WEBP/BMP/ICO, RTF sowie die Formate, die **niemals** akzeptiert werden dürfen
  (PE `MZ`, ELF, Mach-O, `#!`-Skripte → `ALWAYS_FORBIDDEN_MIMES`, unabhängig von der
  Allowlist des Aufrufers). Der **erkannte** Typ ist maßgeblich und soll persistiert werden —
  das schließt die zweite Hälfte des Findings („gespeichert als application/pdf").
  Formate ohne Signatur (CSV, Text, XML) melden „unbekannt"; der Aufrufer entscheidet per
  `allowUnknownForText`.
- `apps/web/src/lib/import-export/file-parser.ts`: Prüfung an der einen Stelle, durch die
  **jeder** Importpfad läuft (`import/upload`, `import/[jobId]/validate`).
- `packages/shared/src/lib/clamav.ts`: `isClamAvFailClosed()` ist jetzt
  umgebungsabhängig — **fail-closed in `NODE_ENV=production`**, fail-open sonst;
  `CLAMAV_FAIL_CLOSED=0` bleibt als dokumentierter, sichtbarer Opt-out. Neu
  `isClamAvRequired()`, damit ein Aufrufer auch `status: "skipped"` (CLAMAV_HOST nie gesetzt)
  in Produktion als Ablehnung behandeln kann (`CLAMAV_OPTIONAL=1` als Opt-out).

**Nachweis**
`apps/web/src/__tests__/lib/import-file-parser-limits.test.ts` (S04-06-Block): PE-Binary als
`.csv`/`text/csv`, ELF als `.xlsx`, PDF als Tabellenkalkulation werden mit
`UnsupportedUploadError` abgelehnt; echtes CSV ohne Magic Bytes wird weiterhin akzeptiert.
`packages/shared/tests/clamav.test.ts`: Default fail-open außerhalb, fail-closed in
Produktion, expliziter Opt-out.

---

### S04-07 · Low · Fragiles Roh-SQL mit manuellem Escaping (Translations)

**Status: geschlossen für den Pfad in WP5-Hoheit; zwei fremde Pfade übergeben**

**Änderung**

- `apps/web/src/app/api/v1/translations/import/route.ts` (beide Blöcke, XLIFF- und
  CSV-Importpfad): `sql.raw` mit interpoliertem `tableName`/`field`/`entityId`/`orgId`/`userId`
  und handgeschriebenem `''`-Escaping → parametrisierte ` sql` ``-Templates mit
  `sql.identifier()` für die allow-gelisteten Bezeichner und gebundenen Parametern für alle
  Werte. Der `orgFilter`-String ist durch ein `sql`-Fragment ersetzt.
  Die Allowlists (`ENTITY_TABLE_MAP`, `TRANSLATABLE_FIELDS`) und `UUID_RE` bleiben als äußere
  Schicht bestehen — der Fix beseitigt das _Regressionsrisiko des Mechanismus_, nicht eine
  aktuell ausnutzbare Lücke.

**Nachweis** `tsc --noEmit` und die bestehenden Übersetzungstests bleiben grün; es gibt in
diesen beiden Blöcken kein `sql.raw` mehr (`grep -n "sql.raw" …/translations/import/route.ts`
liefert nur noch Kommentartext).

**Zusatzbefund derselben Klasse — behoben (`S04-07-EXT`)**
`apps/web/src/lib/import-export/export-engine.ts` (WP5-Hoheit) baute die WHERE-Klausel als
String: der **Wert** wurde `''`-escaped, der **Spaltenname** — ein beliebiger
Query-Parametername, den `/export/[entityType]`, `/findings/export`, `/bcms/bia/export` und
`/dpms/ropa/export` unbesehen durchreichen — wurde ohne jedes Escaping in einen
doppelt-gequoteten Bezeichner interpoliert. Ein `"` im Parameter**namen** bricht aus:
`?title"='' OR 1=1 --=x` ergibt `WHERE "title"='' OR 1=1 --" = 'x'` und kommentiert die
`org_id`-Bedingung aus → **Cross-Tenant-Read** über eine für jeden Modulnutzer erreichbare
Route. Fix: Filterschlüssel müssen in den `exportColumns` der Entity-Definition stehen
(vorhandene Allowlist), Bezeichner über `sql.identifier()`, Werte und `org_id` als gebundene
Parameter; `sql.raw` ist aus der Funktion verschwunden.

---

### S04-08 · Low (Info) · Same-Origin-Proxy erlaubt Header-Injection

**Status: geschlossen**

**Änderung** `apps/web/src/app/api/v1/playground/execute/route.ts`: Header-**Allowlist**
(`content-type, accept, accept-language, if-match, if-none-match, x-request-id,
x-idempotency-key`) statt Durchreichen beliebiger Header. Verworfene Header werden in der
Antwort als `rejectedHeaders` gemeldet, damit der Drop nicht still ist. Zusätzlich ist die
Header-Map auf 20 Einträge begrenzt. Der Same-Origin-Gate aus `2ce8d6b8` ist unangetastet.

**Nachweis** `apps/web/src/__tests__/api/playground-header-allowlist-s04-08.test.ts`
(14 Tests, grün): `Authorization`, `Cookie`, `X-Forwarded-For`/`-Host`, `X-Real-IP`, `Host`,
`Origin`, `Referer`, `X-Org-Id`, `X-User-Id` werden verworfen und gemeldet; die
fachlich nötigen Header kommen an; der SSRF-Gate lehnt weiterhin
`http://169.254.169.254/…`, `//evil.example/` und `/\evil.example/` mit 422 ab.

---

### S04-09 · Low (Info) · GET-Handler ohne Query-Schema

**Status: geschlossen für die Routen in WP5-Hoheit (23 von 276); Rest übergeben**

**Änderung**

- **Neu `apps/web/src/lib/query-schema.ts`**: `parseQueryParams()` plus Primitive
  (`searchQueryParam` mit Längenbegrenzung, `uuidQueryParam`, `dateQueryParam`,
  `dateTimeQueryParam`, `booleanQueryParam`, `intQueryParam(min,max,default)`,
  `csvListQueryParam`). Leere Werte (`?status=`) werden wie „nicht gesetzt" behandelt, damit
  die bisherige Truthiness-Semantik erhalten bleibt; unbekannte Parameter (`page`, `limit`)
  werden gestrippt statt abgelehnt.
  **Verortung:** bewusst in `apps/web`, nicht in `packages/shared` — `@grc/shared` pinnt
  zod 3.25, `apps/web` löst zod 4.3 auf; ein v3-Schemaobjekt in einem v4-`z.object()` bricht
  zur Laufzeit. (Der erste Entwurf lag in `packages/shared/src/lib/query-validation.ts` und
  wurde deshalb verschoben; `packages/shared/src/index.ts` trägt einen Kommentar, der das
  festhält.)
- Abgearbeitet aus `evidence/S04/unvalidated-query-handlers.txt`, alle Routen in WP5-Hoheit:
  **ISMS (22):** `soa`, `soa/diff`, `soa/ai-gap-analysis`, `incidents`,
  `incidents/correlations`, `incidents/patterns`, `threats`, `threats/top`,
  `vulnerabilities`, `assessments`, `assessments/[id]/evaluations`,
  `assessments/[id]/risk-evaluations`, `reviews`, `reviews/[id]/dashboard`,
  `nonconformities`, `certification/snapshots`, `cve/feed`, `cve/matches`,
  `assets/classification-overview`, `assets/[id]/cpe`, `maturity/heatmap`, `posture/trend`.
  **Export (1):** `risks/export` — dort wurden zusätzlich zwei `split(",") as Array<…>`
  Blind-Casts durch echte Enum-Arrays ersetzt und `Number(scoreMin/scoreMax)` (NaN-fähig)
  durch begrenzte Integer.
  Wo eine echte pg-Enum existiert, ist das Schema daran gebunden (`…Enum.enumValues`), sonst
  an Form und Länge.
- Abgelehnte Werte ergeben jetzt **422 mit `details`** statt eines Postgres-500
  (`invalid input value for enum …`, `invalid input syntax for type uuid`) oder einer stillen
  NaN-Koerzion.

**Nachweis** `tsc --noEmit` grün; die bestehenden ISMS-Routentests bleiben grün.
Die verbleibenden ~253 Handler liegen in fremder Hoheit → Abschnitt 3.

---

### S10-16 · Medium · `changeStatus` der Automation-Engine schreibt in beliebige Tabelle

**Status: geschlossen**

**Änderung** `apps/worker/src/crons/automation-engine-init.ts`: neue Konstante
`AUTOMATION_STATUS_TABLES` (`risk, control, finding, incident, task, work_item, vendor,
asset`). `changeStatus` lehnt jeden anderen `entityType` ab und protokolliert ihn mit Org-
und Entity-ID. `document` steht bewusst **nicht** auf der Liste — das ist genau der im
Finding beschriebene Pfad zu `document-retention-purge.ts`, der
`status IN ('archived','expired')` hart löscht.

**Nachweis** `apps/worker/tests/crons/automation-change-status-allowlist.test.ts`
(15 Tests, grün): `document`, `document_version`, `audit_log`, `audit_log_archive`,
`whistleblow_report`, `user_organization_role`, `organization`, `pg_class`, `""` führen zu
**keinem** `db.execute`; die sechs erlaubten Entitäten führen weiterhin genau ein Update aus.

---

### S10-19 · Low · Latente SQL-Injection in `scheduled-export`

**Status: geschlossen**

**Änderung**

- `packages/shared/src/schemas/import-export.ts`: `importEntityTypeValues` wird exportiert,
  damit der Worker gegen dieselbe Liste prüfen kann, die die API erzwingt.
- `apps/worker/src/crons/scheduled-export.ts`:
  `sql.raw(\`SELECT COUNT(_) … FROM "${entityType}" WHERE org_id = '${schedule.org_id}'\`)`
→ Allowlist-Prüfung **vor** dem Query-Bau, danach
`` sql`SELECT COUNT(_) as cnt FROM ${sql.identifier(entityType)} WHERE org_id = ${schedule.org_id}::uuid` ``.
  Ein abgelehnter Entity-Typ überspringt nur diesen Eintrag und erscheint als Fehlermeldung —
  der übrige Zeitplan läuft weiter.

**Nachweis** `apps/worker/tests/crons/scheduled-export-sql-guard.test.ts` (8 Tests, grün):
`risk" WHERE 1=1 UNION SELECT 1 --`, `risk"; DROP TABLE audit_log; --`,
`risk" ; COPY t FROM PROGRAM 'id'; --`, `audit_log`, `organization`, `""` erzeugen **kein**
Count-Statement und eine Fehlermeldung; ein erlaubter Typ ergibt ein Statement mit
`"risk"` als Bezeichner und `org_id = $n` als gebundenem Parameter (kein `org_id = '…'`);
ein gemischter Zeitplan verarbeitet den gültigen Eintrag weiter.

---

## 2. Änderungen außerhalb der engen Dateihoheit

| Datei                                                                                                                                                       | Grund                                                                                                                                                            | Umfang                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `packages/auth/src/saml/metadata-parser.ts`                                                                                                                 | WP3-Hoheit. S04-02 ist ohne diese Zeile nicht schließbar.                                                                                                        | 1 Import + 1 `fetch`→`safeFetch` (+ Kommentar). Keine Parsing-/Signaturlogik.                                 |
| `packages/auth/src/oidc/discovery.ts`                                                                                                                       | dito                                                                                                                                                             | dito                                                                                                          |
| `packages/shared/src/lib/clamav.ts`                                                                                                                         | S04-06 verlangt fail-closed in Prod; Datei ist keinem Paket zugewiesen.                                                                                          | `isClamAvFailClosed()` umgebaut, `isClamAvRequired()` ergänzt, Test angepasst.                                |
| `packages/shared/src/lib/excel-to-bpmn.ts`                                                                                                                  | S04-04 betrifft diesen zweiten `xlsx.load()`-Aufrufer; Datei ist keinem Paket zugewiesen.                                                                        | 1 Import + 1 Pre-Flight-Zeile.                                                                                |
| `apps/web/src/lib/ropa-export.ts`                                                                                                                           | Implementierung der beiden ROPA-`export/route.ts`, die in WP5-Hoheit liegen.                                                                                     | `csvCell()` delegiert an `toCsvCell`.                                                                         |
| `apps/web/src/app/api/v1/audit-mgmt/audits/[id]/audit-pack/route.ts`, `.../tprm/vendors/[id]/onboarding-pack/route.ts`, `.../processes/audit-pack/route.ts` | Identischer S04-05-Defekt, keinem Paket zugewiesen. Sie stehen zu lassen hätte den Fix zu einem Placebo gemacht.                                                 | lokale `csv()`-Helfer delegieren an `toCsvCell`; im Prozess-Audit-Pack zwei handgebaute Quote-Blöcke ersetzt. |
| `apps/web/src/lib/query-schema.ts` (neu)                                                                                                                    | S04-09-Helfer; musste wegen des zod-3/4-Splits aus `packages/shared` nach `apps/web` wandern.                                                                    | neue Datei, keine bestehende berührt.                                                                         |
| `apps/web/src/__tests__/lib/export-engine-pdf.test.ts`                                                                                                      | Der `drizzle-orm`-Stub des Tests kannte nur `sql` und `sql.raw`. Nach dem `S04-07-EXT`-Fix braucht `fetchEntityData` zusätzlich `sql.identifier` und `sql.join`. | 2 Zeilen im Mock; die vier Zusicherungen des Tests sind unverändert.                                          |
| `packages/shared/tests/clamav.test.ts`                                                                                                                      | Der Test pinnte „Default = fail-open" — nach S04-06 ist der Default umgebungsabhängig.                                                                           | Ein Test aufgeteilt in „außerhalb Produktion" und „in Produktion" (via `vi.stubEnv`).                         |

---

## 3. Bedarf an andere Pakete

1. **WP7 (DMS) — Magic-Byte-Prüfung und ClamAV im Dokument-Upload einbinden.**
   `apps/web/src/app/api/v1/documents/[id]/upload/route.ts` prüft weiterhin nur
   `file.type` (Client-Header) und persistiert diesen Wert als `mimeType`.
   Bitte einbinden:
   ```ts
   import { verifyUploadSignature } from "@grc/shared";
   import { isClamAvRequired } from "@grc/shared/lib/clamav";

   const sig = verifyUploadSignature(buffer, {
     allowedMimes: ALLOWED_MIMES,
     declaredMime: file.type,
   });
   if (!sig.ok) return Response.json({ error: sig.reason }, { status: 415 });
   // …und sig.detectedMime statt file.type persistieren/ausliefern.
   ```
   Zusätzlich: `scan.status === "skipped"` sollte in Produktion abgelehnt werden, wenn
   `isClamAvRequired()` true ist — heute ist ein nie konfiguriertes ClamAV dasselbe Loch wie
   ein fail-open-Fehler. `isClamAvFailClosed()` ist bereits umgestellt und wirkt ohne weitere
   Änderung.
2. **WP7/WP8 — CSV-Formula-Injection in den übrigen Exportpfaden.**
   `apps/web/src/app/api/v1/dpms/data-breach/[id]/notification-pack/route.ts` enthält denselben
   lokalen `csv()`-Helfer ohne `=+-@`-Neutralisierung (Zeile 9). Ersetzen durch
   `toCsvCell` aus `@/lib/import-export/csv-sanitizer` (Muster wie im Audit-Pack).
   `dpms/ropa/export` und `policies/**` bitte gegenprüfen.
3. **Eigentümer von `audit-mgmt/continuous-rules` — Fehlermeldung nachziehen.**
   Die Route meldet bei Ablehnung noch „INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE
   are not allowed". Der Guard ist jetzt eine Allowlist; besser
   `validateCustomAuditSql(query).reason` durchreichen — die Funktion liefert bereits einen
   operatortauglichen Grund. Rein kosmetisch, sicherheitsrelevant ist nichts.
4. **Eigentümer von `import/upload` und `processes/import-excel` — Fehlercodes.**
   `parseFile()` wirft jetzt `ImportTooLargeError` / `UnsupportedUploadError`,
   `convertExcelToBPMN()` wirft `ZipBombError`. Beide Routen fangen generisch und antworten 500. Sicherheitstechnisch fail-closed und korrekt, aber 413/415/422 wäre die richtige
   Antwort. Kein WP5-Fix, weil die Routen nicht in WP5-Hoheit liegen.
5. **Produkt/Architektur — Nachfolge für `custom_sql`.**
   Empfehlung als eigenes Backlog-Item: parametrisierte Regelsprache oder Allowlist geprüfter
   Prüf-Queries, dazu `executeBuiltinRule()` tatsächlich implementieren. Bis dahin ist der
   Zustand nach diesem Paket der von `bi-reports/execute` — bewusst gleichgezogen, nicht
   besser (siehe Abschnitt 0).
6. **WP2 (RLS) — Abhängigkeit beachten.**
   Der S04-01-Fix stützt sich darauf, dass die Rolle `grc_app` existiert, **kein** `BYPASSRLS`
   hat und die RLS-Policies der von Audit-Regeln gelesenen Tabellen greifen. Fällt S01-02
   (`app.bypass_rls`-Escape-Hatch, von `grc_app` selbst setzbar) nicht, bleibt eine
   Cross-Tenant-Restfläche bestehen — dann allerdings über die Policy, nicht über diesen
   Endpunkt.
7. **Keine neue Migration erforderlich.** WP5 hat keine Schemaänderung gebraucht; der
   reservierte Nummernkreis wurde nicht angefasst.

---

## 4. Restrisiko

- **TOCTOU zwischen DNS-Prüfung und `fetch`.** `safeFetch` löst den Hostnamen auf, prüft die
  IP und ruft dann `fetch` auf, das **erneut** auflöst. Ein Angreifer mit Kontrolle über einen
  DNS-Server und sehr kurzer TTL kann das Fenster theoretisch treffen. Der robuste Fix ist ein
  eigener undici-Dispatcher, der die geprüfte IP pinnt (`lookup`-Hook) — bewusst nicht in
  diesem Paket, weil er das HTTP-Stack-Verhalten aller ausgehenden Aufrufe ändert.
- **`custom_sql` bleibt eine Lesefläche.** Nach dem Fix kann ein Org-Admin/Auditor per Regel
  jede Zeile lesen, die `grc_app` in seiner eigenen Organisation lesen darf — inklusive
  Spalten, für die es keine eigene API-Route gibt. Das ist eine bewusst akzeptierte
  Konsequenz der Beibehaltung des Features und identisch zur Lage bei `bi-reports/execute`.
- **`assertZipWithinLimits` vertraut dem Central Directory.** Ein Archiv kann eine kleine
  unkomprimierte Größe deklarieren und beim Entpacken mehr liefern. Die zweite und dritte
  Schicht (Streaming-Reader, Zeilen-/Zellengrenzen) fangen das ab; die Pre-Flight-Prüfung ist
  die billige erste Schicht, nicht die einzige.
- **Magic Bytes sind keine Inhaltsprüfung.** Eine Datei mit `%PDF`-Header und beliebigem Rest
  passiert die Signaturprüfung. Der Fix schließt „beliebiger Inhalt als PDF deklariert",
  nicht „bösartiges PDF". Dafür bleibt ClamAV (jetzt in Produktion fail-closed) zuständig.
- **S04-09 ist nur zu ~8 % abgedeckt** (23 von 276 Handlern) — die übrigen liegen in fremder
  Hoheit. Der Bericht stuft das Finding als reines Robustheitsthema ein (kein SQLi, `paginate()`
  clampt), das Restrisiko ist entsprechend inkonsistente Fehlerbehandlung, nicht Sicherheit.
- **Verhaltensänderung: ausgehendes Klartext-HTTP.** Threat-Feeds über `http://` werden ab
  jetzt abgelehnt, solange `WEBHOOK_ALLOW_HTTP=1` nicht gesetzt ist; SAML-/OIDC-Ziele
  ausnahmslos (`requireHttps`). Falls Pilotkunden HTTP-Feeds betreiben, ist das eine
  bewusste, dokumentierte Regression.

---

## 5. Verifikationslauf (Stand Abschluss WP5)

| Lauf                             | Ergebnis                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared` — `vitest run` | **80 Dateien / 1 923 Tests grün** (inkl. `url-safety-ssrf-s04`, `zip-safety-s04-04`, angepasster `clamav`)                                                                                                                                                                                                                                                                                                                                            |
| `packages/auth` — `vitest run`   | **12 Dateien / 196 Tests grün** (inkl. `sso-ssrf-s04-02`)                                                                                                                                                                                                                                                                                                                                                                                             |
| `apps/worker` — `vitest run`     | **128 Dateien / 231 Tests grün** (inkl. der vier neuen WP5-Suiten)                                                                                                                                                                                                                                                                                                                                                                                    |
| `apps/worker` — `tsc --noEmit`   | **fehlerfrei**                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `apps/web` — `vitest run`        | 4 673 grün / 526 skipped; **alle WP5-Suiten grün**. Verbleibende Fehlschläge ausschließlich in Dateien anderer, parallel laufender Pakete: `portal-auth.test.ts` + `with-auth.test.ts` (`lib/api.ts`, `packages/auth/src/anonymous-token.ts` → WP3), `audit-rbac-matrix.test.ts` (`audit-mgmt/audits/[id]/sign-off/route.ts` → WP4). `export-engine-pdf.test.ts` schlug durch den WP5-Fix fehl und wurde mitgezogen (siehe Abschnitt 2) — jetzt grün. |
| `apps/web` — `tsc --noEmit`      | Keine Fehler in WP5-Dateien. Die 5 verbleibenden Fehler stammen aus fremden, in Arbeit befindlichen Dateien: `admin/scim/tokens` und `s02-02-privilege-escalation.test.ts` (WP3), `health/schema-drift` (WP1), `processes/[id]/approval-steps/[stepId]/decide` (fremd).                                                                                                                                                                               |

**Neue Tests dieses Pakets — 162 Fälle in 10 Dateien:**

| Datei                                                                   | Fälle | Finding        |
| ----------------------------------------------------------------------- | ----- | -------------- |
| `apps/worker/tests/crons/continuous-audit-runner-sql-guard.test.ts`     | 13    | S04-01         |
| `packages/shared/tests/url-safety-ssrf-s04.test.ts`                     | 41    | S04-02/-03     |
| `packages/auth/tests/sso-ssrf-s04-02.test.ts`                           | 21    | S04-02         |
| `apps/worker/tests/crons/threat-feed-sync-ssrf.test.ts`                 | 9     | S04-03         |
| `packages/shared/tests/zip-safety-s04-04.test.ts`                       | 8     | S04-04         |
| `apps/web/src/__tests__/lib/import-file-parser-limits.test.ts`          | 8     | S04-04, S04-06 |
| `apps/web/src/__tests__/api/csv-formula-injection-s04-05.test.ts`       | 25    | S04-05         |
| `apps/web/src/__tests__/api/playground-header-allowlist-s04-08.test.ts` | 14    | S04-08         |
| `apps/worker/tests/crons/automation-change-status-allowlist.test.ts`    | 15    | S10-16         |
| `apps/worker/tests/crons/scheduled-export-sql-guard.test.ts`            | 8     | S10-19         |

Jeder dieser Tests hätte den Zustand **vor** dem Fix auffallen lassen: die Nutzlast wäre an
die Datenbank gegangen (S04-01, S10-19), `fetch` wäre auf die private Adresse gelaufen
(S04-02/-03), die Bombe hätte geparst (S04-04), die Zelle hätte mit `=` begonnen (S04-05),
das Binary hätte den Parser erreicht (S04-06), der Header wäre weitergereicht worden (S04-08),
das `UPDATE` auf `document` wäre ausgeführt worden (S10-16).

**Nicht committet** — gemäß Auftrag bleibt der Commit dem Integrationsschritt vorbehalten.
