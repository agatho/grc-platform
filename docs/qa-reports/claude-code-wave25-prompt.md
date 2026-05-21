# Claude Code — Wave 25: A1-6.-Welle ENDGAME + Wave-24-Restpunkte

**Quelle:** `arctos-qa-verification-2026-05-15-wave24.md`
**Branch:** `feature/wave-25-a1-endgame-debug-mandatory`
**User-Direktive:** „Auch an eine Alpha habe ich Qualitätsansprüche. Alles was wir finden muss gefixed werden."

**Vorbedingung:**

- Hash-Chain v3 healthy `total≥16826 mismatches=0` muss bleiben
- Wave 24 abgesegnet: 13/18 grün, 4 Wave-23-Regressions geheilt, Continuity-ADR live
- A1 Finding-FK-Persistenz ist nach **SECHS Wellen** noch nicht gefixt

---

## Klartext

Wave 24 hatte den **Debug-Endpoint als Schlüsselkomponente** für A1 — und er wurde **nicht deployt** (404). Damit konnte die 6-Wellen-Frustration nicht durchschnitten werden.

**Wave 25 hat genau 1 zwingende Anweisung:** Der Debug-Endpoint wird **als ALLERERSTES** deployed. Bevor irgendein anderer Fix-Versuch gemacht wird. Die Logs aus diesem Endpoint sind dann der einzige beweisende Pfad zum Bug.

---

## Block A — A1 Endgame: DEBUG-ENDPOINT ZUERST, NICHT ZULETZT

### A1-Step-1 (PFLICHT, sonst kein Merge)

**Datei anlegen:** `apps/web/src/app/api/v1/_debug/finding-insert-trace/route.ts`

```typescript
import { db, finding } from "@grc/db";
import { withAuth } from "@/lib/api";
import { sql } from "drizzle-orm";
import { createFindingSchema } from "@grc/shared";

// Production-safe: only admin role.
// Three parallel insert attempts to isolate where controlId is dropped.
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const rawBody = (await req.json()) as Record<string, unknown>;
  const traces: Array<Record<string, unknown>> = [];

  // STAGE 1: Raw body captured before any parsing
  traces.push({ stage: "raw-body", value: rawBody });

  // STAGE 2: After Zod parse — does the schema preserve controlId?
  const parsed = createFindingSchema.safeParse(rawBody);
  traces.push({
    stage: "zod-parse",
    success: parsed.success,
    parsedValue: parsed.success ? parsed.data : undefined,
    parsedControlId: parsed.success ? parsed.data.controlId : undefined,
    parsedAuditId: parsed.success ? parsed.data.auditId : undefined,
    error: parsed.success ? undefined : parsed.error.flatten(),
  });

  // STAGE 3: Direct SQL INSERT bypassing all ORM layers
  try {
    const directResult = await db.execute(sql`
      INSERT INTO finding (org_id, work_item_id, title, severity, source, control_id, audit_id, risk_id, created_by, updated_by)
      VALUES (
        ${ctx.orgId},
        gen_random_uuid(),
        ${"debug-direct-" + Date.now()},
        ${"minor_nonconformity"}::finding_severity,
        ${"audit"}::finding_source,
        ${rawBody.controlId ?? null}::uuid,
        ${rawBody.auditId ?? null}::uuid,
        ${rawBody.riskId ?? null}::uuid,
        ${ctx.userId},
        ${ctx.userId}
      )
      RETURNING id, control_id, audit_id, risk_id;
    `);
    traces.push({
      stage: "direct-sql-insert",
      success: true,
      row: directResult.rows?.[0],
    });
  } catch (e: any) {
    traces.push({
      stage: "direct-sql-insert",
      success: false,
      error: e.message,
    });
  }

  // STAGE 4: Drizzle ORM INSERT with explicit values
  try {
    const drizzleResult = await db
      .insert(finding)
      .values({
        orgId: ctx.orgId,
        workItemId: crypto.randomUUID(),
        title: "debug-drizzle-" + Date.now(),
        severity: "minor_nonconformity",
        source: "audit",
        controlId: rawBody.controlId as string | undefined,
        auditId: rawBody.auditId as string | undefined,
        riskId: rawBody.riskId as string | undefined,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    traces.push({
      stage: "drizzle-insert",
      success: true,
      row: drizzleResult[0],
    });
  } catch (e: any) {
    traces.push({ stage: "drizzle-insert", success: false, error: e.message });
  }

  // STAGE 5: SELECT immediately after to detect post-insert triggers
  if (traces[3]?.row && (traces[3].row as any).id) {
    const reread = await db.execute(sql`
      SELECT id, control_id, audit_id, risk_id 
      FROM finding 
      WHERE id = ${(traces[3].row as any).id}::uuid;
    `);
    traces.push({ stage: "select-after-drizzle", row: reread.rows?.[0] });
  }

  return Response.json({
    traces,
    summary: {
      rawHasControlId: !!rawBody.controlId,
      zodPreservesControlId: parsed.success && !!parsed.data.controlId,
      sqlPersistsControlId: !!(traces[2] as any)?.row?.control_id,
      drizzlePersistsControlId: !!(traces[3] as any)?.row?.controlId,
      selectAfterInsertHasControlId: !!(traces[4] as any)?.row?.control_id,
    },
  });
}
```

### A1-Step-2: Cowork QA fährt Test gegen Debug-Endpoint

```bash
curl -X POST $PROD/api/v1/_debug/finding-insert-trace \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session>" \
  -d "{\"controlId\":\"<valid-uuid>\", \"auditId\":\"<valid-uuid>\", \"riskId\":\"<valid-uuid>\"}"
```

**Erwartete Output-Matrix (eine davon stimmt):**

| Summary                                                                                 | Bug-Location                   | Fix                                                |
| --------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------- |
| `rawHasControlId:true, zodPreservesControlId:false`                                     | Zod-Schema strippt             | Schema-Strict-Mode korrigieren                     |
| `zodPreservesControlId:true, sqlPersistsControlId:true, drizzlePersistsControlId:false` | Drizzle-ORM-Layer              | Drizzle-Schema-Definition vs INSERT-Spalten prüfen |
| `drizzlePersistsControlId:true, selectAfterInsertHasControlId:false`                    | Post-Insert Trigger setzt NULL | Trigger-Liste in Prod prüfen                       |
| `sqlPersistsControlId:false`                                                            | DB-Constraint / Default        | Spalte hat DEFAULT NULL ohne Override-Path         |

**Done für Step 2:** Output-Matrix im PR dokumentiert.

### A1-Step-3: Fix basierend auf Step-2-Ergebnis

Implementiere den Fix in der durch Step-2 identifizierten Schicht. **Kein blindes „Code-im-Repo-sieht-korrekt-aus"-Argument mehr.**

### A1-Step-4: Production-Endpoint funktioniert

```ts
test("W25-A1: POST /findings persists controlId (production)", async () => {
  const ctrl = await getOrCreateControl();
  const r = await POST("/api/v1/findings", {
    title: "W25 A1 final",
    severity: "major_nonconformity",
    source: "audit",
    controlId: ctrl.id,
  });
  expect(r.status).toBe(201);
  const g = await GET(`/api/v1/findings/${r.body.data.id}`);
  expect(g.body.data.controlId).toBe(ctrl.id);
});
```

### A1-Step-5: Debug-Endpoint entfernen

Nach grünem A1-Step-4: **Migration 0338** entfernt die Debug-Route-Datei. **NICHT VERGESSEN!**

---

## Block B — Wave-24-Neue-Regressions

### B1 — W24-NEW-FILTER-CONTROLID-500

**Verhalten:**

```
GET /api/v1/findings?controlId=<uuid> → 500 (Server-Crash)
```

War in Wave 24 wahrscheinlich nicht da, oder wurde durch Wave-24-Code-Änderungen eingeführt.

**Fix:** UUID-Validierung im Filter-Handler. Bei invalidem UUID: 422 statt 500. Bei validem UUID: `where(eq(finding.controlId, value))` query.

**Test:**

```ts
test("W25-B1: GET /findings?controlId=<uuid> returns 200", async () => {
  const ctrl = await getOrCreateControl();
  const r = await GET(`/api/v1/findings?controlId=${ctrl.id}`);
  expect(r.status).toBe(200);
});

test("W25-B1: GET /findings?controlId=invalid returns 422", async () => {
  const r = await GET("/api/v1/findings?controlId=not-a-uuid");
  expect(r.status).toBe(422);
});
```

### B2 — W24-NEW-BCM-BIA-403

**Verhalten:**

```
POST /api/v1/bcms/bia als bcm@meridian.test → 403 "Required role(s): admin, risk_manager"
```

`bcm_manager` ist die einzige Rolle deren Primärworkflow BIA-Anlage ist. RBAC-Lücke.

**Fix:**

```typescript
// In /bcms/bia/route.ts POST
const ctx = await withAuth("admin", "risk_manager", "bcm_manager");
```

Plus: `domain-rbac-suite.test.ts` SPECS für `POST /bcms/bia` updaten.

**Test:**

```ts
test("W25-B2: bcm_manager can create BIA", async () => {
  loginAs("bcm_manager");
  const r = await POST("/bcms/bia", {
    name: "Test BIA",
    scope: "test",
    leadAssessorId: userId,
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
  });
  expect(r.status).toBe(201);
});
```

---

## Block C — Wave-24-Restpunkte (3 Items)

### C1 — W24-D7 Compliance-Coverage Demo-Mappings seeden

**Verhalten:**

```
GET /compliance/coverage?framework=iso_27001_2022 → 200
{ frameworkCount: 1, overallCoveragePct: 0 }  ← 0% obwohl Org Controls hat
```

Framework wird gezählt, aber 0 Controls sind auf ISO-27001-Annex-A-Items gemappt.

**Fix:**

**Migration 0339:** Demo-Mappings seeden. Beispiel:

```sql
-- Seed 10-20 Demo-Mappings für Meridian Holdings GmbH
-- Map Meridian-Org-Controls auf ISO 27001:2022 Annex A Controls
INSERT INTO framework_control_mapping (org_id, org_control_id, framework_control_id, mapped_at, mapped_by)
SELECT
  'ccc4cc1c-...'::uuid as org_id,
  c.id as org_control_id,
  fc.id as framework_control_id,
  now() as mapped_at,
  'seed' as mapped_by
FROM control c
CROSS JOIN framework_control fc
WHERE c.org_id = 'ccc4cc1c-...'
  AND fc.framework_id IN (SELECT id FROM framework WHERE code = 'iso_27001_2022')
  AND (
    -- Map by control title similarity oder explicit list
    c.title ILIKE '%access control%' AND fc.code = 'A.5.15' OR
    c.title ILIKE '%password%' AND fc.code = 'A.5.17' OR
    c.title ILIKE '%backup%' AND fc.code = 'A.8.13'
    -- 10+ more explicit mappings
  )
ON CONFLICT DO NOTHING;
```

Alternativ: Wenn der Mapping-Endpoint POST funktioniert, schreibe ein Seed-Skript das die Mappings via API anlegt.

**Test:**

```ts
test("W25-C1: ISO 27001 coverage > 0 after seed", async () => {
  const r = await GET("/compliance/coverage?framework=iso_27001_2022");
  expect(r.body.data.overallCoveragePct).toBeGreaterThan(0);
  expect(r.body.data.frameworkCount).toBeGreaterThan(0);
});
```

### C2 — W24-D2 Vendor-Assessment Schema-Discovery

**Verhalten:**

```
POST /api/v1/vendors/{id}/assessments {assessmentType:'initial', scoringScale:'standard'} → 422
```

Endpoint existiert (war 404), aber kein Schema-Discovery-Endpoint.

**Fix:** Analog zu Audit-Activity-Schema-Discovery aus Wave 24 (`GET /audit-mgmt/audits/{id}/activities/schema` mit `example` body):

```typescript
// GET /api/v1/vendors/{id}/assessments/schema
return Response.json({
  data: {
    fields: {
      /* JSON-Schema-style required/optional fields */
    },
    example: {
      assessmentType: "initial",
      scoringScale: "standard",
      scheduledDate: "2026-06-01",
      assessorId: "<userId>",
      questionnaire: "iso_27001_supplier",
    },
  },
});
```

Plus POST-Handler an dem `example`-Body grünt.

**Test:**

```ts
test("W25-C2: Vendor-Assessment Schema-Discovery + POST", async () => {
  const schema = await GET(`/vendors/${vId}/assessments/schema`);
  expect(schema.body.data.example).toBeDefined();
  const post = await POST(
    `/vendors/${vId}/assessments`,
    schema.body.data.example,
  );
  expect(post.status).toBe(201);
});
```

### C3 — W24-D6 ESG-Measurement Path-Inkonsistenz

**Verhalten:**

```
GET /api/v1/esg/measurements/schema → 200 mit example body (metricId, value, unit, ...)
POST /api/v1/esg/measurements (mit example body) → 404
```

Path-Inkonsistenz: Schema-Endpoint existiert, POST-Endpoint ist offenbar an einer anderen URL.

**Fix:**

1. Schema-Endpoint zeigt korrekte POST-URL im Response: `data.endpoint: "/api/v1/esg/metrics/{metricId}/measurements"` o.ä.
2. Oder: POST-Endpoint an `/api/v1/esg/measurements` ergänzen (analog zu measurement-Bulk).

**Test:**

```ts
test("W25-C3: ESG Measurement Schema endpoint + POST work", async () => {
  const schema = await GET("/esg/measurements/schema");
  expect(schema.body.data.endpoint).toBeDefined();
  expect(schema.body.data.example.metricId).toBeDefined();
  // Get first metric
  const metrics = await GET("/esg/metrics?limit=1");
  const metricId = metrics.body.data.items[0].id;
  const url = schema.body.data.endpoint.replace("{metricId}", metricId);
  const post = await POST(url, { ...schema.body.data.example, metricId });
  expect(post.status).toBe(201);
});
```

---

## Block D — Verbleibende Journey-Tests

Mit den Block-B-Fixes können wir die noch offenen Journeys nachholen:

### D1 — US-11 Control Owner Operating-Effectiveness-Test

Mit Wave-24-B4-Fix (POST /control-tests jetzt 422 statt 405) kann der Control-Owner-Workflow gefahren werden, sobald Body-Schema bekannt ist.

**Schema-Discovery:** Migration sollte `GET /api/v1/control-tests/schema` analog ergänzen.

### D2 — US-12 BCM Manager BIA-Lifecycle

Mit Wave-25-B2-Fix möglich.

### D3 — US-15 External Auditor Audit-Pack-Export

Test gegen `ext-auditor@meridian.test`:

- Read-Access auf Audits + Findings + Risks
- Audit-Pack-PDF-Export für gewählten Audit-Scope

---

## Pilot-Readiness-Gate erweitert

Zusätzlich zu Wave-23+24-Checks:

```bash
# A1 Production endpoint persists controlId
PERSISTED=$(curl ... | jq -r '.data.controlId')
[ "$PERSISTED" = "$CTRL" ] || (echo "GATE FAIL: A1" && exit 1)

# B1 Filter ?controlId returns 200
STATUS=$(curl -o /dev/null -w "%{http_code}" .../findings?controlId=$CTRL)
[ "$STATUS" = "200" ] || (echo "GATE FAIL: B1" && exit 1)

# B2 BCM Manager BIA Create
STATUS=$(curl -o /dev/null -w "%{http_code}" -X POST -H "auth: $BCM_TOKEN" .../bcms/bia -d '...')
[ "$STATUS" = "201" ] || (echo "GATE FAIL: B2 BCM=$STATUS" && exit 1)

# C1 Compliance coverage > 0
COV=$(curl ... /compliance/coverage?framework=iso_27001_2022 | jq -r '.data.overallCoveragePct')
[ "$COV" -gt "0" ] || (echo "GATE FAIL: C1 coverage=$COV" && exit 1)

# Debug-Endpoint entfernt nach A1-Fix
STATUS=$(curl -o /dev/null -w "%{http_code}" -X POST .../api/v1/_debug/finding-insert-trace)
[ "$STATUS" = "404" ] || (echo "GATE FAIL: Debug endpoint not removed after fix" && exit 1)
```

---

## Definition of Done

- [ ] **A1-Step-1**: Debug-Endpoint `/api/v1/_debug/finding-insert-trace` deployed UND grün gegen Production-Test
- [ ] **A1-Step-2**: Output-Matrix im PR dokumentiert (welche Stage hat den Bug)
- [ ] **A1-Step-3**: Fix in der identifizierten Schicht implementiert
- [ ] **A1-Step-4**: Production POST `/findings {controlId}` persistiert controlId
- [ ] **A1-Step-5**: Debug-Endpoint entfernt via Migration 0338
- [ ] **B1**: `GET /findings?controlId=X` 200 (war 500)
- [ ] **B2**: BCM Manager kann BIA anlegen (war 403)
- [ ] **C1**: Compliance Coverage iso_27001_2022 > 0% (Demo-Mappings geseedet)
- [ ] **C2**: Vendor-Assessment-Schema-Discovery 200, POST 201
- [ ] **C3**: ESG-Measurement POST 201 mit Schema-Path
- [ ] **D1-D3**: 3 Journey-Tests durchgespielt
- [ ] Pilot-Readiness-Gate grün (5 neue Checks)
- [ ] Hash-Chain v3 healthy nach allen Mutationen
- [ ] **Wave-24-Regression-Schutz:** Alle 13 grünen Wave-24-Items bleiben grün

**Wenn auch nur ein Punkt rot ist, ist Wave 25 nicht fertig.**

---

## Vorgehen (zeitlich)

**Tag 1 (heute) — A1 Live-Debug:**

- 10:00 Debug-Endpoint deployen (Block A Step 1)
- 12:00 Cowork QA fährt Trace-Test gegen Prod
- 14:00 Output-Matrix interpretieren → Bug-Location ist klar
- 16:00 Fix implementieren

**Tag 2 — A1 verifizieren + Block B:**

- 09:00 Production POST `/findings` Re-Test
- 10:00 Debug-Endpoint entfernen (Migration 0338)
- 11:00 B1 Filter-ControlId
- 14:00 B2 BCM RBAC

**Tag 3 — Block C:**

- C1 Demo-Mapping Migration
- C2 Vendor Schema-Discovery
- C3 ESG Path-Fix

**Tag 4 — Block D Journeys + Gate:**

- US-11, US-12, US-15 testen
- Pilot-Readiness-Gate grün

---

## Anti-Patterns (Wave-24-Lehre — strikt befolgen!)

1. **Debug-Endpoint NICHT skippen.** Wave 24 hat das gemacht und A1 ist 6. Welle. Wave 25 macht Debug-Endpoint zum **Done-Kriterium #1**.

2. **Output-Matrix dokumentieren BEVOR Fix versucht wird.** Sonst „Code-im-Repo-sieht-korrekt-aus"-Fallback und 7. Welle.

3. **Nicht „nur teilweise deployen"** desselben Route-Handlers. Wenn Status-Reject + FK-Persistenz im selben File sind, deployen beide oder keiner.

4. **RBAC-Erweiterungen testen mit ALLEN betroffenen Rollen.** Wave 24 hat `bcm_manager` bei BIA-Create vergessen — typisch wenn nur Admin-Test gefahren wird.

5. **Filter-Validierung systematisch.** Jeder neue Query-Parameter braucht entweder Zod-Schema oder UUID-/Enum-Check vor der DB-Query.

---

## Erfolgs-Meldung Template

```
Wave 25 deployed.

A1 Diagnose-Ergebnis (Live-Debug):
- rawHasControlId: true
- zodPreservesControlId: <yes|no>
- sqlPersistsControlId: <yes|no>
- drizzlePersistsControlId: <yes|no>
- selectAfterInsertHasControlId: <yes|no>
→ Bug-Location: <Zod | Drizzle | Trigger | Constraint>

Fixes:
- A1: <root cause + fix>
- B1: filter validation
- B2: bcm_manager added to BIA RBAC
- C1: <N> demo mappings seeded for ISO 27001
- C2: vendor-assessment schema-discovery endpoint
- C3: ESG measurement path normalized

Debug endpoint removed via migration 0338. ✅

Pilot-Readiness-Gate (extended): ✅ PASSED
Hash-Chain v3: healthy total=<N> mismatches=0
```

---

_Wave 25 Prompt geschrieben von Cowork QA, 2026-05-15. 6 Items in 4 Blöcken. Debug-Endpoint als zwingender Tag-1-Output für A1. 7. Welle wäre Plattform-Verantwortungs-Frage._
