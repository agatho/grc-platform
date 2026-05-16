# Claude Code — Wave 23: ENDGAME für A1, A2, C3-Regression

**Quelle:** `arctos-qa-verification-2026-05-15-wave22.md`
**Branch:** `feature/wave-23-endgame`
**Vorbedingung:** Hash-Chain healthy v1=1229 v2=513 total=1742 mismatches=0. Bleibt healthy.

---

## Klartext

A1 (Finding-FK-Persistenz) und A2 (`/admin/branding` 500) sind **vier Wellen** nicht gefixt. Wave 22 hat im selben Route-Handler den Status-Strict-Reject deployed, aber die FK-Persistenz nicht. Das ist kein normaler Fix-Workflow mehr — das ist ein Pipeline-, Build- oder DB-Schema-Problem.

**Wave 23 hat genau 4 Items + 1 Pflicht-Diagnose. Nichts anderes. Keine Erweiterungen.** Wenn diese 4 Items nicht grün werden, ist Wave 23 nicht fertig. Punkt.

---

## DIAGNOSE-PFLICHT (BEVOR Fix-Versuche)

Bevor irgendein Code geändert wird, müssen die folgenden 4 Diagnose-Schritte gemacht und ihre Ergebnisse im PR dokumentiert werden. **Ohne diese Diagnose kein Code-Change.**

### D1 — Production-Commit-SHA

```bash
# Auf dem Production-Host
curl https://arctos.charliehund.de/api/v1/_meta/build  # falls existiert
# ODER:
ssh prod 'cd /app && git rev-parse HEAD'
```

Vergleiche die SHA mit dem letzten Wave-22-Commit auf `main`. **Wenn sie unterschiedlich sind, ist das Problem nicht Code, sondern Deploy.**

→ Im PR dokumentieren: "Prod SHA: `<sha>`, Main SHA: `<sha>`, Match: yes/no"

### D2 — Production-DB-Schema-Check

```sql
-- Connect to production DB
\d finding;
```

Erwarte als Spalten: `id, org_id, work_item_id, control_id (uuid, references control), audit_id (uuid), risk_id (uuid), control_test_id (uuid), task_id (uuid), title, ...`

**Wenn `control_id` fehlt oder ohne `references control` → Migration nicht gelaufen.**

→ Im PR dokumentieren: Output von `\d finding` der Prod-DB.

### D3 — Drizzle-Insert-Trace (für A1)

Temporären Console-Log direkt vor dem INSERT in `findings/route.ts` Zeile 122:

```ts
console.log("[W23-DEBUG] Finding INSERT values:", {
  controlId: body.data.controlId,
  auditId: body.data.auditId,
  riskId: body.data.riskId,
  raw_body: rawBody
});
const [row] = await tx.insert(finding).values({ ... }).returning();
console.log("[W23-DEBUG] Finding INSERT result:", { controlId: row.controlId, auditId: row.auditId });
```

Deploy auf Prod, Cowork QA macht einen Test-POST, **die Logs zeigen:**

- Was kam in `body.data.controlId` an? (sollte gültige UUID sein)
- Was kam aus dem INSERT zurück? (sollte gleiche UUID sein, kein null)

→ Im PR dokumentieren: Server-Log-Excerpts der zwei Console-Logs. Diese identifizieren, ob der Bug **vor** dem Insert (Zod strippt), **im** Insert (Drizzle ignoriert), oder **nach** dem Insert (Trigger setzt NULL) liegt.

### D4 — A2 RequestID-Server-Log

Wave 22 lieferte: `requestId: "24a45b827c4f2e4d"`

```bash
# Auf Prod-Host
grep "24a45b827c4f2e4d" /var/log/arctos/*.log
```

→ Im PR dokumentieren: vollständiger Stack-Trace dieses Requests. Daraus ist der Crash-Grund offensichtlich.

---

## Fix-Items

### W23-A1 — Finding FK-Persistenz (P0, Pilot-Blocker)

**Bekannter Stand (verifiziert 2026-05-15 4× hintereinander):**

```
POST /findings {title:'…', severity:'major_nonconformity', source:'audit', controlId:VALID, auditId:VALID, riskId:VALID}
→ 201
GET /findings/{id}
→ { controlId: null, auditId: null, riskId: null, status: 'identified' }
```

Source-Code im Repo:

- `apps/web/src/app/api/v1/findings/route.ts` Zeilen 122-141: INSERT enthält `controlId/auditId/riskId` ✓
- `packages/shared/src/schemas/control.ts:253-265`: Zod-Schema akzeptiert die Felder ✓
- `packages/db/src/schema/control.ts:328-333`: Drizzle-Tabelle hat die Spalten ✓

**Wie das Bug-Suchen läuft (basierend auf D-Diagnose):**

| D3-Log zeigt                                             | Bug ist                                             | Fix                                                  |
| -------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| `body.data.controlId: undefined`                         | Zod strippt das Feld                                | Schema-Strict-Mode korrigieren oder `.passthrough()` |
| `body.data.controlId: <uuid>` aber `row.controlId: null` | Drizzle-Insert ignoriert es                         | Drizzle-Schema-Inferenz prüfen, evtl. `db.refresh()` |
| Insert-Result `controlId: <uuid>` aber GET zeigt null    | Trigger oder GET-Projection-Bug                     | Trigger-List in Prod prüfen, GET-Select-Statement    |
| Beide undefined nach Zod                                 | Bug irgendwo zwischen `req.json()` und Schema-Parse | Body-JSON inspect, Middleware prüfen                 |

**Akzeptanz-Test (Cowork-QA-Reproduzierbar):**

```ts
// apps/web/src/__tests__/api/findings-cross-module-links.test.ts (NEW)
test("W23-A1: POST /findings persists controlId, auditId, riskId from body", async () => {
  const ctrl = await getOrCreateControl();
  const audit = await getOrCreateAudit();
  const risk = await getOrCreateRisk();

  const r = await POST("/api/v1/findings", {
    title: "W23 A1 Test",
    severity: "major_nonconformity",
    source: "audit",
    controlId: ctrl.id,
    auditId: audit.id,
    riskId: risk.id,
  });
  expect(r.status).toBe(201);

  const g = await GET(`/api/v1/findings/${r.body.data.id}`);
  expect(g.body.data.controlId).toBe(ctrl.id); // <-- MUSS grün werden
  expect(g.body.data.auditId).toBe(audit.id); // <-- MUSS grün werden
  expect(g.body.data.riskId).toBe(risk.id); // <-- MUSS grün werden
});

test("W23-A1: Cascade aggregation reflects new critical finding", async () => {
  const before = (await GET("/api/v1/controls/effectiveness")).body.data
    .openCriticalFindings;
  const ctrl = await getOrCreateControl();
  await POST("/api/v1/findings", {
    title: "Cascade Test",
    severity: "major_nonconformity",
    source: "audit",
    controlId: ctrl.id,
  });
  const after = (await GET("/api/v1/controls/effectiveness")).body.data
    .openCriticalFindings;
  expect(after).toBe(before + 1); // <-- MUSS grün werden
});
```

**Done:** Beide Tests grün. Cowork-QA-Live-Test reproduziert den ersten Test grün gegen Prod.

---

### W23-A2 — `/admin/branding` 500 (P0, niedriges Risiko aber 4 Wellen offen)

**Bekannter Stand:** `GET /admin/branding → 500 (RequestID 24a45b827c4f2e4d)`

**Vorgehen:**

1. **D4-Stack-Trace** ist die Diagnose-Quelle
2. Wahrscheinliche Ursache: `select ... from organization_branding where org_id = ...` liefert 0 Zeilen, Code macht `branding.logoUrl` auf undefined → Crash
3. Fix-Optionen:
   - **a)** Default-Row pro Org seeden via Migration
   - **b)** Route-Handler returnt 200 mit default-Object wenn keine DB-Row existiert
   - **c)** Wenn Feature noch nicht ready: **501 Not Implemented mit RFC-7807-Body** (akzeptabel)

**Akzeptanz-Test:**

```ts
test("W23-A2: /admin/branding returns 200 with config OR 501 Not Implemented", async () => {
  const r = await GET("/api/v1/admin/branding");
  expect([200, 501]).toContain(r.status); // <-- MUSS grün werden, niemals 500
});
```

**Done:** Endpoint liefert 200 oder 501, niemals 500.

---

### W23-C3 — Contract `name` 500-Regression (P1, neu in Wave 22)

**Bekannter Stand:** Wave 22 brach den Backwards-Compat:

- Wave 21: `POST /contracts {name:'…'}` → 422 "Validation failed"
- Wave 22: `POST /contracts {name:'…'}` → **500 empty body**

**Vorgehen:**

Wave 22 hat vermutlich versucht, einen `name → title` Alias zu implementieren, aber der Code wirft eine ungefangene Exception. Drei Optionen:

**Option A — Sauberer Backwards-Compat:**

```ts
// Im Contract POST-Handler vor schema.parse:
const raw = await req.json();
if (raw.name && !raw.title) {
  raw.title = raw.name;
  delete raw.name;
  // Response-Header anhängen
  responseHeaders.set(
    "Warning",
    "299 - \"Use 'title' instead of 'name', deprecated since v0.2.x\"",
  );
}
```

**Option B — Striktes Reject mit Hinweis (akzeptabel):**

```ts
if ("name" in raw && !("title" in raw)) {
  return Response.json(
    {
      error: "Validation failed",
      detail: "Field 'name' is deprecated. Use 'title' instead.",
      deprecatedField: "name",
      suggestedField: "title",
    },
    { status: 422 },
  );
}
```

**Empfohlen: Option B** — weniger Aufwand, klare Migration-Aufforderung. Backwards-Compat-Aliase sind technische Schulden.

**Akzeptanz-Test:**

```ts
test("W23-C3: Contract with 'name' field returns 422 with hint (not 500)", async () => {
  const r = await POST('/api/v1/contracts', { name:'Test', contractType:'service_agreement', ... });
  expect(r.status).toBe(422);  // <-- niemals 500
  expect(r.body.detail).toMatch(/title|deprecated/i);
});
test("W23-C3: Contract with 'title' works", async () => {
  const r = await POST('/api/v1/contracts', { title:'Test', ... });
  expect(r.status).toBe(201);
});
```

**Done:** Beide Tests grün, kein 500 mehr.

---

### W23-B6 — Programmes-Endpoint-Klarstellung (P2, Polish)

**Bekannter Stand:** `/programmes` ist ein Module-Info-Endpoint, kein Resource-List. Wave-21-Prompt-Erwartung war falsch.

**Vorgehen:**

1. **Doku:** Im OpenAPI-Spec klar dokumentieren, dass `/programmes` ein Modul-Discovery-Endpoint ist
2. **Programme-Resource:** Falls geplant — Resource-Pfad einführen (`/programmes/journeys`), mit ≥ 2 Demo-Journeys seeden
3. **Maturity-Endpoint:** Wenn `/programmes/journeys/{id}/maturity-breakdown` existieren soll, dann Demo-Seed-Daten plus Computation-Test

**Done:** `/programmes/journeys` mit Demo-Daten, oder klare Doku dass Programme ein nicht-flaches Modul ist.

---

## Pilot-Readiness-Gate (CI-Pre-Merge-Check)

In CI ein Smoke-Test-Script `scripts/pilot-readiness-gate.sh` der gegen Staging läuft:

```bash
#!/bin/bash
set -e

# Login as admin
TOKEN=$(curl -s -X POST -d 'email=admin@arctos.dev&password=admin123' staging/api/auth/credentials)

# A1: Finding FK persistence
CTRL=$(curl -H "auth: $TOKEN" staging/api/v1/controls?limit=1 | jq -r '.data.items[0].id')
FIND=$(curl -X POST -H "auth: $TOKEN" -d "{\"title\":\"gate\",\"severity\":\"major_nonconformity\",\"source\":\"audit\",\"controlId\":\"$CTRL\"}" staging/api/v1/findings)
FIND_ID=$(echo $FIND | jq -r '.data.id')
PERSISTED=$(curl -H "auth: $TOKEN" staging/api/v1/findings/$FIND_ID | jq -r '.data.controlId')
[ "$PERSISTED" = "$CTRL" ] || (echo "GATE FAIL: A1 controlId not persisted ($PERSISTED vs $CTRL)" && exit 1)

# A2: branding not 500
STATUS=$(curl -o /dev/null -w "%{http_code}" -H "auth: $TOKEN" staging/api/v1/admin/branding)
[[ "$STATUS" =~ ^(200|501)$ ]] || (echo "GATE FAIL: A2 branding=$STATUS" && exit 1)

# C3: contract name regression
STATUS=$(curl -o /dev/null -w "%{http_code}" -X POST -H "auth: $TOKEN" -d '{"name":"x","contractType":"service_agreement",...}' staging/api/v1/contracts)
[ "$STATUS" = "422" ] || (echo "GATE FAIL: C3 name=$STATUS, expected 422" && exit 1)

# Hash chain integrity
HEALTH=$(curl -H "auth: $TOKEN" staging/api/v1/audit-log/integrity | jq -r '.data.healthy')
[ "$HEALTH" = "true" ] || (echo "GATE FAIL: Hash chain not healthy" && exit 1)

echo "✅ Pilot-Readiness-Gate PASSED"
```

**Pre-Merge in `main`:** Dieses Skript muss `exit 0` zurückgeben.

---

## Vorgehen (zeitlich)

**Tag 1: Diagnose (NICHT überspringen!)**

- D1 Prod-Commit-SHA dokumentieren
- D2 Prod-DB-Schema von `finding` dokumentieren
- D3 Drizzle-Insert-Trace deployen + Cowork-QA-Test triggern → Logs lesen
- D4 A2 RequestID-Stack-Trace lesen

**Tag 2: Fix basierend auf Diagnose-Erkenntnissen**

- W23-A1: Fix dort wo D3 den Bug isolierte
- W23-A2: Fix basierend auf D4-Stack-Trace
- W23-C3: Option B implementieren

**Tag 3: Test + Gate**

- Pilot-Readiness-Gate-Script schreiben
- Vitest-Tests für W23-A1/A2/C3 hinzufügen
- CI grün, merge

**Tag 4: Cowork-QA-Verifikation, dann Pilot-Sign-Off**

---

## Anti-Patterns (zur ABSOLUTEN VERMEIDUNG)

1. **"Code im Repo sieht korrekt aus" als Begründung für Done** — wir haben 4 Wellen damit verloren. Wenn der Live-Server null zurückgibt, dann IST es im Live-Server nicht korrekt. Punkt.

2. **Status-Strict-Reject deployen ohne FK-Persistenz** — Wave 21 hat exakt das gemacht. Wave 23 darf den selben Route-Handler nur als Ganzes deployen.

3. **Diagnose-Schritte überspringen** — D1-D4 sind keine Optionen. Ohne Diagnose-Doku im PR keine Merge-Freigabe.

4. **"Pilot-readiness-gate würde grün sein"** als Vermutung — das Gate-Script LÄUFT, gibt exit 0 oder 1 zurück. Subjektive Einschätzungen reichen nicht.

5. **Mehr Items adden** — Wave 23 hat 4 Items + 1 Diagnose-Pflicht. Wenn weitere Verbesserungen zwischendurch auffallen, kommen sie in Wave 24. Wave 23 wird klein gehalten, damit es endlich abschließt.

---

## Definition of Done (alle Punkte müssen erfüllt sein)

- [ ] D1-D4 Diagnose im PR dokumentiert
- [ ] W23-A1 Test grün gegen Production: POST /findings persistiert controlId
- [ ] W23-A1 Test grün gegen Production: Cascade-Aggregation +1 nach Create
- [ ] W23-A2 Test grün: /admin/branding liefert 200 oder 501
- [ ] W23-C3 Test grün: /contracts {name:…} liefert 422 (nicht 500)
- [ ] Pilot-Readiness-Gate-Script in CI, grün
- [ ] Hash-Chain healthy nach Deploy: v1=1229, mismatches=0
- [ ] Cowork-QA-Smoke-Test gegen Production grün

**Wenn auch nur ein Punkt rot ist, ist Wave 23 nicht fertig.**

---

## Erfolgs-Meldung

```
Wave 23 deployed.

Diagnose:
- D1 Prod SHA matches main HEAD: yes
- D2 Prod finding-table has control_id ref: yes
- D3 Insert trace: body.data.controlId received as <UUID>, Drizzle insert returned controlId=<UUID>
- D4 Branding crash root cause: <e.g. "missing default branding row in org_branding table">

Fixes:
- W23-A1: <root cause + fix>
- W23-A2: <root cause + fix>
- W23-C3: backwards-compat = strict-reject with hint

Pilot-Readiness-Gate: ✅ PASSED
Hash-Chain: healthy v1=1229 v2=<new>
```

Cowork QA verifiziert dann Wave 23, danach Pilot-Sign-Off.

---

_Wave 23 Endgame-Prompt geschrieben von Cowork QA, 2026-05-15. 4 Items + 4-stufige Diagnose-Pflicht. Erstmals mit CI-Gate-Script. Nach Wave 23 ist die Plattform pilot-ready oder es ist klar warum nicht._
