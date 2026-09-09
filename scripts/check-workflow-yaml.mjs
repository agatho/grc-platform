#!/usr/bin/env node
// check-workflow-yaml.mjs
//
// [ARCTOS-FULL-2026-08-31 · Welle 8i]
//
// DER BEFUND, DER DIESES SKRIPT AUSGELOEST HAT
//
// Ich habe in `.github/workflows/ci.yml` einem Schritt ein `env:` gegeben, der
// schon eines hatte — zwei `env:`-Schluessel in derselben Zuordnung. Danach
// meldete GitHub fuer JEDEN Lauf nur noch:
//
//   This run likely failed because of a workflow file issue.
//
// Der gesamte CI-Workflow ist dadurch drei Commits lang gar nicht gestartet,
// und die Pull-Request-Uebersicht zeigte trotzdem gruene Checks — die der
// uebrigen, eigenstaendigen Workflows.
//
// Geprueft hatte ich es. Mit `yaml.safe_load`. Und genau das ist der Punkt:
// die YAML-Spezifikation verbietet doppelte Schluessel, aber die meisten
// Lader — PyYAML wie `js-yaml` in der Vorgabe — nehmen sie stillschweigend
// hin und behalten den letzten. Meine Pruefung KONNTE den Fehler nicht
// finden. Sie war gruen, weil sie blind war.
//
// WAS DIESES SKRIPT PRUEFT
//
// Jede Datei unter `.github/workflows/` wird mit einem Lader gelesen, der bei
// doppelten Schluesseln abbricht. Zusaetzlich die zwei Formfehler, die GitHub
// ebenfalls nur mit „workflow file issue" quittiert: ein Job ohne `steps`,
// und ein Schritt ohne `uses` und ohne `run`.
//
// Aufruf: node scripts/check-workflow-yaml.mjs

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { load, CORE_SCHEMA } from "js-yaml";

const DIR = resolve(process.cwd(), ".github/workflows");
const befunde = [];
let geprueft = 0;

for (const datei of readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f))) {
  const pfad = join(DIR, datei);
  let doc;
  try {
    // `json: false` ist die Vorgabe und laesst doppelte Schluessel NICHT zu —
    // js-yaml wirft dann. Genau das ist hier gewollt.
    doc = load(readFileSync(pfad, "utf8"), {
      filename: datei,
      schema: CORE_SCHEMA,
      json: false,
    });
  } catch (e) {
    befunde.push(`${datei}: ${String(e.message).split("\n")[0]}`);
    continue;
  }
  geprueft++;

  const jobs = doc?.jobs;
  if (!jobs || typeof jobs !== "object") {
    befunde.push(`${datei}: kein \`jobs\`-Block.`);
    continue;
  }
  for (const [name, job] of Object.entries(jobs)) {
    if (job?.uses) continue; // wiederverwendeter Workflow, hat keine steps
    if (!Array.isArray(job?.steps)) {
      befunde.push(`${datei} · Job "${name}": kein \`steps\`-Feld.`);
      continue;
    }
    job.steps.forEach((s, i) => {
      if (!s || (!s.uses && !s.run)) {
        befunde.push(
          `${datei} · Job "${name}", Schritt ${i + 1}` +
            (s?.name ? ` ("${s.name}")` : "") +
            ": weder `uses` noch `run`.",
        );
      }
    });
  }
}

console.log(`Workflow-Dateien geprueft: ${geprueft}.`);

if (befunde.length > 0) {
  console.error(`\n✗ ${befunde.length} Befund(e):\n`);
  for (const b of befunde) console.error(`  ✗ ${b}`);
  console.error(
    "\n  GitHub quittiert alle drei Faelle mit derselben Zeile:\n" +
      '    "This run likely failed because of a workflow file issue."\n' +
      "  Der Workflow startet dann GAR NICHT — und die Uebersicht des Pull\n" +
      "  Requests sieht trotzdem teilweise gruen aus, weil die uebrigen\n" +
      "  Workflows davon nichts wissen.\n" +
      "  Ein `yaml.safe_load` findet den ersten Fall nicht: doppelte\n" +
      "  Schluessel sind laut Spezifikation verboten, werden von den meisten\n" +
      "  Ladern aber stillschweigend hingenommen.",
  );
  process.exit(1);
}

console.log(
  "\n✓ Keine doppelten Schluessel, jeder Job hat Schritte, jeder Schritt hat `uses` oder `run`.",
);
