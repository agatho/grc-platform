#!/usr/bin/env node
/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S14-15, S14-16, S14-18]
 *
 * Generates `docs/API_REFERENCE.md` from the route tree.
 *
 * The previous file was hand-maintained and had drifted the way hand-
 * maintained inventories always do:
 *
 *   431 documented method/path lines, 297 distinct paths
 *   1.357 real route files  →  1.060 routes (78,1 %) undocumented
 *   2 documented paths with no route at all
 *       GET /audit-log/integrity-check  (real path: /audit-log/integrity —
 *         a client following the reference gets a 404 on, of all things, the
 *         hash-chain integrity check that docs/STATUS.md cites as the audit
 *         evidence)
 *       GET /processes/:id/export/svg   (no such route)
 *   2 documented methods the route does not export (→ 405)
 *   Numerous endpoints marked "(paginated)" although only 43 of 1.355 routes
 *     read a pagination parameter at all
 *
 * and it presented itself as "ARCTOS API Reference" with no indication that it
 * covered 22 % of the surface. It is the document external integrators and
 * procurement reviewers receive.
 *
 * Hand-correcting it would have produced the same document one drift cycle
 * later, so it is generated. A ghost endpoint is now impossible by
 * construction, and the coverage numbers in the header are counted rather than
 * claimed.
 *
 * What is read out of each `route.ts`, statically:
 *   - path            from the folder structure ([id] → :id)
 *   - methods         `export async function GET`, `export const GET =`,
 *                     `export { GET } from`
 *   - auth            `withAuth("role", …)` arguments, or "session"
 *   - module gate     `requireModule("key")`
 *   - pagination      which of limit/offset/page/pageSize/cursor it reads
 *   - error contract  problem+json (RFC 7807) vs. legacy `{ error }`
 *
 * Descriptions are NOT invented: the leading comment of the file is used when
 * there is one, and the cell is left empty otherwise. An empty cell is honest;
 * a guessed sentence is what the old file was full of.
 *
 * Usage: node scripts/generate-api-reference.mjs [--check]
 *        --check exits 1 if the file on disk differs from the generated one.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_DIR = join(ROOT, "apps/web/src/app/api");
const OUT = join(ROOT, "docs/API_REFERENCE.md");
const CHECK = process.argv.includes("--check");

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const PAGINATION_PARAMS = [
  "limit",
  "offset",
  "page",
  "pageSize",
  "cursor",
  "perPage",
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/^route\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function routePath(file) {
  const rel = file.slice(API_DIR.length).replace(/\\/g, "/");
  return (
    "/api" +
    rel
      .replace(/\/route\.tsx?$/, "")
      .replace(/\[\.\.\.([^\]]+)\]/g, ":$1*")
      .replace(/\[([^\]]+)\]/g, ":$1")
  );
}

function methodsOf(src) {
  return METHODS.filter(
    (m) =>
      new RegExp(`export\\s+async\\s+function\\s+${m}\\b`).test(src) ||
      new RegExp(`export\\s+(?:const|function)\\s+${m}\\s*[=(]`).test(src) ||
      new RegExp(`export\\s*\\{[^}]*\\b${m}\\b[^}]*\\}\\s*from`).test(src),
  );
}

function authOf(src) {
  const m = src.match(/withAuth\(\s*([^)]*)\)/);
  if (!m) return src.includes("withAuth") ? "session" : "—";
  const roles = [...m[1].matchAll(/"([a-z_]+)"/g)].map((r) => r[1]);
  return roles.length ? roles.join(", ") : "session";
}

function moduleOf(src) {
  const m = src.match(/requireModule\(\s*"([a-z0-9_-]+)"/);
  return m ? m[1] : "—";
}

function paginationOf(src) {
  const found = PAGINATION_PARAMS.filter((p) =>
    new RegExp(`(?:searchParams|params)\\.get\\(\\s*["']${p}["']`).test(src),
  );
  return found.length ? found.join(", ") : "—";
}

function errorShapeOf(src) {
  if (
    /problem(?:Response)?\b|application\/problem\+json|from "@\/lib\/api-errors"/.test(
      src,
    )
  )
    return "problem+json";
  if (/withErrorHandler\s*\(/.test(src)) return "problem+json (wrapper)";
  if (/\{\s*error:/.test(src)) return "legacy `{error}`";
  return "—";
}

/** First `//` block or `/** … *\/` at the top of the file, one line. */
function descriptionOf(src) {
  const lines = src.split("\n");
  const parts = [];
  for (const line of lines) {
    const t = line.trim();
    if (t === "" && parts.length === 0) continue;
    if (t.startsWith("//")) parts.push(t.replace(/^\/\/\s?/, ""));
    else if (t.startsWith("/**") || t.startsWith("*")) {
      const c = t.replace(/^\/\*+\s?|^\*+\/?\s?/g, "").trim();
      if (c) parts.push(c);
    } else if (parts.length) break;
    else if (t.startsWith("import") || t.startsWith("/*")) break;
    else break;
    if (parts.length >= 2) break;
  }
  const text = parts.join(" ").replace(/\|/g, "\\|").trim();
  if (!text) return "";
  // Drop the "METHOD /path —" prefix these comments usually start with; it is
  // already in the two columns to the left.
  return text
    .replace(/^(?:GET|POST|PUT|PATCH|DELETE)\s+\S+\s*[-—:]*\s*/i, "")
    .slice(0, 110);
}

const files = walk(API_DIR).sort();
const routes = files.map((f) => {
  const src = readFileSync(f, "utf8");
  return {
    path: routePath(f),
    file: f.slice(ROOT.length + 1),
    methods: methodsOf(src),
    auth: authOf(src),
    module: moduleOf(src),
    pagination: paginationOf(src),
    errorShape: errorShapeOf(src),
    description: descriptionOf(src),
  };
});

// ── grouping ───────────────────────────────────────────────────────────────
const groups = new Map();
for (const r of routes) {
  // /api/v1/<group>/… ; everything outside /api/v1 lands in "Outside /api/v1".
  const m = r.path.match(/^\/api\/v1\/([^/]+)/);
  const key = m ? m[1] : "_outside-v1";
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

const totalRoutes = routes.length;
const totalOperations = routes.reduce((n, r) => n + r.methods.length, 0);
const withAuthGate = routes.filter((r) => r.auth !== "—").length;
const withModuleGate = routes.filter((r) => r.module !== "—").length;
const withPagination = routes.filter((r) => r.pagination !== "—").length;
const problemJson = routes.filter((r) =>
  r.errorShape.startsWith("problem+json"),
).length;
const outsideV1 = routes.filter((r) => !r.path.startsWith("/api/v1/"));

const today = new Date().toISOString().slice(0, 10);

let md = `<!-- GENERATED FILE — DO NOT EDIT BY HAND.
     Produced by scripts/generate-api-reference.mjs from the route tree under
     apps/web/src/app/api/. Regenerate with:

         node scripts/generate-api-reference.mjs

     [ARCTOS-FULL-2026-08-31 / WP12 · S14-15] The previous version of this file
     was hand-maintained. It documented 297 of 1.357 route paths (22 %) while
     presenting itself as the complete API reference, listed two endpoints that
     do not exist (one of them the audit-log integrity check) and two methods
     the routes do not export, and marked endpoints "(paginated)" that read no
     pagination parameter. Generating it is the only fix that does not drift
     again. -->

# ARCTOS API Reference

**Generated:** ${today} · **Source:** \`apps/web/src/app/api/**/route.ts\`

Base URL: \`/api/v1\`. Authentication is session-based (Auth.js); roles are
checked per organisation context.

## Coverage

| Metric | Value |
|---|---:|
| Route files | ${totalRoutes} |
| Method/path operations | ${totalOperations} |
| Routes with an auth gate (\`withAuth\`) | ${withAuthGate} |
| Routes with a module gate (\`requireModule\`) | ${withModuleGate} |
| Routes reading a pagination parameter | ${withPagination} |
| Routes emitting RFC 7807 \`problem+json\` | ${problemJson} |
| Routes outside \`/api/v1\` | ${outsideV1.length} |

Every row below is derived from a file that exists; a path that is not listed
does not exist. \`—\` in a column means the route does not use that mechanism —
it is not a gap in this document.

**Columns**

- **Auth** — the roles passed to \`withAuth(...)\`. \`session\` = any
  authenticated user. \`—\` = no \`withAuth\` call (public, or token-authenticated;
  the public allowlist is \`PUBLIC_EXACT_PATHS\`/\`PUBLIC_PREFIXES\`/\`PUBLIC_PATTERNS\`
  in \`packages/auth/src/rbac.ts\`).
- **Module** — the \`requireModule\` gate key.
- **Pagination** — the query parameters the handler actually reads
  (S14-18). Four spellings are in use across the codebase; the canonical
  contract is documented in \`docs/ADR-020-api-versioning.md\`.
- **Errors** — \`problem+json\` where the route (or its \`withErrorHandler\`
  wrapper) emits RFC 7807 per ADR-021, \`legacy {error}\` otherwise (S14-16).

`;

const titleCase = (s) =>
  s === "_outside-v1"
    ? "Outside `/api/v1`"
    : s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

for (const key of [...groups.keys()].sort()) {
  const rows = groups.get(key).sort((a, b) => a.path.localeCompare(b.path));
  md += `\n## ${titleCase(key)}\n\n`;
  if (key === "_outside-v1") {
    md += `> ADR-020 states "Alle REST-Endpoints liegen unter \`/api/v1/**\`".\n> These ${rows.length} do not, and the ADR names no exception (S14-17 / D10).\n\n`;
  }
  md += `| Method | Path | Auth | Module | Pagination | Errors | Notes |\n`;
  md += `|---|---|---|---|---|---|---|\n`;
  for (const r of rows) {
    const methods = r.methods.length
      ? r.methods.join(", ")
      : "*(none exported)*";
    md += `| ${methods} | \`${r.path}\` | ${r.auth} | ${r.module} | ${r.pagination} | ${r.errorShape} | ${r.description} |\n`;
  }
}

md += `\n---\n\n_${totalRoutes} routes, ${totalOperations} operations. Regenerate with \`node scripts/generate-api-reference.mjs\`._\n`;

if (CHECK) {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {
    /* missing file → mismatch */
  }
  // The generation date changes daily; compare everything else.
  const strip = (t) => t.replace(/^\*\*Generated:\*\* \d{4}-\d{2}-\d{2}/m, "");
  if (strip(current) !== strip(md)) {
    console.error(
      "docs/API_REFERENCE.md is out of date. Run: node scripts/generate-api-reference.mjs",
    );
    process.exit(1);
  }
  console.log("docs/API_REFERENCE.md is up to date.");
  process.exit(0);
}

writeFileSync(OUT, md, "utf8");
console.log(
  `Wrote ${OUT}: ${totalRoutes} routes, ${totalOperations} operations, ` +
    `${problemJson} with problem+json, ${withPagination} paginated.`,
);
void statSync;
