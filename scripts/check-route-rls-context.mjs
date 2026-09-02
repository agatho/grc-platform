#!/usr/bin/env node
/**
 * check-route-rls-context.mjs — RLS request-context coverage ratchet.
 *
 * Background (#SEC-F01b-RUN, PR #414): under the Next.js App Router runtime a
 * route handler's bare `db.*` reads only run inside the request-scoped RLS
 * context when the handler is wrapped in `withErrorHandler` (which opens the
 * `requestDbStorage.run(...)` frame that `withAuth` → establishRequestScopedContext
 * mutates). A route that calls `withAuth` and issues bare `db.select/query/
 * insert/update/delete/execute` WITHOUT either:
 *    - `withErrorHandler` (opens the ALS frame), or
 *    - a read/audit-context helper (withReadContext / withAuditContext /
 *      withOrgReadContext / withUserReadContext — these open their own
 *      SET LOCAL transaction and don't need the ALS frame)
 * runs context-less. Under the non-superuser `grc_app` role RLS then filters
 * every row (empty 200) or faults (empty-body 500). This is fail-CLOSED — no
 * cross-tenant leak — but the route is functionally broken.
 *
 * This guard is a RATCHET: the set of offending routes lives in
 * `route-rls-context-baseline.txt` and may only SHRINK.
 *   - A NEW offender (not in the baseline) fails CI → wrap it in withErrorHandler.
 *   - A FIXED offender (in the baseline but no longer matching) fails CI → remove
 *     it from the baseline so the ratchet tightens.
 *
 * Run:  node scripts/check-route-rls-context.mjs
 * Auto-refresh baseline (local, after fixing/adding intentionally):
 *       node scripts/check-route-rls-context.mjs --write-baseline
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const API_DIR = path.join(REPO, "apps", "web", "src", "app", "api");
const BASELINE = path.join(__dirname, "route-rls-context-baseline.txt");

const RE_AUTH = /\bwithAuth\b/;
const RE_WEH = /\bwithErrorHandler\b/;
// [ARCTOS-FULL-2026-08-31 · OP-084] `runWithRequestContext` fehlte in dieser
// Liste. Es ist der EXPLIZITE Rahmen aus packages/db/src/request-context.ts:
// es reserviert eine eigene Verbindung, setzt die GUCs darauf und gibt sie
// danach zurueck — genau das, was die drei Read-Helfer auch tun, nur ohne
// deren Lesefilter. Eine Route, die ihn benutzt (der iCal-Feed tut es), war
// damit als Befund gemeldet, obwohl sie den staerkeren der beiden Wege geht.
const RE_RC =
  /\b(with(Read|Audit|OrgRead|UserRead)Context|runWithRequestContext)\b/;
const RE_DBREAD = /\bdb\.(select|query|insert|update|delete|execute)\b/;

/**
 * [ARCTOS-FULL-2026-08-31 · OP-084] Kommentare und Zeichenketten entfernen,
 * BEVOR gemustert wird.
 *
 * Der Waechter las die Datei roh. Das ist bei diesem Regelwerk fatal, weil die
 * Begruendungen in diesem Repository die verbotene Form ZITIEREN: der iCal-Feed
 * erklaert in seinem Kopfkommentar, dass er „uses no `withAuth`" und wie das
 * frühere `db.execute(...)` aussah — beide Muster trafen, keines davon ist
 * Code. Ein Waechter, der Kommentare mitliest, bestraft die Dokumentation
 * eines behobenen Defekts wie den Defekt selbst; ein Autor lernt daraus, den
 * Grund nicht aufzuschreiben. Genau die Klasse Fehlanreiz, die dieser Audit
 * an mehreren Toren gefunden hat.
 *
 * Bewusst ein Zeichenscanner und kein Parser: er muss nur wissen, wo Code
 * aufhoert, nicht was der Code bedeutet. Template-Literale bleiben stehen —
 * `db.execute(sql`…`)` steht IM Code und soll treffen.
 */
function stripCommentsAndStrings(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && c2 === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") i++;
        i++;
      }
      i++;
      out += '""';
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Recursively collect every route.ts under API_DIR. */
function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(fp, out);
    else if (ent.name === "route.ts") out.push(fp);
  }
  return out;
}

function rel(fp) {
  return path.relative(API_DIR, fp).split(path.sep).join("/");
}

/** A route "offends" if it authenticates + reads db directly but opens no context frame. */
function offends(rawSrc) {
  const src = stripCommentsAndStrings(rawSrc);
  return (
    RE_AUTH.test(src) &&
    RE_DBREAD.test(src) &&
    !RE_WEH.test(src) &&
    !RE_RC.test(src)
  );
}

const current = walk(API_DIR)
  .filter((fp) => offends(fs.readFileSync(fp, "utf8")))
  .map(rel)
  .sort();

if (process.argv.includes("--write-baseline")) {
  const header = fs.existsSync(BASELINE)
    ? fs
        .readFileSync(BASELINE, "utf8")
        .split("\n")
        .filter((l) => l.trimStart().startsWith("#"))
        .join("\n") + "\n"
    : "";
  fs.writeFileSync(
    BASELINE,
    header + current.join("\n") + (current.length ? "\n" : ""),
  );
  console.log(`baseline rewritten: ${current.length} entries`);
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE)
  ? fs
      .readFileSync(BASELINE, "utf8")
      .split("\n")
      .map((l) => l.trim())
      // [ARCTOS-FULL-2026-08-31 · OP-084] Kommentarzeilen zulassen. Die Liste
      // steht seit dieser Welle auf 0 Eintraegen; ohne Kopftext waere die Datei
      // leer und niemand wuesste, dass die 0 eine Messung ist und kein Verlust.
      .filter((l) => l && !l.startsWith("#"))
  : [];
const baseSet = new Set(baseline);
const curSet = new Set(current);

const newOffenders = current.filter((f) => !baseSet.has(f));
const fixed = baseline.filter((f) => !curSet.has(f));

let bad = false;
if (newOffenders.length) {
  bad = true;
  console.error(
    `\n✗ ${newOffenders.length} NEW route(s) do authenticated bare db.* reads ` +
      `without a request-scoped RLS context frame.\n` +
      `  Wrap the handler(s) in withErrorHandler (from @/lib/api-wrapper) or use a\n` +
      `  withReadContext/withAuditContext helper. See #SEC-F01b-RUN / PR #414.\n`,
  );
  for (const f of newOffenders) console.error(`    + ${f}`);
}
if (fixed.length) {
  bad = true;
  console.error(
    `\n✗ ${fixed.length} baseline route(s) no longer offend — tighten the ratchet\n` +
      `  by removing them from scripts/route-rls-context-baseline.txt\n` +
      `  (or run: node scripts/check-route-rls-context.mjs --write-baseline).\n`,
  );
  for (const f of fixed) console.error(`    - ${f}`);
}

if (bad) process.exit(1);
console.log(
  `✓ route RLS-context ratchet holds — ${current.length} known-unwrapped ` +
    `route(s) in baseline, 0 new.`,
);
