#!/usr/bin/env node
// audit-dead-exports.mjs
//
// Findet `export`-Statements in apps/web/src und packages/*/src, die
// nirgendwo importiert werden. Heuristik, nicht perfekt:
//   - Ignoriert default-exports in Route-Files (Next.js convention)
//   - Ignoriert API-Route-HTTP-Handler (GET/POST/PUT/PATCH/DELETE)
//   - Ignoriert page.tsx/layout.tsx/template.tsx exports
//   - Ignoriert _stubs und generated-Files
//   - Falsch-Positive moeglich bei Barrel-Imports und dynamic imports
//
// Output: docs/perf/dead-exports-report.md
// Nicht auto-fixed -- nur Vorschlagsliste zum manuellen Review.

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC_DIRS = [
  join(ROOT, "apps/web/src"),
  join(ROOT, "apps/worker/src"),
  join(ROOT, "packages/shared/src"),
  join(ROOT, "packages/db/src"),
  join(ROOT, "packages/auth/src"),
  join(ROOT, "packages/events/src"),
  join(ROOT, "packages/automation/src"),
];
const OUT_DIR = join(ROOT, "docs/perf");
const OUT_MD = join(OUT_DIR, "dead-exports-report.md");

const NEXT_ROUTE_EXPORTS = new Set([
  "default",
  "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
  "generateStaticParams", "generateMetadata", "metadata",
  "dynamic", "revalidate", "fetchCache", "runtime", "preferredRegion",
  "viewport", "generateViewport",
]);

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === "__generated__") continue;
      await walk(full, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

function extractExports(content, file) {
  const exports = [];
  const isRouteOrPage = /\\(api|app)\\.*\\(route|page|layout|template|loading|not-found|error|default)\.tsx?$|route\.ts$|page\.tsx$|layout\.tsx$/.test(file);
  const isStub = /_generated_stubs|_stubs|\\generated\\/i.test(file);
  if (isStub) return [];

  const re = /^export\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    const name = m[1];
    if (isRouteOrPage && NEXT_ROUTE_EXPORTS.has(name)) continue;
    exports.push({ name, file });
  }

  // export { a, b, c } from "..."
  const reBarrel = /^export\s*\{\s*([^}]+)\s*\}/gm;
  while ((m = reBarrel.exec(content)) !== null) {
    for (const name of m[1].split(",").map((s) => s.trim().replace(/\s+as\s+\w+/, "").trim())) {
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        exports.push({ name, file });
      }
    }
  }

  return exports;
}

async function buildImportIndex(files) {
  // Count imports of each symbol across all files
  const importCounts = new Map();
  for (const f of files) {
    const c = await readFile(f, "utf8");
    // import { a, b, c as x } from "..."
    const re = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
    let m;
    while ((m = re.exec(c)) !== null) {
      for (const part of m[1].split(",")) {
        const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
          importCounts.set(name, (importCounts.get(name) ?? 0) + 1);
        }
      }
    }
    // import X from "..." (default or namespace)
    const reDefault = /import\s+(?:type\s+)?(\w+)\s+from\s+["']/g;
    while ((m = reDefault.exec(c)) !== null) {
      importCounts.set(m[1], (importCounts.get(m[1]) ?? 0) + 1);
    }
    // import * as X from "..."
    const reStar = /import\s+\*\s+as\s+(\w+)\s+from\s+["']/g;
    while ((m = reStar.exec(c)) !== null) {
      // namespace import -- we can't statically know which symbols are used
      // mark as wildcard for the file/module, but we don't have module context here
      // fallback: simple count bump that reduces false-positives is unsafe, skip
    }
  }
  return importCounts;
}

async function main() {
  const allFiles = [];
  for (const d of SRC_DIRS) {
    allFiles.push(...(await walk(d)));
  }
  console.log(`Files: ${allFiles.length}`);

  const importCounts = await buildImportIndex(allFiles);
  console.log(`Unique imported symbols: ${importCounts.size}`);

  const dead = [];
  for (const f of allFiles) {
    const c = await readFile(f, "utf8");
    const exports = extractExports(c, f);
    for (const e of exports) {
      if (!importCounts.has(e.name)) {
        dead.push(e);
      }
    }
  }

  // Group by file
  const byFile = new Map();
  for (const d of dead) {
    const rel = relative(ROOT, d.file).replace(/\\/g, "/");
    if (!byFile.has(rel)) byFile.set(rel, []);
    byFile.get(rel).push(d.name);
  }

  await mkdir(OUT_DIR, { recursive: true });

  const md = [];
  md.push(`# Dead-Exports-Report`);
  md.push(``);
  md.push(`_Generated: ${new Date().toISOString()}_`);
  md.push(``);
  md.push(`Static-Analyse findet \`export\`-Statements ohne matching \`import\` im Code. Heuristik, nicht vollstaendig:`);
  md.push(``);
  md.push(`**Nicht erkannt**:`);
  md.push(`- \`import * as X\` Namespace-Imports (Symbole dahinter)`);
  md.push(`- Dynamic \`import()\` mit String-Template`);
  md.push(`- API-Nutzung per fetch / HTTP (externe Consumer)`);
  md.push(`- \`export default\` in Route/Page-Files (ignoriert)`);
  md.push(`- Vitest-Tests in tests/ (nicht im Scan)`);
  md.push(``);
  md.push(`**${dead.length} potenziell tote Exports** in ${byFile.size} Dateien.`);
  md.push(``);
  md.push(`## Top-20 Hot-Spots (>=3 dead exports)`);
  md.push(``);
  md.push(`| Datei | Anzahl | Exports |`);
  md.push(`|---|---|---|`);
  for (const [f, names] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 40)) {
    if (names.length < 3) break;
    md.push(`| \`${f}\` | ${names.length} | ${names.slice(0, 10).map((n) => "`" + n + "`").join(", ")}${names.length > 10 ? " ..." : ""} |`);
  }
  md.push(``);

  md.push(`## Alle Treffer (alphabetisch)`);
  md.push(``);
  for (const [f, names] of [...byFile.entries()].sort()) {
    md.push(`- \`${f}\` -- ${names.map((n) => "`" + n + "`").join(", ")}`);
  }
  md.push(``);

  await writeFile(OUT_MD, md.join("\n"));
  console.log(`Dead exports: ${dead.length} in ${byFile.size} files`);
  console.log(`-> ${OUT_MD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
