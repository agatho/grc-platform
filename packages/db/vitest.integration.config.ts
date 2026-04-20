import { defineConfig } from "vitest/config";

// See vitest.rls.config.ts for the rationale on the vitest 4
// fileParallelism + singleFork combination.
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    fileParallelism: false,
    poolOptions: { forks: { singleFork: true } },
  },
});
