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

// Aktuell leer. Die Next.js-Batch-Disclosure vom 2026-07-23 (8 GHSA-IDs)
// wurde mit der Migration auf Next 16.2.11 behoben (die GitHub-Advisories
// nennen 16.2.11 als Fix der 16er-Linie — nicht erst 16.3, das es nur als
// preview/canary gibt; Backport für die 15er-Linie: 15.5.21). sharp
// (GHSA-f88m-g3jw-g9cj) ist via Root-`overrides.sharp: ">=0.35.0"` auf
// die gefixte 0.35er-Linie gehoben (sharp kommt nur als optionale
// next-Dependency in den Tree; next/image wird in apps/web nicht genutzt).
const ALLOWLIST = [];

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
