// Wave-19-N3: k6 load test for GET /api/v1/risks?limit=100.
//
// Run:
//   ARCTOS_JWT="..." ARCTOS_BASE="http://localhost:3000" k6 run scripts/perf/risks-list.js
//
// Acceptance (per docs/performance/wave19-baseline.md):
//   - http_req_failed rate < 1%
//   - P95 < 500 ms
//   - P99 < 1000 ms

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 50,
  duration: "60s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500", "p(99)<1000"],
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
    "has data array": (r) => {
      try {
        return Array.isArray(JSON.parse(r.body).data);
      } catch {
        return false;
      }
    },
  });
  sleep(0.1);
}
