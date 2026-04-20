# ARCTOS — Audit, Risk, Compliance & Trust Operating System

Self-hosted GRC & BPM SaaS platform for multi-entity corporations. 86 sprints, 9 core modules, 29 compliance frameworks, 2,000+ catalog entries, 401 cross-framework mappings.

## Quick Start (One Command)

```bash
git clone <repo-url> && cd grc-platform
npm run setup
npm run dev
```

**Login:** `admin@arctos.dev` / `admin123`

The setup script handles everything: dependencies, database, migrations, seeds, catalogs, and demo data.

### What `npm run setup` does

1. Checks prerequisites (Node.js 22+, psql)
2. Creates `.env` from template with generated secrets
3. Installs npm dependencies
4. Starts PostgreSQL via Docker Compose (if not running)
5. Creates database and extensions
6. Runs 25 Drizzle migrations + 45 custom SQL migrations
7. Creates `grc_app` role for RLS
8. Seeds foundation data (organizations, users, roles)
9. Seeds 29 catalog frameworks (2,000+ entries)
10. Seeds 401 cross-framework mappings
11. Seeds comprehensive demo data (300 rows across all modules)
12. Builds i18n message bundles

### Prerequisites

- **Node.js 22+** and npm 11+
- **PostgreSQL 16** with TimescaleDB (via Docker or native)
- **Docker** (optional — only needed if PostgreSQL isn't already running)

### Manual Setup (if you prefer)

```bash
# 1. Dependencies
npm install

# 2. Environment
cp .env.example .env
# Edit .env — generate AUTH_SECRET: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Database (choose one)
docker compose up -d                    # Option A: Docker
# OR: create DB manually with psql      # Option B: Native PostgreSQL

# 4. Migrations + Seeds
npm run db:migrate
npm run db:seed
npm run db:seed:demo

# 5. Start
npm run dev
```

## Demo Data

The setup seeds a complete demo scenario for **Meridian Holdings GmbH** — a German holding company:

| Module     | Demo Data                                                       |
| ---------- | --------------------------------------------------------------- |
| **ERM**    | 5 risks, 5 KRIs with 6-month trend data, 4 risk treatments      |
| **ICS**    | 8 controls (ISO 27001 mapped), 2 test campaigns, 6 test results |
| **ISMS**   | 10 assets, 5 threats, 4 vulnerabilities, 8 SoA entries          |
| **DPMS**   | 5 RoPA entries, 2 DPIAs, 3 data breaches, 2 DSRs                |
| **Audit**  | 1 audit plan, 2 audits (ISO pre-audit + NIS2 gap), 5 findings   |
| **BCMS**   | 2 BIA assessments, 1 BCP, 2 crisis scenarios, 1 BC exercise     |
| **TPRM**   | 5 vendors, 3 contracts, 4 SLAs, 1 LkSG assessment               |
| **BPM**    | 6 processes with steps                                          |
| **DMS**    | 8 policy documents                                              |
| **Budget** | 5 hierarchical budgets (2M EUR total)                           |

## Compliance Frameworks

29 seeded catalogs with target module filtering:

| Framework              | Type    | Entries | Modules          |
| ---------------------- | ------- | ------- | ---------------- |
| ISO 27001:2022 Annex A | Control | 97      | ISMS             |
| GDPR (2016/679)        | Control | 106     | DPMS, ISMS       |
| NIS2 (2022/2555)       | Control | 50      | ISMS, BCMS, ERM  |
| DORA (2022/2554)       | Control | 53      | ISMS, BCMS, TPRM |
| BSI IT-Grundschutz     | Control | 160     | ISMS, ICS        |
| EU AI Act (2024/1689)  | Control | 63      | ISMS             |
| MITRE ATT&CK v15.1     | Risk    | 266     | ISMS             |
| TISAX (VDA ISA 6.0)    | Control | 110     | ISMS, TPRM       |
| NIST CSF 2.0           | Control | 131     | ISMS, ICS, ERM   |
| COBIT 2019             | Control | 45      | ICS, Audit       |
| ... and 19 more        |         |         |                  |

401 cross-framework mappings enable "implement once, satisfy many" — one ISO 27001 control can satisfy NIS2, BSI, TISAX, and DORA requirements simultaneously.

## Tech Stack

| Layer    | Technology                                                         |
| -------- | ------------------------------------------------------------------ |
| Frontend | Next.js 15, React 19, Tailwind CSS 4, shadcn/ui, recharts, bpmn-js |
| Backend  | Node.js 22, TypeScript, Hono.js (Worker)                           |
| Database | PostgreSQL 16 + TimescaleDB, Drizzle ORM, RLS                      |
| Auth     | Auth.js v5 (self-hosted) + Custom RBAC + Three Lines of Defense    |
| AI       | Claude API + OpenAI + Gemini + Ollama (local)                      |
| Email    | Resend SDK + React Email (27 templates, DE/EN)                     |
| CI/CD    | GitHub Actions, CodeQL, Dependabot                                 |

## Project Structure

```
arctos/
├── apps/
│   ├── web/            Next.js 15 (Frontend + API routes)
│   └── worker/         Hono.js (Cron jobs, background tasks)
├── packages/
│   ├── db/             Drizzle schema, migrations, seeds
│   ├── shared/         Zod schemas, TypeScript types
│   ├── auth/           Auth.js adapter, RBAC middleware
│   ├── ai/             Multi-provider AI router
│   ├── email/          Resend service + templates
│   ├── graph/          Knowledge graph, dependency analysis
│   ├── reporting/      PDF/Excel report generation
│   └── ui/             shadcn/ui components
├── scripts/
│   ├── setup.sh        One-command setup
│   └── seed-demo.sh    Re-seed demo data
└── .github/            CI/CD workflows
```

## NPM Scripts

| Script                 | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `npm run setup`        | Full setup (deps, DB, migrations, seeds, i18n) |
| `npm run dev`          | Start dev server (web + worker)                |
| `npm run build`        | Production build                               |
| `npm run db:migrate`   | Run database migrations                        |
| `npm run db:seed`      | Seed foundation data                           |
| `npm run db:seed:demo` | Seed demo data only                            |
| `npm run test`         | Run all tests                                  |

## Security

- Row-Level Security on all business tables
- Append-only audit log with SHA-256 hash chain
- AES-256-GCM encryption for whistleblowing data
- CodeQL + Dependabot + secret scanning enabled
- API routes return 401 JSON (never redirect to HTML login)

## Environment Variables

See `.env.example` for all variables. Required:

| Variable            | Description                                         |
| ------------------- | --------------------------------------------------- |
| `DATABASE_URL`      | PostgreSQL connection string                        |
| `AUTH_SECRET`       | Session encryption key (auto-generated by setup)    |
| `WB_ENCRYPTION_KEY` | Whistleblowing encryption (auto-generated by setup) |

Optional: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `AZURE_AD_*`

## License

Proprietary. All rights reserved.
