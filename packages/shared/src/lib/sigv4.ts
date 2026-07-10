// AWS Signature Version 4 (SigV4) — minimal, dependency-free signer.
//
// Used by the S3 storage backend (lib/file-storage.ts) so the platform
// can talk to S3/MinIO with plain `fetch` + `node:crypto` instead of
// pulling in the AWS SDK (ZERO-new-dependency rule, DMS storage
// abstraction). Implements the full canonical-request → string-to-sign
// → signing-key derivation chain from the AWS documentation and is
// verified against the published AWS test vectors in
// packages/shared/tests/sigv4.test.ts.
//
// Deliberately NOT implemented: chunked/streaming signatures,
// UNSIGNED-PAYLOAD (we always sign the real payload hash via
// x-amz-content-sha256), presigned URLs, session tokens.

import { createHash, createHmac } from "crypto";

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/** RFC 3986 strict percent-encoding (AWS "UriEncode"). */
export function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Encode a URL path for the canonical request — '/' is preserved. */
export function encodeCanonicalPath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeRfc3986(decodeSafe(segment)))
    .join("/");
}

function decodeSafe(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** AWS date stamps: 20150830T123600Z / 20150830 */
export function toAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

/**
 * Signing-key derivation (AWS docs "Task 3"):
 * kSigning = HMAC(HMAC(HMAC(HMAC("AWS4"+secret, date), region), service), "aws4_request")
 */
export function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

export interface SigV4Input {
  method: string;
  url: URL;
  /** Headers to sign. `host` is derived from the URL if absent. */
  headers: Record<string, string>;
  /** Hex SHA-256 of the request payload (empty-body hash for GET etc.). */
  payloadHash: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  /** Clock override for tests; defaults to now. */
  date?: Date;
}

export interface SigV4Result {
  /** Headers to send: input headers + x-amz-date + Authorization. */
  headers: Record<string, string>;
  signature: string;
  canonicalRequest: string;
  stringToSign: string;
  signedHeaders: string;
}

/** Sign a request per AWS SigV4 (header-based authorization). */
export function signRequest(input: SigV4Input): SigV4Result {
  const { amzDate, dateStamp } = toAmzDate(input.date ?? new Date());

  const headers: Record<string, string> = { ...input.headers };
  const lowerKeys = new Set(Object.keys(headers).map((k) => k.toLowerCase()));
  if (!lowerKeys.has("host")) headers["host"] = input.url.host;
  if (!lowerKeys.has("x-amz-date")) headers["x-amz-date"] = amzDate;

  const sortedHeaderEntries = Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, " ")] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const canonicalHeaders = sortedHeaderEntries
    .map(([name, value]) => `${name}:${value}\n`)
    .join("");
  const signedHeaders = sortedHeaderEntries.map(([name]) => name).join(";");

  const params = [...input.url.searchParams.entries()].sort((a, b) => {
    if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
    return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
  });
  const canonicalQuery = params
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .join("&");

  const canonicalRequest = [
    input.method.toUpperCase(),
    encodeCanonicalPath(input.url.pathname || "/"),
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");

  // The effective request date is whatever x-amz-date we actually sign
  // (a caller-provided header wins over the derived one) — the
  // credential scope's date stamp must match its first 8 characters.
  const effectiveAmzDate =
    sortedHeaderEntries.find(([name]) => name === "x-amz-date")?.[1] ?? amzDate;
  const effectiveDateStamp = effectiveAmzDate.slice(0, 8) || dateStamp;

  const credentialScope = `${effectiveDateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    effectiveAmzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = deriveSigningKey(
    input.secretAccessKey,
    effectiveDateStamp,
    input.region,
    input.service,
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const outHeaders: Record<string, string> = { ...headers };
  // fetch() forbids an explicit Host header — it derives it from the
  // URL (same value we signed). Drop it from the outgoing header set.
  delete outHeaders["host"];
  outHeaders["Authorization"] = authorization;

  return {
    headers: outHeaders,
    signature,
    canonicalRequest,
    stringToSign,
    signedHeaders,
  };
}
