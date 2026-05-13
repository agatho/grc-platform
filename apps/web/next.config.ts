import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
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
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withNextIntl(nextConfig);
