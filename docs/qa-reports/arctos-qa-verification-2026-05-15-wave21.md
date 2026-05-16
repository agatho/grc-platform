# ARCTOS QA Wave-21 Verifikation — 2026-05-15

**Tester:** Cowork QA
**Fokus:** Block A Beta-Blocker + Block B Black-Box-Items + Block C Polish nach Wave-21-Deploy
**Methodik:** Live-API-Tests, Hash-Chain regression, Multi-Role-Login

---

## TL;DR

**6 von 15 Items vollständig grün. 4 partial. 5 noch offen.** Die zwei Beta-Blocker aus Block A sind **zum dritten Mal** nicht gefixt — Finding-`controlId`-Persistenz und `/admin/branding` 500 bleiben Open. Aber: viele Black-Box-Items aus Block B sind jetzt erreichbar.

| Block | Items | ✅ | 🟡 | 🔴 |
|---|---|---:|---:|---:|
| A Beta-Blocker | 2 | 0 | 0 | **2** |
| B Black-Box | 10 | 6 | 2 | 2 |
| C Polish | 3 | 0 | 1 | 2 |
| **Total** | **15** | **6** | **3** | **6** |

Hash-Chain: **healthy v1=1229, v2=477, total=1706, 0 mismatches.**

---

## Block A — Beta-Blocker (🔴 BEIDE WEITER OFFEN)

### A1 — Finding `controlId/auditId/riskId` Persistenz 🔴 DRITTES MAL NICHT GEFIXT

**Test:**
```
POST /findings {
  title:'W21-A1 Persistence Test',
  severity:'major_nonconformity',
  source:'audit',
  controlId: <valid uuid>,
  auditId: <valid uuid>,
  riskId: <valid uuid>,
  description:'verify all cross-module FKs persist'
}
→ 201 mit id 831ce300-1c84-43e6-94ce-bfeee2c45a85

GET /findings/{id}
→ { controlId: null, auditId: null, riskId: null, status:'identified', ... }
```

**Identisch zu Marathon-Befund + Wave 18 + Wave 19+20.** Die Felder werden trotz validem Schema, validem Route-Handler-Code (line 122-141 in `findings/route.ts`) und korrekter Drizzle-Schema-Definition (line 328-333 in `db/schema/control.ts`) als NULL gespeichert.

**Partial-Fix bestätigt:** Wave-21 Status-Strict-Reject IST deployed:
```
POST /findings {status:'open', ...}
→ 422 "Finding status is set automatically on create (defaults to 'identified'). Use POST /api/v1/findings/{id}/status for transitions."
```

Aber die parallele Behebung der FK-Persistenz im selben Route-Handler **wurde nicht deployed oder ist defekt.** PATCH 200 setzt `controlId` auch nicht.

**Konsequenz:** Cascade-Endpoint `/controls/effectiveness` zeigt 4 → 4 nach Create. Cross-Module-Aggregation für API-erstelle Findings bleibt unwirksam.

### A2 — `/admin/branding` 500 🔴 DRITTES MAL NICHT GEFIXT

```
GET /api/v1/admin/branding → 500 "Internal server error"
```

Unverändert seit Wave 17.

---

## Block B — Black-Box-Items (6 ✅, 2 🟡, 2 🔴)

### B1 — AI-Router Public-Health-Endpoint ✅

```
GET /api/v1/ai/router/health → 200 ✅
```

Endpoint ist da. **Body durch Browser-Proxy maskiert** — Health-Provider-Liste konnte nicht weiter inspiziert werden, aber der Endpoint reagiert.

### B2 — ESG-Datapoints Seed 🔴 NICHT GELADEN

```
GET /api/v1/esg/datapoints?limit=10 → 200
{ total: 0, datapoints: [], byStandard: {} }
```

Schema-Discovery + Endpoint existieren, aber **die 1.144 ESRS-Datapoints sind weiter nicht im Seed.** ESG-Manager kann `POST /esg/metrics` nicht testen — `datapointId` Required.

→ `packages/db/sql/seed_esrs_datapoints.sql` wurde nicht in den prod-seed-flow integriert.

### B3 — Compliance-Frameworks Public-API ✅ (mit Caveat)

```
GET /api/v1/compliance/frameworks → 200
{ total: 953, items: [
  { id: ..., name: 'BSI C5:2020 Cloud Compliance Criteria' },
  { id: ..., name: 'BSI Elementargefährdungen' },
  { id: ..., name: 'BSI IT-Grundschutz Compendium' },
  ...
]}
```

**953 Framework-Einträge!** Endpoint funktioniert. CLAUDE.md sprach von 46 Frameworks — vermutlich sind das 46 Top-Level-Frameworks mit ~ 953 Sub-Controls/Mappings.

**Aber:** `/compliance/coverage?framework=iso-27001` zeigt weiter alle Werte 0:
```
{ frameworkCount: 0, fullyCovered: 0, atRisk: 0, critical: 0, overallCoveragePct: 0, frameworks: [] }
```

→ Coverage-Computation ist nicht gegen die 953 Framework-Records verknüpft. **Cross-Framework-Mapping zur Org-eigenen Control-Implementation fehlt.**

### B4 — Bulk-Operations ✅ Cap + Endpoint, 🟡 Insert SQL-Error

**Cap funktioniert:**
```
POST /risks/bulk { items: [101 items] } → 422 { maxBulkSize: 100 } ✅
```

**Endpoints reagieren mit 207 Multi-Status:**
```
POST /risks/bulk { items: [3 valid items] } → 207
{ created: [], errors: [3x SQL error] }
```

**Aber: ALL 3 ITEMS FAILED mit DB-Error:**
```
"Failed query: insert into 'work_item' ... params: ..., single_risk, W21 Bulk Risk 1, ..."
```

`type_key: "single_risk"` triggers a constraint violation. Bulk-Endpoint exists, Cap works, but the actual INSERT fails — vermutlich fehlt der enum-Wert `single_risk` in `work_item_type_key` enum, oder es gibt eine andere Constraint.

→ **Neue Wave-21-Finding W21-B4-BulkInsertFails (P1)**

### B5 — DMS Path ✅ BEIDE FUNKTIONIEREN

```
GET /api/v1/dms/documents → 200 ✅
GET /api/v1/documents     → 200 ✅
```

Beide Pfade reagieren. Doku-Inkonsistenz weiter da, aber beide Pfade funktional.

### B6 — Programmes Demo-Seed + Maturity 🔴 KEINE DATEN

```
GET /api/v1/programmes?limit=5 → 200, aber items: 0
```

Endpoint da, **keine Demo-Programme im Seed.** Maturity-Breakdown nicht testbar ohne Programme-id.

### B7 — Multi-Tenant RLS Cross-Tenant 🟡 ZWEITE-ORG-USER NICHT GESEEDET

```
Login als ciso@arctistx.test → 401 (User existiert nicht)
```

Wave-21-Prompt empfahl `ciso@arctistx.test` + Eigendaten in Arctis Textilservice org zu seeden. Wurde nicht gemacht. Cross-Tenant-Probe weiter nicht durchführbar mit Real-User.

### B8 — Notifications Live-Trigger 🟡 ENDPOINT 200

```
GET /api/v1/notifications → 200
```

Endpoint reagiert. **Body Proxy-maskiert**, Trigger-Verification nicht durchgeführt (würde dedizierten Cron-Trigger-Test brauchen).

### B9 — PDF-Export Format-Parameter ✅ GEFIXT!

```
GET /api/v1/export/risk?format=pdf → 200
Content-Type: application/pdf
Size: 4883 bytes ✅

GET /api/v1/export/risk?format=csv → 200
Content-Type: text/csv ✅
```

**Wave-19-Bug W19-W10-PDF-Format-Ignored ist gefixt.** Der `format`-Parameter wird respektiert, `?format=pdf` liefert echtes PDF.

### B10 — Academy ✅ Endpoint reagiert

```
GET /api/v1/academy/courses → 200
```

Body maskiert, aber Endpoint funktional.

---

## Block C — Polish (0 ✅, 1 🟡, 2 🔴)

### C1 — UI-Forms Playwright ⏸ NICHT GEPRÜFT

Würde dedizierten Playwright-Run benötigen.

### C2 — Performance Baseline ⏸ NICHT GEPRÜFT

K6/autocannon Load-Test wäre nötig.

### C3 — Contract Backwards-Compat-Layer 🔴 NICHT IMPLEMENTIERT

```
POST /contracts {name: 'Test', ...}
→ 422 "Validation failed"
warning header: null
```

`name` wird weiter rejectet. Kein Deprecation-Warning-Header. Schema-Drift `name → title` bleibt **breaking change** für API-Clients.

---

## Hash-Chain Final

```
healthy: true
v1: 1229 (unverändert seit Wave 7 — 14 Wellen Genesis-stabil)
v2: 477 (+9 durch Wave-21-Test-Mutationen)
total: 1706
chainMismatches: 0
rowMismatches: 0
```

---

## Wave-Vergleich (Marathon → Wave 21)

| Item | M | W18 | W19 | **W21** |
|---|:-:|:-:|:-:|:-:|
| A1 Finding controlId | 🔴 | 🔴 | 🔴 | **🔴** |
| A2 /admin/branding | 🔴 | 🔴 | 🔴 | **🔴** |
| B1 AI Router Health | — | — | 🔴 | **✅** |
| B2 ESG Datapoints | — | 🟡 | 🟡 | **🔴** (unverändert) |
| B3 Compliance Frameworks API | — | — | 🔴 | **✅** (953!) |
| B4 Bulk-Operations | — | — | 🔴 | **🟡** (Cap ✅, Insert 🔴) |
| B5 DMS Path | — | — | 🟡 | **✅** (beide funktionieren) |
| B6 Programmes Maturity | 🟡 | — | 🟡 | **🔴** (keine Daten) |
| B7 Multi-Tenant RLS | — | — | 🟡 | **🟡** (User-Seed fehlt) |
| B8 Notifications | — | — | 🟡 | **🟡** |
| B9 PDF Format | — | — | 🔴 | **✅** |
| B10 Academy | — | — | 🟡 | **✅** |
| C3 Contract Compat | — | — | — | **🔴** |
| Wave-21 Status Strict-Reject | — | — | — | **✅** |

**Fortschritt:** 4 neue grüne Items in Wave 21. Aber die beiden wichtigsten — A1 + A2 — sind weiter offen.

---

## 🆕 Neue Wave-21-Findings

### W21-B4-BulkInsertFails (P1)

`/risks/bulk` Endpoint funktioniert (Cap + Multi-Status-Response), aber die einzelnen Inserts scheitern mit SQL-Error im `work_item`-Table:
```
type_key: "single_risk"
```

Vermutlich fehlt der enum-Wert `single_risk` in `work_item_type_key` PostgreSQL-Enum, oder andere Constraint. Erwartung: 207 mit ≥ 1 erfolgreichem Create.

### W21-A1-DeployGap (P0)

Wave 21 Status-Strict-Reject ist deployed, aber im SELBEN Route-Handler die FK-Persistenz nicht. Hinweis auf Build-/Deploy-Pipeline-Issue: Code im Repository sieht korrekt aus, Behavior im Live-Server widerspricht.

**Empfehlung:** Build-Hash/Commit-SHA des Deployments verifizieren — passt der zur HEAD-Commit der `feature/wave-21-pilot-ready` Branch?

---

## Verdict

**Block B liefert: 6/10 ✅, 2/10 🟡, 2/10 🔴.** Multiple Black-Box-APIs sind jetzt erreichbar (AI-Router, Compliance-Frameworks mit 953 Records, PDF-Format, Bulk-Cap, DMS, Academy). Das ist deutlicher Fortschritt.

**Aber:** Die zwei Pilot-Critical-Items aus Block A sind zum dritten Mal nicht gefixt. Das ist die **Hauptfrage:** warum kommt Wave 21 nicht durch?

**Drei mögliche Ursachen:**
1. **Deploy-Pipeline-Issue:** Code im Repo sieht korrekt aus, aber Build-Artefakt enthält alte Version
2. **Schema-/Migration-Drift:** finding-table hat zwar `control_id` Spalte (verifiziert in `db/schema/control.ts:328`), aber die Production-DB hat sie evtl. nicht (Migration nicht gelaufen)
3. **Hidden bug:** Ein anderes Stück Code zwischen Zod-Parse und Drizzle-Insert lässt die FK-Felder fallen

**Pilot-Readiness:** **NICHT erreicht.** Block A muss vor Pilot grün sein.

**Empfehlung für Wave 22 (HotFix):**
1. **DEPLOY-VERIFICATION:** Auf der Produktion verifizieren: `git rev-parse HEAD` matched die letzte Commit-SHA von Wave 21. Build-Logs prüfen.
2. **PROD-DB-SCHEMA-CHECK:** `\d finding` in PostgreSQL — gibt es wirklich `control_id` Spalte? Letzte Migration angewendet?
3. **HOTFIX:** Wenn Deploy-Issue → Re-Deploy mit cleanem Build. Wenn Schema-Issue → Migration laufen lassen. Wenn Code-Bug → Drizzle-Insert-Statement debuggen mit explizitem Console-Log.
4. **B4-BulkInsert SQL-Error** beheben (`single_risk` enum value)
5. **B2 ESG-Datapoints-Seed** in prod-seed-sequence aufnehmen
6. **B6 Programmes-Demo-Seed**
7. **B7 Arctistx-Test-User-Seed** für Cross-Tenant
8. **C3 Contract Backwards-Compat** mit Deprecation-Header
9. **A2 /admin/branding** parallel debuggen

Hash-Chain hat alle 14+ Wellen + Marathon + 4 Verifikations-Marathons überlebt. **Die fundamentale Architektur trägt.** Aber 2 spezifische Code-Pfade müssen endlich tatsächlich deployed werden.

---

*Wave 21 Verifikation abgeschlossen 2026-05-15. 6/15 ✅, 3/15 🟡, 6/15 🔴. Hash-Chain healthy. Block A weiter Pilot-Showstopper.*
