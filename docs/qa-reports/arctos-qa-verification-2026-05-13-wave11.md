# ARCTOS QA Wave-11 Verifikation — 2026-05-13

**Tester:** Cowork QA
**Wave-11-Deliverables:** 6 PRs (#140, #142, #143, #144, #145, #146)

---

## TL;DR

**Solides Sprint-Ergebnis bei den State-Machines + Audit-Log. Drei Issues bleiben offen:**

| PR | Inhalt | Status |
|---|---|---|
| #140 | Incident State-Machine | ✅ Excellent |
| #140 | PDF-Pipeline | 🔴 503 ENOENT Helvetica.afm |
| #142 | 4 zusätzliche State-Machines | ✅ Vendor/Contract/Process/DSR ✓ |
| #142 | Closed-State-Docs | (nicht direkt geprüft) |
| #143 | RLS Gap-Closure | (nicht prüfbar via QA-API) |
| #144 | Export-Fixes | 🔴 ROPA/BIA/Findings noch 500 |
| #144 | ESG GET | 🟡 `/esg/report/2026` 404, `/esg/report/2026/export` 200 |
| #144 | RBAC-Roles-Discovery | ✅ Excellent |
| #144 | RBAC-Test-User-Seed | 🟡 Nur 2 User (admin + ciso), keine neuen Test-User |
| #145, #146 | Doku + Test-Prewarm | (nicht direkt geprüft) |

**Hash-Chain Status:** ✅ `healthy: true, chainMismatches: 0, v1=1229 (unverändert), v2=69+`. Wave 10's Hot-Fix hält unter Wave-11-Last.

---

## ✅ Erfolgreiche Wave-11-Deliverables

### PR #140 — Incident State-Machine

**Discovery-API perfekt:**
```json
{
  "current": "contained",
  "knownStatuses": ["detected","triaged","contained","eradicated","recovered","lessons_learned","closed"],
  "allowedNext": ["eradicated"],
  "endpoint": "/api/v1/isms/incidents/{id}/status",
  "method": "PUT",
  "bodyShape": {"status":"<one of: ...>","reason":"<optional string>"}
}
```

NIST-konforme 7-state Incident-Lifecycle. Vollständig.

**End-to-End-Test:**
- `PUT /api/v1/isms/incidents/{id}/status {status:'eradicated', reason:'...'}` → 200
- Nach Transition: `current: eradicated, allowedNext: ['recovered']` ✅
- **Hash-Chain bleibt healthy nach Transition** ✅
- DSGVO Art. 33 Foundation jetzt vorhanden (auch wenn `notify-authority` als separate Workflow-Route noch fehlt, aber das war keine harte Anforderung)

**Mini-Inkonsistenz (Polish-Level):** Incident nutzt `allowedNext` während Risks/Findings `allowed` heißen. Beide gleich-verständlich, könnte vereinheitlicht werden.

### PR #142 — 4 weitere State-Machines

| Modul | Status | Allowed-Transitions |
|---|---|---|
| Vendor | ✅ | `[under_review, suspended, terminated]` |
| Contract | ✅ | `[renewal, expired, terminated]` |
| Process | ✅ | `[published, in_review, archived]` |
| DSR | ✅ | `/transitions` jetzt verfügbar (vorher nur named-routes) |

**4/4 wie versprochen.** State-Machine-Coverage jetzt:

| Modul mit Status-Field | `/transitions` |
|---|:-:|
| Risk, BIA, DPIA, Audit, Finding, Vulnerability, Control, **Incident**, **Vendor**, **Contract**, **Process**, **DSR** | ✅ (12/14) |
| Asset | ❌ |
| Threat | ❌ |

12 von 14 abgedeckt — die letzten beiden (Asset, Threat) sind P3-Polish.

### PR #144 — RBAC-Roles-Discovery

```
GET /api/v1/users/f22a4bc0-.../roles → 200
{
  "data": [
    { "orgId": "2b333f6f-...", "orgName": "Audit-CIS-IG1-980731", "role": "admin", "lineOfDefense": null, "department": null, "createdAt": "..." },
    { "orgId": "90609582-...", "orgName": "Audit-ISO27001-038695", "role": "admin", ... },
    ...
  ]
}
```

Excellent. Liefert pro Org die Rolle des Users inkl. `lineOfDefense` (3LoD-Konzept) und `department`-Feld. Perfekt für UI-Anzeige "Sarah Mueller — CISO in Org A, Auditor in Org B".

### Hash-Chain unter Wave-11-Load

Nach 1 Incident-Transition + 1 Risk-Field-Update:
- `total: 1298 (war 1244)` → +54 Entries durch alle Tests
- `v1: 1229 unverändert`
- `v2: 69 (war 15)` → alle neuen Entries v2-verifiziert
- `chainMismatches: 0` ✅
- `rowMismatches: 0` ✅
- `healthy: true` ✅

**Wave-10-Hash-Fix hält** unter neuen Modulen + neuen State-Transitions.

---

## 🔴 Offen / Bugs

### #WAVE11-PDF-01 (P1) — PDF-Pipeline: Helvetica.afm fehlt im Bundle

Alle drei PDF-Endpoints:
```
GET /api/v1/dpms/deadline-monitor/pdf  → 503
GET /api/v1/ai-act/annual-report/2026/pdf → 503
GET /api/v1/dpms/annual-report/2026/pdf → 503
```

Response-Body (vorbildliches RFC-7807):
```json
{
  "type": "https://arctos.charliehund.de/errors/pdf-render-failed",
  "title": "PDF generation failed",
  "status": 503,
  "detail": "ENOENT: no such file or directory, open '/app/apps/web/.next/server/chunks/data/Helvetica.afm'"
}
```

**Bundling-Bug**, kein Code-Bug. Das Font-File (Helvetica.afm — Adobe Font Metrics, vermutlich für PDFKit) wird nicht in den Next.js-Standalone-Build kopiert. Fix wahrscheinlich:
- Webpack `CopyWebpackPlugin` oder `outputFileTracingIncludes` in `next.config.js` ergänzen
- Oder PDFKit auf eingebettete Standard-Fonts umstellen (`registerFont` mit dem Buffer der Standard-Schrift)
- Oder migration zu Puppeteer/Playwright HTML→PDF (lustig: das war meine ursprüngliche Empfehlung)

Ist der Wave-7-Fortschritt (HTML→PDF-Format) jetzt rückwärts. Vorher 200 HTML, jetzt 503 broken. **Regression-Risiko** muss in der Akzeptanztests-Pipeline gefangen werden.

### #WAVE11-EXP-01 (P1) — Export-Endpoints 500

```
GET /api/v1/dpms/ropa/export?format=csv  → 500 (empty body!)
GET /api/v1/bcms/bia/export?format=csv → 500 (empty body)
GET /api/v1/findings/export?format=csv → 500 (empty body)
```

`content-type: null, content-length: 0` — der RFC-7807-Wrapper greift hier nicht, das ist die "alte Krankheit". Vermutlich crashen die Endpoints vor dem Wrapper.

ESG-Export:
```
GET /api/v1/esg/report/2026/export → 200 application/json ✅
```

Funktioniert. Aber:
```
GET /api/v1/esg/report/2026 → 404
```

ESG-Report GET (ohne /export) ist 404. Vermutlich gewollt — das ist die Seite, nicht die API.

### #WAVE11-RBAC-01 (P2) — Test-User-Seed fehlt

`GET /api/v1/users` returnt weiter nur 2 User (admin@arctos.dev, ciso@arctos.dev). Die Wave-11-Übergabe sagte "RBAC seed". Entweder:
- Seed nicht gelaufen
- Seed war nur für Roles-Permissions, nicht für Test-User per Rolle
- Test-User existieren in einer anderen Org (ich bin in Meridian)

**Konsequenz:** Cowork QA kann weiterhin keine echten Cross-Role-Tests fahren. Login als CISO/DPO/Viewer nicht möglich. Wave-12-Wunsch: 9 echte Test-User (`ciso@meridian`, `dpo@meridian`, `compliance@meridian`, `auditor@meridian`, `process-owner@meridian`, `vendor-mgr@meridian`, `esg@meridian`, `whistleblowing@meridian`, `viewer@meridian`) mit Default-Password.

### Open aus Wave 6-10 (nicht in Wave-11-Scope)

- Asset, Threat State-Machines (P3)
- Closed→Identified Re-Open ohne State (#WAVE6-STATE-02, P3)
- BPM-Sub-Pages Empty-Stubs (#NIGHT-047)
- Cross-cutting Compliance-Endpoints (#WAVE6-CROSS-05)

---

## Bewertung Wave 11

Die zwei wichtigsten Beta-Blocker waren PDF-Pipeline und Incident-State-Machine. **Incident ist exzellent** geliefert. **PDF ist regressiert** — vorher mindestens HTML, jetzt 503. Akzeptanzkriterium nicht erfüllt. Plus 3 Export-Endpoints crashen weiter mit empty-body-500.

**Compliance-Reifegrad:**

| Säule | Wave 10 | Wave 11 |
|---|---|---|
| Audit-Hash-Chain | ✅ healthy | ✅ healthy (unter Wave-11-Last) |
| State-Machine-Coverage | 7/14 | **12/14** (+5) ✅ |
| PDF/A-Archive (GoBD §147) | 🟡 HTML | 🔴 broken (503) |
| Incident-Workflow (DSGVO Art. 33) | ❌ fehlt | ✅ NIST-7-State ✓ |
| RBAC-Discovery | 🟡 limited | ✅ full /roles-endpoint |
| RBAC-Test-Coverage | 🟡 only admin | 🟡 still only 2 users |
| Exports | 🔴 4 crashen | 🟡 1 fixed (ESG) |

**Verdict:** Plattform deutlich näher an Beta. Ohne PDF-Pipeline aber kein GoBD-konformer Audit-Trail-Export. Mit 12 State-Machines + Incident-DSGVO-Art-33 + Roles-Discovery sind die wichtigsten Workflow-Foundations vorhanden.

---

## Wave 12 — Empfohlene Reihenfolge

1. **PDF-Pipeline-Fix (P1)** — Helvetica.afm bundlen oder Puppeteer-Migration
2. **Export-Endpoints (P1)** — 3 crashende Routes (ROPA/BIA/Findings) inkl. RFC-7807-Wrapper-Coverage (current: empty body)
3. **RBAC-Test-User-Seed (P2)** — 9 User pro Rolle für echte RBAC-Verifikation
4. **Asset + Threat State-Machines (P3)** — Konsistenz auf 14/14
5. **Closed-State-Refinement (P3)** — `reopened`-State formalisieren

---

## Lobenswerte Beobachtungen Wave 11

✅ **PDF-Error-Response ist excellent RFC-7807** mit dem konkreten Dateipfad im `detail`. Operatoren sehen sofort: "Aha, Bundling-Bug, nicht Code-Bug."

✅ **Incident-Discovery hat `knownStatuses` zusätzlich zu `allowedNext`** — gleiches gute Pattern wie Finding-Discovery aus Wave 8.

✅ **RBAC-Roles-Discovery liefert `lineOfDefense` und `department`-Felder** — 3LoD-Konzept (Three Lines of Defense aus ADR-007) wird API-seitig erst-class.

✅ **Hash-Chain bleibt healthy** unter ~70 neuen v2-Entries durch Wave-11-Tests. Wave-10-Fix ist production-stabil.

✅ **State-Machine-Coverage 12/14** ist enormer Fortschritt — von 4/14 in Wave 6 zu fast vollständig.

✅ **PR-Größe vernünftig aufgeteilt** — 6 PRs statt 1 Monsterbatch. PR #143 (RLS + CodeQL) und PR #146 (Test pre-warm) sind beide nur 1-Topic = saubere Reviewability.

---

*Wave 11 abgeschlossen. State-Machine-Foundation komplett. PDF-Pipeline-Regression + 3 Export-Crashes für Wave 12.*
