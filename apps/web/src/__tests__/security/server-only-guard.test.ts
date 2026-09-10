// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-081]
//
// `packages/db/src/index.ts` exportiert den postgres-js-Pool samt
// `DATABASE_URL`; `packages/auth/src/providers.ts` traegt den Anmeldepfad
// samt Entra-ID-Zugangsdaten. Beide waren gegen einen Import aus einer
// `"use client"`-Datei nur durch einen Kommentar geschuetzt ("Node.js only").
// Der Bundler haette daraus ein Browser-Bundle gebaut — kein Fehler, nur ein
// Shim und moeglicherweise inlinierte Serverkonstanten.
//
// Das Mittel ist der Marker `server-only`. Diese Datei haelt die drei Haelften
// fest, aus denen seine Wirkung besteht — und die dritte ist der eigentliche
// Grund, warum es diesen Test gibt:
//
//   1. Der Marker steht im Browser-Modulgraphen beider Dateien.
//   2. Der Marker ist echt (sein Standard-Einstieg wirft) und Next.js traegt
//      die Regel, die daraus einen Buildfehler macht.
//   3. UNTER NODE passiert nichts. Der naheliegende Einbau —
//      `import "server-only";` — wurde am 2026-09-03 ausprobiert und machte
//      1 Suite in packages/db, 4 in packages/auth und 4 in apps/worker rot,
//      weil das Paket seinen Wurf ueber die `default`-Condition ausliefert und
//      nur Next.js die Condition `react-server` setzt. apps/worker importiert
//      `@grc/db` in 137 Dateien. Ohne (3) waere die Reparatur schlimmer als
//      der Befund.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";

const REPO = path.join(__dirname, "../../../../..");
const GUARDED = [
  "packages/db/src/index.ts",
  "packages/auth/src/providers.ts",
] as const;

describe("OP-081 — Server-Guard, Bundler-Haelfte", () => {
  it.each(GUARDED)(
    "%s zieht `server-only` in den Browser-Modulgraphen",
    async (rel) => {
      // Alles Fremde bleibt extern; nur der eigene Baum und `server-only`
      // werden wirklich aufgeloest. Der Metafile beantwortet damit genau eine
      // Frage: steht der Marker im Graphen dieses Moduls, wenn es fuer den
      // Browser gebuendelt wird?
      const result = await build({
        entryPoints: [path.join(REPO, rel)],
        bundle: true,
        write: false,
        platform: "browser",
        format: "esm",
        metafile: true,
        logLevel: "silent",
        plugins: [
          {
            name: "extern-ausser-server-only",
            setup(b) {
              b.onResolve({ filter: /.*/ }, (args) => {
                if (args.kind === "entry-point") return null;
                if (args.path === "server-only") return null;
                if (args.path.startsWith(".") || path.isAbsolute(args.path))
                  return null;
                return { path: args.path, external: true };
              });
            },
          },
        ],
      });
      const inputs = Object.keys(result.metafile.inputs);
      expect(inputs.some((i) => /server-only/.test(i))).toBe(true);
    },
  );

  it("der Marker ist echt — sein Standard-Einstieg wirft", () => {
    const require_ = createRequire(path.join(REPO, "package.json"));
    const entry = require_.resolve("server-only");
    expect(entry).toMatch(/server-only/);
    // Kein Stub: die Datei besteht aus einem `throw`.
    expect(readFileSync(entry, "utf8")).toMatch(/^\s*throw new Error\(/);
    // Und die `react-server`-Condition zeigt auf eine LEERE Datei — das ist
    // der Grund, warum Next.js auf dem Server nicht stolpert.
    const pkg = JSON.parse(
      readFileSync(path.join(path.dirname(entry), "package.json"), "utf8"),
    ) as { exports: Record<string, Record<string, string>> };
    expect(pkg.exports["."]["react-server"]).toBe("./empty.js");
  });

  it("Next.js traegt die Regel, die daraus einen Buildfehler macht", () => {
    const require_ = createRequire(path.join(REPO, "apps/web/package.json"));
    const aliases = readFileSync(
      require_.resolve("next/dist/build/create-compiler-aliases.js"),
      "utf8",
    );
    // Server-Schichten -> empty, alle uebrigen -> index (der Wurf).
    expect(aliases).toContain(
      "'server-only$': 'next/dist/compiled/server-only/empty'",
    );
    expect(aliases).toContain(
      "'server-only$': 'next/dist/compiled/server-only/index'",
    );
    const wp = readFileSync(
      require_.resolve("next/dist/build/webpack-config.js"),
      "utf8",
    );
    expect(wp).toContain("next-invalid-import-error-loader");
    expect(wp).toContain(
      "'server-only' cannot be imported from a Client Component module.",
    );
  });

  it("das Paket ist deklariert und im Lockfile fixiert", () => {
    const root = JSON.parse(
      readFileSync(path.join(REPO, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    expect(root.dependencies?.["server-only"]).toBeTruthy();
    const lock = JSON.parse(
      readFileSync(path.join(REPO, "package-lock.json"), "utf8"),
    ) as { packages: Record<string, { resolved?: string }> };
    expect(lock.packages["node_modules/server-only"]).toBeTruthy();
  });
});

describe("OP-081 — Server-Guard, Node-Haelfte", () => {
  // Die Zusicherung, die den naiven Einbau ausschliesst. Faellt sie, ist
  // apps/worker (137 Dateien mit `import … from "@grc/db"`), `migrate-all.ts`
  // und jede vitest-Suite dieses Monorepos mit betroffen.
  it("`@grc/db` laesst sich unter Node importieren", async () => {
    const mod = (await import("@grc/db")) as Record<string, unknown>;
    expect(mod.db).toBeDefined();
  });

  it("`@grc/auth/providers` laesst sich unter Node importieren", async () => {
    const mod = (await import("@grc/auth/providers")) as Record<
      string,
      unknown
    >;
    expect(typeof mod.pickAttributableOrgId).toBe("function");
  });

  it("der Guard laeuft nicht in eine unbehandelte Ablehnung", async () => {
    const seen: unknown[] = [];
    const onReject = (r: unknown) => seen.push(r);
    process.on("unhandledRejection", onReject);
    await import("@grc/db");
    // Zwei Ticks: die abgelehnte Zusage des dynamischen Imports wuerde
    // spaetestens hier als unbehandelt gemeldet.
    await new Promise((r) => setTimeout(r, 50));
    process.off("unhandledRejection", onReject);
    expect(seen).toEqual([]);
  });

  it("beide Dateien tragen den Guard und keinen statischen Import", () => {
    for (const rel of GUARDED) {
      const src = readFileSync(path.join(REPO, rel), "utf8");
      expect(src).toMatch(/import\("server-only"\)/);
      // Genau das darf NICHT dastehen — siehe Kopfkommentar.
      expect(src).not.toMatch(/^\s*import\s+["']server-only["']\s*;/m);
    }
  });
});
