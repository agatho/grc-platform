#!/usr/bin/env node
// audit-lod-coverage.mjs
//
// Reports which API routes are guarded by which Line-of-Defense.
// Extracts requireLineOfDefense(...) calls + withAuth(...role, ...) + requireRole(...)
// from all API route files and builds a coverage matrix:
//   Route × [1st, 2nd, 3rd, cross-cutting] × Rollen
//
// Output: docs/security/lod-coverage.md + .csv. Gatekeeper-Check: every
// mutating endpoint (POST/PUT/PATCH/DELETE) should be reachable by at
// least one explicitly-named role (no anonymous mutations).

import { readdir, readFile, mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const API_DIR = join(ROOT, "apps/web/src/app/api/v1");
const OUT_DIR = join(ROOT, "docs/security");

const ROLE_TO_LOD = {
  admin: "cross",
  risk_manager: "2nd",
  control_owner: "1st",
  process_owner: "1st",
  auditor: "3rd",
  dpo: "2nd",
  viewer: "read",
  whistleblowing_officer: "isolated",
  ombudsperson: "isolated",
  esg_manager: "2nd",
  esg_contributor: "1st",
};

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.name === "route.ts" || entry.name === "route.tsx") {
      files.push(full);
    }
  }
  return files;
}

function extractHttpMethods(src) {
  const methods = [];
  for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
    if (new RegExp(`export\\s+async\\s+function\\s+${m}\\b`).test(src)) {
      methods.push(m);
    }
  }
  return methods;
}

function extractAuthCall(src) {
  // Match withAuth("a", "b", ...) or withAuth() — captures args
  const calls = [];
  const re = /withAuth\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const args = m[1]
      .split(",")
      .map((a) => a.trim().replace(/^["']|["']$/g, ""))
      .filter((a) => a.length > 0);
    calls.push(args);
  }
  return calls.flat();
}

function extractRequireLoD(src) {
  const re = /requireLineOfDefense\(\[([^\]]*)\]/g;
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    const lods = m[1]
      .split(",")
      .map((a) => a.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    out.push(...lods);
  }
  return out;
}

async function main() {
  const files = await walk(API_DIR);
  const rows = [];
  for (const file of files) {
    const src = await readFile(file, "utf8");
    const methods = extractHttpMethods(src);
    const roles = extractAuthCall(src);
    const lods = extractRequireLoD(src);
    const relPath = file.replace(ROOT + "/", "").replace(/\\/g, "/");
    const route = relPath
      .replace("apps/web/src/app/api/v1/", "/api/v1/")
      .replace("/route.ts", "");

    for (const method of methods) {
      const isMutating = method !== "GET";
      const roleLods = Array.from(new Set(roles.map((r) => ROLE_TO_LOD[r] ?? "unknown")));
      const anonymous = roles.length === 0 && lods.length === 0 && !src.includes("withAuth");
      rows.push({
        route,
        method,
        isMutating,
        roles: roles.join("|"),
        lods: [...lods, ...roleLods.filter((r) => ["1st", "2nd", "3rd", "cross", "isolated", "read"].includes(r))].join("|"),
        anonymous,
      });
    }
  }

  await mkdir(OUT_DIR, { recursive: true });

  // CSV
  const csv = [
    "route,method,mutating,roles,lods,anonymous",
    ...rows.map((r) => `${r.route},${r.method},${r.isMutating},${r.roles},${r.lods},${r.anonymous}`),
  ].join("\n");
  await writeFile(join(OUT_DIR, "lod-coverage.csv"), csv);

  // Markdown summary
  const anonymousMutating = rows.filter((r) => r.isMutating && r.anonymous);
  const getOnly = rows.filter((r) => r.method === "GET" && r.roles === "");
  const lodCoverage = rows.reduce((acc, r) => { r.lods.split("|").filter(Boolean).forEach((l) => { acc[l] = (acc[l] ?? 0) + 1; }); return acc; }, {});

  const md = [
    `# Three-Lines-of-Defense Coverage Report`,
    ``,
    `_Generated: ${new Date().toISOString()}_`,
    ``,
    `## Summary`,
    ``,
    `- Total API routes: ${rows.length}`,
    `- Mutating (POST/PUT/PATCH/DELETE): ${rows.filter((r) => r.isMutating).length}`,
    `- Anonymous mutating (no withAuth/LoD): **${anonymousMutating.length}** ← should be 0`,
    `- GET without withAuth: ${getOnly.length} (public-ish, e.g. /health)`,
    ``,
    `## Role/LoD distribution`,
    ``,
    `| LoD/Role | Endpoints |`,
    `|---|---|`,
    ...Object.entries(lodCoverage).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`),
    ``,
  ];

  if (anonymousMutating.length > 0) {
    md.push(`## ⚠️ Anonymous mutating endpoints`, "");
    md.push(`| Route | Method |`);
    md.push(`|---|---|`);
    for (const r of anonymousMutating) md.push(`| \`${r.route}\` | ${r.method} |`);
    md.push("");
  }

  md.push(`## Methodology`);
  md.push(`- Parses every \`route.ts\` under \`apps/web/src/app/api/v1/\``);
  md.push(`- Extracts \`withAuth("...")\` args (roles), \`requireLineOfDefense([...])\` args (LoD)`);
  md.push(`- Role→LoD map (per ADR-007):`);
  for (const [role, lod] of Object.entries(ROLE_TO_LOD)) md.push(`  - \`${role}\` → ${lod}`);
  md.push(``);
  md.push(`False positives possible when auth is applied via shared helper that this script doesn't match. Cross-check against \`grep -r "withAuth"\` in suspicious cases.`);

  await writeFile(join(OUT_DIR, "lod-coverage.md"), md.join("\n"));

  console.log(`→ Wrote docs/security/lod-coverage.{md,csv}`);
  console.log(`  Total routes: ${rows.length}`);
  console.log(`  Anonymous mutating: ${anonymousMutating.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
