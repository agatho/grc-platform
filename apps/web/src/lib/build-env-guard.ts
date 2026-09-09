/**
 * [ARCTOS-FULL-2026-08-31 · OP-167] Refuse a production build that would
 * mix two React runtimes.
 *
 * `next build` compiles the app with `process.env.NODE_ENV` inlined as
 * `"production"`, so every server chunk hard-wires
 * `next/dist/compiled/next-server/app-page-turbo.runtime.prod.js`. The
 * static-generation worker, however, is plain Node code: its
 * `route-modules/app-page/module.compiled.js` picks the runtime file from
 * the *process* `NODE_ENV` at run time. With `NODE_ENV=development` in the
 * environment that worker loads `app-page-turbo.runtime.dev.js` as well —
 * two runtime files, two React copies, and the first hook call in the
 * prerender of `/_global-error` dies with
 * `Cannot read properties of null (reading 'useContext')`.
 *
 * Measured on 2026-09-09 (runs 12–16 in `docs/OFFENE-PUNKTE-REGISTER.md`,
 * OP-167): identical checkout and config, the only difference being the
 * process variable — red with `development`, green without. Eleven earlier
 * build runs had all carried the variable and were attributed to a Next.js
 * bug. `.env` files cannot cause this: Next sets `NODE_ENV` before it reads
 * them and never lets them override it (run 15).
 *
 * `--debug-prerender` is the one legitimate development-mode build: Next
 * then also sets `experimental.allowDevelopmentBuild`, so both halves agree.
 *
 * Kept free of imports so `next.config.ts` can call it at load time and a
 * unit test can exercise it without a build.
 */

export interface BuildEnvGuardInput {
  /** `process.env.NODE_ENV` as seen by the config loader. */
  nodeEnv: string | undefined;
  /** `process.argv` of the process loading `next.config.ts`. */
  argv: readonly string[];
}

const NEXT_BIN = /(^|[\\/])next([\\/]dist[\\/]bin[\\/]next(\.js)?)?$/;

/** True when argv is the `next build` CLI invocation (not dev/start, not a worker). */
export function isNextBuildInvocation(argv: readonly string[]): boolean {
  const binIndex = argv.findIndex((a, i) => i > 0 && NEXT_BIN.test(a));
  if (binIndex === -1) return false;
  return argv.slice(binIndex + 1).includes("build");
}

/**
 * Returns the reason a build must not proceed, or `null` when it may.
 */
export function findBuildNodeEnvConflict({
  nodeEnv,
  argv,
}: BuildEnvGuardInput): string | null {
  if (nodeEnv !== "development") return null;
  if (!isNextBuildInvocation(argv)) return null;
  if (argv.includes("--debug-prerender")) return null;
  return (
    "NODE_ENV=development is set in the environment of `next build`. " +
    "The compiled app binds the production React runtime while the " +
    "static-generation worker would load the development one; the build " +
    "then fails prerendering /_global-error with " +
    "\"Cannot read properties of null (reading 'useContext')\" (OP-167). " +
    "Unset NODE_ENV (Next defaults it to production) or pass " +
    "--debug-prerender, which is the only development-mode build Next supports."
  );
}
