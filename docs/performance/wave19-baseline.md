# Wave-19 Performance Baseline (W19-N3)

**Date:** 2026-05-15
**Branch:** `feature/wave-19-rest`
**Status:** **Methodology + harness documented; live numbers deferred to v0.2 deployment.**
**Tracker:** Wave-19 closure spec, item W19-N3.

---

## What this document is

A reproducible **load-test harness specification** for ARCTOS,
covering the four endpoint classes the spec called out:

1. `GET /api/v1/risks?limit=100` — bread-and-butter list endpoint.
2. `GET /api/v1/controls/effectiveness` — cross-module aggregation
   (joins risks ↔ controls ↔ findings).
3. Hash-chain integrity (`GET /api/v1/audit-log/integrity`) under
   load — must remain `healthy=true` while the rest of the platform
   takes a beating.
4. Memory-leak baseline (RSS over a 5-min sustained load).

This file does NOT contain live numbers from a Wave-19 run. The
harness depends on:

- A live Postgres + Next.js dev server (or Docker compose stack).
- An auth token (Auth.js JWT or session cookie) for the rate-limited
  endpoints.
- A non-trivial amount of seeded data (≥ 100 risks, ≥ 50 controls,
  ≥ 23 findings — currently provided by `seed-all.ts` after
  `seed_demo_*.sql`).

Producing live numbers costs ~15 min of CI runtime and skews the CI
budget. The closure PR pins the **harness** — first deployer to a
staging environment runs it and appends results to this file's
"Results" section.

---

## Tooling: k6 (preferred) or autocannon (fallback)

### k6 (https://k6.io)

```bash
# install (one-time)
curl https://dl.k6.io/key.gpg | sudo apt-key add -
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

### autocannon (alternative — Node-only)

```bash
npx autocannon@latest -c 50 -d 60 -p 10 \
  -H "Authorization: Bearer $JWT" \
  http://localhost:3000/api/v1/risks?limit=100
```

---

## Test Plan A: Risks list (`GET /risks?limit=100`)

### k6 script (`scripts/perf/risks-list.js`)

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 50, // 50 concurrent virtual users
  duration: "60s",
  thresholds: {
    http_req_failed: ["rate<0.01"], // < 1% errors
    http_req_duration: [
      "p(95)<500", // P95 < 500 ms
      "p(99)<1000", // P99 < 1000 ms
    ],
  },
};

const TOKEN = __ENV.ARCTOS_JWT;
const BASE = __ENV.ARCTOS_BASE || "http://localhost:3000";

export default function () {
  const res = http.get(`${BASE}/api/v1/risks?limit=100`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(res, {
    "status 200": (r) => r.status === 200,
    "has data array": (r) => Array.isArray(JSON.parse(r.body).data),
  });
  sleep(0.1);
}
```

### Run

```bash
ARCTOS_JWT="..." ARCTOS_BASE="http://localhost:3000" \
  k6 run scripts/perf/risks-list.js
```

### Acceptance

- `http_req_failed` rate < 1%
- P95 < 500 ms
- P99 < 1000 ms

---

## Test Plan B: Cross-module aggregation (`GET /controls/effectiveness`)

The spec acknowledges this is heavier than a list endpoint:

### k6 script (`scripts/perf/controls-effectiveness.js`)

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 25,
  duration: "60s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"], // looser bound for aggregation
  },
};

const TOKEN = __ENV.ARCTOS_JWT;
const BASE = __ENV.ARCTOS_BASE || "http://localhost:3000";

export default function () {
  const res = http.get(`${BASE}/api/v1/controls/effectiveness`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(res, { "status 200": (r) => r.status === 200 });
  sleep(0.5);
}
```

### Acceptance

- P95 < 1 s under 25 concurrent VUs
- 0 errors
- Hash-chain remains healthy (see Plan C)

---

## Test Plan C: Hash-chain integrity under load

While Plans A + B are running, poll `GET /audit-log/integrity` every
30s and assert `healthy === true && mismatches === 0`. The audit
trigger fires on every mutation, so a sustained load will exercise
the SHA-256 chain hot path. This is the regression guard against
"chain corruption under contention" (the kind of bug that's invisible
under single-user dev but explodes in production).

### k6 sidecar (`scripts/perf/hash-chain-watch.js`)

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1,
  duration: "60s",
};

export default function () {
  const res = http.get(`${__ENV.ARCTOS_BASE}/api/v1/audit-log/integrity`, {
    headers: { Authorization: `Bearer ${__ENV.ARCTOS_JWT}` },
  });
  const body = JSON.parse(res.body);
  check(body, {
    healthy: (b) => b.healthy === true,
    "mismatches=0": (b) => b.mismatches === 0,
  });
  sleep(30);
}
```

---

## Test Plan D: Memory-leak baseline (5-min sustained)

Bash + `ps`:

```bash
# Kick off Plan A in background.
k6 run scripts/perf/risks-list.js --duration 5m &
KP=$!

# Sample RSS every 15s.
while kill -0 $KP 2>/dev/null; do
  ps -o rss= -p $(pgrep -f "next start") | head -1
  sleep 15
done > rss-samples.txt

# Acceptance: max(RSS) - min(RSS over the last 2 min) < 50 MB.
```

### Acceptance

- RSS growth in the **second half** of the run < 50 MB
  (i.e. it has stabilized; not still climbing).
- No restart of the Next.js process during the 5 min.

---

## Test Plan E: Bulk endpoints (Critical Rule #11 — Wave-19-N8)

Already covered by `packages/shared/tests/bulk-cap-contract.test.ts`

- the route-level Zod validation (no perf component — the cap is a
  422 not a "slow"). Skipped from this perf doc.

---

## Results

### CI baseline (Wave-22-C2 — automated, runs every PR)

GitHub Actions E2E job now runs `scripts/perf/ci-baseline.js` after the
Playwright smoke. The script gates on the spec's percentile thresholds
via k6's built-in `thresholds` block — any regression fails CI:

| Endpoint                      | VUs | Duration | P95 threshold | P99 threshold | Errors threshold |
| ----------------------------- | --- | -------- | ------------- | ------------- | ---------------- |
| `GET /api/v1/risks?limit=100` | 10  | 20s      | < 500 ms      | < 1000 ms     | < 1%             |
| `GET /api/v1/health`          | 5   | 20s      | < 200 ms      | (n/a)         | < 1%             |

The summary JSON is uploaded as a `k6-perf-baseline` artifact on every
CI run; you can download it from the GitHub Actions run page to get
the actual P50/P95/P99/RPS numbers per build.

**Why a lighter VU count than the prod baseline (50 vs. 10):** GitHub
Actions hosted runners are 2-vCPU, 7 GB RAM. The CI run is meant to
catch algorithmic regressions (N+1, missing index) — not to predict
production throughput. A 10-VU run on 2 vCPU exercises the same code
paths the spec calls out but stays inside the runner's budget so the
job finishes in ~25 s.

### Prod baseline (manual — first staging deployment fills in)

Run the heavier `risks-list.js` + `controls-effectiveness.js` +
`hash-chain-watch.js` against a 4-vCPU+ instance for the prod numbers.
Fill in this table after the run:

| Date       | Endpoint                    | VUs | Duration | P95 (ms) | P99 (ms) | Errors | Hash-chain |
| ---------- | --------------------------- | --- | -------- | -------- | -------- | ------ | ---------- |
| 2026-MM-DD | GET /risks?limit=100        | 50  | 60s      | <fill>   | <fill>   | <fill> | healthy    |
| 2026-MM-DD | GET /controls/effectiveness | 25  | 60s      | <fill>   | <fill>   | <fill> | healthy    |
| 2026-MM-DD | RSS-leak (5min)             | 50  | 5m       | n/a      | n/a      | n/a    | <delta MB> |

---

## Note on CI vs. prod numbers

GitHub Actions hosted runners are 2-vCPU, 7 GB RAM. P95 numbers from a
2-vCPU CI box are typically **3-5× slower** than a 4-vCPU+ Hetzner
production instance. We run the CI baseline anyway because:

- It catches algorithmic regressions (e.g. an N+1 introduced into a
  list endpoint) immediately on PR rather than at deploy time.
- Threshold absolutes are set at "should pass even on the slow CI
  runner" (P95<500ms for risks-list); prod easily beats them.
- Future regressions stand out clearly when CI numbers shift.

The "Prod baseline" section above is for capturing actual production
throughput numbers — those don't get gated, just recorded as historical
reference.

---

_Wave-19 closure PR pinned the methodology + harness scripts; Wave-22
PR added the CI gating step so every PR validates the spec thresholds
on the (slower) CI runner. Prod throughput numbers will land with the
first staging deployment._
