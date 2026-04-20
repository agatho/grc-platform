import { randomBytes } from "node:crypto";
import {
  encodeSequence,
  encodeInteger,
  encodeOctetString,
  encodeBoolean,
  encodeAlgorithmIdentifier,
  OID_SHA256,
  readNode,
  readChildren,
  type DerNode,
} from "./asn1-der";

/**
 * Minimal RFC 3161 TimeStampReq / TimeStampResp client.
 *
 * Only the fields we actually need are encoded/parsed. The response body
 * ("proof") is always kept as-is in the DB so any RFC-3161-compliant tool
 * can verify it later even if our parser evolves.
 *
 * FreeTSA endpoint: https://freetsa.org/tsr
 * Content-Type:     application/timestamp-query (request)
 *                   application/timestamp-reply (response)
 *
 * TimeStampReq ::= SEQUENCE {
 *   version        INTEGER { v1(1) },
 *   messageImprint MessageImprint,
 *   reqPolicy      TSAPolicyId OPTIONAL,
 *   nonce          INTEGER     OPTIONAL,
 *   certReq        BOOLEAN     DEFAULT FALSE,
 *   extensions [0] IMPLICIT Extensions OPTIONAL
 * }
 * MessageImprint ::= SEQUENCE {
 *   hashAlgorithm AlgorithmIdentifier,
 *   hashedMessage OCTET STRING
 * }
 */

export interface TimestampRequestResult {
  /** DER-encoded TimeStampResp bytes — store this in audit_anchor.proof */
  proof: Buffer;
  /** The nonce that was sent; useful if the caller wants to pin it later */
  nonce: Buffer;
  /** status code from TimeStampResp — 0 means granted */
  statusCode: number;
  /** Genera time recorded by the TSA, extracted from the TSTInfo if available */
  genTime?: Date;
}

export interface FreeTsaOptions {
  /** Endpoint URL. Defaults to FreeTSA production. */
  endpoint?: string;
  /** Timeout in ms for the HTTP call. Defaults to 15s. */
  timeoutMs?: number;
}

const DEFAULT_ENDPOINT = "https://freetsa.org/tsr";

/**
 * Build a DER-encoded TimeStampReq for a SHA-256 hash.
 */
export function buildTimestampRequest(
  sha256Hash: Buffer,
  nonce: Buffer,
  certReq = true,
): Buffer {
  if (sha256Hash.length !== 32) {
    throw new Error(`SHA-256 hash must be 32 bytes, got ${sha256Hash.length}`);
  }

  const messageImprint = encodeSequence(
    encodeAlgorithmIdentifier(OID_SHA256, true),
    encodeOctetString(sha256Hash),
  );

  return encodeSequence(
    encodeInteger(1), // version
    messageImprint,
    encodeInteger(nonce),
    encodeBoolean(certReq),
  );
}

/**
 * Send a TimeStampReq to FreeTSA (or any RFC 3161 endpoint) and return
 * the raw response plus the parsed status. Throws on network failure or
 * non-200 HTTP status.
 */
export async function requestTimestamp(
  sha256Hash: Buffer,
  opts: FreeTsaOptions = {},
): Promise<TimestampRequestResult> {
  const endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const nonce = randomBytes(16);

  const body = buildTimestampRequest(sha256Hash, nonce, true);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/timestamp-query",
        Accept: "application/timestamp-reply",
      },
      body: new Uint8Array(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    throw new Error(`TSA returned HTTP ${resp.status} ${resp.statusText}`);
  }

  const proof = Buffer.from(await resp.arrayBuffer());
  const parsed = parseTimestampResponse(proof);

  return {
    proof,
    nonce,
    statusCode: parsed.statusCode,
    genTime: parsed.genTime,
  };
}

/**
 * Parse the status and (best-effort) genTime out of a TimeStampResp.
 *
 * TimeStampResp ::= SEQUENCE {
 *   status        PKIStatusInfo,
 *   timeStampToken TimeStampToken OPTIONAL
 * }
 * PKIStatusInfo ::= SEQUENCE {
 *   status       PKIStatus,            -- 0=granted, 1=grantedWithMods,
 *                                      -- 2=rejection, 3=waiting, ...
 *   statusString PKIFreeText OPTIONAL,
 *   failInfo     PKIFailureInfo OPTIONAL
 * }
 */
export function parseTimestampResponse(resp: Buffer): {
  statusCode: number;
  genTime?: Date;
} {
  const top = readNode(resp, 0);
  const children = readChildren(top);
  if (children.length === 0) {
    throw new Error("TimeStampResp is empty");
  }

  // status is the first child — PKIStatusInfo sequence
  const statusInfo = readChildren(children[0]);
  if (statusInfo.length === 0) {
    throw new Error("TimeStampResp: PKIStatusInfo is empty");
  }
  const statusInt = statusInfo[0];
  const statusCode = statusInt.value.length > 0 ? statusInt.value[0] : -1;

  // genTime is deep inside the timeStampToken. The token is the 2nd
  // child of TimeStampResp (if present). We don't fully parse the
  // ContentInfo → SignedData → EncapsulatedContentInfo → TSTInfo
  // chain here because the store-the-raw-bytes policy already covers
  // provability. We do a best-effort search for a GeneralizedTime
  // tag (0x18) in the token to surface a human-readable timestamp.
  let genTime: Date | undefined;
  if (children.length > 1) {
    genTime = findGeneralizedTime(children[1].value);
  }

  return { statusCode, genTime };
}

function findGeneralizedTime(buf: Buffer): Date | undefined {
  // Linear scan. GeneralizedTime tag is 0x18, length 15 ("YYYYMMDDHHMMSSZ") or 19.
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i] !== 0x18) continue;
    const len = buf[i + 1];
    if (len !== 15 && len !== 19) continue;
    const str = buf.subarray(i + 2, i + 2 + len).toString("utf8");
    // Must end with Z
    if (!str.endsWith("Z")) continue;
    // YYYYMMDDHHMMSSZ
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/.exec(str);
    if (!m) continue;
    const [, yyyy, mm, dd, HH, MM, SS] = m;
    return new Date(
      Date.UTC(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(HH),
        Number(MM),
        Number(SS),
      ),
    );
  }
  return undefined;
}
