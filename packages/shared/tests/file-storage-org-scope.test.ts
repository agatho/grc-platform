// Tenant boundary in the object store.
//
// ── #S06-10 (ARCTOS-FULL-2026-08-31, Medium) ────────────────────────
// The installation has ONE bucket, ONE key pair and no bucket policy.
// The only separation between tenants was the leading "{orgId}/" segment
// that the upload route happens to build — a convention, not a control.
// `S3Storage` knows no org parameter and signs everything with the same
// key, so any future code path that takes a `file_path` from a row it
// did not org-scope reads another tenant's objects, and the object store
// cannot object.
//
// `orgScopedStorage` turns the convention into a precondition. Every DMS
// handler now wraps `getFileStorage()` with its request's org id, so a
// key from a compromised or mis-joined row is refused before it reaches
// the backend.

import { describe, it, expect } from "vitest";
import {
  assertKeyBelongsToOrg,
  orgScopedStorage,
  storageKeyOrgPrefix,
  CrossTenantStorageKeyError,
  type FileStorage,
} from "../src/lib/file-storage";

// [OP-065] `arr[i]` ist unter `noUncheckedIndexedAccess` `T | undefined`.
// In einem Test ist ein fehlendes Element kein Randfall, den man mit `!`
// wegdrückt, sondern ein Fehlschlag mit Namen — `at` macht ihn dazu.
function at<T>(arr: readonly T[], i: number): T {
  const value = arr[i];
  if (value === undefined) {
    throw new Error(`erwartetes Element ${i} fehlt (Länge ${arr.length})`);
  }
  return value;
}

const ORG_A = "aaaaaaaa-0000-4000-8000-000000000001";
const ORG_B = "bbbbbbbb-0000-4000-8000-000000000002";

function fakeStorage(): FileStorage & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async put(key) {
      calls.push(`put:${key}`);
    },
    async get(key) {
      calls.push(`get:${key}`);
      return Buffer.from("bytes");
    },
    async delete(key) {
      calls.push(`delete:${key}`);
      return true;
    },
    async exists(key) {
      calls.push(`exists:${key}`);
      return true;
    },
  };
}

describe("assertKeyBelongsToOrg (S06-10)", () => {
  it("accepts a key under the org prefix", () => {
    expect(() =>
      assertKeyBelongsToOrg(`${ORG_A}/doc-1/uuid-policy.pdf`, ORG_A),
    ).not.toThrow();
  });

  it("refuses another tenant's key", () => {
    expect(() =>
      assertKeyBelongsToOrg(`${ORG_B}/doc-9/uuid-secret.pdf`, ORG_A),
    ).toThrow(CrossTenantStorageKeyError);
  });

  it("refuses traversal that would climb out of the prefix", () => {
    expect(() =>
      assertKeyBelongsToOrg(`${ORG_A}/../${ORG_B}/doc-9/x.pdf`, ORG_A),
    ).toThrow(CrossTenantStorageKeyError);
    expect(() =>
      assertKeyBelongsToOrg(`${ORG_A}\\..\\${ORG_B}\\x.pdf`, ORG_A),
    ).toThrow(CrossTenantStorageKeyError);
  });

  it("refuses a prefix that merely starts with the org id", () => {
    // "<orgA>-evil/…" must not pass as "<orgA>/…"
    expect(() =>
      assertKeyBelongsToOrg(`${ORG_A}-evil/doc/x.pdf`, ORG_A),
    ).toThrow(CrossTenantStorageKeyError);
  });

  it("refuses a leading-slash absolute key", () => {
    expect(() => assertKeyBelongsToOrg(`/${ORG_B}/doc/x.pdf`, ORG_A)).toThrow(
      CrossTenantStorageKeyError,
    );
  });

  it("refuses when no org context is present", () => {
    expect(() => assertKeyBelongsToOrg(`${ORG_A}/doc/x.pdf`, "")).toThrow(
      CrossTenantStorageKeyError,
    );
  });

  it("exposes the prefix it enforces", () => {
    expect(storageKeyOrgPrefix(ORG_A)).toBe(`${ORG_A}/`);
  });
});

describe("orgScopedStorage (S06-10)", () => {
  it("passes through keys inside the org", async () => {
    const inner = fakeStorage();
    const scoped = orgScopedStorage(inner, ORG_A);
    await scoped.get(`${ORG_A}/doc-1/x.pdf`);
    await scoped.put(`${ORG_A}/doc-1/y.pdf`, Buffer.from("y"));
    await scoped.delete(`${ORG_A}/doc-1/z.pdf`);
    await scoped.exists(`${ORG_A}/doc-1/z.pdf`);
    expect(inner.calls).toHaveLength(4);
  });

  it.each(["get", "put", "delete", "exists"] as const)(
    "refuses %s on a foreign key before it reaches the backend",
    async (op) => {
      const inner = fakeStorage();
      const scoped = orgScopedStorage(inner, ORG_A);
      const key = `${ORG_B}/doc-9/secret.pdf`;
      const call =
        op === "put"
          ? scoped.put(key, Buffer.from("x"))
          : op === "get"
            ? scoped.get(key)
            : op === "delete"
              ? scoped.delete(key)
              : scoped.exists(key);
      await expect(call).rejects.toBeInstanceOf(CrossTenantStorageKeyError);
      // The decisive part: the backend was never asked.
      expect(inner.calls).toEqual([]);
    },
  );
});

// #S06-11 — the SSE header is only sent when the deployment configures
// one. It is not a claim the product makes on its own.
describe("S3 server-side encryption header (S06-11)", () => {
  it("omits the header when S3_SSE is unset", async () => {
    const { S3Storage } = await import("../src/lib/file-storage");
    const seen: Record<string, string>[] = [];
    const s3 = new S3Storage({
      region: "us-east-1",
      bucket: "b",
      accessKeyId: "k",
      secretAccessKey: "s",
      forcePathStyle: true,
      fetchFn: (async (_u: unknown, init: RequestInit) => {
        seen.push(init.headers as Record<string, string>);
        return new Response(null, { status: 200 });
      }) as unknown as typeof fetch,
    });
    await s3.put("org/doc/x.pdf", Buffer.from("x"), {
      contentType: "application/pdf",
    });
    expect(Object.keys(at(seen, 0)).map((h) => h.toLowerCase())).not.toContain(
      "x-amz-server-side-encryption",
    );
  });

  it("sends and SIGNS the header when configured", async () => {
    const { S3Storage } = await import("../src/lib/file-storage");
    const seen: Record<string, string>[] = [];
    const s3 = new S3Storage({
      region: "us-east-1",
      bucket: "b",
      accessKeyId: "k",
      secretAccessKey: "s",
      forcePathStyle: true,
      serverSideEncryption: "AES256",
      fetchFn: (async (_u: unknown, init: RequestInit) => {
        seen.push(init.headers as Record<string, string>);
        return new Response(null, { status: 200 });
      }) as unknown as typeof fetch,
    });
    await s3.put("org/doc/x.pdf", Buffer.from("x"), {
      contentType: "application/pdf",
    });
    const headers = Object.fromEntries(
      Object.entries(at(seen, 0)).map(([k, v]) => [k.toLowerCase(), v]),
    );
    expect(headers["x-amz-server-side-encryption"]).toBe("AES256");
    // An x-amz-* header that is not in SignedHeaders is rejected by S3,
    // so it must be part of the signature.
    expect(headers["authorization"]).toContain("x-amz-server-side-encryption");
  });

  it("does not send the header on GET", async () => {
    const { S3Storage } = await import("../src/lib/file-storage");
    const seen: Record<string, string>[] = [];
    const s3 = new S3Storage({
      region: "us-east-1",
      bucket: "b",
      accessKeyId: "k",
      secretAccessKey: "s",
      forcePathStyle: true,
      serverSideEncryption: "AES256",
      fetchFn: (async (_u: unknown, init: RequestInit) => {
        seen.push(init.headers as Record<string, string>);
        return new Response(new Uint8Array([1]), { status: 200 });
      }) as unknown as typeof fetch,
    });
    await s3.get("org/doc/x.pdf");
    expect(Object.keys(at(seen, 0)).map((h) => h.toLowerCase())).not.toContain(
      "x-amz-server-side-encryption",
    );
  });
});
