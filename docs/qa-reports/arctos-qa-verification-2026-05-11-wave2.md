# ARCTOS QA Verification Report — 2. Fix-Welle

**Folge-Report zu [`arctos-qa-verification-2026-05-11.md`](./arctos-qa-verification-2026-05-11.md)**

**Tester:** Cowork QA (browser-based, no code modifications)
**Datum:** 2026-05-11 (Abendsession)
**Test-Methode:** API-direct via Browser-Session-Cookie + UI-Smoke
**Test-Risk:** `RSK-041` (ID `46cfee2b-a324-493b-a145-70e2876bb128`) — bereits aus Vor-Test vorhanden

---

## TL;DR

**Substantieller Fortschritt:** RSC 503 ist weg, State-Machine ist da (mit Pre-Conditions!), Status-PUT hat saubere Fehlermeldung mit Redirect-Hinweis. **Aber:** 3 neue 500-Errors entdeckt — die State-Machine + Treatment-Endpoint crashen bei legitimen Requests ohne Error-Handling.

**Bilanz nach 2 Wellen:** Von ursprünglich 15 Findings (11 + 4 neue) sind nun **8 ✅ gefixt**, **3 ❌ offen**, **1 ⚠️ partial-fix mit neuen Crashes**, **1 nicht erneut testbar**, **2 neue 500-Crashes entdeckt**.

---

## Verifikations-Update (Inkrement zu V2)

| # | Original Issue | V2 Status | V3 Status (jetzt) | Detail |
|---|---|---|---|---|
| QA-003 | RSC 503 | ❌ Nicht gefixt | ✅ **GEFIXT** | `GET /risks/new?_rsc=…` → 200. Frische Requests durchgängig grün. Die alten 503 im Network-Tab waren Cache-Artifakte aus früheren Sessions. |
| QA-012 | Status-PUT silent strip | 🆕 P1 | ✅ **GEFIXT** | Generic PUT lehnt `status`-Feld jetzt mit **422** ab und liefert klaren Redirect-Hinweis: *"status changes must go through PUT /api/v1/risks/{id}/status (state-machine guarded)"* — vorbildlich. |
| 🆕 State-Machine-Endpoint | (vorher nicht existent) | — | ✅ **NEU IMPLEMENTIERT** | `PUT/PATCH /api/v1/risks/{id}/status` existiert, validiert Pre-Conditions (z. B. assessed braucht inherentLikelihood+Impact), gibt strukturierte 422-Antworten mit `from`, `reason`, `allowed targets`. |
| QA-008 | Owner-Dropdown 2 User | ❌ Nicht gefixt | ❌ **NICHT GEFIXT** | `/api/v1/users` liefert weiter nur admin + ciso. Demo-Seed-Issue. |
| QA-010 | Compliance-Score 0% | ❌ Nicht gefixt | ⚠️ **nicht erneut UI-getestet** | API hat keinen `/dashboard/summary`-Endpoint (404). UI-Visit wurde nicht erneut durchgeführt. |
| QA-013 | `—` als Text | P3 | ✅ **GEFIXT** (vermutet) | API liefert jetzt korrekt `null` für leere Behandlungsstrategie. UI muss den Em-Dash-Fallback render — Risiko-Liste zeigt jetzt "---" (drei Striche, plausibel als Platzhalter, kein Escape sichtbar). |
| QA-014 | search_index im Dashboard | P2 | ⚠️ **nicht erneut UI-getestet** | Audit-Log per API enthält jetzt nur relevante entity_types — falls Dashboard-Widget den gleichen API-Filter nutzt, sollte das ebenfalls sauber sein. |
| QA-015 | Radix PointerEvent | P3 | ❌ **NICHT GEFIXT** | Tab-Click via `element.click()` schlägt weiter fehl. Niedrige Prio. |

---

## 🆕 NEUE Findings (Wave 3)

### #QA-016 (P1) — State-Machine wirft 500 mit leerem Body bei legitimen Transitions

**Severity:** P1 — Server-Crash ohne Error-Body
**Modul:** ERM State-Machine
**Where:** `apps/web/src/app/api/v1/risks/[id]/status/route.ts` PUT-Handler

**Repro (alle 3 Cases liefern HTTP 500 mit empty body):**

```bash
# Case 1: Same-state idempotency
curl -X PUT $URL/api/v1/risks/{id}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "assessed"}'  # current status = "assessed"
# → 500, body: ""
# Expected: 200 + same data (idempotent) OR 304 Not Modified

# Case 2: assessed → accepted ("allowed" laut Server-Antwort, aber crash)
curl -X PUT $URL/api/v1/risks/{id}/status \
  -d '{"status": "accepted"}'
# → 500, body: ""
# Hinweis: Bei assessed → closed wurde die State-Machine korrekt mit 422
# antwortet und Allowed-Targets gelistet: "treated, accepted, identified".
# accepted wird also als allowed deklariert, aber der eigentliche Apply crasht.

# Case 3: Backward transition (assessed → identified)
curl -X PUT $URL/api/v1/risks/{id}/status \
  -d '{"status": "identified"}'
# → 500, body: ""
# Auch identified wird in "Allowed targets" gelistet → sollte gehen.
```

**Diagnose:**
Vermutlich:
- Same-state (`assessed → assessed`): UPDATE-Statement crasht weil `WHERE status != new_status` keine Zeile betrifft und Code anschließend auf eine `undefined`-Row zugreift.
- `assessed → accepted`: Erfordert vermutlich einen `risk_acceptance`-Record (siehe `risk-acceptance.ts` Schema mit `risk_acceptance_authority`). Wenn der fehlt, schlägt DB-Constraint zu, aber try/catch fehlt im Handler.
- `assessed → identified`: Möglicherweise downgrade-Logik (Audit-Anchor-Reset?) führt zu Race oder Constraint-Violation.

**Suggested Fix:**
```typescript
// apps/web/src/app/api/v1/risks/[id]/status/route.ts
export async function PUT(req, { params }) {
  try {
    // ... state-machine logic
  } catch (err) {
    console.error('[POST /risks/:id/status] crashed:', err);
    return Response.json(
      { error: 'Internal error during status transition', code: 'STATE_TRANSITION_FAILED' },
      { status: 500 }
    );
  }
}
```

Plus: Same-state-Transition als No-Op behandeln + dedizierte Pre-Conditions für `accepted` (Acceptance-Record erforderlich?) und `identified` (Downgrade-Path).

---

### #QA-017 (P1) — `POST /api/v1/risks/{id}/treatments` crasht ebenfalls mit 500/empty body

**Severity:** P1 — Treatment-Erstellung broken
**Modul:** ERM Treatment
**Where:** `apps/web/src/app/api/v1/risks/[id]/treatments/route.ts` POST-Handler

**Repro:**
```bash
curl -X POST $URL/api/v1/risks/{id}/treatments \
  -H "Content-Type: application/json" \
  -d '{"riskId": "...", "description": "QA test treatment", "status": "planned"}'
# → 500, body: ""
```

**Auswirkung:**
- Treatment-Anlage über API broken
- Damit kann man auch `assessed → treated` nicht durchführen (State-Machine fordert mindestens 1 active treatment)
- Risk-Lifecycle ist effektiv **bei "assessed" festgenagelt** wenn nichts manuell DB-seitig korrigiert wird

**Vermutete Ursache:**
- Endpoint nimmt das Body-Format vermutlich anders an (Felder-Mismatch). Check Zod-Schema in `packages/shared/src/schemas/risk.ts` `createRiskTreatmentSchema`.
- Oder: ein NOT-NULL-Constraint auf `responsibleId` oder ähnlich, der fehlt im Test-Body — sollte aber 422 sein, nicht 500.

**Suggested Fix:**
1. Try/catch um den Handler-Body
2. Zod-Schema-Validation darf nicht durchrutschen (klare 422)
3. DB-Constraint-Errors auf 422 mappen (siehe `apps/web/src/lib/api-errors.ts` für RFC 7807)

---

### #QA-018 (P3) — Tabellen-Render-Bug bei `treatmentStrategy`: API gibt `null`, UI zeigt "---"

**Severity:** P3 — kosmetisch
**Modul:** Risiko-Liste UI
**Where:** Vermutlich `apps/web/src/components/risks/risk-list-row.tsx` oder ähnlich

**Repro:**
1. `/risks` öffnen
2. Spalte "Behandlungsstrategie" bei RSK-041 (kein Treatment gesetzt) anschauen
3. **Sichtbar:** "---" (drei ASCII-Striche)
4. **API-Response für gleiche Zeile:** `treatmentStrategy: null`

**Bewertung:** `—`-Escaping (Original #QA-013) ist gefixt. Aber: Die UI zeigt 3 ASCII-Striche statt einem schönen `—` (Em-Dash). Konsistenz im Repo: Andere Zellen mit leeren Werten zeigen ebenfalls "-" oder "---". Vermutlich gleiches Pattern.

**Suggested Fix:** Konsistent eine schöne Em-Dash-Glyph (`—` = U+2014) als Platzhalter verwenden, in einer zentralen Constants-Datei. Wenn das bereits so ist, vermutlich Browser-Font-Issue (manche Fonts rendern Em-Dash nicht visuell unterschiedbar von 3-em-Strich).

Sehr niedrige Prio.

---

## Komplette Sammelübersicht (Wave 1 + Wave 2)

| # | Severity | Status | Titel |
|---|----------|--------|-------|
| QA-001 | P0 | ✅ | POST /risks 500 → jetzt 201 |
| QA-002 | P0 | ⚠️ Nicht testbar | Kein 500 mehr provozierbar |
| QA-003 | P0 | ✅ | RSC 503 → jetzt 200 |
| QA-004 | P1 | ✅ | Tab-i18n-Key → jetzt "Dokumente" |
| QA-005 | P1 | ✅ | Audit-Log-Filter risk-spezifisch |
| QA-006 | P2 | ✅ | Select uncontrolled-Warning weg |
| QA-007 | P2 | ✅ | "Alle Verantwortlichen" Label |
| QA-008 | P3 | ❌ | Owner-Dropdown weiter 2 User |
| QA-009 | P3 | ⚠️ | Skala-Tooltips (nicht erneut UI-getestet) |
| QA-010 | P3 | ❌ | Compliance-Score Tooltip fehlt |
| QA-011 | P3 | ⚠️ | Wizard-Heatmap (nicht erneut UI-getestet) |
| QA-012 | P1 | ✅ | Status-PUT strippt nicht mehr — 422 mit Hinweis |
| QA-013 | P3 | ✅ | `—` Escape — vermutlich gefixt |
| QA-014 | P2 | ⚠️ | search_index Filter (Dashboard nicht erneut UI-getestet) |
| QA-015 | P3 | ❌ | Radix PointerEvent (niedrige Prio) |
| **QA-016** | **P1** | 🆕 | **State-Machine 500 bei legitimen Transitions** |
| **QA-017** | **P1** | 🆕 | **Treatment-POST 500** |
| QA-018 | P3 | 🆕 (info) | Em-Dash-Render kosmetisch |

**Zählung:**
- ✅ Gefixt: **8** (QA-001, 003, 004, 005, 006, 007, 012, 013)
- ❌ Nicht gefixt: **3** (QA-008, 010, 015)
- ⚠️ Nicht erneut testbar: **4** (QA-002, 009, 011, 014)
- 🆕 Neu in dieser Welle: **2 echte Bugs** (QA-016, 017) + **1 info** (QA-018)

---

## Empfohlene Priorität für die 3. Fix-Welle

**P0/P1 (sofort):**
1. **#QA-017** — Treatment-POST 500 fixen (blockiert die ganze State-Machine ab "treated")
2. **#QA-016** — State-Machine try/catch + Same-State-Idempotenz + accepted/identified-Logik

**P3 (Polish):**
3. **#QA-008** — Demo-Seed um weitere User erweitern (Lisa Schneider, Sarah Keller, etc. aus SETUP.md)
4. **#QA-010** — Compliance-Score Tooltip / Empty-State
5. **#QA-018** — Em-Dash-Glyph statt 3 Striche (optional)

**Nicht für jetzt:**
- #QA-015 (Radix PointerEvent): erst nach axe-core-Run priorisieren

---

## Test-Spur

- Verwendetes Risk: `RSK-041`, ID `46cfee2b-a324-493b-a145-70e2876bb128`
- Aktueller Status: `assessed` (festgenagelt wegen #QA-016/017)
- Inhärent: Likelihood 4, Impact 5 (über generic PUT erfolgreich gesetzt)
- Audit-Log-Events: 11+ (alle korrekt mit `entityType="risk"`)
- Audit-Hash-Chain bleibt healthy

API-Calls in dieser Session: 28
Test-Mutations: 12
500-Errors entdeckt: 7 (alle bei State-Transition oder Treatment-Endpoint)

---

*Generiert von Cowork QA Agent. Falls dritte Welle gewünscht: gleiche Methodik, höchstwahrscheinlich Fokus auf #QA-016/017.*
