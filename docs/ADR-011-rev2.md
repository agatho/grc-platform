# ADR-011 rev.2 — Per-Tenant Audit Chain + Hierarchy-Aware Access

| **ADR-ID**  | **011** |
|-------------|---------|
| **Title**   | **Audit Trail Architecture — rev.2 (per-tenant chain, hierarchy-aware reads)** |
| **Status**  | **Accepted** |
| **Date**    | 2026-04-20 |
| **Supersedes** | ADR-011 rev.1 (global hash chain) |
| **Context** | GDPR Art. 5, ISO 27001 A.12.4, A.9.4; DORA Art. 28; HinSchG; Stakeholder-Analyse 2026-04-20 |

## Context

Rev.1 spezifizierte eine **globale Hash-Chain** über die gesamte `audit_log`-Tabelle, ohne Rücksicht auf Mandanten-Grenzen. Die Integrity-Check-Implementation (`/api/v1/audit-log/integrity`) stellte am 2026-04-20 fest: **4756 von 5008 Rows haben gebrochene Chain-Links** bei intakten Row-Hashes.

Root Cause: `audit_trigger()` liest den `previous_hash` in READ-COMMITTED-Isolation. Bei parallelen Transaktionen sehen beide dasselbe "letzte committed" und berechnen beide einen `entry_hash`, der auf demselben `previous_hash` basiert. Eine Row wird dadurch zur Waise der Chain. Das ist bereits im Demo-Seed eingetreten.

Die naive Lösung (advisory_xact_lock über die gesamte Tabelle) wurde verworfen, weil sie tenant-übergreifend serialisiert ohne fachlichen Grund — und weil sie das **tiefere konzeptionelle Problem** nicht adressiert: Eine globale Chain über mehrere Mandanten ist semantisch falsch.

## Stakeholder Analysis

| # | Stakeholder | Primary Need |
|---|-------------|--------------|
| 1 | Platform-Vendor (wir) | Nachweis, dass wir selbst nicht manipulieren können (ohne externen Anchor nicht möglich) |
| 2 | Customer (Tenant-Admin) | Eigene Org-Daten forensisch nachprüfbar |
| 3 | Customer (interner Revisor) | Read-only Vollzugriff auf eigene Org |
| 4 | Externer Auditor (ISO, ISAE) | Scope- und zeitbegrenzter Read-Zugriff auf eigene Org |
| 5 | Corporate-Parent-Admin | Aggregierter Read-Zugriff auf alle Child-Orgs in direkter Hierarchie |
| 6 | Aufsichtsbehörde (BaFin, DSB, BSI) | Scope-begrenzter Zugriff auf Anfrage, **selbst wieder audit-gelogt** |
| 7 | DPO | GDPR-Art.-15-Auskunft inkl. Audit-Log-Einträge zur Person |
| 8 | Whistleblowing-Officer | **Kryptographisch isolierter** Trail — nicht einmal Admin darf sehen, dass Fall existiert |
| 9 | Gericht / Strafverfolgung | Legal Hold, Chain-of-Custody-konformer Export |
| 10 | Archiv (post-contract) | Read-only Retention für HGB/§147-AO-Fristen |

## Decision

Vier architektonische Entscheidungen:

### D1. **Per-Tenant Hash Chain** (ersetzt globale Chain)

Der `previous_hash` jeder Audit-Log-Row bezieht sich auf den `entry_hash` der vorherigen Row **derselben Organisation**. Die Chain ist pro `org_id` self-contained.

```sql
-- audit_trigger() rev.2:
SELECT entry_hash INTO v_prev_hash
FROM audit_log
WHERE org_id = v_org_id
ORDER BY created_at DESC, id DESC
LIMIT 1;

PERFORM pg_advisory_xact_lock(hashtext('audit_log_chain:' || v_org_id::text));
```

**Vorteile:**
- Parallele Inserts über Tenants hinweg sind unkorrelliert — kein Cross-Tenant-Bottleneck
- Jeder Tenant-Export ist self-contained verifizierbar (forensisch sauber für externe Auditoren)
- Cross-Tenant-Leak-Risiko fällt weg — das Integrity-Endpoint wird stark vereinfacht

**Nachteil:**
- Rows ohne `org_id` (z.B. platform-level Events) brauchen eigene Chain unter `NULL`-Bucket oder werden in `platform_audit_log` separiert. **Entscheidung:** Platform-Events kommen in eigene Tabelle — sind semantisch sowieso unterschiedlich.

### D2. **Hierarchy-aware Read-API** (Corporate-Hierarchy)

Die Read-API `/api/v1/audit-log` filtert standardmäßig auf `ctx.orgId`, bietet aber einen optionalen `includeDescendants=true`-Parameter. Dieser Parameter ist **nur für Rollen mit Parent-Hierarchy-Recht** verfügbar — geprüft über `organization.parent_org_id`-Kette.

```typescript
// Scope-Auflösung:
// 1. ctx.orgId (eigene Org)
// 2. +includeDescendants => alle Orgs, deren parent_org_id ancestor-chain auf ctx.orgId zeigt
// 3. Whistleblowing-Audit-Log ist NIEMALS im Ergebnis, auch nicht für parent
```

**Corporate-Parent sieht**: Metadaten aller Child-Orgs (entity_type, action, created_at, user_name) — aber **nicht** `changes`-Payload, sofern nicht explizit freigegeben (`org_audit_sharing` Join-Tabelle, Phase 2).

### D3. **Whistleblowing als separate isolierte Chain**

Whistleblowing-bezogene Events (`case_created`, `case_accessed`, `case_updated`) landen **nicht** im `audit_log`, sondern in einer separaten Tabelle `whistleblowing_audit_log` mit eigenen Properties:

- Eigener Trigger `whistleblowing_audit_trigger()` auf den wb-Tabellen
- Eigene Chain, eigener Lock-Scope
- RLS-Policy: nur `whistleblowing_officer` und `ombudsperson` haben Read-Access
- Platform-Admin hat keinen Direktzugriff (auch nicht nach Court-Order direkt — nur über dual-control Prozess)

Rationale: HinSchG §8 schützt Whistleblower-Identität. Wenn ein normaler Org-Admin im regulären Audit-Log sähe „user X hat Whistleblowing-Case Y aufgerufen", wäre die Identität des Whistleblowers (oder seines Vertrauten) implizit preisgegeben.

### D4. **GDPR-kompatible Tombstone-Fähigkeit (R6)**

`audit_log` bekommt neue Spalten:

```sql
pii_tombstoned_at timestamptz,
pii_tombstone_reason text,     -- z.B. 'gdpr_art_17', 'person_deceased', 'contract_end'
-- changes-Feld wird bei Tombstone umgeschrieben: PII durch SHA-256(PII|tombstone_key) ersetzt
-- entry_hash bleibt unverändert (Chain-Integrität!)
```

**Mechanik:** Die Tombstone-Operation ersetzt in `changes` die personenbezogenen Feldwerte durch deterministische Hashes. Der `entry_hash` der Row bleibt der originale, weil er zum Zeitpunkt des Inserts fixiert wurde. Dadurch:
- Chain-Integrität wird nicht gebrochen
- Betroffene_r kann Löschung beweisen (Reason + Tombstone-Marker sichtbar)
- Forensischer Nachweis der ursprünglichen Operation bleibt möglich (Hash als Fingerprint)
- Re-Identifikation der Person aus dem Hash ist nicht möglich, wenn der Tombstone-Key nach Ablauf vernichtet wird

**Right-to-be-forgotten bei aktivem Legal Hold:** Tombstone wird aufgeschoben, `legal_hold_id` wird als Referenz auf die hold-row gespeichert. Dokumentiert als Widerspruch zwischen Art. 17 und §147 AO — Legal Hold hat Vorrang, Betroffene_r bekommt schriftliche Begründung.

## Deferred (nicht in Alpha)

| R | Thema | Status |
|---|-------|--------|
| R3 | Access-Log auf Audit-Log (wer liest Logs) | Phase 2 — neue Tabelle `audit_log_access` |
| R4 | External Cryptographic Anchor (TSA / OpenTimestamps) | Phase 2 — nightly Merkle-Root pro Tenant |
| R5 | Legal Hold Integration | Mit Legal-Modul in Phase 3 |
| R8 | Signed JSON Export mit detached Signature | Phase 2 — GPG-basiert |
| R9 | External-Auditor-Rolle (engagement-scoped) | Phase 2 — RBAC-Erweiterung |
| R10 | Platform-Access Dual-Control | Phase 3 — erst bei Managed-Hosting relevant |

## Migration Plan (Alpha)

1. ADR-014 (migration policy) beachten — neue Migration `0113_per_tenant_audit_chain.sql`
2. Dev-DB wipen + neu seeden (wir sind in Alpha — keine produktiven Daten)
3. `audit_trigger()` umschreiben (D1)
4. `/api/v1/audit-log/integrity` neu implementieren (per-Tenant, einfacher)
5. `/api/v1/audit-log` GET-Route mit `includeDescendants`-Parameter (D2)
6. `whistleblowing_audit_log` + separater Trigger (D3)
7. `audit_log` um Tombstone-Spalten erweitern (D4)
8. **Integration-Test** mit echter Parallel-Insert-Last (pgTAP oder Vitest) — dieser Test fängt den Original-Bug
9. DPMS-DSR-Workflow-Handle für Tombstone (Phase 1.5, wenn DPMS-Modul ausgebaut wird)

## References

- ADR-001 (Multi-Tenant RLS) — org_id als Isolationsgrenze
- ADR-005 (PostgreSQL) — advisory_xact_lock, SHA-256 via pgcrypto
- ADR-014 (Migration Policy)
- RFC 3161 (Time-Stamp Protocol) — für Phase 2 External Anchor
- HinSchG §8 (Vertraulichkeitsgebot Whistleblowing)
- GDPR Art. 17 + ErwGr. 66 (Right to erasure)
