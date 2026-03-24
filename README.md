# GRC & BPM SaaS Platform

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL + Redis
docker compose up -d

# 3. Run database migrations
npm run db:migrate

# 4. Start development
npm run dev
```

## Architecture

- **ADR-001**: Multi-Entity via PostgreSQL RLS
- **ADR-002**: Next.js 15 + React 19 + Tailwind + shadcn/ui
- **ADR-003**: bpmn.js for BPMN 2.0 modeling
- **ADR-004**: Node.js 22 + TypeScript 5
- **ADR-005**: PostgreSQL 16 + pgvector + TimescaleDB
- **ADR-006**: Drizzle ORM
- **ADR-007**: Clerk (Auth) + Custom RBAC
- **ADR-011**: Append-only Audit-Trail with hash chain

## Project Structure

```
grc-platform/
├── apps/
│   ├── web/        → Next.js 15 (Frontend + API)
│   └── worker/     → Hono.js (Background Jobs)
├── packages/
│   ├── db/         → Drizzle Schema + SQL
│   ├── ui/         → shadcn/ui Components
│   ├── shared/     → Zod Schemas + Types
│   ├── auth/       → Clerk + RBAC Middleware
│   └── ai/         → Claude API + Ollama Router
└── docker-compose.yml
```

## Sprint 1: Foundation Layer (63 SP)
- Epic 1: Multi-Entity Organization (G-01, G-02)
- Epic 2: Authentication via Clerk (G-04)
- Epic 3: RBAC + Three Lines Model (G-03)
- Epic 4: Audit Trail (G-07)
- Epic 5: UI Shell (G-06, G-08, G-11)
