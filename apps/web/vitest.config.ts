import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { sharedCoverageConfig } from "../../vitest.coverage.shared";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    // 5s default flakes under full parallel load: route-module imports alone
    // take ~3.7s on cold transform, so unrelated tests tip over the limit.
    // Raised to 15s (2026-07-10) — real hangs still fail fast enough.
    testTimeout: 15000,
    include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],
    exclude: ["src/__tests__/api/helpers/**"],
    // `environmentMatchGlobs` was removed in vitest 4; component tests now
    // pick up jsdom via the `@vitest-environment jsdom` pragma at the top of
    // each .test.tsx file. Re-add a `projects`-based mapping later if needed.
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
