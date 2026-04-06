# ARCTOS — Local Development Setup

## Prerequisites

- **Node.js** ≥ 22.0 (`node -v`)
- **PostgreSQL** ≥ 16 with extensions: `pgcrypto`, `uuid-ossp`
- **npm** ≥ 11

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/agatho/grc-platform.git
cd grc-platform
npm install

# 2. Create .env from template
cp .env.example .env
# Edit .env: set DATABASE_URL to your PostgreSQL connection string
# Default: postgresql://grc:grc_dev_password@localhost:5432/grc_platform

# 3. Copy .env for Next.js
cp .env apps/web/.env.local

# 4. Set up the database
# Create the database and user (adjust for your PostgreSQL setup):
psql -U postgres -c "CREATE USER grc WITH PASSWORD 'grc_dev_password' SUPERUSER;"
psql -U postgres -c "CREATE DATABASE grc_platform OWNER grc;"
psql -U postgres -d grc_platform -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
psql -U postgres -d grc_platform -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# 5. Run migrations (from packages/db directory)
cd packages/db
DATABASE_URL="postgresql://grc:grc_dev_password@localhost:5432/grc_platform" npx drizzle-kit migrate
cd ../..
# Or alternatively, apply all SQL files:
# for f in packages/db/drizzle/*.sql; do psql -U grc -d grc_platform -f "$f"; done

# 6. Seed base data (organizations, users, modules)
npm run db:seed

# 7. Seed catalogs + demo data (risks, controls, documents, etc.)
npm run db:seed-all

# 8. Start the development server
npm run dev
# Open http://localhost:3000
```

## Login Credentials

| User | Email | Password | Role |
|------|-------|----------|------|
| Platform Admin | `admin@arctos.dev` | `admin123` | Admin (all orgs) |
| DPO ARC-TX | `dpo.arctx@arctos.dev` | `arctos2026!` | DPO (Arctis Textil) |
| DPO ARC-WW | `dpo.arcww@arctos.dev` | `arctos2026!` | DPO (Borealis Workwear) |

## Demo Data Overview

After running `db:seed` + `db:seed-all`, the platform contains:

| Entity | Count | Examples |
|--------|-------|---------|
| Organizations | 8 | Meridian Holdings (Holding), NovaTec, Arctis Group + 5 subsidiaries |
| Risks | 20+ | DSGVO breach, ransomware, supply chain, NIS2, DORA, ESG |
| Controls | 18+ | Patch management, PAM, security awareness, NIS2 response |
| Findings | 7+ | PAM gaps, patch SLA violations, NIS2 process untested |
| Documents | 8 | Policies, guidelines, procedures |
| Tasks | 10 | Across CRITICAL/HIGH/MEDIUM priorities |
| Assets | 10 | IT systems, servers, applications |
| Vendors | 5 | Third-party service providers |
| Processes | 3 | Business processes |
| KRIs | 5 | Key Risk Indicators with measurements |
| Catalogs | 11 | ISO 27002, NIST CSF 2, BSI, CIS, Cambridge Taxonomy |
| Catalog Entries | 487 | Framework controls and risk categories |
| Modules | 12 | All enabled for all organizations |

## Catalog Frameworks

29 frameworks seeded including: ISO 27001/27002, NIST CSF 2.0, BSI Grundschutz, CIS Controls v8, GDPR, NIS2, DORA, AI Act, COBIT 2019, COSO ERM, MITRE ATT&CK, TISAX, ESRS/CSRD, and more.

## Useful Commands

```bash
# Development
npm run dev                  # Start all packages (web + worker)
npm run build                # Production build

# Database
npm run db:seed              # Seed orgs, users, modules
npm run db:seed-all          # Seed catalogs + demo data
npm run db:migrate           # Run Drizzle migrations

# Testing
npm run test                 # Unit tests (Vitest)
cd apps/web && npx playwright test  # E2E tests (requires running server)

# Database Studio
cd packages/db && npx drizzle-kit studio  # Visual DB browser
```

## Themes

Switch via user menu (PA avatar → top right):
- **Arctic** — Light theme with warm stone neutrals (default)
- **Obsidian** — Dark theme with navy/charcoal tones
- **Polar** — High-contrast pure white/black

## i18n

Toggle DE↔EN via user menu. Default language is German. All 109 sidebar pages, forms, and empty states are fully translated.

## Architecture

```
apps/web/     → Next.js 15 (App Router, Turbopack dev)
apps/worker/  → Hono.js (background jobs, requires RESEND_API_KEY)
packages/db/  → Drizzle ORM (338 tables, 76 migrations)
packages/auth/→ Auth.js v5 (credentials + optional Azure AD SSO)
packages/ui/  → shadcn/ui components
packages/shared/ → Zod schemas, types, constants
```

## Troubleshooting

### Tailwind CSS not loading (unstyled pages)
Ensure `apps/web/postcss.config.mjs` exists with:
```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```
And `@tailwindcss/postcss` is installed: `npm install @tailwindcss/postcss`

### db:migrate fails with "url: undefined"
The `dotenv-cli` can't find `.env`. Either:
- Run from the repo root with the env var: `DATABASE_URL=... npx drizzle-kit migrate`
- Or ensure `.env` exists in the repo root

### Worker crashes with "Missing API key"
The worker requires `RESEND_API_KEY`. For local dev, set `EMAIL_ENABLED=false` in `.env` — the worker crash is non-blocking (web app works fine without it).

### "Modul aktivieren" shown instead of page content
Module configs are empty. Run `npm run db:seed` which auto-enables all modules for all orgs, then reload the page.
