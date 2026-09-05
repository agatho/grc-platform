#!/usr/bin/env node
// ============================================================================
// #S08-10 (WP10) — Lizenz-Gate, das seinen Zweck erfüllt.
//
// Ersetzt:
//     npx license-checker --production \
//       --failOn "GPL-2.0;GPL-3.0;AGPL-1.0;AGPL-3.0" --excludePrivatePackages
//
// Vier belegte Defekte des alten Aufrufs:
//   1. `--failOn` verglich Zeichenketten. Moderne Pakete deklarieren
//      `GPL-3.0-only` / `GPL-3.0-or-later`; die alten Kurzformen trafen diese
//      nie. Hier wird der SPDX-Ausdruck geparst und je Bestandteil bewertet.
//   2. Lücken in der Sperrliste (SSPL, CC-BY-SA, EUPL, BUSL, OSL, CDDL,
//      Elastic, Commons Clause) — jetzt vollständig.
//   3. Custom-Lizenzen waren unsichtbar: `bpmn-js` deklariert
//      "SEE LICENSE IN LICENSE" und passierte das Gate, während der
//      Wasserzeichen-Verstoss aus #S08-02 aktiv war. „UNKNOWN“ und
//      „SEE LICENSE IN …“ sind jetzt eine eigene Fehlerklasse, die eine
//      namentliche Freigabe in ACKNOWLEDGED unten erzwingt — und für bpmn-js
//      wird die Wasserzeichen-Bedingung technisch nachgeprüft.
//   4. `npx license-checker` zog unversionierten Fremdcode zur Laufzeit aus
//      der Registry — in einem Sicherheitsprüfschritt. Dieses Gate läuft
//      offline aus dem installierten Baum.
//
// Aufruf: node scripts/license-gate.mjs [--json]
// Exit 0 = konform, 1 = Verstoss, 2 = Konfigurationsfehler.
// ============================================================================
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { collectDependencies } from "./lib/dep-tree.mjs";

const ROOT = process.cwd();
const JSON_OUT = process.argv.includes("--json");

// SPDX-Bestandteile, die im ausgelieferten Produkt nicht vorkommen dürfen.
// Vergleich case-insensitiv gegen die normalisierte Kennung; `GPL-3.0` matcht
// damit auch `GPL-3.0-only` und `GPL-3.0-or-later`.
const DENY_PREFIXES = [
  "AGPL-1.0",
  "AGPL-3.0",
  "GPL-1.0",
  "GPL-2.0",
  "GPL-3.0",
  "SSPL",
  "CC-BY-SA",
  "CC-BY-NC",
  "EUPL",
  "BUSL",
  "OSL",
  "CDDL",
  "Elastic-2.0",
  "CPAL",
  "RPL",
  "Parity",
  "Commons Clause",
  "Aladdin",
  "JSON", // "JSON License" — die "shall be used for Good, not Evil"-Klausel
];

// LGPL ist zulässig, aber nur mit den Zusatzpflichten aus NOTICE /
// THIRD-PARTY-LICENSES.md (Lizenztext, Copyright, Relinking-Möglichkeit).
const REQUIRE_ATTRIBUTION_PREFIXES = ["LGPL-", "MPL-", "CC-BY-4.0", "EPL-"];

// Pakete mit UNKNOWN- oder Custom-Lizenz, die namentlich bewertet und
// freigegeben sind. Ein neues Paket dieser Klasse failt das Gate, bis es hier
// mit Begründung steht — das ist die Kontrolle, die S08-02 gefunden hätte.
const ACKNOWLEDGED = {
  "bpmn-js": {
    license: "SEE LICENSE IN LICENSE",
    reason:
      "Custom-Lizenz von Camunda Services GmbH, MIT-artig mit harter " +
      "Zusatzbedingung: das bpmn.io-Wasserzeichen darf weder entfernt noch " +
      "überdeckt werden. Bedingung erfüllt — siehe Wasserzeichen-Prüfung " +
      "unten (#S08-02).",
    requiresWatermark: true,
  },
  "bpmn-js-properties-panel": {
    license: "*",
    reason: "Gleiche bpmn.io-Lizenzfamilie wie bpmn-js; keine Zusatzbedingung.",
  },
  buffers: {
    license: "UNKNOWN",
    reason:
      "Letzter Release 2012, keine Lizenzdatei im Tarball. Transitiv über " +
      "@grc/reporting -> exceljs -> unzipper -> binary. Rechtlich ungeklärt; " +
      "als Risiko akzeptiert und in S08-23 zur Ablösung von exceljs vorgemerkt.",
  },
  "png-js": {
    license: "UNKNOWN",
    reason:
      "Keine Lizenzdatei im Tarball; das Repository nennt MIT. Transitiv über " +
      "die PDF-Erzeugung. Als geringes Risiko akzeptiert.",
  },
  chainsaw: {
    license: "MIT/X11",
    reason: "MIT-äquivalent, veraltete Schreibweise.",
  },
  traverse: {
    license: "MIT/X11",
    reason: "MIT-äquivalent, veraltete Schreibweise.",
  },
  jszip: {
    license: "(MIT OR GPL-3.0-or-later)",
    reason:
      "Dual-lizenziert. ARCTOS wählt MIT; die Wahl ist in NOTICE und " +
      "THIRD-PARTY-LICENSES.md ausdrücklich dokumentiert (#S08-16).",
  },
  pako: { license: "(MIT AND Zlib)", reason: "Beide Bestandteile permissiv." },
};

/** Zerlegt einen SPDX-Ausdruck in seine Lizenz-Bestandteile. */
function spdxParts(expr) {
  if (!expr) return [];
  return expr
    .replace(/[()]/g, " ")
    .split(/\s+(?:OR|AND|WITH)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isDenied(part) {
  const p = part.toUpperCase();
  return DENY_PREFIXES.some((d) => p.startsWith(d.toUpperCase()));
}

/**
 * #S08-02-Regressionsschutz: kein Stylesheet und kein Skript darf das
 * bpmn.io-Wasserzeichen ausblenden oder überdecken.
 */
function checkBpmnWatermark() {
  const roots = [join(ROOT, "apps"), join(ROOT, "packages")];
  const hits = [];
  const SUSPICIOUS = [
    /\.bjs-powered-by[^{}]*\{[^{}]*display\s*:\s*none/is,
    /\.bjs-powered-by[^{}]*\{[^{}]*visibility\s*:\s*hidden/is,
    /\.bjs-powered-by[^{}]*\{[^{}]*opacity\s*:\s*0(?!\.)/is,
    /\.bjs-powered-by[^{}]*\{[^{}]*content\s*:\s*none/is,
    /querySelector\w*\(\s*["'`][^"'`]*bjs-powered-by[^"'`]*["'`]\s*\)[\s\S]{0,120}?(remove\(\)|display\s*=\s*["'`]none)/i,
  ];
  const exts = /\.(css|scss|sass|less|ts|tsx|js|jsx|mjs)$/i;
  const skip = new Set([
    "node_modules",
    ".next",
    "dist",
    ".turbo",
    "coverage",
    ".git",
  ]);
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (skip.has(name)) continue;
      const p = join(dir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(p);
        continue;
      }
      if (!exts.test(name)) continue;
      let text;
      try {
        text = readFileSync(p, "utf8");
      } catch {
        continue;
      }
      if (!text.includes("bjs-powered-by")) continue;
      // Kommentare entfernen — sonst schlägt der Kommentar an, der den
      // behobenen Verstoss dokumentiert. Geprüft wird der wirksame Code.
      const code = text
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      if (!code.includes("bjs-powered-by")) continue;
      for (const re of SUSPICIOUS) {
        if (re.test(code)) {
          hits.push(p.replace(ROOT + "/", ""));
          break;
        }
      }
    }
  };
  for (const r of roots) walk(r);
  return hits;
}

// ---------------------------------------------------------------------------
const { all, prodKeys } = collectDependencies({ cwd: ROOT });
const prod = [...all.entries()]
  .filter(([k, v]) => prodKeys.has(k) && !v.isWorkspace && !v.private)
  .map(([, v]) => v);

const violations = [];
const unreviewed = [];
const attributionNeeded = [];

for (const e of prod) {
  const license = e.license ?? "UNKNOWN";
  const ack = ACKNOWLEDGED[e.name];
  const parts = spdxParts(license);

  for (const part of parts) {
    if (!isDenied(part)) continue;
    // Bei Dual-Lizenzen mit "OR" genügt ein zulässiger Zweig — sofern die Wahl
    // dokumentiert ist (ACKNOWLEDGED). Sonst ist sie ein Verstoss.
    const dual = / OR /i.test(license);
    if (dual && ack) continue;
    violations.push(
      `${e.name}@${e.version}: Lizenzbestandteil "${part}" ist gesperrt (voller Ausdruck: ${license}).`,
    );
  }

  if (
    license === "UNKNOWN" ||
    /^SEE LICENSE IN /i.test(license) ||
    license === "UNLICENSED"
  ) {
    if (!ack) {
      unreviewed.push(
        `${e.name}@${e.version}: Lizenz "${license}" ist nicht maschinell bewertbar und ` +
          `steht nicht in ACKNOWLEDGED (scripts/license-gate.mjs). Lizenzdatei lesen, ` +
          `bewerten und mit Begründung eintragen — oder Abhängigkeit ersetzen.`,
      );
    }
  } else if (!parts.length) {
    unreviewed.push(`${e.name}@${e.version}: leerer Lizenzausdruck.`);
  }

  for (const part of parts) {
    if (
      REQUIRE_ATTRIBUTION_PREFIXES.some((p) =>
        part.toUpperCase().startsWith(p.toUpperCase()),
      )
    ) {
      attributionNeeded.push(`${e.name}@${e.version} (${part})`);
    }
  }
}

// Attributionspflichtige Lizenzen müssen in THIRD-PARTY-LICENSES.md stehen.
const tplPath = join(resolve(ROOT), "THIRD-PARTY-LICENSES.md");
const noticePath = join(resolve(ROOT), "NOTICE");
if (!existsSync(tplPath) || !existsSync(noticePath)) {
  violations.push(
    "NOTICE und/oder THIRD-PARTY-LICENSES.md fehlen — `npm run notice` ausführen (#S08-16).",
  );
} else {
  const tpl = readFileSync(tplPath, "utf8");
  for (const item of attributionNeeded) {
    const name =
      item.split("@").slice(0, -1).join("@").replace(/ \(.*/, "") || item;
    const pkgName = item.replace(/@[^@]*\s\(.*$/, "");
    if (!tpl.includes(pkgName) && !tpl.includes(name)) {
      violations.push(
        `${item}: attributionspflichtige Lizenz, aber nicht in THIRD-PARTY-LICENSES.md (#S08-16).`,
      );
    }
  }
}

const watermarkHits = checkBpmnWatermark();
const wantsWatermark = prod.some(
  (e) => ACKNOWLEDGED[e.name]?.requiresWatermark,
);
if (wantsWatermark && watermarkHits.length) {
  violations.push(
    `#S08-02 LIZENZVERSTOSS: das bpmn.io-Wasserzeichen wird ausgeblendet oder ` +
      `überdeckt in: ${watermarkHits.join(", ")}. Die bpmn-js-Lizenz verbietet das ` +
      `wörtlich ("the watermark must stay fully visible"). Regel entfernen oder eine ` +
      `kommerzielle bpmn.io-Lizenz nachweisen.`,
  );
}

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        packages: prod.length,
        violations,
        unreviewed,
        attributionNeeded,
        watermarkHits,
      },
      null,
      2,
    ),
  );
}

const summary = new Map();
for (const e of prod)
  summary.set(
    e.license ?? "UNKNOWN",
    (summary.get(e.license ?? "UNKNOWN") ?? 0) + 1,
  );

if (!JSON_OUT) {
  console.log(`Lizenz-Gate: ${prod.length} Pakete im Produktionsbaum.`);
  for (const [l, n] of [...summary.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${l}`);
  }
}

let exit = 0;
if (unreviewed.length) {
  console.error(`\nNicht bewertete Lizenzen (${unreviewed.length}):`);
  for (const u of unreviewed) console.error(`  ✗ ${u}`);
  exit = 1;
}
if (violations.length) {
  console.error(`\nLizenzverstösse (${violations.length}):`);
  for (const v of violations) console.error(`  ✗ ${v}`);
  exit = 1;
}
if (exit === 0) {
  console.log(
    "\n✓ Keine gesperrten Lizenzen, keine unbewerteten Lizenzen, " +
      "Attributionspflichten in THIRD-PARTY-LICENSES.md abgedeckt, " +
      "bpmn.io-Wasserzeichen sichtbar.",
  );
}
process.exit(exit);
