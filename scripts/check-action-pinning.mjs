#!/usr/bin/env node
// ============================================================================
// #S08-05 / #S08-08 (WP10) — jede GitHub-Action muss per Commit-SHA gepinnt
// sein.
//
// Ist-Zustand zum Auditzeitpunkt: 42 von 50 Action-Referenzen waren an
// bewegliche Tags gebunden, darunter `aquasecurity/trivy-action@master` in
// einem Job mit `packages: write` und `secrets.GITHUB_TOKEN` (#S08-05) —
// exakt der Ablauf der tj-actions/changed-files-Kompromittierung von 2025.
// Gleichzeitig behauptete der Kommentar in `coverage.yml:37`, alle Actions
// seien SHA-gepinnt. Eine behauptete, nicht geleistete Kontrolle ist in
// einem GRC-Produkt der schwerere Mangel.
//
// Dieses Skript macht die Zusage prüfbar:
//   - jede `uses:`-Referenz auf eine Action (owner/repo[@...]) muss einen
//     40-stelligen Commit-SHA tragen;
//   - jede muss einen Kommentar mit dem zugehörigen Tag tragen, damit
//     Dependabot-Bumps lesbar bleiben;
//   - `@master`/`@main` und Tag-Referenzen failen hart;
//   - lokale (`./…`) und Docker-Referenzen (`docker://…`) sind ausgenommen.
//
// Aufruf: node scripts/check-action-pinning.mjs
// ============================================================================
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const DIR = resolve(process.cwd(), ".github/workflows");
const SHA_RE = /^[0-9a-f]{40}$/;
const USES_RE = /^\s*(?:-\s*)?uses:\s*(\S+)\s*(#.*)?$/;

let files;
try {
  files = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f));
} catch {
  console.error(`✗ ${DIR} nicht gefunden.`);
  process.exit(2);
}

const problems = [];
let checked = 0;

for (const f of files) {
  const path = join(DIR, f);
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const m = USES_RE.exec(line);
    if (!m) return;
    const ref = m[1];
    const comment = m[2] ?? "";
    if (
      ref.startsWith("./") ||
      ref.startsWith("docker://") ||
      ref.startsWith(".\\")
    )
      return;
    checked++;
    const at = ref.lastIndexOf("@");
    const loc = `${f}:${i + 1}`;
    if (at < 0) {
      problems.push(`${loc}: "${ref}" ohne Versionsangabe.`);
      return;
    }
    const version = ref.slice(at + 1);
    if (!SHA_RE.test(version)) {
      const kind = /^(master|main|develop)$/.test(version) ? "BRANCH" : "TAG";
      problems.push(
        `${loc}: "${ref}" ist per ${kind} referenziert, nicht per Commit-SHA. ` +
          `Beweglich — ein übernommenes Maintainer-Konto führt beim nächsten Lauf ` +
          `fremden Code in diesem Runner aus (#S08-05/#S08-08).`,
      );
      return;
    }
    if (!/#\s*v?\S+/.test(comment)) {
      problems.push(
        `${loc}: "${ref}" ist gepinnt, trägt aber keinen Tag-Kommentar ` +
          `(\`# v1.2.3\`). Ohne ihn ist nicht nachvollziehbar, welche Version läuft.`,
      );
    }
  });
}

console.log(
  `Action-Pinning: ${checked} Referenzen in ${files.length} Workflows geprüft.`,
);
if (problems.length) {
  console.error(
    `\n✗ Ungepinnte oder unkommentierte Actions (${problems.length}):`,
  );
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(
    "\nSHA ermitteln: git ls-remote --tags --refs https://github.com/<owner>/<repo> | grep '/<tag>$'",
  );
  process.exit(1);
}
console.log(
  "✓ Alle Actions sind per Commit-SHA gepinnt und tragen ihren Tag als Kommentar.",
);
