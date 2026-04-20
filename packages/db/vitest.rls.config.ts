import { defineConfig } from "vitest/config";

// Vitest 4 moved pool options to the top level — the old
// `test.poolOptions` shape is silently ignored, which lets test
// files run in parallel and produces races in beforeAll seed code
// ("tuple concurrently updated", catalogId undefined).
export default defineConfig({
  test: {
    include: ["tests/rls/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    fileParallelism: false,
    poolOptions: { forks: { singleFork: true } },
  },
});
