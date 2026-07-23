import path from "node:path";
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

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
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withNextIntl(nextConfig);
