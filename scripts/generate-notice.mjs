#!/usr/bin/env node
// ============================================================================
// #S08-16 (WP10) — NOTICE / THIRD-PARTY-LICENSES.
//
// Vorher: keine NOTICE-, THIRD-PARTY-LICENSES- oder ATTRIBUTIONS-Datei im Repo
// und keine in den Docker-Images. MIT, Apache-2.0, ISC, BSD-2-Clause und
// BSD-3-Clause — zusammen die grosse Mehrheit des Baums — verlangen sämtlich
// die Beibehaltung des Copyright-Vermerks bei Weitergabe. ARCTOS wird als
// Docker-Image über ghcr.io und per deploy/-Skripten On-Prem verteilt; das ist
// Weitergabe im Lizenzsinn.
//
// Erzeugt:
//   NOTICE                      — kurze Übersicht (Repo-Wurzel)
//   THIRD-PARTY-LICENSES.md     — vollständige Lizenztexte des PROD-Baums
//
// Aufruf: node scripts/generate-notice.mjs [--check]
// `--check` vergleicht mit der eingecheckten Fassung (CI-Gate).
// ============================================================================
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { collectDependencies, rootManifest } from "./lib/dep-tree.mjs";

const ROOT = process.cwd();
const CHECK = process.argv.includes("--check");

// Bewusst dokumentierte Lizenzwahlen bei Dual-/Mehrfachlizenzen (#S08-16).
const LICENSE_CHOICES = {
  jszip:
    "Dual-lizenziert (MIT OR GPL-3.0-or-later). ARCTOS nutzt jszip unter der " +
    "**MIT**-Variante. Diese Wahl ist hiermit ausdrücklich dokumentiert.",
};

// Zusatzpflichten, die über die reine Namensnennung hinausgehen (#S08-16).
const EXTRA_OBLIGATIONS = {
  "LGPL-3.0-or-later":
    "LGPL-3.0-or-later: Die Bibliothek wird als native Shared Library dynamisch " +
    "gebunden und unverändert weitergegeben. Nach LGPL-3 §4 liegen der Lizenztext " +
    "und der Copyright-Vermerk unten bei; der Quellcode ist beim jeweiligen " +
    "Upstream-Projekt verfügbar, und das Relinking gegen eine eigene Fassung ist " +
    "durch den Austausch der Shared Library im Image möglich.",
  "MPL-2.0":
    "MPL-2.0: dateibasiertes Copyleft. Die Dateien werden unverändert " +
    "weitergegeben; Quelle und Lizenztext sind unten genannt.",
  "CC-BY-4.0":
    "CC-BY-4.0: Namensnennung des Urhebers erforderlich — sie erfolgt unten.",
};

function normalizeLicense(entry) {
  if (entry.license && entry.license !== "UNKNOWN") return entry.license;
  return "UNKNOWN";
}

function copyrightLines(entry) {
  const out = new Set();
  for (const f of entry.licenseFiles ?? []) {
    for (const line of f.text.split(/\r?\n/)) {
      if (/copyright\s+(\(c\)|©|\d{4})/i.test(line)) {
        const t = line
          .trim()
          .replace(/^[*#/\s]+/, "")
          .slice(0, 200);
        if (t) out.add(t);
      }
      if (out.size >= 4) break;
    }
  }
  if (!out.size && entry.author) out.add(`Copyright (c) ${entry.author}`);
  return [...out];
}

const { all, prodKeys } = collectDependencies({ cwd: ROOT });
const root = rootManifest(ROOT);

const prodEntries = [...all.entries()]
  .filter(([k, v]) => prodKeys.has(k) && !v.isWorkspace && !v.private)
  .map(([, v]) => v)
  .sort((a, b) =>
    a.name === b.name
      ? a.version.localeCompare(b.version)
      : a.name.localeCompare(b.name),
  );

const byLicense = new Map();
for (const e of prodEntries) {
  const l = normalizeLicense(e);
  if (!byLicense.has(l)) byLicense.set(l, []);
  byLicense.get(l).push(e);
}
const licenseSummary = [...byLicense.entries()].sort(
  (a, b) => b[1].length - a[1].length,
);

const unknown = byLicense.get("UNKNOWN") ?? [];
const custom = prodEntries.filter((e) =>
  /^SEE LICENSE IN /i.test(e.license ?? ""),
);

// ---------------------------------------------------------------- NOTICE ---
const notice = [
  "ARCTOS GRC Platform",
  `Copyright (c) ${root.author ?? "ARCTOS"} — lizenziert unter PolyForm Shield 1.0.0 (siehe LICENSE).`,
  "",
  "Dieses Produkt enthält Software von Dritten. Die vollständigen Lizenztexte",
  "und Copyright-Vermerke aller im ausgelieferten Produktionsbaum enthaltenen",
  "Pakete stehen in THIRD-PARTY-LICENSES.md — im Repository und in beiden",
  "Docker-Images unter /app/THIRD-PARTY-LICENSES.md.",
  "",
  "GENERIERT — nicht von Hand bearbeiten.",
  "Erzeugt von scripts/generate-notice.mjs aus dem installierten npm-Baum.",
  "Neu erzeugen: npm run notice",
  "",
  `Pakete im Produktionsbaum: ${prodEntries.length}`,
  "",
  "Lizenzverteilung (Produktionsbaum):",
  ...licenseSummary.map(
    ([l, pkgs]) => `  ${String(pkgs.length).padStart(4)}  ${l}`,
  ),
  "",
  "Besondere Hinweise:",
  "",
  "  bpmn-js (Camunda Services GmbH, Custom-Lizenz, siehe THIRD-PARTY-LICENSES.md)",
  "  Die Lizenz erteilt die Rechte ausdrücklich unter der Bedingung, dass das",
  "  bpmn.io-Wasserzeichen in gerenderten Diagrammen vollständig sichtbar bleibt",
  "  und nicht von anderen Elementen überdeckt wird. ARCTOS erfüllt diese",
  "  Bedingung; das Wasserzeichen wird angezeigt (#S08-02).",
  "",
  ...Object.entries(LICENSE_CHOICES).flatMap(([pkg, text]) => [
    `  ${pkg}`,
    `  ${text}`,
    "",
  ]),
  ...Object.entries(EXTRA_OBLIGATIONS)
    .filter(([lic]) => byLicense.has(lic))
    .flatMap(([lic, text]) => [
      `  ${lic} — betroffen: ${byLicense
        .get(lic)
        .map((e) => e.name)
        .join(", ")}`,
      `  ${text}`,
      "",
    ]),
].join("\n");

// ------------------------------------------- THIRD-PARTY-LICENSES.md ---
const md = [];
md.push("# Third-Party Licenses — ARCTOS GRC Platform");
md.push("");
md.push("> **GENERIERT — nicht von Hand bearbeiten.**");
md.push(
  "> Erzeugt von `scripts/generate-notice.mjs` aus dem installierten npm-Baum.",
);
md.push(
  "> Neu erzeugen: `npm run notice`. CI prüft die Aktualität (`npm run notice:check`).",
);
md.push("");
md.push(
  "Diese Datei listet jedes Paket, das im **ausgelieferten Produktionsbaum** " +
    "(`npm ls --omit=dev`) enthalten ist, mit Version, Lizenzkennung, " +
    "Copyright-Vermerk und — soweit im Paket vorhanden — dem vollständigen " +
    "Lizenztext. Sie erfüllt die Namensnennungspflichten von MIT, Apache-2.0, " +
    "ISC, BSD-2-Clause und BSD-3-Clause sowie die Zusatzpflichten aus " +
    "LGPL-3.0-or-later, MPL-2.0 und CC-BY-4.0.",
);
md.push("");
md.push(`**Pakete:** ${prodEntries.length}`);
md.push("");
md.push("## Lizenzübersicht");
md.push("");
md.push("| Lizenz | Pakete |");
md.push("|---|---:|");
for (const [l, pkgs] of licenseSummary)
  md.push(`| \`${l}\` | ${pkgs.length} |`);
md.push("");

md.push("## Dokumentierte Lizenzwahlen und Zusatzpflichten");
md.push("");
for (const [pkg, text] of Object.entries(LICENSE_CHOICES)) {
  if (!prodEntries.some((e) => e.name === pkg)) continue;
  md.push(`- **${pkg}** — ${text}`);
}
for (const [lic, text] of Object.entries(EXTRA_OBLIGATIONS)) {
  if (!byLicense.has(lic)) continue;
  md.push(
    `- **${lic}** (${byLicense
      .get(lic)
      .map((e) => e.name)
      .join(", ")}) — ${text}`,
  );
}
md.push(
  "- **bpmn-js** — Custom-Lizenz mit Wasserzeichen-Bedingung. Das bpmn.io-Badge " +
    "bleibt in jedem gerenderten Diagramm vollständig sichtbar (#S08-02).",
);
if (unknown.length) {
  md.push(
    `- **Ohne ermittelbare Lizenz (${unknown.length})**: ` +
      unknown.map((e) => `\`${e.name}@${e.version}\``).join(", ") +
      ". Diese Pakete sind in `scripts/license-gate.mjs` einzeln zu bewerten.",
  );
}
if (custom.length) {
  md.push(
    `- **Custom-Lizenz („SEE LICENSE IN …“) (${custom.length})**: ` +
      custom.map((e) => `\`${e.name}@${e.version}\``).join(", ") +
      ".",
  );
}
md.push("");
md.push("## Pakete");
md.push("");

for (const e of prodEntries) {
  md.push(`### ${e.name}@${e.version}`);
  md.push("");
  md.push(`- Lizenz: \`${normalizeLicense(e)}\``);
  if (e.homepage) md.push(`- Homepage: ${e.homepage}`);
  const cr = copyrightLines(e);
  if (cr.length) for (const c of cr) md.push(`- ${c}`);
  md.push("");
  const file = (e.licenseFiles ?? [])[0];
  if (file) {
    md.push(`<details><summary>Lizenztext (${file.file})</summary>`);
    md.push("");
    md.push("```text");
    md.push(file.text.replace(/```/g, "``​`").trimEnd());
    md.push("```");
    md.push("");
    md.push("</details>");
  } else {
    md.push(
      "_Keine Lizenzdatei im veröffentlichten Tarball enthalten; es gilt die " +
        "Kennung aus der `package.json` des Pakets._",
    );
  }
  md.push("");
}

const outputs = [
  { file: join(resolve(ROOT), "NOTICE"), content: notice.trimEnd() + "\n" },
  {
    file: join(resolve(ROOT), "THIRD-PARTY-LICENSES.md"),
    content: md.join("\n").trimEnd() + "\n",
  },
];

if (CHECK) {
  let failed = false;
  for (const { file, content } of outputs) {
    if (!existsSync(file)) {
      console.error(
        `✗ fehlt: ${file} — \`npm run notice\` ausführen und einchecken.`,
      );
      failed = true;
    } else if (readFileSync(file, "utf8") !== content) {
      console.error(
        `✗ veraltet: ${file} — \`npm run notice\` ausführen und einchecken.`,
      );
      failed = true;
    } else {
      console.log(`✓ ${file} ist aktuell.`);
    }
  }
  process.exit(failed ? 1 : 0);
}

for (const { file, content } of outputs) {
  writeFileSync(file, content);
  console.log(`geschrieben: ${file}`);
}
