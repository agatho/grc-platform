/**
 * Minimal OpenTimestamps client.
 *
 * OpenTimestamps is a free service that aggregates user hashes into a
 * Merkle tree and commits the root into a Bitcoin transaction every
 * hour. We only need three operations:
 *
 *   1. POST a SHA-256 hash to a calendar server → get back a serialised
 *      "pending" timestamp (stub) that proves the hash was submitted.
 *      The stub is small (~300-500 B).
 *
 *   2. Later, poll the same calendar to upgrade the stub to a Bitcoin
 *      commitment — once the next Bitcoin block includes the calendar's
 *      aggregate transaction, the calendar returns a full proof that
 *      chains leaf → calendar merkle tree → block header.
 *
 *   3. Verify a proof: walk the commitment operations (append, prepend,
 *      sha256, bitcoin attestation), ending at a known Bitcoin block
 *      header. This is done by the `ots` CLI and the JS library
 *      javascript-opentimestamps; we don't rewrite it. Our DB just
 *      stores the proof bytes so any compliant tool can verify.
 *
 * Calendar pool URLs are published at https://github.com/opentimestamps/
 * opentimestamps-client/blob/master/README.md — the three primary
 * servers are Petertodd's, Catena's, and eternitywall's. Sending to all
 * three in parallel gives redundancy at ~zero cost.
 */

const DEFAULT_CALENDARS = [
  "https://a.pool.opentimestamps.org",
  "https://b.pool.opentimestamps.org",
  "https://a.pool.eternitywall.com",
];

export interface OtsSubmitResult {
  /** The calendar URL that responded */
  calendar: string;
  /** Raw pending-timestamp bytes as returned by the calendar */
  stub: Buffer;
}

/**
 * Submit a SHA-256 hash to one calendar server and return the pending
 * commitment stub. Throws on network failure or non-200 status.
 */
export async function submitToCalendar(
  sha256Hash: Buffer,
  calendarUrl: string,
  timeoutMs = 15_000,
): Promise<OtsSubmitResult> {
  if (sha256Hash.length !== 32) {
    throw new Error(`SHA-256 hash must be 32 bytes, got ${sha256Hash.length}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetch(`${calendarUrl}/digest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.opentimestamps.v1",
        // The ots CLI sends this; some calendars require it
        Accept: "application/vnd.opentimestamps.v1",
        "User-Agent": "ARCTOS-audit-anchor/1.0",
      },
      body: sha256Hash,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    throw new Error(
      `OpenTimestamps calendar ${calendarUrl} returned HTTP ${resp.status} ${resp.statusText}`,
    );
  }

  const stub = Buffer.from(await resp.arrayBuffer());
  return { calendar: calendarUrl, stub };
}

/**
 * Submit to all calendars in parallel and return the one that responds
 * first. We could persist all three responses for maximum redundancy,
 * but the stubs are inflatable into a valid .ots file later anyway so
 * keeping one is enough for Alpha.
 */
export async function submitToAnyCalendar(
  sha256Hash: Buffer,
  calendars: string[] = DEFAULT_CALENDARS,
  timeoutMs = 15_000,
): Promise<OtsSubmitResult> {
  const attempts = calendars.map((url) => submitToCalendar(sha256Hash, url, timeoutMs));
  return Promise.any(attempts);
}

/**
 * Build a minimal, valid .ots file bytestream given the stubs from the
 * calendars we submitted to. The format per
 * https://github.com/opentimestamps/python-opentimestamps/blob/master/
 * FILE_FORMAT.md is:
 *
 *   "\x00OpenTimestamps\x00\x00Proof\x00\xbf\x89\xe2\xe8\x84\xe8\x92\x94"
 *   <fileHashOp>   -- OP 0x08 (SHA-256)
 *   <digest>       -- 32 bytes
 *   <timestamp>    -- operation tree
 *
 * For our purposes the caller can store `stub` as-is: the calendar
 * server returns a fully-formed timestamp tree, and all the OTS tools
 * prepend the magic header themselves when decoding. But when we want
 * to EXPORT an .ots file that third-party tools can open without our
 * help, we wrap the stub in the header here.
 */
export function buildOtsFile(sha256Hash: Buffer, stub: Buffer): Buffer {
  if (sha256Hash.length !== 32) {
    throw new Error(`SHA-256 hash must be 32 bytes, got ${sha256Hash.length}`);
  }
  // Magic: "\x00OpenTimestamps\x00\x00Proof\x00" + 8-byte proof magic
  const magic = Buffer.concat([
    Buffer.from([0x00]),
    Buffer.from("OpenTimestamps", "ascii"),
    Buffer.from([0x00, 0x00]),
    Buffer.from("Proof", "ascii"),
    Buffer.from([0x00]),
    // Proof format magic bytes (python-opentimestamps/timestamp.py)
    Buffer.from([0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94]),
  ]);
  const version = Buffer.from([0x01]); // protocol version 1
  const fileHashOp = Buffer.from([0x08]); // SHA-256
  return Buffer.concat([magic, version, fileHashOp, sha256Hash, stub]);
}
