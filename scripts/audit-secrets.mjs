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
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);
const OUT = join(ROOT, "docs/security/secret-scan-report.md");

// ============================================================================
// [ARCTOS-FULL-2026-08-31 / WP10 · S08-14]
//
// Vier belegte Defekte dieses Scanners, alle hier behoben:
//
//  1. EXCLUDE_DIRS enthielt den BASISNAMEN "security" und `walk()` prüfte
//     `EXCLUDE_DIRS.has(entry.name)` an JEDER Baumposition. Damit fielen
//     `apps/web/src/app/api/v1/security/**` und jedes weitere Verzeichnis
//     namens `security/` stillschweigend aus dem Scan — gemeint war nur
//     `docs/security` (Self-Exclusion des eigenen Reports). Gleiches galt
//     für `build/` und `coverage/`, und die .gitignore belegt, dass es
//     API-Pfade namens `coverage` gibt. Jetzt: PFADPRÄFIXE statt
//     Basisnamen, und die Self-Exclusion greift nur noch für die eine
//     Report-Datei.
//  2. Mustergaps: `sk-[A-Za-z0-9]{48,}` erfasst keine modernen
//     OpenAI-Keys der Form `sk-proj-…` (die enthalten `-` und `_`);
//     `github_pat_[…]{82}` verlangte EXAKT 82 Zeichen; für
//     Slack-Webhooks, Stripe, SendGrid, Resend, npm-, GitLab-Token,
//     Azure `AccountKey=` und Connection-Strings mit Passwort gab es gar
//     keine Muster. Ergänzt.
//  3. Der Scan war HEAD-only. Ein einmal committetes und später
//     entferntes Secret war unsichtbar. Der wiederkehrende
//     Historien-Scan läuft jetzt wöchentlich in
//     .github/workflows/secret-scanning.yml (Job `full-history-scan`);
//     dieses Skript bleibt bewusst der schnelle Arbeitsplatz-Scan.
//  4. Abstumpfung: die dauerhaft gemeldeten sechs Treffer waren
//     ausnahmslos Testfixtures. Sie stehen jetzt als benannte, begründete
//     Ausnahmen in KNOWN_TEST_FIXTURES und erscheinen im Report in einem
//     eigenen Abschnitt statt in der Fundliste — der Report ist wieder
//     aussagekräftig.
// ============================================================================

// Patterns mapped to { name, regex, severity }.
// Keep conservative -- too broad = noisy, too narrow = misses real leaks.
const PATTERNS = [
  {
    name: "AWS Access Key",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    severity: "critical",
  },
  // AWS Secret Access Keys are unprefixed 40-char base64 -- detection is
  // pure entropy-heuristic territory, use gitleaks for that. We skip here
  // to avoid the ~200 false positives from SHA-1 hashes, etags, etc.
  {
    name: "Google API Key",
    regex: /\bAIza[0-9A-Za-z-_]{35}\b/g,
    severity: "critical",
  },
  {
    name: "GitHub PAT (classic)",
    regex: /\bghp_[A-Za-z0-9]{36}\b/g,
    severity: "critical",
  },
  // #S08-14: war auf EXAKT 82 Zeichen festgelegt; abweichende Laengen
  // fielen durch.
  {
    name: "GitHub PAT (fine-grained)",
    regex: /\bgithub_pat_[A-Za-z0-9_]{70,}/g,
    severity: "critical",
  },
  {
    name: "GitHub OAuth/Server Token",
    regex: /\bgh[ousr]_[A-Za-z0-9]{36,}/g,
    severity: "critical",
  },
  {
    name: "Slack Bot Token",
    regex: /\bxoxb-[0-9]+-[0-9]+-[A-Za-z0-9]+\b/g,
    severity: "high",
  },
  {
    name: "Anthropic API Key",
    regex: /\bsk-ant-[A-Za-z0-9\-_]{80,}/g,
    severity: "critical",
  },
  // #S08-14: `sk-proj-…`, `sk-svcacct-…` und die klassische Form. Die alte
  // Zeichenklasse [A-Za-z0-9] traf moderne OpenAI-Keys nicht, weil die
  // `-` und `_` enthalten.
  {
    name: "OpenAI API Key",
    regex: /\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9\-_]{20,}/g,
    severity: "critical",
  },
  {
    name: "OpenAI API Key (legacy)",
    regex: /\bsk-[A-Za-z0-9]{48,}\b/g,
    severity: "critical",
  },
  {
    name: "Backblaze B2 Key ID",
    regex: /\bK00[0-9]\w{25}\b/g,
    severity: "high",
  },
  {
    name: "Private Key Header",
    regex: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
    severity: "critical",
  },
  {
    name: "JWT-looking string",
    regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    severity: "medium",
  },
  // [WP10 · S08-15, Befund WP11 2026-09-01] Das Muster darueber ist ein
  // JWS-Muster: drei Segmente, jedes mit Inhalt. Ein Auth.js-Sessiontoken ist
  // aber ein JWE — fuenf Segmente, und bei `alg: "dir"` (dem Standard von
  // Auth.js) ist das zweite Segment, der verschluesselte Schluessel, LEER.
  // `{10,}` an dieser Stelle konnte darauf nie passen.
  //
  // Wirkung des Fehlers: `apps/web/e2e/.auth/admin.json` lag getrackt im
  // Repository und enthielt ein 1523 Zeichen langes `authjs.session-token`
  // des Seed-Admins. Dieser Scanner meldete fuer denselben Baum "0 Funde".
  // Ein Muster, das die haeufigste Tokenform des eigenen Auth-Stacks nicht
  // trifft, ist eine Kontrolle, die ihre Zusage nicht einloest — genau die
  // Klasse, die S08-14/S08-15 beschreiben.
  {
    name: "JWE-looking string (Auth.js session token)",
    regex:
      /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}/g,
    severity: "high",
  },
  // Playwright-Storage-State und verwandte Sitzungsabzuege. Greift auch
  // dann, wenn das Token selbst nicht wie ein JWT/JWE aussieht.
  {
    name: "Browser storage state with session cookie",
    regex:
      /"name"\s*:\s*"(?:[a-z0-9_.-]*(?:session[_.-]?token|__Secure-[a-z0-9_.-]*session)[a-z0-9_.-]*)"\s*,\s*"value"\s*:\s*"[^"]{32,}"/gi,
    severity: "high",
  },
  {
    name: "Generic password assignment",
    regex: /(password|passwd|pwd)\s*[:=]\s*["'][^"'\s]{8,}["']/gi,
    severity: "medium",
  },

  // ── #S08-14: ergaenzte Muster ────────────────────────────────────────
  {
    name: "Slack Webhook",
    regex:
      /https:\/\/hooks\.slack\.com\/services\/T[A-Za-z0-9]+\/B[A-Za-z0-9]+\/[A-Za-z0-9]{16,}/g,
    severity: "high",
  },
  {
    name: "Slack Token (any)",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
    severity: "high",
  },
  {
    name: "Stripe Secret Key",
    regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}/g,
    severity: "critical",
  },
  {
    name: "SendGrid API Key",
    regex: /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
    severity: "critical",
  },
  { name: "Resend API Key", regex: /\bre_[A-Za-z0-9]{20,}/g, severity: "high" },
  {
    name: "npm Token",
    regex: /\bnpm_[A-Za-z0-9]{36}\b/g,
    severity: "critical",
  },
  {
    name: "GitLab PAT",
    regex: /\bglpat-[A-Za-z0-9_-]{20,}/g,
    severity: "critical",
  },
  {
    name: "Azure Storage AccountKey",
    regex: /AccountKey=[A-Za-z0-9+/=]{60,}/g,
    severity: "critical",
  },
  {
    name: "Twilio Account SID",
    regex: /\bAC[0-9a-fA-F]{32}\b/g,
    severity: "high",
  },
  // Connection-Strings mit eingebettetem Passwort. Genau die Klasse, die
  // `trufflehog --only-verified` bauartbedingt NIE meldet (S08-15).
  {
    name: "DB/Broker connection string with password",
    regex:
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|amqps?):\/\/[^:/\s"']+:[^@\s"']{4,}@/g,
    severity: "high",
  },
  {
    name: "HTTP Basic-Auth URL",
    regex: /\bhttps?:\/\/[^:/\s"']+:[^@\s"']{4,}@[^\s"']+/g,
    severity: "medium",
  },
  {
    name: "Certificate/Key file content",
    regex: /-----BEGIN (?:ENCRYPTED |RSA )?PRIVATE KEY-----/g,
    severity: "critical",
  },
];

// #S08-14 (4): Bekannte Testfixtures. Sie sind fachlich notwendig (Zod-
// Schema-Tests fuer Passwortregeln, Krypto-Testvektoren) und waren der
// Grund, warum der Report dauerhaft dieselben sechs "medium"-Treffer zeigte
// und deshalb nicht mehr gelesen wurde. Sie erscheinen jetzt in einem
// eigenen Report-Abschnitt, nicht in der Fundliste.
const KNOWN_TEST_FIXTURES = [
  {
    path: "packages/shared/tests/schemas.test.ts",
    reason:
      "Zod-Schema-Tests der Passwortregeln — die Werte SIND der Testgegenstand.",
  },
  {
    path: "packages/shared/tests/wb-crypto.test.ts",
    reason:
      "Krypto-Testvektoren (64-stelliger Hex-Schluessel 0123…) aus der Spezifikation.",
  },
  {
    path: "packages/db/tests/helpers.ts",
    reason: "Dev-Datenbank-URL gegen localhost.",
  },
  {
    path: "packages/db/src/seed.ts",
    reason: "Demo-Seed; verweigert sich in NODE_ENV=production (#SEC-F04).",
  },
  {
    path: ".env.example",
    reason:
      "Template mit Platzhaltern; scripts/check-env-example.mjs erzwingt, dass kein Platzhalter wie ein Wert aussieht (#S08-18).",
  },
  {
    path: ".github/workflows/ci.yml",
    reason: "CI-Testpasswoerter gegen den Service-Container des Runners.",
  },
  {
    path: "packages/auth/tests/fixtures/idp-test-key.pem",
    reason:
      "Eigens fuer die SAML-Testsuite erzeugtes IdP-Schluesselpaar (WP3). Es " +
      "gehoert zu keiner realen Identitaet und wird von keinem Deployment " +
      "gelesen — die produktive IdP-Konfiguration kommt aus sso_config. " +
      "Bewusst im Repo, damit die Signaturpruefungstests deterministisch sind.",
  },
  {
    path: "packages/shared/tests/identity-schemas.test.ts",
    reason:
      "Zod-Schema-Test der Passwortregeln — der Wert IST der Testgegenstand.",
  },
  {
    path: "apps/web/e2e/document-signature.spec.ts",
    reason:
      "Playwright-Zugangsdaten fuer das Demo-Seed-Konto der Wegwerf-E2E-DB. " +
      "Der Demo-Seed verweigert sich in NODE_ENV=production (#SEC-F04).",
  },
  {
    path: "packages/db/sql/fix_umlauts_v3.sql",
    reason:
      "Dev-Aufrufbeispiel im Kopfkommentar (localhost, grc_dev_password).",
  },
  {
    path: "apps/web/src/app/(dashboard)/access-log/page.tsx",
    reason:
      // Der Beispielwert ist hier bewusst NICHT ausgeschrieben: sonst
      // meldet dieser Scanner seine eigene Dokumentation als Fund. Gemeint
      // ist die Zuordnung des Schluessels `password` auf sein Anzeigelabel.
      "Kein Secret: Label-Mapping der Anmeldemethode fuer die Oberflaeche " +
      "(Schluessel `password` auf seinen Anzeigetext).",
  },
];

// #S08-14 (1): Basisnamen, die an JEDER Baumposition ausgeschlossen werden
// duerfen, weil sie nirgends Anwendungscode enthalten koennen.
const EXCLUDE_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  ".turbo",
  ".git",
  "backups",
  "audit-test-2026-04-17",
  ".playwright-cache",
  "playwright-report",
]);
// #S08-14 (1): Diese hier NUR als Pfadpraefix ab der Repo-Wurzel. Vorher
// standen "build", "coverage", "dist" und "security" als Basisnamen in
// derselben Liste — damit fielen `apps/web/src/app/api/v1/security/**` und
// jedes `**/coverage/`-Verzeichnis (die .gitignore belegt, dass es solche
// API-Pfade gibt) stillschweigend aus dem Scan.
const EXCLUDE_PATH_PREFIXES = [
  "dist/",
  "coverage/",
  "build/",
  "SBOM/",
  "packages/db/drizzle/",
];
// Self-exclusion: NUR der eigene Report, nicht das gesamte Verzeichnis
// docs/security/ (dort liegen u. a. lod-coverage.csv und die
// RLS-Coverage-Reports, die sehr wohl gescannt gehoeren).
const EXCLUDE_FILES = new Set(["docs/security/secret-scan-report.md"]);
// Skip environment-variable references like $DB_PASSWORD, ${FOO}
const ENV_REF = /\$\{?[A-Z_][A-Z0-9_]*\}?/;
const EXCLUDE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".pdf",
  ".dump",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".zip",
  ".gz",
]);

function relPath(full) {
  return relative(ROOT, full).replace(/\\/g, "/");
}

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE_DIR_NAMES.has(entry.name)) continue;
    const full = join(dir, entry.name);
    const rel = relPath(full);
    if (entry.isDirectory()) {
      // #S08-14: Pfadpraefix, nicht Basisname.
      if (EXCLUDE_PATH_PREFIXES.some((p) => (rel + "/").startsWith(p)))
        continue;
      await walk(full, out);
    } else {
      if (EXCLUDE_FILES.has(rel)) continue;
      const ext = entry.name.includes(".")
        ? "." + entry.name.split(".").pop()
        : "";
      if (EXCLUDE_EXTENSIONS.has(ext)) continue;
      out.push(full);
    }
  }
  return out;
}

/**
 * #S08-14: Nur GETRACKTE Dateien scannen. Der Kopfkommentar dieses Skripts
 * versprach das seit jeher ("all tracked files"), `walk()` lief aber über das
 * Arbeitsverzeichnis — und meldete dadurch lokale `.env`-Dateien,
 * Coverage-HTML und andere ignorierte Artefakte als Treffer. Genau dieses
 * Rauschen hat den Report unlesbar gemacht. `walk()` bleibt als Rückfall,
 * falls kein Git verfügbar ist (der Kopfkommentar nennt Offline-Nutzung als
 * Anwendungsfall).
 */
async function trackedFiles() {
  try {
    const out = execFileSync("git", ["ls-files", "-z"], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const rels = out.split("\0").filter(Boolean);
    return rels
      .filter((rel) => !EXCLUDE_FILES.has(rel))
      .filter(
        (rel) =>
          !EXCLUDE_PATH_PREFIXES.some((pre) => (rel + "/").startsWith(pre)),
      )
      .filter((rel) => {
        const base = rel.split("/").pop() ?? rel;
        const ext = base.includes(".") ? "." + base.split(".").pop() : "";
        return !EXCLUDE_EXTENSIONS.has(ext);
      })
      .map((rel) => join(ROOT, rel));
  } catch {
    console.warn(
      "git ls-files nicht verfügbar — Rückfall auf Verzeichnis-Walk.",
    );
    return walk(ROOT);
  }
}

async function main() {
  const files = await trackedFiles();
  console.log(`Scanning ${files.length} files...`);
  const findings = [];
  const acknowledged = [];
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
          const line = content.slice(
            lineStart,
            lineEnd > 0 ? lineEnd : content.length,
          );
          const lineNum = content.slice(0, m.index).split("\n").length;
          // Skip obvious false positives
          if (
            pat.name === "AWS Secret Access Key" &&
            /^[0-9a-f]{40}$/i.test(m[0])
          )
            continue; // SHA-1 hash
          if (/placeholder|example|dummy|changeme|xxxxx/i.test(line)) continue;
          // #S08-14: sed-/grep-Ausdruecke, die eine Verbindungszeichenkette
          // ZERLEGEN, sind keine Fundstellen. Erkennbar an Regex-Metazeichen
          // im "Passwort"-Teil.
          if (/[[\]()*+\\]|\.\*/.test(m[0])) continue;
          // env-variable references like $DB_PASSWORD or ${FOO} are not secrets
          if (pat.name === "Generic password assignment" && ENV_REF.test(line))
            continue;
          const rel = relPath(file);
          // #S08-14: Shell-/Compose-Variablenreferenzen sind keine Werte.
          if (/\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/.test(m[0])) continue;
          // #S08-14 (4): bekannte Testfixtures raus aus der Fundliste, rein
          // in den eigenen Report-Abschnitt. Ein Report, der dauerhaft
          // dieselben sechs Falsch-Positive zeigt, wird nicht mehr gelesen.
          let fixture = KNOWN_TEST_FIXTURES.find((f) => rel === f.path);
          // #S08-14 / #S08-18: Eine Verbindungszeichenkette gegen `localhost`,
          // `127.0.0.1` oder einen Compose-Servicenamen (Hostname ohne Punkt)
          // kann per Konstruktion keinen Produktivbezug haben. Sie bleibt im
          // Report, aber als bewertete Fundstelle — sonst ertrinkt ein echter
          // Treffer gegen einen externen Host in 30 Dev-Defaults.
          if (
            !fixture &&
            /connection string with password|Basic-Auth URL/i.test(pat.name)
          ) {
            // Das Treffer-Fragment endet beim `@` (die Regex bindet dort);
            // der Hostname steht dahinter, deshalb wird der Kontext gelesen.
            const after = content.slice(
              m.index + m[0].length,
              m.index + m[0].length + 128,
            );
            const host =
              (/@([^:/?#\s"']+)/.exec(m[0]) ?? [])[1] ??
              (/^([^:/?#\s"']+)/.exec(after) ?? [])[1] ??
              "";
            const isLocal =
              /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|host\.docker\.internal)$/i.test(
                host,
              ) ||
              (host !== "" && !host.includes("."));
            if (isLocal) {
              fixture = {
                path: rel,
                reason:
                  `Bindet an \`${host}\` — localhost bzw. ein Compose-Servicename. ` +
                  `Kein Produktivbezug; die produktiven Passwörter erzeugen ` +
                  `deploy/setup-hetzner.sh und deploy/create-tenant.sh per ` +
                  `\`openssl rand\` (#S08-18).`,
              };
            }
          }
          const entry = {
            file: rel,
            line: lineNum,
            pattern: pat.name,
            severity: pat.severity,
            match: m[0].slice(0, 12) + "…[len=" + m[0].length + "]",
          };
          if (fixture) {
            acknowledged.push({ ...entry, reason: fixture.reason });
          } else {
            findings.push(entry);
          }
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
    md.push(
      `This scan uses conservative regex patterns (see scripts/audit-secrets.mjs). It is NOT a guarantee of secret-free code -- pair with gitleaks (CI) and GitHub Secret-Scanning.`,
    );
  } else {
    md.push(`| File | Line | Pattern | Severity | Match |`);
    md.push(`|---|---|---|---|---|`);
    for (const f of findings) {
      md.push(
        `| \`${f.file}\` | ${f.line} | ${f.pattern} | ${f.severity} | \`${f.match}\` |`,
      );
    }
  }

  // #S08-14 (4)
  md.push(``);
  md.push(`## Bekannte, bewertete Testfixtures (${acknowledged.length})`);
  md.push(``);
  md.push(
    `Diese Treffer sind fachlich notwendig und geprüft. Sie stehen bewusst ` +
      `NICHT in der Fundliste oben: bis zum Audit 2026-08-31 meldete dieser ` +
      `Report dauerhaft dieselben sechs Treffer, und genau deshalb wurde er ` +
      `nicht mehr gelesen (#S08-14). Ein NEUER Treffer erscheint oben und ` +
      `fällt damit auf.`,
  );
  md.push(``);
  if (acknowledged.length === 0) {
    md.push(`_Keine._`);
  } else {
    md.push(`| File | Line | Pattern | Begründung |`);
    md.push(`|---|---|---|---|`);
    for (const f of acknowledged) {
      md.push(`| \`${f.file}\` | ${f.line} | ${f.pattern} | ${f.reason} |`);
    }
  }
  md.push(``);
  md.push(`## Grenzen dieses Scans`);
  md.push(``);
  md.push(
    `Dieser Scan läuft ausschließlich über den ARBEITSBAUM (HEAD). Ein ` +
      `einmal committetes und später entferntes Secret ist hier unsichtbar. ` +
      `Den vollständigen Historien-Scan fährt wöchentlich der Job ` +
      `\`full-history-scan\` in \`.github/workflows/secret-scanning.yml\` ` +
      `(gitleaks über alle Refs, Ergebnis als Artefakt, 90 Tage) — ` +
      `siehe #S08-14 und #S08-15.`,
  );
  await writeFile(OUT, md.join("\n") + "\n");
  console.log(`→ Wrote ${OUT}`);
  console.log(`  Findings: ${findings.length}`);
  if (findings.length > 0) {
    console.log(
      `  Critical: ${findings.filter((f) => f.severity === "critical").length}`,
    );
    console.log(
      `  High:     ${findings.filter((f) => f.severity === "high").length}`,
    );
    console.log(
      `  Medium:   ${findings.filter((f) => f.severity === "medium").length}`,
    );
  }
  process.exit(
    findings.filter((f) => f.severity === "critical").length > 0 ? 1 : 0,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
