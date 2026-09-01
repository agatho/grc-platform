import path from "node:path";
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

import { staticSecurityHeaders } from "./src/lib/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Monorepo root (grc-platform/). Pinned explicitly: Next 16 otherwise
// infers the workspace root from surrounding lockfiles — a stray
// package-lock.json ABOVE the repo (seen on dev machines) distorts the
// .next/standalone layout that the Dockerfile COPY paths rely on.
const monorepoRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  transpilePackages: ["@grc/auth", "@grc/db", "@grc/shared", "@grc/ui"],
  // Keep node-only OTS dependency out of the bundler — it pulls in
  // fs/tls via the legacy `request` http client. Only the /audit-log/
  // anchor/upgrade route touches it, server-side.
  // pdfkit also stays external: webpack would otherwise inline its
  // .afm font-metric files as bundled chunks at paths pdfkit's runtime
  // doesn't expect (the Wave-11 ENOENT looking for
  // .next/server/chunks/data/Helvetica.afm).
  serverExternalPackages: ["javascript-opentimestamps", "pdfkit"],
  // #WAVE12-PDF-01: pdfkit reads its Standard-14 font metrics
  // (Helvetica.afm etc.) from node_modules/pdfkit/js/data/ at
  // runtime via __dirname-relative fs.readFileSync. The standalone
  // build's tracer doesn't see those reads (they're computed paths)
  // so the .afm files don't get copied into the deploy bundle.
  // outputFileTracingIncludes pulls them in explicitly per route
  // that touches the pdf module.
  outputFileTracingIncludes: {
    "/api/v1/**/pdf/**": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/v1/**/export-pdf/**": ["./node_modules/pdfkit/js/data/**/*"],
    // Catch the shared pdf.ts importer regardless of route shape.
    "/api/v1/**": ["./node_modules/pdfkit/js/data/**/*"],
  },
  // Next 16 removed the `eslint` config option (and `next build` no longer
  // lints) — ESLint runs standalone in CI, nothing replaces the old
  // `eslint.ignoreDuringBuilds` block.
  //
  // [WP12 · S12-16] `ignoreBuildErrors` was unconditionally `true`, so
  // `next build` reported success even when the typecheck failed — the build
  // was worthless as a quality gate. `tsc --noEmit -p apps/web/tsconfig.json`
  // is green (verified, exit 0), so honouring type errors costs nothing today
  // and stops the next regression from shipping. `ARCTOS_BUILD_IGNORE_TS_ERRORS=1`
  // restores the old behaviour for an emergency hotfix build — an explicit,
  // visible act rather than a permanent default.
  typescript: {
    ignoreBuildErrors: process.env.ARCTOS_BUILD_IGNORE_TS_ERRORS === "1",
  },
  // [WP12 · S12-08] Security headers belong to the application, not to one
  // deployment's reverse proxy. `deploy/Caddyfile` still sets the same set and
  // may override it; a Compose, Kubernetes or plain `next start` deployment —
  // none of which ships a proxy — is now covered as well. The per-request CSP
  // with its nonce is set in `middleware.ts`; everything request-independent
  // is set here, which is also the only layer that sees `/_next/static/**`
  // (the middleware matcher excludes it).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: staticSecurityHeaders(),
      },
      {
        // [WP12 · S14-17] ADR-020's Implementation-Plan asked for a
        // "Deprecation-Header-Stub" on /api/v1/**. A stub that permanently
        // says `Deprecation: false` teaches clients to ignore the header,
        // which makes it worthless on the day it becomes true — so the
        // header itself is switched on at T−6 months per the ADR's runbook.
        // What ships now is the version marker, which is what an integrator
        // actually needs in a log line, and the anchor the Deprecation and
        // Sunset headers will be added to.
        source: "/api/v1/:path*",
        headers: [{ key: "X-API-Version", value: "v1" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
