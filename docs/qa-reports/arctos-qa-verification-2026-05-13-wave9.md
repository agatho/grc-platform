# ARCTOS QA Wave-9 Verifikation — 2026-05-13

**Tester:** Cowork QA
**Vorgängerbericht:** `arctos-qa-verification-2026-05-13-wave8.md`
**Fokus:** Hash-Chain Hot-Fix #2 (P0)

---

## TL;DR

**Großer Schritt vorwärts — aber das P0 ist noch nicht endgültig gefixt.**

| Was funktioniert | Was noch nicht |
|---|---|
| ✅ Integrity-Endpoint structured response | ❌ Chain-Mismatches noch da (4 alt + neue) |
| ✅ Hash-Versionierung (v1=1229, v2=6, v0_broken=0) | ❌ Anchor-Trust-Gate fehlt |
| ✅ Repair der V2-Entry-Hashes (rowMismatches=0) | ❌ Chain bricht bei jeder neuen Mutation |
| ✅ Defensive Error-Handling (503 statt 500 empty) | |

**Status: 503 healthy=false** — aber jetzt mit **diagnostischen Daten** statt Empty-Body.

---

## ✅ Was Wave 9 gelöst hat

### 1. Integrity-Endpoint diagnostisch verfügbar

`GET /api/v1/audit-log/integrity` → 503 mit strukturiertem Body:

```json
{
  "data": {
    "scope": "org:ccc4cc1c-...",
    "total": 1235,
    "verified": { "v1": 1229, "v2": 6 },
    "skipped": { "v0_broken": 0 },
    "rowMismatches": [],
    "chainMismatches": [/* 6 entries */],
    "healthy": false
  }
}
```

Genau die Versionierung + Counts, die ich empfohlen hatte. Lobenswert.

### 2. Repair-Migration für die 4 Wave-7-Entries gelaufen

`rowMismatches: []` — die Entry-Hashes der vier ursprünglich broken Entries sind jetzt konsistent mit ihrer V2-Recompute. Migration `0301_*` (oder ähnlich) ist erfolgreich gelaufen.

### 3. V2-Hash-Function ist Entry-stabil

Drei neue Status-Transitions geschrieben → 2 neue V2-Entries → ALLE `rowMismatches: 0`. Die canonical-JSON-Serialisierung (oder was auch immer für die V2-Function gewählt wurde) ist deterministisch. Vorbildlich.

### 4. UI-Banner zeigt Health-Status

`/audit-log` Header sagt "Integritätsprüfung: HTTP 500" (wird nach diesem Fix vermutlich auf "HTTP 503 / Chain-Mismatches: 4" wechseln). Transparenz statt silent-broken.

---

## ❌ Was Wave 9 nicht gelöst hat

### #WAVE7-CRITICAL-01 (P0) — Chain-Mismatches bleiben (und wachsen!)

**Zwei distincte Mismatch-Quellen:**

**Quelle A (alt, aus Wave 7):** 4 chain-mismatches mit Timestamp `2026-05-12 21:45:22.445451+00`. Diese sind die Wave-7-broken-entries — `entry_hash` wurde repariert, aber die **nachfolgenden Entries haben weiterhin den alten `previous_hash` gespeichert**. Die Migration hat nicht **kaskadiert** die Forward-Chain repariert.

**Quelle B (neu, aus Wave 9):** Bei meinen drei Test-Transitions wurden 2 weitere chain-mismatches geschrieben — Timestamp `2026-05-13 05:16:43.260165+00`. Forensik:

```json
[
  {
    "id": "32a7d3c3-...",
    "entityType": "search_index",
    "storedPreviousHash":    "e154b425...c8",
    "expectedPreviousHash":  "b73c3fca...e2"
  },
  {
    "id": "64805300-...",
    "entityType": "risk",
    "storedPreviousHash":    "b73c3fca...e2",  ← = expected_prev des search_index-Eintrags!
    "expectedPreviousHash":  "8093bb64...96"
  }
]
```

**Das ist eine Race-Condition.** Beobachte: `risk.storedPreviousHash == search_index.expectedPreviousHash`. Das heißt:

- Eine einzige PUT-Transition schreibt mehrere audit-entries (work_item, risk, search_index, ggf. mehr)
- Diese werden **mit dem gleichen Timestamp** geschrieben
- Der Verify-Code ordnet sie in einer Reihenfolge an (vermutlich `ORDER BY created_at, id` oder `entity_type`), die NICHT die tatsächliche Write-Reihenfolge ist
- Beim Verify-Walk passt der `previous_hash` der entries deshalb nicht mehr zur erwarteten Reihenfolge

**Wurzelursache-Hypothese:**

Die V2-Hash-Function ist Entry-stabil (`rowMismatches=0`), aber das **Chain-Walk-Ordering ist non-deterministic für Entries mit identischem Timestamp**. Lösung-Optionen:

1. **Sequenz-Spalte:** Spalte `chain_seq BIGSERIAL` einfügen, Walk per `ORDER BY chain_seq ASC`
2. **`previous_hash` mit in Hash einbeziehen:** Bei Recompute des Chain-Walks die tatsächlichen `storedPreviousHash`-Werte respektieren (nicht "expected" basierend auf row-order)
3. **Microsekunden-Präzision in Timestamps:** `created_at TIMESTAMPTZ(6)` mit garantierter Monotonie pro Org

Option 1 ist am robustesten.

### Anchor-Trust-Gate NICHT implementiert

```
POST /api/v1/audit-log/anchor (mit broken chain) → 200 ✅
{
  "merkleRoot": "460a210a8dc1...",
  "leafCount": 198,
  "results": [
    { "provider": "freetsa", "status": "created", "proofStatus": "complete" },
    { "provider": "opentimestamps", ...}
  ]
}
```

🚨 **FreeTSA hat einen Anchor auf einer broken-chain erzeugt.** Das ist die Erweiterung des Compliance-Risikos in den externen TSA-Trust. Mein Wave-9-Vorschlag (Schritt 5: 409 Conflict wenn `healthy=false`) ist **nicht** umgesetzt worden.

---

## Stress-Test-Ergebnis

3 sukzessive Risk-Status-Transitions (`identified → treated → closed → identified`):

| Vor 3 Mutationen | Nach 3 Mutationen |
|---|---|
| `verified.v2: 4, chainMismatches: 4` | `verified.v2: 6, chainMismatches: 6` |

→ Jede neue Mutation, die mehrere Audit-Entries gleichzeitig schreibt, fügt einen Chain-Mismatch hinzu. **Die Chain bleibt nicht stabil unter Last.** Production-Use würde stündlich neue Mismatches anhäufen.

---

## Wave 10 — Empfohlene Next Steps (immer noch nur Hash-Chain)

### Schritt 1: Chain-Sequence-Column einführen

```sql
ALTER TABLE audit_log ADD COLUMN chain_seq BIGSERIAL UNIQUE;
CREATE INDEX idx_audit_log_chain_seq ON audit_log(org_id, chain_seq);
```

Verify-Code walkt jetzt `ORDER BY chain_seq ASC` statt `ORDER BY created_at, id`. Das eliminiert die Race-Condition bei concurrent multi-entity writes innerhalb derselben Transaction.

### Schritt 2: Forward-Chain-Repair für die Wave-7-Entries

Aktuell sind 4 row-hashes neu, aber die `previous_hash` der nachfolgenden Entries zeigt noch auf die alten. Cascade-Repair:

```sql
-- Walk all entries created after the broken window in chain order,
-- recompute their previous_hash from the actual preceding entry's entry_hash
WITH RECURSIVE chain AS (
  SELECT id, entry_hash, ROW_NUMBER() OVER (ORDER BY chain_seq) as rn
  FROM audit_log
  WHERE org_id = $1 AND chain_seq > (SELECT MIN(chain_seq) FROM audit_log WHERE created_at = '2026-05-12 21:45:22.445451+00')
)
UPDATE audit_log a
SET previous_hash = c.entry_hash,
    entry_hash = recompute_v2(a.id, c.entry_hash, ...)
FROM chain c
WHERE a.chain_seq = c.rn + 1;
```

Forward-cascade muss bis ans Chain-Ende laufen. Großes Migration-Window — entweder Wartungsfenster oder DB-Lock.

### Schritt 3: Anchor-Trust-Gate

```ts
const integrity = await computeIntegrity(orgId);
if (!integrity.healthy) {
  return Response.json({
    type: 'https://arctos.charliehund.de/errors/anchor-blocked',
    title: 'Cannot anchor unhealthy chain',
    status: 409,
    detail: `Chain has ${integrity.chainMismatches.length} mismatches. Repair first.`,
    requestId: req.requestId,
  }, { status: 409 });
}
```

Aktuell verschmutzt jeder Anchor-Run den FreeTSA + OpenTimestamps-Trust weiter.

### Schritt 4: Regression-Test

Nach Schritt 1-3:
- Cowork QA schreibt 10 Mutationen über 1 min (Risk-Transitions, BIA-Updates, DPIA-Transitions, Finding-Status-Changes, Asset-Updates)
- `chainMismatches: []` muss konstant bleiben
- `rowMismatches: []` muss konstant bleiben
- Anchor darf erst wieder funktionieren wenn `healthy: true`

---

## Lobenswerte Beobachtungen Wave 9

✅ **Strukturierte Response-Diagnose** — von `500 empty body` zu `503 mit verified/skipped/mismatches`. Operatoren sehen jetzt was los ist.

✅ **Hash-Versionierung sauber umgesetzt** — `v1`, `v2`, `v0_broken`-Counts genau wie empfohlen. Erlaubt zukünftige Hash-Migrations ohne Big-Bang.

✅ **V2 ist Entry-stabil** — `rowMismatches: 0` nach Migration und 3 Test-Mutationen. Die canonical-JSON-Serialisierung funktioniert.

✅ **`expectedPreviousHash` vs `storedPreviousHash` in den Mismatch-Details** — exzellente Forensik, ermöglicht Race-Condition-Diagnose ohne Server-Logs.

---

## Status-Verdict

**P0 zu 70% gefixt:**
- Diagnose: ✅ (war 30% — jetzt 100%)
- Entry-Hash-Stabilität: ✅ (war 0% — jetzt 100%)
- Chain-Forward-Repair: ❌ (immer noch 0%)
- Race-Condition-Free Write: ❌ (war 0% — neue Mutationen brechen Chain)
- Anchor-Trust-Gate: ❌ (war 0% — immer noch 0%)

**Plattform-Stand: Alpha mit teilweise-broken Audit-Verification.** Die Aufzeichnung der Audit-Entries selbst läuft korrekt (Inhalt + Hash). Nur die Chain-Verknüpfung zwischen aufeinanderfolgenden Entries bricht. Compliance-Auditor würde fragen: "Können Sie beweisen, dass kein Entry zwischen X und Y eingefügt wurde?" Aktuell: nein.

Eine weitere Iteration **nur auf Hash-Chain** ist erforderlich. Wave 10 muss die Race-Condition (Chain-Seq) + Forward-Chain-Repair-Migration + Anchor-Trust-Gate liefern.

---

*Wave 9 abgeschlossen. P0 zu 70% gefixt, restliche 30% bei Chain-Forward-Cascade + Anchor-Gate. Cowork QA wartet auf Wave 10.*
