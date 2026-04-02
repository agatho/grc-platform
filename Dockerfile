# ============================================================================
# ARCTOS GRC Platform — Production Docker Image
# Multi-stage build: deps → build → runtime
# Output: ~200MB Alpine image with standalone Next.js server
# ============================================================================

# ── Stage 1: Dependencies ───────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Copy package files for all workspaces
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

RUN npm ci --ignore-scripts

# ── Stage 2: Build ──────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build i18n bundles
RUN npx tsx apps/web/scripts/build-messages.ts

# Build Next.js with standalone output (run from root so hoisted deps are found)
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV AUTH_SECRET="build-placeholder"
ENV AUTH_TRUST_HOST="true"
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV NEXT_TELEMETRY_DISABLED=1

RUN cd apps/web && NODE_PATH=/app/node_modules npx next build

# ── Stage 3: Runtime ────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Add non-root user
RUN addgroup --system --gid 1001 arctos && \
    adduser --system --uid 1001 arctos

# Copy standalone server
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static apps/web/.next/static
COPY --from=builder /app/apps/web/public apps/web/public 2>/dev/null || true

# Copy i18n bundles into standalone
COPY --from=builder /app/apps/web/messages/de.json apps/web/messages/de.json
COPY --from=builder /app/apps/web/messages/en.json apps/web/messages/en.json
COPY --from=builder /app/apps/web/messages/de apps/web/messages/de
COPY --from=builder /app/apps/web/messages/en apps/web/messages/en

# Copy migration files + seeds for entrypoint
COPY --from=builder /app/packages/db/drizzle packages/db/drizzle
COPY --from=builder /app/packages/db/sql packages/db/sql
COPY --from=builder /app/packages/db/src/seed.ts packages/db/src/seed.ts
COPY --from=builder /app/packages/db/src/schema packages/db/src/schema
COPY --from=builder /app/packages/db/package.json packages/db/package.json
COPY --from=builder /app/packages/db/drizzle.config.ts packages/db/drizzle.config.ts

# Copy entrypoint
COPY scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Install psql for migrations in entrypoint
RUN apk add --no-cache postgresql-client

USER arctos

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "apps/web/server.js"]
