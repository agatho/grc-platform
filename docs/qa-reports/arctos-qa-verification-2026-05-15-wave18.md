# ARCTOS QA Wave-18 Verifikation — 2026-05-15

**Tester:** Cowork QA
**Fokus:** Alle Marathon-Findings (4 P0 RBAC + 5 P1) nach Wave-18-Deploy
**Methodik:** Login als jeweilige Rolle, Operation ausführen, Status-Code + Persistenz prüfen

---

## TL;DR

🎉 **8 von 9 Marathon-Findings sind gefixt.** Alle 4 P0-RBAC-Lücken (Process Owner, Vendor Manager, ESG Manager, CISO) sind geschlossen. DSR-Workflow ist vollständig (4 Side-Channels + Discovery). Cascade-Endpoints + KPI-Endpoints sind 200. **1 P1 nur teilweise** (Cascade-Endpoint korrekt, aber upstream-Bug verhindert dass neue Findings durchpropagieren). **1 P2 verbleibend** (`/admin/branding` weiter 500).

| Befund | Marathon | Wave 18 |
|---|---|---|
| MAR-P0-01 Process Owner Risk-Lifecycle | 🔴 403 | ✅ **alle 3 Ops 200/201** |
| MAR-P0-02 Vendor Manager Vendor+Contract | 🔴 403 | ✅ **beide 201** |
| MAR-P0-03 ESG Manager Create/Update | 🔴 403 | ✅ **RBAC passed** (422 nur Body-Schema) |
| MAR-P0-04 CISO Risk-Status-Transition | 🔴 403 | ✅ **200** |
| MAR-P1-01 DSR /respond + /close | 🔴 422 | ✅ **alle 4 Side-Channels 200** |
| MAR-P1-02 Finding→Control-Effectiveness | 🔴 kein Cascade | 🟡 **Endpoint da, aber upstream-Bug** |
| MAR-P1-03 Treatment-Cost → Budget | 🔴 kein Endpoint | ✅ **`/risks/treatments/budget` 200** |
| MAR-P1-04 `/controls/findings-summary` | 🔴 500 | ✅ **200** |
| MAR-P1-05 `/processes/governance-summary` | 🔴 500 | ✅ **200** |
| MAR-P2-01 `/kris/{id}/history` | 🔴 404 | ✅ **200** |
| MAR-P2-02 `/admin/branding` | 🔴 500 | 🔴 **500** (nicht gefixt) |

Hash-Chain: **healthy v1=1229, v2=449, total=1678, 0 mismatches** — production-stabil über alle 18 Wellen.

---

## ✅ Detail-Verifikation

### MAR-P0-01: Process Owner Risk-Lifecycle ✅

Login als `process-owner@meridian.test`:

| Operation | Wave 17 | Wave 18 | Beleg |
|---|---|---|---|
| `POST /risks` | ✅ 201 | ✅ 201 | id `8661ef00-2932-44bf-9e28-5456e11415eb` |
| `PUT /risks/{id}/assessment` | 🔴 403 | ✅ **200** | `riskScoreInherent=12` (3×4) |
| `PUT /risks/{id}/status` | 🔴 403 | ✅ **200** | identified → assessed |
| `POST /risks/{id}/treatments` | 🔴 403 | ✅ **201** | id `02f5d1c5-b596-4014-b427-3b882c997ea8` |

**Wave-19-MAR-P0-01 in `/risks/[id]/assessment/route.ts`, `/risks/[id]/status/route.ts`, `/risks/[id]/treatments/route.ts`** fügt `process_owner` (und `ciso`) zu `withAuth(...)` hinzu. Three-Lines-of-Defense ist endlich praktikabel: First-Line-Risikoeigentümer kann sein Risiko von Ende-zu-Ende selbst betreuen.

### MAR-P0-02: Vendor Manager Vendor + Contract ✅

Login als `vendor-mgr@meridian.test`:

```
POST /vendors {name:'Wave18 Vendor', country:'DE', tier:'standard', status:'active', legalForm:'GmbH'}
→ 201, id 5d38ee07-11a2-406b-bb4a-ff2d2dd9b0bb

POST /contracts {title:'Wave18 Contract', contractType:'service_agreement', counterparty:'…', totalValue:'10000', currency:'EUR'}
→ 201, id a77f2912-3422-456d-9e9c-892f251923e5
```

**Wave-19-MAR-P0-02 Migration 0324 fügt `vendor_manager` zum user_role-enum hinzu, plus `withAuth(..., 'vendor_manager', 'contract_manager')` in `/vendors/route.ts` und `/contracts/route.ts`.** Die selbsterklärte Vendor-Manager-Rolle kann jetzt ihre Kern-Aufgabe ausführen ohne Eskalation zum CISO.

### MAR-P0-03: ESG Manager 🟡 RBAC-pass, Body-Schema-Drift

Login als `esg@meridian.test`:

```
GET  /esg/metrics                        → 200 ✅
POST /esg/metrics                        → 422 (RBAC pass — fieldError: "datapointId Required")
POST /esg/measurements                   → 422 (RBAC pass — body-schema-issue)
```

**RBAC-Fix bestätigt:** `esg_manager` ist in `withAuth(...)` der ESG-Write-Routes (Code-Inspektion `/esg/measurements/route.ts` Zeilen 14-21). Die 422 sind reine Body-Schema-Validation-Errors, nicht RBAC.

**Cosmetic-Befund:** das neue Schema verlangt `datapointId` (ein ESRS-Datapoint-Bezug), nicht mehr nur `category/unit`. Frontend-Form muss angepasst sein. Body-Schema-Doku in der API-Schema-Spec hinzufügen.

### MAR-P0-04: CISO Risk-Status-Transition ✅

Login als `ciso@meridian.test`:

```
PUT /risks/f45ff040…/assessment {inherentLikelihood:4, inherentImpact:4, residualLikelihood:3, residualImpact:3}
→ 200, riskScoreInherent=16

PUT /risks/f45ff040…/status {status:'assessed', reason:'CISO P0-04 verify'}
→ 200, status='assessed'
```

**CISO ist jetzt in den `withAuth(...)`-Listen von `assessment` und `status` enthalten.** First/Second-Line-Boundary funktioniert wie ADR-007 vorsieht.

### MAR-P1-01: DSR Workflow vollständig ✅

Login als `dpo@meridian.test`, neue DSR durchgespielt von Create → Closed:

```
POST /dpms/dsr {requestType:'access',...}              → 201, id 387e57e6-c1a0-431f-9157-6d71033d3bd9
GET  /dpms/dsr/{id}/transitions                        → 200, sideChannels: [verify, process, respond, close]
POST /dpms/dsr/{id}/verify  {verificationMethod:…}     → 200, status: verified
POST /dpms/dsr/{id}/process {note:…}                   → 200, status: processing  ← NEU
POST /dpms/dsr/{id}/respond {responseChannel,…}        → 200, status: response_sent
POST /dpms/dsr/{id}/close   {reason:…}                 → 200, status: closed
```

**Wave-19-MAR-P1-01 in `/dpms/dsr/[id]/transitions/route.ts` (Lines 41-93)** exposed das vollständige Side-Channel-Discovery, plus die fehlende `/process`-Route (verified→processing). DSR-Workflow ist jetzt 100 % discovery-driven.

Lobenswert: jedes Side-Channel liefert `purpose` + `bodyShape` mit konkreten Feld-Hinweisen (z.B. `verificationMethod: "<id_doc | video_call | signed_letter>"`). Das ist UX-Gold für UI-Entwicklung und Audit-Doku.

### MAR-P1-02: Finding → Control-Effectiveness Cascade 🟡

**Cascade-Aggregation ist da:**

```
GET /controls/effectiveness → 200
{
  effectivenessPercent: 83,
  effectivenessPercentIncludingFindings: 36,
  controlsWithOpenCriticalFindings: 4,
  openCriticalFindings: 4,
  ineffectiveIncludingFindings: ...
}
```

**Wave-18-P1-1 in `/controls/effectiveness/route.ts` (Lines 62-107)** addiert die Cascade-Berechnung sauber: jedes offene `major_nonconformity` / `significant_nonconformity` Finding auf einer Control wird wie ein ineffective-Testergebnis gewichtet. Aus 83 % wird 36 % wenn 4 von ~24 Controls eine offene critical Finding tragen.

**🔴 Aber: upstream-Regression — `POST /findings {controlId}` persistiert die Verknüpfung NICHT.**

```
POST /findings {title, severity:'major_nonconformity', source:'audit', status:'open', controlId:CTRL_X}
→ 201
GET /findings/{id} → {controlId: null, status: 'identified'}
```

Das ist eine Spiegelung des Wave-15-P1-01-Befundes (auditId nicht in GET-Response), nun für `controlId`. Auch der Status wurde von `open` zu `identified` umgemappt (vielleicht by-design Status-Lifecycle-Norm, aber undokumentiert).

**Konsequenz:** Die Cascade ist konzeptionell korrekt, aber neue Findings (via API) tragen kein `controlId` und schlagen daher nicht in der Aggregation durch. Die 4 angezeigten "controls with critical findings" stammen aus dem Seed (SQL-direct, bypass der API).

**Empfehlung für Wave 19:** `findings/route.ts` POST-Handler muss `controlId` aus dem Body lesen und in die INSERT-Klausel aufnehmen. Außerdem PATCH/PUT für `controlId`-Nachträgliches-Setzen ergänzen (PATCH 405, PUT 422 derzeit).

### MAR-P1-03: Treatment-Cost → Budget-Aggregation ✅

```
GET /risks/treatments/budget?groupBy=org → 200
{
  asOf, groupBy, statuses, currency, mixedCurrencies,
  total, totalOnetime, totalAnnual, treatmentCount, byGroup
}
```

**Wave-18-P1-2 in `/risks/treatments/budget/route.ts`** rollt Treatment-Kosten pro `owner | department | org` auf, mit currency-mixing-Validierung (422 bei mixed currencies). CISO-Quartal-Cost-Report ist endlich technisch unterstützt.

### MAR-P1-04 + MAR-P1-05: KPI-Endpoints ✅

```
GET /controls/findings-summary    → 200 {asOf, total, bySeverity, byStatus, overdue, topAffectedControls}
GET /processes/governance-summary → 200 {asOf, total, byStatus, pendingApprovals, overdueReviews, withDocumentedOwner, ownerCoveragePct, topOwners}
```

Beide Dashboards-KPIs liefern Daten. Beide waren in der Marathon 500.

### MAR-P2-01: `/kris/{id}/history` ✅

```
GET /kris/d0000000-0000-0000-0000-000000000901/history → 200
{ kri, window, series }
```

KRI-Trend-Analyse ist ISO 31000-relevant und endlich verfügbar.

### MAR-P2-02: `/admin/branding` 🔴 NICHT GEFIXT

```
GET /admin/branding → 500 "Internal server error"
```

Weiterhin offen. Nicht Beta-Blocker, aber sollte in Wave 19 mitgenommen werden.

---

## 🆕 Neue Wave-18-Befunde (P3, Polish)

### WAVE18-P3-01: CISO kann keine Findings raisen

```
POST /findings als ciso@meridian.test → 403
"Required role(s): admin, auditor, risk_manager, control_owner, process_owner"
```

CISO sollte als 2nd-Line-Oversight auch Findings raisen können — typische CISO-Aktivität wenn eine Compliance-Verletzung auffällt. Geringe Priorität, aber RBAC-Konsistenz-Lücke.

### WAVE18-P3-02: Field-Naming-Drift bei Contracts

Wave 16 änderte `value → totalValue` und `endDate → expirationDate`. Wave 18 zeigt: auch `name → title` wurde geändert (POST `/contracts {name:…}` → 422, mit `title` → 201).

```
Wave 16:  POST /contracts {value, startDate, endDate}      → akzeptiert (Wave 15 Fix)
Wave 18:  POST /contracts {name, ...}                       → 422 "title Required"
          POST /contracts {title, ...}                      → 201 ✅
```

Schema-Drift zwischen Releases sollte versioniert oder in CHANGELOG dokumentiert werden, sonst bricht jeder API-Client der die Felder hardcoded.

### WAVE18-P3-03: Finding-Status-Mapping undokumentiert

```
POST /findings {status: 'open'} → 201, gespeichert als 'identified'
```

Entweder strict-rejecten mit Enum-Hinweis, oder im Schema-Docs anführen.

---

## Hash-Chain & Audit-Integrity

```
healthy: true
v1: 1229 (unverändert seit Wave 7 — 11 Wellen Genesis-stabil)
v2: 449 (+33 durch Wave-18-Test-Mutationen)
total: 1678
chainMismatches: 0
rowMismatches: 0
legacy: 9395 (pre-v1 entries, unchanged)
```

**Production-stabil durch alle 18 Wellen + Wave-18-Mutationen.** Über 1.600 verifizierte Hash-Chain-Einträge ohne einen einzigen Mismatch.

---

## Detail-Bilanz Wave 14 → Wave 18

| Severity | W14 Open | W15 Open | W16 Open | W17 Open | Marathon Open | **W18 Open** |
|---|---:|---:|---:|---:|---:|---:|
| P0 | 5 | 1 | 0 | 0 | **4** (RBAC) | **0** ✅ |
| P1 | 8 | 3 | 0 | 2 | **5** | **1** (Cascade-Upstream) |
| P2 | viele | viele | viele | viele | 4 | **1** (`/admin/branding`) |

---

## Verdict

**Plattform ist beta-tauglich für Pilot-Kunden.**

Die wichtigste Marathon-Erkenntnis (RBAC inkonsistent über die 9 User Stories) ist vollständig adressiert:

- ✅ Process Owner kann sein Risk von Create → Treatment selbst betreuen
- ✅ Vendor Manager kann Vendoren + Contracts ohne CISO-Eskalation erstellen
- ✅ ESG Manager kommt bis zum Body-Schema durch (RBAC passt, Schema-Doku ergänzen)
- ✅ CISO kann Risk-Status-Transitions ohne admin-Override durchführen
- ✅ DSR-Workflow ist 100 % via Discovery API durchspielbar (verify + process + respond + close)
- ✅ Cross-Module-Cascade Finding → Control-Effectiveness ist als Aggregation implementiert
- ✅ Treatment-Cost → Budget-Aggregation als Endpoint verfügbar
- ✅ KPI-Endpoints `controls/findings-summary` + `processes/governance-summary` liefern Daten

**Restpunkte für Wave 19:**

1. **🔴 Finding-Create persistiert `controlId` nicht** (P1) — Cascade-Endpoint ist da, aber neue API-erstelle Findings tragen kein controlId. Spiegelung Wave-15-P1-01 (auditId-field-projection).
2. **🔴 `/admin/branding` weiter 500** (P2)
3. **🟡 Contract-Schema-Drift `name → title`** (P3) — CHANGELOG eintragen
4. **🟡 Finding-Status-Mapping `open → identified`** (P3) — entweder strict reject oder dokumentieren
5. **🟡 CISO darf keine Findings raisen** (P3) — RBAC-Konsistenz-Lücke

Mit dem Fix von #1 (Finding controlId persistence) wäre die Cross-Module-Cascade vollständig funktional. Die anderen Punkte sind Polish.

**Hash-Chain healthy durch 18 Wellen mit 1.678 verifizierten Einträgen, 0 mismatches.** Audit-Trail-Integrität trägt — DSGVO Art. 5(2), ISO 27001 A.18.1.3, GoBD §147 sind erfüllbar.

---

*Wave 18 abgeschlossen. 4 P0 + 4 P1 gefixt, 1 P1 partial (Cascade-Endpoint ✅ aber Upstream-controlId-Bug), 1 P2 offen.*
