// GET /api/v1/documents/:id/download — controlled-copy watermarking.
//
// Contract under test:
//   - published PDFs are watermarked BY DEFAULT (grows the PDF, sets
//     X-Controlled-Copy: watermarked, writes the audit-log entry)
//   - draft PDFs are served raw unless ?watermarked=1 forces the stamp
//   - ?raw=1 requires admin/quality_manager (403 otherwise)
//   - non-PDFs are never modified (X-Controlled-Copy: none)
//   - X-File-SHA256 is only sent for unmodified bytes

import { describe, it, expect, vi, beforeEach } from "vitest";
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
vi.mock("@grc/shared/lib/file-storage", () => ({
  getFileStorage: () => ({ get: storageGet }),
  FileNotFoundInStorageError: class extends Error {},
}));

const recordControlledCopyDownload = vi.fn(
  async (..._args: unknown[]) => undefined,
);
vi.mock("@/lib/documents/controlled-copy", () => ({
  recordControlledCopyDownload: (...args: unknown[]) =>
    recordControlledCopyDownload(...args),
}));

import { GET } from "../../app/api/v1/documents/[id]/download/route";

async function makeTestPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  return Buffer.from(await doc.save());
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
    fileSha256: "a".repeat(64),
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
    selectQueue.push([docRow()]); // document
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
    const [, info] = recordControlledCopyDownload.mock.calls[0] as unknown as [
      unknown,
      { versionLabel: string; documentId: string },
    ];
    expect(info.versionLabel).toBe("3.0");
    expect(info.documentId).toBe("doc-1");
  });

  it("serves draft PDFs unmodified (no watermark, hash header present)", async () => {
    selectQueue.push([docRow({ status: "draft" })]);

    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Controlled-Copy")).toBe("none");
    expect(res.headers.get("X-File-SHA256")).toBe("a".repeat(64));
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(originalPdf)).toBe(true);
    expect(recordControlledCopyDownload).not.toHaveBeenCalled();
  });

  it("?watermarked=1 forces the stamp for draft PDFs", async () => {
    selectQueue.push([docRow({ status: "draft" })]);
    selectQueue.push([{ versionLabel: "0.2" }]);

    const res = await call("?watermarked=1");
    expect(res.headers.get("X-Controlled-Copy")).toBe("watermarked");
    expect(recordControlledCopyDownload).toHaveBeenCalledTimes(1);
  });

  it("?raw=1 is forbidden for regular users", async () => {
    selectQueue.push([docRow()]);

    const res = await call("?raw=1");
    expect(res.status).toBe(403);
    expect(recordControlledCopyDownload).not.toHaveBeenCalled();
  });

  it("?raw=1 returns original bytes for admins", async () => {
    sessionRoles = [{ orgId: "org-1", role: "admin" }];
    selectQueue.push([docRow()]);

    const res = await call("?raw=1");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Controlled-Copy")).toBe("none");
    expect(res.headers.get("X-File-SHA256")).toBe("a".repeat(64));
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(originalPdf)).toBe(true);
    expect(recordControlledCopyDownload).not.toHaveBeenCalled();
  });

  it("never modifies non-PDF files", async () => {
    const svg = Buffer.from("<svg/>");
    storageGet.mockResolvedValue(svg);
    selectQueue.push([
      docRow({ mimeType: "image/svg+xml", fileName: "logo.svg" }),
    ]);

    const res = await call();
    expect(res.headers.get("X-Controlled-Copy")).toBe("none");
    // SVG-XSS hardening stays intact
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(recordControlledCopyDownload).not.toHaveBeenCalled();
  });

  it("serves original bytes with X-Controlled-Copy: error when stamping fails", async () => {
    const corrupt = Buffer.from("%PDF-1.4 corrupt garbage");
    storageGet.mockResolvedValue(corrupt);
    selectQueue.push([docRow()]);
    selectQueue.push([{ versionLabel: "3.0" }]);

    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Controlled-Copy")).toBe("error");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(corrupt)).toBe(true);
    expect(recordControlledCopyDownload).not.toHaveBeenCalled();
  });
});
