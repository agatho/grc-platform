# ADR-011 rev.3 — External Tamper-Evidence Anchors (FreeTSA + OpenTimestamps)

| **ADR-ID**     | **011**                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------- |
| **Title**      | **Audit Trail Architecture — rev.3 (external dual anchors)**                                    |
| **Status**     | **Accepted**                                                                                    |
| **Date**       | 2026-04-20                                                                                      |
| **Supersedes** | — (extends rev.2)                                                                               |
| **Context**    | GDPR Art. 5, ISO 27001 A.12.4, DORA Art. 28, eIDAS, Stakeholder-Analyse (Platform-Vendor-Trust) |

## Context

Rev.2 etablierte die per-tenant-SHA-256-Hash-Chain. Die dort bewiesene Eigenschaft ist: _innerhalb_ der Chain ist nichts unbemerkt manipulierbar. Das ungelöste Problem: ein Platform-Admin (wir selbst, die Betreiber) mit DB-Schreibrecht kann **die gesamte Chain rückwirkend neu berechnen** — alte Rows löschen, neue einsetzen, alle Hashes konsistent halten. Externe Beobachter haben keinen Bezugspunkt, der das widerlegen könnte.

Rev.3 schließt genau diese Lücke: die tägliche Merkle-Root jeder Tenant-Chain wird an _externe_ Trust-Roots übergeben. Was wir nach diesem Zeitpunkt schreiben, können wir nicht mehr rückwirkend umschreiben, ohne dass ein externer Zeuge widerspricht.

## Decision

**Dual-Anchor-Strategie** mit zwei unabhängigen externen Trust-Roots:

1. **FreeTSA (RFC 3161 Time-Stamp Authority)** — liefert signierte Zeitstempel in Sekunden. Single-Server (freetsa.org), daher ein Single-Point-of-Failure, aber operativ schnell und sofort juristisch nachvollziehbar (RFC 3161 ist eIDAS-anerkannt, wenn von einer QTSP signiert; FreeTSA ist nicht qualifiziert, aber als nicht-qualifizierter Zeitstempel dennoch prozessuell verwertbar — `§ 371a ZPO` erkennt elektronische Dokumente mit TSA-Siegel als Augenscheinsbeweis).

2. **OpenTimestamps (Bitcoin-Blockchain)** — aggregiert unseren Hash mit Millionen anderer in einem Calendar-Merkle-Tree, committet den Root alle 1-2 Stunden in eine Bitcoin-`OP_RETURN`-Transaktion. Trustless — keine einzelne Entität kann den Proof nachträglich zurückziehen. Latenz: ~1-2 h bis zum Bitcoin-Commit. Kosten: **0 €** (aggregiert).

Beide parallel, weil jeder für sich eine Schwachstelle hat:

- FreeTSA könnte offline gehen oder Keys verlieren → OTS überlebt
- OpenTimestamps-Calendar-Server könnten zensieren → FreeTSA überlebt

### D1. Schema: `audit_anchor` (Migration 0285)

```sql
audit_anchor (
  id, org_id, anchor_date, provider, merkle_root, leaf_count,
  proof (base64 blob), proof_status, bitcoin_block_height,
  last_error, created_at, upgraded_at, verified_at
)
UNIQUE (org_id, anchor_date, provider)
```

Pro Mandant, pro UTC-Tag, pro Provider **eine** Zeile. Das `proof`-Feld hält die rohen Bytes unverändert (bei FreeTSA: DER-encoded TimeStampResp; bei OTS: binäre .ots-Serialisierung). So bleibt der Beweis offline-verifizierbar mit `openssl ts -verify` bzw. `ots verify` — auch wenn unsere Verifikations-Code-Evolution divergiert.

### D2. Merkle-Tree-Construction

Blätter: alle `audit_log.entry_hash` einer Org für einen UTC-Tag, sortiert nach `(created_at, id) ASC` — deterministisch. Pairing: SHA-256 über die Konkatenation der Raw-Bytes (32+32=64). Odd-level: letztes Element wird mit sich selbst gepaart (Bitcoin-Konvention).

Inkludsions-Beweis pro Leaf ist ~20 Knoten tief für 1 Million Einträge — vernachlässigbarer Overhead.

### D3. Nightly Worker (`apps/worker/src/crons/daily-audit-anchor.ts`)

Läuft 00:05 UTC. Für jede Org mit Activity am Vortag:

1. Baue Merkle-Tree
2. POST Root an FreeTSA → insert row mit `proof_status='complete'`
3. POST Root an OTS-Calendar-Pool (parallel an 3 Calendars) → insert row mit `proof_status='pending'`
4. Fehlschläge werden als `proof_status='failed'` mit `last_error` persistiert; retry ist idempotent (unique-index verhindert Duplikate).

### D4. On-Demand Anchor API (`POST /api/v1/audit-log/anchor`)

Ersetzt nicht den Nightly-Worker, ergänzt ihn. Use-Cases:

- Admin fordert vor einer Prüfung einen sofortigen Anchor an
- Tests / Alpha-Demos müssen nicht 24 h warten

### D5. UI-Sichtbarkeit

Im `/audit-log`-Header erscheinen zwei Badges: "FreeTSA: verankert vor 2 h" und "OpenTimestamps: Bitcoin-Bestätigung ausstehend". Ein Button "Jetzt verankern" triggert den API-Endpoint manuell. Fehlerzustände (z.B. TSA offline) werden mit `title`-Hover sichtbar.

### D6. Verifikations-Pfad

Ein Auditor kann die Kette _ohne_ ARCTOS verifizieren:

1. Export aller `audit_log`-Rows einer Org für Tag `T` als JSON (entry_hash + canonical fields).
2. Rebuild des Merkle-Trees mit dem Standard-Sort (created_at, id).
3. Vergleich des berechneten Roots mit `audit_anchor.merkle_root`.
4. Verifikation des FreeTSA-Proofs mit `openssl ts -verify -data <merkle_root> -in proof.tsr`.
5. Verifikation des OTS-Proofs mit `ots verify` — die CLI fragt Bitcoin-Block-Explorer ab (blockstream.info, mempool.space) und prüft den Merkle-Path bis zum Block-Header.

Wir brauchen keinen eigenen Bitcoin-Full-Node. Wenn ein Customer Trust-Minimierung bis zur Quelle will, kann er die OTS-CLI auf einen eigenen Bitcoin-Node zeigen — das Protokoll erlaubt es.

## Evaluated Alternatives

| Option                                      | Advantages                                                                | Disadvantages                                          | Choice                       |
| ------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------- |
| **FreeTSA + OpenTimestamps dual (aktuell)** | Redundanz, Bitcoin-Trustless + Sekunden-Latenz, Kosten 0 €                | Zwei Integrations                                      | ✅                           |
| Nur FreeTSA                                 | Einfacher, sofort verifizierbar                                           | Single Server → Point of Failure                       | —                            |
| Nur OpenTimestamps                          | Trustless via Bitcoin                                                     | 1-2 h Latenz bis voller Proof                          | —                            |
| Kommerzielle eIDAS-QTSP (D-Trust, DigiCert) | Qualified Electronic Timestamp, maximale juristische Anerkennung in DE/EU | ~500-2000 €/Jahr, kommerzielle Abhängigkeit            | Phase 2, wenn GmbH existiert |
| Eigener Bitcoin-Node + Direkt-OP_RETURN     | Volle Autonomie                                                           | ~€5-20 BTC-Gebühr pro Commit, Node-Ops                 | —                            |
| Ethereum-Smart-Contract                     | Billiger als BTC, programmierbar                                          | Wenige Auditoren akzeptieren Ethereum-State als Beweis | —                            |

## Consequences

### Positive

- Platform-Vendor verliert ab Anchor-Zeitpunkt die Möglichkeit, Audit-Events rückwirkend zu manipulieren — egal ob legal, illegal, oder forensisch erzwungen. Das ist der _eigentliche_ Wert des ganzen Tamper-Evidence-Konzepts.
- Bei GmbH-Gründung später muss nichts umgebaut werden — eine QTSP wird einfach als dritter Provider (`provider='dtrust'`) hinzugefügt.
- Kunden können ihre Anchors unabhängig verifizieren, auch wenn ARCTOS nicht mehr existiert.

### Negative / Trade-offs

- **FreeTSA-Dependency**: Wenn freetsa.org permanent offline geht, gehen neue Anchors durch diesen Provider verloren. Alte bleiben verifizierbar (die X.509-Kette überlebt die TSA). OTS fängt das redundanz-bedingt ab.
- **OTS-Latenz**: Ein Anchor ist erst ~1-2 h nach Erstellung Bitcoin-verifizierbar. In dem Fenster ist er nur gegen Calendar-Server verifizierbar. Für operationelle GRC-Use-Cases (monatliche/quartalsweise Audits) vernachlässigbar.
- **Storage-Wachstum**: ~6 KB pro Anchor pro Provider pro Tag. Bei 1000 Tenants × 365 Tage × 2 Provider = ~4.4 GB/Jahr. Für Postgres-Scale unproblematisch.
- **Byte-Genauigkeit im Merkle-Tree**: Unser Leaf-Sort (created_at, id) MUSS für die Verifikation dieselbe Reihenfolge ergeben wie zur Anchor-Zeit. Eine Migration, die `created_at`-Precision ändert oder IDs verändert, bricht die Verifikation. Das ist akzeptiert — ADR-014 Migration Policy verbietet solche Änderungen auf Log-Tabellen ohnehin.

## Roadmap

**Phase 1 (heute, dieser PR)**: FreeTSA + OTS Dual, on-demand API, nightly cron, UI-Badges.

**Phase 2** (wenn GmbH existiert):

- **QTSP-Integration** (D-Trust oder DigiCert) als `provider='qtsp_dtrust'`. Damit ist das Siegel eIDAS-qualifiziert.
- **OTS-Upgrade-Job**: täglich die `proof_status='pending'` OTS-Rows gegen die Calendars pollen und mit dem vollen Bitcoin-Attestation-Proof ersetzen. Setzt `bitcoin_block_height`.
- **Downloadable-Archive-Export**: ein Klick erzeugt eine ZIP mit audit_log-JSON + alle Anchor-Proofs + README mit Verification-Instructions für offline-Audit.

**Phase 3** (bei Enterprise-Sale):

- **Eigener Bitcoin-Pruned-Node** (~10 GB, 10€/Monat Hetzner) für vollständig autonome OTS-Verifikation ohne Explorer-API-Dependency.
- **QTSP-Failover**: zwei QTSPs parallel (DE + NL), damit auch eine nationale Regulator-Intervention nicht zum Ausfall führt.

## References

- RFC 3161 — Internet X.509 Public Key Infrastructure Time-Stamp Protocol
- OpenTimestamps Protocol: https://petertodd.org/2016/opentimestamps-announcement
- ADR-011 rev.2 — Per-Tenant Chain (Grundlage)
- eIDAS Verordnung (EU) 910/2014 — Trust Services
- `§ 371a ZPO` (Beweiswert elektronischer Dokumente mit Siegel)
- FreeTSA: https://freetsa.org — kostenloser TSA-Dienst (Klaus-Rüdiger Kraft)
