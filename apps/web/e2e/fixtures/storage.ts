import path from "node:path";

/**
 * [ARCTOS-FULL-2026-08-31 / WP11 · S11-06]
 *
 * Absolute path to the storage state written by `auth.setup.ts`.
 *
 * The specs used the literal `"e2e/.auth/admin.json"`, which Playwright
 * resolves against `process.cwd()`. That worked only when the suite was
 * started from `apps/web/`. The repository-root config — the one that runs all
 * 67 specs together — has a different cwd, and every spec would have silently
 * started unauthenticated. One constant, resolved from this file's own
 * location, works from any working directory.
 *
 * `__dirname` rather than `import.meta.url`: Playwright transpiles specs to
 * CommonJS, where `import.meta` is a syntax error.
 */
export const STORAGE_STATE = path.resolve(__dirname, "../.auth/admin.json");
