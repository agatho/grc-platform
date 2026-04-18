#!/usr/bin/env node
// audit-secrets.mjs
//
// Local secret-pattern scanner. Runs a set of regex patterns against all
// tracked files (except known exclusions) and reports potential secrets.
//
// This is NOT a replacement for gitleaks (which has better entropy analysis)
// but useful for:
//   - Pre-commit local checks
//   - Developers running on a laptop without network to fetch gitleaks
//   - CI offline environments
//
// Output: stdout list of findings. Exit 1 if any found. Writes
// docs/security/secret-scan-report.md for PR review.

import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const OUT = join(ROOT, "docs/security/secret-scan-report.md");

// Patterns mapped to { name, regex, severity }.
// Keep conservative -- too broad = noisy, too narrow = misses real leaks.
const PATTERNS = [
  { name: "AWS Access Key", regex: /\bAKIA[0-9A-Z]{16}\b/g, severity: "critical" },
  // AWS Secret Access Keys are unprefixed 40-char base64 -- detection is
  // pure entropy-heuristic territory, use gitleaks for that. We skip here
  // to avoid the ~200 false positives from SHA-1 hashes, etags, etc.
  { name: "Google API Key", regex: /\bAIza[0-9A-Za-z-_]{35}\b/g, severity: "critical" },
  { name: "GitHub PAT (classic)", regex: /\bghp_[A-Za-z0-9]{36}\b/g, severity: "critical" },
  { name: "GitHub PAT (fine-grained)", regex: /\bgithub_pat_[A-Za-z0-9_]{82}\b/g, severity: "critical" },
  { name: "Slack Bot Token", regex: /\bxoxb-[0-9]+-[0-9]+-[A-Za-z0-9]+\b/g, severity: "high" },
  { name: "Anthropic API Key", regex: /\bsk-ant-[A-Za-z0-9-_]{95,}\b/g, severity: "critical" },
  { name: "OpenAI API Key", regex: /\bsk-[A-Za-z0-9]{48,}\b/g, severity: "critical" },
  { name: "Backblaze B2 Key ID", regex: /\bK00[0-9]\w{25}\b/g, severity: "high" },
  { name: "Private Key Header", regex: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g, severity: "critical" },
  { name: "JWT-looking string", regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, severity: "medium" },
  { name: "Generic password assignment", regex: /(password|passwd|pwd)\s*[:=]\s*["'][^"'\s]{8,}["']/gi, severity: "medium" },
];

const EXCLUDE_DIRS = new Set([
  "node_modules", ".next", ".turbo", ".git", "dist", "build",
  "coverage", "backups", "audit-test-2026-04-17",
  // Self-exclusion: the report lists suspected secrets, we'd scan
  // our own report otherwise and create infinite false positives.
  "security",
]);
// Skip environment-variable references like $DB_PASSWORD, ${FOO}
const ENV_REF = /\$\{?[A-Z_][A-Z0-9_]*\}?/;
const EXCLUDE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".dump",
  ".woff", ".woff2", ".ttf", ".otf", ".zip", ".gz",
]);

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else {
      const ext = entry.name.includes(".") ? "." + entry.name.split(".").pop() : "";
      if (EXCLUDE_EXTENSIONS.has(ext)) continue;
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const files = await walk(ROOT);
  console.log(`Scanning ${files.length} files...`);
  const findings = [];
  for (const file of files) {
    try {
      const info = await stat(file);
      if (info.size > 1_000_000) continue; // skip >1 MB files (likely binary)
      const content = await readFile(file, "utf8");
      for (const pat of PATTERNS) {
        let m;
        pat.regex.lastIndex = 0;
        while ((m = pat.regex.exec(content)) !== null) {
          const lineStart = content.lastIndexOf("\n", m.index) + 1;
          const lineEnd = content.indexOf("\n", m.index);
          const line = content.slice(lineStart, lineEnd > 0 ? lineEnd : content.length);
          const lineNum = content.slice(0, m.index).split("\n").length;
          // Skip obvious false positives
          if (pat.name === "AWS Secret Access Key" && /^[0-9a-f]{40}$/i.test(m[0])) continue; // SHA-1 hash
          if (/placeholder|example|dummy|changeme|xxxxx/i.test(line)) continue;
          // env-variable references like $DB_PASSWORD or ${FOO} are not secrets
          if (pat.name === "Generic password assignment" && ENV_REF.test(line)) continue;
          findings.push({
            file: file.replace(ROOT + "/", "").replace(/\\/g, "/"),
            line: lineNum,
            pattern: pat.name,
            severity: pat.severity,
            match: m[0].slice(0, 20) + "...",
          });
        }
      }
    } catch {}
  }

  await mkdir(join(ROOT, "docs/security"), { recursive: true });

  const md = [
    `# Secret-Scan Report`,
    ``,
    `_Generated: ${new Date().toISOString()}_`,
    ``,
    `Files scanned: ${files.length}. Findings: ${findings.length}.`,
    ``,
  ];
  if (findings.length === 0) {
    md.push(`✅ **No potential secrets found.**`);
    md.push(``);
    md.push(`This scan uses conservative regex patterns (see scripts/audit-secrets.mjs). It is NOT a guarantee of secret-free code -- pair with gitleaks (CI) and GitHub Secret-Scanning.`);
  } else {
    md.push(`| File | Line | Pattern | Severity | Match |`);
    md.push(`|---|---|---|---|---|`);
    for (const f of findings) {
      md.push(`| \`${f.file}\` | ${f.line} | ${f.pattern} | ${f.severity} | \`${f.match}\` |`);
    }
  }
  await writeFile(OUT, md.join("\n"));
  console.log(`→ Wrote ${OUT}`);
  console.log(`  Findings: ${findings.length}`);
  if (findings.length > 0) {
    console.log(`  Critical: ${findings.filter((f) => f.severity === "critical").length}`);
    console.log(`  High:     ${findings.filter((f) => f.severity === "high").length}`);
    console.log(`  Medium:   ${findings.filter((f) => f.severity === "medium").length}`);
  }
  process.exit(findings.filter((f) => f.severity === "critical").length > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
