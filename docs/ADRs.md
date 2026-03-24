**Architecture Decision Records**

ARCTOS — GRC & BPM SaaS Platform

12 Technology Decisions for the Platform Build

March 2026 — Version 1.0

Based on: Data Model v1.0 (44 Entities) | Gap Analysis v2.1 (88 Requirements) | Market Analysis (35+ Vendors)

# Table of Contents

# Decision Overview

This document records the 12 key technology decisions für die ARCTOS — GRC & BPM SaaS Platform. Each ADR follows the format: Context → evaluated alternatives → decision → consequences. Status: Accepted = decision final, Proposed = to be validated.

| **ADR** | **Decision** | **Core Technologies** | **Status** |
| --- | --- | --- | --- |
| **001** | Multi-Entity via RLS (org_id) | PostgreSQL RLS | ** Accepted ** |
| **002** | Frontend: Next.js 15 + React 19 + shadcn/ui | Next.js, Tailwind, next-intl | ** Accepted ** |
| **003** | BPMN-Engine: bpmn.js (Camunda) | bpmn.js + reactflow | ** Accepted ** |
| **004** | Backend: Node.js 22 + TypeScript 5 | Hono.js, Monorepo | ** Accepted ** |
| **005** | Datenbank: PostgreSQL 16 + pgvector + TimescaleDB | FTS, Hypertables, Embeddings | ** Accepted ** |
| **006** | ORM: Drizzle ORM | Type-safe, SQL-nah | ** Accepted ** |
| **007** | Auth: Auth.js + Custom RBAC | SSO, Three Lines of Defense | ** Accepted ** |
| **008** | KI: Claude API + lokale Modelle | MCP, Ollama, Privacy-Router | ** Accepted ** |
| **009** | Workflow: Temporal.io | Durable, Timer, Cron | ** Proposed ** |
| **010** | API: REST + OpenAPI 3.1 + Webhooks | Zod-to-OpenAPI | ** Accepted ** |
| **011** | Audit-Trail: Append-Only + Hash-Kette | 3 Log-Tabellen, Trigger | ** Accepted ** |
| **012** | Deployment: Docker + K8s | Helm, GitHub Actions | ** Proposed ** |

### Tech Stack at a Glance

Frontend: Next.js 15 + React 19 + Tailwind CSS 4 + shadcn/ui + bpmn.js + Recharts

Backend: Node.js 22 + TypeScript 5 + Hono.js + Drizzle ORM + Zod

Datenbank: PostgreSQL 16 + pgvector + TimescaleDB + RLS + Partitionierung

Auth: Auth.js (Self-Hosted) + Custom RBAC (Three Lines of Defense) — see ADR-007 rev.1

KI: Claude API (Sonnet/Opus) + Ollama (lokale Modelle) + MCP

Workflow: Temporal.io (durable Workflows, Timer, Cron)

API: REST + OpenAPI 3.1 + Webhooks + HMAC-Signatur

Audit: 3 Append-Only Log-Tabellen + SHA-256 Hash-Kette + DB-Trigger

Deployment: Docker + Kubernetes + Helm + GitHub Actions

Hosting: Hetzner Cloud / Deutsche Telekom OTC (DSGVO-konform, DE)

# Architecture Decisions in Detail

## ADR-001: Multi-Entity Architecture

| **ADR-ID** | **001** |
| --- | --- |
| **Title** | **Multi-Entity Isolation via Row-Level Security (RLS)** |
| **Status** | ** Accepted ** |
| **Date** | 2026-03-22 |
| **Context** | G-02: 5 unabhängige Unternehmen mit eigenen Daten + Konfiguration, aber Konzern-Aggregation |

### Decision

Row-Level Security (RLS) auf PostgreSQL-Ebene mit org_id als Diskriminator auf jeder Business-Tabelle. Jede Query wird automatisch durch eine RLS-Policy gefiltert, die den org_id des authentifizierten Users prüft. Konzern-Aggregation über eine separate Reporting-Rolle, die alle org_ids lesen darf.

### Evaluated Alternatives

| **Option** | **Advantages** | **Disadvantages** | **Choice** |
| --- | --- | --- | --- |
| **RLS (org_id pro Zeile)** | Einfaches Schema, Cross-Entity-Joins für Konzernberichte, ein Deployment, PostgreSQL-nativ | Fehlerhafte Policy = Datenleck, etwas Performance-Overhead bei großen Tabellen | **✅** |
| **Schema-per-Tenant** | Härteste Isolation, eigene Migrations pro Tenant | Konzern-Aggregation extrem komplex (Cross-Schema-Queries), Schema-Drift-Risiko, Migrations x5 | — |
| **Separate Datenbanken** | Maximale Isolation | Keine Konzernberichte möglich, 5x Infrastruktur-Kosten, kein gemeinsames Framework-Repository | — |

### Consequences

Jede CREATE TABLE-Anweisung enthält org_id als NOT NULL FK. RLS-Policy wird per Migration aktiviert: CREATE POLICY org_isolation ON <table> USING (org_id = current_setting('app.current_org_id')::uuid). Die Applikation setzt SET app.current_org_id pro Request. Composite Indexes auf (org_id, status) und (org_id, created_at) für Performance. Tests müssen RLS-Bypass und Cross-Tenant-Leaks prüfen.

Ref: Datenmodell v1.0 Abschnitt 1.1 Organization, Cross-Cutting Pflichtfelder

## ADR-002: Frontend Framework

| **ADR-ID** | **002** |
| --- | --- |
| **Title** | **Next.js 15 + React 19 + Tailwind CSS + shadcn/ui** |
| **Status** | ** Accepted ** |
| **Date** | 2026-03-22 |
| **Context** | G-06: Deutsch + Englisch UI, G-08: Konfigurierbare Dashboards, G-11: Mobile-freundlich, P-01: BPMN-Editor |

### Decision

Next.js 15 (App Router) mit React 19 Server Components, Tailwind CSS 4 für Styling, shadcn/ui als Komponentenbibliothek. Internationalisierung via next-intl (de/en). Progressive Web App (PWA) für mobile Nutzung statt nativer App.

### Evaluated Alternatives

| **Option** | **Advantages** | **Disadvantages** | **Choice** |
| --- | --- | --- | --- |
| **Next.js 15 + shadcn/ui** | Server Components (Performance), App Router (Layouts), riesiges Ökosystem, shadcn/ui = volle Kontrolle über Design | Vendor Lock-in auf Vercel-Ökosystem (mitigierbar durch Self-Hosting) | **✅** |
| **Remix / React Router 7** | Nested Routes, progressive Enhancement | Kleineres Ökosystem, weniger Enterprise-Referenzen, kein Server Components | — |
| **SvelteKit** | Bessere Performance, weniger Boilerplate | Deutlich kleinerer Talentpool, bpmn.js ist React-Ökosystem | — |
| **Angular** | Enterprise-Standard, starke Typisierung | Überdimensioniert, bpmn.js-Integration umständlicher, langsamere Entwicklung | — |

### Consequences

Monorepo-Struktur mit Turborepo: apps/web (Next.js), packages/ui (shadcn/ui-Komponenten), packages/shared (Typen, Validierung). next-intl für i18n mit Namespace-Dateien pro Modul (de/risk.json, en/risk.json). Dashboard-Builder mit Recharts + react-grid-layout. Alle UI-Komponenten testen mit Vitest + Testing Library.

## ADR-003: BPMN Engine

| **ADR-ID** | **003** |
| --- | --- |
| **Title** | **bpmn.js (Camunda) as Embedded BPMN 2.0 Editor** |
| **Status** | ** Accepted ** |
| **Date** | 2026-03-22 |
| **Context** | P-01: Native BPMN 2.0 Modellierung, P-02: Mehrere Notationen, P-05: Verknüpfung Prozesse ↔ Risiken/Controls |

### Decision

bpmn.js von Camunda als React-Komponente eingebettet (bpmn-js-react oder eigener Wrapper). Speicherung als BPMN 2.0 XML in der ProcessVersion-Tabelle. Custom Overlays für Risiko- und Control-Annotationen an BPMN-Shapes. Für EPK und Wertkettendiagramme (P-02): vereinfachte Custom-Views mit reactflow als ergänzende Notation.

### Evaluated Alternatives

| **Option** | **Advantages** | **Disadvantages** | **Choice** |
| --- | --- | --- | --- |
| **bpmn.js (Camunda)** | Industriestandard, vollständige BPMN 2.0 Spec, MIT-Lizenz (Viewer) / Camunda-Lizenz (Modeler), Custom Overlays API, Export als SVG/PNG/XML | Camunda-Modeler-Lizenz für Editing, Lernkurve für Customization | **✅** |
| **reactflow** | Flexibel, leichtgewichtig, eigene Node-Types, MIT-Lizenz | Keine BPMN-Validierung, kein Standard-XML-Export, alles selbst bauen | — |
| **BPMN.io + dmn-js** | Zusätzlich DMN-Support | Gleiche Basis wie bpmn.js, DMN ist P3-Feature | — |
| **GoJS** | Schnell, viele Diagrammtypen | Kommerzielle Lizenz ($5k+), kein nativer BPMN-Support | — |

### Consequences

bpmn.js wird als React-Komponente gewrappt mit folgenden Custom-Extensions: (1) Risk-Overlay: rote Badges an BPMN-Shapes die Risikoanzahl und höchsten Risiko-Score zeigen, (2) Control-Overlay: grüne Badges für Controls, (3) Click-Handler: Klick auf Shape öffnet Seitenpanel mit verknüpften Risiken/Controls/Findings. BPMN XML wird in process_version.bpmn_xml gespeichert. Hierarchische Prozesslandschaft (P-03) über Baumnavigation, Drill-Down öffnet Subprozess im Editor. Process Mining (P-10) und Simulation (P-09) sind P3-Features.

## ADR-004: Backend Runtime & Language

| **ADR-ID** | **004** |
| --- | --- |
| **Title** | **Node.js 22 LTS + TypeScript 5.x** |
| **Status** | ** Accepted ** |
| **Date** | 2026-03-22 |
| **Context** | G-10: REST-API, G-09: Workflow-Engine, G-12: KI-Funktionen, Monorepo mit Frontend |

### Decision

Node.js 22 LTS mit TypeScript 5.x. API-Layer als Next.js API Routes (App Router) für einfache CRUD-Endpunkte, plus separater Hono.js-Service für performancekritische Operationen (Bulk-Imports, Event-Processing, Audit-Trail). Shared TypeScript-Typen zwischen Frontend und Backend im Monorepo.

### Evaluated Alternatives

| **Option** | **Advantages** | **Disadvantages** | **Choice** |
| --- | --- | --- | --- |
| **Node.js + TypeScript** | Gleiche Sprache wie Frontend, Type-Sharing im Monorepo, riesiges Ökosystem, gute PostgreSQL-Driver | Single-threaded (mitigierbar durch Worker Threads), nicht ideal für CPU-intensive Tasks | **✅** |
| **Python + FastAPI** | Bestes KI/ML-Ökosystem, async-native, Pydantic-Validierung | Zwei Sprachen im Stack, kein Type-Sharing mit Frontend, GIL-Limitierung | — |
| **Go** | Beste Performance, native Concurrency | Kein Type-Sharing, kleineres Web-Ökosystem, langsamere Feature-Entwicklung | — |
| **.NET / C#** | Enterprise-Standard, starke Typisierung | Microsoft-Lock-in, kein Type-Sharing, Überdimensioniert für SaaS-Startup | — |

### Consequences

Monorepo-Struktur: apps/web (Next.js + API Routes), apps/worker (Hono.js Background-Service), packages/db (Drizzle Schema + Queries), packages/shared (Zod-Schemas, TypeScript-Typen). Zod für Runtime-Validierung auf API-Ebene, TypeScript für Compile-Time-Safety. Für CPU-intensive KI-Tasks (z.B. Monte Carlo Simulation) werden Worker Threads oder ein separater Python-Microservice genutzt.

## ADR-005: Database

| **ADR-ID** | **005** |
| --- | --- |
| **Title** | **PostgreSQL 16 + pgvector + TimescaleDB** |
| **Status** | ** Accepted ** |
| **Date** | 2026-03-22 |
| **Context** | G-01: Einheitliche Plattform, G-07: Audit-Trail, G-02: Multi-Entity, DM-07: Volltextsuche, E-08: Monte Carlo, E-10: KRI-Zeitreihen |

### Decision

PostgreSQL 16 als einzige primäre Datenbank mit drei Extensions: (1) pgvector für KI-basierte semantische Suche, (2) TimescaleDB für Zeitreihen-Daten (KRI-Messwerte, Compliance-Checkpoints, Simulationsergebnisse), (3) Native Full-Text-Search für Volltextsuche (DM-07). Row-Level Security für Multi-Entity-Isolation. JSONB für flexible Felder. Kein separates Zeitreihen-System.

### Evaluated Alternatives

| **Option** | **Advantages** | **Disadvantages** | **Choice** |
| --- | --- | --- | --- |
| **PostgreSQL + TimescaleDB + pgvector** | Eine DB für alles, RLS auf Hypertables, SQL-JOINs zwischen Business- und Zeitreihen-Daten, 90%+ Kompression, Continuous Aggregates | TimescaleDB-Lizenz (Apache 2 Core, TSL Advanced), etwas Konfigurations-Aufwand | — |
| **PostgreSQL + InfluxDB** | Purpose-Built Zeitreihen, schnelle Writes | Zwei Systeme, eigene Query-Sprache (Flux), kein RLS, keine JOINs mit GRC-Daten, doppelte Ops | — |
| **PostgreSQL + Elasticsearch** | Bessere Volltextsuche, Faceted Search | Zwei Systeme synchronisieren, höhere Ops-Komplexität, überdimensioniert | — |
| **MySQL 8 / MongoDB** | Verbreitet / flexibles Schema | Kein RLS, kein pgvector, keine Zeitreihen-Extension | — |

### TimescaleDB: Concrete Use Cases

**KRI-Messwerte (E-10): **50 KRIs x tägliche Messung x 5 Entities = ~91.000 Datenpunkte/Jahr. kri_measurement als Hypertable. Continuous Aggregates liefern automatisch Wochen-/Monats-/Quartalsdurchschnitte für Trend-Dashboards.

**Continuous Control Monitoring (Phase 2): **Automatisierte Compliance-Checks im Vanta/Drata-Stil erzeugen Millionen Checkpoints/Monat. TimescaleDB komprimiert auf ~10% und aggregiert automatisch zu Compliance-Scores.

**Monte-Carlo-Ergebnisse (E-08): **Simulationsergebnisse (P5, P25, P50, P75, P95) als Zeitreihe pro Risiko. Dashboard: Wie hat sich die quantifizierte Risikoexposition über 12 Monate entwickelt?

**Process Mining Event Logs (P-10, Phase 3): **Event-Logs aus ERP-Systemen mit Millionen Events. Hypertables mit Kompression für zeitbasierte Conformance-Analysen.

**AI Usage Tracking (O-10): **Jeder KI-Aufruf geloggt: Tokens, Kosten, Latenz, Provider, Org. Zeitreihe für KI-Budget-Monitoring pro Entity.

### Why Not a Separate System

Der entscheidende Vorteil: TimescaleDB IST PostgreSQL. (1) RLS-Policies gelten auf Hypertables — Org A sieht nie KRI-Messwerte von Org B. (2) SQL-JOINs zwischen Zeitreihen und Business-Daten — z.B. alle KRI-Werte für Risiken mit Score > 15 in den letzten 90 Tagen. (3) Drizzle ORM funktioniert weiterhin. (4) Ein Backup, ein Monitoring, ein Deployment. Ein separates System wie InfluxDB wäre erst bei 100.000+ Writes/Sekunde gerechtfertigt.

### Consequences

Managed PostgreSQL mit TimescaleDB (Timescale Cloud oder Self-Managed auf Hetzner). Drei Hypertables: kri_measurement (Chunk: 1 Monat), simulation_result (Chunk: 1 Quartal), compliance_checkpoint (Chunk: 1 Woche, Phase 2). Continuous Aggregates für KRI-Dashboards. Retention: Rohdaten 3 Jahre, Aggregate 10+ Jahre. Kompression nach 30 Tagen. pgvector für Embeddings. Index-Strategie: Composite auf (org_id, status), GIN für JSONB/tsvector, TimescaleDB-native Indexes. Audit-Log-Partitionierung weiterhin über native PostgreSQL-Partitionen.

## ADR-006: ORM / Database Access

| **ADR-ID** | **006** |
| --- | --- |
| **Title** | **Drizzle ORM** |
| **Status** | ** Accepted ** |
| **Date** | 2026-03-22 |
| **Context** | ADR-004 (TypeScript), ADR-005 (PostgreSQL), Datenmodell v1.0 (44 Entities) |

### Decision

Drizzle ORM für Schema-Definition, Type-Safe Queries und Migrationen. Drizzle bietet SQL-nahe Syntax (kein Abstraktions-Overhead), volle TypeScript-Typisierung, und native PostgreSQL-Feature-Unterstützung (RLS, JSONB-Operatoren, Custom Enums). Raw SQL für komplexe Audit-Trail-Trigger und RLS-Policies.

### Evaluated Alternatives

| **Option** | **Advantages** | **Disadvantages** | **Choice** |
| --- | --- | --- | --- |
| **Drizzle ORM** | SQL-nah, kein Query-Overhead, TypeScript-native Typen, Schema = Single Source of Truth, exzellente PostgreSQL-Unterstützung | Jünger als Prisma, kleinere Community | **✅** |
| **Prisma** | Größte Community, Prisma Studio, intuitive Syntax | Eigene Query Engine (Performance-Overhead), RLS-Support begrenzt, Custom Enums umständlich | — |
| **Kysely** | Type-safe Query Builder, sehr performant | Kein Schema-Management, keine Migrationen, mehr Boilerplate | — |
| **Raw SQL + pg** | Maximale Kontrolle, beste Performance | Keine Type-Safety, kein Schema-Management, fehleranfällig | — |

### Consequences

Schema-Definitionen in packages/db/schema/*.ts (ein File pro Domäne: risk.ts, process.ts, audit.ts, etc.). Drizzle Kit für Migrationen (drizzle-kit generate + drizzle-kit migrate). Custom SQL-Migrationen für RLS-Policies, Audit-Trail-Trigger und Hash-Ketten-Funktion. Zod-Schemas werden aus Drizzle-Typen generiert (drizzle-zod) für API-Validierung. Prepared Statements für häufige Queries.

## ADR-007: Authentication & Authorization (SUPERSEDED — See ADR-007-rev1.md)

| **ADR-ID** | **007** |
| --- | --- |
| **Title** | **Auth.js (Self-Hosted) + Custom RBAC with Three Lines of Defense Model** |
| **Status** | **Accepted (Rev. 1)** |
| **Date** | 2026-03-23 |

> **This ADR has been revised.** The original decision for Clerk has been replaced by Auth.js (self-hosted).
> See `docs/ADR-007-rev1.md` for the full updated decision, rationale, architecture, and migration path.

### Key Change

Clerk (US cloud auth service) replaced by Auth.js (self-hosted) due to data sovereignty requirements. A GRC platform enforcing ISO 27001, NIS2, and GDPR must not depend on third-party cloud services for core authentication. Auth is encapsulated behind a provider interface (`packages/auth`) for future migration to Keycloak/Authentik (~3 days effort).

## ADR-008: AI Strategy

| **ADR-ID** | **008** |
| --- | --- |
| **Title** | **Claude API (Cloud) + Local Models (Privacy-Sensitive)** |
| **Status** | ** Accepted ** |
| **Date** | 2026-03-22 |
| **Context** | G-12: KI-Funktionen, P-08: KI-Prozessgenerierung, E-08: Monte Carlo, O-07: Horizon Scanning |

### Decision

Primär Claude API (Sonnet/Opus) für: BPMN-Generierung aus Freitext (P-08), Risiko-Analyse und Control-Empfehlungen, Cross-Framework-Mapping-Vorschläge, Regulatory Change Detection (O-07), Audit-Bericht-Zusammenfassungen. Für Privacy-sensitive Operationen (z.B. DSFA-Analyse mit Personenbezug): lokale Modelle via Ollama (Llama 3, Mistral). MCP-kompatible Architektur für Tool-Use.

### Evaluated Alternatives

| **Option** | **Advantages** | **Disadvantages** | **Choice** |
| --- | --- | --- | --- |
| **Claude API + lokale Modelle** | Beste Reasoning-Qualität, MCP-nativ, DSGVO-Compliance durch lokale Modelle für sensible Daten | API-Kosten, Latenz bei komplexen Prompts, lokale Modelle = GPU-Infrastruktur | **✅** |
| **Nur Claude API** | Einfachste Integration, konsistente Qualität | DSGVO-Bedenken bei personenbezogenen Daten, Vendor-Lock-in | — |
| **OpenAI GPT-4** | Großes Ökosystem, Function Calling | Kein MCP, US-Datenverarbeitung, DSGVO-Risiko | — |
| **Nur lokale Modelle** | Volle Datenkontrolle | Schlechtere Qualität bei komplexen GRC-Aufgaben, GPU-Kosten | — |

### Consequences

KI-Abstraktionsschicht mit Provider-Interface: jeder KI-Aufruf geht durch einen Router, der basierend auf Datenklassifikation (enthält personenbezogene Daten? → lokal, sonst → Claude API) den Provider wählt. Prompt-Templates pro Use Case in packages/ai/prompts/. MCP-Server-Implementierung für Tool-Use: Claude kann Risiken erstellen, Controls vorschlagen, Frameworks mappen. Kosten-Tracking pro Org für Budget-Modul (O-10).

## ADR-009: Workflow Engine

| **ADR-ID** | **009** |
| --- | --- |
| **Title** | **Temporal.io for Long-Running GRC Workflows** |
| **Status** | ** Proposed ** |
| **Date** | 2026-03-22 |
| **Context** | G-09: Aufgaben, Eskalation, Termine; K-05: Automatisierte Kontrollworkflows; P-06: Genehmigungsworkflow |

### Decision

Temporal.io für langlebige, zustandsbehaftete Workflows: Audit-Kampagnen (Wochen/Monate), Kontrolltest-Zyklen, Genehmigungsworkflows, Eskalationsketten, Fristenverwaltung (72h DSGVO-Meldefrist, 30-Tage DSR-Frist). Temporal bietet durability (Workflows überleben Server-Neustarts), Retry-Logik, Timer und Cron-Schedules nativ.

### Evaluated Alternatives

| **Option** | **Advantages** | **Disadvantages** | **Choice** |
| --- | --- | --- | --- |
| **Temporal.io** | Durable Workflows, Timer/Cron nativ, TypeScript SDK, Replay-fähig, ideal für GRC-Fristen | Ops-Komplexität (eigener Cluster), Lernkurve | **✅** |
| **BullMQ (Redis)** | Einfach, bewährt für Job-Queues | Keine nativen Timer/Cron, kein Workflow-State, nicht durable über Monate | — |
| **Inngest** | Serverless Workflows, einfache API | Vendor-Lock-in, weniger Kontrolle, noch jung | — |
| **Eigene Engine (DB-basiert)** | Volle Kontrolle, kein externer Service | Fehleranfällig, Race Conditions, Skalierungsprobleme, monatelanges Engineering | — |

### Consequences

Temporal Cloud (managed) initial, später Self-Hosting möglich. Workflow-Definitionen in apps/worker/workflows/: AuditCampaignWorkflow, ControlTestCycleWorkflow, ApprovalWorkflow, DSRDeadlineWorkflow, DataBreachNotificationWorkflow, EscalationWorkflow. Activities kommunizieren mit der DB und senden Notifications (E-Mail, Teams, In-App). Fallback: Für Sprint 1 kann eine vereinfachte DB-basierte Queue als Brücke dienen, wenn Temporal-Setup zu aufwendig.

## ADR-010: API Design

| **ADR-ID** | **010** |
| --- | --- |
| **Title** | **REST-First + OpenAPI 3.1 + Webhooks** |
| **Status** | ** Accepted ** |
| **Date** | 2026-03-22 |
| **Context** | G-10: Offene REST-API, Integration ERP/HR/IT |

### Decision

REST-API als primäres Interface, dokumentiert mit OpenAPI 3.1 (auto-generiert aus Zod-Schemas). Webhooks für Event-getriebene Integrationen (z.B. Risiko-Statusänderung → ERP). Kein GraphQL in Phase 1 — REST deckt alle Use Cases ab, GraphQL optional in Phase 3 für komplexe Dashboard-Queries.

### Evaluated Alternatives

| **Option** | **Advantages** | **Disadvantages** | **Choice** |
| --- | --- | --- | --- |
| **REST + OpenAPI** | Universell verstanden, tooling-reich, OpenAPI = automatische Client-Generierung, Swagger UI | Over-Fetching bei komplexen Abfragen (mitigierbar durch Sparse Fields) | **✅** |
| **GraphQL** | Flexible Abfragen, kein Over-Fetching | Complexity Overhead, Caching schwieriger, N+1-Problem, Überdimensioniert für Phase 1 | — |
| **tRPC** | End-to-End Type Safety, kein Schema | Nur TypeScript-Clients, keine externen Integrationen | — |
| **gRPC** | Beste Performance, Streaming | Browser-Inkompatibel ohne Proxy, überdimensioniert | — |

### Consequences

URL-Muster: /api/v1/{entity}?org_id=...&status=...&page=...&limit=... — org_id wird aus Auth-Token extrahiert, nicht manuell übergeben. OpenAPI-Spec wird aus Zod-Schemas generiert (@asteasolutions/zod-to-openapi). Webhook-System: POST an konfigurierbare Endpunkte bei Statusänderungen, mit HMAC-Signatur und Retry-Logik. API-Versionierung über URL-Prefix (/api/v1/). Rate Limiting pro Org.

## ADR-011: Audit Trail Architecture

| **ADR-ID** | **011** |
| --- | --- |
| **Title** | **Append-Only Audit Log with Hash Chain + 3 Log Tables** |
| **Status** | ** Accepted ** |
| **Date** | 2026-03-22 |
| **Context** | G-07: Audit-Trail, DSGVO Art. 5, ISO 27001 A.12.4, A.9.4 |

### Decision

Drei separate Log-Tabellen: (1) audit_log für alle Business-Datenänderungen, (2) access_log für Auth-Events, (3) data_export_log für Downloads/Exporte. Alle drei sind append-only (kein UPDATE/DELETE via PostgreSQL RULE). audit_log nutzt SHA-256 Hash-Kette (previous_hash → entry_hash) für Tamper-Detection. Automatische Befüllung über PostgreSQL-Trigger auf allen Business-Tabellen.

### Design Principles

1. Vollständigkeit: Jede Änderung an jeder Business-Tabelle wird protokolliert — CRUD, Statusübergänge, Zuweisungen, Evidenz-Uploads, Lesebesttigungen, Kommentare, Verknüpfungen.

2. Unverfälschbarkeit: Append-only + Hash-Kette. Integritätsprüfung: SELECT * FROM audit_log WHERE entry_hash != compute_hash(...) findet Manipulationen.

3. Nachvollziehbarkeit: User-Snapshots (Name, Email) direkt im Log, damit die Historie auch nach User-Löschung vollständig bleibt. entity_title als Snapshot.

4. Performance: Partitionierung nach Monat (audit_log_2026_03, ...), Index auf (entity_type, entity_id, created_at), archivierbare Partitionen nach 10+ Jahren.

### Evaluated Alternatives

| **Option** | **Advantages** | **Disadvantages** | **Choice** |
| --- | --- | --- | --- |
| **DB-Trigger + Hash-Kette** | Automatisch, lückenlos, tamper-evident, keine Applikationsänderung nötig | Trigger-Performance bei Bulk-Ops, Hash-Kette = sequentiell | **✅** |
| **Applikations-Level Logging** | Flexibler, einfacher zu implementieren | Lücken möglich (vergessene Log-Calls), umgehbar | — |
| **Event Sourcing (komplett)** | Perfekte Historie, Replay möglich | Massive Komplexität, CQRS nötig, überdimensioniert für GRC | — |
| **Blockchain (extern)** | Kryptographisch beweisbar | Overkill, Infrastruktur-Overhead, keine Markt-Referenz in GRC | — |

### Consequences

DB-Trigger-Funktion: audit_trigger() wird auf jeder Business-Tabelle als AFTER INSERT OR UPDATE OR DELETE Trigger registriert. Die Funktion berechnet den Diff (OLD vs NEW als JSONB), holt den previous_hash, berechnet entry_hash und fügt den Log-Eintrag ein. Für Bulk-Operationen: eine metadata.bulk_operation_id gruppiert zusammengehörige Änderungen. API-Endpunkt: GET /api/v1/audit-log?entity_type=risk&entity_id=... liefert die vollständige Historie eines Objekts. Frontend: Timeline-Komponente zeigt alle Änderungen chronologisch an jedem Objekt.

## ADR-012: Deployment & Infrastructure

| **ADR-ID** | **012** |
| --- | --- |
| **Title** | **Docker + Kubernetes + CI/CD via GitHub Actions** |
| **Status** | ** Proposed ** |
| **Date** | 2026-03-22 |
| **Context** | G-05: Cloud (SaaS) und On-Prem, Multi-Entity Deployment |

### Decision

Docker-Container für alle Services (Web, Worker, Temporal). Kubernetes (K8s) für Orchestrierung im Cloud-Betrieb. Docker Compose für On-Premises-Kunden und lokale Entwicklung. CI/CD via GitHub Actions: Lint → Test → Build → Deploy. Infrastructure as Code mit Terraform/Pulumi.

### Evaluated Alternatives

| **Option** | **Advantages** | **Disadvantages** | **Choice** |
| --- | --- | --- | --- |
| **Docker + K8s** | Skalierbar, portable, On-Prem und Cloud identisch, Health Checks, Rolling Updates | K8s-Komplexität, DevOps-Know-how nötig | **✅** |
| **Vercel + Serverless** | Zero-Ops für Frontend, Auto-Scaling | Kein On-Prem möglich (G-05), Vendor-Lock-in, Temporal nicht deploybar | — |
| **AWS ECS / Fargate** | Managed Container, weniger Ops als K8s | AWS-Lock-in, kein einfaches On-Prem | — |
| **Bare Metal / VMs** | Maximale Kontrolle, günstig | Kein Auto-Scaling, manuelle Updates, hoher Ops-Aufwand | — |

### Consequences

Drei Container-Images: (1) grc-web (Next.js + API), (2) grc-worker (Hono.js + Temporal Worker), (3) grc-migration (Drizzle Kit Migrations). Helm Chart für K8s-Deployment mit konfigurierbaren Values (Replicas, Resource Limits, Ingress). Docker Compose für On-Prem mit PostgreSQL, Temporal, Redis als Sidecar-Services. GitHub Actions Pipeline: PR → Lint + Unit Tests → Merge → Build Docker Images → Deploy to Staging → E2E Tests → Deploy to Production. Hosting-Empfehlung Phase 1: Hetzner Cloud (DSGVO-konform, deutsche Rechenzentren, kosteneffizient) oder Deutsche Telekom Open Telekom Cloud.

# Dependencies Between ADRs

ADR-001 (RLS) → ADR-005 (PostgreSQL) → ADR-006 (Drizzle): RLS setzt PostgreSQL voraus, Drizzle muss RLS-Policies als Raw SQL Migrationen unterstützen.

ADR-002 (Next.js) → ADR-004 (Node.js): Next.js läuft auf Node.js, Monorepo-Struktur teilt TypeScript-Typen.

ADR-003 (bpmn.js) → ADR-002 (React): bpmn.js wird als React-Komponente eingebettet.

ADR-007 (Clerk) → ADR-011 (Audit-Trail): Auth-Events fließen in AccessLog, User-Snapshots in AuditLog.

ADR-008 (KI) → ADR-005 (pgvector): Embeddings werden in PostgreSQL gespeichert.

ADR-005 (TimescaleDB) → KRI (E-10) + CCM (Phase 2) + Monte Carlo (E-08): Zeitreihen-Daten in Hypertables mit Continuous Aggregates für Dashboards.

ADR-009 (Temporal) → ADR-012 (Docker/K8s): Temporal läuft als eigener Container im K8s-Cluster.

ADR-011 (Audit-Trail) → ADR-005 (PostgreSQL): Append-only Rules, Trigger-Funktionen, Partitionierung sind PostgreSQL-native Features.

# Next Steps

**1. **ADR-009 (Temporal) validieren: Proof-of-Concept für einen Genehmigungsworkflow und einen DSR-Frist-Timer aufsetzen. Fallback-Option (DB-Queue) für Sprint 1 bereithalten.

**2. **ADR-012 (Deployment) validieren: Hetzner Cloud vs. OTC Kostenvergleich, K8s-Cluster-Sizing für 5 Entities mit ~100 Usern.

**3. **PRD Sprint 1 erstellen: Walking Skeleton mit Auth → Org-Auswahl → Dashboard → Risk Register als End-to-End-Proof.

**4. **Monorepo aufsetzen: Turborepo + apps/web + apps/worker + packages/db + packages/ui + packages/shared + packages/ai.

**5. **PostgreSQL Schema generieren: Drizzle-Schema aus Datenmodell v1.0 ableiten, RLS-Policies, Audit-Trigger.

**6. **Seed-Daten vorbereiten: ISO 27001:2022, NIS2, BSI Grundschutz Kompendium als Framework-Einträge.