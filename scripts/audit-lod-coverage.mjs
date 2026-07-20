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
import { join, relative } from "node:path";

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

// ─── Non-withAuth auth mechanisms (false-positive fixes, 2026-07-20) ────
//
// The scan previously only matched `withAuth`, so routes with their own
// session lookup (`auth()` from Auth.js) or token validation (SCIM
// bearer, portal tokens, SAML assertion) were miscounted as "anonymous
// mutating" (RBAC-smoke finding: auth/switch-org + SCIM routes).

// Session auth applied directly via Auth.js (e.g. /auth/switch-org).
const SESSION_AUTH_RE = /\bawait\s+auth\s*\(\s*\)/;

// Recognized in-handler token validators → authKind "token".
const TOKEN_VALIDATOR_RE =
  /\b(validateScimToken|validateDdToken|validateMailboxToken|validateSAMLSignature|validateSAMLAssertion)\b/;

// Public-by-design endpoints whose "auth" is intrinsic to the handler
// (credential login, single-use DB-checked tokens, anonymous intake).
// Keep in sync with the auth-smoke allowlist. Keys are route prefixes.
const PUBLIC_BY_DESIGN = new Map([
  [
    "/api/v1/auth/admin-login",
    "Credential login endpoint — public by design",
  ],
  [
    "/api/v1/invitations/[token]/accept",
    "Single-use invitation token, validated against DB in handler",
  ],
  [
    "/api/v1/portal/report/[orgCode]",
    "Anonymous whistleblowing intake (HinSchG) — deliberately unauthenticated",
  ],
  [
    "/api/v1/vendors/dd/submit",
    "External vendor DD submission — accessToken query param validated against DB",
  ],
  [
    "/api/v1/portal/mailbox/[token]/evidence",
    "Whistleblower anonymous mailbox — token validated inline against wb_anonymous_mailbox in handler",
  ],
]);

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
    const relPath = relative(ROOT, file).replace(/\\/g, "/");
    const route = relPath
      .replace("apps/web/src/app/api/v1/", "/api/v1/")
      .replace("/route.ts", "");

    // Auth mechanism classification (most specific wins):
    //   withAuth > session (auth()) > token validator > public-by-design > anonymous
    const hasWithAuth = src.includes("withAuth");
    const hasSessionAuth = SESSION_AUTH_RE.test(src);
    const tokenMatch = src.match(TOKEN_VALIDATOR_RE);
    const publicReason = PUBLIC_BY_DESIGN.get(route) ?? null;
    let authKind = "anonymous";
    if (hasWithAuth) authKind = "withAuth";
    else if (hasSessionAuth) authKind = "session";
    else if (tokenMatch) authKind = `token:${tokenMatch[1]}`;
    else if (publicReason) authKind = "public-by-design";

    for (const method of methods) {
      const isMutating = method !== "GET";
      const roleLods = Array.from(new Set(roles.map((r) => ROLE_TO_LOD[r] ?? "unknown")));
      const anonymous = authKind === "anonymous" && roles.length === 0 && lods.length === 0;
      rows.push({
        route,
        method,
        isMutating,
        roles: roles.join("|"),
        lods: [...lods, ...roleLods.filter((r) => ["1st", "2nd", "3rd", "cross", "isolated", "read"].includes(r))].join("|"),
        authKind,
        publicReason,
        anonymous,
      });
    }
  }

  await mkdir(OUT_DIR, { recursive: true });

  // CSV
  const csv = [
    "route,method,mutating,roles,lods,auth_kind,anonymous",
    ...rows.map((r) => `${r.route},${r.method},${r.isMutating},${r.roles},${r.lods},${r.authKind},${r.anonymous}`),
  ].join("\n");
  await writeFile(join(OUT_DIR, "lod-coverage.csv"), csv);

  // Markdown summary
  const anonymousMutating = rows.filter((r) => r.isMutating && r.anonymous);
  const sessionMutating = rows.filter((r) => r.isMutating && r.authKind === "session");
  const tokenMutating = rows.filter((r) => r.isMutating && r.authKind.startsWith("token:"));
  const publicMutating = rows.filter((r) => r.isMutating && r.authKind === "public-by-design");
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
    `- Anonymous mutating (no auth mechanism found): **${anonymousMutating.length}** ← should be 0`,
    `- Session-authenticated mutating (Auth.js \`auth()\` without withAuth): ${sessionMutating.length}`,
    `- Token-authenticated mutating (SCIM / portal / SAML validators): ${tokenMutating.length}`,
    `- Public-by-design mutating (documented allowlist): ${publicMutating.length}`,
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

  if (sessionMutating.length > 0) {
    md.push(`## Session-authenticated mutating endpoints (Auth.js \`auth()\`)`, "");
    md.push(`Authenticated via the Auth.js session directly instead of the \`withAuth\` helper (no role restriction beyond a valid session).`, "");
    md.push(`| Route | Method |`);
    md.push(`|---|---|`);
    for (const r of sessionMutating) md.push(`| \`${r.route}\` | ${r.method} |`);
    md.push("");
  }

  if (tokenMutating.length > 0) {
    md.push(`## Token-authenticated mutating endpoints`, "");
    md.push(`Authenticated via an in-handler token validator (SCIM bearer token, portal access tokens, SAML assertion validation).`, "");
    md.push(`| Route | Method | Validator |`);
    md.push(`|---|---|---|`);
    for (const r of tokenMutating) md.push(`| \`${r.route}\` | ${r.method} | \`${r.authKind.slice("token:".length)}\` |`);
    md.push("");
  }

  if (publicMutating.length > 0) {
    md.push(`## Public-by-design mutating endpoints (documented allowlist)`, "");
    md.push(`| Route | Method | Reason |`);
    md.push(`|---|---|---|`);
    for (const r of publicMutating) md.push(`| \`${r.route}\` | ${r.method} | ${r.publicReason} |`);
    md.push("");
  }

  md.push(`## Methodology`);
  md.push(`- Parses every \`route.ts\` under \`apps/web/src/app/api/v1/\``);
  md.push(`- Extracts \`withAuth("...")\` args (roles), \`requireLineOfDefense([...])\` args (LoD)`);
  md.push(`- Additionally recognizes (2026-07-20): direct Auth.js session auth (\`await auth()\`), in-handler token validators (\`validateScimToken\`, \`validateDdToken\`, \`validateMailboxToken\`, \`validateSAMLSignature\`/\`validateSAMLAssertion\`) and a hand-curated public-by-design allowlist (see \`PUBLIC_BY_DESIGN\` in the script) — these were previously false-positive "anonymous mutating" counts (RBAC-smoke finding re auth/switch-org + SCIM).`);
  md.push(`- Role→LoD map (per ADR-007):`);
  for (const [role, lod] of Object.entries(ROLE_TO_LOD)) md.push(`  - \`${role}\` → ${lod}`);
  md.push(``);
  md.push(`False positives possible when auth is applied via a shared helper that this script doesn't match. Cross-check against \`grep -r "withAuth"\` in suspicious cases.`);

  await writeFile(join(OUT_DIR, "lod-coverage.md"), md.join("\n"));

  console.log(`→ Wrote docs/security/lod-coverage.{md,csv}`);
  console.log(`  Total routes: ${rows.length}`);
  console.log(`  Anonymous mutating: ${anonymousMutating.length}`);
  console.log(`  Session-auth mutating: ${sessionMutating.length}`);
  console.log(`  Token-auth mutating: ${tokenMutating.length}`);
  console.log(`  Public-by-design mutating: ${publicMutating.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
