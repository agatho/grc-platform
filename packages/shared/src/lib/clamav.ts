// ClamAV malware scanning via the clamd INSTREAM protocol.
//
// Server-only (node:net) — exported via the subpath
// "@grc/shared/lib/clamav", NOT re-exported from the package index.
// Zero dependencies: INSTREAM is a trivial length-prefixed framing on
// a TCP socket, no client library needed.
//
// Configuration (all optional — scanning is opt-in):
//   CLAMAV_HOST           clamd host; when unset, scans are skipped
//                         (status "skipped") with a one-time log notice
//   CLAMAV_PORT           default 3310
//   CLAMAV_TIMEOUT_MS     default 30000
//   CLAMAV_FAIL_CLOSED=1  callers should REJECT uploads when the scan
//                         errors (connection refused, timeout, …).
//                         Default: fail-open (status "error" is treated
//                         as non-blocking so a missing ClamAV container
//                         never breaks uploads).
//
// Protocol: send "zINSTREAM\0", then chunks framed as
// <4-byte big-endian length><data>, terminated by a zero-length chunk.
// clamd answers "stream: OK", "stream: <Signature> FOUND" or
// "... ERROR" (null-terminated because of the z-prefix command).

import { createConnection } from "net";

export type ClamScanStatus = "clean" | "infected" | "skipped" | "error";

export interface ClamScanResult {
  status: ClamScanStatus;
  /** Malware signature name when status === "infected". */
  signature?: string;
  /** Diagnostic message when status === "error". */
  error?: string;
}

/** Minimal structural subset of net.Socket — injectable in tests. */
export interface ClamdSocketLike {
  write(chunk: Uint8Array): boolean;
  end(): void;
  destroy(): void;
  setTimeout(msecs: number, callback?: () => void): unknown;
  on(event: "data", listener: (chunk: Buffer) => void): unknown;
  on(event: "error", listener: (err: Error) => void): unknown;
  on(event: "connect" | "close" | "end", listener: () => void): unknown;
}

export interface ClamScanOptions {
  host?: string;
  port?: number;
  timeoutMs?: number;
  /** Connection factory override for tests. */
  connect?: (host: string, port: number) => ClamdSocketLike;
}

const INSTREAM_CHUNK_SIZE = 8192;

export function isClamAvConfigured(): boolean {
  return Boolean(process.env.CLAMAV_HOST);
}

export function isClamAvFailClosed(): boolean {
  return process.env.CLAMAV_FAIL_CLOSED === "1";
}

/** Parse a raw clamd INSTREAM response line into a scan result. */
export function parseClamdResponse(raw: string): ClamScanResult {
  const line = raw.replace(/\0/g, "").trim();
  if (/^stream: OK$/i.test(line)) {
    return { status: "clean" };
  }
  const found = line.match(/^stream: (.+) FOUND$/i);
  if (found) {
    return { status: "infected", signature: found[1] };
  }
  return {
    status: "error",
    error: line || "Empty response from clamd",
  };
}

let skipNoticeLogged = false;

/**
 * Scan a buffer with clamd. Never throws — connection/protocol
 * failures come back as { status: "error" } so the caller can apply
 * the fail-open / fail-closed policy.
 */
export async function scanBuffer(
  buffer: Buffer,
  options: ClamScanOptions = {},
): Promise<ClamScanResult> {
  const host = options.host ?? process.env.CLAMAV_HOST;
  if (!host && !options.connect) {
    if (!skipNoticeLogged) {
      skipNoticeLogged = true;
      console.info(
        "[clamav] CLAMAV_HOST is not set — malware scanning is disabled, uploads are marked scan_status=skipped. Set CLAMAV_HOST/CLAMAV_PORT to enable scanning.",
      );
    }
    return { status: "skipped" };
  }

  const port =
    options.port ?? Number.parseInt(process.env.CLAMAV_PORT ?? "3310", 10);
  const timeoutMs =
    options.timeoutMs ??
    Number.parseInt(process.env.CLAMAV_TIMEOUT_MS ?? "30000", 10);

  return new Promise<ClamScanResult>((resolvePromise) => {
    let settled = false;
    const chunks: Buffer[] = [];

    let socket: ClamdSocketLike;
    const settle = (result: ClamScanResult): void => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // Socket already gone — nothing to clean up.
      }
      resolvePromise(result);
    };

    try {
      socket = options.connect
        ? options.connect(host ?? "127.0.0.1", port)
        : createConnection({ host, port });
    } catch (err) {
      resolvePromise({
        status: "error",
        error: `clamd connection failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    socket.setTimeout(timeoutMs, () => {
      settle({
        status: "error",
        error: `clamd scan timed out after ${timeoutMs}ms`,
      });
    });

    socket.on("error", (err: Error) => {
      settle({ status: "error", error: `clamd error: ${err.message}` });
    });

    socket.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString("utf8");
      // z-prefixed commands are answered with a NUL-terminated line.
      if (raw.includes("\0") || raw.endsWith("\n")) {
        settle(parseClamdResponse(raw));
      }
    });

    socket.on("close", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (raw.length > 0) {
        settle(parseClamdResponse(raw));
      } else {
        settle({
          status: "error",
          error: "clamd closed the connection without a response",
        });
      }
    });

    socket.on("connect", () => {
      try {
        socket.write(Buffer.from("zINSTREAM\0", "utf8"));
        for (
          let offset = 0;
          offset < buffer.length;
          offset += INSTREAM_CHUNK_SIZE
        ) {
          const chunk = buffer.subarray(offset, offset + INSTREAM_CHUNK_SIZE);
          const frame = Buffer.alloc(4);
          frame.writeUInt32BE(chunk.length, 0);
          socket.write(frame);
          socket.write(chunk);
        }
        const terminator = Buffer.alloc(4);
        terminator.writeUInt32BE(0, 0);
        socket.write(terminator);
      } catch (err) {
        settle({
          status: "error",
          error: `clamd write failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });
  });
}
