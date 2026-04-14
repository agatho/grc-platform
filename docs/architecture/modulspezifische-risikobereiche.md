# Modulspezifische Risikobereiche — Architektur-Entscheidung

## Kontext

Jedes GRC-Modul hat eine eigene, domänenspezifische Risikobewertung die von der jeweiligen Regulatorik/Best Practice vorgegeben wird. Diese Domänen-Risiken müssen ins zentrale ERM-Register aggregiert werden.

## Referenzmodell: ISMS (bereits implementiert)

```
ISMS: Threat × Vulnerability × Asset → IS-Risiko-Szenario → ERM-Sync
```
- Tabelle: `risk_scenario` mit riskId FK → `risk`
- Auto-Sync: Score ≥ 15 → ERM-Register mit risk_source='isms'
- UI: `/isms/risks` mit Inhärent/Residual-Bewertung

## Domänen-Risikobewertungen

### BCMS (ISO 22301 Kap. 8.2.3) — Aufwand: 3-5 SP
**Risikodimensionen:** Disruption-Szenario × Prozess-Kritikalität × Impact über Zeit
**Existiert:** BIA (Impact) + Crisis Scenarios (Severity)
**Fehlt:** Likelihood auf `crisis_scenario` + riskId FK
**Lösung:** ALTER TABLE crisis_scenario ADD likelihood INTEGER, ADD risk_id UUID REFERENCES risk(id)

### DPMS (DSGVO Art. 35) — Aufwand: 3-4 SP
**Risikodimensionen:** Verarbeitungstätigkeit × Datenkategorie × Rechte-Auswirkung
**Existiert:** dpia_risk mit severity/likelihood/impact (String-basiert)
**Fehlt:** Numerische Scores + riskId FK + Aggregationsview
**Lösung:** ALTER TABLE dpia_risk ADD numeric_likelihood INTEGER, ADD risk_id UUID REFERENCES risk(id)

### TPRM (ISO 27036 / LkSG) — Aufwand: 5-8 SP
**Risikodimensionen:** Vendor × Abhängigkeit × Service-Kritikalität (+ LkSG: Menschenrechte × Umwelt)
**Existiert:** vendor_risk_assessment (6 Dimensionen) + lksg_assessment
**Fehlt:** riskId FK + ERM-Bridge + Risiko-Dashboard
**Lösung:** ALTER TABLE vendor_risk_assessment ADD risk_id UUID REFERENCES risk(id)

### ESG (CSRD / ESRS / TCFD) — Aufwand: 4 + 8-13 SP
**Risikodimensionen:** Double Materiality (Impact + Financial) + Klimaszenarien
**Existiert:** materiality_iro mit Impact/Financial Scores
**Fehlt:** riskId FK + ERM-Sync + TCFD Klima-Szenario-Tabelle (neu)
**Lösung:** 
- Phase 1: ALTER TABLE materiality_iro ADD risk_id + ERM-Sync (4 SP)
- Phase 2: Neue climate_risk_scenario Tabelle + UI (8-13 SP)

## Gemeinsame Änderungen

### risk_source Enum erweitern
```sql
ALTER TYPE risk_source ADD VALUE IF NOT EXISTS 'dpms';
ALTER TYPE risk_source ADD VALUE IF NOT EXISTS 'tprm';  
ALTER TYPE risk_source ADD VALUE IF NOT EXISTS 'esg';
```

### ERM-Sync-Pattern (wiederverwendbar)
Jeder Modul-Sync folgt dem gleichen Muster:
1. Domänen-Risiko erstellt/bewertet → Score berechnet
2. Score ≥ Schwelle (konfigurierbar pro Modul) → Auto-Create/Update im ERM
3. `risk.risk_source = 'module_key'` für Herkunftstracking
4. Bidirektional: ERM-Behandlung fließt zurück in Domäne

### Implementierungsreihenfolge
1. TPRM (höchste Lücke)
2. DPMS (niedrigster Aufwand)
3. BCMS (mittel)
4. ESG Klimaszenarien (größter Aufwand)

## Geschätzter Gesamtaufwand: ~25-40 SP
