// GET /api/v1/documents/:id/download — controlled-copy watermarking.
//
// Contract under test (rewritten for ARCTOS-FULL-2026-08-31 / WP7 —
// the previous version pinned the DEFECTIVE contract as intended
// behaviour, which is why the finding quotes it verbatim):
//   - PDFs of RELEASED documents (approved/published/archived/expired)
//     are watermarked by default (#S06-07)
//   - draft/in_review PDFs are served raw unless ?watermarked=1
//   - ?raw=1 requires admin/quality_manager (403 otherwise)
//   - non-PDFs are never modified (X-Controlled-Copy: none)
//   - X-File-SHA256 is only sent for unmodified bytes
//   - a required watermark that cannot be applied REFUSES the download
//     with 422 and writes an audit entry (#S06-06) — it used to serve
//     the unmarked original with no log at all
//   - EVERY issuance is audit-logged, ?raw=1 included (#S06-08)
//   - the bytes coming out of storage are re-hashed against the stored
//     SHA-256 before anything is served (#S06-09)

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";

// Rows returned by consecutive db.select() calls (FIFO).
const selectQueue: unknown[][] = [];

vi.mock("@grc/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(selectQueue.shift() ?? []),
      }),
    }),
  },
  document: {},
  documentVersion: {},
  documentFile: {},
  auditLog: {},
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return { eq: noop, and: noop, isNull: noop, sql: noop };
});

// Role gate: the mock honors the session's roles like the real one.
vi.mock("@grc/auth", () => ({
  requireModule: vi.fn(async () => undefined),
  requireRole:
    (...allowed: string[]) =>
    (
      session: { user: { roles: { orgId: string; role: string }[] } },
      orgId: string,
    ) => {
      const roles = session.user.roles
        .filter((r) => r.orgId === orgId)
        .map((r) => r.role);
      return allowed.some((r) => roles.includes(r))
        ? null
        : new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
          });
    },
}));

let sessionRoles: { orgId: string; role: string }[] = [];

vi.mock("@/lib/api", () => ({
  withAuth: vi.fn(async () => ({
    session: {
      user: {
        id: "user-1",
        name: "Max Mustermann",
        email: "max@example.com",
        get roles() {
          return sessionRoles;
        },
      },
    },
    orgId: "org-1",
    userId: "user-1",
  })),
}));

const storageGet = vi.fn();
// #S06-10: orgScopedStorage is kept REAL here, so a key outside the
// org prefix would still throw in these tests.
vi.mock("@grc/shared/lib/file-storage", async () => {
  const actual = await vi.importActual<
    typeof import("@grc/shared/lib/file-storage")
  >("@grc/shared/lib/file-storage");
  return {
    ...actual,
    getFileStorage: () => ({ get: storageGet }),
  };
});

const recordControlledCopyDownload = vi.fn(
  async (..._args: unknown[]) => undefined,
);
vi.mock("@/lib/documents/controlled-copy", () => ({
  recordControlledCopyDownload: (...args: unknown[]) =>
    recordControlledCopyDownload(...args),
}));

import { GET } from "../../app/api/v1/documents/[id]/download/route";

/** The audit PoC: a PDF protected with an OWNER password only. It opens
 *  in every reader without a prompt, and pdf-lib refuses to parse it —
 *  this is the input that switched the whole control off. Checked in as
 *  a fixture so the test does not depend on the audit workspace. */
const POC_FIXTURE = new URL(
  "../fixtures/owner-password-only.pdf",
  import.meta.url,
).pathname;
const POC_EVIDENCE = "/work/audit/evidence/S06/poc_owner_pw_only.pdf";
const POC_PATH = existsSync(POC_FIXTURE) ? POC_FIXTURE : POC_EVIDENCE;

async function makeTestPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  return Buffer.from(await doc.save());
}

function sha(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function docRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    orgId: "org-1",
    title: "IS-Richtlinie",
    status: "published",
    currentVersion: 3,
    publishedAt: new Date(Date.UTC(2026, 0, 10)),
    fileName: "richtlinie.pdf",
    filePath: "org-1/doc-1/abc-richtlinie.pdf",
    mimeType: "application/pdf",
    fileSha256: null,
    deletedAt: null,
    ...overrides,
  };
}

function call(query = "") {
  return GET(
    new Request(`http://localhost/api/v1/documents/doc-1/download${query}`),
    { params: Promise.resolve({ id: "doc-1" }) },
  );
}

/** The outcome recorded on the Nth call to the audit helper. */
function auditInfo(n = 0): Record<string, unknown> | undefined {
  const c = recordControlledCopyDownload.mock.calls[n] as
    [unknown, Record<string, unknown>] | undefined;
  return c?.[1];
}

describe("documents/[id]/download controlled copies", () => {
  let originalPdf: Buffer;

  beforeEach(async () => {
    selectQueue.length = 0;
    sessionRoles = [{ orgId: "org-1", role: "viewer" }];
    recordControlledCopyDownload.mockClear();
    originalPdf = await makeTestPdf();
    storageGet.mockReset();
    storageGet.mockResolvedValue(originalPdf);
  });

  it("watermarks published PDFs by default + writes the audit entry", async () => {
    selectQueue.push([docRow({ fileSha256: sha(originalPdf) })]); // document
    selectQueue.push([{ versionLabel: "3.0" }]); // current version

    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Controlled-Copy")).toBe("watermarked");
    // hash header only applies to unmodified bytes
    expect(res.headers.get("X-File-SHA256")).toBeNull();

    const body = Buffer.from(await res.arrayBuffer());
    expect(body.length).toBeGreaterThan(originalPdf.length);
    // still a loadable PDF
    const reloaded = await PDFDocument.load(new Uint8Array(body));
    expect(reloaded.getPageCount()).toBe(1);

    expect(recordControlledCopyDownload).toHaveBeenCalledTimes(1);
    const info = auditInfo(0)!;
    expect(info.versionLabel).toBe("3.0");
    expect(info.documentId).toBe("doc-1");
    expect(info.outcome).toBe("watermarked");
  });

  it("serves draft PDFs unmodified (no watermark, hash header present)", async () => {
    selectQueue.push([
      docRow({ status: "draft", fileSha256: sha(originalPdf) }),
    ]);

    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Controlled-Copy")).toBe("none");
    expect(res.headers.get("X-File-SHA256")).toBe(sha(originalPdf));
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(originalPdf)).toBe(true);
    // #S06-08: even an unmarked, unprivileged download is recorded now.
    expect(auditInfo(0)!.outcome).toBe("unmarked");
  });

  // #S06-07 — archived and expired revisions used to leave the DMS
  // unmarked, which is exactly where an unmarked printout does the most
  // damage: nothing on the page says the copy is void.
  it.each(["archived", "expired", "approved"])(
    "watermarks %s revisions too (S06-07)",
    async (status) => {
      selectQueue.push([docRow({ status, fileSha256: sha(originalPdf) })]);
      selectQueue.push([{ versionLabel: "2.0" }]);

      const res = await call();
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Controlled-Copy")).toBe("watermarked");
      expect(auditInfo(0)!.outcome).toBe("watermarked");
    },
  );

  it("?watermarked=1 forces the stamp for draft PDFs", async () => {
    selectQueue.push([
      docRow({ status: "draft", fileSha256: sha(originalPdf) }),
    ]);
    selectQueue.push([{ versionLabel: "0.2" }]);

    const res = await call("?watermarked=1");
    expect(res.headers.get("X-Controlled-Copy")).toBe("watermarked");
    expect(auditInfo(0)!.outcome).toBe("watermarked");
  });

  it("?raw=1 is forbidden for regular users", async () => {
    selectQueue.push([docRow({ fileSha256: sha(originalPdf) })]);

    const res = await call("?raw=1");
    expect(res.status).toBe(403);
    expect(recordControlledCopyDownload).not.toHaveBeenCalled();
  });

  // #S06-08 — the evidence logic used to be inverted: the CONTROLLED
  // copy was demonstrable, the uncontrolled original was not. An admin
  // could pull the pristine version of every released policy without
  // leaving a single trace.
  it("?raw=1 returns original bytes for admins AND records the access (S06-08)", async () => {
    sessionRoles = [{ orgId: "org-1", role: "admin" }];
    selectQueue.push([docRow({ fileSha256: sha(originalPdf) })]);

    const res = await call("?raw=1");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Controlled-Copy")).toBe("none");
    expect(res.headers.get("X-File-SHA256")).toBe(sha(originalPdf));
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(originalPdf)).toBe(true);

    expect(recordControlledCopyDownload).toHaveBeenCalledTimes(1);
    const info = auditInfo(0)!;
    expect(info.outcome).toBe("uncontrolled_raw");
    expect(info.served).toBe(true);
  });

  it("never modifies non-PDF files", async () => {
    const svg = Buffer.from("<svg/>");
    storageGet.mockResolvedValue(svg);
    selectQueue.push([
      docRow({
        mimeType: "image/svg+xml",
        fileName: "logo.svg",
        fileSha256: sha(svg),
      }),
    ]);

    const res = await call();
    expect(res.headers.get("X-Controlled-Copy")).toBe("none");
    // SVG-XSS hardening stays intact
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(auditInfo(0)!.outcome).toBe("unmarked");
  });

  // ── #S06-06 (High) ────────────────────────────────────────────────
  // The audit reproduced this with the PoC file below: a PDF carrying
  // only an owner password (permissions protection — opens in every
  // reader without a prompt) made stampControlledCopy throw, the route
  // served the ORIGINAL bytes with X-Controlled-Copy: error, and
  // recordControlledCopyDownload was never called. Any user with upload
  // rights could switch the control off for every user with DMS access,
  // and the download left no trace at all.
  it("REFUSES the download when a required watermark cannot be applied (S06-06, PoC file)", async () => {
    const poc = readFileSync(POC_PATH);
    storageGet.mockResolvedValue(poc);
    selectQueue.push([docRow({ fileSha256: sha(poc) })]);
    selectQueue.push([{ versionLabel: "3.0" }]);

    const res = await call();

    // Not served at all — and definitely not as unmarked original bytes.
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("watermark_required");
    expect(body.reason).toBe("encrypted");
    expect(res.headers.get("X-Controlled-Copy")).toBe("refused");

    // …and the attempt IS logged.
    expect(recordControlledCopyDownload).toHaveBeenCalledTimes(1);
    const info = auditInfo(0)!;
    expect(info.outcome).toBe("watermark_failed");
    expect(info.failureReason).toBe("encrypted");
    expect(info.served).toBe(false);
  });

  it("refuses and logs for a structurally broken PDF as well (S06-06)", async () => {
    const corrupt = Buffer.from("%PDF-1.4 corrupt garbage");
    storageGet.mockResolvedValue(corrupt);
    selectQueue.push([docRow({ fileSha256: sha(corrupt) })]);
    selectQueue.push([{ versionLabel: "3.0" }]);

    const res = await call();
    expect(res.status).toBe(422);
    expect(auditInfo(0)!.outcome).toBe("watermark_failed");
  });

  // ── #S06-09 ───────────────────────────────────────────────────────
  it("refuses to serve bytes that do not match the recorded SHA-256 (S06-09)", async () => {
    // The DB says one thing, the object store returns another — the
    // exact effect of an unauthenticated write into the bucket.
    selectQueue.push([docRow({ fileSha256: "a".repeat(64) })]);

    const res = await call();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("storage_integrity_mismatch");
    expect(body.actualSha256).toBe(sha(originalPdf));

    expect(recordControlledCopyDownload).toHaveBeenCalledTimes(1);
    const info = auditInfo(0)!;
    expect(String(info.failureReason)).toContain("storage_hash_mismatch");
    expect(info.served).toBe(false);
  });

  it("still serves documents that never had a recorded hash", async () => {
    selectQueue.push([docRow({ status: "draft", fileSha256: null })]);
    const res = await call();
    expect(res.status).toBe(200);
  });
});
