// ============================================================================
// Gemeinsame Basis für SBOM (#S08-12), NOTICE (#S08-16) und Lizenz-Gate
// (#S08-10). Liest den installierten Baum aus `npm ls` und reichert jeden
// Knoten mit den Lizenzangaben aus seiner package.json und den tatsächlich
// vorhandenen Lizenzdateien an.
//
// Bewusst ohne Netzwerkzugriff und ohne `npx <ungepinntes-paket>`: ein
// Sicherheits-/Compliance-Prüfschritt darf keinen unversionierten Fremdcode
// zur Laufzeit nachladen (das war einer der vier Defekte aus S08-10).
// ============================================================================
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const LICENSE_FILE_RE =
  /^(LICEN[CS]E|COPYING|NOTICE|UNLICENSE)(\.[A-Za-z0-9._-]+)?$/i;

function npmLs(cwd, omitDev) {
  const args = ["ls", "--all", "--json", "--long"];
  if (omitDev) args.push("--omit=dev");
  let out;
  try {
    out = execFileSync("npm", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (e) {
    // `npm ls` exitet != 0 bei extraneous/invalid — stdout bleibt gültiges JSON.
    out = e.stdout;
    if (!out) throw e;
  }
  return JSON.parse(out);
}

function walk(node, sink, isRoot = false) {
  for (const [name, dep] of Object.entries(node.dependencies ?? {})) {
    if (dep.version == null) continue; // nicht installiert / link-only
    const key = `${name}@${dep.version}`;
    if (!sink.has(key)) {
      sink.set(key, {
        name,
        version: dep.version,
        path: dep.path ?? null,
        resolved: dep.resolved ?? null,
        integrity: dep._integrity ?? dep.integrity ?? null,
        license: dep.license ?? null,
        description: dep.description ?? null,
        homepage: dep.homepage ?? null,
        author:
          typeof dep.author === "string"
            ? dep.author
            : (dep.author?.name ?? null),
        isWorkspace:
          Boolean(dep.resolved?.startsWith?.("file:")) ||
          dep.linkedFrom != null,
      });
    }
    walk(dep, sink);
  }
  void isRoot;
}

/** Liest Lizenzangaben und -dateien direkt aus dem installierten Paket. */
function enrichFromDisk(entry) {
  if (!entry.path || !existsSync(entry.path)) return entry;
  try {
    const pkg = JSON.parse(
      readFileSync(join(entry.path, "package.json"), "utf8"),
    );
    if (!entry.license) {
      if (typeof pkg.license === "string") entry.license = pkg.license;
      else if (pkg.license?.type) entry.license = pkg.license.type;
      else if (Array.isArray(pkg.licenses))
        entry.license = pkg.licenses.map((l) => l.type ?? l).join(" OR ");
    }
    entry.description ??= pkg.description ?? null;
    entry.homepage ??= pkg.homepage ?? null;
    entry.repository ??=
      typeof pkg.repository === "string"
        ? pkg.repository
        : (pkg.repository?.url ?? null);
    if (!entry.author) {
      entry.author =
        typeof pkg.author === "string"
          ? pkg.author
          : (pkg.author?.name ?? null);
    }
    entry.private = Boolean(pkg.private);
  } catch {
    /* defekte package.json — Knoten bleibt wie er ist */
  }
  const files = [];
  try {
    for (const f of readdirSync(entry.path)) {
      if (!LICENSE_FILE_RE.test(f)) continue;
      const p = join(entry.path, f);
      try {
        if (!statSync(p).isFile()) continue;
        files.push({ file: f, text: readFileSync(p, "utf8") });
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  entry.licenseFiles = files;
  return entry;
}

/**
 * @param {object} [opts]
 * @param {string} [opts.cwd] Repo-Wurzel.
 * @returns {{ all: Map<string, object>, prodKeys: Set<string> }}
 */
export function collectDependencies({ cwd = process.cwd() } = {}) {
  const root = resolve(cwd);
  const all = new Map();
  walk(npmLs(root, false), all, true);
  const prod = new Map();
  walk(npmLs(root, true), prod, true);
  for (const entry of all.values()) enrichFromDisk(entry);
  return { all, prodKeys: new Set(prod.keys()) };
}

export function rootManifest(cwd = process.cwd()) {
  return JSON.parse(readFileSync(join(resolve(cwd), "package.json"), "utf8"));
}
