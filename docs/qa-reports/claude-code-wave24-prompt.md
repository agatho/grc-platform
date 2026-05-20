# Claude Code — Wave 24: Alpha Quality Closure

**Quelle:** `arctos-alpha-findings-2026-05-15.md`
**Branch:** `feature/wave-24-alpha-quality`
**User-Direktive:** „Auch an eine Alpha habe ich Qualitätsansprüche. Alles was wir finden muss gefixed werden."

**Vorbedingung:**
- Hash-Chain v3 healthy `total=15425 mismatches=0` muss bleiben
- Wave 23 has shipped: A2 `/admin/branding` ✅, ESG/Bulk/RLS-Cross-Tenant/Compliance-Frameworks ✅
- A1 Finding-FK-Persistenz ist nach **5 Wellen** noch nicht gefixt

---

## Scope-Übersicht

13 Items aus der Alpha-Verification 2026-05-15. Alles wird gefixed — keine Priorisierung als „später", da der User auch in der Alpha Qualitätsansprüche stellt.

| Block | Items | Severity |
|---|---|---|
| **A. A1 ENDGAME** mit Live-Debug | 1 | P0 (5. Welle!) |
| **B. Wave-23-Regressions reverten** | 4 | P1 (von W23 verursacht) |
| **C. Hash-Chain v3 Continuity ADR** | 1 | P0 (Compliance) |
| **D. Workflow-Endpoint-Lücken** | 7 | P1/P2 |
| **E. Verbleibende Journey-Tests** | 5 | Test-Pflicht |

---

## Block A — A1 Finding-FK-Persistenz: FÜNFTE WELLE

### A1 — Pflicht-Live-Debug + Production-Hotfix

Status: **5 Wellen vergeblich**. Wave 21 Status-Strict-Reject hat es in den Build geschafft, aber die FK-Persistenz NIE — obwohl Repo-Code (Route Zeile 122–141, Zod-Schema, Drizzle-Schema) korrekt aussieht. Symptom unverändert:

```
POST /findings {controlId:VALID, auditId:VALID, riskId:VALID}
→ 201
GET /findings/{id}
→ {controlId:null, auditId:null, riskId:null}
```

**Diesmal mit eskalierter Diagnose:**

#### A1-D1 — Production Build Audit (PFLICHT)

```bash
# In Prod-Host
docker exec -it arctos-web sh -c 'cat /app/.next/BUILD_ID && cat /app/package.json | grep version'

# Auf GitHub vergleichen
git log feature/wave-23-endgame --oneline -10
git diff main..feature/wave-23-endgame -- apps/web/src/app/api/v1/findings/route.ts
```

→ Ist die letzte HEAD-Commit-SHA von `feature/wave-23-endgame` im Build-Artefakt?
→ Im PR dokumentieren: `Prod BUILD_ID: <X>, Main HEAD-SHA: <Y>, Match: yes/no`

#### A1-D2 — Production Database Schema Verify

```bash
psql -d grc_platform_prod -c '\d finding' > /tmp/finding_schema.txt
psql -d grc_platform_prod -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'finding'
  AND column_name IN ('control_id', 'audit_id', 'risk_id', 'control_test_id');
"
```

→ Im PR-Output dokumentieren. Wenn `control_id` fehlt → Migration nicht gelaufen.

#### A1-D3 — Permanent Debug-Endpoint (Production-Diagnose)

**Neuer Endpoint** `apps/web/src/app/api/v1/_debug/finding-insert-trace/route.ts` (nur in non-prod oder hinter Admin-Token):

```typescript
import { db, finding } from "@grc/db";
import { withAuth } from "@/lib/api";
import { sql } from "drizzle-orm";

export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  
  const raw = await req.json();
  const traces: any[] = [];
  
  traces.push({ stage: "raw-body", value: raw });
  
  // Direct insert bypassing all middleware
  try {
    const directResult = await db.execute(sql`
      INSERT INTO finding (org_id, work_item_id, title, severity, source, control_id, audit_id, risk_id, created_by, updated_by)
      VALUES (
        ${ctx.orgId},
        gen_random_uuid(),
        ${raw.title || 'debug-direct-insert'},
        ${raw.severity || 'minor_nonconformity'},
        ${raw.source || 'audit'},
        ${raw.controlId},
        ${raw.auditId},
        ${raw.riskId},
        ${ctx.userId},
        ${ctx.userId}
      )
      RETURNING id, control_id, audit_id, risk_id;
    `);
    traces.push({ stage: "direct-sql-insert", result: directResult.rows[0] });
  } catch (e: any) {
    traces.push({ stage: "direct-sql-insert", error: e.message });
  }
  
  // Drizzle ORM insert with explicit values
  try {
    const drizzleResult = await db.insert(finding).values({
      orgId: ctx.orgId,
      workItemId: crypto.randomUUID(),
      title: 'drizzle-test',
      severity: 'minor_nonconformity',
      source: 'audit',
      controlId: raw.controlId,
      auditId: raw.auditId,
      riskId: raw.riskId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    }).returning();
    traces.push({ stage: "drizzle-insert", result: drizzleResult[0] });
  } catch (e: any) {
    traces.push({ stage: "drizzle-insert", error: e.message });
  }
  
  return Response.json({ traces });
}
```

Cowork QA wird gegen diesen Endpoint einen Test mit valider controlId schießen. Die zwei Traces zeigen:

- **Direct-SQL-INSERT** persistiert: → Problem ist im Drizzle-Layer
- **Drizzle-INSERT** persistiert: → Problem ist im Route-Handler / Zod-Layer
- **Beide null**: → Problem ist in DB (Trigger, Default, RLS)

Dieser Debug-Endpoint **bleibt drin bis A1 gefixt** und wird dann via Migration 0336 entfernt.

#### A1-Fix-Acceptance

```ts
// apps/web/src/__tests__/api/findings-fk-persistence.test.ts
test("W24-A1: Live test against prod via debug endpoint", async () => {
  const ctrl = await getOrCreateControl();
  const r = await POST("/api/v1/_debug/finding-insert-trace", { controlId: ctrl.id });
  expect(r.body.traces[0].value.controlId).toBe(ctrl.id);  // raw body
  expect(r.body.traces[1].result.control_id).toBe(ctrl.id); // direct SQL
  expect(r.body.traces[2].result.controlId).toBe(ctrl.id);  // drizzle
});

test("W24-A1: POST /findings persists controlId via production endpoint", async () => {
  const ctrl = await getOrCreateControl();
  const r = await POST("/api/v1/findings", {
    title: "Persistence",
    severity: "major_nonconformity",
    source: "audit",
    controlId: ctrl.id
  });
  const g = await GET(`/api/v1/findings/${r.body.data.id}`);
  expect(g.body.data.controlId).toBe(ctrl.id);
});
```

**Done:** Production Live-Server liefert controlId im GET zurück. Beide Tests grün.

---

## Block B — Wave-23-Regressions reverten

Wave 23 hat 4 RBAC/Method-Tightening-Änderungen deployed, die User-facing Workflows brechen:

### B1 — W24-CISO-HASH-403: CISO darf `/audit-log/integrity` wieder lesen

**Verhalten heute:**
```
GET /api/v1/audit-log/integrity als ciso@meridian.test → 403 "Required role(s): admin, auditor"
```

**Problem:** CISO ist 2nd-Line-of-Defense. Wenn er Hash-Chain-Health nicht prüfen kann, verliert er Compliance-Trust-Signal für sein Quartals-Review. ISO 27001 A.12.4.2 verlangt dass die Information-Security-Verantwortung (CISO) Audit-Log-Integrität sehen kann.

**Fix:** `withAuth(...)` um `'ciso'` erweitern:

```typescript
const ctx = await withAuth("admin", "auditor", "ciso", "compliance_officer");
```

**Test:**
```ts
test.each(["admin", "auditor", "ciso", "compliance_officer"])(
  "W24-B1: %s can read /audit-log/integrity",
  async (role) => {
    loginAs(role);
    const r = await GET("/api/v1/audit-log/integrity");
    expect(r.status).toBe(200);
    expect(r.body.data.healthy).toBe(true);
  }
);
```

### B2 — W24-F1-FILTER-500: `GET /findings?status=open|in_review` 500

**Verhalten:**
- `?status=identified` → 200 ✅
- `?status=open` → 500 mit RequestID `81d9101ffa46f648`
- `?status=in_review` → 500
- `?status=closed` → vermutlich 200
- `?status=any_invalid_value` → sollte 422

**Wahrscheinliche Ursache:** Filter-Query macht `where(eq(finding.status, statusParam))` ohne Validierung. PostgreSQL rejected den Cast auf `finding_status_enum` und der Server crasht statt 422 zurückzugeben.

**Fix:**
```typescript
// In findings/route.ts GET handler
const validStatuses = ['identified', 'in_review', 'remediated', 'verified', 'accepted', 'closed'] as const;
const statusFilter = url.searchParams.get('status');
if (statusFilter && !validStatuses.includes(statusFilter as any)) {
  return Response.json({
    error: "Validation failed",
    detail: `Invalid status '${statusFilter}'. Valid: ${validStatuses.join(', ')}`,
    invalidParam: 'status'
  }, { status: 422 });
}
```

**Test:**
```ts
test.each([
  ['identified', 200],
  ['in_review', 200],
  ['closed', 200],
  ['open', 422],  // invalid → 422 not 500
  ['xyz', 422],
])("W24-B2: Finding filter status=%s returns %i", async (status, expected) => {
  const r = await GET(`/api/v1/findings?status=${status}`);
  expect(r.status).toBe(expected);
});
```

### B3 — W24-F2-MGMT-SUMMARY: `/erm/management-summary` 405

**Verhalten:** GET 405 Method Not Allowed.

**Fix:** Wenn der Endpoint POST-only ist (z.B. weil er Snapshot generiert), Doku-Hinweis im GET 405-Body geben. Oder GET als read-only-Variante implementieren.

**Vorgehen:**
1. Bestehende Route-File inspizieren (`apps/web/src/app/api/v1/erm/management-summary/route.ts`)
2. GET-Handler implementieren, der aggregierte Quartals-Daten liefert ohne Side-Effects:
```typescript
export const GET = withErrorHandler(async (req) => {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  // aggregate risks, controls, findings into summary
  return Response.json({ data: summary });
});
```

**Test:**
```ts
test("W24-B3: GET /erm/management-summary returns 200 for CISO", async () => {
  loginAs("ciso");
  const r = await GET("/api/v1/erm/management-summary");
  expect(r.status).toBe(200);
  expect(r.body.data).toHaveProperty('risksSummary');
});
```

### B4 — W24-F3-CTRLTEST-405: `POST /control-tests` 405

**Verhalten:** Compliance Officer kann kein Control-Test anlegen (405).

**Fix:** POST-Handler in der korrekten Route-File implementieren. Path-Check: ist es `/api/v1/control-tests` oder `/api/v1/controls/{id}/tests`?

**Test:**
```ts
test("W24-B4: POST /control-tests succeeds for compliance_officer", async () => {
  loginAs("compliance_officer");
  const r = await POST("/api/v1/control-tests", {
    controlId: <valid>,
    testType: "design",
    todResult: "effective",
    testDate: "2026-05-15"
  });
  expect(r.status).toBe(201);
});
```

---

## Block C — Hash-Chain v3 Continuity ADR + Verification

### C1 — W24-HASH-V3-MIGRATION: ADR + Live-Verification

Wave 23 hat Hash-Chain auf v3 migriert:
- v1: 1229 → 0
- v2: 513 → 0
- v3 (neu): 15425

**Compliance-Risiko:** Bei einer Tamper-Evidence-Audit-Chain (ISO 27001 A.12.4.2, GoBD §147, DSGVO Art. 5(2)) ist die **Continuity** der Verkettung entscheidend, nicht der Reset.

**Pflicht:**
1. **ADR-026** schreiben: `docs/adr/0026-hash-chain-v3-migration.md` mit:
   - Was wurde migriert (Schema-Änderungen, neues Hashing-Schema)
   - Warum (Performance? Crypto-Update? Compliance-Anforderung?)
   - **Wie die Continuity bewiesen wird** — gibt es ein Migration-Anchor-Record das v1-Last-Hash → v3-First-Hash explizit verkettet?
   - FreeTSA-Timestamp-Bestätigung der Migration

2. **Continuity-Verification-Endpoint** `/api/v1/audit-log/integrity/continuity`:
   ```typescript
   // Returns proof that v3 chain references v1+v2 history
   return Response.json({
     data: {
       v1: { lastHash, anchoredAt, freeTSAReceipt },
       v2: { firstHash, lastHash, continuityProof: 'v2.first.prev === v1.last.hash' },
       v3: { firstHash, lastHash, continuityProof: 'v3.first.prev === v2.last.hash' },
       totalContinuityValid: true
     }
   });
   ```

3. **Wenn keine Continuity möglich** (z.B. weil Migration v1+v2 wirklich gelöscht hat): explizit dokumentieren als Migration-Event mit FreeTSA-Anker + Org-Sign-Off der Plattform-Owners. Dann ist es ein **bewusster Re-Genesis** und nicht ein Compliance-Bruch.

**Test:**
```ts
test("W24-C1: Hash chain has documented continuity from v1 → v3", async () => {
  const r = await GET("/api/v1/audit-log/integrity/continuity");
  expect(r.status).toBe(200);
  expect(r.body.data.totalContinuityValid).toBe(true);
});
```

---

## Block D — Workflow-Endpoint-Lücken

### D1 — W24-PO-TREAT-STATUS: Process Owner kann Treatment-Status updaten

**Verhalten:**
```
POST /risks/{id}/treatments als process_owner → 201 ✅
PUT /risks/{id}/treatments/{tid} {status:'in_progress'} → 403 "Required role(s): admin, risk_manager"
```

**Fix:** RBAC-Asymmetrie auflösen. Wer ein Treatment anlegt, soll es auch progressen können:

```typescript
// In /risks/[id]/treatments/[tid]/route.ts PUT
const ctx = await withAuth("admin", "risk_manager", "process_owner", "control_owner");
```

**Test:**
```ts
test("W24-D1: process_owner can update treatment status they created", async () => {
  loginAs("process_owner");
  const risk = await POST("/risks", {...});
  const treatment = await POST(`/risks/${risk.id}/treatments`, {...});
  const update = await PUT(`/risks/${risk.id}/treatments/${treatment.id}`, {status:"in_progress"});
  expect(update.status).toBe(200);
});
```

### D2 — W24-VENDOR-ASSESS-404: `POST /vendors/{id}/assessments` 404

**Wahrscheinliche Ursache:** Endpoint-Pfad ist anders (`/api/v1/tprm/vendors/{id}/assessments`?) oder Route fehlt komplett.

**Fix:**
1. Route-File anlegen falls fehlt
2. RBAC: `admin, risk_manager, vendor_manager, contract_manager`
3. Body-Schema: `assessmentType`, `scoringScale`, optional `dueDate`

**Test:**
```ts
test("W24-D2: POST /vendors/{id}/assessments creates assessment", async () => {
  loginAs("vendor_manager");
  const v = await POST("/vendors", {...});
  const a = await POST(`/vendors/${v.id}/assessments`, {assessmentType:"initial", scoringScale:"standard"});
  expect(a.status).toBe(201);
});
```

### D3 — W24-VENDOR-RISKPROFILE-404: `/vendors/{id}/risk-profile` 404

**Fix:** GET-Endpoint mit Aggregation aus `vendor_assessment` + `vendor_risk_score` Tabellen.

**Test:**
```ts
test("W24-D3: GET /vendors/{id}/risk-profile returns profile", async () => {
  const r = await GET(`/vendors/${vendorId}/risk-profile`);
  expect(r.status).toBe(200);
  expect(r.body.data).toHaveProperty('inherentRiskScore');
  expect(r.body.data).toHaveProperty('residualRiskScore');
});
```

### D4 — W24-VENDOR-CONCENTRATION-403: `/tprm/concentration` für Vendor Mgr

**Verhalten:** Vendor Manager 403 — er soll aber seine eigene Concentration sehen können.

**Fix:** `withAuth(...)` erweitern um `'vendor_manager', 'contract_manager'`.

### D5 — W24-AUDIT-ACTIVITY-422: Audit-Activity Body-Schema

**Verhalten:**
```
POST /audit-mgmt/audits/{id}/activities {name:'X', description:'Y'} → 422
```

**Vorgehen:** Body-Schema validieren + im PR dokumentieren welche Felder Required sind. Schema-Discovery-Endpoint `/audit-mgmt/audits/{id}/activities/schema`.

**Test:**
```ts
test("W24-D5: Audit activity create with documented schema", async () => {
  const schema = await GET(`/audit-mgmt/audits/${aid}/activities/schema`);
  const a = await POST(`/audit-mgmt/audits/${aid}/activities`, schema.body.data.example);
  expect(a.status).toBe(201);
});
```

### D6 — W24-ESG-MEAS-BODY: ESG Measurement Body-Schema

**Vorgehen:** Body-Schema-Doku im Route-Code. Discovery-Endpoint `/esg/measurements/schema` mit Beispiel-Payload.

### D7 — W24-COMPLIANCE-COVERAGE: 0/0/0 trotz 1319 Frameworks

**Verhalten:**
```
GET /compliance/coverage?framework=iso-27001 → {coverage:0, frameworkCount:0, ...}
```

Aber `/compliance/frameworks` zeigt 1319 Einträge. **Cross-Mapping Org-Controls ↔ Framework-Controls** fehlt.

**Fix:**
1. Falls Mapping-Daten existieren: Computation-Bug in der Coverage-Aggregation
2. Falls Mapping-Daten fehlen: Migration die Demo-Mappings seedet (z.B. 10–20 Controls aus Meridian-Org auf ISO-27001-Annex-A-Controls mappen)

**Test:**
```ts
test("W24-D7: ISO 27001 coverage returns realistic value > 0", async () => {
  const r = await GET("/compliance/coverage?framework=iso-27001");
  expect(r.body.data.frameworkCount).toBeGreaterThan(0);
  expect(r.body.data.overallCoveragePct).toBeGreaterThan(0);
});
```

---

## Block E — Verbleibende Journey-Tests (Pflicht für Alpha-Sign-Off)

5 Journeys aus Alpha-Verification waren noch offen. Müssen nach Block A–D abgearbeitet sein:

| Journey | Test-User | Was zu prüfen |
|---|---|---|
| US-10 Risk Manager | `risk.manager@arctos.dev` | Cross-Process-Risk-Aggregation, KRI-History |
| US-11 Control Owner | `control.owner@arctos.dev` | ToE-Test-Workflow (hängt von B4 control-tests ab) |
| US-12 BCM Manager | seed-User existiert? | BIA-Quartals-Lifecycle |
| US-13 Security Analyst | seed-User existiert? | NIST-7-State + DSGVO-72h |
| US-15 External Auditor | seed-User existiert? | Read-Only-Audit-Universe |

**Vorgehen:** Cowork QA fährt die 5 Journeys nach Block-A-D-Merge. Wenn Test-User fehlen, im Seed nachziehen:

```sql
-- Migration 0337: Seed BCM/Security/External-Auditor login users
INSERT INTO "user" (id, email, name, password_hash, email_verified, is_active, language)
VALUES
  ('a0000002-0000-0000-0000-000000000010', 'bcm@meridian.test',           'Meridian BCM Manager',       '$bcrypt(WaveQA-2026!)', now(), true, 'de'),
  ('a0000002-0000-0000-0000-000000000011', 'security@meridian.test',      'Meridian Security Analyst',  '$bcrypt(WaveQA-2026!)', now(), true, 'de'),
  ('a0000002-0000-0000-0000-000000000012', 'ext-auditor@meridian.test',   'External Auditor',           '$bcrypt(WaveQA-2026!)', now(), true, 'de')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_organization_role (user_id, org_id, role, line_of_defense)
VALUES
  ('a0000002-0000-0000-0000-000000000010', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'bcm_manager',      'second'),
  ('a0000002-0000-0000-0000-000000000011', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'security_analyst', 'first'),
  ('a0000002-0000-0000-0000-000000000012', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'external_auditor', 'third')
ON CONFLICT DO NOTHING;
```

---

## Pilot-Readiness-Gate (Erweitert)

Das Wave-23-Gate-Script `scripts/pilot-readiness-gate.sh` muss um folgende Checks erweitert werden:

```bash
# A1 Finding FK-Persistence (5. Welle endgame check)
PERSISTED=$(curl ... | jq -r '.data.controlId')
[ "$PERSISTED" = "$CTRL_ID" ] || (echo "GATE FAIL: A1 controlId not persisted" && exit 1)

# B1 CISO can read integrity
INTEG=$(curl -H "auth: $CISO_TOKEN" ... /api/v1/audit-log/integrity | jq -r '.status // 200')
[ "$INTEG" = "200" ] || (echo "GATE FAIL: B1 CISO gets $INTEG on /audit-log/integrity" && exit 1)

# B2 Filter invalid → 422 not 500
STATUS=$(curl -o /dev/null -w "%{http_code}" .../findings?status=invalid_xyz)
[ "$STATUS" = "422" ] || (echo "GATE FAIL: B2 invalid status=$STATUS" && exit 1)

# B3 /erm/management-summary
STATUS=$(curl -o /dev/null -w "%{http_code}" .../erm/management-summary)
[ "$STATUS" = "200" ] || (echo "GATE FAIL: B3 mgmt-summary=$STATUS" && exit 1)

# B4 /control-tests POST
STATUS=$(curl -o /dev/null -w "%{http_code}" -X POST .../control-tests -d '{...}')
[ "$STATUS" = "201" ] || (echo "GATE FAIL: B4 control-tests=$STATUS" && exit 1)

# C1 Hash chain continuity
CONT=$(curl ... /api/v1/audit-log/integrity/continuity | jq -r '.data.totalContinuityValid')
[ "$CONT" = "true" ] || (echo "GATE FAIL: C1 hash chain continuity $CONT" && exit 1)

# D1 Process Owner treatment update
# D2-D7 ähnlich
```

---

## Vorgehen (zeitlich)

**Tag 1 — Block A Live-Debug:**
- A1-D1 Build-SHA-Check
- A1-D2 DB-Schema-Check
- A1-D3 Debug-Endpoint deploy + Cowork-QA-Run gegen Prod
- Logs lesen, root cause identifizieren
- Fix deploy + Re-Test

**Tag 2 — Block B + C:**
- B1 CISO Hash-Chain-Access wiederherstellen
- B2 Filter-422-statt-500
- B3 /erm/management-summary GET implementieren
- B4 /control-tests POST implementieren
- C1 Hash-Chain v3 Continuity ADR + Endpoint

**Tag 3 — Block D:**
- D1 RBAC-Asymmetrie Treatment-Status
- D2/D3/D4 Vendor-Sub-Endpoints
- D5/D6 Body-Schema-Discovery für Audit-Activity + ESG-Measurement
- D7 Compliance-Coverage-Mapping seeden

**Tag 4 — Block E:**
- Seed-Migration 0337 für BCM/Security/External-Auditor-User
- Cowork QA fährt 5 Journeys
- Befunde sammeln, ggf. Wave 25 planen

**Tag 5 — Pilot-Readiness-Gate-Run:**
- Erweitertes Gate-Script gegen Staging laufen lassen
- Bei grün → Pilot-Sign-Off

---

## Definition of Done

- [ ] A1-D1/D2/D3 Diagnose im PR dokumentiert
- [ ] Debug-Endpoint `/api/v1/_debug/finding-insert-trace` deployed UND wieder entfernt nach Fix
- [ ] A1 Live-Test gegen Prod grün (controlId, auditId, riskId alle persistiert)
- [ ] B1 CISO /audit-log/integrity 200
- [ ] B2 Filter-Validierung mit 422-statt-500
- [ ] B3 GET /erm/management-summary 200
- [ ] B4 POST /control-tests 201
- [ ] C1 ADR-0026 + Continuity-Endpoint 200
- [ ] D1 Process Owner Treatment-Status-Update 200
- [ ] D2/D3 Vendor-Assessment + Risk-Profile-Endpoints 201/200
- [ ] D4 Vendor Mgr `/tprm/concentration` 200
- [ ] D5 Audit-Activity-Schema-Discovery 200 + POST 201 mit example-body
- [ ] D6 ESG-Measurement-Schema 200 + POST 201
- [ ] D7 Compliance-Coverage liefert realistische % > 0
- [ ] E Seed-Migration 0337 deployed + 5 Journeys grün
- [ ] Pilot-Readiness-Gate (erweitert) grün
- [ ] Hash-Chain v3 healthy, mismatches=0 nach allen Mutationen

**Wenn auch nur ein Punkt rot ist, ist Wave 24 nicht fertig.**

---

## Test-Account-Cheat-Sheet (erweitert um Wave-24-Seed)

```
Org: Meridian Holdings GmbH = ccc4cc1c-4b09-499c-8420-ebd8da655cd7
Password: WaveQA-2026!

Existing (Wave 22+):
ciso@meridian.test, dpo@meridian.test, compliance@meridian.test,
auditor@meridian.test, process-owner@meridian.test, vendor-mgr@meridian.test,
esg@meridian.test, whistleblowing@meridian.test, viewer@meridian.test,
ciso@arctistx.test (Wave 22 cross-tenant)

NEU in Wave 24 (Migration 0337):
bcm@meridian.test            → bcm_manager
security@meridian.test       → security_analyst
ext-auditor@meridian.test    → external_auditor
```

---

## Anti-Patterns (Wave-23-Lehre — strikt befolgen)

1. **Partieller Deploy desselben Route-Handlers** — Wave 21+22+23 haben Status-Reject deployed aber FK-Persistenz nicht. **Pre-Merge-Smoke-Test muss BEIDE Aspekte abdecken.**

2. **RBAC verschärfen ohne User-Story-Test** — Wave 23 hat CISO Hash-Chain-403 verursacht weil CISO nicht in der Test-Matrix war. **Jede `withAuth(...)`-Änderung muss `domain-rbac-suite.test.ts` updaten.**

3. **Filter ohne Validierung** — Wave 23 hat einen 500-Crash erzeugt. **Alle Query-Param-Werte gegen Enums oder Whitelists validieren.**

4. **Schema-Migration ohne Continuity-Beweis** — Hash-Chain v3 ohne ADR ist Compliance-Risiko. **ADR + Sign-Off-Anchor Pflicht.**

5. **„Code im Repo sieht korrekt aus"** — fünfte Welle damit verloren. **Debug-Endpoint mit Live-Trace ist der einzige beweisende Pfad.**

---

## Erfolgs-Meldung Template

```
Wave 24 deployed.

Diagnose A1:
- Prod BUILD_ID: <X>
- Main HEAD-SHA: <Y>
- Match: yes/no
- finding-table control_id ref: yes/no
- Debug-Endpoint Drizzle-trace: controlId persisted = <UUID|null>
- Root cause: <was found>

Fixes:
- Block A: A1 controlId/auditId/riskId persisted in production ✅
- Block B: 4 Wave-23-Regressions reverted ✅
- Block C: ADR-0026 + continuity endpoint ✅
- Block D: 7 endpoint gaps closed ✅
- Block E: Seed migration 0337, 5 user-stories verified ✅

Pilot-Readiness-Gate (extended): ✅ PASSED (X/X checks)
Hash-Chain v3: healthy total=<N> mismatches=0
```

---

*Wave 24 Alpha-Quality-Closure-Prompt geschrieben von Cowork QA, 2026-05-15. 13 Items in 5 Blöcken. A1 Live-Debug-Endpoint ist die Schlüssel-Innovation für die 5-Wellen-Persistenz-Frage.*
