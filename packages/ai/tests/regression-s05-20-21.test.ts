// [ARCTOS-FULL-2026-08-31 / WP6] Regressionstests für die beiden
// POSITIVEN Befunde des Streams S05.
//
// S05-20 — pgvector-Mandantentrennung: der `org_id`-Filter ist ein echter
//          PRE-Filter vor `ORDER BY`/`LIMIT`, zusätzlich greift RLS.
// S05-21 — kein XSS-Pfad aus Modellausgaben: kein
//          `dangerouslySetInnerHTML`, kein Markdown-Renderer.
//
// Beide Befunde waren im Audit in Ordnung. Diese Tests halten sie fest,
// damit sie nicht unbemerkt kaputtgehen — genau das ist ihr Zweck. Sie
// prüfen die EIGENSCHAFT, nicht den Wortlaut: der Datenbanktest führt die
// Query wirklich aus, der XSS-Test durchsucht den echten Quellbaum.

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(__dirname, "../../..");

// ────────────────────────────────────────────────────────────────
// S05-21 — kein XSS-Pfad aus Modellausgaben
// ────────────────────────────────────────────────────────────────

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") {
      continue;
    }
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}

describe("S05-21 (Info, positiv) — kein XSS-Pfad aus Modellausgaben", () => {
  const webSrc = join(REPO, "apps/web/src");
  const uiSrc = join(REPO, "packages/ui/src");

  it("kein dangerouslySetInnerHTML im Web-Quellbaum", () => {
    // [ARCTOS-FULL-2026-08-31 / WP11 · S11-11] Testdateien ausgenommen.
    // Der Scanner suchte im GESAMTEN Baum nach der Zeichenkette und schlug
    // fehl, sobald WP12 den Sicherheitstest
    // `apps/web/src/__tests__/security/frontend-invariants.test.ts` anlegte —
    // eine Datei, die dieselbe Eigenschaft prueft und den Namen deshalb
    // zwangslaeufig nennt. Ein Regressionstest, der an einem zweiten
    // Regressionstest scheitert, misst den Dateinamen und nicht die
    // Eigenschaft. Produktivcode bleibt vollstaendig abgedeckt.
    const files = walk(webSrc, [".ts", ".tsx"]).filter(
      (f) => !f.includes("__tests__") && !f.includes("/e2e/"),
    );
    expect(files.length).toBeGreaterThan(100);
    const hits = files.filter((f) =>
      readFileSync(f, "utf8").includes("dangerouslySetInnerHTML"),
    );
    expect(
      hits.map((h) => h.slice(REPO.length + 1)),
      "Modellausgaben werden ausschliesslich als React-Text-Children gerendert. " +
        "Wer dangerouslySetInnerHTML einführt, muss zuerst sanitizen (S05-21).",
    ).toEqual([]);
  });

  it("kein dangerouslySetInnerHTML im UI-Paket", () => {
    const files = walk(uiSrc, [".ts", ".tsx"]);
    const hits = files.filter((f) =>
      readFileSync(f, "utf8").includes("dangerouslySetInnerHTML"),
    );
    expect(hits.map((h) => h.slice(REPO.length + 1))).toEqual([]);
  });

  it("kein Markdown-/HTML-Renderer in den Abhängigkeiten", () => {
    // Der Befund gilt genau so lange, wie es keinen Renderer gibt. Käme
    // einer dazu, müsste er mit Sanitizing kommen — dieser Test zwingt
    // die Entscheidung, statt sie zu übersehen.
    const RENDERERS = [
      "react-markdown",
      "marked",
      "markdown-it",
      "showdown",
      "remark-html",
      "html-react-parser",
    ];
    for (const pkg of ["apps/web/package.json", "packages/ui/package.json"]) {
      const file = join(REPO, pkg);
      if (!existsSync(file)) continue;
      const json = JSON.parse(readFileSync(file, "utf8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = {
        ...(json.dependencies ?? {}),
        ...(json.devDependencies ?? {}),
      };
      for (const r of RENDERERS) {
        expect(
          deps[r],
          `${pkg} zieht ${r} — ohne Sanitizer wird S05-21 damit wieder aktiv.`,
        ).toBeUndefined();
      }
    }
  });

  it("der Copilot speichert Assistentenantworten nicht als markdown", () => {
    // Nebenbefund aus S05-17/S05-21: der Stub schrieb die zurück-
    // gespiegelte Nutzereingabe als contentType "markdown".
    const route = join(
      REPO,
      "apps/web/src/app/api/v1/copilot/conversations/[id]/messages/route.ts",
    );
    const src = readFileSync(route, "utf8");
    expect(src).not.toContain('contentType: "markdown"');
    expect(src).toContain('contentType: "text"');
  });
});

// ────────────────────────────────────────────────────────────────
// S05-20 — pgvector-Mandantentrennung
// ────────────────────────────────────────────────────────────────

const SUGGEST_CONTROLS_ROUTE = join(
  REPO,
  "apps/web/src/app/api/v1/ai/suggest-controls/route.ts",
);

describe("S05-20 (Info, positiv) — pgvector-Pre-Filter, statisch", () => {
  const src = readFileSync(SUGGEST_CONTROLS_ROUTE, "utf8");

  it("filtert org_id auf BEIDEN Seiten des Joins", () => {
    expect(src).toContain("ce.org_id = ${orgId}::uuid");
    expect(src).toContain("c.org_id = ${orgId}::uuid");
  });

  it("hat die org_id-Prädikate VOR ORDER BY / LIMIT", () => {
    const where = src.indexOf("WHERE ce.org_id");
    const order = src.indexOf("ORDER BY ce.embedding");
    // lastIndexOf: "LIMIT 40" kommt auch im erklärenden Kommentar vor.
    const limit = src.lastIndexOf("LIMIT 40");
    expect(where).toBeGreaterThan(-1);
    expect(order).toBeGreaterThan(where);
    expect(limit).toBeGreaterThan(order);
  });

  it("filtert nicht erst nach dem LIMIT auf die Organisation", () => {
    // Ein Post-Filter sähe so aus: rows.filter(r => r.orgId === orgId)
    expect(src).not.toMatch(/\.filter\([^)]*orgId\s*===/);
  });
});

// Datenbankgestützter Gegenbeweis. Läuft nur, wenn eine Datenbank
// bereitsteht; ohne DATABASE_URL wird die Suite übersprungen statt
// falsch-grün zu melden.
const DB_URL = process.env.DATABASE_URL;
const describeDb = DB_URL ? describe : describe.skip;

describeDb("S05-20 (Info, positiv) — pgvector-Pre-Filter gegen die Datenbank", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let sql: any;
  const ORG_A = "aaaaaaaa-0000-4000-8000-000000000001";
  const ORG_B = "bbbbbbbb-0000-4000-8000-000000000002";
  let available = false;

  beforeAll(async () => {
    const postgres = (await import("postgres")).default;
    sql = postgres(DB_URL!, { max: 1, onnotice: () => {} });
    const [{ has }] = await sql`
      SELECT (to_regclass('public.control_embedding') IS NOT NULL) AS has`;
    available = Boolean(has);
    if (!available) return;

    await sql`DELETE FROM control_embedding WHERE org_id IN (${ORG_A}::uuid, ${ORG_B}::uuid)`;
    await sql`DELETE FROM control WHERE org_id IN (${ORG_A}::uuid, ${ORG_B}::uuid)`;

    // Die beiden Fixture-Organisationen werden NICHT geloescht: seit WP2
    // tragen die referenzierenden Tabellen FORCE RLS, und die
    // FK-Integritaetsabfrage von `DELETE FROM organization` scheitert
    // dann mit "referential integrity query gave unexpected result".
    // Idempotentes Anlegen genuegt.
    await sql`INSERT INTO organization (id, name)
              VALUES (${ORG_A}::uuid, 'WP6 Org A'),
                     (${ORG_B}::uuid, 'WP6 Org B')
              ON CONFLICT (id) DO NOTHING`;

    const dim = 1536;
    const near = (i: number) => {
      const v = new Array<number>(dim).fill(0);
      v[0] = 1;
      v[1] = i / 1000;
      return `[${v.join(",")}]`;
    };
    const far = () => {
      const v = new Array<number>(dim).fill(0);
      v[0] = 1;
      v[5] = 0.5;
      return `[${v.join(",")}]`;
    };

    // OrgA bekommt EIN weit entferntes Embedding, OrgB drei nahe. Bei
    // einem Post-Filter nach LIMIT hätte OrgA null Treffer.
    const [a] = await sql`
      INSERT INTO control (org_id, title, control_type)
      VALUES (${ORG_A}::uuid, 'A-Far control', 'preventive')
      RETURNING id`;
    await sql`INSERT INTO control_embedding (org_id, control_id, embedding, content_hash, model)
              VALUES (${ORG_A}::uuid, ${a.id}::uuid, ${far()}::vector, 'h-a', 'wp6-test-model')`;

    for (let i = 0; i < 3; i++) {
      const [b] = await sql`
        INSERT INTO control (org_id, title, control_type)
        VALUES (${ORG_B}::uuid, ${"B-Near control " + i}, 'preventive')
        RETURNING id`;
      await sql`INSERT INTO control_embedding (org_id, control_id, embedding, content_hash, model)
                VALUES (${ORG_B}::uuid, ${b.id}::uuid, ${near(i)}::vector, ${"h-b" + i}, 'wp6-test-model')`;
    }
  }, 60_000);

  afterAll(async () => {
    if (!sql) return;
    try {
      await sql`DELETE FROM control_embedding WHERE org_id IN (${ORG_A}::uuid, ${ORG_B}::uuid)`;
      await sql`DELETE FROM control WHERE org_id IN (${ORG_A}::uuid, ${ORG_B}::uuid)`;
    } catch {
      // Aufräumen ist best effort.
    }
    await sql.end({ timeout: 5 });
  }, 60_000);

  it("liefert für OrgA NUR die eigene Kontrolle, obwohl OrgB näher liegt", async () => {
    if (!available) return;
    const q = new Array<number>(1536).fill(0);
    q[0] = 1;
    q[1] = 0.0005;
    const vec = `[${q.join(",")}]`;

    // Die wörtliche Query aus suggest-controls/route.ts.
    const rows = await sql`
      SELECT c.title, 1 - (ce.embedding <=> ${vec}::vector) AS score
      FROM control_embedding ce
      INNER JOIN control c ON c.id = ce.control_id
      WHERE ce.org_id = ${ORG_A}::uuid
        AND c.org_id = ${ORG_A}::uuid
        AND ce.model = 'wp6-test-model'
        AND c.deleted_at IS NULL
      ORDER BY ce.embedding <=> ${vec}::vector ASC
      LIMIT 40`;

    expect(rows.map((r: { title: string }) => r.title)).toEqual([
      "A-Far control",
    ]);
  }, 60_000);

  it("führt den org_id-Filter unterhalb von Sort/Limit aus (EXPLAIN)", async () => {
    if (!available) return;
    const q = new Array<number>(1536).fill(0);
    q[0] = 1;
    const vec = `[${q.join(",")}]`;

    const plan = await sql`
      EXPLAIN
      SELECT c.title
      FROM control_embedding ce
      INNER JOIN control c ON c.id = ce.control_id
      WHERE ce.org_id = ${ORG_A}::uuid
        AND c.org_id = ${ORG_A}::uuid
      ORDER BY ce.embedding <=> ${vec}::vector ASC
      LIMIT 40`;

    const text = plan
      .map((r: Record<string, string>) => Object.values(r)[0])
      .join("\n");

    const limitAt = text.indexOf("Limit");
    const filterAt = text.search(/org_id/);
    expect(limitAt).toBeGreaterThanOrEqual(0);
    expect(filterAt).toBeGreaterThan(limitAt); // Filter tiefer im Plan
  }, 60_000);

  it("hat RLS mit FORCE auf control_embedding", async () => {
    if (!available) return;
    const [row] = await sql`
      SELECT relrowsecurity, relforcerowsecurity
        FROM pg_class WHERE relname = 'control_embedding'`;
    expect(row.relrowsecurity).toBe(true);
    expect(row.relforcerowsecurity).toBe(true);

    const policies = await sql`
      SELECT policyname FROM pg_policies
       WHERE tablename = 'control_embedding'`;
    expect(policies.length).toBeGreaterThan(0);
  }, 60_000);
});
