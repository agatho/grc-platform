# S08 — Secrets, Lieferkette, Lizenzen, Repository-Exposure

**Audit-ID:** ARCTOS-FULL-2026-08-31 · **Stream:** S08
**Prüfgegenstand:** `/work/repo` @ `a8d1414f` (Origin `https://github.com/agatho/grc-platform.git`)
**Stand:** 2026-08-31
**Bezug:** AUDIT_PLAN.md §S08 (Methodik 1–7), §4 (Severity-Rubrik, Evidenzpflicht), Baseline BASE-001

---

## 1. Zusammenfassung

**Das wichtigste Ergebnis vorweg — und es ist ein gutes:** In der vollständigen Git-Historie (1.174 Commits, 70 Refs, 10.270 Blobs, 196 MB) findet sich **kein einziges gültiges Provider-Secret**. Keine `sk-`/`sk-ant-`-Keys, keine `ghp_`/`github_pat_`-Tokens, keine `AKIA`/`ASIA`-Credentials, keine `xoxb-`-Tokens, keine privaten Schlüssel, keine JWTs, keine `.env`-Datei, kein DB-Dump. Alle 475 Treffer meines Scans sind Entwicklungs-Defaults, CI-Testpasswörter oder Shell-Variablen-Referenzen. Die `.gitignore`/`.dockerignore`-Hygiene ist sauber, das CI-Gate „Check for .env files in repo" funktioniert. Die Tragweite von BASE-001 ist damit **keine Credential-Kompromittierung**.

**Was BASE-001 stattdessen exponiert**, ist eine vollständige Angriffskarte: `docs/security/lod-coverage.csv` listet alle 1.801 Route/Methode-Paare mit ihrem Auth-Typ, ihren Rollenanforderungen und den 7 anonymen Endpunkten; `docs/openapi.yaml` (1,4 MB) nennt `https://arctos.charliehund.de` als Produktionsserver; `deploy/` liefert die komplette Betriebstopologie mit. Dazu der vollständige Quellcode eines unter **PolyForm Shield 1.0.0** — also gerade _nicht_ offen — lizenzierten kommerziellen Produkts.

**Die drei ernsthaftesten eigenständigen Befunde:**

1. **Lizenzverletzung (S08-02, High).** `apps/web/src/components/bpmn/bpmn-editor.css:14-17` blendet das bpmn.io-Wasserzeichen per `display: none !important` aus. Die bpmn-js-Lizenz verbietet das wörtlich und ausdrücklich. Das ist keine Härtungsempfehlung, sondern ein laufender Verstoß gegen die Nutzungsbedingungen der zentralen Modellierungskomponente des Produkts — im BPMN-Modul, das ARCTOS als Kernfeature vermarktet.
2. **Das CI-Security-Gate ist auf HEAD rot (S08-03, High).** `node scripts/audit-gate.mjs` bricht auf `a8d1414f` mit Exit 1 und drei nicht allowlisteten High-Advisories ab — darunter `pdfjs-dist` GHSA-hq66-cqwq-w95j (JS-Ausführung beim Öffnen einer manipulierten PDF), und `pdfjs-dist` verarbeitet in `apps/web/src/lib/documents/extract-text.ts` genau die vom Nutzer hochgeladenen DMS-Dokumente.
3. **`aquasecurity/trivy-action@master` (S08-05, High)** — eine bewegliche Branch-Referenz auf eine Drittanbieter-Action, in einem Job mit `packages: write` und `secrets.GITHUB_TOKEN`. Insgesamt sind 42 von 50 Action-Referenzen ungepinnt, obwohl der Kommentar in `coverage.yml:37` behauptet, alle seien SHA-gepinnt.

**Lizenzlage sonst:** entspannt. 847 Pakete, davon 690 MIT — kein GPL, kein AGPL, kein SSPL, kein CC-BY-SA im Baum. Es gibt aber **keine SBOM** und **keine NOTICE-/THIRD-PARTY-Datei**, und das CI-Lizenz-Gate ist so formuliert, dass es moderne SPDX-Kennungen systematisch verfehlt — es hätte den bpmn-js-Fall nie gefunden.

| Severity  | Anzahl |
| --------- | ------ |
| Critical  | 0      |
| High      | 5      |
| Medium    | 9      |
| Low       | 8      |
| Info      | 4      |
| **Summe** | **26** |

---

## 2. Methodik-Protokoll

Alle Schritte read-only gegen `/work/repo`; Schreibzugriffe ausschließlich nach `/work/audit/findings/` und `/work/audit/evidence/S08/`. `npm audit` wurde nie mit `--fix` aufgerufen. **Es wurde kein einziger Authentifizierungsversuch gegen einen fremden Dienst unternommen** — die Bewertung aller Fundstellen erfolgt ausschließlich nach Muster, Kontext und Code-Umgebung (AUDIT_PLAN §S08, Regel 3).

### 2.1 Prüfumfang (nachgezählt, nicht aus Doku übernommen)

| Metrik                       | Wert                                                              | Befehl                                           |
| ---------------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| Commits über alle Refs       | 1.174                                                             | `git rev-list --all --count`                     |
| Refs (lokal + remote)        | 70                                                                | `git for-each-ref \| wc -l`                      |
| Blobs in der Objektdatenbank | 10.270                                                            | `git cat-file --batch-all-objects --batch-check` |
| Blob-Volumen gesamt          | 196.562.009 Bytes                                                 | ebd., aufsummiert                                |
| Zeitraum                     | 2026-03-24 … 2026-08-31                                           | `git log --all --format=%ad`                     |
| Workflows                    | 10                                                                | `ls .github/workflows`                           |
| Installierte npm-Pakete      | 599 Verzeichnisse / 847 Lizenz-Einträge / 1.139 Dependency-Knoten | `npm audit` metadata                             |

### 2.2 Punkt 1 — Secret-Scan über die gesamte Historie

**Werkzeug A: gitleaks 8.21.2** (Binary-Download, `gitleaks detect --source .`).
→ 3 Treffer, alle Falsch-Positive: ein 64-stelliger Test-Vektor `0123…` in `packages/shared/tests/wb-crypto.test.ts:7` und zweimal derselbe i18n-Schlüssel `nav.…` in `module-tab-config.ts:226`.
Rohdaten: `/work/audit/evidence/S08/gitleaks-history.json`

**Werkzeug B: eigener erschöpfender Blob-Scanner** (`/work/audit/evidence/S08/scan_blobs.py`).
gitleaks' Standardregelwerk ist bewusst konservativ; um die Evidenzpflicht zu erfüllen, habe ich zusätzlich **jeden einzelnen der 10.270 Blobs** über `git cat-file --batch --batch-all-objects` gestreamt und gegen 29 Provider-Muster geprüft. `--batch-all-objects` erfasst dabei die gesamte Objektdatenbank, also auch Blobs aus den 68 Remote-Branches und aus unreferenzierten Commits — nicht nur den von HEAD erreichbaren Verlauf.

Geprüfte Muster: `sk-`, `sk-ant-`, `ghp_`, `github_pat_`, `gho_`, `ghs_`, `AKIA`/`ASIA`/`ABIA`/`ACCA`, `aws_secret_access_key=`, `xox[baprs]-`, Slack-Webhooks, `re_`, `AIza`, Stripe `sk_live`/`sk_test`/`rk_`, `SG.`, `-----BEGIN … PRIVATE KEY-----`, `-----BEGIN CERTIFICATE-----`, JWT (`eyJ….eyJ….`), Connection-Strings mit Passwort für PostgreSQL/MySQL/MongoDB/Redis/AMQP/HTTP-Basic, `npm_`, `glpat-`, Twilio-SID, Azure `AccountKey=`, `MINIO_ROOT_PASSWORD`, sowie ein breites generisches `…(secret|key|token|password)…= "…"`-Muster mit Platzhalter-Filterung.

Rohdaten: `/work/audit/evidence/S08/blob-scan-hits.jsonl` (475 Treffer, Werte redigiert).

**Ergebnis nach Regelklasse — die entscheidende Tabelle:**

| Musterklasse                                                                                                                                                                                | Treffer | Bewertung                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| `pg_conn_with_pw`                                                                                                                                                                           | 429     | Dev-/CI-Defaults + `${VAR}`-Referenzen                                            |
| `resend_key`                                                                                                                                                                                | 19      | ausschließlich `re_test_placeholder` / `re_dummy_…`                               |
| `minio_root_pw`                                                                                                                                                                             | 14      | ausschließlich `${MINIO_ROOT_PASSWORD…}`-Referenzen                               |
| `generic_secret_assign`                                                                                                                                                                     | 8       | Testfixture-Passwörter in `*.test.ts`                                             |
| `redis_conn_with_pw`                                                                                                                                                                        | 3       | ausschließlich `${REDIS_PASSWORD}`-Referenzen                                     |
| `certificate_block`                                                                                                                                                                         | 2       | String-Literal `"-----BEGIN CERTIFICATE-----"` im SAML-Validator, kein Zertifikat |
| **`openai_key`, `anthropic_key`, `github_pat_*`, `aws_*`, `slack_*`, `google_api_key`, `stripe_*`, `sendgrid`, `private_key_block`, `jwt`, `npm_token`, `gitlab_pat`, `azure_storage_key`** | **0**   | **kein Treffer über die gesamte Historie**                                        |

**Werkzeug C: Datei-typ-Suche über alle je existierten Pfade.** Über `git rev-list --all --objects` nach `.pem`, `.p12`, `.pfx`, `.key`, `.crt`, `.jks`, `.keystore`, `.kdbx`, `.ovpn`, `.htpasswd`, `.netrc`, `.npmrc`, `.dump`, `.bak`, `.sqlite`, `id_rsa`, `id_ed25519`, `secrets.*` und `.env`:
→ **Nur drei Treffer, alle legitime Templates:** `.env.example`, `deploy/.env.production.example`, `deploy/.env.sample`. Zusätzlich `git log --all --diff-filter=D` auf dieselben Endungen: **keine je gelöschte Secret-Datei** — also auch kein „einmal committet, später entfernt, aber in der Historie noch da"-Fall.

### 2.3 Punkt 2 — Tragweite der öffentlichen Sichtbarkeit

Inventarisierung der bei öffentlicher Lesbarkeit mitgelieferten Artefakte (→ S08-01). Gültigkeitsbewertung der Fundstellen rein nach Muster/Kontext; kein Netzwerkzugriff gegen fremde Dienste.

### 2.4 Punkt 3 — Abhängigkeiten

`npm audit --json` (gesamt) und `npm audit --omit=dev --json` (Produktionsbaum, das was das CI-Gate sieht) → `/work/audit/evidence/S08/npm-audit.json`, `npm-audit-prod.json`. `npm outdated --json` → `npm-outdated.json`. `npm ls <pkg> --omit=dev --all` zur Herkunftsbestimmung jeder verwundbaren Transitive. Install-Skripte über alle 467 Produktionsknoten via Auswertung der `scripts`-Felder. Ausführung von `node scripts/audit-gate.mjs` zur Reproduktion des CI-Verhaltens.

### 2.5 Punkt 4 — Lizenzen

`npx license-checker-rseidelsohn --json` über den Gesamtbaum → `/work/audit/evidence/S08/licenses-all.json` (847 Pakete). Abgleich gegen den Produktionsbaum (`npm ls --omit=dev --all --parseable`, 467 Knoten) zur Scope-Trennung. Copyleft-/Unklar-Filter (GPL, AGPL, SSPL, CC-BY-SA, EUPL, CDDL, MPL, OSL, EPL, BUSL, UNKNOWN, UNLICENSED, Custom) → `licenses-flagged.csv`. Für jeden Treffer die Original-LICENSE-Datei aus `node_modules/` gelesen — so kam der bpmn-js-Verstoß ans Licht, den die Metadaten (`"license": "SEE LICENSE IN LICENSE"`) nicht zeigen.

### 2.6 Punkt 5 — GitHub-Actions-Sicherheit

Alle 10 Workflows vollständig gelesen. Auswertung von `on:`-Triggern, `permissions:`-Blöcken (Workflow- und Job-Ebene), Secret-Nutzung, Action-Pinning (Tag vs. 40-stelliger SHA), Cache-Konfiguration und Job-Reihenfolge.

### 2.7 Punkt 6 — Docker

`Dockerfile`, `Dockerfile.worker`, `.dockerignore`, `docker-compose.yml`, `docker-compose.production.yml`, `deploy/docker-compose.yml`, `docker/init-extensions.sql` gelesen. Abgleich, welche getrackten Pfade der `.dockerignore` entkommen und damit im Runtime-Image landen.

### 2.8 Punkt 7 — SBOM

Suche nach `sbom`, `cyclonedx`, `spdx` über `.github/`, `scripts/`, `docs/`, `package.json`: **null Treffer**.

### 2.9 Falsch-Positiv-Abgrenzung (AUDIT_PLAN §4)

Vier Verdachtsfälle wurden geprüft und aufgrund einer kompensierenden Kontrolle **herabgestuft**; die Prüfung ist bei den jeweiligen Findings dokumentiert:

| Verdacht                                                                   | Kompensierende Kontrolle                                                                                                                                                                                                                  | Ergebnis                                                |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `CRON_SECRET=arctos-cron-secret-change-in-production` in `.env.example:91` | `deploy/create-tenant.sh:54` + `setup-hetzner.sh:75` erzeugen `openssl rand -hex 16`; `docker-compose.production.yml:222` nutzt `${CRON_SECRET:?…}` (Fail-Fast)                                                                           | High → **Low** (S08-18)                                 |
| `CONNECTOR_ENCRYPTION_KEY` ohne Fail-Fast in Compose                       | `packages/shared/src/env-key.ts:23-35` `getRequiredHexKey()` wirft bei fehlendem/kurzem/nicht-hex Schlüssel — kein stiller Fallback auf einen Null-Key (der laut Kommentar in `credentials/route.ts:16` historisch existierte)            | Critical → **Low** (S08-17)                             |
| GHA-Cache-Poisoning über `type=gha` (`ci.yml:608-609`, `:620-621`)         | Der Docker-Job läuft nur bei `push` auf `main` (`ci.yml:573`); PR-Branches befüllen den `scope=web`/`scope=worker`-Cache also nie, und das GHA-Cache-Scoping lässt keinen Schreibzugriff von einem Branch auf den Default-Branch-Scope zu | Medium → **verworfen**, nur hier dokumentiert           |
| `deploy/.env.production.example` landet im Docker-Build-Kontext            | Nur Template mit `CHANGE_ME…`-Werten; im Web-Image außerdem nicht in die Runtime-Stage kopiert                                                                                                                                            | verworfen (bleibt Teil von S08-11 für das Worker-Image) |

---

## 3. Secret-Fundstellen (redigiert)

Format: `Präfix***[Länge]***`. **Kein vollständiges Secret erscheint in diesem Dokument oder in den Evidenzdateien.** Alle Fundstellen sind nach Muster und Umgebungskontext bewertet, nicht durch Ausprobieren.

### 3.1 Übersicht aller Fundklassen

| #   | Regel                   | Präfix                      | Länge | Blobs | in HEAD | Pfade (Auswahl)                                                                       | Bewertung                           |
| --- | ----------------------- | --------------------------- | ----- | ----- | ------- | ------------------------------------------------------------------------------------- | ----------------------------------- |
| A   | `pg_conn_with_pw`       | `grc_`                      | 16    | 71    | 9       | `.env.example`, `SETUP.md`, `docs/DEVELOPER_GUIDE.md`, `packages/db/tests/helpers.ts` | Dev-Default `grc_dev_password`      |
| B   | `pg_conn_with_pw`       | `plac`                      | 11    | 53    | 2       | `.github/workflows/ci.yml`, `Dockerfile`                                              | Literal `placeholder`               |
| C   | `pg_conn_with_pw`       | `grc_`                      | 17    | 49    | 1       | `.github/workflows/ci.yml`                                                            | CI-Testpasswort `grc_test_password` |
| D   | `resend_key`            | `re_t`                      | 19    | 17    | 2       | `.env.example`, `packages/email/src/EmailService.ts`                                  | Platzhalter `re_test_placeholder`   |
| E   | `pg_conn_with_pw`       | `grc_`                      | 20    | 13    | 2       | `.env.example`, `ci.yml`                                                              | Dev-Default `grc_app_dev_password`  |
| F   | `minio_root_pw`         | `${MI`                      | 24    | 7     | 1       | `docker-compose.production.yml`                                                       | Shell-Referenz, kein Wert           |
| G   | `pg_conn_with_pw`       | `CHAN`                      | 15    | 6     | 1       | `deploy/.env.production.example`                                                      | Template `CHANGE_ME_DB_PW`          |
| H   | `pg_conn_with_pw`       | `${DB`/`${GR`/`${MA`/`$DB_` | 6–33  | 17    | 4       | `docker-compose.production.yml`, `deploy/*.sh`                                        | Shell-Referenzen, kein Wert         |
| I   | `redis_conn_with_pw`    | `${RE`                      | 31    | 3     | 1       | `deploy/docker-compose.yml`                                                           | Shell-Referenz                      |
| J   | `generic_secret_assign` | `1234`/`Secu`/`Str0`/`admi` | 8–13  | 7     | 4       | `packages/shared/tests/schemas.test.ts`, `packages/db/src/seed.ts`                    | Testfixtures                        |
| K   | `certificate_block`     | `----`                      | 27    | 2     | 1       | `packages/auth/src/saml/response-validator.ts`                                        | String-Literal zum PEM-Zusammenbau  |
| L   | `pg_conn_with_pw`       | `***`                       | 3     | 4     | 1       | `docs/env-vars-reference.md`                                                          | in der Doku bereits selbst maskiert |

### 3.2 Detailbewertung der relevanten Klassen

**A/C/E — Datenbank-Entwicklungspasswörter.**
`.env.example:18` (HEAD, seit 2026-03-24):

```
DATABASE_URL=postgresql://grc:grc_***[len=16]***@localhost:5432/grc_platform
```

`.github/workflows/ci.yml:148,271,427`:

```
PGPASSWORD=grc_***[len=17]*** psql -h localhost -U grc -d grc_platform_test -f "$f" 2>&1 || true
```

Beide Werte binden ausschließlich an `localhost` bzw. den CI-Service-Container. Kein Produktivbezug — die produktiven Passwörter werden in `deploy/setup-hetzner.sh:75 ff.` und `deploy/create-tenant.sh:54 ff.` per `openssl rand` erzeugt und leben in `.env`-Dateien außerhalb des Repos (ADR-018). **In HEAD noch vorhanden: ja.** → S08-18 (Low).

**D — Resend-Platzhalter.**
`packages/email/src/EmailService.ts` (HEAD):

```
if (!key || key === "re_t***[len=19]***") {
```

Der Platzhalter dient als Sentinel, um den E-Mail-Versand bei unkonfiguriertem Key abzuschalten. Das ist korrektes Verhalten, kein Leak. Ein zweiter Wert `re_d***[len=20]***` (`new Resend("re_d…")`) existiert nur in einem historischen Blob. Beide Werte haben nicht die Struktur eines echten Resend-Keys. **Kein Handlungsbedarf.**

**J — Testfixture-Passwörter.**
`packages/shared/tests/schemas.test.ts` (HEAD, Zeilen 457/474/505 laut dem repo-eigenen Report):

```
password: "Secu***[len=13]***",
password: "Str0***[len=11]***",
password: "1234***[len=8]***",
```

Zod-Schema-Tests für Passwort-Validierungsregeln. Fachlich notwendig, kein Secret. `packages/db/src/seed.ts` (nur historisch) enthielt `// 3. Create admin user (password: "admi***[len=8]***" — dev only)`. **Kein Handlungsbedarf**, aber sie sind der Grund, warum der repo-eigene Scanner dauerhaft 6 „medium"-Findings meldet und damit abstumpft (→ S08-14).

**K — Kein Zertifikat, sondern ein Format-String.**
`packages/auth/src/saml/response-validator.ts` (HEAD):

```
: `----***[len=27]***\n${idpCertPem}\n-----END CERTIFICATE-----`;
```

Das IdP-Zertifikat kommt aus der Variable `idpCertPem`; hier wird nur der PEM-Rahmen ergänzt. Falsch-Positiv.

### 3.3 Negativ-Nachweis (Info, S08-24)

Über **alle** 10.270 Blobs und 70 Refs: **0 Treffer** für OpenAI-, Anthropic-, GitHub-, AWS-, Slack-, Google-, Stripe-, SendGrid-, npm-, GitLab-, Azure-Muster, für private Schlüsselblöcke und für JWTs. Für einen 1.174-Commit-Verlauf mit KI-Assistenz-Anteil (326 Commits von `claude-cowork@arctos.dev`) und einem Repo mit AI-Provider-Anbindung ist das ein bemerkenswert sauberes Ergebnis und verdient, im Abschlussbericht als solches genannt zu werden. **Es entlastet BASE-001 erheblich:** die öffentliche Sichtbarkeit hat keine Credentials preisgegeben.

---

## 4. Abhängigkeits- und Lizenzauswertung

### 4.1 `npm audit` — Ist-Stand auf `a8d1414f`

Gesamtbaum (1.139 Knoten): **8 Advisories — 5 high, 3 moderate, 0 critical.**
Produktionsbaum (`--omit=dev`, 467 Knoten): **6 Advisories — 3 high, 3 moderate.**

| Paket                | Sev      | direkt             | Advisory                                                                                                                                        | Produktionspfad                                                                 | Bewertung                                  |
| -------------------- | -------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------ |
| `pdfjs-dist` 5.7.284 | **high** | ja (`apps/web`)    | GHSA-hq66-cqwq-w95j — JS-Ausführung beim Öffnen einer manipulierten PDF                                                                         | `apps/web/src/lib/documents/extract-text.ts:69`                                 | **S08-04** — liegt auf dem DMS-Upload-Pfad |
| `undici`             | high     | nein               | GHSA-4cwx-7wf7-3272 (CVSS 7,4, Cross-User-Informationsleck über Cache-Direktiven) + 4 weitere                                                   | nur devDependency-Baum                                                          | S08-20                                     |
| `js-yaml`            | high     | nein               | GHSA-5p4m-2wfm-xmqj (quadratischer CPU-Verbrauch)                                                                                               | nur dev                                                                         | S08-20                                     |
| `brace-expansion`    | high     | nein               | GHSA-mh99-v99m-4gvg **und** GHSA-rgw5-rvv9-x895                                                                                                 | **prod:** `@grc/reporting → exceljs → archiver → glob/readdir-glob → minimatch` | **S08-06** — Allowlist-Begründung falsch   |
| `nanoid`             | high     | nein               | GHSA-2v37-7h3g-55p8 (Endlosschleife bei size 0)                                                                                                 | prod: `apps/web → @tailwindcss/postcss → postcss`                               | S08-03                                     |
| `hono` 4.12.33       | moderate | ja (`apps/worker`) | GHSA-f23p-vx2j-j53r — `memo()` hält SSR-Output über Requests hinweg → **Cross-User-Datenoffenlegung**; + ReDoS in CORS- und Language-Middleware | prod, Worker-Runtime                                                            | S08-20                                     |
| `next`               | moderate | ja                 | via `postcss`                                                                                                                                   | prod                                                                            | S08-20                                     |
| `postcss`            | moderate | nein               | GHSA-fxqj-rqcc-2cmp — Pfad-Traversal über `sourceMappingURL`                                                                                    | prod                                                                            | S08-20                                     |

**Veraltete Pakete:** 44 insgesamt, davon **10 eine Major-Version zurück** (`npm-outdated.json`): `@tanstack/react-table` 8→9, `@types/node` 22→26, `eslint` 9→10, `jsdom` 29→30, `motion` 12→13, `openai` 6→7, **`pdfjs-dist` 5.7.284→6.3.289**, `react-grid-layout` 1→2, `svix` 1→2.

**Install-Skripte im Produktionsbaum.** Von 467 Knoten deklarieren 81 ein Lifecycle-Skript, aber nur **2 führen bei `npm ci` aus einem Registry-Tarball tatsächlich Code aus** — `prepare`/`prepublish` laufen nur bei Git-Dependencies bzw. beim Publizieren:

- `@parcel/watcher@2.5.6` → `install: node scripts/build-from-source.js`
- `@swc/core@1.15.21` → `postinstall: node postinstall.js`

Das ist eine sehr kleine Angriffsfläche. Relevant wird sie erst dadurch, dass `Dockerfile:37` und die CI `npm ci` **ohne** `--ignore-scripts` fahren, während `Dockerfile.worker:45` es korrekt setzt (→ S08-19).

**Typosquatting.** Kein Kandidat. Alle direkten Dependencies sind etablierte Pakete; die `@grc/*`-Namen sind Workspace-interne Referenzen. Der umgekehrte Fall — dass jemand _ARCTOS' eigene_ Scope-Namen kapert — ist dagegen ein realer Befund (→ S08-13).

**Unwartete Transitiven im Produktionsbaum** (→ S08-23): `@grc/reporting → exceljs@4.4.0 → unzipper@0.10.14 → binary@0.3.0 → buffers@0.1.1` (letzter Release 2012, `licenses: UNKNOWN`) und `→ bluebird@3.4.7` (2016). Diese Kette ist zugleich die Herkunft der `brace-expansion`-Advisories.

### 4.2 `overrides` in der Root-`package.json` — was wird damit umgangen?

```json
"overrides": {
  "esbuild":   ">=0.25.0",
  "picomatch": ">=4.0.4",
  "react":     "19.2.7",
  "react-dom": "19.2.7",
  "sharp":     ">=0.35.0",
  "exceljs":   { "uuid": "^11.1.1" },
  "next":      { "postcss": "^8.5.10" }
}
```

| Override                     | Zweck                                                                                             | Bewertung                                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `esbuild >=0.25.0`           | GHSA-67mh-4wv8-2f99 — der Dev-Server von esbuild <0.25 akzeptiert beliebige Cross-Origin-Requests | **Legitim.** Ein transitives Paket lässt sich nicht anders anheben.                                                                                                                                                                        |
| `picomatch >=4.0.4`          | ReDoS in picomatch <4.0.4                                                                         | **Legitim.**                                                                                                                                                                                                                               |
| `sharp >=0.35.0`             | GHSA-f88m-g3jw-g9cj; im `audit-gate.mjs`-Kommentar dokumentiert                                   | **Legitim und begründet** — `sharp` kommt nur als optionale `next`-Dependency, `next/image` wird nicht genutzt.                                                                                                                            |
| `exceljs.uuid ^11.1.1`       | hebt uuid innerhalb von exceljs                                                                   | **Legitim**, aber es kuriert ein Symptom: `exceljs@4.4.0` schleppt die gesamte veraltete `unzipper/binary/buffers/bluebird`-Kette mit (S08-23).                                                                                            |
| `next.postcss ^8.5.10`       | GHSA-7fh5-64p2-3v2j                                                                               | **Wirkungslos gegen das aktuelle Advisory.** `npm audit` meldet `postcss` weiterhin als moderate (GHSA-fxqj-rqcc-2cmp, „incomplete fix"), und die Constraint `^8.5.10` erlaubt genau die verwundbare 8.5.20, die installiert ist. → S08-06 |
| `react`/`react-dom` `19.2.7` | Versionsvereinheitlichung, kein CVE                                                               | Neutral. Exakte Pinnung blockiert allerdings React-Patch-Releases.                                                                                                                                                                         |

**Kernaussage:** Die Overrides sind fachlich sauber begründet und dokumentiert — das ist besser als der Branchendurchschnitt. Nur `next.postcss` erweckt den Eindruck, ein Advisory sei geschlossen, während es offen ist.

### 4.3 Lizenzen — alle 847 transitiven Abhängigkeiten

Rohdaten: `/work/audit/evidence/S08/licenses-all.json`, gefiltert `licenses-flagged.csv`.

| Lizenz                                                                                     | Pakete |
| ------------------------------------------------------------------------------------------ | ------ |
| MIT                                                                                        | 690    |
| ISC                                                                                        | 43     |
| Apache-2.0                                                                                 | 42     |
| BSD-2-Clause                                                                               | 16     |
| BSD-3-Clause                                                                               | 12     |
| UNKNOWN                                                                                    | 11     |
| MPL-2.0                                                                                    | 5      |
| MIT-0 / Unlicense / MIT*                                                                   | je 3   |
| UNLICENSED                                                                                 | 2      |
| LGPL-3.0-or-later                                                                          | 2      |
| CC0-1.0 / BlueOak-1.0.0 / 0BSD / „Apache-2.0 AND MIT"                                      | je 2   |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT                                                   | 1      |
| Python-2.0 / CC-BY-4.0 / Custom / (MIT OR GPL-3.0-or-later) / (MIT AND Zlib) / MIT AND ISC | je 1   |

**Starkes Copyleft (GPL / AGPL / SSPL / CC-BY-SA): 0 Pakete.** Für ein kommerzielles Produkt ist das die Antwort, die man hören will.

**Die Fälle, die trotzdem Konsequenzen haben:**

| Paket                                                                          | Lizenz                    | Scope    | Konsequenz für ein kommerzielles Produkt                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`bpmn-js@18.21.0`**                                                          | Custom (bpmn.io)          | **PROD** | MIT-artig **mit einer harten Zusatzbedingung**: das bpmn.io-Wasserzeichen darf weder entfernt noch überdeckt werden. **Diese Bedingung wird verletzt** → **S08-02 (High)**. Rechtsfolge: Wegfall der Lizenz („subject to the following conditions"), damit ungelizenzierte Nutzung der zentralen BPMN-Komponente.                                                                                                         |
| `@img/sharp-libvips-linux-x64@1.3.2`, `@img/sharp-libvips-linuxmusl-x64@1.3.2` | **LGPL-3.0-or-later**     | **PROD** | libvips wird als native Shared Library dynamisch gebunden. Bei reinem SaaS-Betrieb löst LGPL keine Pflicht aus (keine Weitergabe). ARCTOS wird aber **als Docker-Image über ghcr.io verteilt** und `deploy/`-Skripte richten On-Prem-Installationen ein — das ist Weitergabe. Dann gelten LGPL-3 §4: Lizenztext beilegen, Copyright nennen, Relinking ermöglichen. Aktuell liegt dem Image **nichts davon** bei. → S08-16 |
| `lightningcss@1.32.0` + 2 Plattform-Binaries                                   | MPL-2.0                   | **PROD** | Datei-basiertes Copyleft. Solange die Dateien unverändert bleiben, genügt die Nennung der Quelle und des MPL-Texts. Keine Ansteckung auf ARCTOS-Code. Aber: Quellennennung fehlt. → S08-16                                                                                                                                                                                                                                |
| `jszip@3.10.1`                                                                 | (MIT OR GPL-3.0-or-later) | **PROD** | Dual-Lizenz — MIT wählbar, damit unkritisch. **Die Wahl muss aber dokumentiert werden**, sonst ist im Streitfall unklar, unter welchem Zweig genutzt wird. Genutzt in `extract-text.ts` (DOCX-Extraktion). → S08-16                                                                                                                                                                                                       |
| `caniuse-lite@1.0.30001806`                                                    | CC-BY-4.0                 | PROD     | Namensnennung des Urhebers erforderlich. Reine Datenbank, keine Code-Ansteckung. → S08-16                                                                                                                                                                                                                                                                                                                                 |
| `@axe-core/playwright`, `axe-core`                                             | MPL-2.0                   | dev      | Nur Testwerkzeug, wird nicht ausgeliefert. Unkritisch.                                                                                                                                                                                                                                                                                                                                                                    |
| `argparse@2.0.1`                                                               | Python-2.0                | dev      | Permissiv, unkritisch.                                                                                                                                                                                                                                                                                                                                                                                                    |
| `buffers@0.1.1`                                                                | UNKNOWN                   | **PROD** | **Keine Lizenz ermittelbar** → rechtlich ungeklärter Code im ausgelieferten Produkt. → S08-23                                                                                                                                                                                                                                                                                                                             |
| `@grc/*` (10 Pakete)                                                           | UNKNOWN                   | PROD     | Eigene Workspace-Pakete ohne `license`-Feld; `@grc/web`/`@grc/worker` als UNLICENSED. Inkonsistent zur Root-`LICENSE` (PolyForm Shield 1.0.0). → S08-13                                                                                                                                                                                                                                                                   |

**Was komplett fehlt:** Es gibt **keine `NOTICE`-, `THIRD-PARTY-LICENSES`- oder `ATTRIBUTIONS`-Datei** im Repo und keine im Docker-Image. MIT, Apache-2.0, BSD-2/3-Clause und ISC — zusammen **803 der 847 Pakete** — verlangen alle die Beibehaltung des Copyright-Vermerks bei Weitergabe. Bei Auslieferung als Docker-Image ist diese Pflicht derzeit unerfüllt. → S08-16

### 4.4 SBOM

Keine. Weder CycloneDX noch SPDX, weder erzeugt noch veröffentlicht, in keinem der 10 Workflows. → S08-12

---

## 5. Findings

---

### S08-01 · High · Öffentliches Repository liefert eine vollständige, direkt verwertbare Angriffskarte der Produktivinstanz

**Bezug:** BASE-001 (Critical) — dieses Finding bestimmt dessen konkrete Tragweite, wie in §S08 Methodik 2 beauftragt.

**Evidenz**

`docs/security/lod-coverage.csv` (166 KB, HEAD) — vollständige Auth-Matrix aller Routen:

```
route,method,mutating,roles,lods,auth_kind,anonymous
/api/v1/academy/certificates,GET,false,,,withAuth,false
/api/v1/academy/courses/[id],GET,false,admin|admin,cross,withAuth,false
```

1.801 Zeilen. Für jede Route: HTTP-Methode, ob sie mutiert, **welche Rollen sie verlangt**, welcher Auth-Wrapper greift, und ob sie anonym erreichbar ist. Die 7 anonymen Endpunkte sind namentlich gelistet:

```
/api/v1/auth/sso/config, /api/v1/auth/sso/oidc/callback, /api/v1/auth/sso/oidc/login,
/api/v1/auth/sso/saml/login, /api/v1/branding/css/[orgId],
/api/v1/calendar/ical/[token], /api/v1/health
```

`docs/openapi.yaml` (1.423.265 Bytes, HEAD, Zeilen 6-8) — nennt das Produktivziel:

```yaml
servers:
  - url: "https://arctos.charliehund.de"
    description: Production
```

`deploy/` (20 Dateien, HEAD) — die komplette Betriebstopologie: `setup-hetzner.sh`, `harden-server.sh`, `create-tenant.sh`, `delete-tenant.sh`, `db-backup.sh`, `offsite-sync.sh`, `Caddyfile`, `provision-grc-app.sh`. Daraus lassen sich Hoster, Reverse-Proxy, Backup-Ziel, Mandanten-Namensschema und Provisionierungsablauf rekonstruieren.

`docs/ADR-018-secret-management.md` — beschreibt die Secret-Ablage im Klartext:

```
/opt/arctos/
├── .env                         (Haupt, DB_PASSWORD etc.)
└── tenants/
    ├── daimon/env               (Tenant-spezifisch: AUTH_SECRET, WB_KEY, CRON_SECRET)
```

sowie unter „Identified Risks" die eigenen ungeschlossenen Schwachstellen (R1 Single-file-compromise, R2 keine Rotation, R4 Secrets via `/proc/<pid>/environ`).

Betreiber-Identität: `git log --all --format=%ae` → `agatho@charliehund.de` (318 Commits) — dieselbe Domain wie der Produktivhost `arctos.charliehund.de`.

**Angriffsszenario**
Ein Angreifer klont unauthentifiziert, liest `lod-coverage.csv`, und hat ohne einen einzigen Request gegen die Zielinstanz: das Produktivziel, die 7 anonymen Einstiegspunkte, für jede der 1.801 Route/Methode-Kombinationen die geforderte Rolle, und aus ADR-018 den Ablageort und die bekannten Schwächen der Secret-Verwaltung. Er kann Angriffe vollständig offline vorbereiten und trifft die Instanz erst im letzten Schritt — jede Rate-Limit- oder Anomalie-Erkennung, die auf Erkundungsverkehr reagiert, läuft ins Leere.

**Severity-Begründung**
**High, nicht Critical.** Die Rubrik reserviert Critical unter anderem für „Secret-Exposure mit Produktivbezug". Ein solches Secret wurde über die gesamte Historie **nicht** gefunden (§3.3) — deshalb keine Hochstufung. Es bleibt „unvalidierter Input auf sicherheitsrelevantem Pfad"-Niveau im Sinne einer massiven Aufklärungserleichterung. BASE-001 selbst bleibt davon unberührt Critical.

**Empfehlung**
Repository auf privat stellen. Unabhängig davon: `docs/security/lod-coverage.*` und `docs/openapi.yaml` gehören als CI-Artefakt erzeugt und nicht in den Baum committet; die Produktions-URL gehört nicht in eine generierte Spezifikation.

---

### S08-02 · High · Lizenzverletzung: bpmn.io-Wasserzeichen wird per CSS ausgeblendet

**Evidenz**

`apps/web/src/components/bpmn/bpmn-editor.css:14-17` (HEAD):

```css
/* Hide the bpmn.io powered-by badge */
.bjs-powered-by {
  display: none !important;
}
```

`node_modules/bpmn-js/LICENSE` (bpmn-js@18.21.0, Copyright Camunda Services GmbH):

> „Permission is hereby granted … **subject to the following conditions**: … The source code responsible for displaying the bpmn.io project watermark that links back to https://bpmn.io as part of rendered diagrams **MUST NOT be removed or changed**. When this software is being used in a website or application, **the watermark must stay fully visible and not visually overlapped by other elements**."

`package.json`-Metadatum: `"license": "SEE LICENSE IN LICENSE"` — deshalb taucht der Fall in keiner Lizenz-Metadatenprüfung auf.

Eingeführt in `3d5a7ace` (2026-03-25, Johannes Zoeller, „fix: Sprint 3 gaps — bpmn-js editor, components, hooks, 121 tests"). Deklariert in `apps/web/package.json:41` (`bpmn-js: ^18.21.0`) und `:42` (`bpmn-js-properties-panel: ^5.61.0`).

**Konkretes Fehlerszenario**
Die Wasserzeichen-Bedingung ist als _condition_ formuliert, nicht als bloße Obliegenheit. Wird sie nicht eingehalten, entfällt die Rechtekette aus dem ersten Absatz — ARCTOS nutzt und **vertreibt** (ghcr.io-Images, On-Prem-Deployment via `deploy/`) dann eine unlizenzierte Fremdkomponente. Für ein GRC-Produkt, dessen Verkaufsargument die Nachweisführung über Compliance ist, ist ein Lizenzverstoß in der prominentesten UI-Komponente auch jenseits der Rechtsfolge ein Reputationsrisiko: er fällt in jeder Software-Due-Diligence sofort auf, weil das Ausblenden des Badges ein bekanntes Prüfmuster ist.

**Severity-Begründung**
High. Kein technischer Angriffspfad, aber ein bestehender, in jedem gerenderten Diagramm wirksamer Rechtsmangel am Kernmodul, der bei Weitergabe fortlaufend neu verwirklicht wird. Nicht Critical, weil weder Daten noch Verfügbarkeit betroffen sind.

**Empfehlung**
Regel entfernen. Reicht der Platz im Layout nicht, sieht bpmn.io ausdrücklich die kommerzielle Lizenz vor, die von der Wasserzeichenpflicht befreit — das ist der einzige zulässige Alternativweg.

---

### S08-03 · High · Das CI-Security-Gate schlägt auf HEAD fehl — `main` ist mit rotem Gate im Stand

**Evidenz**

`.github/workflows/ci.yml:736-739`:

```yaml
- name: npm audit (production deps)
  # Gate mit dokumentierter, befristeter Allowlist — failt bei jedem
  # neuen high/critical-Advisory, siehe scripts/audit-gate.mjs.
  run: node scripts/audit-gate.mjs
```

Reproduktion auf `a8d1414f`:

```
$ node scripts/audit-gate.mjs
Allowlisted (2):
  ~ brace-expansion: GHSA-mh99-v99m-4gvg … — bis 2026-09-15: …

Nicht-allowlistete high/critical-Advisories (4):
  ✗ brace-expansion: GHSA-rgw5-rvv9-x895 [high] brace-expansion: DoS via unbounded
    intermediate arrays, bypassing the CVE-2026-14257 mitigation
  ✗ nanoid: GHSA-2v37-7h3g-55p8 [high] nanoid: custom generators can loop indefinitely
  ✗ pdfjs-dist: GHSA-hq66-cqwq-w95j [high] PDF.js: Arbitrary JavaScript execution upon
    opening a malicious PDF
GATE_EXIT=1
```

**Fehlerszenario**
Der HEAD des Default-Branch erfüllt das eigene Sicherheitskriterium nicht. Zwei Deutungen, beide problematisch: entweder ist der CI-Lauf auf `main` rot und wird toleriert — dann ist das Gate faktisch abgeschaltet und jedes künftige Advisory geht im Rauschen unter; oder der Job ist nicht als Required Check konfiguriert — dann konnte der Stand überhaupt nur deshalb nach `main` gelangen. In beiden Fällen ist die Zusage „failt bei JEDEM neuen high/critical-Advisory" (Kommentar in `audit-gate.mjs:8-10`) nicht eingelöst. Für ein Produkt, das seinen Kunden Kontrollwirksamkeit verkauft, ist eine deklarierte, aber unwirksame Kontrolle der schwerere Mangel als eine fehlende.

**Severity-Begründung**
High. Der ausgefallene Kontrollpunkt lässt konkret `pdfjs-dist` GHSA-hq66-cqwq-w95j (S08-04) auf dem Nutzer-Upload-Pfad passieren.

**Empfehlung**
`pdfjs-dist` auf ≥6.2.108 heben (Dependabot-Branch `dependabot/npm_and_yarn/pdfjs-dist-6.2.108` liegt bereits auf origin), `nanoid`/`brace-expansion` über Lockfile-Refresh, danach den Job als Required Check auf `main` erzwingen.

---

### S08-04 · High · `pdfjs-dist` mit JS-Ausführungs-Advisory auf dem Pfad nutzerhochgeladener DMS-Dokumente

**Evidenz**

`apps/web/package.json:54`: `"pdfjs-dist": "^5.7.284"` → installiert 5.7.284.
Advisory GHSA-hq66-cqwq-w95j, betroffener Bereich `>=5.6.83 <6.2.108`, Fix verfügbar (6.3.289 aktuell).

`apps/web/src/lib/documents/extract-text.ts:69-79`:

```ts
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const task = pdfjs.getDocument({
  data: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
  // Server-side hardening: no fetch from worker, no @font-face
  // injection (there is no DOM anyway). Note: `isEvalSupported` was
  // removed in pdfjs-dist 5.x — eval'd PS functions no longer exist.
  useWorkerFetch: false,
  disableFontFace: true,
  verbosity: 0,
});
```

**Fehlerszenario**
Ein Nutzer mit Upload-Berechtigung — in einem GRC-Produkt regelmäßig auch externe Auditoren, Lieferanten oder Hinweisgeber — lädt eine präparierte PDF ins DMS. Die serverseitige Textextraktion ruft `getDocument()` auf dem Angreiferinhalt auf; das Advisory beschreibt Ausführung von Angreifer-JavaScript im pdf.js-Kontext.

**Kompensierende Kontrollen — geprüft, mildernd, nicht ausreichend.** Der Code ist erkennbar mit Bedacht gehärtet: `useWorkerFetch: false` verhindert Netzwerkzugriffe, `disableFontFace: true` schließt den Font-Vektor, und der Node-Kontext hat kein DOM, was den klassischen XSS-Teil des CWE-79 entwertet. Das reduziert die Ausnutzbarkeit deutlich. Es entfernt sie nicht: die Verarbeitung läuft im Server-Prozess mit dessen Rechten, und der Kommentar zu `isEvalSupported` beschreibt eine Annahme über 5.x, die genau dieses Advisory in Frage stellt.

**Severity-Begründung**
High statt Critical: kein bewiesener RCE in dieser Konfiguration, aber ein High-Advisory mit verfügbarem Fix auf einem Pfad, der per Design nicht vertrauenswürdige Dateien annimmt. Verifikation der tatsächlichen Ausnutzbarkeit gehört zu S06 (DMS/Upload).

**Empfehlung**
Auf ≥6.2.108 heben. Zusätzlich: Extraktion in einen Child-Prozess mit CPU-/Speicher-Limit und ohne Netzwerk auslagern, damit ein künftiges Parser-Advisory nicht wieder direkt im Request-Prozess landet.

---

### S08-05 · High · `aquasecurity/trivy-action@master` — bewegliche Branch-Referenz in einem Job mit `packages: write`

**Evidenz**

`.github/workflows/ci.yml:660` und `:671`:

```yaml
- name: Trivy image scan — web
  uses: aquasecurity/trivy-action@master
```

Der umgebende Job (`ci.yml:575-577`, `:585-590`):

```yaml
permissions:
  contents: read
  packages: write
...
- name: Login to GitHub Container Registry
  uses: docker/login-action@v4
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
```

Zusätzlich steht `TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}` workflow-weit im `env` (`ci.yml:24`) und damit auch diesem Job zur Verfügung.

**Angriffsszenario**
`@master` löst bei jedem Lauf gegen den aktuellen Stand des Branches auf. Wer Schreibzugriff auf `aquasecurity/trivy-action` erlangt — durch Kompromittierung eines Maintainer-Kontos oder eine bösartige Contribution — führt beim nächsten Push auf `main` Code in einem Runner aus, der (a) ein `GITHUB_TOKEN` mit `packages: write` hält und damit `ghcr.io/agatho/grc-platform/grc-web:latest` überschreiben kann, und (b) `TURBO_TOKEN` in der Umgebung hat. Da die Deployment-Skripte in `deploy/update-all.sh` das `:latest`-Tag ziehen, führt das direkt in die Produktivinstanz. Das ist exakt der Ablauf der `tj-actions/changed-files`-Kompromittierung von 2025.

**Zusatzbefund:** dieselbe Datei pinnt an anderer Stelle korrekt per SHA (`coverage.yml:75-77`, `dependency-review.yml:15`) — die Kontrolle ist bekannt und wurde hier nicht angewandt. `@master` ist dabei die schlechteste Variante, weil nicht einmal ein Tag-Move nötig ist.

**Severity-Begründung**
High. Vollständige Übernahme der Image-Publikation aus einer Fremdkomponente heraus; Voraussetzung ist die Kompromittierung eines Dritten, was eine Hochstufung auf Critical verhindert.

**Empfehlung**
Auf den Release-Commit-SHA pinnen (`aquasecurity/trivy-action@<sha> # v0.x.y`). Ergänzend `permissions` im Trivy-Schritt nicht mehr benötigen: Scan vom Push-Job trennen (siehe S08-07).

---

### S08-06 · Medium · Die Risikoakzeptanz im Audit-Gate beruht auf einer nachweislich falschen Tatsachenbehauptung

**Evidenz**

`scripts/audit-gate.mjs:28-37`:

```js
    // brace-expansion kommt ausschließlich TRANSITIV über Build-/Test-Tooling
    // (glob → minimatch → brace-expansion) in den Tree; es liegt NICHT im
    // Runtime-Pfad der App. Der DoS greift nur bei Angreifer-
    // kontrollierten Brace-Pattern-Strings, die es hier nicht gibt.
    ghsa: "GHSA-mh99-v99m-4gvg",
    until: "2026-09-15",
```

Gegenbeweis:

```
$ npm ls brace-expansion --omit=dev --all
grc-platform@ /work/repo
`-- @grc/reporting@0.1.0 -> ./packages/reporting
  `-- exceljs@4.4.0 overridden
    `-- archiver@5.3.2
      +-- archiver-utils@2.1.0 → glob@7.2.3 → minimatch@3.1.5 → brace-expansion@1.1.16
      `-- readdir-glob@1.1.3 → minimatch@5.1.9 → brace-expansion@2.1.2
```

`--omit=dev` heißt: **im Produktionsbaum**, über `@grc/reporting` → `exceljs`, also über den XLSX-Export — eine Laufzeitfunktion der Anwendung, kein Build-Werkzeug.

**Drei weitere Mängel im selben File:**

1. Zeile 17 behauptet „Aktuell leer", während `ALLOWLIST` einen Eintrag enthält — Kommentar und Code widersprechen sich in derselben Datei.
2. Die Allowlist ist **paket-unabhängig nach GHSA-ID** aufgebaut (`ALLOWLIST.find((a) => a.ghsa === ghsa)`, Zeile 64). Ein einmal für ein Build-Tool akzeptiertes Advisory wird damit auch dann stillgelegt, wenn dasselbe Paket später in einer produktiven Position auftaucht — genau der hier eingetretene Fall.
3. Das zweite brace-expansion-Advisory **GHSA-rgw5-rvv9-x895** trägt den Titel „bypassing the CVE-2026-14257 mitigation" — es hebt die Wirkung genau des allowlisteten Fixes auf und ist nicht erfasst.

**Fehlerszenario**
Ein Prüfer (intern oder im Kundenaudit) liest die Begründung, hält den Befund für belegt entkräftet und schließt ihn. Die getroffene Risikoentscheidung stützt sich auf einen unzutreffenden Sachverhalt. In einem GRC-Produkt, das Risikoakzeptanz als Fachfunktion anbietet, wiegt das schwerer als das Advisory selbst.

**Severity-Begründung**
Medium. Der technische Restschaden ist klein — dass Angreifer Brace-Pattern in den XLSX-Export einschleusen, ist unbelegt —, aber die Kontrolle „dokumentierte, befristete Ausnahme" ist in ihrer Kernfunktion beschädigt.

**Empfehlung**
Allowlist-Einträge um ein Pflichtfeld `package` ergänzen und beim Abgleich mitprüfen; die Begründung auf den tatsächlichen `npm ls --omit=dev`-Pfad korrigieren; GHSA-rgw5-rvv9-x895 entweder fixen oder eigenständig begründen. Die Behauptung „nicht im Runtime-Pfad" sollte künftig maschinell aus `npm ls --omit=dev` abgeleitet statt von Hand geschrieben werden.

---

### S08-07 · Medium · Trivy scannt erst, nachdem das Image bereits nach `ghcr.io:latest` gepusht wurde

**Evidenz**

`.github/workflows/ci.yml:592-621` — Push:

```yaml
- name: Build & Push Web Image
  uses: docker/build-push-action@v7
  with:
    push: true
    tags: |
      ghcr.io/${{ github.repository }}/grc-web:latest
      ghcr.io/${{ github.repository }}/grc-web:${{ github.sha }}
```

`.github/workflows/ci.yml:659-668` — Scan, zwei Schritte später:

```yaml
- name: Trivy image scan — web
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ghcr.io/${{ github.repository }}/grc-web:${{ github.sha }}
    severity: CRITICAL,HIGH
    exit-code: "1"
    ignore-unfixed: true
    skip-dirs: /usr/local/lib/node_modules/npm
```

**Fehlerszenario**
Enthält das Image eine CRITICAL-Lücke, bricht der Job ab — aber `:latest` zeigt zu diesem Zeitpunkt bereits auf das verwundbare Image. `deploy/update-all.sh` zieht `:latest`. Ein rotes CI verhindert das Deployment also nicht; es meldet es nur nachträglich. Zwischen Push und manueller Reaktion ist das Artefakt deployfähig.

**Verschärfend:** `ignore-unfixed: true` blendet alle Lücken ohne Upstream-Fix aus, und `skip-dirs: /usr/local/lib/node_modules/npm` nimmt das gebündelte npm heraus. Beide Entscheidungen sind für sich vertretbar und im Kommentar (`ci.yml:652-658`) begründet — zusammen mit der Push-vor-Scan-Reihenfolge bleibt vom Gate aber wenig übrig.

**Severity-Begründung**
Medium: Härtungslücke mit klarem Weg zur Wirkung, aber ohne unmittelbaren Angriffspfad.

**Empfehlung**
Lokal bauen (`load: true`), scannen, und erst bei grünem Scan pushen. Alternativ nur den SHA-Tag pushen und `:latest` in einem separaten, vom Scan abhängigen Schritt setzen.

---

### S08-08 · Medium · 42 von 50 Action-Referenzen sind ungepinnt, entgegen der im Repo dokumentierten Zusage

**Evidenz**

```
$ grep -rhoE "uses: [^ ]+" .github/workflows/ | sed 's/uses: //' \
    | awk -F@ '{if ($2 ~ /^[0-9a-f]{40}$/) print "SHA"; else print "TAG"}' | sort | uniq -c
      8 SHA
     42 TAG
```

Dem gegenüber `coverage.yml:37-40`:

```yaml
# #WAVE11-SCORECARD: pin all GitHub Actions by commit SHA (scorecard
# alerts 1407-1415). Comment carries the tag for readability — keep
# both in sync when bumping.
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v6
```

Ungepinnt (Auswahl): `actions/checkout@v7` (15×), `actions/setup-node@v7` (8×), `actions/upload-artifact@v7` (6×), `docker/build-push-action@v7` (2×), **`aquasecurity/trivy-action@master` (2×)**, `trufflesecurity/trufflehog@v3.95.9`, `gitleaks/gitleaks-action@v3`, `ossf/scorecard-action@v2.4.3`, `github/codeql-action/*@v4`, `docker/login-action@v4`, `docker/setup-buildx-action@v4`.

Nur SHA-gepinnt: `coverage.yml` (4 Refs), `dependency-review.yml` (2 Refs), zusammen 8.

**Zusatzbefund Versionsdrift:** `codeql.yml:29,37,41` nutzt `github/codeql-action/*@v4`, `scorecard.yml:25` dagegen `github/codeql-action/upload-sarif@v3` — zwei Major-Versionen derselben Action im selben Repo.

**Fehlerszenario**
Git-Tags sind verschiebbar. Wer ein Maintainer-Konto einer der genannten Actions übernimmt, kann `v7` auf einen bösartigen Commit umhängen und läuft beim nächsten Workflow mit. Die Actions von GitHub und Docker sind vergleichsweise gut geschützt; `trivy-action`, `gitleaks-action` und `trufflehog` sind kleinere Projekte — und ausgerechnet sie laufen in den Jobs mit Secret-Zugriff.

**Severity-Begründung**
Medium. Erfordert die Kompromittierung eines Dritten; die Doku-Drift („pin all") erhöht das Risiko, weil sie in einer Prüfung fälschlich Entwarnung gibt. Der `@master`-Fall ist als S08-05 separat mit High geführt.

**Empfehlung**
Alle Refs per SHA pinnen, Dependabot mit `package-ecosystem: github-actions` für die Bumps nutzen (läuft bereits, siehe `dependabot/github_actions/*`-Branches), CodeQL-Version vereinheitlichen.

---

### S08-09 · Medium · `TURBO_TOKEN` liegt workflow-weit in `env` und ist damit jedem Schritt inklusive `npm ci` zugänglich

**Evidenz**

`.github/workflows/ci.yml:18-25` und identisch `coverage.yml:22-27`:

```yaml
env:
  NODE_VERSION: "22"
  AUTH_SECRET: ci-build-placeholder
  AUTH_TRUST_HOST: "true"
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

Nachgelagert in jedem Job: `- run: npm ci` (`ci.yml:737` u. a.) — **ohne `--ignore-scripts`**. Im Produktionsbaum führen dabei `@parcel/watcher@2.5.6` (`install`) und `@swc/core@1.15.21` (`postinstall`) Code aus; im Dev-Baum kommen weitere hinzu. Ebenso `npx tsx scripts/coverage-aggregate.ts` und `npx license-checker …`, die Pakete zur Laufzeit aus der Registry beziehen.

**Fehlerszenario**
Ein kompromittiertes Paket irgendwo im Installationsbaum liest im `postinstall` `process.env.TURBO_TOKEN` und exfiltriert es. Der Token gewährt Schreibzugriff auf den Turbo-Remote-Cache — wer dort schreiben kann, vergiftet Build-Artefakte für alle nachfolgenden Läufe und damit letztlich die produzierten Images.

**Kompensierende Kontrolle — geprüft.** Das Repo ist öffentlich, deshalb erhalten Fork-PRs von GitHub grundsätzlich keine Secrets; ein Angreifer kann den Token also nicht durch einen einfachen PR abgreifen. Der Pfad über eine kompromittierte Dependency bleibt aber offen und ist vom Fork-Schutz unberührt.

**Severity-Begründung**
Medium. Kein direkter Angriffspfad, aber ein Secret mit Cache-Schreibrecht in einer Umgebung, die per Design fremden Code ausführt — und ohne Not workflow-weit statt schrittgenau gesetzt.

**Empfehlung**
`TURBO_TOKEN` nur auf den Schritten setzen, die Turbo tatsächlich aufrufen. `npm ci --ignore-scripts` als Standard, mit expliziter Nachinstallation der zwei benötigten nativen Pakete.

---

### S08-10 · Medium · Das CI-Lizenz-Gate greift systematisch daneben — es hätte S08-02 nie gefunden

**Evidenz**

`.github/workflows/ci.yml:769-771`:

```yaml
- name: License compliance check
  run: |
    npx license-checker --production --failOn "GPL-2.0;GPL-3.0;AGPL-1.0;AGPL-3.0" \
      --excludePrivatePackages --summary
```

Vier Defekte:

1. **SPDX-Kennungen verfehlt.** `--failOn` vergleicht die Lizenz-Zeichenkette. Moderne Pakete deklarieren `GPL-3.0-only` oder `GPL-3.0-or-later`; die veralteten Kurzformen `GPL-3.0`/`GPL-2.0` treffen diese nicht. Im aktuellen Baum belegt: `@img/sharp-libvips-linux-x64` deklariert `LGPL-3.0-or-later` und passiert das Gate — was hier korrekt ist, aber zeigt, dass die `-or-later`-Form nicht gematcht wird.
2. **Lücken in der Sperrliste.** Nicht erfasst: `SSPL-1.0`, `CC-BY-SA-*`, `EUPL-1.2`, `BUSL-1.1`, `Commons Clause`, `OSL-3.0`, `CDDL`, `LGPL-*`, `Elastic-2.0`.
3. **Custom-Lizenzen unsichtbar.** `bpmn-js` deklariert `"license": "SEE LICENSE IN LICENSE"`. Das ist keine der gesperrten Zeichenketten — das Gate ist grün, während der Verstoß aus S08-02 im Repo aktiv ist. **Das ist der Beleg dafür, dass diese Kontrolle ihren Zweck nicht erfüllt.**
4. **`npx license-checker` ist ungepinnt und wird zur Laufzeit aus der Registry gezogen** — ein Sicherheitsprüfschritt, der selbst unversionierten Fremdcode nachlädt. Das Paket ist zudem seit Jahren unwartet; der gepflegte Fork heißt `license-checker-rseidelsohn` (für diese Prüfung genutzt).

**Positiv abzugrenzen:** `dependency-review.yml:20-33` macht es deutlich besser — `deny-licenses: GPL-2.0-only, GPL-3.0-only, AGPL-3.0-only` verwendet korrekte SPDX-Kennungen und dokumentiert die trufflehog-AGPL-Ausnahme sauber. Nur greift dieser Workflow ausschließlich bei `pull_request` auf `main` und nur für _geänderte_ Abhängigkeiten — der Bestand wird nie geprüft.

**Severity-Begründung**
Medium. Eine deklarierte Compliance-Kontrolle ohne Wirkung; der konkrete Schaden ist bereits als S08-02 eingetreten.

**Empfehlung**
Auf `license-checker-rseidelsohn` (versionsgepinnt) oder besser auf eine SBOM-basierte Prüfung umstellen; Sperrliste über SPDX-Ausdrücke statt Zeichenketten auswerten; `UNKNOWN` und `SEE LICENSE IN …` als eigene Fehlerklasse behandeln, die eine manuelle Freigabe erzwingt.

---

### S08-11 · Medium · Das Worker-Produktionsimage enthält den kompletten Quellbaum inklusive Tests, Deploy-Skripten und Produktions-Compose

**Evidenz**

`Dockerfile.worker:47-77` — die `runner`-Stage ist zugleich das Endimage:

```dockerfile
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
...
COPY --from=deps /app ./
# Overlay the source. .dockerignore excludes node_modules, so the
# tree above survives this copy.
COPY . .
USER arctos
```

`.dockerignore` (vollständig) schließt aus: `node_modules`, `.next`, `dist`, `.turbo`, `.git`, `.github`, `.claude`, `docs`, `docs-private`, `coverage`, `*.env*`, `.DS_Store`, `*.log`, sowie einige Build-Verzeichnisse. **Nicht ausgeschlossen** und damit im Image:

```
tests/**, apps/web/src/__tests__/**, packages/*/tests/**   → 412 getrackte Testdateien
deploy/                → 20 Dateien: setup-hetzner.sh, harden-server.sh, create-tenant.sh,
                         delete-tenant.sh, db-backup.sh, offsite-sync.sh, Caddyfile,
                         provision-grc-app.sh, .env.production.example, .env.sample
docker-compose.production.yml, docker-compose.yml
packages/db/sql/**     → 81 SQL-Dateien
CHANGELOG.md, SECURITY.md
```

**Fehlerszenario**
Wer über eine beliebige andere Schwachstelle Dateizugriff im Worker-Container erlangt, liest dort die vollständige Betriebsdokumentation der Zielumgebung: Mandanten-Provisionierung, Backup-Ziele, Server-Härtungsschritte, Reverse-Proxy-Konfiguration, das Compose-File mit allen Variablennamen. Ein Container, der nur `apps/worker` und dessen Abhängigkeiten braucht, liefert damit die Landkarte für die laterale Bewegung gleich mit. Zusätzlich vergrößern 412 Testdateien und 81 SQL-Skripte die Angriffsfläche für Pfad-Traversal- oder Include-Fehler.

**Kontrast:** Das Web-Image macht es richtig — `Dockerfile:128-146` kopiert selektiv aus der Builder-Stage (`.next/standalone`, `static`, `public`, `messages`, `drizzle`, `sql`) und schleppt keinen Quellbaum mit.

**Severity-Begründung**
Medium. Kein eigenständiger Angriffspfad, aber eine deutliche Verstärkung jeder anderen Container-Kompromittierung, und ein vermeidbarer Verstoß gegen minimale Images.

**Empfehlung**
`.dockerignore` um `tests/`, `**/__tests__/`, `**/*.test.ts`, `**/*.spec.ts`, `deploy/`, `docker-compose*.yml`, `CHANGELOG.md`, `SECURITY.md`, `e2e/` erweitern. Sauberer: im Worker-Dockerfile gezielt `apps/worker` und `packages/*/src` kopieren statt `COPY . .`.

---

### S08-12 · Medium · Keine SBOM — weder erzeugt noch veröffentlicht noch archiviert

**Evidenz**

```
$ grep -rn -i "sbom\|cyclonedx\|spdx" .github scripts docs package.json
(keine Ausgabe)
```

Über alle 10 Workflows, alle Skripte und die gesamte Dokumentation: kein Treffer. `docker/build-push-action@v7` unterstützt `sbom: true` und `provenance: true` — beides ist in `ci.yml:592-621` nicht gesetzt.

**Fehlerszenario**
Erscheint morgen ein Advisory zu einem tief transitiven Paket, ist nicht feststellbar, welche der bereits ausgelieferten Images betroffen sind — es gibt keine Aufzeichnung, was in einem konkreten Image steckte. `npm audit` beschreibt immer nur den _heutigen_ Baum, nicht den von Image `grc-web:<sha>` vor drei Monaten. Für ein Produkt, das nach CRA und NIS2 vertrieben werden soll, ist eine maschinenlesbare Stückliste zunehmend eine Marktzugangsvoraussetzung; Kundenaudits im GRC-Umfeld fragen sie regelmäßig ab.

**Severity-Begründung**
Medium. Kein Angriffspfad, aber ein Wartbarkeits- und Nachweisdefizit mit unmittelbarer Wirkung auf die Incident-Response-Fähigkeit — und für dieses Produktsegment ein Vertriebsrisiko.

**Empfehlung**
`sbom: true` und `provenance: mode=max` in beiden `build-push-action`-Schritten setzen; zusätzlich eine CycloneDX-SBOM je Release als Artefakt mit langer Aufbewahrung ablegen.

---

### S08-13 · Medium · 10 von 12 Workspace-Paketen ohne `private: true`; der `@grc`-Scope ist nicht abgesichert

**Evidenz**

```
@grc/web         private=True    version=0.1.0  license=None
@grc/worker      private=True    version=0.1.0  license=None
@grc/ai          private=None    version=0.1.0  license=None
@grc/auth        private=None    version=0.1.0  license=None
@grc/automation  private=None    version=0.1.0  license=None
@grc/db          private=None    version=0.1.0  license=None
@grc/email       private=None    version=0.1.0  license=None
@grc/events      private=None    version=0.1.0  license=None
@grc/graph       private=None    version=0.1.0  license=None
@grc/reporting   private=None    version=0.1.0  license=None
@grc/shared      private=None    version=0.1.0  license=None
@grc/ui          private=None    version=0.1.0  license=None
```

Die Root-`package.json` trägt `"private": true`, aber diese Kennzeichnung wirkt nicht auf Workspace-Pakete.

**Zwei Fehlerszenarien**

1. **Versehentliche Veröffentlichung.** `npm publish` aus `packages/db/` publiziert das Paket. Nur `private: true` verhindert das. Der Inhalt steht unter PolyForm Shield 1.0.0 — die npm-Registry-Nutzungsbedingungen sind damit nicht vereinbar, und der Code wäre über den npm-CDN dauerhaft und unwiderruflich mirrorbar.
2. **Dependency Confusion.** Da das Repo öffentlich ist (BASE-001), sind alle Paketnamen bekannt. Ist der `@grc`-Scope auf npmjs.com nicht registriert, kann ein Angreifer `@grc/db` dort mit `version: 99.0.0` veröffentlichen. Im normalen Workspace-Betrieb greift die lokale Auflösung, und `package-lock.json` schützt zusätzlich — der Angriff zieht erst, wenn irgendwo ohne Workspace-Kontext installiert wird (Installation in einem Unterverzeichnis, Lockfile-Neuaufbau, ein abgespaltener Build).

**Severity-Begründung**
Medium. Szenario 1 ist eine einzelne Fehlbedienung mit irreversibler Folge; Szenario 2 hat mit Lockfile und Workspace-Auflösung echte kompensierende Kontrollen und ist allein nicht mehr als Low.

**Empfehlung**
`"private": true` in allen zehn Paketen ergänzen — eine Zeile je Datei. Zusätzlich den `@grc`-Scope auf npmjs.com defensiv registrieren und in `.npmrc` `@grc:registry` auf eine interne Registry zeigen lassen.

---

### S08-14 · Medium · Der repo-eigene Secret-Scanner überspringt jedes Verzeichnis namens `security` und hat Mustergaps

**Evidenz**

`scripts/audit-secrets.mjs:41-47`:

```js
const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  ".git",
  "dist",
  "build",
  "coverage",
  "backups",
  "audit-test-2026-04-17",
  // Self-exclusion: the report lists suspected secrets, we'd scan
  // our own report otherwise and create infinite false positives.
  "security",
]);
```

`walk()` (Zeile 58) prüft `EXCLUDE_DIRS.has(entry.name)` — also den **Basisnamen an jeder Baumposition**, nicht den Pfad `docs/security`. Damit fallen unter anderem `apps/web/src/app/api/v1/security/**` und jedes weitere `security/`-Verzeichnis stillschweigend aus dem Scan. Gleiches gilt für `build/` und `coverage/` — und `!apps/web/src/app/api/v1/**/coverage/` in der `.gitignore` (Zeile 12-16) belegt, dass es solche API-Pfade tatsächlich gibt.

Mustergaps in `PATTERNS` (Zeile 24-39):

| Regel                               | Problem                                                                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/\bsk-[A-Za-z0-9]{48,}\b/`         | erfasst **keine** modernen OpenAI-Keys der Form `sk-proj-…` — die enthalten `-` und `_`, die Zeichenklasse nicht                                     |
| `/\bsk-ant-[A-Za-z0-9-_]{95,}\b/`   | 95 Zeichen Mindestlänge nach dem Präfix ist knapp am realen Format                                                                                   |
| `/\bgithub_pat_[A-Za-z0-9_]{82}\b/` | **exakt** 82 Zeichen; abweichende Längen fallen durch                                                                                                |
| AWS Secret Access Key               | **bewusst weggelassen** (Kommentar Zeile 27-29) — mit nachvollziehbarer Begründung (Entropie-Heuristik, ~200 Falsch-Positive), aber die Lücke bleibt |
| —                                   | keine Muster für Slack-Webhooks, Stripe, SendGrid, Resend, npm-, GitLab-Token, Azure `AccountKey=` oder Connection-Strings mit Passwort              |

**Drittes Defizit — der Scan ist HEAD-only.** `walk()` läuft über das Arbeitsverzeichnis. `docs/security/secret-scan-report.md` (HEAD) hält fest: „Files scanned: 2874. Findings: 6." Ein einmal committetes und später entferntes Secret ist damit unsichtbar. Genau dafür wäre ein Historien-Scan nötig — den dieser Audit erstmals durchgeführt hat.

**Viertes Defizit — Abstumpfung.** Die 6 gemeldeten Findings sind allesamt Testfixtures (§3.2 J). Ein Report, der dauerhaft dieselben sechs Falsch-Positive zeigt, wird nicht mehr gelesen.

**Severity-Begründung**
Medium. Fehlende Härtung einer Sicherheitskontrolle mit konkret benennbaren blinden Flecken. Kein Critical, weil gitleaks in `secret-scanning.yml` parallel läuft und der unabhängige Historien-Scan dieses Audits **keinen** Fund in den übersprungenen Bereichen ergeben hat — die Lücke hat sich bislang nicht materialisiert.

**Empfehlung**
`EXCLUDE_DIRS` auf Pfadpräfixe umstellen (`docs/security` statt `security`); den Self-Exclusion-Zweck stattdessen über eine Ausnahme nur für `secret-scan-report.md` lösen; Muster um `sk-proj-`, Resend, Slack-Webhook, Stripe, npm/GitLab-Token und Connection-Strings ergänzen; Testfixture-Pfade als bekannte Ausnahmen führen, damit der Report wieder aussagekräftig wird.

---

### S08-15 · Medium · Die CI-Secret-Scans finden bauartbedingt nur verifizierbare Live-Credentials

**Evidenz**

`.github/workflows/ci.yml:747-751`:

```yaml
- name: Check for leaked secrets
  uses: trufflesecurity/trufflehog@v3.95.9
  with:
    extra_args: --only-verified --results=verified
```

`.github/workflows/secret-scanning.yml:27-32`:

```yaml
- name: Run gitleaks
  uses: gitleaks/gitleaks-action@v3
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    # No GITLEAKS_LICENSE -> runs in OSS mode (rate-limited but fine
    # for small repos)
```

**Fehlerszenario**
`--only-verified` meldet ausschließlich Credentials, die trufflehog durch einen Live-Aufruf gegen den jeweiligen Anbieter bestätigen kann. Unsichtbar bleiben damit strukturell:

- Datenbank-Connection-Strings und Redis-/AMQP-Passwörter (kein verifizierbarer Anbieter),
- private Schlüssel und Zertifikate,
- Secrets für selbst gehostete Dienste (Garage, MinIO, ClamAV, FreeTSA) — also genau die Klasse, die diese Architektur überwiegend nutzt,
- bereits rotierte Secrets, die in der Historie stehen bleiben und für forensische Bewertung dennoch relevant sind,
- alles, wofür trufflehog keinen Detektor hat.

Das ist eine bewusste Abwägung gegen Falsch-Positive und für sich vertretbar. Problematisch ist, dass **keine zweite Kontrolle die entstehende Lücke schließt**: gitleaks läuft in einem eigenen Workflow, aber `gitleaks-action@v3` scannt bei `push`/`pull_request` die jeweiligen Commits, nicht wiederkehrend den Gesamtverlauf. Ein Secret, das vor Einführung des Workflows committet wurde, wird von keiner der beiden Kontrollen je gesehen.

Ergänzend: `gitleaks/gitleaks-action@v3` ist ungepinnt (S08-08) und erhält `GITHUB_TOKEN` — dieselbe Risikoklasse wie S08-05, nur mit geringeren Rechten (`contents: read`, `pull-requests: write`).

**Severity-Begründung**
Medium: fehlende Tiefenprüfung auf einem Sicherheitspfad. Der unabhängige Vollscan dieses Audits hat die Lücke nicht materialisiert (§3.3) — deshalb keine Hochstufung.

**Empfehlung**
Im wöchentlichen `schedule`-Lauf von `secret-scanning.yml` einen vollständigen Historien-Scan ohne `--only-verified` fahren und das Ergebnis als Artefakt sichern; die PR-Läufe bei `--only-verified` belassen, damit die Entwickler-Rückmeldung rauscharm bleibt.

---

### S08-16 · Low · Keine Attributionsdatei — Namensnennungspflichten von 803 Paketen bei Image-Weitergabe unerfüllt

**Evidenz**
Weder im Repo-Root noch in `docs/` existiert `NOTICE`, `THIRD-PARTY-LICENSES` oder `ATTRIBUTIONS`; die Dockerfiles kopieren keine Lizenzdateien in die Images.

Betroffen: MIT (690), Apache-2.0 (42), ISC (43), BSD-2-Clause (16), BSD-3-Clause (12) = **803 Pakete**, die sämtlich die Beibehaltung des Copyright-Vermerks bei Weitergabe fordern. Dazu die Sonderfälle aus §4.3: `LGPL-3.0-or-later` (2× sharp-libvips, PROD — Lizenztext und Relinking-Möglichkeit), `MPL-2.0` (3× lightningcss, PROD — Quellennennung), `CC-BY-4.0` (caniuse-lite, PROD — Urhebernennung), `jszip` (Dual-Lizenz — die Wahl von MIT sollte dokumentiert sein).

**Fehlerszenario**
ARCTOS wird als Docker-Image über ghcr.io und per `deploy/`-Skripten On-Prem verteilt — das ist Weitergabe im Lizenzsinn. In einer Software-Due-Diligence oder einem Kunden-Lieferantenaudit ist „zeigen Sie mir Ihre Third-Party-Attribution" eine Standardfrage; sie ist derzeit nicht beantwortbar.

**Severity-Begründung**
Low. Formaler Mangel ohne technische Wirkung, mit geringem Aufwand behebbar. Der materielle Lizenzverstoß ist S08-02.

**Empfehlung**
`THIRD-PARTY-LICENSES.md` im Build erzeugen (`license-checker-rseidelsohn --files`) und in beide Images unter `/app/THIRD-PARTY-LICENSES.md` kopieren; die MIT-Wahl für `jszip` dort explizit festhalten.

---

### S08-17 · Low · Uneinheitliches Fail-Fast in `docker-compose.production.yml` — kritische Secrets mit leerem Default

**Evidenz**

`docker-compose.production.yml` — Fail-Fast korrekt gesetzt bei:

```yaml
:37    POSTGRES_PASSWORD: ${DB_PASSWORD:?Set DB_PASSWORD in .env}
:204   DATABASE_URL: postgresql://grc:${DB_PASSWORD:?Set DB_PASSWORD in .env}@postgres:5432/grc_platform
:213   AUTH_SECRET: ${AUTH_SECRET:?Set AUTH_SECRET in .env}
:216   WB_ENCRYPTION_KEY: ${WB_ENCRYPTION_KEY:?Set WB_ENCRYPTION_KEY in .env}
:222   CRON_SECRET: ${CRON_SECRET:?Set CRON_SECRET in .env}
```

Fail-Fast **fehlt** bei:

```yaml
:75    GARAGE_RPC_SECRET: ${GARAGE_RPC_SECRET:-}
:76    GARAGE_ADMIN_TOKEN: ${GARAGE_ADMIN_TOKEN:-}
:114   MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-}
:212   APP_DATABASE_URL: postgresql://grc_app:${GRC_APP_PASSWORD:-}@postgres:5432/grc_platform
:217   CONNECTOR_ENCRYPTION_KEY: ${CONNECTOR_ENCRYPTION_KEY}
:220   SECRET_ENCRYPTION_KEY: ${SECRET_ENCRYPTION_KEY:-}
```

**Kompensierende Kontrollen — geprüft und wirksam.** `packages/shared/src/env-key.ts:23-35`:

```ts
export function getRequiredHexKey(envVarName: string, byteLength: number): Buffer {
  const keyHex = process.env[envVarName];
  if (!keyHex || keyHex.length !== expectedHexLen || !/^[0-9a-fA-F]+$/.test(keyHex)) {
    throw new Error(
```

Ein leerer `CONNECTOR_ENCRYPTION_KEY` führt also zu einem Fehler bei der ersten Nutzung, **nicht** zu schwacher Verschlüsselung. Der Kommentar in `apps/web/src/app/api/v1/connectors/[id]/credentials/route.ts:16` („this used to read `CONNECTOR_ENCRYPTION_KEY ?? "0".repeat(64)`") zeigt, dass der gefährliche Null-Key-Fallback bewusst beseitigt wurde. Ein leeres `MINIO_ROOT_PASSWORD` lässt MinIO nicht starten.

**Restrisiko**
`GRC_APP_PASSWORD:-` (Zeile 212) ist der einzige Fall mit Wirkung über die Verfügbarkeit hinaus: leer gesetzt entsteht `postgresql://grc_app:@postgres:5432/…`. Ob die Anwendung dann sauber abbricht oder auf `DATABASE_URL` (Superuser `grc`, BYPASSRLS) zurückfällt, entscheidet über die RLS-Durchsetzung — **das gehört in S01 (Mandantentrennung) verifiziert und wird von hier aus nur verwiesen.** Die CI-Assertion `ci.yml:785-797` prüft nur, dass die Zeile existiert und nicht auf `grc` zeigt, nicht dass das Passwort gesetzt ist.

**Severity-Begründung**
Low aus S08-Sicht — herabgestuft von Critical wegen `getRequiredHexKey`. Die Bewertung des `GRC_APP_PASSWORD`-Falls obliegt S01. Bemerkenswert: auf origin liegt ein unfusionierter Branch `config/compose-fail-fast-secrets` — das Problem ist bekannt.

**Empfehlung**
Alle sechs Variablen auf `${VAR:?…}` umstellen und den Branch fusionieren. Für `GRC_APP_PASSWORD` zusätzlich eine Startprüfung, die einen leeren Wert ablehnt statt auf `DATABASE_URL` zurückzufallen.

---

### S08-18 · Low · Entwicklungs- und CI-Datenbankpasswörter über die gesamte Historie committet

**Evidenz**
`.env.example:18` (HEAD): `DATABASE_URL=postgresql://grc:grc_***[len=16]***@localhost:5432/grc_platform`
`.env.example:19`: `# APP_DATABASE_URL=postgresql://grc_app:grc_***[len=20]***@localhost:5432/grc_platform`
`.env.example:91`: `CRON_SECRET=arctos-cron-secret-change-in-production`
`.github/workflows/ci.yml:148,271,427`: `PGPASSWORD=grc_***[len=17]*** psql -h localhost -U grc …`
Verbreitung: 133 Blobs über die Historie, 12 Pfade, davon 9 in HEAD (`SETUP.md`, `CLAUDE.md`, `docs/DEVELOPER_GUIDE.md`, `docs/DEV_ENVIRONMENT_GUIDE.md`, `packages/db/tests/helpers.ts`, `packages/db/tests/integration/audit-chain-per-tenant.test.ts`, `apps/web/src/__tests__/rls-route-chain/risks-route-rls.test.ts`, `.env.example`, `ci.yml`).

**Kompensierende Kontrollen — geprüft und wirksam.**
`deploy/create-tenant.sh:54`: `CRON_SECRET=$(openssl rand -hex 16)`
`deploy/setup-hetzner.sh:75`: `CRON_SECRET=$(openssl rand -hex 16)`
`deploy/setup.sh:63-66`: ersetzt `CHANGE_ME_AUTH_SECRET`, `CHANGE_ME_WB_KEY`, `CHANGE_ME_CRON`, `CHANGE_ME_DB_PW` durch `openssl rand`-Werte
`scripts/setup.sh:49`: erzeugt `CRON_SECRET` über `crypto.randomBytes(16)`
`docker-compose.production.yml:222`: `${CRON_SECRET:?…}` — kein stiller Default
`apps/worker/src/index.ts:148-151`: verweigert mit HTTP 500, wenn `CRON_SECRET` nicht gesetzt ist

Es gibt also **keinen** Pfad, auf dem einer dieser Werte in eine Produktivumgebung gelangt. Alle binden an `localhost` bzw. den CI-Service-Container.

**Restrisiko**
`CRON_SECRET=arctos-cron-secret-change-in-production` ist der einzige Wert, der wie ein benutzbares Secret aussieht statt wie ein Platzhalter. Wer `.env.example` von Hand nach `.env` kopiert statt `scripts/setup.sh` zu nutzen, deployt ihn — und der Wert steht öffentlich im Repo (BASE-001). Die Worker-Cron-Endpunkte wären damit von außen auslösbar.

**Severity-Begründung**
Low. Von High herabgestuft, weil der dokumentierte Einrichtungsweg das Secret zwingend erzeugt und Compose ohne gesetzten Wert nicht startet. Der Restpfad setzt eine Fehlbedienung entgegen der Dokumentation voraus.

**Empfehlung**
`.env.example:91` auf `CRON_SECRET=generate-with-openssl-rand-hex-16` ändern — analog zu `AUTH_SECRET=generate-a-random-secret-here`, das genau richtig formuliert ist. Ein Platzhalter darf nicht wie ein Wert aussehen.

---

### S08-19 · Low · Das Web-Image führt beim Build Install-Skripte aus, das Worker-Image nicht

**Evidenz**
`Dockerfile:37`: `RUN npm ci`
`Dockerfile.worker:45`: `RUN npm ci --omit=dev --ignore-scripts`

Tatsächlich ausgeführt werden im Produktionsbaum genau zwei Skripte: `@parcel/watcher@2.5.6` (`install: node scripts/build-from-source.js`) und `@swc/core@1.15.21` (`postinstall: node postinstall.js`). Im Web-Build kommen die devDependencies hinzu, weil dort ohne `--omit=dev` installiert wird.

**Fehlerszenario**
Ein kompromittiertes Paket führt im `postinstall` beliebigen Code in der Builder-Stage aus — mit Zugriff auf den gesamten Quellbaum und die Build-Argumente. Ein manipuliertes `.next/standalone` landet anschließend im Runtime-Image.

**Severity-Begründung**
Low. Sehr kleine Angriffsfläche (zwei Pakete, beide etabliert), und der Lockfile pinnt exakte Versionen samt Integrity-Hash. Das Finding ist vor allem eine **Inkonsistenz**: die Kontrolle existiert im Worker-Dockerfile und fehlt ohne Begründung im Web-Dockerfile.

**Empfehlung**
`npm ci --ignore-scripts` auch im Web-Dockerfile; die beiden nativen Pakete gezielt mit `npm rebuild @parcel/watcher @swc/core` nachziehen, falls der Build sie braucht.

---

### S08-20 · Low · Dependabot-PRs für exakt die verwundbaren Pakete liegen unfusioniert auf origin

**Evidenz**

```
$ git branch -a | grep dependabot/npm
  remotes/origin/dependabot/npm_and_yarn/brace-expansion-1.1.18
  remotes/origin/dependabot/npm_and_yarn/hono-4.12.34
  remotes/origin/dependabot/npm_and_yarn/js-yaml-4.3.1
  remotes/origin/dependabot/npm_and_yarn/pdfjs-dist-6.2.108
  remotes/origin/dependabot/npm_and_yarn/undici-7.29.0
  remotes/origin/dependabot/npm_and_yarn/dev-deps-6edc86fd1b
  remotes/origin/dependabot/npm_and_yarn/multi-4b10dec7ea
  remotes/origin/dependabot/npm_and_yarn/production-deps-09cf2d3c4d
  remotes/origin/dependabot/github_actions/ossf/scorecard-action-2.4.4
  remotes/origin/dependabot/github_actions/trufflesecurity/trufflehog-3.97.1
```

Jeder der fünf Paket-Branches adressiert genau ein in §4.1 gemeldetes Advisory. `pdfjs-dist-6.2.108` schließt exakt GHSA-hq66-cqwq-w95j (betroffen `<6.2.108`) — den High-Befund aus S08-04.

**Fehlerszenario**
Die Fixes sind vorbereitet, getestet und liegen bereit; sie werden nur nicht fusioniert. Das erklärt zugleich, warum das Audit-Gate rot ist (S08-03): der Rückstau ist prozessual, nicht technisch. Für ein GRC-Produkt ist das ein Befund zum Schwachstellenmanagement-Prozess — der eigene Patch-Zyklus ist nicht durchgesetzt.

**Severity-Begründung**
Low als eigenständiges Finding (die Advisories sind unter S08-03/S08-04 geführt); relevant als Ursachenbefund.

**Empfehlung**
Die fünf Branches fusionieren, danach `node scripts/audit-gate.mjs` erneut laufen lassen. Eine SLA für Dependabot-Security-PRs festlegen (etwa: high/critical innerhalb von 7 Tagen) und in ADR-018 dokumentieren.

---

### S08-21 · Low · Basis-Images per Tag statt Digest gepinnt; `apk upgrade` macht Builds nicht reproduzierbar

**Evidenz**
`Dockerfile:17` / `Dockerfile.worker:22`: `ARG NODE_IMAGE=node:22.20-alpine`
`Dockerfile:108` / `Dockerfile.worker:54`: `RUN apk upgrade --no-cache`

Beides ist im Dockerfile ausführlich begründet (`Dockerfile:5-14` und `:102-107`): Tag-Pinning als Kompromiss zwischen Lesbarkeit und Immutabilität, `apk upgrade` um den Rückstand des Node-Basis-Images gegenüber Alpines Sicherheits-Feed aufzuholen und die Trivy-Prüfung zu bestehen.

**Fehlerszenario**
`node:22.20-alpine` ist ein beweglicher Tag innerhalb der Patch-Linie; `apk upgrade --no-cache` zieht den jeweils aktuellen Alpine-Stand. Zwei Builds desselben Commits ergeben damit unterschiedliche Images. Für ein Produkt mit Auditierbarkeitsanspruch heißt das: Von einem laufenden Container lässt sich nicht auf einen reproduzierbaren Bauzustand zurückschließen — was die Aussagekraft eines Incident-Forensik-Ergebnisses schwächt.

**Severity-Begründung**
Low. Bewusste, dokumentierte Abwägung; das Sicherheitsargument für `apk upgrade` ist stichhaltig. Der eigentliche Mangel ist die fehlende Aufzeichnung dessen, was gebaut wurde — was die SBOM aus S08-12 leisten würde.

**Empfehlung**
Digest-Pinning (`node:22.20-alpine@sha256:…`) mit Dependabot-Bumps; `apk upgrade` beibehalten, aber `apk list --installed` als Build-Artefakt sichern — oder besser: die SBOM aus S08-12 einführen, dann erübrigt sich das.

---

### S08-22 · Info · Entwickler-Arbeitsplatzpfade und Benutzername in der Historie

**Evidenz**
Fünf Blobs enthalten Windows-Pfade eines Entwickler-Arbeitsplatzes:

```
docs/security/lod-coverage.md    C:/Users/daimon/Downloads/grcfiles/grc-platform//api/v1/auth/admin-login
docs/security/lod-coverage.csv   C:/Users/daimon/Downloads/grcfiles/grc-platform//api/v1/academy/courses,POST,tr
docs/security/secret-scan-report.md  C:/Users/daimon/Downloads/grcfiles/grc-platform/packages/shared/tests/…
docs/session-handover-2026-04-14.md  C:\Users\daimon\Downloads\grcfiles\grc-platform
docs/session-handover-2026-04-15.md  C:\Users\daimon\Downloads\grcfiles\grc-platform
```

Ursache: Die Generatorskripte schreiben absolute statt repo-relative Pfade in ihre Reports. In HEAD sind die Reports bereinigt; die Blobs bleiben in der Historie erhalten.

Ebenfalls öffentlich harvestbar: `johannes.gm.zoeller@gmail.com` (480 Commits), `agatho@charliehund.de` (318), `claude-cowork@arctos.dev` (326).

**Bewertung**
Info. Der Benutzername `daimon` und die Verzeichnisstruktur sind für sich harmlos, taugen aber als Bausteine für gezieltes Social Engineering — insbesondere zusammen mit der Domain-Übereinstimmung zwischen Commit-Adresse und Produktivhost (S08-01).

**Empfehlung**
`scripts/generate-openapi.mjs` und die Coverage-Generatoren auf repo-relative Pfade umstellen. Eine Historienbereinigung lohnt für diesen Befund allein nicht — falls das Repo ohnehin wegen BASE-001 neu aufgesetzt wird, gleich miterledigen.

---

### S08-23 · Info · Unwartete Transitiven im Produktionsbaum über `exceljs`

**Evidenz**

```
$ npm ls unzipper binary bluebird --omit=dev --all
`-- @grc/reporting@0.1.0 -> ./packages/reporting
  `-- exceljs@4.4.0 overridden
    `-- unzipper@0.10.14
      +-- binary@0.3.0
      `-- bluebird@3.4.7
```

`buffers@0.1.1` (via `binary@0.3.0`) trägt `licenses: UNKNOWN` und stammt aus 2012; `bluebird@3.4.7` aus 2016. Dieselbe Kette liefert über `archiver → glob → minimatch` die `brace-expansion`-Advisories aus S08-06.

**Bewertung**
Info. Kein aktives Advisory auf `buffers`/`binary`/`bluebird`. Die Beobachtung ist Kontext für zwei andere Findings: sie erklärt die Herkunft der brace-expansion-Meldungen (S08-06) und liefert mit `buffers` einen der elf UNKNOWN-Lizenzfälle im ausgelieferten Produkt (§4.3). `exceljs@4.4.0` ist die einzige direkte Abhängigkeit, die eine solche Alt-Kette einschleppt.

**Empfehlung**
Bei nächster Gelegenheit prüfen, ob `exceljs` durch eine gepflegte Alternative (`write-excel-file`, `xlsx-populate`) ersetzbar ist. Kein akuter Handlungsdruck.

---

### S08-24 · Info · Negativ-Nachweis: keine Provider-Secrets in 1.174 Commits

**Evidenz**
Vollständiger Scan aller 10.270 Blobs über alle 70 Refs (§2.2) gegen 29 Provider-Muster:

| Musterklasse                                                      | Treffer |
| ----------------------------------------------------------------- | ------- |
| OpenAI (`sk-`), Anthropic (`sk-ant-`)                             | 0       |
| GitHub (`ghp_`, `github_pat_`, `gho_`, `ghs_`)                    | 0       |
| AWS (`AKIA`/`ASIA`/`ABIA`/`ACCA`, Secret-Key-Zuweisung)           | 0       |
| Slack (`xox[baprs]-`, Webhooks)                                   | 0       |
| Google (`AIza`), Stripe, SendGrid                                 | 0       |
| Private Schlüssel (`-----BEGIN … PRIVATE KEY-----`)               | 0       |
| JWT (`eyJ….eyJ….`)                                                | 0       |
| npm-, GitLab-Token, Azure `AccountKey=`                           | 0       |
| `.env`/`.pem`/`.p12`/`.key`/DB-Dumps (je committet oder gelöscht) | 0       |

**Bewertung**
Info, aber ausdrücklich festzuhalten. Dieses Ergebnis entlastet BASE-001 in seiner gravierendsten denkbaren Ausprägung: die öffentliche Sichtbarkeit hat **keine** Zugangsdaten preisgegeben. Eine Notfall-Rotation von Produktiv-Secrets ist auf Basis der Historie nicht erforderlich. Für einen 1.174-Commit-Verlauf mit hohem KI-Assistenz-Anteil und angebundenen AI-Providern ist das ein überdurchschnittlich sauberes Ergebnis und spricht für die `.gitignore`-Disziplin des Projekts.

**Einschränkung:** Die Aussage gilt für die im Klon vorhandenen Objekte. Nicht überprüfbar sind serverseitig bereits garbage-collectete Objekte sowie Secrets in gelöschten Forks oder in GitHub-Issues/PR-Kommentaren, die kein Git-Objekt sind.

---

### S08-25 · Low · `apps/worker/tsconfig.tsbuildinfo` ist getrackt, obwohl `.gitignore` es ausschließt

**Evidenz**
`.gitignore:18`: `*.tsbuildinfo`

```
$ git ls-files | grep tsbuildinfo
apps/worker/tsconfig.tsbuildinfo
```

Die Datei wurde vor Einführung der Ignore-Regel committet (`6a70957d`, `87794ae7`) und deshalb weiter getrackt — `.gitignore` wirkt nicht auf bereits indizierte Dateien. In der Historie liegen 12 Versionen mit bis zu 958 KB.

**Geprüft:** Der Inhalt enthält ausschließlich repo-relative Pfade (`../../node_modules/typescript/lib/…`), **keine** absoluten Arbeitsplatzpfade. Kein Informationsleck.

**Bewertung**
Low. Build-Artefakt im Versionsverlauf: erzeugt Merge-Konflikte, verfälscht Diff-Statistiken und bläht den Klon auf. Kein Sicherheitsbezug.

**Empfehlung**
`git rm --cached apps/worker/tsconfig.tsbuildinfo`.

---

### S08-26 · Info · CI-Schwellwertprüfungen sind fail-open, wenn ihr Report nicht existiert

**Evidenz**
`.github/workflows/schema-drift.yml:43-53`:

```bash
        run: |
          MISSING=$(grep -c ",RLS_MISSING$" docs/security/rls-coverage-report.csv || echo 0)
          echo "RLS_MISSING count: $MISSING"
          BASELINE=131
          if [ "$MISSING" -gt "$BASELINE" ]; then
            echo "::error::RLS_MISSING count $MISSING exceeds baseline $BASELINE …"
            exit 1
          fi
```

Analog `.github/workflows/i18n-coverage.yml:44-56` (vier Zähler nach demselben Muster).

**Reproduktion** (Datei ohne Treffer, wie auf HEAD — dort ist die RLS_MISSING-Zahl 0):

```
$ printf 'a,OK\nb,OK\n' > t.csv
$ MISSING=$(grep -c ",RLS_MISSING$" t.csv || echo 0); echo "MISSING=[$MISSING]"
MISSING=[0
0]
$ BASELINE=131; if [ "$MISSING" -gt "$BASELINE" ]; then echo over; else echo ok; fi; echo "exit=$?"
bash: [: 0
0: integer expression expected
ok
exit=0
```

**Tatsächliches Verhalten — Korrektur einer naheliegenden Fehlannahme.** `grep -c` gibt bei null Treffern `0` aus **und** beendet sich mit Status 1; `|| echo 0` hängt eine zweite Zeile an, sodass `MISSING` den Wert `"0\n0"` trägt. `[ … -gt … ]` scheitert daran mit `integer expression expected` — der Schritt bricht deswegen aber **nicht** ab: eine fehlschlagende Bedingung im `if` ist von `bash -e` (dem Standard-Shell-Modus von GitHub Actions) ausgenommen, der `else`-Zweig greift, der Schritt endet mit Exit 0. Die Prüfung meldet also grün. Auf HEAD ist das inhaltlich zufällig korrekt, weil tatsächlich 0 Tabellen ohne RLS gezählt werden.

**Der eigentliche Defekt** liegt woanders: Existiert `docs/security/rls-coverage-report.csv` nicht — weil der vorgelagerte Generator seinen Report unter anderem Namen oder gar nicht schreibt —, so gibt `grep` nichts auf stdout aus und endet mit Status 2. `|| echo 0` setzt `MISSING="0"`, `0 -gt 131` ist falsch, der Schritt endet grün. **Die Kontrolle bestätigt dann Konformität, obwohl sie nichts geprüft hat.** Dasselbe gilt für alle vier Zähler in `i18n-coverage.yml`.

**Bewertung**
Info aus S08-Sicht: fail-open, aber mit vorgelagertem Generatorschritt, der bei einem Schreibfehler in aller Regel selbst rot wird. Der spurious `[: integer expression expected` im Log ist zusätzlich ein Rauschbeitrag, der zur Abstumpfung gegenüber CI-Meldungen beiträgt (vgl. S08-03). **Die inhaltliche Bewertung der Baseline von 131 Tabellen ohne RLS gehört zu S01, die CI-Vollständigkeit zu S13** — hier nur als Beobachtung notiert und weitergereicht.

**Empfehlung**
Vor der Auswertung die Existenz des Reports erzwingen (`test -f … || { echo "::error::report missing"; exit 1; }`), dann `MISSING=$(grep -c … || true); MISSING=${MISSING:-0}`.

---

## 6. Evidenzverzeichnis

Alle Dateien unter `/work/audit/evidence/S08/`:

| Datei                   | Inhalt                                                                      |
| ----------------------- | --------------------------------------------------------------------------- |
| `gitleaks-history.json` | gitleaks 8.21.2 Rohbefund (3 Falsch-Positive)                               |
| `scan_blobs.py`         | Der für dieses Audit geschriebene Blob-Scanner (29 Muster, Redaktionslogik) |
| `blob-scan-hits.jsonl`  | 475 Treffer, Werte auf Präfix + Länge redigiert                             |
| `all-objects.txt`       | 26.947 Objekt→Pfad-Zuordnungen (`git rev-list --all --objects`)             |
| `all-blobs-check.txt`   | Typ/SHA/Größe aller Objekte der Objektdatenbank                             |
| `npm-audit.json`        | `npm audit --json`, Gesamtbaum                                              |
| `npm-audit-prod.json`   | `npm audit --omit=dev --json`, Produktionsbaum                              |
| `npm-outdated.json`     | 44 veraltete Pakete                                                         |
| `licenses-all.json`     | Lizenzen aller 847 Pakete                                                   |
| `licenses-flagged.csv`  | 26 nicht-permissive/unklare Lizenzen mit PROD/dev-Scope                     |
| `prod-tree-paths.txt`   | 467 Knoten des Produktionsbaums                                             |
| `action-refs.txt`       | Alle 50 Action-Referenzen der 10 Workflows                                  |

---

## 7. Findings-Register S08

| ID     | Severity | Titel                                                                     | Ort                                                                         |
| ------ | -------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| S08-01 | High     | Öffentliches Repo liefert vollständige Angriffskarte der Produktivinstanz | `docs/security/lod-coverage.csv`, `docs/openapi.yaml:6-8`, `deploy/**`      |
| S08-02 | High     | Lizenzverletzung: bpmn.io-Wasserzeichen per CSS ausgeblendet              | `apps/web/src/components/bpmn/bpmn-editor.css:14-17`                        |
| S08-03 | High     | CI-Security-Gate schlägt auf HEAD fehl (Exit 1, 3 offene High-Advisories) | `scripts/audit-gate.mjs`, `.github/workflows/ci.yml:736-739`                |
| S08-04 | High     | `pdfjs-dist` JS-Ausführungs-Advisory auf dem DMS-Upload-Pfad              | `apps/web/package.json:54`, `apps/web/src/lib/documents/extract-text.ts:69` |
| S08-05 | High     | `aquasecurity/trivy-action@master` in Job mit `packages: write`           | `.github/workflows/ci.yml:660,671`                                          |
| S08-06 | Medium   | Audit-Gate-Allowlist beruht auf falscher Tatsachenbehauptung              | `scripts/audit-gate.mjs:28-37`                                              |
| S08-07 | Medium   | Trivy scannt erst nach dem Push nach `ghcr.io:latest`                     | `.github/workflows/ci.yml:592-621` vs. `:659-679`                           |
| S08-08 | Medium   | 42 von 50 Actions ungepinnt entgegen dokumentierter Zusage                | alle 10 Workflows; Zusage `coverage.yml:37-40`                              |
| S08-09 | Medium   | `TURBO_TOKEN` workflow-weit in `env`, `npm ci` ohne `--ignore-scripts`    | `.github/workflows/ci.yml:18-25`, `coverage.yml:22-27`                      |
| S08-10 | Medium   | Lizenz-Gate verfehlt SPDX-Kennungen und Custom-Lizenzen                   | `.github/workflows/ci.yml:769-771`                                          |
| S08-11 | Medium   | Worker-Image enthält kompletten Quellbaum, Tests, `deploy/`               | `Dockerfile.worker:75`, `.dockerignore`                                     |
| S08-12 | Medium   | Keine SBOM erzeugt oder veröffentlicht                                    | `.github/workflows/**`                                                      |
| S08-13 | Medium   | 10 von 12 Workspace-Paketen ohne `private: true`                          | `packages/*/package.json`                                                   |
| S08-14 | Medium   | Repo-Scanner überspringt jedes `security/`-Verzeichnis; Mustergaps        | `scripts/audit-secrets.mjs:41-47,24-39`                                     |
| S08-15 | Medium   | CI-Secret-Scans nur `--only-verified`, kein Historien-Scan                | `ci.yml:747-751`, `secret-scanning.yml:27-32`                               |
| S08-16 | Low      | Keine NOTICE/THIRD-PARTY-Datei — 803 Pakete mit Namensnennungspflicht     | Repo-Root, beide Dockerfiles                                                |
| S08-17 | Low      | Uneinheitliches Fail-Fast bei Secrets in Prod-Compose                     | `docker-compose.production.yml:75,76,114,212,217,220`                       |
| S08-18 | Low      | Dev-/CI-DB-Passwörter historienweit committet                             | `.env.example:18,19,91`, `ci.yml:148,271,427`                               |
| S08-19 | Low      | Web-Image `npm ci` ohne `--ignore-scripts` (Worker hat es)                | `Dockerfile:37` vs. `Dockerfile.worker:45`                                  |
| S08-20 | Low      | Dependabot-Fixes für alle gemeldeten CVEs liegen unfusioniert             | `origin/dependabot/npm_and_yarn/*`                                          |
| S08-21 | Low      | Basis-Images per Tag statt Digest; `apk upgrade` unreproduzierbar         | `Dockerfile:17,108`, `Dockerfile.worker:22,54`                              |
| S08-22 | Info     | Entwickler-Arbeitsplatzpfade und Benutzername in 5 historischen Blobs     | `docs/security/*`, `docs/session-handover-2026-04-1[45].md`                 |
| S08-23 | Info     | Unwartete Transitiven (`buffers@0.1.1`, `bluebird@3.4.7`) via `exceljs`   | `packages/reporting` → `exceljs@4.4.0`                                      |
| S08-24 | Info     | Negativ-Nachweis: 0 Provider-Secrets in 1.174 Commits / 10.270 Blobs      | gesamte Historie                                                            |
| S08-25 | Low      | `apps/worker/tsconfig.tsbuildinfo` getrackt trotz `.gitignore`            | `.gitignore:18` vs. `git ls-files`                                          |
| S08-26 | Info     | CI-Schwellwertprüfungen sind fail-open, wenn ihr Report fehlt             | `schema-drift.yml:44-52`, `i18n-coverage.yml:44-56`                         |

---

## 8. Schnittstellen zu anderen Streams

| Finding                                       | Übergabe an  | Grund                                                                                                               |
| --------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------- |
| S08-17 (`GRC_APP_PASSWORD:-`)                 | **S01**      | Ob ein leeres Passwort auf `DATABASE_URL` (Superuser, BYPASSRLS) zurückfällt, entscheidet über die RLS-Durchsetzung |
| S08-04 (`pdfjs-dist`)                         | **S04, S06** | Ausnutzbarkeit hängt an Upload-Validierung und DMS-Verarbeitungskette                                               |
| S08-01 (`lod-coverage.csv`, 7 anonyme Routen) | **S02**      | Die veröffentlichte Auth-Matrix ist zugleich die Sollvorgabe, gegen die S02 prüfen kann                             |
| S08-03, S08-07, S08-26                        | **S13**      | CI-Vollständigkeit und Wirksamkeit der Gates                                                                        |
| S08-11 (Testdateien im Image)                 | **S11**      | 412 getrackte Testdateien — Abgleich mit der Coverage-Realität                                                      |
| Hono `memo()`-Advisory (§4.1)                 | **S10**      | Cross-User-Datenoffenlegung im Worker-Runtime                                                                       |

---

_Ende S08. Erstellt 2026-08-31 gegen `a8d1414f`. Keine Datei in `/work/repo` wurde verändert; `npm audit` wurde ausschließlich lesend ausgeführt; es erfolgten keine Authentifizierungsversuche gegen fremde Dienste._
