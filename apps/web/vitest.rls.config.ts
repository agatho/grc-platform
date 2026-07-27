import { defineConfig } from "vitest/config";
import path from "path";

// #SEC-F01b-RUN — dedicated config for the REAL route-chain RLS test. Kept out
// of the default `vitest.config.ts` run because it needs a live Postgres + the
// non-superuser `grc_app` role (APP_DATABASE_URL). CI runs it in the
// integration-tests job (which already provisions the DB + grc_app), NOT in the
// DB-less unit-tests job. Single fork so the shared `db`/request pools and the
// seed lifecycle don't race.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/rls-route-chain/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
