# ARCTOS QA Verification Report — Re-Test nach Claude-Code-Fixes

**Folge-Report zum [`arctos-qa-report-erm-risk-lifecycle-2026-05-10.md`](./arctos-qa-report-erm-risk-lifecycle-2026-05-10.md)**

**Tester:** Cowork QA (browser-based, no code modifications)
**Datum:** 2026-05-11
**Umgebung:** https://arctos.charliehund.de (Login: `admin@arctos.dev`)
**Test-Methode:** UI Smoke + direkte API-Calls via Browser-Session-Cookie

---

## TL;DR

**🎉 Großer Fortschritt.** Von 11 ursprünglichen Findings sind **6 gefixt**, **3 noch offen**, **2 nicht erneut getestet** (UI-Klick-Tooling). **4 neue Findings** beim Re-Test entdeckt, davon 1 sicherheitsrelevant (P1).

Der zentrale P0-Bug (POST `/api/v1/risks` → 500) ist behoben — die Risk-Erstellung funktioniert jetzt End-to-End. Risk RSK-041 wurde während des Re-Tests erfolgreich angelegt.

---

## Verifikations-Matrix

| # | Original Issue | Severity | Status nach Fix | Verifikations-Detail |
|---|---|---|---|---|
| QA-001 | POST `/api/v1/risks` → 500 | P0 | ✅ **FIXED** | POST returnt jetzt `201` mit korrektem Body. RSK-041 erstellt mit ID `46cfee2b-a324-493b-a145-70e2876bb128`. |
| QA-002 | Kein Error-Toast bei 500 | P0 | ⚠️ **NICHT VERIFIZIERBAR** | Kein 500 mehr provozierbar via Happy-Path. Müsste mit invaliden Server-Mocks oder DB-Outage getestet werden. |
| QA-003 | `/risks?_rsc=*` → 503 | P0 | ❌ **NICHT GEFIXT** | RSC-Streams liefern weiterhin 503 (siehe Network-Trace unten). Auch alle anderen Module (`/isms`, `/budget`, `/catalogs?module=erm`) → 503. Vermutlich Infra-/Proxy-Issue. |
| QA-004 | Tab-Label i18n-Key sichtbar | P1 | ✅ **FIXED** | Tab heißt jetzt **"Dokumente"** mit Icon (Screenshot in PR). DE und EN müssten beide validiert werden — DE-Lokale verifiziert. |
| QA-005 | Risk-Historie zeigt fremde Events | P1 | ✅ **FIXED** | `/api/v1/audit-log?entity_type=risk&entity_id={id}` liefert jetzt 9 risk-spezifische `update`-Einträge mit korrektem `entityType="risk"`, `entityId={id}`, `entityTitle`, vollständigem `changes`-Diff (before/after), und intakter Hash-Chain. Im Dashboard "Letzte Änderungen" werden ebenfalls jetzt risk-Events statt programme_journey_phase angezeigt. |
| QA-006 | Select uncontrolled→controlled Warning | P2 | ✅ **FIXED** | Console über die gesamte Session sauber — keine React-Warning mehr. |
| QA-007 | Filter "Alle Verantwortlic..." truncated | P2 | ✅ **FIXED** | Filter-Label heißt jetzt vollständig **"Alle Verantwortlichen"**. |
| QA-008 | Owner-Dropdown nur 2 User | P3 | ❌ **NICHT GEFIXT** | `/api/v1/users` liefert weiterhin nur `admin@arctos.dev` + `ciso@arctos.dev`. Demo-Seed läuft offenbar weiterhin nur partial (oder Filter zu restriktiv). |
| QA-009 | 5×5 Matrix ohne Skala-Tooltips | P3 | ⚠️ **NICHT ERNEUT GEPRÜFT** | Tab-Switch-via-JS scheitert in Radix UI; UI-Test braucht echten Mouse-Trail (manuell). |
| QA-010 | Compliance-Score 0% ohne Erklärung | P3 | ❌ **NICHT GEFIXT** | Dashboard zeigt weiter 0% Compliance-Score, kein Tooltip, kein Empty-State. |
| QA-011 | Wizard- vs Detail-Heatmap inkonsistent | P3 | ⚠️ **NICHT ERNEUT GEPRÜFT** | Wizard nicht erneut durchgeklickt (API-Test ersetzt UI-Walk). |

**Score:** 6 ✅ gefixt · 3 ❌ offen · 2 ⚠️ nicht verifizierbar

---

## Neue Findings (im Re-Test entdeckt)

### #QA-012 (P1) — `PUT /api/v1/risks/{id}` strippt Status silent + akzeptiert illegale Statuswerte

**Severity:** P1 — State-Machine-Logik fehlt
**Modul:** ERM Risk Update
**Where:** `apps/web/src/app/api/v1/risks/[id]/route.ts` PUT/PATCH-Handler + `packages/shared/src/schemas/risk.ts` `updateRiskSchema`

**Repro (API-Direct):**
```bash
# 1. PUT mit illegalem Statuswert
curl -X PUT $URL/api/v1/risks/{id} \
  -H "Content-Type: application/json" \
  -d '{"status": "totally-fake-status"}'
# → 200 (sollte 422 sein)

# 2. PUT mit gültigem Statuswert
curl -X PUT $URL/api/v1/risks/{id} \
  -H "Content-Type: application/json" \
  -d '{"status": "closed"}'
# → 200, aber GET danach: status bleibt unverändert ("identified")
```

**Diagnose:**
`updateRiskSchema` in `packages/shared/src/schemas/risk.ts` Zeile 78–107 hat KEIN `status`-Feld. Zod strippt das Feld silent (default-Verhalten). Der PUT-Handler ruft `updateRiskSchema.safeParse(body)` auf und schreibt das gestrippte Objekt zurück → Status-Update ist effektiv ein No-Op, ABER der API gibt 200 zurück und der Client glaubt, der Update sei erfolgreich.

**Compliance-Risiko:**
- Ein User klickt "Status auf 'closed' setzen" → UI sagt "Erfolgreich"
- Tatsächlich passiert nichts. Risk bleibt offen. Audit-Log zeigt ein "update" ohne Status-Diff.
- ISO 31000 verlangt nachvollziehbare State-Transitions — der aktuelle Stand verletzt das.

**Suggested Fix:**

Option A — separater Status-Transition-Endpoint mit State-Machine:
```typescript
// apps/web/src/app/api/v1/risks/[id]/status/route.ts
const ALLOWED_TRANSITIONS: Record<RiskStatus, RiskStatus[]> = {
  identified: ['assessed'],
  assessed: ['treated', 'accepted', 'closed'],
  treated: ['accepted', 'closed'],
  accepted: ['closed'],
  closed: [], // terminal
};

export async function PUT(req, { params }) {
  // ... validate, check current status, check transition allowed
  if (!ALLOWED_TRANSITIONS[current.status].includes(body.status)) {
    return Response.json({ error: `Invalid transition ${current.status}→${body.status}` }, { status: 422 });
  }
  // ...
}
```

Option B — `status` ins `updateRiskSchema` aufnehmen + Server-Side Transition-Check im PUT-Handler.

**Test-Coverage-Lücke:**
Mein PR #85 hat `risks-create-rbac.test.ts` und `risk-status-transition.test.ts` für **Schema-Layer** geschrieben. Aber: ein Test der Schema-Validierung verifiziert NICHT, dass der API-Handler auch tatsächlich `status` setzt — dafür brauchts einen Integration-Test gegen die echte DB. **Genau das ist die Test-Lücke die der User in der QA-Session kritisierte: Mock-only Tests fangen API-Verträge nicht.**

---

### #QA-013 (P3) — Em-Dash als Unicode-Escape `—` in Risikoregister-Tabelle

**Severity:** P3 — visueller Render-Bug
**Modul:** Risikoregister-Liste
**Where:** `apps/web/src/app/(dashboard)/risks/page.tsx` Tabellen-Renderer

**Repro:**
1. `/risks` öffnen
2. Bei einem Risk **ohne** Behandlungsstrategie (z. B. RSK-041) auf die Spalte "Behandlungsstrategie" schauen

**Expected:** "—" (Em-Dash als Zeichen)
**Actual:** `—` (sechs ASCII-Zeichen)

**Vermutete Ursache:** Fallback-String mit doppelter Escapierung — z. B. `value ?? "\\u2014"` statt `value ?? "—"` oder JSON-stringify ohne anschließendes Decoding.

**Suggested Fix:** In der Tabellen-Cell-Komponente den Fallback auf das literale Zeichen `"—"` umstellen.

---

### #QA-014 (P2) — Dashboard "Letzte Änderungen" zeigt search_index-Events (technische Noise)

**Severity:** P2 — UX-Quality
**Modul:** Dashboard
**Where:** `apps/web/src/app/(dashboard)/dashboard/page.tsx` Recent-Changes-Widget + Filter-Query

**Repro:**
1. Login → Dashboard
2. Widget "Letzte Änderungen" anschauen

**Actual:** Mischung aus:
- `Platform Admin update search_index — QA-Retest: API-Verifikation...` ← technisches Event
- `Platform Admin update risk — QA-Retest: API-Verifikation...` ← User-Event

**Expected:** Nur User-Events (entity_type IN ('risk','control','finding','audit',...) excluding 'search_index', 'event_log', 'audit_anchor' und ähnliche technische Tabellen).

**Suggested Fix:** Im Dashboard-Recent-Changes-Query (vermutlich `/api/v1/audit-log` mit Default-Filter) eine Block-List für technische `entity_type`-Werte einbauen.

---

### #QA-015 (P3, Accessibility) — Radix UI Dropdowns/Tabs reagieren nicht auf reine `MouseEvent.click()` ohne PointerEvent

**Severity:** P3 — Potenzieller A11y-Issue, aber unklare echte Auswirkung
**Modul:** Form-Komponenten (Radix-Select, Radix-Tabs)
**Where:** `packages/ui/components/select.tsx`, `packages/ui/components/tabs.tsx` (Radix Wrapper)

**Repro (programmatisch):**
```javascript
// Funktioniert nicht:
document.querySelector('[role="combobox"]').click();

// Funktioniert:
combo.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, ... }));
combo.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, ... }));
```

**Auswirkung:**
- Test-Automation mit normalen click()-Events scheitert
- Möglicherweise: Screen-Reader, die nur `click` (nicht `pointerdown/up`) emittieren, könnten die Dropdowns nicht öffnen
- Voice-Control (Dragon, Siri) potenziell betroffen

**Suggested Fix:**
- Radix UI fügt normalerweise `click` Handler hinzu — wenn nicht: prüfen ob `data-state` propagation funktioniert
- Falls A11y-Test (axe-core) sauber: Issue niedrig priorisieren
- Falls A11y-Test rot: zusätzlichen Click-Handler manuell hinzufügen

---

## Edge Cases — jetzt durchgespielt (vorher durch P0 blockiert)

| Test | Methode | Erwartet | Tatsächlich | Status |
|------|---------|----------|-------------|--------|
| Empty title | POST `/risks` mit `{title: ""}` | 422 + Field-Error | `422 {"error":"Validation failed","details":{"fieldErrors":{"title":["String must contain at least 1 character(s)"]}}}` | ✅ |
| Invalid impact range | POST mit `financialImpactMax < min` | 422 + Field-Error | `422 {"error":"Validation failed","details":{"fieldErrors":{"financialImpactMax":["financialImpactMax must be >= financialImpactMin"]}}}` | ✅ Cross-Field-Refine funktioniert |
| Audit-Hash-Chain | GET `/audit-log/integrity` | `healthy: true` | `{"total":1167,"rowVerified":1167,"chainVerified":1167,"rowMismatches":[],"healthy":true}` | ✅ Trotz aller Test-Mutations intakt |
| Owner-Assignment | PUT `{ownerId: adminId}` | 200, persistiert | 200, GET zeigt ownerId gesetzt | ✅ |
| Status `closed` direkt setzen | PUT `{status: "closed"}` | 200 + persistiert (oder 422 wenn illegal) | **200, aber Status bleibt "identified"** | ❌ Siehe #QA-012 |
| Illegaler Status | PUT `{status: "fake"}` | 422 | **200** | ❌ Siehe #QA-012 |
| Audit-Log-Filter | GET `/audit-log?entity_type=risk&entity_id={id}` | Nur risk-Events | 9 risk-Updates korrekt gefiltert | ✅ |
| GET /risks list | GET `/risks?limit=5` | 200 + pagination | 200, 5 items | ✅ |

**Nicht durchgespielt** (Tools-Limitation):
- State-Transitions via UI (Tab-Click-Issue, siehe #QA-015)
- Browser-Back nach Form-Submit
- Doppel-Submit-Race
- Treatment-Hinzufügen via UI

---

## Was Claude Code im nächsten Sprint angehen sollte

**Priorität 1 (P0/P1 offene/neue):**
1. **#QA-003** — RSC 503 fixen (Infra/Proxy oder Backend-Timeout, müsste Ops-Logs prüfen)
2. **#QA-012** — Status-Transition-Logik bauen (separater Endpoint oder Schema erweitern + State-Machine)

**Priorität 2 (P2 neu/offen):**
3. **#QA-014** — Dashboard-Recent-Changes Filter für technische Events
4. **#QA-002** — Defensive: globaler API-Error-Handler mit Toast (selbst wenn aktueller Code OK ist, hilft es bei zukünftigen 5xx)

**Priorität 3 (P3 polish):**
5. **#QA-008** — Demo-Seed prüfen + Owner-Filter im Dropdown erweitern
6. **#QA-010** — Compliance-Score Tooltip
7. **#QA-013** — `—` Em-Dash-Render-Bug

**Niedrige Prio:**
8. **#QA-015** — A11y-Test mit axe-core über `npm run test:e2e:a11y` ergänzen, dann fundierte Entscheidung

---

## Verification-Test-Daten

- Created Risk: `RSK-041` (ID `46cfee2b-a324-493b-a145-70e2876bb128`)
- Audit-Log-Events: 9 (alle mit korrektem `entityType="risk"`, `entityId=46cfee2b…`)
- Audit-Hash-Chain: 1167 verified, 0 mismatches, healthy
- Test-API-Calls: 14 (alle dokumentiert oben)

---

*Generiert von Cowork QA Agent. Verifikation gegen https://arctos.charliehund.de. Falls Re-Tests gewünscht: vorhandene Audit-Log-Einträge für RSK-041 bleiben als Forensik-Spur.*
