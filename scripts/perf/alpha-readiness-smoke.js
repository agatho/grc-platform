// Alpha-readiness load-smoke.
//
// Exercises the high-aggregation endpoints introduced during the
// BPM/Audit/DPMS/TPRM overhauls — 4 KPI dashboards and 2 ZIP-pack
// exports — to surface obvious N+1s, missing indexes, or unbounded
// queries BEFORE pilot users see them.
//
// Run on prod (or a copy of prod with realistic data volume):
//
//   ARCTOS_JWT="<bearer>" \
//   ARCTOS_BASE="https://arctos.charliehund.de" \
//   AUDIT_ID="<one real audit uuid>" \
//   VENDOR_ID="<one real vendor uuid>" \
//   k6 run scripts/perf/alpha-readiness-smoke.js
//
// What the thresholds mean:
//   p(95) < 1500ms  — 95th percentile of all KPI / ZIP requests under 1.5s
//                     (KPI dashboards are nested aggregations; ZIP packs
//                      stream JSZip-encoded bundles, so 1.5s is a generous
//                      ceiling for an alpha. Tighten later.)
//   http_req_failed rate < 2% — allow a small error rate but fail at 2%+
//                                (any sustained 5xx means a real issue).
//
// If the script fails: look at the per-tag p(95) breakdown printed at
// the end. The most likely culprits are tprm-kpis (13 aggregations) and
// audit-pack (multi-table JOIN producing the ZIP).

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend } from "k6/metrics";

const TOKEN = __ENV.ARCTOS_JWT;
const BASE = __ENV.ARCTOS_BASE || "http://localhost:3000";
const AUDIT_ID = __ENV.AUDIT_ID;
const VENDOR_ID = __ENV.VENDOR_ID;

export const options = {
  scenarios: {
    kpi_dashboards: {
      executor: "constant-vus",
      vus: 10,
      duration: "30s",
      exec: "hitKpis",
    },
    zip_exports: {
      executor: "constant-vus",
      vus: 2,
      duration: "30s",
      exec: "hitZips",
      startTime: "5s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500", "p(99)<3000"],
    // Per-endpoint tags get per-endpoint thresholds in the summary.
  },
};

const kpiTrend = new Trend("kpi_latency", true);
const zipTrend = new Trend("zip_latency", true);

const kpiEndpoints = [
  "/api/v1/dashboard/bpm-kpis",
  "/api/v1/dashboard/audit-kpis",
  "/api/v1/dashboard/dpms-kpis",
  "/api/v1/dashboard/tprm-kpis",
];

function authHeaders() {
  return TOKEN
    ? { Authorization: `Bearer ${TOKEN}` }
    : { Cookie: __ENV.ARCTOS_COOKIE || "" };
}

export function hitKpis() {
  for (const path of kpiEndpoints) {
    const res = http.get(`${BASE}${path}`, {
      headers: authHeaders(),
      tags: { endpoint: path },
    });
    kpiTrend.add(res.timings.duration, { endpoint: path });
    check(res, {
      "status 200": (r) => r.status === 200,
      "has data": (r) => {
        try {
          return JSON.parse(r.body).data != null;
        } catch {
          return false;
        }
      },
    });
    sleep(0.2);
  }
}

export function hitZips() {
  if (AUDIT_ID) {
    group("audit-pack", () => {
      const res = http.post(
        `${BASE}/api/v1/audit-mgmt/audits/${AUDIT_ID}/audit-pack`,
        null,
        { headers: authHeaders(), tags: { endpoint: "audit-pack" } },
      );
      zipTrend.add(res.timings.duration, { endpoint: "audit-pack" });
      check(res, {
        "status 200": (r) => r.status === 200,
        "content-type zip": (r) =>
          (r.headers["Content-Type"] || "").includes("application/zip"),
      });
    });
  }
  if (VENDOR_ID) {
    group("vendor-onboarding-pack", () => {
      const res = http.post(
        `${BASE}/api/v1/tprm/vendors/${VENDOR_ID}/onboarding-pack`,
        null,
        { headers: authHeaders(), tags: { endpoint: "vendor-pack" } },
      );
      zipTrend.add(res.timings.duration, { endpoint: "vendor-pack" });
      check(res, {
        "status 200": (r) => r.status === 200,
        "content-type zip": (r) =>
          (r.headers["Content-Type"] || "").includes("application/zip"),
      });
    });
  }
  sleep(1);
}

export function handleSummary(data) {
  const json = JSON.stringify(data.metrics, null, 2);
  return {
    stdout: `\n── Alpha-readiness smoke summary ──\n${json}\n`,
  };
}
