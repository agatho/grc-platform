# Claude Code — Wave 19 Sprint-Prompt

**Quelle:** `docs/qa-reports/arctos-qa-verification-2026-05-15-wave18.md`
**Branch:** `feature/wave-19-cascade-completion`
**Vorbedingung:** Hash-Chain `healthy v1=1229 v2=449 total=1678 mismatches=0`. Nicht regredieren.

---

## Auftrag

Cowork QA hat 8 von 9 Wave-18-Fixes verifiziert. **2 Items sind noch offen + 3 Polish-P3.** Bitte beide Show-Stopper für die volle Cross-Module-Cascade (P1) plus den 500-Endpoint (P2) fixen, sowie die 3 P3-Polish-Items mitnehmen.

---

## P1 (Beta-Blocker für vollständige Cascade)

### W19-P1-01: `POST /findings {controlId}` persistiert die Verknüpfung nicht

**Symptom:**

```
POST /api/v1/findings
{ title:'…', severity:'major_nonconformity', source:'audit', status:'open', controlId: '<uuid>' }
→ 201 {id: NEW_ID}

GET /api/v1/findings/NEW_ID
→ { controlId: null, status:'identified', … }
```

Das `controlId` aus dem POST-Body wird im INSERT nicht mitgegeben, daher kommt in der DB `null` an. Das ist die direkte Ursache, warum die in Wave 18 sauber implementierte Cascade in `/api/v1/controls/effectiveness/route.ts` (Lines 62-107) keine über die API erstellten Findings sieht — der WHERE-Filter `finding.controlId is not null` schließt sie aus. Die seed-erzeugten Critical-Findings funktionieren, weil sie SQL-direct mit `controlId` gesetzt wurden.

**Spiegelung von Wave-15-P1-01** (gleicher Bug mit `auditId`). Damals wurde nur der Filter (`findings?auditId=X`) gefixt, nicht das POST-Schema.

**Erwartung:**

1. `POST /findings` akzeptiert UND persistiert `controlId` (und während wir dabei sind auch `auditId`, `riskId`, `processId`, alle existierenden Cross-Module-Joinable-Foreign-Keys).
2. `GET /findings/{id}` Response enthält `controlId` (bei not-null) im JSON.
3. `PATCH /findings/{id}` (oder PUT) erlaubt nachträgliches Setzen — derzeit PATCH 405, PUT 422.

**Suche an:**

- `apps/web/src/app/api/v1/findings/route.ts` (POST)
- `apps/web/src/app/api/v1/findings/[id]/route.ts` (GET, PATCH/PUT)
- `packages/shared/src/schemas/finding.ts` (Zod-Schema)
- `packages/db/src/schema/finding.ts` (Drizzle-Schema — sollte die FK-Spalten bereits haben)

**Akzeptanz:**

```ts
// neue Vitest-Test in apps/web/src/__tests__/api/findings-cross-module-links.test.ts
test("POST /findings persists controlId + GET returns it", async () => {
  const r = await POST({ ... controlId: c1.id });
  expect(r.status).toBe(201);
  const j = await r.json();
  const g = await GET(j.data.id);
  expect(g.data.controlId).toBe(c1.id);
});

test("Cascade picks up API-created critical finding", async () => {
  const before = await GET('/controls/effectiveness');
  await POST('/findings', { severity:'major_nonconformity', status:'open', controlId: c1.id });
  const after = await GET('/controls/effectiveness');
  expect(after.controlsWithOpenCriticalFindings).toBe(before.controlsWithOpenCriticalFindings + 1);
});
```

**Bonus:** Während des Fixes auch das Status-Mapping klären. Wave 18 hat gezeigt: `POST /findings {status:'open'}` speichert als `status:'identified'`. Entweder im Zod-Schema strict-rejecten mit Enum-Liste, oder im Mapping dokumentieren. Lieber strict-reject — verhindert client-side-Annahmen die der Server still überschreibt.

---

## P2 (Polish, nicht Beta-Blocker)

### W19-P2-01: `GET /admin/branding` 500

**Symptom:**

```
GET /api/v1/admin/branding → 500 "Internal server error"
```

War schon in Wave 17 + Marathon + Wave 18 markiert. Vermutlich missing Table, falsche Drizzle-Schema-Reference, oder Org-Scope-Filter-Crash.

**Vorgehen:** Server-Log mit RequestID inspizieren (`pino` / `logger`), dann Route reparieren. Wenn die Feature noch nicht existiert, lieber 501 Not Implemented zurückgeben als 500.

**Suche an:** `apps/web/src/app/api/v1/admin/branding/route.ts`

---

## P3 (Polish)

### W19-P3-01: Contract-Schema-Drift — `name → title`

**Beobachtung:** Über die Wellen hat sich das Contract-Schema mehrfach umbenannt:

- Wave 14: `value`, `startDate`, `endDate`
- Wave 16: → `totalValue`, `effectiveDate`, `expirationDate`
- Wave 18: → `title` (war `name`)

Frontend-Clients und API-Konsumenten brechen bei jedem Schema-Swap.

**Erwartung:**

1. CHANGELOG.md-Eintrag pro Field-Rename
2. Im OpenAPI-Spec den deprecation-Marker für alte Field-Namen für 1-2 Releases halten (oder strict reject mit "use `title` not `name`" hint)
3. Test in `domain-rbac-suite.test.ts` ergänzen der gegen das aktuelle Schema asserted

**Suche an:** `packages/shared/src/schemas/contract.ts`, `CHANGELOG.md`

### W19-P3-02: CISO kann keine Findings raisen

```
POST /findings als ciso@meridian.test → 403
"Required role(s): admin, auditor, risk_manager, control_owner, process_owner"
```

CISO ist 2nd-Line-of-Defense und sollte Compliance-Verletzungen als Findings dokumentieren können. RBAC-Konsistenz-Lücke.

**Erwartung:** `withAuth(...)` in `findings/route.ts` POST-Handler um `'ciso'` ergänzen. Test in `domain-rbac-suite.test.ts` SPECS für `POST /findings` anpassen (analog Wave-19-MAR-P0-02 Pattern für vendor_manager).

### W19-P3-03: ESG Body-Schema-Doku

**Beobachtung:**

```
POST /esg/metrics       → 422 {fieldErrors: {datapointId: ['Required']}}
POST /esg/measurements  → 422 {fieldErrors: {datapointId: ['Required']}}
```

Frontend-Form fehlt das Feld (Wave 18 hat nur RBAC verifiziert, nicht UI-Flow). Außerdem ist das Discovery für `datapointId`-Auswahl nicht offensichtlich (`/esg/datapoints` liefert leere data-Liste).

**Erwartung:**

1. `GET /esg/datapoints` mit Seed-Datapoints aus dem ESRS-Catalog populieren (`packages/db/sql/seed_esrs_datapoints.sql` existiert bereits — wird sie im prod-seed geladen?)
2. Discovery-Endpoint `GET /esg/metrics/schema` oder ähnlich der das erwartete Body-Shape liefert
3. Frontend-Form für `/esg/metrics` neu-Form um Datapoint-Picker erweitern

**Lower priority** als #1 + #2. Kann in Wave 20 mit, wenn ESG-Sprint geplant ist.

---

## Vorgehen (empfohlen)

1. Branch `feature/wave-19-cascade-completion` von `main`
2. **W19-P1-01** zuerst (Finding-Cross-Module-Links + Status-Mapping) — das ist der Marathon-Blocker
3. **W19-P2-01** (`/admin/branding`)
4. **W19-P3-01** (Contract Schema-Drift docs) + **W19-P3-02** (CISO findings RBAC) — beide trivial
5. **W19-P3-03** ESG Body-Schema kann in eigenen Sprint
6. Tests aktualisieren in `apps/web/src/__tests__/api/domain-rbac-suite.test.ts` für die neuen RBAC-Listen
7. CHANGELOG.md schreiben
8. Hash-Chain-Healthy-Check als Pre-Merge-Gate (`/api/v1/audit-log/integrity` muss healthy bleiben)

---

## Test-Account-Cheat-Sheet (für lokale + Cowork-QA-Verifikation)

```
Org: Meridian Holdings GmbH = ccc4cc1c-4b09-499c-8420-ebd8da655cd7
Default Password (alle 9 Meridian-RBAC-User): WaveQA-2026!

Email                                     Role
─────────────────────────────────────────────────────────
ciso@meridian.test                        ciso
dpo@meridian.test                         dpo
compliance@meridian.test                  compliance_officer
auditor@meridian.test                     auditor
process-owner@meridian.test               process_owner
vendor-mgr@meridian.test                  vendor_manager  (Wave 18 enum-added)
esg@meridian.test                         esg_manager
whistleblowing@meridian.test              whistleblowing_officer
viewer@meridian.test                      viewer

Plus:
admin@arctos.dev / admin123               admin (cross-org)
```

---

## Erfolgs-Kriterien für Wave 19

| Item               | Kriterium                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------- |
| W19-P1-01          | `POST /findings {controlId}` persistiert. Cascade-Endpoint zeigt +1 nach Create. Test grün. |
| W19-P2-01          | `GET /admin/branding` 200 oder 501 (Not Implemented), kein 500                              |
| W19-P3-01          | CHANGELOG-Eintrag pro Field-Rename, OpenAPI updated                                         |
| W19-P3-02          | `POST /findings` als CISO → 201, RBAC-Test angepasst                                        |
| Hash-Chain         | `healthy=true, mismatches=0, v1=1229`                                                       |
| Wave-18-Regression | Alle 8 Marathon-Fixes von Wave 18 bleiben grün                                              |

Cowork QA verifiziert anschließend in Wave 19, dann ist die Plattform für den ersten Pilot-Kunden technisch tauglich.

---

_Wave 19 Sprint-Prompt geschrieben von Cowork QA, 2026-05-15._
