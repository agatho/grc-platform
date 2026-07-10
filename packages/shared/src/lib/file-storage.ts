// FileStorage abstraction for DMS file attachments.
//
// Server-only (node:fs, node:crypto) — exported via the subpath
// "@grc/shared/lib/file-storage" and intentionally NOT re-exported
// from the package index so it can never leak into client bundles.
//
// Both consumers use the same storage keys the platform has always
// stored in document.file_path / document_file.file_path
// ("{orgId}/{docId}/{uuid}-{filename}"), so existing files stay
// readable with STORAGE_BACKEND=local (the default) without any
// migration:
//   - apps/web  → upload / download / verify-integrity / erase routes
//   - apps/worker → document-retention-purge cron
//
// Backends:
//   local (default) — files under UPLOAD_DIR (exactly the pre-existing
//                     fs/promises behavior and directory layout)
//   s3              — S3-compatible object storage (AWS S3, MinIO, …)
//                     via SigV4-signed fetch (lib/sigv4.ts), no SDK.
//
// Env (lazy-validated: errors surface on first use, not at import):
//   STORAGE_BACKEND=local|s3   (default local)
//   UPLOAD_DIR                 (local; default <cwd>/../../uploads/documents)
//   S3_ENDPOINT                (s3; e.g. http://minio:9000 — optional for AWS)
//   S3_REGION                  (s3; default us-east-1)
//   S3_BUCKET                  (s3; required)
//   S3_ACCESS_KEY_ID           (s3; required)
//   S3_SECRET_ACCESS_KEY       (s3; required)
//   S3_FORCE_PATH_STYLE=1      (s3; path-style URLs — required for MinIO)

import { mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
import { dirname, resolve, sep } from "path";
import { sha256Hex, signRequest } from "./sigv4";

export interface FileStorageMeta {
  contentType?: string;
}

export interface FileStorage {
  put(key: string, data: Buffer, meta?: FileStorageMeta): Promise<void>;
  /** @throws FileNotFoundInStorageError when the key does not exist. */
  get(key: string): Promise<Buffer>;
  /** @returns true if the object existed (best knowledge of the backend). */
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
}

export class FileNotFoundInStorageError extends Error {
  readonly key: string;
  constructor(key: string) {
    super(`File not found in storage: ${key}`);
    this.name = "FileNotFoundInStorageError";
    this.key = key;
  }
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

// ──────────────────────────────────────────────────────────────
// Local filesystem backend — byte-for-byte the historical behavior
// ──────────────────────────────────────────────────────────────

export class LocalFsStorage implements FileStorage {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  /** Resolve a storage key to an absolute path, refusing traversal. */
  private resolveKey(key: string): string {
    const base = resolve(this.baseDir);
    const full = resolve(base, key);
    if (full !== base && !full.startsWith(base + sep)) {
      throw new Error(`Invalid storage key (path traversal): ${key}`);
    }
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const fullPath = this.resolveKey(key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolveKey(key));
    } catch (err) {
      if (isErrnoException(err) && err.code === "ENOENT") {
        throw new FileNotFoundInStorageError(key);
      }
      throw err;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await unlink(this.resolveKey(key));
      return true;
    } catch (err) {
      if (isErrnoException(err) && err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }
}

// ──────────────────────────────────────────────────────────────
// S3-compatible backend — SigV4 + fetch, path-style for MinIO
// ──────────────────────────────────────────────────────────────

export interface S3StorageConfig {
  /** Custom endpoint (MinIO etc.). Omit for AWS S3. */
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Path-style URLs (…/bucket/key) — required for MinIO. */
  forcePathStyle: boolean;
  /** Fetch override for tests. */
  fetchFn?: typeof fetch;
}

export class S3Storage implements FileStorage {
  private readonly cfg: S3StorageConfig;
  private readonly fetchFn: typeof fetch;

  constructor(cfg: S3StorageConfig) {
    this.cfg = cfg;
    this.fetchFn = cfg.fetchFn ?? fetch;
  }

  /** Build the object URL (path-style or virtual-hosted). */
  objectUrl(key: string): URL {
    const encodedKey = key
      .split("/")
      .map((s) => encodeURIComponent(s))
      .join("/");
    if (this.cfg.endpoint) {
      const base = this.cfg.endpoint.replace(/\/+$/, "");
      if (this.cfg.forcePathStyle) {
        return new URL(`${base}/${this.cfg.bucket}/${encodedKey}`);
      }
      const url = new URL(base);
      url.host = `${this.cfg.bucket}.${url.host}`;
      url.pathname = `/${encodedKey}`;
      return url;
    }
    if (this.cfg.forcePathStyle) {
      return new URL(
        `https://s3.${this.cfg.region}.amazonaws.com/${this.cfg.bucket}/${encodedKey}`,
      );
    }
    return new URL(
      `https://${this.cfg.bucket}.s3.${this.cfg.region}.amazonaws.com/${encodedKey}`,
    );
  }

  private async request(
    method: "GET" | "PUT" | "DELETE" | "HEAD",
    key: string,
    body?: Buffer,
    contentType?: string,
  ): Promise<Response> {
    const url = this.objectUrl(key);
    // Never UNSIGNED-PAYLOAD: always sign the real content hash.
    const payloadHash = sha256Hex(body ?? Buffer.alloc(0));
    const headersToSign: Record<string, string> = {
      host: url.host,
      "x-amz-content-sha256": payloadHash,
    };
    if (contentType) headersToSign["content-type"] = contentType;

    const signed = signRequest({
      method,
      url,
      headers: headersToSign,
      payloadHash,
      accessKeyId: this.cfg.accessKeyId,
      secretAccessKey: this.cfg.secretAccessKey,
      region: this.cfg.region,
      service: "s3",
    });

    return this.fetchFn(url, {
      method,
      headers: signed.headers,
      body: body ? new Uint8Array(body) : undefined,
    });
  }

  private async throwOnError(
    res: Response,
    op: string,
    key: string,
  ): Promise<never> {
    const text = await res.text().catch(() => "");
    throw new Error(
      `S3 ${op} failed for key "${key}": HTTP ${res.status} ${text.slice(0, 300)}`,
    );
  }

  async put(key: string, data: Buffer, meta?: FileStorageMeta): Promise<void> {
    const res = await this.request(
      "PUT",
      key,
      data,
      meta?.contentType ?? "application/octet-stream",
    );
    if (!res.ok) await this.throwOnError(res, "PutObject", key);
    // Drain the body so the connection can be reused.
    await res.arrayBuffer().catch(() => undefined);
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.request("GET", key);
    if (res.status === 404) throw new FileNotFoundInStorageError(key);
    if (!res.ok) await this.throwOnError(res, "GetObject", key);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<boolean> {
    const res = await this.request("DELETE", key);
    if (res.status === 404) return false;
    if (!res.ok && res.status !== 204) {
      await this.throwOnError(res, "DeleteObject", key);
    }
    await res.arrayBuffer().catch(() => undefined);
    return true;
  }

  async exists(key: string): Promise<boolean> {
    const res = await this.request("HEAD", key);
    await res.arrayBuffer().catch(() => undefined);
    if (res.status === 404) return false;
    if (!res.ok) await this.throwOnError(res, "HeadObject", key);
    return true;
  }
}

// ──────────────────────────────────────────────────────────────
// Factory — env-driven, lazily validated, cached per backend
// ──────────────────────────────────────────────────────────────

/** Historical default: <cwd>/../../uploads/documents (apps/web and
 *  apps/worker both sit two levels below the repo root, so this
 *  resolves to the same directory from either process). */
export function defaultUploadDir(): string {
  return (
    process.env.UPLOAD_DIR ?? resolve(process.cwd(), "../../uploads/documents")
  );
}

let cachedStorage: FileStorage | null = null;
let cachedSignature: string | null = null;

/** Test hook — clears the cached storage instance. */
export function __resetFileStorageCache(): void {
  cachedStorage = null;
  cachedSignature = null;
}

export function getFileStorage(): FileStorage {
  const backend = (process.env.STORAGE_BACKEND ?? "local").toLowerCase();
  const signature = [
    backend,
    process.env.UPLOAD_DIR ?? "",
    process.env.S3_ENDPOINT ?? "",
    process.env.S3_REGION ?? "",
    process.env.S3_BUCKET ?? "",
    process.env.S3_ACCESS_KEY_ID ?? "",
    process.env.S3_FORCE_PATH_STYLE ?? "",
  ].join("|");
  if (cachedStorage && cachedSignature === signature) return cachedStorage;

  if (backend === "local") {
    cachedStorage = new LocalFsStorage(defaultUploadDir());
  } else if (backend === "s3") {
    const missing: string[] = [];
    if (!process.env.S3_BUCKET) missing.push("S3_BUCKET");
    if (!process.env.S3_ACCESS_KEY_ID) missing.push("S3_ACCESS_KEY_ID");
    if (!process.env.S3_SECRET_ACCESS_KEY) missing.push("S3_SECRET_ACCESS_KEY");
    if (missing.length > 0) {
      throw new Error(
        `STORAGE_BACKEND=s3 is set but required variables are missing: ${missing.join(
          ", ",
        )}. Set them (plus optional S3_ENDPOINT / S3_REGION / S3_FORCE_PATH_STYLE=1 for MinIO) or switch back to STORAGE_BACKEND=local.`,
      );
    }
    cachedStorage = new S3Storage({
      endpoint: process.env.S3_ENDPOINT || undefined,
      region: process.env.S3_REGION || "us-east-1",
      bucket: process.env.S3_BUCKET as string,
      accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "1",
    });
  } else {
    throw new Error(
      `Unknown STORAGE_BACKEND "${backend}" — expected "local" or "s3".`,
    );
  }

  cachedSignature = signature;
  return cachedStorage;
}
