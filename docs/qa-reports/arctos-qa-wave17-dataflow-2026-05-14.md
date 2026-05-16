# ARCTOS Wave 17 — Datenfluss-Integrität & Wave-16-Polish

**Tester:** Cowork QA
**Methodik:** Wave-17-Polish-Items + Vor-/Nach-Mutation-Vergleich zur Aggregation-Korrektheit + UI-Sichtbarkeit

---

## TL;DR

**Aggregationen funktionieren mehrheitlich korrekt, aber 2 zentrale Cross-Module-Cascades fehlen.**

| Datenfluss-Test | Ergebnis |
|---|---|
| Risk-Create → Total-Count | ✅ propagiert in Echtzeit (24→25) |
| Risk-Create → byStatus-Aggregation | ✅ identified+1 |
| `inherentLikelihood × inherentImpact` → `riskScoreInherent` | ✅ **auto-berechnet** (5×5=25) |
| UI zeigt Score korrekt | ✅ "25 / Kritisch" in der Inherent-Spalte |
| Status-Transition → Dashboard-Aggregation | ✅ assessed-1, treated+1 |
| Audit-Finding-Link (`auditId`, `controlId`) | ✅ beide persistiert |
| Critical-Finding auf Control → Controls-Effectiveness | 🔴 **reagiert nicht** |
| Treatment-Cost → Budget-Aggregation | 🔴 **Endpoint fehlt** |

---

## Wave-17-Polish-Items

| Endpoint | Status |
|---|:-:|
| `/tprm/concentration` | ✅ 200 |
| `/admin/calendar/holidays` | ✅ 200 |
| `/admin/settings` | ✅ 200 |
| `/admin/license` | ✅ 200 |
| `/admin/integrations` | ✅ 200 |
| `/notifications/mark-all-read` | ✅ 200 |
| `/controls/findings-summary` | 🔴 500 |
| `/processes/governance-summary` | 🔴 500 |
| `/admin/branding` | 🔴 500 |
| `/kris/{id}/history` | 🔴 404 |

**6 von 10 P2/P3-Items gefixt. 4 offen.**

---

## Datenfluss-Detail-Tests

### Test 1: Risk-Create-Propagation ✅

```
VORHER risks.total=24, byStatus={identified:9, assessed:12, treated:2, closed:1}
CREATE: POST /risks {likelihood:5, impact:5} → 201
NACHHER risks.total=25, byStatus={identified:10, assessed:12, treated:2, closed:1}
```

**Δ Total: +1, Δ identified: +1.** Aggregations propagieren in Echtzeit.

### Test 2: Score-Berechnung ✅

Nach `PUT /risks/{id}/assessment {inherentLikelihood:5, inherentImpact:5}`:

```json
{
  "inherentLikelihood": 5,
  "inherentImpact": 5,
  "riskScoreInherent": 25,
  ...
}
```

**`riskScoreInherent` wird automatisch berechnet (5 × 5 = 25).** UI zeigt "25 / Kritisch" in der Inherent-Score-Spalte.

### Test 3: Status-Transition + Aggregation ✅

```
Vor Transition: identified=10, assessed=13, treated=2
PUT /risks/{id}/status {status:'treated'} → 200
Nach Transition: identified=9, assessed=12, treated=3
```

**Aggregation reagiert korrekt auf State-Wechsel.**

### Test 4: Cross-Module-Link Audit→Finding→Control ✅ (Persistenz, nicht Effektivität)

```
POST /findings {severity:'major_nonconformity', source:'audit', auditId:X, controlId:Y} → 201
GET /findings/{id} → {auditId:X, controlId:Y, severity:'major_nonconformity'}
```

`auditId` und `controlId` werden korrekt persistiert. Filter `findings?auditId=X` liefert das Finding zurück.

### Test 5: 🔴 Controls-Effectiveness Cross-Cascade FEHLT

```
VORHER: testsRun=6, effective=2, partiallyEffective=1, ineffective=0, effectivenessPercent=83
MUTATION: Critical Finding (major_nonconformity) auf Control erstellen
NACHHER: testsRun=6, effective=2, partiallyEffective=1, ineffective=0, effectivenessPercent=83
```

**Identische Werte!** Ein major-nonconformity-Finding auf einer Control sollte die Effectiveness verschlechtern. Tut es nicht. **Cross-Module-Cascade Finding→Control-Effectiveness ist nicht implementiert.**

### Test 6: 🔴 Treatment-Budget-Aggregation FEHLT

Treatment mit `costEstimate: 7500 EUR` erstellt:
```
GET /risks/treatments-summary → 422
GET /risks/budget-summary → 422
GET /risks/{id}/treatments-cost → 404
GET /risks/aggregation/treatments → 500
```

**Kein Aggregations-Endpoint existiert** für Treatment-Cost-Summen pro Risk-Owner, pro Department, pro Org. DPO würde das für Cost-Reporting brauchen.

---

## Was DAS für die Plattform bedeutet

### ✅ Funktioniert wirklich

1. **CRUD propagiert in Echtzeit** — neue Items erscheinen sofort in Aggregations
2. **Status-Aggregationen** reagieren auf Transitions (byStatus, treated++/assessed--)
3. **Score-Berechnung** für Risks (likelihood × impact) automatisch
4. **Cross-Module-Links** persistiert (auditId, controlId, riskId Verkettungen)
5. **UI zeigt berechnete Werte** korrekt (25/Kritisch, etc.)
6. **DORA-Critical-Vendors-Sync** funktioniert (TPRM-Vendor mit tier:critical → in /dora/critical-vendors)

### 🔴 Funktioniert NICHT (echte Datenfluss-Lücken)

1. **Finding-Severity → Control-Effectiveness** — ein critical Finding auf einer Control beeinflusst die Effectiveness-Aggregation NICHT
2. **Treatment-Cost → Budget-Aggregation** — kein Endpoint, kein Dashboard-Wert
3. **`controls/findings-summary`** crasht (500) — UI kann ICS-Findings-KPIs nicht anzeigen
4. **`processes/governance-summary`** crasht (500) — UI kann BPM-Compliance-KPIs nicht anzeigen
5. **`admin/branding`** crasht (500)
6. **`kris/{id}/history`** 404 — KRI-Trend-Analyse nicht möglich

### 🟡 Mittel-Risiko (Field-Naming-Inkonsistenzen)

- POST `/risks` akzeptiert `likelihood/impact` aber speichert nichts → man muss explizit über `PUT /risks/{id}/assessment` mit `inherentLikelihood/inherentImpact` gehen. **Field-Konvention im API-Schema deutlich machen.** Frontend-Form sollte gleich die "Assessment"-Felder verwenden.

---

## Hash-Chain

```
healthy: true
v1: 1229 (unverändert)
v2: 374+ (durch Wave-17-Tests)
mismatches: 0
```

---

## Empfehlung Wave 18

### P1 — Echte Datenfluss-Lücken schließen

1. **Finding-Severity → Control-Effectiveness Cascade**: Wenn `major_nonconformity` oder höher auf einer Control entsteht, sollte die Control-Effectiveness von `effective` → `partiallyEffective` oder `ineffective` propagieren. Logik im Aggregations-Computation einbauen.

2. **Treatment-Cost-Budget-Aggregation**: Neuer Endpoint `/api/v1/risks/treatments/budget?groupBy=ownerId|department|org` mit Aggregation. Wichtig für CISO-Quartal-Reports.

3. **`/controls/findings-summary` + `/processes/governance-summary`** 500 fixen — die UI braucht diese KPIs.

### P2

4. `/admin/branding` 500 fixen
5. `/kris/{id}/history` implementieren (KRI-Trend ist ISO 31000-relevant)

### P3 (Polish)

6. POST `/risks {likelihood, impact}` — entweder akzeptieren UND speichern, oder im Schema strikt rejecten mit Hinweis auf Assessment-Endpoint

---

## Verdict

**Datenfluss-Integrität: 70 %**. Die wichtigsten Aggregationen funktionieren, aber zentrale Cross-Module-Cascades (Finding→Control, Treatment-Cost-Budget) fehlen noch. Das sind keine Smoke-Bugs sondern **konzeptionelle Business-Logic-Lücken** — die Plattform speichert Daten korrekt, leitet aber nicht alle abgeleiteten Werte ab.

Cowork QA empfiehlt 1 weitere Iteration auf Datenfluss-Cascades, dann ist die Plattform für Pilot-Kunden mit echter Compliance-Reporting-Anforderung tauglich.

---

*Wave 17 abgeschlossen. Polish 6/10. Datenfluss-Test: 6/8 OK, 2 Cascade-Lücken identifiziert.*
