# ARCTOS Release Runbook

Konkrete Schritt-für-Schritt-Anleitung, wie ein ARCTOS-Release geschnitten, deployt und im Fehlerfall zurückgerollt wird. Im Zweifel **erst dieses Runbook, dann improvisieren**.

---

## 0. Vorbedingungen

| Anforderung                                                   | Check                             |
| ------------------------------------------------------------- | --------------------------------- |
| Du hast Push-Rechte auf `origin/main`                         | `gh auth status`                  |
| Du hast SSH-Zugang zum Hetzner-Server (`arctos@`…)            | `ssh arctos@<server>`             |
| GitHub Actions hat GHCR-Push-Permission (automatisch via PAT) | CI-Run `Build`-Job muss grün sein |
| Postgres-Volume wurde in den letzten 24 h gebackupt           | `deploy/db-backup.sh` cron-log    |
| Ein zweites Terminal-Fenster ist offen (rollback-ready)       | —                                 |

---

## 1. Pre-Flight (vor dem Tag)

1.1 **Alle Jobs grün** auf `main`:

```bash
gh run list --workflow=ci.yml --limit 1 --json conclusion,displayTitle
# → conclusion muss "success" sein
```

Fail → **stop**. Erst fixen, dann weiter.

1.2 **`CHANGELOG.md` aktualisiert** — `[Unreleased]` enthält keine offenen Einträge mehr; die neue Version hat ein Datum.

1.3 **`MIGRATIONS_KNOWN_ISSUES.md`** — offene Einträge sind entweder gefixt oder explizit auf die nächste Version vertagt.

1.4 **Lokaler smoke:**

```bash
cd apps/web && npm run build  # muss ohne Fehler durchgehen
npx playwright test e2e/ci-smoke.spec.ts  # muss grün sein (braucht laufenden Dev-Stack)
```

---

## 2. Tag schneiden

```bash
cd <repo>

# Letzten CI-Status holen und bestätigen
SHA=$(git rev-parse HEAD)
gh run list --commit "$SHA" --limit 1 --json conclusion

# Signed Tag
git tag -s v0.1.0-alpha -m "ARCTOS 0.1.0-alpha — first blocking-CI release"
git push origin v0.1.0-alpha
```

Sobald der Tag gepusht ist, triggert GHA den `Build`-Job erneut (falls über `tags` konfiguriert) und published das Image `ghcr.io/agatho/grc-platform/grc-web:<sha>` + `:latest`.

---

## 3. Image-Verifikation

```bash
# Digest des Release-Images notieren (wird später im Compose referenziert)
docker pull ghcr.io/agatho/grc-platform/grc-web:<sha>
docker inspect --format='{{index .RepoDigests 0}}' ghcr.io/agatho/grc-platform/grc-web:<sha>
# → ghcr.io/agatho/grc-platform/grc-web@sha256:abcdef...
```

Dieser Digest geht in `deploy/docker-compose.yml` (statt `:latest` — Reproduzierbarkeit).

Trivy-Scan im CI hat bereits CRITICAL/HIGH geblockt, bei Bedarf lokal verifizieren:

```bash
trivy image --severity CRITICAL,HIGH ghcr.io/agatho/grc-platform/grc-web@sha256:...
```

---

## 4. Deploy auf Hetzner

```bash
ssh arctos@<hetzner-ip>
cd /opt/arctos

# DB-Backup vor dem Deploy (manueller Zeitstempel zusätzlich zum Cron)
./deploy/db-backup.sh  # legt /opt/arctos/backups/db-<timestamp>.sql.gz an

# Image-Tag bumpen
sed -i 's|grc-web@sha256:.*|grc-web@sha256:<new-digest>|' docker-compose.yml

# Down → Up mit expliziter Dependency-Ordnung
docker compose pull
docker compose up -d --no-build
# „--no-build" erzwingt das Pull-Image; verhindert accidentally local rebuilds.

# Migrations & Seeds laufen via Entrypoint beim Container-Start.
docker compose logs -f web | head -200
# Warten bis "Ready on http://0.0.0.0:3000" sichtbar ist.
```

---

## 5. Post-Deploy Smoke

5.1 **HTTP-200 am Login**:

```bash
curl -I https://arctos.<domain>/login
# HTTP/2 200
```

5.2 **Admin-Login** im Browser:

- `https://arctos.<domain>/login` → `admin@arctos.dev` / das `.env`-Passwort.
- Dashboard lädt, Avatar oben rechts sichtbar.

  5.3 **Risk-CRUD** (UI-Schritt, eine Minute):

- `/risks/new` → Titel „release-smoke-$(date +%s)", speichern.
- Im Register auffindbar, Detail-Seite lädt, löschen geht.

  5.4 **Audit-Archive**:

```bash
curl -L -u admin@arctos.dev:<pw> \
  -H "Cookie: authjs.session-token=<token>" \
  "https://arctos.<domain>/api/v1/audit-log/archive?from=$(date -d '30 days ago' +%F)&to=$(date +%F)" \
  -o release-smoke.zip
unzip -l release-smoke.zip  # → README.md, manifest.json, audit_log/*.jsonl
```

5.5 **Hash-Chain-Integrität** (einmal pro Tenant):

```bash
curl -s -H "Cookie: …" https://arctos.<domain>/api/v1/audit-log/integrity | jq '.data.healthy'
# → true
```

---

## 6. Freigabe

Erst wenn 5.1–5.5 alle grün sind:

```bash
# GitHub-Release aus dem Tag (öffentliche Release-Notes = Changelog-Abschnitt)
gh release create v0.1.0-alpha \
  --title "ARCTOS 0.1.0-alpha" \
  --notes-file <(awk '/^## \[0.1.0-alpha\]/,/^## \[/{print}' CHANGELOG.md | sed '$d')
```

Dann im Team-Channel / Mail die Release-Notes posten.

---

## 7. Rollback (wenn Post-Deploy-Smoke fehlschlägt)

```bash
ssh arctos@<hetzner-ip>
cd /opt/arctos

# 7.1 App-Rollback: altes Image wieder rein
sed -i 's|grc-web@sha256:<new-digest>|grc-web@sha256:<prev-digest>|' docker-compose.yml
docker compose pull
docker compose up -d --no-build

# 7.2 DB-Rollback nur wenn die Migration selbst das Problem war:
#     dann über das Backup aus Schritt 4.
docker compose down
psql -U grc -d grc_platform -f /opt/arctos/backups/db-<timestamp>.sql
docker compose up -d

# 7.3 Tag nicht zurückziehen — er dokumentiert, dass v0.1.0-alpha
#     "in den Smoke gelaufen ist und abgebrochen wurde". Next: v0.1.1-alpha
#     mit Fix + Post-Mortem-Link im Changelog.
```

---

## 8. Post-Mortem (bei Rollback)

- Was hat die Post-Deploy-Smoke gefangen, was CI nicht gefangen hatte?
- **Immer** einen neuen CI-Test schreiben, der das Szenario reproduziert, bevor der Fix gemerged wird. Das Runbook wird in dem Fall mit der neuen Check-Spalte erweitert.

---

## 9. Zeit-Budget

| Schritt        | Mensch-Zeit | Wall-Clock        |
| -------------- | ----------- | ----------------- |
| 1 Pre-Flight   | 10 min      | 15 min            |
| 2 Tag          | 5 min       | 15 min (CI-Build) |
| 3 Image-Verify | 5 min       | 2 min             |
| 4 Deploy       | 10 min      | 5 min (pull + up) |
| 5 Smoke        | 10 min      | 10 min            |
| 6 Freigabe     | 5 min       | —                 |
| **Gesamt**     | **~45 min** | **~50 min**       |
| Rollback       | 15 min      | 5 min             |
