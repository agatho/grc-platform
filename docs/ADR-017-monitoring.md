## ADR-017: Monitoring & Alerting Strategy

| **ADR-ID**  | **017**                                                                                                                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**   | **Grafana Cloud Free + JSON-Logs als Basis; OpenTelemetry als spätere Erweiterung**                                                                                                                                                       |
| **Status**  | **Proposed**                                                                                                                                                                                                                              |
| **Date**    | 2026-04-18                                                                                                                                                                                                                                |
| **Context** | Aktuell gibt es `/api/v1/health`, den Schema-Drift-Check und den Audit-Integrity-Endpoint, aber kein Monitoring-Backend das sie regelmäßig abruft + alarmiert. Die Plattform ist GRC — Ausfälle müssen innerhalb Minuten entdeckt werden. |

### Decision

**Phase 1 (sofort, ohne Infra-Change)**: Healthchecks.io Free-Plan. Jeder Probe-Endpoint bekommt einen Check:

- `/api/v1/health` alle 60s
- `/api/v1/health/schema-drift` (mit Admin-Cookie) stündlich
- `/api/v1/audit-log/integrity` (mit Admin-Cookie) täglich 03:00

Healthchecks.io sendet Alarme an E-Mail + optional Slack/Telegram/PagerDuty bei fehlgeschlagenem Ping.

**Phase 2 (wenn > 50 Tenants oder Compliance-Druck)**: Grafana Cloud Free-Tier mit Loki + Prometheus:

- Loki: JSON-Logs via Docker-Log-Driver nach `promtail` im Host
- Prometheus: node-exporter + postgres-exporter im Compose-Stack
- Grafana-Dashboards für DB-Latenz, Audit-Trail-Größe, KRI-Entwicklung

**Nicht verwenden**:

- Datadog (zu teuer + US-Cloud, widerspricht ADR-007 rev. 1)
- Sentry SaaS (US-Cloud). Alternative: Sentry Self-Hosted auf Hetzner — aber separater ADR.

### Rationale

- Healthchecks.io: 50 Checks kostenlos, EU-gehostet (DE), reicht für Phase 1.
- Grafana Cloud Free-Tier: 50GB Logs + 10k Active Series + 3 Users. Mehr als genug für Einzel-Hetzner-Installation.
- OpenTelemetry als spätere Option: Vendor-neutral, wechselbar zu self-hosted Tempo/Jaeger falls Grafana nicht reicht.
- **Keine In-App-Error-Reporting-SaaS** bis ADR-018 (Secret-Management) geklärt ist — wir wollen keine weiteren Secrets im `.env` ohne Vault.

### Concrete Metrics to Expose

Aus der bestehenden Audit-Impact-KRI-API lassen sich bereits ziehen:

```
arctos_open_findings_total{severity="significant_nonconformity"} 3
arctos_overdue_findings_total 12
arctos_unlinked_findings_total 45  # Traceability-Gap (Audit -> Risk)
arctos_audit_treatments_open_total 7
arctos_schema_drift_missing_in_db 3
```

Implementation: Neuer Endpoint `/api/v1/metrics` (Admin-Token-protected), Prometheus-text-format. Separate ADR wenn Bedarf.

### Migration Path

1. **Woche 1**: Healthchecks.io-Account + 3 Checks konfigurieren. Telegram/Slack-Hook angebinden.
2. **Woche 4**: Log-Shipper promtail im Compose-Stack; Loki-Target Grafana Cloud.
3. **Monat 3**: Prometheus + postgres-exporter. Dashboards.
4. **Jahr 1**: Evaluierung ob OpenTelemetry Traces hinzugenommen werden sollen.

### Consequences

- Externer Anbieter (Grafana Labs, UK-Unternehmen) — DSGVO-vertretbar, Datenverarbeitung in EU-Region erzwingbar
- Logs landen bei Grafana Cloud — **keine sensiblen Daten dürfen geloggt werden** (PII, secret tokens, Audit-Content). Structured-Logger (apps/web/src/lib/logger.ts) kümmert sich um Field-Scrubbing.
- Wenn Grafana Cloud Ausfall: lokale Docker-Logs bleiben verfügbar, Grad Ausfall = "blind für 10 Minuten", nicht "Plattform down"
