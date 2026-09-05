# ============================================================================
# ARCTOS GRC Platform — Production Docker Image
# Multi-stage build: deps → build → runtime
# ============================================================================
#
# #DEP-CONFIG: base images pinned to specific minor.patch tags
# (was previously `node:22-alpine` — a moving tag that could pick up
# a new minor each rebuild). For maximum immutability you can replace
# the version tag with a digest:
#   FROM node@sha256:<sha> AS deps
# Trade-off: tag is human-readable + easy to bump on a roll; digest
# is bit-identical-or-fail but rebuilds need explicit SHA updates.
# The pinned tag below balances both — moves only on `node:22.20.x`
# patch releases (security fixes) but won't silently jump majors.

# Common Node base — single source of truth for all three stages.
# [ARCTOS-FULL-2026-08-31 / WP10 · S08-21] Digest-Pinning.
# Der Tag `node:22.20-alpine` ist innerhalb der Patch-Linie beweglich: zwei
# Builds desselben Commits ergaben unterschiedliche Images. Fuer ein Produkt
# mit Auditierbarkeitsanspruch heisst das, dass sich von einem laufenden
# Container nicht auf einen reproduzierbaren Bauzustand zurueckschliessen
# laesst. Der Digest unten ist bit-identisch-oder-Fehlschlag; der Tag bleibt
# als Kommentar stehen, damit ein Bump lesbar ist. Dependabot bumpt
# `docker`-Ecosystem-Digests automatisch (.github/dependabot.yml).
# Ermittelt am 2026-09-01 mit:
#   docker buildx imagetools inspect node:22.20-alpine --format '{{.Manifest.Digest}}'
ARG NODE_IMAGE=node:22.20-alpine@sha256:dbcedd8aeab47fbc0f4dd4bffa55b7c3c729a707875968d467aaaea42d6225af

# ── Stage 1: Dependencies ───────────────────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/ai/package.json packages/ai/
COPY packages/auth/package.json packages/auth/
COPY packages/automation/package.json packages/automation/
COPY packages/db/package.json packages/db/
COPY packages/email/package.json packages/email/
COPY packages/events/package.json packages/events/
COPY packages/graph/package.json packages/graph/
COPY packages/reporting/package.json packages/reporting/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/

# [ARCTOS-FULL-2026-08-31 / WP10 · S08-19]
# Vorher: `npm ci` — der Web-Build fuehrte damit Lifecycle-Skripte JEDES
# installierten Pakets aus (inkl. devDependencies), waehrend
# Dockerfile.worker `--ignore-scripts` bereits korrekt setzte. Ein
# kompromittiertes Paket haette im `postinstall` beliebigen Code in der
# Builder-Stage ausgefuehrt — mit Zugriff auf den gesamten Quellbaum und
# die Build-Argumente; das manipulierte `.next/standalone` waere danach im
# Runtime-Image gelandet. Die Inkonsistenz zwischen beiden Images hatte
# keine Begruendung.
#
# Die zwei Pakete des Produktionsbaums, die tatsaechlich Code ausfuehren
# (@parcel/watcher: `install`, @swc/core: `postinstall`), werden danach
# gezielt nachgezogen — `npm rebuild` fuehrt nur deren eigene Skripte aus,
# nicht die des gesamten Baums.
RUN npm ci --ignore-scripts \
 && npm rebuild @parcel/watcher @swc/core --foreground-scripts 2>/dev/null || true

# ── Stage 2: Build ──────────────────────────────────────────────
FROM ${NODE_IMAGE} AS builder
WORKDIR /app

COPY --from=deps /app/ ./
COPY . .

# Build i18n bundles
RUN npx tsx apps/web/scripts/build-messages.ts

# Build Next.js with standalone output.
# AUTH_SECRET / AUTH_TRUST_HOST / DATABASE_URL are required by Next.js
# build-time evaluation (auth config is imported during page analysis),
# but must NEVER be baked into the runtime image. We pass them as ARG
# values and surface them to the build command only via the RUN line's
# environment — that way they don't appear as ENV layers in the
# resulting image (Docker's `SecretsUsedInArgOrEnv` lint rule).
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_TELEMETRY_DISABLED=1

ARG AUTH_SECRET=build-placeholder
ARG AUTH_TRUST_HOST=true
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder

# #WAVE23.1: build-time SHA + branch + build-time injected into the
# image so `/api/v1/_meta/build` can report which commit is actually
# running. Defaults are "unknown" so the image still builds in dev /
# CI without --build-arg. The deploy script should pass:
#   --build-arg GIT_SHA=$(git rev-parse HEAD) \
#   --build-arg GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD) \
#   --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# CI's docker/build-push-action receives them via the `build-args`
# input.
#
# These are runtime ENVs (not just build-time ARGs) so the route can
# read them at request time. NEXT_PUBLIC_ prefix forces Next.js to
# inline them into the server bundle (the standalone build strips
# unprefixed ENVs that weren't referenced at build time).
ARG GIT_SHA=unknown
ARG GIT_BRANCH=unknown
ARG BUILD_TIME=unknown
ENV NEXT_PUBLIC_GIT_SHA=$GIT_SHA
ENV NEXT_PUBLIC_GIT_BRANCH=$GIT_BRANCH
ENV NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME

# Run from workspace root so hoisted node_modules are resolved.
# Next 16: the build uses Turbopack (the v16 default). The legacy
# `--webpack` pipeline was evaluated during the 16.2.11 migration and
# rejected: it OOMs below a ~7-8GB heap on this app (Next-16 webpack
# memory regression; Next 15 built fine at 3GB), while Turbopack builds
# in ~2 min inside 4GB. pdfkit stays runtime-external via
# serverExternalPackages + outputFileTracingIncludes (.afm font
# metrics) — presence in .next/standalone is part of the migration
# verification.
RUN AUTH_SECRET="$AUTH_SECRET" \
    AUTH_TRUST_HOST="$AUTH_TRUST_HOST" \
    DATABASE_URL="$DATABASE_URL" \
    sh -c 'npx next build --dir apps/web || (cd apps/web && npx next build)'

# ── Stage 3: Runtime ────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

# Pull Alpine security patches into the runtime layer. The pinned
# node:22.x-alpine base lags Alpine's security feed by days-to-weeks
# (libcrypto3/musl/zlib CVEs accumulate), and the Trivy gate fails
# CI Build when HIGH+CRITICAL show up. `apk upgrade --no-cache` is
# the standard fix — keeps the base pin for reproducibility while
# patching userland on every build.
RUN apk upgrade --no-cache

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# #WAVE23.1: propagate build SHA/branch/time into the runtime image
# so the `/api/v1/_meta/build` endpoint can serve them at request
# time. We re-declare the ARGs in this stage (Docker scopes ARGs
# per-stage) and re-bake them into ENV. NEXT_PUBLIC_ prefix matches
# what next/server reads in the standalone server bundle.
ARG GIT_SHA=unknown
ARG GIT_BRANCH=unknown
ARG BUILD_TIME=unknown
ENV NEXT_PUBLIC_GIT_SHA=$GIT_SHA
ENV NEXT_PUBLIC_GIT_BRANCH=$GIT_BRANCH
ENV NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME

RUN addgroup --system --gid 1001 arctos && \
    adduser --system --uid 1001 arctos

# Copy standalone server
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static apps/web/.next/static
COPY --from=builder /app/apps/web/public apps/web/public

# Copy i18n bundles
COPY --from=builder /app/apps/web/messages/de.json apps/web/messages/de.json
COPY --from=builder /app/apps/web/messages/en.json apps/web/messages/en.json
COPY --from=builder /app/apps/web/messages/de apps/web/messages/de
COPY --from=builder /app/apps/web/messages/en apps/web/messages/en

# Copy migration files + seeds for entrypoint.
# Since the 2026-04-20 consolidation (commit 3cb6cdc) there is a single
# source-of-truth: packages/db/drizzle/*.sql. The old src/migrations/
# directory was renamed to src/migrations-archive/ (git history only,
# not shipped) after every sprint migration was carried forward into
# drizzle/ with a fresh sequential number.
COPY --from=builder /app/packages/db/drizzle packages/db/drizzle
COPY --from=builder /app/packages/db/sql packages/db/sql

# [WP10 · S08-16] Namensnennungspflicht bei Weitergabe. MIT, Apache-2.0,
# ISC, BSD-2/3-Clause verlangen saemtlich die Beibehaltung des
# Copyright-Vermerks; ARCTOS wird als Image ueber ghcr.io und per deploy/
# On-Prem verteilt — das ist Weitergabe im Lizenzsinn. Bis 2026-08-31 lag
# dem Image nichts davon bei.
COPY NOTICE THIRD-PARTY-LICENSES.md /app/

# [WP10 · S08-12] Stueckliste im Image. Erscheint morgen ein Advisory zu
# einem tief transitiven Paket, war vorher nicht feststellbar, welches
# bereits ausgelieferte Image betroffen ist — `npm audit` beschreibt immer
# nur den heutigen Baum.
COPY SBOM/arctos-sbom-prod.cdx.json /app/SBOM/arctos-sbom-prod.cdx.json

# Copy entrypoint + Pre-Start-Gate (#S13-10)
COPY scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
COPY scripts/prestart.sh /app/prestart.sh
COPY scripts/assert-runtime-config.mjs /app/scripts/assert-runtime-config.mjs
RUN chmod +x /app/docker-entrypoint.sh /app/prestart.sh

# Install psql for migrations. PDF export runs entirely through pdfkit
# (pure Node, Standard-14 .afm font metrics shipped inside the package)
# since 2026-07-11 — the previous Chromium/Puppeteer install
# (chromium + nss/freetype/harfbuzz/ttf-freefont/font-noto-cjk and the
# PUPPETEER_SKIP_DOWNLOAD / PUPPETEER_EXECUTABLE_PATH env vars) is gone.
# ca-certificates stays: outbound TLS (Resend, FreeTSA anchoring,
# webhooks) needs a current trust store.
RUN apk add --no-cache \
    postgresql-client \
    ca-certificates

USER arctos

EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# [WP10 · S13-13] Container-Healthcheck. `restart: unless-stopped` reagiert
# nur auf einen BEENDETEN Prozess; ein haengender Node-Prozess (Event-Loop
# blockiert, Pool erschoepft) wurde nie neu gestartet — waehrend
# runbook.md:118 "Docker-Restart-Policy greift automatisch" zusagte. Der
# Worker hatte seit WP9 einen Healthcheck, `web` nicht (Uebergabe aus
# S10-21). `start-period` deckt den Migrationslauf des Entrypoints ab.
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health')\
    .then(r=>r.json().then(j=>process.exit(r.ok&&j.status!=='unhealthy'?0:1)))\
    .catch(()=>process.exit(1))"

# [WP10 · S13-10] prestart.sh prueft die Pflicht-Betriebsvariablen und
# uebergibt danach an den Migrations-Entrypoint. Ohne APP_DATABASE_URL,
# AUDIT_SEAL_KEY, PII_PSEUDONYM_KEY o. ae. startet der Container in
# NODE_ENV=production nicht mehr — vorher lief er klaglos als Superuser
# mit wirkungsloser RLS und meldete /api/v1/health mit 200.
ENTRYPOINT ["/app/prestart.sh", "web"]
CMD ["node", "apps/web/server.js"]
