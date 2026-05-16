# ARCTOS QA Wave-22 Hotfix-Verifikation — 2026-05-15

**Tester:** Cowork QA
**Fokus:** Verbleibende Wave-21-Restpunkte + Beta-Blocker-Re-Test (vierter Versuch)
**Methodik:** Live-API mit Multi-Role + Hash-Chain regression

---

## TL;DR

**3 weitere Items gefixt: ESG-Datapoints-Seed, Bulk-Risks-INSERT, Multi-Tenant-RLS-Cross-Tenant.** ABER: Die zwei Beta-Blocker (A1 Finding-FKs, A2 /admin/branding) bleiben offen — **zum vierten Mal in Folge**. Eine neue Regression: C3 Contract `name`-Field gibt jetzt 500 statt 422.

| Item                      | Marathon | W18 | W19+20 | W21 |         **W22**          |
| ------------------------- | :------: | :-: | :----: | :-: | :----------------------: |
| A1 Finding controlId      |    🔴    | 🔴  |   🔴   | 🔴  |          **🔴**          |
| A2 /admin/branding        |    🔴    | 🔴  |   🔴   | 🔴  |          **🔴**          |
| B2 ESG-Datapoints         |    🟡    | 🟡  |   🔴   | 🔴  |     **✅** (65 seed)     |
| B4 Bulk Risks INSERT      |    —     |  —  |   —    | 🔴  |          **✅**          |
| B6 Programmes (Maturity)  |    —     |  —  |   —    | 🔴  | **🟡** (module-info nur) |
| B7 Multi-Tenant RLS       |    —     |  —  |   🟡   | 🟡  |          **✅**          |
| C3 Contract `name` Compat |    —     |  —  |   —    | 🔴  |   **🔴** (jetzt 500!)    |

Hash-Chain: **healthy v1=1229, v2=513, total=1742, 0 mismatches.**

---

## ✅ Was Wave 22 GEFIXT hat

### B2 — ESG-Datapoints Seed ✅

```
GET /api/v1/esg/datapoints?limit=10 → 200
{ total: 65, datapoints: [<65 ESRS-Datapoints>] }
```

**65 ESG-Datapoints geseedet.** Weniger als die ~1.144 ESRS-Original-Datapoints (Wave-21-Prompt empfahl ≥100), aber funktional. ESG-Manager kann jetzt `POST /esg/metrics` mit gültiger `datapointId` ausführen.

### B4 — Bulk-Risks INSERT ✅

```
POST /api/v1/risks/bulk { items: [2 valid risks] } → 201 ✅
```

Wave-21-Befund **W21-B4-BulkInsertFails** (SQL-Error mit `type_key:'single_risk'`) ist gefixt. Bulk-Endpoint operational, Cap (max 100) bleibt aktiv aus Wave 21.

### B7 — Multi-Tenant RLS Cross-Tenant ✅

```
Login als ciso@arctistx.test (zweite Org) → 200 ✅
GET /risks/<known-Meridian-risk-id> als arctistx-user → 404 ✅
```

**Cross-Tenant-Read-Attempt wird mit 404 geblockt.** Zweite-Org-User sind geseedet (`ciso@arctistx.test` mit Passwort `WaveQA-2026!`). RLS-Isolation greift wie spezifiziert.

→ Wave-21-Lücke W21-B7-NoSecondOrgUsers ist gefixt. Multi-Mandanten-Compliance praktisch verifizierbar.

---

## 🔴 Was Wave 22 NICHT GEFIXT hat

### A1 — Finding `controlId/auditId/riskId` Persistenz 🔴 VIERTES MAL OFFEN

```
POST /findings {
  title: 'W22 A1 …',
  severity: 'major_nonconformity',
  source: 'audit',
  controlId: <valid-uuid>,
  auditId: <valid-uuid>,
  riskId: <valid-uuid>,
  description: 'Wave 22 verify'
} → 201, id 35ead49a-3264-435f-a7cd-dc5adfbf40f4

GET /findings/35ead49a-… → {
  controlId: null,
  auditId: null,
  riskId: null,
  status: 'identified',
  ...
}
```

**Identisch zu Marathon, Wave 18, Wave 19+20, Wave 21.** Status-Strict-Reject IST deployed, aber die FK-Persistenz im SELBEN Route-Handler weiter nicht. Cross-Module-Cascade bleibt für API-erstelle Findings unwirksam.

**Mein Wave-21-Verdacht (Deploy-Pipeline-Issue oder Schema-Drift) ist NICHT adressiert.**

### A2 — `/admin/branding` 500 🔴 VIERTES MAL OFFEN

```
GET /admin/branding → 500
{
  detail: "An unexpected error occurred. The full error has been logged server-side; include the requestId when reporting.",
  requestId: "24a45b827c4f2e4d",
  title: "Internal server error",
  type: "https://arctos.charliehund.de/errors/internal"
}
```

Verbesserung: Response ist jetzt RFC-7807-konform statt nur "Internal server error". Aber Status ist weiterhin 500.

**Mit RequestID `24a45b827c4f2e4d` kann Claude Code den Server-Log direkt einsehen und den Crash debuggen.**

### C3 — Contract Backwards-Compat 🔴 REGRESSION

```
POST /contracts {name: 'W22 Test', ...} → 500 (war 422 in Wave 21, jetzt 500!)
Response body: empty
Warning header: null
```

**Wave 22 hat C3 gebrochen.** Statt strict-422 zurückzuweisen, crasht der Handler jetzt mit 500 und leerem Body. Vermutlich wurde der Backwards-Compat-Layer halb implementiert (alte `name`-Erkennung versucht, scheitert), und der Catch-Handler greift den Fehler nicht ab.

→ **Neue P1-Regression: W22-C3-ContractNameCrash**

### B6 — Programmes Maturity-Compute 🟡 ENDPOINT-INFO STATT DATEN

```
GET /api/v1/programmes → 200
{
  data: {
    module: "...",
    description: "...",
    endpoints: [...],
    requestId: "..."
  }
}
```

`/programmes` ist ein **Module-Info-Endpoint**, kein List-Endpoint. Programmes wird über Sub-Pfade verwaltet (`/programmes/journeys`, `/programmes/{id}/...`).

```
GET /api/v1/programmes/journeys → 200 (empty body)
```

→ Kein Demo-Seed für Programme-Journeys + Maturity-Compute bleibt nicht testbar. Wave-21-Prompt-Erwartung war strukturell falsch (kein flacher `/programmes` Resource).

---

## Hash-Chain Final

```
healthy: true
v1: 1229 (unverändert seit Wave 7 — 15 Wellen Genesis-stabil)
v2: 513 (+36 durch Wave-22-Test-Mutationen)
total: 1742
chainMismatches: 0
rowMismatches: 0
```

---

## Bilanz nach 22 Wellen

| Severity          | Anzahl Open vor Marathon |                     Open nach Wave 22 |
| ----------------- | -----------------------: | ------------------------------------: |
| P0 (Beta-Blocker) |                        0 | **2** (A1, A2 — vier Wellen ohne Fix) |
| P1                |                        0 |     2 (B6 keine Daten, C3 Regression) |
| P2                |                    viele |                         sinkt langsam |

**Plattform-Stand:** Fundament ist 90 % production-stabil. Aber:

1. **A1 ist die kritische Daten-Integritäts-Lücke** — ohne Cross-Module-FK-Persistenz funktionieren weder Cascade-Aggregationen noch Audit-Trail-Verkettung für API-erstellte Findings. Das blockt jeden Pilot mit echten Cross-Modul-Workflows.
2. **A2 ist niedriges Risiko**, aber 500 in produktivem Code ist nie OK.

---

## Empfehlung für Wave 23 (Final HotFix vor Pilot)

### P0 — Vier-Wellen-Persistenz-Bug schließen

**Theorie:** Code im Repo sieht korrekt aus, Live-Server-Behavior widerspricht. Hypothesen:

1. **Build-Cache-Issue:** Wave-21-22-Commits enthalten den Fix, aber Build-Artefakt verwendet eine ältere Version. → Build-Cache invalidieren, fresh `pnpm build`.
2. **Drizzle-ORM-Layer:** `body.data.controlId` kommt korrekt durch Zod, wird aber von Drizzle's `.values({...})` ignoriert. Verdacht: TS-Type-Mismatch der bei lockerer compile-time-check durchgeht. → Drizzle-Insert vor dem `.returning()` mit `console.log(values)` instrumentieren.
3. **Migration nicht in prod gelaufen:** `\d finding` in prod-PG zeigt evtl. keine `control_id`-Spalte (würde aber zu SQL-Error führen, nicht silent null — wahrscheinlich nicht das Problem).
4. **Trigger oder default-Logik:** Ein Insert-Trigger setzt `control_id` aktiv auf NULL.

**Vorgehen:**

- `prisma db pull` oder `drizzle introspect` gegen Prod-DB, mit lokalem Schema vergleichen
- Drizzle-Query-Log aktivieren (`DEBUG=drizzle*` im Server-Env)
- Test-Endpoint `/api/v1/_debug/finding-insert?controlId=X` der einen INSERT direkt ausführt und das executed SQL zurückgibt

### P1

- **A2 /admin/branding:** RequestID `24a45b827c4f2e4d` zum Debugging. Wahrscheinlich `select … from organization_branding` ohne Default-Row → undefined Crash.
- **C3 Contract `name`-Crash-Regression:** Try/catch um den Backwards-Compat-Code, Fallback auf 422.

### P2

- **B6 Programmes Demo-Journeys** seeden, Maturity-Compute-Test
- **B2 ESG** Datapoint-Anzahl von 65 auf ≥ 500 erweitern (vollständige ESRS-Coverage)

---

## Verdict

**Cowork QA empfiehlt:** Wave 23 muss explizit Build-/Deploy-Pipeline auditieren. Vier Iterationen mit selbem Verhalten weisen auf Infrastruktur-Issue, nicht Code-Issue hin.

**Hash-Chain weiter healthy** — die fundamentale Architektur trägt. Aber die zwei spezifischen Code-Pfade A1+A2 müssen vor dem ersten Pilot endlich live-funktional sein.

Geschätzte Restarbeit für Pilot-Ready: **2 P0 + 2 P1 = 4 fokussierte Fixes.** Mit Deploy-Pipeline-Audit eventuell 1-2 Tage.

---

_Wave 22 Hotfix-Verifikation abgeschlossen 2026-05-15. 3 neue grüne Items (B2, B4, B7), 2 Beta-Blocker weiter offen, 1 neue Regression (C3). Hash-Chain healthy._
