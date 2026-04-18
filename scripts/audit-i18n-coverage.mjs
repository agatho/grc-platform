#!/usr/bin/env node
// audit-i18n-coverage.mjs
//
// Scan apps/web/messages/de und apps/web/messages/en auf:
//   - Schluessel die nur in DE existieren (EN fehlt)
//   - Schluessel die nur in EN existieren (DE fehlt)
//   - Namespace-Dateien die nur in einer Sprache existieren
//   - Leere oder placeholder-artige Werte ("TODO", "___", "")
//
// Output: docs/i18n-coverage-report.md
//
// Limitation: nur Schluessel-Parity, nicht inhaltlich korrekte Uebersetzung.

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const DE_DIR = join(ROOT, "apps/web/messages/de");
const EN_DIR = join(ROOT, "apps/web/messages/en");
const OUT_DIR = join(ROOT, "docs");
const OUT_MD = join(OUT_DIR, "i18n-coverage-report.md");

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function flatten(obj, prefix = "", acc = new Map()) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v, full, acc);
    } else {
      acc.set(full, v);
    }
  }
  return acc;
}

function isPlaceholder(v) {
  if (v === null || v === undefined) return true;
  if (typeof v !== "string") return false;
  const t = v.trim();
  if (t === "") return true;
  if (t === "TODO" || t === "FIXME") return true;
  if (/^_+$/.test(t)) return true;
  if (/^(XXX|TBD|TBA)$/i.test(t)) return true;
  return false;
}

async function main() {
  const deFiles = (await readdir(DE_DIR)).filter((f) => f.endsWith(".json")).sort();
  const enFiles = (await readdir(EN_DIR)).filter((f) => f.endsWith(".json")).sort();
  const allFiles = [...new Set([...deFiles, ...enFiles])].sort();

  const onlyDeFiles = deFiles.filter((f) => !enFiles.includes(f));
  const onlyEnFiles = enFiles.filter((f) => !deFiles.includes(f));

  const perFile = [];
  let totalMissingEn = 0, totalMissingDe = 0, totalPlaceholderDe = 0, totalPlaceholderEn = 0;

  for (const f of allFiles) {
    const de = flatten(await readJson(join(DE_DIR, f)));
    const en = flatten(await readJson(join(EN_DIR, f)));
    const missingEn = [];
    const missingDe = [];
    const placeholderDe = [];
    const placeholderEn = [];
    for (const k of de.keys()) {
      if (!en.has(k)) missingEn.push(k);
      if (isPlaceholder(de.get(k))) placeholderDe.push(k);
    }
    for (const k of en.keys()) {
      if (!de.has(k)) missingDe.push(k);
      if (isPlaceholder(en.get(k))) placeholderEn.push(k);
    }
    totalMissingEn += missingEn.length;
    totalMissingDe += missingDe.length;
    totalPlaceholderDe += placeholderDe.length;
    totalPlaceholderEn += placeholderEn.length;
    perFile.push({ file: f, deCount: de.size, enCount: en.size, missingEn, missingDe, placeholderDe, placeholderEn });
  }

  await mkdir(OUT_DIR, { recursive: true });

  const md = [];
  md.push(`# i18n-Coverage-Report`);
  md.push(``);
  md.push(`_Generated: ${new Date().toISOString()}_`);
  md.push(``);
  md.push(`Vergleicht \`apps/web/messages/de/*.json\` gegen \`apps/web/messages/en/*.json\`. Nur Schluessel-Parity, nicht Qualitaet der Uebersetzung.`);
  md.push(``);
  md.push(`**Summary**:`);
  md.push(`- Namespace-Dateien: DE=${deFiles.length}, EN=${enFiles.length}`);
  md.push(`- Nur-DE-Dateien: ${onlyDeFiles.length} (${onlyDeFiles.map((f) => "`" + f + "`").join(", ") || "–"})`);
  md.push(`- Nur-EN-Dateien: ${onlyEnFiles.length} (${onlyEnFiles.map((f) => "`" + f + "`").join(", ") || "–"})`);
  md.push(`- Fehlende EN-Uebersetzungen: ${totalMissingEn}`);
  md.push(`- Fehlende DE-Uebersetzungen: ${totalMissingDe}`);
  md.push(`- Placeholder-Werte DE: ${totalPlaceholderDe}`);
  md.push(`- Placeholder-Werte EN: ${totalPlaceholderEn}`);
  md.push(``);

  md.push(`## Per-Datei`);
  md.push(``);
  md.push(`| Datei | DE-Keys | EN-Keys | EN fehlt | DE fehlt | Placeholder-DE | Placeholder-EN |`);
  md.push(`|---|---|---|---|---|---|---|`);
  for (const p of perFile) {
    const diff = p.missingEn.length + p.missingDe.length + p.placeholderDe.length + p.placeholderEn.length;
    const marker = diff === 0 ? "✅" : "⚠";
    md.push(`| ${marker} \`${p.file}\` | ${p.deCount} | ${p.enCount} | ${p.missingEn.length} | ${p.missingDe.length} | ${p.placeholderDe.length} | ${p.placeholderEn.length} |`);
  }
  md.push(``);

  md.push(`## Details (fehlende Keys je Datei)`);
  md.push(``);
  for (const p of perFile) {
    if (p.missingEn.length === 0 && p.missingDe.length === 0 && p.placeholderDe.length === 0 && p.placeholderEn.length === 0) continue;
    md.push(`### \`${p.file}\``);
    md.push(``);
    if (p.missingEn.length > 0) {
      md.push(`**EN fehlt** (${p.missingEn.length}):`);
      md.push("```");
      for (const k of p.missingEn.slice(0, 100)) md.push(`- ${k}`);
      if (p.missingEn.length > 100) md.push(`... ${p.missingEn.length - 100} more`);
      md.push("```");
    }
    if (p.missingDe.length > 0) {
      md.push(`**DE fehlt** (${p.missingDe.length}):`);
      md.push("```");
      for (const k of p.missingDe.slice(0, 100)) md.push(`- ${k}`);
      if (p.missingDe.length > 100) md.push(`... ${p.missingDe.length - 100} more`);
      md.push("```");
    }
    if (p.placeholderDe.length > 0) {
      md.push(`**Placeholder-DE** (${p.placeholderDe.length}): ${p.placeholderDe.slice(0, 20).map((k) => "`" + k + "`").join(", ")}${p.placeholderDe.length > 20 ? " ..." : ""}`);
    }
    if (p.placeholderEn.length > 0) {
      md.push(`**Placeholder-EN** (${p.placeholderEn.length}): ${p.placeholderEn.slice(0, 20).map((k) => "`" + k + "`").join(", ")}${p.placeholderEn.length > 20 ? " ..." : ""}`);
    }
    md.push(``);
  }

  await writeFile(OUT_MD, md.join("\n"));
  console.log(`Files: DE=${deFiles.length}, EN=${enFiles.length}`);
  console.log(`Missing EN: ${totalMissingEn}, Missing DE: ${totalMissingDe}`);
  console.log(`Placeholder DE: ${totalPlaceholderDe}, Placeholder EN: ${totalPlaceholderEn}`);
  console.log(`-> ${OUT_MD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
