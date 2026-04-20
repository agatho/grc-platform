# ARCTOS — Deploy Guide

## Quick Deploy (5 minutes)

```bash
# 1. Copy deploy files to your server
scp -r deploy/ user@your-server:~/arctos/
ssh user@your-server
cd ~/arctos

# 2. Configure environment
cp .env.sample .env
nano .env   # Fill in DB_PASSWORD, AUTH_SECRET, WB_ENCRYPTION_KEY

# 3. Generate secrets (run on any machine with Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Use the output for AUTH_SECRET and WB_ENCRYPTION_KEY

# 4. Start everything
docker compose up -d

# 5. Open browser
# http://your-server:3000
# Login: admin@arctos.dev / admin123
```

## What Happens on First Start

1. PostgreSQL starts with TimescaleDB + required extensions
2. Redis starts for caching
3. ARCTOS web app waits for PostgreSQL to be healthy
4. Database migrations run automatically (70 migration files)
5. If `RUN_SEEDS=true`: catalogs, frameworks, and demo data are seeded
6. Application starts on port 3000

## After First Start

Edit `.env` and set `RUN_SEEDS=false` to skip seeding on subsequent restarts:

```bash
sed -i 's/RUN_SEEDS=true/RUN_SEEDS=false/' .env
```

## Requirements

- Docker Engine 24+ with Compose V2
- 2 GB RAM minimum (4 GB recommended)
- 10 GB disk space

## Commands

```bash
# Start
docker compose up -d

# View logs
docker compose logs -f web

# Stop
docker compose down

# Update to latest image
docker compose pull web
docker compose up -d web

# Reset database (WARNING: destroys all data)
docker compose down -v
docker compose up -d
```

## Files

| File                  | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| `docker-compose.yml`  | Full stack definition (web + postgres + redis)     |
| `.env.sample`         | Environment template — copy to `.env`              |
| `init-extensions.sql` | PostgreSQL extensions (auto-runs on first DB init) |

## Architecture

```
┌─────────────────────────────────────────┐
│  Browser → http://your-server:3000      │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│  ARCTOS Web (Next.js standalone)        │
│  - Runs migrations on startup           │
│  - Seeds data if RUN_SEEDS=true         │
└──────┬──────────────────┬───────────────┘
       │                  │
┌──────▼──────┐   ┌──────▼──────┐
│  PostgreSQL │   │    Redis    │
│  TimescaleDB│   │   7-alpine  │
│  Port 5432  │   │  Port 6379  │
└─────────────┘   └─────────────┘
```
