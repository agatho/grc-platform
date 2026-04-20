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
  serverExternalPackages: ["javascript-opentimestamps"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withNextIntl(nextConfig);
