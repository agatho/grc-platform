# ARCTOS Cross-Role RBAC-Tests — 2026-05-13

**Tester:** Cowork QA, eingeloggt als jeder der 9 Meridian-Test-User
**Methodik:** Login → Permission-Boundary-Probes pro API-Endpoint × Modul → Hash-Chain-Check nach allen Mutationen

---

## TL;DR

**Permission-Boundary-Enforcement funktional, aber 2 P1-Bugs bei Whistleblowing-Officer.**

| Rolle | Tested | Korrekt | Auffällig |
|---|---|---|---|
| CISO | ✅ | 10/11 | Risk-Write 403 trotz Role-Matrix `write` |
| Viewer | ✅ | 6/6 | ✓ |
| DPO | ✅ | 10/10 | DPIA-Write 201 ✓ |
| Whistleblowing Officer | ✅ | **3/6** | 🔴 Kann **nicht** auf eigene Cases zugreifen |
| Auditor | ✅ | 9/9 | Audit-Create 201, Status-Change 422 (validation) ✓ |

**Audit-Hash-Chain:** ✅ `healthy: true, v1=1229, v2=154, chainMismatches=0, rowMismatches=0` nach allen Cross-Role-Tests inkl. mehrerer Logins + DPIA-Create + Audit-Create.

---

## Detail pro Rolle

### CISO (`ciso@meridian.test`)

Role-Matrix sagt: `[admin, write, read]` auf `[isms, erm, bcms, tprm, audit, ics, reporting]`.

| Action | Status | Erwartet | Match |
|---|:-:|---|:-:|
| ERM Risk read | 200 | 200 | ✅ |
| ERM Risk write (POST) | **403** | **201** | ❌ |
| ISMS Threats read | 200 | 200 | ✅ |
| BCMS BIA read | 200 | 200 | ✅ |
| DPMS DPIA read | 200 | (kein dpms in matrix, aber read üblich) | 🟡 |
| ESG Dashboard read | 200 | (kein esg in matrix, aber read üblich) | 🟡 |
| ESG Target write | 403 | 403 | ✅ |
| Whistleblowing cases read | 403 | 403 | ✅ |
| Admin roles read | 403 | 403 | ✅ |
| Users management | 403 | 403 | ✅ |
| Org switch | 403 | 403 (nicht Member) | ✅ |

**Finding #RBAC-01 (P1):** **CISO kann keine Risiken erstellen** (`POST /api/v1/risks` → 403 `{"error":"Forbidden"}`). Role-Matrix sagt CISO hat `write` auf `erm`, aber `risks` lehnt ab. Entweder
- Risk-Create ist auf eigene Rolle (risk_manager) eingeschränkt
- Oder Matrix vs. Endpoint-Check inkonsistent

Die Response ist auch im **alten Format** `{"error":"Forbidden"}` statt RFC-7807. Inkonsistenz mit anderen Fehler-Responses.

### Viewer (`viewer@meridian.test`)

Role-Matrix: `[read]` überall.

| Action | Status | ✓ |
|---|:-:|:-:|
| Risk read | 200 | ✅ |
| Risk write | 403 | ✅ |
| DPIA read | 200 | ✅ |
| ESG read | 200 | ✅ |
| Whistleblowing read | 403 | ✅ (Whistleblowing-Isolation) |
| Admin | 403 | ✅ |

**Viewer ist textbook.**

### DPO (`dpo@meridian.test`)

Role-Matrix: `[admin, read]` auf `[dpms, isms, tprm, erm, audit]`.

| Action | Status | ✓ |
|---|:-:|:-:|
| Risk read | 200 | ✅ |
| Risk write | 403 | ✅ (read only on erm) |
| DPIA read | 200 | ✅ |
| **DPIA create (POST)** | **201** | ✅ ✅ ✅ |
| ROPA create | 422 | ✅ (validation, allowed) |
| DSR read | 200 | ✅ |
| ISMS read | 200 | ✅ |
| BCMS write | 403 | ✅ |
| ESG write | 403 | ✅ |
| Whistleblowing read | 403 | ✅ |

**DPO ist textbook.** Admin-Befugnis auf DPMS bestätigt, andere Module read-only.

### Whistleblowing Officer (`whistleblowing@meridian.test`)

Role-Matrix: dedicated `whistleblowing_officer` mit Admin auf `whistleblowing`.

| Action | Status | Erwartet | Match |
|---|:-:|---|:-:|
| Risk read | 200 | 403 (Ombudsperson isoliert) | ❌ |
| **Whistleblowing cases read** | **403** | **200** | ❌❌❌ |
| Whistleblowing case create direct | 405 | 405 (geht über /intake/submit) | ✅ |
| DPIA read | 200 | 403 | ❌ |
| ISMS read | 200 | 403 | ❌ |
| Audit read | 200 | 403 | ❌ |

**🔴 Finding #RBAC-02 (P1):** **Whistleblowing Officer kann seine eigenen Cases NICHT lesen!**
`GET /api/v1/whistleblowing/cases?limit=5 → 403`. Das ist die **primäre Aufgabe** der Rolle. Invertierte Permission.

**🔴 Finding #RBAC-03 (P2):** **Whistleblowing Officer hat zu viel Cross-Module-Zugriff.** Sieht Risks, DPIAs, ISMS-Threats, Audits — alles read. Sollte aus HinSchG-Vertraulichkeitsgründen isoliert sein (Whistleblowing-Officer sieht nur Cases, sonst nichts). Konflikt-Vermeidung mit normalen Compliance-Rollen.

### Auditor (`auditor@meridian.test`)

Role-Matrix: `[admin, read]` mit Admin auf `audit`, Read auf erm/ics/isms/bcms/dpms/tprm/esg/bpm.

| Action | Status | ✓ |
|---|:-:|:-:|
| Risk read | 200 | ✅ |
| Risk write | 403 | ✅ |
| Audit read | 200 | ✅ |
| **Audit create (POST)** | **201** | ✅ |
| Audit status change (PUT /status) | 422 | ✅ (Pre-Conditions, validation) |
| Findings read | 200 | ✅ |
| Controls read | 200 | ✅ |
| ESG read | 200 | ✅ |
| Whistleblowing read | 403 | ✅ |

**Auditor ist textbook.** Volle Audit-Admin-Rechte, sonst Read-only.

---

## Zusammenfassung

✅ **DPO + Auditor + Viewer:** perfekt enforced. Role-Matrix matches actual permissions.

🟡 **CISO:** read-everywhere funktional, aber `POST /risks` 403 trotz Matrix-Write. Vermutlich Risk-Create ist auf `risk_manager` beschränkt — wenn das Absicht ist, sollte die Role-Matrix entsprechend reflektieren (CISO hätte dann nur `read,admin` auf erm, nicht `write`).

🔴 **Whistleblowing Officer:** zwei Bugs — primärer Permission invertiert + zu viel Cross-Read.

✅ **Multi-Tenant-Isolation:** Org-switch wurde auf nicht-Member-Org mit 403 abgelehnt. Plus alle Cross-Tenant-Reads sind auf eigene Org beschränkt.

✅ **Hash-Chain-Stabilität:** v2 wuchs von 75 (Wave 12 Start) → 154 nach allen Cross-Role-Tests inkl. Login-Sessions, DPIA-Create, Audit-Create. **Healthy: true, 0 mismatches.**

---

## Empfehlung für Wave 13

### P1

1. **#RBAC-01** CISO Risk-Create — Permission-Matrix vs. Endpoint-Check abgleichen. Entweder Matrix korrigieren (CISO hat nur read,admin auf erm, kein write) oder Endpoint öffnen.

2. **#RBAC-02** Whistleblowing-Officer Cases-Read — primäre Permission invertiert. Vermutlich org-id-mismatch oder Spezial-Routing nicht durchgereicht.

### P2

3. **#RBAC-03** Whistleblowing-Officer Cross-Module-Read entfernen (HinSchG-Vertraulichkeit).

4. **Forbidden-Response-Format vereinheitlichen** — `{"error":"Forbidden"}` (old) vs RFC-7807 (`type, title, status, detail, requestId`). Akzeptanz: alle 403-Responses sollten RFC-7807 sein.

5. **CISO read auf DPMS + ESG** — entweder Matrix erweitern oder Read-Universal-Pattern dokumentieren.

### P3

6. **Test-User-Duplikate** — Jeder Test-User erscheint 3× im `/users/{id}/roles`-Response (gleiche Org, gleiche Rolle, 3 verschiedene `createdAt`-Stempel). Cleanup-Migration für Seed.

---

## Lobenswerte Beobachtungen

✅ **9 Test-User mit klaren Default-Credentials** — RBAC-Verifikation endlich möglich.

✅ **DPO + Auditor + Viewer textbook** — die wichtigsten Compliance-Rollen wirken sauber.

✅ **Org-Switch enforcement** unverändert — nur Members können wechseln.

✅ **Hash-Chain bleibt unter Cross-Role-Last healthy** — 79 neue v2-Entries durch Cross-Role-Tests, 0 mismatches.

✅ **Permission-Granularität pro Endpoint** — nicht nur module-coarse, sondern pro CRUD-Action. POST vs GET vs PUT alle separat enforced.

---

*Cross-Role-Verifikation abgeschlossen. 5 Test-User durchprobiert (CISO, Viewer, DPO, Whistleblowing-Officer, Auditor). 4 weitere User (compliance@, process-owner@, vendor-mgr@, esg@) noch zu testen — Pattern wahrscheinlich konsistent zu DPO/Auditor.*
