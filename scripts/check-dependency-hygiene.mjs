#!/usr/bin/env node
// ============================================================================
// check-dependency-hygiene.mjs
//
// [ARCTOS-FULL-2026-08-31 / WP10 · S08-06 / S08-19]
//
// WARUM ES DIESE PRUEFUNG GIBT
//
// Bei der Abschlussverifikation dieses Arbeitspakets fiel auf, dass
// `react-grid-layout@1.5.3` — eine PRODUKTIONS-Abhaengigkeit von apps/web —
// im veroeffentlichten Tarball Folgendes mitlieferte:
//
//   · `ip_fetcher`     — ein ausfuehrbares Mach-O-arm64-Binary (33 KB)
//   · `ip_fetcher.c`   — dessen Quelle: ein curl-Beispiel, das die eigene
//                        oeffentliche IP von https://ifconfig.me abruft
//   · `yarn-error.log` — 374 KB Arbeitsverzeichnis-Protokoll des Maintainers
//
// Ursache ist ein fehlendes `files`-Feld in der package.json des Pakets:
// npm publish nahm das gesamte Arbeitsverzeichnis auf.
//
// DAMIT DIE BEWERTUNG EHRLICH BLEIBT: das Binary war in unserem Baum
// WIRKUNGSLOS — kein `bin`-Eintrag, kein Install-Hook, von keinem JS
// referenziert, und fuer die falsche Architektur (arm64 Mach-O auf einem
// x64-Linux-Build). Dasselbe gilt fuer das `dev`-Script des Pakets, das
// `npx @react-grab/claude-code@latest` aufrief: `dev` laeuft beim
// Installieren eines Tarballs nie. Es gab hier also KEINEN Vorfall, und
// diese Datei behauptet auch keinen.
//
// Der Punkt ist der Blindfleck: NICHTS im Repository haette bemerkt, dass
// eine Produktionsabhaengigkeit ein ausfuehrbares Binary und 374 KB
// Fremdprotokoll mitbringt. `npm audit` kennt nur CVEs, Dependabot nur
// Versionen, die Lizenzpruefung nur SPDX-Ausdruecke. Waere in derselben
// Luecke etwas Wirksames mitgekommen, waere es genauso durchgelaufen.
//
// Behoben ist der konkrete Fall durch den Sprung auf 1.5.4 (dort sind alle
// drei Dateien und das `npx`-Script entfernt). Diese Pruefung sorgt dafuer,
// dass der naechste Fall auffaellt.
//
// WAS GEPRUEFT WIRD (nur im PRODUKTIONSBAUM, `npm ls --omit=dev`):
//
//   1. Ausfuehrbare Binaerdateien (ELF, Mach-O, PE) in Paketen, die dafuer
//      keinen Grund haben — also weder ein `bin`-Feld noch eine bekannte
//      Native-Build-Kette deklarieren.
//   2. Install-Hooks (preinstall/install/postinstall) — sie laufen bei jedem
//      `npm install` ohne `--ignore-scripts` mit den Rechten des Aufrufenden.
//      In CI und Dockerfile installieren wir mit `--ignore-scripts`; diese
//      Liste sagt, worauf man sich dabei verlaesst. `prepare` zaehlt NICHT
//      mit: es laeuft nur beim Installieren aus einem Git-URL.
//   3. Install-Hooks, die Code aus dem Netz nachladen (`npx <paket>@latest`,
//      `curl … | sh`). Bewusst NUR in den Hooks: die uebrigen Scripts eines
//      Pakets (`build`, `dev`, `test`) laufen bei uns nie.
//   4. Versehentlich mitveroeffentlichte Arbeitsdateien
//      (yarn-error.log, npm-debug.log, .env, .npmrc mit Token).
//
// Bekannte, bewertete Faelle stehen in ACKNOWLEDGED und erscheinen im
// Bericht getrennt von den Funden — dieselbe Haltung wie in
// scripts/audit-secrets.mjs: eine Liste, die dauerhaft dieselben Treffer
// zeigt, wird nicht mehr gelesen.
//
// Exit 0 = sauber, 1 = neue Funde, 2 = Konfigurations-/Aufruffehler.
// ============================================================================

import { execFileSync } from "node:child_process";
import {
  readFileSync,
  readdirSync,
  statSync,
  openSync,
  readSync,
  closeSync,
} from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);

// ── Bewertete Ausnahmen ─────────────────────────────────────────────────
// Jeder Eintrag braucht eine Begruendung. Ein Paket hier einzutragen ist
// eine Entscheidung, keine Formalie.
const ACKNOWLEDGED = [
  {
    pkg: "esbuild",
    kinds: ["binary", "installHook"],
    reason:
      "Native Bundler-Binaries sind der Zweck des Pakets; der Install-Hook waehlt " +
      "die Plattform-Variante. Fester Bestandteil der Next-/Vitest-Kette.",
  },
  {
    pkg: "@esbuild/linux-x64",
    kinds: ["binary"],
    reason: "Plattform-Paket von esbuild — enthaelt genau das eine Binary.",
  },
  {
    pkg: "@next/swc-linux-x64-gnu",
    kinds: ["binary"],
    reason: "SWC-Compiler von Next.js, plattformspezifisches natives Modul.",
  },
  {
    pkg: "@next/swc-linux-x64-musl",
    kinds: ["binary"],
    reason: "SWC-Compiler von Next.js, plattformspezifisches natives Modul.",
  },
  {
    pkg: "sharp",
    kinds: ["binary", "installHook"],
    reason:
      "libvips-Bindings fuer Bildverarbeitung; native Abhaengigkeit per Konstruktion.",
  },
  {
    pkg: "lightningcss",
    kinds: ["binary", "installHook"],
    reason: "Nativer CSS-Parser der Tailwind-/Next-Kette.",
  },
  {
    pkg: "@tailwindcss/oxide",
    kinds: ["binary", "installHook"],
    reason: "Native Engine von Tailwind 4.",
  },
  {
    pkg: "@parcel/watcher",
    kinds: ["binary", "installHook"],
    reason:
      "Nativer Dateisystem-Watcher (Tailwind-/Next-Kette). Der install-Hook " +
      "`node scripts/build-from-source.js` baut nur, wenn kein passendes " +
      "Prebuild vorliegt. In CI und Dockerfile installieren wir mit " +
      "--ignore-scripts, der Hook laeuft dort also nicht.",
  },
  {
    pkg: "@swc/core",
    kinds: ["binary", "installHook"],
    reason:
      "Rust-Compiler-Bindings (Next.js/Vitest-Kette). Der postinstall-Hook " +
      "waehlt das Plattform-Binary aus; ebenfalls durch --ignore-scripts " +
      "in CI und Dockerfile ausgeschaltet.",
  },
];

const ackFor = (name) => ACKNOWLEDGED.find((a) => a.pkg === name);

// ── Produktionsbaum ermitteln ───────────────────────────────────────────
function productionPackages() {
  let out;
  try {
    out = execFileSync(
      "npm",
      ["ls", "--omit=dev", "--all", "--json", "--long"],
      {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 512 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
  } catch (e) {
    // `npm ls` endet mit Exit != 0, sobald irgendwo eine Peer-Warnung steht.
    // Die JSON-Ausgabe ist trotzdem vollstaendig und brauchbar.
    out = e.stdout?.toString() ?? "";
  }
  if (!out.trim()) {
    console.error(
      "check-dependency-hygiene: `npm ls --omit=dev` lieferte keine Ausgabe.",
    );
    console.error(
      "  Ist `npm ci` gelaufen? Ohne node_modules kann nicht geprueft werden.",
    );
    process.exit(2);
  }
  let tree;
  try {
    tree = JSON.parse(out);
  } catch {
    console.error(
      "check-dependency-hygiene: Ausgabe von `npm ls` ist kein gueltiges JSON.",
    );
    process.exit(2);
  }

  const found = new Map(); // path -> { name, version, path }
  const walk = (node) => {
    for (const [name, dep] of Object.entries(node.dependencies ?? {})) {
      if (dep.path && !found.has(dep.path)) {
        found.set(dep.path, { name, version: dep.version, path: dep.path });
        walk(dep);
      }
    }
  };
  walk(tree);
  return [...found.values()];
}

// ── Binaerdatei-Erkennung ueber Magic Bytes ─────────────────────────────
const MAGIC = [
  { name: "ELF", bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { name: "Mach-O 64", bytes: [0xcf, 0xfa, 0xed, 0xfe] },
  { name: "Mach-O 32", bytes: [0xce, 0xfa, 0xed, 0xfe] },
  { name: "Mach-O universal", bytes: [0xca, 0xfe, 0xba, 0xbe] },
  { name: "PE/EXE", bytes: [0x4d, 0x5a] },
];

function magicOf(file) {
  let fd;
  try {
    fd = openSync(file, "r");
    const buf = Buffer.alloc(4);
    const n = readSync(fd, buf, 0, 4, 0);
    if (n < 2) return null;
    for (const m of MAGIC) {
      if (m.bytes.every((b, i) => buf[i] === b)) return m.name;
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

// `.node` ist das reguläre Format nativer Node-Addons — es IST ein ELF/Mach-O
// und waere sonst Dauerrauschen. Solche Dateien zaehlen nur, wenn das Paket
// gar keine native Bauart deklariert; das prueft nativeByDesign().
const NATIVE_EXT = /\.(node|wasm)$/;
const SKIP_DIRS = new Set(["node_modules", ".git", ".bin"]);
const STRAY_FILES = new Set([
  "yarn-error.log",
  "npm-debug.log",
  "yarn-debug.log",
  ".env",
  ".env.local",
  ".npmrc",
  ".pypirc",
  "id_rsa",
]);

function scanPackageDir(dir, limit = 4000) {
  const binaries = [];
  const strays = [];
  let seen = 0;
  const walk = (d, depth) => {
    if (seen > limit || depth > 8) return;
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (seen > limit) return;
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(p, depth + 1);
        continue;
      }
      if (!e.isFile()) continue;
      seen++;
      if (STRAY_FILES.has(e.name)) {
        let size = 0;
        try {
          size = statSync(p).size;
        } catch {
          /* egal — die Existenz ist der Befund, nicht die Groesse */
        }
        strays.push({ file: p, size });
        continue;
      }
      if (NATIVE_EXT.test(e.name)) continue;
      const magic = magicOf(p);
      if (magic) binaries.push({ file: p, magic });
    }
  };
  walk(dir, 0);
  return { binaries, strays };
}

// Ein Paket darf Binaries mitbringen, wenn es sie als `bin` deklariert oder
// erkennbar nativ gebaut wird.
function nativeByDesign(manifest, dir) {
  if (manifest.bin && Object.keys(manifest.bin).length > 0) return true;
  if (manifest.gypfile === true) return true;
  try {
    statSync(join(dir, "binding.gyp"));
    return true;
  } catch {
    /* kein node-gyp-Paket */
  }
  return false;
}

// NUR diese drei laufen beim Installieren eines veroeffentlichten Tarballs.
// `prepare` steht bewusst NICHT dabei: es laeuft beim Installieren aus einem
// Git-URL und im Entwicklungsablauf des Pakets selbst, nicht bei uns. Es hier
// mitzuzaehlen erzeugte 30+ Dauertreffer (postgres, preact, xml-crypto …) und
// damit genau die Abstumpfung, gegen die S08-14 sich richtet.
const INSTALL_HOOKS = ["preinstall", "install", "postinstall"];
// Muster fuer "laedt fremden Code aus dem Netz nach". Wird NUR auf die
// Install-Hooks angewandt — die uebrigen Scripts eines Pakets (`build`,
// `dev`, `docs`, `test`) laufen auf unseren Rechnern nie und sind kein
// Befund, auch wenn sie `npx` enthalten.
const REMOTE_EXEC = [
  {
    name: "npx auf Fremdpaket",
    re: /\bnpx\s+(?:-y\s+|--yes\s+)?[@\w][\w@/.-]*/,
  },
  {
    name: "curl|wget in eine Shell",
    re: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba)?sh\b/,
  },
  {
    name: "node -e mit Netzwerkabruf",
    re: /\bnode\s+-e\b[^\n]*\b(?:https?|fetch|request)\b/,
  },
];

// ── Auswertung ──────────────────────────────────────────────────────────
const pkgs = productionPackages();
if (pkgs.length === 0) {
  console.error(
    "check-dependency-hygiene: Produktionsbaum ist leer — das kann nicht stimmen.",
  );
  process.exit(2);
}

const findings = [];
const acknowledged = [];

for (const p of pkgs) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(p.path, "package.json"), "utf8"));
  } catch {
    continue;
  }
  const ack = ackFor(p.name);
  const label = `${p.name}@${p.version ?? manifest.version ?? "?"}`;
  const rel = relative(ROOT, p.path) || ".";

  const record = (kind, detail) => {
    const entry = { pkg: label, kind, detail, path: rel };
    if (ack?.kinds.includes(kind))
      acknowledged.push({ ...entry, reason: ack.reason });
    else findings.push(entry);
  };

  // (2) Install-Hooks — und (3) Netz-Nachladen INNERHALB dieser Hooks.
  for (const h of INSTALL_HOOKS) {
    const s = manifest.scripts?.[h];
    if (typeof s !== "string" || s.length === 0) continue;
    record("installHook", `${h}: ${s}`);
    for (const m of REMOTE_EXEC) {
      if (m.re.test(s)) record("remoteExec", `${h}: ${s}  [${m.name}]`);
    }
  }

  // (1) + (4) Dateisystem
  const { binaries, strays } = scanPackageDir(p.path);
  if (binaries.length && !nativeByDesign(manifest, p.path)) {
    for (const b of binaries.slice(0, 5)) {
      record("binary", `${relative(p.path, b.file)} (${b.magic})`);
    }
  }
  for (const s of strays.slice(0, 5)) {
    record("stray", `${relative(p.path, s.file)} (${s.size} Bytes)`);
  }
}

// ── Bericht ─────────────────────────────────────────────────────────────
const KIND_TEXT = {
  binary: "Ausfuehrbares Binary ohne deklarierten Grund",
  installHook: "Install-Hook (laeuft bei npm install ohne --ignore-scripts)",
  remoteExec: "Script laedt Fremdcode aus dem Netz nach",
  stray: "Versehentlich mitveroeffentlichte Arbeitsdatei",
};

console.log(
  `Dependency-Hygiene: ${pkgs.length} Pakete im Produktionsbaum geprueft ` +
    `(Binaries, Install-Hooks, Netz-Nachladen, Arbeitsdateien).`,
);

if (acknowledged.length) {
  console.log(`\nBewertete Ausnahmen (${acknowledged.length}):`);
  const byPkg = new Map();
  for (const a of acknowledged) {
    if (!byPkg.has(a.pkg)) byPkg.set(a.pkg, a);
  }
  for (const a of byPkg.values()) console.log(`  · ${a.pkg} — ${a.reason}`);
}

if (findings.length === 0) {
  console.log(
    "\n✓ Keine unerklaerten Binaries, Install-Hooks, Netz-Nachladungen oder Arbeitsdateien.",
  );
  process.exit(0);
}

console.log(`\n✗ Unbewertete Funde (${findings.length}):`);
for (const f of findings) {
  console.log(`  ✗ [${f.kind}] ${f.pkg}`);
  console.log(`      ${KIND_TEXT[f.kind]}`);
  console.log(`      ${f.detail}`);
  console.log(`      ${f.path}`);
}
console.log(
  "\nJeder Fund ist eine Entscheidung: Paket wechseln/aktualisieren, oder mit\n" +
    "Begruendung in ACKNOWLEDGED in dieser Datei eintragen. Nicht kommentarlos\n" +
    "erweitern — die Begruendung ist der eigentliche Inhalt der Liste.",
);
process.exit(1);
