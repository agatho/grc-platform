#!/usr/bin/env node
// ============================================================================
// Security-Audit-Gate (CI) — ersetzt das nackte `npm audit --audit-level=high`.
//
// Motivation (2026-07-23): Upstream-Advisories ohne non-breaking Fix (z. B.
// die Next.js-Batch-Disclosure GHSA-m99w-… mit Fix erst in Next 16) machten
// die CI dauerhaft rot, ohne dass ein sinnvoller sofortiger Fix existiert.
// Dieses Gate failt weiterhin bei JEDEM neuen high/critical-Advisory in
// Produktions-Dependencies — außer es steht mit GHSA-ID, Begründung und
// ABLAUFDATUM in der Allowlist unten. Abgelaufene Einträge failen wieder.
//
// Pflege: Eintrag nur mit Begründung + realistischem `until` ergänzen; die
// Liste ist bewusst im Repo sichtbar (Audit-Trail via git blame).
// ============================================================================
import { execSync } from "node:child_process";

const ALLOWLIST = [
  // Next.js Batch-Disclosure 2026-07-23 — kein Fix innerhalb von Next 15,
  // gepatcht erst ab Next 16.3. Migration auf Next 16 als Arbeitspaket
  // eingeplant. Exposition gemindert: Instanz läuft hinter Auth (alle
  // API-Routen 401-gated, Auth-Smoke-Test) und Caddy-Reverse-Proxy.
  ...[
    "GHSA-m99w-x7hq-7vfj", // DoS in App Router Server Actions
    "GHSA-89xv-2m56-2m9x", // SSRF in Server Actions (custom servers)
    "GHSA-68g3-v927-f742", // cache confusion (request bodies)
    "GHSA-4633-3j49-mh5q", // cache confusion (invalid UTF-8)
    "GHSA-4c39-4ccg-62r3", // unbounded Server Action payload (Edge)
    "GHSA-p9j2-gv94-2wf4", // SSRF via rewrites destination
    "GHSA-q8wf-6r8g-63ch", // DoS Image Optimization SVGs
    "GHSA-955p-x3mx-jcvp", // disclosure of Server Function endpoints
  ].map((ghsa) => ({
    ghsa,
    until: "2026-10-31",
    reason: "Next.js: Fix erst in v16.3, Migration geplant",
  })),
  {
    // sharp wird ausschließlich als optionale Dependency von Next.js
    // gezogen (Image Optimization); Fix kommt mit der Next-16-Migration.
    ghsa: "GHSA-f88m-g3jw-g9cj",
    until: "2026-10-31",
    reason: "sharp: nur via next, Fix mit Next-16-Migration",
  },
];

const today = new Date().toISOString().slice(0, 10);
let auditJson;
try {
  auditJson = execSync("npm audit --omit=dev --json", {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (e) {
  // npm audit exitet != 0 bei Findings — stdout enthält trotzdem das JSON.
  auditJson = e.stdout;
}

const report = JSON.parse(auditJson);
const vulns = report.vulnerabilities ?? {};
const failures = [];
const allowed = [];

for (const [pkg, info] of Object.entries(vulns)) {
  if (!["high", "critical"].includes(info.severity)) continue;
  for (const via of info.via ?? []) {
    if (typeof via !== "object" || !via.url) continue; // transitive Verweise
    if (!["high", "critical"].includes(via.severity)) continue;
    const ghsa = (via.url.match(/GHSA-[a-z0-9-]+/i) ?? [null])[0];
    const entry = ALLOWLIST.find((a) => a.ghsa === ghsa);
    if (entry && entry.until >= today) {
      allowed.push(
        `${pkg}: ${ghsa} (${via.title}) — bis ${entry.until}: ${entry.reason}`,
      );
    } else if (entry) {
      failures.push(
        `${pkg}: ${ghsa} — Allowlist-Eintrag ABGELAUFEN (${entry.until}): ${via.title}`,
      );
    } else {
      failures.push(
        `${pkg}: ${ghsa ?? via.url} [${via.severity}] ${via.title}`,
      );
    }
  }
}

if (allowed.length) {
  console.log(`Allowlisted (${allowed.length}):`);
  for (const a of [...new Set(allowed)]) console.log(`  ~ ${a}`);
}
if (failures.length) {
  console.error(
    `\nNicht-allowlistete high/critical-Advisories (${failures.length}):`,
  );
  for (const f of [...new Set(failures)]) console.error(`  ✗ ${f}`);
  console.error(
    "\nFix einspielen oder — nur mit Begründung + Ablaufdatum — in scripts/audit-gate.mjs allowlisten.",
  );
  process.exit(1);
}
console.log(
  "audit-gate: OK (keine neuen high/critical-Advisories in Produktions-Dependencies)",
);
