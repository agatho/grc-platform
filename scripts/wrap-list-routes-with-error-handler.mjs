#!/usr/bin/env node
// One-shot codemod: wrap every list-endpoint GET handler in
// withErrorHandler so PaginationError (from `?limit=500` etc.) surfaces
// as RFC-7807 problem+json instead of an empty 500 body.
//
// #WAVE14D-P0-01/02: Wave-14 QA found that 19 of 21 list routes had no
// error wrapping; PaginationError thrown by paginate() crashed Node
// with no body, and 21 parallel limit=500 calls knocked the whole
// server into 502 for 30s. Centralising the wrap eliminates the class.
//
// Usage: node scripts/wrap-list-routes-with-error-handler.mjs
// Idempotent: if a file already imports withErrorHandler, it's left alone.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "apps", "web", "src", "app", "api", "v1");

// Files to wrap. Each is a route file that exports an async GET that
// calls paginate(req).
const TARGETS = [
  "findings/route.ts",
  "audit-mgmt/audits/route.ts",
  "bcms/bia/route.ts",
  "dpms/dpia/route.ts",
  "dpms/ropa/route.ts",
  "isms/threats/route.ts",
  "isms/vulnerabilities/route.ts",
  "isms/incidents/route.ts",
  "processes/route.ts",
  "assets/route.ts",
  "contracts/route.ts",
  "vendors/route.ts",
  "kris/route.ts",
  "organizations/route.ts",
  "control-tests/route.ts",
  "audit-log/route.ts",
  "tasks/route.ts",
];

let touched = 0;
let skipped = 0;

for (const rel of TARGETS) {
  const path = resolve(ROOT, rel);
  if (!existsSync(path)) {
    console.error(`MISSING ${rel}`);
    continue;
  }

  let src = readFileSync(path, "utf8");

  if (src.includes('from "@/lib/api-wrapper"')) {
    skipped += 1;
    console.log(`SKIP   ${rel} (already wrapped)`);
    continue;
  }

  // 1. Inject the import after the last `from "@/lib/api"` import line.
  //    All target files import withAuth/paginate/paginatedResponse from there,
  //    so this anchor exists in every one.
  const importInsert = `\nimport { withErrorHandler } from "@/lib/api-wrapper";`;
  const importAnchor = /(import\s*\{[^}]*\}\s*from\s*"@\/lib\/api";)/;
  if (!importAnchor.test(src)) {
    console.error(`SKIP   ${rel} (no @/lib/api anchor)`);
    skipped += 1;
    continue;
  }
  src = src.replace(importAnchor, `$1${importInsert}`);

  // 2. Locate `export async function GET(req: Request) {` and rewrite it
  //    to the wrapped form. Track the brace depth from that point so we
  //    can find the matching closing `}` and turn it into `});`.
  const sigRe =
    /export\s+async\s+function\s+GET\s*\(\s*req\s*:\s*Request\s*\)\s*\{/;
  const sigMatch = sigRe.exec(src);
  if (!sigMatch) {
    console.error(`SKIP   ${rel} (no GET signature match)`);
    skipped += 1;
    continue;
  }
  const sigStart = sigMatch.index;
  const sigEnd = sigStart + sigMatch[0].length;
  const openBracePos = sigEnd - 1; // position of the `{`

  // Walk forward from openBracePos counting braces, ignoring those inside
  // strings/comments. This is small files (<400 lines) and the existing
  // code is well-formed TypeScript, so a tokenless scan that just
  // accounts for "...", '...', `...`, // line comments and /* block */
  // is enough.
  let depth = 0;
  let i = openBracePos;
  let inLine = false; // // ...
  let inBlock = false; // /* ... */
  let inStr = null; // "'`" or null
  let closePos = -1;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (inLine) {
      if (ch === "\n") inLine = false;
      i += 1;
      continue;
    }
    if (inBlock) {
      if (ch === "*" && next === "/") {
        inBlock = false;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (inStr) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === inStr) inStr = null;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLine = true;
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlock = true;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      i += 1;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        closePos = i;
        break;
      }
      i += 1;
      continue;
    }
    i += 1;
  }

  if (closePos === -1) {
    console.error(`SKIP   ${rel} (couldn't find GET close brace)`);
    skipped += 1;
    continue;
  }

  // 3. Splice. Replace signature with the wrapped form, replace the
  //    closing `}` with `});`.
  const before = src.slice(0, sigStart);
  const wrappedSig = `export const GET = withErrorHandler(async function GET(req: Request) {`;
  const middle = src.slice(sigEnd, closePos);
  const after = src.slice(closePos + 1);
  src = `${before}${wrappedSig}${middle}});${after}`;

  writeFileSync(path, src, "utf8");
  touched += 1;
  console.log(`OK     ${rel}`);
}

console.log(`\n${touched} files wrapped, ${skipped} skipped.`);
