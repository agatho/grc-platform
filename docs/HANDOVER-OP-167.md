# Handover — OP-167: the production build crashes on `/_global-error`

**Written:** 2026-09-09 · **Branch:** `audit/full-2026-08-31` · **HEAD:** `31ec0083`
**For:** a Claude Code session running locally on the machine that can actually build.

> **Resolved 2026-09-09, same day, in the local session.** Six further build runs
> (12–17) showed the cause was not Next.js but the build recipe in §7 of this very
> document: `set NODE_ENV=development` before `next build`. With that variable the
> static-generation worker loads Next's _development_ page runtime while the compiled
> app is bound to the _production_ one — two React copies, null hook dispatcher on the
> first `useContext` in `/_global-error`. Without the variable the identical checkout
> builds green in under two minutes and `server.js` runs. Full measurement, the trace
> that shows both runtime files loading in one worker, and what it rules out: the
> Nachtrag 2026-09-09 under OP-167 in `docs/OFFENE-PUNKTE-REGISTER.md`. §3–§6 below are
> left as written; they are the leads that were open before that run, and §6's
> `node:stream` finding still stands on its own merits. A guard in `next.config.ts`
> now refuses such a build in two seconds with the reason (`src/lib/build-env-guard.ts`).

This is the one open point that blocks **deployment and the test instance**. It does
not block the test suite: `playwright.config.ts` starts `npm run dev` outside CI, so
E2E has never depended on this (OP-204).

---

## 0. Why this is not being worked on in the cloud session

Measured, not assumed: the cloud container has **7 GB of RAM** and `next build` is
`Killed` (OOM) during compilation. Every build therefore has to run on the Windows
machine anyway, through a bridge, one batch file and one log file per round — at
15–20 minutes per round. The next useful step also needs to read and patch
`node_modules/next`, which is direct work on a local checkout.

**Start Claude Code here:**

```
C:\Users\daimon\Downloads\grcfiles\arctos-audit-build
```

That checkout is on `audit/full-2026-08-31` at `31ec0083`, clean, with `next@16.2.11`
installed and `node_modules` complete.

---

## 1. The failure, verbatim

```
  Generating static pages using 31 workers (516/688)
Error occurred prerendering page "/_global-error".
TypeError: Cannot read properties of null (reading 'useContext')
    at ignore-listed frames { digest: '3120278025' }
Export encountered an error on /_global-error/page: /_global-error, exiting the build.
⨯ Next.js build worker exited with code: 1 and signal: null
```

No `server.js` is produced, so there is no standalone artifact and no deployment.

`/_global-error` is a **synthetic route**. Next generates it whether or not the app
ships a `global-error.tsx`.

---

## 2. What has been measured — and what each run rules out

Eleven build runs. Do not repeat these.

| #   | Date      | Run                                                 | Result                                             | Rules out                                                                                    |
| --- | --------- | --------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | 09-03     | 16.2.11, unchanged                                  | crash, digest `3120278025`                         | —                                                                                            |
| 2   | 09-03     | `global-error.tsx` reduced to a minimum             | crash, **same digest**                             | the content of our file                                                                      |
| 3   | 09-03     | `global-error.tsx` deleted (Next generates its own) | crash, **same digest**                             | our file at all                                                                              |
| 4   | 09-03     | Node 24.13 instead of 25.2                          | crash, **same digest**                             | the Node version                                                                             |
| 5   | 09-03     | `next build --debug-prerender`                      | **GREEN**, 688/688, 0 errors, runnable `server.js` | — see §3                                                                                     |
| 6   | 09-03     | Next 16.3.4                                         | crash                                              | that release                                                                                 |
| 7   | 09-05     | 16.4.0-canary.15                                    | crash                                              | that canary                                                                                  |
| 8   | 09-05     | canary.15 with `experimental.cpus: 1`               | crash at **(0/688)**                               | the page count and worker batching — refutes the earlier attribution to vercel/next.js#95741 |
| 9   | 09-05     | canary.15 without the `withNextIntl` plugin         | crash                                              | next-intl                                                                                    |
| 10  | **09-09** | 16.2.11, full build                                 | crash, digest `3120278025`                         | still live today                                                                             |
| 11  | **09-09** | **16.4.0-canary.22**                                | crash, digest `4108919610`, same route             | seven further canaries                                                                       |

Also established: only one React copy in the tree (19.2.7); `package-lock.json`
unchanged since the last green build; and `layout.tsx`, `global-error.tsx`,
`not-found.tsx` and the four providers have not been touched since the last
successful build at `4caff361`.

---

## 3. The strongest lead: run #5 says which switch changes the outcome

`--debug-prerender` produces a **green build with a runnable `server.js`**. Per the
Next documentation that flag does four things:

1. disables `serverMinification`
2. disables `turbopackMinify`
3. emits server source maps
4. sets `prerenderEarlyExit=false`

Item 4 only changes whether the build stops at the first error — but run #5 reported
**0 errors**, not "errors, continued". So the build does not merely survive the crash;
**the crash does not happen.** That points at 1 or 2.

The Next docs say `--debug-prerender` output must not be deployed. **But
`serverMinification` is an ordinary config option**, and a build with it turned off
_is_ deployable.

### Experiment A — the cheapest test with the highest payoff

In `apps/web/next.config.ts`, one option at a time, each a full build:

```ts
// A1
experimental: { serverMinification: false }

// A2
turbopack: { root: monorepoRoot, minify: false }   // check the option name for 16.2.11

// A3 — both
```

If A1 or A2 builds green **and** produces `.next/standalone/apps/web/server.js`, then
OP-167 is solved for practical purposes: a deployable production build, at the cost
of unminified server output, with the reason documented in an ADR. That would unblock
the test instance today.

Record for each run: exit code, whether `server.js` exists, and the page count
reached. A build that says `✓ Compiled successfully` has **not** passed this point —
compilation is a separate phase from generation. (That mistake has already been made
once in this audit and is on record.)

---

## 4. Second lead: `useContext` on null is React's dispatcher

`Cannot read properties of null (reading 'useContext')` is what React throws when
`ReactSharedInternals.H` (the hook dispatcher) is null. Two usual causes:

1. a hook called outside a render pass, or
2. **two React instances mixed** — the module calling the hook resolved a different
   React copy than the one that set the dispatcher.

The register states there is only one React copy — but that was measured with
`npm ls`, i.e. against the **dependency tree**, not against the **built output**.
`/_global-error` is rendered by Next's own code with Next's own React resolution, and
under minification the import can be rewritten.

Worth checking:

- `.next/server` and the standalone trace for more than one `react-dom` bundle
- whether `next` ships its own bundled React that the synthetic route binds instead of
  the workspace one
- the same check under `--debug-prerender` (green) vs. the normal build (red) — a
  difference between the two is the answer

---

## 5. Third lead: get the real stack

`at ignore-listed frames { digest: '3120278025' }` hides the frames. Options:

- run with `--debug-prerender` **plus** a deliberately introduced second error, to see
  whether the tooling reports real frames at all in that mode
- patch `node_modules/next` locally to stop ignore-listing, or to print the error
  before it is digested
- `NODE_OPTIONS=--stack-trace-limit=100`, and check whether Next honours a debug
  environment variable in this version

The digest differs between versions (`3120278025` in 16.2.11, `4108919610` in
canary.22), so it is derived from the message _and_ something version-specific — it is
not a stable identifier to search issues by.

---

## 6. The webpack path — measured, and it is not a shortcut

`next build --webpack` was tried twice on 09-03 and once today.

- The default 4 GB heap dies with `JavaScript heap out of memory`. With 16 GB it
  proceeds.
- **Today, with `ARCTOS_BUILD_IGNORE_TS_ERRORS=1` (so the type errors cannot stop
  it), webpack fails during compilation:**

  ```
  Module build failed: UnhandledSchemeError:
  Reading from "node:stream" is not handled by plugins

  Import trace:
    node:stream
    packages/shared/src/lib/excel-to-bpmn.ts
    packages/shared/src/index.ts
    ./src/app/(dashboard)/audit/executions/[id]/page.tsx
  ```

  This is a **real defect of ours, not a webpack quirk**: a server-only module reaches
  a client page through the `@grc/shared` barrel. Turbopack tolerates it silently;
  webpack does not. Worth fixing on its own merits (move `excel-to-bpmn` out of the
  barrel, or expose it as a subpath export), independently of OP-167.

- Behind that sits a second webpack-only blocker, already characterised: the webpack
  path generates stricter route types and rejects

  ```
  Type '{ __tag__: "GET"; __param_position__: "second"; … }'
  does not satisfy the constraint 'ParamCheck<RouteContext>'.
  ```

  The register calls this "work on over a thousand routes". **That is wrong, and it is
  worth correcting:** the optionality comes from **one type**, in
  `apps/web/src/lib/api-wrapper.ts:69`:

  ```ts
  type WrappedRouteHandler<TCtx = unknown> = (
    req: Request,
    ctx?: TCtx, // ← this is the whole problem
  ) => Promise<Response>;
  ```

  The comment above it explains why it is optional: roughly 90 unit tests call flat
  handlers as `GET(req)`. Making the parameter required turns those into TS2554.
  So the size of that job is "one type plus about 90 test call sites", which is a
  measurable afternoon — not a thousand routes. **Measure it before believing either
  number:** make it required, run `tsc -p apps/web`, count.

Order of work if §3 fails: fix the `node:stream` leak, then decide on the type, then
find out what webpack does at prerender — that last question has **never been
answered**, because no webpack run has ever reached the generation phase.

---

## 7. How to run a build here

```bat
cd /d C:\Users\daimon\Downloads\grcfiles\arctos-audit-build\apps\web
set NODE_ENV=
set ARCTOS_BUILD_IGNORE_TS_ERRORS=1
set NODE_OPTIONS=--max-old-space-size=12288
rmdir /s /q .next
npx next build
```

> **Corrected 2026-09-09.** This recipe used to read `set NODE_ENV=development`, and
> that line _was_ OP-167 — see the note at the top of this document. `NODE_ENV` must be
> **unset** (Next then defaults it to `production`) or the build is refused by
> `next.config.ts`. Set `development` only for `npm install`, and clear it again before
> building. Measured here: the build takes about two minutes on this machine, not 15–20;
> the longer figure was the bridge round-trip, not the build.

Notes that have each cost a run already:

- **`NODE_ENV=production` breaks `npm install` / `npm ci`** — it drops 564 dev
  packages including `tsx`, and the build then fails for an unrelated reason. Set
  `development` for installs — **and unset it before `next build`** (see above; a
  variable set for the install and left in place is exactly how OP-167 came about).
- **`ARCTOS_BUILD_IGNORE_TS_ERRORS=1` is not there to hide errors.** It is there so
  the build _reaches the generation phase_, where the crash lives. A measurement of
  16.3.4 was lost because type errors stopped it earlier.
- **Delete `.next` between runs.** A stale Turbopack cache once reported a BOM error
  that had already been fixed.
- `[db] connection prewarm failed: connect ECONNREFUSED 127.0.0.1:5433` during
  "Collecting page data" is **harmless noise** — no database is needed for the build.
- `experimental: { cpus: 1 }` makes the crash arrive at `(0/688)` instead of
  `(516/688)`, which turns a 6-minute wait into a fast one. Use it for bisecting;
  remove it for the run that is supposed to produce the artifact.
- Success criterion is **not** `✓ Compiled successfully`. It is
  `.next\standalone\apps\web\server.js` existing.

---

## 8. Working rules from this audit

They exist because each was paid for once.

- **A counter-proof only counts if the failure itself is in the log** — with the test
  name and the assertion. The absence of a success is not a result. (Five self-inflicted
  errors of this class are on record in `docs/OFFENE-PUNKTE-REGISTER.md`.)
- **A justification must not cover more than what it justifies.** Four findings in this
  audit had this exact shape, including "Playwright needs a production build", which
  was never true and had immobilised four points.
- **Where a test shows a defect, fix the defect, not the expectation.**
- **No `git stash` while a run is in flight** — it truncated a file to length 0 once
  under load. Use `git show HEAD:path > copy`.
- Record what was ruled out, not just what was found. Half the value of the eleven runs
  above is the exclusions.

---

## 9. What to bring back

Whatever the outcome, these are the two deliverables:

1. **Either** a green build with a runnable `server.js` and the config change that
   achieved it (then: an ADR, and the test instance can be updated), **or** the
   measurement that says why not.
2. **A minimal reproduction** for `vercel/next.js#95741`. The issue explicitly asks
   for one "with the size of a real production tree", and this repository is exactly
   that. Strip the app down until the crash disappears; the last step that removes it
   is the report.

Append the result to `docs/OFFENE-PUNKTE-REGISTER.md` as a dated Nachtrag under
OP-167, in the same form as the existing ones: what was measured, what it rules out,
and what remains open.
