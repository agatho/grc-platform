import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { sharedCoverageConfig } from "../../vitest.coverage.shared";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],
    exclude: ["src/__tests__/api/helpers/**"],
    environmentMatchGlobs: [
      ["src/__tests__/components/**", "jsdom"],
    ],
    coverage: {
      ...sharedCoverageConfig,
      include: ["src/**/*.{ts,tsx}"],
      // Next.js generated + Auth.js boundary code excluded
      exclude: [
        ...(sharedCoverageConfig.exclude ?? []),
        "src/middleware.ts",
        "src/auth.ts",
        "src/app/layout.tsx",
        "src/app/not-found.tsx",
        "src/i18n/**",
        ".next/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
