# Multi-stage build for GRC Platform
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json turbo.json ./
COPY apps/web/package.json apps/web/
COPY packages/*/package.json packages/*/
RUN npm install

FROM base AS builder
COPY . .
RUN npx turbo build --filter=@grc/web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static apps/web/.next/static
COPY --from=builder /app/apps/web/public apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
