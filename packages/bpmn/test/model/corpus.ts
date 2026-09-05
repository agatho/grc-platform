/**
 * Loader for the BPMN corpus in `test/corpus/`.
 *
 * The corpus is the measurement basis for everything in this package: every
 * `.bpmn` file there is either a diagram that really occurs in the repository
 * (extracted from seed SQL, unit tests, E2E specs, PRDs) or a deliberately
 * constructed hard case for a BPMN construct the target picture needs but the
 * current stock has never seen. `test/corpus/INDEX.md` says which is which.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const CORPUS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "corpus",
);

export interface CorpusEntry {
  /** File name without the `.bpmn` suffix. */
  readonly name: string;
  readonly path: string;
  readonly xml: string;
  /** `repo` — extracted from the repository; `synth` — built for this spike. */
  readonly origin: "repo" | "synth";
}

export function loadCorpus(): CorpusEntry[] {
  return readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith(".bpmn"))
    .sort()
    .map((file) => {
      const path = join(CORPUS_DIR, file);
      return {
        name: file.replace(/\.bpmn$/, ""),
        path,
        xml: readFileSync(path, "utf8"),
        origin: file.startsWith("repo-")
          ? ("repo" as const)
          : ("synth" as const),
      };
    });
}
