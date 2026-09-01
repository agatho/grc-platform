#!/usr/bin/env node
/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S14-05, S14-07, S14-08, S14-21]
 *
 * Checks the translation CATALOGUE against the CODE. The existing
 * `scripts/audit-i18n-coverage.mjs` compares `messages/de` with `messages/en`
 * and nothing else — it never opens `src/`, which is why 21 keys used in the
 * code but absent from the catalogue went unnoticed, two of them on the main
 * dashboard and one inside an `aria-label` (S14-05, S14-08 point 1).
 *
 * What this adds, one check per gap the audit named:
 *
 *   missing-keys      every `t("…")` literal resolves to a message (S14-05)
 *   namespace-drift   `src/i18n/request.ts` registers every namespace file
 *                     that exists on disk (S14-07 / C6). The list has to stay
 *                     explicit — the bundler needs static `import()`
 *                     specifiers — so the check is what stops it drifting.
 *   bundle-drift      the runtime bundles `messages/{de,en}.json` agree with
 *                     the namespace directories (S14-08 point 3)
 *   unused-keys       reported, never fatal: 399 call sites build keys from
 *                     template literals, so the number is an upper bound
 *                     (S14-21). `--max-unused` turns it into a ratchet.
 *
 * Exit code 1 on any fatal finding. Advisory findings are printed and do not
 * fail the run.
 *
 * Usage:
 *   node scripts/audit-i18n-usage.mjs [--json] [--max-unused N]
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const repoRoot = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "..",
);
const webRoot = path.join(repoRoot, "apps/web");
const srcRoot = path.join(webRoot, "src");
const messagesRoot = path.join(webRoot, "messages");
const requestTs = path.join(srcRoot, "i18n/request.ts");

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const maxUnusedIdx = argv.indexOf("--max-unused");
const maxUnused =
  maxUnusedIdx >= 0 ? Number(argv[maxUnusedIdx + 1]) : Number.POSITIVE_INFINITY;

// ── helpers ────────────────────────────────────────────────────────────────

function walk(dir, filter, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(p, filter, out);
    } else if (filter(p)) out.push(p);
  }
  return out;
}

/** Flattens `{a:{b:"x"}}` to `["a.b"]`, and records intermediate object nodes. */
function flatten(obj, prefix, leaves, nodes) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      nodes.add(key);
      flatten(v, key, leaves, nodes);
    } else {
      leaves.add(key);
    }
  }
}

// ── 1. catalogue ───────────────────────────────────────────────────────────

/** file stem -> namespace alias, as registered in request.ts */
function readRegisteredNamespaces() {
  const src = fs.readFileSync(requestTs, "utf8");
  // Scope the scan to the namespaceMap literal — `SUPPORTED_LOCALES` is also
  // an array of two string literals and would otherwise be picked up.
  const start = src.indexOf("const namespaceMap");
  const end = src.indexOf("];", start);
  if (start < 0 || end < 0)
    throw new Error("namespaceMap not found in src/i18n/request.ts");
  const block = src.slice(start, end);
  const map = new Map();
  const rx = /\[\s*"([a-z0-9-]+)"\s*,\s*"([A-Za-z0-9]+)"\s*\]/g;
  let m;
  while ((m = rx.exec(block))) map.set(m[1], m[2]);
  return map;
}

const registered = readRegisteredNamespaces();
const onDisk = fs
  .readdirSync(path.join(messagesRoot, "de"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

const unregistered = onDisk.filter((f) => !registered.has(f));
const registeredButMissing = [...registered.keys()].filter(
  (f) => !onDisk.includes(f),
);

/** Build the message tree exactly as `loadIndividualFiles` does. */
function buildCatalogue(locale) {
  const merged = {};
  for (const [file, alias] of registered) {
    const p = path.join(messagesRoot, locale, `${file}.json`);
    if (!fs.existsSync(p)) continue;
    merged[alias] = JSON.parse(fs.readFileSync(p, "utf8"));
  }
  // Mirrors `mergeCommonNamespace` in apps/web/src/i18n/request.ts and the
  // identical merge in apps/web/scripts/build-messages.ts (S14-05): common.json
  // is spread into the root AND exposed as the `common` namespace, with its
  // own nested `common` node merged in so both spellings resolve.
  const commonFile = merged.common ?? {};
  const nested = commonFile.common ?? {};
  return { ...commonFile, ...merged, common: { ...commonFile, ...nested } };
}

const catalogue = buildCatalogue("de");
const leaves = new Set();
const nodes = new Set();
flatten(catalogue, "", leaves, nodes);

// ── 2. usage in code ───────────────────────────────────────────────────────

const tsxFiles = walk(
  srcRoot,
  (p) =>
    (p.endsWith(".tsx") || p.endsWith(".ts")) &&
    !p.includes("__tests__") &&
    !p.endsWith(".test.ts") &&
    !p.endsWith(".test.tsx"),
);

/**
 * Resolves `const t = useTranslations("ns")` / `getTranslations("ns")` and the
 * literal keys called on the resulting binding. Template-literal keys are
 * collected separately: they cannot be resolved statically and must not be
 * reported as missing (that would make the gate cry wolf and get switched off,
 * which is how S14-08 happened in the first place).
 */
const used = new Map(); // fullKey -> [file:line]
const dynamic = [];

for (const file of tsxFiles) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes("seTranslations") && !text.includes("etTranslations"))
    continue;
  const lines = text.split("\n");

  // binding name -> namespace ("" = root)
  const bindings = new Map();
  const bindRx =
    /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(\s*(?:"([^"]*)"|'([^']*)')?\s*\)/g;
  let bm;
  while ((bm = bindRx.exec(text))) bindings.set(bm[1], bm[2] ?? bm[3] ?? "");

  for (const [bind, ns] of bindings) {
    const callRx = new RegExp(
      `\\b${bind}(?:\\.rich|\\.raw|\\.markup)?\\s*\\(\\s*(?:\`([^\`]*)\`|"([^"]*)"|'([^']*)')`,
      "g",
    );
    let cm;
    while ((cm = callRx.exec(text))) {
      const raw = cm[1] ?? cm[2] ?? cm[3];
      const line = text.slice(0, cm.index).split("\n").length;
      const full = ns ? `${ns}.${raw}` : raw;
      // Template literal with an interpolation, or a string concatenated with
      // an expression (`t("dsr.requestType." + data.requestType)`): the key is
      // computed and cannot be resolved statically.
      const after = text.slice(
        cm.index + cm[0].length,
        cm.index + cm[0].length + 8,
      );
      const isComputed =
        (cm[1] !== undefined && cm[1].includes("${")) || /^\s*\+/.test(after);
      if (isComputed) {
        dynamic.push(`${path.relative(repoRoot, file)}:${line}\t${full}`);
        continue;
      }
      if (!used.has(full)) used.set(full, []);
      used.get(full).push(`${path.relative(repoRoot, file)}:${line}`);
      void lines;
    }
  }
}

// ── 3. findings ────────────────────────────────────────────────────────────

const missing = [];
const objectNode = [];
for (const [key, sites] of used) {
  if (leaves.has(key)) continue;
  if (nodes.has(key)) {
    // next-intl throws INSUFFICIENT_PATH when a message path resolves to an
    // object rather than a string — a hard runtime error, not a fallback.
    objectNode.push({ key, sites });
  } else {
    missing.push({ key, sites });
  }
}

// Unused: a catalogue leaf no static call site reaches. Prefix-matched against
// dynamic call sites so `t(`status.${s}`)` does not mark the whole subtree dead.
const dynamicPrefixes = dynamic
  .map((d) => d.split("\t")[1].split("${")[0].replace(/\.$/, ""))
  .filter(Boolean);
const unused = [...leaves].filter((k) => {
  if (used.has(k)) return false;
  return !dynamicPrefixes.some((p) => k.startsWith(p));
});

// ── 3b. i18n COVERAGE of pages and components (S14-14) ────────────────────
//
// `CLAUDE.md:415`, Critical Implementation Rule 7: "All UI text through i18n —
// use useTranslations('namespace'), never hardcode strings". The audit counted
// 95 of 482 pages and 74 of 125 components with no i18n import at all, and 10
// of the 14 EU-AI-Act pages hard-coded in German although an `ai-act`
// namespace exists.
//
// Translating them is product-content work, not remediation work — but the
// number must not GROW while that is pending, and nothing was measuring it.
// `--max-untranslated` turns this into a ratchet.
function countWithoutI18n(dir, filter) {
  const files = walk(dir, filter);
  const without = files.filter(
    (f) => !/useTranslations|getTranslations/.test(fs.readFileSync(f, "utf8")),
  );
  return { total: files.length, without };
}

const pageCoverage = countWithoutI18n(path.join(srcRoot, "app"), (p) =>
  p.endsWith("page.tsx"),
);
const componentCoverage = countWithoutI18n(
  path.join(srcRoot, "components"),
  (p) => p.endsWith(".tsx") && !p.endsWith(".test.tsx"),
);
const untranslated =
  pageCoverage.without.length + componentCoverage.without.length;
const maxUntranslatedIdx = argv.indexOf("--max-untranslated");
const maxUntranslated =
  maxUntranslatedIdx >= 0
    ? Number(argv[maxUntranslatedIdx + 1])
    : Number.POSITIVE_INFINITY;

// Runtime bundle vs. namespace directories.
const bundleDrift = [];
for (const locale of ["de", "en"]) {
  const bundlePath = path.join(messagesRoot, `${locale}.json`);
  if (!fs.existsSync(bundlePath)) {
    bundleDrift.push(
      `${locale}.json missing — run apps/web/scripts/build-messages.ts`,
    );
    continue;
  }
  const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  const bLeaves = new Set();
  flatten(bundle, "", bLeaves, new Set());
  const dirLeaves = new Set();
  flatten(buildCatalogue(locale), "", dirLeaves, new Set());
  for (const k of dirLeaves)
    if (!bLeaves.has(k)) bundleDrift.push(`${locale}: bundle missing ${k}`);
}

const fatal =
  missing.length > 0 ||
  objectNode.length > 0 ||
  unregistered.length > 0 ||
  registeredButMissing.length > 0 ||
  bundleDrift.length > 0 ||
  unused.length > maxUnused ||
  untranslated > maxUntranslated;

if (asJson) {
  console.log(
    JSON.stringify(
      {
        missing,
        objectNode,
        unregistered,
        registeredButMissing,
        bundleDrift,
        pagesWithoutI18n: pageCoverage.without.length,
        pagesTotal: pageCoverage.total,
        componentsWithoutI18n: componentCoverage.without.length,
        componentsTotal: componentCoverage.total,
        untranslatedFiles: [
          ...pageCoverage.without,
          ...componentCoverage.without,
        ].map((f) => path.relative(repoRoot, f)),
        unusedCount: unused.length,
        unused,
        dynamicCount: dynamic.length,
        usedCount: used.size,
        leafCount: leaves.size,
      },
      null,
      2,
    ),
  );
} else {
  console.log("── i18n: code vs. catalogue ─────────────────────────────────");
  console.log(
    `Namespaces registered in src/i18n/request.ts : ${registered.size}`,
  );
  console.log(
    `Namespace files on disk (messages/de)        : ${onDisk.length}`,
  );
  console.log(`Catalogue messages (leaves)                  : ${leaves.size}`);
  console.log(`Distinct keys used in code (static)          : ${used.size}`);
  console.log(
    `Call sites with a computed key               : ${dynamic.length}`,
  );
  console.log("");

  const section = (title, items, render) => {
    console.log(
      `${items.length === 0 ? "OK  " : "FAIL"} ${title}: ${items.length}`,
    );
    for (const it of items.slice(0, 40)) console.log(`       ${render(it)}`);
    if (items.length > 40) console.log(`       … ${items.length - 40} more`);
  };

  section(
    "keys used in code but missing from the catalogue",
    missing,
    (m) => `${m.key}  (${m.sites.join(", ")})`,
  );
  section(
    "keys that resolve to an object node (next-intl INSUFFICIENT_PATH)",
    objectNode,
    (m) => `${m.key}  (${m.sites.join(", ")})`,
  );
  section(
    "namespace files not registered in src/i18n/request.ts",
    unregistered,
    (s) => s,
  );
  section(
    "namespaces registered in request.ts with no file on disk",
    registeredButMissing,
    (s) => s,
  );
  section(
    "runtime bundle out of sync with messages/<locale>/",
    bundleDrift,
    (s) => s,
  );

  console.log(
    `${untranslated > maxUntranslated ? "FAIL" : "INFO"} files with no i18n at all (S14-14): ` +
      `${pageCoverage.without.length}/${pageCoverage.total} pages, ` +
      `${componentCoverage.without.length}/${componentCoverage.total} components` +
      (Number.isFinite(maxUntranslated) ? ` — budget ${maxUntranslated}` : ""),
  );
  console.log(
    `${unused.length > maxUnused ? "FAIL" : "INFO"} catalogue messages never reached by a static call: ${unused.length}` +
      (Number.isFinite(maxUnused)
        ? ` (budget ${maxUnused})`
        : " (advisory — upper bound, see S14-21)"),
  );
  console.log("");
  console.log(fatal ? "RESULT: FAIL" : "RESULT: OK");
}

process.exit(fatal ? 1 : 0);
