# GRC Platform — Development Environment Guide

## Architektur-Übersicht

```
┌──────────────────────────────────────────────────────────┐
│  WINDOWS ARBEITSPLATZ                                    │
│  ┌─────────────────────────────────────────────┐         │
│  │  VS Code + Remote-SSH Extension             │         │
│  │  → Verbindet sich zur Linux-VM              │         │
│  │  → Code-Editing, Terminal, Debugging        │         │
│  └──────────────────┬──────────────────────────┘         │
│                     │ SSH                                 │
└─────────────────────┼────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────┐
│  LINUX DEV-VM (Ubuntu 26.04 LTS Beta, 8 Cores, 32GB, 256GB)  │
│                                                          │
│  ┌────────────┐ ┌────────────┐ ┌──────────────────────┐  │
│  │ Node.js 25 │ │ Claude Code│ │ Turborepo            │  │
│  └────────────┘ └────────────┘ └──────────────────────┘  │
│                                                          │
│  ┌─── Docker ────────────────────────────────────────┐   │
│  │  ┌────────────────┐ ┌───────┐ ┌────────────────┐  │   │
│  │  │ PostgreSQL 18   │ │ Redis │ │ pgAdmin        │  │   │
│  │  │ + TimescaleDB   │ │  7    │ │ (Port 5050)    │  │   │
│  │  │ + pgvector      │ │       │ │                │  │   │
│  │  │ (Port 5432)     │ │(6379) │ │                │  │   │
│  │  └────────────────┘ └───────┘ └────────────────┘  │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── Projekt ───────────────────────────────────────┐   │
│  │  ~/projects/grc-platform/                         │   │
│  │  ├── apps/web/      (Next.js, Port 3000)          │   │
│  │  ├── apps/worker/   (Hono.js, Port 3001)          │   │
│  │  └── packages/      (db, shared, auth, ui, ai)    │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── Optional ──────────────────────────────────────┐   │
│  │  GitHub Actions Self-Hosted Runner                │   │
│  │  (läuft als systemd-Service)                      │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
                      │
                      │ git push → GitHub Actions
                      ▼
┌──────────────────────────────────────────────────────────┐
│  GITHUB                                                  │
│  ┌─── CI Pipeline ───────────────────────────────────┐   │
│  │  Lint → Type Check → Unit Tests → Integration     │   │
│  │  Tests (mit TimescaleDB) → Security Scan → Build  │   │
│  └───────────────────────────────────────────────────┘   │
│  ┌─── CD Pipeline ───────────────────────────────────┐   │
│  │  Staging (Dev-VM via SSH) → Production (Hetzner)  │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## Phase 1: VM aufsetzen

### 1.1 Ubuntu 24.04 Server installieren

Erstellen Sie eine VM mit folgenden Specs:

| Ressource | Empfehlung |
|-----------|-----------|
| OS | Ubuntu 26.04 LTS Beta Server (kein Desktop/GUI nötig) |
| CPU | 8 Cores |
| RAM | 32 GB |
| SSD | 256 GB |
| Netzwerk | Statische IP im internen Netz, SSH-Zugang von außen |

Bei der Installation: OpenSSH-Server aktivieren, alles andere minimal.

### 1.2 Setup-Script ausführen

Nach der Installation einloggen und das Setup-Script ausführen:

```bash
# Option A: Direkt vom Repo (wenn öffentlich)
curl -fsSL https://raw.githubusercontent.com/<org>/grc-platform/main/infra/dev-vm-setup.sh | sudo bash

# Option B: Script kopieren und ausführen
scp dev-vm-setup.sh grcdev@<vm-ip>:
ssh grcdev@<vm-ip>
sudo chmod +x dev-vm-setup.sh
sudo ./dev-vm-setup.sh
```

Das Script installiert automatisch:
- Docker Engine (nicht native Installation — keine Lizenzkosten)
- Node.js 25 LTS
- Claude Code CLI
- Turborepo
- PostgreSQL 18 + TimescaleDB + pgvector + Redis (Docker)
- pgAdmin (Docker, Port 5050)
- Git, UFW Firewall, Fail2ban
- Hilfreiche Bash-Aliase

### 1.3 SSH-Key einrichten (Windows → VM)

Auf Ihrem Windows-Rechner (PowerShell):

```powershell
# SSH-Key generieren (falls noch keiner existiert)
ssh-keygen -t ed25519 -C "grc-dev"

# Key auf die VM kopieren
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh grcdev@<vm-ip> "cat >> ~/.ssh/authorized_keys"

# Test
ssh grcdev@<vm-ip>
```

### 1.4 VS Code verbinden

1. VS Code auf Windows öffnen
2. Extension installieren: **Remote - SSH** (ms-vscode-remote.remote-ssh)
3. `F1` → "Remote-SSH: Connect to Host" → `grcdev@<vm-ip>`
4. VS Code öffnet ein neues Fenster, verbunden mit der VM
5. Terminal öffnen (`Ctrl+Backtick`) — Sie sind jetzt auf der VM

---

## Phase 2: Projekt starten

### 2.1 Repo klonen

```bash
cd ~/projects
git clone https://github.com/<org>/grc-platform.git
cd grc-platform
```

### 2.2 Dependencies installieren

```bash
npm install
```

### 2.3 Umgebungsvariablen

```bash
cp .env.example .env

# Editieren:
# - Clerk API Keys eintragen (von clerk.com Dashboard)
# - Anthropic API Key (für KI-Features)
# - DATABASE_URL sollte bereits korrekt sein:
#   postgresql://grc:grc_dev_password@localhost:5432/grc_platform
```

### 2.4 Datenbank-Schema laden

```bash
# Option A: Komplettes SQL-Schema direkt laden
psql postgresql://grc:grc_dev_password@localhost:5432/grc_platform < packages/db/sql/000_schema.sql

# Option B: Über Drizzle Migrations (empfohlen für laufende Entwicklung)
npm run db:migrate
```

### 2.5 Entwicklung starten

```bash
# Startet Next.js (Port 3000) + Worker (Port 3001) parallel
npm run dev
```

Erreichbar unter: `http://<vm-ip>:3000`

---

## Phase 3: CI/CD Pipeline

### 3.1 GitHub Repository Secrets einrichten

Im GitHub Repo unter Settings → Secrets and Variables → Actions:

**Secrets:**

| Name | Wert | Zweck |
|------|------|-------|
| `STAGING_HOST` | IP der Dev-VM | SSH-Deploy auf die VM |
| `STAGING_USER` | `grcdev` | SSH-User |
| `STAGING_SSH_KEY` | Inhalt von `~/.ssh/id_ed25519` | SSH-Authentifizierung |
| `CLERK_SECRET_KEY` | `sk_test_...` | Clerk Auth (für Tests) |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Claude API (optional für Tests) |

**Variables (Settings → Variables):**

| Name | Wert |
|------|------|
| `STAGING_HOST` | IP der Dev-VM (gleich wie Secret, aber für URL-Anzeige) |

### 3.2 Pipeline-Dateien ins Repo

Die zwei Pipeline-Dateien gehören ins Repo:

```
grc-platform/
└── .github/
    └── workflows/
        ├── ci.yml      # Lint → Test → Build (bei jedem Push/PR)
        └── cd.yml      # Deploy auf VM (nach erfolgreichem CI auf main)
```

### 3.3 CI-Pipeline: Was passiert bei jedem Push?

```
Push/PR auf main oder develop
  │
  ├─ Job 1: Lint & Type Check (2-3 Min)
  │   └─ ESLint, TypeScript strict mode
  │
  ├─ Job 2: Unit Tests (3-5 Min)
  │   └─ Vitest, Coverage Report
  │
  ├─ Job 3: Integration Tests mit DB (5-8 Min)
  │   ├─ TimescaleDB + pgvector als Service Container
  │   ├─ Migrations ausführen
  │   ├─ RLS-Isolation Tests (Cross-Tenant)
  │   └─ API-Endpunkt Tests
  │
  ├─ Job 4: Build Docker Images (3-5 Min)
  │   └─ Nur bei Push auf main (nicht bei PRs)
  │
  └─ Job 5: Security Scan (2 Min)
      └─ npm audit + TruffleHog (Secrets in Code)
```

### 3.4 CD-Pipeline: Wie wird deployed?

**Stufe 1 (Sprint 1-4): Dev-VM**
- Push auf `main` → CI erfolgreich → automatischer Deploy auf die Dev-VM
- SSH-Login → `git pull` → `npm ci` → `npm run db:migrate` → `turbo build` → PM2 restart
- Health Check: HTTP 200 auf Port 3000

**Stufe 2 (ab Sprint 5): Hetzner Cloud**
- Manueller Trigger via "Run workflow" auf GitHub
- Docker Images werden gepullt → Migrations → Rolling Update
- Zero-Downtime-Deployment

### 3.5 Optional: Self-Hosted Runner auf der VM

Statt GitHub-Hosted Runner (2.000 Min/Monat im Free-Plan) können Sie einen Self-Hosted Runner auf der Dev-VM installieren. Vorteile: schnellere Builds (kein Cold Start), direkter DB-Zugriff für Tests, kostenlos.

Anleitung: `~/actions-runner/INSTALL.md` auf der VM (wird vom Setup-Script erstellt).

---

## Phase 4: PM2 für Prozess-Management (auf der VM)

PM2 hält die App am Laufen, auch nach SSH-Disconnect oder VM-Reboot:

```bash
# Installieren
npm install -g pm2

# Apps starten
cd ~/projects/grc-platform
pm2 start apps/web/node_modules/.bin/next --name grc-web -- start -p 3000
pm2 start apps/worker/dist/index.js --name grc-worker

# Auto-Start bei Reboot
pm2 startup
pm2 save

# Nützliche Befehle
pm2 status          # Alle Prozesse anzeigen
pm2 logs grc-web    # Logs der Web-App
pm2 restart all     # Alles neu starten
pm2 monit           # Live-Monitoring
```

---

## Täglicher Workflow

```
1. VS Code auf Windows öffnen
2. Remote-SSH → grcdev@<vm-ip>
3. Terminal: cd ~/projects/grc-platform
4. git pull (falls Änderungen von CI/CD)
5. npm run dev (startet alles parallel)
6. Code schreiben, Tests laufen automatisch
7. git commit + git push → CI läuft auf GitHub
8. Bei merge auf main → automatischer Deploy auf VM
```

### Mit Claude Code

```bash
# In der VM (über VS Code Terminal oder direkt SSH)
cd ~/projects/grc-platform
claude

# Claude Code hat Zugriff auf:
# - Alle Projektdateien
# - PostgreSQL (über psql oder Drizzle)
# - systemd (für Service-Management)
# - Git (für Commits/Branches)
# - npm/turbo (für Builds/Tests)
```

---

## Checkliste: VM-Einrichtung

- [ ] Ubuntu 24.04 Server installiert (8 Cores, 32GB RAM, 256GB SSD)
- [ ] Statische IP zugewiesen
- [ ] `dev-vm-setup.sh` ausgeführt
- [ ] SSH-Key von Windows kopiert
- [ ] VS Code Remote-SSH getestet
- [ ] `systemctl ps` zeigt PostgreSQL + Redis als "healthy"
- [ ] `grc-db` Alias funktioniert (PostgreSQL Shell)
- [ ] pgAdmin erreichbar unter `http://<vm-ip>:5050`
- [ ] GitHub Repo erstellt
- [ ] `.github/workflows/ci.yml` und `cd.yml` gepusht
- [ ] GitHub Secrets konfiguriert
- [ ] Erster `npm run dev` erfolgreich auf Port 3000
- [ ] PM2 eingerichtet und `pm2 save` ausgeführt
- [ ] Optional: GitHub Actions Self-Hosted Runner installiert
