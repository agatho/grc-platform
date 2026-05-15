// Wave-19-N3: k6 sidecar that polls hash-chain integrity while
// other perf scripts hammer the platform.
//
// Run in a second terminal alongside risks-list.js or
// controls-effectiveness.js:
//   ARCTOS_JWT="..." ARCTOS_BASE="http://localhost:3000" k6 run scripts/perf/hash-chain-watch.js
//
// Acceptance: every poll returns healthy=true, mismatches=0.

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1,
  duration: "60s",
};

const TOKEN = __ENV.ARCTOS_JWT;
const BASE = __ENV.ARCTOS_BASE || "http://localhost:3000";

export default function () {
  const res = http.get(`${BASE}/api/v1/audit-log/integrity`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  let body = {};
  try {
    body = JSON.parse(res.body);
  } catch {
    /* parse failure handled by the check below */
  }
  check(body, {
    healthy: (b) => b.healthy === true,
    "mismatches=0": (b) => b.mismatches === 0,
  });
  sleep(30);
}
