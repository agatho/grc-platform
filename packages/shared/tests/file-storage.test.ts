// FileStorage abstraction (DMS storage backends).
//
// - LocalFsStorage: full roundtrip against a temp directory + key
//   compatibility with the historical {orgId}/{docId}/{name} layout
// - S3Storage: URL building (path-style for MinIO), SigV4-signed
//   requests with real payload hashes, 404 semantics — via mocked fetch
// - Factory: env-driven backend selection with lazy validation

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  LocalFsStorage,
  S3Storage,
  FileNotFoundInStorageError,
  getFileStorage,
  __resetFileStorageCache,
} from "../src/lib/file-storage";
import { sha256Hex } from "../src/lib/sigv4";

describe("LocalFsStorage", () => {
  let dir: string;
  let storage: LocalFsStorage;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "grc-storage-"));
    storage = new LocalFsStorage(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("roundtrips put → exists → get → delete", async () => {
    const key = "org-1/doc-1/abc-file.pdf";
    const data = Buffer.from("controlled document content");

    await storage.put(key, data);
    expect(await storage.exists(key)).toBe(true);
    expect((await storage.get(key)).equals(data)).toBe(true);

    expect(await storage.delete(key)).toBe(true);
    expect(await storage.exists(key)).toBe(false);
    expect(await storage.delete(key)).toBe(false); // idempotent
  });

  it("reads pre-existing files written with plain fs (backward compat)", async () => {
    // Simulates files uploaded before the abstraction existed: the
    // file_path column value is the storage key.
    const legacyKey = "org-2/doc-9/legacy.txt";
    await mkdir(join(dir, "org-2/doc-9"), { recursive: true });
    await writeFile(join(dir, legacyKey), "legacy bytes");

    expect((await storage.get(legacyKey)).toString()).toBe("legacy bytes");
  });

  it("throws FileNotFoundInStorageError for missing keys", async () => {
    await expect(storage.get("nope/missing.bin")).rejects.toBeInstanceOf(
      FileNotFoundInStorageError,
    );
  });

  it("refuses path traversal keys", async () => {
    await expect(storage.get("../../etc/passwd")).rejects.toThrow(
      /path traversal/,
    );
    await expect(
      storage.put("a/../../outside.txt", Buffer.from("x")),
    ).rejects.toThrow(/path traversal/);
  });

  it("writes bytes under the base directory exactly at the key path", async () => {
    await storage.put("o/d/f.bin", Buffer.from([1, 2, 3]));
    const onDisk = await readFile(join(dir, "o/d/f.bin"));
    expect([...onDisk]).toEqual([1, 2, 3]);
  });
});

interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: Uint8Array;
}

function mockFetch(
  responder: (req: RecordedRequest) => {
    status: number;
    body?: Buffer | string;
  },
): { fetchFn: typeof fetch; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  const fetchFn = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const recorded: RecordedRequest = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body as Uint8Array | undefined,
    };
    requests.push(recorded);
    const { status, body } = responder(recorded);
    return new Response(
      body !== undefined ? new Uint8Array(Buffer.from(body)) : null,
      { status },
    );
  }) as typeof fetch;
  return { fetchFn, requests };
}

describe("S3Storage", () => {
  const baseCfg = {
    endpoint: "http://127.0.0.1:9000",
    region: "us-east-1",
    bucket: "arctos-docs",
    accessKeyId: "minio",
    secretAccessKey: "minio123",
    forcePathStyle: true,
  };

  it("builds path-style URLs for MinIO", () => {
    const s3 = new S3Storage(baseCfg);
    expect(s3.objectUrl("org/doc/f.pdf").toString()).toBe(
      "http://127.0.0.1:9000/arctos-docs/org/doc/f.pdf",
    );
  });

  it("builds virtual-hosted AWS URLs without endpoint", () => {
    const s3 = new S3Storage({ ...baseCfg, endpoint: undefined, forcePathStyle: false });
    expect(s3.objectUrl("k.txt").toString()).toBe(
      "https://arctos-docs.s3.us-east-1.amazonaws.com/k.txt",
    );
  });

  it("PUT signs the real payload hash and sends the body", async () => {
    const { fetchFn, requests } = mockFetch(() => ({ status: 200 }));
    const s3 = new S3Storage({ ...baseCfg, fetchFn });
    const data = Buffer.from("pdf bytes");

    await s3.put("org/doc/a.pdf", data, { contentType: "application/pdf" });

    expect(requests).toHaveLength(1);
    const req = requests[0];
    expect(req.method).toBe("PUT");
    expect(req.url).toBe("http://127.0.0.1:9000/arctos-docs/org/doc/a.pdf");
    expect(req.headers["x-amz-content-sha256"]).toBe(sha256Hex(data));
    expect(req.headers["x-amz-content-sha256"]).not.toBe("UNSIGNED-PAYLOAD");
    expect(req.headers["content-type"]).toBe("application/pdf");
    expect(req.headers["Authorization"]).toMatch(
      /^AWS4-HMAC-SHA256 Credential=minio\/\d{8}\/us-east-1\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
    expect(Buffer.from(req.body ?? []).toString()).toBe("pdf bytes");
  });

  it("GET returns the body and maps 404 to FileNotFoundInStorageError", async () => {
    const { fetchFn } = mockFetch((req) =>
      req.url.endsWith("/missing.bin")
        ? { status: 404, body: "NoSuchKey" }
        : { status: 200, body: "object-bytes" },
    );
    const s3 = new S3Storage({ ...baseCfg, fetchFn });

    expect((await s3.get("there.bin")).toString()).toBe("object-bytes");
    await expect(s3.get("missing.bin")).rejects.toBeInstanceOf(
      FileNotFoundInStorageError,
    );
  });

  it("delete/exists map S3 status codes", async () => {
    const { fetchFn } = mockFetch((req) => {
      if (req.method === "DELETE") return { status: 204 };
      return req.url.endsWith("/there.bin")
        ? { status: 200 }
        : { status: 404 };
    });
    const s3 = new S3Storage({ ...baseCfg, fetchFn });

    expect(await s3.exists("there.bin")).toBe(true);
    expect(await s3.exists("gone.bin")).toBe(false);
    expect(await s3.delete("there.bin")).toBe(true);
  });

  it("surfaces non-404 errors with status + body context", async () => {
    const { fetchFn } = mockFetch(() => ({
      status: 403,
      body: "SignatureDoesNotMatch",
    }));
    const s3 = new S3Storage({ ...baseCfg, fetchFn });
    await expect(s3.get("k")).rejects.toThrow(
      /HTTP 403.*SignatureDoesNotMatch/,
    );
  });
});

describe("getFileStorage factory", () => {
  const envKeys = [
    "STORAGE_BACKEND",
    "UPLOAD_DIR",
    "S3_ENDPOINT",
    "S3_REGION",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "S3_FORCE_PATH_STYLE",
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of envKeys) saved[k] = process.env[k];
    __resetFileStorageCache();
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    __resetFileStorageCache();
  });

  it("defaults to LocalFsStorage", () => {
    delete process.env.STORAGE_BACKEND;
    expect(getFileStorage()).toBeInstanceOf(LocalFsStorage);
  });

  it("returns S3Storage when fully configured", () => {
    process.env.STORAGE_BACKEND = "s3";
    process.env.S3_ENDPOINT = "http://127.0.0.1:9000";
    process.env.S3_BUCKET = "b";
    process.env.S3_ACCESS_KEY_ID = "k";
    process.env.S3_SECRET_ACCESS_KEY = "s";
    process.env.S3_FORCE_PATH_STYLE = "1";
    expect(getFileStorage()).toBeInstanceOf(S3Storage);
  });

  it("lazily fails with a clear message when s3 config is incomplete", () => {
    process.env.STORAGE_BACKEND = "s3";
    delete process.env.S3_BUCKET;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    expect(() => getFileStorage()).toThrow(
      /S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY/,
    );
  });

  it("rejects unknown backends", () => {
    process.env.STORAGE_BACKEND = "ftp";
    expect(() => getFileStorage()).toThrow(/Unknown STORAGE_BACKEND/);
  });
});
