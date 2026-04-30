import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.ts", "tests/**/*.{test,spec}.ts"],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@grc/db": resolve(__dirname, "../../packages/db/src"),
      "@grc/shared": resolve(__dirname, "../../packages/shared/src"),
      "@grc/email": resolve(__dirname, "../../packages/email/src"),
      "@grc/events": resolve(__dirname, "../../packages/events/src"),
    },
  },
});
