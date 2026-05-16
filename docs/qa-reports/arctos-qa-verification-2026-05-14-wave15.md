# ARCTOS QA Wave-15 Verifikation — 2026-05-14

**Tester:** Cowork QA
**Fokus:** Wave-14-DEEP P0 + P1 Findings nach Deployment

---

## TL;DR

**Mehrere große Fixes, aber UI-Sync auf Risks/Controls noch nicht durch.**

| Finding | Wave 14 | Wave 15 |
|---|---|---|
| `#WAVE14D-P0-02` Server-Cap auf alle 19 List-Endpoints | 🔴 500 empty | ✅ **422 RFC-7807** auf allen 19 (3 davon 403 für CISO) |
| `#WAVE14D-P0-01` Server-DoS durch limit=500 | 🔴 502 Crash | ✅ kein Crash mehr (cap aktiv) |
| `#WAVE14D-P0-03` ISMS-UI-Pages "0 gesamt" | 🔴 broken | ✅ **3 von 5 fixed** (`/isms/threats`, `/isms/incidents`, `/controls/rcm`); 2 noch broken (`/risks`, `/controls`) |
| `#WAVE14D-P0-04` DSR-Create 500 empty | 🔴 500 | ✅ **201 Created** (als DPO) |
| `#WAVE14D-P0-05` `/controls/rcm` mainLen=0 | 🔴 | ✅ **2098 chars** mit Risk-Kontroll-Matrix |
| `#WAVE14D-P1-04` BIA-Discovery falscher Endpoint | 🔴 | ✅ **Discovery zeigt `/start`**, Workflow funktioniert |
| `#WAVE14D-P1-05` Audit Discovery + fieldwork | 🔴 | ✅ **Discovery vorhanden**, `current → preparation → fieldwork` |
| `#WAVE14D-P1-01` Audit→Finding link-loss | 🔴 silent loss | 🟡 **persistiert (Filter funktioniert)** aber Field nicht in GET-Response |
| `#WAVE14D-P1-02/03` Contract-Validation | 🔴 akzeptiert neg + end<start | 🔴 **NICHT GEFIXT** — weiter 201 |
| `#WAVE14D-P1-07` `/dora/critical-vendors` | 🔴 404 | 🔴 **NICHT GEFIXT** — jetzt 500 |
| Hash-Chain | ✅ healthy | ✅ **healthy v1=1229, v2=368, 0 mismatches** |

---

## ✅ Was gefixt wurde

### 1. Server-Cap auf allen Listen-Endpoints (`#WAVE14D-P0-02`)

Alle 19 zuvor crashenden Endpoints liefern jetzt 422 statt 500 empty body:

```
risks: 422       findings: 422      bcms/bia: 422       dpms/dpia: 422
controls: 422    audit-mgmt/audits: 422  dpms/dsr: 422   dpms/ropa: 422
isms/threats: 422  isms/vulnerabilities: 422  isms/incidents: 422
processes: 422   assets: 422        contracts: 422      vendors: 422
kris: 422        users: 403*        organizations: 403* control-tests: 422
audit-log: 403*  tasks: 422
```
(*403 weil CISO keinen Admin-Zugriff hat — by-design)

### 2. UI-Sync auf `limit=100` (`#WAVE14D-P0-03` teilweise)

UI-Code wurde auf `limit=100` umgestellt. Netzwerk-Mitschnitt zeigt:
```
GET /api/v1/risks?limit=100&sortBy=riskScoreResidual&sortDir=desc
```

Pages, die jetzt funktionieren:
- ✅ `/isms/threats` zeigt 5 Bedrohungen (war 0)
- ✅ `/isms/incidents` zeigt 2 Vorfälle inkl. Wave14-W5 (war 0)
- ✅ `/isms/vulnerabilities` (vermutlich auch — nicht erneut verifiziert)
- ✅ `/controls/rcm` rendert volle Risk-Kontroll-Matrix (war mainLen=0)

### 3. DSR-Create gefixt (`#WAVE14D-P0-04`)

`POST /api/v1/dpms/dsr` als DPO mit `{requestType, subjectName, subjectEmail, receivedAt, description}` → **201 Created** mit valider DSR-Data, `status: received`. War vorher 500 empty.

### 4. BIA Discovery + Start (`#WAVE14D-P1-04`)

Discovery liefert jetzt korrekten Pfad:
```json
{
  "current": "draft",
  "allowedNext": ["in_progress"],
  "endpoint": "/api/v1/bcms/bia/{id}/start",
  "method": "POST"
}
```

`POST /api/v1/bcms/bia/{id}/start` → 200 mit `{biaAssessmentId, status:'in_progress', previousStatus:'draft', blockers:[], nextSteps:[...]}` — **strukturierte Hilfe** für was als nächstes zu tun ist! Exzellent.

### 5. Audit-Mgmt Discovery + State-Machine (`#WAVE14D-P1-05`)

`GET /audit-mgmt/audits/{id}/transitions` → 200 mit `current: planned, allowedNext: [preparation]`. State-Machine ist 4-Phasen: `planned → preparation → fieldwork → ...`. Pre-Conditions sind jetzt discoverable.

### 6. Audit→Finding Link partial-fix (`#WAVE14D-P1-01`)

POST `/findings {auditId}` setzt jetzt den Link in der DB:
- `findings?auditId=X` liefert die verlinkten Findings ✅
- ABER: das `auditId`-Feld erscheint nicht in der GET-Response des Findings selbst (Field-Projection issue)

Filter funktioniert, GET-Detail-Response zeigt es nicht. Kosmetisch, aber inkonsistent.

---

## 🔴 Was nicht gefixt wurde

### `#WAVE14D-P0-03` Restliche UI-Pages (`/risks`, `/controls`)

`/risks` und `/controls` zeigen weiter "konnten nicht geladen werden". Grund: UI sendet
```
GET /api/v1/risks?limit=100&sortBy=riskScoreResidual&sortDir=desc → 422
```

Der **`limit=500`-Cap ist gefixt**, aber der `sortBy`-Whitelist fehlt für `riskScoreResidual`. Andere Module akzeptieren ihre sortBy-Felder offenbar, nur Risks/Controls nicht.

**Empfehlung:** Zod-Schema für `/risks` und `/controls` muss explizit `sortBy` mit erlaubten Werten whitelistieren: `['createdAt', 'updatedAt', 'riskScoreResidual', 'severity', ...]`.

### `#WAVE14D-P1-02 + -03` Contract-Validation

```
POST /contracts {value: -5000, startDate: '2027-01-01', endDate: '2026-01-01'} → 201 CREATED
```

Weder negativer Wert noch Datum-Reihenfolge wird validiert. Wave-15-Fix ist nicht erfolgt.

### `#WAVE14D-P1-07` `/dora/critical-vendors` 500

War 404, jetzt 500. Schlimmer geworden. Endpoint existiert vermutlich jetzt, aber crasht. RequestId verfügbar: `ccd2ccf71c8c3`.

---

## ✅ Hash-Chain

```
healthy: true
v1: 1229 (unverändert seit Wave 7)
v2: 368 (+8 durch Wave-15-Tests)
mismatches: 0
```

Production-stabil durch alle 15 Wellen.

---

## Detail-Bilanz

| Severity | Wave 14 OPEN | Wave 15 OPEN |
|---|---:|---:|
| P0 | 5 | 1 (UI `/risks`, `/controls`) |
| P1 | 8 | 3 (Contract-Val, DORA-Critical, Audit→Finding-Field) |

**Quote FIXED:** ~70 % der P0 + P1 aus Wave 14 in einem Sprint.

---

## Wave 16 Empfehlung

### P0

1. **`/risks` und `/controls` UI-Sync vollenden** — sortBy-Whitelist im Server-Schema für diese 2 Module ergänzen oder UI-Code anpassen
2. **`/dora/critical-vendors` 500 debuggen** (requestId `ccd2ccf71c8c3`)

### P1

3. **Contract-Validation hinzufügen**: `value: z.number().nonnegative()`, custom-validator `endDate > startDate`
4. **Audit→Finding `auditId` in GET-Response** zeigen (Projection-Fix)

### P2 (vom Wave-14-Backlog noch offen)

- `/controls/findings` Aggregation zeigt 0 obwohl Daten existieren
- `/processes/governance` "GESAMTPROZESSE 0"
- `/tprm/concentration` returns null
- Mehrere Admin-Endpoints 404
- DPIA-Schema-Inkonsistenz
- KRI-history 404

---

## Lobenswerte Wave-15-Patterns

✅ **`bia/start`-Response liefert `nextSteps`** mit strukturierten Workflow-Hinweisen ("score_process_impacts: Process-Impacts mit MTPD/RTO/RPO erfassen") — sehr UX-friendly

✅ **Audit-Discovery zeigt 4-Phasen-State-Machine** (`planned → preparation → fieldwork → ...`) — Klassisches Audit-Lifecycle korrekt modelliert

✅ **UI-Pages erholen sich:** ISMS-Sub-Pages und `/controls/rcm` zeigen jetzt korrekt Daten

✅ **Hash-Chain unverändert healthy** über 15 Wellen + Wave-15-Mutationen

---

## Verdict

Wave 15 hat die Mehrheit der Wave-14-DEEP-P0/P1-Findings gefixt. **Plattform-Stand verbessert sich kontinuierlich**, aber:

- 2 zentrale UI-Pages (`/risks`, `/controls`) bleiben für Endnutzer broken durch sortBy-Mismatch
- Contract-Validation-Bug ist trivial zu fixen, aber blockiert noch
- DORA-Critical-Vendors-500 ist neuer Bug (besser dokumentiert als Wave-14, aber funktional schlechter)

**1-2 weitere Iterationen** für volle UI-API-Sync + Validation-Sweep, dann ist Beta realistisch.

---

*Wave 15 abgeschlossen. ~70 % FIXED, Hash-Chain healthy.*
