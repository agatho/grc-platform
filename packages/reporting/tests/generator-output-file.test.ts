// Where and how ReportGenerator puts the generated file on disk.
//
// The write path (`fs.mkdir` + `fs.writeFile` in generator.ts step 6) had
// no test at all. It wrote into a hard-coded `/tmp/arctos-reports` and let
// the process umask decide the permissions, so on a shared host the report
// — which carries whatever the template selected out of the tenant's data
// — was world-readable. The file name already contains the generation
// log's `gen_random_uuid()` primary key, so nothing here is about
// guessability; it is about who may read the file once it exists.
//
// No database is involved: `@grc/db` and `drizzle-orm` are mocked the same
// way section-data-fetcher.test.ts does it, and the PDF renderer is
// stubbed so the assertions are about the file, not about pdfkit.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const TEMPLATE_ID = "22222222-2222-4222-8222-222222222222";
const LOG_ID = "33333333-3333-4333-8333-333333333333";

/** Results handed to consecutive `db.select()…limit()` calls. */
let selectResults: unknown[][] = [];

const selectChain: Record<string, unknown> = {};
for (const method of ["from", "where", "leftJoin", "orderBy", "offset"]) {
  selectChain[method] = vi.fn(() => selectChain);
}
selectChain.limit = vi.fn(() => Promise.resolve(selectResults.shift() ?? []));

vi.mock("@grc/db", () => ({
  db: {
    select: vi.fn(() => selectChain),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve(undefined)) })),
    })),
  },
  reportTemplate: {},
  reportGenerationLog: {},
  organization: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
}));

vi.mock("../src/renderers/pdfkit-renderer", () => ({
  renderReportDocumentPdf: vi.fn(() =>
    Promise.resolve(Buffer.from("%PDF-1.4 stub\n%%EOF\n")),
  ),
}));

const template = {
  id: TEMPLATE_ID,
  orgId: ORG_ID,
  name: "Quartalsbericht",
  sectionsJson: [],
  brandingJson: null,
};

/** Fresh module instance — REPORT_OUTPUT_DIR is resolved at import time. */
async function generateOnce(): Promise<string> {
  selectResults = [[template], [{ id: ORG_ID, name: "Meridian Holdings" }]];
  vi.resetModules();
  const { ReportGenerator } = await import("../src/generator");
  const result = await new ReportGenerator().generate(
    LOG_ID,
    ORG_ID,
    TEMPLATE_ID,
    {},
    "pdf",
  );
  return result.filePath;
}

const written: string[] = [];
const overrideDirs: string[] = [];

afterEach(async () => {
  for (const file of written.splice(0)) {
    await fs.rm(file, { force: true });
  }
  for (const dir of overrideDirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  delete process.env.REPORT_OUTPUT_DIR;
});

beforeEach(() => {
  delete process.env.REPORT_OUTPUT_DIR;
});

describe("ReportGenerator output file", () => {
  it("writes below os.tmpdir(), not a hard-coded /tmp", async () => {
    const filePath = await generateOnce();
    written.push(filePath);

    expect(path.dirname(filePath)).toBe(
      path.join(os.tmpdir(), "arctos-reports"),
    );
    await expect(fs.access(filePath)).resolves.toBeUndefined();
  });

  it("honours the REPORT_OUTPUT_DIR override", async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "arctos-reports-t-"));
    overrideDirs.push(base);
    const target = path.join(base, "nested");
    process.env.REPORT_OUTPUT_DIR = target;

    const filePath = await generateOnce();
    expect(path.dirname(filePath)).toBe(target);
    await expect(fs.access(filePath)).resolves.toBeUndefined();
  });

  it.skipIf(process.platform === "win32")(
    "creates the file 0600 inside a 0700 directory",
    async () => {
      // POSIX only: Windows ignores the `mode` argument of mkdir/writeFile
      // and reports 0666/0777 back from stat, so asserting there would test
      // the platform rather than the code. Runs in CI, which is Linux.
      const base = await fs.mkdtemp(
        path.join(os.tmpdir(), "arctos-reports-t-"),
      );
      overrideDirs.push(base);
      const target = path.join(base, "nested");
      process.env.REPORT_OUTPUT_DIR = target;

      const filePath = await generateOnce();

      const fileStat = await fs.stat(filePath);
      expect(fileStat.mode & 0o777).toBe(0o600);
      const dirStat = await fs.stat(target);
      expect(dirStat.mode & 0o777).toBe(0o700);
    },
  );
});
