// CI Performance Baseline (Wave-21-C2)
//
// Runs against the CI E2E stack (Postgres + web on 2-vCPU runner).
// Lighter VU count than the prod baseline (scripts/perf/risks-list.js)
// because GitHub Actions runners are resource-constrained — but still
// gates on the same percentile thresholds the spec requires:
//
//   GET /api/v1/risks?limit=100  → P95 < 500ms, P99 < 1000ms
//   GET /api/v1/health            → P95 < 200ms (cheap healthz, no DB)
//
// Auth: the CI E2E job seeds admin@arctos.dev. We log in via NextAuth's
// credentials provider, capture the session-token cookie, and reuse it
// for every VU. (NextAuth CSRF tokens are session-scoped so we get one
// per VU iteration.)

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE = __ENV.ARCTOS_BASE || "http://localhost:3000";
const EMAIL = __ENV.ARCTOS_EMAIL || "admin@arctos.dev";
const PASSWORD = __ENV.ARCTOS_PASSWORD || "admin123";

const risksLatency = new Trend("risks_list_duration", true);
const healthLatency = new Trend("health_duration", true);

export const options = {
  scenarios: {
    risks_list: {
      executor: "constant-vus",
      vus: 10, // 10 VUs is enough to expose obvious P95 regressions
      duration: "20s",
      exec: "risksList",
    },
    health: {
      executor: "constant-vus",
      vus: 5,
      duration: "20s",
      exec: "healthz",
    },
  },
  thresholds: {
    // Spec thresholds (pre-PR-run baseline; CI runners are 2-vCPU so
    // more permissive than the prod target — adjust both directions
    // when prod numbers come in).
    risks_list_duration: ["p(95)<500", "p(99)<1000"],
    health_duration: ["p(95)<200"],
    // Hard gate: zero failures
    "http_req_failed{scenario:risks_list}": ["rate<0.01"],
    "http_req_failed{scenario:health}": ["rate<0.01"],
  },
};

// One-time login per VU iteration. NextAuth credential-provider flow:
//   1. GET /api/auth/csrf → csrfToken
//   2. POST /api/auth/callback/credentials with form-urlencoded body
//   3. The set-cookie response holds the session-token
function login() {
  const csrfRes = http.get(`${BASE}/api/auth/csrf`);
  const csrfToken = csrfRes.json("csrfToken");
  if (!csrfToken) return null;

  const loginRes = http.post(
    `${BASE}/api/auth/callback/credentials`,
    {
      email: EMAIL,
      password: PASSWORD,
      csrfToken,
      callbackUrl: BASE,
      json: "true",
    },
    {
      redirects: 0,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  // The session cookie is set by the response; k6's cookie jar tracks
  // it automatically for subsequent requests on the same VU.
  return loginRes.status === 200 || loginRes.status === 302;
}

export function risksList() {
  if (!login()) {
    console.error("login failed — skipping iteration");
    sleep(0.1);
    return;
  }

  const res = http.get(`${BASE}/api/v1/risks?limit=100`);
  risksLatency.add(res.timings.duration);
  check(res, {
    "risks status 200": (r) => r.status === 200,
    "risks has data array": (r) => {
      try {
        return Array.isArray(r.json("data"));
      } catch {
        return false;
      }
    },
  });
  sleep(0.1);
}

export function healthz() {
  // /api/v1/health is public — no login needed. Cheaper than risks.
  const res = http.get(`${BASE}/api/v1/health`);
  healthLatency.add(res.timings.duration);
  check(res, { "health status 200": (r) => r.status === 200 });
  sleep(0.1);
}
