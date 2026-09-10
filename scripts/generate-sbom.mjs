#!/usr/bin/env node
// ============================================================================
// #S08-12 (WP10) — CycloneDX-1.5-SBOM für ARCTOS.
//
// Vorher: keine SBOM, weder erzeugt noch veröffentlicht noch archiviert. Damit
// war nach einem neuen Advisory nicht feststellbar, welche bereits
// ausgelieferten Images betroffen sind — `npm audit` beschreibt immer nur den
// heutigen Baum.
//
// Erzeugt zwei Dateien unter SBOM/:
//   SBOM/arctos-sbom.cdx.json       — voller Baum (prod + dev)
//   SBOM/arctos-sbom-prod.cdx.json  — nur der ausgelieferte Produktionsbaum
//
// Aufruf:
//   node scripts/generate-sbom.mjs [--out-dir SBOM] [--check]
//
// `--check` erzeugt die SBOM in ein temporäres Verzeichnis und vergleicht sie
// mit der eingecheckten Fassung (ohne den Zeitstempel). Damit ist die SBOM in
// CI verifizierbar und kann nicht veralten.
//
// Bewusst ohne Netzwerk und ohne ungepinntes `npx`: die SBOM entsteht aus dem
// installierten Baum (`npm ls`) plus package-lock.json.
// ============================================================================
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { collectDependencies, rootManifest } from "./lib/dep-tree.mjs";

const args = process.argv.slice(2);
const outDirArg = args.indexOf("--out-dir");
const OUT_DIR = resolve(outDirArg >= 0 ? args[outDirArg + 1] : "SBOM");
const CHECK = args.includes("--check");
const ROOT = process.cwd();

function purl(name, version) {
  // pkg:npm/@scope/name@version — Scope-Slash bleibt unencodiert (PURL-Spec).
  const [scope, bare] = name.startsWith("@") ? name.split("/") : [null, name];
  const encoded = scope
    ? `${encodeURIComponent(scope)}/${encodeURIComponent(bare)}`
    : encodeURIComponent(bare);
  return `pkg:npm/${encoded}@${encodeURIComponent(version)}`;
}

function licenseNode(expr) {
  if (!expr) return undefined;
  // CycloneDX: einfache SPDX-ID -> license.id, Ausdruck -> expression.
  if (/[()]| OR | AND | WITH /i.test(expr)) return [{ expression: expr }];
  if (
    /^SEE LICENSE IN /i.test(expr) ||
    expr === "UNLICENSED" ||
    expr === "UNKNOWN"
  ) {
    return [{ license: { name: expr } }];
  }
  return [{ license: { id: expr } }];
}

function hashesFor(entry) {
  const integrity = entry.integrity ?? entry.lockIntegrity;
  if (!integrity) return undefined;
  const out = [];
  for (const part of String(integrity).split(/\s+/)) {
    const [alg, b64] = part.split("-");
    const map = { sha512: "SHA-512", sha256: "SHA-256", sha1: "SHA-1" };
    if (!map[alg] || !b64) continue;
    out.push({
      alg: map[alg],
      content: Buffer.from(b64, "base64").toString("hex"),
    });
  }
  return out.length ? out : undefined;
}

function buildBom({ entries, scope, root, lock }) {
  const components = [];
  for (const entry of entries) {
    if (entry.isWorkspace || entry.private) continue; // eigene Workspace-Pakete
    const lockKey = Object.keys(lock.packages ?? {}).find(
      (k) =>
        k.endsWith(`node_modules/${entry.name}`) &&
        lock.packages[k].version === entry.version,
    );
    if (lockKey) entry.lockIntegrity = lock.packages[lockKey].integrity ?? null;
    components.push({
      type: "library",
      "bom-ref": purl(entry.name, entry.version),
      name: entry.name,
      version: entry.version,
      description: entry.description ?? undefined,
      purl: purl(entry.name, entry.version),
      licenses: licenseNode(entry.license),
      hashes: hashesFor(entry),
      externalReferences: [
        entry.homepage ? { type: "website", url: entry.homepage } : null,
        entry.resolved && /^https?:/.test(entry.resolved)
          ? { type: "distribution", url: entry.resolved }
          : null,
      ].filter(Boolean),
      properties: [{ name: "arctos:scope", value: scope }],
    });
  }
  components.sort((a, b) => (a.purl < b.purl ? -1 : a.purl > b.purl ? 1 : 0));
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: "ARCTOS",
          name: "scripts/generate-sbom.mjs",
          version: "1.0.0",
        },
      ],
      component: {
        type: "application",
        "bom-ref": purl(root.name ?? "grc-platform", root.version ?? "0.0.0"),
        name: root.name ?? "grc-platform",
        version: root.version ?? "0.0.0",
        licenses: licenseNode("PolyForm-Shield-1.0.0"),
      },
      properties: [
        { name: "arctos:tree", value: scope },
        {
          name: "arctos:gitSha",
          value: process.env.GIT_SHA ?? process.env.GITHUB_SHA ?? "unknown",
        },
      ],
    },
    components,
  };
}

function stableWithoutTimestamp(bom) {
  const clone = JSON.parse(JSON.stringify(bom));
  delete clone.metadata.timestamp;
  clone.metadata.properties = (clone.metadata.properties ?? []).filter(
    (p) => p.name !== "arctos:gitSha",
  );
  return JSON.stringify(clone, null, 2);
}

const { all, prodKeys } = collectDependencies({ cwd: ROOT });
const root = rootManifest(ROOT);
const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8"));

const full = buildBom({ entries: [...all.values()], scope: "all", root, lock });
const prod = buildBom({
  entries: [...all.entries()]
    .filter(([k]) => prodKeys.has(k))
    .map(([, v]) => v),
  scope: "production",
  root,
  lock,
});

const targets = [
  { file: join(OUT_DIR, "arctos-sbom.cdx.json"), bom: full },
  { file: join(OUT_DIR, "arctos-sbom-prod.cdx.json"), bom: prod },
];

if (CHECK) {
  let failed = false;
  for (const { file, bom } of targets) {
    if (!existsSync(file)) {
      console.error(
        `✗ SBOM fehlt: ${file} — \`npm run sbom\` ausführen und einchecken.`,
      );
      failed = true;
      continue;
    }
    const onDisk = stableWithoutTimestamp(
      JSON.parse(readFileSync(file, "utf8")),
    );
    const fresh = stableWithoutTimestamp(bom);
    if (onDisk !== fresh) {
      const h = (s) =>
        createHash("sha256").update(s).digest("hex").slice(0, 12);
      console.error(
        `✗ SBOM veraltet: ${file} (eingecheckt ${h(onDisk)}, erwartet ${h(fresh)}) — ` +
          `\`npm run sbom\` ausführen und einchecken.`,
      );
      failed = true;
    } else {
      console.log(
        `✓ ${file} ist aktuell (${bom.components.length} Komponenten).`,
      );
    }
  }
  process.exit(failed ? 1 : 0);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const { file, bom } of targets) {
  writeFileSync(file, JSON.stringify(bom, null, 2) + "\n");
  console.log(
    `SBOM geschrieben: ${file} (${bom.components.length} Komponenten)`,
  );
}
