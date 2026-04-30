# Test Coverage Reporting

This repository tracks Vitest coverage across **all** packages and apps and aggregates the per-package summaries into a single report consumable in CI and locally.

## Local Workflow

```bash
# Run vitest with coverage in every package + app (caches via turbo).
npm run test:coverage

# Aggregate the per-package coverage-summary.json files into one report.
npm run test:coverage:aggregate
```

Outputs:

| File | Purpose |
|------|---------|
| `<package>/coverage/index.html` | Per-package interactive HTML report |
| `<package>/coverage/lcov.info` | LCOV format for downstream tools |
| `<package>/coverage/coverage-summary.json` | Machine-readable per-package totals |
| `coverage/aggregated-summary.json` | Aggregated totals + per-package breakdown |
| `coverage/aggregated-summary.md` | Markdown report (used by CI for PR comments) |

## CI Workflow

`.github/workflows/coverage.yml` runs on every PR (and pushes to `main`):

1. Installs dependencies via `npm ci`
2. Runs `npm run test:coverage` (turbo orchestrates per-package vitest runs)
3. Runs the aggregator script
4. Uploads three artefacts:
   - `coverage-summary` — JSON + Markdown
   - `coverage-html` — full HTML reports per package
   - `coverage-lcov` — LCOV files (for Codecov / SonarCloud / similar)
5. Comments the aggregated Markdown report on the PR (replacing prior comments)
6. Posts the same content to the workflow run summary

`continue-on-error` is set on the test step so a single package failure still
produces an aggregate; the report shows which packages were skipped.

## Configuration

- **Shared coverage settings:** `vitest.coverage.shared.ts` — provider, reporters,
  exclude patterns. Used via `import { sharedCoverageConfig }` in every
  `vitest.config.ts`.
- **Per-package overrides:** each `vitest.config.ts` extends the shared config
  with its own `include` list (and additional `exclude` entries where needed,
  e.g. excluding Drizzle schema files from the DB package or Next.js boundary
  code in `apps/web`).

## Coverage Thresholds

There are no enforced thresholds yet. To start gating, set them in
`vitest.coverage.shared.ts`:

```ts
thresholds: {
  statements: 60,
  branches: 50,
  functions: 60,
  lines: 60,
}
```

Recommended ratchet strategy:

1. Run for 2–4 weeks without thresholds; observe the "natural" baseline.
2. Set thresholds at the current observed level (rounded down to nearest 5 %).
3. Fail PRs that lower coverage; raise thresholds when packages clearly
   exceed them for ≥ 2 sprints.

## Reading the Aggregated Report

The Markdown output uses these emoji bands:

- 🟢 ≥ 80 % — healthy
- 🟡 60 – 79 % — acceptable, watch for regressions
- 🟠 40 – 59 % — gap; consider targeted deep-tests
- 🔴 < 40 % — investigate; likely missing coverage on critical paths

Aggregate totals are weighted by lines/statements/functions/branches across
all packages — large packages (`packages/shared`, `apps/web`) dominate.
For per-package action items, look at the breakdown table.

## Where Coverage Reporting Helps

- **PR review:** see at a glance whether a change is covered by tests.
- **Sprint planning:** identify packages with the lowest branch coverage as
  Deep-Test-Sprint candidates (currently `packages/auth` at ~ 41 %).
- **Refactoring:** verify that pre-refactor coverage is preserved.

## Where Coverage Reporting Does **Not** Help

- Smoke tests (e.g. `all-routes-smoke`, `all-components-smoke`) drive line
  coverage to 100 % without exercising business logic. **High coverage ≠ high
  quality.** Use coverage as a heat-map of attention, not a quality KPI.
- Coverage cannot detect missing tests for code paths that don't exist yet.
- Branch coverage misses many edge cases in untested combinations of inputs.

## Related Files

- `vitest.coverage.shared.ts` — shared config (root)
- `scripts/coverage-aggregate.ts` — aggregator
- `.github/workflows/coverage.yml` — CI workflow
- `package.json` — `test:coverage` and `test:coverage:aggregate` scripts
- `turbo.json` — `test:coverage` task with `coverage/**` outputs
