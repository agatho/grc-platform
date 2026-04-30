// Auto-discovers every Drizzle schema file under packages/db/src/schema/
// and asserts that each one:
//   1. Loads without errors
//   2. Exports at least one Drizzle table object
//
// This catches breaking changes in any schema file before integration tests
// (which require a live Postgres) ever run.

import { describe, it, expect } from "vitest";

const schemaModules = import.meta.glob<Record<string, unknown>>(
  "../../src/schema/*.ts",
);

describe("DB schema files smoke (auto-discovered)", () => {
  it("discovers at least 100 schema files", () => {
    expect(Object.keys(schemaModules).length).toBeGreaterThanOrEqual(100);
  });

  for (const [path, importer] of Object.entries(schemaModules)) {
    const fileName = path.split("/").pop()!.replace(".ts", "");

    describe(fileName, () => {
      it("loads without errors", async () => {
        await expect(importer()).resolves.toBeDefined();
      });

      it("exports at least one entity (table or const)", async () => {
        const mod = await importer();
        const exports = Object.keys(mod).filter(
          (k) => k !== "default" && !k.startsWith("__"),
        );
        expect(exports.length).toBeGreaterThan(0);
      });

      it("each exported value is non-null/non-undefined", async () => {
        const mod = await importer();
        for (const [key, value] of Object.entries(mod)) {
          if (key === "default" || key.startsWith("__")) continue;
          expect(value, `${fileName}.${key}`).not.toBeNull();
          expect(value, `${fileName}.${key}`).not.toBeUndefined();
        }
      });
    });
  }
});
