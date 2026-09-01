## ADR-017: Monitoring & Alerting Strategy

| **ADR-ID**  | **017**                                                                                                                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**   | **Grafana Cloud Free + JSON-Logs als Basis; OpenTelemetry als spätere Erweiterung**                                                                                                                                                       |
| **Status**  | **Accepted** (2026-09-01 — Phase 1 umgesetzt, siehe §Umsetzungsstand)                                                                                                                                                                                                                              |
| **Date**    | 2026-04-18                                                                                                                                                                                                                                |
| **Context** | Aktuell gibt es `/api/v1/health`, den Schema-Drift-Check und den Audit-Integrity-Endpoint, aber kein Monitoring-Backend das sie regelmäßig abruft + alarmiert. Die Plattform ist GRC — Ausfälle müssen innerhalb Minuten entdeckt werden. |

### Umsetzungsstand (2026-09-01, ARCTOS-FULL-2026-08-31 / WP10)

> Dieses ADR stand seit dem **2026-04-18** auf „Proposed" und terminierte
> Phase 1 auf „Woche 1". Beim Audit am 2026-08-31 — **4,5 Monate später** —
> ergab eine vollständige Suche über `apps/web/src`, `apps/worker/src`,
> `packages/*/src`, `deploy`, `scripts`, `.github` und beide Compose-Dateien
> nach `healthchecks.io|alertmanager|prometheus|promtail|loki|sentry|
> opentelemetry|statsd|datadog` **null Treffer** (S13-11). Kein Client in
> einer `package.json`, kein Exporter in einer Compose-Datei, kein Heartbeat
> in `deploy/` oder `scripts/`, kein `schedule:`-Workflow, der einen
> Health-Endpunkt abruft. Der in Zeile 50 angekündigte Endpunkt
> `/api/v1/metrics` existierte nicht.
>
> Folge: die Plattform war unbeobachtet. Ein Ausfall wurde durch
> Nutzerreport entdeckt. Die im DR-Playbook zugesagte RTO von 5 min beginnt
> definitionsgemäß bei „Incident Confirmed" — es gab keinen Mechanismus, der
> einen Incident bestätigt. Und es gab keinen Alarm auf ein einziges
> sicherheitsrelevantes Ereignis (S13-12).

| Zusage | Stand 2026-08-31 | Stand 2026-09-01 |
|---|---|---|
| Metriken im Prometheus-Format | nicht vorhanden | `scripts/ops-metrics.mjs`, Compose-Dienst `ops-metrics`, `GET :9105/metrics` |
| `/api/v1/metrics` (Zeile 50) | nicht vorhanden | **bewusst nicht dort** — siehe „Abweichung" unten |
| Health-/Readiness-Endpunkte | nur `/api/v1/health` (prüfte `SELECT 1`) | dazu `:9105/healthz`, `:9105/readyz`, Container-`HEALTHCHECK` für `web` (S13-13) und `worker` |
| Alarm: fehlgeschlagene Logins | keiner | `failed_logins_burst`, `failed_logins_single_account` |
| Alarm: Massenexport | keiner | `mass_export_hourly`, `mass_export_daily` |
| Alarm: Bruch der Audit-Kette | keiner | `audit_chain_broken`, `audit_chain_unverifiable`, `audit_write_attempt` |
| Alarm: Job-Fehler | keiner | `job_failures`, zusätzlich `scheduler_silent` |
| Alarm: Backup / Off-Site / DR-Drill | keiner | `backup_stale`, `backup_failed`, `backup_unencrypted`, `backup_without_objects`, `offsite_stale`, `dr_drill_overdue` |
| Field-Scrubbing im Logger (§Consequences) | **behauptet, nicht vorhanden** (S13-15) | implementiert — siehe unten |

**Abweichung von der ursprünglichen Entscheidung — und ihr Grund.**
Zeile 50 sah `/api/v1/metrics` in der Web-App vor. Umgesetzt ist stattdessen
ein eigener Prozess (`ops-metrics`). Der Grund ist die
Mandantentrennung: die Auswertung braucht org-übergreifenden Lesezugriff
(Kettenprüfung über alle Scopes, `access_log` aller Mandanten). Die Web-App
läuft seit der Remediation absichtlich als `grc_app` unter RLS und **darf
das nicht** (S01-10) — ein Metrik-Endpunkt in der Web-App hätte entweder
falsche Zahlen geliefert oder die Rollentrennung aufgehoben. `ops-metrics`
verbindet als `grc_worker` (BYPASSRLS, kein SUPERUSER) und ist nicht nach
aussen exponiert.

**Field-Scrubbing (§Consequences) — jetzt tatsächlich vorhanden.**
Der Satz „Structured-Logger kümmert sich um Field-Scrubbing" war die
Voraussetzung, unter der externes Log-Shipping überhaupt beschlossen wurde.
Der Logger hatte davon nichts: `...fields` wurde ungefiltert übernommen,
ohne Deny-List, Key-Maskierung, Tiefen- oder Grössenbegrenzung
(`LogFields` ist `[k: string]: unknown`). Ein
`log.error("save failed", { payload: body })` schrieb den kompletten
Request-Body auf stderr. `apps/web/src/lib/logger.ts` scrubbt jetzt nach
Schlüsselname (Passwörter, Tokens, Secrets, `body`/`payload`/`raw`),
maskiert E-Mail-Adressen auf `e***@domain.tld`, erkennt tokenartige WERTE
unabhängig vom Schlüssel (JWT, `sk-…`, lange Hex-Ketten,
Connection-Strings mit Passwort) und begrenzt Tiefe, Array-Länge,
String-Länge und Zeilengrösse. `requestId`, `orgId`, `userId` und die
Laufzeitfelder bleiben — sie tragen die Korrelation.

**Log-Retention.** Beide Compose-Dateien führen jetzt einen `logging:`-Block
(json-file, `max-size: 50m`, `max-file: 5`, also höchstens 250 MB je
Container ≈ 3–7 Tage). Vorher gab es keinen: die Logdateien wuchsen
unbegrenzt bis die Partition voll war, auf derselben Partition wie die
Backups (S13-16). Logzeilen enthalten `userId`, `orgId` und
`X-Request-ID` und sind damit personenbeziehbar — die Frist gehört ins
Verarbeitungsverzeichnis.

**Was weiterhin offen ist (Betreiber, nicht Code):**
`ALERT_WEBHOOK_URL` und `HEALTHCHECKS_URL` müssen gesetzt werden. Ohne sie
schreibt `ops-metrics` die Alarme strukturiert nach stderr — sichtbar, aber
niemand wird geweckt. Der Dead-Man's-Switch (`HEALTHCHECKS_URL`) ist der
einzige Mechanismus, der auch den Fall „Host komplett tot" meldet; ein
Exporter auf demselben Host kann das per Definition nicht.

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

Implementation: **umgesetzt in `scripts/ops-metrics.mjs`** (Compose-Dienst
`ops-metrics`, `GET :9105/metrics`, Prometheus-Textformat) statt als
Web-Endpunkt — Begründung im Abschnitt „Umsetzungsstand". Die tatsächlich
exportierten Kennzahlen sind breiter als die Liste oben; die
massgebliche Aufstellung steht im Kopfkommentar von `scripts/ops-metrics.mjs`
und in `docs/runbook.md` §8.

Die GRC-Fachkennzahlen (`arctos_open_findings_total` usw.) sind bewusst
NICHT enthalten: sie sind mandantenbezogen und gehören in die
Anwendungsoberfläche, nicht in einen org-übergreifenden Betriebsexporter.

### Migration Path

1. ~~**Woche 1**~~ **erledigt 2026-09-01**: Metrik- und Alarmdienst
   `ops-metrics` im Stack. Healthchecks.io ist als Dead-Man's-Switch über
   `HEALTHCHECKS_URL` angebunden (Konto und URL sind ein Betreiberschritt).
2. **Woche 4**: Log-Shipper promtail im Compose-Stack; Loki-Target Grafana Cloud.
3. **Monat 3**: Prometheus + postgres-exporter. Dashboards.
4. **Jahr 1**: Evaluierung ob OpenTelemetry Traces hinzugenommen werden sollen.

### Consequences

- Externer Anbieter (Grafana Labs, UK-Unternehmen) — DSGVO-vertretbar, Datenverarbeitung in EU-Region erzwingbar
- Logs landen bei Grafana Cloud — **keine sensiblen Daten dürfen geloggt
  werden** (PII, secret tokens, Audit-Content). Der Structured-Logger
  (`apps/web/src/lib/logger.ts`) leistet das Field-Scrubbing seit
  2026-09-01 **tatsächlich**; bis dahin war dieser Satz eine unerfüllte
  Zusage, auf die die Entscheidung für externes Log-Shipping gestützt war
  (S13-15). Die Regeln stehen im Kopfkommentar der Datei und sind über
  `__scrubForTest` testbar.
- **Nicht abgedeckt:** 58 `console.*`-Aufrufe in `apps/web/src` und 164 in
  `apps/worker/src` gehen am Logger vorbei und damit auch am Scrubbing. Sie
  unterliegen weder `ARCTOS_LOG_LEVEL` noch dem NDJSON-Format. Vor dem
  Anschluss an einen externen Log-Empfänger sind sie umzustellen — das ist
  der verbleibende Teil von S13-15 und in WP10.md als offener Punkt geführt.
- Wenn Grafana Cloud Ausfall: lokale Docker-Logs bleiben verfügbar, Grad Ausfall = "blind für 10 Minuten", nicht "Plattform down"
