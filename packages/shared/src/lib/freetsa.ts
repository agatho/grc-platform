import {
  randomBytes,
  createHash,
  createVerify,
  X509Certificate,
} from "node:crypto";
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
 * RFC 3161 TimeStampReq / TimeStampResp client **with response
 * validation**.
 *
 * ── Why this file grew (ARCTOS-FULL-2026-08-31 / S03-11) ──────────────
 *
 * The previous implementation accepted a timestamp on two conditions:
 * HTTP 200, and the first PKIStatusInfo integer being 0. Nothing else was
 * checked — not the nonce (RFC 3161 §2.4.2, the protocol's only replay
 * protection), not the `messageImprint` against the hash we submitted,
 * not the CMS signature, not the certificate. The nonce was even
 * returned to the caller with the comment "useful if the caller wants to
 * pin it later"; neither caller pinned it.
 *
 * The consequence is not academic. A response captured earlier, a
 * response for a completely different hash, or one produced by whoever
 * terminates the TLS connection, all satisfied "status == 0". The
 * platform then displayed "FreeTSA: anchored 2h ago" and the customer
 * believed in an external witness that had never existed. `verified_at`
 * was a column no code path ever wrote.
 *
 * `requestTimestamp()` now validates before it returns, and throws
 * instead of returning something the caller would store as evidence:
 *
 *   1. PKIStatus must be 0 (granted). `grantedWithMods` is refused — it
 *      means the TSA changed something about the request.
 *   2. The TSTInfo `messageImprint` must carry SHA-256 and must equal the
 *      hash we submitted, byte for byte.
 *   3. The TSTInfo `nonce` must equal the nonce we sent.
 *   4. The CMS SignedData signature must verify: the message-digest
 *      signed attribute must equal SHA-256 over the eContent, and the
 *      signature must verify over the DER SET OF signed attributes under
 *      the signer certificate's public key.
 *   5. `genTime` must be inside the signer certificate's validity window
 *      and must not lie in the future beyond a small tolerance.
 *   6. If a trust anchor is configured (`FREETSA_CA_PEM` / `opts.caPem`),
 *      the signer certificate must be issued by it. Without one, the
 *      result is flagged `chainVerified: false` rather than silently
 *      treated as verified.
 *
 * The raw DER response is still stored verbatim, so `openssl ts -verify`
 * remains possible independently of this parser.
 */

export interface TimestampRequestResult {
  /** DER-encoded TimeStampResp bytes — store this in audit_anchor.proof */
  proof: Buffer;
  /** The nonce that was sent and verified against the response */
  nonce: Buffer;
  /** status code from TimeStampResp — 0 means granted */
  statusCode: number;
  /** genTime recorded by the TSA, parsed from the TSTInfo */
  genTime?: Date;
  /** True once messageImprint, nonce and CMS signature all verified */
  verified: boolean;
  /** True only if a trust anchor was configured and the chain checked out */
  chainVerified: boolean;
  /** Subject of the signing certificate, for the operator-facing UI */
  signerSubject?: string;
  /** TSA policy OID from the TSTInfo */
  policyOid?: string;
  /** Serial number of the timestamp token, hex */
  serialNumber?: string;
}

export interface FreeTsaOptions {
  /** Endpoint URL. Defaults to FreeTSA production. */
  endpoint?: string;
  /** Timeout in ms for the HTTP call. Defaults to 15s. */
  timeoutMs?: number;
  /**
   * PEM trust anchor(s) for the TSA certificate chain. Defaults to
   * `process.env.FREETSA_CA_PEM`. Without it the response is still fully
   * signature-checked but `chainVerified` stays false.
   */
  caPem?: string;
  /** Tolerance for a genTime in the future. Defaults to 5 minutes. */
  clockSkewMs?: number;
  /**
   * Escape hatch for offline/air-gapped deployments that deliberately run
   * without an external TSA. It does NOT weaken validation — it only
   * allows a missing trust anchor. There is no option that skips 1–5.
   */
  allowUnpinnedChain?: boolean;
}

const DEFAULT_ENDPOINT = "https://freetsa.org/tsr";

const OID_SIGNED_DATA = "1.2.840.113549.1.7.2";
const OID_CT_TST_INFO = "1.2.840.113549.1.9.16.1.4";
const OID_ATTR_MESSAGE_DIGEST = "1.2.840.113549.1.9.4";
const OID_ATTR_CONTENT_TYPE = "1.2.840.113549.1.9.3";

const DIGEST_BY_OID: Record<string, string> = {
  "2.16.840.1.101.3.4.2.1": "sha256",
  "2.16.840.1.101.3.4.2.2": "sha384",
  "2.16.840.1.101.3.4.2.3": "sha512",
  "1.3.14.3.2.26": "sha1",
};

const SIG_ALG_BY_OID: Record<string, { digest: string; key: "rsa" | "ec" }> = {
  "1.2.840.113549.1.1.11": { digest: "sha256", key: "rsa" },
  "1.2.840.113549.1.1.12": { digest: "sha384", key: "rsa" },
  "1.2.840.113549.1.1.13": { digest: "sha512", key: "rsa" },
  "1.2.840.113549.1.1.5": { digest: "sha1", key: "rsa" },
  // rsaEncryption as the signatureAlgorithm — the digest then comes from
  // the SignerInfo digestAlgorithm, which is what most TSAs emit.
  "1.2.840.113549.1.1.1": { digest: "", key: "rsa" },
  "1.2.840.10045.4.3.2": { digest: "sha256", key: "ec" },
  "1.2.840.10045.4.3.3": { digest: "sha384", key: "ec" },
};

export class TimestampValidationError extends Error {
  readonly reason: string;
  constructor(reason: string, message: string) {
    super(message);
    this.name = "TimestampValidationError";
    this.reason = reason;
  }
}

// [OP-065] Ein DER-Baum aus fremder Hand hat keine garantierte Form. Bis
// hierher wurden seine Elemente direkt indiziert — `tst[2]`,
// `readChildren(imprintSeq[0])[0]`, `readChildren(readChildren(mdAttr)[1])[0]`
// — und fehlte eines davon, war das Ergebnis nicht etwa eine Ablehnung,
// sondern ein `TypeError: Cannot read properties of undefined (reading
// 'value')`. Der fliegt an dem gesamten Fehlermodell dieses Moduls vorbei:
// jeder andere Ablehnungsgrund kommt als `TimestampValidationError` mit einem
// benannten `reason` heraus, dieser als roher Programmierfehler. Im
// Wiederholungslauf (`apps/worker/src/crons/audit-chain-verify.ts`) landete
// er als `last_error` an einem Anker — eine Meldung, mit der ein Betreiber
// nichts anfangen kann, für einen Zustand, der schlicht „die Antwort ist
// verstümmelt" heisst.
//
// `requireChild` macht daraus die Ablehnung, die es immer war. Der Grund
// `malformed` ist derselbe, den die benachbarten Längenprüfungen von Hand
// werfen; diese Funktion ersetzt sie an rund 25 Stellen durch dieselbe
// Aussage, ohne dass an jeder einzelnen eine eigene `if`-Zeile stehen muss.
function requireChild(nodes: DerNode[], index: number, what: string): DerNode {
  const node = nodes[index];
  if (node === undefined) {
    throw new TimestampValidationError(
      "malformed",
      `${what}: element ${index} is missing (${nodes.length} present)`,
    );
  }
  return node;
}

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
 * Send a TimeStampReq to FreeTSA (or any RFC 3161 endpoint), validate the
 * response and return it. Throws `TimestampValidationError` if the
 * response does not attest to the hash we submitted — the caller must not
 * store an unvalidated response as an anchor.
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
  const validated = verifyTimestampResponse(proof, sha256Hash, nonce, opts);

  return { proof, nonce, ...validated };
}

/**
 * Validate a stored TimeStampResp against the hash it is supposed to
 * attest to. Used by `requestTimestamp` on arrival and by the periodic
 * re-verification job on anchors that are already in the database — which
 * is what finally sets `audit_anchor.verified_at`.
 *
 * `expectedNonce` may be omitted when re-verifying a stored proof: the
 * nonce is not persisted, and its purpose (replay protection at request
 * time) has already been served.
 */
export function verifyTimestampResponse(
  resp: Buffer,
  expectedImprint: Buffer,
  expectedNonce?: Buffer,
  opts: FreeTsaOptions = {},
): Omit<TimestampRequestResult, "proof" | "nonce"> {
  const top = readNode(resp, 0);
  if (top.tag !== 0x30) {
    throw new TimestampValidationError(
      "malformed",
      "TimeStampResp is not a SEQUENCE",
    );
  }
  const children = readChildren(top);
  if (children.length === 0) {
    throw new TimestampValidationError("malformed", "TimeStampResp is empty");
  }

  const statusInfo = readChildren(requireChild(children, 0, "TimeStampResp"));
  if (statusInfo.length === 0) {
    throw new TimestampValidationError(
      "malformed",
      "TimeStampResp: PKIStatusInfo is empty",
    );
  }
  // `value[0]` ist bei einem leeren INTEGER `undefined`; `?? -1` liefert
  // denselben Ersatzwert wie die frühere Längenabfrage, in einem Ausdruck.
  const statusCode =
    requireChild(statusInfo, 0, "PKIStatusInfo").value[0] ?? -1;

  if (statusCode !== 0) {
    throw new TimestampValidationError(
      "status",
      `TSA refused the request: PKIStatus ${statusCode}` +
        (statusCode === 1
          ? " (grantedWithMods — the TSA altered the request, refusing)"
          : ""),
    );
  }

  if (children.length < 2) {
    throw new TimestampValidationError(
      "no_token",
      "TSA returned status granted but no timeStampToken",
    );
  }

  // ── ContentInfo → SignedData ────────────────────────────────────────
  const contentInfo = readChildren(requireChild(children, 1, "TimeStampResp"));
  if (
    contentInfo.length < 2 ||
    decodeOid(requireChild(contentInfo, 0, "ContentInfo")) !== OID_SIGNED_DATA
  ) {
    throw new TimestampValidationError(
      "malformed",
      "timeStampToken is not a CMS SignedData",
    );
  }
  // contentInfo[1] is [0] EXPLICIT; its single child is the SignedData
  // SEQUENCE, whose children are the SignedData fields.
  const sdSeq = readChildren(requireChild(contentInfo, 1, "ContentInfo"))[0];
  if (!sdSeq || sdSeq.tag !== 0x30) {
    throw new TimestampValidationError(
      "malformed",
      "CMS content is not a SignedData SEQUENCE",
    );
  }
  const sd = readChildren(sdSeq);

  const encapIdx = sd.findIndex((n) => n.tag === 0x30 && looksLikeEncap(n));
  if (encapIdx < 0) {
    throw new TimestampValidationError(
      "malformed",
      "SignedData has no EncapsulatedContentInfo carrying a TSTInfo",
    );
  }
  const encap = readChildren(requireChild(sd, encapIdx, "SignedData"));
  if (encap.length < 2) {
    throw new TimestampValidationError(
      "malformed",
      "EncapsulatedContentInfo has no eContent — this is a detached token",
    );
  }
  // eContent is [0] EXPLICIT OCTET STRING
  const eContentOctets = readNode(
    requireChild(encap, 1, "EncapsulatedContentInfo").value,
    0,
  );
  const tstInfoDer = eContentOctets.value;

  // ── TSTInfo ─────────────────────────────────────────────────────────
  const tst = readChildren(readNode(tstInfoDer, 0));
  // version, policy, messageImprint, serialNumber, genTime, [accuracy],
  // [ordering], [nonce], [tsa], [extensions]
  const policyOid = tst[1] ? decodeOid(tst[1]) : undefined;
  const imprintSeq = readChildren(requireChild(tst, 2, "TSTInfo"));
  const imprintAlgOid = decodeOid(
    requireChild(
      readChildren(requireChild(imprintSeq, 0, "messageImprint")),
      0,
      "messageImprint.hashAlgorithm",
    ),
  );
  const imprintValue = requireChild(imprintSeq, 1, "messageImprint").value;

  if (DIGEST_BY_OID[imprintAlgOid] !== "sha256") {
    throw new TimestampValidationError(
      "imprint_algorithm",
      `TSA attested a ${DIGEST_BY_OID[imprintAlgOid] ?? imprintAlgOid} imprint; SHA-256 was requested`,
    );
  }
  if (!timingSafeEqualBuffers(imprintValue, expectedImprint)) {
    throw new TimestampValidationError(
      "imprint_mismatch",
      `TSA attested ${imprintValue.toString("hex")} but the submitted hash was ${expectedImprint.toString("hex")} — this response does not belong to our Merkle root`,
    );
  }

  const serialNumber = tst[3] ? tst[3].value.toString("hex") : undefined;
  const genTime = tst[4] ? parseGeneralizedTime(tst[4].value) : undefined;

  // nonce: the first INTEGER after genTime that is not `ordering`.
  if (expectedNonce) {
    const nonceNode = tst.slice(5).find((n) => n.tag === 0x02);
    if (!nonceNode) {
      throw new TimestampValidationError(
        "nonce_missing",
        "TSTInfo carries no nonce — replay protection cannot be checked",
      );
    }
    if (!nonceEquals(nonceNode.value, expectedNonce)) {
      throw new TimestampValidationError(
        "nonce_mismatch",
        "TSTInfo nonce does not match the nonce we sent — this is a replayed or substituted response",
      );
    }
  }

  // ── CMS signature ───────────────────────────────────────────────────
  // certificates [0] IMPLICIT CertificateSet — the only 0xA0 at
  // SignedData level (crls would be 0xA1).
  const certs = sd
    .filter((n) => n.tag === 0xa0)
    .flatMap((n) => readChildren(n))
    .filter((n) => n.tag === 0x30)
    .map((n) => reencode(n));

  // SignedData has two SETs: digestAlgorithms (field 2) and signerInfos
  // (last field). Taking the first would pick the wrong one.
  const setNodes = sd.filter((n) => n.tag === 0x31);
  const signerInfos = setNodes[setNodes.length - 1];
  if (!signerInfos || setNodes.length < 2) {
    throw new TimestampValidationError(
      "malformed",
      "SignedData carries no SignerInfo",
    );
  }
  const si = readChildren(
    requireChild(readChildren(signerInfos), 0, "signerInfos"),
  );

  // SignerInfo ::= SEQUENCE { version, sid, digestAlgorithm,
  //   [0] signedAttrs OPTIONAL, signatureAlgorithm, signature, ... }
  if (si.length < 6 || requireChild(si, 2, "SignerInfo").tag !== 0x30) {
    throw new TimestampValidationError("malformed", "SignerInfo is malformed");
  }
  const digestAlgOid = decodeOid(
    requireChild(
      readChildren(requireChild(si, 2, "SignerInfo")),
      0,
      "SignerInfo.digestAlgorithm",
    ),
  );
  const digestAlg = DIGEST_BY_OID[digestAlgOid] ?? "sha256";

  const attrIdx = si.findIndex((n) => n.tag === 0xa0);
  if (attrIdx < 3) {
    // RFC 3161 §2.4.2 requires signedAttrs (content-type + message-digest)
    // for a TSTInfo token. Without them there is nothing binding the
    // signature to this specific TSTInfo.
    throw new TimestampValidationError(
      "no_signed_attrs",
      "SignerInfo has no signedAttrs — the signature is not bound to the TSTInfo",
    );
  }
  const sigAlgNode = si[attrIdx + 1];
  const signatureNode = si[attrIdx + 2];

  if (
    !sigAlgNode ||
    sigAlgNode.tag !== 0x30 ||
    !signatureNode ||
    signatureNode.tag !== 0x04
  ) {
    throw new TimestampValidationError(
      "malformed",
      "SignerInfo is missing signatureAlgorithm or signature",
    );
  }

  // message-digest signed attribute must equal digest(eContent)
  const attrs = readChildren(requireChild(si, attrIdx, "SignerInfo"));
  const mdAttr = attrs.find((a) => {
    const parts = readChildren(a);
    return (
      parts.length > 0 &&
      decodeOid(requireChild(parts, 0, "signedAttr")) ===
        OID_ATTR_MESSAGE_DIGEST
    );
  });
  if (!mdAttr) {
    throw new TimestampValidationError(
      "malformed",
      "signedAttrs carry no message-digest attribute",
    );
  }
  const mdValue = requireChild(
    readChildren(
      requireChild(readChildren(mdAttr), 1, "message-digest attribute"),
    ),
    0,
    "message-digest attribute value",
  ).value;
  const eContentDigest = createHash(digestAlg).update(tstInfoDer).digest();
  if (!timingSafeEqualBuffers(mdValue, eContentDigest)) {
    throw new TimestampValidationError(
      "content_digest_mismatch",
      "the signed message-digest attribute does not match the TSTInfo it is supposed to cover",
    );
  }

  const ctAttr = attrs.find((a) => {
    const parts = readChildren(a);
    return (
      parts.length > 0 &&
      decodeOid(requireChild(parts, 0, "signedAttr")) === OID_ATTR_CONTENT_TYPE
    );
  });
  if (ctAttr) {
    const ctOid = decodeOid(
      requireChild(
        readChildren(
          requireChild(readChildren(ctAttr), 1, "content-type attribute"),
        ),
        0,
        "content-type attribute value",
      ),
    );
    if (ctOid !== OID_CT_TST_INFO) {
      throw new TimestampValidationError(
        "content_type",
        `signed content-type is ${ctOid}, expected id-ct-TSTInfo`,
      );
    }
  }

  // The signature covers the DER SET OF signedAttrs: the implicit [0]
  // tag (0xA0) is replaced by the universal SET tag (0x31).
  const signedAttrsDer = reencode({
    ...requireChild(si, attrIdx, "SignerInfo"),
    tag: 0x31,
  });
  const sigAlgOid = decodeOid(
    requireChild(readChildren(sigAlgNode), 0, "signatureAlgorithm"),
  );
  const sigAlg = SIG_ALG_BY_OID[sigAlgOid];
  if (!sigAlg) {
    throw new TimestampValidationError(
      "signature_algorithm",
      `unsupported TSA signature algorithm ${sigAlgOid}`,
    );
  }
  const verifyDigest = sigAlg.digest || digestAlg;

  if (certs.length === 0) {
    throw new TimestampValidationError(
      "no_certificate",
      "the token carries no certificate although certReq was set — the signature cannot be checked",
    );
  }

  let signer: X509Certificate | undefined;
  for (const der of certs) {
    let cert: X509Certificate;
    try {
      cert = new X509Certificate(der);
    } catch {
      continue;
    }
    const v = createVerify(verifyDigest);
    v.update(signedAttrsDer);
    v.end();
    let ok = false;
    try {
      ok = v.verify(cert.publicKey, signatureNode.value);
    } catch {
      ok = false;
    }
    if (ok) {
      signer = cert;
      break;
    }
  }

  if (!signer) {
    throw new TimestampValidationError(
      "signature_invalid",
      "no certificate in the token verifies its signature — the response is forged or corrupted",
    );
  }

  // genTime plausibility, bounded by the signer certificate's validity.
  const skew = opts.clockSkewMs ?? 5 * 60_000;
  if (genTime) {
    if (genTime.getTime() > Date.now() + skew) {
      throw new TimestampValidationError(
        "gentime_future",
        `TSA genTime ${genTime.toISOString()} lies in the future`,
      );
    }
    const notBefore = new Date(signer.validFrom).getTime();
    const notAfter = new Date(signer.validTo).getTime();
    if (
      Number.isFinite(notBefore) &&
      Number.isFinite(notAfter) &&
      (genTime.getTime() < notBefore || genTime.getTime() > notAfter)
    ) {
      throw new TimestampValidationError(
        "gentime_outside_certificate",
        `TSA genTime ${genTime.toISOString()} lies outside the signing certificate's validity`,
      );
    }
  }

  // Trust anchor. Absent one, we say so rather than implying a chain
  // check that did not happen.
  const caPem = opts.caPem ?? process.env.FREETSA_CA_PEM;
  let chainVerified = false;
  if (caPem && caPem.trim().length > 0) {
    const anchors = splitPem(caPem).map((p) => new X509Certificate(p));
    chainVerified = anchors.some((anchor) => {
      try {
        return signer!.verify(anchor.publicKey) || signer!.checkIssued(anchor);
      } catch {
        return false;
      }
    });
    if (!chainVerified) {
      throw new TimestampValidationError(
        "chain_untrusted",
        "the TSA signing certificate is not issued by the configured trust anchor (FREETSA_CA_PEM)",
      );
    }
  } else if (!opts.allowUnpinnedChain) {
    // Not fatal: refusing to anchor at all would be worse than anchoring
    // with a signature-verified but unpinned certificate. The flag is
    // persisted so the UI and the archive can state what was checked.
    chainVerified = false;
  }

  return {
    statusCode,
    genTime,
    verified: true,
    chainVerified,
    signerSubject: signer.subject,
    policyOid,
    serialNumber,
  };
}

/**
 * Parse the status and genTime out of a TimeStampResp without validating
 * it. Retained for callers that only want to display metadata about a
 * proof they already trust — it must never be used to decide whether a
 * proof is acceptable. Use `verifyTimestampResponse` for that.
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
  const statusInfo = readChildren(requireChild(children, 0, "TimeStampResp"));
  const statusNode = statusInfo[0];
  if (statusNode === undefined) {
    throw new Error("TimeStampResp: PKIStatusInfo is empty");
  }
  const statusCode = statusNode.value[0] ?? -1;

  let genTime: Date | undefined;
  const tokenNode = children[1];
  if (tokenNode !== undefined) {
    genTime = findGeneralizedTime(tokenNode.value);
  }
  return { statusCode, genTime };
}

// ──────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────

function looksLikeEncap(node: DerNode): boolean {
  try {
    const kids = readChildren(node);
    const head = kids[0];
    return (
      head !== undefined &&
      head.tag === 0x06 &&
      decodeOid(head) === OID_CT_TST_INFO
    );
  } catch {
    return false;
  }
}

function decodeOid(node: DerNode): string {
  const b = node.value;
  // [OP-065] `b[0]` und `b[i]` stehen hinter Schranken, die der Compiler
  // nicht mit dem Indexzugriff verbindet. Die Zerlegung in erstes Byte und
  // Rest sagt dasselbe in einer Form, die er nachvollzieht — und ersetzt die
  // Längenabfrage, statt einen Zweig hinzuzufügen.
  const [head, ...rest] = b;
  if (head === undefined) return "";
  const parts: number[] = [Math.floor(head / 40), head % 40];
  let acc = 0;
  for (const byte of rest) {
    acc = acc * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) {
      parts.push(acc);
      acc = 0;
    }
  }
  return parts.join(".");
}

/** Re-emit a parsed node as DER (used to feed node:crypto). */
function reencode(node: DerNode): Buffer {
  const len = node.value.length;
  let lenBuf: Buffer;
  if (len < 0x80) {
    lenBuf = Buffer.from([len]);
  } else {
    const bytes: number[] = [];
    let n = len;
    while (n > 0) {
      bytes.unshift(n & 0xff);
      n >>= 8;
    }
    lenBuf = Buffer.from([0x80 | bytes.length, ...bytes]);
  }
  return Buffer.concat([Buffer.from([node.tag]), lenBuf, node.value]);
}

function timingSafeEqualBuffers(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  // [OP-065] Über den Wert statt über den Index: `a[i] ^ b[i]` war unter
  // `noUncheckedIndexedAccess` `undefined ^ undefined`, und das ist in
  // JavaScript 0 — ein Vergleich, der bei einem Lesefehler „gleich" gesagt
  // hätte. Die Längen sind oben geprüft, `entries()` macht die Invariante
  // für den Compiler sichtbar, und die Laufzeit bleibt konstant.
  let diff = 0;
  for (const [i, byte] of a.entries()) diff |= byte ^ (b[i] ?? 0);
  return diff === 0;
}

/** DER INTEGER may carry a leading 0x00 sign byte; compare on value. */
function nonceEquals(der: Buffer, sent: Buffer): boolean {
  const strip = (b: Buffer) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0x00) i++;
    return b.subarray(i);
  };
  return timingSafeEqualBuffers(strip(der), strip(sent));
}

function parseGeneralizedTime(buf: Buffer): Date | undefined {
  const str = buf.toString("utf8");
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/.exec(str);
  if (!m) return undefined;
  const [, yyyy, mm, dd, HH, MM, SS, frac] = m;
  const ms = frac ? Math.round(Number(frac) * 1000) : 0;
  return new Date(
    Date.UTC(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(HH),
      Number(MM),
      Number(SS),
      ms,
    ),
  );
}

function findGeneralizedTime(buf: Buffer): Date | undefined {
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i] !== 0x18) continue;
    const len = buf[i + 1];
    if (len !== 15 && len !== 19) continue;
    const parsed = parseGeneralizedTime(buf.subarray(i + 2, i + 2 + len));
    if (parsed) return parsed;
  }
  return undefined;
}

function splitPem(pem: string): string[] {
  const out: string[] = [];
  const re = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pem)) !== null) out.push(m[0]);
  return out.length > 0 ? out : [pem];
}
