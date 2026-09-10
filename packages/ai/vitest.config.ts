import { defineConfig } from "vitest/config";
import { coverageFor } from "../../vitest.coverage.shared";

// [ARCTOS-FULL-2026-08-31 / WP6]
// `packages/ai` hatte fünf Testdateien, aber weder ein `test`-Skript noch
// eine Vitest-Konfiguration — `turbo test` lief sie nie. Damit war die
// gesamte Router- und Prompt-Logik faktisch ungetestet, obwohl Tests im
// Baum lagen. Beides ist ergänzt.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: coverageFor("packages/ai", {
      include: ["src/**/*.ts"],
    }),
  },
});
