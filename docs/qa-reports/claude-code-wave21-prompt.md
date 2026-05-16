# Claude Code — Wave 21: Beta-Blocker + Black-Box-Items vollständig schließen

**Quelle:** `arctos-qa-verification-2026-05-15-wave19-20.md`
**Branch:** `feature/wave-21-pilot-ready`
**User-Direktive:** "die beiden Blocker und alle Black-Box-Items müssen gefixed sein."
**Vorbedingung:** Hash-Chain `healthy v1=1229 v2=468 total=1697 mismatches=0`. Bleibt healthy.

---

## Scope

Wave 19+20 hat 5/19 Items vollständig geliefert, 8 sind in der Verifikation aus zwei Gründen nicht-grün geblieben:

1. **2 echte Beta-Blocker** — Code-Bugs die persistieren
2. **8 Black-Box-Items** — Endpoints fehlen, Seeds nicht geladen, Pfad-Drift, oder Public-API existiert gar nicht

Diese PR schließt **alle 10 Items**, dann ist die Plattform pilot-ready. Keine neuen Features bis das durch ist.

Format pro Item: **Symptom → Erwartung → Suchpfade → Akzeptanz-Test → Done-Kriterium.**

---

## Block A — Beta-Blocker (P0, KRITISCH)

### A1 — Finding `controlId/auditId/riskId/processId` Persistenz im POST

**Symptom (verifiziert 2026-05-15):**

```
POST /api/v1/findings
{
  title: 'W19 verify',
  severity: 'major_nonconformity',
  source: 'audit',
  controlId: '<valid-uuid>',
  description: '…'
}
→ 201 Created

GET /api/v1/findings/<new-id>
→ {
  controlId: null,        ← DROPPED in INSERT!
  auditId: null,
  riskId: null,
  controlTestId: null,
  status: 'identified',   ← Status-Mapping 'open' → 'identified' undokumentiert
  …
}
```

**Konsequenz:** Die in Wave 18 sauber implementierte Cascade-Aggregation in `/api/v1/controls/effectiveness/route.ts` (Lines 62-107) ist für alle API-erstellten Findings unwirksam. WHERE-Clause `finding.controlId is not null` schließt sie aus. Die 4 Cascade-Hits aus dem Seed sind SQL-direct gesetzt und nicht via API.

**Erwartung:**

1. POST-Handler liest und persistiert `controlId`, `auditId`, `riskId`, `processId` (alle Cross-Module-FKs die im Drizzle-Schema existieren)
2. Zod-Body-Schema akzeptiert diese Felder als `.uuid().optional()`
3. INSERT-Statement gibt die Felder mit
4. GET-Response liefert sie (Field-Projection)
5. PATCH `/findings/{id}` (oder PUT) erlaubt nachträgliches Setzen — aktuell PATCH 405, PUT 422
6. Status-Mapping `'open' → 'identified'`: entweder strict-rejecten mit Enum-Liste UND OpenAPI-Doku ODER `'open'` als Alias akzeptieren mit Doku — **nicht still überschreiben**

**Suchpfade:**
- `apps/web/src/app/api/v1/findings/route.ts` (POST)
- `apps/web/src/app/api/v1/findings/[id]/route.ts` (GET, PATCH/PUT)
- `packages/shared/src/schemas/finding.ts`
- `packages/db/src/schema/finding.ts` (FK-Spalten sollten existieren — verify)

**Akzeptanz-Test:**
```ts
// apps/web/src/__tests__/api/findings-cross-module-links.test.ts
describe("Finding cross-module persistence", () => {
  test("POST persists controlId + GET returns it", async () => {
    const r = await POST({ ..., controlId: c1.id });
    expect(r.status).toBe(201);
    const j = await r.json();
    const g = await GET(`/findings/${j.data.id}`);
    expect(g.data.controlId).toBe(c1.id);
  });

  test("POST persists auditId, riskId, processId", async () => {
    // Same shape for all 3
  });

  test("PATCH /findings/{id} sets controlId post-create", async () => {
    const created = await POST({ ... });  // no controlId
    const patched = await PATCH(`/findings/${created.id}`, { controlId: c1.id });
    expect(patched.status).toBe(200);
    expect((await GET).data.controlId).toBe(c1.id);
  });

  test("Status 'open' is rejected with helpful enum-list", async () => {
    const r = await POST({ ..., status: 'open' });
    expect(r.status).toBe(422);
    expect(r.body.error.fieldErrors.status[0]).toMatch(/identified|in_review|.../);
  });

  test("Cascade picks up API-created critical finding", async () => {
    const before = (await GET('/controls/effectiveness')).data.openCriticalFindings;
    await POST({ severity: 'major_nonconformity', status: 'identified', controlId: c1.id });
    const after = (await GET('/controls/effectiveness')).data.openCriticalFindings;
    expect(after).toBe(before + 1);
  });
});
```

**Done:** Alle 5 Tests grün. Cowork-QA-Marathon-Cascade-Test reproduzierbar: POST mit controlId → +1 in Cascade.

---

### A2 — `GET /admin/branding` 500

**Symptom:** `GET /api/v1/admin/branding → 500 "Internal server error"` (seit Wave 17 unverändert)

**Vorgehen:**

1. Server-Log mit RequestID inspizieren
2. Drizzle-Schema `organizationBranding` o.ä. prüfen — existiert die Tabelle?
3. Wenn Tabelle existiert: Org-Scope-Filter (`orgId = ctx.orgId`) korrekt? Single-row-default-Branding seeden falls leere Tabelle = error
4. Wenn Feature nicht produktiv ist: `501 Not Implemented` mit RFC-7807-Body statt 500

**Suchpfade:**
- `apps/web/src/app/api/v1/admin/branding/route.ts`
- `packages/db/src/schema/admin.ts` oder `organization.ts`

**Akzeptanz-Test:**
```ts
test("GET /admin/branding returns 200 with branding-config OR 501 Not Implemented", async () => {
  const r = await GET('/api/v1/admin/branding');
  expect([200, 501]).toContain(r.status);
  if (r.status === 200) {
    expect(r.body.data).toMatchObject({
      logoUrl: expect.any(String),
      primaryColor: expect.any(String),
      // …
    });
  }
});
```

**Done:** Endpoint liefert 200 oder 501, nie 500.

---

## Block B — Black-Box-Items (Endpoints/Seeds/Pfade)

### B1 — AI-Router Public-Health-Endpoint

**Symptom:**
```
GET /api/v1/ai/router/health → 404 (returns HTML login page = wirklich 404)
GET /api/v1/ai/health        → 404
```

CLAUDE.md erwähnt "Multi-Provider-Router (Claude, OpenAI, Gemini, Ollama)". Test-Coverage hat Privacy-Router-Edge-Cases (Task #10). Aber: kein öffentlicher Health-Endpoint.

**Erwartung:**

```
GET /api/v1/ai/router/health → 200
{
  data: {
    asOf: "2026-05-15T…",
    providers: [
      { name: "claude",  status: "healthy", latencyMs: 234, model: "claude-opus-4-6" },
      { name: "openai",  status: "healthy", latencyMs: 412, model: "gpt-4o" },
      { name: "gemini",  status: "degraded", latencyMs: 1820, model: "gemini-2.0" },
      { name: "ollama",  status: "healthy", latencyMs: 89, model: "llama-3.1" }
    ],
    privacyTierRouting: {
      public:       "claude",
      internal:     "claude",
      confidential: "ollama",
      restricted:   "ollama"
    },
    lastFailover: "2026-05-14T22:13:00Z"
  }
}
```

**Suchpfade:** `apps/web/src/app/api/v1/ai/...`, `packages/ai/src/router.ts`

**Akzeptanz-Test:**
```ts
test("AI router health endpoint", async () => {
  const r = await GET('/api/v1/ai/router/health');
  expect(r.status).toBe(200);
  expect(r.data.providers.length).toBeGreaterThan(0);
  expect(r.data.privacyTierRouting.confidential).toMatch(/ollama|local/);
});
test("Failover when primary times out", async () => { ... });
```

**Done:** Health-Endpoint + Failover-Test grün.

---

### B2 — ESG-Datapoints Seed laden

**Symptom:**
```
GET /api/v1/esg/datapoints → 200
{ data: { total: 0, datapoints: [], byStandard: {} } }
```

`packages/db/sql/seed_esrs_datapoints.sql` existiert (CLAUDE.md erwähnt "CSRD-Datenfelder"). Wird im prod-seed nicht geladen.

**Erwartung:**

1. Migration oder Seed-Skript `seed_esrs_datapoints` in `seed-all.ts` / `seed.ts` Sequenz aufnehmen
2. Mindestens die ESRS-Standard-Datapoints E1-E5, S1-S4, G1 (rd. 1.144 Datapoints im offiziellen ESRS-Set)
3. `GET /esg/datapoints?limit=10` zeigt ≥ 100 Einträge
4. `POST /esg/metrics {datapointId: <gültig>}` als esg_manager → 201

**Suchpfade:**
- `packages/db/sql/seed_esrs_datapoints.sql`
- `packages/db/src/seed.ts` oder `seed-all.ts`
- `packages/db/scripts/seed-all.ts`

**Akzeptanz-Test:**
```ts
test("ESG datapoints seeded", async () => {
  const r = await GET('/api/v1/esg/datapoints?limit=100');
  expect(r.data.total).toBeGreaterThan(100);
  expect(r.data.byStandard).toHaveProperty('ESRS_E1');
});
test("ESG manager can create metric with valid datapointId", async () => {
  loginAs('esg@meridian.test');
  const dp = (await GET('/esg/datapoints?limit=1')).data.datapoints[0];
  const r = await POST('/esg/metrics', { name:'…', datapointId: dp.id, unit:'tCO2e', frequency:'quarterly' });
  expect(r.status).toBe(201);
});
```

**Done:** Datapoint-Seed in prod-flow, Tests grün.

---

### B3 — Compliance-Frameworks Public-API

**Symptom:**
```
GET /api/v1/compliance/frameworks → 404
GET /api/v1/frameworks → 404
GET /api/v1/compliance-frameworks → 404
```

Aber: CLAUDE.md sagt "46 Frameworks geseedet, ~960 Cross-Framework-Mappings". `/api/v1/compliance/coverage?framework=iso-27001` reagiert (200) aber liefert alles Null. → **Frameworks-Tabelle existiert intern, aber keine Public-API.**

**Erwartung:**

1. `GET /compliance/frameworks` → Liste der 46 Frameworks mit `{id, code, name, category, version, controlCount}`
2. `GET /compliance/frameworks/{code}` → Detail mit Control-Liste
3. `GET /compliance/coverage?framework={code}` zeigt realistische %-Werte (`overallCoveragePct > 0`, `frameworks: [...]`)
4. `GET /compliance/cross-mappings?from=iso-27001&to=nis2` → ~30+ Mappings

**Suchpfade:**
- `apps/web/src/app/api/v1/compliance/...` (existiert vermutlich teilweise)
- `packages/db/src/schema/compliance.ts` oder `framework.ts`

**Akzeptanz-Test:**
```ts
test("46 frameworks accessible via public API", async () => {
  const r = await GET('/compliance/frameworks');
  expect(r.data.items.length).toBeGreaterThan(40);
});
test("Coverage shows realistic values", async () => {
  const r = await GET('/compliance/coverage?framework=iso-27001');
  expect(r.data.frameworkCount).toBeGreaterThan(0);
  // wenigstens ein Control ist gemappt
});
test("Cross-mapping ISO 27001 → NIS2 returns mappings", async () => {
  const r = await GET('/compliance/cross-mappings?from=iso-27001&to=nis2');
  expect(r.data.items.length).toBeGreaterThan(20);
});
```

**Done:** 3 Tests grün, Coverage liefert Daten.

---

### B4 — Bulk-Operations-API

**Symptom:**
```
POST /api/v1/risks/bulk → 405 Method Not Allowed
POST /api/v1/bulk/risks → 404
POST /api/v1/risks/import → 405
```

Critical Implementation Rule #11 (Bulk-Cap) hat ein Test-Pendant aber keinen produktiven API-Endpoint.

**Erwartung:**

1. `POST /risks/bulk` mit `{items: [...]}` body, Max 100 Items per Request (Cap), 201 mit `{created: [...], errors: [...]}` Response
2. `POST /controls/bulk`, `/findings/bulk`, `/treatments/bulk` analog
3. Bei > 100 Items: 422 mit `{maxBulkSize: 100, providedSize: N}` und klarer Message
4. Bei Mixed-Erfolg (50 OK + 3 invalid): 207 Multi-Status oder 201 mit `errors:[]` Liste
5. Audit-Log: 1 Hash-Chain-Entry pro persistiertem Item (NICHT 1 für die ganze Operation)

**Suchpfade:** Neue Routes unter `apps/web/src/app/api/v1/{entity}/bulk/route.ts`. Bulk-Cap-Util in `packages/api/src/lib/bulk.ts`.

**Akzeptanz-Test:**
```ts
test("Bulk-create 50 risks within cap", async () => {
  const r = await POST('/risks/bulk', { items: Array(50).fill({...}) });
  expect(r.status).toBe(201);
  expect(r.data.created.length).toBe(50);
});
test("Bulk-create 200 risks rejected with cap", async () => {
  const r = await POST('/risks/bulk', { items: Array(200).fill({...}) });
  expect(r.status).toBe(422);
  expect(r.data.error.maxBulkSize).toBe(100);
});
test("Hash-chain entry per item", async () => {
  const before = (await GET('/audit-log/integrity')).data.total;
  await POST('/risks/bulk', { items: Array(10).fill({...}) });
  const after = (await GET('/audit-log/integrity')).data.total;
  expect(after - before).toBeGreaterThanOrEqual(10);
});
```

**Done:** Bulk-Endpoints für Risks + Controls + Findings + Treatments, alle 3 Tests grün.

---

### B5 — DMS Path-Drift

**Symptom:**
```
GET /api/v1/dms/documents     → 404
GET /api/v1/documents         → 200 ✅ (anderer Pfad!)
GET /api/v1/dms               → 404
```

DMS existiert unter `/documents`, nicht `/dms/documents`. Wave-19-Prompt empfahl `/dms/documents`. Doku-Inkonsistenz.

**Erwartung:** Pfade vereinheitlichen — Empfehlung: `/dms/documents` als Canonical (matched die `module_key`-Konvention), `/documents` als Redirect-Alias für 1-2 Releases mit Deprecation-Warning-Header.

**Suchpfade:** `apps/web/src/app/api/v1/documents/`, ggf. Konsolidierung mit DMS-Module

**Akzeptanz-Test:**
```ts
test("DMS at /dms/documents (canonical)", async () => {
  expect((await GET('/dms/documents')).status).toBe(200);
});
test("Old /documents redirects with deprecation warning", async () => {
  const r = await fetch('/api/v1/documents');
  expect(r.headers.get('warning')).toMatch(/deprecated/);
});
```

**Done:** Canonical-Pfad funktioniert, alter Pfad mit Deprecation-Warning.

---

### B6 — Programmes Demo-Seed + Maturity-Auto-Compute

**Symptom:**
```
GET /programmes?limit=2 → 200, aber Liste vermutlich leer
GET /programmes/{id}/maturity-breakdown → kann nicht getestet werden (kein Programme-id)
```

Marathon-Befund: "Maturity-Auto-Berechnung aus Control-Effectiveness ist hardgecoded statt aus Daten abgeleitet."

**Erwartung:**

1. Mindestens 2 Programme im Demo-Seed (z.B. "ISO 27001 Zertifizierung 2026", "DSGVO-Compliance-Roadmap")
2. Beide mit Phase (`planning/execution/...`) + verlinkten Controls + Risks
3. `GET /programmes/{id}/maturity-breakdown` liefert Berechnung:
   ```
   {
     overallMaturity: 3,  // ML1-5
     components: {
       controlEffectiveness: 4,   // aus Control-Tests
       auditCoverage: 3,          // aus letzten 12 Monaten
       riskTreatmentQuote: 2,     // aus offenen Treatments
       documentationCompleteness: 3
     },
     weighting: {...},
     trend: 'improving' | 'stable' | 'declining'
   }
   ```
4. Werte werden LIVE aus DB berechnet, nicht hardcoded

**Suchpfade:**
- `apps/web/src/app/api/v1/programmes/...`
- `packages/db/src/seed.ts` für Programme-Seed
- `packages/automation/src/...` für Maturity-Computation

**Done:** 2 Programmes im Seed, Maturity-Endpoint liefert dynamisch berechnete Werte, Test in `packages/automation/__tests__/programme-maturity.test.ts`.

---

### B7 — Multi-Tenant RLS Cross-Tenant-Probe-Suite

**Symptom:**
```
process-owner@meridian.test sucht "foreign" risk via /risks → none-found
```

Konnte nicht direkt probed werden, weil RLS schon im SELECT filtert. Aber: keine systematische Test-Suite mit zweiter Org.

**Erwartung:**

1. Zweite Demo-Org im Seed: "Arctos-Test-Tenant" oder bestehende "Arctis Textilservice GmbH" mit `vendor-mgr@arctistx.test` + eigenen Daten (10 Risks, 5 Controls)
2. Test-Suite in `packages/db/src/__tests__/rls/cross-tenant-isolation.test.ts`:
   - Org-A-User liest Org-B-Risk direkt via ID → muss 404 sein
   - Org-A-User listet `/risks` → keine Org-B-Daten in der Response
   - Org-A-User mutiert Org-B-Risk via PUT → 404 oder 403
   - Cross-tenant Query-Param `?orgId=<B>` als A-User → ignoriert, returns A-Daten
3. `docs/security/rls-coverage-report.md` zeigt 100% RLS-Coverage über alle 545 Tabellen, oder explizit ausgenommene mit ADR-Reference

**Akzeptanz-Test:**
```ts
test.each(TABLES_WITH_ORG_ID)("Cross-tenant isolation for %s", async (table) => {
  // Org-A creates row, Org-B-user GETs by id → 404
});
```

**Done:** Cross-tenant-test-suite grün über alle org-scoped Tabellen, RLS-Report 100%.

---

### B8 — Notifications Live-Trigger E2E

**Symptom:**
```
GET /notifications?limit=10 → 200 (Body durch Proxy blocked, Inhalt unbekannt)
```

Endpoint reagiert, aber nicht verifiziert ob Risk-Create/DSR-Create/Audit-Schedule wirklich Notifications generieren.

**Erwartung:**

E2E-Test pro Trigger:
1. **Risk-assigned**: `POST /risks {ownerId:X}` → User X hat Notification mit `type:'risk_assigned'`
2. **DSR-received**: `POST /dpms/dsr {...}` → alle DPOs der Org haben Notification
3. **Audit-scheduled**: `POST /audit-mgmt/audits {assignedTo:X}` → User X + Audit-Subject Notifications
4. **Incident-high-severity**: `POST /incidents {severity:'high'}` → CISO + Security-Analyst Notifications
5. **Email-Trigger**: Im Dev-Mode wird Resend-API mit Mock-Catcher abgefangen — verifiziere Email-Body rendert ohne React-Email-Errors
6. **Mark-as-read** Flow: `POST /notifications/{id}/read` → unread-count -1

**Akzeptanz-Test:**
```ts
test.each([
  { trigger: 'risk-assigned', endpoint: '/risks', body: { ownerId: U.id }, expectType: 'risk_assigned' },
  { trigger: 'dsr-received',  endpoint: '/dpms/dsr', body: {...}, expectType: 'dsr_received' },
  { trigger: 'audit-scheduled', endpoint: '/audit-mgmt/audits', body: { assignedTo: U.id }, expectType: 'audit_scheduled' },
  { trigger: 'incident-high', endpoint: '/incidents', body: { severity:'high' }, expectType: 'incident_alert' }
])("Notification trigger: %s", async ({ endpoint, body, expectType }) => {
  await loginAs(U);
  const before = (await GET('/notifications?unread=true')).data.total;
  await POST(endpoint, body);
  const after = (await GET('/notifications?unread=true')).data.total;
  expect(after).toBeGreaterThan(before);
  const latest = (await GET('/notifications?limit=1')).data.items[0];
  expect(latest.type).toBe(expectType);
});
```

**Done:** 4 Trigger-Tests grün, Email-Render-Smoke ohne Errors, Mark-as-read funktioniert.

---

### B9 — PDF-Export Format-Parameter respektieren

**Symptom:** (Wave 19 neu gefunden)
```
GET /export/risk?format=pdf      → 200, ABER content-type: text/csv (Format ignoriert!)
GET /export/finding?format=pdf   → 200, ABER content-type: text/csv
```

**Erwartung:**

1. `?format=pdf` liefert `application/pdf`, PDF/A-2b-konform
2. `?format=csv` weiter wie bisher
3. `?format=xlsx` als Bonus (XLSX-Export)
4. Bei `format=pdf`: ein Export-Job-Pattern (zurückgeben job-id, async-rendering) wenn synchron zu langsam wird

**Suchpfade:**
- `apps/web/src/app/api/v1/export/[entityType]/route.ts`
- `packages/reporting/src/...` für PDF-Generation

**Akzeptanz-Test:**
```ts
test.each([
  ['risk', 'pdf', 'application/pdf'],
  ['risk', 'csv', 'text/csv'],
  ['risk', 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['finding', 'pdf', 'application/pdf'],
  ['control', 'pdf', 'application/pdf']
])("Export %s as %s returns %s", async (entity, format, expectedCT) => {
  const r = await fetch(`/api/v1/export/${entity}?format=${format}`);
  expect(r.status).toBe(200);
  expect(r.headers.get('content-type')).toContain(expectedCT);
});

test("PDF export is PDF/A-2b compliant", async () => {
  const buf = await (await fetch('/api/v1/export/risk?format=pdf')).arrayBuffer();
  // Magic-bytes check + PDF/A marker
  expect(buf.byteLength).toBeGreaterThan(1024);
  expect(parsePdfAconformance(buf)).toMatch(/2[ab]/);
});
```

**Done:** 5 Tests grün, PDF/A-Validierung dokumentiert.

---

### B10 — Academy Enrollment + Progress E2E

**Symptom:** `GET /academy/courses → 200` (body blocked, content nicht verifiziert).

**Erwartung:**

1. Seed enthält ≥ 10 Courses (gdpr, info_security, anti_corruption, nis2, dora, esg, phishing, code_of_conduct, aml, data_classification, incident_response, bcm, whistleblowing)
2. `POST /academy/enrollments {courseId, userId}` als department_head → 201
3. `GET /academy/users/{userId}/enrollments` → Liste enrolled courses mit progress
4. `POST /academy/enrollments/{id}/progress {percent: 50}` → 200, progress: 50
5. `POST /academy/enrollments/{id}/complete` → 200, completedAt: NOW
6. `GET /academy/users/{userId}/compliance-trainings-overdue` → Liste der überfälligen

**Akzeptanz-Test:** vollständiger Enrollment → Progress → Complete-Walk-Through.

**Done:** Academy-Module End-to-End grün.

---

## Block C — Ergänzungen aus Wave 19+20 (Polish)

### C1 — UI-Forms Playwright-CI-Run

**Erwartung:** Playwright-Tests in `apps/web/e2e/forms/*.spec.ts` für Risks/Controls/Findings/DPIAs/Audits/Vendors/Contracts. Coverage-Bericht in CI sichtbar.

**Done:** 7 Form-Specs grün, in CI-Output.

### C2 — Performance Concurrent-Load Baseline

**Erwartung:** K6/autocannon-Script in `scripts/perf/wave21-baseline.js`, Lauf gegen `/risks?limit=100` mit 50 VU für 60s. Report-Markdown `docs/performance/wave21-baseline.md` mit P50/P95/P99/RPS/Errors.

**Done:** P95 < 500ms, P99 < 1s, 0 Errors, Hash-Chain healthy nach Lauf.

### C3 — Contract Backwards-Compat-Layer

**Erwartung:** `name` weiter akzeptieren mit `Warning: 299 - "Use 'title' instead of 'name', deprecated since v0.2.x"` Header für 2 Releases.

**Done:** Test: POST mit `name` → 201 mit Warning-Header, POST mit `title` → 201 ohne Warning.

---

## Done-Kriterien für die Gesamt-PR

| Kategorie | Done wenn |
|---|---|
| **Block A** | Beide Beta-Blocker (Finding controlId, /admin/branding) grün. |
| **Block B** | Alle 10 Black-Box-Items haben Tests, Endpoints liefern Daten (nicht Zero/404/500). |
| **Hash-Chain** | `healthy=true, mismatches=0, v1=1229` nach allen Mutationen. |
| **RBAC-Suite** | `domain-rbac-suite.test.ts` SPECS für neue Bulk-Routes ergänzt. |
| **RLS-Report** | `docs/security/rls-coverage-report.md` zeigt 100% Coverage. |
| **CHANGELOG** | Jeder Endpoint-Add + Schema-Change dokumentiert. |
| **Migrations** | Falls neue Spalten/Indizes: Nummer ≥ 0325, idempotent. |
| **Wave-19-Regression** | Alle 5 Wave-19+20-Greens bleiben grün (CISO findings, Incident DSGVO 72h, BIA Gates, Whistleblowing HinSchG, Hash-Chain). |
| **Pilot-Readiness-Checkliste** | Diese 4 müssen erfüllt sein, sonst kein Pilot:<br/>1. Finding-Cascade funktioniert end-to-end<br/>2. Admin-Endpoints liefern 200 oder 501 (kein 500)<br/>3. ESG/Compliance/Bulk/AI-Router APIs erreichbar<br/>4. Cross-Tenant-Isolation getestet |

---

## Vorgehen (empfohlen)

**Tag 1: Block A (Beta-Blocker)**
- A1 Finding-controlId (oberste Priorität)
- A2 /admin/branding

**Tag 2-3: Block B kritisch**
- B4 Bulk-Operations
- B7 Multi-Tenant RLS Test-Suite

**Tag 4-5: Block B mittel**
- B2 ESG-Datapoints Seed
- B3 Compliance-Frameworks Public-API
- B9 PDF-Export Format
- B1 AI-Router Health

**Tag 6-7: Block B Polish + Block C**
- B5 DMS Path
- B6 Programmes Seed
- B8 Notifications E2E
- B10 Academy E2E
- C1 UI-Forms
- C2 Performance
- C3 Contract Backwards-Compat

**Tag 8: PR-Review + Hash-Chain-Pre-Merge-Check**

**Aufteilung:** 1 großer PR ODER 3 PRs (Block A, B, C). Empfehlung: 2 PRs — `pr-21a-blockers` (Block A + B4 + B7) + `pr-21b-coverage` (B1, B2, B3, B5, B6, B8, B9, B10, C1-3). Block A ist Pilot-Showstopper, der Rest kann iterativ.

---

## Test-Account-Cheat-Sheet (unverändert)

```
Org: Meridian Holdings GmbH = ccc4cc1c-4b09-499c-8420-ebd8da655cd7
Password: WaveQA-2026!

Email                                Role                    LoD
ciso@meridian.test                   ciso                    2nd
dpo@meridian.test                    dpo                     2nd
compliance@meridian.test             compliance_officer      2nd
auditor@meridian.test                auditor                 3rd
process-owner@meridian.test          process_owner           1st
vendor-mgr@meridian.test             vendor_manager (W18)    1st
esg@meridian.test                    esg_manager             2nd
whistleblowing@meridian.test         whistleblowing_officer  —
viewer@meridian.test                 viewer                  —

admin@arctos.dev / admin123          admin
```

**Für B7 Cross-Tenant-Test:** Zweite Org seeden mit eigenen Users:
```
Vorschlag: Arctis Textilservice GmbH = 7cf7aa82-af08-48f5-80d0-eb46b6e37319
Users seeden: ciso@arctistx.test, process-owner@arctistx.test, vendor-mgr@arctistx.test
Mit Daten: 10 Risks, 5 Controls, 3 Audits, 2 DPIAs
```

---

## Anti-Patterns (zur Vermeidung)

1. **404-Endpoint als "implemented" markieren** ohne Smoke-Test gegen Live-Server
2. **Seed-Daten dokumentieren** ohne tatsächlich in `seed-all.ts` Sequenz aufzunehmen
3. **Cascade-Aggregation fixen** ohne den Upstream-Persistenz-Bug zu lösen (Wave 18 → Wave 19 Lehre)
4. **Format-Parameter im Route-Handler ignorieren** — defensives Programmieren, kein implizites Default
5. **Bulk-Create ohne Cap** — DoS-Vektor
6. **Cross-Tenant-Test mit nur einer Org** — RLS-Coverage nicht beweisbar

---

## Erfolgs-Meldung an Cowork QA

Nach Merge:
> "Wave 21 deployed. Hash-chain integrity: healthy v1=1229 v2=<N> mismatches=0.
> Block A: 2/2 Beta-Blocker grün. Block B: 10/10 Black-Box-Items implementiert. Block C: 3/3 Polish.
> Cowork QA bitte Final-Verifikation für Pilot-Ready-Sign-Off starten."

Cowork QA fährt dann den finalen Marathon: alle 19 Marathon-Items + alle 18 Wave-19+20-Items + alle 13 Wave-21-Items. Dann ist die Plattform **Pilot-Ready** und kann an ersten Kunden gehen.

---

*Wave 21 Final-Closure-Prompt geschrieben von Cowork QA, 2026-05-15. Schließt 2 Beta-Blocker + 10 Black-Box-Items + 3 Polish = 15 Items. Nach Wave 21 ist die Plattform pilot-tauglich für GRC-Erstkunden.*
