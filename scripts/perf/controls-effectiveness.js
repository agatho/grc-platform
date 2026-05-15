// Wave-19-N3: k6 load test for GET /api/v1/controls/effectiveness.
//
// Cross-module aggregation — joins risks ↔ controls ↔ findings.
// Run alongside hash-chain-watch.js to confirm chain integrity holds
// under load.
//
// Run:
//   ARCTOS_JWT="..." ARCTOS_BASE="http://localhost:3000" k6 run scripts/perf/controls-effectiveness.js
//
// Acceptance:
//   - http_req_failed rate < 1%
//   - P95 < 1000 ms (looser bound than the list endpoint)

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 25,
  duration: "60s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
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
