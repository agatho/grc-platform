# Architecture Overview

Diagramme rendern in GitHub via Mermaid.

## Deployment (Hetzner)

```mermaid
graph TB
  User[Browser / API-Client]
  subgraph Hetzner_Host["Hetzner Dedicated (ubuntu-16gb-fsn1-1)"]
    Caddy[Caddy Reverse-Proxy<br/>TLS, :443]
    subgraph Tenants["Per-Tenant Containers"]
      WebMain[web<br/>grc_platform]
      WebDaimon[web-daimon<br/>grc_daimon]
      WebEtc[...]
    end
    PG[(PostgreSQL 16<br/>TimescaleDB, pgvector, RLS)]
    Redis[(Redis)]
  end
  subgraph Backup["Backup-Strategie (ADR-014/015)"]
    Local[/opt/arctos/backups/<br/>30d Rotation]
    B2[Backblaze B2<br/>eu-central, append-only]
  end

  User -->|HTTPS| Caddy
  Caddy -->|arctos.charliehund.de| WebMain
  Caddy -->|daimon.arctos.charliehund.de| WebDaimon
  WebMain --> PG
  WebDaimon --> PG
  WebMain --> Redis
  PG -. nightly pg_dump .-> Local
  Local -. rclone sync .-> B2
```

## Request Flow (Authenticated API)

```mermaid
sequenceDiagram
  actor User
  participant Caddy
  participant Middleware
  participant Route as API Route
  participant RLS as RLS Context
  participant DB as PostgreSQL

  User->>Caddy: POST /api/v1/audit-mgmt/audits
  Caddy->>Middleware: proxy_pass
  Middleware->>Middleware: ensure X-Request-ID
  Middleware->>Middleware: verify JWT (edge-safe)
  alt JWT invalid
    Middleware-->>User: 401 JSON
  else JWT valid
    Middleware->>Route: forward
    Route->>Route: withAuth("admin", "auditor") → ctx
    Route->>Route: requireModule("audit", ctx.orgId)
    Route->>Route: Zod validation
    Route->>RLS: set_config('app.current_org_id', ctx.orgId)
    RLS->>DB: BEGIN + INSERT ...
    DB->>DB: audit_trigger() SHA-256 hash chain (ADR-011)
    RLS->>RLS: COMMIT
    Route-->>User: 201 { data: ... } + X-Request-ID
  end
```

## Multi-Entity Isolation (ADR-001)

```mermaid
graph LR
  subgraph "Session + JWT"
    JWT[JWT.user.roles = [<br/>  {orgId: ccc4..., role: admin},<br/>  {orgId: 9425..., role: admin}<br/>]]
    Cookie[Cookie arctos-org-id<br/>= 9425...]
  end
  subgraph "Server-side Resolution"
    Session[session.user.currentOrgId<br/>= cookie ? cookie : roles[0]]
  end
  subgraph "RLS Policies"
    Query[SELECT * FROM risk]
    Policy["WHERE org_id = current_setting('app.current_org_id')"]
  end

  JWT --> Session
  Cookie --> Session
  Session -->|set_config| Policy
  Query --> Policy
```

## Audit-ERM Feedback Loop (Iter 1-3)

```mermaid
graph TB
  Audit[Audit Execution]
  Checklist[Checklist Item]
  Finding[Finding<br/>riskId, controlId optional]
  Treatment[risk_treatment<br/>linked via workItemId]
  Risk[Risk Register<br/>needsReassessment derived]
  Report[Audit Report<br/>affectedRisks, affectedControls]
  KRI[Platform KRIs<br/>unlinkedFindings, overdueTreatments]
  Control[Control<br/>audit-impact endpoint]
  Maturity[Control Maturity<br/>suggestedMaturityDelta]

  Audit --> Checklist
  Checklist -->|nonconforming| Finding
  Finding -->|sync-treatment| Treatment
  Treatment --> Risk
  Finding -->|riskId| Risk
  Finding -->|controlId| Control
  Control --> Maturity
  Audit --> Report
  Finding --> Report
  Risk --> Report
  Finding --> KRI
  Treatment --> KRI
```

## Monorepo

```mermaid
graph LR
  subgraph apps
    Web[apps/web<br/>Next.js 15]
    Worker[apps/worker<br/>Hono background jobs]
  end
  subgraph packages
    DB[packages/db<br/>Drizzle schema + migrations]
    Auth[packages/auth<br/>Auth.js + RBAC]
    Shared[packages/shared<br/>Zod schemas + constants]
    UI[packages/ui<br/>shadcn/ui components]
    Email[packages/email<br/>Resend + React Email]
    AI[packages/ai<br/>Claude API + Ollama]
    Events[packages/events<br/>event bus + webhooks]
    Reporting[packages/reporting<br/>PDF/Excel/CSV]
    Graph[packages/graph<br/>knowledge graph]
    Automation[packages/automation<br/>rule engine]
  end

  Web --> DB
  Web --> Auth
  Web --> Shared
  Web --> UI
  Web --> Email
  Web --> AI
  Worker --> DB
  Worker --> Shared
  Worker --> Events
  Auth --> DB
  Auth --> Shared
```

## Migration Lifecycle (ADR-014)

```mermaid
stateDiagram-v2
  [*] --> Development: Drizzle-Schema-TS-File geändert
  Development --> GenerateMigration: drizzle-kit generate
  GenerateMigration --> drizzle_folder: SQL in packages/db/drizzle/
  drizzle_folder --> PR_Review: git push + PR
  PR_Review --> CI_Green: Tests, migration-policy, schema-drift
  CI_Green --> Merge_Main: Review-Approval
  Merge_Main --> Manual_Deploy: Ops runs arctos-update
  Manual_Deploy --> Entrypoint: docker-entrypoint.sh
  Entrypoint --> DB_Applied: psql -f for drizzle/*.sql + src/migrations/*.sql
  DB_Applied --> Verify: /api/v1/health/schema-drift
  Verify --> [*]: healthy=true

  note right of drizzle_folder: ADR-014 Phase 3:<br/>neue Files NUR hier
  note right of DB_Applied: ON_ERROR_STOP=0<br/>idempotent
```

## ADRs im Überblick

Siehe [adr-index.md](./adr-index.md) für alle 15 Architektur-Entscheidungen + Links.
