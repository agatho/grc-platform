// POST /api/v1/documents/:id/upload — the released-version guard.
//
// ── #S06-01 (ARCTOS-FULL-2026-08-31, High) ──────────────────────────
// Reproduced by the audit: the route overwrote document_version.file_*
// of the CURRENT version in place. On a published document the release
// record of v2.0 (valid_from, approval history, all acknowledgments)
// stayed put while a different file moved in behind it — no status
// check, no four-eyes, no new version, no legal-hold check. The writes
// also ran on the bare `db` handle, so app.current_user_id was unset and
// the DB audit trigger recorded the hash swap with a NULL actor
// (evidence/S06/audit_actor_null_repro.txt).
//
// What this file asserts:
//   1. an upload against a released document is REFUSED (409)
//   2. an upload under legal hold is REFUSED (409)
//   3. a draft upload whose current version already carries a file
//      creates a NEW version instead of rewriting the snapshot
//   4. every write goes through withAuditContext, i.e. the audit entry
//      carries the actor — the second half of the finding
//   5. #S04-06/#S06-21: the magic bytes decide, not the client header
//   6. #S06-06: an unstampable PDF is rejected at upload time

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { PDFDocument } from "pdf-lib";

const POC_FIXTURE = new URL(
  "../fixtures/owner-password-only.pdf",
  import.meta.url,
).pathname;
const POC_PATH = existsSync(POC_FIXTURE)
  ? POC_FIXTURE
  : "/work/audit/evidence/S06/poc_owner_pw_only.pdf";

const selectQueue: unknown[][] = [];
/** Rows the transaction's own select() returns (current version). */
const txSelectQueue: unknown[][] = [];
const inserted: Array<{ table: string; values: unknown }> = [];
const updated: Array<{ table: string; values: unknown }> = [];

function tableName(t: unknown): string {
  return (t as { __name?: string })?.__name ?? "unknown";
}

const tx = {
  select: () => ({
    from: (t: unknown) => ({
      where: () => {
        void t;
        return Promise.resolve(txSelectQueue.shift() ?? []);
      },
    }),
  }),
  insert: (t: unknown) => ({
    values: (v: unknown) => {
      inserted.push({ table: tableName(t), values: v });
      return {
        returning: () => Promise.resolve([{ id: "file-1", ...(v as object) }]),
      };
    },
  }),
  update: (t: unknown) => ({
    set: (v: unknown) => {
      updated.push({ table: tableName(t), values: v });
      return {
        where: () => ({
          returning: () =>
            Promise.resolve([
              {
                id: "doc-1",
                fileName: "neu.pdf",
                fileSize: 1,
                mimeType: "application/pdf",
              },
            ]),
          then: (r: (x: unknown) => unknown) =>
            Promise.resolve(undefined).then(r),
        }),
      };
    },
  }),
};

vi.mock("@grc/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(selectQueue.shift() ?? []),
      }),
    }),
  },
  document: { __name: "document" },
  documentVersion: { __name: "document_version" },
  documentFile: { __name: "document_file" },
  auditLog: { __name: "audit_log" },
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return { eq: noop, and: noop, isNull: noop, sql: noop };
});

vi.mock("@grc/auth", () => ({
  requireModule: vi.fn(async () => undefined),
}));

/** Records whether a write ran inside withAuditContext — the actor fix. */
const auditContextCalls: unknown[] = [];
vi.mock("@/lib/api", () => ({
  withAuth: vi.fn(async () => ({
    session: {
      user: {
        id: "user-1",
        name: "Max Mustermann",
        email: "max@example.com",
        roles: [{ orgId: "org-1", role: "process_owner" }],
      },
    },
    orgId: "org-1",
    userId: "user-1",
  })),
  withAuditContext: vi.fn(
    async (
      ctx: unknown,
      fn: (t: unknown) => Promise<unknown>,
      annotation?: unknown,
    ) => {
      auditContextCalls.push(annotation);
      return fn(tx);
    },
  ),
}));

const storagePut = vi.fn(async () => undefined);
vi.mock("@grc/shared/lib/file-storage", async () => {
  const actual = await vi.importActual<
    typeof import("@grc/shared/lib/file-storage")
  >("@grc/shared/lib/file-storage");
  return {
    ...actual,
    getFileStorage: () => ({
      put: storagePut,
      get: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    }),
  };
});

vi.mock("@grc/shared/lib/clamav", () => ({
  scanBuffer: vi.fn(async () => ({ status: "skipped" })),
  isClamAvFailClosed: () => false,
  isClamAvRequired: () => false,
}));

vi.mock("@/lib/documents/extract-text", () => ({
  extractFileText: vi.fn(async () => null),
}));

const createdVersions: unknown[] = [];
vi.mock("@/lib/document-versioning", () => ({
  createDocumentVersion: vi.fn(async (_tx: unknown, params: unknown) => {
    createdVersions.push(params);
    return {
      id: "version-new",
      versionNumber: 4,
      versionMajor: 2,
      versionMinor: 1,
      versionLabel: "2.1",
      validFrom: new Date(),
    };
  }),
}));

import { POST } from "../../app/api/v1/documents/[id]/upload/route";

async function pdfFile(name = "neu.pdf"): Promise<File> {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  const bytes = Buffer.from(await doc.save());
  return new File([bytes], name, { type: "application/pdf" });
}

function docRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    orgId: "org-1",
    title: "IS-Richtlinie",
    status: "draft",
    content: null,
    legalHold: false,
    currentVersion: 3,
    deletedAt: null,
    ...overrides,
  };
}

async function call(file: File) {
  const form = new FormData();
  form.append("file", file);
  return POST(
    new Request("http://localhost/api/v1/documents/doc-1/upload", {
      method: "POST",
      body: form,
    }),
    { params: Promise.resolve({ id: "doc-1" }) },
  );
}

describe("documents/[id]/upload — released versions are immutable (S06-01)", () => {
  beforeEach(() => {
    selectQueue.length = 0;
    txSelectQueue.length = 0;
    inserted.length = 0;
    updated.length = 0;
    createdVersions.length = 0;
    auditContextCalls.length = 0;
    storagePut.mockClear();
  });

  // The reproduced attack: the author of a published document uploads a
  // changed PDF and the current, released version silently points at it.
  it.each(["approved", "published", "archived", "expired"])(
    "refuses an upload against a %s document",
    async (status) => {
      selectQueue.push([docRow({ status })]);
      const res = await call(await pdfFile());

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe("document_released");
      // Nothing was written anywhere.
      expect(storagePut).not.toHaveBeenCalled();
      expect(updated).toHaveLength(0);
      expect(inserted).toHaveLength(0);
    },
  );

  it("refuses an upload while the document is under legal hold", async () => {
    selectQueue.push([docRow({ legalHold: true })]);
    const res = await call(await pdfFile());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("legal_hold");
    expect(storagePut).not.toHaveBeenCalled();
  });

  it("fills an EMPTY version snapshot in place (no history to overwrite)", async () => {
    selectQueue.push([docRow({ status: "draft" })]);
    txSelectQueue.push([{ id: "version-1", filePath: null, versionNumber: 3 }]);

    const res = await call(await pdfFile());
    expect(res.status).toBe(201);
    // The existing version row was completed, not replaced.
    expect(createdVersions).toHaveLength(0);
    expect(updated.some((u) => u.table === "document_version")).toBe(true);
  });

  it("creates a NEW version instead of rewriting a snapshot that already has a file", async () => {
    selectQueue.push([docRow({ status: "in_review" })]);
    txSelectQueue.push([
      {
        id: "version-1",
        filePath: "org-1/doc-1/old-richtlinie.pdf",
        versionNumber: 3,
      },
    ]);

    const res = await call(await pdfFile());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.newVersionLabel).toBe("2.1");

    // The decisive assertion: the old snapshot was NOT updated.
    expect(createdVersions).toHaveLength(1);
    expect(updated.some((u) => u.table === "document_version")).toBe(false);
  });

  // Second half of the finding: the actor in the audit log.
  it("performs every write inside withAuditContext so the actor is recorded", async () => {
    selectQueue.push([docRow({ status: "draft" })]);
    txSelectQueue.push([{ id: "version-1", filePath: null, versionNumber: 3 }]);

    const res = await call(await pdfFile());
    expect(res.status).toBe(201);
    // Exactly one audit-scoped transaction covering document_file,
    // document and document_version — previously three bare db writes.
    expect(auditContextCalls).toHaveLength(1);
    expect(auditContextCalls[0]).toMatchObject({
      actionDetail: expect.stringContaining("file_uploaded"),
    });
    expect(inserted.some((i) => i.table === "document_file")).toBe(true);
    expect(updated.some((u) => u.table === "document")).toBe(true);
  });

  // #S04-06 / #S06-21
  it("rejects content whose magic bytes contradict the declared type", async () => {
    selectQueue.push([docRow({ status: "draft" })]);
    // A real PNG signature, declared as application/pdf. Storing it as
    // the declared type is what let `isPdf` on the download path be
    // wrong; storing it silently as PNG would hide the lie.
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 0),
    ]);
    const fake = new File([png], "x.pdf", { type: "application/pdf" });
    const res = await call(fake);
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.code).toBe("content_type_mismatch");
    expect(body.detectedMime).toBe("image/png");
    expect(storagePut).not.toHaveBeenCalled();
  });

  it("rejects a real PDF declared as text/plain (S06-21 residual case)", async () => {
    selectQueue.push([docRow({ status: "draft" })]);
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    const bytes = Buffer.from(await doc.save());
    const disguised = new File([bytes], "policy.txt", { type: "text/plain" });
    const res = await call(disguised);
    // Stored as text/plain it would have been served — and, more to the
    // point, never watermarked, because isPdf reads the stored type.
    expect(res.status).toBe(415);
    expect((await res.json()).detectedMime).toBe("application/pdf");
  });

  // #S06-06 — reject where the uploader can still fix it.
  it("rejects a PDF that could never be watermarked", async () => {
    selectQueue.push([docRow({ status: "draft" })]);
    const poc = new File([readFileSync(POC_PATH)], "geschuetzt.pdf", {
      type: "application/pdf",
    });
    const res = await call(poc);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("pdf_not_stampable");
    expect(body.reason).toBe("encrypted");
    expect(storagePut).not.toHaveBeenCalled();
    // The rejection itself is an audit event.
    expect(inserted.some((i) => i.table === "audit_log")).toBe(true);
  });
});
