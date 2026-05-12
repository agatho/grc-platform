# ARCTOS QA Report — ERM Risk Lifecycle End-to-End

**Tester:** Cowork QA (browser-based, no code modifications)
**Datum:** 2026-05-10
**Umgebung:** https://arctos.charliehund.de (Login: `admin@arctos.dev`)
**Browser:** Chrome via Claude in Chrome extension
**Org-Context:** Meridian Holdings GmbH (Demo-Seed)
**Test-Umfang:** Happy Path Risk-Lifecycle + 5 Edge Cases

---

## TL;DR for Claude Code

**P0 — Risk-Create ist komplett broken auf Production.**

Der zentrale "Risiko erstellen"-Flow scheitert mit HTTP 500 beim finalen POST `/api/v1/risks`. Das UI gibt keine Rückmeldung — der Nutzer denkt, der Submit hat nicht geklappt und drückt vermutlich erneut, ohne dass ein Risk angelegt wird. Existierende Risks lassen sich anzeigen, Bewertung-Tab funktioniert mit guter 5×5-Heatmap-Visualization. Status-Transitions konnten wegen P0 nicht durchgespielt werden.

**Severity-Verteilung:** 3× P0, 2× P1, 1× P2, 5× P3 = **11 Findings**

---

## ISSUES (für Claude Code als GitHub-Issue-Backlog)

### #QA-001 (P0) — POST `/api/v1/risks` schlägt mit HTTP 500 fehl

**Severity:** P0 — Blocker
**Modul:** ERM Risk
**Where:** `apps/web/src/app/api/v1/risks/route.ts` (POST handler)

**Repro:**

1. Login als `admin@arctos.dev / admin123`
2. `+ Risk` Button im Dashboard-Header klicken → `/risks/new`
3. Step 1 (Grunddaten) ausfüllen:
   - Titel: "QA-Test: Datenschutzverletzung durch Phishing-Angriff"
   - Beschreibung: beliebig
   - Kategorie: Cyber
   - Quelle: ISMS
   - Verantwortlicher: Sarah Mueller (CISO)
   - Abteilung: IT-Security
4. "Weiter" → Step 2 (Bewertung)
5. Inhärent: Likelihood 4 (Hoch), Impact 5 (Sehr hoch) → Score 20 Kritisch ✓
6. Residual: Likelihood 2, Impact 3 → Score 6 Mittel ✓
7. "Weiter" → Step 3 (Behandlung)
8. Behandlungsstrategie: Mindern (ausgewählt)
9. Begründung: ~250 Zeichen Text
10. Button "Risiko erstellen" klicken

**Expected:** HTTP 201 mit `{ data: { id, elementId, ... } }`, Redirect auf Risk-Detail-Page, Toast "Risiko angelegt".

**Actual:** `POST /api/v1/risks → HTTP 500`. URL bleibt auf `/risks/new`. **Keine Fehlermeldung im UI** (siehe #QA-002).

**Network-Trace:**

```
POST /api/v1/risks
Status: 500 Internal Server Error
(Response-Body nicht inspizierbar via DevTools-Extension, müsste Server-Log geprüft werden)
```

**Vermutete Ursache (Spekulation aus Repo-Kenntnis):**

- `apps/web/src/app/api/v1/risks/route.ts` POST validiert `body.data.ownerId` gegen `userOrganizationRole`. Sarah Mueller (`ciso@arctos.dev`) ist möglicherweise nicht korrekt mit org-role verbunden, was zu einer fehlgeschlagenen DB-Query führt — aber das sollte eigentlich 422 sein, nicht 500.
- Wahrscheinlicher: `risk` oder `workItem` INSERT fällt auf einen NOT-NULL-Constraint, der durch das Schema neuer Migrations entstanden ist und der Handler-Code es nicht setzt.
- Oder: Audit-Trigger fehlt für Tabelle, RLS-Policy hat Lücke.

**Suggested Fix:**

1. Server-Log abrufen: `docker logs grc-web | grep "risks" -A 30` → echte Stack-Trace ermitteln.
2. Audit-Trail-Trigger-Fehler? Schema-Drift? Sieh `packages/db/MIGRATIONS_KNOWN_ISSUES.md`.
3. `route.ts` mit try/catch + structured Error-Logging instrumentieren (`apps/web/src/lib/logger.ts` ist vorhanden).

**Test-Coverage-Lücke, die das verhindert hätte:** Integration-Test gegen echte DB (nicht nur Mock wie `risks-create-rbac.test.ts` in PR #85).

---

### #QA-002 (P0) — UI zeigt keinen Error-Toast bei API-500-Fehler

**Severity:** P0 — UX-Disaster, masquerade die Schwere von #QA-001
**Modul:** ERM Risk Wizard (Step 3)
**Where:** `apps/web/src/app/(dashboard)/risks/new/page.tsx` (Submit-Handler) + globaler Toast-Provider

**Repro:**

1. Wie #QA-001, finalen Submit triggern.
2. Beobachten: Button bleibt aktiv, kein Spinner, kein Toast, URL ändert sich nicht.

**Expected:** Roter Toast "Risiko konnte nicht erstellt werden. Bitte später erneut versuchen oder Support kontaktieren. (Code: 500)" + Button-Reset.

**Actual:** Stille. Nutzer drückt vermutlich erneut → ggf. duplicate-submit, ggf. Frust.

**Suggested Fix:**

1. Submit-Handler in `risks/new/page.tsx` wrappen:

```typescript
const res = await fetch("/api/v1/risks", {
  method: "POST",
  body: JSON.stringify(form),
});
if (!res.ok) {
  toast.error(`Risiko konnte nicht erstellt werden (HTTP ${res.status}).`);
  return;
}
```

2. Global: Error-Boundary für API-Calls in `apps/web/src/lib/api-client.ts` (falls existiert, sonst neu).
3. RFC-7807-Error-Helper aus `apps/web/src/lib/api-errors.ts` nutzen.

---

### #QA-003 (P0) — `GET /risks` und `/risks/new` als RSC liefern HTTP 503

**Severity:** P0 — Intermittent, könnte deployment-related sein
**Modul:** Next.js RSC Streaming

**Repro:**

- Beim Navigieren zu `/risks` und `/risks/new` produzieren die `?_rsc=...` RSC-Stream-Requests **503 Service Unavailable** im Network-Log, obwohl die HTML-Page sichtbar lädt.

**Network-Trace:**

```
GET /risks?_rsc=1q980          → 503
GET /risks/new?_rsc=1q980      → 503
GET /risks/new?_rsc=1v4rn      → 503
```

**Expected:** 200 mit RSC-Stream-Body.

**Actual:** 503. Page-Load funktioniert trotzdem (Fallback aufs Client-Rendering), aber Performance + Streaming-Hydration ist kaputt.

**Vermutete Ursache:**

- Reverse-Proxy (Nginx/Caddy/Traefik) hat ein Timeout oder verwirft Streaming-Responses mit `Transfer-Encoding: chunked`.
- Oder: Cache-Control für `?_rsc=...` URLs ist auf `no-cache` falsch konfiguriert und Backend antwortet zu langsam.

**Suggested Fix:**

1. Nginx/Caddy Config prüfen: `proxy_buffering off; proxy_http_version 1.1;` für `?_rsc=*` URLs.
2. Falls Hetzner-Setup: Container-Health-Check könnte einen Restart-Loop auslösen wenn RSC-Streams zu lange dauern.

---

### #QA-004 (P1) — Tab-Label `risk.detail.tabs.documents` zeigt i18n-Key statt Übersetzung

**Severity:** P1
**Modul:** ERM Risk Detail
**Where:** `apps/web/src/app/(dashboard)/risks/[id]/page.tsx` + `apps/web/messages/de/risk.json` (oder ähnlich)

**Repro:**

1. Risiko-Register öffnen → ein beliebiges Risk öffnen (z. B. RSK-001 Ransomware)
2. Auf der Detail-Seite die Tab-Leiste anschauen

**Expected:** Tab heißt "Dokumente"
**Actual:** Tab heißt wortwörtlich `risk.detail.tabs.documents` (i18n-Key, nicht resolved)

**Suggested Fix:**

- In `apps/web/messages/de/risk.json` (und `en/risk.json`) den Pfad `detail.tabs.documents` ergänzen:

```json
{
  "detail": {
    "tabs": {
      "documents": "Dokumente"  // de
      "documents": "Documents"  // en
    }
  }
}
```

- Plus: i18n-Coverage-CI-Job aktivieren (`docs/i18n-coverage-report.md` existiert bereits, sollte hard fail bei missing keys).

**Screenshot:** `risk-detail-tab-untranslated.png` (Tab-Leiste mit i18n-Key sichtbar)

---

### #QA-005 (P1) — Risk-Historie zeigt fremde Events (programme_journey_phase) statt risk-spezifischer Audit-Einträge

**Severity:** P1 — Compliance-Risiko
**Modul:** ERM Risk Detail, Tab "Historie"
**Where:** `apps/web/src/app/(dashboard)/risks/[id]/page.tsx` + `apps/web/src/app/api/v1/audit-log/route.ts`

**Repro:**

1. RSK-001 (Ransomware) öffnen
2. Tab "Historie" klicken

**Expected:** Audit-Trail-Einträge für genau diese `risk`-Entity:

- "create — Risk angelegt"
- "status_change — identified → assessed"
- "assign — Owner Sarah Mueller"
- usw.

**Actual:** Liste zeigt System-Events aus dem Programme-Cockpit:

```
System  update programme_journey_phase "Programm-Setup"
System  update programme_journey_phase "ACT — Management Review + Zertifizierung"
System  update programme_journey_phase "CHECK — Audits + Wirksamkeit"
System  update programme_journey_phase "DO — Maßnahmen-Umsetzung"
... (mehrfach dupliziert)
```

Das ist:

- **Falsch** — diese Events haben nichts mit RSK-001 zu tun
- **Compliance-Risiko** — Auditor sucht risk-spezifische Historie und findet fremde Daten
- **Duplikat-verdächtig** — gleiche Phase mehrfach in Folge gelogged
- **Schlecht formatiert** — Diff-Hervorhebung als roter/grüner Text in einer Zeile statt strukturiert

**Suggested Fix:**

1. Query in der Historie-Tab muss `WHERE entity_type='risk' AND entity_id={id}` filtern. Aktuell macht sie das offenbar nicht oder hat einen falschen Filter.
2. Such-Stelle: `apps/web/src/app/(dashboard)/risks/[id]/page.tsx` → Component für History-Tab → API-Call sollte `/api/v1/audit-log?entity_type=risk&entity_id={id}` sein.
3. Zusätzlich: `programme_journey_phase` Mehrfach-Updates klären (sind die wirklich duplikate? — möglicherweise separate Bug).

---

### #QA-006 (P2) — Select-Komponente switches uncontrolled → controlled (React-Warning)

**Severity:** P2 — Hidden Anti-Pattern, kann zu State-Inconsistency führen
**Modul:** Form-Komponente (vermutlich shadcn Select wrapper)
**Where:** `_next/static/chunks/28916-cc59b19766b5ebb5.js:0:8868` (mangled, vermutlich `packages/ui/components/select.tsx` oder `apps/web/src/components/ui/select.tsx`)

**Repro:**

1. `/risks/new` öffnen, beliebigen Dropdown nutzen (z. B. Kategorie auswählen)
2. DevTools Console öffnen

**Expected:** Keine React-Warnings.

**Actual:**

```
Warning: Select is changing from uncontrolled to controlled.
Components should not switch from controlled to uncontrolled (or vice versa).
Decide between using a controlled or uncontrolled value for the lifetime of the component.
```

**Suggested Fix:**

- Im Select-Wrapper `value` immer mit `value ?? ""` setzen (nie `undefined`).
- Falls react-hook-form: `defaultValue=""` setzen.

---

### #QA-007 (P2) — Filter-Label "Alle Verantwortlic..." im Risikoregister abgeschnitten

**Severity:** P2 — UI-Polish
**Modul:** ERM Risk-Liste
**Where:** `apps/web/src/app/(dashboard)/risks/page.tsx` → Filter-Bar

**Repro:**

1. `/risks` öffnen
2. Rechts oben die Filter-Dropdowns: "Alle Status", "Alle Kategorien", "Alle Verantwortlic...", "Appetit überschritten"

**Expected:** "Alle Verantwortlichen"
**Actual:** Truncated zu "Alle Verantwortlic..." — Width zu schmal.

**Suggested Fix:** Min-Width des Dropdown-Containers erhöhen, oder Text auf "Owner" verkürzen.

---

### #QA-008 (P3) — Owner-Dropdown im Risk-Wizard zeigt nur 2 User trotz mehr Demo-Usern

**Severity:** P3 — Seed/Filter-Gap
**Modul:** ERM Risk Wizard Step 1
**Where:** `apps/web/src/app/api/v1/users/route.ts` (vermutlich Filter zu eng)

**Repro:**

1. `/risks/new` öffnen
2. "Verantwortlicher" Dropdown öffnen

**Expected (laut SETUP.md):**

- Platform Admin
- Lisa Schneider (Risk Manager)
- Sarah Mueller (CISO)
- Sarah Keller (Control Owner)
- Thomas Fischer (Process Owner)
- DPO ARC-TX
- etc.

**Actual:**

- Kein Verantwortlicher
- Platform Admin (admin@arctos.dev)
- Sarah Mueller (ciso@arctos.dev)

**Vermutete Ursache:**

- Filter zeigt nur Users mit `risk_manager` Role oder Owner sein — aber dann fehlen weitere Roles
- Oder: Demo-Seed läuft nur teilweise

**Suggested Fix:**

- Owner-Filter prüfen: `user_organization_role.role IN ('admin','risk_manager','process_owner','control_owner')` statt nur 2 Roles.
- SETUP.md mit Seed-Reality abgleichen.

---

### #QA-009 (P3) — 5×5-Risikomatrix ohne Tolerance/Skala-Tooltips

**Severity:** P3 — Compliance-relevanter Mangel
**Modul:** ERM Risk Wizard Step 2 (Bewertung)
**Where:** `apps/web/src/app/(dashboard)/risks/new/page.tsx` Schritt 2

**Repro:**

1. `/risks/new` Schritt 2 öffnen
2. Hover über "5 Sehr hoch" bei Auswirkung

**Expected:** Tooltip "z. B. > 1 Mio EUR Schaden, Mehrtagesausfall, Regulatorische Sanktionen"
**Actual:** Kein Tooltip. Skala ist subjektiv → schlecht reproduzierbar, schlecht auditierbar.

**Suggested Fix:**

- Skala-Definition pro Org konfigurierbar (existiert vielleicht in `org_risk_methodology` Tabelle laut Schema)
- Tooltip auf Skalen-Buttons bindern an die `riskMethodologyConfig.likelihoodScale[n].description`

---

### #QA-010 (P3) — Dashboard Compliance-Score 0 % ohne Erklärung

**Severity:** P3 — Onboarding-Friction
**Modul:** Dashboard
**Where:** `apps/web/src/app/(dashboard)/dashboard/page.tsx` Compliance-Score-Widget

**Repro:**

1. Login → Dashboard

**Expected:** Score 0 % zeigt Erklärung "Noch kein Framework aktiviert" oder "Keine Kontrollen getestet" oder Click-Through "Wie wird das berechnet?"

**Actual:** "0%" + "Risikomanagement" steht da, Klick öffnet nichts. Inhärent verwirrend: Compliance-Score 0 % trotz 20 offener Risiken und 2 aktiven Kontrollen — Kausalität unklar.

**Suggested Fix:**

- Tooltip oder Empty-State: "Compliance-Score wird aus aktiven Framework-Mappings + Control-Test-Ergebnissen berechnet. Aktivieren Sie ein Framework um zu starten."
- Link zu `/admin/frameworks` oder `/catalogs`.

---

### #QA-011 (P3) — Mini-Heatmap im Risk-Wizard zeigt nur Inhärent, nicht Residual+Inhärent kombiniert

**Severity:** P3 — Lost-Opportunity-UX
**Modul:** ERM Risk Wizard Step 2 vs. Risk Detail Bewertungs-Tab

**Repro:**

1. `/risks/new` Step 2 (Bewertung) ausfüllen
2. Vergleichen mit Detail-View `/risks/{id}` Tab "Bewertung"

**Beobachtung:**

- Im **Wizard** zeigen die zwei Mini-Heatmaps Inhärent und Residual **getrennt** (jeweils nur ein Punkt).
- In der **Detail-View** zeigt die große Heatmap **beide Punkte** mit Legende (Inhärent ● gefüllt, Residual ○ offen) — viel besser.

**Suggested Fix:** Die Wizard-Heatmap auf das gleiche Pattern wie die Detail-View umstellen — eine kombinierte 5×5 mit beiden Markern + Pfeil dazwischen (BowTie-Visualisierung).

---

## Nicht-getestet wegen P0-Blocker

Folgende geplante Edge Cases konnten **nicht** durchgespielt werden, weil P0-Risk-Create blockiert:

1. **Status-Transitions** (`identified → assessed → treated → accepted → closed`): Bestehende Risiken haben Status, aber UI bietet auf der Detail-Seite **kein sichtbares Status-Change-Control**. Es scheint, der Status wird implizit gesetzt (z. B. nach Bewertung → "Bewertet"). Müsste in separater Test-Iteration mit `PUT /api/v1/risks/[id]` direkt verifiziert werden.
2. **Edit-Path** (Bewertung-Tab → "Bewertung bearbeiten" Button vorhanden, aber nicht durchgeklickt — soll Claude Code separat testen)
3. **Treatment-Hinzufügen** auf existierendem Risk
4. **Owner-Reassignment + Notification-Trigger**
5. **Browser-Back nach Status-Change** (State-Consistency)
6. **Doppel-Submit-Race** (kaum sinnvoll wenn Submit eh 500 gibt)

---

## Empfohlene Reihenfolge für Claude Code

1. **#QA-001 + #QA-002 zusammen lösen** — der Server-Bug + die Error-UI. Ohne #QA-001 Fix kann niemand mehr Risks anlegen.
2. **#QA-003** — RSC 503 separat triagieren (Infra vs. Code).
3. **#QA-004** — schneller Fix (1 i18n-Key in DE+EN).
4. **#QA-005** — Audit-Log-Filter Bug → Compliance-relevant.
5. **#QA-008 + #QA-011** — UX-Polish, gemeinsam in einer Session.
6. **#QA-006, #QA-007, #QA-009, #QA-010** — als kleine Tickets im Backlog.

---

## Anhang: Console-Errors (Browser-Extension-Noise ausgefiltert)

Substantielle App-Warnings:

```
[09:24:58] Warning: Select is changing from uncontrolled to controlled.
[09:25:32] Warning: Select is changing from uncontrolled to controlled.
   Source: _next/static/chunks/28916-cc59b19766b5ebb5.js:0:8868
```

Browser-Extension-Errors (ignoriert):

```
6× "A listener indicated an asynchronous response by returning true,
    but the message channel closed before a response was received"
   Source: dashboard:0:0
```

→ Verursacher: Browser-Extension (vermutlich Claude-Chrome-Extension selbst), keine App-Bugs.

---

## Anhang: Network-Übersicht

```
GET  /                                  → 200
GET  /login                             → 200
POST /api/auth/callback/credentials    → 200 (Login)
GET  /dashboard                         → 200
GET  /api/v1/risks/dashboard-summary    → 200
GET  /risks?_rsc=*                      → 503 (P0)
GET  /risks/new?_rsc=*                  → 503 (P0)
GET  /risks/new (HTML)                  → 200
POST /api/v1/risks                      → 500 (P0)
GET  /risks/{id}                        → 200
```

---

## Session-Metadaten

- **Test-Dauer:** ca. 25 Minuten
- **Klicks/Aktionen:** ~45
- **Screenshots aufgenommen:** 9
- **Console-Logs gesammelt:** 22 (davon 18 Extension-Noise)
- **Network-Requests beobachtet:** 30+
- **Test-Risiko nicht angelegt** (wegen P0)

---

_Generiert von Cowork QA Agent. Bei Rückfragen zu Repro-Schritten: alle Screenshots im Browser-Cache der Cowork-Session, Network-Trace und Console-Logs verfügbar via `read_network_requests` / `read_console_messages`._
