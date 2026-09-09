# Handover — evening of 2026-09-09

**To:** the local Claude Code session
**From:** the cloud session (audit ARCTOS-FULL-2026-08-31)
**Branch:** `audit/full-2026-08-31`, measured against run `34398654753`
**Run this in:** `C:\Users\daimon\Downloads\grcfiles\arctos-audit-build`

Four items. The first is the big one, and it exists because the E2E suite ran
in CI for the first time today.

---

## 0. What changed on the CI side while you worked

You do not need to do anything with these; they are context for reading the
run.

- **OP-251** — the E2E job now seeds its own accounts. The password is
  generated in the job, masked, and thrown away; no secret, no value in the
  repository. `secrets.E2E_PASSWORD` is gone from that step: against a
  database this job creates from scratch, a password from repository secrets
  cannot match a freshly hashed account.
- **OP-254** — the job now also runs `src/seed-demo.ts`. It only ran
  `src/seed.ts`, so the demo dataset the suite asserts against was never
  there. `E2E_ORG_ID` is pinned to the literal demo tenant
  `ccc4cc1c-4b09-499c-8420-ebd8da655cd7`; after both seeds there are **two**
  organisations named exactly `Meridian Holdings GmbH` and the demo data is in
  neither.
- **OP-253** — `.github/actions/apt-ohne-fremdquellen` disables the runner's
  third-party apt sources before any apt use. It cost three of four attempts
  yesterday.
- **OP-221** — `npm run lint` is now `node scripts/lint-ratchet.mjs`, i.e. the
  same gate CI runs. `npm run lint:raw` is the old `turbo lint` if you want
  raw per-workspace output. **`npm run lint` is green on a clean tree** and
  exits 1 with the rule name on a regression; both measured.
- **OP-246** — `scripts/lib/dep-tree.mjs` and `check-dependency-hygiene.mjs`
  now call npm through `npm-cli.js` + `process.execPath`. Note for future
  work: **`npm.cmd` no longer works without a shell** — Node refuses to spawn
  `.cmd` since the CVE-2024-27980 mitigation, and you get `EINVAL`. The
  common advice is stale. Measured on your machine: the hygiene check now
  reports 376 packages there, same as Linux.

---

## 1. The 16 E2E failures — triage first, do not fix 16 things

Run `34398654753`: **183 passed, 16 failed, 5.5 min.** Before today this suite
had never started, so treat every failure as newly _visible_, not newly
_introduced_.

**15 of the 17 numbered entries are in the `regression` project**
(`tests/e2e/regression/**`), which no workflow has ever run:

```
 1) [web]        document-signature.spec.ts:113  Multi-signer ceremony
 2) [regression] f-15-checklist-catalog.spec.ts:8
 3) [regression] f-17-schema-drift.spec.ts:8
 4) [regression] i-01-isms-setup-wizard.spec.ts:22
 5) [regression] i-02-assessment-lifecycle.spec.ts:25
 6) [regression] i-03-soa-diff-export.spec.ts:6
 7) [regression] i-03-soa-diff-export.spec.ts:59
 8) [regression] i-04-management-review.spec.ts:6
 9) [regression] i-05-nc-lifecycle.spec.ts:7
10) [regression] i-06-policy-ack.spec.ts:6
11) [regression] i-07-threat-heatmap.spec.ts:6
12) [regression] i-08-cve-flow.spec.ts:80
13) [regression] n-01-nis2-reporting.spec.ts:6
14) [regression] n-01-risk-form-validation.spec.ts:25
15) [regression] n-02-control-form-validation.spec.ts:7
16) [regression] n-02-nis2-readiness.spec.ts:18
17) [regression] n-03-finding-form-validation.spec.ts:7
```

### The two status codes that matter

The assertion failures are not fifteen different stories. The observed codes
are **503** and **429**, and both have a named suspect:

| Code | Suspect                                                                                                                              | Where                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 429  | The in-process rate limiter. `ci.yml` sets no `RATE_LIMIT_*` variable, and 201 tests run against **one** server with **one** worker. | `apps/web/src/lib/rate-limit.ts`                     |
| 503  | `no_provider_configured` — CI has no AI provider, correctly. A test asserting 201 on an AI-backed route gets 503.                    | `apps/web/src/app/api/v1/ai/_shared/ai-route.ts:101` |

**Do the triage before any fix.** Sort all 16 into three piles and report the
counts before changing code:

1. **Environment** — the test is right, CI lacks something (rate-limit budget,
   AI provider). Fix belongs in `ci.yml`, which is **mine** — hand it back
   with the evidence, do not edit `.github/workflows/**`.
2. **Test defect** — the test asserts something that was never true, or
   depends on state a previous test left behind. Fix the test.
3. **Product defect** — the application is wrong. Own OP number, own commit.

A real product defect must not ride into main inside a batch of test edits.
And the standing rule holds: **where a test shows a defect, fix the defect,
not the expectation.** A 429 is not a licence to raise a threshold in a test.

---

## 2. OP-249 — five silent-error sites, and the owner has ruled on the fifth

Four of the five are "show the user an error instead of nothing" and need no
further decision:

1. `programmes/[id]/steps/[stepId]` — three approval buttons `await fetch(...)`
   without checking `r.ok`. A 4xx/5xx is silent; the page just reloads.
2. `graph/explorer` — a failed subgraph fetch produces no message.
3. `catalogs/controls` and `catalogs/risks` — on a non-ok response the
   assignments of the _previous_ entry used to remain under the newly selected
   one. Now empty, still without a message.
4. `processes/[id]/compare` — same version on both sides used to leave the
   previous comparison standing under a wrong label. Now an empty state.

**The fifth was the owner's call, and it has been made:** in `admin/sso` the
active toggle reseeds the whole form and discards unsaved input. **Decision:
preserve unsaved input** — the toggle changes only the active state and leaves
the rest of the form alone. Note in the commit that this is a deliberate
behaviour change, so anyone who relied on the reset can find the reason.

---

## 3. The unit-test failure from run `34395761770`

That job was 909/909 green on `d3637701` and then failed with:

```
AssertionError: expected null not to be null
  ❯ runWithExpensiveErrorDiagnosticsDisabled …/@testing-library/dom/dist/config.js:47
Error: Test timed out in 15000ms.
```

No code between those commits touches `apps/web` tests — the changes were
`ci.yml`, the composite action, two `scripts/**` files and documentation. The
suspicion is the load-dependent timing class you already met in OP-246 (the
`Geisterkante` corpus test at 5.1 s), but it is a **suspicion, not a finding**:
the run was cancelled before its log was fetchable, and I have not judged it.

Please reproduce under load rather than on an idle machine. If it is timing,
give the test an explicit limit the way you did for the corpus tests — the
expectation stays, the budget becomes honest. If it is a real defect, it gets
its own number.

---

## 4. What stays with me

So the line is clear and we do not both touch the same file:

- `.github/workflows/**`, `.github/actions/**` — mine.
- `scripts/**` — mine.
- `docs/OFFENE-PUNKTE-REGISTER.md` and `-INDEX.md` — mine, so the numbering
  stays collision-free. Send me the entries; do not renumber.
- Application code, tests, anything needing a real build or the Windows/WSL
  machines — yours.

Two more things on my side, not yours: the owner still has to enable branch
protection (measured today: `404 Branch not protected`, so **no** check is
required and a red PR could be merged), and `STAGING_URL` for the Pilot
Readiness Gate.

**The owner's target for "done" is a green pipeline.** The 160 register
entries without a recorded status stay as named backlog — that decision was
made today, so do not open that front.
