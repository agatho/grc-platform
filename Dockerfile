# ============================================================================
# ARCTOS GRC Platform — Production Docker Image
# Multi-stage build: deps → build → runtime
# ============================================================================

# ── Stage 1: Dependencies ───────────────────────────────────────
FROM node:22-alpine AS deps
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

RUN npm ci

# ── Stage 2: Build ──────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/ ./
COPY . .

# Build i18n bundles
RUN npx tsx apps/web/scripts/build-messages.ts

# Build Next.js with standalone output
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV AUTH_SECRET="build-placeholder"
ENV AUTH_TRUST_HOST="true"
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV NEXT_TELEMETRY_DISABLED=1

# Run from workspace root so hoisted node_modules are resolved
RUN npx next build --dir apps/web || (cd apps/web && npx next build)

# ── Stage 3: Runtime ────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

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

# Copy migration files + seeds for entrypoint. Two migration sources:
#  - packages/db/drizzle/*.sql    drizzle-kit generated (Sprint 1–current)
#  - packages/db/src/migrations/  hand-written Sprint 67+ feature migrations
# Both are consumed by scripts/docker-entrypoint.sh in numeric order. Going
# forward only the drizzle/ directory should grow (per ADR-014); src/migrations
# stays to catch up the production DB.
COPY --from=builder /app/packages/db/drizzle packages/db/drizzle
COPY --from=builder /app/packages/db/sql packages/db/sql
COPY --from=builder /app/packages/db/src/migrations packages/db/src/migrations

# Copy entrypoint
COPY scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Install psql for migrations
RUN apk add --no-cache postgresql-client

USER arctos

EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "apps/web/server.js"]
