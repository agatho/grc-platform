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
    // [OP-065] `tmp[0] & 0x80` war unter `noUncheckedIndexedAccess` ein
    // Fehler, und dahinter lag ein echter: für einen NEGATIVEN Wert läuft die
    // Schleife `while (n > 0n)` kein einziges Mal, `tmp` bleibt leer,
    // `undefined & 0x80` ergibt 0 — und heraus kam ein INTEGER mit
    // Inhaltslänge 0. Das ist kein „ungenauer" Wert, das ist ungültiges DER,
    // und es wäre erst beim Gegenüber aufgefallen. Der Kommentar direkt
    // darüber sagt seit jeher „non-negative integer"; jetzt setzt der Code
    // das auch durch, statt es vorauszusetzen.
    if (big < 0n) {
      throw new Error(
        `encodeInteger expects a non-negative value, got ${big.toString()}`,
      );
    }
    if (big === 0n) return tlv(TAG.INTEGER, Buffer.from([0]));
    // Das höchstwertige Byte wird beim Erzeugen mitgeführt statt hinterher
    // über `tmp[0]` nachgeschlagen: die letzte Schleifenrunde legt es ab, und
    // damit braucht es weder einen Indexzugriff noch eine Annahme über die
    // Länge von `tmp`.
    const tmp: number[] = [];
    let n = big;
    let msb = 0;
    while (n > 0n) {
      msb = Number(n & 0xffn);
      tmp.unshift(msb);
      n >>= 8n;
    }
    if (msb & 0x80) tmp.unshift(0);
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
  // [OP-065] `parts[0] * 40 + parts[1]` stand hinter einer Längenprüfung,
  // die der Compiler nicht mit dem Indexzugriff verbinden konnte. Die
  // Zerlegung ersetzt die Längenprüfung durch dieselbe Aussage in einer
  // Form, die der Compiler nachvollzieht — kein zusätzlicher Zweig.
  // Zusätzlich wird auf ganze, nicht-negative Bögen geprüft: `parseInt`
  // liefert für "2.16.x" ein `NaN`, und `NaN * 40 + …` ist wieder `NaN` —
  // `Buffer.from([NaN])` schreibt daraus stillschweigend ein 0x00. Eine
  // falsche OID hätte also eine syntaktisch gültige, inhaltlich falsche
  // Kennung erzeugt.
  const [firstArc, secondArc, ...rest] = parts;
  if (firstArc === undefined || secondArc === undefined) {
    throw new Error("OID must have at least two components");
  }
  if (parts.some((p) => !Number.isInteger(p) || p < 0)) {
    throw new Error(`OID contains a non-numeric component: ${oid}`);
  }

  const first = firstArc * 40 + secondArc;
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
    // Set high bit on all bytes except the last.
    // [OP-065] `encoded[i] |= 0x80` liest und schreibt über den Index;
    // `map` bekommt den Wert gereicht und kennt kein `undefined`.
    const last = encoded.length - 1;
    bytes.push(...encoded.map((b, i) => (i < last ? b | 0x80 : b)));
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

/**
 * Parse one TLV from `buf` starting at `offset`. Returns tag+value+endOffset.
 *
 * [OP-065] Dieser Parser hatte KEINE Bereichsprüfung, und das ist bei einem
 * Parser für fremde Bytes kein Schönheitsfehler. Er liest die Antwort einer
 * RFC-3161-Zeitstempelstelle (`freetsa.ts`) — also Bytes von dem, der die
 * TLS-Verbindung terminiert. `noUncheckedIndexedAccess` hat drei Wege
 * sichtbar gemacht, auf denen er still Unsinn statt eines Fehlers lieferte:
 *
 *  1. **Abgeschnittener Knoten.** `buf[offset]` jenseits des Puffers ist
 *     `undefined`; `tag` war als `number` deklariert und trug in Wahrheit
 *     `undefined`. `lenByte < 0x80` ist mit `undefined` falsch, also lief der
 *     Code in den Langform-Zweig, `undefined & 0x7f` ergab 0 und damit
 *     Länge 0 — ein leerer Knoten mit `tag: undefined`, den jeder
 *     Tag-Vergleich beim Aufrufer als „passt nicht" behandelt hätte, statt
 *     die Antwort als verstümmelt zurückzuweisen.
 *
 *  2. **Negative Länge.** `length = (length << 8) | …` rechnet in 32 Bit MIT
 *     Vorzeichen. Vier Längenbytes mit gesetztem obersten Bit (`84 FF …`)
 *     ergaben eine NEGATIVE Länge, und damit ein `end`, das VOR dem eigenen
 *     Anfang liegt. In `readChildren` wird `off = child.end` gesetzt — der
 *     Versatz lief also rückwärts, und die Schleife arbeitete sich in
 *     Zweierschritten aus dem Minus zurück: bis zu ~8 Millionen Runden, die
 *     ebenso viele Knoten in ein Feld schoben. Eine bösartige TSA-Antwort von
 *     wenigen Bytes reicht dafür.
 *
 *  3. **Länge über das Pufferende hinaus.** `subarray` schneidet
 *     stillschweigend ab, `end` zeigt trotzdem hinter den Puffer. Der
 *     Aufrufer bekam einen zu kurzen Wert, ohne es zu erfahren — bei einem
 *     `messageImprint`-Vergleich genau die Art Unterschied, die man nicht
 *     raten will.
 *
 * Alle drei enden jetzt in einer Ausnahme. Das ist der richtige Ausgang:
 * `freetsa.ts` fängt jeden Fehler dieses Pfades und macht daraus einen
 * `TimestampValidationError` — der Zeitstempel gilt dann als nicht erbracht,
 * und genau das ist er auch.
 */
export function readNode(buf: Buffer, offset = 0): DerNode {
  const tag = buf[offset];
  const lenByte = buf[offset + 1];
  if (tag === undefined || lenByte === undefined) {
    throw new Error(
      `DER: truncated node at offset ${offset} (buffer is ${buf.length} bytes)`,
    );
  }

  let lenBytes = 0;
  let length: number;

  if (lenByte < 0x80) {
    length = lenByte;
  } else {
    lenBytes = lenByte & 0x7f;
    // 0x80 allein ist die „indefinite length" von BER; DER kennt sie nicht.
    // Mehr als vier Längenbytes wären > 4 GiB und in diesem Kontext ohnehin
    // nicht darstellbar.
    if (lenBytes === 0 || lenBytes > 4) {
      throw new Error(
        `DER: unsupported length encoding (0x${lenByte.toString(16)}) at offset ${offset}`,
      );
    }
    length = 0;
    for (let i = 0; i < lenBytes; i++) {
      const b = buf[offset + 2 + i];
      if (b === undefined) {
        throw new Error(
          `DER: truncated length field at offset ${offset} (buffer is ${buf.length} bytes)`,
        );
      }
      // Multiplikation statt `<< 8`: der Schiebeoperator rechnet in 32 Bit
      // mit Vorzeichen und hat aus vier Längenbytes eine negative Länge
      // gemacht (siehe Punkt 2 oben). `length` bleibt so ≥ 0.
      length = length * 256 + b;
    }
  }

  const valueStart = offset + 2 + lenBytes;
  const valueEnd = valueStart + length;
  if (valueEnd > buf.length) {
    throw new Error(
      `DER: node at offset ${offset} declares ${length} content bytes but only ${buf.length - valueStart} are present`,
    );
  }
  return {
    tag,
    value: buf.subarray(valueStart, valueEnd),
    end: valueEnd,
  };
}

/**
 * Parse the children of a SEQUENCE / SET node.
 *
 * Die Schleife setzt `off = child.end` und kommt deshalb nur voran, solange
 * `end > off` gilt. Das ist seit der Bereichsprüfung in {@link readNode}
 * beweisbar: `length` ist dort ≥ 0 und `end = off + 2 + lenBytes + length`,
 * also mindestens `off + 2`. Vorher konnte `length` negativ werden — siehe
 * Punkt 2 im Kopf von `readNode`.
 */
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
