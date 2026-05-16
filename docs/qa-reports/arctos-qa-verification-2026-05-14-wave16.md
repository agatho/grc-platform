# ARCTOS QA Wave-16 Verifikation — 2026-05-14

**Tester:** Cowork QA
**Fokus:** Wave-15 verbleibende 4 Findings (sortBy, Contract-Val, DORA-Critical, Audit-Finding-Field)

---

## TL;DR

🎉 **Alle 4 verbleibenden Wave-15-Findings sind gefixt.** Plattform-Stand erstmals seit Wave 14 ohne offene P0/P1-Findings aus diesem Test-Backlog.

| Finding | Wave 15 | Wave 16 |
|---|---|---|
| `#WAVE14-UI-01/02` `/risks` + `/controls` sortBy | 🔴 422 | ✅ **200** |
| `#WAVE14D-P1-02/03` Contract-Validation | 🔴 201 mit invalid | ✅ **422** mit field-detail |
| `#WAVE14D-P1-07` `/dora/critical-vendors` | 🔴 500 | ✅ **200** mit 2 critical vendors |
| `#WAVE14D-P1-01` Audit→Finding `auditId`-Field | 🟡 persistiert, fehlte in GET-Response | ✅ **vollständig** in GET-Response |
| Hash-Chain | ✅ | ✅ **healthy v1=1229, v2=374, 0 mismatches** |

---

## ✅ Detail-Verifikation

### 1. `/risks` + `/controls` UI vollständig funktional

**API-Test:**
```
GET /api/v1/risks?limit=100&sortBy=riskScoreResidual&sortDir=desc → 200
GET /api/v1/controls?limit=100&sortBy=effectiveness&sortDir=desc → 200
```

**UI-Test:**
- `/risks` zeigt jetzt: "Risikomanagement — 24 risks" mit voller Tabelle (Wave14-QA-W1-Risk als RSK-045 mit Status "Geschlossen" sichtbar)
- `/controls` zeigt: "Internes Kontrollsystem — 18 Kontrollregister" mit voller Tabelle (Sarah Mueller als Verantwortliche)

**Server-Schema wurde um die UI-sortBy-Werte erweitert.**

### 2. Contract-Validation strikt

```
POST /contracts {value: -5000, startDate: '2027-01-01', endDate: '2026-01-01'} → 422
{
  "error": "Validation failed",
  "details": {
    "fieldErrors": {
      "totalValue": ["Monetary value must be a non-negative decimal (e.g. '1000' or '1234.56'); use a dot as the decimal separator"],
      "expirationDate": ["expirationDate must be on or after effectiveDate"]
    }
  }
}
```

Beide Constraints fangen jetzt:
- Negative Werte
- endDate vor startDate

**Bonus-Beobachtung:** Field-Naming geändert (`value` → `totalValue`, `endDate` → `expirationDate`) — UI muss auch angepasst sein.

### 3. DORA Critical-Vendors Cross-Module-Sync

```
GET /api/v1/dora/critical-vendors → 200
{
  "data": {
    "total": 2,
    "vendors": [
      {
        "name": "CloudNova GmbH",
        "tier": "critical",
        "status": "active",
        "country": "Deutschland",
        "inherentRiskScore": 82,
        "residualRiskScore": 45,
        ...
      }
    ]
  }
}
```

TPRM-Vendoren mit `tier: critical` werden automatisch in der DORA-Critical-Vendors-Liste angezeigt. **Cross-Module-Sync funktioniert.**

### 4. Audit→Finding `auditId` vollständig

Wave-14-Finding `Wave15-CrossLink` mit `auditId: 92c78323-2641-4fe2-aa16-ce9ed34b00af` ist jetzt im GET-Response:
```json
{
  "title": "Wave15-CrossLink",
  "auditId": "92c78323-2641-4fe2-aa16-ce9ed34b00af",
  "source": "audit"
}
```

Cross-Module-Link von Audit → Finding ist sowohl persistiert als auch in der API-Response sichtbar.

---

## Hash-Chain Status

```
healthy: true
v1: 1229 (unverändert seit Wave 7)
v2: 374 (+6 durch Wave-16-Tests)
mismatches: 0
```

**Über 16 Wellen production-stabil.**

---

## Detail-Bilanz Wave 14 → Wave 16

| Severity | Wave 14 OPEN | Wave 15 OPEN | Wave 16 OPEN |
|---|---:|---:|---:|
| P0 | 5 | 1 | 0 ✅ |
| P1 | 8 | 3 | 0 ✅ |

**Alle P0 + P1 aus Wave 14 DEEP sind gefixt.**

Verbleibende P2/P3 aus Wave 14 (nicht in Wave-16-Scope):
- `/controls/findings` Aggregation zeigt 0 obwohl Daten existieren (P2)
- `/processes/governance` "GESAMTPROZESSE 0" (P2)
- `/tprm/concentration` returns null (P2)
- Mehrere Admin-Endpoints 404 (P2)
- DPIA-Schema-Inkonsistenz `riskDescription`/`measureDescription` (P3)
- Country-Code-Validation fehlt (P3)
- KRI-history-Endpoint 404 (P3)
- Whistleblowing-Intake-OrgCode nicht discoverable (P3)
- Risk impact/likelihood Range-Validation maskiert (P3)

---

## Lobenswerte Wave-16-Patterns

✅ **Contract-Field-Errors sind UX-Gold**:
   - "Monetary value must be a non-negative decimal (e.g. '1000' or '1234.56'); use a dot as the decimal separator"
   - "expirationDate must be on or after effectiveDate"
   
   Konkrete Hinweise statt nur "invalid". Frontend kann den Hilfetext direkt anzeigen.

✅ **DORA-Critical-Vendor-Response zeigt Risk-Scoring**: `inherentRiskScore: 82, residualRiskScore: 45` — Cross-Module-Aggregation aus TPRM → DORA mit voller Risk-Sicht. Compliance-tauglich.

✅ **`/risks` zeigt 24 risks (Wave14-W1 inkl.)** — Daten-Integrität über alle 14+ Wellen erhalten.

---

## Verdict

**Plattform-Stand nach Wave 16:** Alle harten P0/P1-Findings aus dem Funktional-Tiefen-Test sind gefixt.

| Säule | Status |
|---|:-:|
| Hash-Chain (ISO 27001 A.18.1.3, GoBD §147, DSGVO Art. 5(2)) | ✅ |
| State-Machine-Coverage | 12/14 + 2 by-design |
| PDF/A (GoBD §147) | ✅ |
| Incident DSGVO Art. 33 | ✅ NIST-7-State |
| RBAC + 3LoD | ✅ |
| HinSchG-Vertraulichkeit | ✅ §§-Referenz |
| Multi-Tenant-Isolation | ✅ |
| Exports (CSV/PDF/ZIP) | ✅ |
| Validation-Layer | ✅ RFC-7807 + strict |
| UI-API-Sync | ✅ (`/risks`, `/controls`, `/isms/*`) |
| Cross-Module-Verkettung | ✅ Audit→Finding, TPRM→DORA |
| DSR-Workflow (Art. 15-21) | ✅ |
| BIA-Workflow + Gates | ✅ Discovery + `/start` |

**Plattform-Stand jetzt realistisch beta-tauglich.** Restliche P2/P3-Items sind Polish-Material, kein Beta-Blocker.

---

## Wave 17 Empfehlung (Polish, nicht-zeitkritisch)

1. `/controls/findings` + `/processes/governance` Aggregation-Bug
2. `/tprm/concentration` non-null aggregation
3. Admin-Endpoints (`branding`, `calendar`, `settings`, `license`, `integrations`)
4. DPIA-Schema-Konsistenz (`description` überall statt `riskDescription`/`measureDescription`)
5. Country-Code ISO 3166-Validation
6. KRI-history-Endpoint
7. Whistleblowing-OrgCode-Discovery
8. Notification mark-all-read

---

*Wave 16 abgeschlossen. Alle Wave-14-DEEP-P0/P1-Findings gefixt. Plattform beta-tauglich.*
