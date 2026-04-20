/**
 * Minimal ASN.1 DER encoder.
 *
 * Written from scratch rather than pulled from a library because the only
 * thing we need it for is building a single RFC 3161 TimeStampReq and
 * parsing the few fields of TimeStampResp that matter for verification.
 * The surface area of @peculiar/asn1-schema (or the pkijs family) is
 * enormous by comparison and pulls ~500 KB of dependencies.
 *
 * Supported encodings (just what we need):
 *  - INTEGER (non-negative, arbitrary length)
 *  - BOOLEAN
 *  - OCTET STRING
 *  - NULL
 *  - OBJECT IDENTIFIER
 *  - SEQUENCE
 *
 * Tag classes: universal only. No implicit/explicit tags needed for
 * our TimeStampReq.
 */

const TAG = {
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OID: 0x06,
  SEQUENCE: 0x30,
  BOOLEAN: 0x01,
} as const;

/** Encode a length field (short form < 128, long form otherwise). */
function encodeLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  let n = length;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

/** Wrap a raw payload with a tag + length prefix. */
function tlv(tag: number, value: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), encodeLength(value.length), value]);
}

export function encodeInteger(value: number | bigint | Buffer): Buffer {
  let bytes: Buffer;
  if (Buffer.isBuffer(value)) {
    bytes = value;
  } else {
    // Encode non-negative integer as big-endian, minimum length, with a
    // leading 0x00 if the top bit would otherwise be set (so it stays
    // interpretable as positive).
    const big = typeof value === "bigint" ? value : BigInt(value);
    if (big === 0n) return tlv(TAG.INTEGER, Buffer.from([0]));
    const tmp: number[] = [];
    let n = big;
    while (n > 0n) {
      tmp.unshift(Number(n & 0xffn));
      n >>= 8n;
    }
    if (tmp[0] & 0x80) tmp.unshift(0);
    bytes = Buffer.from(tmp);
  }
  return tlv(TAG.INTEGER, bytes);
}

export function encodeOctetString(value: Buffer): Buffer {
  return tlv(TAG.OCTET_STRING, value);
}

export function encodeNull(): Buffer {
  return Buffer.from([TAG.NULL, 0x00]);
}

export function encodeBoolean(value: boolean): Buffer {
  return tlv(TAG.BOOLEAN, Buffer.from([value ? 0xff : 0x00]));
}

/** Encode an OID from its dotted-decimal string form. */
export function encodeOid(oid: string): Buffer {
  const parts = oid.split(".").map((p) => parseInt(p, 10));
  if (parts.length < 2)
    throw new Error("OID must have at least two components");

  const first = parts[0] * 40 + parts[1];
  const rest = parts.slice(2);
  const bytes: number[] = [first];

  for (const part of rest) {
    if (part < 128) {
      bytes.push(part);
      continue;
    }
    const encoded: number[] = [];
    let n = part;
    while (n > 0) {
      encoded.unshift(n & 0x7f);
      n >>= 7;
    }
    // Set high bit on all bytes except the last
    for (let i = 0; i < encoded.length - 1; i++) encoded[i] |= 0x80;
    bytes.push(...encoded);
  }

  return tlv(TAG.OID, Buffer.from(bytes));
}

export function encodeSequence(...children: Buffer[]): Buffer {
  return tlv(TAG.SEQUENCE, Buffer.concat(children));
}

/**
 * Convenience: AlgorithmIdentifier ::= SEQUENCE { algorithm OID, parameters ANY }.
 * For SHA-256 the parameters are NULL per RFC 5754.
 */
export function encodeAlgorithmIdentifier(
  oid: string,
  parametersNull = true,
): Buffer {
  return encodeSequence(
    encodeOid(oid),
    ...(parametersNull ? [encodeNull()] : []),
  );
}

/** SHA-256 OID per RFC 5754 / NIST */
export const OID_SHA256 = "2.16.840.1.101.3.4.2.1";

// ──────────────────────────────────────────────────────────────
// Minimal DER parser — just enough to extract what we need from
// a TimeStampResp.
// ──────────────────────────────────────────────────────────────

export interface DerNode {
  tag: number;
  value: Buffer;
  /** Offset in the original buffer where this node ends (exclusive) */
  end: number;
}

/** Parse one TLV from `buf` starting at `offset`. Returns tag+value+endOffset. */
export function readNode(buf: Buffer, offset = 0): DerNode {
  const tag = buf[offset];
  let lenByte = buf[offset + 1];
  let lenBytes = 0;
  let length: number;

  if (lenByte < 0x80) {
    length = lenByte;
  } else {
    lenBytes = lenByte & 0x7f;
    length = 0;
    for (let i = 0; i < lenBytes; i++) {
      length = (length << 8) | buf[offset + 2 + i];
    }
  }

  const valueStart = offset + 2 + lenBytes;
  const valueEnd = valueStart + length;
  return {
    tag,
    value: buf.subarray(valueStart, valueEnd),
    end: valueEnd,
  };
}

/** Parse the children of a SEQUENCE / SET node. */
export function readChildren(node: DerNode): DerNode[] {
  const out: DerNode[] = [];
  let off = 0;
  while (off < node.value.length) {
    const child = readNode(node.value, off);
    out.push(child);
    off = child.end;
  }
  return out;
}
